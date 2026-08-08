import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Trash2, Send } from 'lucide-react'
import { Botao } from './Botao'
import { cn } from '../../lib/utils'

/**
 * Gravação de áudio pelo microfone, com escuta antes de enviar.
 *
 * Portado do `GravadorAudio` do Talks (painel). O que veio de lá quase intacto
 * são as **mensagens de erro do microfone**: elas dizem onde clicar em cada
 * sistema, porque "permissão negada" sozinho deixa a pessoa sem saída, e no
 * celular o caminho para reativar não é óbvio nem para quem tem prática.
 *
 * O áudio nunca sai direto da gravação: para, vira arquivo, a pessoa escuta e
 * só então decide. Mandar no soltar do botão transformaria qualquer engano em
 * mensagem enviada, e áudio enviado por engano é o tipo de coisa que ninguém
 * consegue desfazer a tempo.
 */

const LIMITE_SEGUNDOS = 5 * 60

function mmss(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Formato que o navegador aceita gravar. Safari do iPhone só faz mp4. */
function formatoSuportado(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const c of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return ''
}

function extensao(mime: string): string {
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

/** Erro do microfone com o caminho para resolver, que muda por sistema. */
function motivoDoErro(err: unknown): string {
  const e = err as { name?: string }
  if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
    return 'Nenhum microfone foi encontrado neste aparelho.'
  }
  if (e?.name === 'NotReadableError' || e?.name === 'TrackStartError') {
    return 'O microfone está em uso por outro programa. Feche-o e tente de novo.'
  }
  if (typeof navigator === 'undefined') return 'O acesso ao microfone foi negado.'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) {
    return 'Microfone bloqueado. Abra Ajustes, Safari, Microfone e libere para este site.'
  }
  if (/Android/.test(ua)) {
    return 'Microfone bloqueado. Toque no cadeado na barra de endereço, Permissões, Microfone, Permitir.'
  }
  return 'Microfone bloqueado. Clique no cadeado ao lado do endereço, Permissões, Microfone, Permitir, e recarregue a página.'
}

export function GravadorAudio({
  aoConfirmar,
  aoCancelar,
  enviando = false,
}: {
  aoConfirmar: (arquivo: File, duracaoSeg: number) => void
  aoCancelar: () => void
  enviando?: boolean
}) {
  const [estado, setEstado] = useState<'gravando' | 'ouvindo'>('gravando')
  const [erro, setErro] = useState<string | null>(null)
  const [segundos, setSegundos] = useState(0)
  const [urlPreview, setUrlPreview] = useState<string | null>(null)

  const gravador = useRef<MediaRecorder | null>(null)
  const trilha = useRef<MediaStream | null>(null)
  const pedacos = useRef<Blob[]>([])
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null)
  const arquivo = useRef<File | null>(null)

  useEffect(() => {
    let cancelado = false

    async function iniciar() {
      const mime = formatoSuportado()
      if (!mime) {
        setErro('Este navegador não grava áudio. Você pode anexar um arquivo de áudio.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        trilha.current = stream

        const rec = new MediaRecorder(stream, { mimeType: mime })
        gravador.current = rec
        pedacos.current = []

        rec.addEventListener('dataavailable', (e) => {
          if (e.data.size > 0) pedacos.current.push(e.data)
        })
        rec.addEventListener('stop', () => {
          const blob = new Blob(pedacos.current, { type: mime })
          arquivo.current = new File([blob], `audio.${extensao(mime)}`, { type: mime })
          setUrlPreview(URL.createObjectURL(blob))
          setEstado('ouvindo')
          // Solta o microfone assim que para: sem isto o indicador de gravação
          // do sistema fica aceso, e com razão, porque a trilha continua viva.
          stream.getTracks().forEach((t) => t.stop())
          trilha.current = null
        })

        rec.start()
        relogio.current = setInterval(() => {
          setSegundos((s) => {
            // Teto duro: áudio de 20 minutos não é recado, é um problema para
            // quem vai ouvir e para o limite de tamanho do anexo.
            if (s + 1 >= LIMITE_SEGUNDOS) {
              rec.stop()
              if (relogio.current) clearInterval(relogio.current)
            }
            return s + 1
          })
        }, 1000)
      } catch (err) {
        setErro(motivoDoErro(err))
      }
    }
    iniciar()

    return () => {
      cancelado = true
      if (relogio.current) clearInterval(relogio.current)
      if (gravador.current && gravador.current.state !== 'inactive') {
        try {
          gravador.current.stop()
        } catch {
          /* já parado */
        }
      }
      trilha.current?.getTracks().forEach((t) => t.stop())
      trilha.current = null
    }
  }, [])

  // Libera o endereço temporário do preview. Separado do efeito de cima porque
  // lá o `urlPreview` do closure seria sempre nulo.
  useEffect(() => {
    if (!urlPreview) return
    return () => URL.revokeObjectURL(urlPreview)
  }, [urlPreview])

  function parar() {
    if (relogio.current) {
      clearInterval(relogio.current)
      relogio.current = null
    }
    if (gravador.current && gravador.current.state !== 'inactive') gravador.current.stop()
  }

  if (erro) {
    return (
      <div className="flex items-center gap-2 w-full">
        <p role="alert" className="flex-1 text-apoio text-err">
          {erro}
        </p>
        <Botao variante="neutro" tamanho="sm" onClick={aoCancelar}>
          Fechar
        </Botao>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 w-full">
      {estado === 'gravando' ? (
        <>
          <span className="flex items-center gap-2 flex-1 min-w-0">
            {/* O ponto pulsa para dizer que está gravando AGORA. O tempo ao
                lado carrega a informação, então quem não percebe o pulso não
                fica sem saber. */}
            <span className="w-2.5 h-2.5 rounded-full bg-err animate-pulse shrink-0" aria-hidden="true" />
            <span className="dado text-corpo-lg text-tx-1">{mmss(segundos)}</span>
            <span className="text-apoio text-tx-3 truncate">Gravando…</span>
          </span>
          <Botao variante="fantasma" tamanho="sm" onClick={aoCancelar} icone={<Trash2 size={15} />} aria-label="Descartar gravação" />
          <Botao variante="primario" tamanho="sm" onClick={parar} icone={<Square size={14} />}>
            Parar
          </Botao>
        </>
      ) : (
        <>
          {/*
            Player nativo do navegador, e não um desenhado por nós: ele já traz
            barra, tempo e teclado prontos, e a página declara `color-scheme:
            dark`, então ele aparece escuro em vez de destoar do tema.
          */}
          <audio src={urlPreview ?? undefined} controls className="flex-1 min-w-0 h-9" />
          <Botao variante="fantasma" tamanho="sm" onClick={aoCancelar} icone={<Trash2 size={15} />} aria-label="Descartar gravação" />
          <Botao
            variante="primario"
            tamanho="sm"
            carregando={enviando}
            onClick={() => arquivo.current && aoConfirmar(arquivo.current, segundos)}
            icone={<Send size={14} />}
          >
            Enviar
          </Botao>
        </>
      )}
    </div>
  )
}

/** Botão que abre o gravador. Some quando a gravação está em curso. */
export function BotaoGravar({
  onClick,
  desabilitado,
  className,
}: {
  onClick: () => void
  desabilitado?: boolean
  className?: string
}) {
  return (
    <Botao
      variante="fantasma"
      onClick={onClick}
      disabled={desabilitado}
      icone={<Mic size={17} />}
      aria-label="Gravar áudio"
      className={cn('shrink-0 px-0', className)}
    />
  )
}
