import type { ReactNode } from 'react'
import { BarraTopo } from './BarraTopo'

/** Casca do painel administrativo, dedicada ao admin e separada do atendimento. */
export function LayoutAdmin({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-sf-0">
      <BarraTopo titulo="GR7 Administração" />
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  )
}
