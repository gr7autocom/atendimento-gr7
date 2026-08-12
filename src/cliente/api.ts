/**
 * Cliente HTTP do canal web. É a única forma de o PWA falar com o servidor.
 *
 * Não usa `supabase-js` nem embarca chave: a Edge Function `atendimento-web` é
 * deployada com `--no-verify-jwt` e roda com service role, então o que autentica
 * o cliente é o token de sessão no header `x-sessao`, e nada mais. Ver
 * docs/canal-web.md.
 */

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/atendimento-web`

export type DepartamentoWeb = { id: string; nome: string }

export type MensagemWeb = {
  id: string
  direcao: 'entrada' | 'saida'
  origem: 'cliente' | 'atendente' | 'bot'
  corpo: string | null
  created_at: string
  /** Editada pelo cliente. A tela marca, como o WhatsApp faz. */
  editada_em?: string | null
  /** Citação, com o trecho copiado no momento em que foi feita. */
  resposta_corpo?: string | null
  resposta_remetente?: string | null
}

export type Disponibilidade = {
  pode_abrir: boolean
  plantao: boolean
  mensagem_fora_horario: string | null
  departamentos: DepartamentoWeb[]
  /*
    Falas do bot para a tela exibir ANTES de existir chamado. Vêm do servidor,
    e não escritas aqui, para o que a pessoa lê ser igual ao que fica gravado.
  */
  textos: { bem_vindo: string; pergunta_setor: string; pedir_relato: string }
}

/** Teto por anexo. Igual ao da central e ao da Edge Function (`MAX_ANEXO_BYTES`). */
export const MAX_ANEXO_MB = 10

/*
  Janelas de apagar e editar a própria mensagem. Iguais a `JANELA_APAGAR_MIN` e
  `JANELA_EDITAR_MIN` em `supabase/functions/atendimento-web/index.ts` — o servidor
  é quem decide de verdade (`prazo_encerrado`), isto aqui só evita o clique morto:
  sem isto, o menu oferece "Editar"/"Apagar" numa mensagem de duas horas atrás, e o
  cliente só descobre que não pode depois de escolher a nota, escrever o texto
  novo, ou confirmar o apagar.
*/
export const JANELA_APAGAR_MIN = 60
export const JANELA_EDITAR_MIN = 15

export type AnexoWeb = {
  id: string
  mensagem_id: string
  url: string
  nome_arquivo: string | null
  tipo_mime: string | null
  tamanho_bytes: number | null
}

export type Conversa = {
  /** `null` enquanto a conversa só existe na tela: o protocolo nasce com o chamado. */
  protocolo: number | null
  status: 'na_fila' | 'em_atendimento' | 'finalizado'
  encerrado: boolean
  departamento: string | null
  atendente: string | null
  aguardando_avaliacao: boolean
  mensagens: MensagemWeb[]
  /** Todos os anexos do chamado; a tela agrupa por `mensagem_id`. */
  anexos: AnexoWeb[]
}

export type SessaoAberta = {
  token: string
  expira_em: string
  protocolo: number
  departamento: string
  empresa: string | null
}

/** Códigos que a função devolve. Mantido em sincronia com `_shared/web/contrato.ts`. */
export type CodigoErro =
  | 'requisicao_invalida'
  | 'rota_desconhecida'
  | 'campo_invalido'
  | 'cnpj_nao_encontrado'
  | 'departamento_invalido'
  | 'fora_horario'
  | 'limite'
  | 'sessao_invalida'
  | 'sessao_encerrada'
  | 'avaliacao_indisponivel'
  | 'encerramento_indisponivel'
  | 'arquivo_grande'
  | 'arquivo_tipo'
  | 'mensagem_indisponivel'
  | 'prazo_encerrado'
  | 'erro_interno'
  | 'sem_rede'

export class ErroApi extends Error {
  codigo: CodigoErro
  /** Qual campo do formulário o servidor recusou, quando ele diz. */
  campo?: string
  status?: number

  // Campos declarados no corpo, e não no construtor: o projeto compila com
  // `erasableSyntaxOnly`, que recusa parâmetro-propriedade porque ela não é
  // apagável (gera código, em vez de só sumir com os tipos).
  constructor(codigo: CodigoErro, campo?: string, status?: number) {
    super(codigo)
    this.name = 'ErroApi'
    this.codigo = codigo
    this.campo = campo
    this.status = status
  }
}

/** A sessão morreu: o cliente precisa se identificar de novo, não insistir. */
export function sessaoMorreu(erro: unknown): boolean {
  return erro instanceof ErroApi && (erro.codigo === 'sessao_invalida' || erro.codigo === 'sessao_encerrada')
}

async function chamar<T>(rota: string, corpo?: unknown, token?: string): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(`${BASE}/${rota}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'x-sessao': token } : {}),
      },
      body: JSON.stringify(corpo ?? {}),
    })
  } catch {
    // Falha de rede não tem corpo nem status: sem este caso, o app mostraria
    // "erro interno" para quem só está sem sinal.
    throw new ErroApi('sem_rede')
  }

  let json: Record<string, unknown> = {}
  try {
    json = await resposta.json()
  } catch {
    /* corpo vazio é resposta possível em erro de infraestrutura */
  }

  if (!resposta.ok) {
    throw new ErroApi(
      (json.erro as CodigoErro) ?? 'erro_interno',
      json.campo as string | undefined,
      resposta.status
    )
  }
  return json as T
}

