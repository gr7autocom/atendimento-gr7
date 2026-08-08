import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/*
  Qual som toca em qual situação.

  Vira teste porque é regra de quatro casos que ninguém confere olhando a tela:
  som errado não deixa rastro visual, não quebra nada e só aparece como
  incômodo depois de semanas de uso ("a central apita demais"). O arquivo
  também entra aqui: trocar o caminho por um que não existe é falha silenciosa,
  já que o `play()` bloqueado é engolido de propósito.
*/

type AudioFalso = { src: string; volume: number; preload: string; currentTime: number; play: () => Promise<void> }

const criados: AudioFalso[] = []

beforeEach(() => {
  criados.length = 0
  vi.stubGlobal(
    'Audio',
    class {
      src: string
      volume = 1
      preload = ''
      currentTime = 0
      play = vi.fn().mockResolvedValue(undefined)
      constructor(src: string) {
        this.src = src
        criados.push(this as unknown as AudioFalso)
      }
    }
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function carregar() {
  vi.resetModules()
  return await import('./notificacoes')
}

describe('sons de notificação', () => {
  it('o alerta e o discreto são arquivos diferentes', async () => {
    const { tocarAvisoSonoro, tocarSomEnvio } = await carregar()

    tocarAvisoSonoro()
    tocarSomEnvio()

    expect(criados.map((a) => a.src)).toEqual(['/nova-mensagem.mp3', '/envio-mensagem.mp3'])
  })

  it('o discreto sai mais baixo que o alerta', async () => {
    const { tocarAvisoSonoro, tocarSomEnvio } = await carregar()

    tocarAvisoSonoro()
    tocarSomEnvio()

    const [alerta, discreto] = criados
    expect(discreto.volume).toBeLessThan(alerta.volume)
  })

  /*
    Um `Audio` por som, reaproveitado. Criar um a cada mensagem deixa objetos de
    mídia soltos e, em rajada, o navegador passa a recusar a reprodução — que é
    justamente quando o aviso importa.
  */
  it('reaproveita o mesmo Audio em rajada, reiniciando o som', async () => {
    const { tocarSomEnvio } = await carregar()

    tocarSomEnvio()
    tocarSomEnvio()
    tocarSomEnvio()

    expect(criados).toHaveLength(1)
    expect(criados[0].play).toHaveBeenCalledTimes(3)
    expect(criados[0].currentTime).toBe(0)
  })

  it('não quebra onde não existe Audio', async () => {
    vi.stubGlobal('Audio', undefined)
    const { tocarAvisoSonoro, tocarSomEnvio } = await carregar()

    expect(() => {
      tocarAvisoSonoro()
      tocarSomEnvio()
    }).not.toThrow()
  })
})
