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
import { api, type MensagemWeb } from './api'

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

  /**
   * Segundo bug real, achado testando o primeiro em produção (2026-08-10):
   * quando o cliente trocava de aba do navegador esperando resposta, o app
   * PARAVA de consultar o servidor por completo — não é que o aviso falhasse,
   * é que nada rodava para disparar aviso algum. Só voltava a checar quando a
   * pessoa voltava à aba, e nesse momento já estava olhando, então o problema
   * "como saber sem olhar" continuava sem resposta.
   *
   * `vi.useFakeTimers`, e não espera de verdade: os 30s deste teste em tempo
   * real esbarraram na instabilidade do navegador controlado ao validar isto
   * ao vivo (tempo decorrido incerto, estado da página revertendo entre
   * chamadas da ferramenta) — o relógio controlado prova o mesmo sem depender
   * de quanto tempo realmente passa.
   */
  it('continua consultando com a aba trocada, só mais devagar — nunca parado', async () => {
    // O teste anterior salvou uma sessão de verdade no localStorage do jsdom,
    // que persiste entre testes do mesmo arquivo. Sem limpar, `AppCliente`
    // encontra esse token já ao montar e pula direto para a conversa, sem
    // passar pela identificação que este teste precisa preencher.
    localStorage.clear()

    // O jsdom deste projeto não tem `<title>` nenhum fora do que o próprio
    // `cliente.html` real declara — que este teste não carrega, só o
    // componente. Sem isto, o "título base" que `avisarNaAba` guarda na
    // primeira chamada seria a string vazia, e a asserção do final não teria
    // como bater com o que a tela de verdade mostra.
    document.title = 'GR7 Atendimento'

    // Todo navegador real devolve uma Promise de `HTMLMediaElement.play()`
    // desde 2018; o jsdom deste projeto devolve `undefined`, e o código de
    // produção (com razão) confia no comportamento real do navegador. Sem o
    // stub, `tocarAvisoSonoro` lança ao chamar `.catch()` num `undefined`, e o
    // `catch` silencioso do `buscarConversa` engole isso sem dizer nada —
    // foi assim que o teste passou a falha real por muito tempo até este
    // ponto ser isolado.
    vi.stubGlobal(
      'Audio',
      class {
        volume = 1
        preload = ''
        currentTime = 0
        play = vi.fn().mockResolvedValue(undefined)
        constructor(_src: string) {}
      }
    )

    // `shouldAdvanceTime`: sem isto, o `findByLabelText`/`waitFor` do Testing
    // Library ficam esperando um `setTimeout` real que nunca chega a avançar
    // sozinho — o relógio fica todo sob meu controle, e nada mais o move.
    // Com a opção, o tempo falso acompanha o tempo real automaticamente por
    // conta própria, e eu só preciso empurrá-lo à frente nos saltos grandes.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let mensagens: MensagemWeb[] = [
        { id: 'm1', direcao: 'entrada', origem: 'cliente', corpo: 'Meu sistema não abre', created_at: new Date().toISOString() },
      ]
      const conversaMock = vi.fn(() =>
        Promise.resolve({
          protocolo: 111,
          status: 'em_atendimento' as const,
          encerrado: false,
          departamento: 'Suporte',
          atendente: 'Ana',
          aguardando_avaliacao: false,
          anexos: [],
          mensagens,
        })
      )
      vi.mocked(api.identificar).mockResolvedValue({
        token: 'tok-aba-trocada',
        expira_em: new Date(Date.now() + 3600_000).toISOString(),
        protocolo: 111,
        departamento: 'Suporte',
        empresa: null,
      })
      vi.mocked(api.conversa).mockImplementation(conversaMock)

      render(<AppCliente />)

      fireEvent.change(await screen.findByLabelText('Seu nome'), { target: { value: 'Cliente Aba' } })
      fireEvent.change(screen.getByLabelText('Telefone com DDD', { exact: false }), {
        target: { value: '16991234567' },
      })
      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Suporte' }))
      const textarea = await screen.findByLabelText('Sua mensagem')
      fireEvent.change(textarea, { target: { value: 'Meu sistema não abre' } })
      fireEvent.submit(textarea.closest('form')!)

      await waitFor(() => expect(conversaMock).toHaveBeenCalledTimes(1))
      conversaMock.mockClear()

      // Troca de aba: hidden=true, sem foco, e o evento que o efeito escuta.
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false })
      document.dispatchEvent(new Event('visibilitychange'))

      // No ritmo antigo (10s) já teria disparado duas vezes nesses 20s; no
      // ritmo novo (30s), nenhuma ainda — mas nenhuma não é a mesma coisa que
      // PARADO, o que o resto do teste prova.
      await vi.advanceTimersByTimeAsync(20_000)
      expect(conversaMock).not.toHaveBeenCalled()

      // Chega a resposta do atendente enquanto a aba está trocada.
      mensagens = [
        ...mensagens,
        { id: 'm2', direcao: 'saida', origem: 'atendente', corpo: 'Resolvido, pode testar', created_at: new Date().toISOString() },
      ]

      // Passa dos 30s (mais 11s, 31s no total): o ritmo lento dispara.
      await vi.advanceTimersByTimeAsync(11_000)
      expect(conversaMock).toHaveBeenCalled()

      // E o aviso escala de verdade: título com o contador, prova de que a
      // mensagem foi detectada e tratada como "ninguém está olhando", mesmo
      // no ritmo lento da aba trocada.
      await waitFor(() => expect(document.title).toBe('(1) GR7 Atendimento'))
    } finally {
      vi.useRealTimers()
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
      Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => true })
    }
  }, 15_000)
})
