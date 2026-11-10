/// <reference path="../deno.d.ts" />
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

// ── Stable dedup key (FNV-1a) ────────────────────────────────────────────────
// Derives a deterministic identifier from notification content/params so that
// duplicate sends of the same message REPLACE the previous tray entry instead
// of stacking a second identical notification.
function dedupKey(...parts: (string | undefined | null)[]): string {
  let h = 0x811c9dc5
  const s = parts.filter(Boolean).join('|')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return 'alm_' + h.toString(36)
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
      user_ids,
      title,
      body,
      url,
      type,
      target_type,
      scheduled_for,
      sender_name,
      image_url,
      notify_in_app,
      channels,
      // Rich push options
      big_picture_url,
      actions,
      style,
      ttl,
      collapse_key,
    } = raw
    const user_id = rawUserId || target_user_id || null
    const targetUserIds = Array.isArray(user_ids) && user_ids.length > 0
      ? user_ids.filter(Boolean)
      : null // Batch targeted list (explicit user IDs), distinct from target_type routing
    // channels: optional filter — ['webpush','expo','fcm']. Default = all.
    const allow = (ch: string) => !Array.isArray(channels) || channels.length === 0 || channels.includes(ch)

    // Stable tag so identical content collapses in the OS tray instead of
    // stacking duplicates. An explicit collapse_key keeps its identity.
    const contentTag = collapse_key
      ? `alm_${collapse_key}_${dedupKey(title || '', body || '')}`
      : dedupKey(title || '', body || '', url || '', type || '')

    // ── Android notification channel routing (each channel plays the Al-Mawaid chime) ──
    const TYPE_CHANNEL_MAP: Record<string, string> = {
      new_query: 'queries',
      query_reply: 'queries',
      query_resolved: 'queries',
      query_receipt: 'queries',
      new_request: 'requests',
      request_approved: 'requests',
      request_rejected: 'requests',
      request_received: 'requests',
      broadcast: 'broadcasts',
      menu: 'broadcasts',
      survey_reminder: 'reminders',
      reminder: 'reminders',
      survey: 'default',
      survey_digest: 'default',
      feedback: 'default',
    }
    const fcmChannelId = TYPE_CHANNEL_MAP[type || ''] || 'default'

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

    // Resolve target user IDs and push subscriptions
    let allPushSubs: any[] = []

    if (user_id && target_type === 'specific') {
      const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', user_id)
      allPushSubs = subs || []
    } else if (targetUserIds) {
      // Batch targeted push (e.g., cron reminders): resolve subs for explicit ID list
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .in('user_id', targetUserIds.slice(0, 2000))
      allPushSubs = subs || []
    } else if (target_type === 'admins') {
      const { data: admins } = await supabase.from('user_stats').select('user_id').eq('role', 'admin')
      const adminIds = admins?.map((a: any) => a.user_id).filter(Boolean) || []
      if (adminIds.length > 0) {
        const { data: subs } = await supabase.from('push_subscriptions').select('*').in('user_id', adminIds)
        allPushSubs = subs || []
      }
    } else {
      // All active subscribers
      const { data: subs } = await supabase.from('push_subscriptions').select('*').limit(5000)
      allPushSubs = subs || []
    }

    // ── In-app notification rows (Realtime toast + inbox) ──
    // Runs with the service-role client so RLS never blocks inserts. For 'all'
    // broadcasts every member gets a row even if they have no push subscription.
    if (notify_in_app && title) {
      try {
        let inAppIds: string[] = []
        if (target_type === 'specific' && user_id) {
          inAppIds = [user_id]
        } else if (targetUserIds) {
          inAppIds = targetUserIds.slice(0, 10000)
        } else if (target_type === 'admins') {
          const { data: admins } = await supabase.from('user_stats').select('user_id').eq('role', 'admin')
          inAppIds = admins?.map((a: any) => a.user_id).filter(Boolean) || []
        } else {
          const { data: members } = await supabase.from('user_stats').select('user_id').limit(10000)
          inAppIds = members?.map((m: any) => m.user_id).filter(Boolean) || []
        }
        if (inAppIds.length) {
          // ── Duplicate guard: skip users who already hold the exact same
          // title+message row created today (double cron runs, double admin
          // click, service-retry). The same message is never duplicated in
          // the inbox, or pushed twice, within the same day. ──
          const todayStart = new Date();
          todayStart.setUTCHours(0, 0, 0, 0);
          const reminderText = body || ''
          const alreadyNotified = new Set<string>()
          for (let i = 0; i < inAppIds.length; i += 500) {
            const chunk = inAppIds.slice(i, i + 500)
            const { data: existing } = await supabase
              .from('notifications')
              .select('user_id')
              .eq('title', title)
              .eq('message', reminderText)
              .in('user_id', chunk)
              .gte('created_at', todayStart.toISOString())
            for (const row of existing || []) alreadyNotified.add(row.user_id)
          }
          const freshIds = inAppIds.filter((uid: string) => !alreadyNotified.has(uid))
          console.log(`[send-push] In-app dedup: ${inAppIds.length - freshIds.length} of ${inAppIds.length} users already got this content today`)
          if (freshIds.length === 0) {
            // Nothing new to write — fall through so push delivery skips too
            allPushSubs = []
          } else {
            const rows = freshIds.map((uid: string) => ({
              user_id: uid,
              title: title || 'Al-Mawaid',
              message: body || '',
              url: url || '/',
              type: type || 'info',
              sender_name: sender_name || 'Al-Mawaid',
            }))
            for (let i = 0; i < rows.length; i += 200) {
              await supabase.from('notifications').insert(rows.slice(i, i + 200))
            }
          }
        }
      } catch (e) {
        console.error('[send-push] In-app notification insert failed:', e)
      }
    }

    if (allPushSubs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: 'No push subscriptions found' }), { status: 200, headers })
    }

    const webPushSubs = allow('webpush') ? allPushSubs.filter((s: any) => s.token_type === 'webpush' && s.subscription_json) : []
    const expoSubs = allow('expo') ? allPushSubs.filter((s: any) => s.token_type === 'expo' && s.fcm_token) : []
    const fcmSubs = allow('fcm') ? allPushSubs.filter((s: any) => s.token_type === 'fcm' && s.fcm_token) : []

    // De-duplicate across channels for users registered on BOTH Web Push and
    // FCM from the same browser (a legacy double-registration): FCM/expo (rich,
    // native-quality) wins, so that device receives ONE message, not two.
    const fcmUserSet = new Set(fcmSubs.map((s: any) => s.user_id))
    const expoUserSet = new Set(expoSubs.map((s: any) => s.user_id))
    const webPushToSend = webPushSubs.filter((s: any) => !fcmUserSet.has(s.user_id) && !expoUserSet.has(s.user_id))
    const droppedWebPushDupes = webPushSubs.length - webPushToSend.length
    if (droppedWebPushDupes > 0) {
      console.log(`[send-push] Suppressed ${droppedWebPushDupes} duplicate web-push delivery(ies) for FCM-covered users`)
    }

    let sent = 0, failed = 0

    // Helper: send with retry
    async function sendWithRetry(fn: () => Promise<any>, maxRetries = 2): Promise<{ ok: boolean; err?: string }> {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          await fn()
          return { ok: true }
        } catch (err: any) {
          if (attempt === maxRetries) return { ok: false, err: err.message }
          // Only retry on transient errors (network/timeout/5xx), not on 400/404/410
          const msg = err.message || ''
          if (msg.includes('410') || msg.includes('404') || msg.includes('400') || msg.includes('expired')) {
            return { ok: false, err: msg }
          }
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        }
      }
      return { ok: false }
    }

    // Send Web Push notifications
    if (webPushToSend.length > 0) {
      const results = await Promise.allSettled(
        webPushToSend.map((sub: any) =>
          sendWithRetry(() => sendWebPush(sub.subscription_json, title, body, url || '/', image_url, sender_name, big_picture_url, actions, style, contentTag, fcmChannelId))
        )
      )
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled' && (results[i] as PromiseFulfilledResult<any>).value.ok) {
          sent++
        } else {
          failed++
          const result = results[i]
          let errMsg = ''
          if (result.status === 'rejected') {
            errMsg = (result as PromiseRejectedResult).reason?.message || ''
          } else {
            errMsg = (result as PromiseFulfilledResult<any>).value.err || ''
          }
          if (errMsg.includes('410') || errMsg.includes('404') || errMsg.includes('expired')) {
            await supabase.from('push_subscriptions')
              .delete()
              .eq('user_id', webPushToSend[i].user_id)
              .eq('token_type', 'webpush')
          }
        }
      }
    }

    // Send Expo Push notifications
    if (expoSubs.length > 0) {
      const results = await Promise.allSettled(
        expoSubs.map((sub: any) => sendWithRetry(() => sendExpoPush(sub.fcm_token, title, body, url || '/', fcmChannelId)))
      )
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.ok) sent++
        else failed++
      }
    }

    // Send FCM Push (native Android / Capacitor)
    if (fcmSubs.length > 0) {
      const results = await Promise.allSettled(
        fcmSubs.map((sub: any) => sendWithRetry(() => sendFCMPush(sub.fcm_token, title, body, url || '/', big_picture_url, actions, style, collapse_key || contentTag, fcmChannelId)))
      )
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        const ok = result.status === 'fulfilled' && result.value.ok
        if (ok) {
          sent++
        } else {
          failed++
          let errMsg = ''
          if (result.status === 'rejected') {
            errMsg = (result as PromiseRejectedResult).reason?.message || ''
          } else {
            errMsg = (result as PromiseFulfilledResult<any>).value.err || ''
          }
          if (errMsg.includes('NotRegistered') || errMsg.includes('InvalidRegistration')) {
            await supabase.from('push_subscriptions')
              .delete()
              .eq('user_id', fcmSubs[i].user_id)
              .eq('token_type', 'fcm')
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, webpush: webPushToSend.length, expo: expoSubs.length, fcm: fcmSubs.length }), { status: 200, headers })
  } catch (err) {
    console.error('[send-push] Error:', err)
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers })
  }
})

