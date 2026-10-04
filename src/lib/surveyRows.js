// src/lib/surveyRows.js
// Single source of truth for reading member survey responses.
// survey_day_responses (one row per day mon–sat, both lunch l_* and dinner d_*
// in the same row) is the ONLY store. No override table, no legacy flat dependency.

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

// Convert per-day rows into a flat user-row expected by readers.
// Expected shape: mon_l_status, mon_l_dish_1, …, sat_d_dish_5, plus metadata.
export function flattenDayRows(rows) {
  const byUser = {}
  for (const row of rows || []) {
    if (!row || !row.day) continue
    const rawDay = String(row.day).trim().toLowerCase()
    const normDay = rawDay.length > 3 ? rawDay.substring(0, 3) : rawDay
    if (!DAY_KEYS.includes(normDay)) continue
    const key = `${row.user_id || row.thali_number}|${row.week_id}`
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
        flat[`${normDay}_${k}`] = v
      } else {
        flat[k] = v
      }
    }
  }
  return Object.values(byUser)
}

// Convert per-day rows into a single flat row.
export function flattenDayRow(rows) {
  const list = flattenDayRows(rows)
  return list.length ? list[0] : null
}

// Load one member's flat row for a week from canonical survey_day_responses.
export async function fetchUserSurveyRow(userId, weekId) {
  if (!userId || !weekId) return { data: null, error: null }
  const cleanWeekId = String(weekId).trim().split('T')[0]
  const { data: dayData, error: dayErr } = await supabase
    .from('survey_day_responses')
    .select('*')
    .eq('user_id', userId)
    .eq('week_id', cleanWeekId)

  if (dayData && dayData.length > 0) {
    const flat = flattenDayRow(dayData)
    if (flat) return { data: flat, error: null }
  }

  return { data: null, error: dayErr || null }
}

// ── Survey response helpers (1-week cadence: Mon-Sat, 12 meals total) ──
export async function fetchUserSurveyRows(userId, weekIds) {
  const ids = Array.isArray(weekIds) ? weekIds.filter(Boolean) : [weekIds].filter(Boolean)
  if (!ids.length) return { data: {}, error: null }
  const results = await Promise.all(ids.map(wid => fetchUserSurveyRow(userId, wid)))
  const map = {}
  ids.forEach((wid, i) => { map[wid] = results[i]?.data || null })
  return { data: map, error: null }
}

// Count filled meal slots (l/d status present, max 12 per week)
export function countFilledSlotsForRows(rowOrMap, weekIds) {
  const DKS = ['mon','tue','wed','thu','fri','sat']
  let total = 0
  if (rowOrMap && typeof rowOrMap === 'object' && !Array.isArray(rowOrMap) && weekIds && Array.isArray(weekIds)) {
    for (const wid of weekIds) {
      const row = rowOrMap[wid]
      if (!row) continue
      for (const dk of DKS) for (const mk of ['l','d']) if (row[`${dk}_${mk}_status`]) total++
    }
    return Math.min(12, total)
  }
  const rows = Array.isArray(rowOrMap) ? rowOrMap : [rowOrMap]
  for (const row of rows) if (row) for (const dk of DKS) for (const mk of ['l','d']) if (row[`${dk}_${mk}_status`]) total++
  return Math.min(12, total)
}

export function isWeekComplete(flatRow) {
  if (!flatRow) return false
  const DKS = ['mon','tue','wed','thu','fri','sat']
  return DKS.every(dk => flatRow[`${dk}_l_status`] && flatRow[`${dk}_d_status`])
}

export function areAllWeeksComplete(flatMap, weekIds) {
  const ids = Array.isArray(weekIds) ? weekIds : [weekIds].filter(Boolean)
  return ids.every(wid => isWeekComplete(flatMap?.[wid]))
}

// Load the member's MOST RECENT week (latest week_id with any saved day).
export async function fetchLatestUserSurveyRow(userId) {
  const { data: weeks, error: weeksErr } = await supabase
    .from('survey_day_responses')
    .select('week_id')
    .eq('user_id', userId)
    .order('week_id', { ascending: false })
    .limit(1)

  const latest = weeks && weeks.length ? weeks[0].week_id : null
  if (latest) return fetchUserSurveyRow(userId, latest)

  try {
    const { data: flatWeeks } = await supabase
      .from('survey_submissions_flat')
      .select('week_id')
      .eq('user_id', userId)
      .order('week_id', { ascending: false })
      .limit(1)
    const flatLatest = flatWeeks && flatWeeks.length ? flatWeeks[0].week_id : null
    if (flatLatest) return fetchUserSurveyRow(userId, flatLatest)
  } catch {}

  return { data: null, error: null }
}

// Load every member's row for a week.
export async function fetchWeekRows(weekId) {
  const { data: dayData, error: dayErr } = await supabase
    .from('survey_day_responses')
    .select('*')
    .eq('week_id', weekId)

  const dayFlats = flattenDayRows(dayData || [])
  return { data: dayFlats, error: dayErr || null }
}

// Multi-week variant: loads and merges rows for several week_ids at once.
// Keeps each week isolated by week_id — admin dashboards can then show W1, W2 or combined without overlay.
export async function fetchWeekRowsMulti(weekIds) {
  const ids = Array.isArray(weekIds) ? weekIds.filter(Boolean) : [weekIds].filter(Boolean)
  if (!ids.length) return { data: [], error: null }
  if (ids.length === 1) return fetchWeekRows(ids[0])
  const results = await Promise.all(ids.map(wid => fetchWeekRows(wid)))
  // Tag rows with week_id already present; merged is concatenation (week_id disambiguates)
  const merged = results.flatMap(r => r.data || [])
  return { data: merged, error: null }
}

export async function fetchWeekRowsGrouped(weekIds) {
  const ids = Array.isArray(weekIds) ? weekIds.filter(Boolean) : [weekIds].filter(Boolean)
  const results = await Promise.all(ids.map(wid => fetchWeekRows(wid)))
  const map = {}
  ids.forEach((wid, i) => { map[wid] = results[i]?.data || [] })
  return { data: map, error: null }
}

// Admin: erase one member's lunch or dinner for a single day.
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
    const dayUpdates = { [`${mealPrefix}_status`]: null }
    for (let i = 1; i <= 5; i++) {
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
    return { data: { ok: true }, error: null }
  } catch (err) {
    console.error('[eraseSurveySlot] Direct update failed:', err)
    return { data: null, error: err }
  }
}

// Load all rows for all users (used by admin grids).
export async function fetchAllUserRows() {
  const { data: dayData, error: dayErr } = await supabase
    .from('survey_day_responses')
    .select('*')

  const dayFlats = flattenDayRows(dayData || [])
  return { data: dayFlats, error: dayErr || null }
}