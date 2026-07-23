import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { AuthProvider } from '../lib/auth'

describe('ProtectedRoute', () => {
  it('redireciona para /login quando não autenticado', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/protegida']}>
          <Routes>
            <Route path="/login" element={<div>tela de login</div>} />
            <Route
              path="/protegida"
              element={
                <ProtectedRoute>
                  <div>conteudo secreto</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    )
    expect(await screen.findByText('tela de login')).toBeInTheDocument()
  })
})
