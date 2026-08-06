# Decisões (ADRs) — GR7 Atendimento

Registro das decisões fechadas no discovery/design, com justificativa. Data: 2026-07-23.

## ADR-01 — App separado + Supabase compartilhado
**Decisão:** frontend de atendimento separado (pasta irmã), usando o **mesmo projeto Supabase** do painel (banco, auth, Edge Functions).
**Por quê:** não incha o painel, não duplica cadastro/auth, e o vínculo cliente/projeto/tarefa vira `INSERT`/RPC no mesmo banco (não integração por API). Alternativas descartadas: tudo dentro do painel (incha Sidebar/bundle/perfis); dois sistemas + API (duplicação e sync frágil).

## ADR-02 — WhatsApp via uazapi + adapter
**Decisão:** usar a **uazapi** (SaaS não-oficial, online 24/7 do lado do provedor), atrás de um **adapter**. NÃO usar API oficial da Meta por ora. Baileys self-host + Fly.io ficou **fora do escopo** (não manter processo/sessão do nosso lado).
**Por quê:** backend serverless (Edge Functions) não hospeda processo persistente; uazapi encaixa (webhook + REST) e terceiriza a operação de sessão. Adapter mantém a decisão reversível (→ Evolution API ou API oficial da Meta). Risco de ban existe em não-oficial.
**Status (2026-07-31):** o **adapter está pronto e conferido** contra o spec OpenAPI oficial v2.1.1 — endpoints, corpo do webhook e normalização do payload (com 22 testes). Falta apenas o pré-requisito externo: **conta uazapi + número dedicado em WhatsApp Business**. O único ponto em aberto é o **envelope real do webhook**, que precisa ser capturado ao vivo porque o spec se contradiz nele. Ver [whatsapp.md](whatsapp.md).

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
**Status (2026-08-05):** **parcialmente revisto pelo [ADR-11](#adr-11--canal-web-pwa-do-cliente-revisa-parte-do-adr-09)**. O que continua valendo, e é o essencial: **não há multi-tenancy, não há conta de cliente e ninguém do lado do cliente tem senha**. O que deixou de valer é "nunca acessa o sistema": com o canal web, o cliente alcança uma conversa, e só ela, por um token de dispositivo emitido no servidor. Nenhuma policy nova foi criada para o role `anon`, então a premissa de RLS que motivou este ADR segue intacta.

## ADR-11 — Canal web (PWA do cliente), revisa parte do ADR-09
**Decisão (2026-08-05):** existe um **segundo canal de atendimento**, um PWA instalável na área de trabalho do cliente, com a conversa acontecendo pela web. O cliente **não cria conta e não tem senha**: informa nome e telefone (CNPJ opcional) e recebe um **token opaco por dispositivo**, guardado no navegador, que dá acesso a **uma conversa e só a ela**. Todo o tráfego passa por uma **Edge Function única com service role**, nunca pelo PostgREST, e o role `anon` continua sem nenhuma policy. O canal é distinguido pela coluna `atendimentos.canal`, que já existia e estava morta.

**Por quê:** o cliente hoje depende do celular para pedir suporte. Quem está no balcão, com o sistema parado e o telefone longe, fica sem canal. Três fatos tornaram a decisão barata: a coluna `canal` já existe; a resposta do atendente já é gravada no banco e lida de lá, então **o canal web funciona sem depender da contratação da uazapi**; e o design system já está fechado e coberto por teste, então a interface do cliente reusa o que existe.

**Alternativas descartadas:** criar policies para `anon` (mudança de maior risco possível num banco compartilhado com o painel em produção); usar o CNPJ como chave de acesso (é dado público, e daria a qualquer pessoa a conversa em andamento da empresa); repositório separado (duplicaria o design system pela segunda vez); rota dentro do app atual (tornaria a central da equipe instalável e arrastaria o bundle do admin para o cliente).

**Trade-offs aceitos conscientemente:**

- Sem login, **não há barreira de entrada**: qualquer pessoa abre chamado. É o mesmo grau de abertura do WhatsApp, com menos atrito, e o rate limit é a única defesa. O impacto é chamado falso, nunca vazamento de conversa
- **Limpar o navegador perde a conversa em andamento.** Não há solução dentro de "sem login", então o aviso é explícito na tela
- **Não há push**: com o PWA fechado o cliente não é avisado. Por isso o atendente vê presença do cliente na conversa

Referência do canal em [canal-web.md](canal-web.md).

## Pendências de decisão (design em aberto)

- Duração da janela de reabertura e timezone do horário de atendimento
- RLS por departamento (endurecimento pós-MVP) vs filtro só na aplicação no MVP
- Comportamento fora de horário (cria ticket ou só responde)
- Hospedagem/deploy do frontend do atendimento
