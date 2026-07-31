import { criarDriver, type WhatsAppDriver } from '../_shared/whatsapp/index.ts'
import { criarClienteServico, type ClienteServico } from '../_shared/supabase.ts'
import { preflight, respostaJson } from '../_shared/cors.ts'
import { aplicarVariaveis } from '../_shared/bot/variaveis.ts'
import {
  ehComandoSair,
  extrairCnpj,
  extrairNota,
  interpretarEscolha,
  montarMenu,
  type Departamento,
} from '../_shared/bot/fluxo.ts'
import {
  estaAberto,
  momentoNoFuso,
  resumoComercial,
  temPlantonista,
  type Faixa,
} from '../_shared/bot/horario.ts'

// Webhook público: recebe os eventos da uazapi e roda o fluxo do bot. Responde
// 200 rápido. Roda com service role, ignorando a RLS de propósito. Ver docs/bot.md.
//
// Contato SEM cadastro (potencial): o bot pede identificação ANTES do menu e, se
// o cliente mandar o CNPJ, casa com a base de clientes do painel e já vincula.
//
// Enquanto não há uazapi, o driver mock aceita um payload já no formato do
// EventoNormalizado, então dá para simular por POST:
//   { "tipo":"mensagem", "telefone":"+55...", "corpo":"oi", "wa_message_id":"t1", "nome_whatsapp":"Fulano" }

type Ticket = {
  id: string
  protocolo: number
  status: string
  tentativas_menu: number | null
  departamento_id: string | null
  etapa_bot: string | null
}

const agora = () => new Date().toISOString()

async function acharOuCriarContato(sb: ClienteServico, telefone: string, nome: string | null | undefined) {
  const { data: existente } = await sb
    .from('contatos')
    .select('id, nome, nome_whatsapp, cliente_id')
    .eq('telefone', telefone)
    .maybeSingle()
  if (existente) return existente
  const { data, error } = await sb
    .from('contatos')
    .insert({ telefone, nome_whatsapp: nome ?? null })
    .select('id, nome, nome_whatsapp, cliente_id')
    .single()
  if (error) throw error
  return data
}

// `.returns<T>()` aqui e no `carregarFaixas` não é enfeite: o supabase-js analisa
// a string do `.select()` em tempo de tipo para deduzir o formato da linha, e não
// consegue fazer isso quando as colunas vêm de variável — sem ele, o tipo da linha
// vira um erro de parser. Como a tabela também é dinâmica, o formato é afirmado
// aqui e vale o que o chamador pedir.
async function carregarMapa(sb: ClienteServico, tabela: string, chave: string, valor: string) {
  const { data } = await sb
    .from(tabela)
    .select(`${chave}, ${valor}`)
    .returns<Record<string, string>[]>()
  return Object.fromEntries((data ?? []).map((r) => [r[chave], r[valor]])) as Record<string, string>
}

async function carregarDepartamentos(sb: ClienteServico): Promise<Departamento[]> {
  const { data } = await sb
    .from('departamentos')
    .select('id, nome, ordem')
    .eq('ativo', true)
    .order('ordem')
  return (data ?? []) as Departamento[]
}

// `atendimento_horarios` (comercial) tem coluna `ativo`; `atendimento_usuario_horarios`
// (janelas de plantão) não — daí o parâmetro para não pedir coluna inexistente.
async function carregarFaixas(sb: ClienteServico, tabela: string, comAtivo: boolean): Promise<Faixa[]> {
  const cols = comAtivo ? 'dia_semana, hora_inicio, hora_fim, ativo' : 'dia_semana, hora_inicio, hora_fim'
  const { data } = await sb.from(tabela).select(cols).returns<Faixa[]>()
  return data ?? []
}

/**
 * Ticket recém-finalizado que ficou sem a formalização da nota: reabrível.
 * `avaliacao_solicitada_em` não-nulo garante que foi o atendente quem finalizou
 * com a avaliação ativa (o #sair e a avaliação desligada não marcam esse campo);
 * `avaliacao` nula garante que o cliente não deu a nota. Ver docs/bot.md.
 */
