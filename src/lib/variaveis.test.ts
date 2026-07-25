import { describe, it, expect } from 'vitest'
import { aplicarVariaveis } from './variaveis'

describe('aplicarVariaveis', () => {
  it('troca agent.name e contact.name', () => {
    const t = 'Olá {{contact.name}}, meu nome é {{agent.name}}.'
    expect(aplicarVariaveis(t, { agente: 'Bruno', contato: 'João' })).toBe('Olá João, meu nome é Bruno.')
  })

  it('tolera espaços dentro das chaves e repetições', () => {
    const t = '{{ agent.name }} e de novo {{agent.name}}'
    expect(aplicarVariaveis(t, { agente: 'Ana', contato: null })).toBe('Ana e de novo Ana')
  })

  it('sem valor vira string vazia', () => {
    expect(aplicarVariaveis('oi {{contact.name}}', { agente: null, contato: null })).toBe('oi ')
  })
})
