// ═══════════════════════════════════════════════════════════════
// AL-MAWAID — WhatsApp Chatbot (Supabase Edge Function)
// ═══════════════════════════════════════════════════════════════
// Meta WhatsApp Cloud API webhook that lets members chat with
// Al-Mawaid: weekly meal survey, today's menu, daily feedback,
// stop/resume thali, dues and support queries.
//
// Webhook URL:  https://<project>.supabase.co/functions/v1/whatsapp-bot
// Env vars (supabase secrets set):
//   WHATSAPP_ACCESS_TOKEN      — permanent system-user token
//   WHATSAPP_PHONE_NUMBER_ID   — WhatsApp business phone number id
//   WHATSAPP_VERIFY_TOKEN      — any random string you also paste in Meta
//   WHATSAPP_APP_SECRET        — (optional) Meta app secret for signature check
//   WHATSAPP_TZ_OFFSET_MIN     — (optional, default 330 = IST)
//
// Mirrors the member app's canonical write conventions:
//  · survey_day_responses rows (user_id, week_id, day mon..sat,
//    l_status/d_status 'Applied'|'Skipped', l_dish_1..5 / d_dish_1..5,
//    dish_snapshot) — same shapes as src/lib/submitSurvey.js
//  · daily_feedback (day full weekday name, week_id calendar Monday,
//    stars + emoji labels) — same shape as src/member/pages/HomePage.jsx
//  · thali_requests (request_type 'stop'|'resume', from/to dates)
//  · app_settings keyed windows (survey_window_*, survey_status)
// ═══════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  AppSettings, DAYS, DAY_KEYS, STAR_LABELS,
  toLocalDateStr, weekdayName, calendarWeekMonday,
  isSurveyOpen, getSurveyTargetWeek, getSurveyWindowLabel, formatWeekRange,
  parseDishArray, isRotiItem, isCountInput, menuForDay, resolveServingWeekId,
  parseDishInput, parseDateInput, MEAL_ORDER, mealLabel, statusPill, normalizePhone,
  verifySignature,
} from './logic.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const WA_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || ''
const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ''
const WA_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || ''
const WA_APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET') || ''
const WA_GRAPH_VERSION = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v21.0'
// Community timezone offset from UTC in minutes (IST = 330). All
// day/window logic uses this instead of the runtime's local time.
const TZ_OFFSET_MIN = (() => { const n = parseInt(Deno.env.get('WHATSAPP_TZ_OFFSET_MIN') || '330', 10); return isNaN(n) ? 330 : n })()

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ═══════════════════════════════════════════════════════════════
// Time helpers — operate on an IST-shifted Date using UTC accessors
// ═══════════════════════════════════════════════════════════════

/** Date shifted into the community timezone (use only UTC getters). */
function tzNow(): Date {
  return new Date(Date.now() + TZ_OFFSET_MIN * 60_000)
}

/** Load app_settings rows as a flat object. */
async function loadAppSettings(): Promise<AppSettings> {
  const { data } = await supabase.from('app_settings').select('key, value')
  const out: AppSettings = {}
  for (const row of data || []) out[row.key] = row.value
  return out
}

async function loadMenuMap(weekId: string): Promise<Record<string, { lunch: string[]; dinner: string[] }>> {
  const { data } = await supabase.from('weekly_menu').select('day_name, lunch, dinner').eq('week_start', weekId)
  const map: Record<string, { lunch: string[]; dinner: string[] }> = {}
  for (const row of data || []) {
    const key = String(row.day_name).substring(0, 3).toLowerCase()
    map[key] = { lunch: parseDishArray(row.lunch), dinner: parseDishArray(row.dinner) }
  }
  return map
}

// ═══════════════════════════════════════════════════════════════
// Member linking — phone → user_stats
// ═══════════════════════════════════════════════════════════════

interface MemberRow {
  user_id: string
  name: string
  email: string
  thali_number: string | number | null
  phone: string
  role: string
}

async function getWhatsappUser(waPhone: string) {
  const { data } = await supabase.from('whatsapp_users').select('*').eq('wa_phone', waPhone).maybeSingle()
  return data || null
}

async function getMemberByWaPhone(waPhone: string): Promise<{ member: MemberRow | null; linked: boolean }> {
  const link = await getWhatsappUser(waPhone)
  if (link?.user_id) {
    const { data } = await supabase.from('user_stats').select('user_id, name, email, thali_number, phone, role').eq('user_id', link.user_id).maybeSingle()
    if (data) return { member: data as MemberRow, linked: true }
    // stale link (member removed) — drop it
    await supabase.from('whatsapp_users').delete().eq('wa_phone', waPhone)
  }
  // Fall back to matching user_stats.phone directly
  const { data: members } = await supabase.from('user_stats').select('user_id, name, email, thali_number, phone, role')
  const want = normalizePhone(waPhone)
  if (want) {
    const hit = (members || []).find(m => m.phone && normalizePhone(m.phone) === want)
    if (hit) {
      await linkMember(waPhone, hit as MemberRow)
      return { member: hit as MemberRow, linked: true }
    }
  }
  return { member: null, linked: false }
}

async function linkMember(waPhone: string, member: MemberRow) {
  await supabase.from('whatsapp_users').upsert({
    wa_phone: waPhone,
    user_id: member.user_id,
    thali_number: member.thali_number != null ? String(member.thali_number) : null,
    name: member.name || '',
    updated_at: new Date().toISOString(),
  })
}

