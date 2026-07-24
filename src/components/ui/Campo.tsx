import { useEffect, useRef, useState } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

const BASE =
  'w-full rounded-[6px] bg-sf-2 border border-bd-2 text-tx-1 placeholder:text-tx-3 ' +
  'transition-colors duration-[120ms] hover:border-bd-3 focus:border-br-1 focus:outline-none ' +
  'focus:ring-2 focus:ring-[color:var(--br-soft)]'

function Envolucro({
  rotulo,
  dica,
  erro,
  children,
}: {
  rotulo?: string
  dica?: string
  erro?: string | null
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      {rotulo && <span className="text-[13px] text-tx-2">{rotulo}</span>}
      {children}
      {erro ? (
        <span className="text-[12px] text-err">{erro}</span>
      ) : dica ? (
        <span className="text-[12px] text-tx-3">{dica}</span>
      ) : null}
    </label>
  )
}

export function Entrada({
  rotulo,
  dica,
  erro,
  className,
  ...props
}: { rotulo?: string; dica?: string; erro?: string | null } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Envolucro rotulo={rotulo} dica={dica} erro={erro}>
      <input {...props} className={cn(BASE, 'h-9 px-3 text-sm', erro && 'border-err', className)} />
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
  return (
    <Envolucro rotulo={rotulo} dica={dica} erro={erro}>
      <textarea {...props} className={cn(BASE, 'px-3 py-2 text-sm min-h-20 resize-y', className)} />
    </Envolucro>
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
        'dado h-8 px-2 text-[13px] rounded-[6px] bg-sf-2 border border-bd-2 text-tx-1',
        'hover:border-bd-3 focus:border-br-1 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]',
        'transition-colors duration-[120ms]',
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
  return (
    <Envolucro rotulo={rotulo} dica={dica} erro={erro}>
      <select {...props} className={cn(BASE, 'h-9 px-2.5 text-sm', className)}>
        {children}
      </select>
    </Envolucro>
  )
}
