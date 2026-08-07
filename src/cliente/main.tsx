import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { AppCliente } from './AppCliente'

/*
  Bootstrap do PWA do cliente. Reusa o `index.css` da central (fontes locais e
  tokens do tema), porque a identidade visual é a mesma; o que muda é a
  densidade, decidida tela a tela.

  Aqui não entra `supabase-js` nem nada de auth: o PWA fala com o servidor só
  pela Edge Function, por `fetch`, e não embarca chave nenhuma (ver
  docs/canal-web.md).
*/
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppCliente />
  </StrictMode>
)
