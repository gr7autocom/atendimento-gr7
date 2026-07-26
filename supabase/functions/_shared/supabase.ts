import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Cliente com service role. As Edge Functions (webhook/envio/bot) operam como
 * sistema e ignoram a RLS de propósito (ver docs/db.md). SUPABASE_URL e
 * SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente no runtime.
 */
export function criarClienteServico(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, serviceRole, { auth: { persistSession: false } })
}
