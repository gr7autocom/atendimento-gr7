import type { ReactNode } from 'react'
import { Botao } from './Botao'

/** Vazio: diz o que é, por que está vazio e como começar. */
export function Vazio({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone?: ReactNode
  titulo: string
  descricao?: string
  acao?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-10 px-4">
      {icone && <div className="text-tx-3">{icone}</div>}
      <p className="text-corpo-lg text-tx-1">{titulo}</p>
      {descricao && <p className="text-corpo text-tx-2 max-w-xs">{descricao}</p>}
      {acao && <div className="mt-1">{acao}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-1 bg-sf-2 ${className}`} />
}

/**
 * Linhas de esqueleto para listas e tabelas. O `aria-busy` com rótulo diz
 * "Carregando" a quem usa leitor de tela: o esqueleto é pista visual e, sem
 * isso, o carregamento passava em silêncio.
 */
export function LinhasCarregando({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="flex flex-col gap-2 p-3" role="status" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} className="h-9" />
      ))}
    </div>
  )
}

export function Erro({ mensagem, onTentar }: { mensagem: string; onTentar?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 px-4 text-center" role="alert">
      <p className="text-corpo-lg text-err">{mensagem}</p>
      {onTentar && (
        <Botao variante="neutro" tamanho="sm" onClick={onTentar}>
          Tentar de novo
        </Botao>
      )}
    </div>
  )
}
