import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const order = vi.fn().mockResolvedValue({ data: [{ id: '1', nome: 'Suporte' }], error: null })
const select = vi.fn(() => ({ order }))
vi.mock('./supabase', () => ({ supabase: { from: vi.fn(() => ({ select })) } }))

import { useCrud } from './useCrud'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useCrud', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lista itens ordenados da tabela', async () => {
    const { result } = renderHook(() => useCrud('departamentos'), { wrapper })
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))
    expect(result.current.lista.data).toEqual([{ id: '1', nome: 'Suporte' }])
    expect(select).toHaveBeenCalled()
  })
})
