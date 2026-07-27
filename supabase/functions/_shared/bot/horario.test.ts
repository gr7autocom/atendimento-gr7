import { describe, it, expect } from 'vitest'
import {
  estaAberto,
  momentoNoFuso,
  resumoComercial,
  temPlantonista,
  type Faixa,
  type Momento,
} from './horario'

// Segunda-feira, 27/07/2026, 10:00 em São Paulo (UTC-3) = 13:00 UTC.
const SEG_10H_SP = new Date('2026-07-27T13:00:00Z')
// Segunda-feira, 27/07/2026, 20:00 em São Paulo = 23:00 UTC.
const SEG_20H_SP = new Date('2026-07-27T23:00:00Z')

describe('momentoNoFuso', () => {
  it('converte para o fuso de São Paulo', () => {
    expect(momentoNoFuso('America/Sao_Paulo', SEG_10H_SP)).toEqual<Momento>({ dow: 1, min: 600 })
    expect(momentoNoFuso('America/Sao_Paulo', SEG_20H_SP)).toEqual<Momento>({ dow: 1, min: 1200 })
  })

  it('vira o dia conforme o fuso (23:00 UTC ainda é segunda em SP)', () => {
    // 00:30 UTC de terça = 21:30 de segunda em SP.
    const m = momentoNoFuso('America/Sao_Paulo', new Date('2026-07-28T00:30:00Z'))
    expect(m).toEqual<Momento>({ dow: 1, min: 21 * 60 + 30 })
  })
})

describe('estaAberto', () => {
  const comercial: Faixa[] = [{ dia_semana: 1, hora_inicio: '08:00', hora_fim: '18:00', ativo: true }]

  it('dentro da faixa', () => {
    expect(estaAberto(comercial, { dow: 1, min: 600 })).toBe(true)
  })
  it('fora da faixa', () => {
    expect(estaAberto(comercial, { dow: 1, min: 1200 })).toBe(false)
  })
  it('sem faixa configurada considera aberto', () => {
    expect(estaAberto([], { dow: 1, min: 1200 })).toBe(true)
  })
  it('ignora faixa inativa', () => {
    expect(estaAberto([{ dia_semana: 1, hora_inicio: '08:00', hora_fim: '18:00', ativo: false }], { dow: 1, min: 600 }))
      .toBe(false)
  })
})

describe('temPlantonista', () => {
  it('dentro de uma janela cobre', () => {
    const janelas: Faixa[] = [{ dia_semana: 1, hora_inicio: '18:00', hora_fim: '23:00' }]
    expect(temPlantonista(janelas, { dow: 1, min: 1200 })).toBe(true)
  })
  it('sem janela cobrindo, não há plantonista', () => {
    const janelas: Faixa[] = [{ dia_semana: 2, hora_inicio: '18:00', hora_fim: '23:00' }]
    expect(temPlantonista(janelas, { dow: 1, min: 1200 })).toBe(false)
  })
  it('lista vazia, sem plantonista', () => {
    expect(temPlantonista([], { dow: 1, min: 1200 })).toBe(false)
  })
})

describe('resumoComercial', () => {
  it('agrupa dias consecutivos com a mesma faixa', () => {
    const comercial: Faixa[] = [1, 2, 3, 4, 5].map((d) => ({
      dia_semana: d,
      hora_inicio: '08:00',
      hora_fim: '18:00',
      ativo: true,
    }))
    expect(resumoComercial(comercial)).toBe('Seg a Sex 08:00 às 18:00')
  })

  it('separa grupos com faixas diferentes', () => {
    const comercial: Faixa[] = [
      ...[1, 2, 3, 4, 5].map((d) => ({ dia_semana: d, hora_inicio: '08:00', hora_fim: '18:00', ativo: true })),
      { dia_semana: 6, hora_inicio: '08:00', hora_fim: '12:00', ativo: true },
    ]
    expect(resumoComercial(comercial)).toBe('Seg a Sex 08:00 às 18:00; Sáb 08:00 às 12:00')
  })

  it('junta múltiplas faixas do mesmo dia', () => {
    const comercial: Faixa[] = [
      { dia_semana: 1, hora_inicio: '08:00', hora_fim: '12:00', ativo: true },
      { dia_semana: 1, hora_inicio: '13:00', hora_fim: '18:00', ativo: true },
    ]
    expect(resumoComercial(comercial)).toBe('Seg 08:00 às 12:00, 13:00 às 18:00')
  })

  it('sem faixas retorna vazio', () => {
    expect(resumoComercial([])).toBe('')
  })
})
