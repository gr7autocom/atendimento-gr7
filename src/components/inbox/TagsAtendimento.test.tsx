import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { aplicarMutate, removerMutate } = vi.hoisted(() => ({
  aplicarMutate: vi.fn(),
  removerMutate: vi.fn(),
}))

vi.mock('../../lib/useInbox', () => ({
  useTagsDoAtendimento: () => ({
    data: [{ tag_id: 't1', tag: { id: 't1', nome: 'SUPORTE SISTEMA', cor_fundo: '#2e7d32', cor_texto: '#fff' } }],
  }),
  useAcoesTags: () => ({
    aplicar: { mutate: aplicarMutate },
    remover: { mutate: removerMutate },
  }),
}))

vi.mock('../../lib/useCrud', () => ({
  useCrud: () => ({
    lista: {
      data: [
        { id: 't1', nome: 'SUPORTE SISTEMA', ordem: 1, ativo: true, departamento_id: null },
        { id: 't2', nome: 'NOTA FISCAL', ordem: 2, ativo: true, departamento_id: null },
        { id: 't3', nome: 'SO COMERCIAL', ordem: 3, ativo: true, departamento_id: 'dep-x' },
      ],
    },
  }),
}))

import { SeletorTags, FaixaTagsAplicadas } from './TagsAtendimento'

beforeEach(() => {
  aplicarMutate.mockClear()
  removerMutate.mockClear()
})

describe('FaixaTagsAplicadas', () => {
  it('mostra as tags aplicadas como chips com remover', () => {
    render(<FaixaTagsAplicadas atendimentoId="a1" podeEditar />)
    expect(screen.getByText('SUPORTE SISTEMA')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remover tag SUPORTE SISTEMA/i })).toBeInTheDocument()
  })

  it('sem podeEditar, não mostra o botão de remover', () => {
    render(<FaixaTagsAplicadas atendimentoId="a1" podeEditar={false} />)
    expect(screen.queryByRole('button', { name: /remover tag/i })).not.toBeInTheDocument()
  })
})

describe('SeletorTags', () => {
  it('lista só as tags do setor (ou "Todos") e aplica ao clicar', () => {
    render(<SeletorTags atendimentoId="a1" departamentoId="dep-1" usuarioId="u1" />)
    fireEvent.click(screen.getByRole('button', { name: /tags do atendimento/i }))

    // t1 e t2 são "Todos"; t3 é de outro departamento, não deve aparecer
    expect(screen.getByRole('menuitemcheckbox', { name: 'NOTA FISCAL' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitemcheckbox', { name: 'SO COMERCIAL' })).not.toBeInTheDocument()

    // t1 já aplicada aparece marcada
    expect(screen.getByRole('menuitemcheckbox', { name: 'SUPORTE SISTEMA' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'NOTA FISCAL' }))
    expect(aplicarMutate).toHaveBeenCalledWith({ atendimentoId: 'a1', tagId: 't2', usuarioId: 'u1' })
  })
})
