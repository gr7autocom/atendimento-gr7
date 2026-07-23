# Admin — Catálogos (CRUD) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Deixar funcionais as 4 abas de catálogo do Admin (Departamentos, Tags, Motivos, Mensagens rápidas) sobre as tabelas já criadas no Plano 2, com uma base de CRUD reutilizável.

**Architecture:** Camada de dados genérica com TanStack Query (`useCrud`) sobre o Supabase; um componente `CatalogoCrud` dirigido por config de campos (lista + modal de form + ativar/editar/remover); uma página fina por aba passando a config. Substitui os placeholders do `Admin.tsx`.

**Tech Stack:** React 19, TanStack Query, Supabase JS, Tailwind (tokens dark), lucide-react, Zod (validação de form).

## Global Constraints

- **Tema dark** com tokens do painel; cor branca literal `text-[#ffffff]` (gotcha da escala invertida). Cores sólidas, sem gradiente. Ícones só `lucide-react`, sem emoji.
- **Copy** sem travessão como conector; identificadores em português.
- **RLS já aplicada** (Plano 2): escrita nos catálogos exige `can('atendimento.config')` (perfil admin). O usuário logado no teste é admin.
- **Rota já existe:** `Admin.tsx` monta `/admin/<slug>`; a guarda `requireAdmin` já protege a área.
- Só o admin acessa; nada de multi-tenancy.

## File Structure

- `src/lib/useCrud.ts` — Create: hooks TanStack Query genéricos (lista/criar/atualizar/remover)
- `src/components/admin/AdminModal.tsx` — Create: modal simples (dark, fecha no overlay/Esc)
- `src/components/admin/CatalogoCrud.tsx` — Create: CRUD genérico dirigido por config de campos
- `src/pages/admin/Departamentos.tsx` — Create
- `src/pages/admin/Tags.tsx` — Create
- `src/pages/admin/Motivos.tsx` — Create
- `src/pages/admin/MensagensRapidas.tsx` — Create
- `src/pages/Admin.tsx` — Modify: renderizar as páginas reais nas rotas
- Test: `src/lib/useCrud.test.tsx`, `src/components/admin/CatalogoCrud.test.tsx`

---

## Task 1: Camada de dados (`useCrud`)

**Files:** Create `src/lib/useCrud.ts`, Test `src/lib/useCrud.test.tsx`

**Interfaces:**
- Consumes: `supabase` (Plano 1).
- Produces: `useCrud<T>(tabela, orderBy?)` → `{ lista: UseQueryResult<T[]>, criar, atualizar, remover }` (as três mutations invalidam a query da tabela no sucesso).

- [ ] **Step 1: Escrever o teste** (`useCrud.test.tsx`) — a query chama `.from(tabela).select().order()` e devolve os dados

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const order = vi.fn().mockResolvedValue({ data: [{ id: '1', nome: 'Suporte' }], error: null })
const select = vi.fn(() => ({ order }))
vi.mock('./supabase', () => ({ supabase: { from: vi.fn(() => ({ select })) } }))

import { useCrud } from './useCrud'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useCrud', () => {
  beforeEach(() => vi.clearAllMocks())
  it('lista itens ordenados da tabela', async () => {
    const { result } = renderHook(() => useCrud('departamentos'), { wrapper })
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))
    expect(result.current.lista.data).toEqual([{ id: '1', nome: 'Suporte' }])
    expect(select).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar (deve falhar — módulo não existe)**

Run: `npm test -- src/lib/useCrud.test.tsx`
Expected: FAIL (Cannot find module './useCrud').

- [ ] **Step 3: Implementar `src/lib/useCrud.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export function useCrud<T extends { id: string }>(tabela: string, orderBy = 'ordem') {
  const qc = useQueryClient()
  const invalidar = () => qc.invalidateQueries({ queryKey: [tabela] })

  const lista = useQuery({
    queryKey: [tabela],
    queryFn: async () => {
      const { data, error } = await supabase.from(tabela).select('*').order(orderBy)
      if (error) throw error
      return (data ?? []) as T[]
    },
  })

  const criar = useMutation({
    mutationFn: async (valores: Partial<T>) => {
      const { error } = await supabase.from(tabela).insert(valores)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, valores }: { id: string; valores: Partial<T> }) => {
      const { error } = await supabase.from(tabela).update(valores).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tabela).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  return { lista, criar, atualizar, remover }
}
```