async function sendWebPush(subscriptionJson: string | object, title: string, body: string, url: string, image?: string, sender_name?: string, bigPictureUrl?: string, actions?: any[], style?: string, contentTag?: string, channelId?: string) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error('VAPID keys not configured')
  }
  const subscription = typeof subscriptionJson === 'string' ? JSON.parse(subscriptionJson) : subscriptionJson
  const payload = JSON.stringify({
    title, body, url, image: image || undefined, sender_name: sender_name || undefined,
    badge: '/al-mawaid.png', vibrate: [200, 100, 200], requireInteraction: true,
    // Custom Al-Mawaid chime (used by Safari/macOS; Chrome plays its own
    // system sound, which is why the native app uses channel sounds)
    sound: '/sounds/al_mawaid_chime.wav',
    // Stable tag derived from content: a duplicate send REPLACES the tray
    // entry instead of stacking a second identical notification.
    tag: contentTag || `al-mawaid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    actions: actions || [{ action: 'open', title: 'View' }, { action: 'dismiss', title: 'Dismiss' }],
    timestamp: Date.now(),
    channelId, bigPictureUrl, style,
  })
  return webpush.sendNotification(subscription, payload)
}

async function sendExpoPush(expoToken: string, title: string, body: string, url: string, channelId?: string) {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: expoToken, sound: 'default', title, body, data: { url }, channelId, _displayInForeground: true }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.errors?.[0]?.message || 'Expo push send failed')
  }
  return res.json()
}

async function sendFCMPush(fcmToken: string, title: string, body: string, url: string, bigPictureUrl?: string, actions?: any[], style?: string, collapseKey?: string, channelId?: string) {
  const accessToken = await getFCMAccessToken()
  const androidNotification: any = {
    channelId: channelId || 'default',
    sound: 'al_mawaid_chime',
    defaultSound: false,
    priority: 'high',
    clickAction: url || '/',
  }

  // Rich push: BigPictureStyle
  if (bigPictureUrl && style !== 'inbox') {
    androidNotification.imageUrl = bigPictureUrl
    androidNotification.style = 'bigpicture'
    androidNotification.bigPictureUrl = bigPictureUrl
  }

  // Action buttons (max 3)
  if (actions && actions.length > 0) {
    androidNotification.actions = actions.slice(0, 3).map((a: any, idx: number) => ({
      action: a.action || `action_${idx}`,
      title: a.title || `Action ${idx + 1}`,
      icon: a.icon || undefined,
    }))
  }

  const message: any = {
    message: {
      token: fcmToken,
      notification: { title, body },
      android: {
        priority: 'high',
        notification: androidNotification,
      },
      data: {
        url: String(url || '/'),
        title: String(title || 'Al-Mawaid'),
        body: String(body || ''),
      },
    },
  }

  if (collapseKey) {
    message.message.android.collapseKey = collapseKey
  }

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(message),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `FCM v1 push failed: ${res.status}`)
  }
  return res.json()
}
