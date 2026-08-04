import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export function useCrud<T extends { id: string }>(tabela: string, orderBy = 'ordem') {
  const qc = useQueryClient()
  const invalidar = () => qc.invalidateQueries({ queryKey: [tabela] })

  const lista = useQuery({
    queryKey: [tabela],
    queryFn: async () => {
      const { data, error } = await supabase.from(tabela).select('*').order(orderBy)
      if (error) throw error
      return (data ?? []) as T[]
    },
  })

  // A tabela é dinâmica (string) e o projeto não gera types do banco, então o
  // supabase-js não consegue inferir a forma da linha. O cast `as never` é o
  // escape recomendado nesse caso; a forma real é garantida pelos campos da tela.
  const criar = useMutation({
    mutationFn: async (valores: Partial<T>) => {
      const { error } = await supabase.from(tabela).insert(valores as never)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, valores }: { id: string; valores: Partial<T> }) => {
      const { error } = await supabase.from(tabela).update(valores as never).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tabela).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  // Sem isto, gravação recusada falhava em silêncio: a mutation lançava, o
  // TanStack revalidava a lista e a tela voltava ao valor antigo sozinha. Para
  // quem usa, parecia que o botão Salvar não funcionava. Aconteceu de verdade
  // em 2026-07-31, com uma chave de API inválida.
  const erro = mensagemErroCrud(criar.error ?? atualizar.error ?? remover.error)

  function limparErro() {
    criar.reset()
    atualizar.reset()
    remover.reset()
  }

  return { lista, criar, atualizar, remover, erro, limparErro }
}

/** Traduz o erro do Supabase para o que o usuário precisa fazer a respeito. */
export function mensagemErroCrud(erro: unknown): string | null {
  if (!erro) return null
  const e = erro as { code?: string; message?: string }
  switch (e.code) {
    case '42501':
      return 'Você não tem permissão para esta alteração. Fale com o administrador.'
    case '23505':
      return 'Já existe um registro com esse valor. Use outro.'
    case '23503':
      return 'Este item está em uso e não pode ser alterado assim.'
    case '23514':
      return 'Algum campo está fora do formato esperado. Confira e tente de novo.'
    default:
      return e.message
        ? `Não foi possível salvar: ${e.message}`
        : 'Não foi possível salvar. Verifique a conexão e tente de novo.'
  }
}
