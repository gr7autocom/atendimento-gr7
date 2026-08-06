import { describe, it, expect } from 'vitest'
import {
  CHAVE_GLOBAL,
  LIMITES,
  chaveIp,
  chaveTelefone,
  estourou,
  hashIp,
  inicioDaJanela,
  ipDaRequisicao,
} from './limites'

const AGORA = new Date('2026-08-06T12:00:00Z')

describe('inicioDaJanela', () => {
  it('recua a janela do limite', () => {
    expect(inicioDaJanela({ janelaMin: 10, maximo: 5 }, AGORA)).toBe('2026-08-06T11:50:00.000Z')
  })
})

describe('estourou', () => {
  it('libera abaixo do teto e barra a partir dele', () => {
    const limite = { janelaMin: 10, maximo: 5 }
    expect(estourou(limite, 4)).toBe(false)
    expect(estourou(limite, 5)).toBe(true)
    expect(estourou(limite, 9)).toBe(true)
  })
})

describe('chaves', () => {
  // Sem prefixo, um IP hasheado e um telefone poderiam colidir e um sujeito
  // consumiria a cota do outro.
  it('separam IP de telefone', () => {
    expect(chaveIp('abc')).toBe('ip:abc')
    expect(chaveTelefone('+5516991234567')).toBe('tel:+5516991234567')
    expect(chaveIp('x')).not.toBe(chaveTelefone('x'))
    expect(CHAVE_GLOBAL).toBe('global')
  })
})

describe('hashIp', () => {
  it('é estável para o mesmo IP e sal', async () => {
    expect(await hashIp('200.1.2.3', 'sal')).toBe(await hashIp('200.1.2.3', 'sal'))
  })

  it('separa IPs diferentes', async () => {
    expect(await hashIp('200.1.2.3', 'sal')).not.toBe(await hashIp('200.1.2.4', 'sal'))
  })

  // Sem sal, o espaço de IPv4 inteiro cabe numa varredura de segundos, e o hash
  // deixaria de proteger qualquer coisa.
  it('muda com o sal, para não ser reversível por tabela pronta', async () => {
    expect(await hashIp('200.1.2.3', 'sal-a')).not.toBe(await hashIp('200.1.2.3', 'sal-b'))
  })

  it('não guarda o IP em claro', async () => {
    const h = await hashIp('200.1.2.3', 'sal')
    expect(h).not.toContain('200.1.2.3')
    expect(h).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('ipDaRequisicao', () => {
  const req = (headers: Record<string, string>) => new Request('https://x.dev', { headers })

  it('pega o cliente no começo da cadeia do proxy', () => {
    expect(ipDaRequisicao(req({ 'x-forwarded-for': '200.1.2.3, 10.0.0.1, 10.0.0.2' }))).toBe('200.1.2.3')
  })

  it('cai no x-real-ip quando não há cadeia', () => {
    expect(ipDaRequisicao(req({ 'x-real-ip': '200.9.9.9' }))).toBe('200.9.9.9')
  })

  it('não quebra sem header nenhum', () => {
    expect(ipDaRequisicao(req({}))).toBe('desconhecido')
  })
})

describe('LIMITES', () => {
  it('mantém todos os tetos positivos e com janela', () => {
    for (const [nome, limite] of Object.entries(LIMITES)) {
      expect(limite.maximo, nome).toBeGreaterThan(0)
      expect(limite.janelaMin, nome).toBeGreaterThan(0)
    }
  })

  // O teto global existe para o pior caso não derrubar a operação, então precisa
  // ser maior que o de um IP sozinho e ainda assim finito.
  it('deixa o teto global acima do limite por IP', () => {
    expect(LIMITES.aberturaGlobal.maximo).toBeGreaterThan(LIMITES.identificarPorIp.maximo)
  })
})
