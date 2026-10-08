// ═══════════════════════════════════════════════════════════════
// AL-MAWAID — WhatsApp QR Bot Service
// Connects to WhatsApp via QR code scan (No Meta developer account needed)
// ═══════════════════════════════════════════════════════════════

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import pino from 'pino'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  DAYS, DAY_KEYS, STAR_LABELS,
  toLocalDateStr, weekdayName, calendarWeekMonday,
  parseDishArray, menuForDay, resolveServingWeekId,
  normalizePhone,
} from './logic.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://pquusffhuholbnlmuyen.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdXVzZmZodWhvbGJubG11eWVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzc3MTM5MCwiZXhwIjoyMDk5MzQ3MzkwfQ.iv-bPxHFZ2mtzJkfRu_3gTYmK70tu_rvuyrAxhkQiXw'
const TZ_OFFSET_MIN = parseInt(process.env.WHATSAPP_TZ_OFFSET_MIN || '330', 10)

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function tzNow() {
  return new Date(Date.now() + TZ_OFFSET_MIN * 60_000)
}

async function loadAppSettings() {
  const { data } = await supabase.from('app_settings').select('key, value')
  const out = {}
  for (const row of data || []) out[row.key] = row.value
  return out
}

async function loadMenuMap(weekId) {
  const { data } = await supabase.from('weekly_menu').select('day_name, lunch, dinner').eq('week_start', weekId)
  const map = {}
  for (const row of data || []) {
    const key = String(row.day_name).substring(0, 3).toLowerCase()
    map[key] = { lunch: parseDishArray(row.lunch), dinner: parseDishArray(row.dinner) }
  }
  return map
}

async function getWhatsappUser(waPhone) {
  const { data } = await supabase.from('whatsapp_users').select('*').eq('wa_phone', waPhone).maybeSingle()
  return data || null
}

async function getMemberByWaPhone(waPhone) {
  const link = await getWhatsappUser(waPhone)
  if (link?.user_id) {
    const { data } = await supabase.from('user_stats').select('user_id, name, email, thali_number, phone, role, custom_due_amount, payment_exempt').eq('user_id', link.user_id).maybeSingle()
    if (data) return { member: data, linked: true }
    await supabase.from('whatsapp_users').delete().eq('wa_phone', waPhone)
  }
  const { data: members } = await supabase.from('user_stats').select('user_id, name, email, thali_number, phone, role, custom_due_amount, payment_exempt')
  const want = normalizePhone(waPhone)
  if (want) {
    const hit = (members || []).find(m => m.phone && normalizePhone(m.phone) === want)
    if (hit) {
      await linkMember(waPhone, hit)
      return { member: hit, linked: true }
    }
  }
  return { member: null, linked: false }
}

async function linkMember(waPhone, member) {
  await supabase.from('whatsapp_users').upsert({
    wa_phone: waPhone,
    user_id: member.user_id,
    thali_number: member.thali_number != null ? String(member.thali_number) : null,
    name: member.name || '',
    updated_at: new Date().toISOString(),
  })
}