async function findMemberByThali(thaliNo: string): Promise<MemberRow | null> {
  const clean = String(thaliNo).replace(/^#/, '').trim()
  if (!clean) return null
  const { data } = await supabase
    .from('user_stats')
    .select('user_id, name, email, thali_number, phone, role')
    .eq('thali_number', clean)
    .maybeSingle()
  return (data as MemberRow) || null
}

// ═══════════════════════════════════════════════════════════════
// Session state (per WhatsApp chat)
// ═══════════════════════════════════════════════════════════════

async function getSession(waPhone: string) {
  const { data } = await supabase.from('whatsapp_sessions').select('*').eq('wa_phone', waPhone).maybeSingle()
  return data || { wa_phone: waPhone, state: {}, last_msg_id: null }
}

async function setSession(waPhone: string, state: Record<string, unknown>, lastMsgId?: string | null) {
  await supabase.from('whatsapp_sessions').upsert({
    wa_phone: waPhone,
    state,
    ...(lastMsgId !== undefined ? { last_msg_id: lastMsgId } : {}),
    updated_at: new Date().toISOString(),
  })
}

async function clearSession(waPhone: string) {
  await setSession(waPhone, {})
}

// ═══════════════════════════════════════════════════════════════
// WhatsApp Cloud API client
// ═══════════════════════════════════════════════════════════════

async function waApiPost(payload: Record<string, unknown>): Promise<boolean> {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    console.error('[whatsapp-bot] WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID not configured')
    return false
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${WA_GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WA_TOKEN}` },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[whatsapp-bot] Graph API error:', res.status, text)
      return false
    }
    return true
  } catch (e) {
    console.error('[whatsapp-bot] Graph API fetch failed:', e)
    return false
  }
}

async function waSendText(to: string, body: string) {
  return waApiPost({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: body.slice(0, 4000) },
  })
}

/** Interactive reply buttons — max 3, ids ≤ 200 chars. */
async function waSendButtons(to: string, body: string, buttons: Array<{ id: string; title: string }>) {
  if (!buttons.length || buttons.length > 3) return waSendText(to, body)
  return waApiPost({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body.slice(0, 1000) },
      action: {
        buttons: buttons.slice(0, 3).map(b => ({ type: 'reply', reply: { id: b.id.slice(0, 200), title: b.title.slice(0, 20) } })),
      },
    },
  })
}

async function waMarkRead(messageId: string) {
  return waApiPost({ messaging_product: 'whatsapp', status: 'read', message_id: messageId })
}

/** Best-effort admin alert through the existing send-push function. */
async function notifyAdmins(message: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        title: 'Al-Mawaid · WhatsApp bot error',
        body: message,
        target_type: 'admins',
        notify_in_app: true,
        type: 'info',
        sender_name: 'WhatsApp Bot',
      }),
    })
  } catch (e) {
    console.warn('[whatsapp-bot] admin alert failed:', e)
  }
}

// ═══════════════════════════════════════════════════════════════
// Output formatting
// ═══════════════════════════════════════════════════════════════

function helpText(): string {
  return [
    '🍛 *Al-Mawaid WhatsApp Bot*',
    '',
    '1️⃣ *MENU* – today\'s thali menu',
    '2️⃣ *TOMORROW* – tomorrow\'s menu',
    '3️⃣ *SURVEY* – fill / edit the weekly survey',
    '4️⃣ *STATUS* – my survey responses',
    '5️⃣ *FEEDBACK* – rate today\'s meals',
    '6️⃣ *STOP* / *RESUME* – thali request',
    '7️⃣ *DUES* – contribution status',
    '8️⃣ *QUERY* – raise a support query',
    '9️⃣ *WHOAMI* – my linked profile',
    '',
    'Type *CANCEL* any time to leave a flow.',
  ].join('\n')
}

// ═══════════════════════════════════════════════════════════════
// Survey flow
// ═══════════════════════════════════════════════════════════════

async function loadExistingWeekRows(userId: string, weekId: string) {
  const { data } = await supabase
    .from('survey_day_responses')
    .select('*')
    .eq('user_id', userId)
    .eq('week_id', weekId)
  const byDay: Record<string, Record<string, unknown>> = {}
  for (const row of data || []) {
    const dk = String(row.day).trim().toLowerCase().substring(0, 3)
    if (DAY_KEYS.includes(dk)) byDay[dk] = row
  }
  return byDay
}

async function startSurvey(waPhone: string, member: MemberRow, session: Record<string, unknown>, mode: 'resume' | 'redo') {
  const appSettings = await loadAppSettings()
  const weekId = getSurveyTargetWeek(appSettings, tzNow())
  const open = isSurveyOpen(appSettings, tzNow())
  if (!open) {
    await waSendText(waPhone,
      `⏳ The survey window is currently *closed*.\nIt opens ${getSurveyWindowLabel(appSettings)}.\nYou can still type *STATUS* to review your responses.`)
    await clearSession(waPhone)
    return
  }

  const existing = await loadExistingWeekRows(member.user_id, weekId)
  const answered = MEAL_ORDER.filter(({ day, meal }) => existing[day]?.[`${meal}_status`]).length
  const redo = mode === 'redo' || answered === 0

  const firstUnanswered = MEAL_ORDER.findIndex(({ day, meal }) => !existing[day]?.[`${meal}_status`])
  const state: Record<string, unknown> = {
    flow: 'survey',
    week_id: weekId,
    index: redo ? 0 : (firstUnanswered >= 0 ? firstUnanswered : MEAL_ORDER.length),
    day_data: {},
    started_at: new Date().toISOString(),
    window_label: getSurveyWindowLabel(appSettings),
  }

  await setSession(waPhone, state)
  const header = redo && answered > 0
    ? `🔄 Redoing all 12 meals for *${formatWeekRange(weekId)}*.`
    : `📋 Weekly survey *${formatWeekRange(weekId)}*${answered > 0 ? ` — ${12 - answered} meal(s) remaining` : ''}.`
  await waSendText(waPhone, `${header}\n⏳ Window: ${state.window_label}\n${answered > 0 ? '' : 'This takes about 12 quick replies.\n'}`)
  await askCurrentMeal(waPhone, member, state, existing)
}

async function askCurrentMeal(waPhone: string, member: MemberRow, state: Record<string, unknown>, existing: Record<string, Record<string, unknown>>) {
  const idx = Number(state.index || 0)
  if (idx >= MEAL_ORDER.length) {
    await finishSurvey(waPhone, member, state)
    return
  }
  const { day, meal } = MEAL_ORDER[idx]
  const saved = !state.day_data && existing[day]?.[`${meal}_status`] ? existing[day]?.[`${meal}_status`] : null
  await waSendButtons(waPhone,
    `*${mealLabel(day, meal)}*\nWill you be having this meal?${saved ? `\n_(currently saved: ${saved === 'Applied' ? '✅ Applied' : '❌ Skipped'})_` : ''}`,
    [{ id: `sv_apply`, title: '✅ Apply' }, { id: `sv_skip`, title: '❌ Skip' }])
}

/** Ask the dish-detail question for a slot that was just applied. */
async function askDishValues(waPhone: string, member: MemberRow, state: Record<string, unknown>, day: string, meal: string, dishList: string[]) {
  const appSettings = await loadAppSettingsCached(state)
  const dayNameFull = DAYS[DAY_KEYS.indexOf(day)] || day
  const lines = dishList.slice(0, 5).map((dish, i) => {
    const kind = isRotiItem(dish) ? 'yes/no' : isCountInput(appSettings, dayNameFull, meal === 'l' ? 'lunch' : 'dinner', i) ? 'count' : '%'
    return `${i + 1}. ${dish} _(${kind})_`
  })
  const example = dishList.slice(0, 5).map((dish) => isRotiItem(dish) ? 'yes' : '2').join(', ')
  await waSendText(waPhone,
    `*${mealLabel(day, meal)}* — dish details:\n${lines.join('\n')}\n\nReply values in order, e.g. *${example}*\nUse *no* or *0* for a dish you don't want.\nOr reply *- to leave dish details blank*.`)
  state.step = 'dishes'
  state.dish_day = day
  state.dish_meal = meal
  await setSession(waPhone, state)
}

// settings cache per session to avoid re-fetching on every dish question
async function loadAppSettingsCached(state: Record<string, unknown>): Promise<AppSettings> {
  if (state._settings) return state._settings as AppSettings
  const s = await loadAppSettings()
  state._settings = s
  return s
}

/** Persist one day's answers — mirrors submitSurveyRow's per-day row shape. */
async function saveSurveyDay(member: MemberRow, weekId: string, dayKey: string, dayData: Record<string, unknown>, existing: Record<string, unknown> | undefined, markSubmitted: boolean) {
  const nowIso = new Date().toISOString()
  const payload: Record<string, unknown> = {
    user_id: member.user_id,
    week_id: weekId,
    day: dayKey,
    thali_number: member.thali_number != null ? String(member.thali_number).replace(/^#/, '') : null,
    email: member.email || '',
    updated_at: nowIso,
  }
  if (markSubmitted) payload.submitted_at = nowIso

  // statuses
  const lStatus = dayData.l_status ?? existing?.l_status ?? null
  const dStatus = dayData.d_status ?? existing?.d_status ?? null
  if (lStatus) payload.l_status = lStatus
  if (dStatus) payload.d_status = dStatus

  // dishes: session answers win, existing row fills the rest
  for (let i = 1; i <= 5; i++) {
    const lv = dayData[`l_dish_${i}`] ?? existing?.[`l_dish_${i}`] ?? null
    const dv = dayData[`d_dish_${i}`] ?? existing?.[`d_dish_${i}`] ?? null
    if (lStatus === 'Applied' && lv != null) payload[`l_dish_${i}`] = lv
    if (dStatus === 'Applied' && dv != null) payload[`d_dish_${i}`] = dv
  }
  // Skipped meals never carry stale dish values (same rule as the app)
  if (lStatus === 'Skipped') for (let i = 1; i <= 5; i++) payload[`l_dish_${i}`] = null
  if (dStatus === 'Skipped') for (let i = 1; i <= 5; i++) payload[`d_dish_${i}`] = null

  // dish_snapshot: merge with existing so tracker order stays stable
  const snap: Record<string, string[]> = {}
  try {
    const raw = existing?.dish_snapshot
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (obj && typeof obj === 'object') Object.assign(snap, obj)
  } catch { /* start fresh */ }
  for (const mk of ['l', 'd'] as const) {
    const list = dayData[`_${mk}_menu_dishes`]
    if (lStatus === 'Applied' && mk === 'l' && Array.isArray(list) && list.length) snap[`${dayKey}_l`] = list.slice(0, 5)
    if (dStatus === 'Applied' && mk === 'd' && Array.isArray(list) && list.length) snap[`${dayKey}_d`] = list.slice(0, 5)
  }
  payload.dish_snapshot = snap

  const { error } = await supabase
    .from('survey_day_responses')
    .upsert([payload], { onConflict: 'user_id,week_id,day' })
  if (error) {
    console.error('[whatsapp-bot] survey day upsert failed:', error)
    await notifyAdmins(`${member.name || 'A member'} (Thali ${member.thali_number ?? '?'}): WhatsApp survey save failed — ${error.message}`)
    throw new Error(error.message)
  }
}

async function finishSurvey(waPhone: string, member: MemberRow, state: Record<string, unknown>) {
  const weekId = String(state.week_id)
  const rows = await loadExistingWeekRows(member.user_id, weekId)
  const lines = MEAL_ORDER.map(({ day, meal }) => `*${DAYS[DAY_KEYS.indexOf(day)].substring(0, 3).toUpperCase()} ${meal === 'l' ? 'L' : 'D'}* ${statusPill(rows[day]?.[`${meal}_status`])}`)
  const answered = MEAL_ORDER.filter(({ day, meal }) => rows[day]?.[`${meal}_status`]).length
  // Complete 12/12 → stamp submitted_at on the week, like the app's final submit.
  if (answered >= 12) {
    try {
      await supabase.from('survey_day_responses')
        .update({ submitted_at: new Date().toISOString() })
        .eq('user_id', member.user_id)
        .eq('week_id', weekId)
        .is('submitted_at', null)
    } catch (e) { console.warn('[whatsapp-bot] submitted_at stamp failed:', e) }
  }
  await clearSession(waPhone)
  await waSendText(waPhone,
    `🎉 *Survey saved — ${formatWeekRange(weekId)}*\n${lines.slice(0, 6).join('   ')}\n${lines.slice(6).join('   ')}\n\n${answered}/12 meals answered.\nYou can edit until the window closes (${state.window_label}) — just type *SURVEY* again.`)
}

// ═══════════════════════════════════════════════════════════════
// Feedback flow
// ═══════════════════════════════════════════════════════════════

async function startFeedback(waPhone: string, state: Record<string, unknown>) {
  const now = tzNow()
  if (now.getUTCDay() === 0) {
    await waSendText(waPhone, '🙏 There is no thali on Sunday — feedback is for Monday to Saturday.')
    return
  }
  const dayName = weekdayName(now)
  await waSendButtons(waPhone, `⭐ Rate today's meals — *${dayName.charAt(0).toUpperCase() + dayName.slice(1)}*.\nWhich meal?`,
    [{ id: 'fb_lunch', title: '🍛 Lunch' }, { id: 'fb_dinner', title: '🌙 Dinner' }])
  state.flow = 'feedback'
  state.step = 'meal'
  state.day = dayName
  state.week_id = calendarWeekMonday(now)
  await setSession(waPhone, state)
}

async function feedbackStarPrompt(waPhone: string, state: Record<string, unknown>) {
  const meal = state.fb_meal === 'lunch' ? 'Lunch 🍛' : 'Dinner 🌙'
  await waSendText(waPhone, `How was *${meal}* today?\nReply with a rating *1–5*:\n${Object.entries(STAR_LABELS).map(([k, v]) => `${k} = ${v}`).join('\n')}`)
  state.step = 'stars'
  await setSession(waPhone, state)
}

async function saveFeedback(waPhone: string, member: MemberRow, state: Record<string, unknown>, stars: number, comment: string) {
  const meal = state.fb_meal === 'lunch' ? 'lunch' : 'dinner'
  const dayName = String(state.day)
  const payload: Record<string, unknown> = {
    user_id: member.user_id,
    day: dayName,
    week_id: state.week_id,
    [`${meal}_stars`]: stars,
    [`${meal}_emoji`]: STAR_LABELS[stars] || null,
    [`${meal}_comment`]: comment || null,
    created_at: new Date().toISOString(),
  }
  const { error } = await supabase
    .from('daily_feedback')
    .upsert([payload], { onConflict: 'user_id,day,week_id' })
  if (error) {
    console.error('[whatsapp-bot] feedback upsert failed:', error)
    await waSendText(waPhone, `⚠️ Couldn't save your feedback: ${error.message}`)
    return
  }
  await clearSession(waPhone)

  // Mirror the app: best-effort admin notification on each new rating
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        title: '★ New Daily Feedback',
        body: `${member.name || 'A member'}${member.thali_number ? ` (#${member.thali_number})` : ''} rated ${meal === 'lunch' ? 'Lunch' : 'Dinner'}: ${stars}★.`,
        target_type: 'admins',
        notify_in_app: true,
        type: 'feedback',
        sender_name: 'Al-Mawaid',
        url: '/admin/feedback',
      }),
    })
  } catch (e) { console.warn('[whatsapp-bot] feedback admin notify failed:', e) }

  const other = meal === 'lunch' ? 'Dinner' : 'Lunch'
  await waSendText(waPhone, `✅ ${meal === 'lunch' ? 'Lunch' : 'Dinner'} rated *${stars}/5* — thank you!${comment ? `\n💬 "${comment}"` : ''}\n\nType *FEEDBACK* to rate ${other} too.`)
}

