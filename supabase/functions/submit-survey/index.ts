// Supabase Edge Function: submit-survey
// Single audited write path for MEMBER survey responses.
//
// The member app used to upsert survey_submissions_flat directly from the
// client. Any RLS/config problem failed SILENTLY (the client swallowed the
// error into a toast), so responses could vanish with no trace. This function:
//   1. Authenticates the caller (JWT verified by the gateway — verify_jwt).
//   2. Validates the payload server-side (week, statuses, dish answers).
//   3. Writes via the service role (single audited path, bypasses client RLS).
//   4. Logs every call to survey_write_log so failures are visible to admins.
//   5. Sets submitted_at when a write covers all 12 weekly slots.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pquusffhuholbnlmuyen.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MEALS = ['l', 'd']
const STATUS_VALUES = ['Applied', 'Skipped', 'opted_in', 'opted_out']
const DISH_VALUE_RE = /^(Yes|No|yes|no|\d+%?)$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Decode the verified JWT payload (the gateway already verified the signature
// because verify_jwt = true) and return the auth user id (`sub`).
function getJwtSub(req: Request): string | null {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = JSON.parse(atob(padded))
    return typeof json.sub === 'string' ? json.sub : null
  } catch {
    return null
  }
}

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

function json(status: number, body: unknown, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers })
}

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { status: 204, headers })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const logWrite = async (entry: {
    user_id?: string | null, week_id?: string | null, action: string,
    payload: unknown, status: string, error?: string
  }) => {
    try {
      await supabase.from('survey_write_log').insert({
        user_id: entry.user_id || null,
        week_id: entry.week_id || null,
        action: entry.action,
        payload: entry.payload,
        status: entry.status,
        error: entry.error || null,
      })
    } catch (logErr: any) {
      console.error('[submit-survey] Failed to write log:', logErr?.message || logErr)
    }
  }

  try {
    const authUid = getJwtSub(req)
    if (!authUid) {
      return json(401, { ok: false, error: 'Unauthorized: no valid session.' }, headers)
    }

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return json(400, { ok: false, error: 'Invalid JSON body.' }, headers)
    }

    const weekId = body?.week_id
    const userId = body?.user_id
    const fail = async (message: string) => {
      await logWrite({ user_id: userId, week_id: weekId, action: 'submit', payload: body, status: 'error', error: message })
      return json(400, { ok: false, error: message }, headers)
    }

    // ── 1. Authentication: user_id must match the JWT (admins may write for others) ──
    if (!userId || !UUID_RE.test(String(userId))) {
      return await fail('Invalid user_id.')
    }
    if (String(userId) !== authUid) {
      const [{ data: staffRow }, { data: statsRow }] = await Promise.all([
        supabase.from('staff').select('role').eq('user_id', authUid).eq('role', 'admin').maybeSingle(),
        supabase.from('user_stats').select('role').eq('user_id', authUid).eq('role', 'admin').maybeSingle(),
      ])
      if (!staffRow && !statsRow) {
        return await fail('Forbidden: user_id does not match the session.')
      }
    }

    // ── 2. week_id must be a real date ──
    if (!weekId || typeof weekId !== 'string' || !isValidDate(weekId)) {
      return await fail('Invalid week_id (expected YYYY-MM-DD).')
    }

    // ── 3. Optional string fields ──
    // null/'' are allowed: some members have no email or thali number yet, and
    // older clients may send null — rejecting those would silently drop their
    // entire survey. Only a present non-string, non-null value is invalid.
    if (body.thali_number !== undefined && body.thali_number !== null && typeof body.thali_number !== 'string') {
      return await fail('Invalid thali_number.')
    }
    if (body.email !== undefined && body.email !== null && typeof body.email !== 'string') {
      return await fail('Invalid email.')
    }
    if (body.dish_snapshot !== undefined && (typeof body.dish_snapshot !== 'object' || body.dish_snapshot === null)) {
      return await fail('Invalid dish_snapshot.')
    }
    if (body.edit_metadata !== undefined && (typeof body.edit_metadata !== 'object' || body.edit_metadata === null)) {
      return await fail('Invalid edit_metadata.')
    }

    // ── 4. Validate every slot present in the payload ──
    const snapshot = body.dish_snapshot || {}
    let slotCount = 0
    for (const day of DAYS) {
      for (const meal of MEALS) {
        const statusKey = `${day}_${meal}_status`
        const status = body[statusKey]
        if (status === undefined) continue
        slotCount++
        if (!STATUS_VALUES.includes(status)) {
          return await fail(`Invalid status "${status}" for ${statusKey}.`)
        }
        if (status !== 'Applied') continue

        // An Applied slot must have an answer for every dish it saved against
        // in the snapshot (the client always sends both together). Dish values
        // are stored as TEXT, but clients may send integers for count dishes
        // (DailyEditCard writes `2`, others write `'2'`) — accept both.
        const slotDishes: unknown[] = Array.isArray(snapshot[`${day}_${meal}`]) ? snapshot[`${day}_${meal}`] : []
        if (slotDishes.length > 14) {
          return await fail(`Slot ${statusKey} has ${slotDishes.length} dishes — maximum supported is 14.`)
        }
        for (let i = 1; i <= slotDishes.length; i++) {
          const col = `${day}_${meal}_dish_${i}`
          const val = body[col]
          if (val === undefined || val === null || val === '') {
            return await fail(`Slot ${statusKey} is Applied but ${col} is missing an answer.`)
          }
          if (typeof val === 'number' ? !Number.isInteger(val) : (typeof val !== 'string' || !DISH_VALUE_RE.test(val))) {
            return await fail(`Invalid dish value "${String(val)}" in ${col}.`)
          }
        }
        // If no snapshot was saved for the slot, still sanity-check any dish
        // values that were included.
        for (let i = 1; i <= 14; i++) {
          const col = `${day}_${meal}_dish_${i}`
          const val = body[col]
          if (val === undefined || val === null || val === '') continue
          if (typeof val === 'number' ? !Number.isInteger(val) : (typeof val !== 'string' || !DISH_VALUE_RE.test(val))) {
            return await fail(`Invalid dish value "${String(val)}" in ${col}.`)
          }
        }
      }
    }
    // Zero-status payloads are allowed: they are draft saves (dish answers
    // without a status) written by the daily modal's debounced auto-save.

    // ── 5. Write via service role (single audited path) ──
    const updateObj: Record<string, unknown> = {
      user_id: userId,
      week_id: weekId,
      updated_at: new Date().toISOString(),
    }
    // Only write real values — never clobber existing data with null/''.
    if (typeof body.thali_number === 'string' && body.thali_number !== '') updateObj.thali_number = body.thali_number
    if (typeof body.email === 'string' && body.email !== '') updateObj.email = body.email
    if (body.dish_snapshot !== undefined) updateObj.dish_snapshot = body.dish_snapshot
    if (body.edit_metadata !== undefined) updateObj.edit_metadata = body.edit_metadata
    for (const day of DAYS) {
      for (const meal of MEALS) {
        const statusKey = `${day}_${meal}_status`
        if (body[statusKey] !== undefined) updateObj[statusKey] = body[statusKey]
        for (let i = 1; i <= 14; i++) {
          const col = `${day}_${meal}_dish_${i}`
          if (body[col] !== undefined) updateObj[col] = body[col]
        }
      }
    }
    // A write covering all 12 slots = full weekly submission.
    if (slotCount === 12) updateObj.submitted_at = new Date().toISOString()

    const { error: upsertErr } = await supabase
      .from('survey_submissions_flat')
      .upsert([updateObj], { onConflict: 'user_id,week_id' })
    if (upsertErr) throw upsertErr

    await logWrite({ user_id: userId, week_id: weekId, action: slotCount === 0 ? 'draft' : 'submit', payload: body, status: 'success' })
    return json(200, { ok: true, data: { week_id: weekId, slots: slotCount } }, headers)
  } catch (err: any) {
    console.error('[submit-survey]', err?.message || err)
    return json(500, { ok: false, error: err?.message || 'Internal error.' }, headers)
  }
})
