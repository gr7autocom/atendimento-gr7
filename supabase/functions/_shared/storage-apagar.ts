/**
 * Apagar arquivo no Supabase Storage.
 *
 * Existe para a eliminação de titular (LGPD, Art. 18, VI): o relato sai do banco
 * e o arquivo tem de sair do bucket, senão continua alcançável por quem tiver
 * a URL — e depois da eliminação nem existe mais registro apontando para ele.
 *
 * Recebe o cliente de quem chama (não cria um próprio): a exclusão de titular
 * (`atendimento-lgpd`) roda com o JWT do admin, de propósito — ver o
 * cabeçalho daquele arquivo. Quem autoriza a remoção são as policies
 * `atendimento_anexos_select`/`atendimento_anexos_delete` em `storage.objects`
 * (migration `20260811150000`), gatilhadas por `public.e_admin()`, a mesma
 * função que já gate a RPC que lista estes arquivos.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'atendimento-anexos'

export type ResultadoApagar = {
  storage_path: string
  apagado: boolean
  /** Só quando não apagou: o que o Storage respondeu, para o relatório. */
  motivo?: string
}

/**
 * Apaga um arquivo. Nunca lança: a eliminação do banco não pode ser abortada
 * porque o Storage falhou em um arquivo, senão um erro transitório deixaria o
 * pedido do titular sem atendimento nenhum. O que não saiu volta marcado, para
 * o relatório dizer a verdade e alguém poder repetir.
 */
export async function apagarNoStorage(sb: SupabaseClient, storagePath: string): Promise<ResultadoApagar> {
  const { data, error } = await sb.storage.from(BUCKET).remove([storagePath])
  if (error) return { storage_path: storagePath, apagado: false, motivo: error.message }

  /*
    A API do Storage responde 200 com lista vazia tanto quando o objeto já não
    existe quanto quando a policy nega a remoção (RLS filtra a linha sem gerar
    erro) — a mesma armadilha que a migration `20260808153722` do painel documentou.
    Sem esta checagem o chamador acha que apagou e o relatório mente para o titular.
  */
  if (!data || data.length === 0) {
    return { storage_path: storagePath, apagado: false, motivo: 'arquivo não encontrado ou sem permissão' }
  }
  return { storage_path: storagePath, apagado: true }
}
