# Canal web (PWA do cliente)

Referência do segundo canal de atendimento, como [whatsapp.md](whatsapp.md) é do primeiro. Decisão e trade-offs em [decisoes.md](decisoes.md) (ADR-11).

> **Estado (2026-08-07):** o canal **funciona ponta a ponta**, com o cliente conversando pelo site e o atendente respondendo na central. Falta transformá-lo em **aplicativo instalável** (manifest, service worker, `vercel.json`) e o endurecimento da Fase 6. As fases estão em [PROGRESSO.md](../PROGRESSO.md).

## O que é

Um site instalável na área de trabalho do cliente, para ele pedir suporte sem depender do celular. O comportamento de atendimento é o mesmo do WhatsApp: chamado, fila, setor, protocolo, avaliação. O que muda é o transporte e a forma de identificar quem está falando.

**Do lado do atendente não existe canal novo.** É a mesma inbox, o mesmo chamado, a mesma conversa, com um selo indicando de onde veio.

## As duas assimetrias que explicam o resto

1. **WhatsApp é push, web é pull.** No WhatsApp o provedor empurra a mensagem por webhook e a resposta precisa ser despachada de volta. No web, o cliente pergunta pelo que há de novo. Por isso o canal web **não tem driver**: a entrega é o próprio banco, lido pela Edge Function. É também por isso que ele funciona sem a uazapi contratada.
2. **No WhatsApp o número identifica; no web nada identifica.** O WhatsApp garante que a mensagem veio daquele número. No web, o telefone é digitado e não é verificado. Daí o token por dispositivo e o aviso de identificação auto-declarada na central.

**Não generalizar `WhatsAppDriver` em `CanalDriver`.** O web não tem envio, status de conexão, QR nem webhook. Dois caminhos separados, resolvidos com um `switch` no ponto de despacho.

## Identificação

O cliente informa **nome e telefone**, com **CNPJ opcional**. Não há conta, senha nem login.

**O formulário pede só isso.** O setor e o relato acontecem **na conversa** (decisão de 2026-08-07, revendo o formulário único): o bot dá as boas-vindas, pergunta o assunto com os setores em **botões**, e só então pede o relato. Botão e não menu numerado porque aqui é tela: no WhatsApp o cliente digita o número porque o canal só aceita texto.

**Nada é gravado até a primeira mensagem.** Contato, chamado, protocolo e token nascem juntos, quando o cliente descreve o problema. Quem desiste no meio da escolha do setor não deixa contato órfão, chamado vazio nem protocolo gasto. A conversa que ele viu até ali é gravada junto, na mesma ordem, senão o atendente abriria um chamado que começa no meio.

| Situação | Resultado |
|---|---|
| Telefone já em `contatos`, com empresa | Fila, já vinculado |
| Telefone novo, CNPJ informado e encontrado | Vincula a empresa e vai para a fila |
| Telefone novo, sem CNPJ ou CNPJ que não casa | **Potenciais**, para o atendente vincular |

Regras invioláveis:

- Telefone que **já pertence a uma empresa manda**, mesmo que o CNPJ digitado diga outra coisa. Ninguém rouba vínculo pelo PWA
- Contato existente **nunca** tem nome, cargo ou empresa sobrescritos. Só o que está vazio é preenchido
- O telefone é normalizado em E.164 por `_shared/telefone.ts`, o **mesmo** módulo do WhatsApp. Sem isso, `(16) 99123-4567` e `+5516991234567` viram dois contatos e a unificação do histórico evapora

O contato é compartilhado entre os canais **de propósito**: quem fala pelos dois é uma pessoa só, com um histórico só.

## Sessão: token por dispositivo

O CNPJ é dado público. Se fosse a chave de acesso, qualquer pessoa que o digitasse leria a conversa em andamento da empresa, que num atendimento de suporte pode conter senha de servidor, IP e configuração de sistema.

**Regra estrutural: o CNPJ dá direito a abrir conversa nova, nunca a ler conversa existente.** Não existe rota que receba CNPJ e devolva conversa. Toda leitura parte do token.

