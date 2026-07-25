/**
 * Variáveis em mensagens (bot e mensagens rápidas). Padrão único do projeto:
 * **chave dupla em português** — `{{atendente}}`, `{{contato}}`, `{{empresa}}`,
 * `{{protocolo}}`, `{{departamento}}`, `{{horario}}`.
 *
 * Tolerante a espaços dentro das chaves. Chave conhecida com valor nulo vira
 * string vazia; chave desconhecida (ex.: um `{{obs}}` digitado à toa) fica como
 * está, para não apagar texto do usuário sem querer.
 */
export function aplicarVariaveis(
  texto: string,
  vars: Record<string, string | null | undefined>
): string {
  return texto.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (original, nome: string) => {
    const chave = nome.toLowerCase()
    return chave in vars ? (vars[chave] ?? '') : original
  })
}
