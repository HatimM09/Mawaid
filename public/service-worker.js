const CACHE_NAME = 'al-mawaid-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/al-mawaid.png',
  '/wheat_bg.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);
  
  // Skip Vite and Dev server requests
  if (
    url.pathname.includes('@vite') ||
    url.pathname.includes('@react-refresh') ||
    url.pathname.includes('node_modules') ||
    url.search.includes('v=') ||
    url.hostname === 'localhost'
  ) {
    return;
  }

  // Skip Supabase
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).catch((err) => {
        console.warn('[SW] Fetch failed for:', event.request.url, err);
        return new Response('Network error', { status: 408 });
      });
    })
  );
});

// PUSH NOTIFICATION HANDLING
self.addEventListener('push', (event) => {
  let data = { title: 'Al-Mawaid', body: 'New Update' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    data = { title: 'Al-Mawaid', body: event.data.text() };
  }

  const options = {
    body: data.body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [100, 50, 100],
    tag: 'almawaid-notice', // Overwrites previous notice to avoid clutter
    renotify: true,
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
