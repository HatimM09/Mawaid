// Supabase Edge Function: Send Push Notifications
// Supports: Web Push (VAPID), Expo Push, FCM (native Android)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const FCM_SERVICE_ACCOUNT = Deno.env.get('FCM_SERVICE_ACCOUNT') || ''
const FCM_PROJECT_ID = 'al-mawaid-8ffef'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:admin@al-mawaid.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// ── FCM v1 OAuth2 token cache ──
let _fcmToken: { accessToken: string; expiresAt: number } | null = null

async function getFCMAccessToken(): Promise<string> {
  if (_fcmToken && Date.now() < _fcmToken.expiresAt) return _fcmToken.accessToken
  if (!FCM_SERVICE_ACCOUNT) throw new Error('FCM_SERVICE_ACCOUNT not configured')

  const sa = JSON.parse(FCM_SERVICE_ACCOUNT)
  const now = Math.floor(Date.now() / 1000)
  const jwtHeader = { alg: 'RS256', typ: 'JWT' }
  const jwtPayload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const { subtle } = globalThis.crypto
  const pemHeader = '-----BEGIN PRIVATE KEY-----\n'
  const pemFooter = '\n-----END PRIVATE KEY-----\n'
  const pemContents = sa.private_key
  const b64 = pemContents
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\n/g, '')
  const binaryDer = Uint8Array.from(atob(b64), c => c.charCodeAt(0))

  const privateKey = await subtle.importKey(
    'pkcs8', binaryDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )

  const encode = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const signingInput = `${encode(jwtHeader)}.${encode(jwtPayload)}`
  const sig = await subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(signingInput))
  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`FCM OAuth2 error: ${data.error_description || data.error || res.status}`)

  _fcmToken = { accessToken: data.access_token, expiresAt: now + data.expires_in - 60 }
  return _fcmToken.accessToken
}

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const payload = await req.json()
    // Accept either flat body or accidentally nested { body: {...} } from older clients
    const raw = payload?.body && typeof payload.body === 'object' && !Array.isArray(payload.body) && payload.title === undefined
      ? { ...payload.body }
      : payload
    const {
      user_id: rawUserId,
      target_user_id,
      title,
      body,
      url,
      type,
      target_type,
      scheduled_for,
      sender_name,
      image_url,
      channels,
    } = raw
    const user_id = rawUserId || target_user_id || null
    // channels: optional filter — ['webpush','expo','fcm']. Default = all.
    const allow = (ch: string) => !Array.isArray(channels) || channels.length === 0 || channels.includes(ch)

    // Handle scheduling
    if (scheduled_for) {
      const schedDate = new Date(scheduled_for)
      if (schedDate.getTime() > Date.now()) {
        await supabase.from('broadcast_schedule').insert({
          title: title || '',
          body: body || '',
          media_url: url || null,
          target_type: target_type || 'all',
          target_user_id: user_id || null,
          status: 'scheduled',
          scheduled_for: schedDate.toISOString(),
          sender_name: sender_name || 'System',
          total_targets: 0, sent_count: 0, failed_count: 0,
          created_at: new Date().toISOString(),
        })
        return new Response(JSON.stringify({ ok: true, scheduled: true, message: 'Notification scheduled for ' + scheduled_for }), { status: 200, headers })
      }
    }

    // Resolve target user IDs
    let targetUserIds: string[] = []

    if (user_id && target_type === 'specific') {
      targetUserIds = [user_id]
    } else if (target_type === 'admins') {
      const { data: admins } = await supabase.from('user_stats').select('user_id').eq('role', 'admin')
      targetUserIds = admins?.map((a: any) => a.user_id).filter(Boolean) || []
    } else {
      const { data: subs } = await supabase.from('push_subscriptions').select('user_id').limit(5000)
      targetUserIds = [...new Set(subs?.map((s: any) => s.user_id).filter(Boolean) || [])]
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: 'No target users found' }), { status: 200, headers })
    }

    // Fetch subscriptions in chunks to avoid URL length limits
    const CHUNK_SIZE = 100
    let allPushSubs: any[] = []

    for (let i = 0; i < targetUserIds.length; i += CHUNK_SIZE) {
      const chunk = targetUserIds.slice(i, i + CHUNK_SIZE)
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .in('user_id', chunk)
      if (subs?.length) allPushSubs.push(...subs)
    }

    if (allPushSubs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: 'No push subscriptions found' }), { status: 200, headers })
    }

    const webPushSubs = allow('webpush') ? allPushSubs.filter((s: any) => s.token_type === 'webpush' && s.subscription_json) : []
    const expoSubs = allow('expo') ? allPushSubs.filter((s: any) => s.token_type === 'expo' && s.fcm_token) : []
    const fcmSubs = allow('fcm') ? allPushSubs.filter((s: any) => s.token_type === 'fcm' && s.fcm_token) : []

    let sent = 0, failed = 0

    // Send Web Push notifications
    if (webPushSubs.length > 0) {
      const results = await Promise.allSettled(
        webPushSubs.map((sub: any) =>
          sendWebPush(sub.subscription_json, title, body, url || '/', image_url, sender_name)
        )
      )
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled') {
          sent++
        } else {
          failed++
          const errMsg: string = (results[i] as PromiseRejectedResult).reason?.message || ''
          if (errMsg.includes('410') || errMsg.includes('404') || errMsg.includes('expired')) {
            await supabase.from('push_subscriptions')
              .delete()
              .eq('user_id', webPushSubs[i].user_id)
              .eq('token_type', 'webpush')
          }
        }
      }
    }

    // Send Expo Push notifications
    if (expoSubs.length > 0) {
      const results = await Promise.allSettled(
        expoSubs.map((sub: any) => sendExpoPush(sub.fcm_token, title, body, url || '/'))
      )
      sent += results.filter(r => r.status === 'fulfilled').length
      failed += results.filter(r => r.status === 'rejected').length
    }

    // Send FCM Push (native Android / Capacitor)
    if (fcmSubs.length > 0) {
      const results = await Promise.allSettled(
        fcmSubs.map((sub: any) => sendFCMPush(sub.fcm_token, title, body, url || '/'))
      )
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled') {
          sent++
        } else {
          failed++
          const errMsg: string = (results[i] as PromiseRejectedResult).reason?.message || ''
          if (errMsg.includes('NotRegistered') || errMsg.includes('InvalidRegistration')) {
            await supabase.from('push_subscriptions')
              .delete()
              .eq('user_id', fcmSubs[i].user_id)
              .eq('token_type', 'fcm')
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, webpush: webPushSubs.length, expo: expoSubs.length, fcm: fcmSubs.length }), { status: 200, headers })
  } catch (err) {
    console.error('[send-push] Error:', err)
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers })
  }
})

