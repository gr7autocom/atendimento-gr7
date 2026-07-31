import type {
  ConteudoEnvio,
  EventoNormalizado,
  ResultadoConexao,
  ResultadoEnvio,
  WhatsAppDriver,
} from './tipos.ts'

/**
 * Driver de desenvolvimento: não fala com a uazapi. Simula o envio (gera um id
 * fake) e aceita um webhook no próprio shape do EventoNormalizado, para testar o
 * fluxo sem conta. Ativo quando não há UAZAPI_BASE_URL/UAZAPI_TOKEN configurados.
 * Ver docs/whatsapp.md.
 */
export class DriverMock implements WhatsAppDriver {
  enviarMensagem(_para: string, _conteudo: ConteudoEnvio): Promise<ResultadoEnvio> {
    return Promise.resolve({ wa_message_id: `mock-${crypto.randomUUID()}` })
  }

  statusConexao(): Promise<ResultadoConexao> {
    return Promise.resolve({ status: 'disconnected', qrCode: null, pairingCode: null })
  }

  conectar(_phone?: string): Promise<ResultadoConexao> {
    // QR fake só para a aba Conexão ter o que desenhar em desenvolvimento.
    return Promise.resolve({
      status: 'connecting',
      qrCode: 'data:image/png;base64,MOCK',
      pairingCode: null,
    })
  }

  configurarWebhook(_url: string): Promise<void> {
    // Sem provedor não há o que apontar: em desenvolvimento o webhook é chamado
    // direto por POST, com o payload já no shape do EventoNormalizado.
    return Promise.resolve()
  }

  normalizarWebhook(payload: unknown): EventoNormalizado {
    // No mock, aceitamos direto um EventoNormalizado (o teste local envia esse shape).
    const p = payload as Partial<Extract<EventoNormalizado, { tipo: 'mensagem' }>> | null
    if (p && p.tipo === 'mensagem' && p.telefone && p.wa_message_id) {
      return {
        tipo: 'mensagem',
        wa_message_id: p.wa_message_id,
        telefone: p.telefone,
        nome_whatsapp: p.nome_whatsapp ?? null,
        corpo: p.corpo ?? null,
      }
    }
    return { tipo: 'ignorado' }
  }
}
