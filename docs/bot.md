# Bot e ciclo de vida do ticket — GR7 Atendimento

> **Status: aprovado (Seção 3 do design, 2026-07-23).** O bot roda na Edge Function do webhook e trabalha **por ticket**: cada chamado é um ticket; ao encerrar, finaliza. Estados alinhados a [db.md](db.md): `na_fila` → `em_atendimento` → `finalizado` (`triagem` só existe em tickets antigos, ver abaixo).
>
> **Implementado (2026-07-27, modo mock, deployado):** o `whatsapp-webhook` já roda o fluxo — boas-vindas + menu, **identificação do potencial antes do menu com auto-vínculo por CNPJ**, fila, opção inválida (limite → padrão), `#sair`, **avaliação ao finalizar** (Fase 2), e **decisão por horário/plantão + reabertura em 3h** (lógica pura em `_shared/bot/horario.ts`). Como não há uazapi, o envio é mock (mensagens gravadas, não saem no WhatsApp).
>
> **Chamado adiado até o setor (2026-08-10), mesma regra do canal web (ADR-11):** o ticket deixou de nascer na primeira mensagem. Enquanto o cliente ainda está identificando-se ou escolhendo o setor, não existe `atendimentos` — o sub-estado fica em `contatos.etapa_bot_pendente` (`identificacao` | `menu`) e `contatos.tentativas_menu_pendente`. O ticket só nasce **direto em `na_fila`**, já com o setor definido, quando o cliente confirma a escolha (ou cai no departamento padrão após as tentativas). Quem some no meio da triagem não deixa chamado nem protocolo gasto, e o histórico do atendente começa na mensagem que confirma o setor, não na navegação do menu (essas mensagens são enviadas de verdade pelo WhatsApp, mas não ficam gravadas em `atendimento_mensagens`). Status `triagem` e `atendimentos.etapa_bot` continuam existindo só para tickets abertos antes desta mudança — nenhum ticket novo passa por eles.

## Placeholders das mensagens

Textos configuráveis em `bot_mensagens` (admin). Variáveis preenchidas na hora (padrão único do projeto, **chave dupla em português**): `{{empresa}}`, `{{contato}}`, `{{protocolo}}`, `{{departamento}}`, `{{atendente}}`, `{{horario}}`. O mesmo conjunto vale para as mensagens rápidas do atendente (`src/lib/variaveis.ts`). O **menu de departamentos é gerado automaticamente** dos departamentos ativos (não é texto fixo).

## Fluxo de entrada (mensagem do cliente chega)

```
mensagem recebida (webhook)
      │
      ├─ contato tem ticket ATIVO ou em TRIAGEM (tickets antigos)? → ver "compatibilidade" abaixo
      │
      ├─ contato tem ticket FINALIZADO há menos de janela_reabertura_horas (3h)?
      │     ├─ avaliação pendente (avaliacao_solicitada_em, sem nota, dentro de tempo_avaliacao_min)?
      │     │     ├─ mensagem é nota 0-10 → grava avaliacao + agradecimento_avaliacao
      │     │     └─ senão               → avaliacao_invalida
      │     └─ senão → REABRE: status na_fila, zera responsavel_id, mantém departamento (sem menu)
      │
      ├─ contato está em TRIAGEM PRÉ-CHAMADO? (contatos.etapa_bot_pendente preenchido; ainda não existe ticket)
      │     └─ interpreta a mensagem conforme a etapa:
      │           ├─ etapa identificacao → tenta casar CNPJ, avança para etapa menu, envia [identificacao_vinculada?] + menu
      │           ├─ etapa menu, opção válida → NASCE O TICKET direto em na_fila com o setor, envia entrou_fila
      │           └─ etapa menu, inválida      → tentativas_menu_pendente++ ; envia opcao_invalida + menu
      │                 └─ se tentativas_menu_pendente > max_tentativas_menu (padrão 2)
      │                       → NASCE O TICKET no DEPARTAMENTO PADRÃO (encaminhado_padrao), direto em na_fila
      │           (#sair a qualquer momento desta fase: limpa a pendência, envia encerramento, não cria ticket)
      │
      └─ senão → decide pelo horário:
            ├─ dentro do HORÁRIO COMERCIAL
            │     → marca etapa_bot_pendente (identificacao ou menu), envia bem_vindo + instrucao_menu + menu
            ├─ fora do comercial, mas em PLANTÃO com atendente vinculado ativo
            │     → marca etapa_bot_pendente, envia plantao + menu
            │        (ao escolher, o ticket nasce já com plantao_id do turno — visível aos plantonistas)
            └─ fora do comercial e sem plantonista na plataforma
                  → envia fora_horario (texto livre c/ contatos de emergência)
                     e NÃO marca pendência nem cria ticket (só direciona)
```

**Nenhuma mensagem da triagem pré-chamado é gravada em `atendimento_mensagens`** (nem a do cliente, nem a do bot) — são enviadas de verdade pelo WhatsApp, mas o histórico do atendente só começa quando o ticket nasce. O texto que confirma o setor (`entrou_fila`) já vem gravado como a primeira mensagem do ticket.

