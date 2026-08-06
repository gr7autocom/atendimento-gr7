# Roadmap — GR7 Atendimento

> Direção e fases. Estado atual em [PROGRESSO.md](PROGRESSO.md).

## Visão

Central de atendimento própria, operada pela equipe GR7, interligada ao Painel de Implantação, com foco final em **métricas para a gestão**. WhatsApp é o canal principal; o **canal web** entra como segundo, para o cliente não depender do celular.

## Fases

### Fase 1 — MVP (foco atual)

Base navegável + configurações + inbox + bot funcionando.

- App separado com design dark e login compartilhado
- Configurações: departamentos, atendentes por departamento, mensagens do bot, horários
- Inbox: fila única com visibilidade por dono (admin vê tudo; atendente vê os seus mais a fila livre), assumir/responder/finalizar ticket
- Bot por ticket: saudação, menu automático, roteamento, fora de horário, reabertura
- Integração uazapi (webhook + envio) atrás de adapter
- **Canal web (PWA do cliente)** — segundo canal, sem conta e sem senha, na mesma inbox. Não depende da uazapi, então corre em paralelo. Seis fases em [PROGRESSO.md](PROGRESSO.md), desenho em [docs/canal-web.md](docs/canal-web.md)

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
- **Multi-tenancy / portal do cliente** — cliente final **não tem conta nem senha**; só a equipe interna opera o sistema. Revisto em parte pelo ADR-11: o canal web dá ao cliente acesso a **uma conversa**, por token de dispositivo, não a um portal com histórico e tarefas
- **Monorepo** — não reestruturar o painel agora (produção); app separado com design copiado
