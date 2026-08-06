/**
 * Sessão do cliente no canal web: token, hash e validade.
 *
 * A regra que sustenta o resto: **identificar-se dá direito a abrir conversa nova,
 * nunca a ler conversa existente**. Se o telefone ou o CNPJ dessem acesso, qualquer
 * pessoa que os digitasse leria a conversa em andamento da empresa, e conversa de
 * suporte carrega senha de servidor, IP e configuração de sistema.
 *
 * Por isso o escopo do token é **um atendimento**, não o contato. Fosse o contato, o
 * cliente web passaria a enxergar o histórico do WhatsApp dele — o oposto do escopo
 * "só a conversa atual". Ver docs/canal-web.md.
 */

/** 32 bytes: espaço de busca grande o bastante para força bruta não ser opção. */
const BYTES_TOKEN = 32
/** Caracteres guardados em claro, só para casar log com sessão no suporte. */
const TAM_PREFIXO = 8

export const VALIDADE_ABSOLUTA_H = 12
export const VALIDADE_INATIVIDADE_H = 2

export type SessaoViva = {
  expira_em: string
  ultimo_uso_em: string
  revogada_em: string | null
}

/** Token opaco novo, em base64url (seguro em URL, header e localStorage). */
export function gerarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(BYTES_TOKEN))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * SHA-256 do token, em hexadecimal. É isto que vai para o banco: quem ler a tabela
 * não consegue se passar por cliente nenhum.
 *
 * Não é bcrypt/argon de propósito. O token são 32 bytes aleatórios, não uma senha
 * escolhida por gente, então não há dicionário a resistir; e o hash é conferido a
 * cada polling da conversa, onde o custo de um KDF apareceria.
 */
export async function hashToken(token: string): Promise<string> {
  const dados = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', dados)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function prefixoToken(token: string): string {
  return token.slice(0, TAM_PREFIXO)
}

export function expiracaoAbsoluta(agora: Date): string {
  return new Date(agora.getTime() + VALIDADE_ABSOLUTA_H * 3600_000).toISOString()
}

/**
 * Se a sessão ainda vale, considerando as três formas de morrer.
 *
 * A expiração é tripla porque cada uma cobre um caso diferente: a absoluta limita o
 * estrago de um token vazado, a de inatividade mata o token esquecido numa máquina
 * compartilhada, e a revogação é o caminho manual para quando quem abriu o chamado
 * sai da empresa.
 */
export function sessaoValida(sessao: SessaoViva, agora: Date): boolean {
  if (sessao.revogada_em) return false
  if (new Date(sessao.expira_em).getTime() <= agora.getTime()) return false
  const ocioso = agora.getTime() - new Date(sessao.ultimo_uso_em).getTime()
  return ocioso < VALIDADE_INATIVIDADE_H * 3600_000
}

/**
 * Até quando a sessão sobrevive depois de o chamado ser finalizado.
 *
 * Finalizar **não** revoga na hora: a avaliação e a reabertura acontecem depois do
 * fim, e matar a sessão junto derrubaria as duas. A janela é a mesma da reabertura,
 * então o cliente que volta a escrever dentro dela continua sendo reconhecido.
 */
export function fimDaSessaoAoFinalizar(finalizadoEm: Date, janelaReaberturaH: number): string {
  return new Date(finalizadoEm.getTime() + janelaReaberturaH * 3600_000).toISOString()
}
