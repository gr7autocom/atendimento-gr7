# Progresso — GR7 Atendimento

> Estado atual. Decisões em [docs/decisoes.md](docs/decisoes.md). Direção em [ROADMAP.md](ROADMAP.md).

## 🔄 Em Andamento

**Fase de design (brainstorming) — 2026-07-23**

Design aprovado (Seções 1-4). **Seção 5 (uazapi) adiada:** desenvolvemos com **adapter mock + seeds**, integração real com a uazapi entra depois (só troca o driver). **Git dedicado resolvido** (repo próprio na pasta, branch main). Próximo: escrever o **plano de implementação** (migrations+seeds → admin → inbox, com mock).

## 📋 Próximos passos

### Fechar o design (antes de codar)

- [ ] Seção 5 — Integração uazapi + adapter (validar [docs/whatsapp.md](docs/whatsapp.md))
- [ ] Escrever spec final + plano de implementação

### Implementação do MVP (ordem — "base navegável primeiro, uazapi por último")

1. [ ] Scaffold: instalar deps (espelhar painel), Tailwind v4, design tokens dark, Supabase client, auth compartilhada, layout + sidebar
2. [ ] Migrations das tabelas novas (aditivas, no repo do painel)
3. [ ] Configurações: CRUD Departamentos · vínculo atendentes↔departamentos · mensagens do bot · horários
4. [ ] Inbox: fila do departamento + meus atendimentos · thread de mensagens · Assumir/Responder/Finalizar
5. [ ] Integração uazapi: adapter + webhook (receber) + envio + bot por ticket — **depende de conta uazapi + número**

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
- 2026-07-23 — **Seção 4 (Telas) aprovada.** Duas áreas com sidebar própria: Atendimento (`/inbox`) e Admin (`/admin`, gated por `can('atendimento.config')`). Inbox em 3 colunas (filas Meus/Pendentes+selo plantão/Potenciais · conversa · painel do contato com nome editável/empresa/tags/histórico/contadores/vincular empresa). Admin com 9 abas (Dashboard e Relatórios como placeholder Fase 3; vínculo atendente↔departamento na aba Usuários). Responsivo com foco desktop. Spec de telas em [docs/telas.md](docs/telas.md); mapa de docs no CLAUDE.md atualizado.
- 2026-07-23 — **Seção 3 (Fluxo do bot) aprovada.** Fluxo completo do bot; plantão (turnos + plantonistas vinculados, fila de plantão via `e_plantonista`); fora do comercial sem plantonista só direciona (mensagem de emergência, não cria ticket); fallback de triagem p/ departamento padrão após 2 tentativas; avaliação 0-10 opcional; `#sair` encerra pelo cliente; nome do atendente nas mensagens; 12 textos do bot. Refino de contatos: `nome` editável + vínculo manual de empresa (aba Contatos no painel fica pós-MVP). Sobe p/ **16 tabelas**. [docs/bot.md](docs/bot.md), [docs/db.md](docs/db.md), spec e mapa do admin sincronizados. Controle de acesso por horário e outras features do Zintech ficaram pós-MVP.
