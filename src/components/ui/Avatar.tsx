import { cn } from '../../lib/utils'
import { tomAvatar, COR_WHATSAPP } from '../../lib/cores'

/** Iniciais estáveis a partir do nome: primeira letra do primeiro e do último termo. */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

// O tom de fundo vem de lib/cores: é a mesma família de cor categórica usada em
// setor, tag e métrica, e antes estava duplicada aqui com outra função de hash.

export function Avatar({
  nome,
  fotoUrl,
  tamanho = 40,
  whatsapp = false,
  className,
}: {
  nome: string
  /** Foto do usuário (vem do painel). Sem foto, cai nas iniciais. */
  fotoUrl?: string | null
  tamanho?: number
  whatsapp?: boolean
  className?: string
}) {
  const fonte = Math.round(tamanho * 0.4)
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: tamanho, height: tamanho }}>
      {fotoUrl ? (
        <img
          src={fotoUrl}
          alt=""
          className="w-full h-full rounded-full object-cover"
          style={{ width: tamanho, height: tamanho }}
        />
      ) : (
        <span
          className={cn(
            'w-full h-full rounded-full flex items-center justify-center font-semibold text-white',
            tomAvatar(nome)
          )}
          style={{ fontSize: fonte }}
          aria-hidden="true"
        >
          {iniciais(nome)}
        </span>
      )}
      {whatsapp && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full border-2 border-sf-1 flex items-center justify-center"
          style={{ background: COR_WHATSAPP }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" width="8" height="8" fill="white">
            <path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm5.6 14.1c-.2.6-1.2 1.1-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.5-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6 0-1.2.6-1.8.9-2 .2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.7 1.7c.1.2.1.3 0 .5l-.3.5-.3.3c-.1.1-.3.3-.1.5.1.3.7 1.1 1.4 1.8.9.8 1.7 1 2 1.2.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3.1.1.1.6-.1 1.2z" />
          </svg>
        </span>
      )}
    </span>
  )
}
