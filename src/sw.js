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
    icon,
    badge = '/al-mawaid.png',
    vibrate = [100, 50, 100],
    requireInteraction = true,
    tag,
    actions,
    timestamp,
    silent,
    renotify = true,
    sender_name,
    data: extraData = {},
  } = data

  const displayTitle = sender_name ? `Al-Mawaid · ${sender_name}` : title
  const displayBody = body || (sender_name ? `Message from ${sender_name}` : '')

  const uniqueTag = tag || `al-mawaid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const notificationOptions = {
    body: displayBody,
    icon: icon || '/al-mawaid.png',
    badge,
    vibrate,
    requireInteraction,
    tag: uniqueTag,
    silent,
    renotify,
    data: { url, sender_name, deep: true, ...extraData },
  }
  if (image) notificationOptions.image = image
  if (timestamp) notificationOptions.timestamp = timestamp
  if (actions && Array.isArray(actions) && actions.length) {
    notificationOptions.actions = actions
  } else {
    notificationOptions.actions = [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ]
  }

  event.waitUntil(self.registration.showNotification(displayTitle, notificationOptions))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const action = event.action
  const notifData = event.notification.data || {}
  const urlToOpen = notifData.url || '/'

  if (action === 'dismiss') return

  const targetUrl = urlToOpen.startsWith('/')
    ? self.location.origin + urlToOpen
    : urlToOpen

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_DEEP_LINK', url: urlToOpen })
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})
