# Admin — Configurações BOT, Horário/Plantão e Usuários — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Completar a área Admin com as três telas restantes: Configurações BOT (12 textos + flags), Horário de Funcionamento (comercial + turnos de plantão + plantonistas) e Usuários (vínculo atendente↔departamento).

**Architecture:** Três hooks novos porque os dados aqui não são catálogos simples: `useConfig` (chave-valor com upsert por `chave`), `useBotMensagens` (update por `id`), `useVinculos` (N:N genérico para `atendente_departamentos` e `atendimento_plantao_usuarios`) e `useUsuarios` (leitura dos usuários do painel). Cada tela é uma página fina em `src/pages/admin/`.

**Tech Stack:** React 19, TanStack Query, Supabase JS, Tailwind, lucide-react.

## Global Constraints

- **Visual cru é esperado** (ADR-10: identidade própria vem numa etapa de design no fim). Manter apenas coerência: dark, `text-[#ffffff]` literal, cores sólidas, ícones `lucide-react`, sem emoji.
- **Copy** sem travessão como conector; rótulos no singular quando fizer sentido ("Novo turno").
- **RLS já ativa:** escrita nessas tabelas exige `can('atendimento.config')`. `usuarios` é **read-only** (tabela do painel, nunca escrever).
- `atendimento_config` tem PK **`chave`** (não `id`) — usar `upsert`, não `update ... eq('id')`.
- `atendimento_horarios` **não tem** `updated_at` nem `ordem`; ordenar por `dia_semana`.

## File Structure

- `src/lib/useConfig.ts` — Create: `useConfig`, `useBotMensagens`
- `src/lib/useVinculos.ts` — Create: `useVinculos`, `useUsuarios`
- `src/pages/admin/ConfiguracoesBot.tsx` — Create
- `src/pages/admin/HorarioFuncionamento.tsx` — Create
- `src/pages/admin/Usuarios.tsx` — Create
- `src/pages/Admin.tsx` — Modify: ligar as três rotas (remove todos os placeholders)
- Test: `src/lib/useConfig.test.tsx`

---

## Task 1: Hooks de config, bot, vínculos e usuários

**Files:** Create `src/lib/useConfig.ts`, `src/lib/useVinculos.ts`; Test `src/lib/useConfig.test.tsx`

**Interfaces:**
- Produces:
  - `useConfig()` → `{ lista: UseQueryResult<Record<string,string>>, salvar: Mutation<Record<string,string>> }` (upsert por `chave`)
  - `useBotMensagens()` → `{ lista: UseQueryResult<BotMensagem[]>, salvar: Mutation<{id, texto}> }`, `BotMensagem = { id, chave, texto, ativo }`
  - `useVinculos(tabela, colA, colB)` → `{ lista, vincular, desvincular }` (par `Record<string,string>`)
  - `useUsuarios()` → `UseQueryResult<{ id, nome, email }[]>` (somente ativos, ordenados por nome)

- [ ] **Step 1: Teste do `useConfig`** (`src/lib/useConfig.test.tsx`) — transforma linhas chave/valor num objeto

```tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const select = vi.fn().mockResolvedValue({
  data: [{ chave: 'timezone', valor: 'America/Sao_Paulo' }, { chave: 'avaliacao_ativa', valor: 'true' }],
  error: null,
})
vi.mock('./supabase', () => ({ supabase: { from: vi.fn(() => ({ select })) } }))

import { useConfig } from './useConfig'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useConfig', () => {
  it('devolve as configs como objeto chave/valor', async () => {
    const { result } = renderHook(() => useConfig(), { wrapper })
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))
    expect(result.current.lista.data).toEqual({ timezone: 'America/Sao_Paulo', avaliacao_ativa: 'true' })
  })
})
```

- [ ] **Step 2: Rodar (falha)** — `npm test -- src/lib/useConfig.test.tsx` → FAIL

