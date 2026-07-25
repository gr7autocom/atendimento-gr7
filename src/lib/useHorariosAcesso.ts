import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type FaixaAcesso = {
  id: string
  usuario_id: string
  dia_semana: number
  hora_inicio: string
  hora_fim: string
}

/** Horários de acesso (plantão) por usuário: `atendimento_usuario_horarios`. */
export function useHorariosAcesso() {
  const qc = useQueryClient()
  const invalidar = () => qc.invalidateQueries({ queryKey: ['atendimento_usuario_horarios'] })

  const lista = useQuery({
    queryKey: ['atendimento_usuario_horarios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atendimento_usuario_horarios')
        .select('*')
        .order('dia_semana')
      if (error) throw error
      return (data ?? []) as unknown as FaixaAcesso[]
    },
  })

  const adicionar = useMutation({
    mutationFn: async (f: {
      usuario_id: string
      dia_semana: number
      hora_inicio: string
      hora_fim: string
    }) => {
      const { error } = await supabase.from('atendimento_usuario_horarios').insert(f as never)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, valores }: { id: string; valores: Partial<FaixaAcesso> }) => {
      const { error } = await supabase
        .from('atendimento_usuario_horarios')
        .update(valores as never)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('atendimento_usuario_horarios').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  return { lista, adicionar, atualizar, remover }
}