**Compatibilidade com tickets antigos:** um contato com ticket em `status = 'triagem'` (aberto antes de 2026-08-10) continua resolvido pelo fluxo antigo — interpreta a escolha do setor, `#inicio`, tentativas inválidas — até sair da triagem. Nenhum ticket novo nasce mais nesse status.

## Ciclo de vida do ticket (status)

```
(sem ticket)       bot navegando a triagem (identificação, menu) — estado fica no CONTATO, não no ticket
   │  escolhe departamento (ou cai no padrão após 2 tentativas)
   ▼
na_fila            nasce aqui, direto, já com o setor — na fila do departamento (comercial) ou do plantão (plantao_id)
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
- **Janela de reabertura 3h:** só reabre quando o atendimento foi **finalizado pelo atendente e a nota ficou pendente** (`avaliacao_solicitada_em` preenchido, `avaliacao` nula). Nesse caso, uma nova mensagem em até 3h reaproveita o mesmo ticket (volta pra fila do departamento, sem menu). Nota dada, `#sair` ou avaliação desligada = atendimento concluído → ticket novo, independente da hora. Entre 0 e `tempo_avaliacao_min` a mensagem ainda é lida como nota; desse limite até 3h, reabre. (ADR-07)
- **Fallback de triagem:** 2 tentativas inválidas → o ticket nasce direto no departamento padrão (`encaminhado_padrao`), sem passar pelo atendente. (ADR-08)
- **Plantão (revisto 2026-07-25):** deixou de ser turno global e passou a ser **janela de acesso por usuário** (`atendimento_usuario_horarios`, editada no card do atendente). Fora do comercial, quem tem uma janela cobrindo aquele horário é o plantonista e atende pela plataforma; sem ninguém de plantão, o bot só direciona (mensagem `fora_horario` com contatos de emergência), sem criar ticket. A trava vale também para acesso humano ao app: `pode_atender_agora()` na RLS + aviso no login. (ADR-09; tabelas `atendimento_plantoes`/`atendimento_plantao_usuarios` ficaram sem uso.)
- **Encerramento pelo cliente:** `#sair` finaliza (registra `encerrado_por = 'cliente'`).
- **Avaliação (opcional, `avaliacao_ativa`):** ao finalizar, bot pede nota 0-10 dentro de `tempo_avaliacao_min` (60).
- **Nome do atendente:** se `enviar_nome_atendente`, respostas humanas saem prefixadas com `{{atendente}}`.

## Textos default do bot (`bot_mensagens`, editáveis no admin)

| Chave | Texto default |
|---|---|
| `bem_vindo` | "Olá! Aqui é o atendimento da {{empresa}}. É um prazer falar com você." |
| `instrucao_menu` | "Pra falar com o time certo, responda com o número da opção:" |
| `opcao_invalida` | "Não achei essa opção. Responda com o número de uma das opções abaixo:" |
| `voltar_menu` | "Digite #inicio pra voltar ao menu principal." |
| `entrou_fila` | "Pronto, você está na fila de {{departamento}}. Protocolo {{protocolo}}. Assim que um atendente ficar livre, ele te responde por aqui. Pra encerrar antes, digite #sair." |
| `encaminhado_padrao` | "Sem problema. Vou te encaminhar pro {{departamento}} e um atendente continua com você a partir daqui." |
| `plantao` | "Nosso horário comercial já encerrou, mas tem plantão agora e a gente te atende. Responda com o número da opção:" |
| `fora_horario` | "Estamos fora do horário de atendimento comercial. Funcionamos {{horario}}. Pra emergência, chame no WhatsApp: (o admin edita com os contatos e links)." |
| `encerramento` | "Atendimento encerrado. Valeu pelo contato com a {{empresa}}. Se precisar, é só mandar outra mensagem." |
| `solicitar_avaliacao` | "De 0 a 10, que nota você dá pra este atendimento?" |
| `agradecimento_avaliacao` | "Obrigado! Seu retorno ajuda a gente a melhorar." |
| `avaliacao_invalida` | "Seu atendimento está sendo encerrado. Pra avaliar, envie um número de 0 a 10." |

## Configurações que afetam o bot (`atendimento_config`)

`janela_reabertura_horas` (3), `timezone` (America/Sao_Paulo), `departamento_padrao_id`, `max_tentativas_menu` (2), `enviar_nome_atendente` (true), `avaliacao_ativa` (true), `tempo_avaliacao_min` (60), `nome_bot`, `controle_potenciais` (`nunca`/`novos_contatos`/`sem_atendimento`), `solicitar_motivo_finalizar` (true), `permitir_cliente_finalizar` (true).

As quatro últimas foram adicionadas na tela Configurações BOT (2026-07-27), gravadas em `atendimento_config` sem migration. Ficam armazenadas e passam a valer quando o bot/uazapi rodar.

## Fora do escopo (pós-MVP)

Palavras-chave, recado, timeouts do Zintech (prazo para virar potencial/recado), responder grupos, contatos de emergência estruturados, submenus (#voltar entre níveis). O **controle de potenciais** já é **configurável** na tela Configurações BOT (armazenado; a regra de roteamento roda quando o bot entrar). (O **controle de acesso por horário** saiu do pós-MVP: já implementado em 2026-07-25, ver ADR-09.)
