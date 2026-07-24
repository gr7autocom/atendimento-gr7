import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const select = vi.fn().mockResolvedValue({
  data: [
    { chave: 'timezone', valor: 'America/Sao_Paulo' },
    { chave: 'avaliacao_ativa', valor: 'true' },
  ],
  error: null,
})
vi.mock('./supabase', () => ({ supabase: { from: vi.fn(() => ({ select })) } }))

import { useConfig } from './useConfig'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useConfig', () => {
  it('devolve as configs como objeto chave/valor', async () => {
    const { result } = renderHook(() => useConfig(), { wrapper })
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))
    expect(result.current.lista.data).toEqual({
      timezone: 'America/Sao_Paulo',
      avaliacao_ativa: 'true',
    })
  })
})
