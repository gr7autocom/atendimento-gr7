# Changelog — GR7 Atendimento

> Histórico de marcos entregues. Estado atual em `PROGRESSO.md`.

---

## 2026-07-27 — Bot de atendimento, histórico e configurações

- O bot conduz o atendimento pelo WhatsApp: dá boas-vindas, mostra o menu de setores, coloca na fila e encerra com #sair (ainda em teste interno, sem número conectado)
- Cliente sem cadastro é convidado a se identificar antes do menu; se manda o CNPJ, o sistema já vincula a empresa sozinho
- Ao finalizar, o bot pede uma nota de 0 a 10 e registra a avaliação do atendimento
- A conversa mostra mensagens de sistema (abertura, fim do bot, quem assumiu ou saiu, encerramento) para o time acompanhar o histórico; o cliente não as vê
- Transferir agora permite soltar o chamado de volta para a fila sem escolher ninguém, para qualquer atendente assumir
- A tela de Configurações do bot foi reorganizada em abas (Geral, Atendimento, Potenciais), em largura total, com nome do bot e mais ajustes

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
