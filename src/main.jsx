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
  });
}
