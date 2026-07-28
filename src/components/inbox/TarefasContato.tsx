import { useState } from 'react'
import { Plus, CalendarClock, Building2, Loader2, ExternalLink } from 'lucide-react'
import {
  useCatalogosTarefa,
  useCriarTarefa,
  useTarefasDoContato,
  nomeEmpresa,
  type AtendimentoLista,
  type TarefaDoContato,
} from '../../lib/useInbox'
import { useUsuarios } from '../../lib/useVinculos'
import { useUsuarioAtual } from '../../lib/auth'
import { usePermissao } from '../../lib/permissoes'
import { Botao } from '../ui/Botao'
import { Selo } from '../ui/Selo'
import { Modal } from '../ui/Modal'
import { Entrada, AreaTexto, Selecao } from '../ui/Campo'
import { Skeleton } from '../ui/Estados'

/** Quantas tarefas a lista mostra antes do "Ver mais". */
const LIMITE_LISTA = 3
/** Tela de Tarefas do painel de implantação (para o "Ver mais"). */
const URL_TAREFAS_PAINEL = 'https://implantacao.gr7autocom.com.br/tarefas'

/** Tom do selo da etapa pelo nome (mesmas etapas do painel). */
function tomEtapa(nome: string | undefined): 'neutro' | 'marca' | 'ok' | 'err' {
  const n = (nome ?? '').toLowerCase()
  if (n.includes('cancel')) return 'err'
  if (n.includes('conclu')) return 'ok'
  if (n.includes('andamento')) return 'marca'
  return 'neutro'
}

/** Tom da prioridade pela severidade (nível). */
function tomPrioridade(nivel: number | undefined): 'neutro' | 'warn' | 'err' {
  if ((nivel ?? 0) >= 4) return 'err'
  if ((nivel ?? 0) === 3) return 'warn'
  return 'neutro'
}

