import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    const { error } = await signIn(email, senha)
    setEnviando(false)
    if (error) {
      setErro('Não foi possível entrar. Confira e-mail e senha.')
      return
    }
    navigate('/inbox', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm flex flex-col gap-3">
        <h1 className="text-[#ffffff] text-xl font-bold">GR7 Atendimento</h1>
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded px-3 py-2 bg-[#ffffff1a] text-[#ffffff]"
          required
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="rounded px-3 py-2 bg-[#ffffff1a] text-[#ffffff]"
          required
        />
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <button
          type="submit"
          disabled={enviando}
          className="rounded px-3 py-2 bg-[#0078d4] text-[#ffffff] font-medium disabled:opacity-60"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
