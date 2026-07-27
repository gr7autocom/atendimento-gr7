# Changelog — GR7 Atendimento

> Histórico de marcos entregues. Estado atual em `PROGRESSO.md`.

---

## 2026-07-27 — Tela de Configurações do bot

- A tela de Configurações do bot foi reorganizada no padrão das demais telas de admin, em largura total
- Novos ajustes: nome do bot, controle de potenciais, solicitar motivo ao finalizar e permitir o cliente finalizar com #sair
- As mensagens automáticas agora ficam em duas colunas, agrupadas em Gerais e Atendimento, com um único botão para salvar

---

## 2026-07-25 — Tags no atendimento e telas de admin

- Departamentos e Tags reformulados: Departamentos em cards, e Tags com cor própria e escopo por departamento
- O atendente agora aplica uma ou mais tags ao chamado direto no chat; as tags aparecem no card da conversa
- O card da conversa passou a mostrar a empresa do contato quando há vínculo
- Tela de Atendentes em cards com foto (a mesma do painel) e filtros por nome, departamento e status
- Plantão agora é definido por atendente (Horários de Acesso no card), não mais numa lista única
- Acesso ao Atendimento fora do horário comercial só para quem está de plantão; administradores sempre entram
- Mensagens rápidas reformuladas (por departamento) e acionáveis no chat com `/`, com variáveis do nome do atendente e do contato
- Motivos de finalização agora são definidos por departamento, dentro do próprio departamento
- Cada departamento pode ter um horário de atendimento próprio e mostra se está disponível ou fora de horário
- Configurar um departamento agora abre uma tela própria (dados, horário e motivos), com mais espaço
- Configurar um atendente também abre uma tela própria (departamentos e horários de acesso)
- Horário comercial no mesmo formato de grade dos departamentos, agora com horário partido (várias faixas por dia)
- Contatos de uma empresa podem ser cadastrados na aba Contatos do cliente (painel), com cargo; o Atendimento reconhece quem fala por esse telefone
- No painel do contato do atendimento agora dá para ver e editar o cargo de quem fala, e o campo do nome passou a se chamar "Nome"
- A foto do usuário logado (a mesma do painel) aparece no menu do topo, no lugar das iniciais

---

## 2026-07-23 — Projeto criado (planejamento)

- Discovery e decisões de arquitetura concluídos
- Estrutura de documentação criada (CLAUDE.md, PROGRESSO, ROADMAP, docs/*)
- Scaffold Vite base (react-ts)
