import { useState } from 'react'
import { Inbox as IconeInbox, Search, ListFilter, RotateCw, X } from 'lucide-react'
import type { AtendimentoLista } from '../../lib/useInbox'
import type { FiltroInbox } from '../../pages/Dashboard'
import { useCrud } from '../../lib/useCrud'
import { useUsuarios } from '../../lib/useVinculos'
import { usePermissao } from '../../lib/permissoes'
import { cn } from '../../lib/utils'
import { corSetor } from '../../lib/coresSetor'
import { Avatar } from '../ui/Avatar'
import { PontoStatus } from '../ui/Selo'
import { Vazio, LinhasCarregando } from '../ui/Estados'
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
  const listas: Record<Fila, AtendimentoLista[]> = {
    ativos: base.filter((a) => (isAdmin ? !!a.responsavel_id : a.responsavel_id === usuarioId)),
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
    <div className="lg:w-[320px] shrink-0 bg-sf-1 border-b lg:border-b-0 lg:border-r border-bd-1 flex flex-col min-h-0">
      <div className="p-2.5 flex flex-col gap-2 border-b border-bd-1">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tx-3 pointer-events-none" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar"
              aria-label="Pesquisar chamados"
              className="w-full h-8 pl-8 pr-2.5 text-[13px] rounded-[6px] bg-sf-2 border border-bd-2 text-tx-1 placeholder:text-tx-3 hover:border-bd-3 focus:border-br-1 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)] transition-colors duration-[120ms]"
            />
          </div>
          <button
            type="button"
            onClick={aoAtualizar}
            aria-label="Atualizar lista"
            className="w-8 h-8 shrink-0 rounded-[6px] flex items-center justify-center text-tx-2 hover:text-tx-1 hover:bg-sf-2 border border-bd-2 transition-colors duration-[120ms]"
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
            className="flex-1 h-7 px-2 text-[12px] rounded-[6px] bg-sf-2 border border-bd-2 text-tx-2 hover:border-bd-3 focus:border-br-1 focus:outline-none transition-colors duration-[120ms]"
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
            <span className="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-[6px] bg-br-soft text-br-2 text-[12px] font-medium">
              Atendente: {nomeAtendente}
              <button
                type="button"
                onClick={() => aoFiltrar({ ...filtro, atendenteId: null })}
                aria-label="Limpar filtro de atendente"
                className="w-5 h-5 flex items-center justify-center rounded-[4px] hover:bg-[color:var(--br-soft)]"
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
              'flex-1 h-7 rounded-[6px] text-[12px] transition-colors duration-[120ms] inline-flex items-center justify-center gap-1',
              fila === a.id ? 'bg-br-soft text-br-2 font-medium' : 'text-tx-2 hover:text-tx-1 hover:bg-sf-2'
            )}
          >
            {a.label}
            <span className={cn('text-[11px]', fila === a.id ? 'text-br-2' : 'text-tx-3')}>{listas[a.id].length}</span>
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
            const cor = setor ? corSetor(setor) : null
            return (
              <button
                key={a.id}
                onClick={() => onSelecionar(a.id)}
                className={cn(
                  'relative w-full text-left px-3 py-2.5 border-b border-bd-1 flex gap-2.5 transition-colors duration-[120ms]',
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
                    <span className="text-[13px] text-tx-1 font-medium truncate">{nomeContato(a)}</span>
                    <span className="dado text-[11px] text-tx-3 shrink-0">{hora(a.ultima_mensagem_em)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    <PontoStatus status={a.status} />
                    <span className="text-[12px] text-tx-2 italic truncate">{setor ?? 'Sem setor'}</span>
                  </div>
                  <div className="mt-1">
                    <span className="dado text-[11px] text-tx-3 truncate">{a.contato?.telefone ?? ''}</span>
                  </div>
                  {setor && cor && (
                    <span
                      className="inline-flex items-center h-5 mt-1.5 px-1.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wide"
                      style={{ background: cor.bg, color: cor.fg }}
                    >
                      {setor}
                    </span>
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
