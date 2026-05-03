import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MainRouter from './MainRouter.jsx'

// Force unregister legacy service workers to fix "old version" issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.unregister();
      console.log('Legacy Service Worker unregistered');
    }
  });
}

// Clear legacy caches
if ('caches' in window) {
  caches.keys().then(names => {
    for (let name of names) caches.delete(name);
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MainRouter />
  </StrictMode>,
)
