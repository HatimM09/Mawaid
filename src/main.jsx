import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MainRouter from './MainRouter.jsx'
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    // Auto-update silently — no banner shown
    updateSW(true)
  },
  onOfflineReady() {
    console.log('[PWA] App ready for offline use')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MainRouter />
  </StrictMode>,
)
