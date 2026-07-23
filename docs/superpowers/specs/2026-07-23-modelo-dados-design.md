# Spec — Modelo de dados do MVP (Seção 2 do design)

> Data: 2026-07-23 · Status: **aprovado no brainstorming, aguardando revisão final**
> Fonte viva do schema: [../../db.md](../../db.md). Esta spec registra as decisões fechadas que alimentam a migration e o `db.md` final.

## 1. Escopo e restrições

- Modela as **tabelas novas** do Atendimento. Todas **aditivas**: só `CREATE TABLE` / `CREATE FUNCTION` / `CREATE POLICY`. **Nenhum** `ALTER`/`DROP` em tabela do painel (produção).
- As migrations moram no repo do painel (`painel-implantacao-v2/supabase/migrations/`), prefixo `atendimento_`.
- Padrão herdado do painel: `id UUID PK default gen_random_uuid()`, `created_at`/`updated_at TIMESTAMPTZ`, RLS em toda tabela, helpers `current_user_id()` e `can()` reaproveitados.
- Tabelas do painel usadas **read-only**: `usuarios` (atendentes), `clientes` (match por telefone), catálogo `acoes` (permissões).

## 2. Decisões fechadas neste brainstorming

1. **Reconhecimento de cliente automático.** O telefone é a identidade do contato. Ao criar/atualizar um contato, o sistema normaliza o número para **E.164** e tenta casar com `clientes`; se casar, grava `contatos.cliente_id` e o atendente vê nome/empresa + link para a ficha. Sem match, segue como contato solto.
2. **Janela de reabertura = 3 horas, configurável.** Depois de finalizado, mensagem do cliente em até 3h **reabre o mesmo atendimento**; após 3h, **abre um novo** (recomeça pelo bot). Valor em `atendimento_config` (`janela_reabertura_horas`).
3. **3 status de trabalho + 1 estado interno.** O atendente opera com `na_fila → em_atendimento → finalizado`. Existe um estado interno `triagem` (bot conduzindo o menu, ainda sem departamento) que **não** aparece em fila de trabalho. Sem status "aguardando cliente" no MVP.
4. **RLS por departamento no banco desde o MVP.** O banco recusa devolver atendimentos/mensagens de departamentos que não são do atendente, via helper `atende_departamento(departamento_id)`. Ações (assumir/responder/finalizar/config) controladas por `can()`.
5. **Transferência de atendimento.** O atendente pode transferir o chamado para outro **departamento** (volta para a fila desse departamento) e/ou diretamente para um **atendente**. Cada transferência fica registrada em histórico (`atendimento_transferencias`). Origem: prints do sistema atual (Zintech).
6. **Tags de chamado.** Catálogo configurável de rótulos (ex.: `SUPORTE SISTEMA`, `NOTA FISCAL`, `RESOLVIDO POR LIGAÇÃO`) aplicáveis a um atendimento (N:N), usados para filtro/organização.
7. **Motivo de finalização.** Ao finalizar, escolhe-se um motivo de um catálogo configurável (`atendimento_motivos`), gravado no atendimento para fins de relatório (base das métricas da Fase 3).
8. **Mensagens rápidas.** Textos prontos que o **atendente** dispara manualmente com `/` durante a conversa (agiliza o atendimento). Catálogo próprio (`atendimento_mensagens_rapidas`), **distinto** de `bot_mensagens` (respostas automáticas do bot). Cadastradas na área Admin.

**Fora do MVP (registrado para depois):** comentários/notas internas no chamado; múltiplos participantes por atendimento (MVP tem só o `responsavel_id`); mensagens programadas/retornos; criação de tarefa a partir do chamado (Fase 2); banco de arquivos.

**Duas áreas de UI no mesmo app.** O app de Atendimento tem a área de **Atendimento** (inbox, usada pelos atendentes, é o print de referência) e uma área de **Administração** (`/admin`, só para admins) com config do bot, departamentos, tags, motivos, horários, relatórios/métricas e permissões. As duas moram **neste app** (não no Painel de Implantação). Impacto no modelo de dados é só de permissão: escrita de config é gated por `can('atendimento.config')` (perfil admin). O desenho das telas é da **Seção 4**.

