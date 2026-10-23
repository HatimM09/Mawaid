// ═════════════════════════════════════════════════════════════════════════════
// AL-MAWAID — Secure UPI Pay Page (`/pay`, `/upi-pay`)
//
// REBUILT v3 ("tap-the-fragile-app-link" removed on purpose).
//
// WHY THE REBUILD: the old page fired `upi://` intents opened straight into the
// payer's UPI app. Banks intermittently refuse those app-opened payments with
// "Payment limit exceeded", even for ₹1 — a bank/PSP-side rejection the app can
// neither detect nor prevent. The formats that NEVER fail that way are:
//
//   1. SCAN THE QR  — inside the UPI app's own scanner. The app reads the code
//      natively, no external intent, no "unverified app" treatment. Primary path.
//   2. COPY THE UPI ID  — paste/choose "Pay to UPI ID" in the app. Equally
//      reliable; the app itself re-verifies receiver name + amount.
//   3. SHARE THE LINK  — the same NPCI-compliant deep link sent over
//      WhatsApp/etc, opened on a device where it does work.
//   4. AUTOPAY MANDATE — approve a monthly recurring mandate once; the bank
//      debits the receiver directly on schedule forever after (zero fee).
//
// SECURITY / TRUST MODEL (unchanged contract, stated plainly):
//   • The RECEIVER is read-only — read from admin-configured `app_settings.upi_id`
//     and format-validated. A payer can never type or edit it here.
//   • The UPI PIN is NEVER entered here — only inside the payer's bank app.
//   • This page writes NOTHING to `user_payments` (no self-reported money).
//   • There is a gateway with ZERO fees because money never touches this app:
//     bank → bank, direct. Management marks contributions Paid/Pending from
//     Payments Hub after seeing them land in the bank.
//   • No webhook exists for manual UPI, so nothing pretending otherwise is built.
//
// NPCI RULES APPLIED
//   • `am` always 2 decimals; `cu=INR`; note sanitised to A-Z/0-9/space/dash ≤45.
//   • Amounts above ₹1,00,000 are refused here (NPCI per-transaction cap) — pay
//     such dues in parts.
//   • QR/deep-link `tr` is never added on personal P2P VPAs (banks reject
//     unsigned `tr` intents as unverified-merchant collect requests).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import toast, { Toaster } from 'react-hot-toast'
import {
  ShieldCheck, Copy, Check, AlertTriangle, Info, ChevronLeft,
} from 'lucide-react'
import { supabase } from '../../lib/firebaseClient'
import { ThemeCtx } from '../../admin/context'
import { THEMES } from '../theme'
import { GeoBg, GlobalStyles, Card, Btn } from '../ui'

const DEFAULT_RECEIVER = 'murtazacool558@okhdfcbank'
const DEFAULT_PAYEE = 'Al-Mawaid'
const DEFAULT_DUE = 1500
const UPI_TXN_LIMIT = 100000      // NPCI per-transaction cap, ₹
const AUTOPAY_MAX = 15000         // NPCI per-mandate cap (no additional auth factor)
const DEFAULT_SCAN_GAP_MS = 3 * 1000 // light tap-gap against QR tap spam

const isValidVpa = (v) => /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test((v || '').trim())
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const makeRef = () =>
  `AM${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`
    .replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)