- [ ] **Step 3: Implementar `src/lib/useConfig.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type BotMensagem = { id: string; chave: string; texto: string; ativo: boolean }

/** atendimento_config: PK é `chave`, então gravamos com upsert. */
export function useConfig() {
  const qc = useQueryClient()
  const lista = useQuery({
    queryKey: ['atendimento_config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('atendimento_config').select('*')
      if (error) throw error
      const linhas = (data ?? []) as { chave: string; valor: string }[]
      return Object.fromEntries(linhas.map((l) => [l.chave, l.valor])) as Record<string, string>
    },
  })

  const salvar = useMutation({
    mutationFn: async (valores: Record<string, string>) => {
      const linhas = Object.entries(valores).map(([chave, valor]) => ({ chave, valor }))
      const { error } = await supabase.from('atendimento_config').upsert(linhas as never)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['atendimento_config'] }),
  })

  return { lista, salvar }
}

export function useBotMensagens() {
  const qc = useQueryClient()
  const lista = useQuery({
    queryKey: ['bot_mensagens'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bot_mensagens').select('*').order('chave')
      if (error) throw error
      return (data ?? []) as unknown as BotMensagem[]
    },
  })

  const salvar = useMutation({
    mutationFn: async ({ id, texto }: { id: string; texto: string }) => {
      const { error } = await supabase.from('bot_mensagens').update({ texto } as never).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bot_mensagens'] }),
  })

  return { lista, salvar }
}
```

- [ ] **Step 4: Implementar `src/lib/useVinculos.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Par = Record<string, string>

/** Vínculo N:N (ex.: atendente_departamentos, atendimento_plantao_usuarios). */
export function useVinculos(tabela: string, colA: string, colB: string) {
  const qc = useQueryClient()
  const lista = useQuery({
    queryKey: [tabela],
    queryFn: async () => {
      const { data, error } = await supabase.from(tabela).select('*')
      if (error) throw error
      return (data ?? []) as unknown as Par[]
    },
  })
  const invalidar = () => qc.invalidateQueries({ queryKey: [tabela] })

  const vincular = useMutation({
    mutationFn: async (par: Par) => {
      const { error } = await supabase.from(tabela).insert(par as never)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  const desvincular = useMutation({
    mutationFn: async (par: Par) => {
      const { error } = await supabase.from(tabela).delete().eq(colA, par[colA]).eq(colB, par[colB])
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  return { lista, vincular, desvincular }
}

export type UsuarioLista = { id: string; nome: string; email: string }

/** usuarios é tabela do painel: somente leitura. */
export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return (data ?? []) as unknown as UsuarioLista[]
    },
  })
}
```

- [ ] **Step 5: Rodar teste + build** — `npm test -- src/lib/useConfig.test.tsx && npm run build` → PASS + ok
- [ ] **Step 6: Commit** — `git commit -m "feat: hooks de config, mensagens do bot, vinculos e usuarios"`

---

## Task 2: Tela Configurações BOT

**Files:** Create `src/pages/admin/ConfiguracoesBot.tsx`; Modify `src/pages/Admin.tsx`

**Interfaces:** Consumes `useBotMensagens`, `useConfig`.

Duas seções: **Mensagens do bot** (textarea por chave, salvar individual) e **Comportamento** (as flags/números de `atendimento_config`, salvar tudo). Rótulos amigáveis por chave, com as variáveis disponíveis explicadas.

