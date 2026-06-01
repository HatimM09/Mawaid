// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MainRouter from './MainRouter.jsx'

// Register Firebase Messaging Service Worker (handles PWA + Background Push)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').then(reg => {
      console.log('[SW] Firebase messaging SW registered:', reg.scope)
    }).catch(err => {
      console.warn('[SW] Registration failed:', err)
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MainRouter />
  </StrictMode>,
)