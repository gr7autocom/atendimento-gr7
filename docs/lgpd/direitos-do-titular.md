# Direitos do titular — como atender cada pedido

> O que fazer quando alguém escreve pedindo os dados dele (LGPD, Art. 18). Escrito em 2026-08-09.
>
> O canal divulgado ao titular é **suporte@gr7autocom.com.br**, dito no aviso dentro do app. Prazo de resposta: a lei pede **imediato** para confirmação de existência e **15 dias** para a declaração completa (Art. 19).

## Situação de cada direito, sem enfeite

| Direito (Art. 18) | Existe hoje? | Como se faz |
|---|---|---|
| **Confirmação e acesso** (I e II) | Manual | Consulta ao banco por telefone. Não há tela nem exportação |
| **Correção** (III) | Sim, na tela | Painel do contato: nome e cargo são editáveis pelo atendente |
| **Anonimização ou eliminação** (IV e VI) | **Sim, na tela** | Ver abaixo |
| **Portabilidade** (V) | Não existe | Exigiria exportar em formato estruturado. Nunca foi pedido; construir quando for |
| **Informação sobre compartilhamento** (VII) | Sim, escrito | [subprocessadores.md](subprocessadores.md), e o aviso nomeia os dois |
| **Revogação do consentimento** (IX) | Parcial | Encerrar o acesso do cliente derruba a sessão dele (menu ⋮ da conversa). Revogar o consentimento do tratamento inteiro é a eliminação |

## Eliminação: o caminho que existe

**Quem faz:** admin, no rodapé do painel do contato, com o chamado da pessoa aberto. O atendente comum não vê a ação.

**O que acontece, na ordem:**

1. Os arquivos do titular são apagados no **Cloudinary**
2. As mensagens e os anexos saem do banco, junto com as sessões web do aparelho dele
3. O contato é anonimizado: nome e nome de WhatsApp viram nulos, e o telefone vira `anonimizado:<uuid>`, porque a coluna é obrigatória e única
4. O chamado **fica**: protocolo, datas, setor, motivo e nota
5. A operação é registrada em `atendimento_lgpd_eliminacoes`

**Por que os arquivos primeiro.** `atendimento_anexos` cai em cascata com a mensagem, levando o `public_id` — a única chave capaz de apagar o arquivo no provedor. Na ordem inversa, o arquivo ficaria no Cloudinary para sempre e sem nenhuma referência no sistema apontando para ele. Isso não é teoria: aconteceu na primeira execução real, em 2026-08-08, quando um erro de chave estrangeira abortou o passo do banco. O rollback desfez o banco, os arquivos já tinham saído, e repetir a operação terminou o serviço. É o lado certo de falhar.

**Se algum arquivo não sair**, a tela diz quais e que dá para repetir. Eliminação parcial anunciada como completa é pior que falha declarada.

**O que registrar no campo "onde o pedido está registrado":** o e-mail, o protocolo ou a ata. É o que liga a operação ao pedido do titular numa fiscalização. A auditoria **não guarda nome nem telefone** de propósito: registrar quem foi esquecido, dentro do registro do esquecimento, desfaria a eliminação.

## O que fazer antes de eliminar

1. **Confirme que quem pede é o titular.** O e-mail de onde vem o pedido não prova identidade. No mínimo, confirme por um canal já conhecido (o telefone do contato).
2. **Explique o que fica.** O chamado permanece pelos cinco anos do CDC. O titular tem direito de saber que a exclusão não é total, e por quê.
3. **Confira de quem é.** A tela pede o telefone digitado justamente porque o painel troca de conteúdo conforme a conversa aberta.

## Depois de eliminar

O nome do contato passa a aparecer como "Titular anonimizado" na lista e na conversa, e os campos de nome e cargo ficam **travados** — editar ali gravaria direto em `contatos.nome` e reintroduziria o dado que a pessoa pediu para apagar.

Responda ao titular dizendo o que saiu e o que permanece, com o motivo legal.

## Encarregado de dados (Art. 41)

**Não indicado** — a definir pela GR7 Autocom.

A lei pede uma pessoa identificada, com identidade e contato divulgados publicamente. Hoje o aviso dá o e-mail de suporte, o que garante o **canal** mas não cumpre a indicação. Ao definir, preencher aqui e no [`AvisoPrivacidade.tsx`](../../src/cliente/AvisoPrivacidade.tsx).
