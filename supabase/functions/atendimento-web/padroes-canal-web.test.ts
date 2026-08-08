/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guarda do canal web.
 *
 * Por que existe: as regras que sustentam a segurança desta função estavam
 * escritas só em comentário no topo do arquivo, e comentário depende de alguém
 * abrir o arquivo. O projeto já aprendeu isso uma vez — o `docs/design.md`
 * descrevia os padrões ANTES da auditoria de julho e ainda assim 24 problemas
 * aconteceram, o que deu origem ao `src/padroes-ui.test.ts`. Esta é a mesma ideia
 * aplicada à Edge Function.
 *
 * O que está em jogo aqui é maior que layout: `atendimento-web` é pública, sem
 * login, e roda com **service role**, ou seja, ignora a RLS. Um descuido não faz
 * uma tela ficar feia, faz qualquer pessoa ler qualquer conversa da base.
 *
 * Ao adicionar exceção, escreva o motivo. Exceção sem motivo é como o problema
 * começa.
 */

const ARQUIVO = join(process.cwd(), 'supabase/functions/atendimento-web/index.ts')
const fonte = readFileSync(ARQUIVO, 'utf-8')

/** Linhas de código, sem comentário: comentário não é violação (e aqui eles citam
 * justamente o que é proibido, para explicar o porquê). */
const linhasDeCodigo = fonte
  .split(/\r?\n/)
  .map((linha, i) => ({ n: i + 1, texto: linha.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '') }))
  .filter((l) => l.texto.trim())

function procurar(padrao: RegExp) {
  return linhasDeCodigo.filter((l) => padrao.test(l.texto)).map((l) => `${ARQUIVO}:${l.n}  ${l.texto.trim()}`)
}

