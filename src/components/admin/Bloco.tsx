import type { ReactNode } from 'react'

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
    <section className="rounded-[10px] border border-bd-1 bg-sf-1">
      <div className="px-4 py-3 border-b border-bd-1">
        <h2 className="text-[14px] font-semibold text-tx-1">{titulo}</h2>
        {descricao && <p className="text-[12px] text-tx-2 mt-0.5">{descricao}</p>}
        {topicos && topicos.length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5">
            {topicos.map((t, i) => (
              <li key={i} className="text-[12px] text-tx-2 flex gap-1.5">
                <span className="text-tx-3 select-none">·</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}
