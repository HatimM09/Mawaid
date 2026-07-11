// src/lib/PushManager.jsx
// Handles:
//   1. Web Push API (browser push — works when tab is closed)
//   2. Supabase Realtime (in-app toast — instant when tab is open)

import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/firebaseClient'

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

      if (await handleNativeTokens(user)) return

      // Web Push subscription
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
      } catch {}

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'PUSH_RECEIVED') showToast(event.data.title, event.data.body, event.data.url)
      })

      // User-specific notifications
      setTimeout(() => subscribeRealtime(realtimeChannel, user, cancelledRef), 2000)
    }

    init()

    return () => {
      cancelledRef.current = true
      window.removeEventListener('native-push-ready', onNativeReady)
      if (realtimeChannel.current) { supabase.removeChannel(realtimeChannel.current); realtimeChannel.current = null }
    }
  }, [])

  return null
}