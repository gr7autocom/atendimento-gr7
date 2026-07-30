import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/**
 * Lista de regras em tópicos, no imperativo. Fica aqui e é reusada pelo
 * `PainelAba` porque a mesma marcação estava escrita duas vezes, com espaçamento
 * diferente em cada uma.
 */
export function Topicos({ itens, className }: { itens: string[]; className?: string }) {
  if (itens.length === 0) return null
  return (
    <ul className={cn('flex flex-col gap-0.5', className)}>
      {itens.map((t, i) => (
        <li key={i} className="text-apoio text-tx-2 flex gap-1.5">
          <span className="text-tx-3 select-none" aria-hidden="true">
            ·
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Bloco de seção das telas de detalhe (departamento, atendente).
 * `descricao` para uma linha; `topicos` para uma lista de regras (bullets).
 */
export function Bloco({
  titulo,
  descricao,
  topicos,
  children,
}: {
  titulo: string
  descricao?: string
  topicos?: string[]
  children: ReactNode
}) {
  return (
    <section className="rounded-2 border border-bd-1 bg-sf-1">
      <div className="px-4 py-3 border-b border-bd-1">
        <h2 className="text-corpo-lg font-semibold text-tx-1">{titulo}</h2>
        {descricao && <p className="text-apoio text-tx-2 mt-0.5">{descricao}</p>}
        {topicos && <Topicos itens={topicos} className="mt-1" />}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}
