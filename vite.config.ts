import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // env dummy p/ os testes: sem isso, src/lib/supabase.ts lança no import
    // (ele exige VITE_SUPABASE_URL/ANON_KEY). Valores falsos bastam: sem sessão
    // salva, getSession() resolve como null sem bater na rede.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
