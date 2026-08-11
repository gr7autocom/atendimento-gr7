/**
 * Canal web: a única porta entre o PWA do cliente e o banco.
 *
 * ⚠️ DUAS REGRAS QUE ESTA FUNÇÃO NUNCA PODE QUEBRAR ⚠️
 *
 * 1. **Nenhuma ação aceita id de linha vindo do cliente.** O `atendimento_id` sai
 *    SEMPRE do lookup da sessão, nunca do corpo. Esta função roda com service role
 *    e ignora a RLS: no dia em que alguém aceitar um `atendimento_id` no corpo
 *    "para facilitar", qualquer pessoa lê qualquer conversa da base.
 *
 * 2. **Nunca devolver dado interno.** Evento do chamado ("Fulano assumiu") é
 *    interno. `remetente_usuario_id`, `wa_message_id`, `canal`, `client_msg_id`,
 *    tags, motivo e ids de contato/cliente não saem. Do atendente, só o primeiro
 *    nome. O `select` das mensagens é explícito por isso — `select('*')` aqui vaza.
 *
 * Por que service role e não policies para `anon`: a RLS inteira é construída sobre
 * `usuarios` internos, e criar acesso anônimo num banco compartilhado com o painel
 * em produção seria a mudança de maior risco do projeto. Com esta função como porta
 * única, o role `anon` continua sem policy nenhuma. Ver docs/canal-web.md (ADR-11).
 *
 * Deploy: precisa de `--no-verify-jwt`, como o whatsapp-webhook, senão o Supabase
 * exige `Authorization: Bearer <anon>` e o PWA (que não embarca chave) é barrado.
 */

import { criarClienteServico, type ClienteServico } from '../_shared/supabase.ts'
import { MAX_ANEXO_BYTES, subirParaCloudinary, tipoAceito } from '../_shared/web/anexo.ts'
import { preflightWeb, respostaDeErro, respostaJsonWeb } from '../_shared/cors-web.ts'
import {
  ErroContrato,
  MAX_CORPO_BYTES,
  primeiroNome,
  validarClientMsgId,
  validarCnpjOpcional,
  validarMensagem,
  validarNome,
  validarNota,
  validarUuid,
} from '../_shared/web/contrato.ts'
import {
  expiracaoAbsoluta,
  gerarToken,
  hashToken,
  prefixoToken,
  sessaoValida,
} from '../_shared/web/sessao.ts'
import {
  CHAVE_GLOBAL,
  LIMITES,
  chaveIp,
  chaveTelefone,
  estourou,
  hashIp,
  inicioDaJanela,
  ipDaRequisicao,
  type AcaoLimitada,
} from '../_shared/web/limites.ts'
import { normalizarTelefoneBR } from '../_shared/telefone.ts'
import { estaAberto, momentoNoFuso, resumoComercial, temPlantonista, type Faixa } from '../_shared/bot/horario.ts'
import { aplicarVariaveis } from '../_shared/bot/variaveis.ts'

const CANAL = 'web'
const agora = () => new Date()

// Só o que o cliente pode ver. Explícito de propósito: `select('*')` traria
// remetente_usuario_id, wa_message_id, canal e client_msg_id junto.
/*
  A mensagem apagada **não entra nesta lista**: ela é filtrada na consulta, e
  some da tela do cliente. Do lado da equipe ela continua visível, com o corpo,
  marcada como apagada, porque quem manda na empresa lê a conversa depois e
  precisa saber o que foi enviado. É por isso que `excluida` não está aqui:
  filtrar no servidor é mais forte que mandar o campo e confiar na tela.

  `resposta_id` fica de fora pelo mesmo motivo de sempre, é id de linha; a
  citação viaja pela cópia (`resposta_corpo` e `resposta_remetente`).

  `editada_em` entra: o cliente vê "editada" na própria mensagem, como no
  WhatsApp. `corpo_original` NÃO entra, é registro para a equipe.
*/
const SELECT_MENSAGEM = 'id, direcao, origem, corpo, created_at, editada_em, resposta_corpo, resposta_remetente'

/** Quanto tempo o cliente tem para mexer no que mandou. Mesmos prazos do WhatsApp. */
const JANELA_APAGAR_MIN = 60
const JANELA_EDITAR_MIN = 15

