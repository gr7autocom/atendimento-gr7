import { criarDriver, type ConteudoEnvio } from '../_shared/whatsapp/index.ts'
import { preflight, respostaJson } from '../_shared/cors.ts'

// Despacha uma mensagem (texto ou mídia) pelo WhatsApp via driver e devolve o
// wa_message_id. A linha em atendimento_mensagens (saida) é criada pelo app;
// aqui só falamos com o provedor. Ver docs/whatsapp.md.
//
// Body esperado:
//   texto: { para: "+55...", texto: "olá" }
//   mídia: { para: "+55...", tipo: "midia", midia: "image", file: "https://...", caption?, docName? }
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') return respostaJson({ erro: 'Método não suportado' }, 405)

  try {
    const body = await req.json()
    const para: string = body.para
    if (!para) return respostaJson({ erro: 'Campo "para" é obrigatório' }, 400)

    const conteudo: ConteudoEnvio =
      body.tipo === 'midia'
        ? {
            tipo: 'midia',
            midia: body.midia,
            file: body.file,
            caption: body.caption,
            docName: body.docName,
          }
        : { tipo: 'texto', texto: body.texto ?? '' }

    const { wa_message_id } = await criarDriver().enviarMensagem(para, conteudo)
    return respostaJson({ wa_message_id })
  } catch (erro) {
    console.error('whatsapp-send', erro)
    return respostaJson({ erro: String(erro) }, 500)
  }
})
