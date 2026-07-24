import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { MessagesSquare, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { usePermissao } from '../lib/permissoes'
import { cn } from '../lib/utils'

function ItemMenu({ para, icone, texto }: { para: string; icone: ReactNode; texto: string }) {
  return (
    <NavLink
      to={para}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-2.5 h-9 px-3 rounded-[6px] text-[13px] transition-colors duration-[120ms]',
          isActive ? 'bg-sf-2 text-tx-1 font-medium' : 'text-tx-2 hover:text-tx-1 hover:bg-sf-2'
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* barra de seleção: marca o item ativo sem precisar de cor de fundo forte */}
          <span
            aria-hidden="true"
            className={cn(
              'absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full transition-opacity duration-[120ms]',
              isActive ? 'bg-br-1 opacity-100' : 'opacity-0'
            )}
          />
          {icone}
          {texto}
        </>
      )}
    </NavLink>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { signOut, usuario } = useAuth()
  const { isAdmin } = usePermissao()

  return (
    <div className="h-screen flex flex-col md:flex-row bg-sf-0">
      <aside className="md:w-[212px] shrink-0 bg-sf-1 border-b md:border-b-0 md:border-r border-bd-1 flex md:flex-col">
        <div className="hidden md:flex items-center gap-2.5 h-14 px-3 border-b border-bd-1">
          <div className="w-7 h-7 rounded-[6px] bg-br-1 flex items-center justify-center shrink-0">
            <MessagesSquare size={15} className="text-white" />
          </div>
          <span className="text-[13px] font-semibold text-tx-1 truncate">GR7 Atendimento</span>
        </div>

        <nav className="flex md:flex-col gap-0.5 p-2 flex-1">
          <ItemMenu para="/inbox" icone={<MessagesSquare size={16} />} texto="Atendimento" />
          {isAdmin && <ItemMenu para="/admin" icone={<Settings size={16} />} texto="Administração" />}
        </nav>

        <div className="p-2 md:border-t border-bd-1">
          <div className="hidden md:block px-3 pb-2">
            <div className="text-[12px] text-tx-1 truncate">{usuario?.nome ?? 'Atendente'}</div>
            <div className="text-[11px] text-tx-3 truncate">{usuario?.email}</div>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2.5 w-full h-9 px-3 rounded-[6px] text-[13px] text-tx-2 hover:text-tx-1 hover:bg-sf-2 transition-colors duration-[120ms]"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  )
}
