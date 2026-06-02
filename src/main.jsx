// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MainRouter from './MainRouter.jsx'

// Register Firebase Messaging Service Worker (handles PWA + Background Push)
// Also detects new SW versions for the 'Update Available' banner
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').then(reg => {
      console.log('[SW] Firebase messaging SW registered:', reg.scope)

      // ── Check for updates on every page load ─────────────────────────
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        if (!newSW) return

        newSW.addEventListener('statechange', () => {
          // New SW is installed and waiting — update is ready!
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] New version available! ✅')
            // Store the waiting SW so UpdateBanner can activate it
            window.__swWaiting = newSW
            window.dispatchEvent(new CustomEvent('sw-update-ready'))
          }
        })
      })
    }).catch(err => {
      console.warn('[SW] Registration failed:', err)
    })

    // ── On reload: activate waiting SW and skip waiting ────────────────
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MainRouter />
  </StrictMode>,
)