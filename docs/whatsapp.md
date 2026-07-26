# Integração WhatsApp — GR7 Atendimento

## Decisão

- **NÃO usar a API oficial da Meta** por ora (decisão do cliente).
- Provedor: **uazapi** — API REST SaaS brasileira não-oficial, mantém a sessão do WhatsApp **online 24/7 do lado deles** (reconexão, uptime, anti-ban por conta do provedor).
- Sendo **não-oficial**, o risco de ban da Meta permanece; a uazapi transfere só o risco operacional de manter a sessão no ar.

> ⚠️ Antes de fechar: confirmar uptime/estabilidade real da uazapi (há relato de suporte lento no Reclame Aqui — suporte ≠ uptime).

## Sem janela de 24h / templates

Como é não-oficial, **não há** a limitação de "janela de 24h + templates aprovados" da API oficial. Podemos enviar mensagem a qualquer momento. (A "janela de reabertura de ticket" é regra nossa, não da Meta — ver [bot.md](bot.md).)

## Adapter (obrigatório)

O provedor fica atrás de um **adapter/driver** com interface fixa, para não acoplar o domínio à uazapi:

```
interface WhatsAppDriver {
  enviarMensagem(para, conteudo): Promise<{ wa_message_id }>   // /send/text, /send/media
  normalizarWebhook(payload): EventoNormalizado                // mensagem recebida / status
  statusConexao(): Promise<Status>                             // /instance/status
  conectar(phone?): Promise<{ qrCode?, pairingCode?, status }> // /instance/connect (QR/pairing)
}
```

Trocar uazapi → outro provedor (ex.: Evolution API, ou a API oficial da Meta) = trocar só o driver. A inbox, o banco e o app não mudam.

> **MVP sem uazapi:** o desenvolvimento começa com um **driver mock** (implementa a mesma interface, simula receber/enviar gravando direto no banco) + **seeds de exemplo**. Isso destrava inbox e bot sem conta uazapi. A integração real vira um passo isolado depois, trocando o mock pelo driver uazapi.

## Referência da API uazapi (extraída da doc oficial, 2026-07-26)

> Base URL: `https://{subdomain}.uazapi.com` (o subdomínio é por conta/servidor; o gratuito é `free.uazapi.com` e **não serve para produção** — hiberna/expira). Autenticação por **header**, não Bearer: `token` (token da instância) nos endpoints normais, `admintoken` nos administrativos. Limite estourado → HTTP **429**.

**Conexão (aba Conexão + pílula de status):**

| Ação | Método + path | Header | Corpo / retorno |
|---|---|---|---|
| Criar instância | `POST /instance/init` | `admintoken` | retorna o **token da instância** (guardar como secret) |
| Conectar / QR | `POST /instance/connect` | `token` | body `phone?`, `browser?`, `systemName?`. **Sem `phone` → QR base64** (2 min). **Com `phone` → pairing code** (5 min). Estado vai a `connecting` |
| Status | `GET /instance/status` | `token` | `{ state, qrCode?, pairingCode?, ...detalhes }` |

Estados: `disconnected` → `connecting` → `connected`, e `hibernated` (sessão pausada, credenciais preservadas, precisa reconectar). O `hibernated`/`disconnected` é o risco do 24/7 (ver seção abaixo).

**Enviar:**

- `POST /send/text` (`token`) — obrigatórios `number` (dígitos ou JID `@s.whatsapp.net`/`@g.us`/`@lid`/`@newsletter`) e `text`. Úteis: `delay` (ms, ajuda anti-ban), `replyid`, `mentions`, `linkPreview`, `track_id` (amarrar ao nosso `atendimento_mensagens.id`).
- `POST /send/media` (`token`) — obrigatórios `number`, `type` (`image`|`video`|`document`|`audio`|`ptt`|`ptv`|`sticker`), `file` (URL ou base64). Úteis: `text`/`caption`, `docName`, `viewOnce`, `delay`. Retorno traz o id da mensagem (vira `wa_message_id`).

**Webhook (recebimento):** endpoints de **ver**, **configurar** (`POST`), **ver erros** e **SSE**. Filtrar eventos é obrigatório (cada evento = 1 invocation de Edge Function; ver [arquitetura.md](arquitetura.md)).

