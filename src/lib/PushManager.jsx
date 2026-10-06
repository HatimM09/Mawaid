// src/lib/PushManager.jsx
// Handles:
//   1. Capacitor Native Push (FCM — native Android push, works outside the app)
//   2. Web Push API (browser/OS push via service worker — works when tab is closed)
//   3. Deep-link routing: tapping an outside notification opens the app on the
//      related action page (via 'app-navigate' + a pending-link fallback for
//      cold starts where the app wasn't mounted yet).
//
// NOTE: There are intentionally NO in-app popup toasts here. Notifications are
// delivered by the OS outside the app/website and are stored in the Alerts tab
// (/profile/notifications inbox + notices). Realtime events below only refresh
// those lists (badge + inbox) silently.

import { useEffect, useRef } from 'react'
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

export const PENDING_DEEP_LINK_KEY = 'almawaid_pending_deep_link'

function navigateTo(url) {
  if (!url || url === '/') return
  // Persist for cold starts: if the app/tabs aren't mounted yet (login screen,
  // fresh service-worker openWindow), ThaliUserApp consumes this on mount.
  try {
    sessionStorage.setItem(PENDING_DEEP_LINK_KEY, url)
  } catch {
    console.debug('[PushManager] session storage unavailable')
  }
  window.dispatchEvent(new CustomEvent('app-navigate', {
    detail: { url, source: 'push' }
  }))
}

// Tell open alerts lists to refresh silently (no popup, no sound).
function notifyListsUpdated(info = {}) {
  window.dispatchEvent(new CustomEvent('notifications-updated', { detail: info }))
}

// ── Subscribe to Supabase Realtime notification channel ───────────────────────
// Silent: only refreshes the Alerts tab / inbox lists + badge. The visible
// notification itself is delivered by the OS outside the app (Web Push / FCM).
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
        const { id, message, type, title, url, silent } = payload.new || {}
        if (silent) return // Silent bookkeeping rows never surface

        const titleText = (title || 'Al-Mawaid').trim()
        const bodyText = (message || '').trim()
        const isSurveyType = type === 'survey' || type === 'survey_reminder' ||
          titleText.toLowerCase().includes('survey') || bodyText.toLowerCase().includes('survey')

        // Content-based signature key for robust deduplication across different IDs / rapid cron ticks
        const rawContentSig = `${type || 'info'}_${titleText}_${bodyText}`
        const contentKey = `push_seen_${rawContentSig.replace(/\s+/g, '_').substring(0, 100)}`
        const idKey = id ? `push_id_${id}` : null

        const now = Date.now()

        // 1. Skip if this exact notification ID was already handled in this session
        if (idKey && sessionStorage.getItem(idKey)) return
        if (idKey) {
          sessionStorage.setItem(idKey, String(now))
          setTimeout(() => { try { sessionStorage.removeItem(idKey) } catch (e) { console.debug('[PushManager] cleanup skipped', e && e.message) } }, 120000)
        }

        // 2. Content signature cooldown (survey notifications: 15 min cooldown; standard: 60 sec)
        const lastSeenStr = sessionStorage.getItem(contentKey)
        const cooldownMs = isSurveyType ? 15 * 60 * 1000 : 60 * 1000
        if (lastSeenStr && (now - Number(lastSeenStr)) < cooldownMs) {
          return
        }
        sessionStorage.setItem(contentKey, String(now))
        setTimeout(() => { try { sessionStorage.removeItem(contentKey) } catch (e) { console.debug('[PushManager] cleanup skipped', e && e.message) } }, cooldownMs)

        // No in-app popup: the OS-level push (Web Push / FCM) already notified
        // the user outside the app. Just refresh the Alerts tab + badge.
        notifyListsUpdated({ id, type, title: titleText, body: bodyText, url })
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
              // No in-app popup — the Alerts tab badge + inbox update silently.
              // (On Android the tray notification still appears when backgrounded.)
              notifyListsUpdated({
                title: n.title || n.data?.title || 'Al-Mawaid',
                body: n.body || n.data?.body,
                url: n.data?.url || '/profile/notifications',
              })
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
              return new Uint8Array(atob((bs + p).replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => c.charCodeAt(0)))
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
              // No in-app popup — refresh Alerts tab lists silently.
              notifyListsUpdated({
                title: event.data.title,
                body: event.data.body,
                url: event.data.url,
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

      // Silent Alerts-tab refresh for this user (native + web)
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
