import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

type Variante = 'primario' | 'neutro' | 'perigo' | 'fantasma'
type Tamanho = 'sm' | 'md'

const VARIANTES: Record<Variante, string> = {
  // O hover ESCURECE (br-3) em vez de clarear. Com br-2 o branco caía para
  // 2.79:1, ou seja, o botão principal ficava ilegível justo na hora do clique.
  primario: 'bg-br-1 text-white hover:bg-br-3 active:bg-br-4 border border-transparent',
  neutro: 'bg-sf-2 text-tx-1 hover:bg-sf-3 border border-bd-2',
  perigo: 'bg-transparent text-err hover:bg-err-soft border border-transparent',
  fantasma: 'bg-transparent text-tx-2 hover:text-tx-1 hover:bg-sf-2 border border-transparent',
}

const TAMANHOS: Record<Tamanho, string> = {
  sm: 'h-7 px-2.5 text-corpo gap-1.5',
  md: 'h-9 px-3.5 text-corpo-lg gap-2',
}

/**
 * `carregando` trava o botão enquanto a ação está no ar e troca o ícone por um
 * giro. Sem isso, ação lenta aceitava clique duplo (o Enviar da conversa mandava
 * a mensagem duas vezes) e nada dizia ao usuário que já estava em curso.
 * `aria-busy` conta a mesma coisa para o leitor de tela.
 */
export function Botao({
  variante = 'neutro',
  tamanho = 'md',
  icone,
  carregando = false,
  children,
  className,
  disabled,
  ...props
}: {
  variante?: Variante
  tamanho?: Tamanho
  icone?: ReactNode
  carregando?: boolean
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-1 font-medium whitespace-nowrap',
        'transicao',
        'disabled:opacity-45 disabled:pointer-events-none',
        VARIANTES[variante],
        TAMANHOS[tamanho],
        className
      )}
    >
      {carregando ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : icone}
      {children}
    </button>
  )
}
