import { Fragment, useRef, useState, type FormEvent } from 'react'
import {
  Send,
  UserCheck,
  ArrowLeftRight,
  CheckCheck,
  UserPlus,
  MessagesSquare,
  X,
  ArrowLeft,
  MoreVertical,
  Info,
} from 'lucide-react'
import {
  useMensagens,
  useEventos,
  useAcoesAtendimento,
  useParticipantes,
  nomeEmpresa,
  type AtendimentoLista,
  type EventoAtendimento,
} from '../../lib/useInbox'
import { useCrud } from '../../lib/useCrud'
import { useUsuarios } from '../../lib/useVinculos'
import { usePermissao } from '../../lib/permissoes'
import { useUsuarioAtual } from '../../lib/auth'
import { aplicarVariaveis } from '../../lib/variaveis'
import { AceitarPotencial } from './AceitarPotencial'
import { PainelContato } from './PainelContato'
import { SeletorTags, FaixaTagsAplicadas } from './TagsAtendimento'
import { Modal } from '../ui/Modal'
import { Botao } from '../ui/Botao'
import { Selecao } from '../ui/Campo'
import { PontoStatus } from '../ui/Selo'
import { Avatar } from '../ui/Avatar'
import { ItemMenu } from '../ui/Menu'
import { useFecharFora } from '../../lib/useFecharFora'
import { LinhasCarregando } from '../ui/Estados'
import { cn } from '../../lib/utils'
import { canalDoChamado, ROTULO_CANAL } from '../../lib/canal'

type Departamento = { id: string; nome: string; ativo: boolean }
type Motivo = { id: string; nome: string; ativo: boolean; departamento_id?: string | null }
type MsgRapida = { id: string; atalho: string; texto: string; ativo?: boolean; departamento_id?: string | null }

