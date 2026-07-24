# Design system — GR7 Atendimento

> **Identidade própria (ADR-10), dark-only.** Conceito: **console de atendimento** — instrumento de trabalho, denso e preciso. Hierarquia por **camadas de superfície** (não por borda em tudo); cor da marca só onde há ação, seleção ou foco; status como **ponto colorido**; dados em mono.

## Regras invioláveis

- **Dark-only.** Sem tema claro.
- **Cores sólidas, sem gradiente. Sem emoji.** Ícones só via `lucide-react`.
- **Azul do painel** (`#0078d4`) como cor da marca, usado com parcimônia.
- Densidade: base 14px, listas compactas; respiro vem de ritmo consistente, não de espaço vazio.
- Foco visível em tudo que é interativo; contraste mínimo AA.

## Tokens

Definidos em [`src/tema.css`](../src/tema.css) e expostos ao Tailwind v4 via `@theme` (uso: `bg-sf-1`, `text-tx-2`, `border-bd-1`, `text-br-2`…).

| Grupo | Tokens |
|---|---|
| Superfícies | `sf-0` fundo · `sf-1` painéis · `sf-2` cards/hover · `sf-3` elevado (modais) |
| Texto | `tx-1` principal · `tx-2` secundário · `tx-3` apoio/placeholder |
| Bordas | `bd-1` sutil · `bd-2` padrão · `bd-3` hover |
| Marca | `br-1` base · `br-2` hover · `br-3` pressionado · `br-soft` seleção/selo |
| Semânticas | `ok` · `warn` · `err` · `err-soft` |
| Forma/tempo | `r-1` 6px · `r-2` 10px · transições 120–160ms |

## Tipografia

- **IBM Plex Sans** (400/500/600) para UI. Instalada localmente via `@fontsource`, sem CDN.
- **IBM Plex Mono** (400/500) para **dados**: protocolo, telefone, hora. Classe utilitária `.dado` (aplica mono + `tabular-nums`, que alinha números em coluna).
- `.rotulo`: rótulo de bloco em maiúscula pequena, usado no painel do contato.

## Componentes

Em [`src/components/ui/`](../src/components/ui/):

| Componente | Uso |
|---|---|
| `Botao` | variantes `primario`, `neutro`, `perigo`, `fantasma`; tamanhos `sm`/`md`; aceita ícone |
| `Entrada`, `AreaTexto`, `Selecao` | campos com rótulo, dica e erro; foco por anel |
| `Modal` | overlay, fecha no Esc e no clique fora; `role="dialog"` |
| `Selo`, `PontoStatus` | selo por tom; status do atendimento como ponto colorido (+ rótulo opcional) |
| `Tabela`, `Th`, `Tr`, `Td` | tabela densa com cabeçalho discreto e hover de linha |
| `Vazio`, `Skeleton`, `LinhasCarregando`, `Erro` | estados: vazio orienta a ação; carregando usa esqueleto; erro oferece retry |

## Padrões de tela

- **Sidebar:** marca no topo, itens com **barra de seleção** à esquerda no ativo, usuário e sair no rodapé.
- **Admin:** cabeçalho fixo com abas em pílula (ativa em `br-soft`), conteúdo em cards por seção.
- **Inbox:** três colunas (lista `sf-1` · conversa `sf-0` · painel `sf-1`). Item selecionado com faixa da marca. Bolhas com canto assimétrico: entrada em `sf-2`, saída na marca, bot em `sf-3` com rótulo.
- **Listas:** primeira coluna em `font-medium`, apoio em `tx-2`, dados em `.dado`; item inativo em `tx-3`.

## Dívida conhecida

O painel continua com o visual antigo. Como o Atendimento tem identidade própria (ADR-10), não há mais objetivo de igualar os dois; só a cor da marca é compartilhada.
