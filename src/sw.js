import { precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }
  if (event.ports?.length) {
    try { event.ports[0].postMessage({ type: 'ACK' }) } catch { /* port may already be closed */ }
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

// Stable content signature: identical content pushed via multiple channels
// (FCM + Web Push for the same device) shows ONCE — the second delivery is
// swallowed by this short-window cache instead of duplicating in the tray.
const DEDUP_CACHE = 'alm-push-dedup'
const DEDUP_WINDOW_MS = 15000

async function isDuplicateRecently(sig) {
  try {
    const cache = await caches.open(DEDUP_CACHE)
    const hit = await cache.match(new Request('https://almawaid-dedup.invalid/' + sig))
    if (hit) {
      const ts = Number(await hit.text()) || 0
      await cache.put(new Request('https://almawaid-dedup.invalid/' + sig), new Response(String(Date.now())))
      return ts && (Date.now() - ts) < DEDUP_WINDOW_MS
    }
    await cache.put(new Request('https://almawaid-dedup.invalid/' + sig), new Response(String(Date.now())))
    return false
  } catch {
    return false // Never block a notification on a dedup cache failure
  }
}

function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

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
    sound,
    renotify = true,
    sender_name,
    data: extraData = {},
  } = data

  const displayTitle = sender_name ? `Al-Mawaid · ${sender_name}` : title
  const displayBody = body || (sender_name ? `Message from ${sender_name}` : '')

  // Deterministic tag: server-provided tag wins; otherwise derive one from the
  // content so a RE-delivery of the same message REPLACES the tray entry
  // instead of stacking a duplicate (a random tag forced duplicates).
  const contentSig = fnv1a(`${displayTitle}|${displayBody}|${url || ''}`)
  const uniqueTag = tag || `alm_${contentSig}`

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
  if (sound) notificationOptions.sound = sound // Safari/macOS; Chrome plays its system sound
  if (actions && Array.isArray(actions) && actions.length) {
    notificationOptions.actions = actions
  } else {
    notificationOptions.actions = [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ]
  }

  event.waitUntil(
    (async () => {
      // ── Duplicate suppression: same content within a short window shows once ──
      // Identical content delivered by multiple channels (e.g., Web Push + FCM
      // for the same device/batch) shows ONCE — the second delivery is dropped
      // instead of stacking a second tray entry.
      const isDup = await isDuplicateRecently('c_' + contentSig)
      if (isDup) {
        console.debug('[sw] Duplicate push suppressed:', displayTitle)
        return
      }

      // Always show the OS-level notification — even when the app is open and
      // focused. There are no in-app popups anymore; the system notification
      // IS the alert, and tapping it deep-links into the related action page.
      await self.registration.showNotification(displayTitle, notificationOptions)
    })()
  )
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
    (async () => {
      // Prefer an already-open app window: deep-link it in place and focus.
      const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_DEEP_LINK', url: urlToOpen })
          try { await client.focus() } catch { /* focus may be blocked */ }
          return
        }
      }
      // No open window — cold start by opening the deep-link URL.
      try {
        const opened = await clients.openWindow(targetUrl)
        if (opened) return
      } catch { /* openWindow can throw when blocked; fall through */ }
      // Last-resort fallback some browsers need
      if (clients.openWindow) {
        try { await clients.openWindow(targetUrl) } catch { /* ignore */ }
      }
    })()
  )
})
