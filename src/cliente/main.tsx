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

/*
  Registro do service worker, que é o que torna o app instalável e o faz abrir
  sem rede.

  Só em produção, e a razão não é preferência: em produção o cliente mora sozinho
  em `suporte.gr7autocom.com.br`, então o escopo `/` cobre exatamente ele. Em
  desenvolvimento os dois apps dividem o `localhost:5173`, onde `/` é a central
  da equipe — um service worker com escopo `/` passaria a atender a central
  também, servindo a ela uma casca que não é dela.

  Registrado depois do `load` para não disputar rede com o primeiro desenho da
  tela. A falha vai ao console e para por aí: sem service worker o app continua
  funcionando inteiro, só deixa de abrir offline, então derrubar a tela por
  causa disso seria trocar um problema pequeno por um grande.
*/
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((erro) => {
      console.error('Service worker não registrado. O app funciona, mas não abre sem internet.', erro)
    })
  })
}
