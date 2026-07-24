import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Login } from './Login'
import { AuthProvider } from '../lib/auth'

describe('Login', () => {
  it('mostra os campos de e-mail e senha e o botão Entrar', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    )
    // busca por rótulo (e não placeholder): é o que o usuário lê e o que o
    // leitor de tela anuncia
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })
})