// Mesma disciplina do select acima. `public_id` fica de fora: é o identificador
// interno no Cloudinary, serve para apagar do nosso lado e não diz nada ao
// cliente, que só precisa da URL para ver o arquivo.
const SELECT_ANEXO = 'id, mensagem_id, url, nome_arquivo, tipo_mime, tamanho_bytes'

/*
  Textos deste canal, editáveis na aba "Canal web" de Configurações do bot
  (chaves `web_*` em `bot_mensagens`, migration 20260807120000).

  Existem separados dos do WhatsApp porque os de lá mandam digitar o número do
  setor e digitar #sair, instruções que aqui seriam falsas: a escolha é botão e
  encerrar é botão.

  Os valores abaixo são **reserva**, não a fonte: se a chave sumir do banco ou
  vier vazia, o canal continua falando em vez de mandar mensagem em branco ao
  cliente.
*/
const RESERVA = {
  pergunta_setor: 'Sobre qual assunto você precisa falar? Escolha uma das opções abaixo.',
  pedir_relato: 'Pode contar o que está acontecendo que já vamos te atender.',
  entrou_fila:
    'Protocolo {{protocolo}}. Você entrou na fila do setor {{departamento}} e um atendente responde por aqui. Para sair antes, use o botão Encerrar no topo da tela.',
}

/** Texto do canal web: o do banco quando existe, a reserva quando não. */
function textoWeb(textos: Config, chave: keyof typeof RESERVA): string {
  return (textos[`web_${chave}`] ?? '').trim() || RESERVA[chave]
}

type Config = Record<string, string>

// ===== leitura de catálogo =====

async function carregarConfig(sb: ClienteServico): Promise<Config> {
  const { data } = await sb.from('atendimento_config').select('chave, valor').returns<
    { chave: string; valor: string }[]
  >()
  return Object.fromEntries((data ?? []).map((r) => [r.chave, r.valor]))
}

async function carregarTextos(sb: ClienteServico): Promise<Config> {
  const { data } = await sb
    .from('bot_mensagens')
    .select('chave, texto')
    .eq('ativo', true)
    .returns<{ chave: string; texto: string }[]>()
  return Object.fromEntries((data ?? []).map((r) => [r.chave, r.texto]))
}

async function carregarFaixas(sb: ClienteServico, tabela: string, comAtivo: boolean): Promise<Faixa[]> {
  const cols = comAtivo ? 'dia_semana, hora_inicio, hora_fim, ativo' : 'dia_semana, hora_inicio, hora_fim'
  const { data } = await sb.from(tabela).select(cols).returns<Faixa[]>()
  return data ?? []
}

/** Mesma decisão do WhatsApp: fora do comercial só abre com plantonista de janela ativa. */
async function estadoDoHorario(sb: ClienteServico, cfg: Config) {
  const [comercial, plantao] = await Promise.all([
    carregarFaixas(sb, 'atendimento_horarios', true),
    carregarFaixas(sb, 'atendimento_usuario_horarios', false),
  ])
  const momento = momentoNoFuso(cfg.timezone ?? 'America/Sao_Paulo', agora())
  const aberto = estaAberto(comercial.filter((f) => f.ativo !== false), momento)
  const plantonista = temPlantonista(plantao, momento)
  return { aberto, plantonista, podeAbrir: aberto || plantonista, resumo: resumoComercial(comercial) }
}

// ===== rate limit =====

async function conferirLimite(sb: ClienteServico, chave: string, acao: AcaoLimitada) {
  const limite = LIMITES[acao]
  const { count } = await sb
    .from('atendimento_web_tentativas')
    .select('id', { count: 'exact', head: true })
    .eq('chave', chave)
    .eq('acao', acao)
    .gte('created_at', inicioDaJanela(limite, agora()))
  if (estourou(limite, count ?? 0)) throw new ErroContrato('limite', 429)
}

async function registrarTentativa(sb: ClienteServico, chave: string, acao: AcaoLimitada) {
  await sb.from('atendimento_web_tentativas').insert({ chave, acao })
}

// ===== sessão =====

type SessaoResolvida = {
  id: string
  atendimento_id: string
  contato_id: string
}

/**
 * Resolve a sessão pelo header. É daqui que sai o `atendimento_id` de toda rota
 * autenticada — nunca do corpo da requisição.
 */
