/*
  Service worker do PWA do cliente (canal web).

  Escrito à mão, sem `vite-plugin-pwa`: o plugin quer ser dono do build inteiro,
  e este repositório tem duas entradas, das quais só uma pode virar aplicativo.
  Ver docs/canal-web.md.

  ────────────────────────────────────────────────────────────────────────────
  A REGRA QUE NÃO PODE CAIR NUMA MANUTENÇÃO DISTRAÍDA

  Nada da Edge Function entra em cache. Nenhuma resposta de `atendimento-web`,
  em nenhuma estratégia, por nenhum motivo. O que passa por ali é conversa de
  cliente: nome, telefone, CNPJ e o relato do problema. Guardar isso em disco,
  no computador de quem pediu suporte, é o oposto do que este canal promete, e
  sobreviveria à revogação da sessão pelo atendente.

  A defesa é o `return` logo na entrada do `fetch`: o que não é do nosso próprio
  endereço nunca chega às estratégias abaixo. A Edge Function mora em
  `*.supabase.co`, então cai nesse filtro. O teste em `sw.test.ts` cobre isso.
  ────────────────────────────────────────────────────────────────────────────

  O que o cache cobre é só a casca: o HTML, o JavaScript, o CSS, a logo e os
  ícones. Serve para o app abrir instantâneo e para não mostrar tela de erro do
  navegador quando a rede cai no meio do uso. A conversa em si sempre vem da
  rede, e quando não vem, a tela diz que está offline (não existe fila de envio:
  "mandei e ninguém recebeu" é pior que "você está sem internet").
*/

/*
  A versão é trocada pelo build (vite.config.ts, plugin `gr7:estaticos-por-app`)
  pelo hash do JavaScript gerado. Não é enfeite: o `activate` apaga todo cache
  de nome diferente do atual, então é isto que faz a casca velha sair do
  aparelho do cliente quando publicamos.

  Com um número fixo escrito à mão, o cache do primeiro dia sobreviveria a
  todas as publicações seguintes, guardando arquivos que ninguém mais pede.
  Em desenvolvimento o marcador fica como está, e não há build para trocá-lo.
*/
const VERSAO = '__VERSAO_BUILD__'
const CACHE = `gr7-atendimento-casca-${VERSAO}`

/*
  A casca mínima para a primeira tela existir sem rede. Só nomes fixos: os
  arquivos gerados pelo Vite têm hash no nome, mudam a cada build e entram
  sozinhos pelo cache de execução, abaixo.
*/
const CASCA = ['/', '/marca-gr7.png', '/icone-192.png']

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) =>
      /*
        `allSettled` e não `addAll`: o `addAll` é atômico, então um único item
        que responda 404 derruba a instalação inteira e o app fica sem service
        worker nenhum. Casca incompleta é muito melhor que isso.
      */
      Promise.allSettled(CASCA.map((url) => cache.add(url)))
    )
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      /*
        `claim` para as abas já abertas passarem a ser atendidas na primeira
        instalação, sem esperar recarga. Note que NÃO há `skipWaiting`: uma
        versão nova só assume quando o app é fechado e reaberto, o que evita
        trocar o JavaScript debaixo de uma conversa em andamento. O HTML é
        buscado na rede primeiro, então a versão nova chega assim mesmo.
      */
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (evento) => {
  const req = evento.request

  // Só GET. POST de mensagem, avaliação e encerramento nunca se repete de cache.
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // A regra do topo do arquivo. Tudo que não é do nosso endereço para aqui,
  // e é isso que mantém a Edge Function fora do disco.
  if (url.origin !== self.location.origin) return

  // Navegação (abrir o app, recarregar): rede primeiro, para quem abre com
  // internet receber sempre a versão publicada. Sem rede, entrega a casca.
  if (req.mode === 'navigate') {
    evento.respondWith(
      fetch(req)
        .then((resposta) => {
          const copia = resposta.clone()
          caches.open(CACHE).then((cache) => cache.put(req, copia))
          return resposta
        })
        // Sem rede: a própria página se estiver guardada, senão a raiz, que é
        // a única entrada desta pasta e cobre qualquer caminho do aplicativo.
        .catch(async () => (await caches.match(req)) ?? (await caches.match('/')) ?? Response.error())
    )
    return
  }

  /*
    Arquivo com hash no nome (`/assets/cliente-a1b2c3.js`): o conteúdo nunca
    muda para aquele nome, então cache primeiro, sem revalidar. É o que faz a
    abertura ser instantânea.
  */
  if (url.pathname.startsWith('/assets/')) {
    evento.respondWith(
      caches.match(req).then(
        (cacheado) =>
          cacheado ??
          fetch(req).then((resposta) => {
            const copia = resposta.clone()
            caches.open(CACHE).then((cache) => cache.put(req, copia))
            return resposta
          })
      )
    )
    return
  }

  /*
    O resto do nosso endereço (logo, ícones, manifest): entrega o que está em
    cache na hora e atualiza por baixo. Esses nomes são fixos, então cache
    puro deixaria uma logo trocada sem aparecer até limpar o navegador.
  */
  evento.respondWith(
    caches.match(req).then((cacheado) => {
      const daRede = fetch(req)
        .then((resposta) => {
          const copia = resposta.clone()
          caches.open(CACHE).then((cache) => cache.put(req, copia))
          return resposta
        })
        .catch(() => cacheado ?? Response.error())
      return cacheado ?? daRede
    })
  )
})
