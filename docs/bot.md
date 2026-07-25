# Bot e ciclo de vida do ticket — GR7 Atendimento

> **Status: aprovado (Seção 3 do design, 2026-07-23).** O bot roda na Edge Function do webhook e trabalha **por ticket**: cada chamado é um ticket; ao encerrar, finaliza. Estados alinhados a [db.md](db.md): `triagem` → `na_fila` → `em_atendimento` → `finalizado`.

## Placeholders das mensagens

Textos configuráveis em `bot_mensagens` (admin). Variáveis preenchidas na hora: `{empresa}`, `{contato}`, `{protocolo}`, `{departamento}`, `{atendente}`, `{horario}`. O **menu de departamentos é gerado automaticamente** dos departamentos ativos (não é texto fixo).

## Fluxo de entrada (mensagem do cliente chega)

```
mensagem recebida (webhook)
      │
      ├─ contato tem ticket em TRIAGEM? (bot esperando escolha do menu)
      │     └─ interpreta a mensagem:
      │           ├─ opção válida  → define departamento, entra na fila, envia entrou_fila
      │           ├─ #inicio       → remostra o menu principal (voltar_menu)
      │           └─ inválida      → tentativas_menu++ ; envia opcao_invalida + menu
      │                 └─ se tentativas_menu > max_tentativas_menu (padrão 2)
      │                       → encaminha ao DEPARTAMENTO PADRÃO (encaminhado_padrao), entra na fila
      │
      ├─ contato tem ticket FINALIZADO há menos de janela_reabertura_horas (3h)?
      │     ├─ avaliação pendente (avaliacao_solicitada_em, sem nota, dentro de tempo_avaliacao_min)?
      │     │     ├─ mensagem é nota 0-10 → grava avaliacao + agradecimento_avaliacao
      │     │     └─ senão               → avaliacao_invalida
      │     └─ senão → REABRE: status na_fila, zera responsavel_id, mantém departamento (sem menu)
      │
      ├─ contato tem ticket ATIVO (na_fila / em_atendimento)?
      │     ├─ #sair → finaliza (encerrado_por = 'cliente') ; se avaliacao_ativa, pede nota
      │     └─ senão → grava a mensagem no ticket (direcao entrada)
      │
      └─ senão → decide pelo horário e cria/roteia:
            ├─ dentro do HORÁRIO COMERCIAL
            │     → cria ticket (triagem), envia bem_vindo + instrucao_menu + menu
            ├─ fora do comercial, mas em PLANTÃO com atendente vinculado ativo
            │     → cria ticket (triagem, plantao_id do turno), envia plantao + menu
            │        (ao escolher, vai para a FILA DE PLANTÃO — visível aos plantonistas)
            └─ fora do comercial e sem plantonista na plataforma
                  → envia fora_horario (texto livre c/ contatos de emergência)
                     e NÃO cria ticket (só direciona)
```

## Ciclo de vida do ticket (status)

```
triagem            bot enviou menu, esperando escolha (dep. nulo; não aparece em fila de trabalho)
   │  escolhe departamento (ou cai no padrão após 2 tentativas)
   ▼
na_fila            na fila do departamento (comercial) ou do plantão (plantao_id)
   │  atendente clica "Assumir"  — OU responde direto (responder já assume)
   ▼
em_atendimento     tem dono (responsavel_id)
   │  atendente clica "Finalizar" (pede motivo) — ou cliente digita #sair
   ▼
finalizado         se avaliacao_ativa: bot pede nota 0-10 (janela tempo_avaliacao_min)
   │  cliente responde em < 3h (janela de reabertura)
   ▼
(reabre → na_fila, mesmo departamento, sem menu)
```

**Transferência** (a qualquer momento em `na_fila`/`em_atendimento`): para departamento (volta a `na_fila`, zera responsável) ou para atendente (seta responsável, `em_atendimento`). Registro em `atendimento_transferencias`.

## Regras confirmadas

- **Assumir:** fila compartilhada; clicar "Assumir" vira dono. **Responder já assume** se ninguém pegou. (ADR-05)
- **Menu automático** dos departamentos ativos. (ADR-06)
- **Janela de reabertura 3h:** dentro da janela reaproveita o ticket (volta pra fila do departamento, sem menu); passada, ticket novo. (ADR-07)
- **Fallback de triagem:** 2 tentativas inválidas → encaminha ao departamento padrão. (ADR-08)
- **Plantão (revisto 2026-07-25):** deixou de ser turno global e passou a ser **janela de acesso por usuário** (`atendimento_usuario_horarios`, editada no card do atendente). Fora do comercial, quem tem uma janela cobrindo aquele horário é o plantonista e atende pela plataforma; sem ninguém de plantão, o bot só direciona (mensagem `fora_horario` com contatos de emergência), sem criar ticket. A trava vale também para acesso humano ao app: `pode_atender_agora()` na RLS + aviso no login. (ADR-09; tabelas `atendimento_plantoes`/`atendimento_plantao_usuarios` ficaram sem uso.)
- **Encerramento pelo cliente:** `#sair` finaliza (registra `encerrado_por = 'cliente'`).
- **Avaliação (opcional, `avaliacao_ativa`):** ao finalizar, bot pede nota 0-10 dentro de `tempo_avaliacao_min` (60).
- **Nome do atendente:** se `enviar_nome_atendente`, respostas humanas saem prefixadas com `{atendente}`.

## Textos default do bot (`bot_mensagens`, editáveis no admin)

| Chave | Texto default |
|---|---|
| `bem_vindo` | "Olá! Aqui é o atendimento da {empresa}. É um prazer falar com você." |
| `instrucao_menu` | "Pra falar com o time certo, responda com o número da opção:" |
| `opcao_invalida` | "Não achei essa opção. Responda com o número de uma das opções abaixo:" |
| `voltar_menu` | "Digite #inicio pra voltar ao menu principal." |
| `entrou_fila` | "Pronto, você está na fila de {departamento}. Protocolo {protocolo}. Assim que um atendente ficar livre, ele te responde por aqui. Pra encerrar antes, digite #sair." |
| `encaminhado_padrao` | "Sem problema. Vou te encaminhar pro {departamento} e um atendente continua com você a partir daqui." |
| `plantao` | "Nosso horário comercial já encerrou, mas tem plantão agora e a gente te atende. Responda com o número da opção:" |
| `fora_horario` | "Estamos fora do horário de atendimento comercial. Funcionamos {horario}. Pra emergência, chame no WhatsApp: (o admin edita com os contatos e links)." |
| `encerramento` | "Atendimento encerrado. Valeu pelo contato com a {empresa}. Se precisar, é só mandar outra mensagem." |
| `solicitar_avaliacao` | "De 0 a 10, que nota você dá pra este atendimento?" |
| `agradecimento_avaliacao` | "Obrigado! Seu retorno ajuda a gente a melhorar." |
| `avaliacao_invalida` | "Seu atendimento está sendo encerrado. Pra avaliar, envie um número de 0 a 10." |

## Configurações que afetam o bot (`atendimento_config`)

`janela_reabertura_horas` (3), `timezone` (America/Sao_Paulo), `departamento_padrao_id`, `max_tentativas_menu` (2), `enviar_nome_atendente` (true), `avaliacao_ativa` (true), `tempo_avaliacao_min` (60).

## Fora do escopo (pós-MVP)

Controle de acesso por horário (atendente só entra no comercial/plantão dele), palavras-chave, recado, controle de potenciais + timeouts, responder grupos, contatos de emergência estruturados, submenus (#voltar entre níveis).
