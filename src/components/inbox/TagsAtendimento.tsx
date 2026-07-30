import { useMemo, useState } from 'react'
import { X, Check, Tag as IconeTag } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { useTagsDoAtendimento, useAcoesTags } from '../../lib/useInbox'
import { corTag } from '../../lib/cores'
import { useFecharFora } from '../../lib/useFecharFora'
import { PillTag } from '../ui/PillTag'
import { CampoBusca } from '../ui/Campo'
import { cn } from '../../lib/utils'

type TagCatalogo = {
  id: string
  nome: string
  ordem: number
  ativo?: boolean
  cor_fundo?: string | null
  cor_texto?: string | null
  departamento_id?: string | null
}

/** Tags aplicáveis: ativas e do departamento do chamado (ou marcadas "Todos"). */
function useAplicaveis(departamentoId: string | null) {
  const catalogo = useCrud<TagCatalogo>('atendimento_tags')
  const disponiveis = (catalogo.lista.data ?? []).filter(
    (t) => t.ativo !== false && (t.departamento_id == null || t.departamento_id === departamentoId)
  )
  return disponiveis
}

/**
 * Ícone de tag no cabeçalho que abre um dropdown com busca e a lista de tags
 * aplicáveis. Marcar/desmarcar aplica ou remove na hora (uma ou várias).
 */
export function SeletorTags({
  atendimentoId,
  departamentoId,
  usuarioId,
}: {
  atendimentoId: string
  departamentoId: string | null
  usuarioId: string | null
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  // Clique fora e Esc: hook compartilhado (lib/useFecharFora).
  const ref = useFecharFora<HTMLDivElement>(aberto, () => setAberto(false))

  const aplicadas = useTagsDoAtendimento(atendimentoId)
  const disponiveis = useAplicaveis(departamentoId)
  const { aplicar, remover } = useAcoesTags()

  const aplicadasIds = useMemo(
    () => new Set((aplicadas.data ?? []).map((t) => t.tag_id)),
    [aplicadas.data]
  )

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return disponiveis
    return disponiveis.filter((t) => t.nome?.toLowerCase().includes(termo))
  }, [disponiveis, busca])

  function alternar(tag: TagCatalogo) {
    if (aplicadasIds.has(tag.id)) {
      remover.mutate({ atendimentoId, tagId: tag.id })
    } else {
      aplicar.mutate({ atendimentoId, tagId: tag.id, usuarioId })
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Tags do atendimento"
        title="Tags"
        className={cn(
          'w-8 h-8 rounded-1 flex items-center justify-center transicao',
          aberto ? 'bg-sf-2 text-tx-1' : 'text-tx-2 hover:text-tx-1 hover:bg-sf-2'
        )}
      >
        <IconeTag size={16} />
      </button>

      {aberto && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-[min(320px,calc(100vw-24px))] rounded-2 border border-bd-2 bg-sf-3 shadow-2">
          <div className="p-2 border-b border-bd-1">
            <CampoBusca valor={busca} aoMudar={setBusca} rotuloAcessivel="Pesquisar tag" autoFocus />
          </div>
          <div className="max-h-[300px] overflow-y-auto py-1">
            {disponiveis.length === 0 ? (
              <p className="px-3 py-6 text-center text-corpo text-tx-3">
                Nenhuma tag disponível para este setor.
              </p>
            ) : filtradas.length === 0 ? (
              <p className="px-3 py-6 text-center text-corpo text-tx-3">Nenhuma tag encontrada.</p>
            ) : (
              filtradas.map((tag) => {
                const marcada = aplicadasIds.has(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={marcada}
                    onClick={() => alternar(tag)}
                    className={cn(
                      'flex items-center gap-2.5 w-full px-3 h-10 text-left transicao',
                      marcada ? 'bg-sf-2' : 'hover:bg-sf-2'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'w-4 h-4 shrink-0 rounded-micro border flex items-center justify-center',
                        marcada ? 'bg-br-1 border-br-1 text-white' : 'border-bd-3'
                      )}
                    >
                      {marcada && <Check size={12} />}
                    </span>
                    <PillTag tag={tag} />
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Faixa de chips com as tags já aplicadas ao chamado, sob o cabeçalho. */
export function FaixaTagsAplicadas({
  atendimentoId,
  podeEditar,
}: {
  atendimentoId: string
  podeEditar: boolean
}) {
  const aplicadas = useTagsDoAtendimento(atendimentoId)
  const { remover } = useAcoesTags()
  const chips = (aplicadas.data ?? []).filter((t) => t.tag)

  if (chips.length === 0) return null

  return (
    <div className="shrink-0 px-3 sm:px-4 py-2 border-b border-bd-1 bg-sf-1 flex flex-wrap items-center gap-1.5">
      {chips.map((t) => {
        const cor = corTag(t.tag!)
        return (
          <span
            key={t.tag_id}
            style={{ background: cor.bg, color: cor.fg }}
            className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-1 text-apoio font-semibold uppercase tracking-wide"
          >
            {t.tag!.nome}
            {podeEditar && (
              <button
                type="button"
                onClick={() => remover.mutate({ atendimentoId, tagId: t.tag_id })}
                aria-label={`Remover tag ${t.tag!.nome}`}
                className="w-4 h-4 inline-flex items-center justify-center rounded hover:bg-black/25"
              >
                <X size={12} />
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}
