import type { ReactNode } from 'react'

/**
 * Cabeçalho padrão das telas de admin: título + subtexto à esquerda, ações à
 * direita. No mobile empilha (título e subtexto ocupam a largura toda e as
 * ações vão para baixo, sem espremer o texto); no desktop fica lado a lado.
 * O subtexto tem largura de leitura limitada para não esticar em telas largas.
 */
export function CabecalhoAdmin({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string
  descricao?: string
  acoes?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {/* h1: é o título da tela. Em h2 as telas de admin abriam sem h1 nenhum,
            e quem navega por títulos não achava o começo do conteúdo. */}
        <h1 className="text-titulo font-semibold text-tx-1">{titulo}</h1>
        {descricao && <p className="text-corpo text-tx-2 mt-0.5 max-w-2xl">{descricao}</p>}
      </div>
      {acoes && <div className="flex items-center gap-2 shrink-0">{acoes}</div>}
    </div>
  )
}
