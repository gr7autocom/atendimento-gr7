import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Tag as IconeTag } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { Modal, ModalConfirmar } from '../../components/ui/Modal'
import { Botao } from '../../components/ui/Botao'
import { Entrada, Selecao, CampoBusca } from '../../components/ui/Campo'
import { Selo } from '../../components/ui/Selo'
import { PillTag } from '../../components/ui/PillTag'
import { CabecalhoAdmin } from '../../components/admin/CabecalhoAdmin'
import { Vazio, LinhasCarregando } from '../../components/ui/Estados'

type Tag = {
  id: string
  nome: string
  ordem: number
  ativo?: boolean
  cor_fundo?: string | null
  cor_texto?: string | null
  departamento_id?: string | null
}
type Departamento = { id: string; nome: string; ativo?: boolean }

const COR_FUNDO_PADRAO = '#1f6feb'
const COR_TEXTO_PADRAO = '#ffffff'

/** Cor: seletor nativo + hex sincronizados, para o admin acertar o tom exato. */
function CampoCor({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-corpo text-tx-2">{rotulo}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={rotulo}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          className="w-9 h-9 shrink-0 rounded-1 border border-bd-campo bg-sf-2 cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          spellCheck={false}
          className="dado w-full h-9 px-3 text-corpo-lg rounded-1 bg-sf-2 border border-bd-campo text-tx-1 placeholder:text-tx-3 hover:border-tx-3 focus:border-br-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)] transicao"
        />
      </div>
    </label>
  )
}

