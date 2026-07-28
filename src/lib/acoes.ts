export const ACOES_ATENDIMENTO = [
  'atendimento.assumir',
  'atendimento.responder',
  'atendimento.finalizar',
  'atendimento.transferir',
  'atendimento.config',
] as const

/** Capacidades do painel que o Atendimento também consulta (mesma conta/permissão). */
export const ACOES_PAINEL = ['tarefa.criar'] as const

export type AcaoId = (typeof ACOES_ATENDIMENTO)[number] | (typeof ACOES_PAINEL)[number]
