/**
 * Upload de anexo do canal web, feito **pelo servidor**.
 *
 * Por que não do navegador, como a central faz: lá o `lib/cloudinary.ts` sobe
 * direto com um preset aberto, e isso é aceitável porque quem abre a central é
 * funcionário logado. Aqui o navegador é de qualquer pessoa da internet. Um
 * preset aberto embarcado no app do cliente é um endereço de upload sem dono
 * publicado na web, e a primeira coisa que acontece com um desses é alguém
 * hospedar o que quiser na conta.
 *
 * Então o arquivo passa por aqui: a função confere a sessão, o tipo e o
 * tamanho, e só então envia ao Cloudinary com **assinatura** gerada a partir do
 * `CLOUDINARY_API_SECRET`, que nunca sai do servidor.
 */

import { ErroContrato } from './contrato.ts'

/** Teto por arquivo. Igual ao da central, para o cliente não descobrir na hora que o dele é maior. */
export const MAX_ANEXO_BYTES = 10 * 1024 * 1024

/*
  Lista fechada de tipos, e não "tudo menos executável".

  Uma lista de proibidos sempre esquece uma extensão, e o custo do esquecimento
  é hospedar um instalador na conta da GR7 com um endereço que parece nosso.
  O que o cliente precisa mandar para descrever um problema está tudo aqui:
  print da tela, foto do equipamento, nota em PDF, planilha e áudio.
*/
const TIPOS_ACEITOS = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/heic',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
]

export function tipoAceito(tipo: string): boolean {
  // `split(';')`: o navegador manda `audio/webm;codecs=opus` na gravação.
  return TIPOS_ACEITOS.includes(tipo.split(';')[0].trim().toLowerCase())
}

export type AnexoGravado = {
  public_id: string
  url: string
  nome_arquivo: string
  tipo_mime: string
  tamanho_bytes: number
}

/**
 * Assinatura do Cloudinary: SHA-1 dos parâmetros em ordem alfabética + o segredo.
 *
 * Exportada porque o `destroy` da eliminação de titular (LGPD) assina do mesmo
 * jeito. Duplicar essa função em dois lugares seria o pior tipo de duplicação:
 * uma cópia errada não falha no build, falha em produção com "assinatura
 * inválida" e o arquivo do titular continua no ar.
 */
export async function assinar(params: Record<string, string>, segredo: string): Promise<string> {
  const base = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  const dados = new TextEncoder().encode(base + segredo)
  const hash = await crypto.subtle.digest('SHA-1', dados)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Manda o arquivo ao Cloudinary e devolve o que vai para `atendimento_anexos`.
 *
 * `resource_type=auto` porque o mesmo caminho serve para imagem, PDF e áudio, e
 * o Cloudinary trata cada um de um jeito.
 */
export async function subirParaCloudinary(arquivo: File): Promise<AnexoGravado> {
  const cloud = Deno.env.get('CLOUDINARY_CLOUD_NAME')
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY')
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')

  // Falha fechada e explícita: sem credencial, o anexo não vai a lugar nenhum,
  // e o cliente precisa saber disso em vez de ver a mensagem sair sem o arquivo.
  if (!cloud || !apiKey || !apiSecret) throw new ErroContrato('erro_interno', 500)

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const pasta = 'atendimento-web'
  const assinatura = await assinar({ folder: pasta, timestamp }, apiSecret)

  const form = new FormData()
  form.append('file', arquivo)
  form.append('api_key', apiKey)
  form.append('timestamp', timestamp)
  form.append('folder', pasta)
  form.append('signature', assinatura)

  const resposta = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, {
    method: 'POST',
    body: form,
  })
  if (!resposta.ok) throw new ErroContrato('erro_interno', 502)

  const dados = (await resposta.json()) as { secure_url: string; public_id: string }
  return {
    public_id: dados.public_id,
    url: dados.secure_url,
    nome_arquivo: arquivo.name,
    tipo_mime: arquivo.type || 'application/octet-stream',
    tamanho_bytes: arquivo.size,
  }
}
