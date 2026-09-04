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
  if (!userId || !subscription?.endpoint) return
  try {
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
    if (error) {
      // If table constraint has different conflict key, attempt graceful fallback
      if (error.code === '42P10' || error.message?.includes('conflict') || error.message?.includes('ON CONFLICT')) {
        await supabase.from('push_subscriptions').upsert({
          user_id: userId,
          fcm_token: endpoint,
          subscription_json: subscriptionJson,
          token_type: 'webpush',
          updated_at: new Date().toISOString()
        })
      } else {
        console.warn('[PushManager] Push subscription notice:', error.message)
      }
    } else {
      console.log('[PushManager] Push subscription saved to Supabase ✅')
    }
  } catch (err) {
    console.warn('[PushManager] Save push subscription notice:', err?.message || err)
  }
}

function navigateTo(url) {
  if (!url || url === '/') return
  window.dispatchEvent(new CustomEvent('app-navigate', {
    detail: { url, source: 'push' }
  }))
}

function showToast({ title, body, url, image, sender_name }) {
  toast(
    (t) => (
      <div
        onClick={() => { navigateTo(url || '/profile/notifications'); toast.dismiss(t.id) }}
        style={{ cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
      >
        {image ? (
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
          }}>
            <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: 'var(--accent-grad)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0d14" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          {sender_name && (
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.04em', marginBottom: 1, textTransform: 'uppercase' }}>
              {sender_name}
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>
            {title || 'Al-Mawaid'}
          </div>
          {body && <div style={{ fontSize: 12, lineHeight: 1.4, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{body}</div>}
        </div>
      </div>
    ),
    {
      duration: body ? Math.max(5000, Math.min(body.length * 40, 10000)) : 5000,
      style: {
        background: 'rgba(20,16,10,0.95)',
        backdropFilter: 'blur(12px)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14,
        padding: '12px 14px',
        maxWidth: 380,
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
        const { message, type, title, url, sender_name, silent } = payload.new
        if (silent) return // Skip toast for silent notifications
        // Dedup: skip if this notification was already shown
        const dedupKey = `toast_${payload.new.id || (title + '_' + message)}`
        if (sessionStorage.getItem(dedupKey)) return
        sessionStorage.setItem(dedupKey, '1')
        setTimeout(() => { try { sessionStorage.removeItem(dedupKey) } catch {} }, 6000)
        showToast({ title: title || 'Al-Mawaid', body: message, url, sender_name })
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
              console.log('[PushManager] Native push received while foregrounded:', n?.title)
              const notifTitle = n.title || n.data?.title || 'Al-Mawaid'
              const notifBody = n.body || n.data?.body
              const notifUrl = n.data?.url || '/profile/notifications'
              const notifSender = n.data?.sender_name || 'Al-Mawaid'
              const dedupKey = `toast_native_${notifTitle}_${notifBody}`
              if (!sessionStorage.getItem(dedupKey)) {
                sessionStorage.setItem(dedupKey, '1')
                setTimeout(() => { try { sessionStorage.removeItem(dedupKey) } catch {} }, 6000)
                showToast({ title: notifTitle, body: notifBody, url: notifUrl, sender_name: notifSender })
              }
            })
            // ── Deep link: user taps notification → navigate to correct in-app page ──
            PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
              const data = action.notification.data
              const url = data?.url || '/profile/notifications'
              if (url && typeof window !== 'undefined') {
                navigateTo(url)
              }
            })
          }
        } catch (e) {
          console.warn('[PushManager] Capacitor push init failed:', e)
        }
      }

      // ── Web Push subscription (browser/PWA fallback) ──
      // Only on the web/PWA. On native (Capacitor/Expo WebView) push goes through
      // FCM/Expo via PushBridge, and the WebView origin is not an eligible push
      // context — pushManager.subscribe() there always fails with "Registration
      // failed - push service error", so skip Web Push entirely on native.
      const webPushSupported = !isNative() && 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator
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
                console.log('[PushManager] Re-subscribing with updated VAPID key...')
                const oldSub = await swReg.pushManager.getSubscription()
                if (oldSub) await oldSub.unsubscribe()
                if (cancelledRef.current) return
                sub = await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_KEY) })
                console.log('[PushManager] Web Push re-subscribed successfully ✅')
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
          if (!event?.data) return
          setTimeout(() => {
            if (event.data?.type === 'PUSH_RECEIVED') {
              showToast({
                title: event.data.title,
                body: event.data.body,
                url: event.data.url,
                image: event.data.image,
                sender_name: event.data.sender_name,
              })
            }
            if (event.data?.type === 'NOTIFICATION_DEEP_LINK') {
              navigateTo(event.data.url || '/profile/notifications')
            }
          }, 0)
        }
        navigator.serviceWorker.addEventListener('message', swMessageHandler, { passive: true })

        const handleDeepLink = (e) => {
          navigateTo(e.detail?.url || '/profile/notifications')
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