- [ ] **Step 4: Rodar (deve passar)** — `npm test -- src/lib/useCrud.test.tsx` → PASS
- [ ] **Step 5: Commit** — `git add src/lib/useCrud.ts src/lib/useCrud.test.tsx && git commit -m "feat: hook generico de CRUD (TanStack Query + Supabase)"`

---

## Task 2: Modal do Admin

**Files:** Create `src/components/admin/AdminModal.tsx`

**Interfaces:**
- Produces: `<AdminModal titulo aberto onFechar>{children}</AdminModal>` — overlay escuro, fecha no clique fora e no Esc.

- [ ] **Step 1: Implementar `AdminModal.tsx`**

```tsx
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function AdminModal({
  titulo, aberto, onFechar, children,
}: { titulo: string; aberto: boolean; onFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto, onFechar])

  if (!aberto) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-md rounded-lg bg-[#1e1e1e] border border-[#ffffff1a] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#ffffff] font-bold">{titulo}</h2>
          <button onClick={onFechar} aria-label="Fechar" className="text-[#ffffffb3] hover:text-[#ffffff]">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build sanity** — `npm run build` → sem erro
- [ ] **Step 3: Commit** — `git add src/components/admin/AdminModal.tsx && git commit -m "feat: modal base do admin"`

---

## Task 3: Componente `CatalogoCrud` + aba Departamentos

**Files:** Create `src/components/admin/CatalogoCrud.tsx`, `src/pages/admin/Departamentos.tsx`; Modify `src/pages/Admin.tsx`; Test `src/components/admin/CatalogoCrud.test.tsx`

**Interfaces:**
- Consumes: `useCrud`, `AdminModal`.
- Produces: `<CatalogoCrud titulo tabela campos colunas orderBy? />`. `Campo = { nome, label, tipo: 'texto'|'numero'|'textarea', obrigatorio? }`. Renderiza lista (colunas + ativo + ações) e modal de form para criar/editar; alterna `ativo`; remove com confirmação.

- [ ] **Step 1: Escrever o teste** (`CatalogoCrud.test.tsx`) — mostra os itens da lista

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../lib/useCrud', () => ({
  useCrud: () => ({
    lista: { data: [{ id: '1', nome: 'Suporte Geral', ordem: 1, ativo: true }], isLoading: false },
    criar: { mutate: vi.fn() }, atualizar: { mutate: vi.fn() }, remover: { mutate: vi.fn() },
  }),
}))

import { CatalogoCrud } from './CatalogoCrud'

it('lista os itens do catalogo', () => {
  const qc = new QueryClient()
  render(
    <QueryClientProvider client={qc}>
      <CatalogoCrud titulo="Departamentos" tabela="departamentos"
        campos={[{ nome: 'nome', label: 'Nome', tipo: 'texto', obrigatorio: true }]}
        colunas={['nome']} />
    </QueryClientProvider>
  )
  expect(screen.getByText('Suporte Geral')).toBeInTheDocument()
})
```

- [ ] **Step 2: Rodar (falha)** — `npm test -- src/components/admin/CatalogoCrud.test.tsx` → FAIL

- [ ] **Step 3: Implementar `CatalogoCrud.tsx`**

