import { criarDriver } from '../_shared/whatsapp/index.ts'
import { preflight, respostaJson } from '../_shared/cors.ts'

// QR/pairing e status da conexão da instância, para a aba Conexão e para a pílula
// de status na barra do topo. O token da uazapi fica só aqui, nunca no frontend.
//   GET  -> status da conexão
//   POST { phone? } -> inicia a conexão (QR sem phone, pairing code com phone)
// Ver docs/whatsapp.md.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()

  const driver = criarDriver()
  try {
    if (req.method === 'GET') {
      return respostaJson(await driver.statusConexao())
    }
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      return respostaJson(await driver.conectar(body?.phone))
    }
    return respostaJson({ erro: 'Método não suportado' }, 405)
  } catch (erro) {
    console.error('whatsapp-conexao', erro)
    return respostaJson({ erro: String(erro) }, 500)
  }
})
