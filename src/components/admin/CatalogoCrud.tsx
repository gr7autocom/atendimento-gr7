import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { AdminModal } from './AdminModal'

export type Campo = {
  nome: string
  label: string
  tipo: 'texto' | 'numero' | 'textarea'
  obrigatorio?: boolean
}

type Registro = { id: string; ativo?: boolean; [k: string]: unknown }

export function CatalogoCrud({
  titulo,
  tabela,
  campos,
  colunas,
  orderBy = 'ordem',
}: {
  titulo: string
  tabela: string
  campos: Campo[]
  colunas: string[]
  orderBy?: string
}) {
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[#ffffff] font-bold text-lg">{titulo}</h2>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-1 rounded bg-[#0078d4] text-[#ffffff] text-sm px-3 py-1.5"
        >
          <Plus size={16} /> Novo
        </button>
      </div>

      {lista.isLoading ? (
        <p className="text-[#ffffffb3]">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="text-[#ffffffb3]">Nada cadastrado ainda. Clique em Novo para começar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-[#ffffff]">
            <thead className="text-[#ffffffb3] text-left">
              <tr>
                {campos
                  .filter((c) => colunas.includes(c.nome))
                  .map((c) => (
                    <th key={c.nome} className="py-2 pr-3">
                      {c.label}
                    </th>
                  ))}
                <th className="py-2 pr-3">Ativo</th>
                <th className="py-2 w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((r) => (
                <tr key={r.id} className="border-t border-[#ffffff14]">
                  {colunas.map((col) => (
                    <td key={col} className="py-2 pr-3">
                      {String(r[col] ?? '')}
                    </td>
                  ))}
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={r.ativo !== false}
                      aria-label={`Ativo: ${String(r[colunas[0]] ?? '')}`}
                      onChange={(e) => atualizar.mutate({ id: r.id, valores: { ativo: e.target.checked } })}
                    />
                  </td>
                  <td className="py-2 flex gap-2">
                    <button
                      onClick={() => abrirEdicao(r)}
                      aria-label="Editar"
                      className="text-[#ffffffb3] hover:text-[#ffffff]"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Remover este item?')) remover.mutate(r.id)
                      }}
                      aria-label="Remover"
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminModal
        titulo={editando ? `Editar ${titulo}` : `Novo ${titulo}`}
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
          {campos.map((c) => (
            <label key={c.nome} className="flex flex-col gap-1 text-sm text-[#ffffffb3]">
              {c.label}
              {c.tipo === 'textarea' ? (
                <textarea
                  required={c.obrigatorio}
                  value={form[c.nome] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [c.nome]: e.target.value }))}
                  className="rounded px-3 py-2 bg-[#ffffff14] text-[#ffffff] min-h-24"
                />
              ) : (
                <input
                  type={c.tipo === 'numero' ? 'number' : 'text'}
                  required={c.obrigatorio}
                  value={form[c.nome] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [c.nome]: e.target.value }))}
                  className="rounded px-3 py-2 bg-[#ffffff14] text-[#ffffff]"
                />
              )}
            </label>
          ))}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setAberto(false)} className="px-3 py-1.5 text-[#ffffffb3]">
              Cancelar
            </button>
            <button type="submit" className="rounded bg-[#0078d4] text-[#ffffff] px-3 py-1.5">
              Salvar
            </button>
          </div>
        </form>
      </AdminModal>
    </div>
  )
}
