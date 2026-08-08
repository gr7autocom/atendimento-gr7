/**
 * Marca do produto: logo da GR7, separador e a palavra "Atendimento".
 *
 * Existe como componente, e não como três elementos repetidos nas telas, porque
 * ela aparece em quatro lugares (topo da central, login, cabeçalho do app do
 * cliente e rodapé do menu no celular) e antes disso já estava divergindo: cada
 * um montava o quadrado do ícone com um raio e um tamanho de texto diferentes.
 *
 * Três decisões que valem para todos os usos:
 *
 * - `alt="GR7 Autocom"` e não vazio. A logo carrega o nome da empresa; com alt
 *   vazio o leitor de tela anunciaria só "Atendimento". Junto com o texto ao
 *   lado sai "GR7 Autocom Atendimento", que é o nome inteiro do produto.
 * - `width`/`height` explícitos em toda variante. Sem eles a imagem chega depois
 *   do texto e empurra o layout, o que na barra do topo é visível a cada carga.
 * - O separador é `aria-hidden`: é pontuação visual, e lido em voz alta viraria
 *   ruído no meio do nome.
 *
 * O tamanho vem do papel, não do gosto: `sm` em rodapé e legenda, `md` em barra
 * e cabeçalho, `lg` na abertura de uma tela (login, entrada do cliente).
 */
import { cn } from '../../lib/utils'

/*
  A arte é 532x302, então a proporção é 1,7616. As larguras abaixo saem dessa
  conta arredondada ao pixel: escrever uma largura "redonda" deformaria a logo,
  que é o único jeito garantido de estragar uma marca.

  As alturas não são as menores que caberiam. A arte tem "autocom" em corpo
  pequeno sob o "gr7", e abaixo de ~24px essa palavra vira um borrão. Como a
  barra do topo tem 56px, sobra espaço: a marca ganha a altura que a arte pede.
*/
const TAMANHOS = {
  sm: { largura: 28, altura: 16, separador: 'h-3.5', texto: 'text-mini text-tx-3', gap: 'gap-2' },
  md: { largura: 42, altura: 24, separador: 'h-5', texto: 'text-corpo-lg font-medium text-tx-1', gap: 'gap-2.5' },
  lg: { largura: 56, altura: 32, separador: 'h-6', texto: 'text-titulo font-semibold text-tx-1', gap: 'gap-2.5' },
} as const

export function Marca({
  tamanho = 'md',
  className,
}: {
  tamanho?: keyof typeof TAMANHOS
  className?: string
}) {
  const t = TAMANHOS[tamanho]

  return (
    <span className={cn('inline-flex items-center min-w-0', t.gap, className)}>
      <img
        src="/marca-gr7.png"
        alt="GR7 Autocom"
        width={t.largura}
        height={t.altura}
        // A marca está sempre acima da dobra: adiar a carga só faria a barra
        // do topo montar sem ela.
        loading="eager"
        decoding="async"
        className="shrink-0"
      />
      <span aria-hidden="true" className={cn('w-px shrink-0 bg-bd-3', t.separador)} />
      <span className={cn('truncate', t.texto)}>Atendimento</span>
    </span>
  )
}
