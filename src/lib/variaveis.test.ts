import { describe, it, expect } from 'vitest'
import { aplicarVariaveis } from './variaveis'

describe('aplicarVariaveis', () => {
  it('troca as variáveis em português (chave dupla)', () => {
    const t = 'Olá {{contato}}, aqui é {{atendente}} da {{empresa}}. Protocolo {{protocolo}}.'
    const r = aplicarVariaveis(t, {
      atendente: 'Bruno',
      contato: 'João',
      empresa: 'HORTIFRUTI',
      protocolo: '8',
    })
    expect(r).toBe('Olá João, aqui é Bruno da HORTIFRUTI. Protocolo 8.')
  })

  it('tolera espaços e repetições', () => {
    expect(aplicarVariaveis('{{ atendente }} e {{atendente}}', { atendente: 'Ana' })).toBe('Ana e Ana')
  })

  it('chave conhecida com valor nulo vira vazio', () => {
    expect(aplicarVariaveis('oi {{contato}}', { contato: null })).toBe('oi ')
  })

  it('chave desconhecida fica como está', () => {
    expect(aplicarVariaveis('nota {{obs}}', { atendente: 'Ana' })).toBe('nota {{obs}}')
  })
})
