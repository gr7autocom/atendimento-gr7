import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { useHorariosDepartamento } from '../../lib/useHorariosDepartamento'
import { Botao } from '../../components/ui/Botao'
import { Entrada } from '../../components/ui/Campo'
import { Modal } from '../../components/ui/Modal'
import { Selo } from '../../components/ui/Selo'
import { Skeleton } from '../../components/ui/Estados'
import { GradeHorarios } from '../../components/admin/GradeHorarios'

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
  // Reordena trocando o `ordem` com o vizinho; a ordem vale na lista e no Finalizar.
  function moverMotivo(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= motivosDe.length) return
    const a = motivosDe[idx]
    const b = motivosDe[j]
    motivosCrud.atualizar.mutate({ id: a.id, valores: { ordem: b.ordem ?? j } })
    motivosCrud.atualizar.mutate({ id: b.id, valores: { ordem: a.ordem ?? idx } })
  }

  if (lista.isLoading) {
    return (
      <div className="w-full flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    )
  }
  if (!dep) {
    return (
      <div className="w-full">
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
    <div className="w-full flex flex-col gap-4">
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
        <GradeHorarios
          faixas={(horariosDep.lista.data ?? []).filter((f) => f.departamento_id === id)}
          aoAdicionar={(dia) =>
            horariosDep.adicionar.mutate({ departamento_id: id, dia_semana: dia, hora_inicio: '08:00', hora_fim: '18:00' })
          }
          aoAtualizar={(fid, valores) => horariosDep.atualizar.mutate({ id: fid, valores })}
          aoRemover={(fid) => horariosDep.remover.mutate(fid)}
        />
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
            {motivosDe.map((m, idx) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 px-3 py-2 border-b border-bd-1 last:border-b-0 hover:bg-sf-2 transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0 text-[13px] text-tx-1">
                  <span className="dado w-5 text-right text-tx-3 shrink-0">{idx + 1}</span>
                  <span className="truncate">{m.nome}</span>
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moverMotivo(idx, -1)}
                    aria-label={`Subir ${m.nome}`}
                    className="w-7 h-7 rounded-[6px] flex items-center justify-center text-tx-3 hover:text-tx-1 hover:bg-sf-2 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === motivosDe.length - 1}
                    onClick={() => moverMotivo(idx, 1)}
                    aria-label={`Descer ${m.nome}`}
                    className="w-7 h-7 rounded-[6px] flex items-center justify-center text-tx-3 hover:text-tx-1 hover:bg-sf-2 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronDown size={16} />
                  </button>
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
