import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function AdminModal({
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-md rounded-lg bg-[#1e1e1e] border border-[#ffffff1a] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#ffffff] font-bold">{titulo}</h2>
          <button onClick={onFechar} aria-label="Fechar" className="text-[#ffffffb3] hover:text-[#ffffff]">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