```tsx
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
  titulo, tabela, campos, colunas, orderBy = 'ordem',
}: { titulo: string; tabela: string; campos: Campo[]; colunas: string[]; orderBy?: string }) {
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
        <button onClick={abrirNovo}
          className="flex items-center gap-1 rounded bg-[#0078d4] text-[#ffffff] text-sm px-3 py-1.5">
          <Plus size={16} /> Novo
        </button>
      </div>

      {lista.isLoading ? (
        <p className="text-[#ffffffb3]">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="text-[#ffffffb3]">Nada cadastrado ainda. Clique em Novo para começar.</p>
      ) : (
        <table className="w-full text-sm text-[#ffffff]">
          <thead className="text-[#ffffffb3] text-left">
            <tr>
              {campos.filter((c) => colunas.includes(c.nome)).map((c) => (
                <th key={c.nome} className="py-2 pr-3">{c.label}</th>
              ))}
              <th className="py-2 pr-3">Ativo</th>
              <th className="py-2 w-20">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((r) => (
              <tr key={r.id} className="border-t border-[#ffffff14]">
                {colunas.map((col) => (
                  <td key={col} className="py-2 pr-3">{String(r[col] ?? '')}</td>
                ))}
                <td className="py-2 pr-3">
                  <input type="checkbox" checked={r.ativo !== false}
                    onChange={(e) => atualizar.mutate({ id: r.id, valores: { ativo: e.target.checked } })} />
                </td>
                <td className="py-2 flex gap-2">
                  <button onClick={() => abrirEdicao(r)} aria-label="Editar" className="text-[#ffffffb3] hover:text-[#ffffff]">
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => { if (confirm('Remover este item?')) remover.mutate(r.id) }}
                    aria-label="Remover" className="text-red-400 hover:text-red-300">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AdminModal titulo={editando ? `Editar ${titulo}` : `Novo ${titulo}`} aberto={aberto} onFechar={() => setAberto(false)}>
        <form onSubmit={(e) => { e.preventDefault(); salvar() }} className="flex flex-col gap-3">
          {campos.map((c) => (
            <label key={c.nome} className="flex flex-col gap-1 text-sm text-[#ffffffb3]">
              {c.label}
              {c.tipo === 'textarea' ? (
                <textarea required={c.obrigatorio} value={form[c.nome] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [c.nome]: e.target.value }))}
                  className="rounded px-3 py-2 bg-[#ffffff14] text-[#ffffff] min-h-24" />
              ) : (
                <input type={c.tipo === 'numero' ? 'number' : 'text'} required={c.obrigatorio}
                  value={form[c.nome] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [c.nome]: e.target.value }))}
                  className="rounded px-3 py-2 bg-[#ffffff14] text-[#ffffff]" />
              )}
            </label>
          ))}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setAberto(false)} className="px-3 py-1.5 text-[#ffffffb3]">Cancelar</button>
            <button type="submit" className="rounded bg-[#0078d4] text-[#ffffff] px-3 py-1.5">Salvar</button>
          </div>
        </form>
      </AdminModal>
    </div>
  )
}
```

- [ ] **Step 4: Criar `src/pages/admin/Departamentos.tsx`**

```tsx
import { CatalogoCrud } from '../../components/admin/CatalogoCrud'

export function Departamentos() {
  return (
    <CatalogoCrud
      titulo="Departamentos"
      tabela="departamentos"
      campos={[
        { nome: 'nome', label: 'Nome', tipo: 'texto', obrigatorio: true },
        { nome: 'ordem', label: 'Ordem no menu', tipo: 'numero' },
      ]}
      colunas={['nome', 'ordem']}
    />
  )
}
```

- [ ] **Step 5: Ligar no `Admin.tsx`** — substituir o placeholder da rota `departamentos` pela página real. Trocar a linha do `<Route path={a.slug} ...>` para renderizar `<Departamentos />` quando `a.slug === 'departamentos'` (manter placeholder nas demais). Import no topo: `import { Departamentos } from './admin/Departamentos'`. Exemplo do bloco de rotas:

```tsx
<Routes>
  <Route index element={<Navigate to="departamentos" replace />} />
  <Route path="departamentos" element={<Departamentos />} />
  {ABAS.filter((a) => a.slug !== 'departamentos').map((a) => (
    <Route key={a.slug} path={a.slug} element={<p className="text-[#ffffffb3]">{a.label}: em construção.</p>} />
  ))}
</Routes>
```

- [ ] **Step 6: Rodar teste + build** — `npm test -- src/components/admin/CatalogoCrud.test.tsx && npm run build` → PASS + build ok
- [ ] **Step 7: Commit** — `git add src/components/admin/ src/pages/admin/Departamentos.tsx src/pages/Admin.tsx src/components/admin/CatalogoCrud.test.tsx && git commit -m "feat: CRUD de catalogo generico + aba Departamentos"`

---

## Task 4: Abas Tags, Motivos e Mensagens rápidas

**Files:** Create `src/pages/admin/Tags.tsx`, `Motivos.tsx`, `MensagensRapidas.tsx`; Modify `src/pages/Admin.tsx`

**Interfaces:**
- Consumes: `CatalogoCrud`.

