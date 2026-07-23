# GR7 Atendimento — instruções do projeto

Plataforma de atendimento via WhatsApp da GR7, operada pela equipe interna, **interligada ao Painel de Implantação** pelo mesmo Supabase.

> Regras gerais de processo (fluxo de 2 turnos, PROGRESSO, Context7, DoD, idioma, segurança de credenciais) estão no `~/.claude/CLAUDE.md` global. Este arquivo cobre o que é específico do Atendimento.

## Relação com o Painel de Implantação (LEIA PRIMEIRO)

- **App separado**: este projeto vive em `Desktop/projeto/atendimento-gr7/`, **irmão** de `painel-implantacao-v2/`. Git, build e deploy próprios.
- **Mesmo Supabase**: usa o **mesmo projeto Supabase** do painel (banco, auth, Edge Functions). O atendente loga com a conta que já tem no painel.
- **NÃO AFETAR O PAINEL (produção):** o painel está em produção com a equipe usando. Regras invioláveis:
  1. **Migrations só ADITIVAS** — no MVP, apenas `CREATE TABLE` de tabelas novas. **Nenhum `ALTER`/`DROP`** em tabela do painel.
  2. As migrations das tabelas novas moram no **repo do painel** (`painel-implantacao-v2/supabase/migrations/`), que é a fonte única do schema já linkada. Prefixo `atendimento_`/`departamentos`/`contatos`.
  3. O código deste projeto **nunca** importa de dentro do painel — o design system é **copiado** (ver [docs/design.md](docs/design.md)).

## Stack

- **Frontend:** React 19 + TypeScript + Vite · TailwindCSS v4 (`@tailwindcss/vite`, sem config) · lucide-react · `clsx`+`tailwind-merge` (`cn`) · **TanStack Query** (data-fetching/cache do inbox) · **Zod** (validação de forms e payload do webhook)
- **Backend:** Supabase compartilhado · Edge Functions (Deno) para webhook/envio WhatsApp
- **WhatsApp:** **uazapi** (API REST SaaS não-oficial) via **adapter** — ver [docs/whatsapp.md](docs/whatsapp.md)
- **Design:** tema **dark**, idêntico ao painel — ver [docs/design.md](docs/design.md)

## Credenciais Supabase

- **URL:** `https://ghweohedmmmkufqhxdzn.supabase.co` (mesma do painel)
- Env vars (valores no `.env`, nunca commitar): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Copiar os valores do `.env` do painel (mesmo projeto Supabase). Service role só em Edge Functions/CLI.

## Mapa de documentação

| Quando for mexer em… | Leia |
|---|---|
| Visão/escopo/requisitos | [docs/prd.md](docs/prd.md) |
| Estrutura, deploy, isolamento, plano Supabase | [docs/arquitetura.md](docs/arquitetura.md) |
| Tabelas, colunas, RLS, migrations | [docs/db.md](docs/db.md) |
| Cores, tokens, componentes, tema dark | [docs/design.md](docs/design.md) |
| Telas do MVP (inbox, admin), layout, responsividade | [docs/telas.md](docs/telas.md) |
| Webhook, envio, uazapi, adapter | [docs/whatsapp.md](docs/whatsapp.md) |
| Fluxo do bot, ciclo de vida do ticket | [docs/bot.md](docs/bot.md) |
| Por que decidimos X | [docs/decisoes.md](docs/decisoes.md) |

## Regras específicas

1. Design **dark idêntico ao painel** — copiar tokens/componentes, não reinventar.
2. Toda tabela nova com RLS; atendente vê tickets dos **seus departamentos** (ver [docs/db.md](docs/db.md)).
3. Provedor WhatsApp atrás de um **adapter** — nunca chamar a uazapi direto do código de domínio.
4. Nada de multi-tenancy: **cliente final não loga** — só a equipe interna opera.
5. Documentação viva: atualizar `PROGRESSO.md` + o `docs/*.md` afetado ao concluir algo.

## Context7 — libs a consultar

Ao mexer com estas libs, consultar `context7` antes: React, React Router DOM, Supabase (client/Postgres/Edge Functions), TailwindCSS v4, Vite, TypeScript, **TanStack Query**, **Zod**, **uazapi** (integração WhatsApp).
