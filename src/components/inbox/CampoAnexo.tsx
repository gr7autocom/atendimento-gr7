import { useRef, useState } from 'react'
import { Paperclip, X, AlertCircle } from 'lucide-react'
import { enviarAnexo, recusaDoArquivo, formatarTamanho, type ArquivoEnviado } from '../../lib/storage'
import { cn } from '../../lib/utils'

/**
 * Botão de anexo e a fila do que está para ir junto com a resposta.
 *
 * O arquivo sobe **no momento em que é escolhido**, não no Enviar. Dois motivos:
 * a pessoa continua escrevendo a mensagem enquanto o arquivo viaja, e quando o
 * upload falha ela descobre na hora, com o texto ainda na tela, em vez de
 * descobrir no clique final e ter que refazer tudo.
 *
 * Falha de upload **não some**: o item fica na fila marcado em vermelho, com o
 * motivo e o botão de tirar. Anexo que evapora em silêncio faz o atendente
 * mandar "segue em anexo" sem anexo nenhum.
 */

export type AnexoPendente = {
  /** Chave só da tela; o id de verdade nasce no banco. */
  chave: string
  nome: string
  tamanho: number
  progresso: number
  enviado: ArquivoEnviado | null
  erro: string | null
}

let contador = 0

export function CampoAnexo({
  onMudar,
  desabilitado,
}: {
  onMudar: (fn: (atual: AnexoPendente[]) => AnexoPendente[]) => void
  desabilitado?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)

  function atualizar(chave: string, patch: Partial<AnexoPendente>) {
    onMudar((atual) => atual.map((p) => (p.chave === chave ? { ...p, ...patch } : p)))
  }

  async function receber(arquivos: FileList | null) {
    if (!arquivos?.length) return
    for (const arquivo of Array.from(arquivos)) {
      const chave = `a${++contador}`
      const recusa = recusaDoArquivo(arquivo)

      onMudar((atual) => [
        ...atual,
        {
          chave,
          nome: arquivo.name,
          tamanho: arquivo.size,
          progresso: 0,
          enviado: null,
          erro: recusa,
        },
      ])
      if (recusa) continue

      try {
        const enviado = await enviarAnexo(arquivo, (pct) => atualizar(chave, { progresso: pct }))
        atualizar(chave, { enviado, progresso: 100 })
      } catch (e) {
        atualizar(chave, { erro: e instanceof Error ? e.message : 'Falha ao enviar o arquivo.' })
      }
    }
    // Zera o input: sem isso, escolher o MESMO arquivo de novo não dispara
    // `change`, e a pessoa acha que o clique não funcionou.
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={(e) => receber(e.target.files)}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={desabilitado}
        aria-label="Anexar arquivo"
        className="shrink-0 w-9 h-9 rounded-1 flex items-center justify-center text-tx-2 hover:text-tx-1 hover:bg-sf-2 disabled:opacity-40 disabled:pointer-events-none transicao focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]"
      >
        <Paperclip size={17} />
      </button>

      {/*
        Área de soltar: cobre o rodapé inteiro só enquanto o arquivo está sendo
        arrastado. Arrastar para a conversa é o gesto que as pessoas tentam
        primeiro, e sem isto o navegador abriria o arquivo por cima do app.
      */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!desabilitado) setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastando(false)
          if (!desabilitado) receber(e.dataTransfer.files)
        }}
        className={cn(
          'fixed inset-0 z-40 pointer-events-none',
          arrastando && 'pointer-events-auto bg-br-soft border-2 border-dashed border-br-2'
        )}
        aria-hidden="true"
      />
    </>
  )
}

/** A fila em si, acima do campo de texto. */
export function FilaAnexos({
  pendentes,
  onRemover,
}: {
  pendentes: AnexoPendente[]
  onRemover: (chave: string) => void
}) {
  if (pendentes.length === 0) return null

  return (
    <ul className="mb-2 flex flex-col gap-1.5">
      {pendentes.map((p) => (
        <li
          key={p.chave}
          className={cn(
            'flex items-center gap-2 h-10 px-2.5 rounded-1 border bg-sf-2',
            p.erro ? 'border-err' : 'border-bd-2'
          )}
        >
          {p.erro && <AlertCircle size={15} className="shrink-0 text-err" aria-hidden="true" />}
          <span className="min-w-0 flex-1">
            <span className="block text-corpo text-tx-1 truncate">{p.nome}</span>
            {p.erro ? (
              <span className="block text-mini text-err" role="alert">
                {p.erro}
              </span>
            ) : p.enviado ? (
              <span className="block text-mini text-tx-3">{formatarTamanho(p.tamanho)}</span>
            ) : (
              <span className="block text-mini text-tx-3">Enviando… {p.progresso}%</span>
            )}
          </span>
          {!p.erro && !p.enviado && (
            <span className="w-16 h-1 shrink-0 rounded-full bg-sf-0 overflow-hidden" aria-hidden="true">
              <span className="block h-full bg-br-2 transicao" style={{ width: `${p.progresso}%` }} />
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemover(p.chave)}
            aria-label={`Tirar ${p.nome}`}
            className="shrink-0 w-6 h-6 rounded-1 flex items-center justify-center text-tx-3 hover:text-tx-1 hover:bg-sf-3 transicao"
          >
            <X size={14} />
          </button>
        </li>
      ))}
    </ul>
  )
}
