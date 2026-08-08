/**
 * Validação da entrada do canal web e os códigos de erro do contrato.
 *
 * Módulo puro: sem `fetch`, sem `Deno.env`, sem banco. Tudo aqui é testável sem
 * rede, no mesmo espírito de `_shared/bot/fluxo.ts`.
 *
 * A função `atendimento-web` roda com **service role**, ou seja, ignora a RLS. É a
 * superfície mais exposta do sistema: pública, sem login e com poder total no
 * banco. Toda entrada é hostil até prova em contrário, e é aqui que ela é provada.
 */

/**
 * Erros do contrato. Sempre tipados e genéricos: o cliente recebe um código que a
 * interface sabe traduzir, nunca stack nem mensagem do banco. O
 * `whatsapp-send/index.ts` devolve `String(erro)` no corpo; não repetir isso aqui,
 * porque ali o chamador somos nós e aqui é a internet.
 */
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
  // Anexo: dois códigos separados porque a saída do cliente é diferente em cada
  // caso. Arquivo grande ele resolve mandando outro menor; tipo recusado, não.
  | 'arquivo_grande'
  | 'arquivo_tipo'
  // Apagar e editar a própria mensagem: separados porque a saída é diferente.
  // Prazo vencido é definitivo; mensagem indisponível costuma ser tela velha.
  | 'mensagem_indisponivel'
  | 'prazo_encerrado'
  | 'erro_interno'

export class ErroContrato extends Error {
  constructor(readonly codigo: CodigoErro, readonly status = 400, readonly campo?: string) {
    super(codigo)
    this.name = 'ErroContrato'
  }
}

/** Teto do corpo da requisição. Acima disso nem tentamos parsear. */
export const MAX_CORPO_BYTES = 8 * 1024
export const MAX_MENSAGEM = 2000
const MIN_NOME = 2
const MAX_NOME = 80

export function validarNome(valor: unknown): string {
  const nome = String(valor ?? '').trim().replace(/\s+/g, ' ')
  if (nome.length < MIN_NOME || nome.length > MAX_NOME) {
    throw new ErroContrato('campo_invalido', 400, 'nome')
  }
  return nome
}

export function validarMensagem(valor: unknown): string {
  const corpo = String(valor ?? '').trim()
  if (!corpo || corpo.length > MAX_MENSAGEM) {
    throw new ErroContrato('campo_invalido', 400, 'mensagem')
  }
  return corpo
}

export function validarNota(valor: unknown): number {
  const nota = Number(valor)
  if (!Number.isInteger(nota) || nota < 0 || nota > 10) {
    throw new ErroContrato('campo_invalido', 400, 'nota')
  }
  return nota
}

/** UUID v4 gerado pelo cliente para a idempotência do envio. */
export function validarClientMsgId(valor: unknown): string {
  const id = String(valor ?? '').trim().toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    throw new ErroContrato('campo_invalido', 400, 'client_msg_id')
  }
  return id
}

/**
 * CNPJ pelos dígitos verificadores, **antes** de qualquer consulta ao banco.
 *
 * Não é preciosismo: sem isso a rota de identificação vira oráculo da carteira de
 * clientes, porque dá para varrer CNPJs e ver quais respondem "encontrado". Validar
 * o DV corta a maior parte do fuzzing com custo zero, já que CNPJ aleatório quase
 * nunca fecha a conta.
 *
 * Devolve os 14 dígitos, ou `null` quando o campo veio vazio (ele é opcional).
 */
export function validarCnpjOpcional(valor: unknown): string | null {
  const bruto = String(valor ?? '').trim()
  if (!bruto) return null

  const d = bruto.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) {
    throw new ErroContrato('campo_invalido', 400, 'cnpj')
  }

  const digito = (base: string): number => {
    // Pesos do módulo 11 do CNPJ: começam em 2 na ponta direita e sobem até 9,
    // reiniciando em 2. Daí o `% 8` em vez de uma tabela escrita à mão.
    let soma = 0
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[base.length - 1 - i]) * ((i % 8) + 2)
    }
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const dv1 = digito(d.slice(0, 12))
  const dv2 = digito(d.slice(0, 12) + dv1)
  if (dv1 !== Number(d[12]) || dv2 !== Number(d[13])) {
    throw new ErroContrato('campo_invalido', 400, 'cnpj')
  }
  return d
}

export function validarUuid(valor: unknown, campo: string): string {
  const id = String(valor ?? '').trim().toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    throw new ErroContrato('campo_invalido', 400, campo)
  }
  return id
}

/**
 * Só o primeiro nome do atendente vai para o cliente.
 *
 * Nome completo de funcionário é dado pessoal e não acrescenta nada a quem está
 * sendo atendido. "Falando com Pabllo" basta.
 */
export function primeiroNome(nomeCompleto: unknown): string | null {
  const nome = String(nomeCompleto ?? '').trim()
  if (!nome) return null
  return nome.split(/\s+/)[0]
}
