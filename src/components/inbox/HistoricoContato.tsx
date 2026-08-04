import { useState } from 'react'
import { History, Star } from 'lucide-react'
import { useHistoricoContato, type AtendimentoHistorico } from '../../lib/useInbox'
import { PontoStatus } from '../ui/Selo'
import { LinhasCarregando, Erro } from '../ui/Estados'
import { corSetor } from '../../lib/cores'

/** Quantos atendimentos a lista mostra antes do "Ver todos". */
const LIMITE_LISTA = 3

/** "12/07" no ano corrente; "12/07/25" quando for de outro ano. */
function dataCurta(iso: string): string {
  const d = new Date(iso)
  const mesmoAno = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(mesmoAno ? {} : { year: '2-digit' }),
  })
}

function ItemHistorico({ item }: { item: AtendimentoHistorico }) {
  const cor = item.departamento ? corSetor(item.departamento) : null
  return (
    <li className="rounded-2 border border-bd-1 bg-sf-2 px-3 py-2.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="dado text-corpo text-tx-1 font-medium tabular-nums">#{item.protocolo}</span>
        <div className="flex items-center gap-2 shrink-0">
          <time className="text-apoio text-tx-3" dateTime={item.aberto_em}>
            {dataCurta(item.aberto_em)}
          </time>
          {/* Ponto + rótulo: cor sozinha não pode carregar a informação. */}
          <PontoStatus status={item.status} comRotulo />
        </div>
      </div>

      <div className="flex items-center gap-1.5 min-w-0">
        {item.departamento ? (
          <span
            style={{ background: cor?.bg, color: cor?.fg }}
            className="shrink-0 max-w-[130px] truncate px-1.5 h-4 leading-4 rounded-micro text-micro font-semibold uppercase tracking-wide"
            title={item.departamento}
          >
            {item.departamento}
          </span>
        ) : (
          <span className="text-apoio text-tx-3">Sem setor</span>
        )}
        <span className="text-apoio text-tx-2 truncate min-w-0" title={item.atendente ?? undefined}>
          {item.atendente ?? 'Sem atendente'}
        </span>
      </div>

      {(item.motivo || item.avaliacao != null) && (
        <div className="flex items-center justify-between gap-2 text-apoio text-tx-3">
          <span className="truncate min-w-0" title={item.motivo ?? undefined}>
            {item.motivo ?? ''}
          </span>
          {item.avaliacao != null && (
            <span className="shrink-0 inline-flex items-center gap-1 text-tx-2">
              <Star size={11} aria-hidden="true" />
              <span className="dado tabular-nums">{item.avaliacao}</span>
              <span className="sr-only">de nota</span>
            </span>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * Atendimentos anteriores do mesmo contato, no painel lateral.
 *
 * Serve para o atendente saber o que já foi tratado antes de responder. Os itens
 * **não são clicáveis de propósito**: a visibilidade é por dono, então abrir o
 * chamado de outro atendente esbarraria na RLS e daria erro ou tela vazia. Aqui
 * o resumo basta; quem precisa do detalhe tem o protocolo para pedir a quem
 * atendeu.
 */
export function HistoricoContato({
  contatoId,
  atendimentoAtualId,
}: {
  contatoId: string | null
  atendimentoAtualId: string
}) {
  const [expandido, setExpandido] = useState(false)
  const historico = useHistoricoContato(contatoId)

  if (historico.isLoading) return <LinhasCarregando linhas={3} />
  if (historico.isError) {
    return (
      <Erro mensagem="Não foi possível carregar o histórico." onTentar={() => historico.refetch()} />
    )
  }

  // O chamado aberto agora não entra: ele já está na tela ao lado.
  const anteriores = (historico.data ?? []).filter((a) => a.id !== atendimentoAtualId)

  if (anteriores.length === 0) {
    return (
      <p className="flex items-center gap-2 text-corpo text-tx-2 py-1">
        <History size={15} className="shrink-0 text-tx-3" aria-hidden="true" />
        Primeiro atendimento deste contato.
      </p>
    )
  }

  const visiveis = expandido ? anteriores : anteriores.slice(0, LIMITE_LISTA)
  const ocultos = anteriores.length - visiveis.length

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {visiveis.map((item) => (
          <ItemHistorico key={item.id} item={item} />
        ))}
      </ul>

      {(ocultos > 0 || expandido) && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="self-start h-6 px-1 -ml-1 rounded-1 text-apoio text-br-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)] transicao"
        >
          {expandido ? 'Ver menos' : `Ver todos (${anteriores.length})`}
        </button>
      )}
    </div>
  )
}
