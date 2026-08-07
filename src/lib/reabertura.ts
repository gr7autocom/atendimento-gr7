import type { Canal } from './canal'

/**
 * O que o rodapé do chat diz quando o atendimento está finalizado.
 *
 * Existe como módulo próprio, e não inline no JSX, porque é regra de negócio com
 * quatro entradas e nenhuma delas dá para conferir olhando a tela: seria preciso
 * finalizar chamados em estados diferentes para ver cada frase. Aqui cada caso
 * tem teste.
 *
 * A regra real, implementada no `whatsapp-webhook` (ver docs/bot.md): reabre o
 * MESMO protocolo quem volta dentro da janela depois de o atendente finalizar
 * **com a nota pendente**. Nota dada, `#sair` do cliente ou avaliação desligada
 * abrem chamado novo. O rodapé antigo prometia reabertura em todos os casos.
 */
export type DadosReabertura = {
  /** Preenchido quando o bot chegou a pedir a nota. Nulo = avaliação desligada ou `#sair`. */
  avaliacao_solicitada_em: string | null
  /** Nota já dada fecha o ciclo: a próxima mensagem é chamado novo. */
  avaliacao: number | null
  finalizado_em: string | null
  canal: Canal
}

/** Horas da config `janela_reabertura_horas`, com o mesmo default do banco. */
export function janelaEmHoras(valor: string | undefined): number {
  const n = Number(valor)
  return Number.isFinite(n) && n > 0 ? n : 3
}

function plural(horas: number): string {
  return horas === 1 ? '1 hora' : `${horas} horas`
}

export function textoRodapeFinalizado(
  dados: DadosReabertura,
  horas: number,
  /** Canal web: o cliente ainda tem acesso vivo ao PWA? */
  acessoDoClienteVivo: boolean,
  agora: Date = new Date()
): string {
  const FINALIZADO = 'Atendimento finalizado.'

  // Sem acesso o cliente nem alcança a conversa: ele se identifica de novo, e
  // identificar-se abre chamado, nunca devolve o antigo (ADR-11).
  if (dados.canal === 'web' && !acessoDoClienteVivo) {
    return `${FINALIZADO} O acesso do cliente ao site foi encerrado, então ele precisa se identificar de novo e isso abre um chamado novo.`
  }

  const notaPendente = !!dados.avaliacao_solicitada_em && dados.avaliacao === null
  const dentroDaJanela =
    !!dados.finalizado_em &&
    agora.getTime() - new Date(dados.finalizado_em).getTime() < horas * 3_600_000

  if (notaPendente && dentroDaJanela) {
    return `${FINALIZADO} Se o cliente responder em até ${plural(horas)}, este protocolo reabre.`
  }

  return `${FINALIZADO} A próxima mensagem do cliente abre um chamado novo.`
}
