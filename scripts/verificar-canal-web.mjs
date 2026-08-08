/**
 * Teste de fumaça do canal web, contra o ambiente real.
 *
 *   npm run verificar:canal-web
 *
 * Por que não está no `npm test`: precisa de rede, de credencial e do banco de
 * verdade. O `npm test` roda a lógica pura e a guarda de padrões; este script prova
 * que as peças conversam — a Edge Function deployada, as constraints do banco e o
 * caminho que o atendente usa na central.
 *
 * Rode antes de publicar mudança na função `atendimento-web` ou nas migrations do
 * canal. Ele CRIA dados de teste e os APAGA no fim (cascade a partir do contato).
 *
 * Credenciais saem do `.env` local, que não é versionado. Nada de segredo aqui.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(raiz, 'package.json'))
const { createClient } = require('@supabase/supabase-js')

const env = Object.fromEntries(
  readFileSync(join(raiz, process.argv[2] ?? '.env'), 'utf-8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    })
)

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY no .env.')
  process.exit(1)
}

const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const BASE = `${env.VITE_SUPABASE_URL}/functions/v1/atendimento-web`

// Telefone improvável, com máscara de propósito: prova a normalização E.164.
const TEL = '(16) 98888-7766'
const E164 = '+5516988887766'

const res = []
const ok = (nome, passou, detalhe = '') => {
  res.push({ nome, passou })
  console.log(`${passou ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? ` :: ${detalhe}` : ''}`)
}

async function chamar(rota, corpo, token) {
  const r = await fetch(`${BASE}/${rota}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'x-sessao': token } : {}) },
    body: JSON.stringify(corpo ?? {}),
  })
  let json = null
  try {
    json = await r.json()
  } catch {
    /* corpo vazio é resposta válida em erro de infra */
  }
  return { status: r.status, json }
}

let depTemporario = null
let contatoId = null