async function exigirSessao(sb: ClienteServico, req: Request): Promise<SessaoResolvida> {
  const token = req.headers.get('x-sessao')?.trim()
  if (!token) throw new ErroContrato('sessao_invalida', 401)

  const { data } = await sb
    .from('atendimento_web_sessoes')
    .select('id, atendimento_id, contato_id, expira_em, ultimo_uso_em, revogada_em')
    .eq('token_hash', await hashToken(token))
    .maybeSingle()

  if (!data || !sessaoValida(data, agora())) throw new ErroContrato('sessao_invalida', 401)

  // O polling já serve de batimento: mantém a sessão viva e alimenta o indicador
  // de presença que o atendente vê na conversa.
  await sb
    .from('atendimento_web_sessoes')
    .update({ ultimo_uso_em: agora().toISOString() })
    .eq('id', data.id)

  return { id: data.id, atendimento_id: data.atendimento_id, contato_id: data.contato_id }
}

// ===== rotas =====

async function rotaDisponibilidade(sb: ClienteServico, req: Request): Promise<Response> {
  const [cfg, textos] = await Promise.all([carregarConfig(sb), carregarTextos(sb)])
  const horario = await estadoDoHorario(sb, cfg)
  const { data: deps } = await sb
    .from('departamentos')
    .select('id, nome')
    .eq('ativo', true)
    .order('ordem')

  return respostaJsonWeb(req, {
    pode_abrir: horario.podeAbrir,
    plantao: !horario.aberto && horario.plantonista,
    // Mesmo texto configurado em Configurações BOT: uma voz só nos dois canais.
    mensagem_fora_horario: horario.podeAbrir
      ? null
      : aplicarVariaveis(textos.fora_horario ?? '', { horario: horario.resumo }),
    departamentos: deps ?? [],
    /*
      As falas do bot vao junto porque, ate a primeira mensagem do cliente, NAO
      EXISTE chamado: a conversa acontece so na tela. Mandar os textos daqui
      mantem o servidor como fonte da voz (o `bem_vindo` e o mesmo do WhatsApp) e
      garante que o que a pessoa leu e exatamente o que sera gravado depois.
    */
    textos: {
      bem_vindo: textos.bem_vindo ?? '',
      pergunta_setor: textoWeb(textos, 'pergunta_setor'),
      pedir_relato: textoWeb(textos, 'pedir_relato'),
    },
  })
}

