import { useState } from 'react'
import { Inbox as IconeInbox, ListFilter, RotateCw, X, Building2 } from 'lucide-react'
import { nomeEmpresa, useMeusAtendimentosParticipante, type AtendimentoLista } from '../../lib/useInbox'
import type { FiltroInbox } from '../../pages/Dashboard'
import { useCrud } from '../../lib/useCrud'
import { useUsuarios } from '../../lib/useVinculos'
import { usePermissao } from '../../lib/permissoes'
import { cn } from '../../lib/utils'
import { Avatar } from '../ui/Avatar'
import { PontoStatus } from '../ui/Selo'
import { Vazio, LinhasCarregando } from '../ui/Estados'
import { PillTag } from '../ui/PillTag'
import { CampoBusca } from '../ui/Campo'
import { CriarAtendimento } from './CriarAtendimento'

type Fila = 'ativos' | 'pendentes' | 'potenciais'
type Departamento = { id: string; nome: string; ativo: boolean }

function nomeContato(a: AtendimentoLista) {
  return a.contato?.nome || a.contato?.nome_whatsapp || a.contato?.telefone || 'Sem nome'
}

function hora(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  const mesmoDia = d.toDateString() === hoje.toDateString()
  return mesmoDia
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function ListaChamados({
  atendimentos,
  usuarioId,
  selecionadoId,
  onSelecionar,
  carregando,
  aoAtualizar,
  atualizando,
  filtro,
  aoFiltrar,
}: {
  atendimentos: AtendimentoLista[]
  usuarioId: string | null
  selecionadoId: string | null
  onSelecionar: (id: string) => void
  carregando?: boolean
  aoAtualizar: () => void
  atualizando?: boolean
  filtro: FiltroInbox
  aoFiltrar: (f: FiltroInbox) => void
}) {
  const [fila, setFila] = useState<Fila>('ativos')
  const [busca, setBusca] = useState('')
  const departamentos = useCrud<Departamento>('departamentos', 'ordem')
  const usuarios = useUsuarios()
  const { isAdmin } = usePermissao()
  const participo = useMeusAtendimentosParticipante(usuarioId)
  const participoIds = participo.data ?? new Set<string>()

  const setorFiltro = filtro.departamentoId ?? ''
  const atendenteFiltro = filtro.atendenteId
  const nomeAtendente = atendenteFiltro
    ? (usuarios.data ?? []).find((u) => u.id === atendenteFiltro)?.nome ?? 'Atendente'
    : null

  // As três abas são exclusivas: um chamado aparece em uma só.
  // Sem cadastro vai para Potenciais (mesmo estando na fila), até alguém
  // vincular a empresa e assumir. Com dono, vai para Ativos.
  // Admin enxerga tudo: em "Ativos" vê os de todos os atendentes, não só os dele.
  const base = atendimentos.filter((a) => a.status !== 'finalizado')
  const semCadastro = (a: AtendimentoLista) => !a.contato?.cliente_id
  // Sou participante deste chamado (mas não o responsável)?
  const participoDe = (a: AtendimentoLista) => a.responsavel_id !== usuarioId && participoIds.has(a.id)
  const listas: Record<Fila, AtendimentoLista[]> = {
    ativos: base.filter((a) =>
      isAdmin ? !!a.responsavel_id : a.responsavel_id === usuarioId || participoIds.has(a.id)
    ),
    pendentes: base.filter((a) => a.status === 'na_fila' && !a.responsavel_id && !semCadastro(a)),
    potenciais: base.filter((a) => !a.responsavel_id && semCadastro(a)),
  }
  const abas: { id: Fila; label: string }[] = [
    { id: 'ativos', label: 'Ativos' },
    { id: 'pendentes', label: 'Pendentes' },
    { id: 'potenciais', label: 'Potenciais' },
  ]

  // Busca por nome/telefone/protocolo/setor; filtros por departamento e por atendente
  // (estes vêm do painel de supervisão do admin, ou do seletor de setor).
  const termo = busca.trim().toLowerCase()
  const lista = listas[fila].filter((a) => {
    if (setorFiltro && a.departamento_id !== setorFiltro) return false
    if (atendenteFiltro && a.responsavel_id !== atendenteFiltro) return false
    if (!termo) return true
    const alvo = `${nomeContato(a)} ${a.contato?.telefone ?? ''} ${a.protocolo} ${a.departamento?.nome ?? ''}`
    return alvo.toLowerCase().includes(termo)
  })

  const vazio: Record<Fila, { titulo: string; descricao: string }> = {
    ativos: { titulo: 'Nenhum atendimento com você', descricao: 'Assuma um chamado em Pendentes para começar.' },
    pendentes: { titulo: 'Fila vazia', descricao: 'Nada esperando atendimento no momento.' },
    potenciais: { titulo: 'Nenhum contato novo', descricao: 'Quem escrever sem cadastro aparece aqui.' },
  }

  return (
    <div
      className={cn(
        'bg-sf-1 border-b lg:border-b-0 lg:border-r border-bd-1 flex-col min-h-0',
        // No mobile a lista ocupa a altura toda; no desktop é uma coluna fixa de 320px.
        'flex-1 lg:flex-none lg:w-[320px]',
        // No mobile, ao abrir uma conversa a lista some (mestre-detalhe); no desktop fica sempre.
        selecionadoId ? 'hidden lg:flex' : 'flex'
      )}
    >
      <div className="p-2.5 flex flex-col gap-2 border-b border-bd-1">
        <div className="flex items-center gap-1.5">
          <CampoBusca
            valor={busca}
            aoMudar={setBusca}
            rotuloAcessivel="Pesquisar chamados"
            className="flex-1"
          />
          <button
            type="button"
            onClick={aoAtualizar}
            aria-label="Atualizar lista"
            className="w-8 h-8 shrink-0 rounded-1 flex items-center justify-center text-tx-2 hover:text-tx-1 hover:bg-sf-2 border border-bd-campo transicao"
          >
            <RotateCw size={15} className={cn(atualizando && 'animate-spin')} />
          </button>
          <CriarAtendimento />
        </div>

        <div className="flex items-center gap-1.5">
          <ListFilter size={15} className="text-tx-3 shrink-0" />
          <select
            value={setorFiltro}
            onChange={(e) => aoFiltrar({ ...filtro, departamentoId: e.target.value || null })}
            aria-label="Filtrar por departamento"
            className="flex-1 h-7 px-2 text-apoio rounded-1 bg-sf-2 border border-bd-campo text-tx-2 hover:border-tx-3 focus:border-br-2 focus:outline-none transicao"
          >
            <option value="">Todos os setores</option>
            {(departamentos.lista.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
        </div>

        {nomeAtendente && (
          <div className="flex items-center">
            <span className="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-1 bg-br-soft text-br-2 text-apoio font-medium">
              Atendente: {nomeAtendente}
              <button
                type="button"
                onClick={() => aoFiltrar({ ...filtro, atendenteId: null })}
                aria-label="Limpar filtro de atendente"
                className="w-6 h-6 flex items-center justify-center rounded-micro hover:bg-[color:var(--br-soft)]"
              >
                <X size={13} />
              </button>
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-0.5 p-2 border-b border-bd-1">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setFila(a.id)}
            className={cn(
              'flex-1 h-7 rounded-1 text-apoio transicao inline-flex items-center justify-center gap-1',
              fila === a.id ? 'bg-br-soft text-br-2 font-medium' : 'text-tx-2 hover:text-tx-1 hover:bg-sf-2'
            )}
          >
            {a.label}
            <span className={cn('text-mini', fila === a.id ? 'text-br-2' : 'text-tx-3')}>{listas[a.id].length}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {carregando ? (
          <LinhasCarregando linhas={5} />
        ) : lista.length === 0 ? (
          <Vazio icone={<IconeInbox size={20} />} titulo={vazio[fila].titulo} descricao={vazio[fila].descricao} />
        ) : (
          lista.map((a) => {
            const ativo = selecionadoId === a.id
            const setor = a.departamento?.nome
            const empresa = nomeEmpresa(a.contato?.cliente)
            const tags = (a.tags ?? [])
              .map((t) => t.tag)
              .filter((t): t is NonNullable<typeof t> => !!t)
            return (
              <button
                key={a.id}
                onClick={() => onSelecionar(a.id)}
                className={cn(
                  'relative w-full text-left px-3 py-2.5 border-b border-bd-1 flex gap-2.5 transicao',
                  ativo ? 'bg-sf-2' : 'hover:bg-sf-2'
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('absolute left-0 top-0 bottom-0 w-[2px]', ativo ? 'bg-br-1' : 'bg-transparent')}
                />
                <Avatar nome={nomeContato(a)} tamanho={38} whatsapp />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-corpo text-tx-1 font-medium truncate">{nomeContato(a)}</span>
                    <span className="dado text-mini text-tx-3 shrink-0">{hora(a.ultima_mensagem_em)}</span>
                  </div>
                  {empresa && (
                    <div className="flex items-center gap-1 mt-0.5 min-w-0">
                      <Building2 size={12} className="text-tx-3 shrink-0" />
                      <span className="text-apoio text-tx-2 truncate">{empresa}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    <PontoStatus status={a.status} />
                    <span className="text-apoio text-tx-2 italic truncate">{setor ?? 'Sem setor'}</span>
                    {participoDe(a) && (
                      <span className="shrink-0 inline-flex items-center h-[16px] px-1.5 rounded-micro bg-br-soft text-br-2 text-micro font-semibold uppercase tracking-wide">
                        Participo
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <span className="dado text-mini text-tx-3 truncate">{a.contato?.telefone ?? ''}</span>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      {tags.map((t) => (
                        <PillTag key={t.id} tag={t} compacta className="max-w-[calc(50%-3px)]" />
                      ))}
                    </div>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
