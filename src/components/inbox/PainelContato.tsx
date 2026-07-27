import { useEffect, useState } from 'react'
import { Copy, Check, Headset, MessageSquare } from 'lucide-react'
import {
  useAtualizarContato,
  useContadoresContato,
  useParticipantes,
  nomeEmpresa,
  type AtendimentoLista,
} from '../../lib/useInbox'
import { Avatar } from '../ui/Avatar'
import { Entrada } from '../ui/Campo'
import { Skeleton } from '../ui/Estados'
import { SecaoContato } from './SecaoContato'
import { ParticipantesContato } from './ParticipantesContato'

function nomeContato(a: AtendimentoLista) {
  return a.contato?.nome || a.contato?.nome_whatsapp || a.contato?.telefone || 'Sem nome'
}

/** Card de contador do cabeçalho (Atendimentos, Mensagens). */
function Contador({
  icone: Icone,
  label,
  valor,
  carregando,
}: {
  icone: typeof Headset
  label: string
  valor: number
  carregando: boolean
}) {
  return (
    <div className="rounded-[10px] border border-bd-1 bg-sf-2 px-3 py-2.5">
      <div className="text-[11px] text-tx-3">{label}</div>
      <div className="flex items-end justify-between gap-1 mt-1">
        {carregando ? (
          <Skeleton className="h-5 w-9" />
        ) : (
          <span className="dado text-[20px] font-semibold text-tx-1 tabular-nums leading-none">{valor}</span>
        )}
        <Icone size={15} className="text-tx-3 mb-0.5 shrink-0" />
      </div>
    </div>
  )
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
  const [copiado, setCopiado] = useState(false)
  const contadores = useContadoresContato(atendimento?.contato?.id ?? null)
  const participantes = useParticipantes(atendimento?.id ?? null)

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

  function copiarProtocolo() {
    navigator.clipboard?.writeText(String(atendimento!.protocolo))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  return (
    <aside className={cls}>
      <div className="p-5 flex flex-col items-center text-center border-b border-bd-1">
        <Avatar nome={nomeContato(atendimento)} tamanho={72} whatsapp />
        <button
          type="button"
          onClick={copiarProtocolo}
          className="mt-3 inline-flex items-center gap-1.5 text-tx-3 hover:text-tx-2 transition-colors"
          title="Copiar protocolo"
        >
          <span className="rotulo">Protocolo</span>
          {copiado ? <Check size={12} className="text-ok" /> : <Copy size={12} />}
        </button>
        <div className="dado text-[26px] font-semibold text-tx-1 tabular-nums leading-tight">
          {atendimento.protocolo}
        </div>
      </div>

      <div className="px-5 py-4 grid grid-cols-2 gap-2.5 border-b border-bd-1">
        <Contador icone={Headset} label="Atendimentos" valor={contadores.data?.atendimentos ?? 0} carregando={contadores.isLoading} />
        <Contador icone={MessageSquare} label="Mensagens" valor={contadores.data?.mensagens ?? 0} carregando={contadores.isLoading} />
      </div>

      <SecaoContato titulo="Informações" inicialAberta>
        <div className="flex flex-col gap-4">
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
            <div className="rotulo mb-1">Empresa</div>
            {contato?.cliente_id ? (
              <div className="text-[13px] text-tx-1">{nomeEmpresa(contato.cliente) ?? 'Cadastro vinculado'}</div>
            ) : (
              <div className="text-[13px] text-tx-2">Sem cadastro. Use Aceitar para vincular a empresa e assumir.</div>
            )}
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
        </div>
      </SecaoContato>

      <SecaoContato
        titulo="Participantes"
        contagem={(atendimento.responsavel_id ? 1 : 0) + (participantes.lista.data?.length ?? 0)}
      >
        <ParticipantesContato atendimento={atendimento} />
      </SecaoContato>
    </aside>
  )
}
