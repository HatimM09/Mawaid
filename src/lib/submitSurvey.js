// src/lib/submitSurvey.js
// Single audited write path for member survey responses.
import { supabase } from './firebaseClient'

const NOT_DEPLOYED_RE = /Function not found|404|fetching failed/i

/**
 * Upsert one survey_submissions_flat row for the signed-in member.
 * @param {object} payload - the partial row (user_id, week_id, slot statuses,
 *   dish values, dish_snapshot, edit_metadata, …)
 * @returns {Promise<{data: any, error: any}>}
 */
export async function submitSurveyRow(payload) {
  if (!payload || typeof payload !== 'object') {
    return { data: null, error: new Error('Invalid survey payload.') }
  }

  const { data, error } = await supabase.functions.invoke('submit-survey', { body: payload })

  if (!error && data?.ok) return { data, error: null }
  if (!error && data?.ok === false) {
    return { data: null, error: new Error(data.error || 'Survey save rejected by server.') }
  }

  const msg = String(error?.message || '')
  if (error && !NOT_DEPLOYED_RE.test(msg)) {
    console.error('[submitSurvey] Server rejected survey save:', error)
    return { data: null, error }
  }
  if (error) {
    console.warn('[submitSurvey] Edge function unavailable, falling back to direct upsert:', msg)
  }

  const { data: upData, error: upErr } = await supabase
    .from('survey_submissions_flat')
    .upsert([payload], { onConflict: 'user_id,week_id' })
  if (upErr) {
    console.error('[submitSurvey] Direct upsert failed:', upErr)
    return { data: null, error: upErr }
  }
  return { data: upData, error: null }
}
