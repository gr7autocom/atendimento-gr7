import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { temAcessoAgora, type Faixa } from './horario'
import type { UsuarioAutenticado } from './types'

type Status = 'loading' | 'authenticated' | 'unauthenticated' | 'unauthorized'

type AuthContextValue = {
  status: Status
  usuario: UsuarioAutenticado | null
  unauthorizedReason: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  recarregar: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const SELECT_USUARIO = '*, permissao:permissoes(id, nome, slug, cor, capacidades)'

async function resolverUsuario(
  session: Session
): Promise<{ kind: 'ok'; usuario: UsuarioAutenticado } | { kind: 'error'; reason: string }> {
  const { data } = await supabase
    .from('usuarios')
    .select(SELECT_USUARIO)
    .eq('auth_user_id', session.user.id)
    .maybeSingle()
  if (!data) {
    return { kind: 'error', reason: 'Este e-mail não tem acesso ao Atendimento. Fale com o administrador.' }
  }
  const u = data as unknown as UsuarioAutenticado
  if (!u.ativo || u.status === 'inativo') {
    return { kind: 'error', reason: 'Sua conta está desativada. Fale com o administrador.' }
  }

  // Trava de horário: admin sempre acessa. Atendente só dentro do horário
  // comercial ou de uma janela pessoal de plantão. Se o comercial nem foi
  // configurado ainda, não trava (evita bloquear o time sem querer).
  const isAdmin = u.permissao?.slug === 'admin'
  if (!isAdmin) {
    const [comercialRes, janelasRes] = await Promise.all([
      supabase.from('atendimento_horarios').select('dia_semana, hora_inicio, hora_fim, ativo').eq('ativo', true),
      supabase.from('atendimento_usuario_horarios').select('dia_semana, hora_inicio, hora_fim').eq('usuario_id', u.id),
    ])
    const comercial = (comercialRes.data ?? []) as Faixa[]
    const janelas = (janelasRes.data ?? []) as Faixa[]
    if (comercial.length > 0 && !temAcessoAgora({ isAdmin: false, comercial, janelas })) {
      return {
        kind: 'error',
        reason:
          'Acesso liberado no horário comercial ou no seu plantão. Fale com o administrador se precisar entrar agora.',
      }
    }
  }
  return { kind: 'ok', usuario: u }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null)
  const [unauthorizedReason, setUnauthorizedReason] = useState<string | null>(null)
  const callIdRef = useRef(0)

  async function processarSession(session: Session | null) {
    const callId = ++callIdRef.current
    if (!session) {
      if (callId !== callIdRef.current) return
      setUsuario(null)
      setUnauthorizedReason(null)
      setStatus('unauthenticated')
      return
    }
    const res = await resolverUsuario(session)
    if (callId !== callIdRef.current) return
    if (res.kind === 'ok') {
      setUsuario(res.usuario)
      setUnauthorizedReason(null)
      setStatus('authenticated')
    } else {
      setUsuario(null)
      setUnauthorizedReason(res.reason)
      setStatus('unauthorized')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => processarSession(data.session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      processarSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return { error: error?.message ?? null }
  }
  async function signOut() {
    await supabase.auth.signOut()
  }
  async function recarregar() {
    const { data } = await supabase.auth.getSession()
    await processarSession(data.session)
  }

  return (
    <AuthContext.Provider value={{ status, usuario, unauthorizedReason, signIn, signOut, recarregar }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}

export function useUsuarioAtual(): UsuarioAutenticado | null {
  return useAuth().usuario
}
