// src/lib/PushManager.jsx
// Handles:
//   1. Firebase Cloud Messaging (browser push — works when tab is closed)
//   2. Supabase Realtime (in-app toast — instant when tab is open)

import { useEffect, useRef } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import toast from 'react-hot-toast'
import { supabase } from '../admin/supabaseClient'

// ── Firebase config ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyCFQqTnz_CiVIKtDW4XH6CswPAm_KwN6jc',
  authDomain: 'al-mawaid-8ffef.firebaseapp.com',
  projectId: 'al-mawaid-8ffef',
  storageBucket: 'al-mawaid-8ffef.firebasestorage.app',
  messagingSenderId: '333277268731',
  appId: '1:333277268731:web:9f7ba7f8f279a47f94be5e',
}

// VAPID key from env (set in .env and Vercel env vars), with hardcoded fallback for safety
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BIEVWJ3bbYO2OZW--9AD-uDEevFUa4GNC2BuU6gtopIq0BTSLXVMTWh8EI6SIubsp2_s2o6lckRZDwtNzlYrZKY'

function getFirebaseApp() {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
}

async function saveFcmToken(userId, token, tokenType = 'fcm') {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, fcm_token: token, token_type: tokenType, updated_at: new Date().toISOString() },
      { onConflict: 'user_id, token_type' }
    )
  if (error) console.error('[PushManager] Failed to save push token:', error.message)
  else console.log('[PushManager] Push token saved to Supabase ✅ (' + tokenType + ')')
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
function subscribeRealtime(realtimeChannel, user, cancelledRef) {
  if (cancelledRef.current) return

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
        console.log('[PushManager] Realtime notification received:', payload.new)
        const { message, type, title, url } = payload.new
        showToast(title || 'Al-Mawaid', message, url)
      }
    )
    .subscribe((status) => {
      console.log('[PushManager] Realtime status:', status)
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
          await saveFcmToken(user.id, nativeToken, tokenType)
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
      // WEB PUSH (PWA) — Firebase Cloud Messaging via browser
      // ═══════════════════════════════════════════════════════════════════
      try {
        if (!('Notification' in window)) throw new Error('Notifications not supported in this browser')

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
          console.error('[PushManager] VITE_FIREBASE_VAPID_KEY is missing from .env!')
          return
        }

        console.log('[PushManager] Getting FCM token...')
        const app = getFirebaseApp()
        const messaging = getMessaging(app)
        const swReg = await navigator.serviceWorker.ready
        console.log('[PushManager] SW ready:', swReg.scope)

        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        })

        if (!token) {
          console.error('[PushManager] No FCM token returned — check VAPID key')
          return
        }

        console.log('[PushManager] FCM token obtained ✅')

        if (!cancelledRef.current) {
          await saveFcmToken(user.id, token)

          onMessage(messaging, (payload) => {
            console.log('[PushManager] Foreground message:', payload)
            const { title, body } = payload.notification || {}
            const url = payload.data?.url
            showToast(title || 'New notification', body, url)
          })
        }
      } catch (err) {
        console.warn('[PushManager] Firebase push unavailable:', err.message)
      }

      // ── Supabase Realtime (in-app toasts) ─────────────────────────────
      subscribeRealtime(realtimeChannel, user, cancelledRef)
    }

    init()

    return () => {
      cancelledRef.current = true
      window.removeEventListener('native-push-ready', onNativeReady)
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current)
      }
    }
  }, [])

  return null
}