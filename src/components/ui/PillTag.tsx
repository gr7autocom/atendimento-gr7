import { corTag } from '../../lib/cores'
import { cn } from '../../lib/utils'

/**
 * Pill de uma tag com a cor real (ou automática, quando não há cor escolhida).
 *
 * `compacta` é a versão da lista de chamados, onde caber duas por linha importa
 * mais que o tamanho do toque (a pill ali é rótulo, não botão). Antes essa
 * variante era um `<span>` desenhado à mão dentro da lista, fora do componente.
 */
export function PillTag({
  tag,
  compacta = false,
  className,
}: {
  tag: { nome: string; cor_fundo?: string | null; cor_texto?: string | null }
  compacta?: boolean
  className?: string
}) {
  const cor = corTag(tag)
  return (
    <span
      title={compacta ? tag.nome : undefined}
      className={cn(
        'inline-flex items-center font-semibold uppercase tracking-wide max-w-full truncate',
        compacta ? 'h-[18px] px-1.5 rounded-micro text-micro' : 'h-6 px-2 rounded-1 text-apoio',
        className
      )}
      style={{ background: cor.bg, color: cor.fg }}
    >
      {tag.nome || 'Tag'}
    </span>
  )
}
