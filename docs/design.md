# Design system — GR7 Atendimento

> **Identidade própria (ADR-10), dark-only.** Conceito: **console de atendimento** — instrumento de trabalho, denso e preciso. Hierarquia por **camadas de superfície** (não por borda em tudo); cor da marca só onde há ação, seleção ou foco; status como **ponto colorido**; dados em mono.

## Antes de escrever qualquer tela (leia isto)

Um design system só funciona se a decisão for tomada **uma vez** e o resto **consumir**. Cada valor cravado à mão é um lugar a mais para esquecer quando a regra mudar.

1. **O componente já existe?** Confira "[Componentes que já resolvem o caso](#componentes-que-já-resolvem-o-caso-não-recrie)" antes de escrever campo, busca, tabela, menu, tag ou confirmação. Se o que existe não serve, **estenda o componente**, não faça outro na tela.
2. **Nenhum valor literal.** Cor, raio, sombra, transição e tamanho de texto vêm de token; altura e espaçamento, da escala. Se você digitou `[` num `className`, provavelmente errou.
3. **Contraste medido, não estimado.** Texto 4,5:1 · borda de controle 3:1. Cor nova se mede antes de entrar.
4. **Rode `npm test`.** A guarda em [`src/padroes-ui.test.ts`](../src/padroes-ui.test.ts) barra literal de token, borda de campo fraca, `confirm()` nativo, hex solto, emoji, spinner à mão e click-outside duplicado. Ela diz o arquivo, a linha e o substituto.

O que a guarda **não** pega e continua dependendo de olhar: contraste de cor nova, hierarquia de título (um `h1` por tela), alvo de toque, copy de estado vazio e erro, comportamento no mobile e **texto que assume um canal**.

> **Texto que assume um canal** entrou nessa lista em 2026-08-06, com um caso concreto: o painel do contato dizia "WhatsApp informou: sem nome" num chamado vindo do **site**. Passou por type-check, lint e 136 testes, porque a frase estava certa como código e falsa como conteúdo — nenhuma automação que temos lê significado. Enquanto só existia WhatsApp, citá-lo era seguro; com dois canais, qualquer frase que nomeie um deles precisa ser condicional ou neutra. Ainda há casos vivos: mensagens rápidas escritas para o WhatsApp ("digite #sair") ficam erradas no site. Ao escrever texto de interface, pergunte **de qual canal este chamado veio** antes de citar um.

## Regras invioláveis

- **Dark-only.** Sem tema claro.
- **Cores sólidas, sem gradiente. Sem emoji.** Ícones só via `lucide-react`.
- **Azul do painel** (`#0078d4`) como cor da marca, usado com parcimônia.
- Densidade: base 13px (`text-corpo`), listas compactas; respiro vem de ritmo consistente, não de espaço vazio.
- Foco visível em tudo que é interativo; contraste mínimo AA.

## Tokens

Definidos em [`src/tema.css`](../src/tema.css) e expostos ao Tailwind v4 via `@theme` (uso: `bg-sf-1`, `text-tx-2`, `border-bd-1`, `text-br-2`…).

| Grupo | Tokens |
|---|---|
| Superfícies | `sf-0` fundo · `sf-1` painéis · `sf-2` cards/hover · `sf-3` elevado (modais) |
| Texto | `tx-1` principal · `tx-2` secundário · `tx-3` apoio/placeholder |
| Bordas | `bd-1` sutil · `bd-2` padrão · `bd-3` hover · `bd-campo` borda de input/select/textarea |
| Marca | `br-1` base · `br-2` texto/ícone sobre fundo escuro · `br-3` hover de fundo · `br-4` pressionado · `br-soft` seleção/selo |
| Semânticas | `ok` · `ok-soft` · `warn` · `warn-soft` · `err` · `err-soft` |
| Forma | `r-micro` 4px badge · `r-1` 6px controle · `r-2` 10px superfície · `r-3` 12px bolha/moldura · `r-full` |
| Tempo | `t-1` 120ms · `t-2` 160ms, via classe `.transicao` / `.transicao-2` |
| Profundidade | `sh-1` sutil · `sh-2` elevado, via `shadow-1` / `shadow-2` |

### Como usar (auditoria de 2026-07-30, lote 3)

