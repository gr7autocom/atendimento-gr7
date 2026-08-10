import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useFecharFora } from '../../lib/useFecharFora'

/**
 * Menu do botão direito, posicionado no cursor.
 *
 * Portado do `ContextMenu` do Talks, com o visual trocado pelos tokens daqui.
 * O que veio de lá é o miolo, que é onde estão as horas de detalhe: medir o
 * menu depois de montado e puxá-lo para dentro quando estoura a borda, e fechar
 * em clique fora, Esc, rolagem e redimensionamento.
 *
 * A rolagem é escutada em **captura** de propósito: a conversa rola num
 * contêiner interno, e o evento dela não sobe até a janela. Sem `true` ali, o
 * menu ficaria parado no ar enquanto a mensagem que o abriu sobe.
 *
 * Vai por portal no `body` porque a bolha da conversa tem `overflow` e recortaria
 * o menu ao ser aberto perto da borda.
 */

export type ItemContexto = {
  rotulo: string
  icone: LucideIcon
  onClick: () => void
  variante?: 'perigo'
  /**
   * Item visível mas sem ação — o prazo de editar/apagar já passou, por
   * exemplo. Continua na lista, e não desaparece: some faria a pessoa achar
   * que a função nunca existiu. `motivo` é o `title` do botão, e é o que
   * explica o porquê sem precisar de tela de erro depois do clique.
   */
  desabilitado?: boolean
  motivo?: string
}

const MARGEM = 8

export function MenuContexto({
  x,
  y,
  itens,
  onFechar,
}: {
  x: number
  y: number
  itens: ItemContexto[]
  onFechar: () => void
}) {
  // Clique fora e Esc vêm do hook compartilhado, o mesmo dos outros menus do
  // projeto. Aqui sobram rolagem e redimensionamento, que são específicos de um
  // menu ancorado numa coordenada da tela.
  const ref = useFecharFora<HTMLDivElement>(true, onFechar)
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    let left = x
    let top = y
    if (left + width > window.innerWidth - MARGEM) left = window.innerWidth - width - MARGEM
    if (top + height > window.innerHeight - MARGEM) top = window.innerHeight - height - MARGEM
    setPos({ left: Math.max(MARGEM, left), top: Math.max(MARGEM, top) })
  }, [x, y])

  useEffect(() => {
    window.addEventListener('resize', onFechar)
    window.addEventListener('scroll', onFechar, true)
    return () => {
      window.removeEventListener('resize', onFechar)
      window.removeEventListener('scroll', onFechar, true)
    }
  }, [onFechar])

  // O foco entra no menu ao abrir: quem usa teclado precisa alcançar os itens,
  // e sem isto o Tab continuaria de onde estava, atrás do menu.
  useEffect(() => {
    ref.current?.querySelector('button')?.focus()
  }, [])

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-50 min-w-[190px] py-1 rounded-2 bg-sf-3 border border-bd-2 shadow-2"
    >
      {itens.map((item) => {
        const Icone = item.icone
        return (
          <button
            key={item.rotulo}
            type="button"
            role="menuitem"
            disabled={item.desabilitado}
            aria-disabled={item.desabilitado}
            title={item.desabilitado ? item.motivo : undefined}
            onClick={() => {
              item.onClick()
              onFechar()
            }}
            className={cn(
              'flex items-center gap-2 w-full h-10 px-3 text-corpo text-left transicao',
              'focus:outline-none focus:bg-sf-2',
              item.desabilitado
                ? 'text-tx-3 opacity-60 cursor-not-allowed hover:bg-transparent focus:bg-transparent'
                : item.variante === 'perigo'
                  ? 'text-err hover:bg-err-soft'
                  : 'text-tx-1 hover:bg-sf-2'
            )}
          >
            <Icone size={15} className={cn('shrink-0', !item.desabilitado && item.variante !== 'perigo' && 'text-tx-2')} />
            {item.rotulo}
          </button>
        )
      })}
    </div>,
    document.body
  )
}
