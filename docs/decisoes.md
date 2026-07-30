# Decisões (ADRs) — GR7 Atendimento

Registro das decisões fechadas no discovery/design, com justificativa. Data: 2026-07-23.

## ADR-01 — App separado + Supabase compartilhado
**Decisão:** frontend de atendimento separado (pasta irmã), usando o **mesmo projeto Supabase** do painel (banco, auth, Edge Functions).
**Por quê:** não incha o painel, não duplica cadastro/auth, e o vínculo cliente/projeto/tarefa vira `INSERT`/RPC no mesmo banco (não integração por API). Alternativas descartadas: tudo dentro do painel (incha Sidebar/bundle/perfis); dois sistemas + API (duplicação e sync frágil).

## ADR-02 — WhatsApp via uazapi + adapter
**Decisão:** usar a **uazapi** (SaaS não-oficial, online 24/7 do lado do provedor), atrás de um **adapter**. NÃO usar API oficial da Meta por ora. Baileys self-host + Fly.io ficou **fora do escopo** (não manter processo/sessão do nosso lado).
**Por quê:** backend serverless (Edge Functions) não hospeda processo persistente; uazapi encaixa (webhook + REST) e terceiriza a operação de sessão. Adapter mantém a decisão reversível (→ Evolution API ou API oficial da Meta). Risco de ban existe em não-oficial.

## ADR-10 — Visual próprio do Atendimento (revisa a decisão de "idêntico ao painel")
**Decisão (2026-07-23):** o Atendimento terá **identidade visual própria** (dark), mais elaborada que o painel, definida numa **etapa de design dedicada no fim** da implementação. Os tokens de cor base seguem vindos do painel.
**Por quê:** a inbox de atendimento pede um layout mais denso que as telas do painel, e o cliente quer um produto mais acabado. Trade-off aceito conscientemente: as telas construídas antes dessa etapa saem cruas e serão repolidas depois (retrabalho conhecido).
**Status (2026-07-30):** a etapa de **padronização e acessibilidade** aconteceu (auditoria com 24 achados, 5 lotes, guarda em `src/padroes-ui.test.ts`). Tokens, escala tipográfica, dimensões, espaçamento, contraste e navegação por teclado estão fechados e verificados por teste. O que segue em aberto do ADR é o polimento **estético**, não a base.

## ADR-03 — Migrations aditivas no repo do painel
**Decisão:** as tabelas novas moram no `supabase/migrations/` do painel (fonte única já linkada) e o MVP só faz `CREATE TABLE` — nenhum `ALTER`/`DROP` em tabela do painel.
**Por quê:** o painel está em produção; adição pura não afeta o funcionamento. Um único diretório de migrations por banco evita históricos divergentes.

## ADR-04 — Supabase Free no piloto → Pro na produção
**Decisão:** desenvolver e pilotar no Free; migrar para Pro na produção real.
**Por quê:** Cloudinary tira o peso dos anexos; pg_cron/realtime/Edge já rodam no Free. Migrar para Pro por causa do auto-pause (webhook precisa estar sempre no ar) e backup.

## ADR-05 — Posse do ticket: Assumir explícito
**Decisão:** ticket cai numa fila compartilhada do departamento; o atendente clica "Assumir" para virar dono.
**Por quê:** evita dois atendentes respondendo o mesmo cliente. Distribuição automática (rodízio) fica para depois do MVP.

## ADR-06 — Menu do bot automático a partir dos departamentos
**Decisão:** o menu de opções é gerado dos departamentos ativos; saudação e fora-de-horário são texto configurável.
**Por quê:** menos manutenção, nunca fica inconsistente com os departamentos.

## ADR-07 — Janela de reabertura curta de ticket
**Decisão:** mensagem do cliente dentro de uma janela curta após finalizar reabre o mesmo ticket sem repetir o menu; passada a janela, ticket novo.
**Por quê:** evita spammar o menu por um simples "obrigado".

## ADR-08 — Corte do MVP: base navegável primeiro, uazapi por último
**Decisão:** construir tudo que não depende da uazapi primeiro (telas, config, inbox com dados de teste); plugar a uazapi no fim.
**Por quê:** não ficar bloqueado esperando o pré-requisito externo (conta uazapi + número).

## ADR-09 — Sem multi-tenancy (cliente não loga)
**Decisão:** só a equipe interna opera; o cliente final interage pelo WhatsApp e nunca acessa o sistema.
**Por quê:** elimina o risco transversal de isolamento por tenant no RLS. Simplifica enormemente auth e segurança.

## Pendências de decisão (design em aberto)

- Duração da janela de reabertura e timezone do horário de atendimento
- RLS por departamento (endurecimento pós-MVP) vs filtro só na aplicação no MVP
- Comportamento fora de horário (cria ticket ou só responde)
- Hospedagem/deploy do frontend do atendimento