- [ ] **Step 1: Implementar `ConfiguracoesBot.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useBotMensagens, useConfig } from '../../lib/useConfig'

const ROTULOS: Record<string, string> = {
  bem_vindo: 'Boas-vindas',
  instrucao_menu: 'Instrução do menu',
  opcao_invalida: 'Opção inválida',
  voltar_menu: 'Voltar ao menu',
  entrou_fila: 'Entrou na fila',
  encaminhado_padrao: 'Encaminhado ao departamento padrão',
  plantao: 'Fora do comercial, em plantão',
  fora_horario: 'Fora de horário (com contatos de emergência)',
  encerramento: 'Encerramento',
  solicitar_avaliacao: 'Pedir avaliação',
  agradecimento_avaliacao: 'Agradecer avaliação',
  avaliacao_invalida: 'Avaliação inválida',
}

const CONFIGS: { chave: string; label: string; tipo: 'numero' | 'booleano' | 'texto' }[] = [
  { chave: 'janela_reabertura_horas', label: 'Janela de reabertura (horas)', tipo: 'numero' },
  { chave: 'max_tentativas_menu', label: 'Tentativas no menu antes de encaminhar', tipo: 'numero' },
  { chave: 'tempo_avaliacao_min', label: 'Tempo para avaliar (minutos)', tipo: 'numero' },
  { chave: 'avaliacao_ativa', label: 'Pedir avaliação ao encerrar', tipo: 'booleano' },
  { chave: 'enviar_nome_atendente', label: 'Enviar o nome do atendente nas respostas', tipo: 'booleano' },
  { chave: 'timezone', label: 'Fuso horário', tipo: 'texto' },
]

export function ConfiguracoesBot() {
  const { lista: mensagens, salvar: salvarMensagem } = useBotMensagens()
  const { lista: config, salvar: salvarConfig } = useConfig()
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [flags, setFlags] = useState<Record<string, string>>({})

  useEffect(() => {
    if (mensagens.data) setTextos(Object.fromEntries(mensagens.data.map((m) => [m.id, m.texto])))
  }, [mensagens.data])
  useEffect(() => {
    if (config.data) setFlags(config.data)
  }, [config.data])

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <section>
        <h2 className="text-[#ffffff] font-bold text-lg mb-1">Mensagens do bot</h2>
        <p className="text-[#ffffffb3] text-sm mb-4">
          Variáveis disponíveis: {'{empresa}'}, {'{contato}'}, {'{protocolo}'}, {'{departamento}'}, {'{atendente}'}, {'{horario}'}.
          O menu de departamentos é montado sozinho, não precisa escrever aqui.
        </p>
        {mensagens.isLoading ? (
          <p className="text-[#ffffffb3]">Carregando…</p>
        ) : (
          <div className="flex flex-col gap-4">
            {(mensagens.data ?? []).map((m) => (
              <div key={m.id} className="flex flex-col gap-1">
                <label className="text-sm text-[#ffffffb3]">{ROTULOS[m.chave] ?? m.chave}</label>
                <textarea
                  value={textos[m.id] ?? ''}
                  onChange={(e) => setTextos((t) => ({ ...t, [m.id]: e.target.value }))}
                  className="rounded px-3 py-2 bg-[#ffffff14] text-[#ffffff] min-h-20"
                />
                <div>
                  <button
                    onClick={() => salvarMensagem.mutate({ id: m.id, texto: textos[m.id] ?? '' })}
                    className="rounded bg-[#0078d4] text-[#ffffff] text-sm px-3 py-1.5"
                  >
                    Salvar mensagem
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[#ffffff] font-bold text-lg mb-4">Comportamento</h2>
        <div className="flex flex-col gap-3">
          {CONFIGS.map((c) => (
            <label key={c.chave} className="flex items-center gap-3 text-sm text-[#ffffffb3]">
              {c.tipo === 'booleano' ? (
                <input
                  type="checkbox"
                  checked={flags[c.chave] === 'true'}
                  onChange={(e) => setFlags((f) => ({ ...f, [c.chave]: String(e.target.checked) }))}
                />
              ) : (
                <input
                  type={c.tipo === 'numero' ? 'number' : 'text'}
                  value={flags[c.chave] ?? ''}
                  onChange={(e) => setFlags((f) => ({ ...f, [c.chave]: e.target.value }))}
                  className="rounded px-3 py-1.5 bg-[#ffffff14] text-[#ffffff] w-48"
                />
              )}
              {c.label}
            </label>
          ))}
          <div>
            <button
              onClick={() => salvarConfig.mutate(flags)}
              className="rounded bg-[#0078d4] text-[#ffffff] text-sm px-3 py-1.5"
            >
              Salvar comportamento
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Ligar a rota `bot` no `Admin.tsx`** (import + `<Route path="bot" element={<ConfiguracoesBot />} />`, acrescentar `'bot'` a `IMPLEMENTADAS`)
- [ ] **Step 3: Build** — `npm run build` → ok
- [ ] **Step 4: Commit** — `git commit -m "feat: tela de configuracoes do bot (textos e comportamento)"`

---

## Task 3: Tela Horário de Funcionamento (comercial + plantão)

**Files:** Create `src/pages/admin/HorarioFuncionamento.tsx`; Modify `src/pages/Admin.tsx`

**Interfaces:** Consumes `useCrud` (para `atendimento_horarios` e `atendimento_plantoes`), `useVinculos('atendimento_plantao_usuarios', 'plantao_id', 'usuario_id')`, `useUsuarios`.

Dois blocos: **Horário comercial** (uma linha por dia da semana) e **Plantões** (turnos + plantonistas marcáveis). Ambos ordenados por `dia_semana`.

- [ ] **Step 1: Implementar `HorarioFuncionamento.tsx`**

```tsx
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { useVinculos, useUsuarios } from '../../lib/useVinculos'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type Horario = { id: string; dia_semana: number; hora_inicio: string; hora_fim: string; ativo: boolean }
type Plantao = { id: string; nome: string | null; dia_semana: number; hora_inicio: string; hora_fim: string; ativo: boolean }

