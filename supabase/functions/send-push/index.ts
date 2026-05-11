// supabase/functions/send-push/index.ts
// Uses FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY secrets (no JSON parsing)
//
// Deploy: npx supabase functions deploy send-push

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FIREBASE_PROJECT_ID = 'al-mawaid-8ffef'
const CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL')!
const PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY')!

// ── Get OAuth2 access token ───────────────────────────────────────────────────
async function getAccessToken(): Promise<string> {
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

  // Clean up private key — handle both literal \n and real newlines
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

// ── Send one FCM message ──────────────────────────────────────────────────────
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

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const { user_id, title, body, url, type = 'info' } = await req.json()

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 1. Fetch FCM tokens
    let query = supabase.from('push_subscriptions').select('user_id, fcm_token')
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
    await supabase.from('notifications').insert(
      subs.map((s) => ({
        user_id: s.user_id,
        title,
        message: body,
        type,
        url: url || null,
      }))
    )

    // 3. Get OAuth token once
    const accessToken = await getAccessToken()

    // 4. Send push to all tokens
    const results = await Promise.allSettled(
      subs.map(({ fcm_token }) =>
        sendFcmMessage(accessToken, fcm_token, title, body, url || '/')
      )
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    return new Response(
      JSON.stringify({ ok: true, sent, failed }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
