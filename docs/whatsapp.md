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
  enviarMensagem(para, conteudo): Promise<{ wa_message_id }>
  normalizarWebhook(payload): EventoNormalizado   // mensagem recebida / status
  statusConexao(): Promise<Status>                // conectado / qr / desconectado
}
```

Trocar uazapi → outro provedor (ex.: Evolution API, ou a API oficial da Meta) = trocar só o driver. A inbox, o banco e o app não mudam.

## Fluxo técnico (Edge Functions, Deno)

- **Receber:** `whatsapp-webhook` (endpoint público) recebe o webhook da uazapi → valida → `normalizarWebhook` → deduplica por `wa_message_id` → casa/cria `contato` + `atendimento` → grava `atendimento_mensagens` (`entrada`) → realtime atualiza a inbox → dispara lógica do bot.
- **Enviar:** `whatsapp-send` chama a REST da uazapi (token) via `enviarMensagem`, grava mensagem `saida`, atualiza status pelo webhook de status.
- **Conexão:** QR code + status de sessão expostos numa tela de Configurações → Conexão WhatsApp.

## Secrets (Supabase)

`UAZAPI_BASE_URL`, `UAZAPI_TOKEN`, `UAZAPI_INSTANCE` (nomes a confirmar com a doc da uazapi). Nunca no frontend — só nas Edge Functions.

## Pré-requisitos externos (bloqueiam o bot real)

1. Assinatura uazapi ativa
2. Número de WhatsApp dedicado conectado (QR) — de preferência número novo (número na API não funciona no app WhatsApp comum)
3. Confirmar limites de instância/preço atuais direto com a uazapi

## Custo de invocations (Free do Supabase)

Cada mensagem recebida + cada webhook de status é uma invocation de Edge Function. **Filtrar** quais eventos a uazapi envia (ex.: evitar status verboso) para não estourar o Free. Ver [arquitetura.md](arquitetura.md).
