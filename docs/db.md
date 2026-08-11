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
- `id`, `telefone` TEXT UNIQUE (E.164), `nome` TEXT (**editável pelo atendente** — quem está falando), `nome_whatsapp` TEXT (origem WhatsApp, não editável), `cargo` TEXT (opcional, migration `20260725190000`), `cliente_id` FK → `clientes` (SET NULL, nullable — match automático **ou** vínculo manual), `created_at`, `updated_at`
- **O painel também escreve nesta tabela** desde 2026-07-25: a aba "Contatos" do cadastro de cliente lista/edita os contatos por `cliente_id`. Escrita liberada para `can('atendimento.responder') OR can('cliente.editar')` (migration `20260725190000`). O painel nunca faz DELETE: remover contato de uma empresa por lá é `cliente_id = NULL`, para não derrubar os atendimentos em cascata.
- `etapa_bot_pendente` TEXT, `tentativas_menu_pendente` INT NOT NULL default 0 (migration `20260810180000`) — sub-estado do bot do WhatsApp **antes de existir chamado** (`identificacao` | `menu`; nulo = sem triagem em curso). O ticket só nasce quando o setor é confirmado (ver [bot.md](bot.md)), e até lá não há `atendimentos` para guardar esse estado.

### `atendimentos` (tickets)
- `id`, `protocolo BIGINT IDENTITY UNIQUE`, `contato_id` FK → `contatos`, `departamento_id` FK → `departamentos` (nullable até escolher), `responsavel_id` FK → `usuarios` (nullable), `motivo_id` FK → `atendimento_motivos` (nullable, ao Finalizar), `plantao_id` FK → `atendimento_plantoes` (nullable — marca ticket criado em plantão), `status` TEXT CHECK (`triagem` | `na_fila` | `em_atendimento` | `finalizado`), `canal` TEXT NOT NULL default `'whatsapp'` CHECK (`whatsapp` | `web`) — **passou a decidir comportamento** com o canal web (ADR-11); antes existia e nunca era lida, `tentativas_menu INT default 0`, `etapa_bot TEXT` (sub-estado do bot em triagem: `identificacao` | `menu` | `avaliacao`; migration `20260727130000`), `avaliacao INT` (nullable, 0-10), `avaliacao_solicitada_em TIMESTAMPTZ`, `encerrado_por TEXT` (`atendente` | `cliente`, nullable), `aberto_em`, `assumido_em`, `finalizado_em`, `ultima_mensagem_em`, `created_at`, `updated_at`
- **`status = 'triagem'` é legado desde 2026-08-10.** Os dois canais só criam ticket depois do setor decidido — nasce direto em `na_fila`. O CHECK mantém o valor porque tickets abertos antes dessa data ainda podem estar em `triagem` (resolvidos pelo bloco de compatibilidade do `whatsapp-webhook`); nenhum ticket novo passa mais por esse estado. `etapa_bot` idem: só é lido/escrito para esses tickets antigos. O sub-estado da triagem ANTES do ticket existir agora mora em `contatos.etapa_bot_pendente`/`tentativas_menu_pendente` (ver acima).
- Índices: `contato_id`, `departamento_id`, `responsavel_id`, `status`, `plantao_id`, `ultima_mensagem_em`
- **Triggers do bot** (migrations `20260727140000`/`20260727150000`): `registrar_evento_atendimento` (grava `atendimento_eventos` nas mudanças de dono/status/departamento) e `solicitar_avaliacao_ao_finalizar` (ao finalizar pelo atendente com avaliação ativa, grava `solicitar_avaliacao` e marca `avaliacao_solicitada_em`/`etapa_bot='avaliacao'`).

