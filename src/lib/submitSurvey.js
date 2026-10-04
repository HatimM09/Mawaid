// src/lib/submitSurvey.js
// Single audited write path for member survey responses into survey_day_responses.
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

const normalizeStatus = (s) => {
  if (s === null || s === undefined) return null
  const str = String(s).trim()
  const lower = str.toLowerCase()
  if (lower === 'applied' || lower === 'opted_in' || lower === 'yes' || lower === 'true') return 'Applied'
  if (lower === 'skipped' || lower === 'opted_out' || lower === 'no' || lower === 'false') return 'Skipped'
  if (str === 'Applied' || str === 'Skipped' || str === 'opted_in' || str === 'opted_out') return str
  return null
}

const sanitizeDishValue = (val) => {
  if (val === null || val === undefined) return null
  if (typeof val === 'object') {
    if (val.status === 'no' || val.status === 'Skipped' || val.status === 'skipped') return 'No'
    if (val.value !== undefined && val.value !== null) return String(val.value)
    return JSON.stringify(val)
  }
  const s = String(val).trim()
  return s === '' ? null : s
}

/**
 * Upsert one or more survey_day_responses rows for the member.
 * survey_day_responses is the single source of truth for all survey responses.
 * @param {object} payload - the partial row (user_id, week_id, day, slot
 *   statuses, dish values, dish_snapshot, edit_metadata, submitted_at, …)
 * @returns {Promise<{data: any, error: any}>}
 */
