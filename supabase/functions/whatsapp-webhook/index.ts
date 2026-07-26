import { criarDriver } from '../_shared/whatsapp/index.ts'
import { criarClienteServico } from '../_shared/supabase.ts'
import { preflight, respostaJson } from '../_shared/cors.ts'

// Recebe os eventos da uazapi (endpoint público). Responde 200 rápido — o provedor
// exige, senão fica reenviando. Roda com service role, ignorando a RLS de propósito.
//
// ⚠️ O mapeamento do payload (driver.normalizarWebhook) e a persistência da mensagem
// de entrada ainda são A CONFIRMAR — dependem do payload real da uazapi e do fluxo do
// bot, ainda não implementado. Ver docs/whatsapp.md e docs/bot.md.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') return respostaJson({ erro: 'Método não suportado' }, 405)

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return respostaJson({ ok: true }) // corpo inválido: ignora sem derrubar o webhook
  }

  try {
    const evento = criarDriver().normalizarWebhook(payload)
    const supabase = criarClienteServico()

    switch (evento.tipo) {
      case 'status_mensagem': {
        // Atualiza o status de entrega da mensagem que enviamos.
        await supabase
          .from('atendimento_mensagens')
          .update({ status: evento.status })
          .eq('wa_message_id', evento.wa_message_id)
        break
      }
      case 'mensagem': {
        // Deduplica por wa_message_id (UNIQUE parcial em atendimento_mensagens).
        const { data: jaExiste } = await supabase
          .from('atendimento_mensagens')
          .select('id')
          .eq('wa_message_id', evento.wa_message_id)
          .maybeSingle()
        if (jaExiste) break

        // TODO(uazapi + bot): casar/criar contato pelo telefone (E.164), abrir ou
        // reabrir o atendimento (janela de 3h), gravar a mensagem de entrada e rodar
        // o fluxo do bot (ver docs/bot.md). Depende do payload real (A CONFIRMAR) e
        // do bot, ainda não implementado. Por ora só registra no log.
        console.log('webhook mensagem (pendente de persistência)', evento.wa_message_id)
        break
      }
      case 'conexao':
        console.log('webhook conexao', evento.status)
        break
      default:
        break
    }
  } catch (erro) {
    // Nunca devolve erro ao provedor: loga e segue.
    console.error('whatsapp-webhook', erro)
  }

  return respostaJson({ ok: true })
})
