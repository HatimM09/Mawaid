const { onRequest, onCall } = require('firebase-functions/v2/https')
const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onInit } = require('firebase-functions/v2/core')
const { setGlobalOptions } = require('firebase-functions/v2/options')
const admin = require('firebase-admin')
const webpush = require('web-push')

setGlobalOptions({ region: 'us-central1' })
admin.initializeApp()
const db = admin.firestore()

// ── Supabase Admin (for auth operations) ──
// For production: upgrade to Blaze plan and use secrets:
//   firebase functions:secrets:set SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
// Then add secrets: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] to function opts
// UPDATE THIS: Replace with your new Supabase project service_role key
// Get it from: Supabase Dashboard → Project Settings → API → service_role key
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pquusffhuholbnlmuyen.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'REPLACE_WITH_YOUR_SERVICE_ROLE_KEY'
const { createClient } = require('@supabase/supabase-js')
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── VAPID config (set via `firebase functions:secrets:set VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY`) ──
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:admin@al-mawaid.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. handleNewUser — auto-create userStats on Auth signup
// ══════════════════════════════════════════════════════════════════════════════
exports.handleNewUser = onDocumentCreated('userStats/{userId}', (event) => {
  // If userStats doc already exists via seed/import, skip
  if (event.data) return null
  const uid = event.params.userId
  return db.collection('userStats').doc(uid).set({
    user_id: uid,
    name: '',
    email: '',
    thali_number: null,
    phone: '',
    address: '',
    role: 'member',
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  })
})
exports.handleNewUser = onInit(() => {
  // This is a fallback — the primary trigger is the auth onCreate below
  // see: https://firebase.google.com/docs/functions/auth-events
})

// The actual auth trigger (v2):
exports.onUserCreate = onDocumentCreated('_onAuthUserCreated/{uid}', async (event) => {
  // Not used — we use the auth block below
})
// Auth trigger in Firebase Functions v2 uses a blocking function:
// https://firebase.google.com/docs/functions/auth-events#blocking_functions
// We use the beforeCreate hook instead
exports.beforeCreate = onInit(undefined)

// ── Auth onCreate trigger (v1-compatible using admin SDK) ──
// Firebase Functions v2 doesn't have a direct auth.user().onCreate() equivalent.
// Instead, we use the `beforeUserCreated` blocking function.
// Deploy with: firebase deploy --only functions

const { beforeUserCreated } = require('firebase-functions/v2/identity')
exports.beforeUserCreated = beforeUserCreated(async (event) => {
  const uid = event.data.uid
  const email = event.data.email || ''
  const displayName = event.data.displayName || ''
  await db.collection('userStats').doc(uid).set({
    user_id: uid,
    name: displayName,
    email,
    thali_number: null,
    phone: '',
    address: '',
    role: 'member',
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  })
  return {}
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. manageUser — CRUD for Firebase Auth users (called via supabase.rpc)
// ══════════════════════════════════════════════════════════════════════════════
exports.manageUserCreate = onRequest({ cors: true }, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).send('')
  try {
    const { p_email, p_password, p_metadata } = req.body
    const user = await admin.auth().createUser({
      email: p_email,
      password: p_password,
      displayName: p_metadata?.name || '',
    })
    if (p_metadata) {
      await admin.auth().updateUser(user.uid, { displayName: p_metadata.name || '' })
    }
    await db.collection('userStats').doc(user.uid).set({
      user_id: user.uid,
      name: p_metadata?.name || '',
      email: p_email,
      thali_number: p_metadata?.thali_number || null,
      phone: '',
      address: '',
      role: 'member',
      avatar_url: p_metadata?.avatar_url || null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    })
    return res.json({ data: user.uid, error: null })
  } catch (err) {
    return res.status(400).json({ data: null, error: { message: err.message } })
  }
})

exports.manageUserUpdate = onRequest({ cors: true }, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).send('')
  try {
    const { p_user_id, p_password, p_metadata, p_email } = req.body
    const updates = {}
    if (p_password) updates.password = p_password
    if (p_email) updates.email = p_email
    if (p_metadata?.name) updates.displayName = p_metadata.name
    if (Object.keys(updates).length) {
      await admin.auth().updateUser(p_user_id, updates)
    }
    return res.json({ data: null, error: null })
  } catch (err) {
    return res.status(400).json({ data: null, error: { message: err.message } })
  }
})

