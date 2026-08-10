import { describe, it, expect, beforeEach, vi } from 'vitest'

/*
  Sem depender de permissão nenhuma é o ponto inteiro deste módulo — por isso
  o teste nem finge ter Notification concedida. Só título e favicon, que
  qualquer aba pode mudar sozinha.
*/

/*
  jsdom não implementa decode de imagem: sem isto, `new Image().onload` nunca
  dispara e o favicon nunca atualiza no teste. Uma vez só, fora do `beforeEach`
  — `Object.defineProperty` sem `configurable: true` vira propriedade fixa, e
  a segunda tentativa de redefinir no próximo teste derrubaria o `beforeEach`
  inteiro com "Cannot redefine property".
*/
Object.defineProperty(window.Image.prototype, 'src', {
  configurable: true,
  set(this: HTMLImageElement) {
    setTimeout(() => this.onload?.(new Event('load')))
  },
})
Object.defineProperty(window.Image.prototype, 'width', { configurable: true, value: 48 })
Object.defineProperty(window.Image.prototype, 'height', { configurable: true, value: 46 })

/*
  jsdom não desenha canvas de verdade ("without installing the canvas npm
  package"). O que o teste precisa confirmar é que o favicon TROCA para algo
  novo, não o desenho pixel a pixel — então o canvas 2D vira um dublê que
  aceita as chamadas e a exportação devolve uma string fixa e reconhecível.
*/
const CANVAS_FALSO = 'data:image/png;base64,FALSO'
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  drawImage: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
}) as unknown as typeof HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue(CANVAS_FALSO)

beforeEach(() => {
  // O `<link>` primeiro: `head.innerHTML` substitui TODO o conteúdo do head,
  // e o `<title>` também mora lá. Fazer isso depois de setar o título
  // apagaria o próprio título que o teste acabou de definir.
  document.head.innerHTML = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />'
  document.title = 'GR7 Atendimento'
  vi.resetModules()
})

async function carregar() {
  return await import('./tituloAba')
}

describe('avisarNaAba / limparAba', () => {
  it('prefixa o título com a contagem, sem apagar o título original', async () => {
    const { avisarNaAba } = await carregar()

    avisarNaAba(1)
    expect(document.title).toBe('(1) GR7 Atendimento')

    avisarNaAba(2)
    expect(document.title).toBe('(3) GR7 Atendimento')
  })

  it('limparAba restaura o título original e zera a contagem', async () => {
    const { avisarNaAba, limparAba } = await carregar()

    avisarNaAba(5)
    limparAba()
    expect(document.title).toBe('GR7 Atendimento')

    // Depois de zerado, o próximo aviso recomeça de 1 — não continua de 5.
    avisarNaAba(1)
    expect(document.title).toBe('(1) GR7 Atendimento')
  })

  it('não faz nada com quantos <= 0', async () => {
    const { avisarNaAba } = await carregar()

    avisarNaAba(0)
    expect(document.title).toBe('GR7 Atendimento')
  })

  it('troca o href do favicon enquanto há contagem, e restaura ao limpar', async () => {
    const { avisarNaAba, limparAba } = await carregar()
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement
    const hrefOriginal = link.href

    avisarNaAba(1)
    await vi.waitFor(() => expect(link.href).not.toBe(hrefOriginal))
    expect(link.href).toBe(CANVAS_FALSO)

    limparAba()
    expect(link.href).toBe(hrefOriginal)
  })

  it('sem link de favicon na página, ainda assim não quebra', async () => {
    // Só o link do ícone sai, não o `<head>` inteiro — que também derrubaria o
    // `<title>` que o `beforeEach` acabou de definir.
    document.querySelector('link[rel="icon"]')?.remove()
    const { avisarNaAba, limparAba } = await carregar()

    expect(() => avisarNaAba(1)).not.toThrow()
    expect(document.title).toBe('(1) GR7 Atendimento')
    expect(() => limparAba()).not.toThrow()
  })
})
