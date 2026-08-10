import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from './Modal'

/**
 * `fechavel={false}` é a única saída que o pop-up de avaliação do cliente tem
 * de NÃO ter: sem ele, a nota vira algo que dá para escapar sem responder, o
 * que era exatamente o comportamento antigo (embutido no rodapé) que a
 * mudança pediu para deixar de existir. Sem teste, um ajuste futuro no `Modal`
 * — um clique fora "mais esperto", um atalho de teclado novo — pode reabrir
 * essa saída sem que ninguém note, porque nada aqui quebraria visivelmente.
 */
describe('Modal', () => {
  it('fechavel (padrão): X, Esc e clique fora chamam onFechar', () => {
    const onFechar = vi.fn()
    render(
      <Modal titulo="Título" aberto onFechar={onFechar}>
        <p>conteúdo</p>
      </Modal>
    )

    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onFechar).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onFechar).toHaveBeenCalledTimes(2)

    // O clique precisa ser no backdrop (fora da caixa), não em qualquer lugar:
    // clicar dentro do diálogo não pode fechar, e é o próprio `stopPropagation`
    // do Modal que a caixa de diálogo depende para inputs não fecharem o modal.
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onFechar).toHaveBeenCalledTimes(3)
  })

  it('fechavel={false}: sem X, Esc e clique fora não fazem nada', () => {
    const onFechar = vi.fn()
    render(
      <Modal titulo="Como foi o atendimento?" aberto onFechar={onFechar} fechavel={false}>
        <p>nota aqui</p>
      </Modal>
    )

    expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('dialog').parentElement!)

    expect(onFechar).not.toHaveBeenCalled()
    // E o conteúdo continua na tela: não fechou por nenhuma das duas vias.
    expect(screen.getByText('nota aqui')).toBeInTheDocument()
  })

  it('fechavel={false} ainda é um dialog normal para quem usa teclado', () => {
    render(
      <Modal titulo="Como foi o atendimento?" aberto onFechar={() => {}} fechavel={false}>
        <button type="button">Enviar nota</button>
      </Modal>
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Como foi o atendimento?')
  })
})