async function rotaIdentificar(sb: ClienteServico, req: Request, corpo: Record<string, unknown>) {
  const nome = validarNome(corpo.nome)
  const cnpj = validarCnpjOpcional(corpo.cnpj)
  const departamentoId = validarUuid(corpo.departamento_id, 'departamento_id')
  const mensagem = validarMensagem(corpo.mensagem)
  if (corpo.aceite !== true) throw new ErroContrato('campo_invalido', 400, 'aceite')

  const telefone = normalizarTelefoneBR(corpo.telefone)
  if (!telefone) throw new ErroContrato('campo_invalido', 400, 'telefone')

  const ipHash = await hashIp(ipDaRequisicao(req), Deno.env.get('IP_HASH_SALT') ?? 'gr7')
  await conferirLimite(sb, chaveIp(ipHash), 'identificarPorIp')
  await conferirLimite(sb, chaveTelefone(telefone), 'identificarPorTelefone')
  await conferirLimite(sb, CHAVE_GLOBAL, 'aberturaGlobal')
  await registrarTentativa(sb, chaveIp(ipHash), 'identificarPorIp')
  await registrarTentativa(sb, chaveTelefone(telefone), 'identificarPorTelefone')
  await registrarTentativa(sb, CHAVE_GLOBAL, 'aberturaGlobal')

  const cfg = await carregarConfig(sb)
  const horario = await estadoDoHorario(sb, cfg)
  if (!horario.podeAbrir) throw new ErroContrato('fora_horario', 409)

  const { data: dep } = await sb
    .from('departamentos')
    .select('id, nome')
    .eq('id', departamentoId)
    .eq('ativo', true)
    .maybeSingle()
  if (!dep) throw new ErroContrato('departamento_invalido', 400, 'departamento_id')

  // ----- contato: get-or-create pelo telefone, que é a identidade -----
  const { data: existente } = await sb
    .from('contatos')
    .select('id, nome, cliente_id')
    .eq('telefone', telefone)
    .maybeSingle()

  let contatoId: string
  let clienteId: string | null = existente?.cliente_id ?? null

  if (existente) {
    contatoId = existente.id
    // Contato que já existe NUNCA é sobrescrito: só o que está vazio é preenchido.
    // O telefone não é verificado, então deixar o PWA reescrever nome ou empresa
    // permitiria alterar o cadastro de outra pessoa só digitando o número dela.
    if (!existente.nome) await sb.from('contatos').update({ nome }).eq('id', contatoId)
  } else {
    const { data: novo, error } = await sb
      .from('contatos')
      .insert({ telefone, nome })
      .select('id, cliente_id')
      .single()
    if (error) throw error
    contatoId = novo.id
  }

  // Vínculo por CNPJ só quando o contato ainda não tem empresa. Telefone que já
  // pertence a uma empresa manda, mesmo que o CNPJ digitado diga outra coisa:
  // ninguém rouba vínculo pelo PWA.
  if (!clienteId && cnpj) {
    const { data: cliente } = await sb.rpc('atendimento_buscar_cliente_por_cnpj', { p_digitos: cnpj })
    const achado = Array.isArray(cliente) ? cliente[0] : null
    if (achado) {
      clienteId = achado.id
      await sb.from('contatos').update({ cliente_id: achado.id }).eq('id', contatoId)
    }
  }

  // ----- chamado -----
  /*
    Criado so agora, com setor E primeira mensagem (decisao de 2026-08-07).

    Ate aqui a conversa aconteceu na tela do cliente, sem gravar nada: quem
    desiste no meio da escolha do setor nao deixa contato orfao, chamado vazio
    nem protocolo gasto. Nasce direto em `na_fila`, porque ja tem tudo o que a
    fila precisa. Sem empresa, cai naturalmente em Potenciais na inbox.
  */
  const { data: chamado, error: eChamado } = await sb
    .from('atendimentos')
    .insert({
      contato_id: contatoId,
      departamento_id: dep.id,
      status: 'na_fila',
      canal: CANAL,
      aberto_em: agora().toISOString(),
      ultima_mensagem_em: agora().toISOString(),
    })
    .select('id, protocolo')
    .single()
  if (eChamado) throw eChamado

  /*
    A conversa e gravada inteira, na mesma ordem em que o cliente a viveu na
    tela. O atendente precisa ler o caminho todo, inclusive a escolha do setor:
    sem isso ele abre um chamado que comeca no meio.

    `bem_vindo` vem do banco (mesma voz do WhatsApp); a pergunta do setor e o
    pedido de relato sao textos deste canal, porque o do banco
    (`instrucao_menu`) manda digitar o NUMERO do setor, instrucao que aqui seria
    falsa.
  */
  const textos = await carregarTextos(sb)
  const bemVindo = aplicarVariaveis(textos.bem_vindo ?? '', {
    nome,
    departamento: dep.nome,
    protocolo: String(chamado.protocolo),
  })
  const roteiro: { origem: 'bot' | 'cliente'; corpo: string }[] = [
    ...(bemVindo ? [{ origem: 'bot' as const, corpo: bemVindo }] : []),
    { origem: 'bot', corpo: textoWeb(textos, 'pergunta_setor') },
    { origem: 'cliente', corpo: dep.nome },
    { origem: 'bot', corpo: textoWeb(textos, 'pedir_relato') },
    { origem: 'cliente', corpo: mensagem },
    // Por último: o protocolo só existe depois de o chamado nascer, e é aqui que
    // ele de fato entra na fila.
    {
      origem: 'bot',
      corpo: aplicarVariaveis(textoWeb(textos, 'entrou_fila'), {
        protocolo: String(chamado.protocolo),
        departamento: dep.nome,
      }),
    },
  ]
  for (const fala of roteiro) {
    await sb.from('atendimento_mensagens').insert({
      atendimento_id: chamado.id,
      direcao: fala.origem === 'cliente' ? 'entrada' : 'saida',
      origem: fala.origem,
      corpo: fala.corpo,
    })
  }

  /*
    O trigger `registrar_evento_atendimento` grava o evento `atendimento_aberto`
    no instante do INSERT acima, ou seja, ANTES do roteiro que acabou de ser
    gravado. Sem este ajuste, a pílula "Atendimento #N" na conversa do atendente
    ordena antes da própria boas-vindas reconstituída, dando a entender que o
    chamado existia antes de a triagem começar — quando na verdade ele só nasce
    ao final dela. Empurrar o timestamp do evento para depois do roteiro corrige
    a ordem sem mexer no trigger (compartilhado com o WhatsApp, onde a ordem já
    sai certa: lá cada mensagem chega numa requisição separada, de verdade).
  */
  await sb
    .from('atendimento_eventos')
    .update({ created_at: agora().toISOString() })
    .eq('atendimento_id', chamado.id)
    .eq('tipo', 'atendimento_aberto')

  // ----- sessão -----
  const token = gerarToken()
  const expira = expiracaoAbsoluta(agora())
  const { error: eSessao } = await sb.from('atendimento_web_sessoes').insert({
    atendimento_id: chamado.id,
    contato_id: contatoId,
    token_hash: await hashToken(token),
    token_prefixo: prefixoToken(token),
    ip_hash: ipHash,
    expira_em: expira,
    aceite_em: agora().toISOString(),
  })
  if (eSessao) throw eSessao

  let empresa: string | null = null
  if (clienteId) {
    const { data: c } = await sb
      .from('clientes')
      .select('razao_social, nome_fantasia')
      .eq('id', clienteId)
      .maybeSingle()
    empresa = c?.nome_fantasia || c?.razao_social || null
  }

  return respostaJsonWeb(req, {
    token,
    expira_em: expira,
    protocolo: chamado.protocolo,
    departamento: dep.nome,
    empresa,
  }, 201)
}

