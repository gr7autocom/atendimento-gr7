import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/*
  Service worker da central, registrado só em produção.

  Ele NÃO faz cache e não torna a central instalável (ver o próprio `sw-central.js`
  e o comentário no `index.html`): existe para mostrar notificação do sistema,
  que em PWA no Windows só é confiável por este caminho, e para trazer a janela
  para frente quando o atendente clica no card.

  Só em produção pelo mesmo motivo do app do cliente: em desenvolvimento os dois
  dividem o `localhost:5173`, e dois service workers disputando o mesmo escopo
  daria um resultado que depende de qual registrou por último.
*/
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw-central.js').catch((erro) => {
      console.error('Service worker da central não registrado. As notificações do sistema não vão aparecer.', erro)
    })
  })
}
