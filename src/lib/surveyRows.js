// src/lib/surveyRows.js
// Single source of truth for reading member survey responses.
//
// survey_day_responses (one row per day mon–sat, both lunch l_* and dinner d_*
// in the same row) is the ONLY store member writes touch. survey_submissions_flat
// is a legacy/read-only fallback so historical weeks keep displaying.
import { supabase } from './firebaseClient'
import { DAY_KEYS } from '../common/utils'

const META = new Set([
  'id', 'user_id', 'week_id', 'day',
  'thali_number', 'email', 'dish_snapshot', 'edit_metadata',
  'submitted_at', 'created_at', 'updated_at',
])

function parseMetaJson(val) {
  if (!val) return {}
  if (typeof val === 'object') return { ...val }
  try { return JSON.parse(val) } catch { return {} }
}

// Merge per-day rows into the flat "one row per user per week" shape every
// reader (member My Surveys, admin tracking, dashboards) already expects:
//   mon_l_status, mon_l_dish_1, …, sat_d_dish_14, plus the metadata fields.
export function flattenDayRows(rows) {
  const byUser = {}
  for (const row of rows || []) {
    if (!row || !row.day || !DAY_KEYS.includes(row.day)) continue
    const key = `${row.user_id}|${row.week_id}`
    let flat = byUser[key]
    if (!flat) {
      flat = byUser[key] = {
        user_id: row.user_id,
        week_id: row.week_id,
        thali_number: row.thali_number,
        email: row.email,
        dish_snapshot: parseMetaJson(row.dish_snapshot),
        edit_metadata: parseMetaJson(row.edit_metadata),
        submitted_at: row.submitted_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    } else {
      // Merge snapshots & metadata across all days so no slot's dish names or edits are lost
      if (row.dish_snapshot) {
        flat.dish_snapshot = { ...flat.dish_snapshot, ...parseMetaJson(row.dish_snapshot) }
      }
      if (row.edit_metadata) {
        flat.edit_metadata = { ...flat.edit_metadata, ...parseMetaJson(row.edit_metadata) }
      }
      if (row.thali_number && !flat.thali_number) flat.thali_number = row.thali_number
      if (row.email && !flat.email) flat.email = row.email
      if (row.submitted_at && (!flat.submitted_at || row.submitted_at > flat.submitted_at)) {
        flat.submitted_at = row.submitted_at
      }
      if (row.updated_at && (!flat.updated_at || row.updated_at > flat.updated_at)) {
        flat.updated_at = row.updated_at
      }
      if (row.created_at && (!flat.created_at || row.created_at < flat.created_at)) {
        flat.created_at = row.created_at
      }
    }
    for (const [k, v] of Object.entries(row)) {
      if (META.has(k)) continue
      if (k === 'l_status' || k === 'd_status' || /^[ld]_dish_\d+$/.test(k)) {
        flat[`${row.day}_${k}`] = v
      } else {
        flat[k] = v
      }
    }
  }
  return Object.values(byUser)
}

// Union of the live per-day rows with legacy flat rows. Used for week-scoped
// admin reads where a week can mix members on both formats.
async function loadMerged(weekId = null) {
  const dayQuery = supabase.from('survey_day_responses').select('*')
  const flatQuery = supabase.from('survey_submissions_flat').select('*')
  if (weekId) {
    dayQuery.eq('week_id', weekId)
    flatQuery.eq('week_id', weekId)
  }
  const [{ data: dayData, error: dayErr }, { data: flatData }] = await Promise.all([dayQuery, flatQuery])
  if (dayErr) return { data: null, error: dayErr }
  const dayRows = flattenDayRows(dayData)
  const seen = new Set(dayRows.map(r => `${r.user_id}|${r.week_id}`))
  const legacy = (flatData || []).filter(r => r.user_id && !seen.has(`${r.user_id}|${r.week_id}`))
  return { data: [...dayRows, ...legacy], error: null }
}

// Load one member's merged row for a week: live day rows, fall back to the
// legacy flat mirror only when the member has no day rows that week.
export async function fetchUserSurveyRow(userId, weekId) {
  const { data: dayData, error: dayErr } = await supabase
    .from('survey_day_responses')
    .select('*')
    .eq('user_id', userId)
    .eq('week_id', weekId)
  if (dayErr) return { data: null, error: dayErr }
  const flat = flattenDayRow(dayData)
  if (flat) return { data: flat, error: null }
  const { data: flatData, error: flatErr } = await supabase
    .from('survey_submissions_flat')
    .select('*')
    .eq('user_id', userId)
    .eq('week_id', weekId)
    .maybeSingle()
  if (flatErr) return { data: null, error: flatErr }
  return { data: flatData || null, error: null }
}

export function flattenDayRow(rows) {
  const list = flattenDayRows(rows)
  return list.length ? list[0] : null
}

// Load the member's MOST RECENT week (latest week_id with any saved day).
export async function fetchLatestUserSurveyRow(userId) {
  const { data: weeks, error: weeksErr } = await supabase
    .from('survey_day_responses')
    .select('week_id')
    .eq('user_id', userId)
    .order('week_id', { ascending: false })
    .limit(1)
  if (weeksErr) return { data: null, error: weeksErr }
  const latest = weeks && weeks.length ? weeks[0].week_id : null
  if (latest) return fetchUserSurveyRow(userId, latest)
  const { data: flatData, error: flatErr } = await supabase
    .from('survey_submissions_flat')
    .select('*')
    .eq('user_id', userId)
    .order('week_id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (flatErr) return { data: null, error: flatErr }
  return { data: flatData || null, error: null }
}

// Load every member's merged row for a week (or all weeks when omitted) —
// admin tracking/dashboards. Live day rows win, legacy flat is the fallback.
export function fetchWeekRows(weekId) {
  return loadMerged(weekId)
}

export function fetchAllUserRows() {
  return loadMerged()
}

// Admin: erase one member's lunch or dinner for a single day. Backed by the
// erase_survey_slot RPC (migration 039) which clears survey_day_responses and
// the flat mirror in one transaction and writes an audit log row, with direct Supabase fallback.
export async function eraseSurveySlot(userId, weekId, day, meal) {
  const dayKey = (day || '').substring(0, 3).toLowerCase()
  try {
    const { data, error } = await supabase.rpc('erase_survey_slot', {
      p_user_id: userId,
      p_week_id: weekId,
      p_day: dayKey,
      p_meal: meal,
    })
    if (!error) return { data, error: null }
    console.warn('[eraseSurveySlot] RPC failed, using direct Supabase fallback:', error)
  } catch (e) {
    console.warn('[eraseSurveySlot] RPC exception, falling back to direct update:', e)
  }

  // Direct Supabase fallback
  try {
    const mealPrefix = meal === 'dinner' ? 'd' : 'l'
    
    // Clear meal columns in survey_day_responses
    const dayUpdates = { [`${mealPrefix}_status`]: null }
    for (let i = 1; i <= 14; i++) {
      dayUpdates[`${mealPrefix}_dish_${i}`] = null
    }
    dayUpdates.updated_at = new Date().toISOString()
    
    const { error: dayErr } = await supabase
      .from('survey_day_responses')
      .update(dayUpdates)
      .eq('user_id', userId)
      .eq('week_id', weekId)
      .eq('day', dayKey)

    if (dayErr) throw dayErr

    // Also clear in survey_submissions_flat for legacy mirror
    const flatUpdates = { [`${dayKey}_${mealPrefix}_status`]: null }
    for (let i = 1; i <= 14; i++) {
      flatUpdates[`${dayKey}_${mealPrefix}_dish_${i}`] = null
    }
    flatUpdates.updated_at = new Date().toISOString()
    await supabase
      .from('survey_submissions_flat')
      .update(flatUpdates)
      .eq('user_id', userId)
      .eq('week_id', weekId)

    return { data: { ok: true }, error: null }
  } catch (err) {
    console.error('[eraseSurveySlot] Direct update failed:', err)
    return { data: null, error: err }
  }
}