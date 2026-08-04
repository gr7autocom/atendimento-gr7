import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { useHorariosDepartamento } from '../../lib/useHorariosDepartamento'
import { corSetor } from '../../lib/cores'
import { departamentoDisponivelAgora, type Faixa } from '../../lib/horario'
import { Modal, ModalConfirmar } from '../../components/ui/Modal'
import { Botao } from '../../components/ui/Botao'
import { Entrada } from '../../components/ui/Campo'
import { CabecalhoAdmin } from '../../components/admin/CabecalhoAdmin'
import { Selo } from '../../components/ui/Selo'
import { Vazio, Skeleton, AvisoErro } from '../../components/ui/Estados'

type Departamento = { id: string; nome: string; ordem: number; ativo?: boolean }
type HorarioComercial = { dia_semana: number; hora_inicio: string; hora_fim: string; ativo?: boolean }

export function Departamentos() {
  const navigate = useNavigate()
  const crud = useCrud<Departamento>('departamentos')
  const { lista, criar, atualizar, remover } = crud
  const comercial = useCrud<HorarioComercial & { id: string }>('atendimento_horarios', 'dia_semana')
  const horariosDep = useHorariosDepartamento()

  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [numero, setNumero] = useState('')
  // Departamento em vias de ser removido, para o modal nomear o que vai apagar.
  const [removerDep, setRemoverDep] = useState<Departamento | null>(null)
  const [erroRemover, setErroRemover] = useState<string | null>(null)

  const itens = lista.data ?? []
  const faixasComercial = (comercial.lista.data ?? []) as Faixa[]

  const faixasDep = (depId: string) =>
    (horariosDep.lista.data ?? []).filter((f) => f.departamento_id === depId) as Faixa[]
  const disponivel = (depId: string) =>
    departamentoDisponivelAgora({ faixasDep: faixasDep(depId), comercial: faixasComercial })

  function abrirNovo() {
    setNome('')
    const maior = itens.reduce((m, d) => Math.max(m, d.ordem ?? 0), 0)
    setNumero(String(maior + 1))
    setAberto(true)
  }

  function criarDepartamento() {
    criar.mutate({ nome: nome.trim(), ordem: Number(numero || 0) })
    setAberto(false)
  }

  return (
    <div className="w-full">
      <CabecalhoAdmin
        titulo="Departamentos"
        descricao="Cada departamento é uma fila. Clique em um para definir seus motivos e horário."
        acoes={
          <Botao variante="primario" tamanho="sm" onClick={abrirNovo} icone={<Plus size={15} />}>
            Novo departamento
          </Botao>
        }
      />


      <AvisoErro mensagem={crud.erro} />
      {lista.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <div className="rounded-2 border border-bd-1 bg-sf-1">
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
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/admin/departamentos/${d.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/admin/departamentos/${d.id}`)
                  }
                }}
                aria-label={`Configurar ${d.nome}`}
                className="group flex flex-col text-left cursor-pointer rounded-2 border border-bd-1 bg-sf-1 p-3.5 transicao hover:border-bd-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]"
              >
                <div className="flex items-start gap-3">
                  <span
                    // corpo-lg e não titulo: é o número da ordem dentro de um
                    // círculo de 36px, não um título de tela.
                    className="dado shrink-0 grid place-items-center w-9 h-9 rounded-2 text-corpo-lg font-semibold tabular-nums"
                    style={{ background: cor.bg, color: cor.fg }}
                    aria-hidden="true"
                  >
                    {d.ordem}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={'text-corpo-lg font-medium truncate ' + (inativo ? 'text-tx-3' : 'text-tx-1')}
                      title={d.nome}
                    >
                      {d.nome}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Selo tom={disp ? 'ok' : 'warn'}>{disp ? 'Disponível agora' : 'Fora de horário'}</Selo>
                      <span className="text-mini text-tx-3">{usaProprio ? 'horário próprio' : 'segue o comercial'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-bd-1">
                  <span onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      aria-pressed={!inativo}
                      onClick={() => atualizar.mutate({ id: d.id, valores: { ativo: inativo } })}
                      title={inativo ? 'Clique para ativar' : 'Clique para desativar'}
                      className="rounded-1 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]"
                    >
                      <Selo tom={inativo ? 'neutro' : 'ok'}>{inativo ? 'Inativo' : 'Ativo'}</Selo>
                    </button>
                  </span>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <span className="inline-flex items-center gap-1 text-apoio text-tx-2">
                      <Pencil size={14} /> Configurar
                    </span>
                    <span onClick={(e) => e.stopPropagation()}>
                      <Botao
                        variante="perigo"
                        tamanho="sm"
                        aria-label={`Remover ${d.nome}`}
                        onClick={() => {
                          setRemoverDep(d)
                        }}
                      >
                        <Trash2 size={15} />
                      </Botao>
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ModalConfirmar
        aberto={!!removerDep}
        titulo="Remover departamento"
        descricao={
          <>
            O departamento <strong className="text-tx-1">{removerDep?.nome}</strong> sai do menu do bot e dos
            filtros. Chamados que já passaram por ele mantêm o histórico.
          </>
        }
        carregando={remover.isPending}
        erro={erroRemover}
        aoConfirmar={() => {
          if (!removerDep) return
          setErroRemover(null)
          remover.mutate(removerDep.id, {
            onSuccess: () => setRemoverDep(null),
            onError: () => setErroRemover('Não foi possível remover. Tente de novo.'),
          })
        }}
        aoCancelar={() => {
          setRemoverDep(null)
          setErroRemover(null)
        }}
      />

      <Modal titulo="Novo departamento" aberto={aberto} onFechar={() => setAberto(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            criarDepartamento()
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex gap-3">
            <div className="w-24 shrink-0">
              <Entrada rotulo="Número" type="number" min={1} value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div className="flex-1">
              <Entrada rotulo="Nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
          </div>
          <p className="text-apoio text-tx-3">Depois de criar, clique no departamento para configurar motivos e horário.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Botao variante="fantasma" type="button" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao variante="primario" type="submit">
              Enviar
            </Botao>
          </div>
        </form>
      </Modal>
    </div>
  )
}
