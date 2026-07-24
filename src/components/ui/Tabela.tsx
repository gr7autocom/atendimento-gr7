import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** Casca de tabela densa: cabeçalho discreto, linhas compactas, hover sutil. */
export function Tabela({ cabecalho, children }: { cabecalho: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-bd-1 bg-sf-1">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left">{cabecalho}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'h-9 px-3 text-[12px] font-medium text-tx-3 border-b border-bd-1 whitespace-nowrap',
        className
      )}
    >
      {children}
    </th>
  )
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="border-b border-bd-1 last:border-0 hover:bg-sf-2 transition-colors duration-[120ms]">{children}</tr>
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('h-10 px-3 text-tx-1 align-middle', className)}>{children}</td>
}
