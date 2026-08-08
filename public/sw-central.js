/*
  Service worker da central da equipe.

  Ele existe por UM motivo só: mostrar notificação do sistema e trazer a janela
  para frente quando alguém clica nela. Em PWA no Windows, `new Notification()`
  não é confiável, e o caminho que funciona passa pelo service worker.

  ─────────────────────────────────────────────────────────────────────────────
  ISTO NÃO TORNA A CENTRAL INSTALÁVEL

  O ADR-11 diz que só o app do cliente vira aplicativo. Continua valendo: quem
  torna um site instalável é o **manifesto**, e a central não tem nenhum (ver o
  comentário no `index.html`). Service worker sozinho não faz o navegador
  oferecer instalação.

  Por isso, e ao contrário do `sw.js` do cliente, aqui NÃO HÁ CACHE NENHUM: sem
  `fetch`, sem `caches`, sem precache. A central é ferramenta de uso diário numa
  rede estável, e um cache mal ajustado ali significaria atendente vendo lista
  de chamados velha, que é pior que carregar de novo.
  ─────────────────────────────────────────────────────────────────────────────
*/

self.addEventListener('install', () => {
  // Assume na hora: não há cache para migrar, então esperar a aba fechar só
  // adiaria a correção de um bug deste arquivo.
  self.skipWaiting()
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim())
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = evento.notification.data?.url ?? '/'

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      /*
        Reaproveita a janela que já existe em vez de abrir outra. O atendente
        costuma ter a central aberta o dia inteiro; abrir uma segunda aba a cada
        clique em notificação deixaria meia dúzia de cópias do mesmo app
        disputando a mesma sessão até o fim do expediente.
      */
      for (const janela of janelas) {
        if ('focus' in janela) {
          janela.navigate?.(destino)
          return janela.focus()
        }
      }
      return self.clients.openWindow(destino)
    })
  )
})
