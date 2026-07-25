import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, MessageSquareText } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { Modal } from '../../components/ui/Modal'
import { Botao } from '../../components/ui/Botao'
import { Entrada, AreaTexto, Selecao } from '../../components/ui/Campo'
import { Selo } from '../../components/ui/Selo'
import { Vazio, LinhasCarregando } from '../../components/ui/Estados'
import { CabecalhoAdmin } from '../../components/admin/CabecalhoAdmin'

type MsgRapida = {
  id: string
  atalho: string
  titulo?: string | null
  texto: string
  ativo?: boolean
  departamento_id?: string | null
}
type Departamento = { id: string; nome: string; ativo?: boolean }

export function MensagensRapidas() {
  const { lista, criar, atualizar, remover } = useCrud<MsgRapida>('atendimento_mensagens_rapidas', 'atalho')
  const departamentos = useCrud<Departamento>('departamentos', 'ordem')

  const [fMensagem, setFMensagem] = useState('')
  const [fPalavra, setFPalavra] = useState('')
  const [fDep, setFDep] = useState('')

  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<MsgRapida | null>(null)
  const [atalho, setAtalho] = useState('')
  const [texto, setTexto] = useState('')
  const [departamentoId, setDepartamentoId] = useState('')

  const itens = lista.data ?? []
  const deps = departamentos.lista.data ?? []
  const nomeDep = (id?: string | null) => (id ? deps.find((d) => d.id === id)?.nome ?? 'Departamento' : null)

  const filtradas = useMemo(() => {
    const m = fMensagem.trim().toLowerCase()
    const p = fPalavra.trim().toLowerCase()
    return itens.filter((i) => {
      if (fDep && i.departamento_id !== fDep) return false
      if (m && !i.texto?.toLowerCase().includes(m)) return false
      if (p && !i.atalho?.toLowerCase().includes(p)) return false
      return true
    })
  }, [itens, fMensagem, fPalavra, fDep])

  function abrirNovo() {
    setEditando(null)
    setAtalho('')
    setTexto('')
    setDepartamentoId('')
    setAberto(true)
  }

  function abrirEdicao(i: MsgRapida) {
    setEditando(i)
    setAtalho(i.atalho ?? '')
    setTexto(i.texto ?? '')
    setDepartamentoId(i.departamento_id ?? '')
    setAberto(true)
  }

  function salvar() {
    const nome = atalho.trim()
    const valores = {
      atalho: nome,
      titulo: nome, // usamos o atalho como identificador; a coluna titulo continua existindo
      texto: texto.trim(),
      departamento_id: departamentoId || null,
    }
    if (editando) atualizar.mutate({ id: editando.id, valores })
    else criar.mutate({ ...valores, ativo: true })
    setAberto(false)
  }

  return (
    <div className="w-full">
      <CabecalhoAdmin
        titulo="Mensagens rápidas"
        descricao="Respostas prontas que o atendente aciona no chat digitando / seguido da palavra-chave. Podem valer para todos os departamentos ou um específico."
        acoes={
          <Botao variante="primario" tamanho="sm" onClick={abrirNovo} icone={<Plus size={15} />}>
            Nova mensagem
          </Botao>
        }
      />

      <div className="rounded-[10px] border border-bd-1 bg-sf-1 p-3 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Entrada
          rotulo="Mensagem"
          placeholder="Buscar no texto"
          value={fMensagem}
          onChange={(e) => setFMensagem(e.target.value)}
        />
        <Entrada
          rotulo="Palavra-chave"
          placeholder="Buscar no atalho"
          value={fPalavra}
          onChange={(e) => setFPalavra(e.target.value)}
        />
        <Selecao rotulo="Departamento" value={fDep} onChange={(e) => setFDep(e.target.value)}>
          <option value="">Todos</option>
          {deps.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </Selecao>
      </div>

      {lista.isLoading ? (
        <LinhasCarregando linhas={6} />
      ) : itens.length === 0 ? (
        <div className="rounded-[10px] border border-bd-1 bg-sf-1">
          <Vazio
            icone={<MessageSquareText size={22} />}
            titulo="Nenhuma mensagem rápida"
            descricao="Crie a primeira resposta pronta para o atendente usar no chat."
            acao={
              <Botao variante="neutro" tamanho="sm" onClick={abrirNovo} icone={<Plus size={15} />}>
                Nova mensagem
              </Botao>
            }
          />
        </div>
      ) : (
        <div className="rounded-[10px] border border-bd-1 bg-sf-1 overflow-hidden">
          <div className="grid grid-cols-[140px_1fr_auto] sm:grid-cols-[160px_1fr_180px_auto] items-center gap-3 px-4 h-9 border-b border-bd-1 text-[11px] font-medium uppercase tracking-wide text-tx-3">
            <span>Palavra-chave</span>
            <span>Mensagem</span>
            <span className="hidden sm:block">Departamento</span>
            <span className="text-right">Ações</span>
          </div>
          {filtradas.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-tx-3">Nenhuma mensagem encontrada.</p>
          ) : (
            filtradas.map((i) => {
              const inativo = i.ativo === false
              const dep = nomeDep(i.departamento_id)
              return (
                <div
                  key={i.id}
                  className="grid grid-cols-[140px_1fr_auto] sm:grid-cols-[160px_1fr_180px_auto] items-center gap-3 px-4 py-2.5 border-b border-bd-1 last:border-b-0 hover:bg-sf-2 transition-colors"
                >
                  <span className={'dado text-[13px] truncate ' + (inativo ? 'text-tx-3' : 'text-br-2')}>
                    /{i.atalho}
                  </span>
                  <span className={'text-[13px] truncate ' + (inativo ? 'text-tx-3' : 'text-tx-2')}>
                    {i.texto}
                  </span>
                  <div className="hidden sm:block min-w-0">
                    {dep ? (
                      <Selo tom="neutro">{dep}</Selo>
                    ) : (
                      <span className="text-[12px] text-tx-3">Todos os departamentos</span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      type="button"
                      aria-pressed={!inativo}
                      onClick={() => atualizar.mutate({ id: i.id, valores: { ativo: inativo } })}
                      title={inativo ? 'Clique para ativar' : 'Clique para desativar'}
                      className="mr-1 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]"
                    >
                      <Selo tom={inativo ? 'neutro' : 'ok'}>{inativo ? 'Inativa' : 'Ativa'}</Selo>
                    </button>
                    <Botao variante="fantasma" tamanho="sm" aria-label={`Editar ${i.atalho}`} onClick={() => abrirEdicao(i)}>
                      <Pencil size={15} />
                    </Botao>
                    <Botao
                      variante="perigo"
                      tamanho="sm"
                      aria-label={`Remover ${i.atalho}`}
                      onClick={() => {
                        if (confirm(`Remover a mensagem "/${i.atalho}"?`)) remover.mutate(i.id)
                      }}
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

      <Modal
        titulo={editando ? 'Editar mensagem rápida' : 'Nova mensagem rápida'}
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
          <div className="rounded-[8px] border border-bd-1 bg-sf-2 px-3 py-2 text-[12px] text-tx-2">
            Você pode usar variáveis no texto: <span className="dado text-tx-1">{'{{agent.name}}'}</span> (seu nome) e{' '}
            <span className="dado text-tx-1">{'{{contact.name}}'}</span> (nome do contato).
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

          <Entrada
            rotulo="Palavra-chave (depois da /)"
            dica="Sem espaços fica mais fácil de digitar. Ex.: bomdia, inicio-atendimento."
            required
            value={atalho}
            onChange={(e) => setAtalho(e.target.value)}
          />

          <AreaTexto
            rotulo="Mensagem"
            required
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="min-h-28"
          />

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
