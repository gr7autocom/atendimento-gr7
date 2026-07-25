# Prompt para o projeto Painel de Implantação — aba "Contatos" no cliente

> **RESOLVIDO em 2026-07-25.** A aba existe no painel, mas **sem** a tabela `cliente_contatos` descrita abaixo. Ela lê e grava direto em `contatos` (esta base), filtrando por `cliente_id`, porque esse já é o vínculo criado no "Vincular empresa" e duas listas exigiriam sincronização por trigger com conflito no telefone único. Migration `20260725190000` adicionou `cargo` e liberou a escrita para `can('cliente.editar')`. Ver `db.md`, seção `contatos`. O texto abaixo fica como registro do pedido original.

> Cole o bloco abaixo numa sessão do Claude Code **dentro do projeto `painel-implantacao-v2`**. É uma melhoria no painel que o app de Atendimento (irmão, mesmo Supabase) vai consumir.

---

**Tarefa: adicionar uma aba "Contatos" no formulário de cadastro/edição de cliente (empresa), permitindo cadastrar vários contatos por cliente, cada um com nome e telefone.**

**Por que:** hoje o cliente tem só um telefone (o do dono). Na prática, várias pessoas da mesma empresa entram em contato pelo WhatsApp. A nova plataforma de Atendimento (projeto irmão `atendimento-gr7`, mesmo Supabase) identifica quem está falando pelo telefone, então precisa de uma lista de contatos por cliente.

**Requisitos:**

1. **Migration aditiva** (sem `ALTER`/`DROP` em tabelas existentes):
   - Nova tabela `cliente_contatos`:
     - `id UUID PK default gen_random_uuid()`
     - `cliente_id UUID` FK → `clientes(id)` ON DELETE CASCADE, NOT NULL
     - `nome TEXT NOT NULL`
     - `telefone TEXT NOT NULL` — normalizado em **E.164** (ex.: `+5511912345678`)
     - `cargo TEXT` (opcional, ex.: "Financeiro")
     - `created_at`, `updated_at TIMESTAMPTZ`
   - Índice em `cliente_id`.
   - **RLS** seguindo o padrão do painel (SELECT autenticado; escrita gated pela mesma capacidade que edita cliente).

2. **UI:** aba **"Contatos"** no formulário do cliente (junto das abas já existentes), com CRUD simples: listar os contatos e permitir adicionar, editar e remover (campos: nome, telefone, cargo opcional). Seguir o design system e os padrões de formulário já usados no painel. Normalizar o telefone para E.164 ao salvar.

3. **Não quebrar** o cadastro de cliente atual. Mudança puramente aditiva.

**Integração (contexto, não precisa implementar aqui):** o app de Atendimento fará o match do telefone recebido no WhatsApp contra esses contatos (e o telefone do próprio cliente) para saber quem é o interlocutor. Por isso o telefone normalizado é importante.
