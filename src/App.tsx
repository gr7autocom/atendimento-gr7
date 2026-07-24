import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './lib/auth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { Login } from './pages/Login'
import { Inbox } from './pages/Inbox'
import { Admin } from './pages/Admin'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/inbox"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Inbox />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute requireAdmin>
                  <AppShell>
                    <Admin />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            {/* Todos os papéis começam no atendimento; o admin acessa o resto pelo menu. */}
            <Route path="*" element={<Navigate to="/inbox" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
