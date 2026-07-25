import { describe, it, expect } from 'vitest'
import { faixaCobre, temAcessoAgora, paraMinutos } from './horario'

describe('faixaCobre', () => {
  it('mesmo dia', () => {
    expect(faixaCobre(1, '08:00', '18:00', 1, paraMinutos('10:00'))).toBe(true)
    expect(faixaCobre(1, '08:00', '18:00', 1, paraMinutos('19:00'))).toBe(false)
    expect(faixaCobre(1, '08:00', '18:00', 2, paraMinutos('10:00'))).toBe(false)
  })

  it('24h quando início = fim (00:00–00:00)', () => {
    expect(faixaCobre(3, '00:00', '00:00', 3, paraMinutos('05:00'))).toBe(true)
    expect(faixaCobre(3, '00:00', '00:00', 4, paraMinutos('05:00'))).toBe(false)
  })

  it('vira a noite (22:00–06:00 na sexta)', () => {
    expect(faixaCobre(5, '22:00', '06:00', 5, paraMinutos('23:00'))).toBe(true) // sexta à noite
    expect(faixaCobre(5, '22:00', '06:00', 6, paraMinutos('02:00'))).toBe(true) // sábado de madrugada
    expect(faixaCobre(5, '22:00', '06:00', 6, paraMinutos('07:00'))).toBe(false)
    expect(faixaCobre(5, '22:00', '06:00', 5, paraMinutos('20:00'))).toBe(false)
  })
})

describe('temAcessoAgora', () => {
  it('admin sempre acessa', () => {
    expect(temAcessoAgora({ isAdmin: true, comercial: [], janelas: [], agora: new Date() })).toBe(true)
  })

  it('dentro do comercial libera qualquer atendente', () => {
    const agora = new Date(2026, 6, 27, 10, 0)
    const dow = agora.getDay()
    expect(
      temAcessoAgora({
        isAdmin: false,
        comercial: [{ dia_semana: dow, hora_inicio: '08:00', hora_fim: '18:00', ativo: true }],
        janelas: [],
        agora,
      })
    ).toBe(true)
  })

  it('fora do comercial e sem janela bloqueia', () => {
    const agora = new Date(2026, 6, 27, 20, 0)
    const dow = agora.getDay()
    expect(
      temAcessoAgora({
        isAdmin: false,
        comercial: [{ dia_semana: dow, hora_inicio: '08:00', hora_fim: '18:00', ativo: true }],
        janelas: [],
        agora,
      })
    ).toBe(false)
  })

  it('fora do comercial mas dentro da janela pessoal libera', () => {
    const agora = new Date(2026, 6, 27, 20, 0)
    const dow = agora.getDay()
    expect(
      temAcessoAgora({
        isAdmin: false,
        comercial: [{ dia_semana: dow, hora_inicio: '08:00', hora_fim: '18:00', ativo: true }],
        janelas: [{ dia_semana: dow, hora_inicio: '18:00', hora_fim: '23:00' }],
        agora,
      })
    ).toBe(true)
  })
})