// ═══════════════════════════════════════════════════════════════
// Stop / resume thali flow
// ═══════════════════════════════════════════════════════════════

async function startThaliRequest(waPhone: string, kind: 'stop' | 'resume', state: Record<string, unknown>) {
  await waSendButtons(waPhone, kind === 'stop'
    ? '🛑 Stop thali — which meals should stop?'
    : '▶️ Resume thali — which meals to resume?',
    [{ id: 'tr_both', title: '🍽️ Both' }, { id: 'tr_lunch', title: '🍛 Lunch' }, { id: 'tr_dinner', title: '🌙 Dinner' }])
  state.flow = 'thali'
  state.step = 'meal'
  state.kind = kind
  await setSession(waPhone, state)
}

async function saveThaliRequest(waPhone: string, member: MemberRow, state: Record<string, unknown>, fromDate: string, toDate: string | null) {
  const kind = state.kind === 'resume' ? 'resume' : 'stop'
  const mealType = state.tr_meal === 'lunch' ? 'lunch' : state.tr_meal === 'dinner' ? 'dinner' : 'both'
  const { data, error } = await supabase.from('thali_requests').insert([{
    user_id: member.user_id,
    request_type: kind,
    status: 'pending',
    from_date: fromDate,
    to_date: toDate,
    meal_type: mealType,
    details: `Requested via WhatsApp bot${toDate ? '' : kind === 'stop' ? ' (until further notice)' : ''}`,
  }]).select('id').single()
  if (error) {
    console.error('[whatsapp-bot] thali request insert failed:', error)
    await waSendText(waPhone, `⚠️ Couldn't submit your request: ${error.message}`)
    return
  }
  await clearSession(waPhone)
  await waSendText(waPhone,
    `✅ *${kind === 'stop' ? 'Stop' : 'Resume'} request submitted* (ref ${String(data?.id || '').slice(0, 8)}…)\n` +
    `🍽️ Meals: *${mealType}*\n📅 From: *${fromDate}*${toDate ? `\n📅 To: *${toDate}*` : kind === 'stop' ? '\n📅 Until further notice' : ''}\n\nStatus: pending approval. The khidmat guzaar will review it shortly.`)
}

