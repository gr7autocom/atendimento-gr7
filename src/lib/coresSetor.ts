/**
 * Cor estável da tag de um departamento a partir do nome.
 * `departamentos` não guarda cor no banco (só nome/ordem), então derivamos
 * uma cor sólida de uma paleta fixa. O mesmo setor cai sempre no mesmo tom.
 */
const PALETA = [
  { bg: 'rgba(31,111,235,0.16)', fg: '#6cb0ff' }, // azul
  { bg: 'rgba(63,185,80,0.16)', fg: '#57d669' }, // verde
  { bg: 'rgba(210,153,34,0.16)', fg: '#e3a92a' }, // âmbar
  { bg: 'rgba(137,87,229,0.16)', fg: '#b087f5' }, // roxo
  { bg: 'rgba(219,109,40,0.16)', fg: '#f0864a' }, // laranja
  { bg: 'rgba(219,61,109,0.16)', fg: '#f56897' }, // rosa
]

export function corSetor(nome: string) {
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0
  return PALETA[h % PALETA.length]
}

/**
 * Cor do pill de uma tag. O admin pode escolher a cor (colunas `cor_fundo`/
 * `cor_texto`); quando não escolheu, cai na cor automática pelo nome, como os
 * setores. Assim tags antigas (sem cor) continuam legíveis.
 */
export function corTag(tag: { nome: string; cor_fundo?: string | null; cor_texto?: string | null }) {
  if (tag.cor_fundo) return { bg: tag.cor_fundo, fg: tag.cor_texto || '#ffffff' }
  return corSetor(tag.nome ?? '')
}
