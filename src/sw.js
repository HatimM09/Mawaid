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
// IMPORTANT: Each notification gets a unique tag so Android shows every
// notification individually rather than replacing the previous one.
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
    vibrate = [200, 100, 200],
    requireInteraction = true,
    tag,
    actions = [{ action: 'open', title: 'View' }, { action: 'dismiss', title: 'Dismiss' }],
    timestamp,
    silent,
    renotify = true,
    sender_name,
    data: extraData = {},
  } = data

  const displayTitle = sender_name ? `${sender_name} · Al-Mawaid` : title

  const displayBody = body || (sender_name ? `Message from ${sender_name}` : '')

  // Generate unique tag so each notification shows individually on Android
  const uniqueTag = tag || `al-mawaid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const notificationOptions = {
    body: displayBody,
    icon: icon || '/al-mawaid.png',
    badge,
    vibrate,
    requireInteraction,
    tag: uniqueTag,
    actions,
    data: { url, sender_name, ...extraData },
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
          sender_name,
        })
      } else {
        return self.registration.showNotification(displayTitle, notificationOptions)
      }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const action = event.action
  const notifData = event.notification.data || {}
  const urlToOpen = notifData.url || '/profile/notifications'

  if (action === 'dismiss') return

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const originClient = windowClients.find((c) => c.url.includes(self.location.origin))
      if (originClient) {
        originClient.postMessage({
          type: 'NOTIFICATION_DEEP_LINK',
          url: urlToOpen,
        })
        if ('focus' in originClient) return originClient.focus()
      }
      // No open window — open app with alerts flag
      const targetUrl = urlToOpen.startsWith('/')
        ? self.location.origin + '/?alerts=1'
        : urlToOpen
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})
