import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Pencil } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { useVinculos, useUsuarios } from '../../lib/useVinculos'
import { Avatar } from '../../components/ui/Avatar'
import { Selo } from '../../components/ui/Selo'
import { Entrada, Selecao } from '../../components/ui/Campo'
import { Vazio, Skeleton } from '../../components/ui/Estados'
import { CabecalhoAdmin } from '../../components/admin/CabecalhoAdmin'

type Departamento = { id: string; nome: string; ativo?: boolean }
type Status = 'ativos' | 'inativos' | 'todos'

export function Usuarios() {
  const navigate = useNavigate()
  const usuarios = useUsuarios(true)
  const departamentos = useCrud<Departamento>('departamentos', 'ordem')
  const vinculos = useVinculos('atendente_departamentos', 'usuario_id', 'departamento_id')

  const [nome, setNome] = useState('')
  const [deptFiltro, setDeptFiltro] = useState('')
  const [status, setStatus] = useState<Status>('ativos')

  const deps = departamentos.lista.data ?? []
  const nomeDep = (id: string) => deps.find((d) => d.id === id)?.nome ?? ''
  const deptosDe = (usuarioId: string) =>
    (vinculos.lista.data ?? []).filter((v) => v.usuario_id === usuarioId).map((v) => v.departamento_id)

  const filtrados = useMemo(() => {
    const termo = nome.trim().toLowerCase()
    return (usuarios.data ?? []).filter((u) => {
      if (status === 'ativos' && !u.ativo) return false
      if (status === 'inativos' && u.ativo) return false
      if (deptFiltro && !deptosDe(u.id).includes(deptFiltro)) return false
      if (termo && !`${u.nome} ${u.email}`.toLowerCase().includes(termo)) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarios.data, vinculos.lista.data, nome, deptFiltro, status])

  return (
    <div className="w-full">
      <CabecalhoAdmin
        titulo="Atendentes"
        descricao="Atendentes vêm do painel. Clique em um para definir os departamentos que ele atende e o plantão."
      />

      <div className="rounded-2 border border-bd-1 bg-sf-1 p-3 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Entrada
          rotulo="Nome"
          placeholder="Buscar por nome ou e-mail"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <Selecao rotulo="Departamento" value={deptFiltro} onChange={(e) => setDeptFiltro(e.target.value)}>
          <option value="">Todos</option>
          {deps.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </Selecao>
      </div>

      {usuarios.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2 border border-bd-1 bg-sf-1">
          <Vazio
            icone={<Users size={22} />}
            titulo="Nenhum atendente"
            descricao="Ajuste os filtros de nome, departamento ou status."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtrados.map((u) => {
            const setores = deptosDe(u.id)
            return (
              <div
                key={u.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/admin/usuarios/${u.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/admin/usuarios/${u.id}`)
                  }
                }}
                aria-label={`Configurar ${u.nome}`}
                className="group flex flex-col text-left cursor-pointer rounded-2 border border-bd-1 bg-sf-1 p-3.5 transicao hover:border-bd-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    <Avatar nome={u.nome} fotoUrl={u.foto_url} tamanho={40} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-corpo-lg font-medium text-tx-1 truncate" title={u.nome}>
                      {u.nome}
                    </p>
                    <p className="text-apoio text-tx-3 truncate" title={u.email}>
                      {u.email}
                    </p>
                  </div>
                  <Selo tom={u.ativo ? 'ok' : 'neutro'}>{u.ativo ? 'Ativo' : 'Inativo'}</Selo>
                </div>

                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-bd-1">
                  <div className="flex flex-wrap items-center gap-1 min-w-0">
                    {setores.length === 0 ? (
                      <span className="text-apoio text-tx-3">Sem departamento</span>
                    ) : (
                      setores.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center h-5 px-1.5 rounded-micro bg-sf-2 border border-bd-2 text-micro font-medium uppercase tracking-wide text-tx-2 truncate max-w-full"
                        >
                          {nomeDep(id)}
                        </span>
                      ))
                    )}
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 text-apoio text-tx-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <Pencil size={14} /> Configurar
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
