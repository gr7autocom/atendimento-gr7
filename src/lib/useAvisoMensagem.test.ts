import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// `vi.hoisted` porque o `vi.mock` sobe para o topo do arquivo: variável comum
// declarada aqui ainda não existe quando a fábrica roda.
const { tocarAvisoSonoro, tocarSomEnvio, avisar } = vi.hoisted(() => ({
  tocarAvisoSonoro: vi.fn(),
  tocarSomEnvio: vi.fn(),
  avisar: vi.fn(),
}))

vi.mock('./notificacoes', () => ({
  tocarAvisoSonoro,
  tocarSomEnvio,
  avisar,
  estadoDaPermissao: () => 'concedida',
}))

import { useAvisoMensagem } from './useAvisoMensagem'
import type { AtendimentoLista } from './useInbox'

/*
  A regra de qual som toca é o motivo deste arquivo: ela depende de três coisas
  que não estão na tela ao mesmo tempo (a lista anterior, o chamado aberto e a
  aba em foco). Conferir na mão exigiria dois monitores e um cronômetro.
*/
function chamado(id: string, ultima: string | null): AtendimentoLista {
  return { id, protocolo: 1, status: 'em_atendimento', ultima_mensagem_em: ultima } as AtendimentoLista
}

beforeEach(() => {
  tocarAvisoSonoro.mockClear()
  tocarSomEnvio.mockClear()
  avisar.mockClear()
})

describe('useAvisoMensagem', () => {
  it('não avisa na primeira carga', () => {
    renderHook(() => useAvisoMensagem([chamado('a', '2026-08-08T10:00:00Z')], null))

    expect(tocarAvisoSonoro).not.toHaveBeenCalled()
    expect(tocarSomEnvio).not.toHaveBeenCalled()
  })

  it('alerta quando a mensagem chega em chamado que não está aberto', () => {
    const { rerender } = renderHook(({ lista }) => useAvisoMensagem(lista, 'b'), {
      initialProps: { lista: [chamado('a', '2026-08-08T10:00:00Z')] },
    })

    rerender({ lista: [chamado('a', '2026-08-08T10:05:00Z')] })

    expect(tocarAvisoSonoro).toHaveBeenCalledTimes(1)
    expect(tocarSomEnvio).not.toHaveBeenCalled()
  })

  // O caso que motivou a mudança: antes o chamado aberto ficava mudo, e a
  // mensagem que chegava enquanto o atendente olhava outra janela passava batida.
  it('toca o som discreto, e não o alerta, no chamado aberto na tela', () => {
    const { rerender } = renderHook(({ lista }) => useAvisoMensagem(lista, 'a'), {
      initialProps: { lista: [chamado('a', '2026-08-08T10:00:00Z')] },
    })

    rerender({ lista: [chamado('a', '2026-08-08T10:05:00Z')] })

    expect(tocarSomEnvio).toHaveBeenCalledTimes(1)
    expect(tocarAvisoSonoro).not.toHaveBeenCalled()
    // Nem card do sistema: a pessoa está lendo justamente essa conversa.
    expect(avisar).not.toHaveBeenCalled()
  })

  it('toca os dois quando chega no aberto e em outro ao mesmo tempo', () => {
    const { rerender } = renderHook(({ lista }) => useAvisoMensagem(lista, 'a'), {
      initialProps: {
        lista: [chamado('a', '2026-08-08T10:00:00Z'), chamado('b', '2026-08-08T10:00:00Z')],
      },
    })

    rerender({
      lista: [chamado('a', '2026-08-08T10:05:00Z'), chamado('b', '2026-08-08T10:05:00Z')],
    })

    expect(tocarSomEnvio).toHaveBeenCalledTimes(1)
    expect(tocarAvisoSonoro).toHaveBeenCalledTimes(1)
  })
})
