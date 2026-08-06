/**
 * CORS do canal web, com allowlist.
 *
 * Separado do `cors.ts` de propósito, e o de lá **não deve ser alterado**: ele
 * atende o webhook, que é chamado por um provedor sem origem, onde `*` é a resposta
 * certa. Aqui o chamador é um navegador com origem conhecida.
 *
 * Não é defesa forte — `curl` ignora CORS e continua alcançando a função. O que
 * isto impede é um site qualquer montar um cliente por cima da nossa função usando
 * o navegador de quem visita. A defesa real é o rate limit e a validação de sessão.
 */

import { ErroContrato, type CodigoErro } from './web/contrato.ts'

const BASE = {
  'Access-Control-Allow-Headers': 'content-type, x-sessao',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
}

/** Origens liberadas, por env (`PWA_ORIGENS`, separadas por vírgula). */
function origensPermitidas(): string[] {
  return (Deno.env.get('PWA_ORIGENS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

export function headersCorsWeb(req: Request): Record<string, string> {
  const origem = req.headers.get('origin') ?? ''
  const permitidas = origensPermitidas()
  // Sem allowlist configurada, não devolvemos `*`: o padrão inseguro seria herdado
  // silenciosamente em produção se alguém esquecesse de setar a env.
  if (!origem || !permitidas.includes(origem)) return BASE
  return { ...BASE, 'Access-Control-Allow-Origin': origem }
}

export function respostaJsonWeb(req: Request, dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { ...headersCorsWeb(req), 'Content-Type': 'application/json' },
  })
}

/** Erro sempre tipado e sem detalhe interno: o chamador aqui é a internet. */
export function respostaErroWeb(req: Request, codigo: CodigoErro, status = 400, campo?: string): Response {
  return respostaJsonWeb(req, campo ? { erro: codigo, campo } : { erro: codigo }, status)
}

export function respostaDeErro(req: Request, erro: unknown): Response {
  if (erro instanceof ErroContrato) {
    return respostaErroWeb(req, erro.codigo, erro.status, erro.campo)
  }
  // Nunca vazar `String(erro)` para fora: mensagem de banco descreve schema.
  console.error('[atendimento-web] erro nao tratado:', erro)
  return respostaErroWeb(req, 'erro_interno', 500)
}

export function preflightWeb(req: Request): Response {
  return new Response('ok', { headers: headersCorsWeb(req) })
}
