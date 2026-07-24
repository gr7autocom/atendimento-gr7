import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type ContatoResumo = {
  id: string
  nome: string | null
  nome_whatsapp: string | null
  telefone: string
  cliente_id: string | null
}

export type StatusAtendimento = 'triagem' | 'na_fila' | 'em_atendimento' | 'finalizado'

export type AtendimentoLista = {
  id: string
  protocolo: number
  status: StatusAtendimento
  departamento_id: string | null
  responsavel_id: string | null
  ultima_mensagem_em: string
  contato: ContatoResumo | null
  departamento: { nome: string } | null
}

export type Mensagem = {
  id: string
  direcao: 'entrada' | 'saida'
  origem: 'cliente' | 'atendente' | 'bot'
  corpo: string | null
  created_at: string
  remetente_usuario_id: string | null
}

const SELECT_ATENDIMENTO =
  '*, contato:contatos(id, nome, nome_whatsapp, telefone, cliente_id), departamento:departamentos(nome)'

export function useAtendimentos() {
  return useQuery({
    queryKey: ['atendimentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atendimentos')
        .select(SELECT_ATENDIMENTO)
        .order('ultima_mensagem_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as AtendimentoLista[]
    },
    refetchInterval: 10000,
  })
}

export function useMensagens(atendimentoId: string | null) {
  return useQuery({
    queryKey: ['atendimento_mensagens', atendimentoId],
    enabled: !!atendimentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atendimento_mensagens')
        .select('*')
        .eq('atendimento_id', atendimentoId as string)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as Mensagem[]
    },
    refetchInterval: 10000,
  })
}

/** Edição do contato pelo atendente: nome de quem fala e vínculo com a empresa. */
export function useAtualizarContato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      valores,
    }: {
      id: string
      valores: { nome?: string | null; cliente_id?: string | null }
    }) => {
      const { error } = await supabase.from('contatos').update(valores as never).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['atendimentos'] }),
  })
}

export function useAcoesAtendimento() {
  const qc = useQueryClient()
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['atendimentos'] })
    qc.invalidateQueries({ queryKey: ['atendimento_mensagens'] })
  }

  const assumir = useMutation({
    mutationFn: async ({ id, usuarioId }: { id: string; usuarioId: string }) => {
      const { error } = await supabase
        .from('atendimentos')
        .update({
          responsavel_id: usuarioId,
          status: 'em_atendimento',
          assumido_em: new Date().toISOString(),
        } as never)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  /** Responder assume o chamado se ninguém pegou ainda (regra do fluxo, ver bot.md). */
  const responder = useMutation({
    mutationFn: async ({
      atendimentoId,
      corpo,
      usuarioId,
      precisaAssumir,
    }: {
      atendimentoId: string
      corpo: string
      usuarioId: string
      precisaAssumir: boolean
    }) => {
      const { error } = await supabase.from('atendimento_mensagens').insert({
        atendimento_id: atendimentoId,
        direcao: 'saida',
        origem: 'atendente',
        corpo,
        remetente_usuario_id: usuarioId,
        status: 'enviado',
      } as never)
      if (error) throw error

      const patch: Record<string, unknown> = { ultima_mensagem_em: new Date().toISOString() }
      if (precisaAssumir) {
        patch.responsavel_id = usuarioId
        patch.status = 'em_atendimento'
        patch.assumido_em = new Date().toISOString()
      }
      const { error: err2 } = await supabase.from('atendimentos').update(patch as never).eq('id', atendimentoId)
      if (err2) throw err2
    },
    onSuccess: invalidar,
  })

  const finalizar = useMutation({
    mutationFn: async ({ id, motivoId }: { id: string; motivoId: string | null }) => {
      const { error } = await supabase
        .from('atendimentos')
        .update({
          status: 'finalizado',
          motivo_id: motivoId,
          finalizado_em: new Date().toISOString(),
          encerrado_por: 'atendente',
        } as never)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  /**
   * Transferência vai por RPC, não por UPDATE direto: ao mandar o chamado para
   * um departamento que o usuário não atende, a linha sai da visibilidade dele
   * e o RETURNING do PostgREST esbarra na policy de SELECT. A função no banco
   * roda como SECURITY DEFINER e ainda grava o histórico na mesma transação.
   */
  const transferir = useMutation({
    mutationFn: async ({
      id,
      paraDepartamentoId,
      paraUsuarioId,
      observacao,
    }: {
      id: string
      paraDepartamentoId: string | null
      paraUsuarioId: string | null
      observacao?: string | null
    }) => {
      const { error } = await supabase.rpc('transferir_atendimento', {
        p_atendimento_id: id,
        p_departamento_id: paraDepartamentoId,
        p_usuario_id: paraUsuarioId,
        p_observacao: observacao ?? null,
      })
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  return { assumir, responder, finalizar, transferir }
}
