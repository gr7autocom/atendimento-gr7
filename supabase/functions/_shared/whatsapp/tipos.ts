// Tipos do adapter de WhatsApp. O domínio (Edge Functions, app) depende SÓ desta
// interface, nunca da uazapi direto. Trocar de provedor = trocar o driver.
// Ver docs/whatsapp.md.

export type StatusConexao = 'connected' | 'connecting' | 'disconnected' | 'hibernated'

export type ResultadoConexao = {
  status: StatusConexao
  /** QR em base64 (quando conecta sem informar telefone). */
  qrCode?: string | null
  /** Pairing code (quando conecta informando telefone). */
  pairingCode?: string | null
}

export type ConteudoEnvio =
  | { tipo: 'texto'; texto: string }
  | {
      tipo: 'midia'
      midia: 'image' | 'video' | 'document' | 'audio' | 'ptt' | 'ptv' | 'sticker'
      /** URL pública ou base64 do arquivo. */
      file: string
      caption?: string
      docName?: string
    }

export type ResultadoEnvio = { wa_message_id: string }

/** Evento já normalizado, independente do provedor. É o que o domínio consome. */
export type EventoNormalizado =
  | {
      tipo: 'mensagem'
      wa_message_id: string
      /** Telefone do contato em E.164 (ex.: +5516991234567). */
      telefone: string
      nome_whatsapp?: string | null
      corpo: string | null
      recebido_em?: string
    }
  | {
      tipo: 'status_mensagem'
      wa_message_id: string
      status: 'enviado' | 'entregue' | 'lido' | 'falhou'
    }
  | { tipo: 'conexao'; status: StatusConexao }
  /** Evento que não tratamos (grupos, presença, etc.). */
  | { tipo: 'ignorado' }

export interface WhatsAppDriver {
  /** Envia texto ou mídia. Ver /send/text e /send/media. */
  enviarMensagem(para: string, conteudo: ConteudoEnvio): Promise<ResultadoEnvio>
  /** Traduz o payload cru do webhook para um EventoNormalizado. */
  normalizarWebhook(payload: unknown): EventoNormalizado
  /** Estado atual da sessão. Ver GET /instance/status. */
  statusConexao(): Promise<ResultadoConexao>
  /** Inicia a conexão (QR sem phone, pairing code com phone). Ver POST /instance/connect. */
  conectar(phone?: string): Promise<ResultadoConexao>
}
