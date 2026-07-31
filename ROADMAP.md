# Roadmap — GR7 Atendimento

> Direção e fases. Estado atual em [PROGRESSO.md](PROGRESSO.md).

## Visão

Central de atendimento WhatsApp própria, operada pela equipe GR7, interligada ao Painel de Implantação, com foco final em **métricas para a gestão**.

## Fases

### Fase 1 — MVP (foco atual)

Base navegável + configurações + inbox + bot funcionando.

- App separado com design dark e login compartilhado
- Configurações: departamentos, atendentes por departamento, mensagens do bot, horários
- Inbox: fila única com visibilidade por dono (admin vê tudo; atendente vê os seus mais a fila livre), assumir/responder/finalizar ticket
- Bot por ticket: saudação, menu automático, roteamento, fora de horário, reabertura
- Integração uazapi (webhook + envio) atrás de adapter

### Fase 2 — Integração com o Painel

- [x] Criar **tarefa** a partir do chamado (cliente pediu instalar PC) — **entregue em 2026-07-28**, antes do fim da Fase 1
- [ ] Cadastrar **cliente + projeto** a partir da venda (reusa RPC `gerar_tarefas_iniciais_cliente`)
- [ ] Histórico de atendimento na ficha do cliente

### Fase 3 — Métricas / Dashboard / Relatórios (prioridade dos CEOs)

- KPIs: tempo de 1ª resposta, tempo de resolução, volume por atendente/departamento, SLA, horários de pico
- Dashboard próprio + alimentar a página "Relatórios para Gestores" do painel

### Fase 4 — Evoluções (sem prazo)

- Distribuição automática (rodízio) por disponibilidade
- Bot avançado / construtor de fluxo
- Base de conhecimento / respostas rápidas
- Outros canais (Instagram, e-mail) reusando o mesmo container

## Decisões de "não fazer" (por ora)

- **API oficial da Meta** — não usar agora (decisão do cliente); uazapi via adapter, destravável depois
- **Multi-tenancy / portal do cliente** — cliente final não loga; só equipe interna opera
- **Monorepo** — não reestruturar o painel agora (produção); app separado com design copiado
