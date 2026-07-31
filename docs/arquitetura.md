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

- **Frontend separado:** `Desktop/projeto/atendimento-gr7/` (irmão de `painel-implantacao-v2/`). Build/deploy próprios. Só atendentes usam.
- **Backend compartilhado:** mesmo projeto Supabase do painel (banco, auth, Edge Functions). Vínculo cliente/projeto/tarefa é nativo (mesmo banco), não integração por API.
- **Identidade:** o atendente loga com a mesma conta do painel (`usuarios` + `can()`).

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

- Frontend: hospedagem própria (a definir — Apache/Plesk como o painel, ou Vercel/Netlify). Domínio próprio (ex.: `atendimento.gr7autocom.com.br`).
- Edge Functions: no mesmo projeto Supabase (`npx supabase functions deploy`). As três (`whatsapp-webhook`, `whatsapp-send`, `whatsapp-conexao`) estão **prontas e rodando em modo mock**; o `whatsapp-webhook` está **deployado** desde 2026-07-27 e roda o fluxo do bot. Falta a conta uazapi para sair do mock. Ver [whatsapp.md](whatsapp.md).
- Provedor WhatsApp (uazapi): SaaS externo, sem infra nossa.
