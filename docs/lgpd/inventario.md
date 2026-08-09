# Inventário de tratamentos — GR7 Atendimento

> Registro das atividades de tratamento de dados pessoais (LGPD, Art. 37). Escrito em 2026-08-09, a partir do schema e do código, não de memória.
>
> Quem tem acesso a quê está em [subprocessadores.md](subprocessadores.md); como atender um pedido do titular, em [direitos-do-titular.md](direitos-do-titular.md).

## Quem são os titulares

Pessoas físicas que **pedem suporte** em nome de uma empresa cliente da GR7 Autocom: quem digita no WhatsApp ou abre o app do site. O dado pessoal é o dessa pessoa, não o da empresa — CNPJ e razão social são dados de pessoa jurídica e ficam fora do escopo da lei.

Fora deste inventário: os **usuários internos** (equipe da GR7), cujo cadastro vive no Painel de Implantação e é tratado como relação de trabalho, não de consumo.

## Os tratamentos

Uma linha por finalidade real, com a tabela onde o dado mora. Ao acrescentar coleta, acrescente aqui na mesma tarefa.

| # | Finalidade | Dados | Base legal | Onde mora | Retenção |
|---|---|---|---|---|---|
| 1 | Atender o pedido de suporte pelo WhatsApp | Telefone, nome do perfil da conta, conteúdo das mensagens | Execução de contrato (Art. 7, V) — o suporte é parte do serviço contratado pela empresa | `contatos`, `atendimentos`, `atendimento_mensagens` | 5 anos após o encerramento |
| 2 | Atender o pedido de suporte pelo site | Nome e telefone digitados, CNPJ (opcional), conteúdo das mensagens | **Consentimento** (Art. 7, I), registrado no aceite do formulário, somado à execução de contrato | as mesmas, com `canal = 'web'` | 5 anos após o encerramento |
| 3 | Receber arquivo que descreve o problema | Prints, fotos, documentos e áudios enviados por qualquer dos lados | A mesma do atendimento em que o arquivo entrou | `atendimento_anexos` (metadado) + **Cloudinary** (o arquivo) | igual à mensagem |
| 4 | Manter a conversa do site aberta no aparelho do cliente | Hash SHA-256 do token de sessão, **hash** do IP, vínculo com contato e chamado | Legítimo interesse (Art. 7, IX) — sem sessão não há como devolver a conversa a quem a abriu | `atendimento_web_sessoes` | Até **7 dias** após a sessão morrer; limpeza automática às 3h |
| 5 | Barrar abuso do formulário público | `chave` (hash de IP ou telefone) e ação tentada | Legítimo interesse (Art. 7, IX) — segurança | `atendimento_web_tentativas` | Janela curta do rate limit |
| 6 | Provar o que foi enviado, quando alguém apaga ou edita | Corpo original da mensagem, quem apagou, quando | Legítimo interesse (Art. 7, IX) — auditoria interna do atendimento | colunas `excluida_*` e `corpo_original` de `atendimento_mensagens` | igual à mensagem |
| 7 | Provar que um pedido de eliminação foi atendido | Id do contato (já anonimizado), quem executou, contagens, referência do pedido | Cumprimento de obrigação legal (Art. 16, I) — é a prova do Art. 18 | `atendimento_lgpd_eliminacoes` | Indeterminada: **não guarda nome nem telefone**, então não identifica ninguém |

### Por que cinco anos, e por que não é escolha nossa

O prazo segue o **Código de Defesa do Consumidor**, e vale para os dois lados: o registro comprova o atendimento prestado numa reclamação ou processo, e é por isso que ele **não sai** quando o titular pede eliminação. O que sai é o que identifica a pessoa e o conteúdo do relato; o chamado fica, com protocolo, datas, setor, motivo e nota, sem dizer quem era.

Isso está dito ao titular no aviso dentro do app, com o motivo, e não em letra miúda.

## O que este produto NÃO trata

Vale registrar, porque a ausência é decisão e não esquecimento:

- **Nenhum dado sensível** (Art. 5, II). Não há campo de saúde, biometria, origem racial, convicção ou filiação. O relato é digitado pela pessoa e pode conter o que ela escrever, e é por isso que o aviso pede para enviar só o necessário.
- **Nenhuma decisão automatizada** sobre o titular (Art. 20). O bot roteia por setor; ele não avalia, classifica nem pontua pessoa.
- **Nenhum uso comercial nem compartilhamento** com terceiros para publicidade.
- **Nenhuma conta para o cliente.** Ele não tem login nem senha: no site alcança **uma conversa, a dele**, por token de dispositivo (ADR-11).
- **Nenhum cookie de rastreio ou analytics.** O app do cliente não carrega script de terceiro; a CSP e o service worker mantêm tudo no nosso endereço.

## O que ainda falta, com data

Escrito aqui para não voltar a ser invisível:

1. **Job de expiração dos cinco anos.** Não existe. O chamado mais antigo é de julho de 2026, então nada venceu ainda. **Gatilho:** construir antes de julho de 2031, ou junto da primeira eliminação em lote, o que vier primeiro. Enquanto não existir, o prazo é teto declarado e não rotina automática.
2. **Atender pedido de acesso e de portabilidade** é manual hoje, por consulta ao banco. Ver [direitos-do-titular.md](direitos-do-titular.md).
3. **Encarregado de dados não indicado** (Art. 41). É o que falta para o aviso poder nomear uma pessoa em vez de um e-mail de setor.
4. **Região dos subprocessadores a confirmar** — ver [subprocessadores.md](subprocessadores.md).
