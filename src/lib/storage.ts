/**
 * Upload de anexo para o Supabase Storage, bucket `atendimento-anexos`.
 *
 * Substitui o antigo `lib/cloudinary.ts`. Portado do `lib/storage.ts` do
 * painel (que já fez esta mesma migração para tarefas/scrap em 2026-08-08),
 * com o mesmo desenho: upload por `XMLHttpRequest`, e não `supabase-js`,
 * porque só o XHR expõe progresso de upload, e a barra do anexo depende
 * disso.
 *
 * ATENÇÃO ao usar isto no app do cliente: **não use**. Este módulo sobe o
 * arquivo com a sessão do atendente logado, o que é aceitável na central e
 * não é no canal web, onde o navegador é de qualquer pessoa da internet e não
 * tem sessão de atendente nenhuma. Lá o upload passa pela Edge Function
 * (`_shared/web/anexo.ts`), que grava com a chave de serviço. A guarda em
 * `src/padroes-ui.test.ts` barra o import em `src/cliente/`.
 */

import { supabase } from './supabase'

const BUCKET = 'atendimento-anexos'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const MAX_NOME = 60

/** Teto por arquivo. Mesmo valor que o Cloudinary aceitava; a troca de provedor não muda o limite do produto. */
export const TAMANHO_MAXIMO_MB = 10

export type ArquivoEnviado = {
  url: string
  storage_path: string
  nome_arquivo: string
  tipo_mime: string
  tamanho_bytes: number
}

function sanitizar(nome: string): string {
  const ponto = nome.lastIndexOf('.')
  const temExtensao = ponto > 0 && ponto < nome.length - 1
  const base = temExtensao ? nome.slice(0, ponto) : nome
  const ext = temExtensao ? nome.slice(ponto + 1) : ''

  const limpo = (s: string, max: number, manterHifen: boolean) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(manterHifen ? /[^a-z0-9]+/g : /[^a-z0-9]/g, manterHifen ? '-' : '')
      .replace(/^-+|-+$/g, '')
      .slice(0, max)

  const baseLimpa = limpo(base, MAX_NOME, true) || 'arquivo'
  const extLimpa = limpo(ext, 20, false)
  return extLimpa ? `${baseLimpa}.${extLimpa}` : baseLimpa
}

export function montarPath(nomeArquivo: string, pasta: string): string {
  return `${pasta}/${crypto.randomUUID()}-${sanitizar(nomeArquivo)}`
}

export function urlPublica(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

/** Motivo pelo qual o arquivo não pode ser enviado, ou `null` se pode. */
export function recusaDoArquivo(arquivo: File): string | null {
  if (arquivo.size === 0) return 'O arquivo está vazio.'
  if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    return `O arquivo tem ${formatarTamanho(arquivo.size)}. O limite é ${TAMANHO_MAXIMO_MB} MB.`
  }
  return null
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Envia e informa o progresso. `XMLHttpRequest` e não `fetch` porque só ele
 * expõe progresso de upload, e um anexo de 8 MB numa rede ruim sem barra
 * nenhuma parece que travou.
 */
export function enviarAnexo(
  arquivo: File,
  aoProgredir?: (pct: number) => void,
  pasta = 'atendimento-anexos'
): Promise<ArquivoEnviado> {
  return new Promise((resolve, reject) => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        reject(new Error('Sessão expirada. Entre novamente para enviar arquivos.'))
        return
      }

      const path = montarPath(arquivo.name, pasta)
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        // Para em 90: os 10 finais são o servidor processando, e mostrar 100
        // antes da resposta faria a barra encher e a tela continuar parada.
        if (e.lengthComputable) aoProgredir?.(Math.round((e.loaded / e.total) * 90))
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          aoProgredir?.(100)
          resolve({
            url: urlPublica(path),
            storage_path: path,
            nome_arquivo: arquivo.name,
            tipo_mime: arquivo.type || 'application/octet-stream',
            tamanho_bytes: arquivo.size,
          })
        } else {
          reject(new Error('Não conseguimos enviar o arquivo. Tente de novo.'))
        }
      })

      xhr.addEventListener('error', () => reject(new Error('Sem conexão para enviar o arquivo.')))

      xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`)
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
      xhr.setRequestHeader('x-upsert', 'false')
      if (arquivo.type) xhr.setRequestHeader('Content-Type', arquivo.type)
      xhr.send(arquivo)
    })
  })
}

/** Se o anexo deve aparecer aberto na conversa em vez de virar linha de arquivo. */
export function ehImagem(tipoMime: string | null): boolean {
  return !!tipoMime && tipoMime.startsWith('image/')
}

export function ehAudio(tipoMime: string | null): boolean {
  return !!tipoMime && tipoMime.startsWith('audio/')
}