async function rotaConversa(sb: ClienteServico, req: Request): Promise<Response> {
  const sessao = await exigirSessao(sb, req)

  // `.returns<T>()` porque o supabase-js infere embed como array mesmo quando a
  // relação é muitos-para-um. Mesmo motivo do `carregarMapa` no whatsapp-webhook.
  type ChamadoDaConversa = {
    id: string
    protocolo: number
    status: string
    avaliacao: number | null
    avaliacao_solicitada_em: string | null
    departamento: { nome: string } | null
    responsavel: { nome: string } | null
  }

  const { data: chamados } = await sb
    .from('atendimentos')
    .select(
      'id, protocolo, status, avaliacao, avaliacao_solicitada_em, departamento:departamentos(nome), responsavel:usuarios(nome)'
    )
    .eq('id', sessao.atendimento_id)
    .limit(1)
    .returns<ChamadoDaConversa[]>()

  const chamado = chamados?.[0]
  if (!chamado) throw new ErroContrato('sessao_invalida', 401)

  const { data: mensagens } = await sb
    .from('atendimento_mensagens')
    .select(SELECT_MENSAGEM)
    .eq('atendimento_id', sessao.atendimento_id)
    // Apagada some para o cliente. Filtrar aqui, e não na tela, é o que garante
    // que o texto nem chega ao navegador dele.
    .eq('excluida', false)
    .order('created_at')

  /*
    Anexos em consulta separada, não aninhada no select acima. Aninhar
    obrigaria a montar a string do `select` com a lista de campos do anexo
    dentro da das mensagens, e a guarda que fecha `SELECT_MENSAGEM` deixaria de
    conseguir lê-la. Duas listas explícitas valem mais que uma string composta.
  */
  const idsMensagem = (mensagens ?? []).map((m) => m.id)
  const { data: anexos } = idsMensagem.length
    ? await sb.from('atendimento_anexos').select(SELECT_ANEXO).in('mensagem_id', idsMensagem).order('created_at')
    : { data: [] }

  return respostaJsonWeb(req, {
    protocolo: chamado.protocolo,
    status: chamado.status,
    encerrado: chamado.status === 'finalizado',
    departamento: chamado.departamento?.nome ?? null,
    // Só o primeiro nome: nome completo de funcionário é dado pessoal e não
    // acrescenta nada a quem está sendo atendido.
    atendente: primeiroNome(chamado.responsavel?.nome),
    aguardando_avaliacao: Boolean(chamado.avaliacao_solicitada_em) && chamado.avaliacao === null,
    mensagens: mensagens ?? [],
    anexos: anexos ?? [],
  })
}

/**
 * Garante que o chamado aceita mensagem nova, reabrindo dentro da janela.
 *
 * Extraído porque texto e anexo passam pela mesma regra: se cada rota tivesse a
 * sua cópia, a próxima mudança de prazo acertaria uma e esqueceria a outra, e o
 * cliente descobriria mandando um print que "não pode" logo depois de mandar um
 * texto que pôde.
 */
