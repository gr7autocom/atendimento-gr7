import { Fragment, useState } from 'react'
import { Users, Building2, ChevronRight, User } from 'lucide-react'
import { useAtendimentos, type AtendimentoLista } from '../lib/useInbox'
import { useUsuarios } from '../lib/useVinculos'
import { useCrud } from '../lib/useCrud'
import { LinhasCarregando } from '../components/ui/Estados'
import { cn } from '../lib/utils'

type Departamento = { id: string; nome: string; ativo: boolean }
export type FiltroInbox = { departamentoId: string | null; atendenteId: string | null }

const semCadastro = (a: AtendimentoLista) => !a.contato?.cliente_id

// Cores sólidas por métrica, para orientar visualmente (tom escuro do tema).
const COR = {
  online: '#3fb950',
  potenciais: '#a371f7',
  novas: '#3bb6c9',
  ativos: '#4c8dff',
  pendentes: '#e0a12e',
  retornos: '#f0803c',
}

/** Número em pílula colorida quando > 0; discreto quando zero. */
function Contagem({ valor, cor }: { valor: number; cor: string }) {
  if (!valor) return <span className="dado text-[13px] text-tx-3">0</span>
  return (
    <span
      className="dado inline-flex items-center justify-center min-w-[30px] h-6 px-2 rounded-[6px] text-[12px] font-semibold"
      style={{ background: `${cor}26`, color: cor }}
    >
      {valor}
    </span>
  )
}