export const api = {
  disponibilidade: () => chamar<Disponibilidade>('disponibilidade'),

  /*
    Abre o chamado. É chamada uma vez só, quando o cliente manda a PRIMEIRA
    mensagem: até aí nada foi gravado, então quem desiste na escolha do setor não
    deixa contato órfão nem protocolo gasto.
  */
  identificar: (dados: {
    nome: string
    telefone: string
    cnpj?: string
    departamento_id: string
    mensagem: string
    aceite: boolean
  }) => chamar<SessaoAberta>('identificar', dados),

  conversa: (token: string) => chamar<Conversa>('conversa', {}, token),

  /*
    `client_msg_id` é gerado aqui e reenviado igual em caso de repetição: é ele
    que impede a mesma mensagem de entrar duas vezes quando a rede oscila e o
    cliente aperta enviar de novo.
  */
  mensagem: (token: string, mensagem: string, client_msg_id: string) =>
    chamar<{ ok: true }>('mensagem', { mensagem, client_msg_id }, token),

  /**
   * Anexo. O arquivo vai em `multipart/form-data` para a Edge Function, que o
   * grava no Supabase Storage com a chave de serviço. O app do cliente NÃO fala
   * com o Storage direto: o upload autenticado que a central usa depende de
   * sessão de atendente, que não pode ser embarcada num app que qualquer pessoa
   * da internet abre. Há guarda em `src/padroes-ui.test.ts` para isso.
   *
   * Sem `client_msg_id`: o reenvio de arquivo é decisão consciente de quem
   * clica de novo, e deduplicar por id exigiria comparar o conteúdo, não a
   * chamada. Mensagem de texto é diferente, ali o clique duplo é acidente.
   */
  anexo: async (token: string, arquivo: File, mensagem?: string) => {
    const form = new FormData()
    form.append('arquivo', arquivo)
    if (mensagem?.trim()) form.append('mensagem', mensagem.trim())

    let resposta: Response
    try {
      resposta = await fetch(`${BASE}/anexo`, {
        method: 'POST',
        // Sem `Content-Type`: quem o define é o navegador, junto com o
        // `boundary` do multipart. Escrevê-lo à mão quebra o parse no servidor.
        headers: { 'x-sessao': token },
        body: form,
      })
    } catch {
      throw new ErroApi('sem_rede')
    }

    if (!resposta.ok) {
      const json = (await resposta.json().catch(() => ({}))) as Record<string, unknown>
      throw new ErroApi((json.erro as CodigoErro) ?? 'erro_interno', undefined, resposta.status)
    }
    return { ok: true as const }
  },

  /*
    Apagar e editar a própria mensagem, dentro do prazo (1h e 15min, como o
    WhatsApp). Do lado do cliente a mensagem some; do lado da equipe ela
    continua visível, com o texto, marcada. É de propósito: o histórico é prova
    do atendimento, e quem manda na empresa lê a conversa depois.
  */
  apagarMensagem: (token: string, mensagem_id: string) =>
    chamar<{ ok: true }>('apagar-mensagem', { mensagem_id }, token),

  editarMensagem: (token: string, mensagem_id: string, mensagem: string) =>
    chamar<{ ok: true }>('editar-mensagem', { mensagem_id, mensagem }, token),

  encerrar: (token: string) => chamar<{ ok: true }>('encerrar', {}, token),

  avaliar: (token: string, nota: number) => chamar<{ ok: true }>('avaliar', { nota }, token),
}

