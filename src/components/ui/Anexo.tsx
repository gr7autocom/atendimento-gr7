import { useState } from 'react'
import { FileText, Download, ImageIcon, FileSpreadsheet, FileArchive } from 'lucide-react'
import { Modal } from './Modal'
import { cn } from '../../lib/utils'

/**
 * Anexo dentro da bolha da conversa, e o visualizador que abre ao clicar.
 *
 * Fica em `components/ui/` porque as duas aplicações mostram o mesmo anexo: a
 * central para o atendente e o app do cliente. O tipo é declarado aqui, e não
 * importado de `useInbox`, porque importar de lá arrastaria o cliente Supabase
 * para dentro do app do cliente, que não pode tê-lo (guarda em padroes-ui.test).
 *
 * Imagem aparece aberta; o resto vira linha de arquivo. Miniatura de PDF ou de
 * planilha não diz nada que o nome do arquivo já não diga, e ocuparia a
 * conversa inteira de quem manda três anexos seguidos.
 */

export type AnexoExibivel = {
  id: string
  url: string
  nome_arquivo: string | null
  tipo_mime: string | null
  tamanho_bytes: number | null
}

function formatarTamanho(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ehImagem(tipo: string | null): boolean {
  return !!tipo && tipo.startsWith('image/')
}

function ehAudio(tipo: string | null): boolean {
  return !!tipo && tipo.startsWith('audio/')
}

/** Ícone pelo tipo, para o olho distinguir a linha antes de ler o nome. */
function IconeDoTipo({ tipo }: { tipo: string | null }) {
  const t = tipo ?? ''
  if (t.startsWith('image/')) return <ImageIcon size={18} />
  if (t.includes('spreadsheet') || t.includes('excel') || t.includes('csv')) return <FileSpreadsheet size={18} />
  if (t.includes('zip') || t.includes('rar') || t.includes('compressed')) return <FileArchive size={18} />
  return <FileText size={18} />
}

export function ListaAnexos({ anexos, className }: { anexos: AnexoExibivel[]; className?: string }) {
  const [aberto, setAberto] = useState<AnexoExibivel | null>(null)
  if (anexos.length === 0) return null

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {anexos.map((a) =>
        ehAudio(a.tipo_mime) ? (
          /*
            Player nativo do navegador. Ele já traz barra, tempo, velocidade e
            controle por teclado, e a página declara `color-scheme: dark`, então
            aparece escuro em vez de destoar. Um player desenhado por nós seria
            200 linhas para reimplementar, pior, o que o navegador entrega.
          */
          <audio
            key={a.id}
            src={a.url}
            controls
            preload="metadata"
            className="h-9 w-full min-w-[220px] max-w-[320px]"
            aria-label={a.nome_arquivo ?? 'Áudio enviado'}
          />
        ) : ehImagem(a.tipo_mime) ? (
          <button
            key={a.id}
            type="button"
            onClick={() => setAberto(a)}
            className="block rounded-1 overflow-hidden border border-bd-2 hover:border-tx-3 transicao focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]"
            aria-label={`Abrir imagem ${a.nome_arquivo ?? ''}`}
          >
            {/*
              `max-h` e não altura fixa: print de tela é alto e foto é larga, e
              cortar em quadrado esconderia justamente a mensagem de erro que o
              cliente quis mostrar. Sem `width/height` conhecidos, a proporção
              vem do próprio arquivo.
            */}
            <img
              src={a.url}
              alt={a.nome_arquivo ?? 'Imagem enviada'}
              loading="lazy"
              className="max-h-56 w-auto max-w-full object-contain bg-sf-0"
            />
          </button>
        ) : (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 h-10 px-2.5 rounded-1 border border-bd-2 bg-sf-0/40 hover:border-tx-3 transicao focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]"
          >
            <span className="shrink-0 text-tx-2">
              <IconeDoTipo tipo={a.tipo_mime} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-corpo text-tx-1 truncate">{a.nome_arquivo ?? 'Arquivo'}</span>
              {a.tamanho_bytes ? (
                <span className="block text-mini text-tx-3">{formatarTamanho(a.tamanho_bytes)}</span>
              ) : null}
            </span>
            <Download size={15} className="shrink-0 text-tx-3" aria-hidden="true" />
          </a>
        )
      )}

      <Modal
        titulo={aberto?.nome_arquivo ?? 'Imagem'}
        aberto={!!aberto}
        onFechar={() => setAberto(null)}
        largura="ampla"
      >
        {aberto && (
          <div className="flex flex-col items-center gap-3">
            <img
              src={aberto.url}
              alt={aberto.nome_arquivo ?? 'Imagem enviada'}
              className="max-h-[70dvh] max-w-full object-contain"
            />
            {/*
              Baixar como link e não como botão: é navegação para um arquivo, e
              o navegador cuida de salvar. `download` só é respeitado na mesma
              origem, então em outro domínio abre em aba nova, que é o
              comportamento aceitável.
            */}
            <a
              href={aberto.url}
              target="_blank"
              rel="noopener noreferrer"
              download={aberto.nome_arquivo ?? undefined}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-1 text-corpo text-br-2 hover:bg-sf-2 transicao"
            >
              <Download size={15} aria-hidden="true" />
              Baixar {aberto.tamanho_bytes ? `(${formatarTamanho(aberto.tamanho_bytes)})` : ''}
            </a>
          </div>
        )}
      </Modal>
    </div>
  )
}
