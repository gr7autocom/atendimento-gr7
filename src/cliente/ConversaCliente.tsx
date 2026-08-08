import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Send, WifiOff, CheckCircle2, LogOut, Copy, Check, RotateCw, AlertCircle, Paperclip, Bell, Pencil, Trash2 } from 'lucide-react'
import { Botao } from '../components/ui/Botao'
import { Modal, ModalConfirmar } from '../components/ui/Modal'
import { ListaAnexos } from '../components/ui/Anexo'
import { GravadorAudio, BotaoGravar } from '../components/ui/GravadorAudio'
import { MenuContexto } from '../components/ui/MenuContexto'
import { estadoDaPermissao, pedirPermissao, type EstadoPermissao } from '../lib/notificacoes'
import { cn } from '../lib/utils'
import type { AnexoWeb, Conversa, DepartamentoWeb, MensagemWeb } from './api'

/**
 * Segunda tela do cliente: a conversa em si.
 *
 * Quatro estados, todos alcançáveis pelo cliente: na fila (ninguém pegou ainda),
 * em atendimento, pedindo a nota e encerrado. Mais o estado offline, que bloqueia
 * o envio em vez de guardar a mensagem para depois: "mandei e ninguém recebeu" é
 * pior que "você está sem internet" (ver docs/canal-web.md, sem fila offline).
 */

/**
 * Mensagem que o cliente escreveu e ainda não voltou do servidor. Fica na tela
 * desde o clique, e continua lá marcada como não enviada se a chamada falhar.
 * O `client_msg_id` é o mesmo no reenvio, e é ele que impede duplicata no banco.
 */
export type MensagemPendente = {
  client_msg_id: string
  corpo: string
  falhou: boolean
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function Bolha({
  mensagem,
  nomeAtendente,
  anexos = [],
  aoAbrirAcoes,
}: {
  mensagem: MensagemWeb
  nomeAtendente: string | null
  anexos?: AnexoWeb[]
  aoAbrirAcoes?: (e: { x: number; y: number }, m: MensagemWeb) => void
}) {
  const minha = mensagem.origem === 'cliente'
  // O bot se identifica, o atendente tem nome. Sem isso o cliente responde à
  // saudação automática achando que já tem gente do outro lado.
  const autor = minha ? null : mensagem.origem === 'bot' ? 'Atendimento GR7' : nomeAtendente ?? 'Atendimento GR7'
  const soAnexo = anexos.length > 0 && !mensagem.corpo
  return (
    <div className={cn('flex flex-col gap-1', minha ? 'items-end' : 'items-start')}>
      {autor && <span className="text-mini text-tx-3 px-1">{autor}</span>}
      <div
        /*
          Botão direito no computador e toque longo no celular abrem as mesmas
          ações. `onContextMenu` cobre os dois: no celular o navegador dispara
          esse evento no toque longo, então não é preciso montar cronômetro de
          pressão nem disputar com a seleção de texto do sistema.
        */
        onContextMenu={
          aoAbrirAcoes && minha
            ? (e) => {
                e.preventDefault()
                aoAbrirAcoes({ x: e.clientX, y: e.clientY }, mensagem)
              }
            : undefined
        }
        className={cn(
          'max-w-[85%] text-corpo-lg leading-relaxed break-words',
          // Anexo sozinho dispensa o preenchimento colorido: a bolha viraria
          // uma moldura grossa em volta da imagem, sem dizer nada.
          soAnexo
            ? 'p-1 bg-transparent'
            : cn(
                'px-3.5 py-2.5',
                minha ? 'bg-br-1 text-white rounded-3 rounded-br-1' : 'bg-sf-2 text-tx-1 rounded-3 rounded-bl-1'
              )
        )}
      >
        {(
          <>
            {mensagem.resposta_corpo && (
              <span
                className={cn(
                  'block mb-2 pl-2 py-0.5 border-l-2 rounded-r-micro',
                  minha ? 'border-white/60 bg-black/15' : 'border-br-2 bg-sf-0/40'
                )}
              >
                <span className={cn('block text-mini font-medium', minha ? 'text-white/90' : 'text-br-2')}>
                  {mensagem.resposta_remetente ?? 'Mensagem'}
                </span>
                <span className={cn('block text-apoio line-clamp-2', minha ? 'text-white/75' : 'text-tx-2')}>
                  {mensagem.resposta_corpo}
                </span>
              </span>
            )}
            <ListaAnexos anexos={anexos} className={mensagem.corpo ? 'mb-2' : undefined} />
            {mensagem.corpo && <span className="whitespace-pre-wrap">{mensagem.corpo}</span>}
          </>
        )}
      </div>
      <span className="text-mini text-tx-3 px-1">
        {hora(mensagem.created_at)}
        {/* Como no WhatsApp: o cliente vê que aquela mensagem foi alterada. */}
        {mensagem.editada_em ? ' · editada' : ''}
      </span>
    </div>
  )
}

function BolhaPendente({ pendente, aoReenviar }: { pendente: MensagemPendente; aoReenviar: () => void }) {
  return (
    <div className="flex flex-col gap-1 items-end">
      <div
        className={cn(
          'max-w-[85%] px-3.5 py-2.5 text-corpo-lg leading-relaxed whitespace-pre-wrap break-words rounded-3 rounded-br-1',
          // Falhou fica com a cor de aviso; só enviando fica apagada, sem alarme.
          pendente.falhou ? 'bg-sf-2 text-tx-1 border border-warn' : 'bg-br-1 text-white opacity-60'
        )}
      >
        {pendente.corpo}
      </div>
      {pendente.falhou ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-mini text-warn">
            <AlertCircle size={12} aria-hidden="true" />
            Não enviada
          </span>
          <button
            type="button"
            onClick={aoReenviar}
            className="inline-flex items-center gap-1 h-6 px-1.5 rounded-micro text-mini text-br-2 hover:bg-sf-2 transicao"
          >
            <RotateCw size={12} aria-hidden="true" />
            Tentar de novo
          </button>
        </div>
      ) : (
        <span className="text-mini text-tx-3 px-1">Enviando…</span>
      )}
    </div>
  )
}