export async function submitSurveyRow(payload) {
  if (!payload || typeof payload !== 'object') {
    console.error('[submitSurvey] Received invalid payload:', payload)
    return { data: null, error: new Error('Invalid survey payload.') }
  }

  let userId = payload.user_id || payload.userId || payload.id
  if (!userId) {
    try {
      const { data: authData } = await supabase.auth.getUser()
      userId = authData?.user?.id
    } catch {}
  }
  if (!userId) {
    try {
      const { data: sessData } = await supabase.auth.getSession()
      userId = sessData?.session?.user?.id
    } catch {}
  }

  let thaliNo = payload.thali_number || payload.thaliNumber
  let userEmail = payload.email

  // If user_id is still missing but we have email or thali_number, resolve from user_stats
  if (!userId && (thaliNo || userEmail)) {
    try {
      let query = supabase.from('user_stats').select('user_id, thali_number, email')
      if (thaliNo) query = query.eq('thali_number', String(thaliNo).replace(/^#/, ''))
      else if (userEmail) query = query.eq('email', userEmail)
      const { data: u } = await query.maybeSingle()
      if (u?.user_id) {
        userId = u.user_id
        if (!thaliNo && u.thali_number) thaliNo = u.thali_number
        if (!userEmail && u.email) userEmail = u.email
      }
    } catch {}
  }

  if (!userId) {
    return { data: null, error: new Error('User not authenticated. Please refresh and sign in.') }
  }

  let weekId = payload.week_id || payload.weekId
  if (!weekId) {
    try { weekId = getSurveyTargetWeek() } catch {}
  }
  if (weekId) {
    weekId = String(weekId).trim().split('T')[0]
  }

  if (!thaliNo || !userEmail) {
    try {
      const { data: u } = await supabase.from('user_stats').select('thali_number, email').eq('user_id', userId).maybeSingle()
      if (u) {
        if (!thaliNo && u.thali_number) thaliNo = u.thali_number
        if (!userEmail && u.email) userEmail = u.email
      }
    } catch {}
  }

  const cleanThali = thaliNo ? String(thaliNo).replace(/^#/, '').trim() : null
  const thaliLabel = cleanThali ? `Thali ${cleanThali}` : 'A member'

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

  const ALLOWED_COLUMNS = new Set([
    'user_id', 'week_id', 'day', 'thali_number', 'email',
    'l_status', 'l_dish_1', 'l_dish_2', 'l_dish_3', 'l_dish_4', 'l_dish_5',
    'd_status', 'd_dish_1', 'd_dish_2', 'd_dish_3', 'd_dish_4', 'd_dish_5',
    'dish_snapshot', 'edit_metadata', 'submitted_at', 'updated_at'
  ])

  const dayRows = targetDays.map(day => {
    const rawRow = { user_id: userId, week_id: weekId, day }
    for (const k of Object.keys(payload)) {
      if (k.startsWith(day + '_')) {
        rawRow[k.slice(day.length + 1)] = payload[k]
      }
    }
    // Also support direct meal + status / dishValues format
    if (payload.meal && (payload.meal === 'lunch' || payload.meal === 'dinner')) {
      const mk = payload.meal === 'lunch' ? 'l' : 'd'
      if (payload.status) rawRow[`${mk}_status`] = payload.status
      if (payload.dishValues && typeof payload.dishValues === 'object') {
        for (const [dk, dv] of Object.entries(payload.dishValues)) {
          rawRow[`${mk}_${dk}`] = dv
        }
      }
    }

    if (rawRow.l_status !== undefined) rawRow.l_status = normalizeStatus(rawRow.l_status)
    if (rawRow.d_status !== undefined) rawRow.d_status = normalizeStatus(rawRow.d_status)

    // Sanitize all dish fields into valid strings or null
    for (let i = 1; i <= 5; i++) {
      if (rawRow[`l_dish_${i}`] !== undefined) {
        rawRow[`l_dish_${i}`] = sanitizeDishValue(rawRow[`l_dish_${i}`])
      }
      if (rawRow[`d_dish_${i}`] !== undefined) {
        rawRow[`d_dish_${i}`] = sanitizeDishValue(rawRow[`d_dish_${i}`])
      }
    }

    // If a meal is explicitly Skipped, safely clear dish columns so stale values do not persist
    if (rawRow.l_status === 'Skipped') {
      for (let i = 1; i <= 5; i++) rawRow[`l_dish_${i}`] = null
    }
    if (rawRow.d_status === 'Skipped') {
      for (let i = 1; i <= 5; i++) rawRow[`d_dish_${i}`] = null
    }

    const dishSnapshot = payload.dish_snapshot || payload.dishSnapshot
    const editMetadata = payload.edit_metadata || payload.editMetadata
    const updatedAt = payload.updated_at || payload.updatedAt || new Date().toISOString()
    const submittedAt = payload.submitted_at || payload.submittedAt

    if (cleanThali !== undefined && cleanThali !== null) rawRow.thali_number = cleanThali
    if (userEmail !== undefined) rawRow.email = userEmail
    if (dishSnapshot !== undefined) rawRow.dish_snapshot = dishSnapshot
    if (editMetadata !== undefined) rawRow.edit_metadata = editMetadata
    if (updatedAt !== undefined) rawRow.updated_at = updatedAt
    if (submittedAt !== undefined) rawRow.submitted_at = submittedAt

    // Sanitize: ONLY include columns that actually exist in survey_day_responses
    const dayRow = {}
    for (const [k, v] of Object.entries(rawRow)) {
      if (ALLOWED_COLUMNS.has(k) && v !== undefined) {
        dayRow[k] = v
      }
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
 * Supports single weekId or array of weekIds for 2-week cadence.
 * @param {string} userId
 * @param {string|string[]} weekId
 */
export async function beginSurvey(userId, weekId) {
  if (!userId || !weekId) return
  const weekIds = Array.isArray(weekId) ? weekId.filter(Boolean) : [weekId]
  if (!weekIds.length) return
  try {
    const cleanIds = weekIds.map(w => String(w).trim().split('T')[0])
    const seedRows = cleanIds.flatMap(wid => DAY_KEYS.map(day => ({ user_id: userId, week_id: wid, day })))
    const { error: seedErr } = await supabase
      .from('survey_day_responses')
      .upsert(seedRows, { onConflict: 'user_id,week_id,day', ignoreDuplicates: true })
    if (seedErr) console.warn('[submitSurvey] beginSurvey seed failed:', seedErr)
  } catch (e) {
    console.warn('[submitSurvey] beginSurvey failed:', e)
  }
}

// Batch helper: save multiple day payloads in sequence or single batch
export async function submitSurveyRows(payloads) {
  if (!Array.isArray(payloads) || !payloads.length) return { data: null, error: null }
  const results = []
  for (const p of payloads) {
    const r = await submitSurveyRow(p)
    results.push(r)
    if (r.error) return r
  }
  return { data: results.flatMap(r => r.data || []), error: null }
}

export const submitSurvey = submitSurveyRow
export default submitSurveyRow