async function garantirChamadoAberto(sb: ClienteServico, atendimentoId: string) {
  const cfg = await carregarConfig(sb)
  const janelaH = Number(cfg.janela_reabertura_horas ?? 3)

  const { data: chamado } = await sb
    .from('atendimentos')
    .select('id, status, finalizado_em')
    .eq('id', atendimentoId)
    .maybeSingle()
  if (!chamado) throw new ErroContrato('sessao_invalida', 401)

  // Reabertura dentro da janela: mesma regra do WhatsApp, mesmo protocolo. No PWA
  // ela é explícita na tela ("escrever de novo reabre"), nunca silenciosa.
  if (chamado.status === 'finalizado') {
    const fim = new Date(chamado.finalizado_em ?? 0).getTime()
    if (agora().getTime() - fim > janelaH * 3600_000) throw new ErroContrato('sessao_encerrada', 409)
    await sb
      .from('atendimentos')
      .update({ status: 'na_fila', responsavel_id: null, etapa_bot: null })
      .eq('id', chamado.id)
  }
}

/**
 * Anexo do cliente. Recebe o arquivo em `multipart/form-data`, confere, sobe ao
 * Cloudinary pelo servidor (ver `_shared/web/anexo.ts`) e grava a mensagem com
 * o anexo junto.
 *
 * Mensagem e anexo na mesma chamada de propósito: em duas chamadas, a queda de
 * rede entre elas deixaria a conversa com "segue o print" e print nenhum.
 */
async function rotaAnexo(sb: ClienteServico, req: Request) {
  const sessao = await exigirSessao(sb, req)

  await conferirLimite(sb, `sess:${sessao.id}`, 'mensagemPorSessao')
  await registrarTentativa(sb, `sess:${sessao.id}`, 'mensagemPorSessao')

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    throw new ErroContrato('requisicao_invalida', 400)
  }

  const arquivo = form.get('arquivo')
  if (!(arquivo instanceof File)) throw new ErroContrato('requisicao_invalida', 400)
  if (arquivo.size === 0 || arquivo.size > MAX_ANEXO_BYTES) throw new ErroContrato('arquivo_grande', 413)
  if (!tipoAceito(arquivo.type)) throw new ErroContrato('arquivo_tipo', 415)

  const legenda = form.get('mensagem')
  const texto = typeof legenda === 'string' && legenda.trim() ? legenda.trim().slice(0, 2000) : null

  await garantirChamadoAberto(sb, sessao.atendimento_id)

  // O upload vem antes do insert: com o insert primeiro, uma falha no
  // Cloudinary deixaria na conversa uma mensagem que promete um arquivo
  // inexistente. Na ordem inversa o pior caso é um arquivo órfão lá, que não
  // aparece para ninguém.
  const enviado = await subirParaCloudinary(arquivo)

  const { data: msg, error } = await sb
    .from('atendimento_mensagens')
    .insert({
      atendimento_id: sessao.atendimento_id,
      direcao: 'entrada',
      origem: 'cliente',
      corpo: texto,
    })
    .select('id')
    .single()
  if (error) throw error

  const { error: errAnexo } = await sb.from('atendimento_anexos').insert({
    mensagem_id: msg.id,
    public_id: enviado.public_id,
    url: enviado.url,
    nome_arquivo: enviado.nome_arquivo,
    tipo_mime: enviado.tipo_mime,
    tamanho_bytes: enviado.tamanho_bytes,
  })
  if (errAnexo) throw errAnexo

  await sb
    .from('atendimentos')
    .update({ ultima_mensagem_em: agora().toISOString() })
    .eq('id', sessao.atendimento_id)

  return respostaJsonWeb(req, { ok: true })
}

/**
 * Localiza uma mensagem do PRÓPRIO cliente, dentro do prazo.
 *
 * Três conferências, e nenhuma é dispensável:
 *
 * - a mensagem pertence ao chamado **desta sessão**, senão o id vindo do corpo
 *   viraria uma forma de mexer na conversa alheia;
 * - a origem é `cliente`, senão ele apagaria a resposta do atendente;
 * - está dentro da janela, senão daria para limpar um relato de semanas atrás
 *   depois de o atendimento inteiro ter acontecido em cima dele.
 */
