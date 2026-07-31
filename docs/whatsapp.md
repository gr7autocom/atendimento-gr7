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
  configurarWebhook(url): Promise<void>                        // POST /webhook (na ativação)
}
```

Trocar uazapi → outro provedor (ex.: Evolution API, ou a API oficial da Meta) = trocar só o driver. A inbox, o banco e o app não mudam.

> **MVP sem uazapi:** o desenvolvimento começa com um **driver mock** (implementa a mesma interface, simula receber/enviar gravando direto no banco) + **seeds de exemplo**. Isso destrava inbox e bot sem conta uazapi. A integração real vira um passo isolado depois, trocando o mock pelo driver uazapi.

## Referência da API uazapi (conferida no spec OpenAPI oficial, 2026-07-30)

> **Fonte:** spec OpenAPI 3.1.0, `uazapiGO - WhatsApp API` v2.1.1, baixado do painel da uazapi. O arquivo fica em `docs/uazapi-openapi-spec.yaml`, **fora do git** (600 KB, só consulta local). O que importa dele está resumido nesta seção; se precisar de um endpoint não citado aqui, abra o arquivo.
>
> Base URL: `https://{subdomain}.uazapi.com` (o subdomínio é por conta/servidor; o gratuito é `free.uazapi.com` e **não serve para produção** — o próprio `/instance/create` avisa que a instância de teste é desconectada e apagada depois de 1 hora). Autenticação por **header**, não Bearer: `token` (token da instância) nos endpoints normais, `admintoken` nos administrativos. Limite estourado → HTTP **429**.

**Conexão (aba Conexão + pílula de status):**

| Ação | Método + path | Header | Corpo / retorno |
|---|---|---|---|
| Criar instância | `POST /instance/create` | `admintoken` | body `{ name }` obrigatório. Retorna o **token da instância** (guardar como secret). A instância nasce desconectada |
| Conectar / QR | `POST /instance/connect` | `token` | body `phone?`, `browser?`, `systemName?`. **Sem `phone` → QR base64** (2 min). **Com `phone` → pairing code** (5 min). Estado vai a `connecting` |
| Status | `GET /instance/status` | `token` | ver abaixo, o retorno tem duas coisas chamadas "status" |

> ⚠️ Não existe `POST /instance/init` — esse path estava errado aqui até 2026-07-30. É `/instance/create`.

**O retorno do `/instance/status` tem dois campos "status" diferentes.** Confundir os dois quebra a pílula do topo:

```json
{
  "instance": { "status": "connected", "qrcode": "...", "paircode": "...", "profileName": "..." },
  "status":   { "connected": true, "loggedIn": true, "jid": { "user": "5511999999999", "server": "s.whatsapp.net" } }
}
```

- `instance.status` é a **string de estado** que a pílula usa: `disconnected` → `connecting` → `connected`, mais `hibernated` (sessão pausada, credenciais preservadas, precisa reconectar). O `hibernated`/`disconnected` é o risco do 24/7 (ver seção abaixo).
- `status.connected` e `status.loggedIn` são **booleanos** de socket/autenticação. Servem de confirmação, não de fonte do estado.

O QR e o pairing code voltam dentro de `instance` (`qrcode`, `paircode`), não na raiz.

**Enviar:**

- `POST /send/text` (`token`) — obrigatórios `number` (dígitos ou JID `@s.whatsapp.net`/`@g.us`/`@lid`/`@newsletter`) e `text`. Úteis: `delay` (ms, ajuda anti-ban), `replyid`, `mentions`, `linkPreview`, `track_id` (amarrar ao nosso `atendimento_mensagens.id`).
- `POST /send/media` (`token`) — obrigatórios `number`, `type` (`image`|`video`|`document`|`audio`|`ptt`|`ptv`|`sticker`), `file` (URL ou base64). Úteis: `text`/`caption`, `docName`, `viewOnce`, `delay`. Retorno traz o id da mensagem (vira `wa_message_id`).

**Webhook (recebimento):** `GET /webhook` (ver), `POST /webhook` (configurar), `GET /webhook/errors` (erros) e `GET /sse` (alternativa por stream, que **não** usamos — Edge Function não mantém conexão aberta).

### Configurar o webhook (`POST /webhook`, header `token`)

Usar o **modo simples**: sem `action` e sem `id`, a uazapi mantém um único webhook por instância e cria ou atualiza sozinha. É o corpo exato que a `whatsapp-conexao` vai mandar:

```json
{
  "url": "https://<projeto>.supabase.co/functions/v1/whatsapp-webhook",
  "events": ["messages", "messages_update", "connection"],
  "excludeMessages": ["wasSentByApi"]
}
```

**`excludeMessages: ["wasSentByApi"]` não é opcional para nós.** Sem esse filtro, toda mensagem que o nosso bot envia volta como webhook, o `whatsapp-webhook` lê como se fosse do cliente e o bot responde a si mesmo: loop infinito, e cada volta é uma invocation cobrada. O driver mock nunca revela esse problema, porque ele não devolve o que enviamos.

Eventos existentes (assinar **só** os três acima; cada evento é uma invocation, ver [arquitetura.md](arquitetura.md)): `connection`, `history`, `messages`, `messages_update`, `newsletter_messages`, `call`, `contacts`, `presence`, `groups`, `labels`, `chats`, `chat_labels`, `blocks`, `sender`.

Outros filtros de `excludeMessages`, se precisarmos depois: `wasNotSentByApi`, `fromMeYes`, `fromMeNo`, `isGroupYes`, `isGroupNo`. Descartar grupo com `isGroupYes` é candidato — atendimento é sempre 1:1.

