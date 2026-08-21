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
      if (row.updated_at && (!flat.updated_at || row.updated_at > row.updated_at)) {
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

// Convert per-day rows into a single flat row.
export function flattenDayRow(rows) {
  const list = flattenDayRows(rows)
  return list.length ? list[0] : null
}

// Load one member's flat row for a week. Reads only survey_day_responses;
// no legacy flat table fallback in the core path.
export async function fetchUserSurveyRow(userId, weekId) {
  const { data: dayData, error: dayErr } = await supabase
    .from('survey_day_responses')
    .select('*')
    .eq('user_id', userId)
    .eq('week_id', weekId)
  if (dayErr) return { data: null, error: dayErr }
  const flat = flattenDayRow(dayData)
  return { data: flat || null, error: null }
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
  return { data: null, error: null }
}

// Load every member's row for a week (or all weeks when omitted).
// Live day rows only — no legacy flat table fallback.
export async function fetchWeekRows(weekId) {
  const { data, error } = await supabase
    .from('survey_day_responses')
    .select('*')
    .eq('week_id', weekId)
  if (error) return { data: null, error }
  return { data: flattenDayRows(data), error: null }
}

// Admin: erase one member's lunch or dinner for a single day.
// Only clears survey_day_responses — no legacy flat mirror update needed.
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

  // Direct Supabase fallback — only survey_day_responses
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
  const { data, error } = await supabase
    .from('survey_day_responses')
    .select('*')
  if (error) return { data: null, error }
  return { data: flattenDayRows(data), error: null }
}