export function Tags() {
  const { lista, criar, atualizar, remover } = useCrud<Tag>('atendimento_tags')
  const departamentos = useCrud<Departamento>('departamentos', 'ordem')
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Tag | null>(null)
  const [nome, setNome] = useState('')
  const [corFundo, setCorFundo] = useState(COR_FUNDO_PADRAO)
  const [corTexto, setCorTexto] = useState(COR_TEXTO_PADRAO)
  const [departamentoId, setDepartamentoId] = useState('')
  // Guarda a tag que está para ser removida: o modal precisa do nome para dizer
  // o que vai apagar, e o `confirm()` do navegador não combinava com o tema.
  const [removerTag, setRemoverTag] = useState<Tag | null>(null)
  const [erroRemover, setErroRemover] = useState<string | null>(null)

  const itens = lista.data ?? []
  const deps = departamentos.lista.data ?? []
  const nomeDep = (id?: string | null) =>
    id ? deps.find((d) => d.id === id)?.nome ?? 'Departamento' : null

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return itens
    return itens.filter((t) => t.nome?.toLowerCase().includes(termo))
  }, [itens, busca])

  function abrirNovo() {
    setEditando(null)
    setNome('')
    setCorFundo(COR_FUNDO_PADRAO)
    setCorTexto(COR_TEXTO_PADRAO)
    setDepartamentoId('')
    setAberto(true)
  }

  function abrirEdicao(t: Tag) {
    setEditando(t)
    setNome(t.nome ?? '')
    setCorFundo(t.cor_fundo || COR_FUNDO_PADRAO)
    setCorTexto(t.cor_texto || COR_TEXTO_PADRAO)
    setDepartamentoId(t.departamento_id ?? '')
    setAberto(true)
  }

  function salvar() {
    const valores = {
      nome: nome.trim(),
      cor_fundo: corFundo,
      cor_texto: corTexto,
      departamento_id: departamentoId || null,
    }
    if (editando) {
      atualizar.mutate({ id: editando.id, valores })
    } else {
      const maior = itens.reduce((m, t) => Math.max(m, t.ordem ?? 0), 0)
      criar.mutate({ ...valores, ordem: maior + 1 })
    }
    setAberto(false)
  }

  return (
    <div className="w-full">
      <CabecalhoAdmin
        titulo="Tags"
        descricao="Rótulos que o atendente aplica ao chamado. Valem para todos os departamentos ou um específico."
        acoes={
          <>
            <CampoBusca
              valor={busca}
              aoMudar={setBusca}
              rotuloAcessivel="Buscar tag"
              placeholder="Buscar tag"
              className="w-44"
            />
            <Botao variante="primario" tamanho="sm" onClick={abrirNovo} icone={<Plus size={15} />}>
              Nova tag
            </Botao>
          </>
        }
      />

      {lista.isLoading ? (
        <LinhasCarregando linhas={6} />
      ) : itens.length === 0 ? (
        <div className="rounded-2 border border-bd-1 bg-sf-1">
          <Vazio
            icone={<IconeTag size={22} />}
            titulo="Nenhuma tag ainda"
            descricao="Crie a primeira tag para o atendente classificar os chamados."
            acao={
              <Botao variante="neutro" tamanho="sm" onClick={abrirNovo} icone={<Plus size={15} />}>
                Nova tag
              </Botao>
            }
          />
        </div>
      ) : (
        <div className="rounded-2 border border-bd-1 bg-sf-1 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_auto] items-center gap-3 px-4 h-9 border-b border-bd-1 text-mini font-medium uppercase tracking-wide text-tx-3">
            <span>Tag</span>
            <span className="hidden sm:block">Departamento</span>
            <span className="text-right">Ações</span>
          </div>
          {filtradas.length === 0 ? (
            <p className="px-4 py-8 text-center text-corpo text-tx-3">Nenhuma tag encontrada.</p>
          ) : (
            filtradas.map((t) => {
              const inativo = t.ativo === false
              const dep = nomeDep(t.departamento_id)
              return (
                <div
                  key={t.id}
                  className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_auto] items-center gap-3 px-4 py-2.5 border-b border-bd-1 last:border-b-0 hover:bg-sf-2 transicao"
                >
                  <div className={'flex items-center gap-2 min-w-0 ' + (inativo ? 'opacity-50' : '')}>
                    <PillTag tag={t} />
                  </div>
                  <div className="hidden sm:block min-w-0">
                    {dep ? (
                      <Selo tom="neutro">{dep}</Selo>
                    ) : (
                      <span className="text-apoio text-tx-3">Todos os departamentos</span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      type="button"
                      aria-pressed={!inativo}
                      onClick={() => atualizar.mutate({ id: t.id, valores: { ativo: inativo } })}
                      title={inativo ? 'Clique para ativar' : 'Clique para desativar'}
                      className="mr-1 rounded-1 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]"
                    >
                      <Selo tom={inativo ? 'neutro' : 'ok'}>{inativo ? 'Inativa' : 'Ativa'}</Selo>
                    </button>
                    <Botao variante="fantasma" tamanho="sm" aria-label={`Editar ${t.nome}`} onClick={() => abrirEdicao(t)}>
                      <Pencil size={15} />
                    </Botao>
                    <Botao
                      variante="perigo"
                      tamanho="sm"
                      aria-label={`Remover ${t.nome}`}
                      onClick={() => setRemoverTag(t)}
                    >
                      <Trash2 size={15} />
                    </Botao>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      <ModalConfirmar
        aberto={!!removerTag}
        titulo="Remover tag"
        descricao={
          <>
            A tag <strong className="text-tx-1">{removerTag?.nome}</strong> sai dos chamados que já a usam. Não
            dá para desfazer.
          </>
        }
        carregando={remover.isPending}
        erro={erroRemover}
        aoConfirmar={() => {
          if (!removerTag) return
          setErroRemover(null)
          // Fecha só quando o servidor confirma: fechando junto com o mutate, o
          // estado de carregando não aparece e a falha passa em silêncio.
          remover.mutate(removerTag.id, {
            onSuccess: () => setRemoverTag(null),
            onError: () => setErroRemover('Não foi possível remover. Tente de novo.'),
          })
        }}
        aoCancelar={() => {
          setRemoverTag(null)
          setErroRemover(null)
        }}
      />

      <Modal
        titulo={editando ? 'Editar tag' : 'Nova tag'}
        aberto={aberto}
        onFechar={() => setAberto(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            salvar()
          }}
          className="flex flex-col gap-3"
        >
          <Entrada rotulo="Texto" required value={nome} onChange={(e) => setNome(e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <CampoCor rotulo="Cor de fundo" valor={corFundo} aoMudar={setCorFundo} />
            <CampoCor rotulo="Cor do texto" valor={corTexto} aoMudar={setCorTexto} />
          </div>

          <Selecao
            rotulo="Departamento"
            value={departamentoId}
            onChange={(e) => setDepartamentoId(e.target.value)}
          >
            <option value="">Todos os departamentos</option>
            {deps.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </Selecao>

          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-corpo text-tx-2">Prévia:</span>
            <PillTag tag={{ nome: nome || 'Exemplo', cor_fundo: corFundo, cor_texto: corTexto }} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Botao variante="fantasma" type="button" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao variante="primario" type="submit">
              {editando ? 'Salvar' : 'Enviar'}
            </Botao>
          </div>
        </form>
      </Modal>
    </div>
  )
}
