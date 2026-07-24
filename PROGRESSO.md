# Progresso — GR7 Atendimento

> Estado atual. Decisões em [docs/decisoes.md](docs/decisoes.md). Direção em [ROADMAP.md](ROADMAP.md).

## 🔄 Em Andamento

**Fase de design (brainstorming) — 2026-07-23**

Implementação em curso. **Planos 1 (Fundação), 2 (Banco), 3 (Admin — catálogos) e 4 (Admin — config/horário/usuários) concluídos. A área Admin está completa.** Próximo: **Inbox** (filas, conversa, painel do contato) com **adapter mock + bot simulado**, sem uazapi. Depois, a **etapa de design** (ADR-10).

**Planos 1 a 3 (resumo):** Admin: hook `useCrud` (TanStack Query), `AdminModal`, `CatalogoCrud` genérico e as 4 abas de catálogo (Departamentos, Tags, Motivos, Mensagens rápidas) funcionando contra o banco real; CRUD validado no navegador com admin (criar/remover persistiram, provando a RLS de escrita). Próximo: **Plano 4 (Admin — Configurações BOT, Horário de Funcionamento com plantão, Usuários)**, depois a Inbox.

**Planos 1 e 2 (resumo):** Fundação: app rodando, auth compartilhada, rotas/guarda, layout + telas placeholder (branch `feat/fundacao`). Banco: 3 migrations aditivas (schema 16 tabelas + RLS por departamento + seeds) escritas no repo do painel e **aplicadas no Supabase compartilhado via `db push`**; verificado com admin logado (6 departamentos, 12 textos do bot, 6 configs, 5 tags, 5 motivos, capacidades `atendimento.*` no perfil admin, RLS sem erro). Seção 5 (uazapi) segue adiada (adapter mock + seeds). Próximo: **Plano 3 (Admin)** — telas de configuração (CRUD) consumindo as tabelas.

## 📋 Próximos passos

### Implementação (o que falta)

1. [ ] (P0) **Plano 4 — Admin:** Configurações BOT (12 textos + flags), Horário de Funcionamento (comercial + plantão + plantonistas + msg fora de horário), Usuários (vínculo atendente↔departamento)
2. [ ] (P0) **Inbox:** filas (Meus/Pendentes/Potenciais) · conversa · painel do contato · Assumir/Responder/Transferir/Finalizar · **adapter mock + bot simulado** (sem uazapi)
3. [ ] (P1) **Etapa de design:** identidade visual **própria** do Atendimento (ADR-10), repolindo admin + inbox. Feita depois das telas, por decisão do cliente
4. [ ] (P2) **Integração uazapi:** adapter real + webhook + envio (Seção 5 do design, adiada) — **depende de conta uazapi + número**

### Pré-requisitos externos (negócio — bloqueiam o passo 5)

- [ ] Conta/assinatura uazapi ativa + número de WhatsApp dedicado conectado (QR)
- [ ] Confirmar reputação de estabilidade/uptime da uazapi antes de assinar

## ✅ Concluído

