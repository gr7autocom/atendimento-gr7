export const ACOES_ATENDIMENTO = [
  'atendimento.assumir',
  'atendimento.responder',
  'atendimento.finalizar',
  'atendimento.transferir',
  'atendimento.config',
] as const

export type AcaoId = (typeof ACOES_ATENDIMENTO)[number]
