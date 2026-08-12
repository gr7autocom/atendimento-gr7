// Copia o acervo do Cloudinary para o bucket atendimento-anexos e reescreve as URLs.
// Uso: node --env-file=.env scripts/migrar-storage.mjs [--dry-run]
//
// Idempotente: pula registro que ja tem storage_path. Nunca atualiza o registro
// antes de confirmar que o arquivo chegou ao bucket. Nao mexe em public_id: fica
// como rastro de rollback ate uma limpeza posterior confirmada em producao --
// mesmo padrao do painel-implantacao-v2/scripts/migrar-storage.mjs, de onde
// este script foi portado (so uma tabela aqui, atendimento_anexos, contra
// tarefa_anexos/scrap_anexos/avatares/descricoes de la).
import { createClient } from '@supabase/supabase-js'

const DRY = process.argv.includes('--dry-run')
const BUCKET = 'atendimento-anexos'
const PASTA = 'atendimento-anexos'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('Faltam VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

function montarPath(nomeArquivo) {
  const nome = (nomeArquivo || 'arquivo').split('/').pop()
  const ponto = nome.lastIndexOf('.')
  const base = ponto > 0 ? nome.slice(0, ponto) : nome
  const ext = ponto > 0 ? nome.slice(ponto).toLowerCase() : ''
  const limpo = base
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `${PASTA}/${crypto.randomUUID()}-${limpo || 'arquivo'}${ext}`
}

async function copiar(urlOrigem, nomeArquivo) {
  const res = await fetch(urlOrigem)
  if (!res.ok) throw new Error(`download ${res.status}`)
  const buffer = new Uint8Array(await res.arrayBuffer())
  const path = montarPath(nomeArquivo)
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'

  if (DRY) return { path, url: `[dry-run] ${path}`, bytes: buffer.length }

  const { error } = await db.storage.from(BUCKET).upload(path, buffer, { contentType })
  if (error) throw new Error(`upload ${error.message}`)

  return { path, url: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`, bytes: buffer.length }
}

const relatorio = { migrados: 0, pulados: 0, falhas: [] }

console.log(DRY ? '### DRY-RUN: nada sera gravado ###' : '### EXECUCAO REAL ###')

const { data, error } = await db
  .from('atendimento_anexos')
  .select('id, nome_arquivo, url, storage_path')
  .is('storage_path', null)
if (error) {
  console.error(`atendimento_anexos: ${error.message}`)
  process.exit(1)
}

console.log(`\n== atendimento_anexos: ${data.length} pendentes ==`)
for (const linha of data) {
  if (!linha.url?.includes('res.cloudinary.com')) {
    relatorio.pulados++
    continue
  }
  try {
    const novo = await copiar(linha.url, linha.nome_arquivo ?? 'arquivo')
    if (!DRY) {
      const { error: upErr } = await db
        .from('atendimento_anexos')
        .update({ url: novo.url, storage_path: novo.path })
        .eq('id', linha.id)
      if (upErr) throw new Error(`update ${upErr.message}`)
    }
    relatorio.migrados++
    console.log(`  ok ${linha.id} -> ${novo.path}`)
  } catch (e) {
    relatorio.falhas.push({ id: linha.id, erro: e.message })
    console.error(`  FALHA ${linha.id}: ${e.message}`)
  }
}

console.log(`\n=== RELATORIO ===`)
console.log(`  migrados: ${relatorio.migrados}`)
console.log(`  pulados:  ${relatorio.pulados}`)
console.log(`  falhas:   ${relatorio.falhas.length}`)
for (const f of relatorio.falhas) console.log(`    ${f.id}: ${f.erro}`)
process.exit(relatorio.falhas.length > 0 ? 1 : 0)
