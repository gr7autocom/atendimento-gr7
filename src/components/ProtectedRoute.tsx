import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { usePermissao } from '../lib/permissoes'

export function ProtectedRoute({ children, requireAdmin = false }: { children: ReactNode; requireAdmin?: boolean }) {
  const { status } = useAuth()
  const { isAdmin } = usePermissao()

  if (status === 'loading') return <div className="p-6 text-[#ffffff]">Carregando…</div>
  if (status !== 'authenticated') return <Navigate to="/login" replace />
  if (requireAdmin && !isAdmin) return <Navigate to="/inbox" replace />
  return <>{children}</>
}
