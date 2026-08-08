# Arquitetura — GR7 Atendimento

## Topologia: app separado + backend compartilhado

```
WhatsApp ⇄ [uazapi (SaaS, mantém sessão 24/7)]
                  │  webhook (mensagem recebida)
                  ▼
        [Supabase Edge Function: whatsapp-webhook] → grava no banco → realtime
                  ▲                                         │
                  │  HTTP fetch (enviar)                    ▼
        [Edge Function: whatsapp-send]          [App Atendimento (React)]
                                                          │
                        MESMO SUPABASE (banco + auth) ────┘
                 clientes, projetos, tarefas, usuarios, atendimento_*
```

- **Frontend separado:** `Desktop/projeto/atendimento-gr7/` (irmão de `painel-implantacao-v2/`). Build/deploy próprios. A **central** é usada só por atendentes.
- **Backend compartilhado:** mesmo projeto Supabase do painel (banco, auth, Edge Functions). Vínculo cliente/projeto/tarefa é nativo (mesmo banco), não integração por API.
- **Identidade do atendente:** loga com a mesma conta do painel (`usuarios` + `can()`).
- **Identidade do cliente (canal web, ADR-11):** não existe conta nem senha. O cliente se identifica e recebe um **token de dispositivo** que dá acesso a **uma conversa, só a dele**. Ele nunca fala com o PostgREST: todo o tráfego passa por uma Edge Function com service role, e o role `anon` **continua sem nenhuma policy**. Ver [canal-web.md](canal-web.md).

Por que assim: não incha o painel, não duplica cadastro/auth, e o vínculo com a implantação é `INSERT`/RPC no mesmo banco. Ver [decisoes.md](decisoes.md) ADR-01.

## Isolamento do painel (produção)

O painel está em produção com a equipe usando. Regras invioláveis:

1. **Migrations só ADITIVAS** no MVP — apenas `CREATE TABLE` de tabelas novas. Nenhum `ALTER`/`DROP` em tabela do painel.
2. Migrations moram no **repo do painel** (`painel-implantacao-v2/supabase/migrations/`) — fonte única do schema, já linkada. Evita dois históricos de migration divergindo no mesmo banco.
3. O código do atendimento **não importa** nada do painel — o design system é **copiado** (ver [design.md](design.md)).

Resultado: o painel continua byte-a-byte igual; as tabelas novas são invisíveis para ele.

## Plano Supabase: Free → Pro

- **Dev + piloto controlado:** Free (anexos vão pro Cloudinary, não pesam no DB; pg_cron/realtime/Edge Functions já funcionam no Free).
- **Produção real:** Pro. Motivos: (a) Free auto-pausa após ~7 dias ocioso, e o webhook do WhatsApp precisa estar sempre no ar; (b) backup diário/PITR para dados de atendimento.
- **Limites que apertam primeiro no Free:** invocations de Edge Function (filtrar eventos da uazapi), conexões realtime simultâneas, compute compartilhado.

## Deploy

- Frontend: **Apache/Plesk**, como o painel (decidido em 2026-08-07; o `vercel.json` foi apagado junto, para não deixar instrução falsa no repositório). **Um repositório, dois pacotes de publicação:** `npm run build` roda duas passadas e gera `dist/atendimento/` e `dist/suporte/`, cada uma completa e independente, com seu próprio `.htaccess` (de [deploy/](../deploy/)). Publicar é copiar **o conteúdo** de cada pasta para o document root do seu subdomínio — sem regra de endereço para acertar, e sem a tela de login da equipe existindo no endereço do cliente. As duas aplicações continuam no mesmo `src/` porque compartilham o design system; separá-las em repositórios obrigaria a copiar `components/ui/` e o tema, que é o custo já pago com o painel e que diverge em silêncio na primeira correção aplicada de um lado só. Detalhe e listas de estáticos por app em [`vite.config.ts`](../vite.config.ts). **Endereços decididos em 2026-08-07:** a central da equipe em **`atendimento.gr7autocom.com.br`** e o **PWA do cliente** em **`suporte.gr7autocom.com.br`**. São o mesmo build com duas entradas, servidas em subdomínios separados de propósito: o service worker do cliente fica com escopo próprio, a central nunca vira instalável (ADR-11), e o que cada um guarda no navegador não encosta no outro, porque origem diferente é armazenamento diferente. `suporte` é também o endereço que se fala ao telefone.
- Edge Functions: no mesmo projeto Supabase (`npx supabase functions deploy`). As três (`whatsapp-webhook`, `whatsapp-send`, `whatsapp-conexao`) estão **prontas e rodando em modo mock**; o `whatsapp-webhook` está **deployado** desde 2026-07-27 e roda o fluxo do bot. Falta a conta uazapi para sair do mock. Ver [whatsapp.md](whatsapp.md).
- Provedor WhatsApp (uazapi): SaaS externo, sem infra nossa.