/**
 * O que o cliente lê quando algo dá errado. Fica aqui, e não espalhado nas telas,
 * porque é a mesma tradução em todo lugar e porque erro técnico ("campo_invalido")
 * não diz nada a quem só quer suporte.
 */
export function mensagemDeErro(erro: unknown): string {
  if (!(erro instanceof ErroApi)) return 'Algo deu errado. Tente de novo em instantes.'
  switch (erro.codigo) {
    case 'sem_rede':
      return 'Não conseguimos falar com o servidor. Confira sua internet e tente de novo.'
    case 'limite':
      return 'Muitas tentativas seguidas. Aguarde alguns minutos antes de tentar de novo.'
    case 'fora_horario':
      return 'Nosso atendimento fechou agora há pouco. Volte no horário comercial.'
    case 'cnpj_nao_encontrado':
      return 'Não encontramos esse CNPJ na nossa base. Você pode continuar sem ele.'
    case 'departamento_invalido':
      return 'Escolha um dos assuntos da lista.'
    case 'campo_invalido':
      return 'Confira os dados preenchidos.'
    case 'sessao_invalida':
    case 'sessao_encerrada':
      return 'Sua conversa não está mais disponível neste aparelho. Inicie outro atendimento.'
    case 'avaliacao_indisponivel':
      return 'Este atendimento não está mais aceitando nota.'
    case 'encerramento_indisponivel':
      return 'Este atendimento já foi encerrado.'
    // Os dois dizem o que fazer, porque a saída é diferente: um arquivo grande
    // se resolve mandando outro; um tipo recusado, não.
    case 'arquivo_grande':
      return `O arquivo passa de ${MAX_ANEXO_MB} MB. Envie um menor ou divida em partes.`
    case 'arquivo_tipo':
      return 'Esse tipo de arquivo não é aceito. Envie imagem, PDF, planilha ou áudio.'
    case 'prazo_encerrado':
      return 'O prazo para alterar essa mensagem já passou. Envie uma nova explicando a correção.'
    case 'mensagem_indisponivel':
      return 'Essa mensagem não está mais disponível. Atualize a conversa.'
    default:
      return 'Algo deu errado do nosso lado. Tente de novo em instantes.'
  }
}

/** Erro de campo do formulário, no texto que vai embaixo do campo. */
export function erroDeCampo(erro: unknown): { campo: string; texto: string } | null {
  if (!(erro instanceof ErroApi)) return null
  if (erro.codigo === 'cnpj_nao_encontrado') {
    return { campo: 'cnpj', texto: 'Não encontramos esse CNPJ. Você pode continuar sem ele.' }
  }
  if (erro.codigo === 'departamento_invalido') {
    return { campo: 'departamento_id', texto: 'Escolha um dos assuntos da lista.' }
  }
  if (erro.codigo !== 'campo_invalido' || !erro.campo) return null
  const textos: Record<string, string> = {
    nome: 'Escreva seu nome completo.',
    telefone: 'Informe DDD e número, sem letras.',
    cnpj: 'Confira os números do CNPJ.',
    mensagem: 'Conte rapidamente o que está acontecendo.',
    aceite: 'Precisamos do seu aceite para começar.',
  }
  return { campo: erro.campo, texto: textos[erro.campo] ?? 'Confira este campo.' }
}
