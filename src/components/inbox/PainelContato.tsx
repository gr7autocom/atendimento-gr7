import { useEffect, useState } from 'react'
import { useAtualizarContato, nomeEmpresa, type AtendimentoLista } from '../../lib/useInbox'
import { PontoStatus } from '../ui/Selo'
import { Avatar } from '../ui/Avatar'
import { Entrada } from '../ui/Campo'

function nomeContato(a: AtendimentoLista) {
  return a.contato?.nome || a.contato?.nome_whatsapp || a.contato?.telefone || 'Sem nome'
}

export function PainelContato({
  atendimento,
  variante = 'lateral',
}: {
  atendimento: AtendimentoLista | null
  /** 'lateral' = coluna no desktop (some no mobile); 'cheia' = ocupa tudo (overlay no mobile). */
  variante?: 'lateral' | 'cheia'
}) {
  const atualizar = useAtualizarContato()
  const [nome, setNome] = useState('')
  const [cargo, setCargo] = useState('')

  useEffect(() => {
    setNome(atendimento?.contato?.nome ?? '')
    setCargo(atendimento?.contato?.cargo ?? '')
  }, [atendimento?.contato?.id, atendimento?.contato?.nome, atendimento?.contato?.cargo])

  if (!atendimento) return null

  const contato = atendimento.contato
  const cls =
    variante === 'cheia'
      ? 'w-full h-full overflow-y-auto bg-sf-1'
      : 'hidden lg:block lg:w-[272px] shrink-0 bg-sf-1 lg:border-l border-bd-1 overflow-y-auto'

  return (
    <aside className={cls}>
      <div className="p-5 flex flex-col items-center text-center border-b border-bd-1">
        <Avatar nome={nomeContato(atendimento)} tamanho={60} whatsapp />
        <div className="mt-2.5 text-[14px] font-medium text-tx-1 max-w-full truncate">
          {nomeContato(atendimento)}
        </div>
        <div className="mt-1.5">
          <PontoStatus status={atendimento.status} comRotulo />
        </div>
      </div>

      <div className="px-5 py-4 border-b border-bd-1 flex items-baseline justify-between gap-3">
        <span className="rotulo text-tx-3">Protocolo</span>
        <span className="dado text-[16px] font-medium text-tx-1">#{atendimento.protocolo}</span>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div>
          <div className="rotulo mb-1.5">Nome</div>
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
          <div className="rotulo mb-1.5">Cargo</div>
          <Entrada
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            onBlur={() => {
              if (contato && cargo.trim() !== (contato.cargo ?? '')) {
                atualizar.mutate({ id: contato.id, valores: { cargo: cargo.trim() || null } })
              }
            }}
            placeholder="Ex.: Financeiro"
            aria-label="Cargo do contato"
          />
        </div>

        <div>
          <div className="rotulo mb-1">Telefone</div>
          <div className="dado text-[13px] text-tx-1">{contato?.telefone}</div>
        </div>

        <div>
          <div className="rotulo mb-1">Empresa</div>
          {contato?.cliente_id ? (
            <div className="text-[13px] text-tx-1">{nomeEmpresa(contato.cliente) ?? 'Cadastro vinculado'}</div>
          ) : (
            <div className="text-[13px] text-tx-2">Sem cadastro. Use Aceitar para vincular a empresa e assumir.</div>
          )}
        </div>
      </div>
    </aside>
  )
}
