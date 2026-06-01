// supabase/functions/send-push/index.ts
// Sends push notifications to both FCM tokens (PWA) and Expo push tokens (native app).
//
// Token types:
//   - "fcm":  Firebase Cloud Messaging token (from PWA web app)
//   - "expo": Expo Push Token (from React Native app via expo-notifications)
//
// Deploy: npx supabase functions deploy send-push

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FIREBASE_PROJECT_ID = 'al-mawaid-8ffef'
const CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
const PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY')!

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function getFcmAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const encode = (obj: any) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const headerB64 = encode({ alg: 'RS256', typ: 'JWT' })
  const payloadB64 = encode({
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })

  const signingInput = `${headerB64}.${payloadB64}`

  const pemKey = PRIVATE_KEY.replace(/\\n/g, '\n')
  const pemContents = pemKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${signingInput}.${signatureB64}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    throw new Error(`OAuth failed: ${JSON.stringify(tokenData)}`)
  }
  return tokenData.access_token
}

// ── Send via FCM (for PWA web tokens) ─────────────────────────────────────────

async function sendFcmMessage(
  accessToken: string,
  fcmToken: string,
  title: string,
  body: string,
  url: string
) {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          webpush: {
            notification: {
              title,
              body,
              icon: '/al-mawaid.png',
              badge: '/al-mawaid.png',
            },
            fcm_options: { link: url || '/' },
          },
        },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'FCM send failed')
  }
  return res.json()
}

// ── Send via Expo Push Service (for native app tokens) ────────────────────────

async function sendExpoPushMessage(
  expoToken: string,
  title: string,
  body: string,
  url: string
) {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: expoToken,
      sound: 'default',
      title,
      body,
      data: { url },
      _displayInForeground: true,
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.errors?.[0]?.message || 'Expo push send failed')
  }
  return res.json()
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const { user_id, title, body, url, type = 'info' } = await req.json()

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 1. Fetch push subscriptions (both FCM and Expo tokens)
    let query = supabase.from('push_subscriptions').select('user_id, fcm_token, token_type')
    if (user_id) query = query.eq('user_id', user_id)
    const { data: subs, error } = await query
    if (error) throw error
    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, message: 'No subscribers' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2. Insert notification rows (triggers Realtime in-app toasts)
    // Deduplicate by user_id so users don't get duplicate toasts
    const uniqueUserIds = [...new Set(subs.map((s) => s.user_id))]
    await supabase.from('notifications').insert(
      uniqueUserIds.map((uid) => ({
        user_id: uid,
        title,
        message: body,
        type,
        url: url || null,
      }))
    )

    // 3. Separate tokens by type
    const fcmTokens = subs.filter((s) => s.token_type === 'fcm' || !s.token_type).map((s) => s.fcm_token)
    const expoTokens = subs.filter((s) => s.token_type === 'expo').map((s) => s.fcm_token)

    let sent = 0
    let failed = 0

    // 4a. Send via FCM for PWA tokens
    if (fcmTokens.length > 0) {
      const accessToken = await getFcmAccessToken()
      const fcmResults = await Promise.allSettled(
        fcmTokens.map((token) =>
          sendFcmMessage(accessToken, token, title, body, url || '/')
        )
      )
      sent += fcmResults.filter((r) => r.status === 'fulfilled').length
      failed += fcmResults.filter((r) => r.status === 'rejected').length
      for (const r of fcmResults) {
        if (r.status === 'rejected') console.error('[send-push] FCM failed:', r.reason)
      }
    }

    // 4b. Send via Expo Push Service for native app tokens
    if (expoTokens.length > 0) {
      const expoResults = await Promise.allSettled(
        expoTokens.map((token) =>
          sendExpoPushMessage(token, title, body, url || '/')
        )
      )
      sent += expoResults.filter((r) => r.status === 'fulfilled').length
      failed += expoResults.filter((r) => r.status === 'rejected').length
      for (const r of expoResults) {
        if (r.status === 'rejected') console.error('[send-push] Expo push failed:', r.reason)
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent, failed, fcm: fcmTokens.length, expo: expoTokens.length }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
