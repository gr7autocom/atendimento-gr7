import { useCrud } from '../../lib/useCrud'
import { useVinculos, useUsuarios } from '../../lib/useVinculos'

type Departamento = { id: string; nome: string; ativo: boolean }

export function Usuarios() {
  const usuarios = useUsuarios()
  const departamentos = useCrud<Departamento>('departamentos')
  const vinculos = useVinculos('atendente_departamentos', 'usuario_id', 'departamento_id')

  const deptosDe = (usuarioId: string) =>
    (vinculos.lista.data ?? []).filter((v) => v.usuario_id === usuarioId).map((v) => v.departamento_id)

  return (
    <div className="max-w-3xl">
      <h2 className="text-[#ffffff] font-bold text-lg mb-1">Usuários</h2>
      <p className="text-[#ffffffb3] text-sm mb-4">
        A lista vem do painel. Marque os departamentos que cada atendente atende: é isso que define quais filas ele
        enxerga.
      </p>

      {usuarios.isLoading ? (
        <p className="text-[#ffffffb3]">Carregando…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {(usuarios.data ?? []).map((u) => {
            const marcados = deptosDe(u.id)
            return (
              <div key={u.id} className="rounded border border-[#ffffff1a] p-3">
                <div className="text-[#ffffff] mb-2">
                  {u.nome} <span className="text-[#ffffffb3] text-sm">{u.email}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {(departamentos.lista.data ?? []).map((d) => {
                    const marcado = marcados.includes(d.id)
                    return (
                      <label key={d.id} className="text-sm text-[#ffffffb3] flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() =>
                            marcado
                              ? vinculos.desvincular.mutate({ usuario_id: u.id, departamento_id: d.id })
                              : vinculos.vincular.mutate({ usuario_id: u.id, departamento_id: d.id })
                          }
                        />
                        {d.nome}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
