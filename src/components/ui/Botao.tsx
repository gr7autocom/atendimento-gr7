import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Variante = 'primario' | 'neutro' | 'perigo' | 'fantasma'
type Tamanho = 'sm' | 'md'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-br-1 text-white hover:bg-br-2 active:bg-br-3 border border-transparent',
  neutro: 'bg-sf-2 text-tx-1 hover:bg-sf-3 border border-bd-2',
  perigo: 'bg-transparent text-err hover:bg-err-soft border border-transparent',
  fantasma: 'bg-transparent text-tx-2 hover:text-tx-1 hover:bg-sf-2 border border-transparent',
}

const TAMANHOS: Record<Tamanho, string> = {
  sm: 'h-7 px-2.5 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
}

export function Botao({
  variante = 'neutro',
  tamanho = 'md',
  icone,
  children,
  className,
  ...props
}: {
  variante?: Variante
  tamanho?: Tamanho
  icone?: ReactNode
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center rounded-[6px] font-medium whitespace-nowrap',
        'transition-colors duration-[120ms]',
        'disabled:opacity-45 disabled:pointer-events-none',
        VARIANTES[variante],
        TAMANHOS[tamanho],
        className
      )}
    >
      {icone}
      {children}
    </button>
  )
}
