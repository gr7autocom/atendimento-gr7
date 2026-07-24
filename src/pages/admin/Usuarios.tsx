import { useCrud } from '../../lib/useCrud'
import { useVinculos, useUsuarios } from '../../lib/useVinculos'
import { LinhasCarregando } from '../../components/ui/Estados'
import { cn } from '../../lib/utils'

type Departamento = { id: string; nome: string; ativo: boolean }

export function Usuarios() {
  const usuarios = useUsuarios()
  const departamentos = useCrud<Departamento>('departamentos')
  const vinculos = useVinculos('atendente_departamentos', 'usuario_id', 'departamento_id')

  const deptosDe = (usuarioId: string) =>
    (vinculos.lista.data ?? []).filter((v) => v.usuario_id === usuarioId).map((v) => v.departamento_id)

  return (
    <div className="max-w-3xl">
      <h2 className="text-[15px] font-semibold text-tx-1">Usuários</h2>
      <p className="text-[13px] text-tx-2 mt-0.5 mb-4">
        A lista vem do painel. Marque os departamentos que cada atendente atende: é isso que define quais filas ele
        enxerga.
      </p>

      {usuarios.isLoading ? (
        <LinhasCarregando linhas={5} />
      ) : (
        <div className="flex flex-col gap-2">
          {(usuarios.data ?? []).map((u) => {
            const marcados = deptosDe(u.id)
            return (
              <div key={u.id} className="rounded-[10px] border border-bd-1 bg-sf-1 p-3">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-[13px] font-medium text-tx-1">{u.nome}</span>
                  <span className="text-[12px] text-tx-3 truncate">{u.email}</span>
                  {marcados.length > 0 && (
                    <span className="text-[11px] text-tx-3 ml-auto shrink-0">
                      {marcados.length} {marcados.length === 1 ? 'setor' : 'setores'}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(departamentos.lista.data ?? []).map((d) => {
                    const marcado = marcados.includes(d.id)
                    return (
                      <button
                        key={d.id}
                        onClick={() =>
                          marcado
                            ? vinculos.desvincular.mutate({ usuario_id: u.id, departamento_id: d.id })
                            : vinculos.vincular.mutate({ usuario_id: u.id, departamento_id: d.id })
                        }
                        aria-pressed={marcado}
                        className={cn(
                          'h-7 px-2.5 rounded-[6px] text-[12px] border transition-colors duration-[120ms]',
                          marcado
                            ? 'bg-br-soft text-br-2 border-transparent font-medium'
                            : 'bg-sf-2 text-tx-2 border-bd-2 hover:text-tx-1 hover:border-bd-3'
                        )}
                      >
                        {d.nome}
                      </button>
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