> ⚠️ **A CONFIRMAR no spec ao vivo** (as páginas da doc não renderizaram esses dois no fetch): (1) **corpo do `POST` de configurar webhook** (provável `url`, `enabled`, filtros de evento) e o **path exato**; (2) **formato do payload JSON** que a uazapi envia no webhook (mensagem recebida, status, conexão) — é o que o `normalizarWebhook` vai parsear. Validar no painel de teste da doc assim que houver `token`/`admintoken`, antes de codar.

## Fluxo técnico (Edge Functions, Deno)

> **Esqueleto no código:** o adapter e as três Edge Functions já existem em `supabase/functions/` (modo mock por padrão, nada deployado). Passos de deploy e os pontos "A CONFIRMAR" em [../supabase/functions/README.md](../supabase/functions/README.md).

- **Receber:** `whatsapp-webhook` (endpoint público) recebe o webhook da uazapi → valida → `normalizarWebhook` → deduplica por `wa_message_id` → casa/cria `contato` + `atendimento` → grava `atendimento_mensagens` (`entrada`) → realtime atualiza a inbox → dispara lógica do bot.
- **Enviar:** `whatsapp-send` chama `/send/text` ou `/send/media` da uazapi (header `token`) via `enviarMensagem`, grava mensagem `saida`, atualiza status pelo webhook de status.
- **Conexão:** `whatsapp-conexao` chama `/instance/connect` (QR/pairing) e `/instance/status` para a aba **Conexão** (`/admin/conexao`) — o token fica na Edge Function, nunca no frontend. Uma **pílula de status na barra do topo** (`BarraTopo` + `useStatusBot`) mostra "Bot conectado/desconectado" para admin e atendente, para o time perceber quando a sessão cai. Hoje é casca (sempre desconectado); vira automático quando o adapter existir.

## Trabalhar 24/7 (após conectar)

A sessão vive **no servidor da uazapi**, não no nosso app: ninguém precisa manter aba aberta. Mensagem que chega dispara o **webhook** → `whatsapp-webhook` grava no banco → realtime na inbox. Isso já é 24/7 por natureza (event-driven, sem browser).

O risco real é a **sessão cair** (`disconnected`/`hibernated`: queda de rede, WhatsApp deslogar o aparelho, plano que hiberna por inatividade). Se cair, os webhooks param e ninguém percebe (a dor relatada do Zintech). Mitigação:

1. **Watchdog agendado** — um cron (pg_cron do Supabase ou agendador externo) chama `GET /instance/status` periodicamente. A pílula `useStatusBot` passa a ler esse status real (via Edge Function).
2. **Reconexão automática** — status ≠ `connected` → tentar `POST /instance/connect`. Se voltar QR (deslogou de vez), pílula vermelha + QR na aba Conexão para reescanear.
3. **Plano pago sem hibernação** — confirmar com a uazapi que o plano mantém a instância viva (o free hiberna/expira). Número **dedicado e novo**, fora do app comum.

## Secrets (Supabase)

- `UAZAPI_BASE_URL` — `https://{subdomain}.uazapi.com` da conta.
- `UAZAPI_TOKEN` — token da instância (endpoints normais: enviar, status, webhook).
- `UAZAPI_ADMIN_TOKEN` — token administrativo (só para `POST /instance/init`).
- `UAZAPI_INSTANCE` — provavelmente **desnecessário** (o `token` já identifica a instância); confirmar ao integrar.

Nunca no frontend — só nas Edge Functions.

## Pré-requisitos externos (bloqueiam o bot real)

1. Assinatura uazapi ativa
2. Número de WhatsApp dedicado conectado (QR) — de preferência número novo (número na API não funciona no app WhatsApp comum)
3. Confirmar limites de instância/preço atuais direto com a uazapi

## Custo de invocations (Free do Supabase)

Cada mensagem recebida + cada webhook de status é uma invocation de Edge Function. **Filtrar** quais eventos a uazapi envia (ex.: evitar status verboso) para não estourar o Free. Ver [arquitetura.md](arquitetura.md).