## 3. Ciclo de vida do atendimento

```
Cliente manda 1ª mensagem
      │  (Edge Function cria contato + atendimento em status 'triagem')
      ▼
  [ triagem ]  ── bot envia saudação + menu (gerado dos departamentos ativos)
      │  cliente escolhe departamento válido
      ▼
  [ na_fila ]  ── aparece na fila do departamento; visível a quem atende esse dep.
      │  atendente clica "Assumir"  (responsavel_id = ele, assumido_em = agora)
      ▼
[ em_atendimento ] ── só o responsável responde
      │  atendente clica "Finalizar" (finalizado_em = agora)
      ▼
 [ finalizado ]
      │  cliente volta a falar
      ├── Δ ≤ 3h  → reabre o MESMO atendimento (reativa; novo status e destino do responsável = regra da Seção 3)
      └── Δ > 3h  → abre atendimento NOVO (status 'triagem', novo protocolo)
```

Transições de status permitidas: `triagem→na_fila`, `na_fila→em_atendimento`, `em_atendimento→finalizado` e a **reabertura** `finalizado→(na_fila|em_atendimento)` dentro da janela de 3h. Para o modelo de dados basta que a transição de saída de `finalizado` exista; **qual** status assume e se o responsável anterior é mantido são regra de fluxo, definidas na **Seção 3 do design** ([../../bot.md](../../bot.md)).

**Transferência** (a partir de `na_fila` ou `em_atendimento`):
- para **departamento**: troca `departamento_id`, zera `responsavel_id`, status volta a `na_fila` (alguém do novo departamento assume).
- para **atendente**: seta `responsavel_id` (e `departamento_id` do atendente, se informado), status `em_atendimento`.
- toda transferência gera uma linha em `atendimento_transferencias` (quem, quando, de/para).

## 4. Tabelas

Convenção: todas com `id UUID PK DEFAULT gen_random_uuid()` salvo indicação; `created_at TIMESTAMPTZ DEFAULT now()`.

### 4.1 `departamentos`
Filas de atendimento; alimentam o menu do bot.

| Coluna | Tipo | Notas |
|---|---|---|
| `nome` | TEXT NOT NULL | rótulo exibido |
| `ordem` | INT NOT NULL DEFAULT 0 | ordem no menu do bot |
| `ativo` | BOOLEAN NOT NULL DEFAULT true | inativo não entra no menu |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

Seeds (dos prints): `SUPORTE GERAL`, `ASSUNTOS FINANCEIROS`, `COMERCIAL (VENDAS)`, `DÚVIDAS COM NOTAS FISCAIS`, `ARQUIVOS FISCAIS (CONTABIL-SPED)`, `OUTROS ASSUNTOS`.

### 4.2 `atendente_departamentos`
Vínculo N:N atendente ↔ departamento. Define visibilidade.

| Coluna | Tipo | Notas |
|---|---|---|
| `usuario_id` | UUID FK → `usuarios` ON DELETE CASCADE | |
| `departamento_id` | UUID FK → `departamentos` ON DELETE CASCADE | |
| `created_at` | TIMESTAMPTZ | |
| **PK** | `(usuario_id, departamento_id)` | |

### 4.3 `contatos`
Identidade do cliente no WhatsApp (telefone = identidade).

| Coluna | Tipo | Notas |
|---|---|---|
| `telefone` | TEXT NOT NULL UNIQUE | **E.164**, ex. `+5511912345678` |
| `nome_whatsapp` | TEXT | nome que vem do WhatsApp |
| `cliente_id` | UUID FK → `clientes` ON DELETE SET NULL, NULL | preenchido no match |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

### 4.4 `atendimentos`
Um ticket por chamado.

