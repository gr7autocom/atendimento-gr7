# Modelo de dados — GR7 Atendimento

> **Status: aprovado (Seções 2 e 3 do design, 2026-07-23).** Registro de design completo em [superpowers/specs/2026-07-23-modelo-dados-design.md](superpowers/specs/2026-07-23-modelo-dados-design.md). Todas as tabelas são **novas e aditivas** — nenhuma alteração em tabela do painel no MVP. Migrations moram no repo do painel (`painel-implantacao-v2/supabase/migrations/`), prefixo `atendimento_`.

Padrão do projeto (herdado do painel): `id UUID PK default gen_random_uuid()`, `created_at`/`updated_at TIMESTAMPTZ`, `ativo BOOLEAN` quando faz sentido. RLS em toda tabela. Helpers existentes reaproveitados: `current_user_id()`, `can()`.

## Decisões fechadas

1. **Reconhecimento de cliente:** match automático por telefone E.164 (quando bate com `clientes`), **mais vínculo manual** pelo atendente (caminho principal, já que o painel só tem o telefone do dono). O atendente também define o **nome de quem fala**.
2. **Janela de reabertura = 3h, configurável** (`atendimento_config`).
3. **Status de trabalho:** `na_fila → em_atendimento → finalizado`, mais o estado interno `triagem`.
4. **RLS por departamento no banco desde o MVP** (helper `atende_departamento`); fila de plantão via `e_plantonista`.
5. **Transferência** (departamento e/ou atendente) com histórico.
6. **Tags** de chamado (catálogo + N:N).
7. **Motivo de finalização** (catálogo + `atendimentos.motivo_id`).
8. **Mensagens rápidas** do atendente (`/`), catálogo próprio.
9. **Plantão:** turnos com atendentes vinculados; fora do comercial atende pela fila de plantão. Sem plantonista na plataforma, o bot só direciona (ver [bot.md](bot.md)).
10. **Fallback de triagem:** 2 tentativas sem escolher → departamento padrão.
11. **Avaliação (opcional):** ao finalizar, nota 0-10 do cliente.

## Tabelas novas (MVP)

### `departamentos`
Filas de atendimento; alimentam o menu do bot. CRUD em Admin.
- `id`, `nome`, `ordem INT`, `ativo BOOLEAN`, `created_at`, `updated_at`
- Seeds: `SUPORTE GERAL`, `ASSUNTOS FINANCEIROS`, `COMERCIAL (VENDAS)`, `DÚVIDAS COM NOTAS FISCAIS`, `ARQUIVOS FISCAIS (CONTABIL-SPED)`, `OUTROS ASSUNTOS`

### `atendente_departamentos`
Vínculo N:N atendente ↔ departamento (define visibilidade).
- `usuario_id` FK → `usuarios` (CASCADE), `departamento_id` FK → `departamentos` (CASCADE)
- PK composta `(usuario_id, departamento_id)`, `created_at`

### `contatos`
Identidade do cliente no WhatsApp (o **telefone é a identidade**).
- `id`, `telefone` TEXT UNIQUE (E.164), `nome` TEXT (**editável pelo atendente** — quem está falando), `nome_whatsapp` TEXT (origem WhatsApp, não editável), `cliente_id` FK → `clientes` (SET NULL, nullable — match automático **ou** vínculo manual), `created_at`, `updated_at`

### `atendimentos` (tickets)
- `id`, `protocolo BIGINT IDENTITY UNIQUE`, `contato_id` FK → `contatos`, `departamento_id` FK → `departamentos` (nullable até escolher), `responsavel_id` FK → `usuarios` (nullable), `motivo_id` FK → `atendimento_motivos` (nullable, ao Finalizar), `plantao_id` FK → `atendimento_plantoes` (nullable — marca ticket criado em plantão), `status` TEXT CHECK (`triagem` | `na_fila` | `em_atendimento` | `finalizado`), `canal` TEXT default `'whatsapp'`, `tentativas_menu INT default 0`, `avaliacao INT` (nullable, 0-10), `avaliacao_solicitada_em TIMESTAMPTZ`, `encerrado_por TEXT` (`atendente` | `cliente`, nullable), `aberto_em`, `assumido_em`, `finalizado_em`, `ultima_mensagem_em`, `created_at`, `updated_at`
- Índices: `contato_id`, `departamento_id`, `responsavel_id`, `status`, `plantao_id`, `ultima_mensagem_em`

### `atendimento_mensagens`
- `id`, `atendimento_id` FK (CASCADE), `direcao` TEXT (`entrada` | `saida`), `origem` TEXT (`cliente` | `atendente` | `bot`), `corpo` TEXT, `remetente_usuario_id` FK → `usuarios` (nullable), `wa_message_id` TEXT, `status` TEXT (`enviado` | `entregue` | `lido` | `falhou`), `created_at`
- Índices: `atendimento_id`; UNIQUE parcial em `wa_message_id`

### `atendimento_anexos`
Mídia via Cloudinary (padrão `scrap_anexos`/`tarefa_anexos` do painel).
- `id`, `mensagem_id` FK (CASCADE), `public_id`, `url`, `tipo_mime`, `tamanho_bytes`, `nome_arquivo`, `created_at`

