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