async function mensagemDoCliente(
  sb: ClienteServico,
  sessao: { id: string; atendimento_id: string },
  idBruto: unknown,
  janelaMin: number
) {
  if (typeof idBruto !== 'string' || !/^[0-9a-f-]{36}$/i.test(idBruto)) {
    throw new ErroContrato('requisicao_invalida', 400)
  }

  const { data: msg } = await sb
    .from('atendimento_mensagens')
    .select('id, origem, corpo, created_at, excluida')
    .eq('id', idBruto)
    .eq('atendimento_id', sessao.atendimento_id)
    .maybeSingle()

  if (!msg || msg.origem !== 'cliente' || msg.excluida) throw new ErroContrato('mensagem_indisponivel', 404)

  const idade = agora().getTime() - new Date(msg.created_at).getTime()
  if (idade > janelaMin * 60_000) throw new ErroContrato('prazo_encerrado', 409)

  return msg
}

/**
 * Cliente apaga a própria mensagem.
 *
 * Ela some da tela dele e **continua** na da equipe, com o corpo, marcada. Não
 * é meio-termo: é o que permite ao atendente saber que houve mensagem e o que
 * ela dizia, num histórico que é prova do atendimento por cinco anos. Apagar de
 * verdade transformaria o apagar numa forma de reescrever o relato depois de o
 * trabalho ter começado em cima dele.
 */
async function rotaApagarMensagem(sb: ClienteServico, req: Request, corpo: Record<string, unknown>) {
  const sessao = await exigirSessao(sb, req)
  const msg = await mensagemDoCliente(sb, sessao, corpo.mensagem_id, JANELA_APAGAR_MIN)

  const { error } = await sb
    .from('atendimento_mensagens')
    .update({ excluida: true, excluida_por: 'cliente', excluida_em: agora().toISOString() })
    .eq('id', msg.id)
  if (error) throw error

  return respostaJsonWeb(req, { ok: true })
}

/**
 * Cliente edita a própria mensagem.
 *
 * O texto novo vai para `corpo` e o primeiro fica em `corpo_original`, que só a
 * equipe vê. Sem guardar o original, editar seria um jeito silencioso de trocar
 * o que está no histórico, com o mesmo efeito que o apagar sem registro teria.
 */
async function rotaEditarMensagem(sb: ClienteServico, req: Request, corpo: Record<string, unknown>) {
  const sessao = await exigirSessao(sb, req)
  const texto = validarMensagem(corpo.mensagem)
  const msg = await mensagemDoCliente(sb, sessao, corpo.mensagem_id, JANELA_EDITAR_MIN)

  const { error } = await sb
    .from('atendimento_mensagens')
    .update({
      corpo: texto,
      // Só na primeira edição: editar duas vezes não pode apagar o texto que
      // saiu do teclado da pessoa da primeira vez.
      corpo_original: msg.corpo,
      editada_em: agora().toISOString(),
    })
    .eq('id', msg.id)
    .is('corpo_original', null)
  if (error) throw error

  // Segunda edição em diante: o original já está guardado, então só o texto
  // atual e o carimbo mudam.
  const { error: err2 } = await sb
    .from('atendimento_mensagens')
    .update({ corpo: texto, editada_em: agora().toISOString() })
    .eq('id', msg.id)
    .not('corpo_original', 'is', null)
  if (err2) throw err2

  return respostaJsonWeb(req, { ok: true })
}

async function rotaMensagem(sb: ClienteServico, req: Request, corpo: Record<string, unknown>) {
  const sessao = await exigirSessao(sb, req)
  const texto = validarMensagem(corpo.mensagem)
  const clientMsgId = validarClientMsgId(corpo.client_msg_id)

  await conferirLimite(sb, `sess:${sessao.id}`, 'mensagemPorSessao')
  await registrarTentativa(sb, `sess:${sessao.id}`, 'mensagemPorSessao')

  await garantirChamadoAberto(sb, sessao.atendimento_id)

  const { error } = await sb.from('atendimento_mensagens').insert({
    atendimento_id: sessao.atendimento_id,
    direcao: 'entrada',
    origem: 'cliente',
    corpo: texto,
    client_msg_id: clientMsgId,
  })
  // 23505 é o envio repetido (clique duplo, reenvio após queda): a conversa já tem
  // a mensagem, então é sucesso do ponto de vista de quem mandou.
  if (error && error.code !== '23505') throw error

  await sb
    .from('atendimentos')
    .update({ ultima_mensagem_em: agora().toISOString() })
    .eq('id', sessao.atendimento_id)

  return respostaJsonWeb(req, { ok: true })
}

