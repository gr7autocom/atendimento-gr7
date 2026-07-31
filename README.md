# GR7 Atendimento — Central de Atendimento WhatsApp

Plataforma própria de atendimento via WhatsApp da GR7 Automação, **operada pela equipe interna** e **interligada ao Painel de Implantação** (mesmo banco Supabase).

Substitui a dependência da Zintech, entregando o que faltava: **vínculo com a implantação** (cliente/projeto/tarefa) e **métricas de atendimento** para a gestão.

> **App separado, backend compartilhado.** Este é um projeto frontend independente do painel, mas usa o **mesmo Supabase** (banco, auth, Edge Functions). Ver [docs/arquitetura.md](docs/arquitetura.md).

## Status

🟢 **MVP em implementação.** Base navegável pronta com dados reais: login, admin (departamentos, tags, mensagens rápidas, horários, atendentes, config do bot, aba Conexão) e inbox (filas, conversa, painel do contato, assumir/responder/transferir/finalizar). Falta a **integração real com a uazapi** — o adapter em `supabase/functions/` está pronto e conferido contra o spec oficial, aguardando conta + número. Ver [PROGRESSO.md](PROGRESSO.md).

## Stack

React 19 + TypeScript + Vite · TailwindCSS v4 · Supabase (compartilhado com o painel) · lucide-react · WhatsApp via **uazapi** (não-oficial).

## Como retomar o contexto (nova sessão)

1. Leia [CLAUDE.md](CLAUDE.md) — instruções e mapa do projeto
2. Leia [PROGRESSO.md](PROGRESSO.md) — onde paramos
3. Abra o `docs/*.md` relevante à tarefa (ver mapa no CLAUDE.md)

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [docs/prd.md](docs/prd.md) | Visão, problema, objetivos, escopo do MVP |
| [docs/arquitetura.md](docs/arquitetura.md) | App separado + Supabase compartilhado, isolamento, deploy |
| [docs/db.md](docs/db.md) | Modelo de dados / schema das tabelas novas |
| [docs/design.md](docs/design.md) | Design system (dark, tokens, componentes do painel) |
| [docs/whatsapp.md](docs/whatsapp.md) | Integração WhatsApp (uazapi, adapter, webhook) |
| [docs/bot.md](docs/bot.md) | Fluxo do bot e ciclo de vida do ticket |
| [docs/decisoes.md](docs/decisoes.md) | Registro de decisões (ADRs) |
