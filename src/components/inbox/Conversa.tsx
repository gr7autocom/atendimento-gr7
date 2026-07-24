import { useState, type FormEvent } from 'react'
import { Send, UserCheck, ArrowLeftRight, CheckCheck } from 'lucide-react'
import { useMensagens, useAcoesAtendimento, type AtendimentoLista } from '../../lib/useInbox'
import { useCrud } from '../../lib/useCrud'
import { useUsuarios } from '../../lib/useVinculos'
import { AdminModal } from '../admin/AdminModal'
import { cn } from '../../lib/utils'

type Departamento = { id: string; nome: string; ativo: boolean }
type Motivo = { id: string; nome: string; ativo: boolean }

const ROTULO_STATUS: Record<string, string> = {
  triagem: 'No bot',
  na_fila: 'Na fila',
  em_atendimento: 'Em atendimento',
  finalizado: 'Finalizado',
}

function nomeContato(a: AtendimentoLista) {
  return a.contato?.nome || a.contato?.nome_whatsapp || a.contato?.telefone || 'Sem nome'
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
  const [destinoDep, setDestinoDep] = useState('')
  const [destinoUsuario, setDestinoUsuario] = useState('')
  const [motivoId, setMotivoId] = useState('')

  if (!atendimento) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-[#ffffffb3]">Escolha um chamado na lista para ver a conversa.</p>
      </div>
    )
  }

  const souResponsavel = atendimento.responsavel_id === usuarioId
  const semDono = !atendimento.responsavel_id
  const finalizado = atendimento.status === 'finalizado'

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
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <header className="border-b border-[#ffffff1a] p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[#ffffff] truncate">{nomeContato(atendimento)}</div>
          <div className="text-xs text-[#ffffffb3]">
            #{atendimento.protocolo} · {atendimento.departamento?.nome ?? 'Sem departamento'} ·{' '}
            {ROTULO_STATUS[atendimento.status] ?? atendimento.status}
          </div>
        </div>
        {!finalizado && (
          <div className="flex items-center gap-2">
            {semDono && (
              <button
                onClick={() => usuarioId && assumir.mutate({ id: atendimento.id, usuarioId })}
                className="flex items-center gap-1 rounded bg-[#0078d4] text-[#ffffff] text-sm px-3 py-1.5"
              >
                <UserCheck size={16} /> Assumir
              </button>
            )}
            <button
              onClick={() => setModalTransferir(true)}
              className="flex items-center gap-1 rounded bg-[#ffffff14] text-[#ffffff] text-sm px-3 py-1.5"
            >
              <ArrowLeftRight size={16} /> Transferir
            </button>
            <button
              onClick={() => setModalFinalizar(true)}
              className="flex items-center gap-1 rounded bg-[#ffffff14] text-[#ffffff] text-sm px-3 py-1.5"
            >
              <CheckCheck size={16} /> Finalizar
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {mensagens.isLoading ? (
          <p className="text-[#ffffffb3]">Carregando conversa…</p>
        ) : (mensagens.data ?? []).length === 0 ? (
          <p className="text-[#ffffffb3]">Nenhuma mensagem ainda.</p>
        ) : (
          (mensagens.data ?? []).map((m) => (
            <div
              key={m.id}
              className={cn(
                'max-w-[75%] rounded px-3 py-2 text-sm',
                m.direcao === 'entrada'
                  ? 'self-start bg-[#ffffff14] text-[#ffffff]'
                  : m.origem === 'bot'
                    ? 'self-end bg-[#3a3d41] text-[#ffffff]'
                    : 'self-end bg-[#0078d4] text-[#ffffff]'
              )}
            >
              {m.origem === 'bot' && <div className="text-xs opacity-70 mb-0.5">Bot</div>}
              {m.corpo}
            </div>
          ))
        )}
      </div>

      {finalizado ? (
        <div className="border-t border-[#ffffff1a] p-3 text-sm text-[#ffffffb3]">
          Atendimento finalizado. Se o cliente voltar a falar, o chamado reabre pela regra de reabertura.
        </div>
      ) : (
        <form onSubmit={enviar} className="border-t border-[#ffffff1a] p-3 flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={semDono ? 'Responder (isso assume o chamado)' : 'Escreva sua resposta'}
            aria-label="Resposta"
            className="flex-1 rounded px-3 py-2 bg-[#ffffff14] text-[#ffffff]"
          />
          <button
            type="submit"
            disabled={!texto.trim() || (!souResponsavel && !semDono)}
            title={!souResponsavel && !semDono ? 'Este chamado é de outro atendente' : undefined}
            className="flex items-center gap-1 rounded bg-[#0078d4] text-[#ffffff] px-3 py-2 disabled:opacity-50"
          >
            <Send size={16} /> Enviar
          </button>
        </form>
      )}

      <AdminModal titulo="Transferir atendimento" aberto={modalTransferir} onFechar={() => setModalTransferir(false)}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-[#ffffffb3]">
            Departamento
            <select
              value={destinoDep}
              onChange={(e) => setDestinoDep(e.target.value)}
              className="rounded px-3 py-2 bg-[#ffffff14] text-[#ffffff]"
            >
              <option value="">Manter o atual</option>
              {(departamentos.lista.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-[#ffffffb3]">
            Atendente (opcional)
            <select
              value={destinoUsuario}
              onChange={(e) => setDestinoUsuario(e.target.value)}
              className="rounded px-3 py-2 bg-[#ffffff14] text-[#ffffff]"
            >
              <option value="">Deixar na fila do departamento</option>
              {(usuarios.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalTransferir(false)} className="px-3 py-1.5 text-[#ffffffb3]">
              Cancelar
            </button>
            <button
              onClick={() => {
                if (!usuarioId) return
                transferir.mutate({
                  id: atendimento.id,
                  paraDepartamentoId: destinoDep || null,
                  paraUsuarioId: destinoUsuario || null,
                  de: {
                    departamentoId: atendimento.departamento_id,
                    usuarioId: atendimento.responsavel_id,
                    porUsuarioId: usuarioId,
                  },
                })
                setModalTransferir(false)
                setDestinoDep('')
                setDestinoUsuario('')
              }}
              disabled={!destinoDep && !destinoUsuario}
              className="rounded bg-[#0078d4] text-[#ffffff] px-3 py-1.5 disabled:opacity-50"
            >
              Transferir
            </button>
          </div>
        </div>
      </AdminModal>

      <AdminModal titulo="Finalizar atendimento" aberto={modalFinalizar} onFechar={() => setModalFinalizar(false)}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-[#ffffffb3]">
            Qual foi o motivo do atendimento?
            <select
              value={motivoId}
              onChange={(e) => setMotivoId(e.target.value)}
              className="rounded px-3 py-2 bg-[#ffffff14] text-[#ffffff]"
            >
              <option value="">Selecionar</option>
              {(motivos.lista.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalFinalizar(false)} className="px-3 py-1.5 text-[#ffffffb3]">
              Cancelar
            </button>
            <button
              onClick={() => {
                finalizar.mutate({ id: atendimento.id, motivoId: motivoId || null })
                setModalFinalizar(false)
                setMotivoId('')
              }}
              className="rounded bg-[#0078d4] text-[#ffffff] px-3 py-1.5"
            >
              Finalizar
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  )
}
