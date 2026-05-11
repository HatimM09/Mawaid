// public/sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCFQqTnz_CiVIKtDW4XH6CswPAm_KwN6jc",
  authDomain: "al-mawaid-8ffef.firebaseapp.com",
  projectId: "al-mawaid-8ffef",
  storageBucket: "al-mawaid-8ffef.firebasestorage.app",
  messagingSenderId: "333277268731",
  appId: "1:333277268731:web:9f7ba7f8f279a47f94be5e",
  measurementId: "G-J5D0YKG986"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

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

// Handle Background Messages via Firebase
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/al-mawaid.png',
    badge: '/al-mawaid.png',
    data: { url: payload.data?.url || '/' }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Generic Push event (for other push providers if any)
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      // If the message is handled by messaging.onBackgroundMessage, we don't need to do anything here.
      // But if it's a generic push, we show it.
      if (!data.notification && data.title) {
        const options = {
          body: data.body,
          icon: '/al-mawaid.png',
          badge: '/al-mawaid.png',
          data: { url: data.url || '/' }
        };
        event.waitUntil(self.registration.showNotification(data.title, options));
      }
    } catch (e) {
      console.log('Push event data was not JSON:', event.data.text());
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
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
