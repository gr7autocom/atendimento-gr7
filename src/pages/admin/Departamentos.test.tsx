import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../lib/useCrud', () => ({
  useCrud: (tabela: string) => ({
    lista: {
      data:
        tabela === 'departamentos'
          ? [
              { id: '1', nome: 'SUPORTE GERAL', ordem: 1, ativo: true },
              { id: '2', nome: 'ASSUNTOS FINANCEIROS', ordem: 3, ativo: false },
            ]
          : [],
      isLoading: false,
    },
    criar: { mutate: vi.fn() },
    atualizar: { mutate: vi.fn() },
    remover: { mutate: vi.fn() },
  }),
}))

vi.mock('../../lib/useHorariosDepartamento', () => ({
  useHorariosDepartamento: () => ({
    lista: { data: [] },
    adicionar: { mutate: vi.fn() },
    atualizar: { mutate: vi.fn() },
    remover: { mutate: vi.fn() },
  }),
}))

import { Departamentos } from './Departamentos'

function montar() {
  const qc = new QueryClient()
  render(
    <QueryClientProvider client={qc}>
      <Departamentos />
    </QueryClientProvider>
  )
}

describe('Departamentos (cards)', () => {
  it('mostra cada departamento como card com nome e status', () => {
    montar()
    expect(screen.getByText('SUPORTE GERAL')).toBeInTheDocument()
    expect(screen.getByText('ASSUNTOS FINANCEIROS')).toBeInTheDocument()
    // ativo → selo "Ativo"; inativo → selo "Inativo"
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Inativo')).toBeInTheDocument()
  })

  it('tem o botão de criar e ações por card', () => {
    montar()
    expect(screen.getByRole('button', { name: /novo departamento/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /editar SUPORTE GERAL/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remover SUPORTE GERAL/i })).toBeInTheDocument()
  })
})
