import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type EmpresaResumo = { id: string; razao_social: string | null; nome_fantasia: string | null }

export type ContatoResumo = {
  id: string
  nome: string | null
  nome_whatsapp: string | null
  telefone: string
  cargo: string | null
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
  '*, contato:contatos(id, nome, nome_whatsapp, telefone, cargo, cliente_id, cliente:clientes(id, razao_social, nome_fantasia)), departamento:departamentos(nome), tags:atendimento_tag_vinculos(tag:atendimento_tags(id, nome, cor_fundo, cor_texto))'

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

export type EventoAtendimento = {
  id: string
  tipo: string
  ator_usuario_id: string | null
  alvo_usuario_id: string | null
  dados: Record<string, unknown> | null
  created_at: string
}

/** Eventos internos do atendimento (abertura, assumir, transferir, encerrar...).
 *  Renderizados como pílulas centralizadas no chat; o cliente nunca os vê. */
export function useEventos(atendimentoId: string | null) {
  return useQuery({
    queryKey: ['atendimento_eventos', atendimentoId],
    enabled: !!atendimentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atendimento_eventos')
        .select('id, tipo, ator_usuario_id, alvo_usuario_id, dados, created_at')
        .eq('atendimento_id', atendimentoId as string)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as EventoAtendimento[]
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
      valores: { nome?: string | null; cargo?: string | null; cliente_id?: string | null }
    }) => {
      const { error } = await supabase.from('contatos').update(valores as never).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['atendimentos'] }),
  })
}

/**
 * Contadores do contato para o cabeçalho do painel: total de atendimentos e de
 * mensagens trocadas (todas as conversas dele). Conta pelo que a RLS deixa ver
 * (admin vê tudo; atendente vê os seus + a fila livre).
 */
export function useContadoresContato(contatoId: string | null) {
  return useQuery({
    queryKey: ['contadores_contato', contatoId],
    enabled: !!contatoId,
    queryFn: async () => {
      const [at, msg] = await Promise.all([
        supabase
          .from('atendimentos')
          .select('id', { count: 'exact', head: true })
          .eq('contato_id', contatoId as string),
        supabase
          .from('atendimento_mensagens')
          .select('id, atendimento:atendimentos!inner(contato_id)', { count: 'exact', head: true })
          .eq('atendimento.contato_id', contatoId as string),
      ])
      return { atendimentos: at.count ?? 0, mensagens: msg.count ?? 0 }
    },
  })
}

export type Participante = {
  id: string
  usuario_id: string
  usuario: { id: string; nome: string; foto_url: string | null } | null
}

/**
 * Participantes de um atendimento: atendentes adicionados além do responsável,
 * para conversar no mesmo chamado. Adicionar/remover só pelo responsável ou
 * admin (garantido pela RLS). Ver docs/db.md.
 */
