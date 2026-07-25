import { useState } from 'react'
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { corSetor } from '../../lib/coresSetor'
import { Modal } from '../../components/ui/Modal'
import { Botao } from '../../components/ui/Botao'
import { Entrada } from '../../components/ui/Campo'
import { CabecalhoAdmin } from '../../components/admin/CabecalhoAdmin'
import { Selo } from '../../components/ui/Selo'
import { Vazio, Skeleton } from '../../components/ui/Estados'

type Departamento = {
  id: string
  nome: string
  ordem: number
  ativo?: boolean
}

export function Departamentos() {
  const { lista, criar, atualizar, remover } = useCrud<Departamento>('departamentos')
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Departamento | null>(null)
  const [nome, setNome] = useState('')
  const [numero, setNumero] = useState('')

  function abrirNovo() {
    setEditando(null)
    setNome('')
    // Sugere o próximo número na sequência para não deixar o atendente adivinhar.
    const maior = itens.reduce((m, d) => Math.max(m, d.ordem ?? 0), 0)
    setNumero(String(maior + 1))
    setAberto(true)
  }

  function abrirEdicao(d: Departamento) {
    setEditando(d)
    setNome(d.nome ?? '')
    setNumero(String(d.ordem ?? ''))
    setAberto(true)
  }

  function salvar() {
    const valores = { nome: nome.trim(), ordem: Number(numero || 0) }
    if (editando) atualizar.mutate({ id: editando.id, valores })
    else criar.mutate(valores)
    setAberto(false)
  }

  const itens = lista.data ?? []

  return (
    <div className="w-full">
      <CabecalhoAdmin
        titulo="Departamentos"
        descricao="Filas de atendimento. O número define a ordem no menu do bot."
        acoes={
          <Botao variante="primario" tamanho="sm" onClick={abrirNovo} icone={<Plus size={15} />}>
            Novo departamento
          </Botao>
        }
      />

      {lista.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
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
                      className={
                        'text-sm font-medium truncate ' + (inativo ? 'text-tx-3' : 'text-tx-1')
                      }
                      title={d.nome}
                    >
                      {d.nome}
                    </p>
                    <p className="text-[12px] text-tx-3 mt-0.5">Número {d.ordem}</p>
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
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      aria-label={`Editar ${d.nome}`}
                      onClick={() => abrirEdicao(d)}
                    >
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
        <form
          onSubmit={(e) => {
            e.preventDefault()
            salvar()
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex gap-3">
            <div className="w-24 shrink-0">
              <Entrada
                rotulo="Número"
                type="number"
                min={1}
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Entrada
                rotulo="Nome"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Botao variante="fantasma" type="button" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao variante="primario" type="submit">
              {editando ? 'Salvar' : 'Enviar'}
            </Botao>
          </div>
        </form>
      </Modal>
    </div>
  )
}
