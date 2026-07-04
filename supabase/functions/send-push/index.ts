// supabase/functions/send-push/index.ts
// Sends push notifications via:
//   1. Web Push API (for PWA browser subscriptions — works via pushManager.subscribe())
//   2. Expo Push Service (for native app tokens from React Native app)
//
// Token types:
//   - "webpush": Web Push subscription (stored as subscription_json with endpoint + keys)
//   - "expo":    Expo Push Token (from React Native app via expo-notifications)
//
// Deploy: npx supabase functions deploy send-push

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!

// Configure web-push with VAPID details
webpush.setVapidDetails(
  'mailto:admin@al-mawaid.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

// ── Send via Web Push API (for PWA browser subscriptions) ─────────────────────

async function sendWebPush(
  subscriptionJson: string,
  title: string,
  body: string,
  url: string
) {
  const subscription = JSON.parse(subscriptionJson)
  const payload = JSON.stringify({ title, body, url })

  const res = await webpush.sendNotification(subscription, payload)
  return res
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

// ── CORS headers ─────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const { user_id, title, body, url, type = 'info', target_type, scheduled_for, sender_name } = await req.json()

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── If scheduled_for is set and in the future, save to broadcast_schedule ──
    if (scheduled_for) {
      const schedDate = new Date(scheduled_for)
      if (schedDate.getTime() > Date.now()) {
        const { error: schedError } = await supabase
          .from('broadcast_schedule')
          .insert([{
            title,
            body,
            media_url: url || null,
            target_type: target_type || 'all',
            target_user_id: user_id || null,
            status: 'scheduled',
            scheduled_for: scheduled_for,
            sender_name: sender_name || 'System',
            total_targets: 0,
            sent_count: 0,
            failed_count: 0,
          }])
        if (schedError) throw schedError
        return jsonResponse({ ok: true, scheduled: true, message: 'Notification scheduled for ' + scheduled_for })
      }
    }

    // 1. Determine target users
    let targetUserIds: string[] = []
    
    if (user_id && target_type === 'specific') {
      // Specific user
      targetUserIds = [user_id]
    } else if (target_type === 'admins') {
      // Admin staff only
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('user_id')
        .eq('role', 'admin')
      if (staffError) throw staffError
      targetUserIds = (staff || []).map(s => s.user_id)
    } else if (target_type === 'all' || !target_type) {
      // All users - fetch from user_stats (all registered users)
      const { data: allUsers, error: usersError } = await supabase
        .from('user_stats')
        .select('user_id')
      if (usersError) throw usersError
      targetUserIds = (allUsers || []).map(u => u.user_id)
    } else if (target_type === 'opt_in' || target_type === 'opt_out') {
      // Filter by survey status (opt_in = eating, opt_out = not eating)
      const now = new Date()
      const day = now.getDay()
      if (day === 0) {
        return jsonResponse({ ok: true, sent: 0, message: 'No survey data available on Sunday' })
      }
      const days = ['', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
      const dayName = days[day]
      const hour = now.getHours()
      const mealKey = hour < 15 ? 'l' : 'd'
      const statusColumn = `${dayName}_${mealKey}_status`
      const targetStatus = target_type === 'opt_in' ? 'opted_in' : 'opted_out'

      const { data: filteredUsers, error: filterError } = await supabase
        .from('survey_submissions_flat')
        .select('user_id')
        .eq(statusColumn, targetStatus)
      if (filterError) throw filterError

      if (filteredUsers && filteredUsers.length > 0) {
        targetUserIds = filteredUsers.map(u => u.user_id)
      } else {
        return jsonResponse({ ok: true, sent: 0, message: `No users found with ${target_type} status` })
      }
    } else {
      // Fallback: users with push subscriptions
      let query = supabase.from('push_subscriptions').select('user_id')
      const { data: subs, error: subsError } = await query
      if (subsError) throw subsError
      targetUserIds = [...new Set((subs || []).map(s => s.user_id))]
    }

    if (targetUserIds.length === 0) {
      return jsonResponse({ ok: true, sent: 0, message: 'No target users found' })
    }

    // 2. Fetch push subscriptions for target users
    let query = supabase.from('push_subscriptions').select('user_id, fcm_token, token_type, subscription_json').in('user_id', targetUserIds)
    let { data: subs, error } = await query
    if (error) throw error
    const pushSubs = subs || []

    // 3. Insert notification rows for ALL target users (triggers Realtime in-app toasts)
    await supabase.from('notifications').insert(
      targetUserIds.map((uid) => ({
        user_id: uid,
        title,
        message: body,
        type,
        url: url || null,
      }))
    )

    // 4. Separate subscriptions by type
    const webPushSubs = pushSubs.filter((s) => s.token_type === 'webpush' && s.subscription_json)
    const expoTokens = pushSubs.filter((s) => s.token_type === 'expo').map((s) => s.fcm_token)

    let sent = 0
    let failed = 0

    // 5a. Send via Web Push API for PWA subscriptions
    if (webPushSubs.length > 0) {
      const webPushResults = await Promise.allSettled(
        webPushSubs.map((s) =>
          sendWebPush(s.subscription_json!, title, body, url || '/')
        )
      )
      sent += webPushResults.filter((r) => r.status === 'fulfilled').length
      failed += webPushResults.filter((r) => r.status === 'rejected').length

      // Remove expired/invalid subscriptions
      for (let i = 0; i < webPushResults.length; i++) {
        const r = webPushResults[i]
        if (r.status === 'rejected') {
          const errMsg = r.reason?.message || String(r.reason)
          console.error('[send-push] Web Push failed:', errMsg)
          if (errMsg.includes('410') || errMsg.includes('404') || errMsg.includes('expired')) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('user_id', webPushSubs[i].user_id)
              .eq('token_type', 'webpush')
            console.log('[send-push] Removed expired subscription for user:', webPushSubs[i].user_id)
          }
        }
      }
    }

    // 5b. Send via Expo Push Service for native app tokens
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

    return jsonResponse({ ok: true, sent, failed, webpush: webPushSubs.length, expo: expoTokens.length })
  } catch (err) {
    console.error('[send-push] Error:', err.message)
    return jsonResponse({ ok: false, error: err.message }, 500)
  }
})
