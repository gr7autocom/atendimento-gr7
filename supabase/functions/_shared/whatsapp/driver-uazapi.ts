import type {
  ConteudoEnvio,
  EventoNormalizado,
  PerfilContato,
  ResultadoConexao,
  ResultadoEnvio,
  WhatsAppDriver,
} from './tipos.ts'
import { mapearStatusConexao, normalizarEventoUazapi } from './normalizar-uazapi.ts'

// Driver real da uazapi. Endpoints, headers e formato das respostas conferidos no
// spec OpenAPI oficial v2.1.1 (ver docs/whatsapp.md, "Referência da API uazapi").
// Autenticação por header `token` (endpoints normais) e `admintoken`
// (administrativos), não Bearer.

const BASE = Deno.env.get('UAZAPI_BASE_URL') ?? ''
const TOKEN = Deno.env.get('UAZAPI_TOKEN') ?? ''
const ADMIN_TOKEN = Deno.env.get('UAZAPI_ADMIN_TOKEN') ?? ''

/** Eventos que assinamos. Cada evento extra é uma invocation de Edge Function. */
const EVENTOS_WEBHOOK = ['messages', 'messages_update', 'connection']

function cabecalhos(admin = false): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(admin ? { admintoken: ADMIN_TOKEN } : { token: TOKEN }),
  }
}

async function chamar(
  metodo: string,
  caminho: string,
  corpo?: unknown,
  admin = false,
): Promise<Record<string, unknown>> {
  const resp = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: cabecalhos(admin),
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  if (!resp.ok) {
    const texto = await resp.text().catch(() => '')
    throw new Error(`uazapi ${metodo} ${caminho} -> ${resp.status}: ${texto}`)
  }
  return (await resp.json().catch(() => ({}))) as Record<string, unknown>
}

/**
 * `/instance/status` e `/instance/connect` devolvem a mesma forma: o estado da
 * sessão, o QR e o pairing code vivem **dentro de `instance`**, com as chaves em
 * minúsculo (`status`, `qrcode`, `paircode`). Não existe `state`, `qrCode` nem
 * `pairingCode` na raiz — ler de lá devolvia QR nulo e a aba Conexão nunca
 * mostrava o código para escanear.
 *
 * Cuidado com o nome: a resposta tem **dois** campos "status". O de fora
 * (`{ connected, loggedIn, jid }`) é o do socket; o estado de verdade é
 * `instance.status`.
 */
function lerConexao(dados: Record<string, unknown>): ResultadoConexao {
  const instancia = (dados['instance'] ?? {}) as Record<string, unknown>
  return {
    status: mapearStatusConexao(instancia['status']),
    qrCode: (instancia['qrcode'] as string | undefined) ?? null,
    pairingCode: (instancia['paircode'] as string | undefined) ?? null,
  }
}

export class DriverUazapi implements WhatsAppDriver {
  async enviarMensagem(para: string, conteudo: ConteudoEnvio): Promise<ResultadoEnvio> {
    const dados =
      conteudo.tipo === 'texto'
        ? await chamar('POST', '/send/text', { number: para, text: conteudo.texto })
        : await chamar('POST', '/send/media', {
            number: para,
            type: conteudo.midia,
            file: conteudo.file,
            text: conteudo.caption,
            docName: conteudo.docName,
          })
    // Os dois endpoints respondem com o schema `Message`, que tem DOIS ids:
    // `messageid` é o id do WhatsApp e `id` é interno da uazapi (formato
    // `r`+hex). Só o `messageid` volta no webhook, então é ele que serve de
    // `wa_message_id` — usar o `id` faria a deduplicação nunca casar e a mesma
    // mensagem apareceria duas vezes na conversa.
    return { wa_message_id: String(dados['messageid'] ?? '') }
  }

  async statusConexao(): Promise<ResultadoConexao> {
    return lerConexao(await chamar('GET', '/instance/status'))
  }

  async conectar(phone?: string): Promise<ResultadoConexao> {
    return lerConexao(await chamar('POST', '/instance/connect', phone ? { phone } : {}))
  }

  /**
   * Aponta o webhook da instância para a nossa Edge Function. Modo simples do
   * `POST /webhook` (sem `action` e sem `id`): a uazapi mantém um único webhook
   * por instância e cria ou atualiza sozinha.
   *
   * `excludeMessages: ["wasSentByApi"]` não é opcional: sem ele, cada mensagem
   * que o bot envia volta como webhook, o bot lê como se fosse do cliente e
   * responde a si mesmo, em loop, queimando invocations.
   */
  async configurarWebhook(url: string): Promise<void> {
    await chamar('POST', '/webhook', {
      enabled: true,
      url,
      events: EVENTOS_WEBHOOK,
      excludeMessages: ['wasSentByApi'],
      // Os dois `false` de propósito: se ligados, a uazapi acrescenta o tipo do
      // evento e da mensagem como path na URL (`/whatsapp-webhook/messages/...`)
      // e a Function deixaria de ser encontrada.
      addUrlEvents: false,
      addUrlTypesMessages: false,
    })
  }

  normalizarWebhook(payload: unknown): EventoNormalizado {
    return normalizarEventoUazapi(payload)
  }

  /**
   * `preview: true` pede a imagem menor: é só para o avatar da inbox, não tem
   * por que puxar a original. `wa_name` (nome verificado do WhatsApp) vem
   * antes de `wa_contactName`/`name` porque é o mesmo tipo de dado que
   * `nome_whatsapp` já grava hoje — nome de agenda salva é outra coisa.
   */
  async buscarPerfil(telefone: string): Promise<PerfilContato> {
    const dados = await chamar('POST', '/chat/details', { number: telefone, preview: true })
    const nome =
      (dados['wa_name'] as string | undefined) ||
      (dados['wa_contactName'] as string | undefined) ||
      (dados['name'] as string | undefined) ||
      null
    const fotoUrl = (dados['imagePreview'] as string | undefined) ?? null
    return { nome, fotoUrl }
  }
}
