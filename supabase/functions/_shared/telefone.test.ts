import { describe, it, expect } from 'vitest'
import { e164, normalizarTelefoneBR } from './telefone'

describe('e164', () => {
  it('formata dígitos que já trazem o DDI', () => {
    expect(e164('5516991234567')).toBe('+5516991234567')
    expect(e164('+55 16 99123-4567')).toBe('+5516991234567')
  })

  it('preserva número internacional, sem impor o 55', () => {
    expect(e164('351912345678')).toBe('+351912345678')
    expect(e164('12125551234')).toBe('+12125551234')
  })

  it('recusa o que não é telefone plausível', () => {
    expect(e164('')).toBe('')
    expect(e164('991234567')).toBe('') // curto demais, sem DDI
    expect(e164('1234567890123456')).toBe('') // acima do teto do E.164
    expect(e164('abc')).toBe('')
  })
})

describe('normalizarTelefoneBR', () => {
  it('normaliza celular digitado com máscara', () => {
    expect(normalizarTelefoneBR('(16) 99123-4567')).toBe('+5516991234567')
    expect(normalizarTelefoneBR('16991234567')).toBe('+5516991234567')
    expect(normalizarTelefoneBR('16 99123 4567')).toBe('+5516991234567')
  })

  it('normaliza fixo de 8 dígitos com DDD', () => {
    expect(normalizarTelefoneBR('(16) 3123-4567')).toBe('+551631234567')
  })

  it('aceita o 55 escrito, com ou sem o mais', () => {
    expect(normalizarTelefoneBR('5516991234567')).toBe('+5516991234567')
    expect(normalizarTelefoneBR('+55 (16) 99123-4567')).toBe('+5516991234567')
    expect(normalizarTelefoneBR('551631234567')).toBe('+551631234567')
  })

  it('descarta o zero de operadora', () => {
    expect(normalizarTelefoneBR('016 99123-4567')).toBe('+5516991234567')
    expect(normalizarTelefoneBR('0 16 3123-4567')).toBe('+551631234567')
  })

  // O mesmo humano digitando de jeitos diferentes precisa cair no MESMO contato,
  // senão o histórico unificado (o motivo de pedir o telefone) não acontece.
  it('leva todas as grafias do mesmo número ao mesmo resultado', () => {
    const grafias = [
      '(16) 99123-4567',
      '16991234567',
      '016 99123-4567',
      '5516991234567',
      '+55 16 99123-4567',
      ' 16 9 9123 4567 ',
    ]
    const normalizados = new Set(grafias.map(normalizarTelefoneBR))
    expect(normalizados).toEqual(new Set(['+5516991234567']))
  })

  it('respeita o mais como declaração de país, sem prefixar 55', () => {
    expect(normalizarTelefoneBR('+351 912 345 678')).toBe('+351912345678')
  })

  it('recusa número sem DDD, porque adivinhar amarraria ao contato errado', () => {
    expect(normalizarTelefoneBR('99123-4567')).toBe('')
    expect(normalizarTelefoneBR('3123-4567')).toBe('')
  })

  it('recusa DDD inexistente', () => {
    expect(normalizarTelefoneBR('1091234567')).toBe('') // DDD 10 não existe
    expect(normalizarTelefoneBR('5510912345678')).toBe('') // com DDI e DDD 10
  })

  it('recusa entrada vazia ou sem dígito', () => {
    expect(normalizarTelefoneBR('')).toBe('')
    expect(normalizarTelefoneBR('   ')).toBe('')
    expect(normalizarTelefoneBR(null)).toBe('')
    expect(normalizarTelefoneBR(undefined)).toBe('')
    expect(normalizarTelefoneBR('telefone')).toBe('')
  })
})
