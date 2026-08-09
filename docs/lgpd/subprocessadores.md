# Subprocessadores — GR7 Atendimento

> Quem, além da GR7, guarda ou processa dado pessoal de quem pede suporte (LGPD, Art. 39 e 33). Escrito em 2026-08-09.

A GR7 Autocom é a **controladora**: decide o que coleta e para quê. Os dois serviços abaixo são **operadores**, que tratam o dado sob instrução dela.

## Supabase — banco, autenticação e Edge Functions

| | |
|---|---|
| **O que passa por lá** | Tudo: contatos, chamados, o corpo das mensagens, os hashes de sessão e de IP, a auditoria |
| **Projeto** | `ghweohedmmmkufqhxdzn` (o mesmo do Painel de Implantação) |
| **Região** | **A confirmar** no painel do Supabase. Se for fora do Brasil, é transferência internacional e vale o Art. 33 |
| **Como o acesso é limitado** | RLS em toda tabela nova; o role `anon` **sem nenhuma policy**; service role só em Edge Function e script server-side, nunca no frontend |

## Cloudinary — arquivos enviados na conversa

| | |
|---|---|
| **O que passa por lá** | Prints, fotos, documentos e áudios, com o conteúdo que o cliente resolveu mandar |
| **Região** | **A confirmar** na conta. Mesma ressalva do Art. 33 |
| **Como o acesso é limitado** | Upload da central usa preset aberto; o do **cliente** passa pela Edge Function assinada, porque preset aberto não pode ser embarcado num app que qualquer pessoa da internet abre |

### O que o Cloudinary tem de pior, e é preciso dizer

**A URL do arquivo é pública para quem a tiver.** Não há autenticação por requisição: quem obtiver o endereço vê o arquivo, mesmo sem login no Atendimento. Os endereços não são adivinháveis (o `public_id` é aleatório) e não são indexados, mas isso é obscuridade, não controle de acesso.

Consequência prática: o print que um cliente manda é tão protegido quanto o sigilo da URL. É por isso que o aviso pede para enviar **só o necessário** — uma tela de sistema costuma trazer dado de terceiro junto.

Trocar isso exigiria URL assinada com expiração, que o Cloudinary suporta e que este projeto **não usa hoje**. Fica registrado como melhoria conhecida, não como bug.

## O que a GR7 precisa ter no papel

Nenhuma das duas coisas abaixo é código, e nenhuma existe até onde este documento alcança:

1. **Contrato ou termo de tratamento** com cada operador, ou o aceite dos termos padrão deles arquivado.
2. **Cláusula de transferência internacional**, se a região for fora do Brasil.

## Como o titular fica sabendo

O aviso dentro do app ([`AvisoPrivacidade.tsx`](../../src/cliente/AvisoPrivacidade.tsx)) nomeia os dois. Até 2026-08-09 ele dizia apenas "serviços contratados", sem dizer quais, o que não permite ao titular saber para onde o dado dele vai.
