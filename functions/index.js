// ═════════════════════════════════════════════════════════════════
// AL-MAWAID — Firebase Cloud Functions
// Push notification dispatch: FCM (native Android), Web Push, Expo Push
// Subscriptions are read from Supabase (not Firestore) after migration.
// FCM is sent via Firebase Admin SDK (admin.messaging) — no OAuth needed.
// ═════════════════════════════════════════════════════════════════

const { onRequest } = require('firebase-functions/v2/https')
const { setGlobalOptions } = require('firebase-functions/v2/options')
const admin = require('firebase-admin')
const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')

setGlobalOptions({ region: 'us-central1' })
admin.initializeApp()

// ── Supabase / VAPID (read at request time so deploy analysis doesn't crash) ──
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || 'https://pquusffhuholbnlmuyen.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on this function')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

function ensureVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY || ''
  const priv = process.env.VAPID_PRIVATE_KEY || ''
  if (pub && priv) {
    webpush.setVapidDetails('mailto:admin@al-mawaid.com', pub, priv)
    return true
  }
  return false
}

const setCorsHeaders = (res) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// ═════════════════════════════════════════════════════════════════
// sendPush — HTTP endpoint for sending push notifications
// ════════════════════════════════════════════════════════════════
exports.sendPush = onRequest({
  secrets: ['SUPABASE_SERVICE_ROLE_KEY'],
  cors: true,
  invoker: 'public',
}, async (req, res) => {
  setCorsHeaders(res)
  if (req.method === 'OPTIONS') return res.status(204).send('')

  try {
    // Parse JSON body if present
    let data = {}
    const contentType = req.headers['content-type'] || ''
    if (contentType.includes('application/json')) {
      let rawBody = ''
      if (req.rawBody) {
        rawBody = req.rawBody.toString()
      } else if (req.body) {
        // Fallback in case body was already parsed (shouldn't happen in CFv2 without middleware)
        rawBody = JSON.stringify(req.body)
      }
      try {
        data = JSON.parse(rawBody)
      } catch (e) {
        console.error('Failed to parse JSON body', e)
        return res.status(400).send({ error: 'Invalid JSON' })
      }
    } else {
      // Non-JSON content treated as empty payload
      data = {}
    }

    // Handle nested body format: { body: { ... } } or flat { ... }
    const payload = data?.body && typeof data.body === 'object' && !Array.isArray(data.body) && data.title === undefined
      ? { ...data.body }
      : data

    const {
      user_id: rawUserId,
      target_user_id,
      title,
      body: notificationBody, // Renamed to avoid conflict with body param
      url,
      type,
      target_type,
      scheduled_for,
      sender_name,
      image_url,
      channels,
    } = payload
    const user_id = rawUserId || target_user_id || null
    // channels: optional filter — ['webpush','expo','fcm']. Default = all.
    const allow = (ch) => !Array.isArray(channels) || channels.length === 0 || channels.includes(ch)
    const vapidReady = ensureVapid()

    const supabaseAdminLive = getSupabaseAdmin()

    // ── Resolve target user IDs from Supabase ──
    let targetUserIds = []

    if (user_id && target_type === 'specific') {
      targetUserIds = [user_id]
    } else if (target_type === 'admins') {
      const { data: admins } = await supabaseAdminLive.from('user_stats').select('user_id').eq('role', 'admin')
      targetUserIds = (admins || []).map(a => a.user_id).filter(Boolean)
    } else {
      // 'all' or anything else — get all unique user_ids with subscriptions
      const { data: subs } = await supabaseAdminLive.from('push_subscriptions').select('user_id').limit(5000)
      targetUserIds = [...new Set((subs || []).map(s => s.user_id).filter(Boolean))]
    }

    if (targetUserIds.length === 0) {
      return res.json({ ok: true, sent: 0, message: 'No target users found' })
    }

    // ── Fetch all subscriptions from Supabase in chunks ──
    const CHUNK_SIZE = 100
    let allPushSubs = []
    for (let i = 0; i < targetUserIds.length; i += CHUNK_SIZE) {
      const chunk = targetUserIds.slice(i, i + CHUNK_SIZE)
      const { data: subs } = await supabaseAdminLive
        .from('push_subscriptions')
        .select('*')
        .in('user_id', chunk)
      if (subs?.length) allPushSubs.push(...subs)
    }

    if (allPushSubs.length === 0) {
      return res.json({ ok: true, sent: 0, message: 'No push subscriptions found' })
    }

    // ── Separate by token type ──
    const webPushSubs = (allow('webpush') && vapidReady)
      ? allPushSubs.filter(s => s.token_type === 'webpush' && s.subscription_json)
      : []
    const expoTokens = allow('expo') ? allPushSubs.filter(s => s.token_type === 'expo').map(s => s.fcm_token).filter(Boolean) : []
    const fcmTokens = allow('fcm') ? allPushSubs.filter(s => s.token_type === 'fcm').map(s => s.fcm_token).filter(Boolean) : []

    let sent = 0, failed = 0

    // ── 1. Send Web Push (VAPID) ──
    if (webPushSubs.length > 0) {
      const webPushResults = await Promise.allSettled(
        webPushSubs.map(s => sendWebPush(s.subscription_json, title, notificationBody, url || '/', image_url, sender_name))
      )
      for (let i = 0; i < webPushResults.length; i++) {
        if (webPushResults[i].status === 'fulfilled') {
          sent++
        } else {
          failed++
          const errMsg = webPushResults[i].reason?.message || String(webPushResults[i].reason)
          if (errMsg.includes('410') || errMsg.includes('404') || errMsg.includes('expired') || errMsg.includes('unsubscribed')) {
            try {
              await supabaseAdminLive.from('push_subscriptions')
                .delete()
                .eq('user_id', webPushSubs[i].user_id)
                .eq('token_type', 'webpush')
            } catch (_) { /* ignore cleanup errors */ }
          }
        }
      }
    }

    // ── 2. Send Expo Push ──
    if (expoTokens.length > 0) {
      const expoResults = await Promise.allSettled(
        expoTokens.map(token => sendExpoPushMessage(token, title, notificationBody, url || '/'))
      )
      for (let i = 0; i < expoResults.length; i++) {
        if (expoResults[i].status === 'fulfilled') {
          sent++
        } else {
          failed++
        }
      }
    }

    // ── 3. Send FCM (native Android / Capacitor) via Firebase Admin SDK ──
    if (fcmTokens.length > 0) {
      const FCM_BATCH_SIZE = 500 // Firebase limit per sendEachForMulticast call
      for (let i = 0; i < fcmTokens.length; i += FCM_BATCH_SIZE) {
        const batch = fcmTokens.slice(i, i + FCM_BATCH_SIZE)
        try {
          const message = {
            tokens: batch,
            notification: { title, body: notificationBody },
            android: {
              priority: 'high',
              notification: {
                channelId: 'default',
                sound: 'default',
                priority: 'high',
                clickAction: url || '/',
                sticky: false,
              },
            },
            data: url ? { url, click_url: url } : {},
            webpush: {
              fcmOptions: { link: url || '/' },
              notification: {
                title,
                body: notificationBody,
                icon: '/al-mawaid.png',
                badge: '/al-mawaid.png',
                tag: 'al-mawaid',
              },
            },
          }
          const response = await admin.messaging().sendEachForMulticast(message)
          sent += response.successCount
          failed += response.failureCount

          // Clean up invalid/expired tokens
          if (response.failureCount > 0) {
            for (let j = 0; j < response.responses.length; j++) {
              const resp = response.responses[j]
              if (!resp.success && (
                resp.error?.code === 'messaging/registration-token-not-registered' ||
                resp.error?.code === 'messaging/invalid-registration-token' ||
                resp.error?.code === 'messaging/mismatched-credential'
              )) {
                try {
                  await supabaseAdminLive.from('push_subscriptions')
                    .delete()
                    .eq('fcm_token', batch[j])
                    .eq('token_type', 'fcm')
                } catch (_) { /* ignore cleanup errors */ }
              }
            }
          }
        } catch (err) {
          console.error('[sendPush] FCM batch error:', err.message)
          failed += batch.length
        }
      }
    }

    return res.json({ ok: true, sent, failed, webpush: webPushSubs.length, expo: expoTokens.length, fcm: fcmTokens.length })
  } catch (err) {
    console.error('[sendPush] Error:', err)
    return res.status(500).send({ ok: false, error: err.message })
  }
})

async function sendWebPush(subscriptionJson, title, body, url, image, sender_name) {
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

async function sendExpoPushMessage(expoToken, title, body, url) {
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