// ═══════════════════════════════════════════════════════════════
// Dues
// ═══════════════════════════════════════════════════════════════

async function sendDues(waPhone: string, member: MemberRow) {
  const appSettings = await loadAppSettings()
  const now = tzNow()
  const monthStart = toLocalDateStr(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
  const nextMonth = toLocalDateStr(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)))
  const monthLabel = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  if (member.role === 'member' || member.role === 'admin') {
    const { data: profile } = await supabase.from('user_stats').select('payment_exempt, custom_due_amount').eq('user_id', member.user_id).maybeSingle()
    if (profile?.payment_exempt) {
      await waSendText(waPhone, '💚 Your thali contribution is exempt — no dues pending. Type *MENU* for today\'s thali.')
      return
    }
    const due = Number(profile?.custom_due_amount ?? appSettings.default_payment_due ?? 1500)
    const { data: payments } = await supabase
      .from('user_payments')
      .select('amount, status, created_at')
      .eq('user_id', member.user_id)
      .gte('created_at', `${monthStart}T00:00:00Z`)
      .lt('created_at', `${nextMonth}T00:00:00Z`)
    const verified = (payments || []).filter(p => p.status === 'verified').reduce((s, p) => s + Number(p.amount), 0)
    const submitted = (payments || []).filter(p => p.status === 'submitted').reduce((s, p) => s + Number(p.amount), 0)
    const balance = Math.max(0, due - verified - submitted)
    const upi = appSettings.upi_id || '—'
    const payee = appSettings.upi_payee_name || 'Al-Mawaid'
    const lines = [
      `💰 *${appSettings.payment_title || 'Monthly Thali Contribution'}* — ${monthLabel}`,
      '',
      `Monthly due: ₹${due.toFixed(2)}`,
      verified > 0 ? `✅ Verified payments: ₹${verified.toFixed(2)}` : '',
      submitted > 0 ? `⏳ Submitted (awaiting verification): ₹${submitted.toFixed(2)}` : '',
      `Balance: *₹${balance.toFixed(2)}*`,
      '',
      balance > 0
        ? `Pay via UPI: *${upi}* (${payee}) or open the Al-Mawaid app → Dues & Payments to submit the receipt.`
        : '🎉 All settled for this month. Thank you!',
    ]
    await waSendText(waPhone, lines.filter(Boolean).join('\n'))
    return
  }
  await waSendText(waPhone, 'Dues are tracked for member thalis. Ask an admin if you need payment details.')
}

