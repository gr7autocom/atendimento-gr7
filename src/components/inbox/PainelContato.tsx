import { useEffect, useState } from 'react'
import { useAtualizarContato, type AtendimentoLista } from '../../lib/useInbox'

const ROTULO_STATUS: Record<string, string> = {
  triagem: 'No bot',
  na_fila: 'Na fila',
  em_atendimento: 'Em atendimento',
  finalizado: 'Finalizado',
}

export function PainelContato({ atendimento }: { atendimento: AtendimentoLista | null }) {
  const atualizar = useAtualizarContato()
  const [nome, setNome] = useState('')

  useEffect(() => {
    setNome(atendimento?.contato?.nome ?? '')
  }, [atendimento?.contato?.id, atendimento?.contato?.nome])

  if (!atendimento) return null

  const contato = atendimento.contato

  return (
    <aside className="lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-[#ffffff1a] p-3 flex flex-col gap-4 overflow-y-auto">
      <div>
        <div className="text-xs text-[#ffffffb3]">Protocolo</div>
        <div className="text-[#ffffff] text-lg font-bold">#{atendimento.protocolo}</div>
        <div className="text-xs text-[#ffffffb3]">{ROTULO_STATUS[atendimento.status] ?? atendimento.status}</div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#ffffffb3]">Quem está falando</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={() => {
            if (contato && nome !== (contato.nome ?? '')) {
              atualizar.mutate({ id: contato.id, valores: { nome: nome || null } })
            }
          }}
          placeholder={contato?.nome_whatsapp ?? 'Nome do contato'}
          aria-label="Nome do contato"
          className="rounded px-3 py-2 bg-[#ffffff14] text-[#ffffff] text-sm"
        />
        <span className="text-xs text-[#ffffff80]">
          O WhatsApp informou: {contato?.nome_whatsapp || 'sem nome'}
        </span>
      </div>

      <div>
        <div className="text-xs text-[#ffffffb3]">Telefone</div>
        <div className="text-[#ffffff] text-sm">{contato?.telefone}</div>
      </div>

      <div>
        <div className="text-xs text-[#ffffffb3]">Empresa</div>
        {contato?.cliente_id ? (
          <div className="text-[#ffffff] text-sm">Vinculada ao cadastro do painel</div>
        ) : (
          <div className="text-[#ffffffb3] text-sm">
            Sem cadastro. O vínculo com a empresa chega junto da etapa de design.
          </div>
        )}
      </div>
    </aside>
  )
}
