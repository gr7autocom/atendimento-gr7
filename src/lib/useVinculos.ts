import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Par = Record<string, string>

/** Vínculo N:N (ex.: atendente_departamentos, atendimento_plantao_usuarios). */
export function useVinculos(tabela: string, colA: string, colB: string) {
  const qc = useQueryClient()

  const lista = useQuery({
    queryKey: [tabela],
    queryFn: async () => {
      const { data, error } = await supabase.from(tabela).select('*')
      if (error) throw error
      return (data ?? []) as unknown as Par[]
    },
  })

  const invalidar = () => qc.invalidateQueries({ queryKey: [tabela] })

  const vincular = useMutation({
    mutationFn: async (par: Par) => {
      const { error } = await supabase.from(tabela).insert(par as never)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  const desvincular = useMutation({
    mutationFn: async (par: Par) => {
      const { error } = await supabase.from(tabela).delete().eq(colA, par[colA]).eq(colB, par[colB])
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  return { lista, vincular, desvincular }
}

export type UsuarioLista = { id: string; nome: string; email: string }

/** `usuarios` é tabela do painel: somente leitura aqui. */
export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return (data ?? []) as unknown as UsuarioLista[]
    },
  })
}
