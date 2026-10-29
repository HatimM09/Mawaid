// ═══════════════════════════════════════════════════════════════
// AL-MAWAID — WhatsApp Interactive Portal Bot
// Fast Button & Numbered Tap Theme with Smart Query Detection
// ═══════════════════════════════════════════════════════════════

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import pino from 'pino'
import http from 'http'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  DAY_KEYS, STAR_LABELS,
  weekdayName, calendarWeekMonday,
  parseDishArray, menuForDay, resolveServingWeekId,
  normalizePhone, getPoliteName,
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

let activeSock = null
let latestQr = null
let latestQrDataUrl = null
let botStatus = 'connecting' // 'waiting_qr' | 'online' | 'reconnecting'
let connectedUser = null
let lastPairingCode = null

async function requestPairing(phoneInput) {
  if (!activeSock) throw new Error('WhatsApp bot is initializing. Please wait a moment.')
  const digits = String(phoneInput || '').replace(/[^\d]/g, '')
  if (digits.length < 10) throw new Error('Please enter a valid 10 or 12 digit phone number.')
  const formatted = digits.length === 10 ? '91' + digits : digits
  try {
    const code = await activeSock.requestPairingCode(formatted)
    lastPairingCode = { code, phone: formatted, at: new Date().toISOString() }
    console.log(`\n═══════════════════════════════════════════════════════════════`)
    console.log(`🔑 WHATSAPP PAIRING CODE FOR +${formatted}: ${code}`)
    console.log(`   (WhatsApp > Settings > Linked Devices > Link with phone number)`)
    console.log(`═══════════════════════════════════════════════════════════════\n`)
    return { code, phone: formatted }
  } catch (err) {
    console.error('Pairing code request failed:', err)
    throw err
  }
}

