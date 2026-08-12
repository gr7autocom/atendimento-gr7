/**
 * Eliminação de dados de titular (LGPD, Art. 18, VI), pedida pelo admin.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A ORDEM É O PRODUTO DESTA FUNÇÃO
 *
 *   1. lista os arquivos do titular      (RPC atendimento_lgpd_anexos_do_titular)
 *   2. apaga cada um no Storage          (bucket atendimento-anexos)
 *   3. elimina no banco                  (RPC atendimento_lgpd_eliminar_titular)
 *
 * Invertida, ela não funciona, e não é questão de estilo: `atendimento_anexos`
 * tem `ON DELETE CASCADE` em `mensagem_id`, então o passo 3 apaga o registro do
 * anexo e leva o `storage_path` com ele. O arquivo ficaria no Storage para
 * sempre, alcançável por quem tivesse a URL, e sem nenhuma referência no
 * sistema dizendo que existe — impossível de achar depois, nem de propósito.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SEM SERVICE ROLE, DE PROPÓSITO
 *
 * O client é criado com o JWT de quem chamou, então quem decide se a pessoa
 * pode eliminar é o `e_admin()` dentro das RPCs, no banco. Com service role a
 * função ignoraria a RLS e teria de reimplementar a checagem de permissão aqui
 * — duas verdades sobre quem é admin, e a de fora sempre desatualizando. A
 * remoção no Storage segue a mesma regra: as policies do bucket
 * `atendimento-anexos` (migration `20260811150000`) também checam
 * `e_admin()`, então este client sem service role também é quem apaga o
 * arquivo, sem precisar de um segundo cliente.
 *
 * É o oposto da `atendimento-web`, que usa service role porque atende cliente
 * sem login nenhum. Aqui existe login, e ele é a autorização.
 */
// `esm.sh` e não `jsr`, como o resto das functions: o deno.lock fixa esta URL e
// misturar as duas origens traria duas cópias do supabase-js para o bundle.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { apagarNoStorage, type ResultadoApagar } from '../_shared/storage-apagar.ts'

type AnexoDoTitular = { storage_path: string | null; url: string | null }

/*
  Origens da central. Diferente do `cors-web.ts`, que serve ao PWA do cliente:
  são endereços distintos e misturá-los abriria a eliminação para a origem
  errada. Vazio recusa todo navegador, que é o padrão seguro enquanto o
  subdomínio não existe.
*/
function origemPermitida(origem: string | null): string | null {
  const permitidas = (Deno.env.get('CENTRAL_ORIGENS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  return origem && permitidas.includes(origem) ? origem : null
}

function cabecalhos(origem: string | null) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const ok = origemPermitida(origem)
  if (ok) {
    h['Access-Control-Allow-Origin'] = ok
    h['Access-Control-Allow-Headers'] = 'authorization, content-type'
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    h['Vary'] = 'Origin'
  }
  return h
}

Deno.serve(async (req) => {
  const origem = req.headers.get('origin')
  const head = cabecalhos(origem)

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: head })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ erro: 'metodo_invalido' }), { status: 405, headers: head })
  }

  const auth = req.headers.get('Authorization')
  if (!auth) {
    return new Response(JSON.stringify({ erro: 'sem_credencial' }), { status: 401, headers: head })
  }

  let corpo: { contato_id?: string; referencia_pedido?: string }
  try {
    corpo = await req.json()
  } catch {
    return new Response(JSON.stringify({ erro: 'corpo_invalido' }), { status: 400, headers: head })
  }

  const contatoId = corpo.contato_id
  if (!contatoId || !/^[0-9a-f-]{36}$/i.test(contatoId)) {
    return new Response(JSON.stringify({ erro: 'contato_id_invalido' }), { status: 400, headers: head })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } }
  )

  // 1. Os arquivos, antes de qualquer remoção. Erro aqui aborta tudo: a RPC
  // devolve 42501 para quem não é admin, e essa é a única checagem de permissão
  // que existe no fluxo.
  const { data: anexos, error: erroLista } = await supabase.rpc('atendimento_lgpd_anexos_do_titular', {
    p_contato_id: contatoId,
  })
  if (erroLista) {
    const status = erroLista.code === '42501' ? 403 : 500
    return new Response(JSON.stringify({ erro: 'falha_ao_listar', detalhe: erroLista.message }), {
      status,
      headers: head,
    })
  }

  // 2. Storage. Um a um: são poucos por titular, e falha de um não impede os
  // outros nem a eliminação — o que não saiu volta no relatório para alguém
  // repetir, porque abortar por um arquivo deixaria o pedido do titular
  // inteiramente sem atendimento.
  const arquivos: ResultadoApagar[] = []
  for (const a of (anexos ?? []) as AnexoDoTitular[]) {
    if (!a.storage_path) continue
    arquivos.push(await apagarNoStorage(supabase, a.storage_path))
  }

  // 3. Só agora o banco.
  const { data: resumo, error: erroElim } = await supabase.rpc('atendimento_lgpd_eliminar_titular', {
    p_contato_id: contatoId,
    p_referencia_pedido: corpo.referencia_pedido ?? null,
  })
  if (erroElim) {
    const status = erroElim.code === '42501' ? 403 : 500
    /*
      Os arquivos já foram apagados e o banco não. É o único estado inconsistente
      possível aqui, e ele é o lado certo de falhar: o titular fica com o relato
      no banco e sem os arquivos, então repetir a chamada termina o serviço. O
      inverso (banco limpo, arquivos no ar) seria irreversível.
    */
    return new Response(
      JSON.stringify({
        erro: 'falha_ao_eliminar',
        detalhe: erroElim.message,
        arquivos,
        aviso: 'Os arquivos foram apagados no provedor, o banco nao. Repita a operacao.',
      }),
      { status, headers: head }
    )
  }

  const r = (Array.isArray(resumo) ? resumo[0] : resumo) ?? {}
  return new Response(
    JSON.stringify({
      ok: true,
      mensagens_apagadas: r.mensagens_apagadas ?? 0,
      anexos_apagados: r.anexos_apagados ?? 0,
      atendimentos_afetados: r.atendimentos_afetados ?? 0,
      sessoes_apagadas: r.sessoes_apagadas ?? 0,
      arquivos,
      // O que o provedor recusou. A tela precisa mostrar isto: eliminação
      // parcial anunciada como completa é pior que falha declarada.
      arquivos_nao_apagados: arquivos.filter((a) => !a.apagado),
    }),
    { status: 200, headers: head }
  )
})
