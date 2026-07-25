import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { useHorariosDepartamento } from '../../lib/useHorariosDepartamento'
import { Botao } from '../../components/ui/Botao'
import { Entrada, CampoHora } from '../../components/ui/Campo'
import { Modal } from '../../components/ui/Modal'
import { Selo } from '../../components/ui/Selo'
import { Skeleton } from '../../components/ui/Estados'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type Departamento = { id: string; nome: string; ordem: number; ativo?: boolean }
type Motivo = { id: string; nome: string; ordem?: number; ativo?: boolean; departamento_id?: string | null }

/** Bloco de seção da tela de detalhe. */
function Bloco({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-bd-1 bg-sf-1">
      <div className="px-4 py-3 border-b border-bd-1">
        <h2 className="text-[14px] font-semibold text-tx-1">{titulo}</h2>
        {descricao && <p className="text-[12px] text-tx-2 mt-0.5">{descricao}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

const campoNovo =
  'flex-1 h-9 px-3 text-sm rounded-[6px] bg-sf-2 border border-bd-2 text-tx-1 placeholder:text-tx-3 ' +
  'hover:border-bd-3 focus:border-br-1 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)] transition-colors duration-[120ms]'

export function DepartamentoDetalhe() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { lista, atualizar } = useCrud<Departamento>('departamentos')
  const motivosCrud = useCrud<Motivo>('atendimento_motivos', 'ordem')
  const horariosDep = useHorariosDepartamento()

  const dep = (lista.data ?? []).find((d) => d.id === id) ?? null

  const [nome, setNome] = useState('')
  const [numero, setNumero] = useState('')
  const [novoMotivo, setNovoMotivo] = useState('')
  const [editando, setEditando] = useState<Motivo | null>(null)
  const [nomeEdit, setNomeEdit] = useState('')

  // Preenche os campos quando o departamento carrega.
  useEffect(() => {
    if (dep) {
      setNome(dep.nome ?? '')
      setNumero(String(dep.ordem ?? ''))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep?.id])

  const motivosDe = (motivosCrud.lista.data ?? [])
    .filter((m) => m.departamento_id === id)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  const faixasDe = (dia: number) =>
    (horariosDep.lista.data ?? [])
      .filter((f) => f.departamento_id === id && f.dia_semana === dia)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))

  function salvarDados() {
    atualizar.mutate({ id, valores: { nome: nome.trim(), ordem: Number(numero || 0) } })
  }
  function addMotivo() {
    const n = novoMotivo.trim()
    if (!n) return
    const maior = motivosDe.reduce((m, x) => Math.max(m, x.ordem ?? 0), 0)
    motivosCrud.criar.mutate({ nome: n, departamento_id: id, ativo: true, ordem: maior + 1 })
    setNovoMotivo('')
  }
  function salvarMotivo() {
    if (!editando) return
    motivosCrud.atualizar.mutate({ id: editando.id, valores: { nome: nomeEdit.trim() } })
    setEditando(null)
  }

  if (lista.isLoading) {
    return (
      <div className="w-full max-w-5xl flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    )
  }
  if (!dep) {
    return (
      <div className="w-full max-w-5xl">
        <button
          type="button"
          onClick={() => navigate('/admin/departamentos')}
          className="inline-flex items-center gap-1.5 text-[13px] text-tx-2 hover:text-tx-1"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <p className="mt-6 text-sm text-tx-3">Departamento não encontrado.</p>
      </div>
    )
  }

  const inativo = dep.ativo === false

  return (
    <div className="w-full max-w-5xl flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/admin/departamentos')}
            aria-label="Voltar"
            className="w-8 h-8 shrink-0 rounded-[6px] flex items-center justify-center text-tx-2 hover:text-tx-1 hover:bg-sf-2 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-[16px] font-semibold text-tx-1 truncate">{dep.nome}</h1>
            <p className="text-[12px] text-tx-3">Departamento {dep.ordem}</p>
          </div>
        </div>
        <button
          type="button"
          aria-pressed={!inativo}
          onClick={() => atualizar.mutate({ id, valores: { ativo: inativo } })}
          title={inativo ? 'Clique para ativar' : 'Clique para desativar'}
          className="rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]"
        >
          <Selo tom={inativo ? 'neutro' : 'ok'}>{inativo ? 'Inativo' : 'Ativo'}</Selo>
        </button>
      </div>

      <Bloco titulo="Dados">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-24">
            <Entrada rotulo="Número" type="number" min={1} value={numero} onChange={(e) => setNumero(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Entrada rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <Botao variante="primario" tamanho="sm" onClick={salvarDados}>
            Salvar
          </Botao>
        </div>
      </Bloco>

      <Bloco
        titulo="Horário de atendimento"
        descricao="Vazio = usa o horário comercial. Preenchido, o departamento fica disponível só nessas faixas. Para 24h, use De 00:00 e Até 00:00."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
          {DIAS.map((nomeDia, dia) => {
            const faixas = faixasDe(dia)
            return (
              <div key={dia} className="rounded-[8px] border border-bd-1 bg-sf-0 p-2 flex flex-col gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-tx-2 text-center">{nomeDia}</div>
                <button
                  type="button"
                  onClick={() =>
                    horariosDep.adicionar.mutate({
                      departamento_id: id,
                      dia_semana: dia,
                      hora_inicio: '08:00',
                      hora_fim: '18:00',
                    })
                  }
                  className="inline-flex items-center justify-center gap-1 h-7 rounded-[6px] border border-bd-2 text-[12px] text-br-2 hover:bg-br-soft transition-colors"
                >
                  <Plus size={13} /> horário
                </button>
                {faixas.map((fx) => (
                  <div key={fx.id} className="relative rounded-[6px] bg-sf-2 border border-bd-1 p-1.5 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => horariosDep.remover.mutate(fx.id)}
                      aria-label={`Remover faixa de ${nomeDia}`}
                      className="absolute top-1 right-1 w-5 h-5 rounded-[4px] flex items-center justify-center text-tx-3 hover:text-err hover:bg-err-soft transition-colors"
                    >
                      <X size={13} />
                    </button>
                    <label className="flex items-center gap-1">
                      <span className="text-[11px] text-tx-3 w-6">De</span>
                      <CampoHora
                        rotuloAcessivel={`Início ${nomeDia}`}
                        valor={fx.hora_inicio.slice(0, 5)}
                        aoSalvar={(v) => horariosDep.atualizar.mutate({ id: fx.id, valores: { hora_inicio: v } })}
                        className="w-[64px]"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-[11px] text-tx-3 w-6">Até</span>
                      <CampoHora
                        rotuloAcessivel={`Fim ${nomeDia}`}
                        valor={fx.hora_fim.slice(0, 5)}
                        aoSalvar={(v) => horariosDep.atualizar.mutate({ id: fx.id, valores: { hora_fim: v } })}
                        className="w-[64px]"
                      />
                    </label>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </Bloco>

      <Bloco titulo="Motivos de finalização" descricao="Aparecem no Finalizar dos chamados deste departamento.">
        <div className="flex gap-2 mb-3">
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
          <Botao variante="primario" tamanho="sm" onClick={addMotivo} icone={<Plus size={15} />}>
            Adicionar
          </Botao>
        </div>
        {motivosDe.length === 0 ? (
          <p className="text-[13px] text-tx-3">Nenhum motivo ainda.</p>
        ) : (
          <div className="rounded-[8px] border border-bd-1 overflow-hidden">
            {motivosDe.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 px-3 py-2 border-b border-bd-1 last:border-b-0 hover:bg-sf-2 transition-colors"
              >
                <span className="text-[13px] text-tx-1 truncate">{m.nome}</span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    aria-label={`Editar motivo ${m.nome}`}
                    onClick={() => {
                      setEditando(m)
                      setNomeEdit(m.nome)
                    }}
                  >
                    <Pencil size={15} />
                  </Botao>
                  <Botao
                    variante="perigo"
                    tamanho="sm"
                    aria-label={`Remover motivo ${m.nome}`}
                    onClick={() => motivosCrud.remover.mutate(m.id)}
                  >
                    <Trash2 size={15} />
                  </Botao>
                </div>
              </div>
            ))}
          </div>
        )}
      </Bloco>

      <Modal titulo="Editar motivo" aberto={!!editando} onFechar={() => setEditando(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            salvarMotivo()
          }}
          className="flex flex-col gap-3"
        >
          <Entrada rotulo="Nome" required value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)} />
          <div className="flex justify-end gap-2 pt-1">
            <Botao variante="fantasma" type="button" onClick={() => setEditando(null)}>
              Cancelar
            </Botao>
            <Botao variante="primario" type="submit">
              Salvar
            </Botao>
          </div>
        </form>
      </Modal>
    </div>
  )
}
