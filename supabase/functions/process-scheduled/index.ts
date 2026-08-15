// Supabase Edge Function: Process Scheduled Broadcasts & Menu Publish
// Called by external cron service every minute
// Handles: broadcast delivery + menu publish notifications

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pquusffhuholbnlmuyen.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

function getWeekMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().split('T')[0]
}

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const now = new Date().toISOString()
    let totalProcessed = 0

    // ── 1. Process scheduled broadcasts ──
    // Atomic lock: update scheduled→processing so crashed runs don't get stuck
    const { data: dueBroadcasts, error: bcErr } = await supabase
      .from('broadcast_schedule')
      .update({ status: 'processing' })
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .select('*')
      .order('scheduled_for', { ascending: true })
      .limit(20)

    if (bcErr) throw bcErr

    if (dueBroadcasts?.length) {
      for (const broadcast of dueBroadcasts) {
        try {
          let targets: string[] = []
          // Real push delivery counters — scoped at the loop body so both the
          // push block and the final status update can read them.
          let pushSent = 0
          let pushFailed = 0
          if (broadcast.target_type === 'specific' && broadcast.target_user_id) {
            targets = [broadcast.target_user_id]
          } else if (broadcast.target_type === 'admins') {
            const { data: admins } = await supabase.from('user_stats').select('user_id').eq('role', 'admin')
            targets = admins?.map((a: any) => a.user_id) || []
          } else if (broadcast.target_type === 'opt_in' || broadcast.target_type === 'opt_out') {
            const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
            const dayNum = new Date().getDay()
            const h = new Date().getHours()
            if (dayNum !== 0) {
              const today = dayMap[dayNum]
              const mealName = h < 15 ? 'lunch' : 'dinner'
              const dayKey = today.substring(0, 3).toLowerCase()
              const mealKey = mealName === 'lunch' ? 'l' : 'd'
              const statusField = `${dayKey}_${mealKey}_status`
              const weekId = getWeekMonday(new Date())
              const { data: subs } = await supabase
                .from('survey_submissions_flat')
                .select('user_id, ' + statusField)
                .eq('week_id', weekId)
              if (subs) {
                targets = subs
                  .filter((s: any) => broadcast.target_type === 'opt_in'
                    ? s[statusField] === 'Applied'
                    : s[statusField] !== 'Applied')
                  .map((s: any) => s.user_id)
              }
            }
            if (targets.length === 0) {
              const { data: users } = await supabase.from('user_stats').select('user_id').limit(5000)
              targets = users?.map((u: any) => u.user_id) || []
            }
          } else {
            const { data: users } = await supabase.from('user_stats').select('user_id').limit(5000)
            targets = users?.map((u: any) => u.user_id) || []
          }

          if (targets.length > 0) {
            const notifications = targets.map((user_id: string) => ({
              user_id, title: broadcast.title || 'Notification',
              message: broadcast.body || '', type: 'broadcast', url: '/profile/notifications',
              sender_name: broadcast.sender_name || 'Al-Mawaid',
            }))

            const { error: notifErr } = await supabase.from('notifications').insert(notifications)
            if (notifErr) throw notifErr

            // Send push: Firebase CF (AAB FCM + web) with edge fallback.
            // Capture the REAL delivery counts so admin dashboards show actual
            // device coverage (delivered vs failed), not just member counts.
            if (broadcast.channel === 'push' || !broadcast.channel) {
              const pushBody = {
                title: broadcast.title || 'Al-Mawaid',
                body: broadcast.body || '',
                url: '/',
                target_type: broadcast.target_type === 'specific' ? 'specific' : null,
                user_id: broadcast.target_user_id || null,
                image_url: broadcast.media_url || undefined,
                sender_name: broadcast.sender_name || 'Al-Mawaid',
                big_picture_url: broadcast.media_url || undefined,
                actions: broadcast.actions || undefined,
                style: broadcast.style || undefined,
                collapse_key: broadcast.collapse_key || undefined,
              }
              const record = (json: any) => {
                pushSent = Number(json?.sent) || 0
                pushFailed = Number(json?.failed) || 0
              }
              const invokeEdge = async () => {
                const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                  },
                  body: JSON.stringify(pushBody),
                })
                record(await res.json().catch(() => ({})))
              }
              try {
                const fbRes = await fetch('https://us-central1-al-mawaid-8ffef.cloudfunctions.net/sendPush', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(pushBody),
                })
                const fbJson = await fbRes.json().catch(() => ({}))
                if (fbRes.ok && Number(fbJson.sent) > 0) {
                  record(fbJson)
                } else {
                  await invokeEdge()
                }
              } catch (pushErr) {
                console.error(`[process-scheduled] Push send failed for broadcast ${broadcast.id}:`, pushErr.message)
                try { await invokeEdge() } catch (_) { /* already logged */ }
              }
            }
          }

          const isPush = broadcast.channel === 'push' || !broadcast.channel
          await supabase.from('broadcast_schedule').update({
            status: isPush && pushFailed > 0 && pushSent === 0 ? 'failed' : 'sent',
            sent_count: isPush ? pushSent : targets.length,
            failed_count: isPush ? pushFailed : 0,
            sent_at: now,
          }).eq('id', broadcast.id)

          totalProcessed++
        } catch (err: any) {
          console.error(`[process-scheduled] Failed broadcast ${broadcast.id}:`, err.message)
          await supabase.from('broadcast_schedule').update({
            status: 'failed', failed_count: (broadcast.failed_count || 0) + 1,
          }).eq('id', broadcast.id)
        }
      }
    }

    // ── 2. Publish menus that are due ──
    const { data: dueMenus, error: menuErr } = await supabase
      .from('weekly_menu')
      .select('week_start')
      .not('publish_at', 'is', null)
      .lte('publish_at', now)
      .order('publish_at', { ascending: true })
      .limit(1)

    if (menuErr) throw menuErr

    if (dueMenus?.length) {
      const weekStart = dueMenus[0].week_start

      const { data: existingNotice } = await supabase
        .from('notices')
        .select('id')
        .eq('type', 'menu')
        .ilike('message', `%${weekStart}%`)
        .maybeSingle()

      if (!existingNotice) {
        await supabase.from('notices').insert({
          title: 'New Weekly Menu Available',
          message: `The menu for week of ${weekStart} is now live! Check it out in the app.`,
          body: `The menu for week of ${weekStart} is now live! Check it out in the app.`,
          url: '/', type: 'menu', sender_name: 'Al-Mawaid',
        })
        totalProcessed++
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: totalProcessed }), { status: 200, headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers })
  }
})
