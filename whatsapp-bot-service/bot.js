// ═══════════════════════════════════════════════════════════════
// AL-MAWAID — Royal WhatsApp Interactive Portal Bot (24/7 Direct)
// Zero 3rd-Party API • Low-Latency Caching • 8 Interactive Modes
// ═══════════════════════════════════════════════════════════════

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import pino from 'pino'
import http from 'http'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  DAYS, DAY_KEYS, STAR_LABELS,
  weekdayName, calendarWeekMonday, toLocalDateStr, addDaysStr,
  parseDishArray, menuForDay, resolveServingWeekId,
  getSurveyTargetWeek, isSurveyOpen, getSurveyWindowLabel, formatWeekRange,
  statusPill, parseDateInput, normalizePhone, getPoliteName,
} from './logic.js'

// Prevent crashes on transient socket disconnects or libsignal retry failures
process.on('uncaughtException', (err) => {
  console.warn('⚠️ [Process uncaughtException handled]:', err?.message || err)
})
process.on('unhandledRejection', (err) => {
  console.warn('⚠️ [Process unhandledRejection handled]:', err?.message || err)
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const PORT = process.env.PORT || 3000
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://pquusffhuholbnlmuyen.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdXVzZmZodWhvbGJubG11eWVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzc3MTM5MCwiZXhwIjoyMDk5MzQ3MzkwfQ.iv-bPxHFZ2mtzJkfRu_3gTYmK70tu_rvuyrAxhkQiXw'
const TZ_OFFSET_MIN = parseInt(process.env.WHATSAPP_TZ_OFFSET_MIN || '330', 10)

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Live Bot & Performance Telemetry ──
let activeSock = null
let latestQr = null
let latestQrDataUrl = null
let botStatus = 'connecting' // 'waiting_qr' | 'online' | 'reconnecting'
let connectedUser = null
let lastPairingCode = null
const metrics = {
  startedAt: Date.now(),
  messagesProcessed: 0,
  totalLatencyMs: 0,
  lastLatencyMs: 0,
  lastMessageAt: null,
}

// ── Fast In-Memory TTL Cache (eliminates repeated DB round-trips) ──
const memCache = new Map()
function cacheGet(key) {
  const entry = memCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.exp) {
    memCache.delete(key)
    return null
  }
  return entry.val
}
function cacheSet(key, val, ttlMs = 60_000) {
  memCache.set(key, { val, exp: Date.now() + ttlMs })
  return val
}
function cacheDel(key) {
  memCache.delete(key)
}

// ── Message Deduplication & Per-Chat Serialization ──
const seenMsgIds = new Set()
const chatQueues = new Map()
function enqueueForChat(waPhone, fn) {
  const prev = chatQueues.get(waPhone) || Promise.resolve()
  const next = prev.then(fn, fn).finally(() => {
    if (chatQueues.get(waPhone) === next) chatQueues.delete(waPhone)
  })
  chatQueues.set(waPhone, next)
  return next
}

async function requestPairing(phoneInput) {
  if (!activeSock) throw new Error('WhatsApp bot is initializing. Please wait a moment.')
  const digits = String(phoneInput || '').replace(/[^\d]/g, '')
  if (digits.length < 10) throw new Error('Please enter a valid 10 or 12 digit phone number.')
  const formatted = digits.length === 10 ? '91' + digits : digits
  const code = await activeSock.requestPairingCode(formatted)
  lastPairingCode = { code, phone: formatted, at: new Date().toISOString() }
  console.log(`\n🔑 PAIRING CODE FOR +${formatted}: ${code}\n`)
  return { code, phone: formatted }
}

async function relinkSession() {
  console.log('🔄 Relink requested: resetting session and cleaning auth directory...')
  botStatus = 'waiting_qr'
  latestQr = null
  latestQrDataUrl = null
  connectedUser = null
  lastPairingCode = null
  memCache.clear()

  if (activeSock) {
    try {
      activeSock.ev.removeAllListeners('connection.update')
      activeSock.ev.removeAllListeners('messages.upsert')
      activeSock.ev.removeAllListeners('creds.update')
      await activeSock.logout().catch(() => {})
      activeSock.end(new Error('Relink session requested'))
    } catch (e) {
      console.warn('Socket termination warning:', e)
    }
    activeSock = null
  }

  const authDir = path.join(__dirname, 'auth_info_baileys')
  try {
    if (fs.existsSync(authDir)) {
      for (const f of fs.readdirSync(authDir)) {
        try { fs.unlinkSync(path.join(authDir, f)) } catch {}
      }
    }
  } catch (err) {
    console.warn('Failed clearing auth dir:', err)
  }

  setTimeout(() => {
    startBot().catch(e => console.error('Failed to restart bot after relink:', e))
  }, 800)
}

function extractMessageText(message) {
  if (!message) return ''
  let m = message
  if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message
  if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message
  if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message
  if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message
  if (m.editedMessage?.message?.protocolMessage?.editedMessage) {
    m = m.editedMessage.message.protocolMessage.editedMessage
  }

  const text = (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    m.templateButtonReplyMessage?.selectedId ||
    m.listResponseMessage?.title ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.interactiveResponseMessage?.body?.text ||
    ''
  )
  return String(text || '').trim()
}

// ═══════════════════════════════════════════════════════════════
// Royal Gold & Emerald Web Control Panel
// ═══════════════════════════════════════════════════════════════

function renderDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Al-Mawaid Royal WhatsApp Bot (24/7 Direct)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: radial-gradient(circle at top right, #0f1f1a 0%, #070b12 55%, #05070c 100%);
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 28px 16px;
    }
    .container { max-width: 960px; width: 100%; }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 24px; padding-bottom: 18px;
      border-bottom: 1px solid rgba(212,175,55,0.22);
      flex-wrap: wrap; gap: 16px;
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-icon {
      width: 50px; height: 50px; border-radius: 14px;
      background: linear-gradient(135deg, #d4af37 0%, #936c28 100%);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; box-shadow: 0 8px 24px rgba(212,175,55,0.28);
    }
    .brand h1 { font-size: 21px; font-weight: 800; color: #fff; letter-spacing: -0.02em; }
    .brand p { font-size: 13px; color: #d4af37; font-weight: 600; }
    .badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 16px; border-radius: 999px; font-size: 13px; font-weight: 700;
    }
    .badge-online { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.35); }
    .badge-qr { background: rgba(212,175,55,0.15); color: #fbbf24; border: 1px solid rgba(212,175,55,0.4); }
    .badge-connecting { background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.35); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }

    .stats-strip {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px;
    }
    @media (max-width: 700px) { .stats-strip { grid-template-columns: repeat(2, 1fr); } }
    .stat-pill {
      background: rgba(17,24,39,0.85); border: 1px solid rgba(212,175,55,0.18);
      border-radius: 14px; padding: 14px 16px;
    }
    .stat-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
    .stat-val { font-size: 20px; font-weight: 800; color: #fef3c7; margin-top: 4px; font-family: 'JetBrains Mono', monospace; }

    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 22px; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }

    .card {
      background: rgba(15,23,42,0.85);
      border: 1px solid rgba(212,175,55,0.2);
      border-radius: 20px; padding: 24px;
      display: flex; flex-direction: column;
    }
    .card h2 { font-size: 17px; font-weight: 700; margin-bottom: 8px; color: #fef3c7; display: flex; align-items: center; gap: 8px; }
    .card p.desc { font-size: 13px; color: #94a3b8; margin-bottom: 18px; line-height: 1.5; }
    .qr-box {
      background: #fff; border-radius: 16px; padding: 14px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px; width: 250px; height: 250px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.5);
    }
    .qr-box img { width: 100%; height: 100%; object-fit: contain; }
    .qr-placeholder { color: #64748b; font-size: 13px; text-align: center; }
    .input-row { display: flex; gap: 8px; margin-bottom: 12px; }
    .input-text {
      flex: 1; padding: 12px 14px; border-radius: 12px;
      background: #1e293b; border: 1px solid rgba(212,175,55,0.25);
      color: #fff; font-size: 14px; font-family: inherit;
    }
    .btn {
      padding: 12px 18px; border-radius: 12px; border: none;
      background: linear-gradient(135deg, #d4af37 0%, #a67c1e 100%);
      color: #05070c; font-weight: 800; font-size: 13px; cursor: pointer;
    }
    .btn-danger {
      background: rgba(239,68,68,0.16); color: #fca5a5; border: 1px solid rgba(239,68,68,0.35);
    }
    .modes-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
    .mode-item {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px; padding: 12px; font-size: 13px;
    }
    .mode-item strong { color: #fbbf24; display: block; margin-bottom: 2px; }
    .code-display {
      background: #090d16; border: 1px dashed rgba(212,175,55,0.5);
      border-radius: 12px; padding: 14px; text-align: center;
      font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 800;
      letter-spacing: 0.16em; color: #fbbf24; display: none; margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="brand-icon">🌙</div>
        <div>
          <h1>Al-Mawaid Royal WhatsApp Bot</h1>
          <p>24/7 Self-Hosted • Zero 3rd-Party API • Instant Cache Engine</p>
        </div>
      </div>
      <div id="statusBadge" class="badge badge-connecting"><span class="dot"></span><span>Connecting...</span></div>
    </div>

    <div class="stats-strip">
      <div class="stat-pill"><div class="stat-label">Messages</div><div class="stat-val" id="statMsgs">0</div></div>
      <div class="stat-pill"><div class="stat-label">Avg Speed</div><div class="stat-val" id="statAvg">— ms</div></div>
      <div class="stat-pill"><div class="stat-label">Last Reply</div><div class="stat-val" id="statLast">— ms</div></div>
      <div class="stat-pill"><div class="stat-label">Uptime</div><div class="stat-val" id="statUp">0m</div></div>
    </div>

    <div class="grid" id="linkGrid">
      <div class="card">
        <h2>📷 Link via QR Code</h2>
        <p class="desc">WhatsApp → Settings → Linked Devices → Link a Device</p>
        <div class="qr-box">
          <img id="qrImage" style="display:none;" alt="WhatsApp QR" />
          <div id="qrLoading" class="qr-placeholder">Waiting for QR code...</div>
        </div>
      </div>
      <div class="card">
        <h2>🔑 Link via Phone Number</h2>
        <p class="desc">Enter your 10-digit WhatsApp number to get an 8-digit pairing code.</p>
        <div class="input-row">
          <input type="text" id="phoneInput" class="input-text" placeholder="e.g. 9876543210" />
          <button id="pairBtn" class="btn" onclick="requestCode()">Get Code</button>
        </div>
        <div id="codeDisplay" class="code-display"></div>
        <div style="margin-top:auto; padding-top:16px;">
          <button id="relinkBtn" class="btn btn-danger" onclick="relink()">🔄 Reset / Relink Device</button>
        </div>
      </div>
    </div>

    <div class="card" id="onlineCard" style="display:none; margin-bottom:22px;">
      <h2>✅ Bot Connected & Running 24/7</h2>
      <p class="desc" id="onlinePhone">Active WhatsApp session is live.</p>
      <div><button id="relinkBtn2" class="btn btn-danger" onclick="relink()">🔄 Switch / Relink Device</button></div>
    </div>

    <div class="card">
      <h2>✦ Active Royal Portal Modes</h2>
      <div class="modes-grid">
        <div class="mode-item"><strong>1 · Today's Menu</strong>Instant Lunch & Dinner dishes</div>
        <div class="mode-item"><strong>2 · Tomorrow's Menu</strong>Next serving day preview</div>
        <div class="mode-item"><strong>3 · Weekly Survey</strong>Status grid + 1-tap Apply/Skip</div>
        <div class="mode-item"><strong>4 · Stop / Resume</strong>Guided thali pause & resume</div>
        <div class="mode-item"><strong>5 · Rate Meal</strong>1–5★ meal feedback</div>
        <div class="mode-item"><strong>6 · Dues & Pay</strong>Balance, UPI & UTR verify</div>
        <div class="mode-item"><strong>7 · Ask Admin</strong>Direct Jamaat support ticket</div>
        <div class="mode-item"><strong>8 · My Thali</strong>Profile, Switch & Unlink</div>
      </div>
    </div>
  </div>

  <script>
    async function pollStatus() {
      try {
        const r = await fetch('/api/status');
        const d = await r.json();
        document.getElementById('statMsgs').textContent = d.metrics?.messagesProcessed ?? 0;
        document.getElementById('statAvg').textContent = (d.metrics?.avgLatencyMs ?? 0) + ' ms';
        document.getElementById('statLast').textContent = (d.metrics?.lastLatencyMs ?? 0) + ' ms';
        const mins = Math.floor((d.uptime || 0) / 60);
        document.getElementById('statUp').textContent = mins >= 60 ? Math.floor(mins/60) + 'h ' + (mins%60) + 'm' : mins + 'm';

        const badge = document.getElementById('statusBadge');
        if (d.status === 'online') {
          badge.className = 'badge badge-online';
          badge.innerHTML = '<span class="dot"></span><span>Online 24/7</span>';
          document.getElementById('linkGrid').style.display = 'none';
          document.getElementById('onlineCard').style.display = 'flex';
          if (d.connectedUser?.phone) {
            document.getElementById('onlinePhone').textContent = 'Connected Number: +' + d.connectedUser.phone;
          }
        } else if (d.status === 'waiting_qr') {
          badge.className = 'badge badge-qr';
          badge.innerHTML = '<span class="dot"></span><span>Scan QR to Connect</span>';
          document.getElementById('linkGrid').style.display = 'grid';
          document.getElementById('onlineCard').style.display = 'none';
          if (d.qrDataUrl) {
            document.getElementById('qrImage').src = d.qrDataUrl;
            document.getElementById('qrImage').style.display = 'block';
            document.getElementById('qrLoading').style.display = 'none';
          }
        } else {
          badge.className = 'badge badge-connecting';
          badge.innerHTML = '<span class="dot"></span><span>Reconnecting...</span>';
        }
      } catch {}
    }
    async function requestCode() {
      const phone = document.getElementById('phoneInput').value.trim();
      if (!phone) return;
      const btn = document.getElementById('pairBtn');
      btn.disabled = true;
      try {
        const r = await fetch('/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
        const d = await r.json();
        if (d.success) {
          const el = document.getElementById('codeDisplay');
          el.textContent = d.code;
          el.style.display = 'block';
        } else alert(d.error || 'Pairing failed');
      } finally { btn.disabled = false; }
    }
    async function relink() {
      await fetch('/api/relink', { method: 'POST' });
      setTimeout(pollStatus, 1000);
    }
    setInterval(pollStatus, 2000);
    pollStatus();
  </script>
</body>
</html>`
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (url.pathname === '/api/status') {
    const avgLatencyMs = metrics.messagesProcessed > 0
      ? Math.round(metrics.totalLatencyMs / metrics.messagesProcessed)
      : 0
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    return res.end(JSON.stringify({
      status: botStatus,
      qrDataUrl: latestQrDataUrl,
      connectedUser: connectedUser ? {
        id: connectedUser.id,
        phone: connectedUser.id ? connectedUser.id.split(':')[0] : null,
        name: connectedUser.name || 'Al-Mawaid Royal Bot'
      } : null,
      lastPairingCode,
      uptime: process.uptime(),
      metrics: {
        messagesProcessed: metrics.messagesProcessed,
        avgLatencyMs,
        lastLatencyMs: metrics.lastLatencyMs,
        lastMessageAt: metrics.lastMessageAt,
      }
    }))
  }

  if (url.pathname === '/api/pair' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body || '{}')
        const result = await requestPairing(parsed.phone)
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(JSON.stringify({ success: true, ...result }))
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(JSON.stringify({ success: false, error: err.message }))
      }
    })
    return
  }

  if ((url.pathname === '/api/relink' || url.pathname === '/api/reset' || url.pathname === '/api/logout') && req.method === 'POST') {
    await relinkSession()
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    return res.end(JSON.stringify({ success: true, message: 'Bot session reset cleanly. Generating fresh QR code.' }))
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      status: 'ok',
      botStatus,
      uptime: Math.round(process.uptime()),
      messagesProcessed: metrics.messagesProcessed,
      timestamp: new Date().toISOString()
    }))
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(renderDashboardHtml())
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not Found')
})

server.listen(PORT, () => {
  console.log(`🌐 Al-Mawaid Royal Bot Portal listening at http://localhost:${PORT}`)
})

// ═══════════════════════════════════════════════════════════════
// Fast Cached Data Helpers
// ═══════════════════════════════════════════════════════════════

function toWaJid(phone) {
  let digits = String(phone || '').replace(/[^\d]/g, '')
  if (digits.length === 10) digits = '91' + digits
  return `${digits}@s.whatsapp.net`
}

function tzNow() {
  return new Date(Date.now() + TZ_OFFSET_MIN * 60_000)
}

async function loadAppSettings() {
  const hit = cacheGet('app_settings')
  if (hit) return hit
  const { data } = await supabase.from('app_settings').select('key, value')
  const out = {}
  for (const row of data || []) out[row.key] = row.value
  return cacheSet('app_settings', out, 60_000)
}

async function loadAllMembersCached() {
  const hit = cacheGet('all_members')
  if (hit) return hit
  const { data } = await supabase
    .from('user_stats')
    .select('user_id, name, email, thali_number, phone, role, custom_due_amount, payment_exempt')
  return cacheSet('all_members', data || [], 60_000)
}

async function loadMenuMap(weekId) {
  const key = `menu:${weekId}`
  const hit = cacheGet(key)
  if (hit) return hit
  const { data } = await supabase.from('weekly_menu').select('day_name, lunch, dinner').eq('week_start', weekId)
  const map = {}
  for (const row of data || []) {
    const k = String(row.day_name).substring(0, 3).toLowerCase()
    map[k] = { lunch: parseDishArray(row.lunch), dinner: parseDishArray(row.dinner) }
  }
  return cacheSet(key, map, 60_000)
}

async function getPaymentManagerInfo() {
  const hit = cacheGet('payment_mgr')
  if (hit) return hit
  const appSettings = await loadAppSettings()
  let mgrPhone = appSettings.payment_manager_phone ? normalizePhone(appSettings.payment_manager_phone) : null
  let mgrUserId = null
  let mgrName = appSettings.payment_manager_name || 'Mulla Murtaza Mohammadhussain Hamid'

  const { data: managers } = await supabase
    .from('user_stats')
    .select('user_id, name, phone, email')
    .or('name.ilike.%Murtaza%Hamid%,name.ilike.%Mulla Murtaza%,email.ilike.%murtaza.mohammed.hamid%')
    .limit(1)

  if (managers && managers.length > 0) {
    if (!mgrPhone && managers[0].phone) mgrPhone = normalizePhone(managers[0].phone)
    mgrUserId = managers[0].user_id
    if (managers[0].name) mgrName = managers[0].name
  }
  if (!mgrPhone) mgrPhone = '6375250267'
  return cacheSet('payment_mgr', { mgrPhone, mgrUserId, mgrName }, 300_000)
}

function fireAdminPush(payload) {
  supabase.functions.invoke('send-push', { body: payload }).catch(err => {
    console.warn('[fireAdminPush] warning:', err?.message || err)
  })
}

async function notifyPaymentManager({ member, amount, utr, monthLabel, waPhone }) {
  const { mgrPhone } = await getPaymentManagerInfo()

  // Background in-app notice
  supabase
    .from('user_stats')
    .select('user_id')
    .or('name.ilike.%Murtaza%,email.ilike.%murtaza%,role.eq.admin,role.eq.payment_manager')
    .then(({ data: managers }) => {
      if (managers && managers.length > 0) {
        const notices = managers.map(mgr => ({
          title: '💳 New Thali Payment Received',
          body: `${member.name || 'Member'} (Thali #${member.thali_number || '—'}) paid ₹${Number(amount).toLocaleString('en-IN')} for ${monthLabel}. UTR: ${utr}. Recorded via WhatsApp Bot.`,
          sender_name: 'Al-Mawaid Royal Bot',
          target_user_id: mgr.user_id,
          tone: '#34d399',
          created_at: new Date().toISOString()
        }))
        return supabase.from('notices').insert(notices)
      }
    })
    .catch(() => {})

  // Background push
  fireAdminPush({
    title: `💳 Thali #${member.thali_number || '—'} Payment: ₹${Number(amount).toLocaleString('en-IN')}`,
    body: `${member.name || 'Member'} paid ₹${Number(amount).toLocaleString('en-IN')} for ${monthLabel}. UTR: ${utr}.`,
    target_type: 'admins',
    notify_in_app: true,
    type: 'new_payment',
    sender_name: 'Al-Mawaid Royal Bot',
    url: '/admin/payments'
  })

  // Direct WhatsApp alert to Manager
  if (activeSock && mgrPhone) {
    const mgrJid = toWaJid(mgrPhone)
    const tNum = String(member.thali_number || '—').trim()
    const alertMsg =
      `╭─ 🔔 *NEW PAYMENT ALERT* ─╮\n` +
      `│ ◈ Thali: *#${tNum}* (${getPoliteName(member.name)})\n` +
      `│ ◈ Amount: *₹${Number(amount).toLocaleString('en-IN')}*\n` +
      `│ ◈ Month: ${monthLabel}\n` +
      `│ ◈ UTR: \`${utr}\`\n` +
      `│ ◈ Phone: +${waPhone}\n` +
      `╰──────────────────────╯\n` +
      `▸ Quick Verify: *VERIFY ${utr}*`
    activeSock.sendMessage(mgrJid, { text: alertMsg }).catch(err => {
      console.error('[notifyPaymentManager] WhatsApp alert failed:', err)
    })
  }
}

async function getMemberByWaPhone(waPhone) {
  const cached = cacheGet(`wa_member:${waPhone}`)
  if (cached) return cached

  const { data: link } = await supabase.from('whatsapp_users').select('user_id').eq('wa_phone', waPhone).maybeSingle()
  if (link?.user_id) {
    const { data } = await supabase
      .from('user_stats')
      .select('user_id, name, email, thali_number, phone, role, custom_due_amount, payment_exempt')
      .eq('user_id', link.user_id)
      .maybeSingle()
    if (data) return cacheSet(`wa_member:${waPhone}`, { member: data, linked: true }, 120_000)
    await supabase.from('whatsapp_users').delete().eq('wa_phone', waPhone)
  }

  const members = await loadAllMembersCached()
  const want = normalizePhone(waPhone)
  if (want) {
    const hit = members.find(m => m.phone && normalizePhone(m.phone) === want)
    if (hit) {
      await linkMember(waPhone, hit)
      return cacheSet(`wa_member:${waPhone}`, { member: hit, linked: true }, 120_000)
    }
  }
  return { member: null, linked: false }
}

async function linkMember(waPhone, member) {
  cacheSet(`wa_member:${waPhone}`, { member, linked: true }, 120_000)
  await supabase.from('whatsapp_users').upsert({
    wa_phone: waPhone,
    user_id: member.user_id,
    thali_number: member.thali_number != null ? String(member.thali_number) : null,
    name: member.name || '',
    updated_at: new Date().toISOString(),
  })
}

async function unlinkMember(waPhone) {
  cacheDel(`wa_member:${waPhone}`)
  await Promise.all([
    supabase.from('whatsapp_users').delete().eq('wa_phone', waPhone),
    clearSession(waPhone),
  ])
}

async function findMemberByThali(thaliNo) {
  const clean = String(thaliNo || '').replace(/^[#\s]+|[#\s]+$/g, '').trim()
  if (!clean) return null
  const cleanLower = clean.toLowerCase()
  const norm = cleanLower.replace(/[\s\-_/\\#.]/g, '')

  const all = await loadAllMembersCached()
  if (all && all.length) {
    let hit = all.find(u => String(u.thali_number || '').trim().toLowerCase() === cleanLower)
    if (hit) return hit

    hit = all.find(u => String(u.thali_number || '').replace(/[\s\-_/\\#.]/g, '').toLowerCase() === norm)
    if (hit) return hit

    const cleanDigits = clean.replace(/[^\d]/g, '')
    if (cleanDigits.length > 0 && cleanDigits.length < 10) {
      hit = all.find(u => String(u.thali_number || '').trim() === cleanDigits)
      if (hit) return hit
    }

    if (cleanDigits.length >= 10) {
      const last10 = cleanDigits.slice(-10)
      hit = all.find(u => u.phone && normalizePhone(u.phone).endsWith(last10))
      if (hit) return hit
    }
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

// ═══════════════════════════════════════════════════════════════
// Signature "Al-Mawaid Royal Crescent" WhatsApp Theme
// ═══════════════════════════════════════════════════════════════

const ROYAL_FOOTER = `_✦ Reply *MENU* anytime · *0* to Close_`

function renderMainMenu(memberName, thaliNumber) {
  const shortName = getPoliteName(memberName)
  const thali = thaliNumber ? `Thali *#${String(thaliNumber).trim()}*` : 'Member'
  return (
    `╭─ 🌙 *AL-MAWAID ROYAL PORTAL* ─╮\n` +
    `│ Salam *${shortName}* · ${thali}\n` +
    `╰─────────────────────────╯\n\n` +
    `▸ *1* · 🍽️ Today's Menu\n` +
    `▸ *2* · 📅 Tomorrow's Menu\n` +
    `▸ *3* · 📋 Weekly Survey & Status\n` +
    `▸ *4* · ⏸️ Stop / Resume Thali\n` +
    `▸ *5* · ⭐ Rate Today's Meal\n` +
    `▸ *6* · 💳 Thali Dues & Pay\n` +
    `▸ *7* · 💬 Ask Admin\n` +
    `▸ *8* · 🪪 My Thali Profile\n` +
    `▸ *0* · ❌ Close Chat\n\n` +
    `_✦ Reply a number (*1–8*) or keyword_`
  )
}

function renderMenuCard(dayMenu, title) {
  if (!dayMenu) {
    return (
      `╭─ 🍽️ *${title}* ─╮\n` +
      `│ _No menu published yet._\n` +
      `╰─────────────────────╯\n\n${ROYAL_FOOTER}`
    )
  }
  const lunch = dayMenu.lunch?.length ? dayMenu.lunch.map(d => `   • ${d}`).join('\n') : '   • —'
  const dinner = dayMenu.dinner?.length ? dayMenu.dinner.map(d => `   • ${d}`).join('\n') : '   • —'
  return (
    `╭─ 🍽️ *${title}* ─╮\n` +
    `│\n` +
    `│ ☀️ *LUNCH*\n${lunch}\n` +
    `│\n` +
    `│ 🌙 *DINNER*\n${dinner}\n` +
    `╰─────────────────────╯\n\n` +
    `✦ Quick: *3* Survey · *5* Rate · *MENU*`
  )
}

async function renderSurveyPanel(member) {
  const now = tzNow()
  const appSettings = await loadAppSettings()
  const targetWeek = getSurveyTargetWeek(appSettings, now)
  const open = isSurveyOpen(appSettings, now)
  const winLabel = getSurveyWindowLabel(appSettings)

  const { data: rows } = await supabase
    .from('survey_day_responses')
    .select('day, l_status, d_status')
    .eq('user_id', member.user_id)
    .eq('week_id', targetWeek)

  const byDay = {}
  for (const r of rows || []) byDay[r.day] = r

  const lines = DAY_KEYS.map((dk, idx) => {
    const label = DAYS[idx].substring(0, 3).toUpperCase()
    const r = byDay[dk] || {}
    const l = r.l_status === 'Applied' ? '✅' : r.l_status === 'Skipped' ? '❌' : '⬜'
    const d = r.d_status === 'Applied' ? '✅' : r.d_status === 'Skipped' ? '❌' : '⬜'
    return `│ *${label}*  ☀️ ${l}   🌙 ${d}`
  }).join('\n')

  return (
    `╭─ 📋 *WEEKLY SURVEY* ─╮\n` +
    `│ Week: *${formatWeekRange(targetWeek)}*\n` +
    `│ Window: ${open ? '🟢 *OPEN*' : '🔴 *CLOSED*'} _(${winLabel})_\n` +
    `├─────────────────────┤\n` +
    `${lines}\n` +
    `╰─────────────────────╯\n\n` +
    `▸ *1* · ✅ Apply ALL (Mon–Sat)\n` +
    `▸ *2* · ❌ Skip ALL (Mon–Sat)\n` +
    `▸ *3* · ☀️🌙 Apply Today Only\n` +
    `▸ *4* · 🚫 Skip Today Only\n` +
    `▸ *MENU* · Back to Portal`
  )
}

async function applyBulkSurvey(member, statusVal, onlyToday = false) {
  const now = tzNow()
  const appSettings = await loadAppSettings()
  const targetWeek = getSurveyTargetWeek(appSettings, now)
  const dow = now.getUTCDay()
  const todayKey = dow === 0 ? 'mon' : (DAY_KEYS[dow - 1] || 'mon')
  const keys = onlyToday ? [todayKey] : DAY_KEYS

  const upserts = keys.map(dk => ({
    user_id: member.user_id,
    thali_number: member.thali_number != null ? String(member.thali_number) : null,
    week_id: targetWeek,
    day: dk,
    l_status: statusVal,
    d_status: statusVal,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('survey_day_responses')
    .upsert(upserts, { onConflict: 'user_id,week_id,day' })

  if (error) {
    console.error('[applyBulkSurvey] error:', error)
    return `❌ Could not update survey right now. Please try again.`
  }

  const scope = onlyToday ? `Today (${todayKey.toUpperCase()})` : `Full Week (${formatWeekRange(targetWeek)})`
  return (
    `╭─ ${statusVal === 'Applied' ? '✅ *SURVEY APPLIED*' : '❌ *SURVEY SKIPPED*'} ─╮\n` +
    `│ ◈ Thali: *#${member.thali_number || '—'}*\n` +
    `│ ◈ Scope: *${scope}*\n` +
    `│ ◈ Status: *${statusPill(statusVal)}*\n` +
    `╰──────────────────────╯\n\n${ROYAL_FOOTER}`
  )
}

// ═══════════════════════════════════════════════════════════════
// Message Processing Handler (8 Modes + Smart Detection)
// ═══════════════════════════════════════════════════════════════

async function handleMessage(waPhone, rawText) {
  const text = (rawText || '').trim()
  if (!text) return null
  const upper = text.toUpperCase()

  const [{ member, linked }, session] = await Promise.all([
    getMemberByWaPhone(waPhone),
    getSession(waPhone),
  ])
  let state = session.state || {}

  // 1. Session timeout (10 minutes -> clear stale flow)
  if (session?.updated_at && (Date.now() - new Date(session.updated_at).getTime() > 10 * 60 * 1000)) {
    await clearSession(waPhone)
    state = {}
  }

  // 2. Global Close Chat (kept distinct from STOP THALI)
  if (['0', 'CLOSE', 'END', 'EXIT', 'BYE', 'CANCEL'].includes(upper)) {
    await clearSession(waPhone)
    return `╭─ 👋 *CHAT CLOSED* ─╮\n│ Reply *MENU* anytime to reopen.\n╰──────────────────╯`
  }

  // 3. Global Menu & Greetings
  if (['MENU', 'HOME', 'START', 'MAIN MENU', 'RESET', 'HI', 'HELLO', 'HELP', 'ASSALAMUALAIKUM', 'SALAAM', 'HEY'].includes(upper)) {
    await clearSession(waPhone)
    if (member && linked) {
      return renderMainMenu(member.name, member.thali_number)
    }
  }

  // 4. Pleasantries
  if (['THANKS', 'THANK YOU', 'SHUKRAN', 'JAZAKALLAH', 'JAZAKALLAH KHAIR', 'OK', 'OKAY', 'DONE', 'FINE', 'ALHAMDULILLAH', 'MUBARAK'].includes(upper)) {
    await clearSession(waPhone)
    return `🙏 *Afwan / JazakAllah!* Happy to serve you.\n\n${ROYAL_FOOTER}`
  }

  // 5. Explicit LINK / SWITCH command
  const linkPrefixMatch = text.match(/^(?:(?:my\s+)?thali(?:\s*(?:no|number|#))?|link|switch|t\.?no\.?)\s*[:#]?\s*([a-zA-Z0-9\-_\s/]+)$/i)
  if (linkPrefixMatch) {
    const candidateThali = linkPrefixMatch[1].trim()
    const found = await findMemberByThali(candidateThali)
    if (found) {
      await linkMember(waPhone, found)
      const tNum = String(found.thali_number || '').trim()
      return `✅ Thali *#${tNum}* linked!\n\n` + renderMainMenu(found.name, found.thali_number)
    }
    return `❌ Thali *#${candidateThali}* not found. Please check your Thali Number and try again.`
  }

  // 6. Unlinked onboarding
  if (!member || !linked) {
    const cleanThali = text.replace(/^[#\s]+|[#\s]+$/g, '').trim()
    const isGreeting = ['HI', 'HELLO', 'START', 'HELP', 'ASSALAMUALAIKUM', 'SALAAM', 'HEY', 'MENU'].includes(upper)
    if (!isGreeting && cleanThali.length >= 1 && cleanThali.length <= 15) {
      const found = await findMemberByThali(cleanThali)
      if (found) {
        await linkMember(waPhone, found)
        const tNum = String(found.thali_number || '').trim()
        return `✅ Thali *#${tNum}* linked!\n\n` + renderMainMenu(found.name, found.thali_number)
      }
      if (/^[a-zA-Z0-9\-_\s/]+$/.test(cleanThali)) {
        return `❌ Thali *#${cleanThali}* not found.\n\nReply with your correct Thali Number (e.g. \`101\`, \`104/B\`, \`G2\`):`
      }
    }
    return (
      `╭─ 🌙 *AL-MAWAID PORTAL* ─╮\n` +
      `│ Salam! Please reply with your\n` +
      `│ *Thali Number* to link your account\n` +
      `│ (e.g. \`101\`, \`104/B\`, \`G2\`)\n` +
      `╰───────────────────────╯`
    )
  }

  // 7. Direct Thali Number switch when idle
  if (!['1', '2', '3', '4', '5', '6', '7', '8'].includes(upper) && !state.flow) {
    const candidateThali = await findMemberByThali(text)
    if (candidateThali) {
      if (candidateThali.user_id !== member.user_id) {
        await linkMember(waPhone, candidateThali)
        const tNum = String(candidateThali.thali_number || '').trim()
        return `✅ Switched to Thali *#${tNum}*!\n\n` + renderMainMenu(candidateThali.name, candidateThali.thali_number)
      }
      return renderMainMenu(member.name, member.thali_number)
    }
  }

  // ── ACTIVE FLOW: SURVEY ──
  if (state.flow === 'survey') {
    if (upper === '1' || upper === 'APPLY ALL') {
      await clearSession(waPhone)
      return applyBulkSurvey(member, 'Applied', false)
    }
    if (upper === '2' || upper === 'SKIP ALL') {
      await clearSession(waPhone)
      return applyBulkSurvey(member, 'Skipped', false)
    }
    if (upper === '3' || upper === 'TODAY APPLY') {
      await clearSession(waPhone)
      return applyBulkSurvey(member, 'Applied', true)
    }
    if (upper === '4' || upper === 'TODAY SKIP') {
      await clearSession(waPhone)
      return applyBulkSurvey(member, 'Skipped', true)
    }
  }

  // ── ACTIVE FLOW: STOP / RESUME THALI ──
  if (state.flow === 'thali_request') {
    if (state.step === 'choose_type') {
      if (upper === '1' || upper === 'STOP') {
        state.reqType = 'stop'
        state.step = 'from_date'
        await setSession(waPhone, state)
        return `⏸️ *Stop Thali — Start Date*\n\nReply with start date:\n▸ *today*\n▸ *tomorrow*\n▸ Or *DD-MM-YYYY* (e.g. \`28-11-2026\`)`
      }
      if (upper === '2' || upper === 'RESUME') {
        state.reqType = 'resume'
        state.step = 'from_date'
        await setSession(waPhone, state)
        return `▶️ *Resume Thali — Date*\n\nReply with resume date:\n▸ *today*\n▸ *tomorrow*\n▸ Or *DD-MM-YYYY* (e.g. \`28-11-2026\`)`
      }
      return `Please reply *1* to Stop Thali or *2* to Resume Thali (or *MENU* to cancel).`
    }

    if (state.step === 'from_date') {
      const parsed = parseDateInput(text, tzNow())
      if (!parsed) return `⚠️ Invalid date. Reply *today*, *tomorrow*, or *DD-MM-YYYY*:`
      state.fromDate = parsed

      if (state.reqType === 'resume') {
        await supabase.from('thali_requests').insert({
          user_id: member.user_id,
          thali_number: String(member.thali_number || ''),
          request_type: 'resume',
          from_date: parsed,
          to_date: parsed,
          meal_type: 'both',
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        fireAdminPush({
          title: `▶️ Resume Request: Thali #${member.thali_number || '—'}`,
          body: `${member.name || 'Member'} requested to resume thali from ${parsed}.`,
          target_type: 'admins',
          notify_in_app: true,
          type: 'thali_request',
          sender_name: 'Al-Mawaid Royal Bot',
          url: '/admin/requests',
        })
        await clearSession(waPhone)
        return (
          `╭─ ▶️ *RESUME REQUEST SENT* ─╮\n` +
          `│ ◈ Thali: *#${member.thali_number || '—'}*\n` +
          `│ ◈ From: *${parsed}*\n` +
          `│ ◈ Status: ⏳ *Pending Approval*\n` +
          `╰─────────────────────────╯\n\n${ROYAL_FOOTER}`
        )
      }

      state.step = 'to_date'
      await setSession(waPhone, state)
      return `📅 *End Date*\nStart: *${parsed}*\n\nReply end date (*today*, *tomorrow*, *DD-MM-YYYY*), or *1* for single day:`
    }

    if (state.step === 'to_date') {
      const parsed = (text === '1' || upper === 'SINGLE') ? state.fromDate : parseDateInput(text, tzNow())
      if (!parsed) return `⚠️ Invalid date. Reply *DD-MM-YYYY* or *1* for single day:`
      state.toDate = parsed < state.fromDate ? state.fromDate : parsed
      state.step = 'meal_scope'
      await setSession(waPhone, state)
      return `🍽️ *Which Meal?*\n\n▸ *1* · Both (Lunch & Dinner)\n▸ *2* · Lunch Only ☀️\n▸ *3* · Dinner Only 🌙`
    }

    if (state.step === 'meal_scope') {
      const mealType = upper === '2' ? 'lunch' : upper === '3' ? 'dinner' : upper === '1' ? 'both' : null
      if (!mealType) return `Reply *1* (Both), *2* (Lunch), or *3* (Dinner):`

      await supabase.from('thali_requests').insert({
        user_id: member.user_id,
        thali_number: String(member.thali_number || ''),
        request_type: 'stop',
        from_date: state.fromDate,
        to_date: state.toDate,
        meal_type: mealType,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      fireAdminPush({
        title: `⏸️ Stop Request: Thali #${member.thali_number || '—'}`,
        body: `${member.name || 'Member'} requested stop (${mealType}) from ${state.fromDate} to ${state.toDate}.`,
        target_type: 'admins',
        notify_in_app: true,
        type: 'thali_request',
        sender_name: 'Al-Mawaid Royal Bot',
        url: '/admin/requests',
      })
      const fromD = state.fromDate
      const toD = state.toDate
      await clearSession(waPhone)
      return (
        `╭─ ⏸️ *STOP REQUEST SENT* ─╮\n` +
        `│ ◈ Thali: *#${member.thali_number || '—'}*\n` +
        `│ ◈ Dates: *${fromD}* → *${toD}*\n` +
        `│ ◈ Meal: *${mealType.toUpperCase()}*\n` +
        `│ ◈ Status: ⏳ *Pending Approval*\n` +
        `╰────────────────────────╯\n\n${ROYAL_FOOTER}`
      )
    }
  }

  // ── ACTIVE FLOW: FEEDBACK ──
  if (state.flow === 'feedback') {
    if (state.step === 'meal_type') {
      const low = text.toLowerCase()
      const meal = ['1', 'lunch', 'l', 'dupahr', 'dopahar'].includes(low) ? 'lunch'
        : ['2', 'dinner', 'd', 'raat', 'night'].includes(low) ? 'dinner' : null
      if (!meal) return `⭐ *Rate Meal*\n\n▸ *1* · Lunch ☀️\n▸ *2* · Dinner 🌙\n\n_Reply 1 or 2 (or MENU to cancel):_`
      state.meal = meal
      state.step = 'rating'
      await setSession(waPhone, state)
      return (
        `⭐ *Rate ${meal === 'lunch' ? 'Lunch ☀️' : 'Dinner 🌙'}*\n\n` +
        `▸ *1* · 😞 Poor\n▸ *2* · 😐 Fair\n▸ *3* · 🙂 Good\n▸ *4* · 😄 Great\n▸ *5* · 🤩 Excellent\n\n_Reply 1 to 5:_`
      )
    }
    if (state.step === 'rating') {
      const num = parseInt(text.charAt(0), 10)
      if (isNaN(num) || num < 1 || num > 5) return `Reply a rating from *1* to *5* (or *MENU* to cancel):`
      state.stars = num
      state.step = 'comment'
      await setSession(waPhone, state)
      return `⭐ *${STAR_LABELS[num]}*\n\nAny comment? _Reply with your note or *-* to skip:_`
    }
    if (state.step === 'comment') {
      const comment = (text === '-' || upper === 'SKIP') ? '' : text
      const now = tzNow()
      const payload = {
        user_id: member.user_id,
        day: weekdayName(now).toLowerCase(),
        week_id: calendarWeekMonday(now),
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
      fireAdminPush({
        title: `⭐ ${state.meal === 'lunch' ? 'Lunch' : 'Dinner'} Feedback: ${member.name || 'Member'} (#${member.thali_number || '—'})`,
        body: `${STAR_LABELS[state.stars]}: "${comment || 'No comment'}"`,
        target_type: 'admins',
        notify_in_app: true,
        type: 'feedback',
        sender_name: 'Al-Mawaid Royal Bot',
        url: '/admin/feedback',
      })
      const stars = state.stars
      const mealName = state.meal === 'lunch' ? 'Lunch' : 'Dinner'
      await clearSession(waPhone)
      return (
        `╭─ 🙏 *FEEDBACK SAVED* ─╮\n` +
        `│ ◈ Meal: *${mealName}*\n` +
        `│ ◈ Rating: *${STAR_LABELS[stars]}*\n` +
        `╰───────────────────────╯\n\n${ROYAL_FOOTER}`
      )
    }
  }

  // ── ACTIVE FLOW: QUERY ──
  if (state.flow === 'query' && text) {
    const comment = text.trim()
    const subject = comment.length > 50 ? comment.substring(0, 47) + '...' : comment
    await supabase.from('queries').insert({ user_id: member.user_id, subject, comment, status: 'open' })
    fireAdminPush({
      title: `📩 New Query: ${member.name || 'Member'} (#${member.thali_number || '—'})`,
      body: comment.substring(0, 90),
      target_type: 'admins',
      notify_in_app: true,
      type: 'new_query',
      sender_name: 'Al-Mawaid Royal Bot',
      url: '/admin/queries',
    })
    await clearSession(waPhone)
    return (
      `╭─ 📨 *SENT TO ADMIN* ─╮\n` +
      `│ "${comment}"\n` +
      `│ Jamaat management will reply soon.\n` +
      `╰─────────────────────╯\n\n${ROYAL_FOOTER}`
    )
  }

  // ── ACTIVE FLOW: PAYMENT UTR ──
  if (state.flow === 'payment' && state.step === 'awaiting_utr') {
    const cleanUtr = text.replace(/^(?:PAID|UTR|REF|TXN)[:\s-]*/i, '').trim()
    if (!cleanUtr || cleanUtr.length < 5 || cleanUtr.length > 35) {
      return `⚠️ Enter your *12-digit UTR* (e.g. \`428912345678\`) or reply *MENU* to cancel:`
    }
    const appSettings = await loadAppSettings()
    const payAmt = Number(state.amount || member.custom_due_amount || appSettings.default_payment_due || 1500)
    const monthLabel = state.monthLabel || 'This Month'
    const monthKey = state.monthKey || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const upiId = appSettings.upi_id || '6375250267@okbizaxis'
    const payeeName = appSettings.upi_payee_name || 'Al Mawaid'

    const { error: insErr } = await supabase.from('user_payments').insert({
      user_id: member.user_id,
      user_name: member.name || '',
      user_email: member.email || '',
      thali_number: String(member.thali_number || ''),
      amount: payAmt,
      currency: 'INR',
      status: 'submitted',
      transaction_ref: cleanUtr,
      upi_id: upiId,
      payee_name: payeeName,
      payment_method: 'UPI',
      note: `WhatsApp Bot payment for ${monthLabel}`,
      metadata: { month: monthKey, month_label: monthLabel, wa_phone: waPhone, channel: 'whatsapp_bot', submitted_at: new Date().toISOString() },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (insErr) return `❌ Could not record payment. Please try again.`
    await clearSession(waPhone)
    notifyPaymentManager({ member, amount: payAmt, utr: cleanUtr, monthLabel, waPhone })
    return (
      `╭─ ✅ *PAYMENT RECORDED* ─╮\n` +
      `│ ◈ Thali: *#${String(member.thali_number || '—').trim()}*\n` +
      `│ ◈ Amount: *₹${payAmt.toLocaleString('en-IN')}* (${monthLabel})\n` +
      `│ ◈ UTR: \`${cleanUtr}\`\n` +
      `│ ◈ Status: ⏳ *Sent for Verification*\n` +
      `╰────────────────────────╯\n\n${ROYAL_FOOTER}`
    )
  }

  // ── ADMIN COMMANDS: VERIFY <UTR> & STATS ──
  const verifyMatch = text.match(/^(?:VERIFY|APPROVE)\s+([A-Za-z0-9_-]{4,35})$/i)
  if (verifyMatch) {
    const utrToVerify = verifyMatch[1].trim()
    const { mgrPhone } = await getPaymentManagerInfo()
    const isMgr = normalizePhone(waPhone) === mgrPhone || ['admin', 'supervisor', 'payment_manager'].includes(member?.role)
    if (isMgr) {
      const { data: hitPayments } = await supabase
        .from('user_payments')
        .select('*')
        .ilike('transaction_ref', utrToVerify)
        .order('created_at', { ascending: false })
        .limit(1)
      if (hitPayments && hitPayments.length > 0) {
        const p = hitPayments[0]
        await supabase.from('user_payments').update({ status: 'verified', updated_at: new Date().toISOString() }).eq('id', p.id)
        const payerWaPhone = p.metadata?.wa_phone
        if (activeSock && payerWaPhone) {
          activeSock.sendMessage(toWaJid(payerWaPhone), {
            text:
              `╭─ 🎉 *PAYMENT VERIFIED* ─╮\n` +
              `│ Salam *${getPoliteName(p.user_name)}*,\n` +
              `│ Amount: *₹${Number(p.amount).toLocaleString('en-IN')}*\n` +
              `│ UTR: \`${p.transaction_ref}\`\n` +
              `│ Status: ✅ *VERIFIED*\n` +
              `╰────────────────────────╯`
          }).catch(() => {})
        }
        return `✅ Verified Thali *#${p.thali_number}* (₹${Number(p.amount).toLocaleString('en-IN')} · \`${p.transaction_ref}\`). Member notified!`
      }
      return `⚠️ No payment found for UTR \`${utrToVerify}\`.`
    }
  }

  if (upper === 'STATS' || upper === 'COUNT') {
    const { mgrPhone } = await getPaymentManagerInfo()
    const isMgr = normalizePhone(waPhone) === mgrPhone || ['admin', 'supervisor', 'khidmat', 'payment_manager'].includes(member?.role)
    if (isMgr) {
      const now = tzNow()
      const dow = now.getUTCDay()
      const dk = dow === 0 ? 'mon' : (DAY_KEYS[dow - 1] || 'mon')
      const appSettings = await loadAppSettings()
      const wid = resolveServingWeekId(appSettings, now)
      const { data: rows } = await supabase.from('survey_day_responses').select('l_status, d_status').eq('week_id', wid).eq('day', dk)
      const lApp = (rows || []).filter(r => r.l_status === 'Applied').length
      const lSkip = (rows || []).filter(r => r.l_status === 'Skipped').length
      const dApp = (rows || []).filter(r => r.d_status === 'Applied').length
      const dSkip = (rows || []).filter(r => r.d_status === 'Skipped').length
      return (
        `╭─ 📊 *TODAY'S COUNTS (${dk.toUpperCase()})* ─╮\n` +
        `│ ☀️ Lunch:  ✅ ${lApp}  |  ❌ ${lSkip}\n` +
        `│ 🌙 Dinner: ✅ ${dApp}  |  ❌ ${dSkip}\n` +
        `╰──────────────────────────╯\n\n${ROYAL_FOOTER}`
      )
    }
  }

  // ── DIRECT SHORTCUT: PAID <UTR> ──
  const directPaidMatch = text.match(/^PAID\s+(?:(?:RS\.?|INR|₹)?\s*(\d+(?:\.\d+)?)\s+)?([A-Za-z0-9_-]{5,35})$/i)
  if (directPaidMatch) {
    const customAmt = directPaidMatch[1] ? parseFloat(directPaidMatch[1]) : null
    const cleanUtr = directPaidMatch[2].trim()
    const appSettings = await loadAppSettings()
    const now = tzNow()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    const payAmt = customAmt || Number(member.custom_due_amount || appSettings.default_payment_due || 1500)
    const upiId = appSettings.upi_id || '6375250267@okbizaxis'
    const payeeName = appSettings.upi_payee_name || 'Al Mawaid'

    const { error: insErr } = await supabase.from('user_payments').insert({
      user_id: member.user_id,
      user_name: member.name || '',
      user_email: member.email || '',
      thali_number: String(member.thali_number || ''),
      amount: payAmt,
      currency: 'INR',
      status: 'submitted',
      transaction_ref: cleanUtr,
      upi_id: upiId,
      payee_name: payeeName,
      payment_method: 'UPI',
      note: `WhatsApp Bot payment for ${monthLabel}`,
      metadata: { month: monthKey, month_label: monthLabel, wa_phone: waPhone, channel: 'whatsapp_bot', submitted_at: new Date().toISOString() },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (insErr) return `❌ Could not record payment. Please try again.`
    await clearSession(waPhone)
    notifyPaymentManager({ member, amount: payAmt, utr: cleanUtr, monthLabel, waPhone })
    return (
      `╭─ ✅ *PAYMENT RECORDED* ─╮\n` +
      `│ ◈ Thali: *#${String(member.thali_number || '—').trim()}*\n` +
      `│ ◈ Amount: *₹${payAmt.toLocaleString('en-IN')}* (${monthLabel})\n` +
      `│ ◈ UTR: \`${cleanUtr}\`\n` +
      `╰────────────────────────╯\n\n${ROYAL_FOOTER}`
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // 8 Main Interactive Modes
  // ═══════════════════════════════════════════════════════════════

  // MODE 1: Today's Menu
  if (upper === '1' || upper === 'TODAY' || upper === "TODAY'S MENU") {
    await clearSession(waPhone)
    const now = tzNow()
    const dow = now.getUTCDay()
    if (dow === 0) {
      return `╭─ 🍽️ *TODAY'S MENU (SUNDAY)* ─╮\n│ No thali distribution on Sunday.\n╰────────────────────────────╯\n\n_Reply *2* for Tomorrow (Monday) or *MENU*._`
    }
    const appSettings = await loadAppSettings()
    const servingWeek = resolveServingWeekId(appSettings, now)
    const menuMap = await loadMenuMap(servingWeek)
    const dayKey = DAY_KEYS[dow - 1] || 'mon'
    return renderMenuCard(menuForDay(menuMap, dayKey), `TODAY · ${weekdayName(now).toUpperCase()}`)
  }

  // MODE 2: Tomorrow's Menu
  if (upper === '2' || upper === 'TOMORROW' || upper === "TOMORROW'S MENU") {
    await clearSession(waPhone)
    const tomorrow = new Date(tzNow().getTime() + 86400_000)
    const dow = tomorrow.getUTCDay()
    if (dow === 0) {
      return `╭─ 📅 *TOMORROW (SUNDAY)* ─╮\n│ No thali distribution on Sunday.\n╰────────────────────────╯\n\n${ROYAL_FOOTER}`
    }
    const appSettings = await loadAppSettings()
    const servingWeek = resolveServingWeekId(appSettings, tomorrow)
    const menuMap = await loadMenuMap(servingWeek)
    const dayKey = DAY_KEYS[dow - 1] || 'mon'
    return renderMenuCard(menuForDay(menuMap, dayKey), `TOMORROW · ${weekdayName(tomorrow).toUpperCase()}`)
  }

  // MODE 3: Weekly Survey & Status
  if (upper === '3' || upper === 'SURVEY' || upper === 'STATUS') {
    await setSession(waPhone, { flow: 'survey', step: 'menu' })
    return renderSurveyPanel(member)
  }
  if (upper === 'APPLY ALL') {
    await clearSession(waPhone)
    return applyBulkSurvey(member, 'Applied', false)
  }
  if (upper === 'SKIP ALL') {
    await clearSession(waPhone)
    return applyBulkSurvey(member, 'Skipped', false)
  }

  // MODE 4: Stop / Resume Thali
  if (upper === '4' || upper === 'STOP' || upper === 'STOP THALI' || upper === 'PAUSE' || upper === 'RESUME') {
    if (upper === 'RESUME') {
      await setSession(waPhone, { flow: 'thali_request', step: 'from_date', reqType: 'resume' })
      return `▶️ *Resume Thali — Date*\n\nReply with resume date:\n▸ *today*\n▸ *tomorrow*\n▸ Or *DD-MM-YYYY*`
    }
    await setSession(waPhone, { flow: 'thali_request', step: 'choose_type' })
    return (
      `╭─ ⏸️ *THALI STOP / RESUME* ─╮\n` +
      `│ ▸ *1* · Stop / Pause Thali\n` +
      `│ ▸ *2* · Resume Thali\n` +
      `╰──────────────────────────╯\n\n_Reply 1 or 2 (or MENU to cancel):_`
    )
  }

  // MODE 5: Rate Meal
  if (upper === '5' || upper === 'FEEDBACK' || upper === 'RATE') {
    await setSession(waPhone, { flow: 'feedback', step: 'meal_type' })
    return `⭐ *Rate Today's Meal*\n\n▸ *1* · Lunch ☀️\n▸ *2* · Dinner 🌙\n\n_Reply 1 or 2 (or MENU to cancel):_`
  }

  // MODE 6: Thali Dues & Pay
  if (['6', 'DUES', 'PAYMENTS', 'PAYMENT', 'PAY', 'THALI PAYMENT', 'CONTRIBUTION'].includes(upper)) {
    await clearSession(waPhone)
    const appSettings = await loadAppSettings()
    const now = tzNow()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    const { data: payments } = await supabase
      .from('user_payments')
      .select('amount, status, metadata, created_at')
      .eq('user_id', member.user_id)
      .order('created_at', { ascending: false })

    const validPayments = (payments || []).filter(p => p.status !== 'rejected')
    const paidThisMonth = validPayments
      .filter(p => (p.metadata?.month ? p.metadata.month === currentMonthKey : p.created_at?.startsWith(currentMonthKey)))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)

    let totalDue = Number(appSettings.default_payment_due || 1500)
    if (member.payment_exempt) totalDue = 0
    else if (member.custom_due_amount != null && Number(member.custom_due_amount) > 0) totalDue = Number(member.custom_due_amount)

    const pendingBalance = Math.max(0, totalDue - paidThisMonth)
    const upiId = appSettings.upi_id || '6375250267@okbizaxis'
    const payeeName = appSettings.upi_payee_name || 'Al Mawaid'
    const tNum = String(member.thali_number || 'N/A').trim()

    if (member.payment_exempt) {
      return `💚 *Thali #${tNum}* — Payment Exempt 🛡️\n\n${ROYAL_FOOTER}`
    }
    if (pendingBalance === 0 && totalDue > 0) {
      return (
        `╭─ 🎉 *ALL CLEARED · ${monthLabel.toUpperCase()}* ─╮\n` +
        `│ ◈ Thali: *#${tNum}*\n` +
        `│ ◈ Paid: *₹${paidThisMonth.toLocaleString('en-IN')}* ✅\n` +
        `│ ◈ Balance: *₹0*\n` +
        `╰───────────────────────────────╯\n\n${ROYAL_FOOTER}`
      )
    }

    await setSession(waPhone, {
      flow: 'payment',
      step: 'awaiting_utr',
      monthKey: currentMonthKey,
      monthLabel,
      amount: pendingBalance,
      totalDue,
    })

    return (
      `╭─ 💳 *THALI #${tNum} DUES · ${monthLabel.toUpperCase()}* ─╮\n` +
      `│ ◈ Due: ₹${totalDue.toLocaleString('en-IN')}\n` +
      (paidThisMonth > 0 ? `│ ◈ Paid: ₹${paidThisMonth.toLocaleString('en-IN')} ✅\n` : '') +
      `│ ◈ *Balance: ₹${pendingBalance.toLocaleString('en-IN')}*\n` +
      `╰───────────────────────────────────╯\n\n` +
      `⚡ *Pay Online:* https://al-mawaid.vercel.app/pay\n` +
      `📲 *UPI ID:* \`${upiId}\` _(${payeeName})_\n\n` +
      `👉 *Reply with your 12-digit UTR after paying to auto-record!*`
    )
  }

  // MODE 7: Ask Admin
  if (['7', 'QUERY', 'HELP QUERY', 'SUPPORT', 'ASK'].includes(upper)) {
    await setSession(waPhone, { flow: 'query', step: 'text' })
    return `💬 *Ask Admin*\n\nType your message or question below (or reply *MENU* to cancel):`
  }

  // MODE 8: My Thali Profile / Unlink
  if (['8', 'PROFILE', 'WHOAMI', 'ME'].includes(upper)) {
    await clearSession(waPhone)
    return (
      `╭─ 🪪 *MY THALI PROFILE* ─╮\n` +
      `│ ◈ Name: *${member.name || 'Member'}*\n` +
      `│ ◈ Thali: *#${member.thali_number || '—'}*\n` +
      `│ ◈ WhatsApp: +${waPhone}\n` +
      `╰────────────────────────╯\n\n` +
      `▸ *SWITCH <thali>* — Switch account\n` +
      `▸ *UNLINK* — Disconnect this number\n\n${ROYAL_FOOTER}`
    )
  }

  if (upper === 'UNLINK') {
    await unlinkMember(waPhone)
    return `🔓 *Unlinked!* Your WhatsApp number has been disconnected. Reply with your Thali Number anytime to link again.`
  }

  // Smart Query Detection for free-text (>= 4 chars)
  if (text.length >= 4) {
    const subject = text.length > 50 ? text.substring(0, 47) + '...' : text
    await supabase.from('queries').insert({ user_id: member.user_id, subject, comment: text, status: 'open' })
    fireAdminPush({
      title: `📩 New Query: ${member.name || 'Member'} (#${member.thali_number || '—'})`,
      body: text.substring(0, 90),
      target_type: 'admins',
      notify_in_app: true,
      type: 'new_query',
      sender_name: 'Al-Mawaid Royal Bot',
      url: '/admin/queries',
    })
    return (
      `╭─ 📨 *SENT TO ADMIN* ─╮\n` +
      `│ "${text}"\n` +
      `│ Forwarded to Jamaat management.\n` +
      `╰─────────────────────╯\n\n${ROYAL_FOOTER}`
    )
  }

  return renderMainMenu(member.name, member.thali_number)
}

// ═══════════════════════════════════════════════════════════════
// Baileys 24/7 Low-Latency Socket Runner
// ═══════════════════════════════════════════════════════════════

let botStartedOnce = false

async function startBot() {
  const authDir = path.join(__dirname, 'auth_info_baileys')
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const { version } = await fetchLatestBaileysVersion()

  if (!botStartedOnce) {
    console.log('🌙 Starting Al-Mawaid Royal WhatsApp Bot (24/7 Direct)...')
    console.log(`📡 Baileys v${version.join('.')} | Portal: http://localhost:${PORT}`)
    botStartedOnce = true
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['Al-Mawaid Royal Bot', 'Chrome', '124.0.0'],
    printQRInTerminal: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: true,
    keepAliveIntervalMs: 25_000,
    connectTimeoutMs: 20_000,
    defaultQueryTimeoutMs: 20_000,
    retryRequestDelayMs: 250,
  })

  activeSock = sock
  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      latestQr = qr
      botStatus = 'waiting_qr'
      try {
        latestQrDataUrl = await QRCode.toDataURL(qr, { width: 340, margin: 2 })
      } catch (err) {
        console.warn('Failed to generate QR data URL:', err)
      }
    }

    if (connection === 'close') {
      activeSock = null
      botStatus = 'reconnecting'
      latestQr = null
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403
      if (statusCode !== 408) {
        console.log(`⚠️ Connection closed (code: ${statusCode || 'unknown'}). Reconnecting in 2s...`)
      }

      if (isLoggedOut) {
        console.log('❌ Device unlinked/logged out. Clearing session for fresh QR...')
        try {
          for (const f of fs.readdirSync(authDir)) {
            try { fs.unlinkSync(path.join(authDir, f)) } catch {}
          }
        } catch {}
      }

      setTimeout(() => {
        startBot().catch(e => console.error('Failed to restart bot:', e))
      }, 2000)
    } else if (connection === 'open') {
      activeSock = sock
      botStatus = 'online'
      latestQr = null
      latestQrDataUrl = null
      connectedUser = sock.user
      const phone = connectedUser?.id ? connectedUser.id.split(':')[0] : 'WhatsApp'
      console.log(`✅ AL-MAWAID ROYAL WHATSAPP BOT ONLINE 24/7 (+${phone})`)
    }
  })

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return
    const tasks = m.messages.map((msg) => {
      if (!msg.message || msg.key.fromMe) return null
      const remoteJid = msg.key.remoteJid || ''
      if (remoteJid.endsWith('@g.us') || remoteJid.includes('broadcast') || remoteJid.includes('newsletter')) return null

      const msgId = msg.key.id
      if (msgId) {
        if (seenMsgIds.has(msgId)) return null
        seenMsgIds.add(msgId)
        if (seenMsgIds.size > 2000) {
          const first = seenMsgIds.values().next().value
          seenMsgIds.delete(first)
        }
      }

      const rawText = extractMessageText(msg.message)
      if (!rawText) return null
      const waPhone = remoteJid.replace('@s.whatsapp.net', '')

      return enqueueForChat(waPhone, async () => {
        const t0 = Date.now()
        // Non-blocking read receipt so reply is never delayed
        sock.readMessages([msg.key]).catch(() => {})
        try {
          const reply = await handleMessage(waPhone, rawText)
          if (reply) {
            await sock.sendMessage(remoteJid, { text: reply })
            const dt = Date.now() - t0
            metrics.messagesProcessed += 1
            metrics.totalLatencyMs += dt
            metrics.lastLatencyMs = dt
            metrics.lastMessageAt = new Date().toISOString()
            console.log(`⚡ Replied to ${waPhone} in ${dt}ms`)
          }
        } catch (err) {
          console.error(`❌ Error handling message from ${waPhone}:`, err)
        }
      })
    }).filter(Boolean)

    if (tasks.length > 0) await Promise.allSettled(tasks)
  })
}

startBot().catch(console.error)
