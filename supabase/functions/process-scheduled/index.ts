// Supabase Edge Function: Process Scheduled Broadcasts & Menu Publish
// Called by external cron service every minute
// Handles: broadcast delivery + menu publish notifications

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pquusffhuholbnlmuyen.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

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
    const { data: dueBroadcasts, error: bcErr } = await supabase
      .from('broadcast_schedule')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(20)

    if (bcErr) throw bcErr

    if (dueBroadcasts?.length) {
      for (const broadcast of dueBroadcasts) {
        try {
          await supabase.from('broadcast_schedule').update({ status: 'sending' }).eq('id', broadcast.id)

          let targets = []
          if (broadcast.target_type === 'specific' && broadcast.target_user_id) {
            targets = [broadcast.target_user_id]
          } else if (broadcast.target_type === 'admins') {
            const { data: admins } = await supabase.from('user_stats').select('user_id').eq('role', 'admin')
            targets = admins?.map(a => a.user_id) || []
          } else {
            const { data: users } = await supabase.from('user_stats').select('user_id').limit(5000)
            targets = users?.map(u => u.user_id) || []
          }

          // Always insert in-app notifications (triggers Supabase Realtime toast)
          const notifications = targets.map(user_id => ({
            user_id, title: broadcast.title || 'Notification',
            message: broadcast.body || '', type: 'broadcast', url: broadcast.media_url || '/',
          }))

          if (notifications.length) {
            const { error: notifErr } = await supabase.from('notifications').insert(notifications)
            if (notifErr) throw notifErr
          }

          // Send push: Firebase CF (AAB FCM + web) with edge fallback
          if (broadcast.channel === 'push' || !broadcast.channel) {
            const pushBody = {
              title: broadcast.title || 'Al-Mawaid',
              body: broadcast.body || '',
              url: '/',
              target_type: broadcast.target_type === 'specific' ? 'specific' : null,
              user_id: broadcast.target_user_id || null,
              image_url: broadcast.media_url || undefined,
              sender_name: broadcast.sender_name || 'Al-Mawaid',
            }
            try {
              const fbRes = await fetch('https://us-central1-al-mawaid-8ffef.cloudfunctions.net/sendPush', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pushBody),
              })
              const fbJson = await fbRes.json().catch(() => ({}))
              if (!fbRes.ok || !(fbJson.sent > 0)) {
                await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                  },
                  body: JSON.stringify(pushBody),
                })
              }
            } catch (pushErr) {
              console.error(`[process-scheduled] Push send failed for broadcast ${broadcast.id}:`, pushErr.message)
              try {
                await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                  },
                  body: JSON.stringify(pushBody),
                })
              } catch (_) { /* already logged */ }
            }
          }

          await supabase.from('broadcast_schedule').update({
            status: 'sent', sent_count: targets.length, sent_at: now,
          }).eq('id', broadcast.id)

          totalProcessed++
        } catch (err) {
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
      .limit(1)

    if (menuErr) throw menuErr

    if (dueMenus?.length) {
      const weekStart = dueMenus[0].week_start

      // Check if we already sent a notice for this week
      const { data: existingNotice } = await supabase
        .from('notices')
        .select('id')
        .eq('type', 'menu')
        .ilike('message', `%${weekStart}%`)
        .maybeSingle()

      if (!existingNotice) {
        await supabase.from('notices').insert({
          title: '🍽️ New Weekly Menu Available',
          message: `The menu for week of ${weekStart} is now live! Check it out in the app.`,
          url: '/', type: 'menu',
        })
        totalProcessed++
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: totalProcessed }), { status: 200, headers })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers })
  }
})
