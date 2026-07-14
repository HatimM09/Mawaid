// src/lib/PushManager.jsx
// Handles:
//   1. Capacitor Native Push (FCM — native Android push)
//   2. Web Push API (browser push — works when tab is closed)
//   3. Supabase Realtime (in-app toast — instant when tab is open)

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/firebaseClient'

function isNative() {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
}

// VAPID public key for Web Push subscription
const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BEjjek2qtdlh_xXfXqyfZhHQZt9zRQd_2M-WJxtxCkJkHgzUd6r-Szrj9dsgCTF7XAZjEMq3CPLkUvOjGwKCRm0'

async function savePushSubscription(userId, subscription) {
  const endpoint = subscription.endpoint
  const subscriptionJson = JSON.stringify(subscription)
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        fcm_token: endpoint,
        subscription_json: subscriptionJson,
        token_type: 'webpush',
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id, token_type' }
    )
  if (error) console.error('[PushManager] Failed to save push subscription:', error.message)
  else console.log('[PushManager] Push subscription saved to Supabase ✅')
}

function showToast(title, body, url) {
  toast(
    (t) => (
      <div
        onClick={() => { if (url) window.location.href = url; toast.dismiss(t.id) }}
        style={{ cursor: url ? 'pointer' : 'default' }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{title}</div>
        {body && <div style={{ fontSize: 13, opacity: 0.8 }}>{body}</div>}
        {url && <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>Tap to open →</div>}
      </div>
    ),
    {
      duration: 5000,
      icon: '🔔',
      style: {
        background: '#1a1308',
        color: '#FAF3E0',
        border: '1px solid rgba(212,175,55,0.3)',
        borderRadius: 12,
        padding: '12px 16px',
        maxWidth: 340,
      },
    }
  )
}

// ── Subscribe to Supabase Realtime notification channel ───────────────────────
function subscribeRealtime(realtimeChannel, user, cancelledRef, retryCount = 0) {
  const MAX_RETRIES = 3
  if (cancelledRef.current || realtimeChannel.current) return
  if (retryCount > MAX_RETRIES) {
    console.warn('[PushManager] Realtime max retries reached — giving up')
    return
  }

  console.log('[PushManager] Subscribing to Realtime notifications...')
  realtimeChannel.current = supabase
    .channel(`notifications:${user.id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        const { message, type, title, url } = payload.new
        showToast(title || 'Al-Mawaid', message, url)
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[PushManager] Realtime ${status} — retrying (${retryCount + 1}/${MAX_RETRIES})`)
        if (realtimeChannel.current) {
          supabase.removeChannel(realtimeChannel.current)
        }
        realtimeChannel.current = null
        if (!cancelledRef.current) {
          setTimeout(() => subscribeRealtime(realtimeChannel, user, cancelledRef, retryCount + 1), 5000)
        }
      } else {
        console.log('[PushManager] Realtime connected:', status)
      }
    })
}

