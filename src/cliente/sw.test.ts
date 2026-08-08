/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guarda do service worker (public/sw.js).
 *
 * Por que existe: o service worker é o único código do projeto que decide o que
 * fica gravado no disco de quem usa. A regra "nada da Edge Function entra em
 * cache" está escrita em maiúsculas no topo do arquivo, e o projeto já aprendeu
 * em 2026-08-06 que regra em comentário não segura nada: as duas regras da
 * `atendimento-web` viraram teste (padroes-canal-web.test.ts) exatamente porque
 * comentário depende de alguém ler.
 *
 * O que se testa aqui é o comportamento, não o texto: monta-se um ambiente de
 * service worker falso, executa-se o arquivo real e disparam-se requisições.
 * Se alguém trocar a ordem dos `if` e a conversa do cliente passar a ser
 * cacheada, este teste fica vermelho.
 *
 * O arquivo não passa por bundler (mora em `public/`), então é lido e avaliado
 * em vez de importado.
 */

type Ouvintes = Record<string, (evento: unknown) => void>

/** Requisição mínima, com o que o sw.js lê: url, method e mode. */
function requisicao(url: string, { method = 'GET', mode = 'cors' } = {}) {
  return { url, method, mode }
}

function montarAmbiente() {
  const ouvintes: Ouvintes = {}
  const gravado: string[] = []

  const cache = {
    add: async () => undefined,
    put: async (req: { url: string }) => {
      gravado.push(req.url)
    },
    delete: async () => true,
  }
  const caches = {
    open: async () => cache,
    keys: async () => [],
    match: async () => undefined,
    delete: async () => true,
  }
  const self = {
    addEventListener: (tipo: string, fn: (evento: unknown) => void) => {
      ouvintes[tipo] = fn
    },
    location: { origin: 'https://suporte.gr7autocom.com.br' },
    clients: { claim: async () => undefined },
  }
  const fetchFalso = async (req: { url: string }) => ({
    clone: () => req,
    ok: true,
  })

  const codigo = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf-8')
  new Function('self', 'caches', 'fetch', 'Response', codigo)(self, caches, fetchFalso, {
    error: () => ({ tipo: 'erro' }),
  })

  return { ouvintes, gravado }
}

/** Dispara o `fetch` do sw e diz se ele assumiu a resposta. */
function despachar(ouvintes: Ouvintes, req: ReturnType<typeof requisicao>) {
  let assumiu = false
  ouvintes.fetch({
    request: req,
    respondWith: () => {
      assumiu = true
    },
  })
  return assumiu
}

describe('service worker do PWA do cliente', () => {
  let ambiente: ReturnType<typeof montarAmbiente>

  beforeEach(() => {
    ambiente = montarAmbiente()
  })

  it('registra os três ciclos de vida', () => {
    expect(Object.keys(ambiente.ouvintes).sort()).toEqual(['activate', 'fetch', 'install'])
  })

  it('NÃO intercepta a Edge Function: conversa de cliente nunca vai para o disco', () => {
    const rotas = ['disponibilidade', 'identificar', 'conversa', 'mensagem', 'encerrar', 'avaliar']
    for (const rota of rotas) {
      const assumiu = despachar(
        ambiente.ouvintes,
        requisicao(`https://ghweohedmmmkufqhxdzn.supabase.co/functions/v1/atendimento-web/${rota}`)
      )
      expect(assumiu, `a rota ${rota} não pode ser interceptada pelo service worker`).toBe(false)
    }
    expect(ambiente.gravado).toEqual([])
  })

  it('não intercepta nada de outro endereço, seja qual for', () => {
    const assumiu = despachar(ambiente.ouvintes, requisicao('https://exemplo.com.br/qualquer-coisa.json'))
    expect(assumiu).toBe(false)
  })

  it('não intercepta requisição que não é GET', () => {
    const assumiu = despachar(
      ambiente.ouvintes,
      requisicao('https://suporte.gr7autocom.com.br/algo', { method: 'POST' })
    )
    expect(assumiu).toBe(false)
  })

  it('assume a navegação, que é o que faz o app abrir sem rede', () => {
    const assumiu = despachar(
      ambiente.ouvintes,
      requisicao('https://suporte.gr7autocom.com.br/', { mode: 'navigate' })
    )
    expect(assumiu).toBe(true)
  })

  it('assume a casca: o JavaScript do build e a logo', () => {
    for (const caminho of ['/assets/cliente-a1b2c3.js', '/marca-gr7.png', '/icone-192.png']) {
      const assumiu = despachar(ambiente.ouvintes, requisicao(`https://suporte.gr7autocom.com.br${caminho}`))
      expect(assumiu, `${caminho} deveria ser servido pelo cache da casca`).toBe(true)
    }
  })
})