### `atendimento_mensagens`
- `id`, `atendimento_id` FK (CASCADE), `direcao` TEXT (`entrada` | `saida`), `origem` TEXT (`cliente` | `atendente` | `bot`), `corpo` TEXT, `remetente_usuario_id` FK → `usuarios` (nullable), `wa_message_id` TEXT, `status` TEXT (`enviado` | `entregue` | `lido` | `falhou`), `canal` TEXT NOT NULL CHECK (`whatsapp` | `web`), `client_msg_id` UUID (nullable), `created_at`
- **Responder e apagar** (migration `20260808120000`, desenho copiado do Talks): `resposta_id` FK → a própria tabela (SET NULL), `resposta_corpo` TEXT, `resposta_remetente` TEXT, `excluida` BOOLEAN NOT NULL DEFAULT false.
  - **A citação guarda cópia, não só a chave.** Com `resposta_id` sozinho, apagar a mensagem citada deixaria um retângulo vazio no meio da conversa e quem lê perderia o fio de uma resposta que ainda faz sentido. `resposta_corpo` é um recorte (200 caracteres): serve para reconhecer o que foi citado, não para reler.
  - **Apagar é marcar, nunca `DELETE`.** A conversa é prova do atendimento e fica cinco anos por causa do CDC; remover destruiria o que a retenção existe para guardar. A tela mostra "Mensagem apagada".
  - **A policy sozinha não bastava.** RLS decide quais LINHAS, nunca quais COLUNAS: com só a policy `atendimento_mensagens_update_apagar`, o autor poderia reescrever o próprio `corpo` depois de enviado, e o histórico deixaria de ser registro do que foi dito. Quem limita coluna é o GRANT, então a migration faz `REVOKE UPDATE ... FROM authenticated` e devolve só `GRANT UPDATE (excluida)`. Continua **sem policy de DELETE** em lugar nenhum.
  - Quem pode apagar: o autor ou admin, e só o que tem `remetente_usuario_id` (ou seja, mensagem de atendente). O que veio do cliente e do bot não tem dono do nosso lado, e apagar a fala do cliente seria mexer no relato dele.
- Índices: `atendimento_id`; UNIQUE parcial em `wa_message_id`; UNIQUE parcial em `client_msg_id`
- **`canal` é copiado do atendimento por trigger** (`atendimento_mensagem_herda_canal`, BEFORE INSERT), nunca informado por quem insere: assim ninguém precisa lembrar de preencher e não há como uma mensagem divergir do chamado a que pertence.
- **`CHECK (canal <> 'web' OR wa_message_id IS NULL)` é o guard do despacho.** `wa_message_id` é a evidência de "isto passou pelo provedor de WhatsApp", então gravar despacho de WhatsApp numa conversa que nasceu na web é **impossível**, não apenas desaconselhado. Existe porque, no dia da uazapi, o despacho será plugado no lugar mais fácil (o `responder` do app, ou um trigger genérico aqui) e a regra de canal é o `if` que ninguém escreve. A mesma regra na camada de aplicação está em `_shared/canal.ts`.
- **`client_msg_id` é a idempotência do canal web**, e não o `wa_message_id`: aquele significa "id no provedor de WhatsApp" e o CHECK acima o proíbe no web. Cliente que clica duas vezes, ou reenvia depois de perder a conexão, manda o mesmo valor e a segunda gravação é recusada em vez de duplicar a conversa.
- Migration `20260805120000`.

### `atendimento_web_sessoes` e `atendimento_web_tentativas`

Sessão do cliente no canal web, sem login e sem senha. Migration `20260805120100`. Detalhe em [canal-web.md](canal-web.md).

- **`atendimento_web_sessoes`**: `id`, `atendimento_id` FK (CASCADE), `contato_id` FK (CASCADE), `token_hash` TEXT UNIQUE, `token_prefixo` TEXT, `ip_hash` TEXT, `criada_em`, `ultimo_uso_em`, `expira_em`, `revogada_em`, `aceite_em`
- **`atendimento_web_tentativas`**: `id`, `chave` TEXT (`ip:<hash>` ou `tel:<e164>`), `acao` TEXT, `created_at`. Contador de rate limit em tabela porque o isolate da Edge Function é efêmero e há mais de uma instância
- **O escopo do token é UM ATENDIMENTO, não o contato.** Se fosse o contato, o cliente web passaria a enxergar o histórico do WhatsApp dele, que é o oposto do escopo "só a conversa atual"
- **O token cru nunca é gravado**, só o SHA-256. Não é bcrypt de propósito: são 32 bytes aleatórios, não uma senha, e o hash é conferido a cada polling
- **`ip_hash`, nunca o IP em claro**: para rate limit basta igualdade, e IP é dado pessoal sob a LGPD
- RLS: `sessoes` só é legível por `e_admin()` e `tentativas` não tem policy nenhuma. **Nenhuma das duas tem policy de escrita** — quem opera é a Edge Function com service role
- RPC `atendimento_web_revogar_sessao(p_atendimento_id)` (SECURITY DEFINER, `authenticated`): marca as sessões do chamado como revogadas. Valida com a mesma regra de quem pode atuar no atendimento. Existe para o cenário concreto de quem abriu o chamado sair da empresa com o token vivo na máquina

