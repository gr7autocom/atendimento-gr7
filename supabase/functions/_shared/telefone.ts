/**
 * Formato do telefone, compartilhado pelos canais.
 *
 * Por que existe: `contatos.telefone` é `NOT NULL UNIQUE` e é a **identidade do
 * cliente** no sistema inteiro. Até aqui só o WhatsApp escrevia nessa coluna, e o
 * formato vinha pronto do provedor. Com o canal web, o telefone passa a ser
 * **digitado por gente**, e `(16) 99123-4567` e `+5516991234567` gravariam dois
 * contatos para a mesma pessoa — o histórico unificado, que é o motivo de pedir o
 * telefone no formulário, evaporaria em silêncio.
 *
 * O formato canônico é um só: `+` seguido de dígitos, com DDI. Duas portas de
 * entrada, porque os dois canais sabem coisas diferentes:
 *
 * - `e164`: para quem **já tem o DDI**, como o JID do WhatsApp. Só valida e formata.
 * - `normalizarTelefoneBR`: para quem digitou num formulário brasileiro, onde o
 *   `+55` costuma ficar implícito.
 *
 * Um número internacional não pode passar por `normalizarTelefoneBR`: sem `+`, os
 * 12 dígitos de um telefone português seriam lidos como número brasileiro malformado.
 * Por isso a entrada com `+` é respeitada como está.
 */

/** Menor telefone que aceitamos: DDD + 8 dígitos, sem DDI. */
const MIN_DIGITOS = 10
/** Teto folgado do E.164 (15 dígitos) para barrar lixo colado no campo. */
const MAX_DIGITOS = 15

/**
 * Dígitos que já incluem o DDI viram o formato canônico.
 * Devolve string vazia quando não é telefone plausível.
 */
export function e164(digitosComDDI: string): string {
  const digitos = String(digitosComDDI ?? '').replace(/\D/g, '')
  if (digitos.length < MIN_DIGITOS || digitos.length > MAX_DIGITOS) return ''
  return `+${digitos}`
}

/**
 * Telefone digitado num formulário brasileiro para o formato canônico.
 *
 * Aceita máscara, espaço, o zero de operadora e o `+55` escrito ou não. Entrada
 * que começa com `+` é tratada como internacional e não recebe o 55.
 *
 * Devolve string vazia quando não dá para normalizar com segurança — sem DDD,
 * por exemplo, porque adivinhar DDD amarraria o chamado ao contato errado.
 */
export function normalizarTelefoneBR(entrada: unknown): string {
  const bruto = String(entrada ?? '').trim()
  if (!bruto) return ''

  // O `+` é declaração de DDI: quem escreveu sabe o país, não presumimos o Brasil.
  if (bruto.startsWith('+')) return e164(bruto)

  // Zero de operadora (`016 9...`) não faz parte do número.
  const digitos = bruto.replace(/\D/g, '').replace(/^0+/, '')

  // 12 e 13 dígitos começando com 55 já trazem o DDI: fixo e celular, nessa ordem.
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    return temDddValido(digitos.slice(2)) ? e164(digitos) : ''
  }

  // 10 (fixo) e 11 (celular) são DDD + número, com o 55 implícito.
  if (digitos.length === 10 || digitos.length === 11) {
    return temDddValido(digitos) ? e164(`55${digitos}`) : ''
  }

  return ''
}

/** DDD brasileiro vai de 11 a 99: o que começa com 0 ou 1x abaixo de 11 não existe. */
function temDddValido(nacional: string): boolean {
  const ddd = Number(nacional.slice(0, 2))
  return ddd >= 11 && ddd <= 99
}