- [ ] **Step 1: `src/pages/admin/Tags.tsx`**

```tsx
import { CatalogoCrud } from '../../components/admin/CatalogoCrud'

export function Tags() {
  return (
    <CatalogoCrud titulo="Tags" tabela="atendimento_tags"
      campos={[
        { nome: 'nome', label: 'Nome', tipo: 'texto', obrigatorio: true },
        { nome: 'ordem', label: 'Ordem', tipo: 'numero' },
      ]}
      colunas={['nome', 'ordem']} />
  )
}
```

- [ ] **Step 2: `src/pages/admin/Motivos.tsx`** (idêntico a Tags, tabela `atendimento_motivos`, titulo "Motivos")

```tsx
import { CatalogoCrud } from '../../components/admin/CatalogoCrud'

export function Motivos() {
  return (
    <CatalogoCrud titulo="Motivos" tabela="atendimento_motivos"
      campos={[
        { nome: 'nome', label: 'Nome', tipo: 'texto', obrigatorio: true },
        { nome: 'ordem', label: 'Ordem', tipo: 'numero' },
      ]}
      colunas={['nome', 'ordem']} />
  )
}
```

- [ ] **Step 3: `src/pages/admin/MensagensRapidas.tsx`** (tabela `atendimento_mensagens_rapidas`, ordena por `atalho`)

```tsx
import { CatalogoCrud } from '../../components/admin/CatalogoCrud'

export function MensagensRapidas() {
  return (
    <CatalogoCrud titulo="Mensagens rápidas" tabela="atendimento_mensagens_rapidas" orderBy="atalho"
      campos={[
        { nome: 'atalho', label: 'Atalho (após a /)', tipo: 'texto', obrigatorio: true },
        { nome: 'titulo', label: 'Título', tipo: 'texto', obrigatorio: true },
        { nome: 'texto', label: 'Texto', tipo: 'textarea', obrigatorio: true },
      ]}
      colunas={['atalho', 'titulo']} />
  )
}
```

- [ ] **Step 4: Ligar as três no `Admin.tsx`** — adicionar imports e `<Route>` para `tags`, `motivos`, `mensagens-rapidas`, seguindo o mesmo padrão da rota `departamentos`. O filtro do placeholder passa a excluir todas as abas já implementadas:

```tsx
const IMPLEMENTADAS = new Set(['departamentos', 'tags', 'motivos', 'mensagens-rapidas'])
// ...
<Route path="tags" element={<Tags />} />
<Route path="motivos" element={<Motivos />} />
<Route path="mensagens-rapidas" element={<MensagensRapidas />} />
{ABAS.filter((a) => !IMPLEMENTADAS.has(a.slug)).map((a) => (
  <Route key={a.slug} path={a.slug} element={<p className="text-[#ffffffb3]">{a.label}: em construção.</p>} />
))}
```

- [ ] **Step 5: Build** — `npm run build` → sem erro
- [ ] **Step 6: Commit** — `git add src/pages/admin/ src/pages/Admin.tsx && git commit -m "feat: abas Tags, Motivos e Mensagens rapidas"`

---

## Task 5: Validação no navegador

- [ ] **Step 1:** `npm run dev`, logar como admin, abrir `/admin/departamentos`: aparecem os 6 departamentos semeados. Criar um novo, editar, alternar ativo, remover. Repetir uma verificação rápida em Tags (5 itens) e Mensagens rápidas (vazio, criar um).
- [ ] **Step 2:** Confirmar que as escritas persistem (recarregar a página e ver o item). Isso valida a RLS de escrita com `can('atendimento.config')` do admin de ponta a ponta.
- [ ] **Step 3:** `npm test` verde, `npm run build` sem erro.

## Self-Review (checklist)

- Cobertura: as 4 abas de catálogo do mapa do admin (Departamentos, Tags, Motivos, Mensagens rápidas) implementadas. As demais (BOT, Horário, Usuários) ficam no Plano 4 — declarado no escopo.
- Sem placeholders de código. Tipos consistentes (`Campo`, `useCrud<T>`).
- RLS: escrita depende de `can('atendimento.config')` (admin). Testar com admin real.

Ao concluir, seguir para o **Plano 4 (Admin — Configurações BOT, Horário de Funcionamento, Usuários)**.
