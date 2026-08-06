import { describe, it, expect } from 'vitest'
import { CANAL_PADRAO, despachaPeloWhatsApp, ehCanal, type Canal } from './canal'

describe('ehCanal', () => {
  it('reconhece os dois canais', () => {
    expect(ehCanal('whatsapp')).toBe(true)
    expect(ehCanal('web')).toBe(true)
  })

  it('recusa o que não é canal', () => {
    expect(ehCanal('instagram')).toBe(false)
    expect(ehCanal('')).toBe(false)
    expect(ehCanal(null)).toBe(false)
    expect(ehCanal(undefined)).toBe(false)
    expect(ehCanal(1)).toBe(false)
  })
})

describe('despachaPeloWhatsApp', () => {
  it('despacha o que veio do WhatsApp', () => {
    expect(despachaPeloWhatsApp('whatsapp')).toBe(true)
    expect(despachaPeloWhatsApp(CANAL_PADRAO)).toBe(true)
  })

  // O teste que importa. Hoje é trivial porque nada despacha ainda; no dia em que o
  // envio real entrar, ele fica vermelho se alguém mandar tudo para o provedor.
  it('NÃO despacha atendimento que nasceu na web', () => {
    expect(despachaPeloWhatsApp('web')).toBe(false)
  })

  it('falha fechada quando o canal é desconhecido ou ausente', () => {
    expect(despachaPeloWhatsApp(null)).toBe(false)
    expect(despachaPeloWhatsApp(undefined)).toBe(false)
    expect(despachaPeloWhatsApp('')).toBe(false)
    expect(despachaPeloWhatsApp('instagram')).toBe(false)
    expect(despachaPeloWhatsApp('WhatsApp')).toBe(false) // sem normalizar caixa
  })

  it('cobre todo canal declarado, para o terceiro não passar despercebido', () => {
    const canais: Canal[] = ['whatsapp', 'web']
    for (const canal of canais) {
      expect(typeof despachaPeloWhatsApp(canal)).toBe('boolean')
    }
  })
})
