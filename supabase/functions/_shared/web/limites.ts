/**
 * Rate limit do canal web.
 *
 * Não é polimento, é a única barreira que existe. O formulário aceita potencial e
 * não exige CNPJ, então qualquer pessoa na internet cria chamado. No WhatsApp há o
 * atrito de possuir um número; aqui não há atrito nenhum.
 *
 * Duas coisas que isto impede:
 * 1. **Inundar a fila de Potenciais**, que trava a operação de atendimento.
 * 2. **Descobrir a carteira de clientes**, varrendo CNPJ para ver quais respondem
 *    "encontrado". A validação de dígito verificador em `contrato.ts` já corta a
 *    maior parte disso; o limite fecha o resto.
 *
 * A contagem mora em tabela, nunca em memória: o isolate da Edge Function é
 * efêmero e há mais de uma instância, então contador em memória não conta nada.
 */

export type Limite = { janelaMin: number; maximo: number }

export const LIMITES = {
  /** Abertura de chamado por origem de rede. */
  identificarPorIp: { janelaMin: 10, maximo: 5 } as Limite,
  /** Mesma pessoa insistindo. Mais folgado: reidentificar é caminho legítimo. */
  identificarPorTelefone: { janelaMin: 60, maximo: 10 } as Limite,
  /** Teto geral, para o pior caso não derrubar a operação. */
  aberturaGlobal: { janelaMin: 60, maximo: 60 } as Limite,
  /** Ritmo de digitação humana, com folga larga. */
  mensagemPorSessao: { janelaMin: 1, maximo: 30 } as Limite,
} as const

export type AcaoLimitada = keyof typeof LIMITES

/** Início da janela de contagem, para o `WHERE created_at >= ?`. */
export function inicioDaJanela(limite: Limite, agora: Date): string {
  return new Date(agora.getTime() - limite.janelaMin * 60_000).toISOString()
}

export function estourou(limite: Limite, contagem: number): boolean {
  return contagem >= limite.maximo
}

/** Prefixo no sujeito da contagem para IP e telefone nunca colidirem entre si. */
export function chaveIp(ipHash: string): string {
  return `ip:${ipHash}`
}

export function chaveTelefone(e164: string): string {
  return `tel:${e164}`
}

export const CHAVE_GLOBAL = 'global'

/**
 * Hash do IP. Guardar IP em claro seria dado pessoal sob a LGPD sem necessidade
 * nenhuma: para contar tentativas basta saber se duas requisições vieram da mesma
 * origem, e igualdade de hash resolve isso.
 *
 * O sal vem do ambiente para o hash não ser reversível por tabela pronta — sem ele,
 * o espaço de IPv4 inteiro cabe numa varredura de segundos.
 */
export async function hashIp(ip: string, sal: string): Promise<string> {
  const dados = new TextEncoder().encode(`${sal}:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', dados)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

/**
 * IP de origem atrás do proxy do Supabase.
 *
 * `x-forwarded-for` acumula a cadeia e o primeiro item é o cliente. O valor é
 * falsificável por quem monta a requisição, e não há o que fazer quanto a isso numa
 * função pública: serve para conter abuso casual, não atacante determinado. Por
 * isso existem também o limite por telefone e o teto global.
 */
export function ipDaRequisicao(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'desconhecido'
}
