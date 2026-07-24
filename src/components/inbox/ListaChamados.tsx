import { useState } from 'react'
import { Inbox as IconeInbox } from 'lucide-react'
import type { AtendimentoLista } from '../../lib/useInbox'
import { cn } from '../../lib/utils'
import { PontoStatus } from '../ui/Selo'
import { Vazio, LinhasCarregando } from '../ui/Estados'

type Fila = 'meus' | 'pendentes' | 'potenciais'

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
}: {
  atendimentos: AtendimentoLista[]
  usuarioId: string | null
  selecionadoId: string | null
  onSelecionar: (id: string) => void
  carregando?: boolean
}) {
  const [fila, setFila] = useState<Fila>('pendentes')

  // As três abas são exclusivas: um chamado aparece em uma só.
  // Sem cadastro vai para Potenciais (mesmo estando na fila), até alguém
  // vincular a empresa e assumir. Com dono, vai para Meus.
  const ativos = atendimentos.filter((a) => a.status !== 'finalizado')
  const semCadastro = (a: AtendimentoLista) => !a.contato?.cliente_id
  const listas: Record<Fila, AtendimentoLista[]> = {
    meus: ativos.filter((a) => a.responsavel_id === usuarioId),
    pendentes: ativos.filter((a) => a.status === 'na_fila' && !a.responsavel_id && !semCadastro(a)),
    potenciais: ativos.filter((a) => !a.responsavel_id && semCadastro(a)),
  }
  const abas: { id: Fila; label: string }[] = [
    { id: 'meus', label: 'Meus' },
    { id: 'pendentes', label: 'Pendentes' },
    { id: 'potenciais', label: 'Potenciais' },
  ]
  const lista = listas[fila]

  const vazio: Record<Fila, { titulo: string; descricao: string }> = {
    meus: { titulo: 'Nenhum atendimento com você', descricao: 'Assuma um chamado em Pendentes para começar.' },
    pendentes: { titulo: 'Fila vazia', descricao: 'Nada esperando atendimento no momento.' },
    potenciais: { titulo: 'Nenhum contato novo', descricao: 'Quem escrever sem cadastro aparece aqui.' },
  }

  return (
    <div className="lg:w-[300px] shrink-0 bg-sf-1 border-b lg:border-b-0 lg:border-r border-bd-1 flex flex-col min-h-0">
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
            <span className={cn('text-[11px]', fila === a.id ? 'text-br-2' : 'text-tx-3')}>
              {listas[a.id].length}
            </span>
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
            return (
              <button
                key={a.id}
                onClick={() => onSelecionar(a.id)}
                className={cn(
                  'relative w-full text-left px-3 py-2.5 border-b border-bd-1 transition-colors duration-[120ms]',
                  ativo ? 'bg-sf-2' : 'hover:bg-sf-2'
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-0 top-0 bottom-0 w-[2px]',
                    ativo ? 'bg-br-1' : 'bg-transparent'
                  )}
                />
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] text-tx-1 font-medium truncate">{nomeContato(a)}</span>
                  <span className="dado text-[11px] text-tx-3 shrink-0">{hora(a.ultima_mensagem_em)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 min-w-0">
                  <PontoStatus status={a.status} />
                  <span className="text-[12px] text-tx-2 truncate">
                    {a.departamento?.nome ?? 'Sem setor'}
                  </span>
                  <span className="dado text-[11px] text-tx-3 ml-auto shrink-0">#{a.protocolo}</span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