### `atendimento_eventos`
Eventos internos do atendimento (base do histórico). Renderizados como **pílulas centralizadas** no chat do operador; **nunca vão para o cliente**. Migration `20260727140000`.
- `id`, `atendimento_id` FK (CASCADE), `tipo` TEXT (`atendimento_aberto` | `fim_bot` | `assumido` | `saiu_atendimento` | `transferido_departamento` | `finalizado` | `reaberto`), `ator_usuario_id` FK → `usuarios` (nullable — quem fez; nulo = bot/sistema), `alvo_usuario_id` FK → `usuarios` (nullable — participante do evento), `dados` JSONB (ex.: `protocolo`, `de`/`para`), `created_at`
- Gravado pelo trigger `registrar_evento_atendimento` no `atendimentos`; SELECT pela mesma regra por dono das mensagens.

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
Motivos de finalização, **por departamento** (revisto 2026-07-25). Configurados dentro do card do departamento (não há mais tela avulsa).
- `id`, `nome` TEXT, `ordem INT`, `ativo BOOLEAN`, `created_at`, `updated_at`
- `departamento_id` FK → `departamentos` (CASCADE). Migration `20260725160000`. No Finalizar aparecem só os do departamento do chamado. Motivos legados sem departamento (nulo) não aparecem.

### `atendimento_departamento_horarios`
Horário de atendimento **por departamento** (opcional). Configurado no card do departamento. Migration `20260725170000`.
- `id`, `departamento_id` FK → `departamentos` (CASCADE), `dia_semana INT` (0-6), `hora_inicio TIME`, `hora_fim TIME`, `created_at`
- **Vazio para um departamento = usa o horário comercial global.** Preenchido = o departamento está disponível só nessas faixas (helper `departamentoDisponivelAgora` em `src/lib/horario.ts`; fora delas o bot manda `fora_horario`).

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
- Chaves: `bem_vindo`, `instrucao_menu`, `opcao_invalida`, `voltar_menu`, `entrou_fila`, `encaminhado_padrao`, `plantao`, `fora_horario`, `encerramento`, `solicitar_avaliacao`, `agradecimento_avaliacao`, `avaliacao_invalida`, `pedir_identificacao` (potencial sem cadastro, antes do menu — migration `20260727120000`), `identificacao_vinculada` (confirma o auto-vínculo por CNPJ — migration `20260727130000`)
- Placeholders (padrão único do projeto, **chave dupla em português**): `{{empresa}}`, `{{contato}}`, `{{protocolo}}`, `{{departamento}}`, `{{atendente}}`, `{{horario}}`. As mensagens rápidas usam o mesmo conjunto.

### `atendimento_horarios`
Horário comercial (MVP: global). CRUD na aba "Horário de Funcionamento".
- `id`, `dia_semana INT` (0-6), `hora_inicio TIME`, `hora_fim TIME`, `ativo BOOLEAN`

### `atendimento_config`
Ajustes globais chave-valor.
- `chave` TEXT PK, `valor` TEXT, `updated_at`
- Seeds: `janela_reabertura_horas = '3'`, `timezone = 'America/Sao_Paulo'`, `departamento_padrao_id`, `max_tentativas_menu = '2'`, `enviar_nome_atendente = 'true'`, `avaliacao_ativa = 'true'`, `tempo_avaliacao_min = '60'`
- Chaves adicionais escritas pela tela **Configurações BOT** (2026-07-27, sem migration, via upsert): `nome_bot`, `controle_potenciais` (`nunca`/`novos_contatos`/`sem_atendimento`), `solicitar_motivo_finalizar`, `permitir_cliente_finalizar`

### `atendimento_participantes`
Colaboração multi-atendente: além do responsável, outros atendentes entram no chamado para **ver e responder**. Migration `20260727160000`.
- `id`, `atendimento_id` FK → `atendimentos` (CASCADE), `usuario_id` FK → `usuarios` (CASCADE), `adicionado_por` FK → `usuarios` (SET NULL), `created_at`. UNIQUE(`atendimento_id`, `usuario_id`).
- **Duas FKs para `usuarios`** (`usuario_id` e `adicionado_por`): ao embutir o usuário no PostgREST, desambiguar com `usuarios!usuario_id`.
- Helper `e_participante(atendimento_id)` (SECURITY DEFINER). Adicionar/remover só pelo **responsável ou admin**; finalizar/transferir **não** são liberados ao participante (a policy de UPDATE de `atendimentos` fica intacta).

