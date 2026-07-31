# PRD — GR7 Atendimento

## Contexto

A GR7 Automação faz atendimento aos clientes hoje pela **Zintech** (plataforma omnichannel + chatbot + CRM + PABX). A Zintech não atende dois pontos que os CEOs consideram críticos:

1. **Vínculo com a implantação** — atendimento e painel de implantação são mundos separados; a informação não conversa com o cliente/projeto/tarefa já geridos no painel.
2. **Recursos e, principalmente, métricas** — os CEOs querem indicadores de atendimento que hoje não têm.

Decisão: construir **plataforma de atendimento própria**, interligada ao painel.

## Objetivo

Uma central de atendimento **WhatsApp**, operada pela equipe interna, que:

- Centraliza as conversas dos clientes numa inbox por departamento
- Se conecta nativamente ao painel (cliente/projeto/tarefa) — mesmo banco
- Fornece **métricas de atendimento** para a gestão (foco final)

## Personas

- **Atendente (interno GR7):** usa a inbox, assume e responde tickets. Enxerga os **seus** mais a **fila livre** de todos os setores, e não vê o chamado que já é de outro atendente (visibilidade por dono, revista em 2026-07-24 — ver [db.md](db.md)). É um `usuario` já existente no painel.
- **Gestor/CEO:** consome métricas e relatórios.
- **Cliente final:** conversa **pelo WhatsApp**. **NÃO loga em nada** — não há portal do cliente.

## Modelo de atendimento

- **Inbox omnichannel (só WhatsApp por ora)** — o cliente conversa pelo WhatsApp; a equipe atende.
- **Por ticket:** cada chamado é um ticket novo. O cliente escolhe o departamento num menu do bot; o ticket cai na fila desse departamento e aparece para os atendentes vinculados. Ao encerrar, o ticket é finalizado. Reabertura dentro de uma janela curta reaproveita o mesmo ticket.

## Escopo do MVP

**Entra (base navegável, sem uazapi):**
- App separado, design dark, login compartilhado (mesmo Supabase)
- Configurações: CRUD de Departamentos · vínculo atendentes↔departamentos · mensagens do bot (saudação, fora de horário) · horário de atendimento
- Inbox: fila do departamento + meus atendimentos · thread de mensagens · Assumir → Responder → Finalizar
- Schema das tabelas novas · vínculo automático contato↔cliente por telefone

**Entra por último (depende da uazapi):**
- Adapter + webhook + envio + bot rodando de verdade

**Fora do MVP (fases seguintes):**
- Integrações com o painel (tarefa/projeto a partir do chamado) — Fase 2
- Métricas/dashboard/relatórios — Fase 3
- Distribuição automática, outros canais, bot avançado, base de conhecimento — Fase 4

## Requisitos funcionais (MVP)

- **RF1** Departamentos: criar/editar/ativar/desativar/ordenar
- **RF2** Atendentes: vincular um `usuario` a 1+ departamentos
- **RF3** Bot: saudação + menu automático dos departamentos ativos + mensagem de fora de horário
- **RF4** Roteamento: cliente escolhe o departamento → ticket na fila do departamento
- **RF5** Ticket: Assumir (explícito) → Em atendimento → Finalizar; reabertura dentro de janela curta
- **RF6** Inbox: fila do departamento e "meus atendimentos"; thread com envio de texto e mídia
- **RF7** Contato: identidade por telefone (E.164); casar com `clientes` quando possível

## Requisitos não-funcionais

- **RNF1** Design **dark idêntico** ao painel
- **RNF2** **Isolamento do painel em produção** — migrations só aditivas; código não importa do painel
- **RNF3** Provedor WhatsApp atrás de **adapter** (trocável)
- **RNF4** Supabase **Free** no piloto → **Pro** na produção real
- **RNF5** Sem multi-tenancy — cliente não loga

## Fora de escopo (não fazer por ora)

API oficial da Meta · portal do cliente · monorepo · distribuição automática no MVP.
