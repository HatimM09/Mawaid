// Firebase Messaging Service Worker — Background Push Notifications
// This file MUST live at the root of /public so it's served at /firebase-messaging-sw.js
// Service workers cannot use import.meta.env — values must be hardcoded (these are public identifiers, not secrets)

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDKLqH2nXvMHCD_WK9PvMOjs49mgXzMU7g",          // ⬅️ Replace with your Firebase Web API Key
  authDomain: "al-mawaid-d1801.firebaseapp.com",
  projectId: "al-mawaid-d1801",
  storageBucket: "al-mawaid-d1801.firebasestorage.app",
  messagingSenderId: "167074939367",
  appId: "1:167074939367:web:9667ddea023fae9396fd42",            // ⬅️ Replace with your Firebase App ID
});

const messaging = firebase.messaging();

// Handle background messages (when the app/tab is closed or not focused)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw] Background message received:', payload);

  const notifData = payload.notification || {};
  const title = notifData.title || 'Al-Mawaid';
  const options = {
    body: notifData.body || 'You have a new update',
    icon: notifData.icon || '/al-mawaid.png',
    badge: '/al-mawaid.png',
    vibrate: [200, 100, 200],
    tag: 'almawaid-push-' + Date.now(),
    renotify: true,
    data: payload.data || {},
    actions: [
      { action: 'open', title: 'Open App' },
    ],
  };

  self.registration.showNotification(title, options);
});

// Handle notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If the app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});