### `atendimento_tags`
Catálogo de rótulos. CRUD em Admin. O atendente aplica a tag ao chamado (uma ou mais) via `atendimento_tag_vinculos`.
- `id`, `nome` TEXT UNIQUE, `ordem INT`, `ativo BOOLEAN`, `created_at`, `updated_at`
- `cor_fundo` TEXT (hex; nulo = cor automática pelo nome), `cor_texto` TEXT (hex; nulo = branco), `departamento_id` FK → `departamentos` (SET NULL, nullable — **nulo = todos os departamentos**; preenchido = tag específica de um setor). Migration aditiva `20260724160000`.
- Seeds: `SUPORTE SISTEMA`, `NOTA FISCAL`, `RESOLVIDO POR LIGAÇÃO`, `ARQUIVO FISCAL`, `NÃO RELACIONADO A GR7`

### `atendimento_tag_vinculos`
Aplicação N:N de tags a um atendimento.
- `atendimento_id` FK (CASCADE), `tag_id` FK (CASCADE), `aplicada_por` FK → `usuarios` (nullable), `created_at`
- PK composta `(atendimento_id, tag_id)`

### `atendimento_motivos`
Catálogo de motivos de finalização. CRUD em Admin.
- `id`, `nome` TEXT UNIQUE, `ordem INT`, `ativo BOOLEAN`, `created_at`, `updated_at`

### `atendimento_transferencias`
Histórico de transferências.
- `id`, `atendimento_id` FK (CASCADE), `de_departamento_id`, `para_departamento_id`, `de_usuario_id`, `para_usuario_id` (FK nullable), `transferido_por` FK → `usuarios` NOT NULL, `observacao` TEXT, `created_at`
- Índice: `atendimento_id`

### `atendimento_mensagens_rapidas`
Textos prontos do atendente (`/`). CRUD em Admin. **Não confundir** com `bot_mensagens`.
- `id`, `atalho` TEXT UNIQUE (ex.: `bomdia`, o que vem depois da `/`), `titulo` TEXT (não usado na UI, recebe o atalho), `texto` TEXT, `ativo BOOLEAN`, `created_at`, `updated_at`
- `departamento_id` FK → `departamentos` (SET NULL, nullable — **nulo = todos**; preenchido = mensagem de um setor). Migration `20260725140000`.
- No chat, o atendente digita `/` e escolhe uma aplicável (do setor do chamado ou "Todos"); ao inserir, as variáveis são trocadas (`src/lib/variaveis.ts`).

### `atendimento_plantoes` / `atendimento_plantao_usuarios` (DEPRECATED)
Modelo antigo de plantão global (turnos + plantonistas). **Substituído por `atendimento_usuario_horarios`** (plantão por usuário, revisto em 2026-07-25). As tabelas continuam existindo (sem DROP), mas **não são mais usadas** pela UI nem pela regra de acesso.

### `atendimento_usuario_horarios`
Horários de acesso (plantão) **por usuário**. CRUD no card do atendente (tela **Atendentes**).
- `id`, `usuario_id` FK → `usuarios` (CASCADE), `dia_semana INT` (0-6), `hora_inicio TIME`, `hora_fim TIME`, `created_at`. Migration `20260725120000`.
- Regra: fora do comercial, o atendente só acessa dentro de uma faixa sua. Convenção `00:00–00:00` = dia inteiro; `fim < início` = vira a noite.

### `bot_mensagens`
Mensagens **automáticas do bot** (chave-valor). Menu gerado dos departamentos (não fica aqui).
- `id`, `chave` TEXT UNIQUE, `texto` TEXT, `ativo BOOLEAN`, `updated_at`
- Chaves: `bem_vindo`, `instrucao_menu`, `opcao_invalida`, `voltar_menu`, `entrou_fila`, `encaminhado_padrao`, `plantao`, `fora_horario`, `encerramento`, `solicitar_avaliacao`, `agradecimento_avaliacao`, `avaliacao_invalida`
- Placeholders (padrão único do projeto, **chave dupla em português**): `{{empresa}}`, `{{contato}}`, `{{protocolo}}`, `{{departamento}}`, `{{atendente}}`, `{{horario}}`. As mensagens rápidas usam o mesmo conjunto.

### `atendimento_horarios`
Horário comercial (MVP: global). CRUD na aba "Horário de Funcionamento".
- `id`, `dia_semana INT` (0-6), `hora_inicio TIME`, `hora_fim TIME`, `ativo BOOLEAN`

### `atendimento_config`
Ajustes globais chave-valor.
- `chave` TEXT PK, `valor` TEXT, `updated_at`
- Seeds: `janela_reabertura_horas = '3'`, `timezone = 'America/Sao_Paulo'`, `departamento_padrao_id`, `max_tentativas_menu = '2'`, `enviar_nome_atendente = 'true'`, `avaliacao_ativa = 'true'`, `tempo_avaliacao_min = '60'`

## Ciclo de vida e fluxo do bot

