import { useState } from 'react'
import { Plus, Pencil, Trash2, Building2, X } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { useHorariosDepartamento } from '../../lib/useHorariosDepartamento'
import { corSetor } from '../../lib/coresSetor'
import { departamentoDisponivelAgora, type Faixa } from '../../lib/horario'
import { Modal } from '../../components/ui/Modal'
import { Botao } from '../../components/ui/Botao'
import { Entrada, CampoHora } from '../../components/ui/Campo'
import { CabecalhoAdmin } from '../../components/admin/CabecalhoAdmin'
import { Selo } from '../../components/ui/Selo'
import { Vazio, Skeleton } from '../../components/ui/Estados'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type Departamento = { id: string; nome: string; ordem: number; ativo?: boolean }
type Motivo = { id: string; nome: string; ordem?: number; ativo?: boolean; departamento_id?: string | null }
type HorarioComercial = { dia_semana: number; hora_inicio: string; hora_fim: string; ativo?: boolean }

const campoNovo =
  'flex-1 h-9 px-3 text-sm rounded-[6px] bg-sf-2 border border-bd-2 text-tx-1 placeholder:text-tx-3 ' +
  'hover:border-bd-3 focus:border-br-1 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)] transition-colors duration-[120ms]'

export function Departamentos() {
  const { lista, criar, atualizar, remover } = useCrud<Departamento>('departamentos')
  const comercial = useCrud<HorarioComercial & { id: string }>('atendimento_horarios', 'dia_semana')
  const motivos = useCrud<Motivo>('atendimento_motivos', 'ordem')
  const horariosDep = useHorariosDepartamento()

  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Departamento | null>(null)
  const [nome, setNome] = useState('')
  const [numero, setNumero] = useState('')
  const [novoMotivo, setNovoMotivo] = useState('')

  const itens = lista.data ?? []
  const faixasComercial = (comercial.lista.data ?? []) as Faixa[]

  const faixasDep = (depId: string, dia?: number) =>
    (horariosDep.lista.data ?? [])
      .filter((f) => f.departamento_id === depId && (dia === undefined || f.dia_semana === dia))
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
  const disponivel = (depId: string) =>
    departamentoDisponivelAgora({ faixasDep: faixasDep(depId) as Faixa[], comercial: faixasComercial })
  const motivosDe = (depId: string) =>
    (motivos.lista.data ?? [])
      .filter((m) => m.departamento_id === depId)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))

  function abrirNovo() {
    setEditando(null)
    setNome('')
    setNovoMotivo('')
    const maior = itens.reduce((m, d) => Math.max(m, d.ordem ?? 0), 0)
    setNumero(String(maior + 1))
    setAberto(true)
  }

  function abrirEdicao(d: Departamento) {
    setEditando(d)
    setNome(d.nome ?? '')
    setNumero(String(d.ordem ?? ''))
    setNovoMotivo('')
    setAberto(true)
  }

  function salvar() {
    const valores = { nome: nome.trim(), ordem: Number(numero || 0) }
    if (editando) atualizar.mutate({ id: editando.id, valores })
    else criar.mutate(valores)
    setAberto(false)
  }

  function addMotivo() {
    const n = novoMotivo.trim()
    if (!n || !editando) return
    const maior = motivosDe(editando.id).reduce((m, x) => Math.max(m, x.ordem ?? 0), 0)
    motivos.criar.mutate({ nome: n, departamento_id: editando.id, ativo: true, ordem: maior + 1 })
    setNovoMotivo('')
  }

  return (
    <div className="w-full">
      <CabecalhoAdmin
        titulo="Departamentos"
        descricao="Filas de atendimento. Em cada um você define os motivos de finalização e o horário de atendimento."
        acoes={
          <Botao variante="primario" tamanho="sm" onClick={abrirNovo} icone={<Plus size={15} />}>
            Novo departamento
          </Botao>
        }
      />

      {lista.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <div className="rounded-[10px] border border-bd-1 bg-sf-1">
          <Vazio
            icone={<Building2 size={22} />}
            titulo="Nenhum departamento ainda"
            descricao="Crie o primeiro departamento para montar o menu do bot."
            acao={
              <Botao variante="neutro" tamanho="sm" onClick={abrirNovo} icone={<Plus size={15} />}>
                Novo departamento
              </Botao>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {itens.map((d) => {
            const cor = corSetor(d.nome ?? '')
            const inativo = d.ativo === false
            const disp = disponivel(d.id)
            const usaProprio = faixasDep(d.id).length > 0
            return (
              <div
                key={d.id}
                className="group flex flex-col rounded-[10px] border border-bd-1 bg-sf-1 p-3.5 transition-colors hover:border-bd-2"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="dado shrink-0 grid place-items-center w-9 h-9 rounded-[8px] text-[15px] font-semibold tabular-nums"
                    style={{ background: cor.bg, color: cor.fg }}
                    aria-hidden="true"
                  >
                    {d.ordem}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={'text-sm font-medium truncate ' + (inativo ? 'text-tx-3' : 'text-tx-1')}
                      title={d.nome}
                    >
                      {d.nome}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Selo tom={disp ? 'ok' : 'warn'}>{disp ? 'Disponível agora' : 'Fora de horário'}</Selo>
                      <span className="text-[11px] text-tx-3">{usaProprio ? 'horário próprio' : 'segue o comercial'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-bd-1">
                  <button
                    type="button"
                    aria-pressed={!inativo}
                    onClick={() => atualizar.mutate({ id: d.id, valores: { ativo: inativo } })}
                    title={inativo ? 'Clique para ativar' : 'Clique para desativar'}
                    className="rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]"
                  >
                    <Selo tom={inativo ? 'neutro' : 'ok'}>{inativo ? 'Inativo' : 'Ativo'}</Selo>
                  </button>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <Botao variante="fantasma" tamanho="sm" aria-label={`Editar ${d.nome}`} onClick={() => abrirEdicao(d)}>
                      <Pencil size={15} />
                    </Botao>
                    <Botao
                      variante="perigo"
                      tamanho="sm"
                      aria-label={`Remover ${d.nome}`}
                      onClick={() => {
                        if (confirm(`Remover o departamento "${d.nome}"?`)) remover.mutate(d.id)
                      }}
                    >
                      <Trash2 size={15} />
                    </Botao>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        titulo={editando ? 'Editar departamento' : 'Novo departamento'}
        aberto={aberto}
        onFechar={() => setAberto(false)}
      >
        <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-0.5">
          <div className="flex gap-3">
            <div className="w-24 shrink-0">
              <Entrada rotulo="Número" type="number" min={1} value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div className="flex-1">
              <Entrada rotulo="Nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
          </div>

          {editando ? (
            <>
              <div>
                <p className="text-[13px] text-tx-2">Motivos de finalização</p>
                <p className="text-[12px] text-tx-3 mt-0.5 mb-2">
                  Aparecem no Finalizar dos chamados deste departamento.
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    value={novoMotivo}
                    onChange={(e) => setNovoMotivo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addMotivo()
                      }
                    }}
                    placeholder="Novo motivo"
                    aria-label="Novo motivo"
                    className={campoNovo}
                  />
                  <Botao variante="neutro" tamanho="sm" onClick={addMotivo} icone={<Plus size={15} />}>
                    Adicionar
                  </Botao>
                </div>
                <div className="flex flex-col gap-1">
                  {motivosDe(editando.id).length === 0 ? (
                    <p className="text-[12px] text-tx-3">Nenhum motivo ainda.</p>
                  ) : (
                    motivosDe(editando.id).map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-2 px-2.5 h-8 rounded-[6px] bg-sf-2 border border-bd-1"
                      >
                        <span className="text-[13px] text-tx-1 truncate">{m.nome}</span>
                        <button
                          type="button"
                          onClick={() => motivos.remover.mutate(m.id)}
                          aria-label={`Remover motivo ${m.nome}`}
                          className="w-6 h-6 shrink-0 rounded-[6px] flex items-center justify-center text-tx-3 hover:text-err hover:bg-err-soft transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-[13px] text-tx-2">Horário de atendimento</p>
                <p className="text-[12px] text-tx-3 mt-0.5 mb-2">
                  Vazio = usa o horário comercial. Preenchido, o departamento fica disponível só nessas faixas.
                </p>
                <div className="flex flex-col divide-y divide-bd-1 rounded-[8px] border border-bd-1">
                  {DIAS.map((nomeDia, dia) => {
                    const faixas = faixasDep(editando.id, dia)
                    return (
                      <div key={dia} className="flex items-start gap-2 px-2.5 py-2">
                        <span className="w-14 shrink-0 text-[12px] text-tx-2 pt-1.5">{nomeDia}</span>
                        <div className="flex-1 flex flex-col gap-1.5">
                          {faixas.map((fx) => (
                            <div key={fx.id} className="flex items-center gap-1.5">
                              <CampoHora
                                rotuloAcessivel={`Início ${nomeDia}`}
                                valor={fx.hora_inicio.slice(0, 5)}
                                aoSalvar={(v) => horariosDep.atualizar.mutate({ id: fx.id, valores: { hora_inicio: v } })}
                                className="w-[68px]"
                              />
                              <span className="text-[12px] text-tx-3">até</span>
                              <CampoHora
                                rotuloAcessivel={`Fim ${nomeDia}`}
                                valor={fx.hora_fim.slice(0, 5)}
                                aoSalvar={(v) => horariosDep.atualizar.mutate({ id: fx.id, valores: { hora_fim: v } })}
                                className="w-[68px]"
                              />
                              <button
                                type="button"
                                onClick={() => horariosDep.remover.mutate(fx.id)}
                                aria-label={`Remover faixa de ${nomeDia}`}
                                className="w-6 h-6 rounded-[6px] flex items-center justify-center text-tx-3 hover:text-err hover:bg-err-soft transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              horariosDep.adicionar.mutate({
                                departamento_id: editando.id,
                                dia_semana: dia,
                                hora_inicio: '08:00',
                                hora_fim: '18:00',
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
            </>
          ) : (
            <p className="text-[12px] text-tx-3">Salve o departamento para configurar motivos e horário.</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Botao variante="fantasma" type="button" onClick={() => setAberto(false)}>
              {editando ? 'Concluir' : 'Cancelar'}
            </Botao>
            <Botao variante="primario" type="button" onClick={salvar}>
              {editando ? 'Salvar nome/número' : 'Enviar'}
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  )
}
