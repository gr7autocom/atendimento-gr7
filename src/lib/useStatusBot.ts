import { useConexaoStatus } from './useConexaoWhatsapp'

export type StatusBot = 'conectado' | 'desconectado' | 'carregando'

/**
 * Status da conexão do WhatsApp (bot). Fonte única para a pílula da barra do topo
 * e para a tela de Conexão — as duas consultam `useConexaoStatus` (Edge Function
 * `whatsapp-conexao`), então nunca divergem.
 */
export function useStatusBot(): { status: StatusBot } {
  const { data, isLoading } = useConexaoStatus()
  if (isLoading) return { status: 'carregando' }
  return { status: data?.status === 'connected' ? 'conectado' : 'desconectado' }
}
