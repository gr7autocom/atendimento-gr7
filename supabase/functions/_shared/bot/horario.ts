// Regra de horário do bot (pura, sem I/O). Decide se estamos no horário
// comercial e se há plantonista disponível agora, no fuso da config. Espelha a
// mesma lógica de faixas de src/lib/horario.ts — copiada de propósito, porque o
// código Deno não importa de src/ (mesma barreira do design system). Ver docs/bot.md.

export type Faixa = {
  dia_semana: number // 0=Domingo ... 6=Sábado
  hora_inicio: string // "HH:MM" ou "HH:MM:SS"
  hora_fim: string
  ativo?: boolean
}

export type Momento = { dow: number; min: number }

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
  nowMin: number,
): boolean {
  const i = paraMinutos(horaInicio)
  const f = paraMinutos(horaFim)
  if (i === f) return dow === diaRow
  if (f > i) return dow === diaRow && nowMin >= i && nowMin < f
  return (dow === diaRow && nowMin >= i) || (dow === (diaRow + 1) % 7 && nowMin < f)
}

const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Dia da semana (0-6) e minutos do dia, calculados no fuso informado. */
export function momentoNoFuso(timezone: string, agora: Date): Momento {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora)
  const val = (t: string) => partes.find((p) => p.type === t)?.value ?? ''
  const dow = DIAS[val('weekday')] ?? agora.getUTCDay()
  const min = Number(val('hour')) * 60 + Number(val('minute'))
  return { dow, min }
}

/**
 * Estamos dentro do horário comercial?
 * Sem nenhuma faixa configurada, considera **aberto** — mesma decisão da RLS
 * `pode_atender_agora()`, pra não travar o atendimento antes de configurar.
 */
export function estaAberto(comercial: Faixa[], momento: Momento): boolean {
  if (comercial.length === 0) return true
  return comercial.some(
    (f) => f.ativo !== false && faixaCobre(f.dia_semana, f.hora_inicio, f.hora_fim, momento.dow, momento.min),
  )
}

/** Há algum atendente com janela de plantão cobrindo o momento? */
export function temPlantonista(janelas: Faixa[], momento: Momento): boolean {
  return janelas.some((f) => faixaCobre(f.dia_semana, f.hora_inicio, f.hora_fim, momento.dow, momento.min))
}

/**
 * Resumo legível do horário comercial para a mensagem `fora_horario` ({{horario}}).
 * Agrupa dias consecutivos com a mesma faixa: "Seg a Sex 08:00 às 18:00; Sáb 08:00 às 12:00".
 * Sem faixas, retorna vazio (o texto do admin decide o que dizer).
 */
export function resumoComercial(comercial: Faixa[]): string {
  const porDia: string[] = []
  for (let d = 0; d < 7; d++) {
    porDia[d] = comercial
      .filter((f) => f.ativo !== false && f.dia_semana === d)
      .sort((a, b) => paraMinutos(a.hora_inicio) - paraMinutos(b.hora_inicio))
      .map((f) => `${f.hora_inicio.slice(0, 5)} às ${f.hora_fim.slice(0, 5)}`)
      .join(', ')
  }
  const grupos: { ini: number; fim: number; txt: string }[] = []
  for (let d = 0; d < 7; d++) {
    const txt = porDia[d]
    if (!txt) continue
    const ult = grupos[grupos.length - 1]
    if (ult && ult.txt === txt && ult.fim === d - 1) ult.fim = d
    else grupos.push({ ini: d, fim: d, txt })
  }
  return grupos
    .map((g) => {
      const dias = g.ini === g.fim ? NOMES_DIA[g.ini] : `${NOMES_DIA[g.ini]} a ${NOMES_DIA[g.fim]}`
      return `${dias} ${g.txt}`
    })
    .join('; ')
}