try {
  let { data: deps } = await sb.from('departamentos').select('id, nome').eq('ativo', true).limit(1)
  if (!deps?.length) {
    const { data: novo } = await sb
      .from('departamentos')
      .insert({ nome: 'TESTE CANAL WEB (apagar)', ordem: 999, ativo: true })
      .select('id, nome')
      .single()
    depTemporario = novo.id
    deps = [novo]
    console.log('(sem departamento ativo: criei um temporario)')
  }
  const dep = deps[0]

  // ---- disponibilidade
  const disp = await chamar('disponibilidade')
  ok('disponibilidade responde', disp.status === 200, `status=${disp.status}`)
  ok('disponibilidade lista setores', disp.json?.departamentos?.length > 0)

  // ---- entrada hostil recusada antes de tocar o banco
  // O formulário só coleta identidade: setor e relato acontecem na conversa.
  // O chamado nasce com tudo de uma vez: identidade, setor e o primeiro relato.
  const base = { nome: 'Fulano de Teste', telefone: TEL, departamento_id: dep.id, mensagem: 'meu PDV nao abre', aceite: true }
  ok('nome curto recusado', (await chamar('identificar', { ...base, nome: 'x' })).json?.campo === 'nome')
  // Sem checar o DV, a rota vira oraculo da carteira de clientes.
  ok('CNPJ com DV errado recusado', (await chamar('identificar', { ...base, cnpj: '12345678000199' })).json?.campo === 'cnpj')
  ok('sem aceite de privacidade recusado', (await chamar('identificar', { ...base, aceite: false })).json?.campo === 'aceite')
  ok('telefone sem DDD recusado', (await chamar('identificar', { ...base, telefone: '99999' })).json?.campo === 'telefone')

  // ---- abertura
  const ident = await chamar('identificar', base)
  ok('identificar abre o chamado', ident.status === 201, `status=${ident.status} ${JSON.stringify(ident.json)}`)
  const token = ident.json?.token
  ok('devolve token de sessao', typeof token === 'string' && token.length === 43)

  const { data: contato } = await sb.from('contatos').select('id').eq('telefone', E164).maybeSingle()
  contatoId = contato?.id
  ok('telefone com mascara virou E.164', Boolean(contato), `procurado ${E164}`)

  const { data: chamado } = await sb
    .from('atendimentos')
    .select('id, canal, status, protocolo, departamento_id')
    .eq('contato_id', contatoId)
    .maybeSingle()
  // Nasce direto na fila, com setor: ate a primeira mensagem nada existia.
  ok('chamado nasce canal=web em na_fila, com setor',
    chamado?.canal === 'web' && chamado?.status === 'na_fila' && chamado?.departamento_id === dep.id,
    `status=${chamado?.status}`)

  // ---- conversa: o roteiro inteiro precisa estar gravado
  const conv1 = await chamar('conversa', {}, token)
  const roteiro = (conv1.json?.mensagens ?? []).map((m) => m.origem).join(',')
  ok('conversa guarda o caminho todo, inclusive a escolha do setor',
    conv1.json?.mensagens?.some((m) => m.origem === 'cliente' && m.corpo === dep.nome) &&
      conv1.json?.mensagens?.filter((m) => m.origem === 'bot').length >= 2,
    `roteiro=${roteiro}`)
  ok('setor invalido recusado', (await chamar('identificar', { ...base, departamento_id: '00000000-0000-0000-0000-000000000000' })).json?.erro === 'departamento_invalido')

  /*
    Vazamento: lista FECHADA, não lista de proibidos.

    Antes aqui havia um `proibidos` com cinco nomes conhecidos. O problema é que
    ela nunca pega o caso real, que é alguém acrescentar um campo novo achando
    que é inofensivo: o nome dele não estaria na lista, e o teste passaria verde
    enquanto o dado sai. Agora qualquer chave que não esteja explicitamente
    liberada derruba a verificação.

    Vale para a resposta inteira, e não só para as mensagens: protocolo, status,
    departamento e atendente também vêm daqui.
  */
  /*
    `excluida` NAO esta aqui, e a ausencia e o ponto: a mensagem apagada some
    da tela do cliente porque e filtrada na consulta, nao porque o campo chega
    e a tela decide esconde-la. `corpo_original` (o texto antes de uma edicao)
    tambem fica fora: e registro para a equipe.
  */
  const PERMITIDO_MENSAGEM = [
    'id', 'direcao', 'origem', 'corpo', 'created_at',
    'editada_em', 'resposta_corpo', 'resposta_remetente',
  ]
  const PERMITIDO_CONVERSA = [
    'protocolo', 'status', 'encerrado', 'departamento', 'atendente', 'aguardando_avaliacao', 'mensagens', 'anexos',
  ]
  const PERMITIDO_ANEXO = ['id', 'mensagem_id', 'url', 'nome_arquivo', 'tipo_mime', 'tamanho_bytes']
  const sobrando = (obj, permitido) => Object.keys(obj ?? {}).filter((k) => !permitido.includes(k))

  const extrasConversa = sobrando(conv1.json, PERMITIDO_CONVERSA)
  const extrasMensagem = [...new Set((conv1.json?.mensagens ?? []).flatMap((m) => sobrando(m, PERMITIDO_MENSAGEM)))]
  const extrasAnexo = [...new Set((conv1.json?.anexos ?? []).flatMap((a) => sobrando(a, PERMITIDO_ANEXO)))]
  ok('conversa devolve so os campos previstos, nada alem',
    extrasConversa.length === 0 && extrasMensagem.length === 0 && extrasAnexo.length === 0,
    `extras: conversa=[${extrasConversa}] mensagem=[${extrasMensagem}] anexo=[${extrasAnexo}]`)

  // O atendente é identificado pelo primeiro nome. Sobrenome junto identifica a
  // pessoa fora do trabalho, e o cliente não precisa disso para ser atendido.
  const nomeAtendente = conv1.json?.atendente
  ok('do atendente sai so o primeiro nome',
    nomeAtendente === null || (typeof nomeAtendente === 'string' && !nomeAtendente.trim().includes(' ')),
    `atendente=${JSON.stringify(nomeAtendente)}`)

  ok('conversa sem token e recusada', (await chamar('conversa', {})).status === 401)
  ok('token inventado e recusado', (await chamar('conversa', {}, 'a'.repeat(43))).status === 401)

  // ---- o atendente responde como a central responde (insert direto, sem uazapi)
  const { data: atendente } = await sb.from('usuarios').select('id, nome').eq('ativo', true).limit(1).maybeSingle()
  await sb.from('atendimentos')
    .update({ responsavel_id: atendente?.id, status: 'em_atendimento', assumido_em: new Date().toISOString() })
    .eq('id', chamado.id)
  await sb.from('atendimento_mensagens').insert({
    atendimento_id: chamado.id, direcao: 'saida', origem: 'atendente',
    corpo: 'ja estou vendo aqui', remetente_usuario_id: atendente?.id, status: 'enviado',
  })

  const conv2 = await chamar('conversa', {}, token)
  ok('cliente recebe a resposta do atendente (sem uazapi)',
    conv2.json?.mensagens?.some((m) => m.corpo === 'ja estou vendo aqui'))
  ok('cliente ve so o primeiro nome do atendente',
    conv2.json?.atendente === atendente?.nome?.split(/\s+/)[0], `atendente=${conv2.json?.atendente}`)

  // ---- idempotencia
  const cid = crypto.randomUUID()
  await chamar('mensagem', { mensagem: 'obrigado!', client_msg_id: cid }, token)
  await chamar('mensagem', { mensagem: 'obrigado!', client_msg_id: cid }, token)
  const conv3 = await chamar('conversa', {}, token)
  const copias = (conv3.json?.mensagens ?? []).filter((m) => m.corpo === 'obrigado!').length
  ok('reenvio com mesmo id nao duplica', copias === 1, `copias=${copias}`)

  // ---- o guard do despacho, no fluxo real
  const { error: eGuard } = await sb.from('atendimento_mensagens').insert({
    atendimento_id: chamado.id, direcao: 'saida', origem: 'atendente',
    corpo: 'tentativa de despacho', wa_message_id: 'wamid-proibido-smoke',
  })
  ok('GUARD: despacho de WhatsApp impossivel em chamado web', eGuard?.code === '23514', eGuard?.code ?? 'NAO FALHOU')

  // ---- encerrar, avaliar e reabrir
  ok('cliente encerra o atendimento', (await chamar('encerrar', {}, token)).status === 200)
  const { data: fim } = await sb.from('atendimentos')
    .select('status, encerrado_por, avaliacao_solicitada_em').eq('id', chamado.id).maybeSingle()
  ok('finalizado por cliente', fim?.status === 'finalizado' && fim?.encerrado_por === 'cliente')
  // Igual ao #sair do WhatsApp: quem desligou nao e quem se pede para avaliar.
  ok('encerrar pelo cliente NAO pede avaliacao', !fim?.avaliacao_solicitada_em)
  ok('avaliacao fora de hora recusada', (await chamar('avaliar', { nota: 10 }, token)).json?.erro === 'avaliacao_indisponivel')

  await chamar('mensagem', { mensagem: 'voltei', client_msg_id: crypto.randomUUID() }, token)
  const { data: pos } = await sb.from('atendimentos').select('status, protocolo').eq('id', chamado.id).maybeSingle()
  ok('reabertura mantem o protocolo', pos?.status === 'na_fila' && pos?.protocolo === chamado.protocolo)

  // ---- apagar e editar a propria mensagem
  const convApagar = await chamar('conversa', {}, token)
  const minha = (convApagar.json?.mensagens ?? []).find((m) => m.origem === 'cliente')
  const doBot = (convApagar.json?.mensagens ?? []).find((m) => m.origem === 'bot')

  ok('cliente edita a propria mensagem',
    (await chamar('editar-mensagem', { mensagem_id: minha?.id, mensagem: 'texto corrigido' }, token)).status === 200)
  const posEdicao = await chamar('conversa', {}, token)
  const editada = (posEdicao.json?.mensagens ?? []).find((m) => m.id === minha?.id)
  ok('texto novo na conversa e marca de editada',
    editada?.corpo === 'texto corrigido' && !!editada?.editada_em, `corpo=${editada?.corpo}`)
  ok('cliente NAO recebe o texto anterior', editada && !('corpo_original' in editada),
    `campos=${Object.keys(editada ?? {})}`)

  // O que a guarda promete: o id do corpo so alcanca a propria conversa.
  ok('nao apaga mensagem do bot', (await chamar('apagar-mensagem', { mensagem_id: doBot?.id }, token)).json?.erro === 'mensagem_indisponivel')
  ok('nao apaga mensagem de outro chamado',
    (await chamar('apagar-mensagem', { mensagem_id: '00000000-0000-0000-0000-000000000000' }, token)).json?.erro === 'mensagem_indisponivel')
  ok('id fora de formato recusado',
    (await chamar('apagar-mensagem', { mensagem_id: 'nao-e-uuid' }, token)).json?.erro === 'requisicao_invalida')

  ok('cliente apaga a propria mensagem', (await chamar('apagar-mensagem', { mensagem_id: minha?.id }, token)).status === 200)
  const posApagar = await chamar('conversa', {}, token)
  ok('apagada SOME para o cliente',
    !(posApagar.json?.mensagens ?? []).some((m) => m.id === minha?.id),
    `restaram=${(posApagar.json?.mensagens ?? []).length}`)

  // E continua para a equipe, com o corpo: e o que a auditoria le depois.
  const { data: naBase } = await sb
    .from('atendimento_mensagens')
    .select('corpo, excluida, excluida_por, corpo_original')
    .eq('id', minha?.id ?? '00000000-0000-0000-0000-000000000000')
  ok('equipe continua vendo o texto, marcado como apagado pelo cliente',
    naBase?.[0]?.excluida === true && naBase[0].excluida_por === 'cliente' && naBase[0].corpo === 'texto corrigido',
    JSON.stringify(naBase?.[0]))
  ok('texto anterior a edicao ficou guardado', !!naBase?.[0]?.corpo_original, `original=${naBase?.[0]?.corpo_original}`)

  ok('rota desconhecida devolve 404 tipado', (await chamar('inventada', {})).status === 404)
} catch (erro) {
  ok('execucao sem excecao', false, String(erro))
} finally {
  if (contatoId) {
    await sb.from('contatos').delete().eq('id', contatoId)
    console.log('\nLimpeza: contato de teste removido (cascade leva chamado, mensagens e sessao).')
  }
  await sb.from('atendimento_web_tentativas').delete().eq('chave', `tel:${E164}`)
  if (depTemporario) await sb.from('departamentos').delete().eq('id', depTemporario)

  const falhas = res.filter((r) => !r.passou)
  console.log(`\n${res.length - falhas.length}/${res.length} verificacoes passaram.`)
  process.exit(falhas.length ? 1 : 0)
}
