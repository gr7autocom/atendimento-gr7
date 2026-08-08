/**
 * Notificação nativa do sistema (o card do Windows), para o atendente.
 *
 * Portado do `notificacoes-nativas.ts` do painel, onde já roda em produção. O
 * detalhe que veio de lá e não é óbvio: em PWA no Windows, `new Notification()`
 * não é confiável, e o que funciona é `registration.showNotification()`, pelo
 * service worker. O `new Notification()` fica como reserva para o caso de não
 * haver service worker registrado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE A CENTRAL TEM SERVICE WORKER SEM SER INSTALÁVEL
 *
 * O ADR-11 diz que a central da equipe nunca vira aplicativo instalável. Isso
 * continua valendo: quem torna um site instalável é o **manifesto**, e a
 * central não tem nenhum. O service worker dela existe só para poder mostrar
 * notificação e trazer a janela para frente quando ela é clicada.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Estado da permissão, para a tela saber o que oferecer. */
export type EstadoPermissao = 'indisponivel' | 'concedida' | 'negada' | 'a_perguntar'

export function estadoDaPermissao(): EstadoPermissao {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'indisponivel'
  if (Notification.permission === 'granted') return 'concedida'
  if (Notification.permission === 'denied') return 'negada'
  return 'a_perguntar'
}

/**
 * Pede a permissão. Só pode ser chamada a partir de um gesto do usuário: o
 * navegador ignora (ou pune) pedido feito sozinho ao carregar a página, e um
 * pedido negado sem contexto é praticamente definitivo.
 */
export async function pedirPermissao(): Promise<EstadoPermissao> {
  if (estadoDaPermissao() === 'indisponivel') return 'indisponivel'
  const r = await Notification.requestPermission()
  return r === 'granted' ? 'concedida' : r === 'denied' ? 'negada' : 'a_perguntar'
}

export type Aviso = {
  titulo: string
  corpo?: string
  /** Para onde levar ao clicar. */
  url: string
  /*
    Agrupa: dois avisos com a mesma `tag` viram um só, o segundo substituindo o
    primeiro. Sem isso, dez mensagens do mesmo chamado empilham dez cards.
  */
  tag: string
}

/** Dispara o aviso do sistema. Silencioso quando não há permissão. */
export async function avisar(aviso: Aviso): Promise<void> {
  if (estadoDaPermissao() !== 'concedida') return

  const opcoes: NotificationOptions = {
    body: aviso.corpo,
    icon: '/icone-192.png',
    tag: aviso.tag,
    data: { url: aviso.url },
  }

  if ('serviceWorker' in navigator) {
    try {
      const registro = await navigator.serviceWorker.ready
      await registro.showNotification(aviso.titulo, opcoes)
      return
    } catch {
      /* cai para a reserva abaixo */
    }
  }

  const n = new Notification(aviso.titulo, opcoes)
  n.onclick = () => window.focus()
}

/**
 * Som curto de mensagem nova.
 *
 * Um único `Audio` reaproveitado: criar um a cada mensagem deixa objetos de
 * mídia soltos e, em rajada, o navegador começa a recusar a reprodução.
 * `currentTime = 0` reinicia o mesmo som.
 *
 * O `catch` vazio é proposital e não é falha engolida: navegador bloqueia
 * áudio antes de o usuário interagir com a página, e insistir só encheria o
 * console de erro sem nada a fazer a respeito.
 */
let audio: HTMLAudioElement | null = null

export function tocarAvisoSonoro(): void {
  if (typeof Audio === 'undefined') return
  if (!audio) {
    audio = new Audio('/nova-mensagem.mp3')
    audio.volume = 0.5
    audio.preload = 'auto'
  }
  audio.currentTime = 0
  void audio.play().catch(() => {})
}
