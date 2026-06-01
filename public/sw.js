// public/sw.js
// NOTE: This service worker handles basic offline caching only.
// Push notifications are handled by /firebase-messaging-sw.js (registered in main.jsx).
// Do NOT add Firebase Messaging here — it belongs in firebase-messaging-sw.js only.

const CACHE_NAME = 'al-mawaid-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/al-mawaid.png',
  '/wheat_bg.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip non-http(s) requests (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  // Skip Vite dev-server & HMR requests so they don't break during development
  if (
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/@fs') ||
    url.pathname.startsWith('/__vite') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/src/')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        // Fallback for offline if needed
      });
    })
  );
});
