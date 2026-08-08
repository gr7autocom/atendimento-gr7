import type { ReactNode } from 'react'
import { BarraTopo } from './BarraTopo'
import { SidebarRecolhida } from './SidebarRecolhida'

/** Casca única do app: barra do topo, sidebar recolhido e o conteúdo da rota. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-sf-0">
      <BarraTopo />
      <div className="flex-1 min-h-0 relative flex">
        <SidebarRecolhida />
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
