export type Permissao = {
  id: string
  nome: string
  slug: string | null
  cor: string | null
  capacidades: string[] | null
}

export type Usuario = {
  id: string
  auth_user_id: string | null
  nome: string
  email: string
  foto_url: string | null
  ativo: boolean
  status: 'ativo' | 'pendente' | 'inativo' | null
}

export type UsuarioAutenticado = Usuario & {
  permissao: Pick<Permissao, 'id' | 'nome' | 'slug' | 'cor' | 'capacidades'> | null
}
