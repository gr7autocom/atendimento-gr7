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

- **Frontend:** React 19 + TypeScript + Vite · TailwindCSS v4 (`@tailwindcss/vite`, sem config) · lucide-react · `clsx`+`tailwind-merge` (`cn`) · **TanStack Query** (data-fetching/cache do inbox)
  - **Zod está instalado, mas não é usado em lugar nenhum** (conferido em 2026-07-31). Era previsto para forms e para o payload do webhook; os forms validam à mão e o `normalizar-uazapi.ts` valida de forma defensiva, porque o formato do envelope ainda não foi visto em tráfego real. Antes de escrever validação nova, decidir: adotar o Zod de fato ou tirar a dependência.
- **Backend:** Supabase compartilhado · Edge Functions (Deno) para webhook/envio WhatsApp
- **WhatsApp:** **uazapi** (API REST SaaS não-oficial) via **adapter** — ver [docs/whatsapp.md](docs/whatsapp.md)
- **Design:** tema **dark** com visual **próprio** do Atendimento (tokens de cor base vindos do painel; layout e componentes próprios). Base padronizada e auditada, ver a regra 1 e [docs/design.md](docs/design.md)

## Credenciais Supabase

- **URL:** `https://ghweohedmmmkufqhxdzn.supabase.co` (mesma do painel)
- Env vars (valores no `.env`, nunca commitar): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Copiar os valores do `.env` do painel (mesmo projeto Supabase). Service role só em Edge Functions/CLI.
- **Copiar do painel traz lixo junto, e um deles quebrou o build em silêncio.** O `.env` veio com `NODE_ENV=development` (o painel é uma aplicação Node; aqui nada usa essa variável). O Vite lê `NODE_ENV` dos arquivos `.env` e é dele que sai `import.meta.env.PROD`, então o `npm run build` produzia pacote de **desenvolvimento** e apagava na compilação todo bloco `if (import.meta.env.PROD)` — foi assim que o registro do service worker do PWA sumiu do build sem nenhum erro, em 2026-08-07. A defesa é o **`.env.production` versionado** (sem credencial, exceção explicada no `.gitignore`), que vence qualquer `.env` local. Não apague.

## Mapa de documentação

| Quando for mexer em… | Leia |
|---|---|
| Visão/escopo/requisitos | [docs/prd.md](docs/prd.md) |
| Estrutura, deploy, isolamento, plano Supabase | [docs/arquitetura.md](docs/arquitetura.md) |
| Tabelas, colunas, RLS, migrations | [docs/db.md](docs/db.md) |
| Cores, tokens, componentes, tema dark | [docs/design.md](docs/design.md) |
| Telas do MVP (inbox, admin), layout, responsividade | [docs/telas.md](docs/telas.md) |
| Webhook, envio, uazapi, adapter | [docs/whatsapp.md](docs/whatsapp.md) |
| Canal web, PWA do cliente, sessão sem login | [docs/canal-web.md](docs/canal-web.md) |
| Fluxo do bot, ciclo de vida do ticket | [docs/bot.md](docs/bot.md) |
| Por que decidimos X | [docs/decisoes.md](docs/decisoes.md) |
| LGPD: coleta, subprocessador, direito do titular | [docs/lgpd/](docs/lgpd/) |
| Contatos, vínculo com empresa, o que o painel grava | [docs/prompt-alinhamento-contatos-painel.md](docs/prompt-alinhamento-contatos-painel.md) |

## Coleta nova pede revisão do aviso de privacidade

Sempre que uma tarefa fizer o produto **coletar algo que ele não coletava**, revisar o [`AvisoPrivacidade.tsx`](src/cliente/AvisoPrivacidade.tsx) **na mesma tarefa**. O aceite do canal web é o registro do consentimento da LGPD, e consentimento que não descreve o que é coletado não vale como consentimento.

Aconteceu em 2026-08-08: o anexo passou a receber prints, fotos e áudios do cliente, que vão para o **Cloudinary**, e o aviso continuou falando só de nome, telefone e mensagens. Só apareceu no fechamento da tarefa.

**A coleta nova entra no [docs/lgpd/inventario.md](docs/lgpd/inventario.md) na mesma tarefa, junto do aviso.** O inventário existe desde 2026-08-09 e só vale se acompanhar o código: uma linha a mais na tabela de tratamentos custa um minuto, e reconstruir de memória o que o sistema coleta custa uma auditoria.