// ═══════════════════════════════════════════════════════════════
// Menu / status / query
// ═══════════════════════════════════════════════════════════════

function formatMealDishes(label: string, dishes: string[]): string {
  if (!dishes.length) return ''
  return `*${label}:*\n${dishes.map(d => `• ${d}`).join('\n')}`
}

async function sendMenu(waPhone: string, which: 'today' | 'tomorrow') {
  const now = tzNow()
  const target = which === 'today' ? now : new Date(now.getTime() + 86400_000)
  const dow = target.getUTCDay()
  if (dow === 0) {
    await waSendText(waPhone, '🙏 There is no thali on Sunday — see you Monday! Type *MENU* for today\'s thali.')
    return
  }
  const appSettings = await loadAppSettings()
  const servingWeek = resolveServingWeekId(appSettings, now)
  const menuMap = await loadMenuMap(servingWeek)
  const dayKey = DAY_KEYS[dow - 1]
  const menu = menuForDay(menuMap, dayKey)
  const dayLabel = which === 'today' ? 'Today' : 'Tomorrow'
  const dayName = weekdayName(target)
  if (!menu || (!menu.lunch.length && !menu.dinner.length)) {
    await waSendText(waPhone, `🍽️ Menu for *${dayName} (${formatWeekRange(servingWeek)})* hasn't been published yet. Please check back later.`)
    return
  }
  const lines = [`🍽️ *${dayLabel} — ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}* _(${formatWeekRange(servingWeek)})_`]
  const l = formatMealDishes('🍛 Lunch', menu.lunch)
  const d = formatMealDishes('🌙 Dinner', menu.dinner)
  if (l) lines.push('', l)
  if (d) lines.push('', d)
  lines.push('', 'Type *SURVEY* to plan next week\'s meals.')
  await waSendText(waPhone, lines.join('\n'))
}

async function sendStatus(waPhone: string, member: MemberRow) {
  const appSettings = await loadAppSettings()
  const weekId = getSurveyTargetWeek(appSettings, tzNow())
  const rows = await loadExistingWeekRows(member.user_id, weekId)
  const lines = MEAL_ORDER.map(({ day, meal }) => `*${DAYS[DAY_KEYS.indexOf(day)].substring(0, 3).toUpperCase()} ${meal === 'l' ? 'L' : 'D'}* ${statusPill(rows[day]?.[`${meal}_status`])}`)
  const answered = MEAL_ORDER.filter(({ day, meal }) => rows[day]?.[`${meal}_status`]).length
  const open = isSurveyOpen(appSettings, tzNow())
  await waSendText(waPhone,
    `📋 *My survey — ${formatWeekRange(weekId)}*\n${lines.slice(0, 6).join('   ')}\n${lines.slice(6).join('   ')}\n\n${answered}/12 answered.\n${open ? `⏳ Window OPEN until ${getSurveyWindowLabel(appSettings)} — type *SURVEY* to ${answered === 12 ? 'edit' : 'fill'}.` : `⏳ Window opens ${getSurveyWindowLabel(appSettings)}.`}`)
}

async function startQuery(waPhone: string, state: Record<string, unknown>, initialText: string) {
  if (initialText) {
    await saveQuery(waPhone, state, initialText)
    return
  }
  await waSendText(waPhone, '🎧 Please describe your query in one message (subject + details).')
  state.flow = 'query'
  state.step = 'text'
  await setSession(waPhone, state)
}

async function saveQuery(waPhone: string, state: Record<string, unknown>, text: string) {
  const userId = state.user_id as string
  const name = String(state.name || 'Member')
  const subject = text.split('\n')[0].slice(0, 80) || 'WhatsApp query'
  const { data, error } = await supabase.from('queries').insert([{
    user_id: userId,
    subject,
    comment: text,
    status: 'open',
  }]).select('id').single()
  if (error) {
    console.error('[whatsapp-bot] query insert failed:', error)
    await waSendText(waPhone, `⚠️ Couldn't submit your query: ${error.message}`)
    return
  }
  await clearSession(waPhone)
  await waSendText(waPhone, `✅ Query *${subject}* submitted (ref ${String(data?.id || '').slice(0, 8)}…).\nYou'll get a reply from the team — check the app's Support section for updates.`)
}

// ═══════════════════════════════════════════════════════════════
// Linking flow
// ═══════════════════════════════════════════════════════════════

async function startLinking(waPhone: string, reason: string) {
  await waSendText(waPhone, `${reason}\n\n🔐 *Link your thali:* reply with your *thali number* (e.g. *123*).`)
  await setSession(waPhone, { flow: 'link', step: 'thali' })
}

async function handleThaliInput(waPhone: string, raw: string) {
  const member = await findMemberByThali(raw)
  if (!member) {
    await waSendText(waPhone, `🤔 No member found with thali *${raw}*.\nCheck the number and reply again, or type *CANCEL*.`)
    return
  }
  await linkMember(waPhone, member)
  await clearSession(waPhone)
  const firstName = (member.name || 'Member').split(' ')[0]
  await waSendText(waPhone,
    `✅ Linked! Welcome *${firstName}* — Thali *${member.thali_number}*.\n\n${helpText()}`)
}