### `atendimento_tarefas`
Vínculo entre um atendimento/contato e uma **tarefa avulsa** aberta pelo atendente direto do chat (a tarefa mora em `tarefas`, do painel; aqui só guardamos de qual chamado/contato ela nasceu). Migration `20260728120000`.
- `id`, `tarefa_id` FK → `tarefas` (CASCADE, **UNIQUE**), `atendimento_id` FK → `atendimentos` (CASCADE), `contato_id` FK → `contatos` (CASCADE), `criado_por` FK → `usuarios` (SET NULL), `created_at`.
- RLS: **SELECT** autenticado (`USING true` — o vínculo em si não é sensível; a tarefa/atendimento têm suas próprias policies); **INSERT** com `criado_por = current_user_id()`.
- **Criação pela RPC `criar_tarefa_atendimento`** (migration `20260729120000`, no repo do painel). Grava a tarefa e o vínculo **na mesma transação**; antes eram dois inserts soltos e uma falha no segundo deixava tarefa órfã no painel enquanto o atendente via erro e tentava de novo, duplicando. `SECURITY INVOKER`, então a RLS de `tarefas` (`WITH CHECK can('tarefa.criar')`) continua valendo.
- Regras que a RPC aplica (saíram do frontend): **empresa obrigatória** (contato sem `cliente_id` é recusado), etapa **Pendente** (fallback: primeira por `ordem`), categoria **Outros** + classificação **Solicitações de cliente**, `inicio_previsto` = `now()` quando não informado, `de_projeto:false`, título em MAIÚSCULAS.
- Erros pelo `code`: `42501` sem a capacidade, `23514` regra de negócio (mensagem já vem pronta do banco), `23503` contato ou atendimento inexistente. Tradução em `mensagemErroCriarTarefa` (`src/lib/useInbox.ts`).
- Notificação por `notify-assignment` quando o responsável não é o criador (best effort, fora da transação).
- **Embed no PostgREST:** `tarefas` tem 2 FKs para `etapas` (`etapa_id`, `etapa_antes_pausa_id`) e 2 para `usuarios` (`responsavel_id`, `criado_por_id`) → desambiguar com `etapas!etapa_id` e `usuarios!responsavel_id`.

## Ciclo de vida e fluxo do bot

Ver [bot.md](bot.md) (Seção 3). Resumo: `triagem` (menu) → `na_fila` (departamento ou plantão) → `em_atendimento` (assumir/responder) → `finalizado` (+ avaliação opcional). Reabertura em 3h (só quando a nota ficou pendente) volta pra fila do departamento.

## Reconhecimento de cliente (E.164) + vínculo manual

- `contatos.telefone` sempre normalizado (`+55DDDNXXXXXXXX`, UNIQUE).
- **Match automático:** compara com `clientes.telefone`/`telefone_responsavel` (normalizados em runtime, sem alterar o painel). Acerta pouco no MVP (painel só tem telefone do dono).
- **Vínculo manual (principal):** o atendente escreve o `nome` do contato e associa a empresa (`cliente_id`) buscando na base de `clientes`. `clientes` read-only.
- **Aba "Contatos" no painel (entregue em 2026-07-25):** o cadastro de cliente lista e edita os contatos daquela empresa direto em `contatos`, filtrando por `cliente_id`. Não foi criada a tabela `cliente_contatos` que o `prompt-painel-aba-contatos.md` propunha: duas listas exigiriam sincronização por trigger, com conflito no telefone único, e o contato cadastrado no painel não seria reconhecido aqui. Efeito prático: o que o atendente vincula em "Vincular empresa" aparece no painel, e o contato cadastrado no painel já entra no match da primeira mensagem.

## RLS

RLS **por dono** (revisto em 2026-07-24, migration `20260724150000`). Antes era por departamento; agora o departamento serve só para roteamento do bot e filtro da lista, não para a visão. Helper novo: `e_admin()` (perfil slug `admin`). `atende_departamento`/`e_plantonista` seguem definidos, mas não são mais usados na visibilidade.

