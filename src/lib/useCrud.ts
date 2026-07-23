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

  const criar = useMutation({
    mutationFn: async (valores: Partial<T>) => {
      const { error } = await supabase.from(tabela).insert(valores)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, valores }: { id: string; valores: Partial<T> }) => {
      const { error } = await supabase.from(tabela).update(valores).eq('id', id)
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

  return { lista, criar, atualizar, remover }
}