| Coluna | Tipo | Notas |
|---|---|---|
| `protocolo` | BIGINT GENERATED ALWAYS AS IDENTITY, UNIQUE | número humano do chamado |
| `contato_id` | UUID FK → `contatos` NOT NULL | |
| `departamento_id` | UUID FK → `departamentos`, NULL | NULL enquanto em `triagem` |
| `responsavel_id` | UUID FK → `usuarios`, NULL | preenchido ao Assumir |
| `motivo_id` | UUID FK → `atendimento_motivos`, NULL | preenchido ao Finalizar (relatório) |
| `status` | TEXT NOT NULL DEFAULT `'triagem'` | CHECK: `triagem`\|`na_fila`\|`em_atendimento`\|`finalizado` |
| `canal` | TEXT NOT NULL DEFAULT `'whatsapp'` | |
| `aberto_em` | TIMESTAMPTZ DEFAULT now() | |
| `assumido_em` | TIMESTAMPTZ NULL | |
| `finalizado_em` | TIMESTAMPTZ NULL | |
| `ultima_mensagem_em` | TIMESTAMPTZ | usado na ordenação da inbox e na janela de reabertura |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

Índices: `contato_id`, `departamento_id`, `responsavel_id`, `status`, `ultima_mensagem_em`.

### 4.5 `atendimento_mensagens`

| Coluna | Tipo | Notas |
|---|---|---|
| `atendimento_id` | UUID FK → `atendimentos` ON DELETE CASCADE NOT NULL | |
| `direcao` | TEXT NOT NULL | CHECK: `entrada`\|`saida` |
| `origem` | TEXT NOT NULL | CHECK: `cliente`\|`atendente`\|`bot` |
| `corpo` | TEXT | pode ser NULL se só anexo |
| `remetente_usuario_id` | UUID FK → `usuarios`, NULL | preenchido em `saida` humana |
| `wa_message_id` | TEXT | id da uazapi; idempotência + correlação de status |
| `status` | TEXT NULL | CHECK: `enviado`\|`entregue`\|`lido`\|`falhou` (só `saida`) |
| `created_at` | TIMESTAMPTZ | |

Índices: `atendimento_id`; **UNIQUE parcial** em `wa_message_id` where `wa_message_id IS NOT NULL` (dedupe de webhook).

### 4.6 `atendimento_anexos`
Mídia via Cloudinary (mesmo padrão de `scrap_anexos`/`tarefa_anexos` do painel).

| Coluna | Tipo | Notas |
|---|---|---|
| `mensagem_id` | UUID FK → `atendimento_mensagens` ON DELETE CASCADE NOT NULL | |
| `public_id` | TEXT | id no Cloudinary |
| `url` | TEXT | |
| `tipo_mime` | TEXT | |
| `tamanho_bytes` | BIGINT | |
| `nome_arquivo` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

### 4.7 `bot_mensagens`
Textos pré-programados (chave-valor). Menu é gerado dos departamentos, **não** fica aqui.

| Coluna | Tipo | Notas |
|---|---|---|
| `chave` | TEXT UNIQUE NOT NULL | `saudacao`, `fora_horario`, `opcao_invalida`, … |
| `texto` | TEXT NOT NULL | |
| `ativo` | BOOLEAN NOT NULL DEFAULT true | |
| `updated_at` | TIMESTAMPTZ | |

### 4.8 `atendimento_horarios`
Horário de atendimento (MVP: global; por-departamento fica pra depois).

| Coluna | Tipo | Notas |
|---|---|---|
| `dia_semana` | INT NOT NULL | CHECK 0–6 (0 = domingo) |
| `hora_inicio` | TIME NOT NULL | |
| `hora_fim` | TIME NOT NULL | |
| `ativo` | BOOLEAN NOT NULL DEFAULT true | |

### 4.9 `atendimento_config`
Ajustes globais chave-valor.

| Coluna | Tipo | Notas |
|---|---|---|
| `chave` | TEXT PK | |
| `valor` | TEXT NOT NULL | |
| `updated_at` | TIMESTAMPTZ | |

