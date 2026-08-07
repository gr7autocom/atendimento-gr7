import { useEffect, useState } from 'react'
import { Ponto } from '../ui/Selo'
import { usePresencaCliente } from '../../lib/useInbox'

/**
 * Presença do cliente no cabeçalho da conversa, só no canal web.
 *
 * Por que existe: o PWA do cliente não tem push (ver docs/canal-web.md), então
 * quem fecha a janela não é avisado de nada. Sem este indicador o atendente
 * escreve sem saber se está falando com alguém que lê agora ou com uma tela
 * fechada, que é a decisão que ele toma no WhatsApp olhando o "online".
 */

/**
 * O PWA fala de 10 em 10 segundos. 45s tolera três falhas seguidas antes de dizer
 * que a pessoa saiu: mais curto daria "ausente" com o cliente na frente da tela.
 */
const LIMIAR_PRESENTE_MS = 45_000

function textoAusencia(desdeMs: number): string {
  const min = Math.floor(desdeMs / 60_000)
  if (min < 1) return 'Cliente ausente'
  if (min < 60) return `Cliente ausente há ${min} min`
  return `Cliente ausente há ${Math.floor(min / 60)} h`
}

export function PresencaCliente({
  atendimentoId,
  ativo,
}: {
  atendimentoId: string
  /** Só consulta em chamado do site que ainda está aberto. */
  ativo: boolean
}) {
  const { data } = usePresencaCliente(atendimentoId, ativo)

  /*
    Relógio próprio, de 30 em 30 segundos.

    O refetch sozinho não basta: enquanto o cliente está ausente o `ultimo_uso_em`
    não muda, o TanStack Query reaproveita o objeto anterior (structural sharing)
    e o componente não re-renderiza. O texto congelaria em "há 3 min" para sempre,
    e quem está "na conversa" nunca viraria "ausente".
  */
  const [, marcarTempo] = useState(0)
  useEffect(() => {
    if (!ativo) return
    const id = setInterval(() => marcarTempo((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [ativo])

  if (!ativo || !data) return null

  // Sem acesso vivo: o atendente até escreve, mas o cliente não recebe. É o estado
  // que mais muda o que ele faz, por isso usa a cor de aviso.
  if (!data.ultimo_uso_em || data.sessoes_ativas === 0) {
    return <Ponto cor="var(--warn)">Cliente sem acesso</Ponto>
  }

  const desde = Date.now() - new Date(data.ultimo_uso_em).getTime()
  if (desde < LIMIAR_PRESENTE_MS) {
    return <Ponto cor="var(--ok)">Cliente na conversa</Ponto>
  }

  // Ausente é situação normal de quem foi cuidar de outra coisa, não um problema:
  // ponto neutro, para não competir com o status do atendimento ao lado.
  return <Ponto cor="var(--tx-3)">{textoAusencia(desde)}</Ponto>
}
