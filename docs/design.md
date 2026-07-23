# Design system — GR7 Atendimento

> **Decisão revista em 2026-07-23:** o Atendimento terá **visual próprio** (dark), mais elaborado que o painel. Os **tokens de cor** continuam vindo do painel (já copiados em `src/design-tokens.css`), mas layout e componentes são próprios, definidos numa **etapa de design dedicada ao final da implementação**. Até lá as telas saem funcionais e cruas de propósito. O conteúdo abaixo sobre "copiar componentes do painel" fica como **referência opcional**, não mais como regra.

## Princípios

- **Dark-only** (mesma decisão do painel — ADR-003 lá). Sem light mode.
- TailwindCSS v4 via `@tailwindcss/vite` (sem `tailwind.config`).
- ⚠️ **Gotcha herdado do painel:** o `design-tokens.css` **inverte a escala de cinza do Tailwind** (`text-white` vira um cinza escuro). Por isso o painel usa `text-[#ffffff]` literal e superfícies com `#ffffff` + alpha. Copiar o `design-tokens.css` **junto** com esse entendimento para não repetir bugs de contraste.

## O que copiar do painel

| Do painel | Para | Observação |
|---|---|---|
| `src/design-tokens.css` | `src/design-tokens.css` | tokens de cor/tema dark (a escala invertida) |
| `src/index.css` (partes relevantes) | `src/index.css` | base, autofill, keyframes |
| `src/lib/utils.ts` (`cn`, `estiloBadge`) | `src/lib/utils.ts` | helpers de classe/badge |
| `src/components/Modal.tsx` | idem | modal com focus trap |
| `src/components/*` base (Button, Tabs, PageHeader, EmptyState, Skeleton, StatusDot) | conforme necessário | copiar sob demanda |
| Sidebar/Layout | adaptar | menu próprio do atendimento |

## Componentes de conversa (reaproveitar do Talk)

A UI de mensagem do Talk (`src/components/scrap/*` no painel) é ~70% reaproveitável para o thread do atendimento:

- `MensagemBubble`, `MensagemInput`, `AudioPlayerWhats`, `GravadorAudio`, `MediaLightbox`
- Padrões: optimistic update, upload Cloudinary, auto-scroll, busca na conversa

**Não** copiar o *container* do Talk (`scrap_conversas` é 1:1 entre dois usuários internos). O container do atendimento é "contato externo ↔ atendente" — modelo próprio (ver [db.md](db.md)).

## Ícones e utilitários

- `lucide-react` (mesmo do painel)
- `clsx` + `tailwind-merge` → helper `cn`

## Dívida conhecida

Cópia gera duplicação com o painel. Aceitável pelo isolamento. Se um dia virar monorepo, desduplicar num pacote `packages/ui` compartilhado.