// ═══════════════════════════════════════════════════════════════
// Router
// ═══════════════════════════════════════════════════════════════

function parseCommand(text: string): string {
  const t = text.trim().toLowerCase()
  if (t === '1' || t === 'menu' || t === 'today' || t === 'aaj') return 'menu'
  if (t === '2' || t === 'tomorrow' || t === 'kal') return 'tomorrow'
  if (t === '3' || t === 'survey' || t === 'form') return 'survey'
  if (t === '4' || t === 'status' || t === 'my status') return 'status'
  if (t === '5' || t === 'feedback' || t === 'rate') return 'feedback'
  if (t === '6' || t === 'stop' || t === 'stop thali') return 'stop'
  if (t === 'resume' || t === 'resume thali' || t === 'start thali') return 'resume'
  if (t === '7' || t === 'dues' || t === 'payment' || t === 'payments') return 'dues'
  if (t === '8' || t === 'query' || t === 'support' || t === 'issue') return 'query'
  if (t === '9' || t === 'whoami' || t === 'profile' || t === 'my profile') return 'whoami'
  if (t === 'unlink') return 'unlink'
  if (t.startsWith('link')) return 'link'
  if (t === 'hi' || t === 'hello' || t === 'hey' || t === 'salam' || t === 'assalamualaikum' || t === 'start' || t === 'help' || t === 'm' || t === 'menu help') return 'help'
  if (t === 'cancel' || t === 'exit' || t === 'stop flow') return 'cancel'
  return ''
}

function extractCommandPayload(text: string, cmd: string): string {
  // supports "query the rotis were cold" style one-shots
  const t = text.trim()
  const rest = t.slice(cmd.length).trim()
  return rest
}

async function routeMessage(waPhone: string, member: MemberRow | null, session: Record<string, unknown>, incoming: { text: string; buttonId: string | null; msgId: string }) {
  const state = (session.state && typeof session.state === 'object' ? session.state : {}) as Record<string, unknown>
  const text = (incoming.text || '').trim()
  const lower = text.toLowerCase()

  // Global commands always available
  let cmd = parseCommand(text)
  if (cmd === 'cancel') {
    await clearSession(waPhone)
    await waSendText(waPhone, '👍 Done. Type *MENU* any time for the options.')
    return
  }

  // ── Active flows ──
  // While a flow is running, only read-only commands pass through —
  // bare numbers/words belong to the flow (e.g. "1" = Apply mid-survey).
  const FLOW_SAFE_CMDS = new Set(['help', 'status', 'whoami', 'dues', 'unlink'])
  const activeFlow = ['link', 'survey', 'feedback', 'thali', 'query'].includes(String(state.flow || ''))
  if (activeFlow && cmd && !FLOW_SAFE_CMDS.has(cmd)) cmd = ''

  if (state.flow === 'link') {
    if (!cmd) {
      await handleThaliInput(waPhone, text)
      return
    }
  }

  if (state.flow === 'survey') {
    if (!cmd) {
      await handleSurveyInput(waPhone, member as MemberRow, state, incoming)
      return
    }
  }

  if (state.flow === 'feedback') {
    if (!cmd) {
      await handleFeedbackInput(waPhone, member as MemberRow, state, incoming)
      return
    }
  }

  if (state.flow === 'thali') {
    if (!cmd) {
      await handleThaliFlowInput(waPhone, member as MemberRow, state, incoming)
      return
    }
  }

  if (state.flow === 'query') {
    if (!cmd) {
      await saveQuery(waPhone, state, text)
      return
    }
  }

  // ── Commands ──
  switch (cmd) {
    case 'help': {
      if (!member) { await startLinking(waPhone, '👋 Welcome to Al-Mawaid!'); return }
      await waSendText(waPhone, helpText())
      return
    }
    case 'menu': {
      if (!member) { await startLinking(waPhone, '🔒 Please link your thali first.'); return }
      await sendMenu(waPhone, 'today')
      return
    }
    case 'tomorrow': {
      if (!member) { await startLinking(waPhone, '🔒 Please link your thali first.'); return }
      await sendMenu(waPhone, 'tomorrow')
      return
    }
    case 'survey': {
      if (!member) { await startLinking(waPhone, '🔒 Please link your thali first.'); return }
      await startSurvey(waPhone, member, state, 'resume')
      return
    }
    case 'status': {
      if (!member) { await startLinking(waPhone, '🔒 Please link your thali first.'); return }
      await sendStatus(waPhone, member)
      return
    }
    case 'feedback': {
      if (!member) { await startLinking(waPhone, '🔒 Please link your thali first.'); return }
      await startFeedback(waPhone, state)
      return
    }
    case 'stop': {
      if (!member) { await startLinking(waPhone, '🔒 Please link your thali first.'); return }
      await startThaliRequest(waPhone, 'stop', state)
      return
    }
    case 'resume': {
      if (!member) { await startLinking(waPhone, '🔒 Please link your thali first.'); return }
      await startThaliRequest(waPhone, 'resume', state)
      return
    }
    case 'dues': {
      if (!member) { await startLinking(waPhone, '🔒 Please link your thali first.'); return }
      await sendDues(waPhone, member)
      return
    }
    case 'query': {
      if (!member) { await startLinking(waPhone, '🔒 Please link your thali first.'); return }
      state.user_id = member.user_id
      state.name = member.name
      await startQuery(waPhone, state, extractCommandPayload(text, lower.startsWith('query') ? 'query' : 'support'))
      return
    }
    case 'whoami': {
      if (!member) { await startLinking(waPhone, '🔒 Please link your thali first.'); return }
      await waSendText(waPhone,
        `👤 *${member.name || 'Member'}*\nThali: *${member.thali_number ?? '—'}*\nRole: ${member.role}\n\nType *MENU* for options, *UNLINK* to disconnect this number.`)
      return
    }
    case 'link': {
      const payload = extractCommandPayload(text, 'link')
      if (payload) {
        await handleThaliInput(waPhone, payload)
      } else {
        await startLinking(waPhone, '🔐 Link your thali to this WhatsApp number.')
      }
      return
    }
    case 'unlink': {
      await supabase.from('whatsapp_users').delete().eq('wa_phone', waPhone)
      await clearSession(waPhone)
      await waSendText(waPhone, '🔌 This WhatsApp number is now unlinked. Type *HI* to link again.')
      return
    }
    default: {
      // Unrecognized
      if (!member) { await startLinking(waPhone, '👋 Welcome to Al-Mawaid!'); return }
      await waSendText(waPhone, `🤖 I didn't understand that.\n\n${helpText()}`)
    }
  }
}