Seeds iniciais: `janela_reabertura_horas = '3'`, `timezone = 'America/Sao_Paulo'`.

### 4.10 `atendimento_tags`
Catálogo de rótulos de chamado (CRUD em Configurações).

| Coluna | Tipo | Notas |
|---|---|---|
| `nome` | TEXT NOT NULL UNIQUE | ex. `SUPORTE SISTEMA` |
| `ordem` | INT NOT NULL DEFAULT 0 | |
| `ativo` | BOOLEAN NOT NULL DEFAULT true | |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

Seeds (dos prints): `SUPORTE SISTEMA`, `NOTA FISCAL`, `RESOLVIDO POR LIGAÇÃO`, `ARQUIVO FISCAL`, `NÃO RELACIONADO A GR7`.

### 4.11 `atendimento_tag_vinculos`
Aplicação N:N de tags a um atendimento.

| Coluna | Tipo | Notas |
|---|---|---|
| `atendimento_id` | UUID FK → `atendimentos` ON DELETE CASCADE | |
| `tag_id` | UUID FK → `atendimento_tags` ON DELETE CASCADE | |
| `aplicada_por` | UUID FK → `usuarios`, NULL | quem marcou |
| `created_at` | TIMESTAMPTZ | |
| **PK** | `(atendimento_id, tag_id)` | |

### 4.12 `atendimento_motivos`
Catálogo de motivos de finalização (CRUD em Configurações).

| Coluna | Tipo | Notas |
|---|---|---|
| `nome` | TEXT NOT NULL UNIQUE | ex. `SUPORTE GERAL` |
| `ordem` | INT NOT NULL DEFAULT 0 | |
| `ativo` | BOOLEAN NOT NULL DEFAULT true | |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

### 4.13 `atendimento_transferencias`
Histórico de transferências de um atendimento.

| Coluna | Tipo | Notas |
|---|---|---|
| `atendimento_id` | UUID FK → `atendimentos` ON DELETE CASCADE NOT NULL | |
| `de_departamento_id` | UUID FK → `departamentos`, NULL | departamento antes |
| `para_departamento_id` | UUID FK → `departamentos`, NULL | departamento depois |
| `de_usuario_id` | UUID FK → `usuarios`, NULL | responsável antes |
| `para_usuario_id` | UUID FK → `usuarios`, NULL | responsável depois (se transferiu a atendente) |
| `transferido_por` | UUID FK → `usuarios` NOT NULL | quem transferiu |
| `observacao` | TEXT NULL | nota opcional |
| `created_at` | TIMESTAMPTZ | |

Índice: `atendimento_id`.

### 4.14 `atendimento_mensagens_rapidas`
Textos prontos do atendente (disparados com `/`). Catálogo global; CRUD na área Admin. **Não confundir** com `bot_mensagens` (automáticas do bot).

| Coluna | Tipo | Notas |
|---|---|---|
| `atalho` | TEXT NOT NULL UNIQUE | o que segue o `/` (ex.: `bomdia`) |
| `titulo` | TEXT NOT NULL | rótulo na lista |
| `texto` | TEXT NOT NULL | conteúdo inserido na conversa |
| `ativo` | BOOLEAN NOT NULL DEFAULT true | |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

## 5. Reconhecimento de cliente (telefone E.164)

- **Normalização:** todo telefone (de entrada do webhook e de `clientes` na comparação) é reduzido a E.164 `+55DDDNXXXXXXXX`. `contatos.telefone` é **sempre** gravado normalizado (UNIQUE garante 1 contato por número).
- **Match com `clientes`:** ao criar o contato, comparar o telefone normalizado contra `clientes.telefone` e `clientes.telefone_responsavel` (também normalizados em runtime, sem alterar a tabela do painel). Achou → grava `cliente_id`.
- **Celular BR com "9":** ao comparar, tolerar a ausência/presença do nono dígito em números antigos (fallback de comparação). Detalhe de implementação da função de normalização.
- `clientes` permanece **read-only**; nenhum vínculo altera o painel.

