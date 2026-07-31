# Edge Functions — WhatsApp (uazapi)

Integração do WhatsApp via **adapter** (nunca chamar a uazapi direto do domínio).
Referência da API e do fluxo 24/7 em [../../docs/whatsapp.md](../../docs/whatsapp.md).

> **Estado: esqueleto.** A estrutura está pronta; nada foi deployado ainda. Sem
> chaves configuradas, tudo roda no **driver mock** (não fala com a uazapi). Não há
> migration nem impacto no painel.

## Estrutura

```
_shared/
  cors.ts               Helpers de resposta/CORS
  supabase.ts           Cliente service role (ignora RLS, ver docs/db.md)
  whatsapp/
    tipos.ts            Interface WhatsAppDriver + EventoNormalizado
    driver-uazapi.ts    Driver real: só HTTP (endpoints conferidos no spec OpenAPI)
    normalizar-uazapi.ts  Payload da uazapi → EventoNormalizado (puro, testável)
    driver-mock.ts      Driver de desenvolvimento (sem conta)
    index.ts            criarDriver(): escolhe uazapi (se há chaves) ou mock
whatsapp-send/          POST envia texto/mídia → { wa_message_id }
whatsapp-conexao/       GET status · POST { phone? } conecta · POST { acao: "webhook" }
whatsapp-webhook/       POST público: recebe eventos da uazapi
```

## Quando as chaves chegarem

1. Preencher `supabase/functions/.env` a partir do `.env.example` e aplicar:
   `supabase secrets set --env-file supabase/functions/.env --project-ref <ref>`.
   Com `UAZAPI_BASE_URL` + `UAZAPI_TOKEN` presentes, `criarDriver()` passa a usar a
   uazapi real automaticamente.
2. Criar a instância (`POST /instance/create`, header `admintoken`, body `{ name }`)
   e guardar o `UAZAPI_TOKEN` retornado. Não existe `/instance/init`.
3. Deploy: `supabase functions deploy whatsapp-webhook whatsapp-send whatsapp-conexao --project-ref <ref>`.
4. Apontar o webhook da uazapi para cá, com **um POST**, sem entrar no painel deles:
   `POST /functions/v1/whatsapp-conexao` com `{ "acao": "webhook" }`. A URL sai do
   `SUPABASE_URL` e os filtros certos já vão no corpo, incluindo o
   `excludeMessages: ["wasSentByApi"]`, que evita o bot responder a si mesmo em loop.
5. Conferir o envelope real do webhook (é o único "A CONFIRMAR" que sobrou): mandar
   uma mensagem de teste e comparar com os casos de
   `_shared/whatsapp/normalizar-uazapi.test.ts`. O normalizador já aceita as duas
   formas descritas no spec; se o tráfego real mostrar uma terceira, o caso novo entra
   no teste antes do código.
6. `whatsapp-webhook/index.ts`: implementar a persistência da mensagem de entrada
   (casar/criar contato, abrir/reabrir atendimento, rodar o bot — ver docs/bot.md).
7. Ligar a pílula de status: `src/lib/useStatusBot.ts` passa a chamar `whatsapp-conexao`
   (GET) e revalidar em intervalo; e um watchdog agendado reconecta se cair (24/7).

## Validar antes de publicar

O `npm test` da raiz cobre a lógica pura (`_shared/bot/`, `_shared/whatsapp/normalizar-uazapi`),
mas **não** type-checa as Functions: elas rodam em Deno e ficam fora do `tsc` do app.
Rodar sempre a partir desta pasta, que é onde mora o `deno.json`:

```
cd supabase\functions
deno check whatsapp-webhook/index.ts whatsapp-send/index.ts whatsapp-conexao/index.ts
deno lint
```

Os três entrypoints bastam: o `check` segue os imports e cobre todo o código de
produção. Não use curinga — ele pegaria os `*.test.ts`, que importam `vitest` (npm)
e o Deno não resolve. Esses testes são do vitest, não do Deno.

## Rodar local (mock)

```
supabase functions serve whatsapp-conexao
# GET  -> { status: "disconnected", ... }
# POST -> { status: "connecting", qrCode: "data:image/png;base64,MOCK" }
```

O CLI está como devDependency do projeto, então o comando é `npx supabase ...`
(ou `npm exec supabase -- ...`). Não há binário global.
