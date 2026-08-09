import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Botao } from './Botao'
import { cn } from '../../lib/utils'

const FOCAVEIS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Mesma API do antigo AdminModal, para trocar sem refatorar as telas. */
/*
  Larguras por papel, não por gosto. `padrao` cobre formulário e confirmação,
  que é a esmagadora maioria. `ampla` existe para conteúdo que perde sentido
  espremido: a visualização de um anexo, onde o ponto é justamente enxergar o
  arquivo. Acrescentar um terceiro valor pede o mesmo critério: um papel novo,
  não uma tela que quis um pouco mais de espaço.
*/
const LARGURAS = {
  padrao: 'max-w-md',
  ampla: 'max-w-4xl',
} as const

export function Modal({
  titulo,
  aberto,
  onFechar,
  children,
  largura = 'padrao',
  fechavel = true,
}: {
  titulo: string
  aberto: boolean
  onFechar: () => void
  children: ReactNode
  largura?: keyof typeof LARGURAS
  /**
   * `false` tira o X, o Esc e o clique fora. É para o caso raro em que a tela
   * só continua depois de uma resposta obrigatória (a nota de avaliação do
   * cliente, por exemplo) — sem isso, "fechar" deixaria a pessoa num limbo
   * sem ação nenhuma disponível, porque não existe conteúdo por trás para
   * onde voltar. Continua um `role="dialog"` normal: quem usa teclado só não
   * encontra uma saída, porque genuinamente não há uma.
   */
  fechavel?: boolean
}) {
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto || !fechavel) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto, fechavel, onFechar])

  /**
   * Foco: sem isso o Tab continuava passeando pela tela ATRÁS do diálogo, então
   * quem usa teclado não sabia onde estava. Ao abrir, o foco entra no primeiro
   * campo (ou na própria caixa); ao fechar, volta para o botão que abriu.
   */
  useEffect(() => {
    if (!aberto) return
    const anterior = document.activeElement as HTMLElement | null
    // Prefere o primeiro CAMPO, não o primeiro focável: o botão Fechar vem antes
    // no DOM e receber o foco nele fazia o diálogo abrir apontando para a saída.
    const campo = caixa.current?.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    )
    const primeiro = campo ?? caixa.current?.querySelector<HTMLElement>(FOCAVEIS)
    ;(primeiro ?? caixa.current)?.focus()
    return () => anterior?.focus?.()
  }, [aberto])

  // Prende o Tab dentro do diálogo, ciclando do último de volta ao primeiro.
  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return
    const alvos = Array.from(caixa.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? [])
    if (alvos.length === 0) return
    const primeiro = alvos[0]
    const ultimo = alvos[alvos.length - 1]
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primeiro.focus()
    }
  }

  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={fechavel ? onFechar : undefined}
    >
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        onKeyDown={aoTeclar}
        onClick={(e) => e.stopPropagation()}
        className={cn('w-full rounded-2 bg-sf-3 border border-bd-2 shadow-2', LARGURAS[largura])}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-bd-1">
          <h2 className="text-corpo-lg font-semibold text-tx-1">{titulo}</h2>
          {fechavel && (
            <Botao variante="fantasma" tamanho="sm" onClick={onFechar} aria-label="Fechar">
              <X size={16} />
            </Botao>
          )}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

/**
 * Confirmação de ação destrutiva. Substitui o `confirm()` do navegador, que
 * aparecia em tema claro do sistema, ignorava a identidade do produto e não
 * dava para dizer o que exatamente ia acontecer.
 *
 * Quem chama deve fechar no `onSuccess` da mutação, não junto com o `mutate`:
 * fechando no mesmo tique, o `carregando` nunca aparece e a remoção some da
 * tela antes de ter acontecido. Se falhar, passe `erro` e o modal continua
 * aberto explicando, em vez de sumir como se tivesse dado certo.
 */
export function ModalConfirmar({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar = 'Remover',
  carregando = false,
  erro,
  aoConfirmar,
  aoCancelar,
}: {
  aberto: boolean
  titulo: string
  descricao: ReactNode
  rotuloConfirmar?: string
  carregando?: boolean
  erro?: string | null
  aoConfirmar: () => void
  aoCancelar: () => void
}) {
  return (
    <Modal titulo={titulo} aberto={aberto} onFechar={aoCancelar}>
      <div className="flex flex-col gap-4">
        <p className="text-corpo text-tx-2">{descricao}</p>
        {erro && (
          <p role="alert" className="text-apoio text-err">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Botao variante="fantasma" onClick={aoCancelar}>
            Cancelar
          </Botao>
          <Botao variante="perigo" onClick={aoConfirmar} carregando={carregando}>
            {rotuloConfirmar}
          </Botao>
        </div>
      </div>
    </Modal>
  )
}
