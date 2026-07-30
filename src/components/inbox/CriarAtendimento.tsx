import { useState } from 'react'
import { Plus, User, Building2, X } from 'lucide-react'
import {
  useContatos,
  useClientes,
  useCriarAtendimento,
  nomeEmpresa,
  type ContatoResumo,
  type EmpresaResumo,
} from '../../lib/useInbox'
import { useCrud } from '../../lib/useCrud'
import { useUsuarios } from '../../lib/useVinculos'
import { Modal } from '../ui/Modal'
import { Botao } from '../ui/Botao'
import { Selecao, CampoBusca } from '../ui/Campo'
import { cn } from '../../lib/utils'

type Departamento = { id: string; nome: string; ativo: boolean }
type Modo = 'contato' | 'empresa'

function soDigitos(v: string) {
  return v.replace(/\D/g, '')
}

export function CriarAtendimento() {
  const criar = useCriarAtendimento()
  const departamentos = useCrud<Departamento>('departamentos', 'ordem')
  const usuarios = useUsuarios()

  const [aberto, setAberto] = useState(false)
  const [modo, setModo] = useState<Modo | null>(null)
  const [busca, setBusca] = useState('')

  // dados do chamado
  const [contatoId, setContatoId] = useState<string | null>(null)
  const [telefone, setTelefone] = useState('') // só dígitos, sem o +55
  const [nome, setNome] = useState('')
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clienteLabel, setClienteLabel] = useState<string | null>(null)
  const [departamentoId, setDepartamentoId] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const contatos = useContatos(modo === 'contato' ? busca : '')
  const clientes = useClientes(modo === 'empresa' ? busca : '')

  function limpar() {
    setModo(null)
    setBusca('')
    setContatoId(null)
    setTelefone('')
    setNome('')
    setClienteId(null)
    setClienteLabel(null)
    setDepartamentoId('')
    setResponsavelId('')
    setErro(null)
  }

  function fechar() {
    setAberto(false)
    limpar()
  }

  function escolherContato(c: ContatoResumo) {
    setContatoId(c.id)
    setTelefone(soDigitos(c.telefone).replace(/^55/, ''))
    setNome(c.nome ?? c.nome_whatsapp ?? '')
    setClienteId(c.cliente_id)
    setClienteLabel(nomeEmpresa(c.cliente))
    setModo(null)
    setBusca('')
  }

  function escolherEmpresa(e: EmpresaResumo) {
    setClienteId(e.id)
    setClienteLabel(nomeEmpresa(e))
    setModo(null)
    setBusca('')
  }

  async function enviar() {
    setErro(null)
    if (!contatoId && soDigitos(telefone).length < 10) {
      setErro('Escolha um contato ou digite o número completo com DDD.')
      return
    }
    if (!departamentoId) {
      setErro('Escolha o departamento do chamado.')
      return
    }
    try {
      await criar.mutateAsync({
        telefone: contatoId ? null : `+55${soDigitos(telefone)}`,
        nome: nome.trim() || null,
        clienteId: clienteId,
        contatoId: contatoId,
        departamentoId,
        responsavelId: responsavelId || null,
      })
      fechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar o atendimento.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Criar atendimento"
        title="Criar atendimento"
        className="w-8 h-8 shrink-0 rounded-1 flex items-center justify-center text-tx-2 hover:text-tx-1 hover:bg-sf-2 border border-bd-campo transicao"
      >
        <Plus size={16} />
      </button>

      <Modal titulo="Criar atendimento" aberto={aberto} onFechar={fechar}>
        <div className="flex flex-col gap-4">
          <div>
            <div className="rotulo mb-1">Canal</div>
            <div className="text-corpo text-tx-2">
              WhatsApp <span className="text-tx-3">· número do bot entra com a integração</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setModo(modo === 'contato' ? null : 'contato')
                  setBusca('')
                }}
                aria-pressed={modo === 'contato'}
                className={cn(
                  'flex-1 h-8 inline-flex items-center justify-center gap-1.5 rounded-1 text-apoio border transicao',
                  modo === 'contato'
                    ? 'bg-br-soft text-br-2 border-transparent font-medium'
                    : 'bg-sf-2 text-tx-2 border-bd-2 hover:text-tx-1 hover:border-tx-3'
                )}
              >
                <User size={14} /> Buscar por contato
              </button>
              <button
                type="button"
                onClick={() => {
                  setModo(modo === 'empresa' ? null : 'empresa')
                  setBusca('')
                }}
                aria-pressed={modo === 'empresa'}
                className={cn(
                  'flex-1 h-8 inline-flex items-center justify-center gap-1.5 rounded-1 text-apoio border transicao',
                  modo === 'empresa'
                    ? 'bg-br-soft text-br-2 border-transparent font-medium'
                    : 'bg-sf-2 text-tx-2 border-bd-2 hover:text-tx-1 hover:border-tx-3'
                )}
              >
                <Building2 size={14} /> Buscar por empresa
              </button>
            </div>

            {modo && (
              <div>
                <CampoBusca
                  valor={busca}
                  aoMudar={setBusca}
                  rotuloAcessivel={modo === 'contato' ? 'Buscar contato' : 'Buscar empresa'}
                  placeholder={modo === 'contato' ? 'Nome ou telefone do contato' : 'Nome da empresa'}
                  autoFocus
                />
                {busca.trim().length >= 2 && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-1 border border-bd-campo bg-sf-2 divide-y divide-bd-1">
                    {modo === 'contato' ? (
                      (contatos.data ?? []).length === 0 ? (
                        <div className="px-2.5 py-2 text-apoio text-tx-3">
                          {contatos.isLoading ? 'Buscando…' : 'Nenhum contato encontrado.'}
                        </div>
                      ) : (
                        (contatos.data ?? []).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => escolherContato(c)}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-sf-3 transicao"
                          >
                            <div className="text-corpo text-tx-1 truncate">{c.nome || c.nome_whatsapp || 'Sem nome'}</div>
                            <div className="dado text-mini text-tx-3">{c.telefone}</div>
                          </button>
                        ))
                      )
                    ) : (clientes.data ?? []).length === 0 ? (
                      <div className="px-2.5 py-2 text-apoio text-tx-3">
                        {clientes.isLoading ? 'Buscando…' : 'Nenhuma empresa encontrada.'}
                      </div>
                    ) : (
                      (clientes.data ?? []).map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => escolherEmpresa(e)}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-sf-3 transicao text-corpo text-tx-1 truncate"
                        >
                          {nomeEmpresa(e) ?? 'Empresa sem nome'}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-bd-1 pt-3">
            <div>
              <div className="rotulo mb-1.5">Número</div>
              {contatoId ? (
                <div className="flex items-center justify-between gap-2 h-9 px-3 rounded-1 bg-sf-2 border border-bd-campo">
                  <span className="dado text-corpo text-tx-1">+55 {telefone}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setContatoId(null)
                      setTelefone('')
                    }}
                    className="text-mini text-tx-3 hover:text-tx-1 inline-flex items-center gap-1"
                  >
                    <X size={12} /> trocar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="h-9 px-2.5 inline-flex items-center rounded-1 bg-sf-3 border border-bd-campo text-corpo text-tx-2 shrink-0">
                    +55
                  </span>
                  <input
                    value={telefone}
                    onChange={(e) => setTelefone(soDigitos(e.target.value))}
                    inputMode="numeric"
                    placeholder="DDD e número"
                    aria-label="Número do contato"
                    className="dado flex-1 h-9 px-3 text-corpo rounded-1 bg-sf-2 border border-bd-campo text-tx-1 placeholder:text-tx-3 focus:border-br-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]"
                  />
                </div>
              )}
            </div>

            <div>
              <div className="rotulo mb-1.5">Nome</div>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Quem está em contato"
                aria-label="Nome do contato"
                className="w-full h-9 px-3 text-corpo-lg rounded-1 bg-sf-2 border border-bd-campo text-tx-1 placeholder:text-tx-3 focus:border-br-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]"
              />
            </div>

            <div>
              <div className="rotulo mb-1.5">Empresa</div>
              {clienteLabel ? (
                <div className="flex items-center justify-between gap-2 h-9 px-3 rounded-1 bg-sf-2 border border-bd-campo">
                  <span className="text-corpo text-tx-1 truncate">{clienteLabel}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setClienteId(null)
                      setClienteLabel(null)
                    }}
                    className="text-mini text-tx-3 hover:text-tx-1 inline-flex items-center gap-1 shrink-0"
                  >
                    <X size={12} /> remover
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setModo('empresa')
                    setBusca('')
                  }}
                  className="w-full h-9 px-3 text-left text-corpo text-tx-3 rounded-1 bg-sf-2 border border-bd-campo border-dashed hover:border-tx-3 hover:text-tx-2 transicao"
                >
                  Amarrar a uma empresa (opcional)
                </button>
              )}
            </div>

            <Selecao
              rotulo="Departamento"
              value={departamentoId}
              onChange={(e) => setDepartamentoId(e.target.value)}
            >
              <option value="">Selecionar</option>
              {(departamentos.lista.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </Selecao>

            <Selecao
              rotulo="Atendente"
              dica="Sem escolher ninguém, o chamado entra como pendente para a fila."
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
            >
              <option value="">Deixar na fila (pendente)</option>
              {(usuarios.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Selecao>
          </div>

          {erro && <div className="text-apoio text-err">{erro}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <Botao variante="fantasma" onClick={fechar}>
              Cancelar
            </Botao>
            <Botao variante="primario" onClick={enviar} disabled={criar.isPending}>
              {criar.isPending ? 'Criando…' : 'Criar atendimento'}
            </Botao>
          </div>
        </div>
      </Modal>
    </>
  )
}
