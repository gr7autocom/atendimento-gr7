# Telas do MVP — GR7 Atendimento

> **Status: aprovado (Seção 4 do design, 2026-07-23).** Tema **dark idêntico ao painel** (tokens copiados, ver [design.md](design.md)). Regras de UI globais: cores sólidas (sem gradiente), sem emoji (ícones só via `lucide-react`), responsivo. Modelo de dados em [db.md](db.md); fluxo do bot em [bot.md](bot.md).

## Navegação geral

App único (`AppShell`): **barra do topo** (`BarraTopo`: marca à esquerda, notificações e menu do usuário à direita) e um **sidebar recolhido** à esquerda (`SidebarRecolhida`) que expande no hover, revisto em 2026-07-24. Os itens do menu aparecem **por papel**:

- **Atendimentos** (`/inbox`) — todos os papéis.
- **Departamentos, Tags, Mensagens rápidas, Configurações BOT, Conexão, Horário de Funcionamento, Usuários** (`/admin/*`) — **só admin** (`requireAdmin`). Os **Motivos** deixaram de ter tela própria: são configurados dentro do card do departamento.

O **suporte** vê só **Atendimentos** no menu; o **admin** vê tudo. Login compartilhado com o painel (mesmo Supabase); todos caem em `/inbox` ao entrar, e o admin acessa o resto pelo sidebar. As seções de admin, que eram abas em pílula, viraram **itens do menu, cada um com sua tela** (as rotas já existiam).

**Dashboard de supervisão (só admin):** não é tela separada. Fica **dentro de Atendimentos**, na área da direita, como estado padrão quando nenhuma conversa está aberta. Ao abrir uma conversa aparece o chat; o **X** no cabeçalho da conversa fecha e volta ao dashboard. O atendente comum, sem conversa aberta, vê a marca d'água.

**Sidebar no mobile:** a faixa de ícones some (`hidden lg:flex`). A navegação vai para um **menu de tela cheia** aberto ao tocar na **foto do usuário** (na `BarraTopo`): avatar + nome + perfil, seção "Menu" com os itens (por papel) e "Conta" com Sair. No desktop, o sidebar de ícones volta e a foto abre só um dropdown compacto (usuário + Sair).

**Dashboard no mobile:** o painel de supervisão do admin **não aparece no mobile** (é `lg+`). No mobile o admin vê só a lista de conversas (com o filtro de setor). No desktop o dashboard ocupa a área direita quando não há conversa aberta.

**Chat no mobile (mestre-detalhe, padrão Zintech):** abaixo de `lg` a lista some ao abrir a conversa, que ocupa a tela cheia. O cabeçalho tem **←** (volta à lista) e um **menu ⋮** com **Dados do atendimento, Transferir, Finalizar** (e Assumir/Aceitar quando couber). "Dados do atendimento" abre o **painel do contato em tela cheia** (`PainelContato variante="cheia"`). No desktop (`lg+`) as ações ficam inline no cabeçalho e o painel do contato é a coluna lateral.

O dashboard também **filtra a lista** (à esquerda): 6 cards coloridos (cor sólida por métrica) + tabelas **Por departamento** e **Por atendente**. Clicar num departamento filtra a lista por setor; a setinha expande os **atendentes com ativo naquele setor**, e clicar num deles filtra por setor + atendente. Simétrico na tabela de atendentes (expande os **setores em que ele tem ativo**). O filtro de atendente aparece como um **chip** no topo da lista, com **×** para limpar; o filtro de setor fica no seletor de setores.

## Responsividade

**Responsivo com foco desktop** (inbox e admin). O layout primário é desktop; no mobile as colunas **empilham**, sem rolagem horizontal, e tudo continua utilizável. Config raramente é feita no celular, e a inbox rende melhor no desktop.

## Inbox (atendimento)

Layout de 3 colunas no desktop:

```
┌───────────────┬────────────────────────────┬──────────────────┐
│ FILAS         │ CONVERSA (thread)          │ PAINEL DO CONTATO│
│               │                            │                  │
│ Meus (3)      │  cabeçalho: contato +      │  Protocolo #1024 │
│ Pendentes (0) │   protocolo + ações        │  Nome (editável) │
│ Potenciais(0) │                            │  Telefone        │
│               │  [bolhas: cliente /        │  Empresa (ficha) │
│ [lista de     │   atendente / bot]         │  [Vincular empresa]│
│  chamados     │                            │  Tags [+]        │
│  com nome,    │  ────────────────────────  │  Histórico       │
│  depto, hora, │  [Assumir] [Transferir]    │  Atend.: 228     │
│  selo tag/    │  [/ resposta rápida] [+]   │  Msgs: 3930      │
│  plantão]     │  [campo de resposta] [▶]   │  [Finalizar]     │
└───────────────┴────────────────────────────┴──────────────────┘
```

### Coluna 1 — Filas

As três abas são **exclusivas**: um chamado aparece em uma só, nunca duplicado.

- **Meus** — tem responsável e o responsável sou eu.
- **Pendentes** — na fila, sem dono, e o contato **já tem empresa vinculada**.
- **Potenciais** — contato **sem cadastro**, sem dono. Cliente novo cai aqui e **não** aparece em Pendentes.

**Fluxo do potencial (igual ao Zintech):** o atendente abre o chamado, clica em **Aceitar**, escolhe a **empresa** (busca na base de `clientes` do painel) e o **setor**, e o chamado é assumido por ele, indo para Meus. Criar empresa nova continua sendo tarefa do painel: aqui só se **vincula** a uma existente.