async function relinkSession() {
  console.log('🔄 Relink requested: resetting session and cleaning auth directory...')
  botStatus = 'waiting_qr'
  latestQr = null
  latestQrDataUrl = null
  connectedUser = null
  lastPairingCode = null

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

  // Delete all auth files to prevent "Bad MAC" and session desync errors
  const authDir = path.join(__dirname, 'auth_info_baileys')
  try {
    if (fs.existsSync(authDir)) {
      const files = fs.readdirSync(authDir)
      for (const f of files) {
        try { fs.unlinkSync(path.join(authDir, f)) } catch {}
      }
    }
  } catch (err) {
    console.warn('Failed clearing auth dir:', err)
  }

  setTimeout(() => {
    startBot().catch(e => console.error('Failed to restart bot after relink:', e))
  }, 1200)
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

function renderDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Al-Mawaid WhatsApp Bot Portal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #090d16;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 16px;
    }
    .container { max-width: 900px; width: 100%; }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-icon {
      width: 48px; height: 48px; border-radius: 14px;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; box-shadow: 0 8px 24px rgba(16,185,129,0.3);
    }
    .brand h1 { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.02em; }
    .brand p { font-size: 13px; color: #94a3b8; }
    .badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 16px; border-radius: 999px;
      font-size: 13px; font-weight: 600;
    }
    .badge-online { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
    .badge-qr { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); }
    .badge-connecting { background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }

    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }

    .card {
      background: #111827;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 24px;
      display: flex; flex-direction: column;
      position: relative;
      overflow: hidden;
    }
    .card h2 { font-size: 17px; font-weight: 700; margin-bottom: 8px; color: #f1f5f9; display: flex; align-items: center; gap: 8px; }
    .card p.desc { font-size: 13px; color: #94a3b8; margin-bottom: 20px; line-height: 1.5; }

    .qr-box {
      background: #fff;
      border-radius: 16px;
      padding: 16px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px;
      width: 260px; height: 260px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.4);
    }
    .qr-box img { width: 100%; height: 100%; object-fit: contain; }
    .qr-placeholder { color: #64748b; font-size: 13px; text-align: center; }

    .steps { list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: #cbd5e1; }
    .steps li { display: flex; align-items: flex-start; gap: 8px; }
    .step-num {
      width: 20px; height: 20px; border-radius: 50%; background: rgba(16,185,129,0.2);
      color: #34d399; display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 2px;
    }

    .form-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
    .form-group label { font-size: 13px; font-weight: 600; color: #cbd5e1; }
    .input-row { display: flex; gap: 8px; }
    .input-text {
      flex: 1; padding: 12px 14px; border-radius: 12px;
      background: #1e293b; border: 1px solid rgba(255,255,255,0.12);
      color: #fff; font-size: 14px; font-family: inherit;
    }
    .input-text:focus { outline: none; border-color: #10b981; }
    .btn {
      padding: 12px 18px; border-radius: 12px; border: none;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      color: #fff; font-weight: 600; font-size: 14px; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      transition: all 0.2s;
    }
    .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(16,185,129,0.4); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .code-display {
      background: #0f172a;
      border: 1px solid rgba(16,185,129,0.3);
      border-radius: 14px;
      padding: 16px;
      text-align: center;
      margin-top: 12px;
      display: none;
    }
    .code-number {
      font-family: 'JetBrains Mono', monospace;
      font-size: 28px;
      font-weight: 700;
      color: #34d399;
      letter-spacing: 0.15em;
      margin: 8px 0;
      user-select: all;
    }

    .features-card {
      background: #111827; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px; padding: 24px; width: 100%;
    }
    .features-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px; margin-top: 16px;
    }
    .feature-item {
      background: #1a2234; border: 1px solid rgba(255,255,255,0.05);
      border-radius: 14px; padding: 14px 16px;
    }
    .feature-item h3 { font-size: 14px; color: #34d399; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
    .feature-item p { font-size: 12px; color: #94a3b8; line-height: 1.4; }

    .online-box {
      display: none;
      background: rgba(16,185,129,0.08);
      border: 1px solid rgba(16,185,129,0.25);
      border-radius: 16px;
      padding: 24px;
      text-align: center;
      margin-bottom: 24px;
    }
    .online-box h3 { font-size: 20px; font-weight: 700; color: #34d399; margin-bottom: 6px; }
    .online-box p { font-size: 14px; color: #cbd5e1; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="brand-icon">🍲</div>
        <div>
          <h1>Al-Mawaid WhatsApp Bot</h1>
          <p>Interactive Member Portal & Monthly Payments Hub</p>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <button id="relinkBtn" class="btn" style="background:#334155; font-size:13px; padding:8px 14px; border:1px solid rgba(255,255,255,0.12);" onclick="triggerRelink()">🔄 Relink WhatsApp</button>
        <div id="statusBadge" class="badge badge-connecting">
          <span class="dot"></span>
          <span id="statusText">Connecting...</span>
        </div>
      </div>
    </div>

    <div id="onlineBox" class="online-box">
      <h3>🎉 WhatsApp Bot is Connected & Active!</h3>
      <p id="onlineUserText" style="margin-top:6px; font-weight:600;"></p>
      <p style="margin-top:8px; font-size:13px; color:#94a3b8;">
        Members can now message your WhatsApp number to view menus, check dues, pay via UPI, and submit feedback.
      </p>
      <button id="relinkBtn2" class="btn" style="background:rgba(239,68,68,0.15); color:#fca5a5; border:1px solid rgba(239,68,68,0.35); font-size:13px; padding:8px 16px; margin-top:16px;" onclick="triggerRelink()">
        Disconnect & Relink Device
      </button>
    </div>

    <div id="linkGrid" class="grid">
      <!-- Method 1: QR Code -->
      <div class="card">
        <h2>📱 Option 1: Scan QR Code</h2>
        <p class="desc">Open WhatsApp on your phone, navigate to Linked Devices, and scan this code.</p>
        <div class="qr-box">
          <div id="qrLoading" class="qr-placeholder">Generating QR code...</div>
          <img id="qrImage" src="" alt="WhatsApp QR Code" style="display:none;" />
        </div>
        <ol class="steps">
          <li><span class="step-num">1</span> <span>Open <strong>WhatsApp</strong> on your mobile phone</span></li>
          <li><span class="step-num">2</span> <span>Go to <strong>Settings</strong> &gt; <strong>Linked Devices</strong></span></li>
          <li><span class="step-num">3</span> <span>Tap <strong>Link a Device</strong> and point camera at the QR code</span></li>
        </ol>
      </div>

      <!-- Method 2: Pairing Code -->
      <div class="card">
        <h2>🔑 Option 2: Link with Phone Number</h2>
        <p class="desc">No camera? Enter your phone number with country code to get an 8-digit Pairing Code.</p>
        <div class="form-group">
          <label>WhatsApp Mobile Number:</label>
          <div class="input-row">
            <input id="phoneInput" type="tel" class="input-text" placeholder="e.g. 919876543210" />
            <button id="pairBtn" class="btn" onclick="requestPairingCode()">Get Code</button>
          </div>
        </div>

        <div id="codeDisplay" class="code-display">
          <div style="font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Your WhatsApp Pairing Code</div>
          <div id="pairingCodeVal" class="code-number">---- ----</div>
          <div style="font-size:12px; color:#cbd5e1; line-height:1.4;">
            👉 In WhatsApp, tap <strong>"Link with phone number instead"</strong> and enter this code.
          </div>
        </div>

        <ol class="steps" style="margin-top:16px;">
          <li><span class="step-num">1</span> <span>Open WhatsApp &gt; <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong></span></li>
          <li><span class="step-num">2</span> <span>Tap <strong>"Link with phone number instead"</strong> at the bottom</span></li>
          <li><span class="step-num">3</span> <span>Enter the 8-digit code displayed above</span></li>
        </ol>
      </div>
    </div>

    <!-- Features Overview -->
    <div class="features-card">
      <h2 style="font-size:16px; color:#fff;">✨ Features Activated on this Bot</h2>
      <div class="features-grid">
        <div class="feature-item">
          <h3>💳 Monthly Thali Dues</h3>
          <p>Replies with personalized amount from <code>user_stats.custom_due_amount</code> or default due.</p>
        </div>
        <div class="feature-item">
          <h3>📲 1-Tap UPI Links</h3>
          <p>Generates deep links for Google Pay, PhonePe, Paytm, and BHIM with pre-filled amount and note.</p>
        </div>
        <div class="feature-item">
          <h3>🔔 Murtaza Hamid Alerts</h3>
          <p>Direct WhatsApp message + in-app notice to Mulla Murtaza Hamid with member name, thali # and UTR.</p>
        </div>
        <div class="feature-item">
          <h3>⚡ Quick Verify</h3>
          <p>Management can reply <code>VERIFY &lt;UTR&gt;</code> directly in WhatsApp to mark payment approved.</p>
        </div>
        <div class="feature-item">
          <h3>🍽️ Daily Menus</h3>
          <p>Instant access to today and tomorrow's lunch and dinner dishes from the weekly menu database.</p>
        </div>
        <div class="feature-item">
          <h3>⭐ Meal Ratings</h3>
          <p>Members can submit 1-5 star reviews with optional comments recorded in Admin Portal.</p>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentStatus = null;

    async function pollStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        const badge = document.getElementById('statusBadge');
        const statusText = document.getElementById('statusText');
        const qrImage = document.getElementById('qrImage');
        const qrLoading = document.getElementById('qrLoading');
        const onlineBox = document.getElementById('onlineBox');
        const linkGrid = document.getElementById('linkGrid');
        const onlineUserText = document.getElementById('onlineUserText');

        if (data.status === 'online') {
          badge.className = 'badge badge-online';
          statusText.textContent = 'Online & Active';
          onlineBox.style.display = 'block';
          linkGrid.style.display = 'none';
          const p = data.connectedUser?.phone || data.connectedUser?.id || '';
          onlineUserText.textContent = p ? 'Connected Phone: +' + p.replace('@s.whatsapp.net', '') : 'Connected to WhatsApp';
        } else if (data.status === 'waiting_qr') {
          badge.className = 'badge badge-qr';
          statusText.textContent = 'Scan QR Code';
          onlineBox.style.display = 'none';
          linkGrid.style.display = 'grid';
          if (data.qrDataUrl) {
            qrImage.src = data.qrDataUrl;
            qrImage.style.display = 'block';
            qrLoading.style.display = 'none';
          }
        } else {
          badge.className = 'badge badge-connecting';
          statusText.textContent = 'Connecting...';
        }

        if (data.lastPairingCode && !document.getElementById('pairingCodeVal').textContent.includes(data.lastPairingCode.code)) {
          showPairingCode(data.lastPairingCode.code);
        }
      } catch (err) {
        console.error('Poll failed:', err);
      }
    }

    function showPairingCode(rawCode) {
      const codeDisplay = document.getElementById('codeDisplay');
      const val = document.getElementById('pairingCodeVal');
      const clean = String(rawCode || '').replace(/[^A-Za-z0-9]/g, '');
      const formatted = clean.length === 8 ? clean.substring(0, 4) + '-' + clean.substring(4) : rawCode;
      val.textContent = formatted;
      codeDisplay.style.display = 'block';
    }

    async function requestPairingCode() {
      const input = document.getElementById('phoneInput');
      const btn = document.getElementById('pairBtn');
      const phone = input.value.trim();
      if (!phone) {
        alert('Please enter your WhatsApp mobile number.');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Requesting...';
      try {
        const res = await fetch('/api/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });
        const data = await res.json();
        if (data.success && data.code) {
          showPairingCode(data.code);
        } else {
          alert('Could not generate pairing code: ' + (data.error || 'Unknown error'));
        }
      } catch (e) {
        alert('Error contacting server: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Get Code';
      }
    }

    async function triggerRelink() {
      if (!confirm('Are you sure you want to reset & relink WhatsApp? This will clear any stale credentials and generate a fresh QR code.')) return;
      const relinkBtn = document.getElementById('relinkBtn');
      const relinkBtn2 = document.getElementById('relinkBtn2');
      if (relinkBtn) relinkBtn.disabled = true;
      if (relinkBtn2) relinkBtn2.disabled = true;
      try {
        const res = await fetch('/api/relink', { method: 'POST' });
        const data = await res.json();
        const badge = document.getElementById('statusBadge');
        const statusText = document.getElementById('statusText');
        badge.className = 'badge badge-connecting';
        statusText.textContent = 'Resetting...';
        document.getElementById('onlineBox').style.display = 'none';
        document.getElementById('linkGrid').style.display = 'grid';
        document.getElementById('qrImage').style.display = 'none';
        document.getElementById('qrLoading').style.display = 'block';
        document.getElementById('qrLoading').textContent = 'Generating fresh QR code...';
        setTimeout(pollStatus, 1500);
      } catch (e) {
        alert('Reset failed: ' + e.message);
      } finally {
        if (relinkBtn) relinkBtn.disabled = false;
        if (relinkBtn2) relinkBtn2.disabled = false;
      }
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
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    return res.end(JSON.stringify({
      status: botStatus,
      qrDataUrl: latestQrDataUrl,
      connectedUser: connectedUser ? {
        id: connectedUser.id,
        phone: connectedUser.id ? connectedUser.id.split(':')[0] : null,
        name: connectedUser.name || 'Al-Mawaid Bot'
      } : null,
      lastPairingCode,
      uptime: process.uptime()
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
    return res.end(JSON.stringify({ status: 'ok', botStatus, timestamp: new Date().toISOString() }))
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(renderDashboardHtml())
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not Found')
})

server.listen(PORT, () => {
  console.log(`🌐 Al-Mawaid Bot Portal listening at http://localhost:${PORT}`)
})

function toWaJid(phone) {
  let digits = String(phone || '').replace(/[^\d]/g, '')
  if (digits.length === 10) digits = '91' + digits
  return `${digits}@s.whatsapp.net`
}

function tzNow() {
  return new Date(Date.now() + TZ_OFFSET_MIN * 60_000)
}

async function loadAppSettings() {
  const { data } = await supabase.from('app_settings').select('key, value')
  const out = {}
  for (const row of data || []) out[row.key] = row.value
  return out
}

async function getPaymentManagerInfo() {
  const appSettings = await loadAppSettings()
  let mgrPhone = appSettings.payment_manager_phone ? normalizePhone(appSettings.payment_manager_phone) : null
  let mgrUserId = null
  let mgrName = appSettings.payment_manager_name || 'Mulla Murtaza Mohammadhussain Hamid'

  // Look up Mulla Murtaza Hamid in user_stats
  const { data: managers } = await supabase
    .from('user_stats')
    .select('user_id, name, phone, email')
    .or('name.ilike.%Murtaza%Hamid%,name.ilike.%Mulla Murtaza%,email.ilike.%murtaza.mohammed.hamid%')
    .limit(1)

  if (managers && managers.length > 0) {
    if (!mgrPhone && managers[0].phone) {
      mgrPhone = normalizePhone(managers[0].phone)
    }
    mgrUserId = managers[0].user_id
    if (managers[0].name) mgrName = managers[0].name
  }

  // Fallback to known phone if not found: 6375250267 (last 10 digits)
  if (!mgrPhone) mgrPhone = '6375250267'

  return { mgrPhone, mgrUserId, mgrName }
}

async function notifyPaymentManager({ member, amount, utr, monthLabel, waPhone }) {
  const { mgrPhone, mgrName } = await getPaymentManagerInfo()
  const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })

  // 1. In-App Notice for Mulla Murtaza Hamid & Admins
  try {
    const { data: managers } = await supabase
      .from('user_stats')
      .select('user_id')
      .or('name.ilike.%Murtaza%,email.ilike.%murtaza%,role.eq.admin,role.eq.payment_manager')

    if (managers && managers.length > 0) {
      const notices = managers.map(mgr => ({
        title: '💳 New Thali Payment Received',
        body: `${member.name || 'Member'} (Thali #${member.thali_number || '—'}) paid ₹${Number(amount).toLocaleString('en-IN')} for ${monthLabel}. UTR: ${utr}. Recorded via WhatsApp Bot.`,
        sender_name: 'Al-Mawaid WhatsApp Bot',
        target_user_id: mgr.user_id,
        tone: '#34d399',
        created_at: new Date().toISOString()
      }))
      await supabase.from('notices').insert(notices)
    }
  } catch (err) {
    console.warn('[notifyPaymentManager] in-app notice failed:', err)
  }

  // 2. Push notification via send-push
  try {
    await supabase.functions.invoke('send-push', {
      body: {
        title: `💳 Thali #${member.thali_number || '—'} Payment: ₹${Number(amount).toLocaleString('en-IN')}`,
        body: `${member.name || 'Member'} paid ₹${Number(amount).toLocaleString('en-IN')} for ${monthLabel}. UTR: ${utr}.`,
        target_type: 'admins',
        notify_in_app: true,
        type: 'new_payment',
        sender_name: 'WhatsApp Bot',
        url: '/admin/payments'
      }
    })
  } catch (err) {
    console.warn('[notifyPaymentManager] push notification failed:', err)
  }

  // 3. Direct WhatsApp Message to Mulla Murtaza Hamid
  if (activeSock && mgrPhone) {
    try {
      const mgrJid = toWaJid(mgrPhone)
      const tNum = String(member.thali_number || '—').trim()
      const alertMsg = `🔔 *New Thali Payment*\n\n` +
        `• Thali: *#${tNum}* • *${member.name || 'Member'}*\n` +
        `• Amount: *₹${Number(amount).toLocaleString('en-IN')}* (${monthLabel})\n` +
        `• UTR: \`${utr}\`\n` +
        `• Phone: +${waPhone}\n\n` +
        `👉 Reply: *VERIFY ${utr}*`

      await activeSock.sendMessage(mgrJid, { text: alertMsg })
      console.log(`📤 Direct payment alert sent to Manager WhatsApp: ${mgrPhone}`)
    } catch (err) {
      console.error('[notifyPaymentManager] WhatsApp alert to manager failed:', err)
    }
  }
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
  const clean = String(thaliNo || '').replace(/^[#\s]+|[#\s]+$/g, '').trim()
  if (!clean) return null
  const cleanLower = clean.toLowerCase()
  const norm = cleanLower.replace(/[\s\-_/\\#.]/g, '')

  // 1. Direct case-insensitive match
  const { data: direct } = await supabase
    .from('user_stats')
    .select('user_id, name, email, thali_number, phone, role, custom_due_amount, payment_exempt')
    .ilike('thali_number', clean)
    .maybeSingle()
  if (direct) return direct

  // 2. Fetch all members for flexible normalized matching (handles 101/A, 101-A, 101 A, G2, etc.)
  const { data: all } = await supabase
    .from('user_stats')
    .select('user_id, name, email, thali_number, phone, role, custom_due_amount, payment_exempt')

  if (all && all.length) {
    // 2a. Direct trimmed match in memory
    let hit = all.find(u => String(u.thali_number || '').trim().toLowerCase() === cleanLower)
    if (hit) return hit

    // 2b. Normalized match without slashes, spaces, dashes, dots
    hit = all.find(u => {
      const uNorm = String(u.thali_number || '').replace(/[\s\-_/\\#.]/g, '').toLowerCase()
      return uNorm === norm
    })
    if (hit) return hit

    // 2c. Exact digits match (e.g. user typed "101")
    const cleanDigits = clean.replace(/[^\d]/g, '')
    if (cleanDigits.length > 0 && cleanDigits.length < 10) {
      hit = all.find(u => String(u.thali_number || '').trim() === cleanDigits)
      if (hit) return hit
    }

    // 2d. Phone digits match if user typed 10 digits
    if (cleanDigits.length >= 10) {
      const last10 = cleanDigits.slice(-10)
      hit = all.find(u => u.phone && normalizePhone(u.phone).endsWith(last10))
      if (hit) return hit
    }
  }
  return null
}

function formatShortName(fullName) {
  return getPoliteName(fullName)
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
  if (!dayMenu) return `🍽️ *${title}*\n_No menu available._\n\n_Reply MENU or 1-6_`
  const lunch = dayMenu.lunch?.length ? dayMenu.lunch.join(', ') : '—'
  const dinner = dayMenu.dinner?.length ? dayMenu.dinner.join(', ') : '—'
  return `🍽️ *${title}*\n\n` +
    `☀️ *Lunch:* ${lunch}\n` +
    `🌙 *Dinner:* ${dinner}\n\n` +
    `_Reply MENU or 1-6_`
}

function renderMainMenu(memberName, thaliNumber) {
  const shortName = formatShortName(memberName)
  const thali = thaliNumber ? ` • Thali #${String(thaliNumber).trim()}` : ''
  return `🍲 *Al-Mawaid* — Salam *${shortName}*${thali}\n\n` +
    `1. Today's Menu 🍽️\n` +
    `2. Tomorrow's Menu 📅\n` +
    `3. Rate Meal ⭐\n` +
    `4. Thali Dues & Pay 💳\n` +
    `5. Ask Admin 💬\n` +
    `6. Close Chat ❌\n\n` +
    `_Reply 1 to 6_`
}

// ═══════════════════════════════════════════════════════════════
// Message Processing Handler
// ═══════════════════════════════════════════════════════════════

async function handleMessage(waPhone, rawText) {
  const text = (rawText || '').trim()
  if (!text) return null
  const upper = text.toUpperCase()

  const { member, linked } = await getMemberByWaPhone(waPhone)
  const session = await getSession(waPhone)
  let state = session.state || {}

  // 1. Session timeout check (10 minutes of inactivity -> clear stale sub-flow)
  if (session?.updated_at) {
    const ageMs = Date.now() - new Date(session.updated_at).getTime()
    if (ageMs > 10 * 60 * 1000) {
      await clearSession(waPhone)
      state = {}
    }
  }

  // 2. Global cancel / Close Chat (Always active anytime)
  if (['6', 'CLOSE', 'END', 'EXIT', 'BYE', 'STOP', 'CANCEL'].includes(upper)) {
    await clearSession(waPhone)
    return `👋 *Chat Closed.*\nReply *MENU* anytime to reopen the portal.`
  }

  // 3. Global Menu & Start Commands (Always resets stuck flows)
  if (['MENU', 'HOME', 'START', 'MAIN MENU', 'RESET'].includes(upper)) {
    await clearSession(waPhone)
    if (member && linked) {
      return renderMainMenu(member.name, member.thali_number)
    }
  }

  // 4. Greetings (Always welcome member and show main menu)
  if (['HI', 'HELLO', 'HELP', 'ASSALAMUALAIKUM', 'SALAAM', 'HEY'].includes(upper)) {
    await clearSession(waPhone)
    if (member && linked) {
      return renderMainMenu(member.name, member.thali_number)
    }
  }

  // 5. Pleasantries & Thanks (Acknowledge warmly without creating false query tickets)
  if (['THANKS', 'THANK YOU', 'SHUKRAN', 'JAZAKALLAH', 'JAZAKALLAH KHAIR', 'OK', 'OKAY', 'DONE', 'FINE', 'ALHAMDULILLAH', 'MUBARAK'].includes(upper)) {
    await clearSession(waPhone)
    return `🙏 *Afwan / JazakAllah!* Happy to serve you.\n\n_Reply MENU anytime to view portal options._`
  }

  // 6. Explicit LINK command (works anytime): "link 101", "thali 101", "my thali is 101", "#101"
  const linkPrefixMatch = text.match(/^(?:(?:my\s+)?thali(?:\s*(?:no|number|#))?|link|t\.?no\.?)\s*[:#]?\s*([a-zA-Z0-9\-_\s/]+)$/i)
  if (linkPrefixMatch) {
    const candidateThali = linkPrefixMatch[1].trim()
    const found = await findMemberByThali(candidateThali)
    if (found) {
      await linkMember(waPhone, found)
      const tNum = String(found.thali_number || '').trim()
      const sName = formatShortName(found.name)
      return `✅ Thali *#${tNum}* linked successfully!\nSalam, *${sName}* 👋\n\n` + renderMainMenu(found.name, found.thali_number)
    } else {
      return `❌ Thali *#${candidateThali}* could not be found.\n\nPlease check your Thali Number and reply again.`
    }
  }

  // 7. Unlinked flow: Member not yet found in user_stats
  if (!member || !linked) {
    const cleanThali = text.replace(/^[#\s]+|[#\s]+$/g, '').trim()
    const isGreeting = ['HI', 'HELLO', 'START', 'HELP', 'ASSALAMUALAIKUM', 'SALAAM', 'HEY', 'MENU'].includes(upper)

    if (!isGreeting && cleanThali.length >= 1 && cleanThali.length <= 15) {
      const found = await findMemberByThali(cleanThali)
      if (found) {
        await linkMember(waPhone, found)
        const tNum = String(found.thali_number || '').trim()
        const sName = formatShortName(found.name)
        return `✅ Thali *#${tNum}* linked!\nSalam, *${sName}* 👋\n\n` + renderMainMenu(found.name, found.thali_number)
      } else if (/^[a-zA-Z0-9\-_\s/]+$/.test(cleanThali)) {
        return `❌ Thali *#${cleanThali}* not found in records.\n\nPlease reply with your correct Thali Number (e.g. \`101\`, \`104/B\`, \`G2\`):`
      }
    }
    return `👋 *Al-Mawaid Portal*\nSalam! Please reply with your *Thali Number* to access menus and dues (e.g. \`101\`, \`104/B\`, \`G2\`):`
  }

  // 8. Direct Thali Number Input (switch thali or reload)
  if (!['1', '2', '3', '4', '5', '6'].includes(upper) && !state.flow) {
    const candidateThali = await findMemberByThali(text)
    if (candidateThali) {
      if (candidateThali.user_id !== member.user_id) {
        await linkMember(waPhone, candidateThali)
        const tNum = String(candidateThali.thali_number || '').trim()
        const sName = formatShortName(candidateThali.name)
        return `✅ Switched to Thali *#${tNum}*!\nSalam, *${sName}* 👋\n\n` + renderMainMenu(candidateThali.name, candidateThali.thali_number)
      } else {
        return renderMainMenu(member.name, member.thali_number)
      }
    }
  }

  // 9. Active Multi-step Flow: FEEDBACK
  if (state.flow === 'feedback') {
    // If user changes their mind and inputs another menu number
    if (['1', '2', '4', '5', '6'].includes(upper) && state.step !== 'rating' && state.step !== 'comment') {
      await clearSession(waPhone)
      // routes to menu option below
    } else if (state.step === 'meal_type') {
      const low = text.toLowerCase()
      let meal = null
      if (['1', 'lunch', 'l', 'dupahr', 'dopahar'].includes(low)) {
        meal = 'lunch'
      } else if (['2', 'dinner', 'd', 'raat', 'night'].includes(low)) {
        meal = 'dinner'
      }

      if (!meal) {
        return `⭐ *Rate Meal Today*\n\n1. Lunch ☀️\n2. Dinner 🌙\n\n_Reply 1 for Lunch, 2 for Dinner, or MENU to cancel:_`
      }

      state.meal = meal
      state.step = 'rating'
      await setSession(waPhone, state)
      const mealTitle = meal === 'lunch' ? 'Lunch ☀️' : 'Dinner 🌙'
      return `⭐ *Rate ${mealTitle}*\n\n` +
        `1. 😞 Poor (1★)\n` +
        `2. 😐 Fair (2★)\n` +
        `3. 🙂 Good (3★)\n` +
        `4. 😄 Great (4★)\n` +
        `5. 🤩 Excellent (5★)\n\n` +
        `_Reply 1 to 5 (or MENU to cancel):_`
    } else if (state.step === 'rating') {
      const num = parseInt(text.charAt(0), 10)
      if (isNaN(num) || num < 1 || num > 5) {
        const mealTitle = state.meal === 'lunch' ? 'Lunch' : 'Dinner'
        return `Please reply with a number from *1* to *5* stars for ${mealTitle} (or MENU to cancel):`
      }
      state.stars = num
      state.step = 'comment'
      await setSession(waPhone, state)
      const mealTitle = state.meal === 'lunch' ? 'Lunch' : 'Dinner'
      return `⭐ *${STAR_LABELS[num]}*\n\nAny comments for *${mealTitle}*?\n_Reply with your comment, or - to skip:_`
    } else if (state.step === 'comment') {
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
      } catch {}

      await clearSession(waPhone)
      const mealDisplayName = state.meal === 'lunch' ? 'Lunch' : 'Dinner'
      return `🙏 *Thank You!*\nYour review for *${mealDisplayName}* (${state.stars}★) is recorded.\n\n_Reply MENU to continue_`
    }
  }

  // 10. Active Multi-step Flow: QUERY Prompt
  if (state.flow === 'query') {
    if (['1', '2', '3', '4', '6'].includes(upper)) {
      await clearSession(waPhone)
      // route to selected option below
    } else if (text) {
      const comment = text.trim()
      const subject = comment.length > 50 ? comment.substring(0, 47) + '...' : comment

      await supabase.from('queries').insert({
        user_id: member.user_id,
        subject: subject,
        comment: comment,
        status: 'open',
      })

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
      } catch {}

      await clearSession(waPhone)
      return `📨 *Message Sent to Admin!*\n\n"${comment}"\n\nForwarded to Jamaat management. They will review and reply soon.\n\n_Reply MENU to view options._`
    }
  }

  // 11. Active Multi-step Flow: PAYMENT Confirmation (Awaiting UTR)
  if (state.flow === 'payment' && state.step === 'awaiting_utr') {
    if (['1', '2', '3', '5', '6'].includes(upper)) {
      await clearSession(waPhone)
      // route to selected option below
    } else {
      const cleanUtr = text.replace(/^(?:PAID|UTR|REF|TXN)[:\s-]*/i, '').trim()
      if (!cleanUtr || cleanUtr.length < 5 || cleanUtr.length > 35) {
        return `⚠️ Please enter your *12-digit UTR* from GPay, PhonePe, or Paytm receipt (e.g. \`428912345678\`):\n\n_(Or reply MENU to cancel)_`
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
        metadata: {
          month: monthKey,
          month_label: monthLabel,
          wa_phone: waPhone,
          channel: 'whatsapp_bot',
          submitted_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (insErr) {
        console.error('[payment] insert error:', insErr)
        return `❌ Could not record payment. Please try again or contact management.`
      }

      await clearSession(waPhone)

      await notifyPaymentManager({
        member,
        amount: payAmt,
        utr: cleanUtr,
        monthLabel,
        waPhone,
      })

      const tNum = String(member.thali_number || 'N/A').trim()
      const shortName = formatShortName(member.name)
      return `✅ *Payment Recorded!*\n\n` +
        `• Thali: *#${tNum}* (${shortName})\n` +
        `• Amount: *₹${payAmt.toLocaleString('en-IN')}* (${monthLabel})\n` +
        `• UTR: \`${cleanUtr}\`\n\n` +
        `📢 Sent to management for verification. Thank you! 🙏\n\n` +
        `_Reply MENU anytime._`
    }
  }

  // Manager Quick Action: VERIFY <UTR>
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
        await supabase
          .from('user_payments')
          .update({ status: 'verified', updated_at: new Date().toISOString() })
          .eq('id', p.id)

        // Notify member on WhatsApp if wa_phone is stored
        const payerWaPhone = p.metadata?.wa_phone
        if (activeSock && payerWaPhone) {
          try {
            const memberJid = toWaJid(payerWaPhone)
            await activeSock.sendMessage(memberJid, {
              text: `🎉 *Payment Verified!*\n\n` +
                `Salam *${formatShortName(p.user_name)}*,\n` +
                `Your payment of *₹${Number(p.amount).toLocaleString('en-IN')}* for *${p.metadata?.month_label || 'this month'}* (UTR: \`${p.transaction_ref}\`) has been verified by *Mulla Murtaza Hamid*.\n\n` +
                `Status: ✅ *VERIFIED*\nThank you! 🙏`
            })
          } catch (e) {
            console.warn('Failed to notify member of verification:', e)
          }
        }

        return `✅ *Verified!*\n\n` +
          `• Thali: *#${p.thali_number}* (${p.user_name})\n` +
          `• Amount: *₹${Number(p.amount).toLocaleString('en-IN')}*\n` +
          `• UTR: \`${p.transaction_ref}\`\n\n` +
          `Member notified & dues updated.`
      } else {
        return `⚠️ No payment record found matching UTR \`${utrToVerify}\`.`
      }
    }
  }

  // Direct Shortcut: PAID <UTR> or PAID <AMOUNT> <UTR>
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
      metadata: {
        month: monthKey,
        month_label: monthLabel,
        wa_phone: waPhone,
        channel: 'whatsapp_bot',
        submitted_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (insErr) {
      console.error('[payment] insert error:', insErr)
      return `❌ Could not record payment. Please try again.`
    }

    await clearSession(waPhone)

    await notifyPaymentManager({
      member,
      amount: payAmt,
      utr: cleanUtr,
      monthLabel,
      waPhone,
    })

    const tNum = String(member.thali_number || 'N/A').trim()
    const shortName = formatShortName(member.name)
    return `✅ *Payment Recorded!*\n\n` +
      `• Thali: *#${tNum}* (${shortName})\n` +
      `• Amount: *₹${payAmt.toLocaleString('en-IN')}* (${monthLabel})\n` +
      `• UTR: \`${cleanUtr}\`\n\n` +
      `📢 Sent to management for verification. Thank you! 🙏\n\n` +
      `_Reply MENU anytime._`
  }

  // 12. Main Interactive Options: 1 to 6

  // Option 1: Today's Menu
  if (upper === '1' || upper === 'MENU' || upper === "TODAY" || upper === "TODAY'S MENU") {
    await clearSession(waPhone)
    const now = tzNow()
    const dayOfWeek = now.getUTCDay()
    if (dayOfWeek === 0) {
      return `🍽️ *Today's Menu (SUNDAY)*\n\nNo thali distribution today (Sunday).\n\n_Reply 2 to view Tomorrow's (Monday's) menu, or MENU for options._`
    }
    const appSettings = await loadAppSettings()
    const servingWeek = resolveServingWeekId(appSettings, now)
    const menuMap = await loadMenuMap(servingWeek)
    const dayKey = DAY_KEYS[dayOfWeek - 1] || 'mon'
    const dayMenu = menuForDay(menuMap, dayKey)
    const dayName = weekdayName(now)
    return renderMenuCard(dayKey, dayMenu, `Today's Menu (${dayName.toUpperCase()})`)
  }

  // Option 2: Tomorrow's Menu
  if (upper === '2' || upper === 'TOMORROW' || upper === "TOMORROW'S MENU") {
    await clearSession(waPhone)
    const now = tzNow()
    const tomorrow = new Date(now.getTime() + 86400_000)
    const tomDayOfWeek = tomorrow.getUTCDay()
    if (tomDayOfWeek === 0) {
      return `🍽️ *Tomorrow's Menu (SUNDAY)*\n\nNo thali distribution tomorrow (Sunday).\n\n_Reply 1 to view Today's menu, or MENU for options._`
    }
    const appSettings = await loadAppSettings()
    const servingWeek = resolveServingWeekId(appSettings, tomorrow)
    const menuMap = await loadMenuMap(servingWeek)
    const dayKey = DAY_KEYS[tomDayOfWeek === 0 ? 0 : tomDayOfWeek - 1] || 'mon'
    const dayMenu = menuForDay(menuMap, dayKey)
    const dayName = weekdayName(tomorrow)
    return renderMenuCard(dayKey, dayMenu, `Tomorrow's Menu (${dayName.toUpperCase()})`)
  }

  // Option 3: Meal Feedback
  if (upper === '3' || upper === 'FEEDBACK' || upper === 'RATE') {
    await setSession(waPhone, { flow: 'feedback', step: 'meal_type' })
    return `⭐ *Rate Meal Today*\n\n1. Lunch ☀️\n2. Dinner 🌙\n\n_Reply 1 for Lunch or 2 for Dinner (or MENU to cancel):_`
  }

  // Option 4: Pay Monthly Thali Contribution & Dues
  if (['4', 'DUES', 'PAYMENTS', 'PAYMENT', 'PAY', 'THALI PAYMENT', 'CONTRIBUTION'].includes(upper)) {
    await clearSession(waPhone)
    const appSettings = await loadAppSettings()
    const now = tzNow()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    const { data: payments } = await supabase
      .from('user_payments')
      .select('*')
      .eq('user_id', member.user_id)
      .order('created_at', { ascending: false })

    const validPayments = (payments || []).filter(p => p.status !== 'rejected')

    // Filter payments for this month
    const thisMonthPayments = validPayments.filter(p => {
      if (p.metadata?.month) return p.metadata.month === currentMonthKey
      if (p.created_at) {
        const k = `${new Date(p.created_at).getFullYear()}-${String(new Date(p.created_at).getMonth() + 1).padStart(2, '0')}`
        return k === currentMonthKey
      }
      return false
    })

    const paidThisMonth = thisMonthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)

    let totalDue = Number(appSettings.default_payment_due || 1500)
    if (member.payment_exempt) {
      totalDue = 0
    } else if (member.custom_due_amount != null && Number(member.custom_due_amount) > 0) {
      totalDue = Number(member.custom_due_amount)
    }

    const pendingBalance = Math.max(0, totalDue - paidThisMonth)
    const upiId = appSettings.upi_id || '6375250267@okbizaxis'
    const payeeName = appSettings.upi_payee_name || 'Al Mawaid'
    const tNum = String(member.thali_number || 'N/A').trim()
    const shortName = formatShortName(member.name)

    if (member.payment_exempt) {
      return `💚 *Thali #${tNum}* (${shortName})\n\n🛡️ Status: *Payment Exempt*\nNo monthly payment required.\n\n_Reply MENU anytime._`
    }

    if (pendingBalance === 0 && totalDue > 0) {
      return `🎉 *All Cleared for ${monthLabel}!*\n\n` +
        `• Thali: *#${tNum}* (${shortName})\n` +
        `• Paid: ₹${paidThisMonth.toLocaleString('en-IN')} ✅\n` +
        `• *Balance:* *₹0*\n\n` +
        `Thank you! 🙏\n_Reply MENU anytime._`
    }

    await setSession(waPhone, {
      flow: 'payment',
      step: 'awaiting_utr',
      monthKey: currentMonthKey,
      monthLabel: monthLabel,
      amount: pendingBalance,
      totalDue: totalDue
    })

    const mc = appSettings.upi_mc || '5812'
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&mc=${mc}&aid=uGICAgKCipYeAPg&ver=01&mode=01&am=${pendingBalance.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Thali #${tNum} - ${monthLabel}`)}`

    return `💳 *Thali #${tNum} Dues • ${monthLabel}*\n` +
      `Salam *${shortName}*,\n\n` +
      `• Due: ₹${totalDue.toLocaleString('en-IN')}\n` +
      (paidThisMonth > 0 ? `• Paid: ₹${paidThisMonth.toLocaleString('en-IN')} ✅\n` : '') +
      `• *Balance to Pay:* *₹${pendingBalance.toLocaleString('en-IN')}*\n\n` +
      `📲 *Pay via UPI:*\n` +
      `• UPI ID: \`${upiId}\` _(tap to copy)_\n` +
      `• Payee: *${payeeName}*\n` +
      `• 1-Tap Pay: ${upiUri}\n\n` +
      `👉 *After paying in GPay / PhonePe / Paytm, reply with your 12-digit UTR receipt:*`
  }

  // Option 5: Ask a Question
  if (upper === '5' || upper === 'QUERY' || upper === 'HELP QUERY' || upper === 'SUPPORT' || upper === 'ASK') {
    await setSession(waPhone, { flow: 'query', step: 'text' })
    return `💬 *Ask Admin*\n\nType your message or question below to send directly to Jamaat management (or reply MENU to cancel):`
  }

  // 13. Smart Query Detection & Fallback
  // If user typed a meaningful message (> 4 characters) that isn't a command, send as query
  const comment = text.trim()
  if (comment.length >= 4) {
    const subject = comment.length > 50 ? comment.substring(0, 47) + '...' : comment

    await supabase.from('queries').insert({
      user_id: member.user_id,
      subject: subject,
      comment: comment,
      status: 'open',
    })

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
    } catch {}

    return `📨 *Message Sent to Admin!*\n\n` +
      `"${comment}"\n\n` +
      `Forwarded to Jamaat management. They will review and reply soon.\n\n` +
      `_Reply MENU to view options._`
  }

  // Fallback default: show main menu
  return renderMainMenu(member.name, member.thali_number)
}

// ═══════════════════════════════════════════════════════════════
// Baileys Socket Runner
// ═══════════════════════════════════════════════════════════════

let botStartedOnce = false

async function startBot() {
  const authDir = path.join(__dirname, 'auth_info_baileys')
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const { version } = await fetchLatestBaileysVersion()

  if (!botStartedOnce) {
    console.log('🤖 Starting Al-Mawaid WhatsApp Bot...')
    console.log(`📡 Baileys version: ${version.join('.')}`)
    console.log(`📱 Web Portal & QR ready at http://localhost:${PORT}`)
    botStartedOnce = true
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
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
        console.log(`⚠️ Connection closed (code: ${statusCode || 'unknown'}). Reconnecting in 3s...`)
      }

      if (isLoggedOut) {
        console.log('❌ WhatsApp device was unlinked/logged out. Clearing session for fresh QR...')
        try {
          const authDir = path.join(__dirname, 'auth_info_baileys')
          const files = fs.readdirSync(authDir)
          for (const f of files) {
            try { fs.unlinkSync(path.join(authDir, f)) } catch {}
          }
        } catch (e) {
          console.warn('Failed to clear auth dir:', e)
        }
      }

      setTimeout(() => {
        startBot().catch(e => console.error('Failed to restart bot:', e))
      }, 3000)
    } else if (connection === 'open') {
      activeSock = sock
      botStatus = 'online'
      latestQr = null
      latestQrDataUrl = null
      connectedUser = sock.user
      const phone = connectedUser?.id ? connectedUser.id.split(':')[0] : 'WhatsApp'
      console.log(`\n🎉 ✅ AL-MAWAID WHATSAPP BOT IS ONLINE & READY! (+${phone})`)
      console.log(`🌐 Control Panel: http://localhost:${PORT}\n`)
    }
  })

  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (m.type !== 'notify') return
      for (const msg of m.messages) {
        if (!msg.message || msg.key.fromMe) continue
        const remoteJid = msg.key.remoteJid || ''
        if (remoteJid.endsWith('@g.us') || remoteJid.includes('broadcast') || remoteJid.includes('newsletter')) continue

        const waPhone = remoteJid.replace('@s.whatsapp.net', '')
        const rawText = extractMessageText(msg.message)

        if (!rawText) continue

        console.log(`📩 Incoming message from ${waPhone}: "${rawText}"`)

        // Mark read & simulate typing presence
        try {
          await sock.readMessages([msg.key])
          await sock.sendPresenceUpdate('composing', remoteJid)
        } catch {}

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
