import { useState } from 'react'
import { Plus, Pencil, Trash2, Inbox } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { Modal } from '../ui/Modal'
import { Botao } from '../ui/Botao'
import { Entrada, AreaTexto } from '../ui/Campo'
import { Tabela, Th, Tr, Td } from '../ui/Tabela'
import { Vazio, LinhasCarregando } from '../ui/Estados'

export type Campo = {
  nome: string
  label: string
  tipo: 'texto' | 'numero' | 'textarea'
  obrigatorio?: boolean
}

type Registro = { id: string; ativo?: boolean; [k: string]: unknown }

export function CatalogoCrud({
  titulo,
  singular,
  descricao,
  tabela,
  campos,
  colunas,
  orderBy = 'ordem',
}: {
  titulo: string
  /** Nome no singular, usado no título do formulário ("Novo departamento"). */
  singular?: string
  descricao?: string
  tabela: string
  campos: Campo[]
  colunas: string[]
  orderBy?: string
}) {
  const nomeForm = singular ?? titulo
  const { lista, criar, atualizar, remover } = useCrud<Registro>(tabela, orderBy)
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Registro | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})

  function abrirNovo() {
    setEditando(null)
    setForm({})
    setAberto(true)
  }

  function abrirEdicao(r: Registro) {
    setEditando(r)
    setForm(Object.fromEntries(campos.map((c) => [c.nome, String(r[c.nome] ?? '')])))
    setAberto(true)
  }

  function salvar() {
    const valores: Record<string, unknown> = {}
    for (const c of campos) {
      const v = form[c.nome] ?? ''
      valores[c.nome] = c.tipo === 'numero' ? Number(v || 0) : v
    }
    if (editando) atualizar.mutate({ id: editando.id, valores })
    else criar.mutate(valores)
    setAberto(false)
  }

  const itens = lista.data ?? []
  const colunasVisiveis = campos.filter((c) => colunas.includes(c.nome))

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-tx-1">{titulo}</h2>
          {descricao && <p className="text-[13px] text-tx-2 mt-0.5">{descricao}</p>}
        </div>
        <Botao variante="primario" tamanho="sm" onClick={abrirNovo} icone={<Plus size={15} />}>
          Novo
        </Botao>
      </div>

      {lista.isLoading ? (
        <LinhasCarregando />
      ) : itens.length === 0 ? (
        <div className="rounded-[10px] border border-bd-1 bg-sf-1">
          <Vazio
            icone={<Inbox size={22} />}
            titulo="Nada cadastrado ainda"
            descricao={`Clique em Novo para criar o primeiro ${nomeForm}.`}
            acao={
              <Botao variante="neutro" tamanho="sm" onClick={abrirNovo} icone={<Plus size={15} />}>
                Novo
              </Botao>
            }
          />
        </div>
      ) : (
        <Tabela
          cabecalho={
            <>
              {colunasVisiveis.map((c) => (
                <Th key={c.nome}>{c.label}</Th>
              ))}
              <Th className="w-16">Ativo</Th>
              <Th className="w-20 text-right">Ações</Th>
            </>
          }
        >
          {itens.map((r) => (
            <Tr key={r.id}>
              {colunas.map((col, i) => (
                <Td key={col} className={i === 0 ? 'font-medium' : 'text-tx-2'}>
                  {String(r[col] ?? '')}
                </Td>
              ))}
              <Td>
                <input
                  type="checkbox"
                  className="accent-[color:var(--br-1)]"
                  checked={r.ativo !== false}
                  aria-label={`Ativo: ${String(r[colunas[0]] ?? '')}`}
                  onChange={(e) => atualizar.mutate({ id: r.id, valores: { ativo: e.target.checked } })}
                />
              </Td>
              <Td>
                <div className="flex items-center justify-end gap-0.5">
                  <Botao variante="fantasma" tamanho="sm" aria-label="Editar" onClick={() => abrirEdicao(r)}>
                    <Pencil size={15} />
                  </Botao>
                  <Botao
                    variante="perigo"
                    tamanho="sm"
                    aria-label="Remover"
                    onClick={() => {
                      if (confirm('Remover este item?')) remover.mutate(r.id)
                    }}
                  >
                    <Trash2 size={15} />
                  </Botao>
                </div>
              </Td>
            </Tr>
          ))}
        </Tabela>
      )}

      <Modal
        titulo={editando ? `Editar ${nomeForm}` : `Novo ${nomeForm}`}
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
          {campos.map((c) =>
            c.tipo === 'textarea' ? (
              <AreaTexto
                key={c.nome}
                rotulo={c.label}
                required={c.obrigatorio}
                value={form[c.nome] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [c.nome]: e.target.value }))}
              />
            ) : (
              <Entrada
                key={c.nome}
                rotulo={c.label}
                type={c.tipo === 'numero' ? 'number' : 'text'}
                required={c.obrigatorio}
                value={form[c.nome] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [c.nome]: e.target.value }))}
              />
            )
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Botao variante="fantasma" type="button" onClick={() => setAberto(false)}>
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
