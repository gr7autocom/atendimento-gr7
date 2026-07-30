import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Topicos } from './Bloco'

export type AbaItem<T extends string> = { id: T; label: string; icone: LucideIcon }

/** Ids que ligam a aba ao seu painel. `idGrupo` isola telas com mais de um conjunto. */
export const idAba = (idGrupo: string, aba: string) => `${idGrupo}-aba-${aba}`
export const idPainel = (idGrupo: string, aba: string) => `${idGrupo}-painel-${aba}`

/**
 * Navegação por abas das telas de admin (Configurações do bot, Departamento,
 * Atendente). Visual único do projeto: pílula ativa na cor da marca, hover suave
 * nas inativas. Genérico sobre o id da aba.
 *
 * Acessibilidade: antes havia `role="tablist"`/`role="tab"` sem `aria-controls`,
 * sem painel correspondente e sem navegação por setas. Semântica pela metade é
 * pior que nenhuma: o leitor de tela anuncia "aba 1 de 3" e o usuário aperta a
 * seta esperando trocar, sem nada acontecer. Agora segue o padrão completo, com
 * roving tabindex (só a aba ativa recebe Tab; setas andam entre elas).
 */
export function Abas<T extends string>({
  abas,
  ativo,
  aoSelecionar,
  idGrupo,
  rotulo,
}: {
  abas: readonly AbaItem<T>[]
  ativo: T
  aoSelecionar: (id: T) => void
  idGrupo: string
  rotulo?: string
}) {
  function aoTeclar(e: React.KeyboardEvent, indice: number) {
    const ultimo = abas.length - 1
    let alvo: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') alvo = indice === ultimo ? 0 : indice + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') alvo = indice === 0 ? ultimo : indice - 1
    else if (e.key === 'Home') alvo = 0
    else if (e.key === 'End') alvo = ultimo
    if (alvo === null) return
    e.preventDefault()
    aoSelecionar(abas[alvo].id)
    // Leva o foco junto, senão o teclado seleciona uma aba e continua na outra.
    document.getElementById(idAba(idGrupo, abas[alvo].id))?.focus()
  }

  return (
    <div role="tablist" aria-label={rotulo} className="flex flex-wrap gap-1">
      {abas.map((a, i) => {
        const Icone = a.icone
        const on = ativo === a.id
        return (
          <button
            key={a.id}
            id={idAba(idGrupo, a.id)}
            type="button"
            role="tab"
            aria-selected={on}
            // Só a aba ativa aponta para painel: as telas renderizam apenas o
            // painel selecionado, e aria-controls para um id inexistente é
            // referência quebrada para o leitor de tela.
            aria-controls={on ? idPainel(idGrupo, a.id) : undefined}
            tabIndex={on ? 0 : -1}
            onKeyDown={(e) => aoTeclar(e, i)}
            onClick={() => aoSelecionar(a.id)}
            className={cn(
              'flex items-center gap-2 h-9 px-3.5 rounded-2 text-corpo font-medium transicao',
              on ? 'bg-br-1 text-white' : 'text-tx-2 hover:text-tx-1 hover:bg-sf-2'
            )}
          >
            <Icone size={15} aria-hidden="true" />
            {a.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Painel de conteúdo de uma aba: card padrão + orientação opcional em tópicos.
 * Usa `p-4` e o `Topicos` do `Bloco`: eram dois cards com a mesma cara e
 * espaçamento interno diferente (p-5 aqui, p-4 lá), o que fazia as telas de
 * admin parecerem desalinhadas ao trocar de aba.
 */
export function PainelAba({
  topicos,
  idGrupo,
  aba,
  children,
}: {
  topicos?: string[]
  /** Mesmo `idGrupo` passado às `Abas`, para o painel se ligar à aba. */
  idGrupo?: string
  /** Id da aba que este painel mostra. */
  aba?: string
  children: React.ReactNode
}) {
  const ligado = idGrupo && aba
  return (
    <div
      id={ligado ? idPainel(idGrupo, aba) : undefined}
      role={ligado ? 'tabpanel' : undefined}
      aria-labelledby={ligado ? idAba(idGrupo, aba) : undefined}
      // tabIndex 0: o painel entra na ordem do Tab depois da aba, que é como o
      // usuário de teclado chega ao conteúdo que acabou de escolher.
      tabIndex={ligado ? 0 : undefined}
      className="rounded-2 border border-bd-1 bg-sf-1 p-4"
    >
      {topicos && <Topicos itens={topicos} className="mb-4" />}
      {children}
    </div>
  )
}