- Chamados de **plantão** entram em **Pendentes** com um **selo "plantão"** (não é aba separada).
- Cada item: nome do contato, departamento, hora da última mensagem, selo de tag/plantão, indicador de anexo.
- Filtro por departamento respeita a RLS (o atendente só vê os seus).

### Coluna 2 — Conversa
- Cabeçalho: contato + protocolo + ações (buscar na conversa, tags, transferir, finalizar).
- Thread com bolhas por origem (cliente / atendente / bot), status de entrega, mídia (Cloudinary), auto-scroll.
- Rodapé: **Assumir** (ou responder já assume), campo de resposta, **`/` mensagens rápidas**, anexo, enviar.
- **Transferir:** modal com departamento e/ou atendente (registra em `atendimento_transferencias`).
- **Finalizar:** modal que pede o **motivo** (catálogo).

### Coluna 3 — Painel do contato
- Nome do contato (**editável**), **cargo** (editável, opcional), telefone (do WhatsApp), empresa vinculada com link para a ficha do painel. O rótulo do nome é **"Nome"**. O cargo aparece **só neste painel**, não no card da lista.
- **Vincular empresa:** busca na base de `clientes` e associa (`cliente_id`), vínculo manual, principal no MVP. É o **mesmo dado** da aba **Contatos** do cadastro do cliente no painel (que grava direto em `contatos`), não uma cópia. O painel pode preencher também o **cargo** do contato (revisto 2026-07-25, migration `20260725190000`). Remover contato = `cliente_id = NULL` (nunca DELETE, por causa do CASCADE em `atendimentos`).
- Tags do chamado (adicionar/remover).
- **Histórico do contato:** atendimentos anteriores do mesmo contato.
- **Contadores:** total de atendimentos e mensagens do contato.

## Administração (`/admin`)

Sidebar com as abas abaixo. Detalhe de cada aba chega por prints ao longo do desenvolvimento.

| Aba | Tela | MVP |
|---|---|---|
| **Dashboard** | cards de indicadores | placeholder (Fase 3) |
| **Atendentes** (Usuários) | `usuarios` do painel em **cards com foto** (`foto_url`, read-only) + filtros (nome/departamento/status). Clicar no card abre a **tela dedicada** `/admin/usuarios/:id` (largura total) com blocos **Departamentos que atende** e **Horário de plantão** (7 colunas por dia, HH:MM; o mesmo `GradeHorarios` do departamento). Sem criar/inativar/remover (isso é no painel) | sim |
| **Departamentos** | grid de cards (número/nome/ativo + selo **Disponível/Fora de horário**). Clicar no card abre a **tela dedicada** `/admin/departamentos/:id` (largura total) com blocos **Dados**, **Horário de atendimento** (7 colunas por dia, De/Até em HH:MM; vazio = comercial) e **Motivos de finalização** (ordenáveis por setas, a ordem vale no Finalizar). O **modal** fica só para **criar** um departamento (número + nome) | sim |
| **Tags** | CRUD de tags | sim |
| **Mensagens rápidas** | grid full-width (palavra-chave/mensagem/departamento) + filtros; modal com **Departamento** (Todos ou um setor), palavra-chave e texto. No chat, `/` abre o seletor e insere trocando `{{agent.name}}`/`{{contact.name}}` | sim |
| **Horário de Funcionamento** | **horário comercial** no mesmo padrão (`GradeHorarios`, 7 colunas por dia, HH:MM). Aceita **várias faixas por dia** (horário partido); dia sem faixa fica fechado. O **plantão** é por usuário, no card do atendente. Fora do comercial, só acessa quem tem plantão cobrindo a hora; reforçado no login e na RLS (`pode_atender_agora()`), admin sempre passa | sim |
| **Configurações BOT** | bloco **Comportamento** (nome do bot, controle de potenciais, tempos e toggles: avaliação, nome do atendente, motivo ao finalizar, #sair) + bloco **Mensagens automáticas** (12 textos em 2 colunas, agrupados em Gerais/Atendimento, um só Salvar) | sim |
| **Conexão** | conexão do WhatsApp por QR Code (passos + área do QR/status). **Casca por ora:** QR/sessão vêm do adapter uazapi quando a integração entrar (hoje mostra estado Desconectado, botão desabilitado) | sim |
| **Relatórios** | listagens / exportação | placeholder (Fase 3) |

- **Dashboard e Relatórios** ficam como **placeholder** no MVP (menu existe, conteúdo real é Fase 3).
- **Vínculo atendente↔departamento** é feito na aba **Usuários**.

## Design

- Tema **dark idêntico ao painel**, tokens copiados (`design-tokens.css`). Atenção ao gotcha da escala de cinza invertida (ver [design.md](design.md)).
- Cores sólidas, sem gradiente. Ícones só via `lucide-react`. Sem emoji na interface.
- Componentes reaproveitados do painel: `Modal`, `Button`, `Tabs`, `PageHeader`, `EmptyState`, `Skeleton`, `StatusDot`, e a UI de mensagem do Talk (bolha, input, áudio, lightbox) para a thread.

## Fora do escopo (pós-MVP)

Dashboard e Relatórios reais (Fase 3); abas do painel do contato vistas no Zintech que não entram agora (Tarefas, Mensagens Programadas, Retornos, Comentários); admin 100% otimizado para mobile.
