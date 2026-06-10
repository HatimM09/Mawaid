// supabase/functions/process-scheduled/index.ts
// Cron-triggered Edge Function that automatically sends scheduled broadcasts
// when their scheduled_for time arrives.
//
// Called by pg_cron every minute via net.http_post()
// Deploy: npx supabase functions deploy process-scheduled

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ── CORS headers (not strictly needed for cron calls, but good practice) ──
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  // Auth check: accept service-role key or configured CRON_SECRET
  // For production, set: supabase secrets set CRON_SECRET=<random-uuid>
  // then update the cron SQL to use the same secret.
  const CRON_SECRET = Deno.env.get('CRON_SECRET')
  const authHeader = req.headers.get('Authorization') || ''
  const callerKey = authHeader.replace('Bearer ', '')
  const isAuthorized = !CRON_SECRET ||
    callerKey === CRON_SECRET ||
    callerKey === SUPABASE_SERVICE_KEY
  if (!isAuthorized) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const now = new Date().toISOString()

    // ── 1. Fetch due scheduled broadcasts ──────────────────────
    const { data: entries, error } = await supabase
      .from('broadcast_schedule')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(20)

    if (error) throw error
    if (!entries || entries.length === 0) {
      return jsonResponse({ ok: true, processed: 0, message: 'No due broadcasts' })
    }

    console.log(`[process-scheduled] Found ${entries.length} due broadcast(s) to send`)

    let processed = 0
    let failed = 0
    const results: { id: number; title: string; status: string; sent?: number }[] = []

    // ── 2. Process each due entry ──────────────────────────────
    for (const entry of entries) {
      try {
        // Mark as sending
        await supabase
          .from('broadcast_schedule')
          .update({ status: 'sending', updated_at: now })
          .eq('id', entry.id)

        // Invoke the send-push function
        const fnUrl = `${SUPABASE_URL}/functions/v1/send-push`
        const response = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
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
          await supabase
            .from('broadcast_schedule')
            .update({
              status: 'sent',
              sent_at: now,
              sent_count: result.sent || 0,
              failed_count: result.failed || 0,
              updated_at: now,
            })
            .eq('id', entry.id)

          processed++
          results.push({ id: entry.id, title: entry.title, status: 'sent', sent: result.sent })
        } else {
          throw new Error(result.error || 'send-push returned non-ok')
        }
      } catch (err) {
        console.error(`[process-scheduled] Failed entry ${entry.id}:`, err)

        await supabase
          .from('broadcast_schedule')
          .update({
            status: 'failed',
            failed_count: (entry.failed_count || 0) + 1,
            updated_at: now,
          })
          .eq('id', entry.id)

        failed++
        results.push({ id: entry.id, title: entry.title, status: 'failed' })
      }
    }

    return jsonResponse({
      ok: true,
      processed,
      failed,
      total: entries.length,
      results,
    })
  } catch (err) {
    console.error('[process-scheduled] Error:', err.message)
    return jsonResponse({ ok: false, error: err.message }, 500)
  }
})