/**
 * Escolha do setor, dentro da conversa e logo abaixo da pergunta do bot.
 *
 * Botões e não menu numerado: no WhatsApp o cliente digita o número porque o
 * canal só aceita texto. Aqui é uma tela, então um toque resolve e ninguém erra
 * o número. A escolha vira mensagem do cliente na conversa, para o atendente ler
 * o caminho completo.
 */
function EscolhaDeSetor({
  departamentos,
  escolhendo,
  aoEscolher,
}: {
  departamentos: DepartamentoWeb[]
  escolhendo: boolean
  aoEscolher: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2 pl-1">
      {departamentos.map((d) => (
        <button
          key={d.id}
          type="button"
          disabled={escolhendo}
          onClick={() => aoEscolher(d.id)}
          className={cn(
            'min-h-11 w-full max-w-[85%] px-3.5 py-2 rounded-2 border text-corpo-lg text-left transicao',
            'bg-sf-2 border-bd-campo text-tx-1 hover:border-br-2 hover:text-br-2',
            'focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]',
            'disabled:opacity-60 disabled:hover:border-bd-campo disabled:hover:text-tx-1'
          )}
        >
          {d.nome}
        </button>
      ))}
    </div>
  )
}

function Avaliacao({ aoAvaliar, enviando }: { aoAvaliar: (nota: number) => void; enviando: boolean }) {
  const [nota, setNota] = useState<number | null>(null)
  return (
    <div className="border-t border-bd-1 bg-sf-1 p-4 flex flex-col gap-3">
      <p className="text-corpo-lg text-tx-1 text-center">De 0 a 10, como foi o atendimento?</p>
      {/*
        Botões e não campo de texto: no WhatsApp a nota vem digitada porque é o que
        o canal permite; aqui a tela resolve, e ninguém erra o formato.
      */}
      <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNota(n)}
            aria-pressed={nota === n}
            className={cn(
              'h-11 rounded-1 border text-corpo-lg font-medium transicao',
              'focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]',
              nota === n
                ? 'bg-br-soft border-br-2 text-br-2'
                : 'bg-sf-2 border-bd-campo text-tx-2 hover:border-tx-3 hover:text-tx-1'
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <Botao
        variante="primario"
        disabled={nota === null}
        carregando={enviando}
        onClick={() => nota !== null && aoAvaliar(nota)}
        className="h-11 text-corpo-lg w-full"
      >
        Enviar nota
      </Botao>
    </div>
  )
}

/**
 * Protocolo com botão de copiar. O cliente costuma anotar esse número para
 * cobrar depois, e no celular selecionar texto pequeno é um exercício de
 * paciência.
 */
function CopiarProtocolo({ protocolo }: { protocolo: number }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(String(protocolo))
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1600)
      }}
      aria-label={`Copiar o número do atendimento, ${protocolo}`}
      className="inline-flex items-center gap-1 h-6 px-1 -ml-1 rounded-micro text-tx-2 hover:text-tx-1 hover:bg-sf-2 transicao shrink-0"
    >
      <span className="dado">#{protocolo}</span>
      {copiado ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
      {/* O aviso é texto, não só o ícone virando check: cor e forma pequenas
          passam despercebidas, e é a única confirmação que a ação tem. */}
      <span className="sr-only" role="status">{copiado ? 'Número copiado' : ''}</span>
    </button>
  )
}

