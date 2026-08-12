import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Botao } from './Botao'

/**
 * `<button>` sem `type` nasce `type="submit"` dentro de `<form>` (padrão do
 * HTML). Foi assim que o Enter no campo de resposta da central acionava o
 * microfone em vez de mandar a mensagem: `BotaoGravar` vinha antes do
 * "Enviar" no DOM e virava, sem querer, o alvo do Enter. Reproduz aqui a
 * mesma estrutura de `Conversa.tsx` para não deixar o bug voltar.
 */
describe('Botao', () => {
  it('nasce type="button" por padrão', () => {
    render(<Botao>Rótulo</Botao>)
    expect(screen.getByRole('button', { name: 'Rótulo' })).toHaveAttribute('type', 'button')
  })

  it('type="submit" continua funcionando quando pedido de propósito', () => {
    render(<Botao type="submit">Enviar</Botao>)
    expect(screen.getByRole('button', { name: 'Enviar' })).toHaveAttribute('type', 'submit')
  })

  it('Enter no campo de um formulário submete, e não clica no botão sem type que vem antes', async () => {
    const usuario = userEvent.setup()
    const aoGravar = vi.fn()
    const aoEnviar = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={aoEnviar}>
        <Botao onClick={aoGravar} aria-label="Gravar áudio">
          Mic
        </Botao>
        <input aria-label="Resposta" />
        <Botao type="submit">Enviar</Botao>
      </form>
    )

    await usuario.click(screen.getByLabelText('Resposta'))
    await usuario.keyboard('{Enter}')

    expect(aoGravar).not.toHaveBeenCalled()
    expect(aoEnviar).toHaveBeenCalledTimes(1)
  })
})
