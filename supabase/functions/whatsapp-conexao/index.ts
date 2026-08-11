import { criarDriver } from '../_shared/whatsapp/index.ts'
import { preflight, respostaJson } from '../_shared/cors.ts'

// QR/pairing e status da conexão da instância, para a aba Conexão e para a pílula
// de status na barra do topo. O token da uazapi fica só aqui, nunca no frontend.
//   GET  -> status da conexão
//   POST { phone? } -> inicia a conexão (QR sem phone, pairing code com phone)
//   POST { acao: "webhook", url? } -> aponta o webhook do provedor para cá
// Ver docs/whatsapp.md.

/**
 * URL pública da `whatsapp-webhook` neste mesmo projeto. `SUPABASE_URL` é
 * injetada pelo runtime das Edge Functions, então na ativação basta chamar
 * `POST { acao: "webhook" }` sem informar endereço nenhum.
 *
 * Com `WEBHOOK_SECRET` configurado, o segredo vai embutido como `?secret=`:
 * a uazapi não aceita header customizado na configuração do webhook dela,
 * só URL — é o único jeito dela conseguir passar pela checagem do outro lado.
 */
function urlDoWebhook(): string {
  const base = Deno.env.get('SUPABASE_URL') ?? ''
  if (!base) throw new Error('SUPABASE_URL ausente: informe a url no corpo da requisição')
  const url = new URL(`${base}/functions/v1/whatsapp-webhook`)
  const segredo = Deno.env.get('WEBHOOK_SECRET')
  if (segredo) url.searchParams.set('secret', segredo)
  return url.toString()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  const driver = criarDriver()
  try {
    if (req.method === 'GET') {
      return respostaJson(await driver.statusConexao())
    }
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      if (body?.acao === 'webhook') {
        const url = typeof body.url === 'string' && body.url ? body.url : urlDoWebhook()
        await driver.configurarWebhook(url)
        return respostaJson({ ok: true, url })
      }
      return respostaJson(await driver.conectar(body?.phone))
    }
    return respostaJson({ erro: 'Método não suportado' }, 405)
  } catch (erro) {
    console.error('whatsapp-conexao', erro)
    return respostaJson({ erro: String(erro) }, 500)
  }
})