export function HorarioFuncionamento() {
  const horarios = useCrud<Horario>('atendimento_horarios', 'dia_semana')
  const plantoes = useCrud<Plantao>('atendimento_plantoes', 'dia_semana')
  const vinculos = useVinculos('atendimento_plantao_usuarios', 'plantao_id', 'usuario_id')
  const usuarios = useUsuarios()
  const [novo, setNovo] = useState({ nome: '', dia_semana: '1', hora_inicio: '18:00', hora_fim: '21:00' })

  const porDia = (d: number) => (horarios.lista.data ?? []).find((h) => h.dia_semana === d)

  function salvarDia(d: number, campos: Partial<Horario>) {
    const existente = porDia(d)
    if (existente) horarios.atualizar.mutate({ id: existente.id, valores: campos })
    else horarios.criar.mutate({ dia_semana: d, hora_inicio: '08:00', hora_fim: '18:00', ativo: true, ...campos } as Partial<Horario>)
  }

  const plantonistasDe = (plantaoId: string) =>
    (vinculos.lista.data ?? []).filter((v) => v.plantao_id === plantaoId).map((v) => v.usuario_id)

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <section>
        <h2 className="text-[#ffffff] font-bold text-lg mb-1">Horário comercial</h2>
        <p className="text-[#ffffffb3] text-sm mb-4">Fora desses horários o bot usa o plantão, ou avisa que estamos fechados.</p>
        <table className="w-full text-sm text-[#ffffff]">
          <thead className="text-[#ffffffb3] text-left">
            <tr><th className="py-2">Dia</th><th>Abre</th><th>Fecha</th><th>Atende</th></tr>
          </thead>
          <tbody>
            {DIAS.map((nome, d) => {
              const h = porDia(d)
              return (
                <tr key={d} className="border-t border-[#ffffff14]">
                  <td className="py-2">{nome}</td>
                  <td>
                    <input type="time" value={h?.hora_inicio?.slice(0, 5) ?? '08:00'}
                      onChange={(e) => salvarDia(d, { hora_inicio: e.target.value })}
                      className="bg-[#ffffff14] text-[#ffffff] rounded px-2 py-1" />
                  </td>
                  <td>
                    <input type="time" value={h?.hora_fim?.slice(0, 5) ?? '18:00'}
                      onChange={(e) => salvarDia(d, { hora_fim: e.target.value })}
                      className="bg-[#ffffff14] text-[#ffffff] rounded px-2 py-1" />
                  </td>
                  <td>
                    <input type="checkbox" aria-label={`Atende ${nome}`} checked={h?.ativo ?? false}
                      onChange={(e) => salvarDia(d, { ativo: e.target.checked })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-[#ffffff] font-bold text-lg mb-1">Plantões</h2>
        <p className="text-[#ffffffb3] text-sm mb-4">
          Turnos fora do comercial. Marque quem atende cada turno. Turno sem ninguém marcado faz o bot só avisar
          o horário e mostrar os contatos de emergência (texto na aba Configurações BOT).
        </p>

        <div className="flex flex-wrap items-end gap-2 mb-4">
          <input placeholder="Nome do turno" value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
            className="rounded px-3 py-1.5 bg-[#ffffff14] text-[#ffffff]" />
          <select value={novo.dia_semana} onChange={(e) => setNovo({ ...novo, dia_semana: e.target.value })}
            className="rounded px-3 py-1.5 bg-[#ffffff14] text-[#ffffff]">
            {DIAS.map((nome, d) => <option key={d} value={d}>{nome}</option>)}
          </select>
          <input type="time" value={novo.hora_inicio} onChange={(e) => setNovo({ ...novo, hora_inicio: e.target.value })}
            className="rounded px-2 py-1.5 bg-[#ffffff14] text-[#ffffff]" />
          <input type="time" value={novo.hora_fim} onChange={(e) => setNovo({ ...novo, hora_fim: e.target.value })}
            className="rounded px-2 py-1.5 bg-[#ffffff14] text-[#ffffff]" />
          <button
            onClick={() => plantoes.criar.mutate({
              nome: novo.nome || null, dia_semana: Number(novo.dia_semana),
              hora_inicio: novo.hora_inicio, hora_fim: novo.hora_fim, ativo: true,
            } as Partial<Plantao>)}
            className="flex items-center gap-1 rounded bg-[#0078d4] text-[#ffffff] text-sm px-3 py-1.5">
            <Plus size={16} /> Novo turno
          </button>
        </div>

        {(plantoes.lista.data ?? []).length === 0 ? (
          <p className="text-[#ffffffb3]">Nenhum plantão cadastrado.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(plantoes.lista.data ?? []).map((p) => {
              const marcados = plantonistasDe(p.id)
              return (
                <div key={p.id} className="rounded border border-[#ffffff1a] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#ffffff]">
                      {p.nome ? `${p.nome} · ` : ''}{DIAS[p.dia_semana]} {p.hora_inicio?.slice(0, 5)} às {p.hora_fim?.slice(0, 5)}
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-[#ffffffb3] flex items-center gap-1">
                        <input type="checkbox" checked={p.ativo}
                          onChange={(e) => plantoes.atualizar.mutate({ id: p.id, valores: { ativo: e.target.checked } })} />
                        Ativo
                      </label>
                      <button onClick={() => { if (confirm('Remover este turno?')) plantoes.remover.mutate(p.id) }}
                        aria-label="Remover turno" className="text-red-400 hover:text-red-300">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(usuarios.data ?? []).map((u) => {
                      const marcado = marcados.includes(u.id)
                      return (
                        <label key={u.id} className="text-sm text-[#ffffffb3] flex items-center gap-1">
                          <input type="checkbox" checked={marcado}
                            onChange={() =>
                              marcado
                                ? vinculos.desvincular.mutate({ plantao_id: p.id, usuario_id: u.id })
                                : vinculos.vincular.mutate({ plantao_id: p.id, usuario_id: u.id })
                            } />
                          {u.nome}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Ligar a rota `horario`** no `Admin.tsx`
- [ ] **Step 3: Build** — ok
- [ ] **Step 4: Commit** — `git commit -m "feat: tela de horario de funcionamento com plantoes e plantonistas"`

---

## Task 4: Tela Usuários (vínculo com departamentos)

**Files:** Create `src/pages/admin/Usuarios.tsx`; Modify `src/pages/Admin.tsx`

**Interfaces:** Consumes `useUsuarios`, `useCrud<Departamento>('departamentos')`, `useVinculos('atendente_departamentos', 'usuario_id', 'departamento_id')`.

- [ ] **Step 1: Implementar `Usuarios.tsx`**

```tsx
import { useCrud } from '../../lib/useCrud'
import { useVinculos, useUsuarios } from '../../lib/useVinculos'

type Departamento = { id: string; nome: string; ativo: boolean }

export function Usuarios() {
  const usuarios = useUsuarios()
  const departamentos = useCrud<Departamento>('departamentos')
  const vinculos = useVinculos('atendente_departamentos', 'usuario_id', 'departamento_id')

  const deptosDe = (usuarioId: string) =>
    (vinculos.lista.data ?? []).filter((v) => v.usuario_id === usuarioId).map((v) => v.departamento_id)

  return (
    <div className="max-w-3xl">
      <h2 className="text-[#ffffff] font-bold text-lg mb-1">Usuários</h2>
      <p className="text-[#ffffffb3] text-sm mb-4">
        A lista vem do painel. Marque os departamentos que cada atendente atende: é isso que define quais filas ele enxerga.
      </p>

      {usuarios.isLoading ? (
        <p className="text-[#ffffffb3]">Carregando…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {(usuarios.data ?? []).map((u) => {
            const marcados = deptosDe(u.id)
            return (
              <div key={u.id} className="rounded border border-[#ffffff1a] p-3">
                <div className="text-[#ffffff] mb-2">
                  {u.nome} <span className="text-[#ffffffb3] text-sm">{u.email}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {(departamentos.lista.data ?? []).map((d) => {
                    const marcado = marcados.includes(d.id)
                    return (
                      <label key={d.id} className="text-sm text-[#ffffffb3] flex items-center gap-1">
                        <input type="checkbox" checked={marcado}
                          onChange={() =>
                            marcado
                              ? vinculos.desvincular.mutate({ usuario_id: u.id, departamento_id: d.id })
                              : vinculos.vincular.mutate({ usuario_id: u.id, departamento_id: d.id })
                          } />
                        {d.nome}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Ligar a rota `usuarios`** no `Admin.tsx` e **remover o bloco de placeholders** (todas as abas passam a ter tela)
- [ ] **Step 3: Rodar tudo** — `npm test && npm run build` → verde
- [ ] **Step 4: Commit** — `git commit -m "feat: tela de usuarios com vinculo de departamentos"`

---

## Task 5: Validação no navegador

- [ ] **Step 1:** Logar como admin, abrir `/admin/bot`: os 12 textos aparecem preenchidos com o seed. Editar um e salvar; recarregar e confirmar que persistiu.
- [ ] **Step 2:** `/admin/horario`: marcar Segunda como ativo com 08:00–18:00 (cria a linha), criar um turno de plantão e marcar você mesmo como plantonista. Recarregar e conferir.
- [ ] **Step 3:** `/admin/usuarios`: marcar um departamento para o seu usuário. Recarregar e conferir. **Isso é pré-requisito da Inbox** (sem vínculo, a RLS não mostra fila nenhuma).
- [ ] **Step 4:** `npm test` verde, `npm run build` ok.

## Self-Review

- Cobertura: as 3 abas restantes do mapa do admin. Depois disso, o admin fica completo (Dashboard e Relatórios seguem placeholders de Fase 3, conforme o design).
- `atendimento_config` usa upsert (PK `chave`), `usuarios` é read-only, `atendimento_horarios` sem `ordem`/`updated_at` — todos tratados.
- Visual cru é esperado (ADR-10).

Ao concluir, seguir para a **Inbox** (com adapter mock e bot simulado).