- Token de **32 bytes aleatórios** em base64url, guardado no `localStorage`
- No banco, só o **SHA-256** dele, mais um prefixo de 8 caracteres em claro para suporte e log
- **Escopo é o atendimento, não o contato.** Se fosse o contato, o cliente veria o histórico do WhatsApp, exatamente o que o escopo "só a conversa atual" evita
- Expiração tripla: absoluta (12h), por inatividade (2h, mata token esquecido em máquina compartilhada) e ligada ao ciclo do chamado
- **Finalizar não revoga na hora.** A sessão vale até `finalizado_em + janela_reabertura_horas`, senão avaliação e reabertura morrem junto
- Revogação manual pelo menu da conversa, na central. O cenário é concreto: quem abriu o chamado sai da empresa. Entregue no menu ⋮ da conversa (desktop e mobile), com confirmação. A RPC exige atendente logado desde a migration `20260806120100` — até ela, um visitante sem login revogava chamado da fila livre (ver [db.md](db.md), "REVOKE ... FROM PUBLIC não fecha função")
- **Presença do cliente** na central sai da RPC `atendimento_web_presenca` (migration `20260806120000`): último uso e quantos acessos vivos, nunca token nem IP

**Consequência que não pode ficar escondida:** limpar dados do navegador, trocar de máquina ou usar aba anônima faz o cliente perder a conversa em andamento e abrir outra. Não há solução dentro de "sem login", então o aviso é explícito na tela de identificação.

## Porta única: a Edge Function

O PWA **nunca** fala com o PostgREST. Tudo passa por `supabase/functions/atendimento-web/`, com service role, no padrão do `whatsapp-webhook`, e deployada com `--no-verify-jwt`.

A razão é direta: a RLS inteira é construída sobre `usuarios` internos e **não existe uma única policy para o role `anon`**. Criar acesso anônimo num banco compartilhado com o painel em produção seria a mudança de maior risco do projeto. Com a função como porta única, esse risco não existe.

### Rotas

Roteadas por path, não por campo `acao` no corpo, porque o log do Supabase separa por rota.

Todas são **POST**, com JSON, e as autenticadas levam o token no header `x-sessao`. Corpo acima de 8 KB é recusado pelo tamanho **lido de fato**, não pelo `content-length`, que o cliente informa.

| Rota | Entrada | Devolve |
|---|---|---|
| `/disponibilidade` | — | `pode_abrir`, `plantao`, `mensagem_fora_horario`, `departamentos[]` |
| `/identificar` | `nome`, `telefone`, `cnpj?`, `departamento_id`, `mensagem`, `aceite` | `token`, `expira_em`, `protocolo`, `departamento`, `empresa` |
| `/conversa` | (token) | `protocolo`, `status`, `encerrado`, `departamento`, `atendente`, `aguardando_avaliacao`, `mensagens[]` |
| `/mensagem` | `mensagem`, `client_msg_id` | `ok` |
| `/encerrar` | (token) | `ok` |
| `/avaliar` | `nota` 0-10 | `ok` |

O `aceite` é obrigatório e grava `aceite_em` na sessão: é o registro do consentimento exigido pela LGPD.

### Variáveis de ambiente

- **`IP_HASH_SALT`** — sal do hash de IP. Sem ele o hash seria reversível por tabela pronta, já que o espaço de IPv4 inteiro cabe numa varredura de segundos. Configurado em 2026-08-06
- **`PWA_ORIGENS`** — origens liberadas no CORS, separadas por vírgula. **Configurada em 2026-08-07** com `https://suporte.gr7autocom.com.br` e `http://localhost:5173` (este para desenvolvimento; tirar quando o PWA estiver publicado). Enquanto esteve vazia, a função respondia sem `Allow-Origin` e navegador nenhum a alcançava, que é o padrão seguro. Ela não substitui autenticação: CORS é regra de navegador, e `curl` a ignora — quem protege as rotas é o token de sessão e o rate limit

### Como as regras são mantidas

Comentário no topo do arquivo não segura nada sozinho: depende de alguém abrir o arquivo. O projeto já aprendeu isso quando o `design.md` descrevia padrões que 24 problemas ignoraram, e a resposta foi a guarda em teste. Aqui vale o mesmo, com mais em jogo — esta função é pública, sem login e roda com service role.

**`atendimento-web/padroes-canal-web.test.ts`** roda no `npm test` e falha se alguém:

- ler identificador de registro do corpo da requisição (`corpo.atendimento_id` e afins)
- localizar sessão por outra coisa que não `token_hash`
- usar `select('*')` em qualquer consulta
- pôr campo interno no `SELECT_MENSAGEM` ou em qualquer select
- apagar o bloco de regras do topo do arquivo

As três primeiras foram conferidas introduzindo a violação de propósito: a guarda barrou cada uma.

