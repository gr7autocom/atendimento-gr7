export type StatusBot = 'conectado' | 'desconectado' | 'carregando'

/**
 * Status da conexão do WhatsApp (bot). Fonte única para a pílula da barra do topo
 * e para a tela de Conexão.
 *
 * Enquanto a integração uazapi não entra, retorna sempre `desconectado`. Quando o
 * adapter existir, este hook passa a buscar o status real (`statusConexao`) via
 * Edge Function e a revalidar em intervalo, sem mudar quem o consome.
 */
export function useStatusBot(): { status: StatusBot } {
  return { status: 'desconectado' }
}
