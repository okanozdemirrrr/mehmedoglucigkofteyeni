import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary, { BootErrorScreen, sanitizeErrorMessage } from './components/ErrorBoundary'
import { hydrateAuthStorage } from './lib/authStorage'

/** Son yakalanan hata — index.html watchdog okuyabilir */
window.__APP_LAST_ERROR__ = window.__APP_LAST_ERROR__ || ''
window.__APP_MOUNTED__ = false

function showBootError(err) {
  const message = sanitizeErrorMessage(err)
  window.__APP_LAST_ERROR__ = message
  const root = document.getElementById('root')
  if (!root) return
  try {
    createRoot(root).render(
      <BootErrorScreen message={message} onRetry={() => window.location.reload()} />
    )
    window.__APP_MOUNTED__ = true
    window.dispatchEvent(new Event('app-mounted'))
  } catch {
    root.innerHTML = `<div style="padding:24px;font-family:system-ui">Uygulama başlatılamadı. <button type="button" onclick="location.reload()">Yeniden dene</button><pre style="margin-top:12px;color:#991b1b;white-space:pre-wrap">${message}</pre></div>`
    window.__APP_MOUNTED__ = true
  }
}

window.onerror = function onError(message, source, lineno, colno, error) {
  const text = sanitizeErrorMessage(error || message)
  window.__APP_LAST_ERROR__ = text
  console.error('[onerror]', text, source, lineno, colno)
  return false
}

window.addEventListener('unhandledrejection', (event) => {
  const text = sanitizeErrorMessage(event.reason)
  window.__APP_LAST_ERROR__ = text
  console.error('[unhandledrejection]', text)
})

function mount() {
  const el = document.getElementById('root')
  if (!el) {
    showBootError(new Error('root elementi bulunamadı'))
    return
  }

  createRoot(el).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  )

  window.__APP_MOUNTED__ = true
  window.dispatchEvent(new Event('app-mounted'))
}

// Hydrate render'ı ENGELLEMEZ — arka planda, max 3 sn (authStorage içinde)
void hydrateAuthStorage()

try {
  mount()
} catch (err) {
  showBootError(err)
}
