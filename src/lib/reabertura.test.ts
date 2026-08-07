import { describe, it, expect } from 'vitest'
import { textoRodapeFinalizado, janelaEmHoras, type DadosReabertura } from './reabertura'

const AGORA = new Date('2026-08-07T12:00:00Z')
const haMinutos = (min: number) => new Date(AGORA.getTime() - min * 60_000).toISOString()

const base: DadosReabertura = {
  avaliacao_solicitada_em: haMinutos(30),
  avaliacao: null,
  finalizado_em: haMinutos(30),
  canal: 'whatsapp',
}

describe('janelaEmHoras', () => {
  it('usa o valor da config', () => {
    expect(janelaEmHoras('6')).toBe(6)
  })

  // Config ausente, vazia ou escrita errada não pode zerar a janela na tela: o
  // banco continuaria reabrindo em 3h e o rodapé diria outra coisa.
  it('cai no default do banco quando o valor não presta', () => {
    expect(janelaEmHoras(undefined)).toBe(3)
    expect(janelaEmHoras('')).toBe(3)
    expect(janelaEmHoras('abc')).toBe(3)
    expect(janelaEmHoras('0')).toBe(3)
  })
})

describe('textoRodapeFinalizado', () => {
  it('promete reabertura só com nota pendente e dentro da janela', () => {
    expect(textoRodapeFinalizado(base, 3, true, AGORA)).toBe(
      'Atendimento finalizado. Se o cliente responder em até 3 horas, este protocolo reabre.'
    )
  })

  it('respeita a janela configurada, em vez das 3h que estavam cravadas', () => {
    expect(textoRodapeFinalizado(base, 1, true, AGORA)).toContain('em até 1 hora,')
    expect(textoRodapeFinalizado(base, 6, true, AGORA)).toContain('em até 6 horas,')
  })

  // Os três caminhos que o texto antigo prometia reabrir e o banco não reabre.
  it('não promete reabertura com a nota já dada', () => {
    expect(textoRodapeFinalizado({ ...base, avaliacao: 10 }, 3, true, AGORA)).toBe(
      'Atendimento finalizado. A próxima mensagem do cliente abre um chamado novo.'
    )
  })

  it('não promete reabertura quando a avaliação nem foi pedida (#sair ou desligada)', () => {
    expect(
      textoRodapeFinalizado({ ...base, avaliacao_solicitada_em: null }, 3, true, AGORA)
    ).toContain('abre um chamado novo')
  })

  it('não promete reabertura depois de a janela vencer', () => {
    const vencido = { ...base, finalizado_em: haMinutos(4 * 60) }
    expect(textoRodapeFinalizado(vencido, 3, true, AGORA)).toContain('abre um chamado novo')
  })

  it('trata a borda da janela como vencida', () => {
    const naBorda = { ...base, finalizado_em: haMinutos(180) }
    expect(textoRodapeFinalizado(naBorda, 3, true, AGORA)).toContain('abre um chamado novo')
  })

  it('sem acesso no canal web, explica que o cliente precisa se identificar de novo', () => {
    expect(textoRodapeFinalizado({ ...base, canal: 'web' }, 3, false, AGORA)).toBe(
      'Atendimento finalizado. O acesso do cliente ao site foi encerrado, então ele precisa se identificar de novo e isso abre um chamado novo.'
    )
  })

  // O acesso encerrado manda no texto mesmo quando a nota está pendente: sem
  // conversa aberta no site, não há como responder e reabrir.
  it('acesso encerrado vence a nota pendente', () => {
    expect(textoRodapeFinalizado({ ...base, canal: 'web' }, 3, false, AGORA)).toContain(
      'se identificar de novo'
    )
  })

  it('no canal web com acesso vivo, a regra é a mesma do WhatsApp', () => {
    expect(textoRodapeFinalizado({ ...base, canal: 'web' }, 3, true, AGORA)).toContain(
      'este protocolo reabre'
    )
  })

  // WhatsApp não tem sessão do PWA, então o parâmetro de acesso não pode
  // influenciar: o telefone continua alcançável de qualquer jeito.
  it('no WhatsApp o acesso do site é irrelevante', () => {
    expect(textoRodapeFinalizado(base, 3, false, AGORA)).toContain('este protocolo reabre')
  })
})