async function acharTicketReabertura(sb: ClienteServico, contatoId: string, janelaHoras: number) {
  const limite = new Date(Date.now() - janelaHoras * 3600_000).toISOString()
  const { data } = await sb
    .from('atendimentos')
    .select('id, protocolo, departamento_id')
    .eq('contato_id', contatoId)
    .eq('status', 'finalizado')
    .gte('finalizado_em', limite)
    .is('avaliacao', null)
    .not('avaliacao_solicitada_em', 'is', null)
    .order('finalizado_em', { ascending: false })
    .limit(1)
  return (data && data[0]) || null
}

const SELECT_TICKET = 'id, protocolo, status, tentativas_menu, departamento_id, etapa_bot'

async function acharTicketAberto(sb: ClienteServico, contatoId: string): Promise<Ticket | null> {
  const { data } = await sb
    .from('atendimentos')
    .select(SELECT_TICKET)
    .eq('contato_id', contatoId)
    .in('status', ['triagem', 'na_fila', 'em_atendimento'])
    .order('created_at', { ascending: false })
    .limit(1)
  return (data && data[0]) || null
}

/** Ticket recém-finalizado aguardando a nota de avaliação do cliente. */
async function acharTicketAvaliacao(sb: ClienteServico, contatoId: string) {
  const { data } = await sb
    .from('atendimentos')
    .select('id, protocolo, avaliacao_solicitada_em')
    .eq('contato_id', contatoId)
    .eq('status', 'finalizado')
    .not('avaliacao_solicitada_em', 'is', null)
    .is('avaliacao', null)
    .order('finalizado_em', { ascending: false })
    .limit(1)
  return (data && data[0]) || null
}

async function criarTicketTriagem(sb: ClienteServico, contatoId: string, etapa: string): Promise<Ticket> {
  const { data, error } = await sb
    .from('atendimentos')
    .insert({
      contato_id: contatoId,
      status: 'triagem',
      etapa_bot: etapa,
      canal: 'whatsapp',
      tentativas_menu: 0,
      aberto_em: agora(),
      ultima_mensagem_em: agora(),
    })
    .select(SELECT_TICKET)
    .single()
  if (error) throw error
  return data as Ticket
}

async function gravarEntrada(sb: ClienteServico, ticketId: string, wa_message_id: string, corpo: string | null) {
  await sb.from('atendimento_mensagens').insert({
    atendimento_id: ticketId,
    direcao: 'entrada',
    origem: 'cliente',
    corpo,
    wa_message_id,
    status: 'entregue',
  })
}

async function enviarBot(
  sb: ClienteServico,
  driver: WhatsAppDriver,
  telefone: string,
  ticketId: string,
  textos: string[],
) {
  for (const texto of textos) {
    const { wa_message_id } = await driver.enviarMensagem(telefone, { tipo: 'texto', texto })
    await sb.from('atendimento_mensagens').insert({
      atendimento_id: ticketId,
      direcao: 'saida',
      origem: 'bot',
      corpo: texto,
      wa_message_id,
      status: 'enviado',
    })
  }
  await sb.from('atendimentos').update({ ultima_mensagem_em: agora() }).eq('id', ticketId)
}