- `atendimentos`: SELECT se `e_admin()` **ou** `responsavel_id = current_user_id()` **ou** (`responsavel_id IS NULL` **e** `status <> 'triagem'`). Ou seja: **admin vê tudo**; atendente vê **os seus** + a **fila livre** (pendentes/potenciais de qualquer setor); ninguém vê o chamado que está na mão de outro atendente. Tickets em `triagem` (dep nulo, sem dono) não aparecem — conduzidos pela Edge Function (service role).
- **Trava por hora** (revisto em 2026-07-25, migration `20260725130000`): as policies de `atendimentos` (SELECT/UPDATE) e o INSERT de `atendimento_mensagens` exigem também `pode_atender_agora()`. A função (SECURITY DEFINER) retorna `true` se **admin** **ou** comercial ainda não configurado **ou** agora dentro de um `atendimento_horarios` ativo **ou** dentro de uma faixa de `atendimento_usuario_horarios` do usuário (timezone `atendimento_config.timezone`, default `America/Sao_Paulo`). O login (`auth.tsx`) reforça a mesma regra com aviso amigável. Não afeta o painel (não usa `atendimentos`).
- `atendimento_mensagens`/`atendimento_anexos`/`atendimento_tag_vinculos`/`atendimento_transferencias`/`atendimento_eventos`: SELECT se o atendimento pai é visível pela **mesma regra** (admin / dono / fila livre / **participante**).
- **Participante (migration `20260727160000`):** o predicado de visibilidade das tabelas `atendimento_*` ganhou `OR e_participante(atendimento_id)` — quem é participante **vê e responde** (INSERT em `atendimento_mensagens`). O UPDATE de `atendimentos` **não** foi tocado, então participante não finaliza nem transfere. Só **adiciona** acesso; ninguém perdeu visibilidade.
- Catálogos e config (`departamentos`, `atendimento_tags`, `atendimento_motivos`, `atendimento_mensagens_rapidas`, `atendimento_plantoes`, `atendimento_plantao_usuarios`, `bot_mensagens`, `atendimento_horarios`, `atendimento_config`): SELECT autenticado; escrita por `can('atendimento.config')`.
- Ações novas do atendimento (slugs em `permissoes.capacidades`, **não** há tabela `acoes`): `atendimento.assumir`, `atendimento.responder`, `atendimento.finalizar`, `atendimento.transferir`, `atendimento.config`. No perfil `admin`, todas. No perfil `suporte`, as quatro de operação (sem `config`), concedidas na migration `20260724150000`. Manter em sincronia com `src/lib/acoes.ts`.
- Edge Functions (webhook/envio/bot) usam **service role** (ignoram RLS).
- **Transferência é RPC, não UPDATE direto:** `transferir_atendimento(p_atendimento_id, p_departamento_id, p_usuario_id, p_observacao)` (SECURITY DEFINER). Motivo: o PostgREST executa `UPDATE ... RETURNING` e o Postgres exige que a **linha nova** satisfaça a policy de SELECT; ao mandar o chamado para um departamento que o usuário não atende, ele deixa de enxergá-la e o banco recusa (42501). A função valida acesso pela regra por dono (admin / dono / fila livre) + `can('atendimento.transferir')` e grava o histórico na mesma transação.
- `atendimentos` aceita INSERT de quem tem `can('atendimento.responder')`.
- **Criação manual é RPC, não INSERT direto:** `criar_atendimento(p_telefone, p_nome, p_cliente_id, p_contato_id, p_departamento_id, p_responsavel_id)` (SECURITY DEFINER). Mesmo motivo da transferência (o `INSERT ... RETURNING` esbarra na policy de SELECT ao criar já atribuído a outro atendente/departamento). Acha ou cria o contato pelo telefone e cria o atendimento na mesma transação: sem atendente nasce `na_fila` (pendente), com atendente `em_atendimento`. Usada pelo modal **Criar atendimento** enquanto não há uazapi.
- **Match de cliente por CNPJ:** `atendimento_buscar_cliente_por_cnpj(p_digitos)` (SECURITY DEFINER, migration `20260727130000`) devolve o cliente cujo CNPJ normalizado (só dígitos) bate com `p_digitos`. Usada pelo bot no `whatsapp-webhook` para o auto-vínculo do potencial pelo CNPJ.
- **Histórico do contato é RPC, não SELECT direto:** `atendimento_historico_contato(p_contato_id)` (SECURITY DEFINER, migration `20260731160000`) devolve **todos** os atendimentos do contato — protocolo, datas, status, setor, atendente, motivo, nota e contagem de mensagens. Motivo do DEFINER: a visibilidade é **por dono**, então um `select` direto devolveria a lista pela metade, sem avisar que está incompleta, e o atendente concluiria que o cliente nunca falou daquele assunto. O mesmo valia para os contadores do painel do contato, que mostravam número menor que a realidade. A função devolve **só o resumo, nunca o corpo das mensagens** — o atendente fica sabendo que o chamado existiu e como terminou, sem ler a conversa do colega —, e valida na entrada com `e_admin() OR can('atendimento.responder')`. Consumida por `useHistoricoContato` e `useContadoresContato`, que compartilham a mesma `queryKey`.
- **Presença do cliente no canal web é RPC:** `atendimento_web_presenca(p_atendimento_id)` (SECURITY DEFINER, migration `20260806120000`) devolve **uma linha com dois campos** — `ultimo_uso_em` (o acesso vivo mais recente, porque o cliente pode ter aberto a conversa em mais de um dispositivo) e `sessoes_ativas`. Sessão revogada ou expirada não conta. Motivo do DEFINER: `atendimento_web_sessoes` libera SELECT só para `e_admin()`, e afrouxar a policy exporia `token_hash` e `ip_hash` a todo atendente. A função não devolve token, IP nem id de sessão. Chamado de WhatsApp volta `null`/`0`, e não resultado vazio, para a interface não confundir "sem sessão" com "não consultei". Valida na entrada com `e_admin() OR can('atendimento.responder')` **e** a regra por dono (admin / dono / fila livre / **participante**). `sessoes_ativas` serve ao "Encerrar acesso do cliente" do menu da conversa, que sem ele apareceria em chamado sem acesso nenhum a encerrar.

