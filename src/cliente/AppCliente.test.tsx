import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Bug real de produção (2026-08-10): ao mandar a primeira mensagem, a tela
 * mostrava de volta o formulário de identificação por um instante, antes do
 * chat aparecer. A causa: entre `identificar` guardar o token e `conversa`
 * responder (duas idas ao servidor, uma depois da outra), nenhuma das
 * checagens de tela batia — sem rascunho (já foi limpo), sem conversa (ainda
 * não chegou) — e o código caía no `return` do fim, que é o formulário.
 *
 * Em teste local a rede é instantânea e a brecha nunca durou o suficiente
 * para aparecer; por isso só apareceu em produção. Aqui as duas chamadas são
 * `Promise`s que só resolvem quando o teste decide, para prender a tela
 * exatamente nesse instante e conferir o que ela mostra.
 */

const { disponibilidadeMock, identificarDeferido, conversaDeferido } = vi.hoisted(() => {
  function deferido<T>() {
    let resolve!: (v: T) => void
    const promise = new Promise<T>((r) => {
      resolve = r
    })
    return { promise, resolve }
  }
  return {
    disponibilidadeMock: {
      pode_abrir: true,
      plantao: false,
      mensagem_fora_horario: null,
      departamentos: [{ id: 'd1', nome: 'Suporte' }],
      textos: { bem_vindo: '', pergunta_setor: 'Qual assunto?', pedir_relato: 'Conte o que houve' },
    },
    identificarDeferido: deferido<{ token: string; expira_em: string; protocolo: number; departamento: string; empresa: string | null }>(),
    conversaDeferido: deferido<{
      protocolo: number
      status: string
      encerrado: boolean
      departamento: string | null
      atendente: string | null
      aguardando_avaliacao: boolean
      mensagens: unknown[]
      anexos: unknown[]
    }>(),
  }
})

vi.mock('./api', async (importOriginal) => {
  const real = await importOriginal<typeof import('./api')>()
  return {
    ...real,
    api: {
      ...real.api,
      disponibilidade: vi.fn().mockResolvedValue(disponibilidadeMock),
      identificar: vi.fn(() => identificarDeferido.promise),
      conversa: vi.fn(() => conversaDeferido.promise),
    },
  }
})

import { AppCliente } from './AppCliente'

// jsdom não implementa matchMedia; a tela de conversa consulta
// `prefers-reduced-motion` para decidir a rolagem, e sem isto o efeito
// quebra ao montar o componente (nada a ver com o bug em teste).
window.matchMedia ??= vi.fn().mockReturnValue({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})
// Idem para o autoscroll ao chegar mensagem: jsdom não implementa.
Element.prototype.scrollIntoView ??= vi.fn()

describe('AppCliente', () => {
  it('nao volta para o formulario entre abrir o chamado e a conversa chegar', async () => {
    render(<AppCliente />)

    fireEvent.change(await screen.findByLabelText('Seu nome'), { target: { value: 'Cliente Teste' } })
    // `exact: false`: o rótulo do telefone tem uma dica embutida no mesmo
    // `<label>` (ver `Envolucro` em `ui/Campo.tsx`), então o texto acessível
    // do campo é "Telefone com DDD" + a dica, não só o rótulo isolado.
    fireEvent.change(screen.getByLabelText('Telefone com DDD', { exact: false }), {
      target: { value: '16991234567' },
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Suporte' }))

    const textarea = await screen.findByLabelText('Sua mensagem')
    fireEvent.change(textarea, { target: { value: 'Meu sistema não abre' } })
    fireEvent.submit(textarea.closest('form')!)

    // `identificar` respondeu (token guardado), `conversa` ainda não: a brecha
    // exata do bug. Nada aqui resolve sozinho — o teste controla o relógio.
    identificarDeferido.resolve({
      token: 'tok-teste',
      expira_em: new Date(Date.now() + 3600_000).toISOString(),
      protocolo: 999,
      departamento: 'Suporte',
      empresa: null,
    })

    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Abrindo o atendimento' })).toBeInTheDocument()
    })
    // O achado do bug: o formulário do zero não pode reaparecer aqui.
    expect(screen.queryByLabelText('Seu nome')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continuar' })).not.toBeInTheDocument()

    conversaDeferido.resolve({
      protocolo: 999,
      status: 'na_fila',
      encerrado: false,
      departamento: 'Suporte',
      atendente: null,
      aguardando_avaliacao: false,
      mensagens: [{ id: 'm1', direcao: 'entrada', origem: 'cliente', corpo: 'Meu sistema não abre', created_at: new Date().toISOString() }],
      anexos: [],
    })

    expect(await screen.findByText('Meu sistema não abre')).toBeInTheDocument()
  })
})
