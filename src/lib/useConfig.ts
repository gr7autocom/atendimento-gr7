import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type BotMensagem = { id: string; chave: string; texto: string; ativo: boolean }

/** atendimento_config: a PK é `chave`, então gravamos com upsert (não update por id). */
export function useConfig() {
  const qc = useQueryClient()

  const lista = useQuery({
    queryKey: ['atendimento_config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('atendimento_config').select('*')
      if (error) throw error
      const linhas = (data ?? []) as unknown as { chave: string; valor: string }[]
      return Object.fromEntries(linhas.map((l) => [l.chave, l.valor])) as Record<string, string>
    },
  })

  const salvar = useMutation({
    mutationFn: async (valores: Record<string, string>) => {
      const linhas = Object.entries(valores).map(([chave, valor]) => ({ chave, valor }))
      const { error } = await supabase.from('atendimento_config').upsert(linhas as never)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['atendimento_config'] }),
  })

  return { lista, salvar }
}

export function useBotMensagens() {
  const qc = useQueryClient()

  const lista = useQuery({
    queryKey: ['bot_mensagens'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bot_mensagens').select('*').order('chave')
      if (error) throw error
      return (data ?? []) as unknown as BotMensagem[]
    },
  })

  const salvar = useMutation({
    mutationFn: async ({ id, texto }: { id: string; texto: string }) => {
      const { error } = await supabase.from('bot_mensagens').update({ texto } as never).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bot_mensagens'] }),
  })

  return { lista, salvar }
}
