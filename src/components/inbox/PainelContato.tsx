import { useEffect, useState } from 'react'
import { useAtualizarContato, nomeEmpresa, type AtendimentoLista } from '../../lib/useInbox'
import { PontoStatus } from '../ui/Selo'
import { Entrada } from '../ui/Campo'

export function PainelContato({ atendimento }: { atendimento: AtendimentoLista | null }) {
  const atualizar = useAtualizarContato()
  const [nome, setNome] = useState('')

  useEffect(() => {
    setNome(atendimento?.contato?.nome ?? '')
  }, [atendimento?.contato?.id, atendimento?.contato?.nome])

  if (!atendimento) return null

  const contato = atendimento.contato

  return (
    <aside className="lg:w-[264px] shrink-0 bg-sf-1 border-t lg:border-t-0 lg:border-l border-bd-1 overflow-y-auto">
      <div className="p-4 border-b border-bd-1">
        <div className="rotulo">Protocolo</div>
        <div className="dado text-[20px] font-medium text-tx-1 leading-tight">#{atendimento.protocolo}</div>
        <div className="mt-1">
          <PontoStatus status={atendimento.status} comRotulo />
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div>
          <div className="rotulo mb-1.5">Quem está falando</div>
          <Entrada
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={() => {
              if (contato && nome !== (contato.nome ?? '')) {
                atualizar.mutate({ id: contato.id, valores: { nome: nome || null } })
              }
            }}
            placeholder={contato?.nome_whatsapp ?? 'Nome do contato'}
            aria-label="Nome do contato"
            dica={`WhatsApp informou: ${contato?.nome_whatsapp || 'sem nome'}`}
          />
        </div>

        <div>
          <div className="rotulo">Telefone</div>
          <div className="dado text-[13px] text-tx-1 mt-0.5">{contato?.telefone}</div>
        </div>

        <div>
          <div className="rotulo">Empresa</div>
          {contato?.cliente_id ? (
            <div className="text-[13px] text-tx-1 mt-0.5">
              {nomeEmpresa(contato.cliente) ?? 'Cadastro vinculado'}
            </div>
          ) : (
            <div className="text-[13px] text-tx-2 mt-0.5">
              Sem cadastro. Use Aceitar para vincular a empresa e assumir.
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
