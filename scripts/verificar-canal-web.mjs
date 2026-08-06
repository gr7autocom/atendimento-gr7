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
  const base = { nome: 'Fulano de Teste', telefone: TEL, departamento_id: dep.id, mensagem: 'oi', aceite: true }
  ok('nome curto recusado', (await chamar('identificar', { ...base, nome: 'x' })).json?.campo === 'nome')
  // Sem checar o DV, a rota vira oraculo da carteira de clientes.
  ok('CNPJ com DV errado recusado', (await chamar('identificar', { ...base, cnpj: '12345678000199' })).json?.campo === 'cnpj')
  ok('sem aceite de privacidade recusado', (await chamar('identificar', { ...base, aceite: false })).json?.campo === 'aceite')
  ok('telefone sem DDD recusado', (await chamar('identificar', { ...base, telefone: '99999' })).json?.campo === 'telefone')

  // ---- abertura
  const ident = await chamar('identificar', { ...base, mensagem: 'meu PDV nao abre' })
  ok('identificar abre o chamado', ident.status === 201, `status=${ident.status} ${JSON.stringify(ident.json)}`)
  const token = ident.json?.token
  ok('devolve token de sessao', typeof token === 'string' && token.length === 43)

  const { data: contato } = await sb.from('contatos').select('id').eq('telefone', E164).maybeSingle()
  contatoId = contato?.id
  ok('telefone com mascara virou E.164', Boolean(contato), `procurado ${E164}`)

  const { data: chamado } = await sb
    .from('atendimentos')
    .select('id, canal, status, protocolo')
    .eq('contato_id', contatoId)
    .maybeSingle()
  ok('chamado nasce canal=web em na_fila', chamado?.canal === 'web' && chamado?.status === 'na_fila')

  // ---- conversa e o que nao pode vazar
  const conv1 = await chamar('conversa', {}, token)
  ok('conversa traz mensagem do cliente e boas-vindas do bot',
    conv1.json?.mensagens?.some((m) => m.origem === 'cliente') && conv1.json?.mensagens?.some((m) => m.origem === 'bot'))

  const campos = new Set((conv1.json?.mensagens ?? []).flatMap((m) => Object.keys(m)))
  const proibidos = ['remetente_usuario_id', 'wa_message_id', 'canal', 'client_msg_id', 'atendimento_id']
  ok('mensagem nao vaza campo interno', !proibidos.some((c) => campos.has(c)), `campos=${[...campos]}`)

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
