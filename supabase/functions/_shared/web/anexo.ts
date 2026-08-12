/**
 * Upload de anexo do canal web, feito **pelo servidor**.
 *
 * Por que não do navegador, como a central faz: lá o `lib/storage.ts` sobe
 * direto com a sessão do atendente logado, e isso é aceitável porque quem
 * abre a central é funcionário autenticado. Aqui o navegador é de qualquer
 * pessoa da internet, sem sessão de atendente nenhuma. Então o arquivo passa
 * por aqui: a função confere a sessão do canal web (não a do Supabase), o
 * tipo e o tamanho, e só então grava no bucket com a chave de serviço, que
 * ignora RLS — é o mesmo motivo pelo qual `atendimento-web` inteira roda com
 * service role (ver `_shared/supabase.ts`).
 */

import type { ClienteServico } from '../supabase.ts'
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
  storage_path: string
  url: string
  nome_arquivo: string
  tipo_mime: string
  tamanho_bytes: number
}

const BUCKET = 'atendimento-anexos'
const MAX_NOME = 60

/** Mesma limpeza de nome do `src/lib/storage.ts`, duplicada porque a Edge Function
 *  (Deno) e o frontend (Vite) não compartilham módulo entre si. */
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

/**
 * Grava o arquivo no Storage e devolve o que vai para `atendimento_anexos`.
 *
 * `sb` precisa ser o cliente de serviço (`criarClienteServico()`): o upload
 * ignora RLS de propósito, porque quem chama aqui não tem sessão Supabase.
 */
export async function subirParaStorage(sb: ClienteServico, arquivo: File): Promise<AnexoGravado> {
  const path = `atendimento-web/${crypto.randomUUID()}-${sanitizar(arquivo.name)}`

  const { error } = await sb.storage.from(BUCKET).upload(path, arquivo, {
    contentType: arquivo.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new ErroContrato('erro_interno', 502)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  return {
    storage_path: path,
    url: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`,
    nome_arquivo: arquivo.name,
    tipo_mime: arquivo.type || 'application/octet-stream',
    tamanho_bytes: arquivo.size,
  }
}
