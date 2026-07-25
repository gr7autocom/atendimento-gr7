import { NavLink } from 'react-router-dom'
import { MessagesSquare, Network, Tag, Zap, Bot, QrCode, Clock, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { usePermissao } from '../lib/permissoes'
import { cn } from '../lib/utils'

export type ItemNav = { to: string; label: string; icone: LucideIcon; adminOnly: boolean }

export const ITENS_NAV: ItemNav[] = [
  { to: '/inbox', label: 'Atendimentos', icone: MessagesSquare, adminOnly: false },
  { to: '/admin/departamentos', label: 'Departamentos', icone: Network, adminOnly: true },
  { to: '/admin/tags', label: 'Tags', icone: Tag, adminOnly: true },
  { to: '/admin/mensagens-rapidas', label: 'Mensagens rápidas', icone: Zap, adminOnly: true },
  { to: '/admin/bot', label: 'Configurações BOT', icone: Bot, adminOnly: true },
  { to: '/admin/conexao', label: 'Conexão', icone: QrCode, adminOnly: true },
  { to: '/admin/horario', label: 'Horário de Funcionamento', icone: Clock, adminOnly: true },
  { to: '/admin/usuarios', label: 'Usuários', icone: Users, adminOnly: true },
]

/**
 * Barra estreita de ícones; ao passar o mouse ela expande e mostra os nomes,
 * sobrepondo o conteúdo (o espaçador mantém o layout no lugar). Itens de
 * administração só aparecem para o admin.
 */
export function SidebarRecolhida() {
  const { isAdmin } = usePermissao()
  const itens = ITENS_NAV.filter((i) => !i.adminOnly || isAdmin)

  return (
    <>
      {/* No mobile o sidebar some; a navegação vai para o menu do avatar (BarraTopo). */}
      <nav
        className="group absolute inset-y-0 left-0 z-20 w-[52px] hover:w-[216px] bg-sf-1 border-r border-bd-1 overflow-hidden transition-[width] duration-150 hidden lg:flex flex-col py-2 gap-0.5"
        aria-label="Navegação"
      >
        {itens.map((i) => {
          const Icone = i.icone
          return (
            <NavLink
              key={i.to}
              to={i.to}
              title={i.label}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center h-10 mx-1.5 rounded-[6px] transition-colors duration-[120ms]',
                  isActive ? 'bg-sf-2 text-tx-1 font-medium' : 'text-tx-2 hover:text-tx-1 hover:bg-sf-2'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute left-0 top-2 bottom-2 w-[2px] rounded-full transition-opacity',
                      isActive ? 'bg-br-1 opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="w-[40px] flex items-center justify-center shrink-0">
                    <Icone size={18} />
                  </span>
                  <span className="text-[13px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    {i.label}
                  </span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
      {/* espaçador: mantém o conteúdo alinhado enquanto a barra sobrepõe no hover (só desktop) */}
      <div className="w-[52px] shrink-0 hidden lg:block" aria-hidden="true" />
    </>
  )
}