Ver [bot.md](bot.md) (Seção 3). Resumo: `triagem` (menu) → `na_fila` (departamento ou plantão) → `em_atendimento` (assumir/responder) → `finalizado` (+ avaliação opcional). Reabertura em 3h volta pra fila do departamento.

## Reconhecimento de cliente (E.164) + vínculo manual

- `contatos.telefone` sempre normalizado (`+55DDDNXXXXXXXX`, UNIQUE).
- **Match automático:** compara com `clientes.telefone`/`telefone_responsavel` (normalizados em runtime, sem alterar o painel). Acerta pouco no MVP (painel só tem telefone do dono).
- **Vínculo manual (principal):** o atendente escreve o `nome` do contato e associa a empresa (`cliente_id`) buscando na base de `clientes`. `clientes` read-only.
- Futuro (pós-MVP, lado do painel): aba "Contatos" por cliente → vincular ao contato específico.

## RLS

RLS **por dono** (revisto em 2026-07-24, migration `20260724150000`). Antes era por departamento; agora o departamento serve só para roteamento do bot e filtro da lista, não para a visão. Helper novo: `e_admin()` (perfil slug `admin`). `atende_departamento`/`e_plantonista` seguem definidos, mas não são mais usados na visibilidade.

- `atendimentos`: SELECT se `e_admin()` **ou** `responsavel_id = current_user_id()` **ou** (`responsavel_id IS NULL` **e** `status <> 'triagem'`). Ou seja: **admin vê tudo**; atendente vê **os seus** + a **fila livre** (pendentes/potenciais de qualquer setor); ninguém vê o chamado que está na mão de outro atendente. Tickets em `triagem` (dep nulo, sem dono) não aparecem — conduzidos pela Edge Function (service role).
- **Trava por hora** (revisto em 2026-07-25, migration `20260725130000`): as policies de `atendimentos` (SELECT/UPDATE) e o INSERT de `atendimento_mensagens` exigem também `pode_atender_agora()`. A função (SECURITY DEFINER) retorna `true` se **admin** **ou** comercial ainda não configurado **ou** agora dentro de um `atendimento_horarios` ativo **ou** dentro de uma faixa de `atendimento_usuario_horarios` do usuário (timezone `atendimento_config.timezone`, default `America/Sao_Paulo`). O login (`auth.tsx`) reforça a mesma regra com aviso amigável. Não afeta o painel (não usa `atendimentos`).
- `atendimento_mensagens`/`atendimento_anexos`/`atendimento_tag_vinculos`/`atendimento_transferencias`: SELECT se o atendimento pai é visível pela **mesma regra** (admin / dono / fila livre).
- Catálogos e config (`departamentos`, `atendimento_tags`, `atendimento_motivos`, `atendimento_mensagens_rapidas`, `atendimento_plantoes`, `atendimento_plantao_usuarios`, `bot_mensagens`, `atendimento_horarios`, `atendimento_config`): SELECT autenticado; escrita por `can('atendimento.config')`.
- Ações novas do atendimento (slugs em `permissoes.capacidades`, **não** há tabela `acoes`): `atendimento.assumir`, `atendimento.responder`, `atendimento.finalizar`, `atendimento.transferir`, `atendimento.config`. No perfil `admin`, todas. No perfil `suporte`, as quatro de operação (sem `config`), concedidas na migration `20260724150000`. Manter em sincronia com `src/lib/acoes.ts`.
- Edge Functions (webhook/envio/bot) usam **service role** (ignoram RLS).
- **Transferência é RPC, não UPDATE direto:** `transferir_atendimento(p_atendimento_id, p_departamento_id, p_usuario_id, p_observacao)` (SECURITY DEFINER). Motivo: o PostgREST executa `UPDATE ... RETURNING` e o Postgres exige que a **linha nova** satisfaça a policy de SELECT; ao mandar o chamado para um departamento que o usuário não atende, ele deixa de enxergá-la e o banco recusa (42501). A função valida acesso pela regra por dono (admin / dono / fila livre) + `can('atendimento.transferir')` e grava o histórico na mesma transação.
- `atendimentos` aceita INSERT de quem tem `can('atendimento.responder')`.
- **Criação manual é RPC, não INSERT direto:** `criar_atendimento(p_telefone, p_nome, p_cliente_id, p_contato_id, p_departamento_id, p_responsavel_id)` (SECURITY DEFINER). Mesmo motivo da transferência (o `INSERT ... RETURNING` esbarra na policy de SELECT ao criar já atribuído a outro atendente/departamento). Acha ou cria o contato pelo telefone e cria o atendimento na mesma transação: sem atendente nasce `na_fila` (pendente), com atendente `em_atendimento`. Usada pelo modal **Criar atendimento** enquanto não há uazapi.

## Reaproveitamento do painel (read-only)

- `clientes` — match/vínculo por telefone. Read-only no MVP.
- `usuarios` — atendentes/responsáveis/plantonistas.
- `permissoes.capacidades` (`text[]`) / `can()` — permissões (sem tabela `acoes`).
- `notificacoes` — **não alterar no MVP**.
