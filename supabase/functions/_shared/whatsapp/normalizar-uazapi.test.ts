import { describe, it, expect } from 'vitest'
import {
  mapearStatusConexao,
  mapearStatusMensagem,
  normalizarEventoUazapi,
  telefoneDeJid,
} from './normalizar-uazapi'

// Estes testes travam o mapeamento do CONTEÚDO (schema `Message`, documentado no
// spec) e a tolerância aos dois ENVELOPES que o spec descreve. O envelope real
// ainda não foi capturado em tráfego — quando for, é aqui que o caso novo entra
// antes de mexer no código. Ver docs/whatsapp.md, "Payload do webhook".

/** Mensagem recebida, com os campos que o schema `Message` traz. */
const MENSAGEM = {
  messageid: '3EB0538DA65A59F6D8A251',
  id: 'r1a2b3c4',
  chatid: '5516991234567@s.whatsapp.net',
  sender: '5516991234567@s.whatsapp.net',
  senderName: 'Maria',
  fromMe: false,
  isGroup: false,
  messageType: 'conversation',
  text: 'Bom dia',
  // 2026-07-29T08:00:00Z, em milissegundos como o spec declara.
  messageTimestamp: 1785312000000,
  wasSentByApi: false,
}

describe('telefoneDeJid', () => {
  it('converte JID de pessoa para E.164', () => {
    expect(telefoneDeJid('5516991234567@s.whatsapp.net')).toBe('+5516991234567')
    expect(telefoneDeJid('5516991234567')).toBe('+5516991234567')
  })

  it('descarta o que não é telefone de pessoa', () => {
    // Grupo, canal e id oculto do WhatsApp: nenhum vira contato.
    expect(telefoneDeJid('120363123456789012@g.us')).toBe('')
    expect(telefoneDeJid('120363123456789012@newsletter')).toBe('')
    expect(telefoneDeJid('98765432101234@lid')).toBe('')
    expect(telefoneDeJid('')).toBe('')
    expect(telefoneDeJid(null)).toBe('')
  })
})

describe('mapearStatusMensagem', () => {
  it('traduz o ciclo de vida da mensagem', () => {
    expect(mapearStatusMensagem('Sent')).toBe('enviado')
    expect(mapearStatusMensagem('Delivered')).toBe('entregue')
    expect(mapearStatusMensagem('Read')).toBe('lido')
    expect(mapearStatusMensagem('Failed')).toBe('falhou')
    expect(mapearStatusMensagem('Canceled')).toBe('falhou')
  })

  it('devolve null para o que não muda nada na conversa', () => {
    // `Queued` é a mensagem ainda na fila da uazapi: não saiu, nada a atualizar.
    expect(mapearStatusMensagem('Queued')).toBeNull()
    expect(mapearStatusMensagem('inventado')).toBeNull()
    expect(mapearStatusMensagem(undefined)).toBeNull()
  })
})

describe('mapearStatusConexao', () => {
  it('reconhece os quatro estados da instância', () => {
    expect(mapearStatusConexao('connected')).toBe('connected')
    expect(mapearStatusConexao('connecting')).toBe('connecting')
    expect(mapearStatusConexao('hibernated')).toBe('hibernated')
    expect(mapearStatusConexao('disconnected')).toBe('disconnected')
  })

  it('cai em disconnected no desconhecido', () => {
    // Estado que não entendemos tem que acender a pílula vermelha, não some.
    expect(mapearStatusConexao(undefined)).toBe('disconnected')
    expect(mapearStatusConexao('qualquer-coisa')).toBe('disconnected')
  })
})