- 2026-07-23 — Discovery + decisões de arquitetura fechadas (ver [docs/decisoes.md](docs/decisoes.md)): app separado + Supabase compartilhado; WhatsApp via uazapi + adapter; migrations aditivas no painel; Supabase Free→Pro; sem multi-tenancy (cliente não loga).
- 2026-07-23 — Escopo do MVP aprovado (Seção 1). Corte: base navegável primeiro, uazapi por último.
- 2026-07-23 — Decisões de fluxo: assumir explícito; menu do bot automático a partir dos departamentos; janela de reabertura curta de ticket.
- 2026-07-23 — Scaffold Vite base criado (template react-ts) + estrutura de documentação.
- 2026-07-23 — Stack ajustada: adicionados **TanStack Query** (data-fetching/cache do inbox) e **Zod** (validação de forms + webhook). Escopo WhatsApp reduzido só à **uazapi** — Baileys self-host + Fly.io saiu do escopo (adapter continua como ponto de reversibilidade). Docs sincronizadas: CLAUDE.md, docs/whatsapp.md, docs/decisoes.md, README.md, ROADMAP.md.
- 2026-07-23 — **Seção 2 (Modelo de dados) aprovada.** 14 tabelas; RLS por departamento no banco desde o MVP; reconhecimento de cliente E.164; reabertura 3h; status triagem/na_fila/em_atendimento/finalizado; transferência (com histórico), tags, motivo de finalização e mensagens rápidas incorporados dos prints do Zintech; área Admin `/admin` dentro do próprio app. Spec em [docs/superpowers/specs/2026-07-23-modelo-dados-design.md](docs/superpowers/specs/2026-07-23-modelo-dados-design.md); [docs/db.md](docs/db.md) sincronizado. Ordem de implementação definida.
- 2026-07-23 — **Plano 4 (Admin — config, horário/plantão, usuários) implementado.** Hooks `useConfig` (upsert por `chave`), `useBotMensagens`, `useVinculos` (N:N) e `useUsuarios` (leitura do painel). Telas: Configurações BOT (12 textos na ordem do fluxo + flags de comportamento), Horário de Funcionamento (comercial por dia + turnos de plantão + plantonistas marcáveis) e Usuários (vínculo atendente↔departamento). **Admin completo.** Validado no navegador: dia comercial criado, turno de plantão criado com plantonista, e vínculo `Pabllo Martins ↔ SUPORTE GERAL` persistido (pré-requisito da Inbox). Testes 7/7, build ok. Plano em [docs/superpowers/plans/2026-07-23-admin-config.md](docs/superpowers/plans/2026-07-23-admin-config.md).
- 2026-07-23 — **Plano 3 (Admin — catálogos) implementado.** `useCrud` (TanStack Query + Supabase), `AdminModal`, `CatalogoCrud` genérico dirigido por config de campos, e as abas Departamentos, Tags, Motivos e Mensagens rápidas ligadas em `/admin`. Testes 6/6, build ok, validado no navegador com admin real (criar e remover persistiram, confirmando a RLS de escrita por `can('atendimento.config')`). Plano em [docs/superpowers/plans/2026-07-23-admin-catalogos.md](docs/superpowers/plans/2026-07-23-admin-catalogos.md).
- 2026-07-23 — **Plano 1 (Fundação) e Plano 2 (Banco) implementados.** Fundação na branch `feat/fundacao` (9 commits, testes verdes, login validado no navegador com admin real). Banco: 16 tabelas + RLS por departamento (helpers `atende_departamento`/`e_plantonista`) + seeds, aplicado no Supabase compartilhado (migrations `20260723180000/180100/180200` no repo do painel, branch main); catálogo de ações via `permissoes.capacidades` (não há tabela `acoes`). Verificado com admin logado. [docs/db.md](docs/db.md) sincronizado.
- 2026-07-23 — **Seção 4 (Telas) aprovada.** Duas áreas com sidebar própria: Atendimento (`/inbox`) e Admin (`/admin`, gated por `can('atendimento.config')`). Inbox em 3 colunas (filas Meus/Pendentes+selo plantão/Potenciais · conversa · painel do contato com nome editável/empresa/tags/histórico/contadores/vincular empresa). Admin com 9 abas (Dashboard e Relatórios como placeholder Fase 3; vínculo atendente↔departamento na aba Usuários). Responsivo com foco desktop. Spec de telas em [docs/telas.md](docs/telas.md); mapa de docs no CLAUDE.md atualizado.
- 2026-07-23 — **Seção 3 (Fluxo do bot) aprovada.** Fluxo completo do bot; plantão (turnos + plantonistas vinculados, fila de plantão via `e_plantonista`); fora do comercial sem plantonista só direciona (mensagem de emergência, não cria ticket); fallback de triagem p/ departamento padrão após 2 tentativas; avaliação 0-10 opcional; `#sair` encerra pelo cliente; nome do atendente nas mensagens; 12 textos do bot. Refino de contatos: `nome` editável + vínculo manual de empresa (aba Contatos no painel fica pós-MVP). Sobe p/ **16 tabelas**. [docs/bot.md](docs/bot.md), [docs/db.md](docs/db.md), spec e mapa do admin sincronizados. Controle de acesso por horário e outras features do Zintech ficaram pós-MVP.
