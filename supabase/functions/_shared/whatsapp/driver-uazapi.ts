import type {
  ConteudoEnvio,
  EventoNormalizado,
  ResultadoConexao,
  ResultadoEnvio,
  StatusConexao,
  WhatsAppDriver,
} from './tipos.ts'

// Driver real da uazapi. Endpoints e headers confirmados na doc oficial
// (ver docs/whatsapp.md, "Referência da API uazapi"). Autenticação por header
// `token` (endpoints normais) e `admintoken` (administrativos), não Bearer.

const BASE = Deno.env.get('UAZAPI_BASE_URL') ?? ''
const TOKEN = Deno.env.get('UAZAPI_TOKEN') ?? ''
const ADMIN_TOKEN = Deno.env.get('UAZAPI_ADMIN_TOKEN') ?? ''

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

function mapearStatus(estado: unknown): StatusConexao {
  return estado === 'connected' || estado === 'connecting' || estado === 'hibernated'
    ? estado
    : 'disconnected'
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
    // ⚠️ A CONFIRMAR: nome exato do campo do id da mensagem na resposta da uazapi.
    const id = dados['id'] ?? dados['messageid'] ?? (dados['key'] as Record<string, unknown>)?.['id'] ?? ''
    return { wa_message_id: String(id) }
  }

  async statusConexao(): Promise<ResultadoConexao> {
    const dados = await chamar('GET', '/instance/status')
    return {
      status: mapearStatus(dados['state'] ?? (dados['instance'] as Record<string, unknown>)?.['status']),
      qrCode: (dados['qrCode'] as string | null) ?? null,
      pairingCode: (dados['pairingCode'] as string | null) ?? null,
    }
  }

  async conectar(phone?: string): Promise<ResultadoConexao> {
    const dados = await chamar('POST', '/instance/connect', phone ? { phone } : {})
    return {
      status: mapearStatus(dados['state'] ?? 'connecting'),
      qrCode: (dados['qrCode'] as string | null) ?? null,
      pairingCode: (dados['pairingCode'] as string | null) ?? null,
    }
  }

  normalizarWebhook(payload: unknown): EventoNormalizado {
    // ⚠️ A CONFIRMAR: o formato real do payload do webhook uazapi não foi validado
    // ainda (a doc é SPA e não renderizou no fetch — ver docs/whatsapp.md). Quando
    // houver token/admintoken, validar no painel de teste da doc e mapear aqui:
    //   - evento de mensagem recebida  -> { tipo: 'mensagem', wa_message_id, telefone, corpo, nome_whatsapp }
    //   - evento de status de mensagem -> { tipo: 'status_mensagem', wa_message_id, status }
    //   - evento de conexão            -> { tipo: 'conexao', status }
    // Até lá, ignora tudo para não gravar dado com shape errado.
    void payload
    return { tipo: 'ignorado' }
  }
}
