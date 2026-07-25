import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../lib/useVinculos', () => ({
  useUsuarios: () => ({
    data: [
      { id: 'u1', nome: 'Bruno Scoz', email: 'bruno@x.com', foto_url: 'http://x/f.jpg', ativo: true },
      { id: 'u2', nome: 'Iago Scandar', email: 'iago@x.com', foto_url: null, ativo: false },
    ],
    isLoading: false,
  }),
  useVinculos: () => ({
    lista: { data: [{ usuario_id: 'u1', departamento_id: 'd1' }] },
    vincular: { mutate: vi.fn() },
    desvincular: { mutate: vi.fn() },
  }),
}))

vi.mock('../../lib/useCrud', () => ({
  useCrud: () => ({
    lista: {
      data: [
        { id: 'd1', nome: 'SUPORTE GERAL', ativo: true },
        { id: 'd2', nome: 'FINANCEIRO', ativo: true },
      ],
    },
  }),
}))

vi.mock('../../lib/useHorariosAcesso', () => ({
  useHorariosAcesso: () => ({
    lista: { data: [] },
    adicionar: { mutate: vi.fn() },
    atualizar: { mutate: vi.fn() },
    remover: { mutate: vi.fn() },
  }),
}))

import { Usuarios } from './Usuarios'

describe('Atendentes (cards)', () => {
  it('mostra só os ativos por padrão, com o departamento vinculado', () => {
    render(<Usuarios />)
    expect(screen.getByText('Bruno Scoz')).toBeInTheDocument()
    // Iago está inativo; filtro padrão é "Ativos"
    expect(screen.queryByText('Iago Scandar')).not.toBeInTheDocument()
    // chip do departamento no card do Bruno (também aparece no filtro, por isso getAll)
    expect(screen.getAllByText('SUPORTE GERAL').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /editar Bruno Scoz/i })).toBeInTheDocument()
  })

  it('filtro de status Inativos mostra o atendente inativo', () => {
    render(<Usuarios />)
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'inativos' } })
    expect(screen.getByText('Iago Scandar')).toBeInTheDocument()
    expect(screen.queryByText('Bruno Scoz')).not.toBeInTheDocument()
  })
})