function formatarPrazo(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ItemTarefa({ item }: { item: TarefaDoContato }) {
  const t = item.tarefa
  if (!t) return null
  const prazo = formatarPrazo(t.prazo_entrega)
  return (
    <div className="rounded-[8px] border border-bd-1 bg-sf-2 px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] text-tx-1 font-medium leading-snug break-words min-w-0">{t.titulo}</span>
        <span className="dado text-[11px] text-tx-3 shrink-0 tabular-nums">#{t.codigo}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {t.etapa?.nome && <Selo tom={tomEtapa(t.etapa.nome)}>{t.etapa.nome}</Selo>}
        {t.prioridade?.nome && <Selo tom={tomPrioridade(t.prioridade.nivel)}>{t.prioridade.nome}</Selo>}
        <span className="text-[11px] text-tx-3">{t.responsavel?.nome ?? 'Em aberto'}</span>
      </div>
      {prazo && (
        <div className="flex items-center gap-1.5 text-[11px] text-tx-3">
          <CalendarClock size={12} className="shrink-0" />
          <span className="dado tabular-nums">{prazo}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Conteúdo da seção "Tarefas" do painel do contato. O atendente abre uma tarefa
 * avulsa (formulário num modal, já que o painel é estreito) que passa a ser
 * trabalhada no painel de implantação; aqui a lista é só leitura e mostra as
 * mais recentes (o restante fica no painel, via "Ver mais"). O botão de criar só
 * aparece para quem tem `tarefa.criar` (a RLS de `tarefas` também barra). A lista
 * vem por `atendimento_tarefas` (só o que foi aberto pelo chat) — tarefa criada
 * direto no painel não aparece aqui. Ver docs/db.md.
 */
export function TarefasContato({ atendimento }: { atendimento: AtendimentoLista }) {
  const usuario = useUsuarioAtual()
  const { can } = usePermissao()
  const usuarios = useUsuarios()
  const catalogos = useCatalogosTarefa()
  const lista = useTarefasDoContato(atendimento.contato?.id ?? null)
  const criar = useCriarTarefa()

  const podeCriar = can('tarefa.criar')
  const contato = atendimento.contato
  const empresa = contato?.cliente_id ? nomeEmpresa(contato.cliente) : null

  const [aberto, setAberto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [responsavelId, setResponsavelId] = useState<string>(usuario?.id ?? '')
  const [prioridadeId, setPrioridadeId] = useState('')
  const [inicio, setInicio] = useState('')
  const [prazo, setPrazo] = useState('')

  const tarefas = lista.data ?? []
  const visiveis = tarefas.slice(0, LIMITE_LISTA)
  const temMais = tarefas.length > LIMITE_LISTA
  const inputBase =
    'dado h-9 px-2.5 text-sm rounded-[6px] bg-sf-2 border border-bd-2 text-tx-1 hover:border-bd-3 ' +
    'focus:border-br-1 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)] transition-colors duration-[120ms]'

  function abrir() {
    setTitulo('')
    setDescricao('')
    setResponsavelId(usuario?.id ?? '')
    setPrioridadeId('')
    setInicio('')
    setPrazo('')
    criar.reset()
    setAberto(true)
  }

  function salvar() {
    if (!titulo.trim() || !contato) return
    criar.mutate(
      {
        atendimentoId: atendimento.id,
        contatoId: contato.id,
        clienteId: contato.cliente_id,
        titulo: titulo.trim().toUpperCase(),
        descricao: descricao.trim() || null,
        responsavelId: responsavelId || null,
        inicioIso: inicio ? new Date(inicio).toISOString() : null,
        prazoIso: prazo ? new Date(prazo).toISOString() : null,
        prioridadeId: prioridadeId || null,
        etapaPendenteId: catalogos.data?.etapaPendenteId ?? null,
        criadoPorId: usuario!.id,
      },
      { onSuccess: () => setAberto(false) }
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {podeCriar && (
        <Botao variante="neutro" tamanho="sm" icone={<Plus size={15} />} onClick={abrir}>
          Nova tarefa
        </Botao>
      )}

      {lista.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-[8px]" />
          <Skeleton className="h-16 w-full rounded-[8px]" />
        </div>
      ) : tarefas.length === 0 ? (
        <p className="text-[12px] text-tx-3">
          {podeCriar
            ? 'Nenhuma tarefa aberta para este contato. Use Nova tarefa para abrir uma no painel.'
            : 'Nenhuma tarefa aberta para este contato.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visiveis.map((item) => (
            <ItemTarefa key={item.id} item={item} />
          ))}
          {temMais && (
            <a
              href={URL_TAREFAS_PAINEL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 h-8 rounded-[6px] border border-bd-2 bg-sf-2 text-[12px] text-tx-2 hover:text-tx-1 hover:bg-sf-3 transition-colors duration-[120ms]"
            >
              Ver mais no painel
              <ExternalLink size={13} className="shrink-0" />
            </a>
          )}
        </div>
      )}

      <Modal titulo="Nova tarefa" aberto={aberto} onFechar={() => setAberto(false)}>
        <div className="flex flex-col gap-3.5">
          <Entrada
            rotulo="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value.toUpperCase())}
            placeholder="Ex.: INSTALAR PDV NOVO"
            aria-label="Título da tarefa"
            autoFocus
          />
          <AreaTexto
            rotulo="Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="O que precisa ser feito (opcional)"
            aria-label="Descrição da tarefa"
          />
          <div className="grid grid-cols-2 gap-3">
            <Selecao
              rotulo="Responsável"
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              aria-label="Responsável"
            >
              <option value="">Em aberto (sem responsável)</option>
              {(usuarios.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Selecao>
            <Selecao
              rotulo="Prioridade"
              value={prioridadeId}
              onChange={(e) => setPrioridadeId(e.target.value)}
              aria-label="Prioridade"
            >
              <option value="">Sem prioridade</option>
              {(catalogos.data?.prioridades ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Selecao>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-tx-2">Início previsto</span>
              <input
                type="datetime-local"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                aria-label="Início previsto"
                className={`${inputBase} w-full min-w-0`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-tx-2">Prazo de entrega</span>
              <input
                type="datetime-local"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                aria-label="Prazo de entrega"
                className={`${inputBase} w-full min-w-0`}
              />
            </label>
          </div>

          {empresa && (
            <div className="flex items-center gap-1.5 text-[12px] text-tx-3">
              <Building2 size={13} className="shrink-0" />
              <span className="truncate">
                Vincula à empresa <span className="text-tx-2">{empresa}</span>
              </span>
            </div>
          )}

          {criar.isError && (
            <p className="text-[12px] text-err">Não foi possível criar a tarefa. Tente de novo.</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Botao variante="fantasma" tamanho="md" onClick={() => setAberto(false)} disabled={criar.isPending}>
              Cancelar
            </Botao>
            <Botao
              variante="primario"
              tamanho="md"
              onClick={salvar}
              disabled={!titulo.trim() || criar.isPending}
              icone={criar.isPending ? <Loader2 size={15} className="animate-spin" /> : undefined}
            >
              Criar tarefa
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  )
}
