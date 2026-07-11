import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }
  if (event.ports?.length) {
    try { event.ports[0].postMessage({ type: 'ACK' }) } catch {}
  }
})

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

// ── Native Web Push handler ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Al-Mawaid', body: '', url: '/' }
  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      try { data = { title: event.data.text() || 'Al-Mawaid' } } catch { /* ignore */ }
    }
  }

  const {
    title = 'Al-Mawaid',
    body = '',
    url = '/',
    image,
    badge = '/al-mawaid.png',
    vibrate = [200, 100, 200],
    requireInteraction = true,
    tag = 'al-mawaid',
    actions = [{ action: 'open', title: 'View' }],
    timestamp,
    silent,
    renotify,
    data: extraData = {},
  } = data

  const notificationOptions = {
    body,
    icon: '/al-mawaid.png',
    badge,
    vibrate,
    requireInteraction,
    tag,
    actions,
    data: { url, ...extraData },
    renotify,
    silent,
  }
  if (image) notificationOptions.image = image
  if (timestamp) notificationOptions.timestamp = timestamp

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const focusedClient = clients.find((c) => c.focused)
      if (focusedClient) {
        focusedClient.postMessage({
          type: 'PUSH_RECEIVED',
          title,
          body,
          url,
          image,
        })
      } else {
        return self.registration.showNotification(title, notificationOptions)
      }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const action = event.action
  const urlToOpen = event.notification.data?.url || '/'

  if (action === 'dismiss') return

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
