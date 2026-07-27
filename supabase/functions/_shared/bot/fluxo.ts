// Regras puras do fluxo do bot (sem I/O). O webhook orquestra; aqui só decisões
// determinísticas, fáceis de testar e reaproveitar. Ver docs/bot.md.

export type Departamento = { id: string; nome: string; ordem: number }

/** Menu numerado a partir dos departamentos ativos, na ordem. */
export function montarMenu(departamentos: Departamento[]): string {
  return departamentos.map((d, i) => `${i + 1} - ${d.nome}`).join('\n')
}

/** Resposta do cliente no menu: número 1..N → departamento; fora disso, null. */
export function interpretarEscolha(
  texto: string,
  departamentos: Departamento[],
): Departamento | null {
  const n = Number((texto ?? '').trim())
  if (!Number.isInteger(n) || n < 1 || n > departamentos.length) return null
  return departamentos[n - 1]
}

/** `#sair`: comando de encerramento pelo cliente. */
export function ehComandoSair(texto: string): boolean {
  return (texto ?? '').trim().toLowerCase() === '#sair'
}

/**
 * Extrai os 14 dígitos de um CNPJ de uma mensagem livre (com ou sem máscara).
 * Retorna só os dígitos, ou null se não achar um CNPJ no texto.
 */
export function extrairCnpj(texto: string): string | null {
  const m = (texto ?? '').match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)
  return m ? m[0].replace(/\D/g, '') : null
}

/** Nota de avaliação (0 a 10) numa mensagem livre; null se não achar. */
export function extrairNota(texto: string): number | null {
  const m = (texto ?? '').match(/\b(10|[0-9])\b/)
  if (!m) return null
  const n = Number(m[1])
  return n >= 0 && n <= 10 ? n : null
}
