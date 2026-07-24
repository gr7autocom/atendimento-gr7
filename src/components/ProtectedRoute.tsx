import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { usePermissao } from '../lib/permissoes'

export function ProtectedRoute({ children, requireAdmin = false }: { children: ReactNode; requireAdmin?: boolean }) {
  const { status } = useAuth()
  const { isAdmin } = usePermissao()

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sf-0">
        <span className="text-[13px] text-tx-2">Carregando…</span>
      </div>
    )
  }
  if (status !== 'authenticated') return <Navigate to="/login" replace />
  if (requireAdmin && !isAdmin) return <Navigate to="/inbox" replace />
  return <>{children}</>
}
