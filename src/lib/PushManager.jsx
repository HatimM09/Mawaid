// src/lib/PushManager.jsx
// Handles:
//   1. Web Push API (browser push — works when tab is closed)
//   2. Supabase Realtime (in-app toast — instant when tab is open)

import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../admin/supabaseClient'

// VAPID public key for Web Push subscription
const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BApS0pbqbnV2xZBrqVhxgkacMNC5dAoT6M9zGcmLOvePl7f_iKA7ReDdJ0Cu9_2Ex969EJa3cssF3awCB-zXIhk'

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
    console.log('[PushManager] mounted ✅')
    console.log('[PushManager] VAPID key:', VAPID_KEY ? '✅ loaded' : '❌ missing')
    cancelledRef.current = false

    // ═══════════════════════════════════════════════════════════════════
    // NATIVE SHELL DETECTION — used both at init() and via event listener
    // ═══════════════════════════════════════════════════════════════════
    let nativeTokensHandled = false

    async function handleNativeTokens(user) {
      const nativePlatform = window.__nativePlatform
      const nativeToken = window.__nativePushToken
      const tokenType = window.__nativeTokenType || 'expo'

      if (nativePlatform && nativeToken && !nativeTokensHandled) {
        nativeTokensHandled = true
        console.log('[PushManager] Running inside React Native shell:', nativePlatform, 'token type:', tokenType)
        console.log('[PushManager] Using native push token ✅')

        if (!cancelledRef.current) {
          // Save native token as a push subscription entry
          const { error } = await supabase
            .from('push_subscriptions')
            .upsert(
              { user_id: user.id, fcm_token: nativeToken, token_type: tokenType, updated_at: new Date().toISOString() },
              { onConflict: 'user_id, token_type' }
            )
          if (error) console.error('[PushManager] Failed to save native token:', error.message)
          else console.log('[PushManager] Native push token saved ✅')
          subscribeRealtime(realtimeChannel, user, cancelledRef)
          return true
        }
      }
      return false
    }

    // Listen for tokens injected by React Native shell (race condition guard).
    // Runs if PushBridge injects tokens AFTER PushManager has already mounted.
    // Note: this event fires only once, so we fetch user ourselves if not cached yet.
    const onNativeReady = async () => {
      if (nativeTokensHandled || cancelledRef.current) return
      const user = window.__pushManagerUser ||
        (await supabase.auth.getUser()).data?.user
      if (!user) return
      const handled = await handleNativeTokens(user)
      if (handled) window.removeEventListener('native-push-ready', onNativeReady)
    }
    window.addEventListener('native-push-ready', onNativeReady)

    async function init() {
      // 1. Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log('[PushManager] user:', user?.id || 'none', userError?.message || '')
      if (!user || cancelledRef.current) return

      // Cache user on window so the event listener can use it
      window.__pushManagerUser = user

      // Try native tokens first (they may have been injected already)
      if (await handleNativeTokens(user)) return

      // ═══════════════════════════════════════════════════════════════════
      // WEB PUSH (PWA) — Native Web Push API via Service Worker
      // ═══════════════════════════════════════════════════════════════════
      try {
        if (!('Notification' in window)) throw new Error('Notifications not supported in this browser')
        if (!('PushManager' in window)) throw new Error('Push API not supported')

        console.log('[PushManager] Notification.permission:', Notification.permission)

        let permission = Notification.permission
        if (permission === 'default') {
          console.log('[PushManager] Requesting permission...')
          permission = await Notification.requestPermission()
          console.log('[PushManager] Permission result:', permission)
        }

        if (permission !== 'granted') {
          console.warn('[PushManager] Permission not granted:', permission)
          return
        }

        if (!VAPID_KEY) {
          console.error('[PushManager] VAPID public key is missing!')
          return
        }

        console.log('[PushManager] Subscribing to Web Push...')
        const swReg = await navigator.serviceWorker.ready
        console.log('[PushManager] SW ready:', swReg.scope)

        // Convert VAPID key from base64url to Uint8Array
        const urlBase64ToUint8Array = (base64String) => {
          const padding = '='.repeat((4 - base64String.length % 4) % 4)
          const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/')
          const rawData = atob(base64)
          const outputArray = new Uint8Array(rawData.length)
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i)
          }
          return outputArray
        }

        const subscription = await swReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
        })

        console.log('[PushManager] Web Push subscribed ✅ endpoint:', subscription.endpoint)

        if (!cancelledRef.current) {
          await savePushSubscription(user.id, subscription)
        }
      } catch (err) {
        console.debug('[PushManager] Web Push subscription failed (non-critical):', err.message)
      }

      // Listen for foreground push messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'PUSH_RECEIVED') {
          showToast(event.data.title, event.data.body, event.data.url)
        }
      })

      //      ── Supabase Realtime (in-app toasts) ─────────────────────────────
      setTimeout(() => subscribeRealtime(realtimeChannel, user, cancelledRef), 2000)
    }

    init()

    return () => {
      cancelledRef.current = true
      window.removeEventListener('native-push-ready', onNativeReady)
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current)
        realtimeChannel.current = null
      }
    }
  }, [])

  return null
}