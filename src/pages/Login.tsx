import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Marca } from '../components/ui/Marca'
import { useAuth } from '../lib/auth'
import { Botao } from '../components/ui/Botao'
import { Entrada } from '../components/ui/Campo'

export function Login() {
  const { signIn, status, unauthorizedReason } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // O redirecionamento espera o perfil resolver. Navegar direto após o signIn
  // corria contra a resolução assíncrona do usuário e a rota protegida rebatia
  // de volta para cá, prendendo quem já estava autenticado.
  useEffect(() => {
    if (status === 'authenticated') navigate('/', { replace: true })
  }, [status, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    const { error } = await signIn(email, senha)
    setEnviando(false)
    if (error) setErro('Não foi possível entrar. Confira e-mail e senha.')
  }

  // Conta válida no login, mas sem perfil ativo no sistema: explica em vez de sumir.
  const mensagemErro = erro ?? (status === 'unauthorized' ? unauthorizedReason : null)

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-sf-0">
      <div className="w-full max-w-[360px]">
        <div className="flex flex-col items-center gap-1 mb-6">
          <Marca tamanho="lg" />
          {/*
            Dizia "Central de WhatsApp da equipe". Desde o canal web o chamado
            também chega pelo site, então nomear um canal aqui virou informação
            errada (ver docs/design.md, texto que assume um canal).
          */}
          <div className="text-apoio text-tx-3">Central de atendimento da equipe</div>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-2 border border-bd-1 bg-sf-1 p-4"
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
            erro={mensagemErro}
            required
          />
          <Botao variante="primario" type="submit" disabled={enviando} className="w-full">
            {enviando ? 'Entrando…' : 'Entrar'}
          </Botao>
        </form>

        <p className="text-apoio text-tx-3 mt-4 text-center">
          Use a mesma conta do Painel de Implantação.
        </p>
      </div>
    </div>
  )
}