export default function PushManager() {
  const realtimeChannel = useRef(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false

    let nativeTokensHandled = false

    async function handleNativeTokens(user) {
      const nativePlatform = window.__nativePlatform
      const nativeToken = window.__nativePushToken
      const tokenType = window.__nativeTokenType || 'expo'

      if (nativePlatform && nativeToken && !nativeTokensHandled) {
        nativeTokensHandled = true
        if (!cancelledRef.current) {
          await supabase.from('push_subscriptions').upsert(
            { user_id: user.id, fcm_token: nativeToken, token_type: tokenType, updated_at: new Date().toISOString() },
            { onConflict: 'user_id, token_type' }
          )
          subscribeRealtime(realtimeChannel, user, cancelledRef)
          return true
        }
      }
      return false
    }

    const onNativeReady = async () => {
      if (nativeTokensHandled || cancelledRef.current) return
      const user = window.__pushManagerUser || (await supabase.auth.getUser()).data?.user
      if (!user) return
      if (await handleNativeTokens(user)) window.removeEventListener('native-push-ready', onNativeReady)
    }
    window.addEventListener('native-push-ready', onNativeReady)

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelledRef.current) return
      window.__pushManagerUser = user

      // Check if user has notifications enabled
      const { data: prefs } = await supabase.from('user_stats').select('notifications_enabled').eq('user_id', user.id).maybeSingle()
      if (prefs?.notifications_enabled === false) {
        console.log('[PushManager] Notifications disabled by user')
        return
      }

      if (await handleNativeTokens(user)) return

      // ── Capacitor Native Push (FCM) ──
      if (isNative()) {
        try {
          const { PushNotifications } = await import('@capacitor/push-notifications')
          let perm = await PushNotifications.checkPermissions()
          if (perm.receive === 'prompt') {
            perm = await PushNotifications.requestPermissions()
          }
          if (perm.receive === 'granted') {
            await PushNotifications.register()
            PushNotifications.addListener('registration', async (token) => {
              if (token?.value && !cancelledRef.current) {
                await supabase.from('push_subscriptions').upsert(
                  { user_id: user.id, fcm_token: token.value, token_type: 'fcm', updated_at: new Date().toISOString() },
                  { onConflict: 'user_id, token_type' }
                )
              }
            })
            PushNotifications.addListener('pushNotificationReceived', (n) => {
              showToast(n.title, n.body, n.data?.url)
            })
            // ── Deep link: user taps notification → navigate to correct in-app page ──
            PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
              const data = action.notification.data
              const url = data?.url || '/'
              if (url && typeof window !== 'undefined') {
                // Use React Router navigation if available, else fallback to location
                try {
                  window.__pendingNotificationUrl = url
                  // Dispatch custom event for the app to pick up
                  window.dispatchEvent(new CustomEvent('notification-deep-link', { detail: { url } }))
                } catch (e) {
                  console.warn('[PushManager] Deep link navigation failed:', e)
                }
              }
            })
          }
        } catch (e) {
          console.warn('[PushManager] Capacitor push init failed:', e)
        }
      }

      // ── Web Push subscription (browser/PWA fallback) ──
      try {
        if (!('Notification' in window) || !('PushManager' in window)) return
        let permission = Notification.permission
        if (permission === 'default') permission = await Notification.requestPermission()
        if (permission !== 'granted' || !VAPID_KEY) return
        const swReg = await navigator.serviceWorker.ready
        const urlBase64ToUint8Array = (bs) => {
          const p = '='.repeat((4 - bs.length % 4) % 4)
          return new Uint8Array(atob((bs + p).replace(/\-/g, '+').replace(/_/g, '/')).split('').map(c => c.charCodeAt(0)))
        }
        const sub = await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_KEY) })
        if (!cancelledRef.current) await savePushSubscription(user.id, sub)

        // Also try to get FCM token via Firebase SDK for better delivery
        try {
          const { requestForToken } = await import('../lib/firebase')
          const fcmToken = await requestForToken()
          if (fcmToken && !cancelledRef.current) {
            await supabase.from('push_subscriptions').upsert(
              { user_id: user.id, fcm_token: fcmToken, token_type: 'fcm', updated_at: new Date().toISOString() },
              { onConflict: 'user_id, token_type' }
            )
          }
        } catch (e) {
          console.warn('[PushManager] Firebase FCM token fetch skipped:', e)
        }
      } catch {}

      const swMessageHandler = (event) => {
        if (event.data?.type === 'PUSH_RECEIVED') {
          showToast(event.data.title, event.data.body, event.data.url)
        }
        // Handle deep link from service worker notification click
        if (event.data?.type === 'NOTIFICATION_DEEP_LINK') {
          const url = event.data.url
          if (url && url !== '/') {
            window.location.href = url
          }
        }
      }
      navigator.serviceWorker.addEventListener('message', swMessageHandler)

      // ── Listen for notification deep-link events (from SW notification click) ──
      const handleDeepLink = (e) => {
        const url = e.detail?.url
        if (url && url !== '/') {
          window.location.href = url
        }
      }
      window.addEventListener('notification-deep-link', handleDeepLink)

      // Store refs for cleanup
      window.__cleanupDeepLink = () => {
        navigator.serviceWorker.removeEventListener('message', swMessageHandler)
        window.removeEventListener('notification-deep-link', handleDeepLink)
      }

      // User-specific notifications
      setTimeout(() => subscribeRealtime(realtimeChannel, user, cancelledRef), 2000)
    }

    init()

    return () => {
      cancelledRef.current = true
      window.removeEventListener('native-push-ready', onNativeReady)
      if (realtimeChannel.current) { supabase.removeChannel(realtimeChannel.current); realtimeChannel.current = null }
      if (window.__cleanupDeepLink) {
        window.__cleanupDeepLink()
        delete window.__cleanupDeepLink
      }
    }
  }, [])

  return null
}