// Variáveis das mensagens do bot (chave dupla em português). Cópia da lógica do
// frontend (src/lib/variaveis.ts) — o design/domínio é copiado, não importado
// entre app e Edge Functions (ver CLAUDE.md).

export function aplicarVariaveis(
  texto: string,
  vars: Record<string, string | null | undefined>,
): string {
  return texto.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (original, nome: string) => {
    const chave = nome.toLowerCase()
    return chave in vars ? (vars[chave] ?? '') : original
  })
}