Regra geral: **classe utilitária do token, nunca o valor literal.** Antes havia `rounded-[6px]`, `duration-[120ms]` e a sombra do modal escritos à mão em 32 arquivos, então mudar o arredondamento ou o ritmo da interface exigia varrer o projeto.

- **Raio pelo papel do elemento:** `rounded-micro` em badge e mini-tag; `rounded-1` em botão, campo, selo e aba; `rounded-2` em card, modal, menu e bloco; `rounded-3` na bolha do chat e na moldura do QR. A marca d'água da conversa vazia é a única exceção literal, por ser ornamento de um lugar só.
- **Transição:** `transicao` (estado: hover, foco, seleção) ou `transicao-2` quando envolve transform. Não usar `transition-colors duration-[...]`.
- **Sombra:** `shadow-1` e `shadow-2`. O valor não se repete no JSX.
- **Cor categórica mora em [`src/lib/cores.ts`](../src/lib/cores.ts)**, não no tema e não dentro do componente. É a cor que distingue *itens* (setor, tag, avatar, métrica) e por isso é lista, não token. Havia três paletas paralelas, cada uma com sua função de hash. Ao acrescentar cor, medir o contraste antes.

### Componentes que já resolvem o caso (não recrie)

- **Busca:** `CampoBusca` (lupa, `type=search`, botão de limpar com alvo de 24px). Estava copiado em três telas, nenhuma com o limpar.
- **Confirmação de ação destrutiva:** `ModalConfirmar`. Nunca `confirm()` do navegador, que abre em tema claro do sistema e não diz o que vai acontecer.
- **Falha ao salvar:** `AvisoErro` ([`ui/Estados.tsx`](../src/components/ui/Estados.tsx)), com `role="alert"`, alimentado pelo `erro` do `useCrud`. Use sempre que a tela grava algo. Sem ele a gravação recusada some em silêncio: o TanStack revalida, o campo volta ao valor antigo e o usuário conclui que o botão Salvar está quebrado — foi o que aconteceu em 2026-08-04 ao reordenar departamentos. O `Erro` é outro caso: ocupa a área toda quando a tela **não carrega**.
- **Menu suspenso:** `useFecharFora` (clique fora + Esc), `PainelMenu` e `ItemMenu`, de [`ui/Menu.tsx`](../src/components/ui/Menu.tsx). O mesmo `useEffect` estava escrito três vezes e nenhuma fechava com Esc.
- **Tabela:** `Tabela`/`Th`/`Tr`/`Td`. O painel de supervisão mantém casca própria (colunas fixas, linhas expansíveis) mas usa o `Th` padrão: exceção justificada não significa reescrever o cabeçalho.
- **Tag:** `PillTag`, com `compacta` para a lista de chamados.
- **Estado como ponto colorido:** `Ponto` ([`ui/Selo.tsx`](../src/components/ui/Selo.tsx)), com a cor por parâmetro e o rótulo ao lado. `PontoStatus` (status do atendimento) e `PresencaCliente` (presença no canal web) são os dois consumidores. A cor é sempre **reforço**: o texto carrega a informação, senão quem não distingue as cores fica sem ela.
- **Card de seção do admin:** `Bloco` (com título) ou `PainelAba` (dentro de abas), ambos `p-4` e ambos usando `Topicos` para a orientação em tópicos.

### Regras de contraste (auditoria de 2026-07-29)

Alvo: **4,5:1** para texto (WCAG AA) e **3:1** para borda de controle (WCAG 1.4.11). O que a auditoria mudou e por quê:

- **`tx-3` é `#828d9b`**, não `#6a7482`. O valor antigo reprovava em toda superfície (3,30 a 4,05) e ele carrega telefone, hora e a classe `.rotulo`, que são conteúdo, não decoração.
- **`br-2` não serve de fundo de botão.** Branco sobre ele dá 2,79:1. É cor de **texto e ícone** sobre superfície escura (6,55:1 sobre `sf-1`). Fundo de ação que reage ao hover **escurece** para `br-3` (7,10:1) e pressiona em `br-4` (9,00:1).
- **Borda de campo usa `bd-campo`** (3,13:1), nunca `bd-2` (1,31:1). As bordas `bd-1` a `bd-3` são separadores e podem ser sutis; a de um controle precisa dizer onde dá para clicar. No hover a borda sobe para `tx-3`, porque `bd-3` é mais fraco que `bd-campo` e apagaria o campo em vez de destacá-lo.
- **Nada de `rgba` de cor semântica escrito à mão.** Fundo de selo verde é `ok-soft`, âmbar é `warn-soft`, vermelho é `err-soft`.
- **`prefers-reduced-motion` é respeitado** globalmente em [`src/index.css`](../src/index.css): quem pede menos movimento no sistema recebe a interface sem spinner, sem pulso de esqueleto e sem transição.

