/**
 * Dados de mentira para montar as telas do cliente antes de ligar na Edge
 * Function (`atendimento-web`). Some quando a integração entrar.
 *
 * Os nomes e formatos são os MESMOS que as rotas devolvem, e não um formato
 * conveniente para a tela: mock que inventa formato empurra o trabalho para a
 * integração, que é quando ele fica caro. Contrato em docs/canal-web.md.
 */

export type DepartamentoWeb = { id: string; nome: string }

export type MensagemWeb = {
  id: string
  origem: 'cliente' | 'atendente' | 'bot'
  corpo: string
  criada_em: string
}

/** Resposta de `/disponibilidade`. */
export type Disponibilidade = {
  pode_abrir: boolean
  plantao: boolean
  mensagem_fora_horario: string | null
  departamentos: DepartamentoWeb[]
}

/** Resposta de `/conversa`. */
export type Conversa = {
  protocolo: number
  status: 'na_fila' | 'em_atendimento' | 'finalizado'
  encerrado: boolean
  departamento: string
  atendente: string | null
  aguardando_avaliacao: boolean
  mensagens: MensagemWeb[]
}

export const DISPONIBILIDADE_MENTIRA: Disponibilidade = {
  pode_abrir: true,
  plantao: false,
  mensagem_fora_horario: null,
  departamentos: [
    { id: 'dep-1', nome: 'SUPORTE SISTEMA' },
    { id: 'dep-2', nome: 'DÚVIDAS NOTA FISCAL' },
    { id: 'dep-3', nome: 'FISCAL / CONTABIL' },
    { id: 'dep-4', nome: 'COMERCIAL (VENDAS)' },
    { id: 'dep-5', nome: 'OUTROS ASSUNTOS' },
  ],
}

/** Fora do horário: o formulário some e sobra o aviso. */
export const FORA_DE_HORARIO_MENTIRA: Disponibilidade = {
  pode_abrir: false,
  plantao: false,
  mensagem_fora_horario:
    'Nosso atendimento funciona de segunda a sexta, das 8h às 18h. Deixe sua mensagem no WhatsApp (16) 3333-4444 que respondemos assim que abrir.',
  departamentos: [],
}

const AGORA = Date.now()
const haMinutos = (min: number) => new Date(AGORA - min * 60_000).toISOString()

export const CONVERSA_NA_FILA: Conversa = {
  protocolo: 1042,
  status: 'na_fila',
  encerrado: false,
  departamento: 'SUPORTE SISTEMA',
  atendente: null,
  aguardando_avaliacao: false,
  mensagens: [
    {
      id: 'm1',
      origem: 'cliente',
      corpo: 'Bom dia, o sistema não está emitindo nota fiscal desde ontem à tarde.',
      criada_em: haMinutos(4),
    },
    {
      id: 'm2',
      origem: 'bot',
      corpo: 'Olá! Recebemos seu atendimento e já encaminhamos para o setor Suporte Sistema. Em instantes alguém responde por aqui.',
      criada_em: haMinutos(4),
    },
  ],
}

export const CONVERSA_EM_ATENDIMENTO: Conversa = {
  ...CONVERSA_NA_FILA,
  status: 'em_atendimento',
  atendente: 'Marcelo',
  mensagens: [
    ...CONVERSA_NA_FILA.mensagens,
    {
      id: 'm3',
      origem: 'atendente',
      corpo: 'Bom dia! Já estou vendo aqui. Você chegou a receber alguma mensagem de erro na tela?',
      criada_em: haMinutos(2),
    },
    {
      id: 'm4',
      origem: 'cliente',
      corpo: 'Sim, aparece "certificado digital vencido".',
      criada_em: haMinutos(1),
    },
  ],
}

export const CONVERSA_AGUARDANDO_AVALIACAO: Conversa = {
  ...CONVERSA_EM_ATENDIMENTO,
  status: 'finalizado',
  encerrado: true,
  aguardando_avaliacao: true,
  mensagens: [
    ...CONVERSA_EM_ATENDIMENTO.mensagens,
    {
      id: 'm5',
      origem: 'atendente',
      corpo: 'Renovei o certificado aqui e a emissão voltou. Qualquer coisa é só chamar.',
      criada_em: haMinutos(1),
    },
  ],
}

export const CONVERSA_ENCERRADA: Conversa = {
  ...CONVERSA_AGUARDANDO_AVALIACAO,
  aguardando_avaliacao: false,
}
