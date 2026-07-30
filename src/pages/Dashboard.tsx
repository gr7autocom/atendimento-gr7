import { Fragment, useState } from 'react'
import { Users, Building2, ChevronRight, User } from 'lucide-react'
import { useAtendimentos, type AtendimentoLista } from '../lib/useInbox'
import { useUsuarios } from '../lib/useVinculos'
import { useCrud } from '../lib/useCrud'
import { LinhasCarregando } from '../components/ui/Estados'
import { Th } from '../components/ui/Tabela'
import { COR_METRICA } from '../lib/cores'
import { cn } from '../lib/utils'

type Departamento = { id: string; nome: string; ativo: boolean }
export type FiltroInbox = { departamentoId: string | null; atendenteId: string | null }

const semCadastro = (a: AtendimentoLista) => !a.contato?.cliente_id

// Cor por métrica: vem de lib/cores, junto com setor, tag e avatar.
const COR = COR_METRICA

/** Número em pílula colorida quando > 0; discreto quando zero. */
function Contagem({ valor, cor }: { valor: number; cor: string }) {
  if (!valor) return <span className="dado text-corpo text-tx-3">0</span>
  return (
    <span
      className="dado inline-flex items-center justify-center min-w-[30px] h-6 px-2 rounded-1 text-apoio font-semibold"
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

  /**
   * `semFonte` marca a métrica que ainda não tem de onde vir (presença do
   * atendente, leitura de mensagem e retorno dependem da integração uazapi).
   *
   * Antes esses três cards mostravam 0 igual aos outros, e zero em painel de
   * gestão lê como "a operação parou", não como "o dado não existe". A legenda
   * evita alarme falso e diz o que falta para o número aparecer.
   */
  const cards = [
    { rotulo: 'Atendentes online', valor: 0, cor: COR.online, semFonte: true },
    { rotulo: 'Potenciais', valor: potenciais.length, cor: COR.potenciais },
    { rotulo: 'Novas mensagens', valor: 0, cor: COR.novas, semFonte: true },
    { rotulo: 'Atendimentos ativos', valor: ativos.length, cor: COR.ativos },
    { rotulo: 'Atendimentos pendentes', valor: pendentes.length, cor: COR.pendentes },
    { rotulo: 'Retornos', valor: 0, cor: COR.retornos, semFonte: true },
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

  /**
   * A linha aqui não usa o `Tr` do design system porque tem estado próprio
   * (clicável, selecionada quando o filtro aponta para ela) e altura variável
   * entre linha-mãe e linha-filha. O cabeçalho, sim, usa o `Th` padrão: antes
   * repetia as mesmas classes à mão e ainda pintava o `thead`, o que fazia esta
   * tabela parecer de outro produto.
   */
  const rowBase = 'border-b border-bd-1 last:border-0 transicao'

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-sf-0">
      <div className="p-5 sm:p-6 flex flex-col gap-6">
        <div>
          {/* h2, não h1: este painel é renderizado DENTRO da inbox, cujo h1 é
              "Atendimentos". Dois h1 na mesma tela quebram a navegação por
              títulos de quem usa leitor de tela. */}
          <h2 className="text-titulo font-semibold text-tx-1">Supervisão</h2>
          <p className="text-corpo text-tx-2 mt-0.5">Clique num departamento ou atendente para filtrar as conversas.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {cards.map((c) => (
            <div
              key={c.rotulo}
              className="rounded-2 border p-3 min-h-[84px] flex flex-col justify-between gap-1"
              style={{ background: `${c.cor}12`, borderColor: `${c.cor}40` }}
            >
              <div className="rotulo text-tx-2 leading-tight">{c.rotulo}</div>
              <div>
                <div
                  className="dado text-metrica font-semibold leading-none tracking-tight"
                  style={{ color: c.valor ? c.cor : 'var(--tx-3)' }}
                >
                  {c.valor}
                </div>
                {c.semFonte && (
                  <p className="text-mini text-tx-3 leading-tight mt-1.5">Sem dados até conectar o WhatsApp</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Por departamento */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={16} className="text-tx-2" />
            <h2 className="text-corpo-lg font-semibold text-tx-1">Por departamento</h2>
          </div>
          {carregando ? (
            <LinhasCarregando linhas={4} />
          ) : (
            <div className="overflow-x-auto rounded-2 border border-bd-1 bg-sf-1">
              <table className="w-full min-w-[560px] text-corpo-lg border-collapse table-fixed">
                <thead>
                  <tr>
                    <Th className="text-left w-[40%]">Departamento</Th>
                    <Th className="text-center w-[20%]">Ativos</Th>
                    <Th className="text-center w-[20%]">Pendentes</Th>
                    <Th className="text-center w-[20%]">Retornos</Th>
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
                                className="w-6 h-6 flex items-center justify-center rounded-micro text-tx-3 hover:text-tx-1 hover:bg-sf-3"
                              >
                                <ChevronRight size={14} className={cn('transition-transform', aberto && 'rotate-90')} />
                              </button>
                              <span className="text-corpo font-medium text-tx-1">{d.nome}</span>
                            </div>
                          </td>
                          <td className="h-10 px-3 text-center"><Contagem valor={d.ativos} cor={COR.ativos} /></td>
                          <td className="h-10 px-3 text-center"><Contagem valor={d.pendentes} cor={COR.pendentes} /></td>
                          <td className="h-10 px-3 text-center"><Contagem valor={0} cor={COR.retornos} /></td>
                        </tr>
                        {aberto &&
                          (atendentesNoDep(d.id).length === 0 ? (
                            <tr className={rowBase}>
                              <td colSpan={4} className="h-9 pl-9 text-apoio text-tx-3">Ninguém com ativo aqui.</td>
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
                                    <span className="inline-flex items-center gap-1.5 text-corpo text-tx-2">
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
            <h2 className="text-corpo-lg font-semibold text-tx-1">Por atendente</h2>
          </div>
          {carregando ? (
            <LinhasCarregando linhas={3} />
          ) : porAtendente.length === 0 ? (
            <p className="text-corpo text-tx-3">Ninguém com atendimento ativo no momento.</p>
          ) : (
            <div className="overflow-x-auto rounded-2 border border-bd-1 bg-sf-1">
              <table className="w-full min-w-[560px] text-corpo-lg border-collapse table-fixed">
                <thead>
                  <tr>
                    <Th className="text-left w-[40%]">Atendente</Th>
                    <Th className="text-center w-[20%]">Ativos</Th>
                    <Th className="text-center w-[20%]">Novas</Th>
                    <Th className="text-center w-[20%]">Retornos</Th>
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
                                className="w-6 h-6 flex items-center justify-center rounded-micro text-tx-3 hover:text-tx-1 hover:bg-sf-3"
                              >
                                <ChevronRight size={14} className={cn('transition-transform', aberto && 'rotate-90')} />
                              </button>
                              <span className="text-corpo font-medium text-tx-1">{u.nome}</span>
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
                                  <span className="inline-flex items-center gap-1.5 text-corpo text-tx-2">
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
