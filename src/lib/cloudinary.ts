/**
 * Upload de anexo para o Cloudinary.
 *
 * Portado do `lib/cloudinary.ts` do painel, que já é o caminho usado por
 * tarefas e pelo Talks. O arquivo nunca passa pelo nosso banco: o Cloudinary
 * devolve `secure_url` e `public_id`, e é isso que vai para `atendimento_anexos`.
 * Ver docs/db.md.
 *
 * ATENÇÃO ao usar isto no app do cliente: **não use**. Este módulo manda o
 * arquivo direto do navegador com um preset aberto, o que é aceitável na
 * central (quem abre é funcionário logado) e não é no canal web, onde o
 * navegador é de qualquer pessoa da internet e o preset exposto vira porta
 * para encher a conta de lixo. Lá o upload passa pela Edge Function.
 * A guarda em `src/padroes-ui.test.ts` barra o import em `src/cliente/`.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string

/** Teto por arquivo. O plano gratuito do Cloudinary aceita 10 MB por imagem. */
export const TAMANHO_MAXIMO_MB = 10

export type ArquivoEnviado = {
  url: string
  public_id: string
  nome_arquivo: string
  tipo_mime: string
  tamanho_bytes: number
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
  const form = new FormData()
  form.append('file', arquivo)
  form.append('upload_preset', UPLOAD_PRESET)
  form.append('folder', pasta)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      // Para em 90: os 10 finais são o servidor processando, e mostrar 100
      // antes da resposta faria a barra encher e a tela continuar parada.
      if (e.lengthComputable) aoProgredir?.(Math.round((e.loaded / e.total) * 90))
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const dados = JSON.parse(xhr.responseText) as { secure_url: string; public_id: string }
        aoProgredir?.(100)
        resolve({
          url: dados.secure_url,
          public_id: dados.public_id,
          nome_arquivo: arquivo.name,
          tipo_mime: arquivo.type || 'application/octet-stream',
          tamanho_bytes: arquivo.size,
        })
      } else {
        reject(new Error('Não conseguimos enviar o arquivo. Tente de novo.'))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Sem conexão para enviar o arquivo.')))

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`)
    xhr.send(form)
  })
}

/** Se o anexo deve aparecer aberto na conversa em vez de virar linha de arquivo. */
export function ehImagem(tipoMime: string | null): boolean {
  return !!tipoMime && tipoMime.startsWith('image/')
}

export function ehAudio(tipoMime: string | null): boolean {
  return !!tipoMime && tipoMime.startsWith('audio/')
}