// ── Survey flow input handling ──
async function handleSurveyInput(waPhone: string, member: MemberRow, state: Record<string, unknown>, incoming: { text: string; buttonId: string | null }) {
  const lower = incoming.text.trim().toLowerCase()
  const idx = Number(state.index || 0)
  const { day, meal } = MEAL_ORDER[Math.min(idx, MEAL_ORDER.length - 1)]
  const weekId = String(state.week_id)
  const dayData = (state.day_data as Record<string, Record<string, unknown>>)?.[day] || {}
  const existingRows = await loadExistingWeekRows(member.user_id, weekId)
  const existingDay = existingRows[day]

  // Step: dish details
  if (state.step === 'dishes') {
    const dDay = String(state.dish_day)
    const dMeal = String(state.dish_meal) as 'l' | 'd'
    const dishList = (state.dish_list as string[]) || []
    const appSettings = await loadAppSettingsCached(state)
    const { values, error } = parseDishInput(incoming.text, dishList, appSettings, dDay, dMeal)
    if (error) {
      await waSendText(waPhone, `⚠️ ${error}`)
      return
    }
    const target = (state.day_data as Record<string, Record<string, unknown>>)?.[dDay] || {}
    for (let i = 0; i < values.length; i++) {
      if (values[i] !== null) target[`${dMeal}_dish_${i + 1}`] = values[i]
    }
    target[`_${dMeal}_menu_dishes`] = dishList
    const dd = (state.day_data as Record<string, Record<string, unknown>> || {})
    dd[dDay] = target
    state.day_data = dd
    state.step = null
    state.dish_day = null
    state.dish_meal = null
    state.dish_list = null
    state.index = idx + 1
    await setSession(waPhone, state)
    await waSendText(waPhone, `✅ Saved ${mealLabel(dDay, dMeal)}`)
    await askCurrentMeal(waPhone, member, state, existingRows)
    return
  }

  // Step: apply/skip for current meal
  const choice = incoming.buttonId === 'sv_apply' ? 'apply'
    : incoming.buttonId === 'sv_skip' ? 'skip'
    : (['1', 'yes', 'y', 'apply', 'ha', 'haan'].includes(lower) ? 'apply'
      : (['2', 'no', 'n', 'skip', 'nahi'].includes(lower) ? 'skip' : null))

  if (!choice) {
    await waSendButtons(waPhone, `*${mealLabel(day, meal)}* — please reply *1* (Apply) or *2* (Skip), or tap a button. Type *CANCEL* to exit the survey.`,
      [{ id: 'sv_apply', title: '✅ Apply' }, { id: 'sv_skip', title: '❌ Skip' }])
    return
  }

  // Apply → fetch dishes for this slot
  if (choice === 'apply') {
    const appSettings = await loadAppSettingsCached(state)
    const menuMap = await loadMenuMap(weekId)
    const menu = menuForDay(menuMap, day)
    const dishList = (menu ? menu[meal === 'l' ? 'lunch' : 'dinner'] : []) || []
    dayData[`${meal}_status`] = 'Applied'
    const dd = (state.day_data as Record<string, Record<string, unknown>> || {})
    dd[day] = dayData
    state.day_data = dd

    // Save the day row immediately (status) so progress persists
    try {
      await saveSurveyDay(member, weekId, day, dayData, existingDay, false)
    } catch {
      await waSendText(waPhone, '⚠️ Save failed — please try again in a moment.')
      return
    }

    if (dishList.length) {
      state.dish_list = dishList.slice(0, 5)
      await askDishValues(waPhone, member, state, day, meal, dishList.slice(0, 5))
    } else {
      state.index = idx + 1
      await setSession(waPhone, state)
      await waSendText(waPhone, `✅ Saved ${mealLabel(day, meal)}`)
      await askCurrentMeal(waPhone, member, state, existingRows)
    }
    return
  }

  // Skip
  dayData[`${meal}_status`] = 'Skipped'
  const dd = (state.day_data as Record<string, Record<string, unknown>> || {})
  dd[day] = dayData
  state.day_data = dd
  try {
    await saveSurveyDay(member, weekId, day, dayData, existingDay, false)
  } catch {
    await waSendText(waPhone, '⚠️ Save failed — please try again in a moment.')
    return
  }
  state.index = idx + 1
  await setSession(waPhone, state)
  await waSendText(waPhone, `❌ Skipped ${mealLabel(day, meal)}`)
  await askCurrentMeal(waPhone, member, state, existingRows)
}

// ── Feedback flow input handling ──
async function handleFeedbackInput(waPhone: string, member: MemberRow, state: Record<string, unknown>, incoming: { text: string; buttonId: string | null }) {
  const text = incoming.text
  const lower = text.trim().toLowerCase()
  if (state.step === 'meal') {
    const choice = incoming.buttonId === 'fb_lunch' || lower === 'lunch' || lower === '1' || lower.includes('lunch') ? 'lunch'
      : incoming.buttonId === 'fb_dinner' || lower === 'dinner' || lower === '2' || lower.includes('dinner') ? 'dinner'
      : null
    if (!choice) {
      await waSendButtons(waPhone, 'Which meal would you like to rate?',
        [{ id: 'fb_lunch', title: '🍛 Lunch' }, { id: 'fb_dinner', title: '🌙 Dinner' }])
      return
    }
    state.fb_meal = choice
    await feedbackStarPrompt(waPhone, state)
    return
  }
  if (state.step === 'stars') {
    const stars = parseInt(lower, 10)
    if (isNaN(stars) || stars < 1 || stars > 5) {
      await waSendText(waPhone, 'Please reply with a rating *1–5* (1 = Poor, 5 = Excellent).')
      return
    }
    state.fb_stars = stars
    await waSendText(waPhone, '💬 Any comment? (optional — reply *-* to skip)')
    state.step = 'comment'
    await setSession(waPhone, state)
    return
  }
  if (state.step === 'comment') {
    const comment = (text.trim() === '-' || text.trim().toLowerCase() === 'skip') ? '' : text.trim().slice(0, 500)
    await saveFeedback(waPhone, member, state, Number(state.fb_stars || 0), comment)
    return
  }
  await clearSession(waPhone)
  await waSendText(waPhone, 'Feedback flow reset. Type *FEEDBACK* to try again.')
}

