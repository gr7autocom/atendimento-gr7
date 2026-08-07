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
- **Selo de canal no avatar** (WhatsApp ou site), distinguindo por **ícone** e não só por cor: verde e azul são o mesmo tom para boa parte das pessoas com daltonismo. O rótulo em texto fica no cabeçalho da conversa, que é onde se decide como responder; na lista a tarefa é reconhecer, e o selo basta.
- **Filtro por canal** ao lado do de setor, montado **só quando há mais de um canal na fila**. Enquanto só houver WhatsApp, um seletor com uma opção real ocupa espaço e não decide nada. Se o canal filtrado sai da fila, o filtro se desfaz sozinho, senão a lista ficaria vazia por um filtro invisível.
- Lista vazia distingue **fila vazia** de **recorte vazio**: com filtro ou busca ativos, o texto diz quantos chamados estão fora do recorte, em vez de afirmar que não há trabalho.
- Filtro por departamento respeita a RLS (o atendente só vê os seus).

### Coluna 2 — Conversa
- Cabeçalho: contato + protocolo + **canal** + ações (buscar na conversa, tags, transferir, finalizar).
- **Presença do cliente**, só no canal do site: "Cliente na conversa" (último acesso há menos de 45s, que tolera três falhas do polling de 10s), "Cliente ausente há X" ou "Cliente sem acesso". Existe porque o PWA **não tem push**: quem fecha a janela não é avisado de nada, e sem o indicador o atendente escreve sem saber se está falando com uma tela fechada. No WhatsApp não aparece, porque quem diz se a pessoa está online é o aparelho dela.
- **Menu ⋮ com "Encerrar acesso do cliente"** (site, com acesso vivo). No desktop o menu é montado só quando existe ação secundária, para a ação rara não disputar a barra com Assumir, Transferir e Finalizar. Confirmação diz o efeito real, e depois de encerrar o item some junto com o acesso.
- Thread com bolhas por origem (cliente / atendente / bot), status de entrega, mídia (Cloudinary), auto-scroll.
- **Mensagens de sistema** (eventos) como **pílulas centralizadas**, internas (o cliente não vê): "Atendimento #NNN", "Fim das mensagens com o bot", "X assumiu"/"X não faz mais parte", transferência, encerrado, reaberto. Base do histórico (`atendimento_eventos`, ver [db.md](db.md)).
- Rodapé: **Assumir** (ou responder já assume), campo de resposta, **`/` mensagens rápidas**, anexo, enviar.
- **Transferir:** modal com departamento e/ou atendente (registra em `atendimento_transferencias`).
- **Finalizar:** modal que pede o **motivo** (catálogo).
- **Rodapé do chamado finalizado é condicional** (regra em `src/lib/reabertura.ts`, com testes): promete reabrir o mesmo protocolo **só com a nota pendente e dentro da janela**, usando o prazo de `janela_reabertura_horas`; diz que a próxima mensagem abre chamado novo quando a nota foi dada, quando o cliente encerrou ou quando a janela venceu; e, no site com acesso encerrado, explica que o cliente precisa se identificar de novo.

### Coluna 3 — Painel do contato
- Nome do contato (**editável**), **cargo** (editável, opcional), telefone (do WhatsApp), empresa vinculada com link para a ficha do painel. O rótulo do nome é **"Nome"**. O cargo aparece **só neste painel**, não no card da lista.
- **Vincular empresa:** busca na base de `clientes` e associa (`cliente_id`), vínculo manual, principal no MVP. É o **mesmo dado** da aba **Contatos** do cadastro do cliente no painel (que grava direto em `contatos`), não uma cópia. O painel pode preencher também o **cargo** do contato (revisto 2026-07-25, migration `20260725190000`). Remover contato = `cliente_id = NULL` (nunca DELETE, por causa do CASCADE em `atendimentos`).
- **Aviso de identificação auto-declarada** (só no canal do site): "Os dados vieram do formulário do site e não foram verificados." Um aviso por seção, não um por campo, e **sem cor de alerta**, porque a ressalva é sobre o que o sistema garante e não sobre a pessoa. O caso que ele resolve é o **telefone**: no WhatsApp o número é a identidade garantida pelo provedor, no site é campo digitado.
- Tags do chamado (adicionar/remover).
- **Histórico do contato:** atendimentos anteriores do mesmo contato — protocolo, data, status, setor, quem atendeu, motivo e nota. Mostra **3 por vez, com "Ver todos"**. Os itens **não são clicáveis**, e isso é decisão, não pendência: chamado finalizado é filtrado fora da lista de chamados, então não existe tela que exiba conversa encerrada (nem para quem a atendeu). Enquanto não houver essa tela, não há destino para o clique. Vem da RPC `atendimento_historico_contato`, que devolve só o resumo e nunca o corpo das mensagens (ver [db.md](db.md)).
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
| **Configurações BOT** | **abas** (Geral · Atendimento · Potenciais) com rodapé Descartar/Salvar. **Geral**: comportamento (nome do bot, tempos, toggles) + mensagens gerais. **Atendimento**: mensagens de atendimento. **Potenciais**: controle de potenciais + mensagens de identificação (pedir/vinculada). Mensagens em 2 colunas | sim |
| **Conexão** | conexão do WhatsApp por QR Code (passos + área do QR/status). **Casca por ora:** QR/sessão vêm do adapter uazapi quando a integração entrar (hoje mostra estado Desconectado, botão desabilitado) | sim |
| **Relatórios** | listagens / exportação | placeholder (Fase 3) |

- **Dashboard e Relatórios** ficam como **placeholder** no MVP (menu existe, conteúdo real é Fase 3).
- **Vínculo atendente↔departamento** é feito na aba **Usuários**.

## Design

- Tema **dark idêntico ao painel**, tokens copiados (`design-tokens.css`). Atenção ao gotcha da escala de cinza invertida (ver [design.md](design.md)).
- Cores sólidas, sem gradiente. Ícones só via `lucide-react`. Sem emoji na interface.
- Componentes reaproveitados do painel: `Modal`, `Button`, `Tabs`, `PageHeader`, `EmptyState`, `Skeleton`, `StatusDot`, e a UI de mensagem do Talk (bolha, input, áudio, lightbox) para a thread.

## Fora do escopo (pós-MVP)

Dashboard e Relatórios reais (Fase 3); abas do painel do contato vistas no Zintech que não entram agora (Mensagens Programadas, Retornos, Comentários); admin 100% otimizado para mobile.

> A aba **Tarefas** saiu desta lista: entregue em 2026-07-28 (abre tarefa avulsa no painel de implantação). Ver [db.md](db.md).