export function ConversaCliente({
  conversa,
  aguardandoSetor = false,
  departamentos = [],
  pendentes = [],
  online = true,
  enviando = false,
  recado,
  aoDispensarRecado,
  aoEnviar,
  aoEnviarArquivo,
  aoApagarMensagem,
  aoEditarMensagem,
  aoEscolherSetor,
  aoReenviar,
  aoEncerrar,
  aoAvaliar,
  aoAbrirOutro,
}: {
  conversa: Conversa
  /** Ainda falta escolher o setor. Enquanto isso, nada foi para o servidor. */
  aguardandoSetor?: boolean
  departamentos?: DepartamentoWeb[]
  pendentes?: MensagemPendente[]
  online?: boolean
  enviando?: boolean
  recado?: string | null
  aoDispensarRecado?: () => void
  aoEnviar: (texto: string) => void
  /** Devolve o texto do erro, ou `null` se deu certo. */
  aoEnviarArquivo: (arquivo: File) => Promise<string | null>
  /** Ausentes enquanto o chamado não existe: não há mensagem gravada para mexer. */
  aoApagarMensagem?: (id: string) => Promise<string | null>
  aoEditarMensagem?: (id: string, texto: string) => Promise<string | null>
  aoEscolherSetor: (departamentoId: string) => void
  aoReenviar: (pendente: MensagemPendente) => void
  aoEncerrar: () => void
  aoAvaliar: (nota: number) => void
  aoAbrirOutro: () => void
}) {
  const [texto, setTexto] = useState('')
  const [modalEncerrar, setModalEncerrar] = useState(false)
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [permissaoAviso, setPermissaoAviso] = useState<EstadoPermissao>(() => estadoDaPermissao())
  const [menuMsg, setMenuMsg] = useState<{ x: number; y: number; m: MensagemWeb } | null>(null)
  const [aApagar, setAApagar] = useState<MensagemWeb | null>(null)
  const [aEditar, setAEditar] = useState<MensagemWeb | null>(null)
  const [textoEdicao, setTextoEdicao] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [erroAnexo, setErroAnexo] = useState<string | null>(null)
  const inputArquivo = useRef<HTMLInputElement>(null)
  const fim = useRef<HTMLDivElement>(null)

  async function enviarArquivo(arquivo: File | null) {
    // Zera o input antes de qualquer coisa: sem isso, escolher o MESMO arquivo
    // de novo (depois de um erro) não dispara `change`, e parece que o botão
    // parou de funcionar.
    if (inputArquivo.current) inputArquivo.current.value = ''
    if (!arquivo) return

    setErroAnexo(null)
    setEnviandoAnexo(true)
    const erro = await aoEnviarArquivo(arquivo)
    setEnviandoAnexo(false)
    // O erro fica na tela até a próxima tentativa. Anexo que falha em silêncio
    // faz o cliente achar que mandou o print e ficar esperando resposta.
    if (erro) setErroAnexo(erro)
  }

  /*
    O projeto respeita `prefers-reduced-motion` no CSS, mas `scrollIntoView` é
    JavaScript e escapa dessa regra: quem pede menos movimento receberia a tela
    deslizando a cada mensagem.
  */
  useEffect(() => {
    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    fim.current?.scrollIntoView({ behavior: semMovimento ? 'auto' : 'smooth' })
  }, [conversa.mensagens.length, pendentes.length, aguardandoSetor])

  const naFila = conversa.status === 'na_fila'
  /*
    Sem setor escolhido, escrever não leva a lugar nenhum: o chamado ainda está em
    triagem e ninguém o vê. Bloquear é mais honesto que aceitar a mensagem e
    deixar o cliente esperando resposta de uma fila em que ele não entrou.
  */
  const faltaEscolherSetor = aguardandoSetor

  function enviar(e: FormEvent) {
    e.preventDefault()
    const limpo = texto.trim()
    if (!limpo || !online) return
    aoEnviar(limpo)
    setTexto('')
  }

  function teclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter manda, Shift+Enter quebra linha: é o que todo mundo já espera de um
    // chat, e sem isso a tecla mais óbvia da tela não faz nada.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <div className="min-h-dvh h-dvh bg-sf-0 flex flex-col">
      <header className="shrink-0 border-b border-bd-1 bg-sf-1">
        <div className="mx-auto w-full max-w-[720px] px-4 h-16 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-corpo-lg font-medium text-tx-1 truncate">
              {conversa.atendente ? `Falando com ${conversa.atendente}` : 'Suporte GR7'}
            </div>
            <div className="flex items-center gap-1.5 text-apoio text-tx-2 min-w-0">
              {conversa.protocolo !== null && <CopiarProtocolo protocolo={conversa.protocolo} />}
              {conversa.departamento && <span className="truncate">· {conversa.departamento}</span>}
            </div>
          </div>
          {!conversa.encerrado && conversa.protocolo !== null && (
            <Botao
              variante="fantasma"
              tamanho="sm"
              icone={<LogOut size={15} />}
              onClick={() => setModalEncerrar(true)}
              className="shrink-0"
            >
              Encerrar
            </Botao>
          )}
        </div>
      </header>

      {/*
        Faixa de espera: enquanto ninguém assumiu, o silêncio do outro lado é o
        normal. Sem dizer isso, o cliente reescreve a mesma dúvida achando que a
        mensagem não chegou.
      */}
      {naFila && !faltaEscolherSetor && (
        <div className="shrink-0 bg-sf-1 border-b border-bd-1">
          <div className="mx-auto w-full max-w-[720px] px-4 py-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-apoio text-tx-2">
              Você está na fila{conversa.departamento ? ` do setor ${conversa.departamento}` : ''}. Assim que
              um atendente assumir, ele responde por aqui.
            </p>
            {/*
              O convite para ligar o aviso aparece aqui, na espera, que é o
              único momento em que ele resolve um problema real: a pessoa vai
              fechar a tela e quer saber quando responderem. Pedir a permissão
              na abertura seria pedir sem motivo, e "bloquear" dado no susto é
              quase definitivo.
            */}
            {permissaoAviso === 'a_perguntar' && (
              <button
                type="button"
                onClick={async () => setPermissaoAviso(await pedirPermissao())}
                className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-1 text-apoio text-br-2 hover:bg-sf-2 transicao focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]"
              >
                <Bell size={15} aria-hidden="true" />
                Avisar quando responderem
              </button>
            )}
          </div>
        </div>
      )}

      {recado && (
        <div className="shrink-0 bg-sf-1 border-b border-bd-1">
          <div className="mx-auto w-full max-w-[720px] px-4 py-2 flex items-start justify-between gap-3">
            <p role="alert" className="text-apoio text-warn">
              {recado}
            </p>
            {aoDispensarRecado && (
              <button
                type="button"
                onClick={aoDispensarRecado}
                aria-label="Dispensar aviso"
                className="text-mini text-tx-2 hover:text-tx-1 h-6 px-1.5 rounded-micro shrink-0"
              >
                Ok
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <h1 className="sr-only">Conversa com o suporte da GR7</h1>
        {/*
          `role="log"` com `aria-live="polite"`: quem usa leitor de tela ouve a
          resposta do atendente chegar sem precisar sair procurando. `polite`
          espera a leitura em curso terminar, então não atropela quem está
          digitando.
        */}
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          className="mx-auto w-full max-w-[720px] px-4 py-5 flex flex-col gap-4"
        >
          {conversa.mensagens.map((m) => (
            <Bolha
              key={m.id}
              mensagem={m}
              nomeAtendente={conversa.atendente}
              anexos={conversa.anexos.filter((a) => a.mensagem_id === m.id)}
              aoAbrirAcoes={aoApagarMensagem ? (pos, msg) => setMenuMsg({ ...pos, m: msg }) : undefined}
            />
          ))}
          {pendentes.map((p) => (
            <BolhaPendente key={p.client_msg_id} pendente={p} aoReenviar={() => aoReenviar(p)} />
          ))}
          {aguardandoSetor && (
            <EscolhaDeSetor
              departamentos={departamentos}
              escolhendo={enviando}
              aoEscolher={aoEscolherSetor}
            />
          )}
          <div ref={fim} />
        </div>
      </div>

      {conversa.aguardando_avaliacao ? (
        <div className="mx-auto w-full max-w-[720px]">
          <Avaliacao aoAvaliar={aoAvaliar} enviando={enviando} />
        </div>
      ) : conversa.encerrado ? (
        <div className="shrink-0 border-t border-bd-1 bg-sf-1 px-4 py-4">
          <div className="mx-auto w-full max-w-[720px] flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2 text-corpo-lg text-tx-2">
              <CheckCircle2 size={17} className="text-ok shrink-0" />
              Atendimento encerrado. Obrigado por falar com a gente.
            </div>
            <Botao variante="neutro" onClick={aoAbrirOutro} className="h-11 text-corpo-lg">
              Iniciar outro atendimento
            </Botao>
          </div>
        </div>
      ) : (
        <form onSubmit={enviar} className="shrink-0 border-t border-bd-1 bg-sf-1 p-3">
          <div className="mx-auto w-full max-w-[720px] flex flex-col gap-2">
            {!online && (
              <p role="alert" className="flex items-center gap-2 text-apoio text-warn">
                <WifiOff size={15} className="shrink-0" />
                Você está sem internet. A mensagem não sai enquanto a conexão não voltar.
              </p>
            )}
            {erroAnexo && (
              <p role="alert" className="flex items-center gap-2 text-apoio text-err">
                <AlertCircle size={15} className="shrink-0" />
                {erroAnexo}
              </p>
            )}
            {gravando ? (
              <GravadorAudio
                enviando={!!enviandoAnexo}
                aoConfirmar={(arquivo) => {
                  setGravando(false)
                  enviarArquivo(arquivo)
                }}
                aoCancelar={() => setGravando(false)}
              />
            ) : (
            <div className="flex gap-2 items-end">
              {/*
                Anexo no app do cliente: o arquivo vai para a Edge Function, que
                assina e sobe. Alvo de 44px como o resto desta tela, porque aqui
                a pessoa está no celular e com pressa.
              */}
              <input
                ref={inputArquivo}
                type="file"
                onChange={(e) => enviarArquivo(e.target.files?.[0] ?? null)}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
              <Botao
                variante="fantasma"
                onClick={() => inputArquivo.current?.click()}
                disabled={!online || faltaEscolherSetor}
                carregando={enviandoAnexo}
                icone={<Paperclip size={19} />}
                aria-label="Anexar arquivo"
                className="shrink-0 w-11 h-11 px-0"
              />
              {/*
                Textarea que cresce, e não campo de uma linha: o cliente está
                descrevendo um problema, não mandando "ok". Em uma linha ele
                perde de vista o que já escreveu. Cresce até 5 linhas e então
                rola, para o compositor não engolir a conversa.
              */}
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={teclar}
                rows={1}
                placeholder={
                  faltaEscolherSetor ? 'Escolha o assunto acima para continuar' : online ? 'Escreva sua mensagem' : 'Sem conexão'
                }
                aria-label="Sua mensagem"
                disabled={!online || faltaEscolherSetor}
                className={cn(
                  'flex-1 min-w-0 py-3 px-3.5 rounded-1 bg-sf-2 border border-bd-campo text-corpo-lg text-tx-1',
                  'placeholder:text-tx-3 transicao hover:border-tx-3 focus:border-br-2 focus:outline-none',
                  'focus:ring-2 focus:ring-[color:var(--br-soft)] disabled:opacity-60',
                  'resize-none max-h-[7.5rem] leading-relaxed'
                )}
                style={{ height: 'auto' }}
                ref={(el) => {
                  if (!el) return
                  el.style.height = 'auto'
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
                  // A barra de rolagem só existe depois do teto: com uma linha
                  // escrita, ela aparecia encostada na borda sem nada a rolar.
                  el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden'
                }}
              />
              {/*
                Microfone só enquanto não há texto: com algo escrito, o botão
                da direita é Enviar. É a troca que todo mensageiro faz, e evita
                três botões disputando o mesmo canto no celular.
              */}
              {!texto.trim() ? (
                <BotaoGravar
                  onClick={() => setGravando(true)}
                  desabilitado={!online || faltaEscolherSetor}
                  className="w-11 h-11"
                />
              ) : (
                <Botao
                  type="submit"
                  variante="primario"
                  icone={<Send size={17} />}
                  carregando={enviando}
                  disabled={!online || faltaEscolherSetor}
                  className="h-12 px-4 shrink-0"
                  title="Enter envia, Shift+Enter quebra linha"
                >
                  <span className="sr-only sm:not-sr-only">Enviar</span>
                </Botao>
              )}
            </div>
            )}
          </div>
        </form>
      )}

      {menuMsg && (
        <MenuContexto
          x={menuMsg.x}
          y={menuMsg.y}
          onFechar={() => setMenuMsg(null)}
          itens={[
            ...(aoEditarMensagem && menuMsg.m.corpo
              ? [
                  {
                    rotulo: 'Editar',
                    icone: Pencil,
                    onClick: () => {
                      setTextoEdicao(menuMsg.m.corpo ?? '')
                      setAEditar(menuMsg.m)
                    },
                  },
                ]
              : []),
            ...(aoApagarMensagem
              ? [
                  {
                    rotulo: 'Apagar',
                    icone: Trash2,
                    variante: 'perigo' as const,
                    onClick: () => setAApagar(menuMsg.m),
                  },
                ]
              : []),
          ]}
        />
      )}

      <ModalConfirmar
        aberto={!!aApagar}
        titulo="Apagar mensagem"
        descricao="A mensagem sai da sua conversa. O atendimento guarda o registro dela, como acontece com todo o histórico."
        rotuloConfirmar="Apagar"
        carregando={ocupado}
        erro={erroAcao ?? undefined}
        aoConfirmar={async () => {
          if (!aApagar || !aoApagarMensagem) return
          setOcupado(true)
          const erro = await aoApagarMensagem(aApagar.id)
          setOcupado(false)
          setErroAcao(erro)
          if (!erro) setAApagar(null)
        }}
        aoCancelar={() => {
          setAApagar(null)
          setErroAcao(null)
        }}
      />

      <Modal titulo="Editar mensagem" aberto={!!aEditar} onFechar={() => setAEditar(null)}>
        <div className="flex flex-col gap-3">
          <textarea
            value={textoEdicao}
            onChange={(e) => setTextoEdicao(e.target.value)}
            rows={4}
            aria-label="Mensagem"
            className="w-full py-2.5 px-3 rounded-1 bg-sf-2 border border-bd-campo text-corpo-lg text-tx-1 hover:border-tx-3 focus:border-br-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)] transicao resize-none"
          />
          {erroAcao && (
            <p role="alert" className="text-apoio text-err">
              {erroAcao}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Botao variante="neutro" onClick={() => setAEditar(null)}>
              Cancelar
            </Botao>
            <Botao
              variante="primario"
              carregando={ocupado}
              disabled={!textoEdicao.trim() || textoEdicao.trim() === aEditar?.corpo}
              onClick={async () => {
                if (!aEditar || !aoEditarMensagem) return
                setOcupado(true)
                const erro = await aoEditarMensagem(aEditar.id, textoEdicao.trim())
                setOcupado(false)
                setErroAcao(erro)
                if (!erro) setAEditar(null)
              }}
            >
              Salvar
            </Botao>
          </div>
        </div>
      </Modal>

      <ModalConfirmar
        aberto={modalEncerrar}
        titulo="Encerrar atendimento"
        descricao="Você encerra a conversa com a GR7. Se precisar de novo, é só iniciar outro atendimento."
        rotuloConfirmar="Encerrar"
        aoConfirmar={() => {
          aoEncerrar()
          setModalEncerrar(false)
        }}
        aoCancelar={() => setModalEncerrar(false)}
      />
    </div>
  )
}
