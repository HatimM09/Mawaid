// src/lib/submitSurvey.js
// Single audited write path for member survey responses.
import { supabase } from './firebaseClient'
import { DAY_KEYS, getSurveyTargetWeek } from '../common/utils'

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
 * The payload carries day-scoped keys (mon_l_status, mon_l_dish_1, …) which
 * are stored day-local (l_status, l_dish_1, …) on the matching day row.
 * survey_submissions_flat is no longer written — survey_day_responses is the
 * single source of truth for live sync.
 * @param {object} payload - the partial row (user_id, week_id, day, slot
 *   statuses, dish values, dish_snapshot, edit_metadata, …)
 * @returns {Promise<{data: any, error: any}>}
 */
export async function submitSurveyRow(payload) {
  if (!payload || typeof payload !== 'object') {
    console.error('[submitSurvey] Received invalid payload:', payload)
    return { data: null, error: new Error('Invalid survey payload.') }
  }

  let userId = payload.user_id || payload.userId
  if (!userId) {
    try {
      const { data: authData } = await supabase.auth.getUser()
      userId = authData?.user?.id
    } catch {}
  }
  if (!userId) {
    return { data: null, error: new Error('User not authenticated. Please refresh and sign in.') }
  }

  let weekId = payload.week_id || payload.weekId
  if (!weekId) {
    try { weekId = getSurveyTargetWeek() } catch {}
  }

  const thaliLabel = typeof (payload.thali_number || payload.thaliNumber) === 'string' && (payload.thali_number || payload.thaliNumber)
    ? `Thali ${payload.thali_number || payload.thaliNumber}`
    : 'A member'

  // Identify all days represented in this payload
  let targetDays = []
  const rawDay = (payload.day || '').trim().toLowerCase()
  const dayKey = rawDay.length > 3 ? rawDay.substring(0, 3) : rawDay
  if (dayKey && DAY_KEYS.includes(dayKey)) {
    targetDays = [dayKey]
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
      if (k.startsWith(day + '_')) {
        dayRow[k.slice(day.length + 1)] = payload[k]
      }
    }
    // Also support direct meal + status / dishValues format
    if (payload.meal && (payload.meal === 'lunch' || payload.meal === 'dinner')) {
      const mk = payload.meal === 'lunch' ? 'l' : 'd'
      if (payload.status) dayRow[`${mk}_status`] = payload.status
      if (payload.dishValues && typeof payload.dishValues === 'object') {
        for (const [dk, dv] of Object.entries(payload.dishValues)) {
          dayRow[`${mk}_${dk}`] = dv
        }
      }
    }
    const thaliNo = payload.thali_number || payload.thaliNumber
    const email = payload.email
    const dishSnapshot = payload.dish_snapshot || payload.dishSnapshot
    const editMetadata = payload.edit_metadata || payload.editMetadata
    const updatedAt = payload.updated_at || payload.updatedAt || new Date().toISOString()
    const submittedAt = payload.submitted_at || payload.submittedAt

    if (thaliNo !== undefined) dayRow.thali_number = thaliNo
    if (email !== undefined) dayRow.email = email
    if (dishSnapshot !== undefined) dayRow.dish_snapshot = dishSnapshot
    if (editMetadata !== undefined) dayRow.edit_metadata = editMetadata
    if (updatedAt !== undefined) dayRow.updated_at = updatedAt
    if (submittedAt !== undefined) dayRow.submitted_at = submittedAt

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
    // Idempotent upsert with ignoreDuplicates.
    const { error: seedErr } = await supabase
      .from('survey_day_responses')
      .upsert(DAY_KEYS.map(day => ({ user_id: userId, week_id: weekId, day })),
        { onConflict: 'user_id,week_id,day', ignoreDuplicates: true })
    if (seedErr) console.warn('[submitSurvey] beginSurvey seed failed:', seedErr)
  } catch (e) {
    console.warn('[submitSurvey] beginSurvey failed:', e)
  }
}