**`npm run verificar:canal-web`** é o teste de fumaça contra o ambiente real, que o `npm test` não cobre porque precisa de rede, credencial e banco. Prova que as peças conversam: função deployada, constraints do banco e o caminho que o atendente usa na central. Cria dados de teste e apaga no fim. Rode antes de publicar mudança na função ou nas migrations do canal.

### Duas regras que a função nunca pode quebrar

Vão em comentário no topo do arquivo, porque são o tipo de coisa que se perde numa manutenção distraída.

1. **Nenhuma ação aceita id de linha vindo do cliente.** O `atendimento_id` sempre sai do lookup da sessão. No dia em que alguém aceitar um `atendimento_id` no corpo "para facilitar", está aberto
2. **Nunca devolver**: eventos do chamado (são internos: "Fulano assumiu"), `remetente_usuario_id`, `wa_message_id`, tags, motivo, ids de contato ou de cliente. Do atendente, só o primeiro nome

Erros sempre tipados e genéricos (`cnpj_nao_encontrado`, `fora_horario`, `limite`, `sessao_invalida`), nunca stack no corpo da resposta.

CORS em `_shared/cors-web.ts` com allowlist por env. **Não alterar o `cors.ts` existente**, que é `*` de propósito porque webhook não tem origem.

### Rate limit é a única barreira que sobra

Aceitando potencial e sem CNPJ obrigatório, o formulário é uma porta aberta na internet. No WhatsApp existe o atrito de ter um número; aqui não existe atrito nenhum.

- Limite por IP e por telefone na identificação
- Teto geral de chamados potenciais por hora, para o pior caso não derrubar a operação
- Limite de mensagens por sessão e piso de intervalo no polling
- Quando o CNPJ vier, validar o dígito verificador **antes** de consultar o banco
- Guardar **hash do IP**, nunca o IP em claro
- Contador em tabela, nunca em memória da função, que é efêmera e multi-instância

## O que do bot roda no web

Sem menu numerado, mas as regras de negócio não são do WhatsApp e se reaproveitam inteiras de `_shared/bot/horario.ts`.

| Peça | No web |
|---|---|
| Boas-vindas | Roda, mesmo texto `bem_vindo` de `bot_mensagens`, compartilhado entre os canais |
| Escolha de setor | **Botões dentro da conversa**, não menu numerado. Antes da escolha nada foi ao servidor |
| Protocolo e ticket | Idêntico, mesma numeração |
| Fila e roteamento | Idêntico |
| Fora de horário e plantão | Idêntico: abre com plantonista de janela ativa, não abre sem |
| Reabertura em 3h | Vale, mas **explícita** na tela, não silenciosa, e só com a sessão viva |
| Avaliação | O gatilho já dispara. A resposta vira **seletor de 0 a 10** |
| `#sair` | Vira botão "Encerrar atendimento" com confirmação |
| Identificação por CNPJ digitado | Não roda, o formulário resolve |

O chamado web **nasce em `na_fila`** com setor preenchido e nunca passa por `triagem`. Dois efeitos saem de graça: o gatilho de eventos grava a abertura já no INSERT, e o chamado aparece para todos os atendentes pela regra da fila livre.

Não reusar: `montarMenu`, `interpretarEscolha`, `tentativas_menu`, `etapa_bot`.

## Textos do canal, editáveis pelo admin

Três mensagens são **deste canal** e vivem em `bot_mensagens` com prefixo `web_` (migration `20260807120000`), editáveis na aba **Canal web** de Configurações do bot:

| Chave | Quando aparece |
|---|---|
| `web_pergunta_setor` | Depois das boas-vindas, junto dos botões de setor |
| `web_pedir_relato` | Assim que o cliente escolhe o setor |
| `web_entrou_fila` | Quando o chamado nasce. Aceita `{{protocolo}}` e `{{departamento}}` |

Existem separadas porque as equivalentes do WhatsApp mandam **digitar o número do setor** (`instrucao_menu`) e **digitar `#sair`** (`entrou_fila`), instruções que na tela seriam falsas. É o mesmo tipo de erro que o painel do contato cometeu ao dizer "WhatsApp informou" num chamado do site.

O código guarda os textos originais como **reserva**: chave apagada ou salva em branco faz o bot falar a frase padrão, em vez de mandar bolha vazia ao cliente.

O `bem_vindo` **não** foi duplicado: a abertura é a mesma voz nos dois canais, e duas cópias seriam duas verdades para manter.