async function findMemberByThali(thaliNo) {
  const clean = String(thaliNo).replace(/^[#\s]+|[#\s]+$/g, '').trim()
  if (!clean) return null

  // 1. Direct case-insensitive match
  const { data: direct } = await supabase
    .from('user_stats')
    .select('user_id, name, email, thali_number, phone, role, custom_due_amount, payment_exempt')
    .ilike('thali_number', clean)
    .maybeSingle()
  if (direct) return direct

  // 2. Normalized matching (ignoring spaces, dashes, dots, underscores, case)
  const norm = clean.replace(/[\s\-_.]/g, '').toLowerCase()
  const { data: all } = await supabase
    .from('user_stats')
    .select('user_id, name, email, thali_number, phone, role, custom_due_amount, payment_exempt')

  if (all && all.length) {
    const match = all.find(u => {
      const uNorm = String(u.thali_number || '').replace(/[\s\-_.]/g, '').toLowerCase()
      return uNorm === norm
    })
    if (match) return match
  }
  return null
}

async function getSession(waPhone) {
  const { data } = await supabase.from('whatsapp_sessions').select('*').eq('wa_phone', waPhone).maybeSingle()
  return data || { wa_phone: waPhone, state: {}, last_msg_id: null }
}

async function setSession(waPhone, state, lastMsgId = null) {
  await supabase.from('whatsapp_sessions').upsert({
    wa_phone: waPhone,
    state: state || {},
    last_msg_id: lastMsgId,
    updated_at: new Date().toISOString(),
  })
}

async function clearSession(waPhone) {
  await supabase.from('whatsapp_sessions').delete().eq('wa_phone', waPhone)
}

function renderMenuCard(dayKey, dayMenu, title) {
  if (!dayMenu) return `*${title}*\n_No menu published yet._`
  const formatList = (arr) => arr.length ? arr.map(x => `  • ${x}`).join('\n') : '  _(no items)_'
  return `🍽️ *${title}*\n\n*Lunch:*\n${formatList(dayMenu.lunch)}\n\n*Dinner:*\n${formatList(dayMenu.dinner)}`
}

function helpText(memberName, thaliNumber) {
  const tag = thaliNumber ? `(Thali #${thaliNumber})` : ''
  return `👋 *Al-Mawaid Assistant* ${tag}\n\n` +
    `*Available Commands:*\n` +
    `• *MENU* — Today's thali menu\n` +
    `• *TOMORROW* — Tomorrow's menu\n` +
    `• *FEEDBACK* — Rate today's Lunch or Dinner\n` +
    `• *DUES* — View complete dues, paid amount & balance\n` +
    `• *QUERY* — Ask a question to admin\n` +
    `• *CANCEL* — Cancel current action`
}

// ═══════════════════════════════════════════════════════════════
// Message Processing Handler
// ═══════════════════════════════════════════════════════════════

async function handleMessage(waPhone, rawText) {
  const text = (rawText || '').trim()
  const upper = text.toUpperCase()

  const { member, linked } = await getMemberByWaPhone(waPhone)
  const session = await getSession(waPhone)
  const state = session.state || {}

  // Explicit LINK command (works anytime)
  const linkPrefixMatch = text.match(/^(?:link|thali)\s*[:#]?\s*([a-zA-Z0-9\-_\s]+)$/i)
  if (linkPrefixMatch) {
    const candidateThali = linkPrefixMatch[1].trim()
    const found = await findMemberByThali(candidateThali)
    if (found) {
      await linkMember(waPhone, found)
      return `✅ *Linked Successfully!*\nWelcome *${found.name || 'Member'}* — Thali #${found.thali_number}.\n\n` + helpText(found.name, found.thali_number)
    } else {
      return `❌ Thali *#${candidateThali}* was not found in Al-Mawaid records. Please check the spelling/format (e.g. \`A-12\`, \`123\`) or contact the admin.`
    }
  }

  // 1. Unlinked flow
  if (!member || !linked) {
    const isStandardCommand = ['MENU', 'TODAY', 'TOMORROW', 'FEEDBACK', 'DUES', 'PAYMENTS', 'QUERY', 'HELP', 'CANCEL'].includes(upper)
    const cleanThali = text.replace(/^[#\s]+|[#\s]+$/g, '').trim()

    if (!isStandardCommand && cleanThali.length >= 1 && cleanThali.length <= 15) {
      const found = await findMemberByThali(cleanThali)
      if (found) {
        await linkMember(waPhone, found)
        return `✅ *Linked Successfully!*\nWelcome *${found.name || 'Member'}* — Thali #${found.thali_number}.\n\n` + helpText(found.name, found.thali_number)
      } else if (/^[a-zA-Z0-9\-_]+$/.test(cleanThali)) {
        return `❌ Thali *#${cleanThali}* was not found in Al-Mawaid records. Please check your thali number or contact the admin.`
      }
    }
    return `👋 *Welcome to Al-Mawaid!*\n\nTo get started, please reply with your *Thali Number* (e.g. \`123\` or \`A-45\`) to link your WhatsApp.`
  }

  // 2. Global cancel
  if (upper === 'CANCEL' || upper === 'EXIT' || upper === 'STOP FLOW') {
    if (state.flow) {
      await clearSession(waPhone)
      return `❌ Action cancelled.\n\n` + helpText(member.name, member.thali_number)
    }
  }

  // 3. Active Multi-step Flows: FEEDBACK (Meal -> Rating -> Comments)
  if (state.flow === 'feedback') {
    // Step 1: Select Meal Type (Lunch or Dinner)
    if (state.step === 'meal_type') {
      const low = text.toLowerCase()
      let meal = null
      if (['1', 'lunch', 'l', 'dupahr', 'dopahar'].includes(low)) {
        meal = 'lunch'
      } else if (['2', 'dinner', 'd', 'raat', 'night'].includes(low)) {
        meal = 'dinner'
      }

      if (!meal) {
        return `Please choose which meal to rate:\n\n1️⃣ *Lunch*\n2️⃣ *Dinner*\n\n_(Reply with *1* for Lunch, *2* for Dinner, or type CANCEL to exit)_`
      }

      state.meal = meal
      state.step = 'rating'
      await setSession(waPhone, state)
      const mealTitle = meal === 'lunch' ? 'Lunch ☀️' : 'Dinner 🌙'
      return `⭐ Rate today's *${mealTitle}*:\n\nPlease reply with a number from *1 to 5*:\n\n` +
        `1 = 😞 Poor\n2 = 😐 Fair\n3 = 🙂 Good\n4 = 😄 Great\n5 = 🤩 Excellent\n\n_(Or type CANCEL to exit)_`
    }

    // Step 2: Rate (1 to 5 stars)
    if (state.step === 'rating') {
      const num = parseInt(text.charAt(0), 10)
      if (isNaN(num) || num < 1 || num > 5) {
        const mealTitle = state.meal === 'lunch' ? 'Lunch' : 'Dinner'
        return `Please rate ${mealTitle} with a number from *1* to *5* stars (1 = Poor, 5 = Excellent):`
      }
      state.stars = num
      state.step = 'comment'
      await setSession(waPhone, state)
      const mealTitle = state.meal === 'lunch' ? 'Lunch' : 'Dinner'
      return `⭐ *${STAR_LABELS[num]}*\n\nAny comments or suggestions for *${mealTitle}*?\n_(Reply with your comments, or type *-* to skip)_:`
    }

    // Step 3: Submit Comments
    if (state.step === 'comment') {
      const comment = (text === '-' || upper === 'SKIP') ? '' : text
      const now = tzNow()
      const weekId = calendarWeekMonday(now)
      const fullDay = weekdayName(now).toLowerCase()

      const payload = {
        user_id: member.user_id,
        day: fullDay,
        week_id: weekId,
        created_at: new Date().toISOString(),
      }

      if (state.meal === 'lunch') {
        payload.lunch_stars = state.stars
        payload.lunch_emoji = STAR_LABELS[state.stars] || ''
        payload.lunch_comment = comment || null
      } else {
        payload.dinner_stars = state.stars
        payload.dinner_emoji = STAR_LABELS[state.stars] || ''
        payload.dinner_comment = comment || null
      }

      await supabase.from('daily_feedback').upsert(payload, { onConflict: 'user_id,day,week_id' })

      // Push notification to admins
      try {
        const userName = `${member.name || 'Member'} (Thali #${member.thali_number || '—'})`
        const mealName = state.meal === 'lunch' ? 'Lunch' : 'Dinner'
        await supabase.functions.invoke('send-push', {
          body: {
            title: `⭐ New ${mealName} Feedback from ${userName}`,
            body: `${STAR_LABELS[state.stars] || state.stars + '★'}: "${comment || 'No comment'}"`,
            target_type: 'admins',
            notify_in_app: true,
            type: 'feedback',
            sender_name: 'WhatsApp Bot',
            url: '/admin/feedback',
          }
        })
      } catch (e) {
        // notification failure should not block user response
      }

      await clearSession(waPhone)
      const dayDisplayName = fullDay.charAt(0).toUpperCase() + fullDay.slice(1)
      const mealDisplayName = state.meal === 'lunch' ? 'Lunch' : 'Dinner'
      return `🙏 *Thank you for your feedback!*\nYour *${mealDisplayName}* review for ${dayDisplayName} (${state.stars}★) has been recorded and submitted to the Admin Portal.`
    }
  }

  // Active Multi-step Flows: QUERY
  if (state.flow === 'query') {
    if (text) {
      const comment = text.trim()
      const subject = comment.length > 50 ? comment.substring(0, 47) + '...' : comment

      await supabase.from('queries').insert({
        user_id: member.user_id,
        subject: subject,
        comment: comment,
        status: 'open',
      })

      // Push notification to admins for Query
      try {
        const userName = `${member.name || 'A Member'} (Thali #${member.thali_number || '—'})`
        await supabase.functions.invoke('send-push', {
          body: {
            title: '📩 New Query from ' + userName,
            body: userName + ': "' + comment.substring(0, 80) + (comment.length > 80 ? '…"' : '"'),
            target_type: 'admins',
            notify_in_app: true,
            type: 'new_query',
            sender_name: 'WhatsApp Bot',
            url: '/admin/queries'
          }
        })
      } catch (e) {
        // notification failure should not block chat
      }

      await clearSession(waPhone)
      return `📨 *Query Received!*\nYour message has been sent directly to the Admin Portal. The administration team will review and reply soon.`
    }
  }

  // 4. Command Router

  if (upper === 'MENU' || upper === "TODAY" || upper === "TODAY'S MENU") {
    const now = tzNow()
    const appSettings = await loadAppSettings()
    const servingWeek = resolveServingWeekId(appSettings, now)
    const menuMap = await loadMenuMap(servingWeek)
    const dayKey = DAY_KEYS[now.getUTCDay() === 0 ? 0 : now.getUTCDay() - 1] || 'mon'
    const dayMenu = menuForDay(menuMap, dayKey)
    const dayName = weekdayName(now)
    return renderMenuCard(dayKey, dayMenu, `Today's Menu (${dayName.toUpperCase()})`)
  }

  if (upper === 'TOMORROW' || upper === "TOMORROW'S MENU") {
    const now = tzNow()
    const tomorrow = new Date(now.getTime() + 86400_000)
    const appSettings = await loadAppSettings()
    const servingWeek = resolveServingWeekId(appSettings, tomorrow)
    const menuMap = await loadMenuMap(servingWeek)
    const dayKey = DAY_KEYS[tomorrow.getUTCDay() === 0 ? 0 : tomorrow.getUTCDay() - 1] || 'mon'
    const dayMenu = menuForDay(menuMap, dayKey)
    const dayName = weekdayName(tomorrow)
    return renderMenuCard(dayKey, dayMenu, `Tomorrow's Menu (${dayName.toUpperCase()})`)
  }

  if (upper === 'FEEDBACK' || upper === 'RATE') {
    await setSession(waPhone, { flow: 'feedback', step: 'meal_type' })
    return `⭐ *Daily Meal Feedback*\nWhich meal would you like to rate for today?\n\n1️⃣ *Lunch*\n2️⃣ *Dinner*\n\n_(Reply with *1* for Lunch, *2* for Dinner, or type CANCEL to exit)_`
  }

  if (upper === 'DUES' || upper === 'PAYMENTS' || upper === 'PAYMENT') {
    const appSettings = await loadAppSettings()
    const { data: payments } = await supabase
      .from('user_payments')
      .select('*')
      .eq('user_id', member.user_id)
      .order('created_at', { ascending: false })

    const validPayments = (payments || []).filter(p => p.status !== 'rejected')
    const totalPaid = validPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)

    let totalDue = Number(appSettings.default_payment_due || 1500)
    if (member.payment_exempt) {
      totalDue = 0
    } else if (member.custom_due_amount != null) {
      totalDue = Number(member.custom_due_amount)
    }

    const pendingBalance = Math.max(0, totalDue - totalPaid)
    const paymentTitle = appSettings.payment_title || 'Monthly Thali Contribution'
    const upiId = appSettings.upi_id || 'murtazacool558@okhdfcbank'
    const payeeName = appSettings.upi_payee_name || 'Al-Mawaid'

    let statusLine = ''
    if (member.payment_exempt) {
      statusLine = '🛡️ *Status:* Payment Exempt'
    } else if (pendingBalance === 0 && totalPaid >= totalDue) {
      statusLine = '✅ *Status:* All Dues Cleared'
    } else {
      statusLine = `⏳ *Status:* ₹${pendingBalance.toLocaleString('en-IN')} Pending`
    }

    let historyText = ''
    if (validPayments.length > 0) {
      historyText = '\n📜 *Recent Payment History:*\n' + validPayments.slice(0, 3).map(p => {
        const dt = new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        const st = p.status === 'verified' ? '✅ Verified' : '⏳ Recorded'
        return `• ₹${Number(p.amount).toLocaleString('en-IN')} on ${dt} (${st})`
      }).join('\n') + '\n'
    }

    return `💳 *Thali Contribution & Dues*\n` +
      `Thali: *#${member.thali_number || 'N/A'}*\n` +
      `Name: *${member.name || 'Member'}*\n\n` +
      `📋 *Contribution Summary:*\n` +
      `• *Purpose:* ${paymentTitle}\n` +
      `• *Total Required Due:* ₹${totalDue.toLocaleString('en-IN')}\n` +
      `• *Total Amount Paid:* ₹${totalPaid.toLocaleString('en-IN')}\n` +
      `• *Remaining Balance:* ₹${pendingBalance.toLocaleString('en-IN')}\n\n` +
      `${statusLine}\n` +
      historyText +
      `\n📲 *UPI Payment Details:*\n` +
      `• UPI ID: \`${upiId}\`\n` +
      `• Payee: *${payeeName}*`
  }

  if (upper === 'QUERY' || upper === 'HELP QUERY' || upper === 'SUPPORT') {
    await setSession(waPhone, { flow: 'query', step: 'text' })
    return `💬 *Support & Query*\nPlease type your message or question below, and it will be sent directly to the Jamaat admin team:`
  }

  // Fallback / Help
  return helpText(member.name, member.thali_number)
}

// ═══════════════════════════════════════════════════════════════
// Baileys Socket Runner
// ═══════════════════════════════════════════════════════════════

async function startBot() {
  const authDir = path.join(__dirname, 'auth_info_baileys')
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const { version } = await fetchLatestBaileysVersion()

  console.log('🤖 Starting Al-Mawaid WhatsApp Bot...')
  console.log(`📡 Baileys version: ${version.join('.')}`)

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('\n═══════════════════════════════════════════════════════════════')
      console.log('📱 SCAN THIS QR CODE WITH YOUR WHATSAPP TO CONNECT THE BOT:')
      console.log('   (WhatsApp > Settings > Linked Devices > Link a Device)')
      console.log('═══════════════════════════════════════════════════════════════\n')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      console.log('⚠️ Connection closed. Reconnecting:', shouldReconnect)
      if (shouldReconnect) {
        setTimeout(startBot, 3000)
      }
    } else if (connection === 'open') {
      console.log('✅ AL-MAWAID WHATSAPP BOT IS ONLINE & READY!')
    }
  })

  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (m.type !== 'notify') return
      for (const msg of m.messages) {
        if (!msg.message || msg.key.fromMe) continue
        const remoteJid = msg.key.remoteJid || ''
        if (remoteJid.endsWith('@g.us')) continue // Ignore group messages

        const waPhone = remoteJid.replace('@s.whatsapp.net', '')
        const rawText = msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption || ''

        if (!rawText.trim()) continue

        console.log(`📩 Incoming message from ${waPhone}: "${rawText}"`)

        // Generate response
        const reply = await handleMessage(waPhone, rawText)
        if (reply) {
          await sock.sendMessage(remoteJid, { text: reply })
          console.log(`📤 Replied to ${waPhone}`)
        }
      }
    } catch (err) {
      console.error('Error handling message:', err)
    }
  })
}

startBot().catch(console.error)
