import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** Casca do painel suspenso: superfície elevada, borda e sombra do tema. */
export function PainelMenu({
  children,
  className,
  rotulo,
}: {
  children: ReactNode
  className?: string
  rotulo?: string
}) {
  return (
    <div
      role="menu"
      aria-label={rotulo}
      className={cn(
        'absolute z-30 rounded-2 border border-bd-2 bg-sf-3 shadow-2 overflow-hidden',
        className
      )}
    >
      {children}
    </div>
  )
}

/** Item de um menu suspenso. `perigo` para a ação destrutiva (sair, remover). */
export function ItemMenu({
  onClick,
  icone,
  children,
  perigo,
}: {
  onClick: () => void
  icone?: ReactNode
  children: ReactNode
  perigo?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 w-full px-3 h-10 text-corpo text-left transicao',
        perigo ? 'text-err hover:bg-err-soft' : 'text-tx-2 hover:text-tx-1 hover:bg-sf-2'
      )}
    >
      {icone}
      {children}
    </button>
  )
}
