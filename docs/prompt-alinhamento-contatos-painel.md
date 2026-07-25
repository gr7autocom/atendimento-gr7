# Alinhamento: aba "Contatos" do painel usa a tabela `contatos`

> Escrito em 2026-07-25, do lado do `painel-implantacao-v2`, para alinhar o Atendimento.
> Cole o bloco abaixo numa sessão do Claude Code **dentro do projeto `atendimento-gr7`**,
> ou apenas leia: o conteúdo já está refletido em [db.md](db.md).

---

Contexto: o projeto irmão painel-implantacao-v2 implementou hoje (2026-07-25) a aba
"Contatos" no cadastro de cliente. Isso muda o que você pode assumir sobre a tabela
`contatos`. Leia antes de mexer em qualquer coisa ligada a contato ou vínculo de empresa.

## A decisão principal

A tabela `cliente_contatos` descrita em docs/prompt-painel-aba-contatos.md NÃO foi criada.
O painel lê e grava direto em `contatos`, filtrando por `cliente_id`. Motivo: `contatos.cliente_id`
já é o vínculo que o atendente cria em "Vincular empresa", então duas listas exigiriam
sincronização por trigger, com conflito garantido no telefone único, e o contato cadastrado
no painel não seria reconhecido no match da primeira mensagem. Aquele arquivo já está
marcado como RESOLVIDO no topo, e docs/db.md já foi atualizado. Não precisa reescrever
essas duas docs, só não contradiga elas.

## O que mudou no banco (migration 20260725190000, já aplicada no remoto)

1. `contatos` ganhou a coluna `cargo TEXT` (opcional, ex: FINANCEIRO).
2. As policies de INSERT e UPDATE de `contatos` passaram de
   `can('atendimento.responder')` para `can('atendimento.responder') OR can('cliente.editar')`.
   Ninguém perdeu acesso, só foi somado quem edita cliente no painel.
3. Índice novo em `contatos(cliente_id)`.
4. Continua sem policy de DELETE em `contatos`.

## Como o painel se comporta com essa tabela

- Lista os contatos de uma empresa por `cliente_id` e permite criar e editar nome,
  telefone e cargo.
- Telefone sempre normalizado em E.164 (`+5511912345678`) antes de gravar. Exibe como
  `(11) 91234-5678`. Nome e cargo salvam em maiúsculas, padrão dos cadastros do painel.
- Telefone que já existe sem empresa: o painel vincula à empresa atual (UPDATE), em vez
  de tentar INSERT e esbarrar na unicidade.
- Telefone que já pertence a outra empresa: o painel recusa e mostra o nome da outra
  empresa, sem roubar o vínculo.
- Remover contato no painel é `cliente_id = NULL`, nunca DELETE, porque
  `atendimentos.contato_id` é FK ON DELETE CASCADE e apagar levaria o histórico junto.
  Mantenha essa mesma regra do lado do atendimento.
- O painel não toca em `nome_whatsapp`. Continua sendo campo só do WhatsApp.

## O que eu quero que você verifique aí no atendimento

1. Se a tela de contato do atendimento exibe ou edita os campos do contato, avalie
   incluir `cargo` (opcional). É informação que o painel passa a preencher e que ajuda
   o atendente a saber com quem está falando.
2. Confirme que nenhum fluxo do atendimento faz DELETE em `contatos`. Se fizer, troque
   por desvincular (`cliente_id = NULL`) pelo motivo do CASCADE acima.
3. Confirme que todo lugar que grava telefone continua normalizando em E.164, já que
   agora existem duas origens de escrita na mesma tabela.
4. Se você tem tela ou modal de "Vincular empresa", vale deixar claro para o atendente
   que o vínculo aparece no cadastro do cliente no painel. É o mesmo dado, não uma cópia.
5. Registre no CHANGELOG do atendimento se fizer sentido pelo padrão de vocês.

Não precisa criar migration nova para nada disso. A do painel já cobriu o banco.
