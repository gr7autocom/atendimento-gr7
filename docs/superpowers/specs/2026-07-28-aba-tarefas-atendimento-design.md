# Aba Tarefas no painel do contato — design

> Feature: o atendente cria uma **tarefa avulsa** direto do chat, que é atribuída e trabalhada no **Painel de Implantação**. No Atendimento a seção serve para **abrir** a tarefa e **acompanhar** (só leitura) o que já foi aberto para aquele contato.

Data: 2026-07-28 · Branch base: `feat/fundacao`

## Contexto

A tabela `public.tarefas` já existe no Supabase compartilhado (fonte: painel). Uma **tarefa avulsa** é definida por `de_projeto = FALSE` (com `projeto_id` e `tarefa_pai_id` nulos). O único campo obrigatório no banco é `titulo`; todo o resto é nullable. A criação no painel é `insert` direto no `supabase-js` (não há RPC/Edge Function de criação).

O contato do Atendimento já se liga à empresa do painel por `contatos.cliente_id → clientes.id` — o mesmo destino de `tarefas.cliente_id`. Isso permite auto-vincular a tarefa ao cliente sem fricção.

### Regra inviolável (isolamento do painel)
- **Migrations só aditivas.** A única mudança de schema é `CREATE TABLE atendimento_tarefas`. **Nenhum `ALTER`/`DROP`** em tabela do painel. A migration mora no repo do painel (`painel-implantacao-v2/supabase/migrations/`), prefixo `atendimento_`.
- O código do Atendimento **não importa** do painel; escreve/lê direto nas tabelas compartilhadas respeitando a RLS.

## Decisões (definidas com o usuário)

| Tema | Decisão |
|---|---|
| Escopo da seção | **Criar + listar** (só leitura; andamento é no painel) |
| Campos do formulário | **Enxuto**: título, descrição, responsável, prazo, prioridade |
| Responsável | **"Para mim" por padrão**; pode trocar por outro usuário ou "Em aberto (sem responsável)" |
| Vínculo com cliente | **Auto-vincular** ao `cliente_id` do contato (se houver); sem empresa, fica sem cliente |
| Associação/listagem | **Opção B**: tabela de vínculo `atendimento_tarefas` (lista o que foi aberto pelo chat para aquele contato) |

## Modelo de dados

### Tabela existente `tarefas` (campos usados na criação)
`titulo` (NOT NULL), `descricao`, `responsavel_id → usuarios(id)`, `prazo_entrega` (timestamptz), `prioridade_id → prioridades(id)`, `cliente_id → clientes(id)`, `etapa_id → etapas(id)`, `criado_por_id → usuarios(id)`, `de_projeto` (bool NOT NULL), `updated_at`.

Cuidados: `de_projeto` é **imutável** após criação (trigger). Categoria/classificação ficam nulas (não usamos), então o trigger de coerência categoria↔classificação não dispara.

### Tabela nova `atendimento_tarefas` (migration aditiva, repo do painel)

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `tarefa_id` | uuid FK `tarefas(id)` ON DELETE CASCADE | UNIQUE (uma tarefa vinculada uma vez) |
| `atendimento_id` | uuid FK `atendimentos(id)` ON DELETE CASCADE | de qual chamado nasceu |
| `contato_id` | uuid FK `contatos(id)` ON DELETE CASCADE | para listar por contato |
| `criado_por` | uuid FK `usuarios(id)` ON DELETE SET NULL | atendente que abriu |
| `created_at` | timestamptz | `NOW()` |

Índices: em `contato_id` e `atendimento_id` (consulta da lista). RLS habilitada.

## UI / componentes (Atendimento)

- **`src/components/inbox/TarefasContato.tsx`** (novo): conteúdo da seção. Renderizado dentro de um `SecaoContato` ("Tarefas", com contagem) em `PainelContato.tsx`, no mesmo padrão de "Participantes".
- **Estado vazio**: texto curto orientando a abrir a primeira tarefa (copy via skill `copywriting`).
- **Botão "Nova tarefa"**: visível só para quem tem a capacidade `tarefa.criar` (ver Permissões). Abre o formulário inline (não modal grande — é enxuto).
- **Formulário (enxuto):**
  - Título* — obrigatório, forçado UPPERCASE (paridade com o painel).
  - Descrição — textarea, opcional.
  - Responsável — select `Em aberto (sem responsável)` + usuários ativos; **default = usuário atual**.
  - Prazo — data + hora, opcional (sem default forçado).
  - Prioridade — select opcional (Baixa/Média/Alta/Urgente, de `prioridades` por `nivel`).
