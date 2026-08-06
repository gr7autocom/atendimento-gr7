# PRD — GR7 Atendimento

## Contexto

A GR7 Automação faz atendimento aos clientes hoje pela **Zintech** (plataforma omnichannel + chatbot + CRM + PABX). A Zintech não atende dois pontos que os CEOs consideram críticos:

1. **Vínculo com a implantação** — atendimento e painel de implantação são mundos separados; a informação não conversa com o cliente/projeto/tarefa já geridos no painel.
2. **Recursos e, principalmente, métricas** — os CEOs querem indicadores de atendimento que hoje não têm.

Decisão: construir **plataforma de atendimento própria**, interligada ao painel.

## Objetivo

Uma central de atendimento operada pela equipe interna, com **WhatsApp** como canal principal e **web** como segundo canal (ADR-11), que:

- Centraliza as conversas dos clientes numa inbox por departamento, independente do canal de origem
- Se conecta nativamente ao painel (cliente/projeto/tarefa) — mesmo banco
- Fornece **métricas de atendimento** para a gestão (foco final)

## Personas

- **Atendente (interno GR7):** usa a inbox, assume e responde tickets. Enxerga os **seus** mais a **fila livre** de todos os setores, e não vê o chamado que já é de outro atendente (visibilidade por dono, revista em 2026-07-24 — ver [db.md](db.md)). É um `usuario` já existente no painel.
- **Gestor/CEO:** consome métricas e relatórios.
- **Cliente final:** conversa pelo **WhatsApp** ou pelo **PWA web** (ADR-11, ver [canal-web.md](canal-web.md)). **NÃO tem conta nem senha** — não há portal do cliente. No canal web ele apenas se identifica (nome e telefone) e alcança **uma conversa, só a dele**, por um token de dispositivo.

## Modelo de atendimento

- **Inbox omnichannel** — o cliente conversa pelo WhatsApp ou pelo canal web; a equipe atende os dois na **mesma inbox**, com selo indicando a origem. A coluna `atendimentos.canal` distingue.
- **Por ticket:** cada chamado é um ticket novo. O cliente escolhe o departamento (menu do bot no WhatsApp, lista clicável no web); o ticket cai na fila desse departamento e aparece para os atendentes. Ao encerrar, o ticket é finalizado. Reabertura dentro de uma janela curta reaproveita o mesmo ticket.

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
- **RNF5** Sem multi-tenancy — cliente **não tem conta nem senha**. No canal web, acesso a uma conversa por token de dispositivo, sem policy nova para o role `anon` (ADR-09 + ADR-11)

## Fora de escopo (não fazer por ora)

API oficial da Meta · **portal do cliente** (o canal web dá acesso a uma conversa, não a um portal com histórico e tarefas) · monorepo · distribuição automática no MVP.