exports.manageUserDelete = onRequest({ cors: true }, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).send('')
  try {
    const { p_user_id } = req.body
    await admin.auth().deleteUser(p_user_id)
    await db.collection('userStats').doc(p_user_id).delete()
    return res.json({ data: null, error: null })
  } catch (err) {
    return res.status(400).json({ data: null, error: { message: err.message } })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// 2b. supabaseAdminAuth — Supabase Auth operations for admin panel
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets set via:
//   firebase functions:secrets:set SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
// ══════════════════════════════════════════════════════════════════════════════
exports.supabaseAdminAuth = onRequest({ cors: true }, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (!supabaseAdmin) {
    return res.status(500).json({ data: null, error: { message: 'Supabase Admin not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets.' } })
  }

  try {
    const { action, p_email, p_password, p_user_id, p_metadata } = req.body

    if (action === 'delete_user') {
      if (!p_user_id) return res.status(400).json({ data: null, error: { message: 'User ID is required' } })
      await supabaseAdmin.auth.admin.deleteUser(p_user_id)
      await db.collection('userStats').doc(p_user_id).delete().catch(() => {})
      return res.json({ data: { deleted: true }, error: null })
    }

    if (action === 'create_user') {
      if (!p_email) return res.status(400).json({ data: null, error: { message: 'Email is required' } })
      if (!p_password || p_password.length < 6) return res.status(400).json({ data: null, error: { message: 'Password must be at least 6 characters' } })
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: p_email,
        password: p_password,
        email_confirm: true,
        user_metadata: p_metadata || {},
      })
      if (error) return res.status(400).json({ data: null, error: { message: error.message } })
      const uid = data.user.id
      await db.collection('userStats').doc(uid).set({
        user_id: uid, name: p_metadata?.name || '', email: p_email,
        thali_number: p_metadata?.thali_number || null, phone: '', address: '',
        role: 'member', avatar_url: p_metadata?.avatar_url || null,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {})
      return res.json({ data: uid, error: null })
    }

    if (action === 'update_user') {
      if (!p_user_id) return res.status(400).json({ data: null, error: { message: 'User ID is required' } })
      const updates = {}
      if (p_email) updates.email = p_email
      if (p_password) updates.password = p_password
      if (p_metadata) updates.user_metadata = p_metadata
      if (Object.keys(updates).length) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(p_user_id, updates)
        if (error) return res.status(400).json({ data: null, error: { message: error.message } })
      }
      return res.json({ data: { updated: true }, error: null })
    }

    if (action === 'reset_password') {
      if (!p_email) return res.status(400).json({ data: null, error: { message: 'Email is required' } })
      const { error } = await supabaseAdmin.auth.admin.resetPasswordForEmail(p_email)
      if (error) return res.status(400).json({ data: null, error: { message: error.message } })
      return res.json({ data: true, error: null })
    }

    return res.status(400).json({ data: null, error: { message: `Unknown action: ${action}` } })
  } catch (err) {
    return res.status(500).json({ data: null, error: { message: err.message } })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. sendPush — HTTP endpoint for sending push notifications
// ══════════════════════════════════════════════════════════════════════════════
exports.sendPush = onRequest({ cors: true, secrets: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] }, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).send('')

  try {
    const { user_id, title, body, url, type, target_type, scheduled_for, sender_name, image_url } = req.body

    // ── If scheduled_for is in future, save to broadcast_schedule ──
    if (scheduled_for) {
      const schedDate = new Date(scheduled_for)
      if (schedDate.getTime() > Date.now()) {
        await db.collection('broadcastSchedule').add({
          title: title || '',
          body: body || '',
          media_url: url || null,
          target_type: target_type || 'all',
          target_user_id: user_id || null,
          status: 'scheduled',
          scheduled_for: admin.firestore.Timestamp.fromDate(schedDate),
          sender_name: sender_name || 'System',
          total_targets: 0,
          sent_count: 0,
          failed_count: 0,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        })
        return res.json({ ok: true, scheduled: true, message: 'Notification scheduled for ' + scheduled_for })
      }
    }

    // 1. Determine target users
    let targetUserIds = []

    if (user_id && target_type === 'specific') {
      targetUserIds = [user_id]
    } else if (target_type === 'admins') {
      const snap = await db.collection('staff').where('role', '==', 'admin').get()
      targetUserIds = snap.docs.map(d => d.data().user_id).filter(Boolean)
    } else if (target_type === 'all' || !target_type) {
      const snap = await db.collection('pushSubscriptions').get()
      const subs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const valid = subs.filter(s =>
        (s.token_type === 'expo' && s.fcm_token) ||
        (s.token_type === 'webpush' && s.subscription_json)
      )
      targetUserIds = [...new Set(valid.map(s => s.user_id))]
    } else if (target_type === 'opt_in' || target_type === 'opt_out') {
      const now = new Date()
      const day = now.getDay()
      if (day === 0) return res.json({ ok: true, sent: 0, message: 'No survey data available on Sunday' })
      const days = ['', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
      const dayName = days[day]
      const hour = now.getHours()
      const mealKey = hour < 15 ? 'l' : 'd'
      const statusField = `${dayName}_${mealKey}_status`
      const targetStatus = target_type === 'opt_in' ? 'opted_in' : 'opted_out'
      const snap = await db.collection('surveySubmissions').where(statusField, '==', targetStatus).get()
      if (snap.empty) return res.json({ ok: true, sent: 0, message: `No users found with ${target_type} status` })
      targetUserIds = [...new Set(snap.docs.map(d => d.data().user_id).filter(Boolean))]
    } else {
      const snap = await db.collection('pushSubscriptions').get()
      targetUserIds = [...new Set(snap.docs.map(d => d.data().user_id).filter(Boolean))]
    }

    if (targetUserIds.length === 0) {
      return res.json({ ok: true, sent: 0, message: 'No target users found' })
    }

    // 2. Fetch push subscriptions
    const subsSnap = await db.collection('pushSubscriptions').where('user_id', 'in', targetUserIds.slice(0, 30)).get()
    const pushSubs = subsSnap.docs.map(d => d.data())

    // 3. Insert notification docs for Realtime in-app toasts
    const batch = db.batch()
    for (const uid of targetUserIds) {
      const ref = db.collection('notifications').doc()
      batch.set(ref, {
        user_id: uid,
        title: title || '',
        message: body || '',
        type: type || 'info',
        url: url || null,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()

    // 4. Separate subscriptions by type
    const webPushSubs = pushSubs.filter(s => s.token_type === 'webpush' && s.subscription_json)
    const expoTokens = pushSubs.filter(s => s.token_type === 'expo').map(s => s.fcm_token).filter(Boolean)

    let sent = 0, failed = 0

    // 5a. Web Push
    if (webPushSubs.length > 0) {
      const webPushResults = await Promise.allSettled(
        webPushSubs.map(s => sendWebPush(s.subscription_json, title, body, url || '/', image_url, sender_name))
      )
      sent += webPushResults.filter(r => r.status === 'fulfilled').length
      failed += webPushResults.filter(r => r.status === 'rejected').length
      for (let i = 0; i < webPushResults.length; i++) {
        if (webPushResults[i].status === 'rejected') {
          const errMsg = webPushResults[i].reason?.message || String(webPushResults[i].reason)
          if (errMsg.includes('410') || errMsg.includes('404') || errMsg.includes('expired')) {
            const q = db.collection('pushSubscriptions').where('user_id', '==', webPushSubs[i].user_id).where('token_type', '==', 'webpush')
            const snap = await q.get()
            snap.docs.forEach(d => d.ref.delete())
          }
        }
      }
    }

    // 5b. Expo Push
    if (expoTokens.length > 0) {
      const expoResults = await Promise.allSettled(
        expoTokens.map(token => sendExpoPushMessage(token, title, body, url || '/'))
      )
      sent += expoResults.filter(r => r.status === 'fulfilled').length
      failed += expoResults.filter(r => r.status === 'rejected').length
    }

    return res.json({ ok: true, sent, failed, webpush: webPushSubs.length, expo: expoTokens.length })
  } catch (err) {
    console.error('[sendPush] Error:', err)
    return res.status(500).json({ ok: false, error: err.message })
  }
})

async function sendWebPush(subscriptionJson, title, body, url, image, sender_name) {
  const subscription = typeof subscriptionJson === 'string' ? JSON.parse(subscriptionJson) : subscriptionJson
  const payload = JSON.stringify({
    title, body, url,
    image: image || undefined,
    sender_name: sender_name || undefined,
    badge: '/al-mawaid.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: 'al-mawaid',
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

// ══════════════════════════════════════════════════════════════════════════════
// 3. processScheduled — cron function to send due scheduled broadcasts
// ══════════════════════════════════════════════════════════════════════════════
exports.processScheduled = onSchedule('every 1 minutes', async (event) => {
  const now = admin.firestore.Timestamp.now()
  const snap = await db.collection('broadcastSchedule')
    .where('status', '==', 'scheduled')
    .where('scheduled_for', '<=', now)
    .orderBy('scheduled_for', 'asc')
    .limit(20)
    .get()

  if (snap.empty) {
    console.log('[processScheduled] No due broadcasts')
    return
  }

  console.log(`[processScheduled] Found ${snap.size} due broadcast(s)`)

  for (const doc of snap.docs) {
    const entry = { id: doc.id, ...doc.data() }
    try {
      await doc.ref.update({ status: 'sending', updated_at: now })

      const fnUrl = `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/sendPush`
      const response = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: entry.title,
          body: entry.body,
          user_id: entry.target_type === 'specific' ? entry.target_user_id : null,
          target_type: entry.target_type === 'all' ? null : entry.target_type,
          url: entry.media_url || '/',
        }),
      })

      const result = await response.json()
      if (result.ok) {
        await doc.ref.update({
          status: 'sent',
          sent_at: now,
          sent_count: result.sent || 0,
          failed_count: result.failed || 0,
          updated_at: now,
        })
      } else {
        throw new Error(result.error || 'sendPush returned non-ok')
      }
    } catch (err) {
      console.error(`[processScheduled] Failed entry ${entry.id}:`, err)
      await doc.ref.update({
        status: 'failed',
        failed_count: admin.firestore.FieldValue.increment(1),
        updated_at: now,
      })
    }
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. surveyReminder — scheduled reminder for pending surveys (every 30 min)
// ══════════════════════════════════════════════════════════════════════════════
const SURVEY_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function getWeekMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  if (day === 0 || (day === 6 && d.getHours() >= 20)) diff += 7
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().split('T')[0]
}

function getCurrentMealSlot(now) {
  const h = now.getHours()
  const m = now.getMinutes()
  const totalMin = h * 60 + m
  if (totalMin < 660) return { day: now, meal: 'lunch' }      // Before 11:00 → lunch
  if (totalMin >= 720 && totalMin < 930) return { day: now, meal: 'dinner' } // 12:00-15:30 → dinner
  // After 20:00 → next day's lunch
  if (totalMin >= 1200) {
    const next = new Date(now)
    next.setDate(next.getDate() + 1)
    return { day: next, meal: 'lunch' }
  }
  return null
}

exports.surveyReminder = onSchedule('every 30 minutes', async (event) => {
  const now = new Date()
  const day = now.getDay()
  // Skip Sunday
  if (day === 0) return

  const weekId = getWeekMonday(now)
  const dayName = SURVEY_DAYS[day - 1]
  if (!dayName) return

  const mealSlot = getCurrentMealSlot(now)
  if (!mealSlot) return

  const targetDayName = SURVEY_DAYS[mealSlot.day.getDay() - 1]
  if (!targetDayName) return

  const dk = targetDayName.substring(0, 3).toLowerCase()
  const mk = mealSlot.meal === 'lunch' ? 'l' : 'd'
  const statusField = `${dk}_${mk}_status`

  try {
    // Get all users who have NOT submitted for this meal slot
    const userSnap = await db.collection('userStats')
      .where('role', '==', 'member')
      .select('user_id', 'name', 'thali_number')
      .get()

    const pendingUsers = []
    for (const doc of userSnap.docs) {
      const uid = doc.id
      const subDoc = await db.collection('surveySubmissions')
        .where('user_id', '==', uid)
        .where('week_id', '==', weekId)
        .limit(1)
        .get()

      if (!subDoc.empty) {
        const data = subDoc.docs[0].data()
        if (!data[statusField]) pendingUsers.push({ uid, name: doc.data().name || '', thali: doc.data().thali_number || '' })
      } else {
        pendingUsers.push({ uid, name: doc.data().name || '', thali: doc.data().thali_number || '' })
      }
    }

    if (pendingUsers.length === 0) {
      console.log(`[surveyReminder] No pending users for ${targetDayName} ${mealSlot.meal}`)
      return
    }

    // Send reminder push to pending users
    const batch = db.batch()
    for (const u of pendingUsers) {
      const ref = db.collection('notifications').doc()
      batch.set(ref, {
        user_id: u.uid,
        title: '📋 Survey Reminder',
        message: `Don't forget to submit your ${targetDayName} ${mealSlot.meal} survey!`,
        type: 'survey_reminder',
        url: '/',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()

    console.log(`[surveyReminder] Sent reminders to ${pendingUsers.length} user(s) for ${targetDayName} ${mealSlot.meal}`)
  } catch (err) {
    console.error('[surveyReminder] Error:', err)
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. surveyDigest — daily summary of survey stats (runs at 6PM daily)
// ══════════════════════════════════════════════════════════════════════════════
exports.surveyDigest = onSchedule('0 18 * * *', async (event) => {
  const now = new Date()
  const day = now.getDay()
  if (day === 0) return // Sunday

  const weekId = getWeekMonday(now)
  const dayName = SURVEY_DAYS[day - 1]
  if (!dayName) return

  const dk = dayName.substring(0, 3).toLowerCase()

  try {
    const subsSnap = await db.collection('surveySubmissions')
      .where('week_id', '==', weekId)
      .get()

    let lunchApplied = 0, lunchSkipped = 0, lunchPending = 0
    let dinnerApplied = 0, dinnerSkipped = 0, dinnerPending = 0

    for (const doc of subsSnap.docs) {
      const data = doc.data()
      const ls = data[`${dk}_l_status`]
      const ds = data[`${dk}_d_status`]
      if (ls === 'Applied') lunchApplied++
      else if (ls === 'Skipped') lunchSkipped++
      else lunchPending++
      if (ds === 'Applied') dinnerApplied++
      else if (ds === 'Skipped') dinnerSkipped++
      else dinnerPending++
    }

    // Send digest to admins
    const adminSnap = await db.collection('staff').where('role', '==', 'admin').get()
    const batch = db.batch()
    for (const doc of adminSnap.docs) {
      const adminUid = doc.data().user_id
      if (!adminUid) continue
      const ref = db.collection('notifications').doc()
      batch.set(ref, {
        user_id: adminUid,
        title: '📊 Survey Digest',
        message: `${dayName}: Lunch ${lunchApplied}✅ / ${lunchSkipped}❌ / ${lunchPending}⏳ | Dinner ${dinnerApplied}✅ / ${dinnerSkipped}❌ / ${dinnerPending}⏳`,
        type: 'survey_digest',
        url: '/admin/survey-tracking',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()

    console.log(`[surveyDigest] ${dayName}: Lunch=${lunchApplied}A/${lunchSkipped}S/${lunchPending}P Dinner=${dinnerApplied}A/${dinnerSkipped}S/${dinnerPending}P`)
  } catch (err) {
    console.error('[surveyDigest] Error:', err)
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// 6. surveyAutoClose — auto-close survey window on Monday at 11:30 AM
// ══════════════════════════════════════════════════════════════════════════════
exports.surveyAutoClose = onSchedule('30 11 * * 1', async (event) => {
  try {
    const settingsRef = db.collection('appSettings').doc('survey_status')
    const doc = await settingsRef.get()
    // Only auto-close if currently set to auto/open
    if (!doc.exists || doc.data()?.value === 'closed') return
    await settingsRef.set({ key: 'survey_status', value: 'closed', updated_at: admin.firestore.FieldValue.serverTimestamp() })
    console.log('[surveyAutoClose] Survey window auto-closed')
  } catch (err) {
    console.error('[surveyAutoClose] Error:', err)
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// 7. surveyAutoOpen — auto-open survey window on Saturday at 8:00 PM
// ══════════════════════════════════════════════════════════════════════════════
exports.surveyAutoOpen = onSchedule('0 20 * * 6', async (event) => {
  try {
    await db.collection('appSettings').doc('survey_status').set({
      key: 'survey_status', value: 'open', updated_at: admin.firestore.FieldValue.serverTimestamp()
    })
    console.log('[surveyAutoOpen] Survey window auto-opened')
  } catch (err) {
    console.error('[surveyAutoOpen] Error:', err)
  }
})