async function sendWebPush(subscriptionJson: string | object, title: string, body: string, url: string, image?: string, sender_name?: string) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error('VAPID keys not configured')
  }
  const subscription = typeof subscriptionJson === 'string' ? JSON.parse(subscriptionJson) : subscriptionJson
  const payload = JSON.stringify({
    title, body, url, image: image || undefined, sender_name: sender_name || undefined,
    badge: '/al-mawaid.png', vibrate: [200, 100, 200], requireInteraction: true,
    // Unique tag per notification so each shows individually on Android
    tag: `al-mawaid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    actions: [{ action: 'open', title: 'View' }, { action: 'dismiss', title: 'Dismiss' }],
    timestamp: Date.now(),
  })
  return webpush.sendNotification(subscription, payload)
}

async function sendExpoPush(expoToken: string, title: string, body: string, url: string) {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: expoToken, sound: 'default', title, body, data: { url }, _displayInForeground: true }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.errors?.[0]?.message || 'Expo push send failed')
  }
  return res.json()
}

async function sendFCMPush(fcmToken: string, title: string, body: string, url: string) {
  const accessToken = await getFCMAccessToken()
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
            priority: 'high',
            clickAction: url || '/',
          },
        },
        data: url ? { url } : undefined,
      },
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `FCM v1 push failed: ${res.status}`)
  }
  return res.json()
}
