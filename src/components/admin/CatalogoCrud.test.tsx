import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../lib/useCrud', () => ({
  useCrud: () => ({
    lista: { data: [{ id: '1', nome: 'Suporte Geral', ordem: 1, ativo: true }], isLoading: false },
    criar: { mutate: vi.fn() },
    atualizar: { mutate: vi.fn() },
    remover: { mutate: vi.fn() },
  }),
}))

import { CatalogoCrud } from './CatalogoCrud'

describe('CatalogoCrud', () => {
  it('lista os itens do catalogo', () => {
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <CatalogoCrud
          titulo="Departamentos"
          tabela="departamentos"
          campos={[{ nome: 'nome', label: 'Nome', tipo: 'texto', obrigatorio: true }]}
          colunas={['nome']}
        />
      </QueryClientProvider>
    )
    expect(screen.getByText('Suporte Geral')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /novo/i })).toBeInTheDocument()
  })
})
