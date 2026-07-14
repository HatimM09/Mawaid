// Supabase Edge Function: Daily Survey Digest & Reminders
// Called by external cron service
// Replaces Firebase Cloud Functions: surveyReminder, surveyDigest, surveyAutoClose, surveyAutoOpen

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pquusffhuholbnlmuyen.supabase.co'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const SURVEY_DAYS_MAP = { mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday', fri: 'friday', sat: 'saturday' }

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

    const { action } = await req.json()

    // ── Auto-close survey (Monday 11:30 AM) ──
    if (action === 'auto_close') {
      await supabase.from('app_settings').upsert({ key: 'survey_status', value: 'closed', updated_at: new Date().toISOString() })
      return new Response(JSON.stringify({ ok: true, action: 'auto_close' }), { status: 200, headers })
    }

    // ── Auto-open survey (Saturday 8:00 PM) ──
    if (action === 'auto_open') {
      await supabase.from('app_settings').upsert({ key: 'survey_status', value: 'open', updated_at: new Date().toISOString() })
      // Push notification to all users that survey is open
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
          body: JSON.stringify({
            title: '📋 Weekly Survey Open',
            body: 'The survey for the coming week is now open! Submit your meal preferences (Sat 8PM – Mon 11AM).',
            url: '/',
            target_type: 'all',
            type: 'survey',
          }),
        })
      } catch (e) { console.error('auto_open push failed:', e) }
      return new Response(JSON.stringify({ ok: true, action: 'auto_open' }), { status: 200, headers })
    }

    // ── Survey reminder (every 30 min during survey hours) ──
    if (action === 'survey_reminder') {
      const now = new Date()
      const day = now.getDay()
      if (day === 0) return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'Sunday' }), { status: 200, headers })

      const weekId = getWeekMonday(now)
      const dayName = DAYS[day - 1]
      if (!dayName) return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200, headers })

      const dk = dayName.substring(0, 3).toLowerCase()
      const h = now.getHours()
      const mealType = h < 15 ? 'l' : 'd'
      const statusField = `${dk}_${mealType}_status`

      // Get users who haven't submitted
      const { data: users } = await supabase.from('user_stats').select('user_id').eq('role', 'member')
      if (!users?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200, headers })

      const pendingUsers = []
      for (const u of users) {
        const { data: sub } = await supabase
          .from('survey_submissions_flat')
          .select(statusField)
          .eq('user_id', u.user_id)
          .eq('week_id', weekId)
          .maybeSingle()

        if (!sub || !sub[statusField]) {
          pendingUsers.push(u.user_id)
        }
      }

      if (pendingUsers.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200, headers })
      }

      const notifications = pendingUsers.map(user_id => ({
        user_id,
        title: 'Survey Reminder',
        message: `Don't forget to submit your ${dayName} ${mealType === 'l' ? 'lunch' : 'dinner'} survey!`,
        type: 'survey_reminder',
        url: '/',
      }))

      await supabase.from('notifications').insert(notifications)

      return new Response(JSON.stringify({ ok: true, sent: pendingUsers.length }), { status: 200, headers })
    }

    // ── Daily digest (6 PM) ──
    if (action === 'survey_digest') {
      const now = new Date()
      const day = now.getDay()
      if (day === 0) return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'Sunday' }), { status: 200, headers })

      const weekId = getWeekMonday(now)
      const dayName = DAYS[day - 1]
      if (!dayName) return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200, headers })

      const dk = dayName.substring(0, 3).toLowerCase()
      const { data: subs } = await supabase
        .from('survey_submissions_flat')
        .select(`${dk}_l_status, ${dk}_d_status`)
        .eq('week_id', weekId)

      let lunchApplied = 0, lunchSkipped = 0, lunchPending = 0
      let dinnerApplied = 0, dinnerSkipped = 0, dinnerPending = 0

      for (const s of subs || []) {
        if (s[`${dk}_l_status`] === 'Applied') lunchApplied++
        else if (s[`${dk}_l_status`] === 'Skipped') lunchSkipped++
        else lunchPending++
        if (s[`${dk}_d_status`] === 'Applied') dinnerApplied++
        else if (s[`${dk}_d_status`] === 'Skipped') dinnerSkipped++
        else dinnerPending++
      }

      // Send digest to admins
      const { data: admins } = await supabase.from('user_stats').select('user_id').eq('role', 'admin')
      if (admins?.length) {
        const notifications = admins.map(a => ({
          user_id: a.user_id,
          title: 'Survey Digest',
          message: `${dayName}: Lunch ${lunchApplied}✅ / ${lunchSkipped}❌ / ${lunchPending}⏳ | Dinner ${dinnerApplied}✅ / ${dinnerSkipped}❌ / ${dinnerPending}⏳`,
          type: 'survey_digest',
          url: '/admin/survey-tracking',
        }))
        await supabase.from('notifications').insert(notifications)
      }

      return new Response(JSON.stringify({ ok: true, applied: { lunch: lunchApplied, dinner: dinnerApplied } }), { status: 200, headers })
    }

    throw new Error(`Unknown action: ${action}`)
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers })
  }
})
