/**
 * Contador na aba: título e favicon, para avisar sem depender de permissão
 * nenhuma.
 *
 * Existe porque a notificação nativa (`notificacoes.ts`) só funciona com a
 * permissão concedida, e no cliente isso depende de a pessoa ter clicado em
 * "Avisar quando responderem". Quem não clicou, ou está numa máquina que
 * nega notificação, fica sem aviso nenhum além do som — e som não ajuda numa
 * máquina sem caixa de som, o caso que motivou isto (2026-08-10).
 *
 * Título e favicon não pedem permissão porque não são notificação do sistema:
 * são só o conteúdo da própria aba, que a página sempre pode mudar. É o mesmo
 * truque do Gmail e do WhatsApp Web.
 */

let contador = 0
let tituloBase: string | null = null
let faviconBase: string | null = null

function linkDoFavicon(): HTMLLinkElement | null {
  return document.querySelector('link[rel="icon"]')
}

/** Guarda o título e o favicon originais na primeira vez, para restaurar depois. */
function garantirBase() {
  if (tituloBase === null) tituloBase = document.title
  if (faviconBase === null) faviconBase = linkDoFavicon()?.href ?? null
}

/**
 * Desenha o favicon original com uma bolinha vermelha e o número por cima.
 *
 * Redesenha sempre a partir do `faviconBase` — a imagem original, nunca a
 * badge anterior —, senão bolinhas se empilhariam a cada mensagem nova.
 */
function faviconComContador(hrefBase: string, n: number, corDaBolinha: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const tam = 32
      const canvas = document.createElement('canvas')
      canvas.width = tam
      canvas.height = tam
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('sem contexto 2d'))
        return
      }

      // Desenha a imagem original centrada, preservando a proporção: o
      // favicon.svg não é quadrado (48×46), e estirar para 32×32 distorceria.
      const escala = Math.min(tam / img.width, tam / img.height)
      const w = img.width * escala
      const h = img.height * escala
      ctx.drawImage(img, (tam - w) / 2, (tam - h) / 2, w, h)

      const raio = tam * 0.3
      const cx = tam - raio
      const cy = raio
      ctx.beginPath()
      ctx.arc(cx, cy, raio, 0, Math.PI * 2)
      ctx.fillStyle = corDaBolinha
      ctx.fill()

      // Branco, não um token: é o texto sobre a bolinha vermelha do favicon, e
      // o tema não tem "texto sobre erro" — o par de contraste aqui é
      // universal (a mesma escolha do ponto de notificação de qualquer app),
      // não uma cor de marca ou de superfície.
      ctx.fillStyle = 'white'
      ctx.font = `bold ${raio * 1.15}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(n > 9 ? '9+' : String(n), cx, cy + raio * 0.05)

      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('falha ao carregar o favicon base'))
    img.src = hrefBase
  })
}

async function atualizarFavicon() {
  if (!faviconBase) return
  try {
    const link = linkDoFavicon()
    if (!link) return
    /*
      Lida do token, não hex cravado: `err` (tema.css) é a cor de erro/perigo
      do projeto, e a guarda em padroes-ui.test.ts barra hex fora de
      lib/cores.ts. Resolvida em tempo de execução porque o canvas 2D não lê
      variável CSS, só cor concreta.
    */
    // "crimson" e não hex: é só o piso de segurança para o var() não resolver
    // (ambiente sem o tema.css carregado), e hex aqui cairia na mesma guarda
    // que este comentário está evitando.
    const cor = getComputedStyle(document.documentElement).getPropertyValue('--err').trim() || 'crimson'
    link.href = await faviconComContador(faviconBase, contador, cor)
  } catch {
    // O título já avisou; o favicon é reforço visual, não a única via.
  }
}

/**
 * Chegou mensagem com a aba escondida: soma ao contador e atualiza título e
 * favicon. `quantos` é o número de mensagens que chegaram desta vez — o
 * polling roda a cada 10s e pode trazer mais de uma de uma vez só.
 */
export function avisarNaAba(quantos: number): void {
  if (typeof document === 'undefined' || quantos <= 0) return
  garantirBase()
  contador += quantos
  if (tituloBase !== null) document.title = `(${contador}) ${tituloBase}`
  void atualizarFavicon()
}

/** A aba voltou a ficar visível: zera o contador e restaura título e favicon. */
export function limparAba(): void {
  if (contador === 0 && tituloBase === null) return
  contador = 0
  if (tituloBase !== null) document.title = tituloBase
  if (faviconBase) {
    const link = linkDoFavicon()
    if (link) link.href = faviconBase
  }
}
