import { corTag } from '../../lib/coresSetor'
import { cn } from '../../lib/utils'

/** Pill de uma tag com a cor real (ou automática, quando não há cor escolhida). */
export function PillTag({
  tag,
  className,
}: {
  tag: { nome: string; cor_fundo?: string | null; cor_texto?: string | null }
  className?: string
}) {
  const cor = corTag(tag)
  return (
    <span
      className={cn(
        'inline-flex items-center h-6 px-2 rounded-[6px] text-[12px] font-semibold uppercase tracking-wide max-w-full truncate',
        className
      )}
      style={{ background: cor.bg, color: cor.fg }}
    >
      {tag.nome || 'Tag'}
    </span>
  )
}