### Regras de componente (auditoria de 2026-07-29, lote 2)

- **Ação assíncrona usa `carregando` no `Botao`**, nunca só `disabled`. A prop trava o clique, troca o ícone por um giro e marca `aria-busy`. Sem isso, ação lenta aceitava clique duplo (o Enviar mandava a mensagem duas vezes) e nada dizia que já estava em curso.
- **Campo com `dica` ou `erro` liga o texto por `aria-describedby`**, gerado dentro do próprio `Campo`. O erro tem prioridade sobre a dica e usa `role="alert"`, que anuncia na hora, mais `aria-invalid` no campo.
- **`Modal` gerencia foco:** ao abrir, o foco vai para o primeiro **campo** (não para o botão Fechar, que vem antes no DOM e apontaria para a saída); o `Tab` fica preso no diálogo; ao fechar, o foco volta para quem abriu.
- **Nunca use `title` como único portador de informação.** O `Botao` tem `disabled:pointer-events-none`, então tooltip em botão desabilitado **nunca aparece**. Se o usuário precisa saber por que não pode agir, o texto é visível na tela.
- **Alvo de toque mínimo de 24×24** (WCAG 2.2). Ícone menor que isso mora dentro de um alvo maior.
- **Um `h1` por tela.** As telas de admin recebem o `h1` do `CabecalhoAdmin`; a inbox tem `h1` oculto (`sr-only`), porque a tela é toda painel e um título visível repetiria a barra do topo. Painel renderizado dentro de outra tela usa `h2` (é o caso do `Dashboard` dentro da inbox).
- **Carregamento e erro se anunciam:** `LinhasCarregando` é `role="status"` com `aria-busy`, e `Erro` é `role="alert"`.
- **Abas seguem o padrão ARIA completo** (lote 5): `Abas` recebe `idGrupo` e `PainelAba` recebe `idGrupo` + `aba`, o que liga `aria-controls` ao `role="tabpanel"`. Setas, Home e End andam entre as abas levando o foco; só a ativa recebe Tab (roving tabindex). Semântica pela metade é pior que nenhuma: o leitor anuncia "aba 1 de 3" e a seta não faz nada.
- **Métrica sem fonte de dados diz isso na tela.** Zero em painel de gestão lê como "a operação parou", não como "o dado não existe". No painel de supervisão, a flag `semFonte` mostra "Sem dados até conectar o WhatsApp" sob o número. Ao ligar a fonte, remover a flag junto.

## Tipografia

- **Roboto** (300/400/500/700) para UI, e **Roboto Mono** (400/500) para **dados**: protocolo, telefone, hora. Trocadas em 2026-07-30 (antes era IBM Plex).
- Instaladas **localmente** via `@fontsource`, **subset latino apenas** (`latin-400.css` e afins), **sem CDN**. Três motivos: o Google Fonts faria o navegador de cada atendente enviar IP e user-agent ao Google em toda visita; o texto ficaria esperando rede externa; e o import cheio do `@fontsource` traz cirílico, grego, vietnamita, math e symbols, o que gerava ~90 arquivos de fonte no build contra os 12 atuais (256 KB).
- Classe utilitária `.dado` aplica mono + `tabular-nums`, que alinha números em coluna. O Roboto Mono desenha o zero cortado, o que ajuda a não confundir `0` com `O` em protocolo e telefone.
- `.rotulo`: rótulo de bloco em maiúscula pequena, usado no painel do contato. Usa `--text-mini`.

### Escala de tamanho (auditoria de 2026-07-30, lote 4)

Tamanho de texto vem da escala, **nunca** de `text-[13px]` arbitrário. Havia 9 tamanhos anônimos em 187 lugares e não se sabia qual era "o corpo do texto"; cada tela decidia sozinha.

