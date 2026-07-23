import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  const msg =
    'Variáveis VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY não definidas. Confira o arquivo .env.'
  console.error(msg)
  throw new Error(msg)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