## 6. RLS e permissões

Helper novo:

```sql
-- true se o usuário logado atende o departamento informado
create function atende_departamento(dep_id uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from atendente_departamentos ad
    where ad.departamento_id = dep_id
      and ad.usuario_id = current_user_id()
  );
$$;
```

Políticas (resumo):

| Tabela | SELECT | INSERT/UPDATE |
|---|---|---|
| `departamentos` | autenticado (lista para menu/config) | `can('atendimento.config')` |
| `atendente_departamentos` | autenticado | `can('atendimento.config')` |
| `contatos` | autenticado | Edge Function (service role) |
| `atendimentos` | `atende_departamento(departamento_id)` **ou** `responsavel_id = current_user_id()` | ações via `can()`; escrita do bot por service role |
| `atendimento_mensagens` | atendimento pai visível (EXISTS join) | `can('atendimento.responder')` / service role |
| `atendimento_anexos` | mensagem pai visível | idem mensagens |
| `atendimento_tags`, `atendimento_motivos`, `atendimento_mensagens_rapidas` | autenticado (catálogos) | `can('atendimento.config')` |
| `atendimento_tag_vinculos` | atendimento pai visível | `can('atendimento.responder')` |
| `atendimento_transferencias` | atendimento pai visível | `can('atendimento.transferir')` |
| `bot_mensagens`, `atendimento_horarios`, `atendimento_config` | autenticado | `can('atendimento.config')` |

Observações:
- Atendimentos em `triagem` têm `departamento_id IS NULL` → **não** aparecem para nenhum atendente; são conduzidos pela Edge Function do bot (service role) até o cliente escolher o departamento.
- **Ações novas** no catálogo `acoes` do painel: `atendimento.assumir`, `atendimento.responder`, `atendimento.finalizar`, `atendimento.transferir`, `atendimento.config`.
- **Transferência entre departamentos e RLS:** ao transferir para um departamento que o atendente atual não atende, ele deixa de ver o atendimento logo após a transferência (efeito esperado da RLS). O histórico em `atendimento_transferencias` preserva o rastro.
- Edge Functions (webhook/envio/bot) usam **service role** e portanto ignoram RLS — a trava por departamento protege o acesso via app/UI dos atendentes.

## 7. Reaproveitamento do painel (read-only)

- `clientes` — match por telefone (Seção 5). Read-only.
- `usuarios` — atendentes e responsáveis.
- `acoes` / `can()` — permissões das ações do atendimento.
- `notificacoes` — **não alterar no MVP**; integração com o sino do painel é pós-MVP.

## 8. Fora do escopo desta seção

- Fluxo detalhado do bot (saudação, roteamento, opção inválida, fora de horário) → **Seção 3** ([../../bot.md](../../bot.md)).
- Telas da inbox/configurações → **Seção 4**.
- Integração uazapi/adapter/webhook → **Seção 5** ([../../whatsapp.md](../../whatsapp.md)).
- Endurecimentos pós-MVP: horário por departamento; notificação cross-app; histórico de atendimento na ficha do cliente (Fase 2 do roadmap).
- Recursos vistos nos prints adiados: comentários/notas internas, múltiplos participantes, mensagens programadas/retornos, banco de arquivos, criação de tarefa (ver "Fora do MVP" na Seção 2).

## 9. Estrutura da área Admin e ordem de implementação

A área **Admin** (`/admin`, só para perfis com `can('atendimento.config')`) tem o sidebar abaixo. Os detalhes de cada aba virão por prints ao longo do desenvolvimento; aqui fica o mapa e a fonte de dados de cada uma.

