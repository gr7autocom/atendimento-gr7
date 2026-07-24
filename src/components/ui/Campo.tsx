import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

const BASE =
  'w-full rounded-[6px] bg-sf-2 border border-bd-2 text-tx-1 placeholder:text-tx-3 ' +
  'transition-colors duration-[120ms] hover:border-bd-3 focus:border-br-1 focus:outline-none ' +
  'focus:ring-2 focus:ring-[color:var(--br-soft)]'

function Envolucro({
  rotulo,
  dica,
  erro,
  children,
}: {
  rotulo?: string
  dica?: string
  erro?: string | null
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      {rotulo && <span className="text-[13px] text-tx-2">{rotulo}</span>}
      {children}
      {erro ? (
        <span className="text-[12px] text-err">{erro}</span>
      ) : dica ? (
        <span className="text-[12px] text-tx-3">{dica}</span>
      ) : null}
    </label>
  )
}

export function Entrada({
  rotulo,
  dica,
  erro,
  className,
  ...props
}: { rotulo?: string; dica?: string; erro?: string | null } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Envolucro rotulo={rotulo} dica={dica} erro={erro}>
      <input {...props} className={cn(BASE, 'h-9 px-3 text-sm', erro && 'border-err', className)} />
    </Envolucro>
  )
}

export function AreaTexto({
  rotulo,
  dica,
  erro,
  className,
  ...props
}: { rotulo?: string; dica?: string; erro?: string | null } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Envolucro rotulo={rotulo} dica={dica} erro={erro}>
      <textarea {...props} className={cn(BASE, 'px-3 py-2 text-sm min-h-20 resize-y', className)} />
    </Envolucro>
  )
}

export function Selecao({
  rotulo,
  dica,
  erro,
  className,
  children,
  ...props
}: { rotulo?: string; dica?: string; erro?: string | null } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Envolucro rotulo={rotulo} dica={dica} erro={erro}>
      <select {...props} className={cn(BASE, 'h-9 px-2.5 text-sm', className)}>
        {children}
      </select>
    </Envolucro>
  )
}
