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
    driver-uazapi.ts    Driver real (endpoints confirmados; ver A CONFIRMAR abaixo)
    driver-mock.ts      Driver de desenvolvimento (sem conta)
    index.ts            criarDriver(): escolhe uazapi (se há chaves) ou mock
whatsapp-send/          POST envia texto/mídia → { wa_message_id }
whatsapp-conexao/       GET status · POST { phone? } inicia conexão (QR/pairing)
whatsapp-webhook/       POST público: recebe eventos da uazapi
```

## Quando as chaves chegarem

1. Preencher `supabase/functions/.env` a partir do `.env.example` e aplicar:
   `supabase secrets set --env-file supabase/functions/.env --project-ref <ref>`.
   Com `UAZAPI_BASE_URL` + `UAZAPI_TOKEN` presentes, `criarDriver()` passa a usar a
   uazapi real automaticamente.
2. Criar a instância (`POST /instance/init`, header `admintoken`) e guardar o
   `UAZAPI_TOKEN` retornado.
3. Fechar os **A CONFIRMAR** (precisam do payload/token reais):
   - `driver-uazapi.ts` → `normalizarWebhook`: mapear os campos reais do webhook.
   - `driver-uazapi.ts` → `enviarMensagem`: confirmar o campo do id na resposta.
   - `whatsapp-webhook/index.ts`: implementar a persistência da mensagem de entrada
     (casar/criar contato, abrir/reabrir atendimento, rodar o bot — ver docs/bot.md).
4. Deploy: `supabase functions deploy whatsapp-webhook whatsapp-send whatsapp-conexao --project-ref <ref>`.
5. Configurar a URL do webhook na uazapi apontando para `whatsapp-webhook`, só com os
   eventos usados (filtrar para não estourar invocations — ver docs/arquitetura.md).
6. Ligar a pílula de status: `src/lib/useStatusBot.ts` passa a chamar `whatsapp-conexao`
   (GET) e revalidar em intervalo; e um watchdog agendado reconecta se cair (24/7).

## Rodar local (mock)

```
supabase functions serve whatsapp-conexao
# GET  -> { status: "disconnected", ... }
# POST -> { status: "connecting", qrCode: "data:image/png;base64,MOCK" }
```