export function Dashboard({
  aoFiltrar,
  filtro,
}: {
  aoFiltrar?: (f: FiltroInbox) => void
  filtro?: FiltroInbox
}) {
  const atendimentos = useAtendimentos()
  const usuarios = useUsuarios()
  const departamentos = useCrud<Departamento>('departamentos', 'ordem')

  const [depAberto, setDepAberto] = useState<string | null>(null)
  const [atendAberto, setAtendAberto] = useState<string | null>(null)

  const depAtivo = filtro?.departamentoId ?? null
  const atendAtivo = filtro?.atendenteId ?? null
  const filtrar = (f: FiltroInbox) => aoFiltrar?.(f)

  const lista = (atendimentos.data ?? []).filter((a) => a.status !== 'finalizado')
  const ativos = lista.filter((a) => a.status === 'em_atendimento' && a.responsavel_id)
  const pendentes = lista.filter((a) => a.status === 'na_fila' && !a.responsavel_id && !semCadastro(a))
  const potenciais = lista.filter((a) => !a.responsavel_id && semCadastro(a))

  const nomeUsuario = (id: string) => (usuarios.data ?? []).find((u) => u.id === id)?.nome ?? 'Atendente'
  const nomeDep = (id: string | null) =>
    (departamentos.lista.data ?? []).find((d) => d.id === id)?.nome ?? 'Sem setor'

  // Métricas sem origem de dados (presença/leitura/uazapi) ficam em 0.
  const cards = [
    { rotulo: 'Atendentes online', valor: 0, cor: COR.online },
    { rotulo: 'Potenciais', valor: potenciais.length, cor: COR.potenciais },
    { rotulo: 'Novas mensagens', valor: 0, cor: COR.novas },
    { rotulo: 'Atendimentos ativos', valor: ativos.length, cor: COR.ativos },
    { rotulo: 'Atendimentos pendentes', valor: pendentes.length, cor: COR.pendentes },
    { rotulo: 'Retornos', valor: 0, cor: COR.retornos },
  ]

  const porDepartamento = (departamentos.lista.data ?? []).map((d) => ({
    id: d.id,
    nome: d.nome,
    ativos: ativos.filter((a) => a.departamento_id === d.id).length,
    pendentes: pendentes.filter((a) => a.departamento_id === d.id).length,
  }))

  const porAtendente = (usuarios.data ?? [])
    .map((u) => ({ id: u.id, nome: u.nome, ativos: ativos.filter((a) => a.responsavel_id === u.id).length }))
    .filter((u) => u.ativos > 0)
    .sort((a, b) => b.ativos - a.ativos)

  // Atendentes com ativo dentro de um departamento.
  const atendentesNoDep = (depId: string) => {
    const m = new Map<string, number>()
    ativos.filter((a) => a.departamento_id === depId && a.responsavel_id).forEach((a) => {
      m.set(a.responsavel_id!, (m.get(a.responsavel_id!) ?? 0) + 1)
    })
    return [...m.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count)
  }

  // Departamentos com ativo de um atendente.
  const depsDoAtendente = (userId: string) => {
    const m = new Map<string | null, number>()
    ativos.filter((a) => a.responsavel_id === userId).forEach((a) => {
      m.set(a.departamento_id, (m.get(a.departamento_id) ?? 0) + 1)
    })
    return [...m.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count)
  }

  const carregando = atendimentos.isLoading || departamentos.lista.isLoading

  const thCls = 'h-9 px-3 text-[12px] font-medium text-tx-3 border-b border-bd-1 whitespace-nowrap'
  const thNome = cn(thCls, 'text-left w-[40%]')
  const thNum = cn(thCls, 'text-center w-[20%]')
  const rowBase = 'border-b border-bd-1 last:border-0 transition-colors duration-[120ms]'

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-sf-0">
      <div className="p-5 sm:p-6 flex flex-col gap-6">
        <div>
          <h1 className="text-[16px] font-semibold text-tx-1">Supervisão</h1>
          <p className="text-[13px] text-tx-2 mt-0.5">Clique num departamento ou atendente para filtrar as conversas.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {cards.map((c) => (
            <div
              key={c.rotulo}
              className="rounded-[10px] border p-3 h-[84px] flex flex-col justify-between"
              style={{ background: `${c.cor}12`, borderColor: `${c.cor}40` }}
            >
              <div className="rotulo text-tx-2 leading-tight">{c.rotulo}</div>
              <div
                className="dado text-[26px] font-semibold leading-none tracking-tight"
                style={{ color: c.valor ? c.cor : 'var(--tx-3)' }}
              >
                {c.valor}
              </div>
            </div>
          ))}
        </div>

        {/* Por departamento */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={16} className="text-tx-2" />
            <h2 className="text-[14px] font-semibold text-tx-1">Por departamento</h2>
          </div>
          {carregando ? (
            <LinhasCarregando linhas={4} />
          ) : (
            <div className="overflow-x-auto rounded-[10px] border border-bd-1 bg-sf-1">
              <table className="w-full min-w-[560px] text-sm border-collapse table-fixed">
                <thead>
                  <tr className="bg-sf-2">
                    <th className={thNome}>Departamento</th>
                    <th className={thNum}>Ativos</th>
                    <th className={thNum}>Pendentes</th>
                    <th className={thNum}>Retornos</th>
                  </tr>
                </thead>
                <tbody>
                  {porDepartamento.map((d) => {
                    const aberto = depAberto === d.id
                    const ativo = depAtivo === d.id && !atendAtivo
                    return (
                      <Fragment key={d.id}>
                        <tr
                          className={cn(rowBase, 'cursor-pointer', ativo ? 'bg-br-soft' : 'hover:bg-sf-2')}
                          onClick={() => filtrar({ departamentoId: d.id, atendenteId: null })}
                        >
                          <td className="h-10 pr-3 pl-1 align-middle">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label={aberto ? 'Recolher' : 'Expandir atendentes'}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDepAberto(aberto ? null : d.id)
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded-[4px] text-tx-3 hover:text-tx-1 hover:bg-sf-3"
                              >
                                <ChevronRight size={14} className={cn('transition-transform', aberto && 'rotate-90')} />
                              </button>
                              <span className="text-[13px] font-medium text-tx-1">{d.nome}</span>
                            </div>
                          </td>
                          <td className="h-10 px-3 text-center"><Contagem valor={d.ativos} cor={COR.ativos} /></td>
                          <td className="h-10 px-3 text-center"><Contagem valor={d.pendentes} cor={COR.pendentes} /></td>
                          <td className="h-10 px-3 text-center"><Contagem valor={0} cor={COR.retornos} /></td>
                        </tr>
                        {aberto &&
                          (atendentesNoDep(d.id).length === 0 ? (
                            <tr className={rowBase}>
                              <td colSpan={4} className="h-9 pl-9 text-[12px] text-tx-3">Ninguém com ativo aqui.</td>
                            </tr>
                          ) : (
                            atendentesNoDep(d.id).map((u) => {
                              const subAtivo = depAtivo === d.id && atendAtivo === u.id
                              return (
                                <tr
                                  key={u.id}
                                  className={cn(rowBase, 'cursor-pointer', subAtivo ? 'bg-br-soft' : 'hover:bg-sf-2')}
                                  onClick={() => filtrar({ departamentoId: d.id, atendenteId: u.id })}
                                >
                                  <td className="h-9 pr-3 pl-9 align-middle">
                                    <span className="inline-flex items-center gap-1.5 text-[13px] text-tx-2">
                                      <User size={13} className="text-tx-3" /> {nomeUsuario(u.id)}
                                    </span>
                                  </td>
                                  <td className="h-9 px-3 text-center"><Contagem valor={u.count} cor={COR.ativos} /></td>
                                  <td className="h-9 px-3 text-center"><Contagem valor={0} cor={COR.pendentes} /></td>
                                  <td className="h-9 px-3 text-center"><Contagem valor={0} cor={COR.retornos} /></td>
                                </tr>
                              )
                            })
                          ))}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Por atendente */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-tx-2" />
            <h2 className="text-[14px] font-semibold text-tx-1">Por atendente</h2>
          </div>
          {carregando ? (
            <LinhasCarregando linhas={3} />
          ) : porAtendente.length === 0 ? (
            <p className="text-[13px] text-tx-3">Ninguém com atendimento ativo no momento.</p>
          ) : (
            <div className="overflow-x-auto rounded-[10px] border border-bd-1 bg-sf-1">
              <table className="w-full min-w-[560px] text-sm border-collapse table-fixed">
                <thead>
                  <tr className="bg-sf-2">
                    <th className={thNome}>Atendente</th>
                    <th className={thNum}>Ativos</th>
                    <th className={thNum}>Novas</th>
                    <th className={thNum}>Retornos</th>
                  </tr>
                </thead>
                <tbody>
                  {porAtendente.map((u) => {
                    const aberto = atendAberto === u.id
                    const ativo = atendAtivo === u.id && !depAtivo
                    return (
                      <Fragment key={u.id}>
                        <tr
                          className={cn(rowBase, 'cursor-pointer', ativo ? 'bg-br-soft' : 'hover:bg-sf-2')}
                          onClick={() => filtrar({ departamentoId: null, atendenteId: u.id })}
                        >
                          <td className="h-10 pr-3 pl-1 align-middle">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label={aberto ? 'Recolher' : 'Expandir departamentos'}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setAtendAberto(aberto ? null : u.id)
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded-[4px] text-tx-3 hover:text-tx-1 hover:bg-sf-3"
                              >
                                <ChevronRight size={14} className={cn('transition-transform', aberto && 'rotate-90')} />
                              </button>
                              <span className="text-[13px] font-medium text-tx-1">{u.nome}</span>
                            </div>
                          </td>
                          <td className="h-10 px-3 text-center"><Contagem valor={u.ativos} cor={COR.ativos} /></td>
                          <td className="h-10 px-3 text-center"><Contagem valor={0} cor={COR.novas} /></td>
                          <td className="h-10 px-3 text-center"><Contagem valor={0} cor={COR.retornos} /></td>
                        </tr>
                        {aberto &&
                          depsDoAtendente(u.id).map((dep) => {
                            const subAtivo = atendAtivo === u.id && depAtivo === dep.id
                            return (
                              <tr
                                key={dep.id ?? 'sem'}
                                className={cn(rowBase, 'cursor-pointer', subAtivo ? 'bg-br-soft' : 'hover:bg-sf-2')}
                                onClick={() => filtrar({ departamentoId: dep.id, atendenteId: u.id })}
                              >
                                <td className="h-9 pr-3 pl-9 align-middle">
                                  <span className="inline-flex items-center gap-1.5 text-[13px] text-tx-2">
                                    <Building2 size={13} className="text-tx-3" /> {nomeDep(dep.id)}
                                  </span>
                                </td>
                                <td className="h-9 px-3 text-center"><Contagem valor={dep.count} cor={COR.ativos} /></td>
                                <td className="h-9 px-3 text-center"><Contagem valor={0} cor={COR.novas} /></td>
                                <td className="h-9 px-3 text-center"><Contagem valor={0} cor={COR.retornos} /></td>
                              </tr>
                            )
                          })}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
