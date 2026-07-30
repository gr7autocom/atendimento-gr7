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
- **Design:** tema **dark** com visual **próprio** do Atendimento (tokens de cor base vindos do painel; layout e componentes próprios). Etapa de design dedicada no fim da implementação — ver [docs/design.md](docs/design.md)

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
| Contatos, vínculo com empresa, o que o painel grava | [docs/prompt-alinhamento-contatos-painel.md](docs/prompt-alinhamento-contatos-painel.md) |

## Regras específicas

1. Design **dark com identidade própria** do Atendimento (decisão revista em 2026-07-23). Tokens de cor base copiados do painel; layout e componentes são próprios. A base visual foi **padronizada e auditada em 2026-07-29/30** (tokens, escala tipográfica, dimensões, espaçamento, contraste e teclado), com guarda em `src/padroes-ui.test.ts`. O que resta do ADR-10 é polimento **estético**, não a base: as telas não são mais "cruas de propósito".
2. Toda tabela nova com RLS; atendente vê tickets dos **seus departamentos** (ver [docs/db.md](docs/db.md)).
3. Provedor WhatsApp atrás de um **adapter** — nunca chamar a uazapi direto do código de domínio.
4. Nada de multi-tenancy: **cliente final não loga** — só a equipe interna opera.
5. Documentação viva: atualizar `PROGRESSO.md` + o `docs/*.md` afetado ao concluir algo.
6. **Toda criação/ajuste de UI: ler [docs/design.md](docs/design.md) E acionar a skill `ui-ux-pro-max`** (plugin, invocada como `ui-ux-pro-max:ui-ux-pro-max`) **antes** de escrever a tela. Nessa ordem, e as duas coisas. O `design.md` abre com um checklist de 4 itens: **componente que já existe** (não recriar campo, busca, tabela, menu, tag ou confirmação), **nenhum valor literal** (cor, raio, sombra, transição, tamanho de texto vêm de token; altura e espaçamento, da escala), **contraste medido** e **`npm test`**, que inclui a guarda `src/padroes-ui.test.ts`. A skill entra para UX, layout e refino; **não** trocar paleta, tipografia ou componentes por catálogo, a identidade está fechada em `src/tema.css` e `src/components/ui/`. No geral, usar **proativamente** as skills e plugins disponíveis (design, copywriting, banco) sem esperar o usuário pedir. O visual deve fugir do padrão genérico de UI gerada por IA.
7. **Padronização de UI não é sugestão.** Layout, cor, fonte, dimensão e espaçamento são decisão do sistema, não de cada tela: valor cravado à mão vira 32 lugares para corrigir depois. A auditoria de 2026-07-29/30 achou 24 problemas assim, e a guarda em `src/padroes-ui.test.ts` existe para não repetir. Se um padrão não serve para o caso novo, **estenda o componente ou o token** e atualize o `design.md`; não abra exceção na tela. Exceção real (a bolha do chat, a moldura da página) vive comentada no código e documentada.

## Context7 — libs a consultar

Ao mexer com estas libs, consultar `context7` antes: React, React Router DOM, Supabase (client/Postgres/Edge Functions), TailwindCSS v4, Vite, TypeScript, **TanStack Query**, **Zod**, **uazapi** (integração WhatsApp).