| Classe | Tamanho | Papel |
|---|---|---|
| `text-micro` | 10px | badge dentro de linha densa |
| `text-mini` | 11px | rótulo caixa-alta, hora, legenda |
| `text-apoio` | 12px | dica de campo, texto secundário |
| `text-corpo` | 13px | **padrão da interface**, e agora o padrão do `body` |
| `text-corpo-lg` | 14px | corpo em área confortável, título de bloco, campo de formulário |
| `text-titulo` | 16px | título de tela e de painel |
| `text-destaque` | 20px | número em destaque no painel do contato |
| `text-metrica` | 26px | número dos cards de supervisão |

Regras de uso: `micro` e `mini` são para rótulo e metadado, **nunca** para frase que se lê. O `body` é `text-corpo` (13px) porque era o tamanho real da interface, que quase todo componente sobrescrevia. O 15px foi fundido em 16 (título de tela virou um só tamanho, em vez de 15 no admin e 16 no detalhe).

## Dimensões e espaçamento

Mesma lógica dos outros tokens: a altura de um controle e o respiro entre blocos são **decisão do sistema**, não de cada tela. Sem isso, cada página nasce com um tamanho e um espaçamento diferente, e o produto parece montado por pessoas que não se falaram.

### Altura por papel

| Altura | Valor | Onde |
|---|---|---|
| `h-6` | 24px | selo, pill, badge, alvo de toque mínimo |
| `h-7` | 28px | controle compacto: `Botao` tamanho `sm`, aba de fila |
| `h-8` | 32px | controle médio: busca, botão de ícone, campo de hora |
| `h-9` | 36px | **controle padrão**: campo, `Botao` tamanho `md`, aba de admin |
| `h-10` | 40px | item de menu suspenso (toque generoso em lista) |
| `h-12` | 48px | barra: cabeçalho de modal |
| `h-14` / `h-16` | 56 / 64px | barra do topo (desktop / mobile) |

O padrão é `h-9`. Se um controle novo não couber em nenhuma dessas alturas, o problema provavelmente é o controle, não a escala.

### Espaçamento

Régua de 4px do Tailwind, sempre. Os valores em uso, por função:

| Uso | Classe |
|---|---|
| Dentro de um controle (ícone e texto) | `gap-1.5` / `gap-2` |
| Entre controles de uma linha | `gap-2` / `gap-3` |
| Entre campos de um formulário | `gap-3` / `gap-4` |
| Entre seções de um painel | `gap-4` / `gap-5` / `gap-6` |
| Padding de card de seção | `p-4` (`Bloco` e `PainelAba` já aplicam) |
| Padding de linha de lista/tabela | `px-3` / `px-4` com `py-2` / `py-2.5` |
| **Moldura da página** | `p-5 sm:p-6` (só a casca de `Admin` e do painel de supervisão) |

Duas regras que evitam a maior parte da divergência: **card de seção é `p-4`**, e **moldura de página é `p-5 sm:p-6`**. São coisas diferentes; não misture. Valores fora da régua (`gap-7`, `p-[13px]`) não entram.

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

- **Casca (`AppShell`):** barra do topo (`BarraTopo`: marca à esquerda, notificações e menu do usuário à direita com nome, e-mail e Sair) + **sidebar recolhido** (`SidebarRecolhida`) à esquerda. A sidebar é uma faixa de ícones que **expande no hover** (largura 52px → 216px), sobrepondo o conteúdo (um espaçador mantém o layout); item ativo com barra da marca à esquerda. Os itens aparecem por papel: `suporte` vê só **Atendimentos**; `admin` vê também as seções de configuração (cada uma sua tela). O **Dashboard de supervisão não é item do menu**: ele é o estado padrão da área direita de Atendimentos para o admin (ver [telas.md](telas.md)).
- **Admin:** cabeçalho fixo com abas em pílula (ativa em `br-soft`), conteúdo em cards por seção.
- **Inbox:** três colunas (lista `sf-1` · conversa `sf-0` · painel `sf-1`). Item selecionado com faixa da marca. Bolhas com canto assimétrico: entrada em `sf-2`, saída na marca, bot em `sf-3` com rótulo.
- **Listas:** primeira coluna em `font-medium`, apoio em `tx-2`, dados em `.dado`; item inativo em `tx-3`.

## Dívida conhecida

O painel continua com o visual antigo. Como o Atendimento tem identidade própria (ADR-10), não há mais objetivo de igualar os dois; só a cor da marca é compartilhada.
