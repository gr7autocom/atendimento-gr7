/**
 * Regra de acesso ao Atendimento por horário.
 *
 * Acesso agora = admin **ou** dentro de um horário comercial ativo **ou**
 * dentro de uma janela pessoal do usuário (o "plantão"). Funções puras para dar
 * pra testar e reusar (login gate + qualquer checagem no cliente).
 *
 * Observação: o cálculo aqui usa o horário local do navegador (o time opera em
 * America/Sao_Paulo). A checagem autoritativa fica na RLS do banco.
 */

export type Faixa = {
  dia_semana: number // 0=Domingo ... 6=Sábado
  hora_inicio: string // "HH:MM" ou "HH:MM:SS"
  hora_fim: string
  ativo?: boolean
}

export function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * A faixa (definida no dia `diaRow`) cobre o momento (`dow`, `nowMin`)?
 * - início == fim → dia inteiro (convenção 00:00–00:00 = 24h).
 * - fim > início → mesmo dia, no intervalo.
 * - fim < início → vira a noite: do início até 23:59 no `diaRow`, e de 00:00 até o fim no dia seguinte.
 */
export function faixaCobre(
  diaRow: number,
  horaInicio: string,
  horaFim: string,
  dow: number,
  nowMin: number
): boolean {
  const i = paraMinutos(horaInicio)
  const f = paraMinutos(horaFim)
  if (i === f) return dow === diaRow
  if (f > i) return dow === diaRow && nowMin >= i && nowMin < f
  return (dow === diaRow && nowMin >= i) || (dow === (diaRow + 1) % 7 && nowMin < f)
}

export function temAcessoAgora(opts: {
  isAdmin: boolean
  comercial: Faixa[]
  janelas: Faixa[]
  agora?: Date
}): boolean {
  if (opts.isAdmin) return true
  const d = opts.agora ?? new Date()
  const dow = d.getDay()
  const nowMin = d.getHours() * 60 + d.getMinutes()
  const cobre = (f: Faixa) => faixaCobre(f.dia_semana, f.hora_inicio, f.hora_fim, dow, nowMin)
  if (opts.comercial.some((h) => h.ativo !== false && cobre(h))) return true
  return opts.janelas.some(cobre)
}

/**
 * Um departamento está disponível agora? Usa as faixas próprias quando existem;
 * senão, cai no horário comercial global.
 */
export function departamentoDisponivelAgora(opts: {
  faixasDep: Faixa[]
  comercial: Faixa[]
  agora?: Date
}): boolean {
  const base = opts.faixasDep.length > 0 ? opts.faixasDep : opts.comercial
  const d = opts.agora ?? new Date()
  const dow = d.getDay()
  const nowMin = d.getHours() * 60 + d.getMinutes()
  return base.some((f) => f.ativo !== false && faixaCobre(f.dia_semana, f.hora_inicio, f.hora_fim, dow, nowMin))
}
