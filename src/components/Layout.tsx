import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { MessageSquare, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { usePermissao } from '../lib/permissoes'
import { cn } from '../lib/utils'

export function Layout({ children }: { children: ReactNode }) {
  const { signOut, usuario } = useAuth()
  const { isAdmin } = usePermissao()

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-2 px-3 py-2 rounded text-[#ffffff] text-sm',
      isActive ? 'bg-[#ffffff26]' : 'hover:bg-[#ffffff14]'
    )

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-[#ffffff1a] p-3 flex md:flex-col gap-1">
        <div className="text-[#ffffff] font-bold px-3 py-2 hidden md:block">GR7 Atendimento</div>
        <NavLink to="/inbox" className={linkCls}>
          <MessageSquare size={18} /> Atendimento
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" className={linkCls}>
            <Settings size={18} /> Admin
          </NavLink>
        )}
        <button
          onClick={() => signOut()}
          className="mt-auto flex items-center gap-2 px-3 py-2 rounded text-[#ffffff] text-sm hover:bg-[#ffffff14]"
        >
          <LogOut size={18} /> Sair {usuario?.nome ? `(${usuario.nome})` : ''}
        </button>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
