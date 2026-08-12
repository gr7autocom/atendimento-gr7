import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Canal } from './canal'
import type { ArquivoEnviado } from './storage'

export type EmpresaResumo = { id: string; razao_social: string | null; nome_fantasia: string | null }

export type ContatoResumo = {
  id: string
  nome: string | null
  nome_whatsapp: string | null
  /** Foto de perfil do WhatsApp (preview). Nula fora do WhatsApp ou sem retorno do provedor. */
  foto_url: string | null
  telefone: string
  cargo: string | null
  cliente_id: string | null
  cliente: EmpresaResumo | null
}

export function nomeEmpresa(e: EmpresaResumo | null | undefined) {
  return e?.nome_fantasia || e?.razao_social || null
}

/*
  Titular que pediu eliminação dos dados (LGPD).

  `contatos.telefone` é NOT NULL UNIQUE e é a identidade do contato em todo o
  sistema, então a anonimização não pode deixá-lo vazio: grava
  `anonimizado:<uuid>`, único por construção e sem colidir com telefone real,
  que é sempre E.164.

  O prefixo é detalhe de banco e **não pode aparecer na tela**. Sem estes
  helpers ele vaza como se fosse o nome do cliente na lista e no cabeçalho da
  conversa — foi o que a primeira validação pela tela mostrou.
*/
const PREFIXO_ANONIMO = 'anonimizado:'

export function ehTitularAnonimizado(telefone: string | null | undefined) {
  return !!telefone?.startsWith(PREFIXO_ANONIMO)
}

export const ROTULO_ANONIMO = 'Titular anonimizado'

/**
 * Como o contato é chamado na lista e no cabeçalho da conversa.
 *
 * Estava escrita igual em `Conversa.tsx` e `ListaChamados.tsx`. Virou uma só
 * aqui porque o caso do titular anonimizado precisava entrar nas duas, e regra
 * de exibição duplicada é regra que vai divergir.
 */
export function nomeDoContato(a: { contato?: ContatoResumo | null }) {
  const c = a.contato
  if (ehTitularAnonimizado(c?.telefone)) return ROTULO_ANONIMO
  return c?.nome || c?.nome_whatsapp || c?.telefone || 'Sem nome'
}

export type StatusAtendimento = 'triagem' | 'na_fila' | 'em_atendimento' | 'finalizado'

export type AtendimentoLista = {
  id: string
  protocolo: number
  status: StatusAtendimento
  /**
   * Origem do chamado. Já vinha do banco, porque o SELECT usa `*`; faltava só
   * declarar. Decide o selo do avatar, o filtro da lista, a copy de reabertura e
   * o indicador de presença do cliente.
   */
  canal: Canal
  departamento_id: string | null
  responsavel_id: string | null
  ultima_mensagem_em: string
  /*
    Estado da avaliação e do fim do chamado. Como o `canal`, já vinham do banco
    (o SELECT usa `*`), faltava declarar. Decidem a copy de reabertura do rodapé:
    o mesmo protocolo só volta com a nota pendente e dentro da janela.
  */
  finalizado_em?: string | null
  avaliacao?: number | null
  avaliacao_solicitada_em?: string | null
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
  /*
    Citação com cópia (migration 20260808120000). O trecho e o autor são
    gravados no momento da citação, não lidos por join: assim a citação
    continua legível depois de a mensagem original ser apagada.
  */
  resposta_id: string | null
  resposta_corpo: string | null
  resposta_remetente: string | null
  /*
    Apagamento é lógico, e assimétrico: some para o cliente, continua aqui
    **com o corpo à mostra**, marcado. Quem manda na empresa lê a conversa
    depois e precisa ver o que foi enviado, não só que algo foi apagado.
  */
  excluida: boolean
  excluida_por: 'atendente' | 'cliente' | null
  excluida_em: string | null
  /** Texto como foi enviado, quando o cliente editou depois. */
  corpo_original: string | null
  editada_em: string | null
}

const SELECT_ATENDIMENTO =
  '*, contato:contatos(id, nome, nome_whatsapp, foto_url, telefone, cargo, cliente_id, cliente:clientes(id, razao_social, nome_fantasia)), departamento:departamentos(nome), tags:atendimento_tag_vinculos(tag:atendimento_tags(id, nome, cor_fundo, cor_texto))'

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['atendimentos'] })
      // Chamado novo entra no histórico e nos contadores do contato.
      qc.invalidateQueries({ queryKey: ['historico_contato'] })
    },
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

