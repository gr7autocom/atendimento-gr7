import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './lib/auth'
import { usePermissao } from './lib/permissoes'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LayoutAtendimento } from './components/LayoutAtendimento'
import { LayoutAdmin } from './components/LayoutAdmin'
import { Login } from './pages/Login'
import { Inbox } from './pages/Inbox'
import { Admin } from './pages/Admin'

const queryClient = new QueryClient()

/** Depois do login, cada papel cai no seu ambiente: admin no painel, suporte no atendimento. */
function InicioPorPapel() {
  const { isAdmin } = usePermissao()
  return <Navigate to={isAdmin ? '/admin' : '/inbox'} replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <InicioPorPapel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inbox"
              element={
                <ProtectedRoute>
                  <LayoutAtendimento>
                    <Inbox />
                  </LayoutAtendimento>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute requireAdmin>
                  <LayoutAdmin>
                    <Admin />
                  </LayoutAdmin>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
