import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Botao } from './Botao'

/** Mesma API do antigo AdminModal, para trocar sem refatorar as telas. */
export function Modal({
  titulo,
  aberto,
  onFechar,
  children,
}: {
  titulo: string
  aberto: boolean
  onFechar: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto, onFechar])

  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[10px] bg-sf-3 border border-bd-2 shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-bd-1">
          <h2 className="text-sm font-semibold text-tx-1">{titulo}</h2>
          <Botao variante="fantasma" tamanho="sm" onClick={onFechar} aria-label="Fechar">
            <X size={16} />
          </Botao>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