describe('canal web: id de linha nunca vem do cliente', () => {
  // A função roda com service role e ignora a RLS. O `atendimento_id` sai SEMPRE
  // do lookup da sessão (`exigirSessao`). No dia em que alguém aceitar um id no
  // corpo "para facilitar", qualquer pessoa lê qualquer conversa da base.
  it('não lê identificador de registro do corpo da requisição', () => {
    const achados = procurar(/\bcorpo\.(atendimento_id|contato_id|sessao_id|cliente_id|usuario_id)\b/)
    expect(
      achados,
      'Use o id que vem de exigirSessao(), nunca um id enviado pelo cliente'
    ).toEqual([])
  })

  /*
    `mensagem_id` é a ÚNICA exceção, e existe porque apagar ou editar uma
    mensagem precisa dizer qual. A diferença para os ids barrados acima é o
    escopo: ele não escolhe de qual conversa se trata, apenas qual linha DENTRO
    da conversa que a sessão já determinou.

    O que torna isso seguro não é a intenção, é o filtro: a consulta precisa
    casar o id com o `atendimento_id` da sessão. Sem esse `.eq`, o id do corpo
    viraria exatamente o escape que a regra acima impede, e qualquer pessoa com
    uma sessão válida mexeria na conversa alheia.

    A verificação de comportamento (tentar apagar mensagem de outro chamado e
    levar 404) está em `npm run verificar:canal-web`, contra o ambiente real.
  */
  it('o mensagem_id do corpo é sempre casado com o atendimento da sessão', () => {
    if (!/\bcorpo\.mensagem_id\b/.test(fonte)) return

    expect(
      /\.eq\('atendimento_id',\s*sessao\.atendimento_id\)/.test(fonte),
      'quem aceita mensagem_id do cliente precisa filtrar por atendimento_id da sessão'
    ).toBe(true)

    // E o filtro tem que estar na mesma consulta que localiza a mensagem.
    const buscaMensagem = fonte.match(
      /from\('atendimento_mensagens'\)[\s\S]{0,400}?\.eq\('id',\s*idBruto\)[\s\S]{0,200}?(?=\n\s*\n)/
    )
    expect(buscaMensagem, 'a busca por id de mensagem sumiu ou mudou de forma').not.toBeNull()
    expect(
      /\.eq\('atendimento_id',\s*sessao\.atendimento_id\)/.test(buscaMensagem![0]),
      'o filtro por atendimento da sessão precisa estar NA MESMA consulta que localiza a mensagem'
    ).toBe(true)
  })

  it('resolve a sessão pelo hash do token, nunca por outro campo', () => {
    // Buscar sessão por contato ou atendimento deixaria alguém pegar a sessão de
    // outra pessoa sabendo só o telefone dela.
    const consultaPorToken = /\.eq\('token_hash'/.test(fonte)
    expect(consultaPorToken, 'a consulta de sessão precisa filtrar por token_hash').toBe(true)

    const achados = procurar(/from\('atendimento_web_sessoes'\)[\s\S]*?\.eq\('(?!token_hash|id)/)
    expect(achados, 'sessão só pode ser localizada por token_hash').toEqual([])
  })
})

describe('canal web: nada de dado interno na resposta', () => {
  // `select('*')` traz remetente_usuario_id, wa_message_id, canal e client_msg_id
  // junto, e tudo isso é interno.
  it('não usa select(*)', () => {
    const achados = procurar(/\.select\(\s*['"`]\s*\*/)
    expect(achados, 'liste as colunas explicitamente: select(*) vaza campo interno').toEqual([])
  })

  /*
    A verificação do conteúdo de `SELECT_MENSAGEM` mora no bloco "lista
    fechada", mais abaixo. Havia aqui uma segunda versão dela, que só barrava
    campo fora de uma lista de permitidos: ela deixava passar a remoção de um
    campo e, principalmente, envelhecia em paralelo com a outra. Duas guardas
    para a mesma regra é como duas fontes da verdade, uma delas fica errada.
  */

  it('não seleciona campo interno de mensagem em consulta nenhuma', () => {
    const achados = procurar(/\.select\([^)]*\b(remetente_usuario_id|wa_message_id|client_msg_id)\b/)
    expect(achados, 'esses campos são internos e não podem chegar ao cliente').toEqual([])
  })
})

describe('canal web: a mensagem devolvida ao cliente é uma lista fechada', () => {
  /*
    As outras guardas deste arquivo são pela negativa: barram `select('*')` e
    barram nome de campo interno escrito no select. Isso deixa passar o caso
    mais provável, que é alguém acrescentar um campo novo achando que é inócuo.

    Aqui a lista é fechada: se `SELECT_MENSAGEM` ganhar ou perder qualquer
    coisa, o teste quebra e obriga a decisão a ser consciente. A mensagem
    trafega para um app sem login, aberto por quem não é da empresa.
  */
  const PERMITIDOS = [
    'id',
    'direcao',
    'origem',
    'corpo',
    'created_at',
    /*
      `editada_em` porque o cliente vê "editada", como no WhatsApp. A citação
      viaja pela cópia do trecho.

      `excluida` NÃO está aqui, e a ausência é o ponto: a mensagem apagada some
      da tela do cliente porque é **filtrada na consulta**, não porque o campo
      chega e a tela decide escondê-la. `corpo_original` também fica fora: é o
      texto anterior a uma edição, registro para a equipe.
    */
    'editada_em',
    'resposta_corpo',
    'resposta_remetente',
  ]

  it('devolve só os campos previstos da mensagem', () => {
    const achado = fonte.match(/const SELECT_MENSAGEM = '([^']+)'/)
    expect(achado, 'SELECT_MENSAGEM sumiu ou mudou de forma').not.toBeNull()

    const campos = achado![1].split(',').map((c) => c.trim())
    expect(
      campos.sort(),
      'Campo novo na mensagem do cliente. Confirme que ele pode sair do nosso lado ' +
        'antes de acrescentar aqui: remetente_usuario_id, wa_message_id, canal e ' +
        'client_msg_id são internos e não podem.'
    ).toEqual([...PERMITIDOS].sort())
  })

  it('o anexo devolvido não leva o public_id', () => {
    const achado = fonte.match(/const SELECT_ANEXO = '([^']+)'/)
    expect(achado, 'SELECT_ANEXO sumiu ou mudou de forma').not.toBeNull()

    const campos = achado![1].split(',').map((c) => c.trim())
    expect(
      campos.sort(),
      'O `public_id` é o identificador interno no Cloudinary e serve para apagar do nosso ' +
        'lado. O cliente só precisa da URL para ver o arquivo.'
    ).toEqual(['id', 'mensagem_id', 'nome_arquivo', 'tamanho_bytes', 'tipo_mime', 'url'].sort())
  })

  it('do atendente sai só o primeiro nome', () => {
    // O cliente não precisa do sobrenome de quem o atende, e sobrenome mais
    // primeiro nome já identifica a pessoa fora do trabalho.
    expect(fonte).toMatch(/atendente:\s*primeiroNome\(/)
  })
})

describe('canal web: o comentário das regras continua no arquivo', () => {
  // Se alguém apagar o bloco de regras do topo, o próximo a mexer perde o porquê
  // e este teste vira o único aviso — que é justamente o que não queremos.
  it('mantém o aviso das duas regras invioláveis', () => {
    expect(fonte).toMatch(/NUNCA PODE QUEBRAR/)
    expect(fonte).toMatch(/service role/)
  })
})
