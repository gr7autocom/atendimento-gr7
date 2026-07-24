import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const order = vi.fn().mockResolvedValue({
  data: [
    {
      id: 'a1',
      protocolo: 1,
      status: 'na_fila',
      contato: { id: 'c1', nome: 'João', telefone: '+5511999990000', cliente_id: null },
      departamento: { nome: 'SUPORTE GERAL' },
    },
  ],
  error: null,
})
const select = vi.fn(() => ({ order }))
vi.mock('./supabase', () => ({ supabase: { from: vi.fn(() => ({ select })) } }))

import { useAtendimentos } from './useInbox'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useAtendimentos', () => {
  it('lista atendimentos com contato e departamento', async () => {
    const { result } = renderHook(() => useAtendimentos(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].contato?.nome).toBe('João')
    expect(result.current.data?.[0].departamento?.nome).toBe('SUPORTE GERAL')
  })
})
