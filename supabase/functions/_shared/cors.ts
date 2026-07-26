// Helpers de resposta compartilhados pelas Edge Functions do WhatsApp.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

/** Resposta JSON com os headers de CORS. */
export function respostaJson(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Resposta ao preflight OPTIONS. */
export function preflight(): Response {
  return new Response('ok', { headers: corsHeaders })
}
