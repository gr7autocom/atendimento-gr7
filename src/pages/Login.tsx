import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessagesSquare } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Botao } from '../components/ui/Botao'
import { Entrada } from '../components/ui/Campo'

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-sf-0">
      <div className="w-full max-w-[360px]">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-[8px] bg-br-1 flex items-center justify-center">
            <MessagesSquare size={18} className="text-white" />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-tx-1 leading-tight">GR7 Atendimento</div>
            <div className="text-[12px] text-tx-3 leading-tight">Central de WhatsApp da equipe</div>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-[10px] border border-bd-1 bg-sf-1 p-5"
        >
          <Entrada
            rotulo="E-mail"
            type="email"
            placeholder="voce@gr7autocom.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Entrada
            rotulo="Senha"
            type="password"
            placeholder="Sua senha do painel"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            erro={erro}
            required
          />
          <Botao variante="primario" type="submit" disabled={enviando} className="w-full">
            {enviando ? 'Entrando…' : 'Entrar'}
          </Botao>
        </form>

        <p className="text-[12px] text-tx-3 mt-4 text-center">
          Use a mesma conta do Painel de Implantação.
        </p>
      </div>
    </div>
  )
}