## Convivência dos dois canais

O mesmo cliente pode ter chamado aberto nos dois ao mesmo tempo. São **dois chamados independentes**, com protocolos diferentes, e nenhum aviso é dado.

Isso só funciona por causa de uma correção que **precisa vir antes do canal web existir**: o `whatsapp-webhook` procura o chamado do cliente por `contato_id` **sem olhar o canal**, em `acharTicketAberto`, `acharTicketReabertura` e `acharTicketAvaliacao`. Como o contato é compartilhado, uma mensagem de WhatsApp capturaria o chamado aberto no web e rodaria o menu do bot em cima dele. A correção é `.eq('canal','whatsapp')` nos três.

## Onde a conversa fica guardada

Em `atendimento_mensagens`, na mesma tabela das conversas de WhatsApp. O navegador do cliente guarda **só o token**, nenhum conteúdo.

Não existe alternativa: nem a API oficial da Meta nem as não-oficiais devolvem histórico de conversa. O WhatsApp entrega eventos em tempo real e nada mais, então qualquer plataforma de atendimento guarda cópia em banco próprio. A impressão de que o painel "espelha o WhatsApp" vem de duas sincronizações (mensagem enviada pelo celular chega por webhook; deleção também), não de o WhatsApp ser a fonte.

**Volume não preocupa nesta escala.** Uma mensagem de texto ocupa cerca de 0,5 KB com índices. 300 mil mensagens por mês, que seriam 10 mil chamados de 30 mensagens, dão 1,8 GB por ano contra os 8 GB do plano Pro. Mídia não entra no banco: `atendimento_anexos` guarda só a URL do Cloudinary.

**Retenção:** 5 anos após o encerramento do chamado, alinhado ao Código de Defesa do Consumidor e justificado como prova da relação de consumo. A rotina de limpeza só quando o banco passar de uns 4 GB ou no primeiro pedido de exclusão. O **direito de exclusão** da LGPD vai precisar de um caminho próprio, mais delicado, porque `atendimento_mensagens` não tem policy de DELETE nenhuma.

## O guard do despacho

Quando a uazapi entrar e a resposta do atendente passar a ser despachada, ela **não pode** ir para o WhatsApp se o chamado nasceu no web. Comentário não segura isso: o despacho será plugado no lugar mais fácil, que é o próprio `responder`.

A defesa vai no banco. `atendimento_mensagens` ganha `canal`, copiada do chamado por trigger, com `CHECK (canal <> 'web' OR wa_message_id IS NULL)`. Como `wa_message_id` é a evidência de "isto foi para o WhatsApp", gravar despacho de WhatsApp num chamado web passa a ser **impossível**, não desaconselhado. `_shared/canal.ts` guarda a regra em código, com teste que hoje é trivial e no futuro fica vermelho.

Idempotência do envio do cliente usa coluna própria, `client_msg_id`. Reusar `wa_message_id` seria contraditório com o CHECK acima.

## Onde o PWA mora

Segundo entry point no mesmo repositório: `cliente.html` mais `src/cliente/`, reusando `src/components/ui/` e `src/tema.css`. Endereço em subdomínio próprio: **`suporte.gr7autocom.com.br`** (decidido em 2026-08-07), separado do `atendimento.gr7autocom.com.br` da equipe. É esse o valor que entra em `PWA_ORIGENS`.

- Manifest referenciado **só** no `cliente.html`, então a central da equipe nunca fica instalável
- Service worker com escopo próprio, que por definição não intercepta as rotas da central. Escrito à mão, sem `vite-plugin-pwa`, que quer ser dono do build inteiro
- **Nunca cachear resposta da Edge Function.** Guardar conversa de cliente em disco é o oposto do que se quer. O cache cobre só a casca do app
- **Sem fila offline.** "Mandei e ninguém recebeu" é pior que "sem internet": estado offline explícito e envio bloqueado
- O PWA **não embarca** a chave do Supabase nem o `supabase-js`. Só `fetch`

O código vive em `src/`, então já nasce coberto pela guarda de [padroes-ui.test.ts](../src/padroes-ui.test.ts), que ganha duas regras: `src/cliente/` não importa o cliente Supabase nem o auth, e não usa `dangerouslySetInnerHTML` (com token em `localStorage`, XSS é o vetor real).

## O que fica de fora

Histórico para o cliente, acompanhamento de tarefas, push, anexos e notificação sonora.
