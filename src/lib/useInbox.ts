import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type EmpresaResumo = { id: string; razao_social: string | null; nome_fantasia: string | null }

export type ContatoResumo = {
  id: string
  nome: string | null
  nome_whatsapp: string | null
  telefone: string
  cliente_id: string | null
  cliente: EmpresaResumo | null
}

export function nomeEmpresa(e: EmpresaResumo | null | undefined) {
  return e?.nome_fantasia || e?.razao_social || null
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
  tags?: { tag: TagInfo | null }[] | null
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
  '*, contato:contatos(id, nome, nome_whatsapp, telefone, cliente_id, cliente:clientes(id, razao_social, nome_fantasia)), departamento:departamentos(nome), tags:atendimento_tag_vinculos(tag:atendimento_tags(id, nome, cor_fundo, cor_texto))'

/** Clientes do painel, somente leitura, para vincular um contato à empresa. */
export function useClientes(busca: string) {
  return useQuery({
    queryKey: ['clientes', busca],
    enabled: busca.trim().length >= 2,
    queryFn: async () => {
      const termo = `%${busca.trim()}%`
      const { data, error } = await supabase
        .from('clientes')
        .select('id, razao_social, nome_fantasia')
        .or(`razao_social.ilike.${termo},nome_fantasia.ilike.${termo}`)
        .order('nome_fantasia')
        .limit(20)
      if (error) throw error
      return (data ?? []) as unknown as EmpresaResumo[]
    },
  })
}

/** Busca em contatos já existentes (por nome, nome do WhatsApp ou telefone). */
export function useContatos(busca: string) {
  return useQuery({
    queryKey: ['contatos-busca', busca],
    enabled: busca.trim().length >= 2,
    queryFn: async () => {
      const termo = `%${busca.trim()}%`
      const { data, error } = await supabase
        .from('contatos')
        .select('id, nome, nome_whatsapp, telefone, cliente_id, cliente:clientes(id, razao_social, nome_fantasia)')
        .or(`nome.ilike.${termo},nome_whatsapp.ilike.${termo},telefone.ilike.${termo}`)
        .order('nome')
        .limit(20)
      if (error) throw error
      return (data ?? []) as unknown as ContatoResumo[]
    },
  })
}

/** Cria um chamado manualmente (atendente iniciando). Via RPC pelo mesmo motivo
 *  da transferência: o INSERT ... RETURNING esbarraria na RLS ao atribuir a
 *  outro atendente/departamento. Sem atendente nasce pendente; com, em atendimento. */
export function useCriarAtendimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      telefone: string | null
      nome: string | null
      clienteId: string | null
      contatoId: string | null
      departamentoId: string | null
      responsavelId: string | null
    }) => {
      const { data, error } = await supabase.rpc('criar_atendimento', {
        p_telefone: p.telefone,
        p_nome: p.nome,
        p_cliente_id: p.clienteId,
        p_contato_id: p.contatoId,
        p_departamento_id: p.departamentoId,
        p_responsavel_id: p.responsavelId,
      })
      if (error) throw error
      return data as unknown as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['atendimentos'] }),
  })
}

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

export type TagInfo = { id: string; nome: string; cor_fundo: string | null; cor_texto: string | null }
export type TagAplicada = { tag_id: string; tag: TagInfo | null }

/** Tags já aplicadas a um atendimento (com nome e cor, para exibir o pill). */
export function useTagsDoAtendimento(atendimentoId: string | null) {
  return useQuery({
    queryKey: ['atendimento_tag_vinculos', atendimentoId],
    enabled: !!atendimentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atendimento_tag_vinculos')
        .select('tag_id, tag:atendimento_tags(id, nome, cor_fundo, cor_texto)')
        .eq('atendimento_id', atendimentoId as string)
      if (error) throw error
      return (data ?? []) as unknown as TagAplicada[]
    },
  })
}

/** Aplicar/remover tag no atendimento. A RLS já libera para quem tem
 *  `atendimento.responder`; `aplicada_por` guarda quem marcou. */
export function useAcoesTags() {
  const qc = useQueryClient()
  const invalidar = (atendimentoId: string) => {
    qc.invalidateQueries({ queryKey: ['atendimento_tag_vinculos', atendimentoId] })
    // A lista do inbox mostra os pills das tags no card; precisa recarregar.
    qc.invalidateQueries({ queryKey: ['atendimentos'] })
  }

  const aplicar = useMutation({
    mutationFn: async ({
      atendimentoId,
      tagId,
      usuarioId,
    }: {
      atendimentoId: string
      tagId: string
      usuarioId: string | null
    }) => {
      const { error } = await supabase.from('atendimento_tag_vinculos').insert({
        atendimento_id: atendimentoId,
        tag_id: tagId,
        aplicada_por: usuarioId,
      } as never)
      if (error) throw error
    },
    onSuccess: (_d, v) => invalidar(v.atendimentoId),
  })

  const remover = useMutation({
    mutationFn: async ({ atendimentoId, tagId }: { atendimentoId: string; tagId: string }) => {
      const { error } = await supabase
        .from('atendimento_tag_vinculos')
        .delete()
        .eq('atendimento_id', atendimentoId)
        .eq('tag_id', tagId)
      if (error) throw error
    },
    onSuccess: (_d, v) => invalidar(v.atendimentoId),
  })

  return { aplicar, remover }
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
