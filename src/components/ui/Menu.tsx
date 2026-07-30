import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

/**
 * Fecha o painel ao clicar fora ou apertar Esc, e devolve a ref para envolver o
 * conjunto gatilho + painel.
 *
 * O mesmo `useEffect` de "clicou fora" estava escrito três vezes (menu do
 * usuário, menu ⋮ da conversa e seletor de tags), e nenhuma das três fechava com
 * Esc, que é o reflexo de quem usa teclado.
 */
export function useFecharFora<T extends HTMLElement = HTMLDivElement>(aberto: boolean, aoFechar: () => void) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) aoFechar()
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto, aoFechar])

  return ref
}

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
