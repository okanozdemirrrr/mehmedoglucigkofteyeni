import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { hydrateAuthStorage } from './lib/authStorage'

async function boot() {
  // Native: oturumu Preferences'tan memory'e al — createClient storage okumaları senkronlaşır
  await hydrateAuthStorage()
  const { default: App } = await import('./App.jsx')
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void boot()