describe('normalizarEventoUazapi — mensagem recebida', () => {
  it('lê o envelope do webhook ({ event, instance, data })', () => {
    expect(
      normalizarEventoUazapi({ event: 'messages', instance: 'gr7', data: MENSAGEM }),
    ).toEqual({
      tipo: 'mensagem',
      wa_message_id: '3EB0538DA65A59F6D8A251',
      telefone: '+5516991234567',
      nome_whatsapp: 'Maria',
      corpo: 'Bom dia',
      recebido_em: '2026-07-29T08:00:00.000Z',
    })
  })

  it('lê o envelope do SSE ({ type, data }), com o evento no singular', () => {
    const evento = normalizarEventoUazapi({ type: 'message', data: MENSAGEM })
    expect(evento.tipo).toBe('mensagem')
  })

  it('aceita o dado aninhado em data.message e em lista', () => {
    expect(normalizarEventoUazapi({ event: 'messages', data: { message: MENSAGEM } }).tipo).toBe(
      'mensagem',
    )
    expect(normalizarEventoUazapi({ event: 'messages', data: [MENSAGEM] }).tipo).toBe('mensagem')
  })

  it('prefere o messageid ao id interno da uazapi', () => {
    // `id` é o id interno (formato r+hex) e não volta no webhook: usar ele
    // faria a deduplicação nunca casar.
    const evento = normalizarEventoUazapi({ event: 'messages', data: MENSAGEM })
    expect(evento).toMatchObject({ wa_message_id: MENSAGEM.messageid })
  })

  it('usa sender_pn quando o remetente vem como id oculto (@lid)', () => {
    const evento = normalizarEventoUazapi({
      event: 'messages',
      data: { ...MENSAGEM, sender: '98765432101234@lid', sender_pn: '5516991234567@s.whatsapp.net' },
    })
    expect(evento).toMatchObject({ telefone: '+5516991234567' })
  })

  it('aceita timestamp em segundos', () => {
    // O spec diz milissegundos, mas o WhatsApp costuma mandar segundos.
    const evento = normalizarEventoUazapi({
      event: 'messages',
      data: { ...MENSAGEM, messageTimestamp: 1785312000 },
    })
    expect(evento).toMatchObject({ recebido_em: '2026-07-29T08:00:00.000Z' })
  })

  it('ignora o eco das nossas próprias mensagens', () => {
    // Trava dupla do anti-loop, além do excludeMessages no webhook.
    expect(
      normalizarEventoUazapi({ event: 'messages', data: { ...MENSAGEM, fromMe: true } }).tipo,
    ).toBe('ignorado')
    expect(
      normalizarEventoUazapi({ event: 'messages', data: { ...MENSAGEM, wasSentByApi: true } }).tipo,
    ).toBe('ignorado')
  })

  it('ignora grupo, porque atendimento é 1:1', () => {
    expect(
      normalizarEventoUazapi({ event: 'messages', data: { ...MENSAGEM, isGroup: true } }).tipo,
    ).toBe('ignorado')
  })

  it('ignora mensagem sem id ou sem telefone utilizável', () => {
    const semId = { ...MENSAGEM, messageid: '', id: '' }
    expect(normalizarEventoUazapi({ event: 'messages', data: semId }).tipo).toBe('ignorado')

    const soGrupo = { ...MENSAGEM, sender: '1203@g.us', chatid: '1203@g.us', sender_pn: '' }
    expect(normalizarEventoUazapi({ event: 'messages', data: soGrupo }).tipo).toBe('ignorado')
  })

  it('aceita mensagem sem texto (mídia sem legenda)', () => {
    const evento = normalizarEventoUazapi({
      event: 'messages',
      data: { ...MENSAGEM, messageType: 'imageMessage', text: '' },
    })
    expect(evento).toMatchObject({ tipo: 'mensagem', corpo: null })
  })
})

describe('normalizarEventoUazapi — status e conexão', () => {
  it('traduz a atualização de status', () => {
    expect(
      normalizarEventoUazapi({
        event: 'messages_update',
        data: { messageid: 'ABC123', status: 'Delivered' },
      }),
    ).toEqual({ tipo: 'status_mensagem', wa_message_id: 'ABC123', status: 'entregue' })
  })

  it('ignora status que ainda não saiu da fila', () => {
    expect(
      normalizarEventoUazapi({
        event: 'messages_update',
        data: { messageid: 'ABC123', status: 'Queued' },
      }).tipo,
    ).toBe('ignorado')
  })

  it('traduz o evento de conexão, inclusive aninhado em instance', () => {
    expect(normalizarEventoUazapi({ event: 'connection', data: { status: 'connected' } })).toEqual({
      tipo: 'conexao',
      status: 'connected',
    })
    expect(
      normalizarEventoUazapi({ event: 'connection', data: { instance: { status: 'hibernated' } } }),
    ).toEqual({ tipo: 'conexao', status: 'hibernated' })
  })
})

describe('normalizarEventoUazapi — o que não tratamos', () => {
  it('ignora os eventos fora do nosso escopo', () => {
    for (const event of ['history', 'presence', 'groups', 'chats', 'call', 'labels', 'blocks']) {
      expect(normalizarEventoUazapi({ event, data: MENSAGEM }).tipo).toBe('ignorado')
    }
  })

  it('ignora payload inválido em vez de estourar', () => {
    // O webhook é endpoint público: lixo não pode derrubar a Function.
    for (const lixo of [null, undefined, 'texto', 42, [], {}]) {
      expect(normalizarEventoUazapi(lixo).tipo).toBe('ignorado')
    }
  })

  it('sem nome de evento, decide pelo conteúdo', () => {
    expect(normalizarEventoUazapi(MENSAGEM).tipo).toBe('mensagem')
    expect(normalizarEventoUazapi({ messageid: 'ABC123', status: 'Read' })).toEqual({
      tipo: 'status_mensagem',
      wa_message_id: 'ABC123',
      status: 'lido',
    })
  })
})