export function useParticipantes(atendimentoId: string | null) {
  const qc = useQueryClient()
  const invalidar = () => qc.invalidateQueries({ queryKey: ['participantes', atendimentoId] })

  const lista = useQuery({
    queryKey: ['participantes', atendimentoId],
    enabled: !!atendimentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atendimento_participantes')
        // desambigua a FK: há usuario_id e adicionado_por apontando para usuarios
        .select('id, usuario_id, usuario:usuarios!usuario_id(id, nome, foto_url), created_at')
        .eq('atendimento_id', atendimentoId as string)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as Participante[]
    },
  })

  const adicionar = useMutation({
    mutationFn: async (usuarioId: string) => {
      const { error } = await supabase
        .from('atendimento_participantes')
        .insert({ atendimento_id: atendimentoId, usuario_id: usuarioId } as never)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('atendimento_participantes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  return { lista, adicionar, remover }
}

// ===== Tarefas avulsas abertas a partir do atendimento =====
// O atendente cria uma tarefa avulsa (tabela `tarefas`, do painel) direto do
// chat; o andamento é no painel. `atendimento_tarefas` guarda o vínculo para
// listar aqui o que já foi aberto para o contato. Ver docs/db.md.

export type Prioridade = { id: string; nome: string; nivel: number }

/** Catálogos para o formulário de tarefa: prioridades e a etapa inicial (Pendente). */
export function useCatalogosTarefa() {
  return useQuery({
    queryKey: ['catalogos_tarefa'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [prio, etp] = await Promise.all([
        supabase.from('prioridades').select('id, nome, nivel').eq('ativo', true).order('nivel'),
        supabase.from('etapas').select('id, nome, ordem').eq('ativo', true).order('ordem'),
      ])
      if (prio.error) throw prio.error
      if (etp.error) throw etp.error
      const etapas = (etp.data ?? []) as { id: string; nome: string; ordem: number }[]
      const pendente = etapas.find((e) => e.nome.toLowerCase() === 'pendente') ?? etapas[0] ?? null
      return {
        prioridades: (prio.data ?? []) as unknown as Prioridade[],
        etapaPendenteId: pendente?.id ?? null,
      }
    },
  })
}

export type TarefaDoContato = {
  id: string
  created_at: string
  tarefa: {
    id: string
    codigo: number
    titulo: string
    prazo_entrega: string | null
    etapa: { nome: string } | null
    prioridade: { nome: string; nivel: number } | null
    responsavel: { nome: string } | null
  } | null
}

/** Tarefas avulsas abertas para este contato (só leitura; andamento no painel). */
export function useTarefasDoContato(contatoId: string | null) {
  return useQuery({
    queryKey: ['tarefas_contato', contatoId],
    enabled: !!contatoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atendimento_tarefas')
        .select(
          // desambigua FKs: tarefas tem etapa_id e etapa_antes_pausa_id (→ etapas),
          // e responsavel_id e criado_por_id (→ usuarios).
          'id, created_at, tarefa:tarefas(id, codigo, titulo, prazo_entrega, etapa:etapas!etapa_id(nome), prioridade:prioridades(nome, nivel), responsavel:usuarios!responsavel_id(nome))'
        )
        .eq('contato_id', contatoId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as TarefaDoContato[]
    },
  })
}

/**
 * Cria uma tarefa avulsa (insert em `tarefas`) e grava o vínculo em
 * `atendimento_tarefas`. Nasce em "Pendente", com o cliente do contato (auto) e
 * `de_projeto:false`. Notifica o atribuído quando não for o próprio criador,
 * pela mesma Edge Function do painel.
 */
export function useCriarTarefa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      atendimentoId: string
      contatoId: string
      clienteId: string | null
      titulo: string
      descricao: string | null
      responsavelId: string | null
      prazoIso: string | null
      prioridadeId: string | null
      etapaPendenteId: string | null
      criadoPorId: string
    }) => {
      const { data, error } = await supabase
        .from('tarefas')
        .insert({
          titulo: p.titulo,
          descricao: p.descricao,
          responsavel_id: p.responsavelId,
          prazo_entrega: p.prazoIso,
          prioridade_id: p.prioridadeId,
          cliente_id: p.clienteId,
          etapa_id: p.etapaPendenteId,
          criado_por_id: p.criadoPorId,
          de_projeto: false,
          updated_at: new Date().toISOString(),
        } as never)
        .select('id')
        .single()
      if (error) throw error
      const tarefaId = (data as { id: string }).id

      const { error: errVinc } = await supabase.from('atendimento_tarefas').insert({
        tarefa_id: tarefaId,
        atendimento_id: p.atendimentoId,
        contato_id: p.contatoId,
        criado_por: p.criadoPorId,
      } as never)
      if (errVinc) throw errVinc

      if (p.responsavelId && p.responsavelId !== p.criadoPorId) {
        // Notificação é best-effort; não bloqueia a criação se falhar.
        await supabase.functions
          .invoke('notify-assignment', { body: { tarefa_id: tarefaId, responsavel_id: p.responsavelId } })
          .catch(() => {})
      }
      return tarefaId
    },
    onSuccess: (_id, v) => {
      qc.invalidateQueries({ queryKey: ['tarefas_contato', v.contatoId] })
    },
  })
}

/** Ids dos atendimentos em que o usuário logado entra como participante (não dono). */
export function useMeusAtendimentosParticipante(usuarioId: string | null) {
  return useQuery({
    queryKey: ['meus_participante', usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atendimento_participantes')
        .select('atendimento_id')
        .eq('usuario_id', usuarioId as string)
      if (error) throw error
      return new Set((data ?? []).map((r) => (r as { atendimento_id: string }).atendimento_id))
    },
    refetchInterval: 15000,
  })
}

export function useAcoesAtendimento() {
  const qc = useQueryClient()
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['atendimentos'] })
    qc.invalidateQueries({ queryKey: ['atendimento_mensagens'] })
    qc.invalidateQueries({ queryKey: ['atendimento_eventos'] })
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