async function rotaEncerrar(sb: ClienteServico, req: Request): Promise<Response> {
  const sessao = await exigirSessao(sb, req)
  const cfg = await carregarConfig(sb)
  if (cfg.permitir_cliente_finalizar === 'false') {
    throw new ErroContrato('encerramento_indisponivel', 409)
  }

  // `encerrado_por = 'cliente'` faz o gatilho de avaliação NÃO disparar, igual ao
  // `#sair` do WhatsApp: quem desligou não é quem se pede para avaliar.
  await sb
    .from('atendimentos')
    .update({
      status: 'finalizado',
      finalizado_em: agora().toISOString(),
      encerrado_por: 'cliente',
    })
    .eq('id', sessao.atendimento_id)
    .neq('status', 'finalizado')

  return respostaJsonWeb(req, { ok: true })
}

async function rotaAvaliar(sb: ClienteServico, req: Request, corpo: Record<string, unknown>) {
  const sessao = await exigirSessao(sb, req)
  const nota = validarNota(corpo.nota)
  const cfg = await carregarConfig(sb)

  const { data: chamado } = await sb
    .from('atendimentos')
    .select('id, avaliacao, avaliacao_solicitada_em')
    .eq('id', sessao.atendimento_id)
    .maybeSingle()

  if (!chamado?.avaliacao_solicitada_em || chamado.avaliacao !== null) {
    throw new ErroContrato('avaliacao_indisponivel', 409)
  }
  const prazoMin = Number(cfg.tempo_avaliacao_min ?? 30)
  const pedidoEm = new Date(chamado.avaliacao_solicitada_em).getTime()
  if (agora().getTime() - pedidoEm > prazoMin * 60_000) {
    throw new ErroContrato('avaliacao_indisponivel', 409)
  }

  await sb.from('atendimentos').update({ avaliacao: nota, etapa_bot: null }).eq('id', chamado.id)
  return respostaJsonWeb(req, { ok: true })
}

// ===== entrada =====

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflightWeb(req)

  try {
    if (req.method !== 'POST') throw new ErroContrato('requisicao_invalida', 405)

    // Roteia por path, e não por campo `acao` no corpo, para o log do Supabase
    // separar as chamadas por rota.
    const rota = new URL(req.url).pathname.split('/').filter(Boolean).pop()

    /*
      O anexo sai antes de tudo porque o corpo dele é `multipart/form-data` com
      um arquivo binário dentro. Lê-lo como texto aqui gastaria memória à toa e,
      pior, consumiria o stream: o `req.formData()` lá dentro receberia um corpo
      já vazio. O teto de tamanho dele é conferido na própria rota.
    */
    if (rota === 'anexo') return await rotaAnexo(criarClienteServico(), req)

    // Teto pelo corpo lido de fato, não pelo content-length, que o cliente informa.
    const bruto = await req.text()
    if (bruto.length > MAX_CORPO_BYTES) throw new ErroContrato('requisicao_invalida', 413)

    let corpo: Record<string, unknown> = {}
    if (bruto.trim()) {
      try {
        corpo = JSON.parse(bruto)
      } catch {
        throw new ErroContrato('requisicao_invalida', 400)
      }
    }

    const sb = criarClienteServico()

    switch (rota) {
      case 'disponibilidade':
        return await rotaDisponibilidade(sb, req)
      case 'identificar':
        return await rotaIdentificar(sb, req, corpo)
      case 'conversa':
        return await rotaConversa(sb, req)
      case 'mensagem':
        return await rotaMensagem(sb, req, corpo)
      case 'encerrar':
        return await rotaEncerrar(sb, req)
      case 'avaliar':
        return await rotaAvaliar(sb, req, corpo)
      case 'apagar-mensagem':
        return await rotaApagarMensagem(sb, req, corpo)
      case 'editar-mensagem':
        return await rotaEditarMensagem(sb, req, corpo)
      default:
        throw new ErroContrato('rota_desconhecida', 404)
    }
  } catch (erro) {
    return respostaDeErro(req, erro)
  }
})
