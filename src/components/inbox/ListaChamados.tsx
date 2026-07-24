import { useState } from 'react'
import type { AtendimentoLista } from '../../lib/useInbox'
import { cn } from '../../lib/utils'

type Fila = 'meus' | 'pendentes' | 'potenciais'

const ROTULO_STATUS: Record<string, string> = {
  triagem: 'No bot',
  na_fila: 'Na fila',
  em_atendimento: 'Em atendimento',
  finalizado: 'Finalizado',
}

function nomeContato(a: AtendimentoLista) {
  return a.contato?.nome || a.contato?.nome_whatsapp || a.contato?.telefone || 'Sem nome'
}

export function ListaChamados({
  atendimentos,
  usuarioId,
  selecionadoId,
  onSelecionar,
}: {
  atendimentos: AtendimentoLista[]
  usuarioId: string | null
  selecionadoId: string | null
  onSelecionar: (id: string) => void
}) {
  const [fila, setFila] = useState<Fila>('pendentes')

  const ativos = atendimentos.filter((a) => a.status !== 'finalizado')
  const listas: Record<Fila, AtendimentoLista[]> = {
    meus: ativos.filter((a) => a.responsavel_id === usuarioId),
    pendentes: ativos.filter((a) => a.status === 'na_fila'),
    potenciais: ativos.filter((a) => a.contato && !a.contato.cliente_id),
  }
  const abas: { id: Fila; label: string }[] = [
    { id: 'meus', label: 'Meus' },
    { id: 'pendentes', label: 'Pendentes' },
    { id: 'potenciais', label: 'Potenciais' },
  ]
  const lista = listas[fila]

  return (
    <div className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-[#ffffff1a] flex flex-col min-h-0">
      <div className="flex gap-1 p-2">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setFila(a.id)}
            className={cn(
              'flex-1 rounded px-2 py-1.5 text-sm text-[#ffffff]',
              fila === a.id ? 'bg-[#ffffff26]' : 'bg-[#ffffff0d] hover:bg-[#ffffff14]'
            )}
          >
            {a.label} ({listas[a.id].length})
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {lista.length === 0 ? (
          <p className="text-[#ffffffb3] text-sm p-3">
            {fila === 'pendentes'
              ? 'Nenhum chamado esperando atendimento.'
              : fila === 'meus'
                ? 'Você não está atendendo ninguém agora.'
                : 'Nenhum contato sem cadastro.'}
          </p>
        ) : (
          lista.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelecionar(a.id)}
              className={cn(
                'w-full text-left px-3 py-2 border-b border-[#ffffff0d]',
                selecionadoId === a.id ? 'bg-[#ffffff1a]' : 'hover:bg-[#ffffff0d]'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#ffffff] text-sm truncate">{nomeContato(a)}</span>
                <span className="text-[#ffffff80] text-xs shrink-0">#{a.protocolo}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#ffffffb3]">
                <span className="truncate">{a.departamento?.nome ?? 'Sem departamento'}</span>
                <span>·</span>
                <span>{ROTULO_STATUS[a.status] ?? a.status}</span>
                {a.contato && !a.contato.cliente_id && (
                  <span className="text-[#ffffff80]">· sem cadastro</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
