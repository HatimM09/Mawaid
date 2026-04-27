import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MainRouter from './MainRouter.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MainRouter />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // PWA caching service worker
    navigator.serviceWorker.register('/service-worker.js').then(reg => {
      console.log('PWA SW Registered!', reg);
    }).catch(err => {
      console.log('PWA SW registration failed: ', err);
    });

    // Firebase Cloud Messaging service worker (for background push notifications)
    navigator.serviceWorker.register('/firebase-messaging-sw.js').then(reg => {
      console.log('Firebase Messaging SW registered!', reg);
    }).catch(err => {
      console.log('Firebase Messaging SW registration failed:', err);
    });
  });
}
