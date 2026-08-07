import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Tom = 'neutro' | 'marca' | 'ok' | 'warn' | 'err'

const TONS: Record<Tom, string> = {
  neutro: 'bg-sf-3 text-tx-2 border-bd-2',
  marca: 'bg-br-soft text-br-2 border-transparent',
  ok: 'bg-ok-soft text-ok border-transparent',
  warn: 'bg-warn-soft text-warn border-transparent',
  err: 'bg-err-soft text-err border-transparent',
}

export function Selo({
  tom = 'neutro',
  children,
  className,
}: {
  tom?: Tom
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center h-5 px-1.5 rounded-1 border text-mini font-medium leading-none',
        TONS[tom],
        className
      )}
    >
      {children}
    </span>
  )
}

/**
 * Ponto colorido de estado, com o texto ao lado. A cor é reforço: quem não
 * distingue as cores lê a mesma informação no rótulo (WCAG 1.4.1).
 *
 * Existe separado do `PontoStatus` porque a presença do cliente no canal web usa
 * o mesmo desenho com outra lista de estados. Não duplique este markup numa
 * terceira tela: passe `cor` e `children`.
 */
export function Ponto({
  cor,
  children,
  rotuloOculto = false,
}: {
  cor: string
  children: ReactNode
  rotuloOculto?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cor }} />
      <span className={cn('text-apoio', rotuloOculto ? 'sr-only' : 'text-tx-2')}>{children}</span>
    </span>
  )
}

/** Status do atendimento como ponto: lê mais rápido que texto numa lista densa. */
const COR_STATUS: Record<string, string> = {
  triagem: 'var(--tx-3)',
  na_fila: 'var(--warn)',
  em_atendimento: 'var(--br-2)',
  finalizado: 'var(--ok)',
}

export const ROTULO_STATUS: Record<string, string> = {
  triagem: 'No bot',
  na_fila: 'Na fila',
  em_atendimento: 'Em atendimento',
  finalizado: 'Finalizado',
}

export function PontoStatus({ status, comRotulo = false }: { status: string; comRotulo?: boolean }) {
  return (
    <Ponto cor={COR_STATUS[status] ?? 'var(--tx-3)'} rotuloOculto={!comRotulo}>
      {ROTULO_STATUS[status] ?? status}
    </Ponto>
  )
}