Os três documentos: [inventario.md](docs/lgpd/inventario.md) (o que se coleta, base legal, retenção), [subprocessadores.md](docs/lgpd/subprocessadores.md) (Supabase e Cloudinary, e o que a URL pública do Cloudinary implica) e [direitos-do-titular.md](docs/lgpd/direitos-do-titular.md) (como atender cada pedido do Art. 18). **Encarregado de dados ainda não indicado** — é o que falta para o aviso nomear uma pessoa em vez de um e-mail de setor.

## Regras específicas

1. Design **dark com identidade própria** do Atendimento (decisão revista em 2026-07-23). Tokens de cor base copiados do painel; layout e componentes são próprios. A base visual foi **padronizada e auditada em 2026-07-29/30** (tokens, escala tipográfica, dimensões, espaçamento, contraste e teclado), com guarda em `src/padroes-ui.test.ts`. O que resta do ADR-10 é polimento **estético**, não a base: as telas não são mais "cruas de propósito".
2. Toda tabela nova com RLS. Visibilidade é **por dono**, não por departamento (revista em 2026-07-24, migration `20260724150000`): **admin vê tudo e atua em qualquer chamado**; **atendente vê os seus mais a fila livre** de todos os setores, e **não vê o chamado de outro atendente**. O departamento serve para roteamento do bot e filtro da lista, não para a visão. Detalhe e helpers em [docs/db.md](docs/db.md).
3. Provedor WhatsApp atrás de um **adapter** — nunca chamar a uazapi direto do código de domínio.
4. Nada de multi-tenancy: o **cliente final não tem conta nem senha** — só a equipe interna opera o sistema. Revisto em parte pelo ADR-11 (2026-08-05): no **canal web** o cliente se identifica e alcança **uma conversa, só a dele**, por token de dispositivo, sempre através de uma Edge Function com service role. O role `anon` continua **sem nenhuma policy** — criar uma é a mudança de maior risco possível neste banco. Ver [docs/canal-web.md](docs/canal-web.md).
5. Documentação viva: atualizar `PROGRESSO.md` + o `docs/*.md` afetado ao concluir algo.
6. **Toda criação/ajuste de UI: ler [docs/design.md](docs/design.md) E acionar a skill `ui-ux-pro-max`** (plugin, invocada como `ui-ux-pro-max:ui-ux-pro-max`) **antes** de escrever a tela. Nessa ordem, e as duas coisas. O `design.md` abre com um checklist de 4 itens: **componente que já existe** (não recriar campo, busca, tabela, menu, tag ou confirmação), **nenhum valor literal** (cor, raio, sombra, transição, tamanho de texto vêm de token; altura e espaçamento, da escala), **contraste medido** e **`npm test`**, que inclui a guarda `src/padroes-ui.test.ts`. A skill entra para UX, layout e refino; **não** trocar paleta, tipografia ou componentes por catálogo, a identidade está fechada em `src/tema.css` e `src/components/ui/`. No geral, usar **proativamente** as skills e plugins disponíveis (design, copywriting, banco) sem esperar o usuário pedir. O visual deve fugir do padrão genérico de UI gerada por IA.
7. **Padronização de UI não é sugestão.** Layout, cor, fonte, dimensão e espaçamento são decisão do sistema, não de cada tela: valor cravado à mão vira 32 lugares para corrigir depois. A auditoria de 2026-07-29/30 achou 24 problemas assim, e a guarda em `src/padroes-ui.test.ts` existe para não repetir. Se um padrão não serve para o caso novo, **estenda o componente ou o token** e atualize o `design.md`; não abra exceção na tela. Exceção real (a bolha do chat, a moldura da página) vive comentada no código e documentada.

## Context7 — libs a consultar

Ao mexer com estas libs, consultar `context7` antes: React, React Router DOM, Supabase (client/Postgres/Edge Functions), TailwindCSS v4, Vite, TypeScript, **TanStack Query**, **Zod**.

**A uazapi não está no Context7** (SaaS pequeno, sem doc indexada). A referência dela é o [docs/whatsapp.md](docs/whatsapp.md), que resume o spec OpenAPI oficial v2.1.1: endpoints, corpo do webhook, campos do payload e as armadilhas. O spec completo fica em `docs/uazapi-openapi-spec.yaml`, **fora do git** (600 KB, consulta local) — se não estiver na máquina, baixar no painel da uazapi.
