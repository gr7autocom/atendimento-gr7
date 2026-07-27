import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export type AbaItem<T extends string> = { id: T; label: string; icone: LucideIcon }

/**
 * Navegação por abas das telas de admin (Configurações do bot, Departamento,
 * Atendente). Visual único do projeto: pílula ativa na cor da marca, hover suave
 * nas inativas. Genérico sobre o id da aba.
 */
export function Abas<T extends string>({
  abas,
  ativo,
  aoSelecionar,
}: {
  abas: readonly AbaItem<T>[]
  ativo: T
  aoSelecionar: (id: T) => void
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1">
      {abas.map((a) => {
        const Icone = a.icone
        const on = ativo === a.id
        return (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => aoSelecionar(a.id)}
            className={cn(
              'flex items-center gap-2 h-9 px-3.5 rounded-[8px] text-[13px] font-medium transition-colors duration-[120ms]',
              on ? 'bg-br-1 text-white' : 'text-tx-2 hover:text-tx-1 hover:bg-sf-2'
            )}
          >
            <Icone size={15} />
            {a.label}
          </button>
        )
      })}
    </div>
  )
}

/** Painel de conteúdo de uma aba: card padrão + orientação opcional em tópicos. */
export function PainelAba({
  topicos,
  children,
}: {
  topicos?: string[]
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[10px] border border-bd-1 bg-sf-1 p-5">
      {topicos && topicos.length > 0 && (
        <ul className="flex flex-col gap-0.5 mb-4">
          {topicos.map((t, i) => (
            <li key={i} className="text-[12px] text-tx-2 flex gap-1.5">
              <span className="text-tx-3 select-none">·</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
      {children}
    </div>
  )
}