// ── Stop/resume flow input handling ──
async function handleThaliFlowInput(waPhone: string, member: MemberRow, state: Record<string, unknown>, incoming: { text: string; buttonId: string | null }) {
  const text = incoming.text
  const lower = text.trim().toLowerCase()
  if (state.step === 'meal') {
    const choice = incoming.buttonId === 'tr_lunch' || lower.includes('lunch') || lower === '2' ? 'lunch'
      : incoming.buttonId === 'tr_dinner' || lower.includes('dinner') || lower === '3' ? 'dinner'
      : incoming.buttonId === 'tr_both' || lower.includes('both') || lower === '1' ? 'both'
      : null
    if (!choice) {
      await waSendButtons(waPhone, 'Which meals?', [{ id: 'tr_both', title: '🍽️ Both' }, { id: 'tr_lunch', title: '🍛 Lunch' }, { id: 'tr_dinner', title: '🌙 Dinner' }])
      return
    }
    state.tr_meal = choice
    const kind = state.kind === 'resume' ? 'resume' : 'stop'
    await waSendText(waPhone,
      kind === 'stop'
        ? '📅 From which date? Reply *today*, *tomorrow* or a date (YYYY-MM-DD).\nTo also set an end date: *2026-10-10 to 2026-10-20*\n(leave out "to" to stop until further notice).'
        : '📅 Resume from which date? Reply *today*, *tomorrow* or a date (YYYY-MM-DD).')
    state.step = 'dates'
    await setSession(waPhone, state)
    return
  }
  if (state.step === 'dates') {
    let fromDate: string | null = null
    let toDate: string | null = null
    const toMatch = lower.match(/\b(?:to|till|until)\s+(.+)$/)
    const base = toMatch ? lower.slice(0, toMatch.index).trim() : lower
    if (toMatch) {
      toDate = parseDateInput(toMatch[1], tzNow())
      if (!toDate) {
        await waSendText(waPhone, '⚠️ I couldn\'t read the end date. Try: *2026-10-10 to 2026-10-20*')
        return
      }
    }
    fromDate = parseDateInput(base, tzNow())
    if (!fromDate) {
      await waSendText(waPhone, '⚠️ I couldn\'t read the date. Reply *today*, *tomorrow* or YYYY-MM-DD.')
      return
    }
    if (toDate && toDate < fromDate) {
      await waSendText(waPhone, '⚠️ The end date is before the start date. Try again, e.g. *2026-10-10 to 2026-10-20*.')
      return
    }
    await saveThaliRequest(waPhone, member, state, fromDate, toDate)
    return
  }
  await clearSession(waPhone)
  await waSendText(waPhone, 'Request flow reset. Type *STOP* or *RESUME* to try again.')
}

// ═══════════════════════════════════════════════════════════════
// Webhook
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  const url = new URL(req.url)

  // ── Meta webhook verification (GET) ──
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && token && token === WA_VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 })
    }
    return new Response(JSON.stringify({ ok: true, service: 'whatsapp-bot' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const rawBody = await req.text()
  if (!(await verifySignature(rawBody, req.headers.get('x-hub-signature-256'), WA_APP_SECRET))) {
    console.warn('[whatsapp-bot] invalid signature — rejecting')
    return new Response(JSON.stringify({ ok: false, error: 'invalid signature' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const entries = (body.entry as Array<Record<string, unknown>>) || []
    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) || []
      for (const change of changes) {
        const value = (change.value as Record<string, unknown>) || {}
        const messages = (value.messages as Array<Record<string, unknown>>) || []
        for (const msg of messages) {
          const waPhone = String(msg.from || '')
          const msgId = String(msg.id || '')
          if (!waPhone) continue

          // Dedupe webhook retries
          const session0 = await getSession(waPhone)
          if (msgId && session0.last_msg_id === msgId) continue

          // Extract text / button reply
          let text = ''
          let buttonId: string | null = null
          const type = String(msg.type || '')
          if (type === 'text') text = String((msg.text as Record<string, unknown>)?.body || '')
          else if (type === 'interactive') {
            const interactive = (msg.interactive as Record<string, unknown>) || {}
            const reply = (interactive.button_reply as Record<string, unknown>) || (interactive.list_reply as Record<string, unknown>) || null
            if (reply) {
              buttonId = String(reply.id || '')
              text = String(reply.title || '')
            }
          } else if (type === 'button') {
            const btn = (msg.button as Record<string, unknown>) || {}
            buttonId = String(btn.payload || '')
            text = String(btn.text || '')
          } else {
            // unsupported message types (media, location…) — nudge to text
            await waMarkRead(msgId)
            await waSendText(waPhone, '🤖 I can only read text messages for now. Please type your request, or *HELP* for options.')
            await setSession(waPhone, session0.state || {}, msgId)
            continue
          }

          await waMarkRead(msgId)

          // Resolve member + route
          const { member } = await getMemberByWaPhone(waPhone)
          try {
            await routeMessage(waPhone, member, session0, { text, buttonId, msgId })
          } catch (e) {
            console.error('[whatsapp-bot] routeMessage failed:', e)
            await notifyAdmins(`Chat with ${waPhone} failed: ${e instanceof Error ? e.message : String(e)}`)
            await waSendText(waPhone, '⚠️ Something went wrong on our side. Please try again in a minute.')
          }
          // persist dedupe id with whatever state the flow left
          const sessionNow = await getSession(waPhone)
          await setSession(waPhone, sessionNow.state || {}, msgId)
        }
      }
    }
  } catch (e) {
    console.error('[whatsapp-bot] webhook processing error:', e)
  }

  // Always 200 so Meta doesn't retry indefinitely
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
