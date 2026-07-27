import { useState } from 'react'
import { X, Plus, Search } from 'lucide-react'
import { useParticipantes, type AtendimentoLista } from '../../lib/useInbox'
import { useUsuarios } from '../../lib/useVinculos'
import { useUsuarioAtual } from '../../lib/auth'
import { usePermissao } from '../../lib/permissoes'
import { Avatar } from '../ui/Avatar'

/**
 * Conteúdo da seção "Participantes" do painel do contato. O responsável aparece
 * no topo (derivado de responsavel_id); os demais são adicionados por busca.
 * Adicionar/remover só aparece para o responsável ou admin (a RLS também barra).
 */
export function ParticipantesContato({ atendimento }: { atendimento: AtendimentoLista }) {
  const usuario = useUsuarioAtual()
  const { isAdmin } = usePermissao()
  const usuarios = useUsuarios(true)
  const { lista, adicionar, remover } = useParticipantes(atendimento.id)
  const [busca, setBusca] = useState('')

  const responsavelId = atendimento.responsavel_id
  const responsavel = (usuarios.data ?? []).find((u) => u.id === responsavelId) ?? null
  const participantes = lista.data ?? []
  const souResponsavel = !!responsavelId && responsavelId === usuario?.id
  const podeGerenciar = souResponsavel || isAdmin

  const jaDentro = new Set(
    [responsavelId, ...participantes.map((p) => p.usuario_id)].filter(Boolean) as string[]
  )
  const termo = busca.trim().toLowerCase()
  const candidatos = (usuarios.data ?? []).filter(
    (u) => u.ativo && !jaDentro.has(u.id) && (!termo || `${u.nome} ${u.email ?? ''}`.toLowerCase().includes(termo))
  )

  return (
    <div className="flex flex-col gap-3">
      {podeGerenciar && (
        <div className="relative">
          <div className="flex items-center gap-2 h-9 px-2.5 rounded-[8px] bg-sf-2 border border-bd-2 focus-within:border-br-1">
            <Search size={14} className="text-tx-3 shrink-0" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Adicionar atendente"
              aria-label="Buscar atendente para adicionar"
              className="flex-1 min-w-0 bg-transparent text-[13px] text-tx-1 placeholder:text-tx-3 focus:outline-none"
            />
            <Plus size={15} className="text-tx-3 shrink-0" />
          </div>
          {termo && (
            <div className="absolute z-10 mt-1 w-full rounded-[8px] border border-bd-2 bg-sf-1 shadow-lg max-h-52 overflow-y-auto">
              {candidatos.length === 0 ? (
                <p className="px-3 py-2.5 text-[12px] text-tx-3">Nenhum atendente encontrado.</p>
              ) : (
                candidatos.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      adicionar.mutate(u.id)
                      setBusca('')
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left hover:bg-sf-2 transition-colors"
                  >
                    <Avatar nome={u.nome} fotoUrl={u.foto_url} tamanho={26} />
                    <span className="text-[13px] text-tx-1 truncate">{u.nome}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {responsavel && (
          <div className="flex items-center gap-2.5">
            <Avatar nome={responsavel.nome} fotoUrl={responsavel.foto_url} tamanho={32} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-tx-1 truncate">{responsavel.nome}</div>
              <div className="text-[11px] text-br-2">Responsável</div>
            </div>
          </div>
        )}

        {participantes.map((p) => (
          <div key={p.id} className="flex items-center gap-2.5">
            <Avatar nome={p.usuario?.nome ?? '?'} fotoUrl={p.usuario?.foto_url ?? null} tamanho={32} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-tx-1 truncate">{p.usuario?.nome ?? 'Atendente'}</div>
              <div className="text-[11px] text-tx-3">Participante</div>
            </div>
            {podeGerenciar && (
              <button
                type="button"
                onClick={() => remover.mutate(p.id)}
                aria-label={`Remover ${p.usuario?.nome ?? 'participante'}`}
                className="shrink-0 w-7 h-7 grid place-items-center rounded-[6px] text-tx-3 hover:text-err hover:bg-err-soft transition-colors"
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}

        {!responsavel && participantes.length === 0 && (
          <p className="text-[12px] text-tx-3">Ninguém no atendimento ainda.</p>
        )}
      </div>
    </div>
  )
}
