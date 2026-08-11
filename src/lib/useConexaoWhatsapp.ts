import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/** Espelha `StatusConexao` de `supabase/functions/_shared/whatsapp/tipos.ts`. */
export type StatusConexao = 'connected' | 'connecting' | 'disconnected' | 'hibernated'

export type ResultadoConexao = {
  status: StatusConexao
  /** QR em base64 (quando conecta sem informar telefone). */
  qrCode?: string | null
  /** Pairing code (quando conecta informando telefone). */
  pairingCode?: string | null
}

const CHAVE = ['whatsapp-conexao'] as const

async function invocar<T>(opcoes: { method: 'GET' | 'POST'; body?: Record<string, unknown> }): Promise<T> {
  const { data, error } = await supabase.functions.invoke('whatsapp-conexao', opcoes)
  if (error) throw error
  return data as T
}

/**
 * Status da conexão do WhatsApp, revalidado a cada 15s. Fonte única para a
 * pílula da barra do topo (`useStatusBot`) e para a tela Conexão.
 */
export function useConexaoStatus() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: () => invocar<ResultadoConexao>({ method: 'GET' }),
    refetchInterval: 15000,
  })
}

/** Inicia a conexão: sem telefone gera QR Code (2 min); com telefone, código de pareamento (5 min). */
export function useConectarWhatsapp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (phone?: string) =>
      invocar<ResultadoConexao>({ method: 'POST', body: phone ? { phone } : {} }),
    onSuccess: (dados) => qc.setQueryData(CHAVE, dados),
  })
}

/** Aponta o webhook da uazapi para a nossa Edge Function (URL calculada no servidor). */
export function useConfigurarWebhookWhatsapp() {
  return useMutation({
    mutationFn: () => invocar<{ ok: true; url: string }>({ method: 'POST', body: { acao: 'webhook' } }),
  })
}