Campos opcionais `addUrlEvents` e `addUrlTypesMessages` acrescentam o tipo do evento e da mensagem como path na URL (`/webhook/messages/conversation`). **Deixar os dois `false`**: a nossa Edge Function é um endpoint só e lê o tipo pelo corpo.

### Payload do webhook — o que ainda falta

Este é o **único item que sobrou dos "A CONFIRMAR"**, e o spec não fecha sozinho porque se contradiz:

- O schema `WebhookEvent` descreve `{ event, instance, data }`, com `data` declarado como objeto livre (`additionalProperties: true`), sem um exemplo sequer.
- O exemplo do `/sse` mostra outra forma, `{ type, data }`, e com nomes de evento no singular (`message`) contra o plural do webhook (`messages`).

Ou seja: **o envelope precisa ser capturado ao vivo**, não deduzido. Assim que houver conta, apontar o webhook para `https://webhook.cool/` (a própria uazapi recomenda, sem rate limit), mandar uma mensagem de teste e colar o JSON real aqui.

Enquanto isso, o `normalizarEventoUazapi` (em `supabase/functions/_shared/whatsapp/normalizar-uazapi.ts`) já está escrito e **aceita as duas formas**, mais o dado aninhado em `data.message` e em lista. Na dúvida ele devolve `{ tipo: 'ignorado' }`, em vez de gravar registro com shape errado. É módulo puro, sem `fetch` e sem `Deno.env`, coberto por 22 testes no `npm test` — quando o envelope real aparecer, o caso novo entra no teste antes do código.

Uma limitação conhecida: se o `data` vier como **lista**, só o primeiro item é aproveitado, porque o `EventoNormalizado` representa um evento por vez. Conferir na captura se a uazapi manda em lote.

O **conteúdo** de dentro do `data`, esse sim, o spec entrega (schema `Message`) e é o que vamos mapear:

| Campo uazapi | Vira, no nosso banco |
|---|---|
| `messageid` | `atendimento_mensagens.wa_message_id` (chave de deduplicação) |
| `chatid`, `sender`, `sender_pn` | telefone do `contato` |
| `senderName` | nome de exibição, quando o contato ainda não existe |
| `fromMe` | direção (`entrada` / `saida`) |
| `messageType`, `content` | tipo e corpo bruto |
| `text` | texto da mensagem |
| `messageTimestamp` | timestamp em **milissegundos** |
| `status` | `Queued`, `Sent`, `Delivered`, `Read`, `Failed`, `Canceled` |
| `wasSentByApi` | trava extra anti-loop, mesmo com o filtro ligado |
| `track_id` | o `atendimento_mensagens.id` que mandamos no envio |
| `error` | motivo da falha de envio |

### Endpoints que destravam pendências já registradas

Anotados aqui para a próxima sessão não redescobrir (ver `PROGRESSO.md`):

| Pendência | Endpoint |
|---|---|
| Indicador de não lidas | `wa_unreadCount` vem em `POST /chat/details`; `POST /message/markread` (body `{ id: [...] }`) marca como lida ao abrir a conversa |
| Áudio e imagem na inbox | `POST /message/download` devolve URL pública (`fileURL`) e, com `transcribe: true`, transcreve áudio via OpenAI |
| Nome e foto do contato sem cadastro manual | `POST /chat/details` traz `wa_name`, `wa_contactName` e foto (`preview` menor ou original) |
| Menu do bot em botão/lista nativos | `POST /send/menu`, hoje mandamos texto numerado (ver [bot.md](bot.md)) |
| "Digitando…" antes da resposta do bot | `POST /message/presence` e `POST /instance/presence` |
| Anti-ban | `delay` (ms) em cada envio e `POST /instance/updateDelaySettings` para o padrão da instância |

## Fluxo técnico (Edge Functions, Deno)

> **No código (modo mock):** o adapter e as três Edge Functions existem em `supabase/functions/`. O **`whatsapp-webhook` roda o bot (Fase 1+2) e está deployado** no Supabase compartilhado — boas-vindas, menu, identificação do potencial + auto-vínculo por CNPJ, fila, `#sair` e avaliação ao finalizar (ver [bot.md](bot.md)). Tudo em **modo mock**: o driver mock aceita um payload no formato do `EventoNormalizado`, então dá para simular por POST (endpoint protegido por `WEBHOOK_SECRET`). **A CONFIRMAR** sobrou só um: o **envelope real** do webhook que o `normalizarWebhook` do driver uazapi vai parsear (o corpo do configurar-webhook está resolvido acima). Passos de deploy em [../supabase/functions/README.md](../supabase/functions/README.md).

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
- `UAZAPI_ADMIN_TOKEN` — token administrativo (só para `POST /instance/create`).
- ~~`UAZAPI_INSTANCE`~~ — **confirmado desnecessário** no spec (2026-07-30): nenhum endpoint pede id de instância no path ou no corpo, o `token` do header já identifica. Não criar esse secret.

Nunca no frontend — só nas Edge Functions.

## Pré-requisitos externos (bloqueiam o bot real)

1. Assinatura uazapi ativa
2. Número de WhatsApp dedicado conectado (QR) — de preferência número novo (número na API não funciona no app WhatsApp comum)
3. **Conta WhatsApp Business, não WhatsApp comum.** A própria uazapi abre o spec com esse aviso: no WhatsApp normal a integração dá desconexão, limitação e instabilidade. Isso muda o pedido ao cliente, não basta "um número novo".
4. Confirmar limites de instância/preço atuais direto com a uazapi

## Custo de invocations (Free do Supabase)

Cada mensagem recebida + cada webhook de status é uma invocation de Edge Function. **Filtrar** quais eventos a uazapi envia (ex.: evitar status verboso) para não estourar o Free. Ver [arquitetura.md](arquitetura.md).
