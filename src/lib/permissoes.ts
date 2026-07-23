import { useAuth } from './auth'
import type { AcaoId } from './acoes'

export function usePermissao() {
  const { usuario } = useAuth()
  const slug = usuario?.permissao?.slug ?? null
  const capacidades = (usuario?.permissao?.capacidades ?? []) as AcaoId[]

  function can(acao: AcaoId): boolean {
    return capacidades.includes(acao)
  }
  return { slug, isAdmin: slug === 'admin', can }
}
