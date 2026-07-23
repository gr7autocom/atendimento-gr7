# Design system — GR7 Atendimento

> Objetivo: visual **dark idêntico ao painel**. O design system é **copiado** do painel (não importado), para manter o isolamento total. Fonte: `painel-implantacao-v2/`.

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