- **Lista (só leitura):** por tarefa — título, status (nome da etapa), responsável, prazo formatado, pílula de prioridade. Ordenada por `created_at desc`. Sem edição no Atendimento.

Visual: tema dark, tokens próprios (`sf-*`, `bd-*`, `tx-*`, `br-*`, `err/err-soft`), sem gradiente, sem emoji, ícones `lucide-react`. Acionar skill de design (`frontend-design`) antes de escrever a tela.

## Hooks de dados (`src/lib/useInbox.ts`)

- **`useCatalogosTarefa()`**: carrega `prioridades` (ativo, order `nivel`) e a `etapa` "Pendente" (id para o insert). Responsável reaproveita o hook de usuários já existente (`useUsuarios`).
- **`useTarefasDoContato(contatoId)`**: lista via `atendimento_tarefas` → embed da `tarefa` (título, prazo, prioridade, etapa nome, responsável nome). Filtro `contato_id = contatoId`.
- **`useCriarTarefa()`**: mutation TanStack Query. Passos:
  1. `insert` em `tarefas` (payload abaixo) → retorna `id`.
  2. `insert` em `atendimento_tarefas` (tarefa_id, atendimento_id, contato_id, criado_por).
  3. Se `responsavel_id` existe e ≠ criador → invocar Edge Function `notify-assignment` (paridade com o painel).
  4. Invalidar as queries de lista e contagem.

Payload do insert em `tarefas`:
```
{
  titulo,                       // trim, UPPERCASE
  descricao: descricao || null,
  responsavel_id: responsavel_id || null,
  prazo_entrega: prazoIso || null,
  prioridade_id: prioridade_id || null,
  cliente_id: contato.cliente_id ?? null,   // auto-vínculo
  etapa_id: etapaPendenteId,                // nasce "Pendente"
  criado_por_id: usuarioAtual.id,
  de_projeto: false,
  updated_at: nowIso,
}
```

## Permissões / RLS

- **Criação de tarefa** hoje é `WITH CHECK (can('tarefa.criar'))`. Têm essa capacidade: `admin`, `vendas`, `suporte` — os papéis dos atendentes. Blindagem de UI: esconder o botão "Nova tarefa" se o usuário não tiver `tarefa.criar` (usar o mecanismo de permissão já existente no Atendimento, `usePermissao`).
- **Escolha do responsável no formulário é sempre livre.** A RLS de `INSERT` só checa `tarefa.criar` (não `tarefa.reatribuir`); logo, na criação, qualquer atendente com `tarefa.criar` pode atribuir a tarefa a qualquer usuário ou deixá-la "Em aberto". O `tarefa.reatribuir` só governa o `UPDATE` posterior (que acontece no painel, fora do escopo). Não replicar o "select readonly" do painel.
- **`atendimento_tarefas`** — RLS no padrão das demais tabelas do Atendimento:
  - SELECT: autenticado (a visibilidade do que importa já é limitada pelo contato/atendimento que o atendente enxerga).
  - INSERT: autenticado com `criado_por = current_user_id()` (o atendente registra o próprio vínculo).
  - DELETE/UPDATE: não expor no MVP (o vínculo é imutável; CASCADE cuida da remoção junto com a tarefa/atendimento).

## Ciclo / integração com o painel

- A tarefa nasce em "Pendente" e aparece nas views do painel (`Minhas` se atribuída ao criador; `Em aberto`/`Todas` se sem responsável). O atendente que for responsável a vê no painel normalmente.
- Notificação de atribuição usa a Edge Function existente `notify-assignment`, mesma do painel.

## Fora de escopo (agora)

- Categoria, classificação, etapa customizada, anexos, checklist, subtarefas, participantes de tarefa.
- Editar status/dados da tarefa pelo Atendimento (andamento é no painel).
- Deep-link para abrir a tarefa no painel (requer URL base do painel; adicionar depois).

## Riscos / observações

- **Papel sem `tarefa.criar`**: se algum atendente tiver papel customizado sem a capacidade, o botão fica oculto (sem erro de RLS). Validar os papéis reais dos atendentes ao testar.
- **Contato sem empresa**: `cliente_id` fica nulo; a tarefa é criada mesmo assim e o vínculo `atendimento_tarefas` garante que ela apareça na lista.
- **Migration em produção**: `atendimento_tarefas` é aditiva; aplicar via CLI no Supabase compartilhado e commitar no repo do painel (não pushar `main` do painel sem o usuário decidir).