| Aba (sidebar) | Fonte de dados | MVP |
|---|---|---|
| Dashboard | métricas derivadas (atendimentos, tempos) | Fase 3 |
| Usuários | `usuarios` (painel, read-only) + `atendente_departamentos` | sim (vínculo) |
| Departamentos | `departamentos` | sim |
| Tags | `atendimento_tags` | sim |
| Motivos | `atendimento_motivos` | sim |
| Mensagens rápidas | `atendimento_mensagens_rapidas` | sim |
| Horário de Funcionamento | `atendimento_horarios` + `atendimento_plantoes` + `atendimento_plantao_usuarios` + msg `fora_horario` | sim |
| Relatórios | métricas derivadas (`motivo_id`, `avaliacao`, tempos) | Fase 3 |
| Configurações BOT | `bot_mensagens` + `atendimento_config` | sim |

**Ordem de implementação** (detalhada no plano; por dependência de dados, não por "painel inteiro"):

1. Scaffold + migrations (todas as tabelas + seeds de config)
2. Admin – abas de configuração que o atendimento consome: Departamentos, Horário de Funcionamento (comercial + plantão), Configurações BOT, Tags, Motivos, Mensagens rápidas, Usuários (vínculo)
3. Atendimento (inbox) – produto principal, já com config real
4. Admin – Dashboard e Relatórios (Fase 3; dependem de dados de atendimento)
5. Integração uazapi (webhook + envio + bot) – por último

Os dados iniciais de config entram por **seed na migration** (departamentos, tags, motivos, textos do bot), então o atendimento não fica bloqueado esperando 100% das telas admin.

## 10. Adendo — Seção 3 (fluxo do bot) e refinamentos

Decisões da Seção 3 ([../../bot.md](../../bot.md)) que impactaram o modelo. Todas já refletidas em [../../db.md](../../db.md):

**Contatos (refino da Decisão 1):**
- `contatos.nome` (editável pelo atendente, "quem fala") + `contatos.nome_whatsapp` (origem).
- Match automático acerta pouco (painel só tem telefone do dono) → **vínculo manual** de empresa (`cliente_id`) é o caminho principal no MVP.
- Aba "Contatos" por cliente no painel: **pós-MVP, lado do painel**.

**Plantão (ADR-09):**
- Novas tabelas `atendimento_plantoes` (turnos: dia/hora/ativo) e `atendimento_plantao_usuarios` (N:N).
- `atendimentos.plantao_id` marca o ticket criado em plantão → fila de plantão via helper RLS `e_plantonista(plantao_id)`.
- Fora do comercial **sem** plantonista na plataforma: bot só envia `fora_horario` (texto livre com emergência) e **não cria ticket**.

**Fallback de triagem (ADR-08):** `atendimentos.tentativas_menu`; após `max_tentativas_menu` (2) → departamento padrão (`departamento_padrao_id`).

**Avaliação (opcional):** `atendimentos.avaliacao` (0-10) + `avaliacao_solicitada_em`; config `avaliacao_ativa`, `tempo_avaliacao_min` (60).

**Encerramento:** `atendimentos.encerrado_por` (`atendente`|`cliente`); `#sair` encerra pelo cliente.

**Nome do atendente:** config `enviar_nome_atendente` prefixa respostas humanas com `{atendente}`.

**Novas configs (`atendimento_config`):** `departamento_padrao_id`, `max_tentativas_menu`, `enviar_nome_atendente`, `avaliacao_ativa`, `tempo_avaliacao_min` (além de `janela_reabertura_horas`, `timezone`).

**`bot_mensagens` (12 chaves):** `bem_vindo`, `instrucao_menu`, `opcao_invalida`, `voltar_menu`, `entrou_fila`, `encaminhado_padrao`, `plantao`, `fora_horario`, `encerramento`, `solicitar_avaliacao`, `agradecimento_avaliacao`, `avaliacao_invalida`. Placeholders `{empresa}` `{contato}` `{protocolo}` `{departamento}` `{atendente}` `{horario}`.

**Total: 16 tabelas.** Pós-MVP adicionais: controle de acesso por horário, palavras-chave, recado, potenciais + timeouts, responder grupos, contatos de emergência estruturados.
