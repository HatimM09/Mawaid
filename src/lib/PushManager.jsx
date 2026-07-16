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
        style={{ cursor: url ? 'pointer' : 'default', display: 'flex', gap: 12, alignItems: 'flex-start' }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #c5a059, #8a6d2f)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, boxShadow: '0 4px 14px rgba(197,160,89,0.35)',
        }}>✦</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.02em', marginBottom: 3, color: '#F5E6C8' }}>
            {title || 'Al-Mawaid'}
          </div>
          {body && <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'rgba(250,243,224,0.78)' }}>{body}</div>}
          {url && url !== '/' && (
            <div style={{ fontSize: 11, marginTop: 6, color: '#c5a059', fontWeight: 600 }}>Open →</div>
          )}
        </div>
      </div>
    ),
    {
      duration: 5500,
      style: {
        background: 'linear-gradient(160deg, #14100a 0%, #1a1308 100%)',
        color: '#FAF3E0',
        border: '1px solid rgba(197,160,89,0.35)',
        borderRadius: 16,
        padding: '14px 16px',
        maxWidth: 360,
        boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
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
      // Skip early return on native — Capacitor may lack PushManager/Web Notification APIs
      const webPushSupported = 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator
      if (webPushSupported) {
        try {
          let permission = Notification.permission
          if (permission === 'default') permission = await Notification.requestPermission()
          if (permission === 'granted' && VAPID_KEY) {
            const swReg = await navigator.serviceWorker.ready
            const urlBase64ToUint8Array = (bs) => {
              const p = '='.repeat((4 - bs.length % 4) % 4)
              return new Uint8Array(atob((bs + p).replace(/\-/g, '+').replace(/_/g, '/')).split('').map(c => c.charCodeAt(0)))
            }
            let sub
            try {
              sub = await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_KEY) })
            } catch (subErr) {
              // If the VAPID key changed since the last subscription, unsubscribe old and retry
              if (subErr.name === 'InvalidStateError' || (subErr.message && subErr.message.includes('applicationServerKey'))) {
                console.warn('[PushManager] VAPID key mismatch — unsubscribing old subscription and retrying')
                const oldSub = await swReg.pushManager.getSubscription()
                if (oldSub) await oldSub.unsubscribe()
                if (cancelledRef.current) return
                sub = await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_KEY) })
              } else {
                throw subErr
              }
            }
            if (!cancelledRef.current) await savePushSubscription(user.id, sub)

            // Also try to get FCM token via Firebase SDK for better delivery
            // Only attempt if VITE_FIREBASE_VAPID_KEY is explicitly configured (avoids 401 from mismatched key)
            if (import.meta.env.VITE_FIREBASE_VAPID_KEY) {
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
            }
          }
        } catch (e) {
          console.warn('[PushManager] Web Push subscribe failed:', e)
        }

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
      }

      // User-specific in-app toasts (native + web)
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