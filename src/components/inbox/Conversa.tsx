import { useState, type FormEvent } from 'react'
import { Send, UserCheck, ArrowLeftRight, CheckCheck, UserPlus, MessagesSquare } from 'lucide-react'
import { useMensagens, useAcoesAtendimento, type AtendimentoLista } from '../../lib/useInbox'
import { useCrud } from '../../lib/useCrud'
import { useUsuarios } from '../../lib/useVinculos'
import { AceitarPotencial } from './AceitarPotencial'
import { Modal } from '../ui/Modal'
import { Botao } from '../ui/Botao'
import { Selecao } from '../ui/Campo'
import { PontoStatus } from '../ui/Selo'
import { LinhasCarregando } from '../ui/Estados'
import { cn } from '../../lib/utils'

type Departamento = { id: string; nome: string; ativo: boolean }
type Motivo = { id: string; nome: string; ativo: boolean }

function nomeContato(a: AtendimentoLista) {
  return a.contato?.nome || a.contato?.nome_whatsapp || a.contato?.telefone || 'Sem nome'
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function Conversa({
  atendimento,
  usuarioId,
}: {
  atendimento: AtendimentoLista | null
  usuarioId: string | null
}) {
  const mensagens = useMensagens(atendimento?.id ?? null)
  const { assumir, responder, finalizar, transferir } = useAcoesAtendimento()
  const departamentos = useCrud<Departamento>('departamentos')
  const motivos = useCrud<Motivo>('atendimento_motivos')
  const usuarios = useUsuarios()

  const [texto, setTexto] = useState('')
  const [modalTransferir, setModalTransferir] = useState(false)
  const [modalFinalizar, setModalFinalizar] = useState(false)
  const [modalAceitar, setModalAceitar] = useState(false)
  const [destinoDep, setDestinoDep] = useState('')
  const [destinoUsuario, setDestinoUsuario] = useState('')
  const [motivoId, setMotivoId] = useState('')

  if (!atendimento) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-sf-0 px-6 text-center">
        <div className="w-24 h-24 rounded-[24px] bg-sf-1 border border-bd-1 flex items-center justify-center">
          <MessagesSquare size={44} className="text-bd-3" />
        </div>
        <div>
          <div className="text-[14px] font-medium text-tx-2">GR7 Atendimento</div>
          <div className="text-[13px] text-tx-3 mt-0.5">Escolha um chamado na lista para abrir a conversa.</div>
        </div>
      </div>
    )
  }

  const souResponsavel = atendimento.responsavel_id === usuarioId
  const semDono = !atendimento.responsavel_id
  const finalizado = atendimento.status === 'finalizado'
  const semCadastro = !atendimento.contato?.cliente_id

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!texto.trim() || !usuarioId || !atendimento) return
    responder.mutate({
      atendimentoId: atendimento.id,
      corpo: texto.trim(),
      usuarioId,
      precisaAssumir: semDono,
    })
    setTexto('')
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-sf-0">
      <header className="h-14 shrink-0 px-4 flex items-center justify-between gap-3 border-b border-bd-1 bg-sf-1">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-tx-1 truncate">{nomeContato(atendimento)}</div>
          <div className="flex items-center gap-2 text-[12px] text-tx-2">
            <span className="dado text-tx-3">#{atendimento.protocolo}</span>
            <span className="text-tx-3">·</span>
            <span className="truncate">{atendimento.departamento?.nome ?? 'Sem setor'}</span>
            <PontoStatus status={atendimento.status} />
          </div>
        </div>

        {!finalizado && (
          <div className="flex items-center gap-1.5 shrink-0">
            {semDono &&
              (semCadastro ? (
                <Botao
                  variante="primario"
                  tamanho="sm"
                  onClick={() => setModalAceitar(true)}
                  icone={<UserPlus size={15} />}
                  title="Vincular a empresa, escolher o setor e assumir"
                >
                  Aceitar
                </Botao>
              ) : (
                <Botao
                  variante="primario"
                  tamanho="sm"
                  onClick={() => usuarioId && assumir.mutate({ id: atendimento.id, usuarioId })}
                  icone={<UserCheck size={15} />}
                >
                  Assumir
                </Botao>
              ))}
            <Botao
              variante="neutro"
              tamanho="sm"
              onClick={() => setModalTransferir(true)}
              icone={<ArrowLeftRight size={15} />}
            >
              Transferir
            </Botao>
            <Botao
              variante="neutro"
              tamanho="sm"
              onClick={() => setModalFinalizar(true)}
              icone={<CheckCheck size={15} />}
            >
              Finalizar
            </Botao>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1.5">
        {mensagens.isLoading ? (
          <LinhasCarregando linhas={3} />
        ) : (mensagens.data ?? []).length === 0 ? (
          <p className="text-[13px] text-tx-3 text-center py-6">Nenhuma mensagem ainda.</p>
        ) : (
          (mensagens.data ?? []).map((m) => {
            const entrada = m.direcao === 'entrada'
            const bot = m.origem === 'bot'
            return (
              <div
                key={m.id}
                className={cn(
                  'max-w-[68%] px-3 py-2 text-[13px] leading-relaxed',
                  entrada
                    ? 'self-start bg-sf-2 text-tx-1 rounded-[10px] rounded-bl-[3px]'
                    : bot
                      ? 'self-end bg-sf-3 text-tx-2 rounded-[10px] rounded-br-[3px] border border-bd-1'
                      : 'self-end bg-br-1 text-white rounded-[10px] rounded-br-[3px]'
                )}
              >
                {bot && <div className="rotulo mb-0.5 text-tx-3">Bot</div>}
                <div className="whitespace-pre-wrap break-words">{m.corpo}</div>
                <div
                  className={cn(
                    'dado text-[10px] mt-1 text-right',
                    entrada ? 'text-tx-3' : bot ? 'text-tx-3' : 'text-white/70'
                  )}
                >
                  {hora(m.created_at)}
                </div>
              </div>
            )
          })
        )}
      </div>

      {finalizado ? (
        <div className="shrink-0 border-t border-bd-1 bg-sf-1 px-4 py-3 text-[13px] text-tx-2">
          Atendimento finalizado. Se o cliente voltar a falar, o chamado reabre pela regra de reabertura.
        </div>
      ) : (
        <form onSubmit={enviar} className="shrink-0 border-t border-bd-1 bg-sf-1 p-3 flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={semDono ? 'Responder (isso assume o chamado)' : 'Escreva sua resposta'}
            aria-label="Resposta"
            className="flex-1 h-9 px-3 text-sm rounded-[6px] bg-sf-2 border border-bd-2 text-tx-1 placeholder:text-tx-3 hover:border-bd-3 focus:border-br-1 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)] transition-colors duration-[120ms]"
          />
          <Botao
            variante="primario"
            type="submit"
            disabled={!texto.trim() || (!souResponsavel && !semDono)}
            title={!souResponsavel && !semDono ? 'Este chamado é de outro atendente' : undefined}
            icone={<Send size={15} />}
          >
            Enviar
          </Botao>
        </form>
      )}

      {modalAceitar && (
        <AceitarPotencial
          atendimento={atendimento}
          usuarioId={usuarioId}
          aberto={modalAceitar}
          onFechar={() => setModalAceitar(false)}
        />
      )}

      <Modal titulo="Transferir atendimento" aberto={modalTransferir} onFechar={() => setModalTransferir(false)}>
        <div className="flex flex-col gap-3">
          <Selecao
            rotulo="Departamento"
            value={destinoDep}
            onChange={(e) => setDestinoDep(e.target.value)}
          >
            <option value="">Manter o atual</option>
            {(departamentos.lista.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Atendente"
            dica="Sem escolher ninguém, o chamado volta para a fila do departamento."
            value={destinoUsuario}
            onChange={(e) => setDestinoUsuario(e.target.value)}
          >
            <option value="">Deixar na fila</option>
            {(usuarios.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Selecao>
          <div className="flex justify-end gap-2 pt-1">
            <Botao variante="fantasma" onClick={() => setModalTransferir(false)}>
              Cancelar
            </Botao>
            <Botao
              variante="primario"
              disabled={!destinoDep && !destinoUsuario}
              onClick={() => {
                transferir.mutate({
                  id: atendimento.id,
                  paraDepartamentoId: destinoDep || null,
                  paraUsuarioId: destinoUsuario || null,
                })
                setModalTransferir(false)
                setDestinoDep('')
                setDestinoUsuario('')
              }}
            >
              Transferir
            </Botao>
          </div>
        </div>
      </Modal>

      <Modal titulo="Finalizar atendimento" aberto={modalFinalizar} onFechar={() => setModalFinalizar(false)}>
        <div className="flex flex-col gap-3">
          <Selecao
            rotulo="Qual foi o motivo do atendimento?"
            dica="Usado nos relatórios de atendimento."
            value={motivoId}
            onChange={(e) => setMotivoId(e.target.value)}
          >
            <option value="">Selecionar</option>
            {(motivos.lista.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Selecao>
          <div className="flex justify-end gap-2 pt-1">
            <Botao variante="fantasma" onClick={() => setModalFinalizar(false)}>
              Cancelar
            </Botao>
            <Botao
              variante="primario"
              onClick={() => {
                finalizar.mutate({ id: atendimento.id, motivoId: motivoId || null })
                setModalFinalizar(false)
                setMotivoId('')
              }}
            >
              Finalizar
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  )
}
