// src/lib/PushManager.jsx
// Handles:
//   1. Firebase Cloud Messaging (browser push — works when tab is closed)
//   2. Supabase Realtime (in-app toast — instant when tab is open)

import { useEffect, useRef } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import toast from 'react-hot-toast'
import { supabase } from '../admin/supabaseClient'

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCFQqTnz_CiVIKtDW4XH6CswPAm_KwN6jc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'al-mawaid-8ffef.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'al-mawaid-8ffef',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'al-mawaid-8ffef.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '333277268731',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:333277268731:web:9f7ba7f8f279a47f94be5e',
}

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''

function getFirebaseApp() {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
}

async function saveFcmToken(userId, token) {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, fcm_token: token, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (error) console.error('[PushManager] Failed to save FCM token:', error.message)
  else console.log('[PushManager] FCM token saved to Supabase ✅')
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

export default function PushManager() {
  const realtimeChannel = useRef(null)

  useEffect(() => {
    console.log('[PushManager] mounted ✅')
    console.log('[PushManager] VAPID key:', VAPID_KEY ? '✅ loaded' : '❌ missing')
    let cancelled = false

    async function init() {
      // 1. Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log('[PushManager] user:', user?.id || 'none', userError?.message || '')
      if (!user || cancelled) return

      // ── Firebase Push ────────────────────────────────────────────────────
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
          // We still continue to Realtime setup
        } else if (!VAPID_KEY) {
          console.error('[PushManager] VITE_FIREBASE_VAPID_KEY is missing from environment!')
        } else {
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
          } else {
            console.log('[PushManager] FCM token obtained ✅')
            if (!cancelled) {
              await saveFcmToken(user.id, token)

              onMessage(messaging, (payload) => {
                console.log('[PushManager] Foreground message:', payload)
                const { title, body } = payload.notification || {}
                const url = payload.data?.url
                showToast(title || 'New notification', body, url)
              })
            }
          }
        }
      } catch (err) {
        console.warn('[PushManager] Firebase push unavailable:', err.message)
      }

      // ── Supabase Realtime ────────────────────────────────────────────────
      if (cancelled) return

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

    init()

    return () => {
      cancelled = true
      if (realtimeChannel.current) {
        supabase.removeChannel(realtimeChannel.current)
      }
    }
  }, [])

  return null
}