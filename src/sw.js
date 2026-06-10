import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

precacheAndRoute(self.__WB_MANIFEST)

// Handle SKIP_WAITING message from vite-plugin-pwa to prevent
// "message channel closed" errors and enable silent SW updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

registerRoute(
  /^https:\/\/spciaktztqnjsttrtosu\.supabase\.co\/rest\/v1\/.*/i,
  new NetworkFirst({
    cacheName: 'supabase-api-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 5 }),
    ],
    networkTimeoutSeconds: 10,
  })
)

registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
)

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
)

registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
)

// ── Native Web Push handler (replaces Firebase Cloud Messaging) ──────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Al-Mawaid', body: '', url: '/' }
  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      try { data = { title: event.data.text() || 'Al-Mawaid' } } catch { /* ignore */ }
    }
  }

  const { title, body, url } = data

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const focusedClient = clients.find((c) => c.focused)
      if (focusedClient) {
        // App is in foreground — send message to show toast
        focusedClient.postMessage({
          type: 'PUSH_RECEIVED',
          title: title || 'Al-Mawaid',
          body: body || '',
          url: url || '/',
        })
      } else {
        // App is in background — show system notification
        return self.registration.showNotification(title || 'Al-Mawaid', {
          body: body || '',
          icon: '/al-mawaid.png',
          badge: '/al-mawaid.png',
          vibrate: [200, 100, 200],
          data: { url: url || '/' },
        })
      }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const urlToOpen = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          if ('navigate' in client) client.navigate(urlToOpen)
          if ('focus' in client) return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen)
    })
  )
})