### `REVOKE ... FROM PUBLIC` não fecha função neste banco

Descoberto ao verificar a RPC de presença em 2026-08-06, com cliente anônimo de verdade: **o Supabase concede `EXECUTE` explicitamente ao role `anon`** em toda função de `public` (visível em `pg_proc.proacl`, `anon=X/postgres`), e `REVOKE ... FROM PUBLIC` **não** remove grant explícito. Ou seja, o `REVOKE`/`GRANT` no fim das nossas migrations não é a defesa: **a defesa é a checagem no corpo da função**.

Isso importa porque o predicado de visibilidade tem um ramo que é verdadeiro para qualquer um: `responsavel_id IS NULL AND status <> 'triagem'` (a fila livre). Numa função `SECURITY DEFINER` que só teste esse predicado, sem antes exigir `e_admin() OR can(...)`, **um visitante sem login passa**. Toda função nova do atendimento começa validando que quem chama é da equipe, e só depois qual chamado ele pode ver.

`atendimento_web_revogar_sessao` nasceu com esse furo e foi corrigida na migration `20260806120100`: um visitante com o UUID de um chamado na fila derrubava o acesso do cliente ao PWA sem login. `criar_atendimento` e `transferir_atendimento` foram conferidas na mesma passada e já validavam `can(...)` na entrada. Verificado com cliente anônimo real: recusado com `42501`, sessões intactas; o atendente continua revogando.

## Reaproveitamento do painel (read-only)

- `clientes` — match/vínculo por telefone. Read-only no MVP.
- `usuarios` — atendentes/responsáveis/plantonistas.
- `permissoes.capacidades` (`text[]`) / `can()` — permissões (sem tabela `acoes`). Inclui `tarefa.criar` (usada pela aba Tarefas).
- `tarefas` — **escrita** (única exceção ao read-only): a aba Tarefas cria tarefa avulsa pela RPC `criar_tarefa_atendimento` (`de_projeto:false`); o vínculo fica em `atendimento_tarefas`. O andamento é no painel.
- `prioridades` — catálogo lido pelo formulário de tarefa (ordenado por `nivel`). `etapas`, `categorias` e `classificacoes` são resolvidas dentro da RPC, não pelo frontend.
- `notificacoes` — **não alterar no MVP**.