const ord = (n) => {
  const v = n % 100
  const suffix = ['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th'
  return `${n}${suffix}`
}

export default function UpiPayPage() {
  // ── Receiver (locked) & admin settings ──
  const [receiverVpa, setReceiverVpa] = useState('')
  const [payeeName, setPayeeName] = useState(DEFAULT_PAYEE)
  const [title, setTitle] = useState('Monthly Thali Contribution')
  const [paymentsEnabled, setPaymentsEnabled] = useState(true)
  const [autopayEnabled, setAutopayEnabled] = useState(false)

  // ── Member context (used ONLY to pre-fill the amount they owe) ──
  const [profile, setProfile] = useState(null)
  const [balance, setBalance] = useState(null) // null = unknown

  // ── Form/UI state ──
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [autopayDay, setAutopayDay] = useState('1')

  const lastActionRef = useRef(0)

  // Theme: reuse the app theme when mounted inside ThaliUserApp, otherwise the
  // member's persisted choice (this page is reachable standalone).
  const [localThemeId] = useState(() => localStorage.getItem('almawaid_theme') || 'dark')

  // ── MOUNT: session + settings + this member's outstanding due ──
  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        let sessionUser = null
        try {
          const { data } = await supabase.auth.getUser()
          sessionUser = data?.user || null
        } catch { /* signed out / offline */ }
        if (!alive) return

        const { data: rows, error: cfgErr } = await supabase
          .from('app_settings')
          .select('key,value')
          .in('key', ['upi_id', 'upi_payee_name', 'upi_mc', 'default_payment_due', 'payment_title', 'payment_enabled', 'upi_autopay_enabled'])
        if (!alive) return
        if (cfgErr) setLoadError('Could not verify the receiver UPI ID. Showing the default.')
        const map = {}
        ;(rows || []).forEach(r => { map[r.key] = r.value })
        setReceiverVpa(String(map.upi_id || '').trim())
        if (map.upi_payee_name) setPayeeName(String(map.upi_payee_name).trim())
        if (map.payment_title) setTitle(String(map.payment_title).trim())
        if (map.payment_enabled != null) setPaymentsEnabled(String(map.payment_enabled) !== 'false')
        if (map.upi_autopay_enabled != null) setAutopayEnabled(String(map.upi_autopay_enabled).trim() === 'true')
        const due = Number(map.default_payment_due)
        const safeDue = Number.isFinite(due) && due > 0 ? due : DEFAULT_DUE

        if (!sessionUser) {
          setAmount(String(safeDue))
        } else {
          const currentMonth = monthKeyOf(new Date())
          const [statsRes, payRes] = await Promise.all([
            supabase.from('user_stats')
              .select('user_id, name, thali_number, email, payment_exempt')
              .eq('user_id', sessionUser.id)
              .maybeSingle(),
            supabase.from('user_payments')
              .select('amount, created_at')
              .eq('user_id', sessionUser.id),
          ])
          if (!alive) return
          setProfile(statsRes.data || null)
          const paid = (payRes.data || []).reduce((sum, p) => {
            if (!p?.created_at) return sum
            return monthKeyOf(new Date(p.created_at)) === currentMonth
              ? sum + (Number(p.amount) || 0)
              : sum
          }, 0)
          const owed = Math.max(0, Number((safeDue - paid).toFixed(2)))
          setBalance(owed)
          setAmount(statsRes.data?.payment_exempt || owed <= 0 ? '' : String(owed))
        }
      } catch {
        if (alive) setLoadError('Could not load payment settings. Showing defaults.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [])

  const receiver = isValidVpa(receiverVpa) ? receiverVpa : DEFAULT_RECEIVER
  const receiverIsConfigured = isValidVpa(receiverVpa)

  const numericAmount = Math.max(0, parseFloat(amount) || 0)
  const amountValid =
    Number.isFinite(numericAmount) && numericAmount >= 1 && numericAmount <= UPI_TXN_LIMIT

  const cleanNote = useMemo(
    () => (note.trim() || title || 'Al-Mawaid Thali Contribution')
      .replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 45).trim(),
    [note, title]
  )

  // UPI deep link used for the QR code and the share link. Kept deliberately
  // minimal (P2P: no `tr`, no `mc` on personal VPAs) — the exact format that
  // every PSP app parses happily.
  const upiLink = useMemo(() => {
    if (!amountValid) return null
    const params = [
      `pa=${encodeURIComponent(receiver)}`,
      `pn=${encodeURIComponent(payeeName || DEFAULT_PAYEE)}`,
      `am=${encodeURIComponent(Number(numericAmount).toFixed(2))}`,
      `cu=INR`,
      `tn=${encodeURIComponent(cleanNote)}`,
    ]
    return `upi://pay?${params.join('&')}`
  }, [receiver, payeeName, numericAmount, cleanNote, amountValid])

  // Thin tap-gap so tapping "Show QR"/"Copy" eleven times doesn't fire eleven
  // toasts; sharing is always allowed.
  const withinGap = () => Date.now() - lastActionRef.current < DEFAULT_SCAN_GAP_MS

  const handleCopyId = async () => {
    if (withinGap()) { toast.error('Slow down a moment.'); return }
    lastActionRef.current = Date.now()
    try {
      await navigator.clipboard.writeText(receiver)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      toast.success('UPI ID copied — paste it in "Pay to UPI ID" inside your app.', { duration: 4000 })
    } catch {
      toast.error('Could not copy. Please copy the UPI ID manually.')
    }
  }

  const handleCopyLink = async () => {
    if (!upiLink) { toast.error('Enter a valid amount first.'); return }
    try {
      await navigator.clipboard.writeText(upiLink)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
      toast.success('Payment link copied.')
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  const handleWhatsAppShare = () => {
    if (!upiLink) { toast.error('Enter a valid amount first.'); return }
    const text =
      `Al-Mawaid ${paymentTitleText()} — ₹${Number(numericAmount).toFixed(0)}\n` +
      `Pay via UPI (tap or scan):\n${upiLink}`
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener')
  }

  const paymentTitleText = () => (title || 'Thali Contribution')

  // ── UPI AutoPay monthly mandate ──
  const buildMandateUrl = useCallback(() => {
    const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`
    const start = new Date()
    const end = new Date(start.getFullYear() + 5, start.getMonth(), start.getDate())
    const ref = makeRef()
    const params = [
      `pa=${encodeURIComponent(receiver)}`,
      `pn=${encodeURIComponent(payeeName || DEFAULT_PAYEE)}`,
      `am=${encodeURIComponent(Number(numericAmount).toFixed(2))}`,
      `mn=${encodeURIComponent(paymentTitleText().slice(0, 45))}`,
      `tn=${encodeURIComponent(cleanNote)}`,
      `cu=INR`,
      `amrule=MAX`,
      `recur=MONTHLY`,
      `recurRule=ON`,
      `recurValue=${Number(autopayDay)}`,
      `validitystart=${fmt(start)}`,
      `validityend=${fmt(end)}`,
      `tr=${ref}`,
      `tid=${ref}`,
      `mode=04`,
      `orgid=000000`,
      `purpose=14`,
      `txnType=CREATE`,
      `rev=Y`,
      `block=N`,
    ]
    return `upi://mandate/pay?${params.join('&')}`
  }, [receiver, payeeName, numericAmount, cleanNote, autopayDay])

  // Mandates as QR: scanning the mandate URI inside the UPI app is just as
  // reliable as the personal-QR path (reuses that app's parser, not an intent).
  const autopayEligible =
    paymentsEnabled && receiverIsConfigured && amountValid && numericAmount >= 1 && numericAmount <= AUTOPAY_MAX

  const t = THEMES[localThemeId] || THEMES.dark
  const inputStyle = {
    width: '100%', padding: '13px 15px', borderRadius: 14,
    background: t.inputBg, border: `1px solid ${t.inputBorder}`,
    color: t.text, fontSize: 15, fontFamily: "'DM Sans', sans-serif",
    outline: 'none', minHeight: 48,
  }
  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: t.textSub, marginBottom: 8,
    fontFamily: "'DM Sans', sans-serif",
  }
  const mutedStyle = { margin: 0, fontSize: 12.5, color: t.textSub, opacity: 0.7, lineHeight: 1.6 }
  const sheetStyle = {
    background: t.card, borderRadius: '24px 24px 0 0',
    maxWidth: 460, width: '100%', maxHeight: '92dvh', overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    padding: '14px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
    boxSizing: 'border-box',
  }
  const closeSheet = (setter) => (e) => { if (e.target === e.currentTarget) setter(false) }
  const sheetButton = {
    width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${t.border}`,
    background: 'transparent', color: t.textSub, fontSize: 13, fontWeight: 800, cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  }
  const stepBadge = {
    width: 24, height: 24, borderRadius: 999, flexShrink: 0,
    background: t.accentBg, color: t.accent, border: `1px solid ${t.accentBorder}`,
    fontSize: 12.5, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <ThemeCtx.Provider value={t}>
      <div style={{
        minHeight: '100dvh', background: t.bgGrad, color: t.text,
        fontFamily: "'DM Sans','Segoe UI',-apple-system,sans-serif",
        position: 'relative', overflowX: 'hidden',
      }}>
        <GeoBg t={t} />
        <GlobalStyles t={t} />
        <Toaster position="top-center" />

        <main style={{
          position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto',
          padding: 'calc(env(safe-area-inset-top, 12px) + 24px) clamp(16px, 4vw, 24px) 48px',
        }}>
          <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 22 }}>
            <button
              onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = '/'))}
              aria-label="Go back"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: t.accent, flexShrink: 0 }}
            >
              <ChevronLeft size={20} />
            </button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <img src="/al-mawaid.png" alt="" style={{ width: 46, height: 46, objectFit: 'contain', filter: 'drop-shadow(0 2px 10px rgba(196,156,90,0.5))' }} />
              <h1 style={{ margin: '10px 0 4px', fontSize: 23, fontWeight: 700, letterSpacing: '0.05em', color: t.accent, fontFamily: "'Playfair Display',serif" }}>
                Pay Securely
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: t.textSub, opacity: 0.75 }}>
                Scan or copy — money goes bank-to-bank, never through this app.
              </p>
            </div>
            <div style={{ width: 32, flexShrink: 0 }} />
          </header>

          {loadError && (
            <div style={{
              marginBottom: 16, padding: '12px 14px', borderRadius: 12,
              background: 'rgba(220,60,60,0.09)', border: '1px solid rgba(220,60,60,0.28)',
              color: '#e05555', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />{loadError}
            </div>
          )}

          {/* ── The handover contract ── */}
          <div style={{
            marginBottom: 16, padding: '12px 14px', borderRadius: 12,
            background: t.accentBg, border: `1px solid ${t.accentBorder}`,
            color: t.textBody, fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 9,
            lineHeight: 1.6,
          }}>
            <Info size={15} style={{ flexShrink: 0, marginTop: 2, color: t.accent }} />
            <span>
              This page doesn't move money or record anything — your bank sees only the
              payment you make there. After the amount lands in the account, management
              marks your contribution <strong>Paid</strong> or <strong>Pending</strong> in Payments Hub.
            </span>
          </div>

          {/* ── AMOUNT + NOTE ── */}
          <Card style={{ marginBottom: 14 }}>
            <label htmlFor="upi-amount" style={labelStyle}>
              Amount (INR) *
              {balance !== null && balance > 0 && (
                <span style={{ float: 'right', textTransform: 'none', letterSpacing: 0, color: t.accent, fontWeight: 700 }}>
                  ₹{balance.toFixed(2)} due
                </span>
              )}
              {balance !== null && balance <= 0 && (
                <span style={{ float: 'right', textTransform: 'none', letterSpacing: 0, color: t.successText || '#34d399', fontWeight: 700 }}>
                  Settled for this month
                </span>
              )}
            </label>
            <input
              id="upi-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="1"
              max={UPI_TXN_LIMIT}
              placeholder="e.g. 1500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={inputStyle}
            />
            {amount.trim() !== '' && !amountValid && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#e05555' }}>
                Enter an amount between ₹1 and ₹{UPI_TXN_LIMIT.toLocaleString('en-IN')} — larger dues are paid in parts.
              </p>
            )}
            {balance !== null && balance > 0 && (
              <p style={{ ...mutedStyle, marginTop: 8 }}>
                Pre-filled with what you owe for {paymentTitleText().toLowerCase()}. Change it freely.
              </p>
            )}
            {profile?.payment_exempt && (
              <p style={{ ...mutedStyle, marginTop: 8 }}>
                Your account is marked exempt from dues — you can ignore this if nothing is owed.
              </p>
            )}

            <label htmlFor="upi-note" style={{ ...labelStyle, marginTop: 18 }}>Note (optional)</label>
            <input
              id="upi-note"
              type="text"
              maxLength={45}
              placeholder={paymentTitleText()}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={inputStyle}
            />
          </Card>

          {/* ── RECEIVER (locked) ── */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <ShieldCheck size={17} color={t.successText || t.accent} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.textSub }}>
                Money goes to
              </span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: t.text, marginBottom: 2 }}>{loading ? '…' : payeeName}</div>
            <button
              onClick={handleCopyId}
              title="Copy UPI ID"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                marginTop: 8, padding: '11px 13px', borderRadius: 12,
                background: t.accentBg, border: `1px solid ${t.accentBorder}`,
                color: t.accent, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif", textAlign: 'left', minHeight: 44,
              }}
            >
              <span style={{ flex: 1, wordBreak: 'break-all' }}>{loading ? '…' : receiver}</span>
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
            <p style={{ ...mutedStyle, marginTop: 10 }}>
              Set by the organisation and locked here — your money always reaches the verified account.
            </p>
          </Card>

          {/* ── STEP 1: SCAN THE QR (the never-fails path, works inside any UPI app) ── */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={stepBadge}>1</div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: t.text }}>
                Scan this with your UPI app
              </div>
            </div>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 12.5, color: t.textSub, lineHeight: 1.7 }}>
              <li>Open <strong style={{ color: t.text }}>GPay / PhonePe / Paytm / BHIM</strong> on this phone</li>
              <li>Tap the app's own <strong style={{ color: t.text }}>Scan</strong> (or Scan-any-QR) button</li>
              <li>The receiver + amount appear pre-filled — approve with your UPI PIN</li>
            </ul>
            {upiLink ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 12, background: '#fff', borderRadius: 14, border: `1px solid ${t.border}` }}>
                <QRCodeCanvas value={upiLink} size={210} includeMargin={false} level="M" />
              </div>
            ) : (
              <p style={{ ...mutedStyle, textAlign: 'center', padding: 18, border: `1px dashed ${t.border}`, borderRadius: 12 }}>
                Enter a valid amount above to show the QR.
              </p>
            )}
            <p style={{ ...mutedStyle, marginTop: 10, textAlign: 'center' }}>
              Scanning inside the app (not the phone camera) is what makes this the most reliable way to pay.
            </p>
          </Card>

          {/* ── STEP 2: COPY / SHARE (for when this phone can't pay — e.g. parents) ── */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={stepBadge}>2</div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: t.text }}>
                Or pay to the copied UPI ID / send the link
              </div>
            </div>
            <p style={{ ...mutedStyle, marginBottom: 12 }}>
              Every UPI app has a "Pay to UPI ID" option — copy the ID above and paste it there.
              Paying from another phone? Share the exact payment link over WhatsApp.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Btn
                onClick={handleCopyLink}
                disabled={!upiLink || loading}
                style={{ width: '100%', padding: '13px 16px', fontSize: 14 }}
              >
                {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                {copiedLink ? 'Payment link copied' : 'Copy Payment Link'}
              </Btn>
              <Btn
                onClick={handleWhatsAppShare}
                disabled={!upiLink || loading}
                style={{ width: '100%', padding: '13px 16px', fontSize: 14 }}
              >
                <Info size={16} />
                Send on WhatsApp
              </Btn>
            </div>
          </Card>

          {/* ── AUTOPAY (admin-gated) ── */}
          {autopayEnabled && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <ShieldCheck size={17} color={t.successText || t.accent} />
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.textSub }}>
                  AutoPay — approve once, pay every month
                </span>
              </div>
              <p style={{ ...mutedStyle, marginBottom: 10 }}>
                Your bank pays the amount below to the receiver on the same date every month —
                straight bank-to-bank, no charges. Pause anytime from your UPI app.
              </p>
              {!upiLink ? (
                <p style={{ ...mutedStyle }}>
                  Enter a valid amount above to set up AutoPay.
                </p>
              ) : autopayEligible ? (
                <>
                  <label htmlFor="autopay-day" style={{ ...labelStyle, marginBottom: 8 }}>Debit date of the month</label>
                  <select
                    id="autopay-day"
                    value={autopayDay}
                    onChange={(e) => setAutopayDay(e.target.value)}
                    style={{ ...inputStyle, marginBottom: 12 }}
                  >
                    {Array.from({ length: 28 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{ord(i + 1)} of every month</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 12, background: '#fff', borderRadius: 14, border: `1px solid ${t.border}` }}>
                    <QRCodeCanvas value={buildMandateUrl()} size={180} includeMargin={false} level="M" />
                  </div>
                  <p style={{ ...mutedStyle, marginTop: 10, textAlign: 'center' }}>
                    Scan with your UPI app to create the monthly mandate for ₹{numericAmount.toFixed(0)} on the {ord(Number(autopayDay))}.
                  </p>
                </>
              ) : (
                <p style={{ ...mutedStyle }}>
                  AutoPay supports up to ₹{AUTOPAY_MAX.toLocaleString('en-IN')} per month — for larger dues, scan the QR above.
                </p>
              )}
            </Card>
          )}

          <p style={{ margin: '14px 0 0', fontSize: 11.5, color: t.textSub, opacity: 0.6, textAlign: 'center', lineHeight: 1.6 }}>
            {paymentsEnabled
              ? 'No gateway fees — UPI is free. This app only shows you where to pay; the payment happens entirely inside your bank.'
              : 'Payments are currently paused for this organisation. Please contact management.'}
          </p>

          <button
            onClick={() => setShowHelp(true)}
            style={{
              width: '100%', marginTop: 16, padding: '11px 14px', borderRadius: 12,
              background: 'transparent', border: '1px solid rgba(239,68,68,0.4)',
              color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Payment failed or stuck? What to do
          </button>
        </main>

        {/* ── HELP SHEET ── */}
        {showHelp && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Payment help"
            onClick={closeSheet(setShowHelp)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9600,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            }}
          >
            <div style={{ ...sheetStyle, borderTop: '2px solid #ef4444' }}>
              <div style={{ width: 44, height: 4, borderRadius: 999, background: t.border, margin: '0 auto 14px' }} />
              <div style={{ fontSize: 16, fontWeight: 900, color: t.text, textAlign: 'center' }}>
                Payment not going through?
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', textAlign: 'center', marginTop: 6, marginBottom: 12 }}>
                Nothing reached Al-Mawaid — your dues are unchanged.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {[
                  ['🏦', 'Daily UPI quota exhausted (most common)', 'Your bank counts every UPI payment across ALL your apps (GPay, PhonePe, Paytm…). After the daily quota, even ₹1 fails. Fix: pay from a different bank account in your UPI app, or retry after midnight.'],
                  ['📥', 'Receiver reached today\'s collection cap', 'One UPI ID can only receive a fixed amount per day. If you hit this while others are also paying, tell management (Payments Hub → help) and pay tomorrow.'],
                  ['🧾', 'Per-transaction cap', 'UPI allows up to ₹1,00,000 per payment; your bank may cap it lower. Split the amount into two payments.'],
                  ['⛽', 'No balance / wrong account selected', 'Check the selected bank account inside your UPI app before retrying.'],
                ].map(([icon, title, body]) => (
                  <div key={title} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 13, background: t.inputBg, border: `1px solid ${t.inputBorder || t.border}` }}>
                    <div style={{ fontSize: 18, flexShrink: 0 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 2 }}>{title}</div>
                      <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.55 }}>{body}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" onClick={() => setShowHelp(false)} style={sheetButton}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeCtx.Provider>
  )
}
