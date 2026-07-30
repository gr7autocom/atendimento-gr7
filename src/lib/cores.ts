/**
 * Cor CATEGÓRICA do produto, num só lugar.
 *
 * O tema (`src/tema.css`) cuida de superfície, texto, marca e semântica. O que
 * mora aqui é diferente: cor que distingue *itens* (este setor, esta tag, este
 * avatar, esta métrica) e por isso é uma lista, não um token.
 *
 * Estava espalhada em três arquivos (a paleta de setor aqui, os tons de avatar
 * dentro do `Avatar` e as cores de métrica dentro do `Dashboard`), cada um com
 * sua própria função de hash. Uma cor nova exigia caçar o lugar certo.
 *
 * Todos os pares abaixo foram medidos: passam 4,5:1 sobre a superfície em que
 * são usados. Ao acrescentar cor, medir antes.
 */

/** Hash estável de um nome. Mesmo nome, mesma cor, sempre. */
function hashNome(nome: string) {
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0
  return h
}

/**
 * Paleta de setor e de tag sem cor escolhida: fundo tingido + texto claro.
 * `departamentos` não guarda cor no banco (só nome e ordem), então derivamos.
 */
const PALETA_ROTULO = [
  { bg: 'rgba(31,111,235,0.16)', fg: '#6cb0ff' }, // azul
  { bg: 'rgba(63,185,80,0.16)', fg: '#57d669' }, // verde
  { bg: 'rgba(210,153,34,0.16)', fg: '#e3a92a' }, // âmbar
  { bg: 'rgba(137,87,229,0.16)', fg: '#b087f5' }, // roxo
  { bg: 'rgba(219,109,40,0.16)', fg: '#f0864a' }, // laranja
  { bg: 'rgba(219,61,109,0.16)', fg: '#f56897' }, // rosa
]

export function corSetor(nome: string) {
  return PALETA_ROTULO[hashNome(nome) % PALETA_ROTULO.length]
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

/** Fundo do avatar: sólido, para a lista não ficar toda de uma cor. */
const PALETA_AVATAR = ['bg-br-1', 'bg-[#8957e5]', 'bg-[#1f6feb]', 'bg-[#3fb950]', 'bg-[#d29922]', 'bg-[#db6d28]']

export function tomAvatar(nome: string) {
  return PALETA_AVATAR[hashNome(nome) % PALETA_AVATAR.length]
}

/**
 * Verde oficial do WhatsApp, usado no selo de canal sobre o avatar do contato.
 * Cor de marca de terceiro: não é token do tema (não muda com o nosso visual) e
 * não pode ser "ajustada", então mora aqui, nomeada, em vez de solta no JSX.
 */
export const COR_WHATSAPP = '#25d366'

/**
 * Cor por métrica do painel de supervisão. Aqui a cor é fixa por significado
 * (pendente é âmbar, retorno é laranja), não derivada de hash.
 */
export const COR_METRICA = {
  online: '#3fb950',
  potenciais: '#a371f7',
  novas: '#3bb6c9',
  ativos: '#4c8dff',
  pendentes: '#e0a12e',
  retornos: '#f0803c',
} as const
