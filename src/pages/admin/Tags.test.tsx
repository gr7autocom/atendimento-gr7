import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../lib/useCrud', () => ({
  useCrud: (tabela: string) => ({
    lista: {
      data:
        tabela === 'departamentos'
          ? [{ id: 'd1', nome: 'SUPORTE GERAL', ordem: 1, ativo: true }]
          : [
              {
                id: 't1',
                nome: 'SUPORTE SISTEMA',
                ordem: 1,
                ativo: true,
                cor_fundo: '#2e7d32',
                cor_texto: '#ffffff',
                departamento_id: null,
              },
              {
                id: 't2',
                nome: 'NOTA FISCAL',
                ordem: 2,
                ativo: true,
                cor_fundo: '#1565c0',
                cor_texto: '#ffffff',
                departamento_id: 'd1',
              },
            ],
      isLoading: false,
    },
    criar: { mutate: vi.fn() },
    atualizar: { mutate: vi.fn() },
    remover: { mutate: vi.fn() },
  }),
}))

import { Tags } from './Tags'

function montar() {
  const qc = new QueryClient()
  render(
    <QueryClientProvider client={qc}>
      <Tags />
    </QueryClientProvider>
  )
}

describe('Tags (lista com cor e departamento)', () => {
  it('mostra cada tag como pill e seu escopo de departamento', () => {
    montar()
    expect(screen.getByText('SUPORTE SISTEMA')).toBeInTheDocument()
    expect(screen.getByText('NOTA FISCAL')).toBeInTheDocument()
    // tag sem departamento vale para todos; a com departamento mostra o nome do setor
    expect(screen.getByText('Todos os departamentos')).toBeInTheDocument()
    expect(screen.getByText('SUPORTE GERAL')).toBeInTheDocument()
  })

  it('tem busca, botão de criar e ações por tag', () => {
    montar()
    expect(screen.getByLabelText(/buscar tag/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nova tag/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /editar SUPORTE SISTEMA/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remover SUPORTE SISTEMA/i })).toBeInTheDocument()
  })
})
