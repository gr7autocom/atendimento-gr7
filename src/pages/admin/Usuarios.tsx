import { useMemo, useState } from 'react'
import { Pencil, Users, X, Plus } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { useVinculos, useUsuarios, type UsuarioLista } from '../../lib/useVinculos'
import { useHorariosAcesso } from '../../lib/useHorariosAcesso'
import { Avatar } from '../../components/ui/Avatar'
import { Selo } from '../../components/ui/Selo'
import { Botao } from '../../components/ui/Botao'
import { Entrada, Selecao, CampoHora } from '../../components/ui/Campo'
import { Modal } from '../../components/ui/Modal'
import { Vazio, Skeleton } from '../../components/ui/Estados'
import { CabecalhoAdmin } from '../../components/admin/CabecalhoAdmin'
import { cn } from '../../lib/utils'

type Departamento = { id: string; nome: string; ativo?: boolean }
type Status = 'ativos' | 'inativos' | 'todos'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export function Usuarios() {
  const usuarios = useUsuarios(true)
  const departamentos = useCrud<Departamento>('departamentos', 'ordem')
  const vinculos = useVinculos('atendente_departamentos', 'usuario_id', 'departamento_id')
  const horarios = useHorariosAcesso()

  const [nome, setNome] = useState('')
  const [deptFiltro, setDeptFiltro] = useState('')
  const [status, setStatus] = useState<Status>('ativos')
  const [editando, setEditando] = useState<UsuarioLista | null>(null)

  const deps = departamentos.lista.data ?? []
  const nomeDep = (id: string) => deps.find((d) => d.id === id)?.nome ?? ''
  const deptosDe = (usuarioId: string) =>
    (vinculos.lista.data ?? []).filter((v) => v.usuario_id === usuarioId).map((v) => v.departamento_id)
  const faixasDe = (usuarioId: string, dia: number) =>
    (horarios.lista.data ?? [])
      .filter((f) => f.usuario_id === usuarioId && f.dia_semana === dia)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))

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
        descricao="A lista vem do painel. Defina os departamentos que cada atendente atende: é isso que decide quais filas ele enxerga. A foto é a mesma do painel."
      />

      <div className="rounded-[10px] border border-bd-1 bg-sf-1 p-3 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-[10px] border border-bd-1 bg-sf-1">
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
                className="relative flex flex-col items-center text-center rounded-[10px] border border-bd-1 bg-sf-1 p-4"
              >
                <button
                  type="button"
                  onClick={() => setEditando(u)}
                  aria-label={`Editar ${u.nome}`}
                  title="Editar departamentos"
                  className="absolute top-2 right-2 w-7 h-7 rounded-[6px] flex items-center justify-center text-tx-3 hover:text-tx-1 hover:bg-sf-2 transition-colors duration-[120ms]"
                >
                  <Pencil size={15} />
                </button>

                <Avatar nome={u.nome} fotoUrl={u.foto_url} tamanho={72} />
                <p className="mt-2.5 text-sm font-medium text-tx-1 truncate max-w-full">{u.nome}</p>
                <p className="text-[12px] text-tx-3 truncate max-w-full">{u.email}</p>
                <Selo tom={u.ativo ? 'ok' : 'neutro'} className="mt-1.5">
                  {u.ativo ? 'Ativo' : 'Inativo'}
                </Selo>

                <div className="mt-3 pt-3 w-full border-t border-bd-1 flex flex-wrap justify-center gap-1">
                  {setores.length === 0 ? (
                    <span className="text-[12px] text-tx-3">Sem departamento</span>
                  ) : (
                    setores.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center h-5 px-1.5 rounded-[4px] bg-sf-2 border border-bd-2 text-[10px] font-medium uppercase tracking-wide text-tx-2 truncate max-w-full"
                      >
                        {nomeDep(id)}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal titulo="Editar atendente" aberto={!!editando} onFechar={() => setEditando(null)}>
        {editando && (
          <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-0.5">
            <div className="flex items-center gap-2.5">
              <Avatar nome={editando.nome} fotoUrl={editando.foto_url} tamanho={40} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-tx-1 truncate">{editando.nome}</div>
                <div className="text-[12px] text-tx-3 truncate">{editando.email}</div>
              </div>
            </div>

            <div>
              <p className="text-[13px] text-tx-2 mb-2">Departamentos que atende</p>
              <div className="flex flex-wrap gap-1.5">
                {deps.map((d) => {
                  const marcado = deptosDe(editando.id).includes(d.id)
                  return (
                    <button
                      key={d.id}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() =>
                        marcado
                          ? vinculos.desvincular.mutate({ usuario_id: editando.id, departamento_id: d.id })
                          : vinculos.vincular.mutate({ usuario_id: editando.id, departamento_id: d.id })
                      }
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

            <div>
              <p className="text-[13px] text-tx-2">Horários de acesso (plantão)</p>
              <p className="text-[12px] text-tx-3 mt-0.5 mb-2">
                Fora do horário comercial, o atendente só acessa dentro dessas faixas. Sem faixa, ele acessa apenas
                no comercial.
              </p>
              <div className="flex flex-col divide-y divide-bd-1 rounded-[8px] border border-bd-1">
                {DIAS.map((nome, d) => {
                  const faixas = faixasDe(editando.id, d)
                  return (
                    <div key={d} className="flex items-start gap-2 px-2.5 py-2">
                      <span className="w-14 shrink-0 text-[12px] text-tx-2 pt-1.5">{nome}</span>
                      <div className="flex-1 flex flex-col gap-1.5">
                        {faixas.map((fx) => (
                          <div key={fx.id} className="flex items-center gap-1.5">
                            <CampoHora
                              rotuloAcessivel={`Início ${nome}`}
                              valor={fx.hora_inicio.slice(0, 5)}
                              aoSalvar={(v) => horarios.atualizar.mutate({ id: fx.id, valores: { hora_inicio: v } })}
                              className="w-[68px]"
                            />
                            <span className="text-[12px] text-tx-3">até</span>
                            <CampoHora
                              rotuloAcessivel={`Fim ${nome}`}
                              valor={fx.hora_fim.slice(0, 5)}
                              aoSalvar={(v) => horarios.atualizar.mutate({ id: fx.id, valores: { hora_fim: v } })}
                              className="w-[68px]"
                            />
                            <button
                              type="button"
                              onClick={() => horarios.remover.mutate(fx.id)}
                              aria-label={`Remover faixa de ${nome}`}
                              className="w-6 h-6 rounded-[6px] flex items-center justify-center text-tx-3 hover:text-err hover:bg-err-soft transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            horarios.adicionar.mutate({
                              usuario_id: editando.id,
                              dia_semana: d,
                              hora_inicio: '18:00',
                              hora_fim: '22:00',
                            })
                          }
                          className="self-start inline-flex items-center gap-1 h-6 px-1.5 rounded-[6px] text-[12px] text-br-2 hover:bg-br-soft transition-colors"
                        >
                          <Plus size={13} /> horário
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Botao variante="primario" onClick={() => setEditando(null)}>
                Concluir
              </Botao>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
