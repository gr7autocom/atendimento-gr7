import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Send, WifiOff, CheckCircle2, LogOut, Copy, Check } from 'lucide-react'
import { Botao } from '../components/ui/Botao'
import { ModalConfirmar } from '../components/ui/Modal'
import { cn } from '../lib/utils'
import type { Conversa, MensagemWeb } from './dados-mentira'

/**
 * Segunda tela do cliente: a conversa em si.
 *
 * Quatro estados, todos alcançáveis pelo cliente: na fila (ninguém pegou ainda),
 * em atendimento, pedindo a nota e encerrado. Mais o estado offline, que bloqueia
 * o envio em vez de guardar a mensagem para depois: "mandei e ninguém recebeu" é
 * pior que "você está sem internet" (ver docs/canal-web.md, sem fila offline).
 */

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function Bolha({ mensagem, nomeAtendente }: { mensagem: MensagemWeb; nomeAtendente: string | null }) {
  const minha = mensagem.origem === 'cliente'
  // O bot se identifica, o atendente tem nome. Sem isso o cliente responde à
  // saudação automática achando que já tem gente do outro lado.
  const autor = minha ? null : mensagem.origem === 'bot' ? 'Atendimento GR7' : nomeAtendente ?? 'Atendimento GR7'
  return (
    <div className={cn('flex flex-col gap-1', minha ? 'items-end' : 'items-start')}>
      {autor && <span className="text-mini text-tx-3 px-1">{autor}</span>}
      <div
        className={cn(
          'max-w-[85%] px-3.5 py-2.5 text-corpo-lg leading-relaxed whitespace-pre-wrap break-words',
          minha
            ? 'bg-br-1 text-white rounded-3 rounded-br-1'
            : 'bg-sf-2 text-tx-1 rounded-3 rounded-bl-1'
        )}
      >
        {mensagem.corpo}
      </div>
      <span className="text-mini text-tx-3 px-1">{hora(mensagem.criada_em)}</span>
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
  online = true,
  enviando = false,
  aoEnviar,
  aoEncerrar,
  aoAvaliar,
  aoAbrirOutro,
}: {
  conversa: Conversa
  online?: boolean
  enviando?: boolean
  aoEnviar: (texto: string) => void
  aoEncerrar: () => void
  aoAvaliar: (nota: number) => void
  aoAbrirOutro: () => void
}) {
  const [texto, setTexto] = useState('')
  const [modalEncerrar, setModalEncerrar] = useState(false)
  const fim = useRef<HTMLDivElement>(null)

  /*
    O projeto respeita `prefers-reduced-motion` no CSS, mas `scrollIntoView` é
    JavaScript e escapa dessa regra: quem pede menos movimento receberia a tela
    deslizando a cada mensagem.
  */
  useEffect(() => {
    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    fim.current?.scrollIntoView({ behavior: semMovimento ? 'auto' : 'smooth' })
  }, [conversa.mensagens.length])

  const naFila = conversa.status === 'na_fila'

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
              <CopiarProtocolo protocolo={conversa.protocolo} />
              <span className="truncate">· {conversa.departamento}</span>
            </div>
          </div>
          {!conversa.encerrado && (
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
      {naFila && (
        <div className="shrink-0 bg-sf-1 border-b border-bd-1">
          <p className="mx-auto w-full max-w-[720px] px-4 py-2 text-apoio text-tx-2">
            Você está na fila do setor {conversa.departamento}. Assim que um atendente assumir, ele
            responde por aqui.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <h1 className="sr-only">Conversa com o suporte da GR7, atendimento {conversa.protocolo}</h1>
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
            <Bolha key={m.id} mensagem={m} nomeAtendente={conversa.atendente} />
          ))}
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
            <div className="flex gap-2 items-end">
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
                placeholder={online ? 'Escreva sua mensagem' : 'Sem conexão'}
                aria-label="Sua mensagem"
                disabled={!online}
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
              <Botao
                type="submit"
                variante="primario"
                icone={<Send size={17} />}
                carregando={enviando}
                disabled={!online || !texto.trim()}
                className="h-12 px-4 shrink-0"
                title="Enter envia, Shift+Enter quebra linha"
              >
                <span className="sr-only sm:not-sr-only">Enviar</span>
              </Botao>
            </div>
          </div>
        </form>
      )}

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
