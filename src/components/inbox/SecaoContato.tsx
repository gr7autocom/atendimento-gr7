import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Seção colapsável do painel do contato (padrão Zintech: lista de categorias
 * com dropdown). Cada seção do painel usa este componente. `contagem` mostra
 * um número entre parênteses no título (ex.: "Arquivos (146)").
 */
export function SecaoContato({
  titulo,
  contagem,
  inicialAberta = false,
  children,
}: {
  titulo: string
  contagem?: number
  inicialAberta?: boolean
  children: ReactNode
}) {
  const [aberta, setAberta] = useState(inicialAberta)
  return (
    <div className="border-b border-bd-1">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="w-full flex items-center justify-between gap-2 px-5 py-3.5 text-left text-corpo font-medium text-tx-1 hover:bg-sf-2 transicao"
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          {titulo}
          {contagem != null && <span className="text-tx-3 font-normal">({contagem})</span>}
        </span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-tx-3 transition-transform duration-200', aberta && 'rotate-180')}
        />
      </button>
      {aberta && <div className="px-5 pb-4">{children}</div>}
    </div>
  )
}
