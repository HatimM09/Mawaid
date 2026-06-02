// public/firebase-messaging-sw.js
// Service Worker for Firebase Cloud Messaging (background push notifications)
// Also handles PWA caching via Workbox (injected at build time)

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

// ── Force immediate activation — skip waiting & claim clients ────────────────
self.addEventListener('install', () => {
  console.log('[firebase-messaging-sw] Install — skipping waiting');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw] Activate — claiming clients');
  event.waitUntil(self.clients.claim());
});

// ── Handle background push messages → show system notification ───────────────
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message', payload);
  
  const notificationTitle = payload.notification?.title || 'Al-Mawaid';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/al-mawaid.png',
    badge: '/al-mawaid.png',
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.url || '/',
      click_action: payload.notification?.click_action || '/',
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ── Handle notification click → open app ────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked', event.notification);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If app window is already open, focus and navigate it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          if ('navigate' in client) {
            client.navigate(urlToOpen);
          }
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      // Otherwise open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});