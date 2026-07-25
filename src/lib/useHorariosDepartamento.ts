import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type FaixaDepartamento = {
  id: string
  departamento_id: string
  dia_semana: number
  hora_inicio: string
  hora_fim: string
}

/** Horário de atendimento por departamento: `atendimento_departamento_horarios`. */
export function useHorariosDepartamento() {
  const qc = useQueryClient()
  const invalidar = () => qc.invalidateQueries({ queryKey: ['atendimento_departamento_horarios'] })

  const lista = useQuery({
    queryKey: ['atendimento_departamento_horarios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atendimento_departamento_horarios')
        .select('*')
        .order('dia_semana')
      if (error) throw error
      return (data ?? []) as unknown as FaixaDepartamento[]
    },
  })

  const adicionar = useMutation({
    mutationFn: async (f: {
      departamento_id: string
      dia_semana: number
      hora_inicio: string
      hora_fim: string
    }) => {
      const { error } = await supabase.from('atendimento_departamento_horarios').insert(f as never)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, valores }: { id: string; valores: Partial<FaixaDepartamento> }) => {
      const { error } = await supabase
        .from('atendimento_departamento_horarios')
        .update(valores as never)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('atendimento_departamento_horarios').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  return { lista, adicionar, atualizar, remover }
}
