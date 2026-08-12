# Subprocessadores — GR7 Atendimento

> Quem, além da GR7, guarda ou processa dado pessoal de quem pede suporte (LGPD, Art. 39 e 33). Escrito em 2026-08-09. Atualizado em 2026-08-11: os anexos migraram do Cloudinary para o Supabase Storage (ver [decisoes.md](../decisoes.md)), e o Cloudinary deixou de ser subprocessador deste projeto.

A GR7 Autocom é a **controladora**: decide o que coleta e para quê. O serviço abaixo é **operador**, que trata o dado sob instrução dela.

## Supabase — banco, autenticação, Edge Functions e arquivos

| | |
|---|---|
| **O que passa por lá** | Tudo: contatos, chamados, o corpo das mensagens, os hashes de sessão e de IP, a auditoria, e também os anexos (prints, fotos, documentos e áudios), no Storage |
| **Projeto** | `ghweohedmmmkufqhxdzn` (o mesmo do Painel de Implantação) |
| **Região** | **A confirmar** no painel do Supabase. Se for fora do Brasil, é transferência internacional e vale o Art. 33 |
| **Como o acesso é limitado** | RLS em toda tabela nova; o role `anon` **sem nenhuma policy**; service role só em Edge Function e script server-side, nunca no frontend. No Storage, bucket `atendimento-anexos`: gravar é liberado a qualquer atendente logado, apagar é só admin (`public.e_admin()`) |

### O que a URL pública do Storage tem de pior, e é preciso dizer

**A URL do arquivo é pública para quem a tiver.** Não há autenticação por requisição: quem obtiver o endereço vê o arquivo, mesmo sem login no Atendimento. Os endereços não são adivinháveis (o caminho leva um UUID aleatório) e não são indexados, mas isso é obscuridade, não controle de acesso. É a mesma limitação que já existia com o Cloudinary — trocar de provedor não mudou essa exposição, só quem hospeda.

Consequência prática: o print que um cliente manda é tão protegido quanto o sigilo da URL. É por isso que o aviso pede para enviar **só o necessário** — uma tela de sistema costuma trazer dado de terceiro junto.

Trocar isso exigiria URL assinada com expiração, que o Supabase Storage suporta e que este projeto **não usa hoje** (o bucket é público de propósito: a central e o canal web só leem a URL, sem sessão, e uma URL assinada expiraria e quebraria anexo de conversa antiga). Fica registrado como melhoria conhecida, não como bug.

## O que a GR7 precisa ter no papel

Nenhuma das duas coisas abaixo é código, e nenhuma existe até onde este documento alcança:

1. **Contrato ou termo de tratamento** com o operador, ou o aceite dos termos padrão dele arquivado.
2. **Cláusula de transferência internacional**, se a região for fora do Brasil.

## Como o titular fica sabendo

O aviso dentro do app ([`AvisoPrivacidade.tsx`](../../src/cliente/AvisoPrivacidade.tsx)) nomeia o Supabase. Até 2026-08-09 ele dizia apenas "serviços contratados", sem dizer quais, o que não permite ao titular saber para onde o dado dele vai. Até 2026-08-11 ele nomeava também o Cloudinary, que saiu do texto junto com a migração.
