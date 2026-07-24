import type { ReactNode } from 'react'
import { BarraTopo } from './BarraTopo'

/** Casca da tela de atendimento: barra do topo e a área de trabalho ocupando o resto. */
export function LayoutAtendimento({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-sf-0">
      <BarraTopo titulo="GR7 Atendimento" />
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  )
}