function nomeContato(a: AtendimentoLista) {
  return a.contato?.nome || a.contato?.nome_whatsapp || a.contato?.telefone || 'Sem nome'
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function diaChave(iso: string) {
  return new Date(iso).toDateString()
}

/** Rótulo do separador de dia: Hoje, Ontem, ou a data. */
function diaLabel(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  const ontem = new Date(hoje)
  ontem.setDate(hoje.getDate() - 1)
  if (d.toDateString() === hoje.toDateString()) return 'Hoje'
  if (d.toDateString() === ontem.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const PILULA_COR: Record<'ok' | 'err' | 'neutro', string> = {
  ok: 'bg-ok/15 text-ok',
  err: 'bg-err/15 text-err',
  neutro: 'bg-sf-2 text-tx-2 border border-bd-1',
}

/** Texto e cor da pílula de evento (mensagem de sistema, só o atendente vê). */
function descreverEvento(
  e: EventoAtendimento,
  nomeUsuario: (id: string | null) => string,
  nomeDep: (id: unknown) => string
): { texto: string; cor: 'ok' | 'err' | 'neutro' } | null {
  switch (e.tipo) {
    case 'atendimento_aberto':
      return { texto: `Atendimento #${String(e.dados?.protocolo ?? '')}`, cor: 'ok' }
    case 'fim_bot':
      return { texto: 'Fim das mensagens com o bot', cor: 'err' }
    case 'assumido':
      return { texto: `${nomeUsuario(e.alvo_usuario_id)} assumiu o atendimento`, cor: 'neutro' }
    case 'saiu_atendimento':
      return { texto: `${nomeUsuario(e.alvo_usuario_id)} não faz mais parte deste atendimento`, cor: 'neutro' }
    case 'transferido_departamento':
      return { texto: `Transferido para ${nomeDep(e.dados?.para)}`, cor: 'neutro' }
    case 'finalizado':
      return { texto: 'Atendimento encerrado', cor: 'err' }
    case 'reaberto':
      return { texto: 'Atendimento reaberto', cor: 'ok' }
    default:
      return null
  }
}

export function Conversa({
  atendimento,
  usuarioId,
  aoFechar,
}: {
  atendimento: AtendimentoLista | null
  usuarioId: string | null
  aoFechar?: () => void
}) {
  const mensagens = useMensagens(atendimento?.id ?? null)
  const eventos = useEventos(atendimento?.id ?? null)
  const participantesChamado = useParticipantes(atendimento?.id ?? null)
  const { assumir, responder, finalizar, transferir } = useAcoesAtendimento()
  const departamentos = useCrud<Departamento>('departamentos')
  const motivos = useCrud<Motivo>('atendimento_motivos')
  const usuarios = useUsuarios()
  const { isAdmin } = usePermissao()
  const usuarioAtual = useUsuarioAtual()
  const msgsRapidas = useCrud<MsgRapida>('atendimento_mensagens_rapidas', 'atalho')

  const [texto, setTexto] = useState('')
  const [pickerOff, setPickerOff] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [modalTransferir, setModalTransferir] = useState(false)
  const [modalFinalizar, setModalFinalizar] = useState(false)
  const [modalAceitar, setModalAceitar] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [mostrarDados, setMostrarDados] = useState(false)
  // Clique fora e Esc: hook compartilhado (lib/useFecharFora).
  const menuRef = useFecharFora<HTMLDivElement>(menuAberto, () => setMenuAberto(false))
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
          <div className="text-corpo-lg font-medium text-tx-2">GR7 Atendimento</div>
          <div className="text-corpo text-tx-3 mt-0.5">Escolha um chamado na lista para abrir a conversa.</div>
        </div>
      </div>
    )
  }

  const canal = canalDoChamado(atendimento.canal)
  const souResponsavel = atendimento.responsavel_id === usuarioId
  const semDono = !atendimento.responsavel_id
  const souParticipante = (participantesChamado.lista.data ?? []).some((p) => p.usuario_id === usuarioId)
  // Pode responder: o dono, um chamado sem dono (assume ao responder), ou um participante.
  const podeResponder = souResponsavel || semDono || souParticipante
  const finalizado = atendimento.status === 'finalizado'
  const semCadastro = !atendimento.contato?.cliente_id
  // Tag é aplicada pelo atendente depois de pegar o chamado (ou pelo admin).
  const podeEditarTags = !finalizado && (souResponsavel || isAdmin)

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

  // Mensagens rápidas: digitar "/" no campo abre a lista de atalhos aplicáveis
  // (do setor do chamado ou "Todos"); escolher insere o texto com as variáveis.
  const atalhoQuery = !finalizado && !pickerOff && texto.startsWith('/') ? texto.slice(1).toLowerCase() : null
  const rapidasAplicaveis = (msgsRapidas.lista.data ?? []).filter(
    (m) => m.ativo !== false && (m.departamento_id == null || m.departamento_id === atendimento.departamento_id)
  )
  const rapidasMatches =
    atalhoQuery === null
      ? []
      : rapidasAplicaveis
          .filter((m) => m.atalho.toLowerCase().includes(atalhoQuery) || m.texto.toLowerCase().includes(atalhoQuery))
          .slice(0, 8)
  const mostrarPicker = rapidasMatches.length > 0

  function inserirRapida(m: MsgRapida) {
    if (!atendimento) return
    setTexto(
      aplicarVariaveis(m.texto, {
        atendente: usuarioAtual?.nome ?? '',
        contato: nomeContato(atendimento),
        empresa: nomeEmpresa(atendimento.contato?.cliente) ?? '',
        protocolo: String(atendimento.protocolo),
        departamento: atendimento.departamento?.nome ?? '',
      })
    )
    setPickerOff(true)
    inputRef.current?.focus()
  }

  const nomeUsuario = (id: string | null) => (usuarios.data ?? []).find((u) => u.id === id)?.nome ?? 'Alguém'
  const nomeDep = (id: unknown) => (departamentos.lista.data ?? []).find((d) => d.id === id)?.nome ?? 'outro setor'

  // Linha do tempo: mensagens + eventos internos, ordenados por horário.
  const itens = [
    ...(mensagens.data ?? []).map((m) => ({ kind: 'msg' as const, at: m.created_at, m })),
    ...(eventos.data ?? []).map((e) => ({ kind: 'evt' as const, at: e.created_at, e })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-sf-0">
      <header className="h-14 shrink-0 px-3 sm:px-4 flex items-center justify-between gap-3 border-b border-bd-1 bg-sf-1">
        <div className="flex items-center gap-2 min-w-0">
          {aoFechar && (
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Voltar para a lista"
              className="lg:hidden w-8 h-8 shrink-0 rounded-1 flex items-center justify-center text-tx-2 hover:text-tx-1 hover:bg-sf-2 transicao"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <Avatar nome={nomeContato(atendimento)} tamanho={34} canal={canal} />
          <div className="min-w-0">
            <div className="text-corpo font-medium text-tx-1 truncate">{nomeContato(atendimento)}</div>
            <div className="flex items-center gap-2 text-apoio text-tx-2">
              <span className="dado text-tx-3">#{atendimento.protocolo}</span>
              <span className="text-tx-3">·</span>
              <span className="truncate">{atendimento.departamento?.nome ?? 'Sem setor'}</span>
              {/*
                O canal em texto aparece só aqui, e não na lista: é neste cabeçalho
                que o atendente decide COMO responder, e o selo do avatar sozinho
                exigiria decorar o significado de cada ícone. Na lista o selo basta,
                porque ali a tarefa é reconhecer, não decidir.
              */}
              <span className="text-tx-3">·</span>
              <span className="shrink-0">{ROTULO_CANAL[canal]}</span>
              <PontoStatus status={atendimento.status} />
            </div>
          </div>
        </div>

        {/* Desktop: ações inline + fechar */}
        <div className="hidden lg:flex items-center gap-1.5 shrink-0">
          {podeEditarTags && (
            <SeletorTags
              atendimentoId={atendimento.id}
              departamentoId={atendimento.departamento_id}
              usuarioId={usuarioId}
            />
          )}
          {!finalizado && (
            <>
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
                    carregando={assumir.isPending}
                  >
                    Assumir
                  </Botao>
                ))}
              <Botao variante="neutro" tamanho="sm" onClick={() => setModalTransferir(true)} icone={<ArrowLeftRight size={15} />}>
                Transferir
              </Botao>
              <Botao variante="neutro" tamanho="sm" onClick={() => setModalFinalizar(true)} icone={<CheckCheck size={15} />}>
                Finalizar
              </Botao>
            </>
          )}
          {aoFechar && (
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar conversa"
              title="Fechar conversa"
              className="w-8 h-8 ml-0.5 rounded-1 flex items-center justify-center text-tx-2 hover:text-tx-1 hover:bg-sf-2 transicao"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Mobile: tag + ações no menu ⋮ */}
        <div className="lg:hidden flex items-center gap-1 shrink-0">
          {podeEditarTags && (
            <SeletorTags
              atendimentoId={atendimento.id}
              departamentoId={atendimento.departamento_id}
              usuarioId={usuarioId}
            />
          )}
          <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuAberto((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuAberto}
            aria-label="Ações do atendimento"
            className="w-9 h-9 rounded-1 flex items-center justify-center text-tx-2 hover:text-tx-1 hover:bg-sf-2 transicao"
          >
            <MoreVertical size={18} />
          </button>
          {menuAberto && (
            <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-30 w-56 rounded-2 border border-bd-2 bg-sf-3 shadow-lg py-1">
              <ItemMenu onClick={() => { setMostrarDados(true); setMenuAberto(false) }} icone={<Info size={16} />}>
                Dados do atendimento
              </ItemMenu>
              {!finalizado &&
                semDono &&
                (semCadastro ? (
                  <ItemMenu onClick={() => { setModalAceitar(true); setMenuAberto(false) }} icone={<UserPlus size={16} />}>
                    Aceitar
                  </ItemMenu>
                ) : (
                  <ItemMenu
                    onClick={() => {
                      if (usuarioId) assumir.mutate({ id: atendimento.id, usuarioId })
                      setMenuAberto(false)
                    }}
                    icone={<UserCheck size={16} />}
                  >
                    Assumir
                  </ItemMenu>
                ))}
              {!finalizado && (
                <>
                  <ItemMenu onClick={() => { setModalTransferir(true); setMenuAberto(false) }} icone={<ArrowLeftRight size={16} />}>
                    Transferir
                  </ItemMenu>
                  <ItemMenu onClick={() => { setModalFinalizar(true); setMenuAberto(false) }} icone={<CheckCheck size={16} />}>
                    Finalizar
                  </ItemMenu>
                </>
              )}
            </div>
          )}
          </div>
        </div>
      </header>

      <FaixaTagsAplicadas atendimentoId={atendimento.id} podeEditar={podeEditarTags} />

      {/* Mobile: painel do contato em tela cheia (acessado por "Dados do atendimento") */}
      {mostrarDados && (
        <div className="lg:hidden fixed inset-0 z-40 bg-sf-0 flex flex-col">
          <header className="h-14 shrink-0 px-3 flex items-center gap-2 border-b border-bd-1 bg-sf-1">
            <button
              type="button"
              onClick={() => setMostrarDados(false)}
              aria-label="Voltar"
              className="w-9 h-9 rounded-1 flex items-center justify-center text-tx-2 hover:text-tx-1 hover:bg-sf-2"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="text-corpo-lg font-medium text-tx-1">Dados do atendimento</span>
          </header>
          <div className="flex-1 min-h-0">
            <PainelContato atendimento={atendimento} variante="cheia" />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {mensagens.isLoading ? (
          <div className="mx-auto w-full max-w-[820px]">
            <LinhasCarregando linhas={3} />
          </div>
        ) : itens.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-sf-1 border border-bd-1 flex items-center justify-center">
              <MessagesSquare size={22} className="text-bd-3" />
            </div>
            <p className="text-corpo text-tx-3">Nenhuma mensagem ainda. Escreva abaixo para começar.</p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[820px] flex flex-col gap-1.5">
            {(() => {
              let ultimoDia = ''
              return itens.map((item) => {
                const dia = diaChave(item.at)
                const novoDia = dia !== ultimoDia
                ultimoDia = dia
                const separador = novoDia && (
                  <div className="self-center my-2 px-2.5 h-6 inline-flex items-center rounded-full bg-sf-2 border border-bd-1 text-mini text-tx-3">
                    {diaLabel(item.at)}
                  </div>
                )

                if (item.kind === 'evt') {
                  const d = descreverEvento(item.e, nomeUsuario, nomeDep)
                  return (
                    <Fragment key={item.e.id}>
                      {separador}
                      {d && (
                        <div className="self-center my-1">
                          <span
                            className={cn(
                              'px-3 h-6 inline-flex items-center rounded-full text-mini font-medium',
                              PILULA_COR[d.cor]
                            )}
                          >
                            {d.texto}
                          </span>
                        </div>
                      )}
                    </Fragment>
                  )
                }

                const m = item.m
                const entrada = m.direcao === 'entrada'
                const bot = m.origem === 'bot'
                return (
                  <Fragment key={m.id}>
                    {separador}
                    <div
                      className={cn(
                        'max-w-[76%] px-3 py-2 text-corpo leading-relaxed shadow-sm',
                        entrada
                          ? 'self-start bg-sf-2 text-tx-1 rounded-3 rounded-bl-micro'
                          : bot
                            ? 'self-end bg-sf-3 text-tx-2 rounded-3 rounded-br-micro border border-bd-1'
                            : 'self-end bg-br-1 text-white rounded-3 rounded-br-micro'
                      )}
                    >
                      {bot && <div className="rotulo mb-0.5 text-tx-3">Bot</div>}
                      <div className="whitespace-pre-wrap break-words">{m.corpo}</div>
                      <div
                        className={cn(
                          'flex items-center justify-end gap-1 mt-1',
                          entrada || bot ? 'text-tx-3' : 'text-white/70'
                        )}
                      >
                        <span className="dado text-micro">{hora(m.created_at)}</span>
                        {!entrada && !bot && <CheckCheck size={13} aria-label="Enviado" />}
                      </div>
                    </div>
                  </Fragment>
                )
              })
            })()}
          </div>
        )}
      </div>

      {finalizado ? (
        <div className="shrink-0 border-t border-bd-1 bg-sf-1 px-4 py-3">
          <div className="mx-auto w-full max-w-[820px] flex items-center gap-2 text-corpo text-tx-2">
            <CheckCheck size={15} className="text-ok shrink-0" />
            Atendimento finalizado. Se o cliente escrever de novo em até 3h, o chamado reabre sozinho.
          </div>
        </div>
      ) : (
        <form onSubmit={enviar} className="shrink-0 border-t border-bd-1 bg-sf-1 p-3">
          <div className="mx-auto w-full max-w-[820px] relative">
            {mostrarPicker && (
              <div className="absolute bottom-full left-0 right-0 mb-2 z-30 rounded-2 border border-bd-2 bg-sf-3 shadow-2 overflow-hidden">
                <div className="px-3 h-7 flex items-center text-mini uppercase tracking-wide text-tx-3 border-b border-bd-1">
                  Mensagens rápidas
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {rapidasMatches.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => inserirRapida(m)}
                      className={cn(
                        'flex flex-col items-start gap-0.5 w-full px-3 py-1.5 text-left transicao',
                        idx === 0 ? 'bg-sf-2' : 'hover:bg-sf-2'
                      )}
                    >
                      <span className="dado text-apoio text-br-2">/{m.atalho}</span>
                      <span className="text-apoio text-tx-2 truncate w-full">{m.texto}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Aviso visível: antes isso era só um `title` no botão, que nunca
                aparecia porque botão desabilitado tem pointer-events-none. Quem
                não é o responsável ficava com o Enviar morto e sem explicação. */}
            {!podeResponder && (
              <p className="mb-2 text-apoio text-warn">
                Este chamado é de outro atendente. Peça a transferência para responder.
              </p>
            )}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value)
                  setPickerOff(false)
                }}
                onKeyDown={(e) => {
                  if (mostrarPicker && e.key === 'Enter') {
                    e.preventDefault()
                    inserirRapida(rapidasMatches[0])
                  } else if (mostrarPicker && e.key === 'Escape') {
                    e.preventDefault()
                    setPickerOff(true)
                  }
                }}
                placeholder={
                  semDono ? 'Responder (isso assume o chamado). / para atalhos' : 'Escreva sua resposta ou / para atalhos'
                }
                aria-label="Resposta"
                className="flex-1 h-9 px-3 text-corpo-lg rounded-2 bg-sf-2 border border-bd-campo text-tx-1 placeholder:text-tx-3 hover:border-tx-3 focus:border-br-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)] transicao"
              />
              <Botao
                variante="primario"
                type="submit"
                disabled={!texto.trim() || !podeResponder}
                carregando={responder.isPending}
                icone={<Send size={15} />}
              >
                Enviar
              </Botao>
            </div>
          </div>
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
            dica="Sem escolher ninguém, volta para a fila do departamento para qualquer atendente assumir."
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
              carregando={transferir.isPending}
              disabled={
                !(
                  (destinoDep && destinoDep !== atendimento.departamento_id) ||
                  (destinoUsuario
                    ? destinoUsuario !== atendimento.responsavel_id
                    : !!atendimento.responsavel_id)
                )
              }
              onClick={() => {
                // Fecha no onSuccess: fechando junto com o mutate, o carregando
                // nunca aparece e uma falha some da tela sem aviso.
                transferir.mutate(
                  {
                    id: atendimento.id,
                    paraDepartamentoId: destinoDep || null,
                    paraUsuarioId: destinoUsuario || null,
                  },
                  {
                    onSuccess: () => {
                      setModalTransferir(false)
                      setDestinoDep('')
                      setDestinoUsuario('')
                    },
                  }
                )
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
            {(motivos.lista.data ?? [])
              .filter((m) => m.ativo !== false && m.departamento_id === atendimento.departamento_id)
              .map((m) => (
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
              carregando={finalizar.isPending}
              onClick={() => {
                finalizar.mutate(
                  { id: atendimento.id, motivoId: motivoId || null },
                  {
                    onSuccess: () => {
                      setModalFinalizar(false)
                      setMotivoId('')
                    },
                  }
                )
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
