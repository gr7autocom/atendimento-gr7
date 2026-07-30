import { useEffect, useId, useRef, useState } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'

// A borda usa bd-campo (3.13:1), não bd-2 (1.31:1): num campo a borda é o que
// diz onde dá para clicar, então precisa dos 3:1 da WCAG 1.4.11. O hover sobe
// para tx-3 (5.12:1) porque bd-3 é MAIS fraco que bd-campo e o hover apagaria
// a borda em vez de destacá-la. O foco usa br-2, que lê sobre superfície escura.
const BASE =
  'w-full rounded-1 bg-sf-2 border border-bd-campo text-tx-1 placeholder:text-tx-3 ' +
  'transicao hover:border-tx-3 focus:border-br-2 focus:outline-none ' +
  'focus:ring-2 focus:ring-[color:var(--br-soft)]'

/**
 * O texto de apoio e o de erro ficam LIGADOS ao campo por `aria-describedby`:
 * antes eles existiam na tela mas o leitor de tela não os associava ao input,
 * então quem não vê ouvia só o rótulo. O erro usa `role="alert"`, que anuncia
 * na hora em que aparece, sem esperar o usuário voltar ao campo.
 */
function Envolucro({
  id,
  rotulo,
  dica,
  erro,
  children,
}: {
  id: string
  rotulo?: string
  dica?: string
  erro?: string | null
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      {rotulo && <span className="text-corpo text-tx-2">{rotulo}</span>}
      {children}
      {erro ? (
        <span id={`${id}-erro`} role="alert" className="text-apoio text-err">
          {erro}
        </span>
      ) : dica ? (
        <span id={`${id}-dica`} className="text-apoio text-tx-3">
          {dica}
        </span>
      ) : null}
    </label>
  )
}

/** Id da descrição que o campo deve apontar: o erro tem prioridade sobre a dica. */
function descricao(id: string, dica?: string, erro?: string | null) {
  if (erro) return `${id}-erro`
  if (dica) return `${id}-dica`
  return undefined
}

export function Entrada({
  rotulo,
  dica,
  erro,
  className,
  ...props
}: { rotulo?: string; dica?: string; erro?: string | null } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <Envolucro id={id} rotulo={rotulo} dica={dica} erro={erro}>
      <input
        {...props}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, dica, erro)}
        className={cn(BASE, 'h-9 px-3 text-corpo-lg', erro && 'border-err', className)}
      />
    </Envolucro>
  )
}

export function AreaTexto({
  rotulo,
  dica,
  erro,
  className,
  ...props
}: { rotulo?: string; dica?: string; erro?: string | null } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <Envolucro id={id} rotulo={rotulo} dica={dica} erro={erro}>
      <textarea
        {...props}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, dica, erro)}
        className={cn(BASE, 'px-3 py-2 text-corpo-lg min-h-20 resize-y', erro && 'border-err', className)}
      />
    </Envolucro>
  )
}

/**
 * Busca com lupa e botão de limpar. Existe porque o mesmo input de busca estava
 * copiado à mão em três telas (inbox, seletor de tags, admin de tags), cada uma
 * com uma variação de classe e nenhuma com o "limpar" que o usuário espera.
 */
export function CampoBusca({
  valor,
  aoMudar,
  rotuloAcessivel,
  placeholder = 'Pesquisar',
  className,
  autoFocus,
}: {
  valor: string
  aoMudar: (v: string) => void
  rotuloAcessivel: string
  placeholder?: string
  className?: string
  autoFocus?: boolean
}) {
  return (
    <div className={cn('relative', className)}>
      <Search
        size={15}
        aria-hidden="true"
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tx-3 pointer-events-none"
      />
      <input
        type="search"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        aria-label={rotuloAcessivel}
        autoFocus={autoFocus}
        className={cn(BASE, 'h-8 pl-8 text-corpo', valor ? 'pr-8' : 'pr-2.5')}
      />
      {valor && (
        <button
          type="button"
          onClick={() => aoMudar('')}
          aria-label="Limpar busca"
          // 24x24: mínimo de alvo de toque da WCAG 2.2.
          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-micro flex items-center justify-center text-tx-3 hover:text-tx-1 hover:bg-sf-3 transicao"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

/**
 * Campo de hora que grava só quando o usuário SAI do campo.
 *
 * Se gravar a cada tecla, o valor volta do servidor no meio da digitação e
 * atropela o que está sendo digitado: digitar "16" acabava virando "06".
 * Aqui o texto fica em estado local enquanto o campo está em foco, e o valor
 * externo só reassume quando o campo não está sendo editado.
 */
export function CampoHora({
  valor,
  aoSalvar,
  rotuloAcessivel,
  className,
}: {
  valor: string
  aoSalvar: (novo: string) => void
  rotuloAcessivel: string
  className?: string
}) {
  const [local, setLocal] = useState(valor)
  const editando = useRef(false)

  useEffect(() => {
    if (!editando.current) setLocal(valor)
  }, [valor])

  return (
    <input
      type="time"
      aria-label={rotuloAcessivel}
      value={local}
      onFocus={() => {
        editando.current = true
      }}
      onChange={(e) => setLocal(e.target.value)}
      // Enter confirma: no campo de hora o Tab só pula entre hora e minuto,
      // então sem isso o usuário pode achar que salvou e não ter saído do campo.
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      onBlur={() => {
        editando.current = false
        // input de hora incompleto devolve string vazia: não grava e volta ao valor atual
        if (!local) {
          setLocal(valor)
          return
        }
        if (local !== valor) aoSalvar(local)
      }}
      className={cn(
        'dado h-8 px-2 text-corpo rounded-1 bg-sf-2 border border-bd-campo text-tx-1',
        'hover:border-tx-3 focus:border-br-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]',
        'transicao',
        className
      )}
    />
  )
}

export function Selecao({
  rotulo,
  dica,
  erro,
  className,
  children,
  ...props
}: { rotulo?: string; dica?: string; erro?: string | null } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <Envolucro id={id} rotulo={rotulo} dica={dica} erro={erro}>
      <select
        {...props}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, dica, erro)}
        className={cn(BASE, 'h-9 px-2.5 text-corpo-lg', erro && 'border-err', className)}
      >
        {children}
      </select>
    </Envolucro>
  )
}
