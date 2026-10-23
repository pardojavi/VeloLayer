import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import 'leaflet/dist/leaflet.css'
import './styles.css'

// El service worker solo tiene sentido en el navegador, no en pruebas.
if (import.meta.env.MODE !== 'test') {
  void import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => undefined)
}

const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
