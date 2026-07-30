import { useEffect, useRef } from 'react'

/**
 * Fecha o painel ao clicar fora ou apertar Esc, e devolve a ref para envolver o
 * conjunto gatilho + painel.
 *
 * O mesmo `useEffect` de "clicou fora" estava escrito três vezes (menu do
 * usuário, menu ⋮ da conversa e seletor de tags), e nenhuma das três fechava com
 * Esc, que é o reflexo de quem usa teclado.
 */
export function useFecharFora<T extends HTMLElement = HTMLDivElement>(aberto: boolean, aoFechar: () => void) {
  const ref = useRef<T>(null)
  // O callback vive numa ref porque quem chama passa arrow inline
  // (`() => setAberto(false)`), nova a cada render. Se o efeito dependesse dela,
  // os listeners seriam removidos e readicionados a cada render com o menu
  // aberto. Assim o efeito só reage a `aberto`, e a ref sempre tem a versão atual.
  const aoFecharRef = useRef(aoFechar)
  aoFecharRef.current = aoFechar

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) aoFecharRef.current()
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') aoFecharRef.current()
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  return ref
}
