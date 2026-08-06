import { describe, it, expect } from 'vitest'
import {
  VALIDADE_ABSOLUTA_H,
  expiracaoAbsoluta,
  fimDaSessaoAoFinalizar,
  gerarToken,
  hashToken,
  prefixoToken,
  sessaoValida,
  type SessaoViva,
} from './sessao'

const AGORA = new Date('2026-08-06T12:00:00Z')
const hAtras = (h: number) => new Date(AGORA.getTime() - h * 3600_000).toISOString()
const hFrente = (h: number) => new Date(AGORA.getTime() + h * 3600_000).toISOString()

const sessao = (p: Partial<SessaoViva> = {}): SessaoViva => ({
  expira_em: hFrente(6),
  ultimo_uso_em: hAtras(0.1),
  revogada_em: null,
  ...p,
})

describe('gerarToken', () => {
  it('gera token seguro em URL e header', () => {
    expect(gerarToken()).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('não repete', () => {
    const tokens = new Set(Array.from({ length: 200 }, gerarToken))
    expect(tokens.size).toBe(200)
  })

  it('tem entropia suficiente para força bruta não ser opção', () => {
    // 32 bytes em base64url sem padding = 43 caracteres.
    expect(gerarToken().length).toBe(43)
  })
})

describe('hashToken', () => {
  it('é estável para o mesmo token', async () => {
    const t = gerarToken()
    expect(await hashToken(t)).toBe(await hashToken(t))
  })

  it('muda para tokens diferentes', async () => {
    expect(await hashToken('a')).not.toBe(await hashToken('b'))
  })

  // O token cru nunca vai para o banco: quem ler a tabela não pode se passar por
  // cliente nenhum.
  it('não deixa o token aparecer no hash', async () => {
    const t = gerarToken()
    const h = await hashToken(t)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).not.toContain(t)
  })
})

describe('prefixoToken', () => {
  it('guarda só o começo, para casar log com sessão', () => {
    expect(prefixoToken('abcdefghijklmno')).toBe('abcdefgh')
  })
})

describe('sessaoValida', () => {
  it('aceita sessão recente e não revogada', () => {
    expect(sessaoValida(sessao(), AGORA)).toBe(true)
  })

  it('recusa sessão revogada, mesmo dentro do prazo', () => {
    expect(sessaoValida(sessao({ revogada_em: hAtras(1) }), AGORA)).toBe(false)
  })

  it('recusa depois do prazo absoluto', () => {
    expect(sessaoValida(sessao({ expira_em: hAtras(1) }), AGORA)).toBe(false)
  })

  // Cobre o token esquecido numa máquina compartilhada: o prazo absoluto ainda não
  // venceu, mas ninguém usa há horas.
  it('recusa por inatividade mesmo com o prazo absoluto de pé', () => {
    const s = sessao({ expira_em: hFrente(6), ultimo_uso_em: hAtras(3) })
    expect(sessaoValida(s, AGORA)).toBe(false)
  })

  it('aceita quem usou há pouco', () => {
    expect(sessaoValida(sessao({ ultimo_uso_em: hAtras(1.9) }), AGORA)).toBe(true)
  })
})

describe('expiracaoAbsoluta', () => {
  it('marca o prazo a partir de agora', () => {
    expect(expiracaoAbsoluta(AGORA)).toBe(hFrente(VALIDADE_ABSOLUTA_H))
  })
})

describe('fimDaSessaoAoFinalizar', () => {
  // Finalizar não revoga na hora: avaliação e reabertura acontecem DEPOIS do fim,
  // e matar a sessão junto derrubaria as duas.
  it('estende até o fim da janela de reabertura', () => {
    expect(fimDaSessaoAoFinalizar(AGORA, 3)).toBe(hFrente(3))
  })
})
