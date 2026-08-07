/**
 * O token de sessão no navegador do cliente.
 *
 * É o que faz o canal ser utilizável: quem fecha a aba e volta cai direto na
 * conversa em andamento, sem preencher nada de novo. Também é o motivo do aviso
 * na tela de identificação, porque limpar os dados do navegador apaga isto e
 * não há como recuperar (ver docs/canal-web.md).
 *
 * `localStorage` e não cookie: o PWA fala com outra origem (a Edge Function), e
 * cookie de terceiro é bloqueado por padrão nos navegadores atuais. O token vai
 * no header `x-sessao`, então precisa ser lido por JavaScript de qualquer forma.
 */

const CHAVE = 'gr7-atendimento-sessao'

export type SessaoLocal = {
  token: string
  /** Só para descartar sessão vencida sem gastar uma ida ao servidor. */
  expira_em: string
  protocolo: number
}

export function lerSessao(): SessaoLocal | null {
  try {
    const cru = localStorage.getItem(CHAVE)
    if (!cru) return null
    const dados = JSON.parse(cru) as SessaoLocal
    if (!dados?.token) return null
    // Vencida: descarta na hora. O servidor recusaria de qualquer jeito, mas
    // assim o cliente já cai no formulário em vez de ver a tela piscar.
    if (dados.expira_em && new Date(dados.expira_em).getTime() < Date.now()) {
      limparSessao()
      return null
    }
    return dados
  } catch {
    // Storage corrompido ou bloqueado (navegação privada em alguns navegadores):
    // o cliente perde a conversa antiga, mas consegue abrir outra.
    return null
  }
}

export function salvarSessao(dados: SessaoLocal): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados))
  } catch {
    /* sem storage o atendimento funciona até fechar a aba, o que é melhor que travar */
  }
}

export function limparSessao(): void {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    /* idem */
  }
}