export type Anexo = {
  id: string
  mensagem_id: string
  url: string
  nome_arquivo: string | null
  tipo_mime: string | null
  tamanho_bytes: number | null
  created_at: string
}

/**
 * Anexos do chamado, agrupados por mensagem.
 *
 * Consulta separada, e não `select` aninhado dentro das mensagens: a maioria
 * dos chamados não tem anexo nenhum, e o join encareceria toda conversa por
 * causa da minoria. A tabela é filtrada pelo mesmo predicado das mensagens na
 * RLS, então o que volta aqui é o que o atendente já pode ver.
 */
export function useAnexos(atendimentoId: string | null) {
  return useQuery({
    queryKey: ['atendimento_anexos', atendimentoId],
    enabled: !!atendimentoId,
    queryFn: async () => {
      const { data: msgs, error: errMsg } = await supabase
        .from('atendimento_mensagens')
        .select('id')
        .eq('atendimento_id', atendimentoId as string)
      if (errMsg) throw errMsg

      const ids = (msgs ?? []).map((m) => (m as { id: string }).id)
      if (ids.length === 0) return new Map<string, Anexo[]>()

      const { data, error } = await supabase
        .from('atendimento_anexos')
        .select('id, mensagem_id, url, nome_arquivo, tipo_mime, tamanho_bytes, created_at')
        .in('mensagem_id', ids)
        .order('created_at')
      if (error) throw error

      const porMensagem = new Map<string, Anexo[]>()
      for (const a of (data ?? []) as unknown as Anexo[]) {
        const lista = porMensagem.get(a.mensagem_id) ?? []
        lista.push(a)
        porMensagem.set(a.mensagem_id, lista)
      }
      return porMensagem
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

/** Uma linha do histórico do contato, como a RPC devolve. */
export type AtendimentoHistorico = {
  id: string
  protocolo: number
  status: string
  aberto_em: string
  finalizado_em: string | null
  departamento: string | null
  atendente: string | null
  motivo: string | null
  avaliacao: number | null
  mensagens: number
}

/**
 * Todos os atendimentos do contato, do mais recente para o mais antigo.
 *
 * Vem de RPC, e não de `select` na tabela, porque a visibilidade é **por dono**:
 * consultando direto, o atendente veria só os chamados dele e a lista sairia
 * pela metade, sem avisar que está incompleta. A `atendimento_historico_contato`
 * é `SECURITY DEFINER` e devolve só o resumo (nunca o corpo das mensagens), com
 * checagem de permissão na entrada. Ver docs/db.md.
 */
export function useHistoricoContato(contatoId: string | null) {
  return useQuery({
    queryKey: ['historico_contato', contatoId],
    enabled: !!contatoId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('atendimento_historico_contato', {
        p_contato_id: contatoId as string,
      })
      if (error) throw error
      return (data ?? []) as AtendimentoHistorico[]
    },
  })
}

/**
 * Contadores do cabeçalho do painel: total de atendimentos e de mensagens do
 * contato. Deriva do histórico (mesma `queryKey`, então o TanStack Query
 * aproveita a requisição já feita) para que os números sejam os totais reais, e
 * não só o que a RLS deixa o atendente ver.
 */
export function useContadoresContato(contatoId: string | null) {
  return useQuery({
    queryKey: ['historico_contato', contatoId],
    enabled: !!contatoId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('atendimento_historico_contato', {
        p_contato_id: contatoId as string,
      })
      if (error) throw error
      return (data ?? []) as AtendimentoHistorico[]
    },
    select: (lista) => ({
      atendimentos: lista.length,
      mensagens: lista.reduce((soma, a) => soma + Number(a.mensagens ?? 0), 0),
    }),
  })
}

export type PresencaCliente = {
  /** Última vez que o PWA do cliente falou com o servidor. `null` = nenhum acesso vivo. */
  ultimo_uso_em: string | null
  sessoes_ativas: number
}

/**
 * Presença do cliente no canal web, para o cabeçalho da conversa.
 *
 * Vem da RPC `atendimento_web_presenca` (SECURITY DEFINER) e não de `select`:
 * `atendimento_web_sessoes` só é legível pelo admin, e liberar a tabela exporia
 * `token_hash` e `ip_hash` a todo atendente. A função devolve dois números e mais
 * nada. Ver docs/db.md.
 *
 * O intervalo acompanha o polling do PWA (10s): consultar mais rápido não traz
 * dado novo, só invocation. Chamado de WhatsApp não tem sessão, então `ativo`
 * corta a consulta na origem em vez de perguntar e receber zero.
 */
export function usePresencaCliente(atendimentoId: string | null, ativo: boolean) {
  return useQuery({
    queryKey: ['presenca_web', atendimentoId],
    enabled: ativo && !!atendimentoId,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('atendimento_web_presenca', {
        p_atendimento_id: atendimentoId as string,
      })
      if (error) throw error
      // A função agrega sem GROUP BY, então sempre volta uma linha; o fallback é
      // para o caso de a resposta chegar vazia por algum motivo de transporte.
      return (data?.[0] ?? { ultimo_uso_em: null, sessoes_ativas: 0 }) as PresencaCliente
    },
  })
}

/**
 * Encerra o acesso do cliente ao PWA: marca como revogadas todas as sessões vivas
 * do atendimento. O cenário é quem abriu o chamado sair da empresa com o token
 * ainda vivo na máquina.
 *
 * A RPC valida permissão por dentro (atendente logado, mais dono / fila livre /
 * admin) e devolve quantas sessões caíram. Ver docs/db.md.
 */
export function useEncerrarAcessoCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (atendimentoId: string) => {
      const { data, error } = await supabase.rpc('atendimento_web_revogar_sessao', {
        p_atendimento_id: atendimentoId,
      })
      if (error) throw error
      return (data ?? 0) as number
    },
    // O cabeçalho passa a dizer "Cliente sem acesso" e o item do menu some, porque
    // não sobrou o que encerrar. É o retorno da ação, então não há aviso extra.
    onSuccess: (_qtd, atendimentoId) => {
      qc.invalidateQueries({ queryKey: ['presenca_web', atendimentoId] })
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

/** Prioridades para o formulário de tarefa. Etapa inicial, categoria e
 *  classificação são resolvidas pela RPC no banco, não aqui. */
export function useCatalogosTarefa() {
  return useQuery({
    queryKey: ['catalogos_tarefa'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prioridades')
        .select('id, nome, nivel')
        .eq('ativo', true)
        .order('nivel')
      if (error) throw error
      return { prioridades: (data ?? []) as unknown as Prioridade[] }
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

/** Tarefas avulsas abertas para este contato (só leitura; andamento no painel).
 *  Faz refetch periódico para refletir mudanças de status feitas no painel. */
export function useTarefasDoContato(contatoId: string | null) {
  return useQuery({
    queryKey: ['tarefas_contato', contatoId],
    enabled: !!contatoId,
    refetchInterval: 30000,
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
 * Cria a tarefa avulsa e o vínculo com o atendimento pela RPC
 * `criar_tarefa_atendimento`, que faz as duas gravações numa transação só (antes
 * eram dois inserts soltos: falha no segundo deixava tarefa órfã no painel).
 * A RPC também exige empresa vinculada e define etapa "Pendente", categoria
 * "Outros" e classificação "Solicitações de cliente". Notifica o atribuído
 * quando não for o próprio criador, pela mesma Edge Function do painel.
 */
export function useCriarTarefa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      atendimentoId: string
      contatoId: string
      titulo: string
      descricao: string | null
      responsavelId: string | null
      inicioIso: string | null
      prazoIso: string | null
      prioridadeId: string | null
      criadoPorId: string
    }) => {
      const { data, error } = await supabase.rpc('criar_tarefa_atendimento', {
        p_atendimento_id: p.atendimentoId,
        p_contato_id: p.contatoId,
        p_titulo: p.titulo,
        p_descricao: p.descricao,
        p_responsavel_id: p.responsavelId,
        p_prioridade_id: p.prioridadeId,
        p_inicio_previsto: p.inicioIso,
        p_prazo_entrega: p.prazoIso,
      } as never)
      if (error) throw error
      const linha = (data as { tarefa_id: string }[] | null)?.[0]
      const tarefaId = linha?.tarefa_id
      if (!tarefaId) throw new Error('RPC não retornou a tarefa criada')

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

/** Mensagem de erro da criação de tarefa, pelo código que o Postgres devolve. */
export function mensagemErroCriarTarefa(erro: unknown): string {
  const e = erro as { code?: string; message?: string } | null
  if (e?.code === '42501') {
    return 'Seu perfil não pode criar tarefas no painel. Peça a liberação a um administrador.'
  }
  // Regras da própria RPC (empresa não vinculada, título vazio) já vêm escritas.
  if (e?.code === '23514' || e?.code === '23503') {
    return e.message ?? 'Não foi possível criar a tarefa.'
  }
  return 'Não foi possível criar a tarefa. Tente de novo.'
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
    qc.invalidateQueries({ queryKey: ['atendimento_anexos'] })
    // O histórico e os contadores do painel leem os atendimentos do contato:
    // assumir, transferir e finalizar mudam status e dono, e sem isto a seção
    // Histórico só acerta depois de recarregar a página.
    qc.invalidateQueries({ queryKey: ['historico_contato'] })
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
      anexos,
      resposta,
    }: {
      atendimentoId: string
      corpo: string
      usuarioId: string
      precisaAssumir: boolean
      /** Já enviados ao Storage pela tela; aqui só se grava o vínculo. */
      anexos?: ArquivoEnviado[]
      /** Mensagem citada, com o trecho copiado no momento da citação. */
      resposta?: { id: string; corpo: string; remetente: string } | null
    }) => {
      /*
        `.select('id')` e não insert cego: o anexo é filho da mensagem
        (`atendimento_anexos.mensagem_id`), então sem o id de volta não há
        como vincular. Uma segunda consulta "pela última mensagem" acertaria
        errado com dois atendentes respondendo ao mesmo tempo.
      */
      const { data: msg, error } = await supabase
        .from('atendimento_mensagens')
        .insert({
          atendimento_id: atendimentoId,
          direcao: 'saida',
          origem: 'atendente',
          corpo,
          remetente_usuario_id: usuarioId,
          status: 'enviado',
          resposta_id: resposta?.id ?? null,
          // Recorte, não a mensagem inteira: a citação serve para reconhecer o
          // que foi respondido, e um parágrafo longo citado empurraria a
          // resposta para fora da tela.
          resposta_corpo: resposta ? resposta.corpo.slice(0, 200) : null,
          resposta_remetente: resposta?.remetente ?? null,
        } as never)
        .select('id')
        .single()
      if (error) throw error

      if (anexos?.length) {
        const { error: errAnexo } = await supabase.from('atendimento_anexos').insert(
          anexos.map((a) => ({
            mensagem_id: (msg as { id: string }).id,
            storage_path: a.storage_path,
            url: a.url,
            nome_arquivo: a.nome_arquivo,
            tipo_mime: a.tipo_mime,
            tamanho_bytes: a.tamanho_bytes,
          })) as never
        )
        /*
          O arquivo já está no Storage quando isto falha, então a mensagem
          existiria sem o anexo que a explica ("segue em anexo" e nada). Falhar
          alto faz a tela mostrar o erro; o órfão no Storage é o custo menor.
        */
        if (errAnexo) throw errAnexo
      }

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

  /**
   * Apagar mensagem. Marca, nunca remove.
   *
   * A conversa é prova do atendimento e fica cinco anos por causa do CDC, então
   * um DELETE destruiria o que a retenção existe para guardar.
   *
   * O efeito é **assimétrico**, e é o ponto do recurso: a mensagem some da tela
   * do cliente e continua na da equipe, em tom apagado e com o corpo à mostra.
   * Quem manda na empresa lê a conversa depois e precisa ver o que foi enviado
   * antes de ser apagado; "Mensagem apagada" sem o corpo esconderia justamente
   * o que a auditoria procura. Quem faz a mensagem sumir do lado do cliente é a
   * Edge Function, que não devolve o que está marcado como excluído.
   *
   * Quem pode é decidido no banco (policy `atendimento_mensagens_update_apagar`
   * mais o GRANT por coluna): só o autor ou admin, e só a coluna `excluida`. A
   * tela apenas não oferece o que o banco recusaria.
   */
  const apagarMensagem = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('atendimento_mensagens')
        .update({
          excluida: true,
          excluida_por: 'atendente',
          excluida_em: new Date().toISOString(),
        } as never)
        .eq('id', id)
      if (error) throw error
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

  return { assumir, responder, apagarMensagem, finalizar, transferir }
}
