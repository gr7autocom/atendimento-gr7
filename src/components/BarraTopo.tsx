import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MessagesSquare, Bell, ChevronDown, LogOut } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Avatar } from './ui/Avatar'
import { cn } from '../lib/utils'

/**
 * Barra horizontal do topo, comum às duas cascas (Atendimento e Admin).
 * Marca à esquerda, notificações e usuário à direita. O menu do usuário
 * guarda o "Sair" e qualquer navegação secundária passada em `menu`.
 */
export function BarraTopo({ titulo, menu }: { titulo: string; menu?: ReactNode }) {
  const { signOut, usuario } = useAuth()
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  return (
    <header className="h-14 shrink-0 px-3 sm:px-4 flex items-center justify-between gap-3 bg-sf-1 border-b border-bd-1">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-[6px] bg-br-1 flex items-center justify-center shrink-0">
          <MessagesSquare size={15} className="text-white" />
        </div>
        <span className="text-[14px] font-semibold text-tx-1 truncate">{titulo}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Notificações"
          className="w-8 h-8 rounded-[6px] flex items-center justify-center text-tx-2 hover:text-tx-1 hover:bg-sf-2 transition-colors duration-[120ms]"
        >
          <Bell size={17} />
        </button>

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={aberto}
            className="flex items-center gap-2 h-8 pl-1 pr-1.5 rounded-[6px] hover:bg-sf-2 transition-colors duration-[120ms]"
          >
            <Avatar nome={usuario?.nome ?? usuario?.email ?? '?'} tamanho={26} />
            <span className="hidden sm:block text-[13px] text-tx-1 max-w-[140px] truncate">
              {usuario?.nome ?? 'Usuário'}
            </span>
            <ChevronDown size={14} className={cn('text-tx-3 transition-transform', aberto && 'rotate-180')} />
          </button>

          {aberto && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+6px)] z-30 w-56 rounded-[10px] border border-bd-2 bg-sf-3 shadow-lg py-1"
            >
              <div className="px-3 py-2 border-b border-bd-1">
                <div className="text-[13px] text-tx-1 truncate">{usuario?.nome ?? 'Usuário'}</div>
                <div className="text-[11px] text-tx-3 truncate">{usuario?.email}</div>
              </div>
              {menu && <div className="py-1 border-b border-bd-1">{menu}</div>}
              <button
                type="button"
                onClick={() => signOut()}
                role="menuitem"
                className="flex items-center gap-2.5 w-full px-3 h-9 text-[13px] text-tx-2 hover:text-tx-1 hover:bg-sf-2 transition-colors duration-[120ms]"
              >
                <LogOut size={15} /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

/** Item de navegação usado dentro do menu do usuário (ex.: acesso cruzado do admin). */
export function ItemMenuTopo({
  onClick,
  icone,
  children,
}: {
  onClick: () => void
  icone: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className="flex items-center gap-2.5 w-full px-3 h-9 text-[13px] text-tx-2 hover:text-tx-1 hover:bg-sf-2 transition-colors duration-[120ms]"
    >
      {icone} {children}
    </button>
  )
}