// `ticket` entra como anulável porque quem chama é o closure `aplica`, montado
// antes de o chamado existir: ele captura a variável, não o valor. Hoje todas as
// chamadas acontecem com o chamado já resolvido, mas o tipo tem que admitir o
// null, senão o `deno check` reprova — e um `!` aqui só esconderia o dia em que
// alguém mover uma chamada para antes.
function vars(
  nomeContato: string,
  ticket: Ticket | null,
  empresa?: string | null,
  departamento?: string | null,
) {
  return {
    contato: nomeContato,
    empresa: empresa ?? '',
    protocolo: String(ticket?.protocolo ?? ''),
    departamento: departamento ?? '',
    atendente: '',
    horario: '',
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') return respostaJson({ erro: 'Método não suportado' }, 405)

  const segredo = Deno.env.get('WEBHOOK_SECRET')
  if (segredo && req.headers.get('x-webhook-secret') !== segredo) {
    return respostaJson({ erro: 'não autorizado' }, 401)
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return respostaJson({ ok: true })
  }

  try {
    const driver = criarDriver()
    const evento = driver.normalizarWebhook(payload)
    const sb = criarClienteServico()

    if (evento.tipo === 'status_mensagem') {
      await sb
        .from('atendimento_mensagens')
        .update({ status: evento.status })
        .eq('wa_message_id', evento.wa_message_id)
      return respostaJson({ ok: true })
    }
    if (evento.tipo !== 'mensagem') return respostaJson({ ok: true })

    const { data: dup } = await sb
      .from('atendimento_mensagens')
      .select('id')
      .eq('wa_message_id', evento.wa_message_id)
      .maybeSingle()
    if (dup) return respostaJson({ ok: true, dedup: true })

    const contato = await acharOuCriarContato(sb, evento.telefone, evento.nome_whatsapp)
    const nomeContato = contato.nome || contato.nome_whatsapp || evento.telefone

    const [msgs, cfg, deps] = await Promise.all([
      carregarMapa(sb, 'bot_mensagens', 'chave', 'texto'),
      carregarMapa(sb, 'atendimento_config', 'chave', 'valor'),
      carregarDepartamentos(sb),
    ])
    const aplica = (chave: string, empresa?: string | null, departamento?: string | null) =>
      aplicarVariaveis(msgs[chave] ?? '', vars(nomeContato, ticket, empresa, departamento))
    const menuTexto = () => `${aplica('instrucao_menu')}\n${montarMenu(deps)}`

    // Avaliação: se há um atendimento recém-finalizado aguardando a nota, a
    // mensagem é interpretada como a avaliação (dentro do prazo configurado).
    const ticketAval = await acharTicketAvaliacao(sb, contato.id)
    if (ticketAval) {
      const min = Number(cfg['tempo_avaliacao_min'] ?? '60')
      const limite = new Date(ticketAval.avaliacao_solicitada_em).getTime() + min * 60000
      if (Date.now() < limite) {
        await gravarEntrada(sb, ticketAval.id, evento.wa_message_id, evento.corpo)
        const v = (chave: string) =>
          aplicarVariaveis(msgs[chave] ?? '', {
            contato: nomeContato,
            empresa: '',
            protocolo: String(ticketAval.protocolo ?? ''),
            departamento: '',
            atendente: '',
            horario: '',
          })
        const nota = extrairNota(evento.corpo ?? '')
        if (nota === null) {
          await enviarBot(sb, driver, evento.telefone, ticketAval.id, [v('avaliacao_invalida')])
        } else {
          await sb.from('atendimentos').update({ avaliacao: nota, etapa_bot: null }).eq('id', ticketAval.id)
          await enviarBot(sb, driver, evento.telefone, ticketAval.id, [v('agradecimento_avaliacao')])
        }
        return respostaJson({ ok: true, avaliacao: nota })
      }
    }

    let ticket = await acharTicketAberto(sb, contato.id)

    if (!ticket) {
      // Continuação recente sem a nota formalizada: reabre o MESMO chamado (sem
      // menu), em vez de abrir outro. Fora dessa condição, é chamado novo.
      const janelaHoras = Number(cfg['janela_reabertura_horas'] ?? '3')
      const reab = await acharTicketReabertura(sb, contato.id, janelaHoras)
      if (reab) {
        await sb
          .from('atendimentos')
          .update({ status: 'na_fila', responsavel_id: null, etapa_bot: null, ultima_mensagem_em: agora() })
          .eq('id', reab.id)
        await gravarEntrada(sb, reab.id, evento.wa_message_id, evento.corpo)
        return respostaJson({ ok: true, reaberto: true, protocolo: reab.protocolo })
      }

      // Chamado novo: decide pelo horário (comercial / plantão / fora).
      const [comercial, janelas] = await Promise.all([
        carregarFaixas(sb, 'atendimento_horarios', true),
        carregarFaixas(sb, 'atendimento_usuario_horarios', false),
      ])
      const momento = momentoNoFuso(cfg['timezone'] ?? 'America/Sao_Paulo', new Date())
      const aberto = estaAberto(comercial, momento)
      const plantao = !aberto && temPlantonista(janelas, momento)

      if (!aberto && !plantao) {
        // Fora do comercial e sem plantonista: só direciona, não cria ticket.
        await driver.enviarMensagem(evento.telefone, {
          tipo: 'texto',
          texto: aplicarVariaveis(msgs['fora_horario'] ?? '', {
            contato: nomeContato,
            empresa: '',
            protocolo: '',
            departamento: '',
            atendente: '',
            horario: resumoComercial(comercial),
          }),
        })
        return respostaJson({ ok: true, fora_horario: true })
      }

      // Saudação do plantão substitui a boas-vindas; o resto do fluxo é igual.
      const conhecido = !!contato.cliente_id
      ticket = await criarTicketTriagem(sb, contato.id, conhecido ? 'menu' : 'identificacao')
      await gravarEntrada(sb, ticket.id, evento.wa_message_id, evento.corpo)
      const saudacao = plantao ? aplica('plantao') : aplica('bem_vindo')
      await enviarBot(sb, driver, evento.telefone, ticket.id,
        conhecido ? [saudacao, menuTexto()] : [saudacao, aplica('pedir_identificacao')])
      return respostaJson({ ok: true, protocolo: ticket.protocolo, plantao })
    }

    await gravarEntrada(sb, ticket.id, evento.wa_message_id, evento.corpo)

    if (ehComandoSair(evento.corpo ?? '') && (cfg['permitir_cliente_finalizar'] ?? 'true') === 'true') {
      await sb
        .from('atendimentos')
        .update({ status: 'finalizado', finalizado_em: agora(), encerrado_por: 'cliente' })
        .eq('id', ticket.id)
      await enviarBot(sb, driver, evento.telefone, ticket.id, [aplica('encerramento')])
      return respostaJson({ ok: true })
    }

    if (ticket.status === 'triagem' && ticket.etapa_bot === 'identificacao') {
      // Resposta da identificação: tenta casar o CNPJ com a base de clientes.
      const digitos = extrairCnpj(evento.corpo ?? '')
      let empresaVinculada: string | null = null
      if (digitos) {
        const { data } = await sb.rpc('atendimento_buscar_cliente_por_cnpj', { p_digitos: digitos })
        const cliente = data && data[0]
        if (cliente) {
          await sb.from('contatos').update({ cliente_id: cliente.id }).eq('id', contato.id)
          empresaVinculada = cliente.nome_fantasia || cliente.razao_social
        }
      }
      await sb.from('atendimentos').update({ etapa_bot: 'menu' }).eq('id', ticket.id)
      const respostas = empresaVinculada
        ? [aplica('identificacao_vinculada', empresaVinculada), menuTexto()]
        : [menuTexto()]
      await enviarBot(sb, driver, evento.telefone, ticket.id, respostas)
      return respostaJson({ ok: true, vinculado: !!empresaVinculada })
    }

    if (ticket.status === 'triagem') {
      // etapa 'menu' (ou legado nulo): interpreta a escolha do setor.
      const dep = interpretarEscolha(evento.corpo ?? '', deps)
      if (dep) {
        await sb
          .from('atendimentos')
          .update({ departamento_id: dep.id, status: 'na_fila' })
          .eq('id', ticket.id)
        await enviarBot(sb, driver, evento.telefone, ticket.id, [aplica('entrou_fila', null, dep.nome)])
      } else {
        const tent = (ticket.tentativas_menu ?? 0) + 1
        const max = Number(cfg['max_tentativas_menu'] ?? '2')
        if (tent >= max) {
          const padrao = deps.find((d) => d.id === cfg['departamento_padrao_id']) ?? deps[0]
          await sb
            .from('atendimentos')
            .update({ departamento_id: padrao?.id ?? null, status: 'na_fila', tentativas_menu: tent })
            .eq('id', ticket.id)
          await enviarBot(sb, driver, evento.telefone, ticket.id, [aplica('encaminhado_padrao', null, padrao?.nome)])
        } else {
          await sb.from('atendimentos').update({ tentativas_menu: tent }).eq('id', ticket.id)
          await enviarBot(sb, driver, evento.telefone, ticket.id, [`${aplica('opcao_invalida')}\n${montarMenu(deps)}`])
        }
      }
      return respostaJson({ ok: true })
    }

    // na_fila / em_atendimento: só registra a mensagem; o operador responde.
    await sb.from('atendimentos').update({ ultima_mensagem_em: agora() }).eq('id', ticket.id)
    return respostaJson({ ok: true })
  } catch (erro) {
    console.error('whatsapp-webhook', erro)
    return respostaJson({ ok: true })
  }
})
