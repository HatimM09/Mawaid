// src/lib/submitSurvey.js
// Single audited write path for member survey responses.
import { supabase } from './firebaseClient'
import { DAY_KEYS } from '../common/utils'

// Best-effort admin alert: a failed save must never be invisible.
async function notifyAdmins(message) {
  try {
    await supabase.functions.invoke('send-push', {
      body: {
        title: 'Al-Mawaid · Survey sync error',
        body: message,
        url: '/admin/survey-tracking',
        target_type: 'admins',
      }
    })
  } catch (e) {
    console.warn('[submitSurvey] Admin alert push failed:', e?.message || e)
  }
}

// Best-effort write-log entry from the client. RLS lets a member append only
// rows for their own user_id.
async function logClientWrite({ user_id, week_id, day, action = 'submit', payload, status, error }) {
  try {
    await supabase.from('survey_write_log').insert({
      user_id: user_id || null,
      week_id: week_id || null,
      day: day || null,
      action,
      payload: payload ?? {},
      status,
      error: error || null,
    })
  } catch (e) {
    console.warn('[submitSurvey] Client write-log entry failed:', e?.message || e)
  }
}

/**
 * Upsert one survey_day_responses row for the signed-in member.
 * @param {object} payload - the partial row (user_id, week_id, day, slot
 *   statuses, dish values, dish_snapshot, edit_metadata, …)
 * @returns {Promise<{data: any, error: any}>}
 */
export async function submitSurveyRow(payload) {
  if (!payload || typeof payload !== 'object') {
    return { data: null, error: new Error('Invalid survey payload.') }
  }

  // EVERY survey save goes to survey_day_responses (one row per day, both
  // lunch l_* and dinner d_* in the same row). survey_submissions_flat is
  // legacy — historical data only. survey_overrides no longer exists.
  return upsertDirect(payload)
}

// Single write path: upsert the TARGETED day rows in survey_day_responses.
// The payload carries day-scoped keys (mon_l_status, mon_l_dish_1, …) which
// are stored day-local (l_status, l_dish_1, …) on the matching day row.
async function upsertDirect(payload) {
  const userId = payload.user_id
  const weekId = payload.week_id
  const thaliLabel = typeof payload.thali_number === 'string' && payload.thali_number
    ? `Thali ${payload.thali_number}`
    : 'A member'

  // Identify all days represented in this payload
  let targetDays = []
  if (payload.day && DAY_KEYS.includes(payload.day)) {
    targetDays = [payload.day]
  } else {
    targetDays = DAY_KEYS.filter(d => Object.keys(payload).some(k => k.startsWith(d + '_')))
  }

  if (targetDays.length === 0) {
    const err = new Error('Cannot determine the survey day for this save.')
    logClientWrite({ user_id: userId, week_id: weekId, day: null, action: 'submit', payload, status: 'error', error: err.message })
    return { data: null, error: err }
  }

  const dayRows = targetDays.map(day => {
    const dayRow = { user_id: userId, week_id: weekId, day }
    for (const k of Object.keys(payload)) {
      if (k.startsWith(day + '_')) dayRow[k.slice(day.length + 1)] = payload[k]
    }
    for (const f of ['thali_number', 'email', 'dish_snapshot', 'edit_metadata', 'submitted_at', 'updated_at']) {
      if (payload[f] !== undefined) dayRow[f] = payload[f]
    }
    return dayRow
  })

  const { data, error } = await supabase
    .from('survey_day_responses')
    .upsert(dayRows, { onConflict: 'user_id,week_id,day' })
  if (error) {
    console.error('[submitSurvey] Day upsert failed:', error)
    for (const day of targetDays) {
      logClientWrite({ user_id: userId, week_id: weekId, day, action: 'submit', payload, status: 'error', error: error.message })
    }
    notifyAdmins(`${thaliLabel}: survey save failed — ${error.message}`)
    return { data: null, error }
  }
  for (const day of targetDays) {
    logClientWrite({ user_id: userId, week_id: weekId, day, action: 'submit', payload, status: 'success' })
  }
  return { data, error: null }
}

/**
 * Create the week's six per-day rows the moment the survey is started
 * (clicking the survey button). Idempotent — safe to call repeatedly.
 * @param {string} userId
 * @param {string} weekId
 */
export async function beginSurvey(userId, weekId) {
  if (!userId || !weekId) return
  try {
    // Seed per-day rows in survey_day_responses (used by admin tracker).
    // NOTE: `.upsert()` — `.insert()` ignores onConflict/ignoreDuplicates and
    // 409s on any already-existing day row.
    const { error: seedErr } = await supabase
      .from('survey_day_responses')
      .upsert(DAY_KEYS.map(day => ({ user_id: userId, week_id: weekId, day })),
        { onConflict: 'user_id,week_id,day', ignoreDuplicates: true })
    if (seedErr) console.warn('[submitSurvey] beginSurvey seed failed:', seedErr)
  } catch (e) {
    console.warn('[submitSurvey] beginSurvey failed:', e)
  }
}
