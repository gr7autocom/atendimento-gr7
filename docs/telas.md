# Telas do MVP — GR7 Atendimento

> **Status: aprovado (Seção 4 do design, 2026-07-23).** Tema **dark idêntico ao painel** (tokens copiados, ver [design.md](design.md)). Regras de UI globais: cores sólidas (sem gradiente), sem emoji (ícones só via `lucide-react`), responsivo. Modelo de dados em [db.md](db.md); fluxo do bot em [bot.md](bot.md).

## Navegação geral

O app tem **duas áreas separadas**, cada uma com casca própria e uma **barra do topo** comum (`BarraTopo`: marca à esquerda, notificações e menu do usuário à direita):

- **Atendimento** (`/inbox`, `LayoutAtendimento`) — usada pelos atendentes no dia a dia.
- **Administração** (`/admin`, `LayoutAdmin`) — só para perfis com `can('atendimento.config')`.

Login compartilhado com o painel (mesmo Supabase). **O ambiente é decidido no login pelo papel** (`InicioPorPapel`): `admin` cai no painel administrativo, `suporte` cai no atendimento. Não há navegação entre as áreas na tela: o atendente só vê o atendimento.

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
- Nome do contato (**editável**), telefone (do WhatsApp), empresa vinculada com link para a ficha do painel.
- **Vincular empresa:** busca na base de `clientes` e associa (`cliente_id`) — vínculo manual, principal no MVP.
- Tags do chamado (adicionar/remover).
- **Histórico do contato:** atendimentos anteriores do mesmo contato.
- **Contadores:** total de atendimentos e mensagens do contato.

## Administração (`/admin`)

Sidebar com as abas abaixo. Detalhe de cada aba chega por prints ao longo do desenvolvimento.

| Aba | Tela | MVP |
|---|---|---|
| **Dashboard** | cards de indicadores | placeholder (Fase 3) |
| **Usuários** | lista dos `usuarios` do painel; por usuário, marcar **departamentos** (vínculo atendente↔departamento fica aqui) | sim |
| **Departamentos** | tabela com criar / editar / ativar / desativar / ordenar | sim |
| **Tags** | CRUD de tags | sim |
| **Motivos** | CRUD de motivos de finalização | sim |
| **Mensagens rápidas** | CRUD (atalho + título + texto) | sim |
| **Horário de Funcionamento** | horário comercial por dia + turnos de **plantão** com atendentes vinculados + texto de fora de horário | sim |
| **Configurações BOT** | edita os 12 textos do bot + flags (avaliação, nome do atendente, tempos) | sim |
| **Relatórios** | listagens / exportação | placeholder (Fase 3) |

- **Dashboard e Relatórios** ficam como **placeholder** no MVP (menu existe, conteúdo real é Fase 3).
- **Vínculo atendente↔departamento** é feito na aba **Usuários**.

## Design

- Tema **dark idêntico ao painel**, tokens copiados (`design-tokens.css`). Atenção ao gotcha da escala de cinza invertida (ver [design.md](design.md)).
- Cores sólidas, sem gradiente. Ícones só via `lucide-react`. Sem emoji na interface.
- Componentes reaproveitados do painel: `Modal`, `Button`, `Tabs`, `PageHeader`, `EmptyState`, `Skeleton`, `StatusDot`, e a UI de mensagem do Talk (bolha, input, áudio, lightbox) para a thread.

## Fora do escopo (pós-MVP)

Dashboard e Relatórios reais (Fase 3); abas do painel do contato vistas no Zintech que não entram agora (Tarefas, Mensagens Programadas, Retornos, Comentários); admin 100% otimizado para mobile.
