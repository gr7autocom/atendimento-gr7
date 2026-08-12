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
**Por quê:** pg_cron/realtime/Edge já rodam no Free. Migrar para Pro por causa do auto-pause (webhook precisa estar sempre no ar) e backup. **Nota (2026-08-11):** os anexos migraram do Cloudinary para o Supabase Storage ([ADR-12](#adr-12--migração-dos-anexos-cloudinary--supabase-storage)), então agora contam no teto de armazenamento do próprio projeto Supabase — não mais um fator a favor do Free por tirarem peso de fora.

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
- **Não há push**: com o PWA fechado o cliente não é avisado. O indicador de presença que mitigava isso foi removido em 2026-08-11 (ver [ADR-13](#adr-13--indicador-de-presença-removido)) — hoje o atendente decide só pelo andamento da conversa, e finaliza se o cliente sumir

Referência do canal em [canal-web.md](canal-web.md).

## ADR-12 — Migração dos anexos: Cloudinary → Supabase Storage

**Decisão (2026-08-11):** os anexos (prints, fotos, documentos e áudios) passam a ser gravados no Supabase Storage, bucket próprio `atendimento-anexos`, em vez do Cloudinary. Acervo já existente migrado (era um único arquivo). O Cloudinary sai deste repositório por completo; os secrets `CLOUDINARY_*` seguem configurados no Supabase compartilhado só porque `painel-implantacao-v2` ainda usa a mesma conta para limpar o legado dele (ver o design doc da migração dele, `docs/superpowers/specs/2026-08-08-migracao-cloudinary-supabase-storage-design.md`, naquele repo).

**Por quê:** o usuário migrou o painel de implantação para o Storage e decidiu não manter dois provedores de arquivo diferentes entre os dois projetos irmãos. Bucket próprio, e não o `arquivos` do painel: os anexos daqui são conversa com cliente externo, e misturá-los no bucket interno de tarefas/scrap do painel acoplaria os dois produtos sem necessidade.

**Como:** mesmo desenho de dois caminhos que já existia com o Cloudinary — a central (atendente autenticado) sobe direto pro bucket com a própria sessão (`src/lib/storage.ts`); o canal web (cliente sem login) nunca fala com o Storage direto, passa pela Edge Function `atendimento-web`, que grava com a chave de serviço. A exclusão de titular (LGPD) segue sem service role, de propósito: as policies do bucket (`atendimento_anexos_select`/`_delete`) checam `public.e_admin()`, a mesma função que já autoriza a RPC de eliminação.

**Trade-off aceito conscientemente:** o bucket é público (mesma característica do Cloudinary antes) — quem tiver a URL acessa o arquivo sem login. Documentado em [lgpd/subprocessadores.md](lgpd/subprocessadores.md); não é regressão, é a mesma exposição que já existia.

**Referência da migração-irmã:** `painel-implantacao-v2` fez o mesmo movimento em 2026-08-08/09 para tarefas, Talks e avatares; o desenho daqui reaproveita as lições de lá, sobretudo a de que `storage.objects` **precisa de policy de SELECT** além de INSERT/DELETE, senão a exclusão responde sucesso sem apagar nada.

## ADR-13 — Indicador de presença removido

**Decisão (2026-08-11):** o "Cliente na conversa" / "Cliente ausente há X min" / "Cliente sem acesso" do cabeçalho da conversa (canal web) saiu da tela.

**Por quê:** o usuário comparou com o Zintech, referência de fluxo deste produto, que não tem esse indicador — e ao pensar no fluxo real percebeu que não precisa dele: o atendente já vê a última mensagem e decide sozinho se continua ou finaliza; um relógio dizendo "ausente há 4 min" não muda essa decisão. Motivou a remoção também um bug encontrado no caminho: o indicador podia ficar desatualizado com a central em segundo plano (a biblioteca de polling pausa por padrão nessa condição), e investigar por que valeu menos a pena que simplesmente tirar uma informação que não influenciava nenhuma ação.

**O que ficou:** a RPC `atendimento_web_presenca` continua no banco e é chamada — não para exibir nada, só para decidir se "Encerrar acesso do cliente" aparece no menu (`sessoes_ativas > 0`). O componente `PresencaCliente.tsx` foi apagado; o hook `usePresencaCliente` ficou, porque essa segunda função ainda depende dele.

## Pendências de decisão (design em aberto)

- Duração da janela de reabertura e timezone do horário de atendimento
- RLS por departamento (endurecimento pós-MVP) vs filtro só na aplicação no MVP
- Comportamento fora de horário (cria ticket ou só responde)
- Hospedagem/deploy do frontend do atendimento
