// src/member/pages/UpiPayPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Standalone UPI REDIRECT page (route: /pay, alias /upi-pay).
//
// SCOPE — deliberately a redirect only:
//   This page does NOT write to `user_payments` — it only reads that table to
//   pre-fill the outstanding balance. It fires the UPI intent, explains
//   failures, and hands off. Recording a contribution is a MANAGEMENT action:
//   when they see the money land in the bank they mark the member Paid or
//   leave it Pending from Payments Hub (Mark Paid / Verify UTR / Unpaid filter).
//
//   Why this model: a `upi://pay` deep-link is fire-and-forget — NPCI never
//   pushes the transaction outcome back to a web page, and this project has no
//   payment gateway to receive a webhook. So any client-side "receipt" would
//   be a self-reported claim, not a verified transfer. Keeping the payer out
//   of the write path removes the phantom-record risk entirely: dues are only
//   ever changed by someone who checked the bank statement.
//
// SECURITY MODEL (the fix for "paying from user and receiver"):
//   The RECEIVER VPA is read-only. It comes from admin-configured
//   `app_settings.upi_id` and can never be typed or edited by the payer, so a
//   typo or malicious edit can't send money to the wrong person. The payer
//   controls only the amount and an optional note — both of which their own
//   UPI app re-displays before authorising.
//   The UPI PIN is NEVER touched here: it is entered inside the payer's own
//   bank app, the only place that can verify it. This page proposes; the bank
//   authorises; management records.
//
// NPCI RELIABILITY RULES (mirrors PaymentsPage, which is battle-tested):
//   1. `am` is always sent with 2 decimals — bare integers are rejected by
//      several PSPs as a malformed collect request.
//   2. One intent never exceeds the ₹1,00,000 per-transaction cap.
//   3. The primary button fires the generic `upi://pay` intent so Android shows
//      the system app chooser with receiver + amount prefilled, rather than a
//      hardcoded single-app deep link that breaks when that app is missing.
//   4. NO `tr` on the primary attempt — on a personal/P2P VPA Indian banks
//      treat `tr` without a merchant `mc` as an unverified merchant intent and
//      reject with "Bank limit exceeded". It IS offered as an alternate format
//      in the failure help, because certain banks want exactly that.
//   5. The receiver VPA is format-validated before launch so a misconfigured
//      ID fails loudly here instead of deep inside the bank app.
//   6. A 10-second cooldown blocks rapid double-taps from firing two intents,
//      and retries are always allowed — nothing to "finish" or "discard".
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import toast, { Toaster } from 'react-hot-toast'
import {
  ShieldCheck, Copy, Check, Smartphone, AlertTriangle,
  ArrowLeftRight, Info, ChevronLeft,
} from 'lucide-react'
import { supabase } from '../../lib/firebaseClient'
import { ThemeCtx } from '../../admin/context'
import { THEMES } from '../theme'
import { GeoBg, GlobalStyles, Card, Btn } from '../ui'

const DEFAULT_RECEIVER = 'murtazacool558@okhdfcbank'
const DEFAULT_PAYEE = 'Al-Mawaid'
const DEFAULT_DUE = 1500
const UPI_TXN_LIMIT = 100000     // NPCI per-transaction cap, ₹
const LAUNCH_COOLDOWN = 10 * 1000 // min gap between two intent fires

const isValidVpa = (v) => /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test((v || '').trim())
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const makeTrRef = () =>
  `AM${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`
    .replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)

export default function UpiPayPage() {
  // ── Receiver (locked) & settings ──
  const [receiverVpa, setReceiverVpa] = useState('')
  const [fallbackVpa, setFallbackVpa] = useState('')
  const [payeeName, setPayeeName] = useState(DEFAULT_PAYEE)
  const [merchantCode, setMerchantCode] = useState('')
  const [paymentTitle, setPaymentTitle] = useState('Monthly Thali Contribution')
  const [paymentsEnabled, setPaymentsEnabled] = useState(true)

  // ── Member context (used ONLY to pre-fill the amount they owe) ──
  const [profile, setProfile] = useState(null)
  const [balance, setBalance] = useState(null) // null = unknown

  // ── Form ──
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [fired, setFired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [lastAttempt, setLastAttempt] = useState(null) // in-memory only, for the help sheet

  // ── Failure handling: "bank limit exceeded" / "can't pay" ──
  const [failHelp, setFailHelp] = useState(false)
  const [showQr, setShowQr] = useState(false)

  const lastLaunchRef = useRef(0)

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
          .in('key', ['upi_id', 'upi_id_2', 'upi_payee_name', 'upi_mc', 'default_payment_due', 'payment_title', 'payment_enabled'])
        if (!alive) return
        if (cfgErr) setLoadError('Could not verify the receiver UPI ID. Showing the default.')
        const map = {}
        ;(rows || []).forEach(r => { map[r.key] = r.value })
        setReceiverVpa(String(map.upi_id || '').trim())
        // Alternate receiver: the primary fix when the main VPA hits its daily
        // collection cap ("receiver can't receive more today").
        setFallbackVpa(String(map.upi_id_2 || '').trim())
        if (map.upi_payee_name) setPayeeName(String(map.upi_payee_name).trim())
        if (map.upi_mc) setMerchantCode(String(map.upi_mc).trim())
        if (map.payment_title) setPaymentTitle(String(map.payment_title).trim())
        if (map.payment_enabled != null) setPaymentsEnabled(String(map.payment_enabled) !== 'false')
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
          const stats = statsRes.data || null
          setProfile(stats)

          const paid = (payRes.data || []).reduce((sum, p) => {
            if (!p?.created_at) return sum
            return monthKeyOf(new Date(p.created_at)) === currentMonth
              ? sum + (Number(p.amount) || 0)
              : sum
          }, 0)
          const owed = Math.max(0, Number((safeDue - paid).toFixed(2)))
          setBalance(owed)
          // Settled (or exempt) → don't nudge a stale figure. The field stays
          // editable so an extra voluntary contribution is still possible.
          setAmount(stats?.payment_exempt || owed <= 0 ? '' : String(owed))
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
  const fallbackValid = isValidVpa(fallbackVpa) && fallbackVpa.trim() !== receiver

  const numericAmount = Math.max(0, parseFloat(amount) || 0)
  const amountValid =
    Number.isFinite(numericAmount) && numericAmount >= 1 && numericAmount <= UPI_TXN_LIMIT

  const cleanNote = useMemo(
    () => (note.trim() || paymentTitle || 'Al-Mawaid Thali Contribution')
      .replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 45).trim(),
    [note, paymentTitle]
  )

  // NPCI-compliant deep link. Receiver is ALWAYS a configured VPA — never
  // something the payer typed.
  //   opts.withTr    → alternate bank-compatible format (see note 4 above).
  //   opts.receiver  → pay the alternate VPA, for receiver-side daily caps.
  const buildUpiUrl = useCallback((opts = {}) => {
    const rc = String(opts.receiver || receiver).trim()
    const amt = opts.amount != null ? Number(opts.amount) : numericAmount
    const params = [
      `pa=${encodeURIComponent(rc)}`,
      `pn=${encodeURIComponent(payeeName || DEFAULT_PAYEE)}`,
      `am=${encodeURIComponent(Number(amt).toFixed(2))}`,
      `cu=INR`,
      `tn=${encodeURIComponent(cleanNote)}`,
    ]
    if (merchantCode) params.push(`mc=${encodeURIComponent(merchantCode)}`)
    if (opts.withTr) params.push(`tr=${encodeURIComponent(makeTrRef())}`)
    return `upi://pay?${params.join('&')}`
  }, [receiver, payeeName, numericAmount, cleanNote, merchantCode])

  const upiUrl = useMemo(() => (amountValid ? buildUpiUrl() : null), [amountValid, buildUpiUrl])

  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return true
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }, [])

  // Custom schemes need ACTION_VIEW on native Android; anchor click elsewhere.
  const fireIntent = useCallback(async (url) => {
    const native = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
    if (native) {
      try {
        const { AppLauncher } = await import('@capacitor/app-launcher')
        const { completed } = await AppLauncher.openUrl({ url })
        if (completed) return
      } catch {
        /* fall through to anchor click */
      }
    }
    try {
      const link = document.createElement('a')
      link.href = url
      link.rel = 'noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch {
      window.location.href = url
    }
  }, [])

  // ── PAY: validate → fire. No attempt is persisted and no row is written —
  //    management marks the contribution Paid/Pending from Payments Hub. ──
  // `urlOverride` lets the app-shortcut buttons fire their own scheme
  // (tez://, phonepe://, paytmmp://) through identical validation.
  const handlePay = (urlOverride = null) => {
    if (!paymentsEnabled) {
      toast.error('Payments are currently paused. Please contact support.')
      return
    }
    if (!receiverIsConfigured) {
      toast.error('Receiver UPI ID is not configured correctly. Please contact support.')
      return
    }
    if (!amountValid) {
      toast.error(`Enter an amount between ₹1 and ₹${UPI_TXN_LIMIT.toLocaleString('en-IN')}.`)
      return
    }
    if (Date.now() - lastLaunchRef.current < LAUNCH_COOLDOWN) {
      toast.error('Please wait a moment before paying again.')
      return
    }
    lastLaunchRef.current = Date.now()

    setLastAttempt({
      amount: Number(numericAmount.toFixed(2)),
      receiver,
      at: Date.now(),
    })
    setFired(true)
    setFailHelp(false)
    fireIntent(urlOverride || buildUpiUrl())
    toast.success('Opening your UPI app — confirm the receiver and amount there.')
  }

  // Recovery launcher for a failed/blocked transfer. Reuses the same validation
  // as the primary Pay button, so a retry is always allowed (nothing is stashed
  // to block it).
  const launchWith = (opts) => {
    if (!paymentsEnabled) { toast.error('Payments are currently paused. Please contact support.'); return }
    if (!amountValid) { toast.error('Enter the amount you want to pay first.'); return }
    if (Date.now() - lastLaunchRef.current < LAUNCH_COOLDOWN) {
      toast.error('Please wait a moment before paying again.')
      return
    }
    lastLaunchRef.current = Date.now()
    setLastAttempt({
      amount: Number(numericAmount.toFixed(2)),
      receiver: String(opts.receiver || receiver).trim(),
      at: Date.now(),
    })
    setFailHelp(false)
    setFired(true)
    fireIntent(buildUpiUrl(opts))
    toast.success('Retrying — check the receiver and amount in your UPI app.')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(receiver)
      setCopied(true)
      toast.success(`Copied "${receiver}". Open your UPI app and choose "Pay to UPI ID".`)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Could not copy. Please copy the UPI ID manually.')
    }
  }

  const shortcutApps = [
    { id: 'gpay', label: 'GPay', scheme: 'tez://upi/pay' },
    { id: 'phonepe', label: 'PhonePe', scheme: 'phonepe://pay' },
    { id: 'paytm', label: 'Paytm', scheme: 'paytmmp://pay' },
  ]
  const buildShortcutUrl = (scheme) => (upiUrl ? `${scheme}?${upiUrl.split('?')[1]}` : null)

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
  const closeSheet = (setter) => (e) => {
    if (e.target === e.currentTarget) setter(false)
  }
  const sheetButton = {
    width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${t.border}`,
    background: 'transparent', color: t.textSub, fontSize: 13, fontWeight: 800, cursor: 'pointer',
  }

  return (
    <ThemeCtx.Provider value={t}>
      <div style={{
        minHeight: '100dvh', background: t.bgGrad, color: t.text,
        fontFamily: "'DM Sans','Segoe UI',-apple-system,sans-serif",
        position: 'relative', overflowX: 'hidden',
      }}>
        <GeoBg t={t} />
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
                Pay via UPI
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: t.textSub, opacity: 0.75 }}>
                You authorise the payment inside your own UPI app.
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

          {/* ── The handover contract: this page never records anything ── */}
          <div style={{
            marginBottom: 16, padding: '12px 14px', borderRadius: 12,
            background: t.accentBg, border: `1px solid ${t.accentBorder}`,
            color: t.textBody, fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 9,
            lineHeight: 1.6,
          }}>
            <Info size={15} style={{ flexShrink: 0, marginTop: 2, color: t.accent }} />
            <span>
              This page only opens your UPI app — <strong>it does not record anything</strong>.
              After you pay, management confirms the amount in the bank and marks your contribution{' '}
              <strong>Paid</strong> or <strong>Pending</strong>. Keep the UTR from your receipt for that.
            </span>
          </div>

          {/* ── RECEIVER — locked. This is the whole point of the page. ── */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <ShieldCheck size={17} color={t.successText || t.accent} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.textSub }}>
                Paying to
              </span>
            </div>

            <div style={{ fontSize: 17, fontWeight: 800, color: t.text, marginBottom: 2 }}>{payeeName}</div>

            <button
              onClick={handleCopy}
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
              This UPI ID is set by the organisation and cannot be changed here — your money always goes to the verified account.
            </p>
          </Card>

          {/* ── AMOUNT (pre-filled with outstanding due) + NOTE ── */}
          <Card style={{ marginBottom: 16 }}>
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
                Enter an amount between ₹1 and ₹{UPI_TXN_LIMIT.toLocaleString('en-IN')}.
              </p>
            )}
            {balance !== null && balance > 0 && (
              <p style={{ ...mutedStyle, marginTop: 8 }}>
                Pre-filled with what you owe for {paymentTitle.toLowerCase()}. Change it freely if you're paying more or less.
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
              placeholder={paymentTitle}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={inputStyle}
            />
          </Card>

          {/* ── REDIRECT ── */}
          <Btn onClick={() => handlePay()} disabled={!amountValid || loading || !paymentsEnabled} style={{ width: '100%', padding: '16px 24px', fontSize: 17 }}>
            <ArrowLeftRight size={18} />
            {amountValid ? `Pay ₹${numericAmount.toFixed(2)}` : 'Pay Now'}
          </Btn>

          {!paymentsEnabled && (
            <p style={{ ...mutedStyle, marginTop: 10, textAlign: 'center' }}>
              Payments are currently paused for this organisation.
            </p>
          )}

          {fired && (
            <div style={{
              marginTop: 14, padding: '12px 14px', borderRadius: 12,
              background: t.successBg, border: `1px solid ${t.successBorder}`,
              color: t.successText, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Smartphone size={15} style={{ flexShrink: 0 }} />
              Handed off to your UPI app. Once your bank confirms it, management will mark it Paid or Pending.
            </div>
          )}

          {/* No auto-prompt waits for them — a failure just needs a way out. */}
          {fired && !failHelp && (
            <button
              onClick={() => setFailHelp(true)}
              style={{
                width: '100%', marginTop: 10, padding: '11px 14px', borderRadius: 12,
                background: 'transparent', border: '1px solid rgba(239,68,68,0.4)',
                color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Bank said "limit exceeded" or the app never opened? Get help
            </button>
          )}

          <p style={{ margin: '14px 0 0', fontSize: 11.5, color: t.textSub, opacity: 0.6, textAlign: 'center', lineHeight: 1.6 }}>
            Opens your installed UPI app (GPay, PhonePe, Paytm, BHIM…) with the receiver and amount prefilled.
            Your UPI PIN is entered there, never here.
          </p>

          {/* ── Desktop fallback: upi:// schemes don't fire on laptops ── */}
          {!isMobile && (
            <Card style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.textSub, marginBottom: 14, textAlign: 'center' }}>
                On desktop?
              </div>

              {upiUrl ? (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  <div style={{ padding: 12, borderRadius: 16, background: '#fff' }}>
                    <QRCodeCanvas value={upiUrl} size={168} includeMargin={false} level="M" />
                  </div>
                </div>
              ) : (
                <p style={{ ...mutedStyle, marginBottom: 14, textAlign: 'center' }}>
                  Enter an amount above to generate a scannable QR code.
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {shortcutApps.map((app) => {
                  const url = buildShortcutUrl(app.scheme)
                  return (
                    <button
                      key={app.id}
                      onClick={() => handlePay(url)}
                      disabled={!url}
                      style={{
                        padding: '10px 6px', borderRadius: 12, minHeight: 44,
                        background: url ? 'transparent' : 'rgba(128,128,128,0.06)',
                        border: `1px solid ${url ? t.border : 'transparent'}`,
                        color: url ? t.accent : t.textSub, opacity: url ? 1 : 0.4,
                        fontSize: 12.5, fontWeight: 700, cursor: url ? 'pointer' : 'not-allowed',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {app.label}
                    </button>
                  )
                })}
              </div>
            </Card>
          )}
        </main>

        {/* ── FAILURE HELP: why the transfer was refused, and how past it ── */}
        {failHelp && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Payment failed help"
            onClick={closeSheet(setFailHelp)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9600,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            }}
          >
            <div style={{ ...sheetStyle, borderTop: '2px solid #ef4444' }}>
              <div style={{ width: 44, height: 4, borderRadius: 999, background: t.border, margin: '0 auto 14px' }} />
              <div style={{ fontSize: 16, fontWeight: 900, color: t.text, textAlign: 'center' }}>
                Bank Rejected the Payment?
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', textAlign: 'center', marginTop: 6, marginBottom: 4 }}>
                Nothing reached Al-Mawaid — your dues are unchanged. Try one of these.
              </div>
              <div style={{ fontSize: 11.5, color: t.textSub, textAlign: 'center', marginTop: 2, marginBottom: 12 }}>
                {lastAttempt
                  ? `Attempted ₹${Number(lastAttempt.amount).toFixed(2)} → ${lastAttempt.receiver}`
                  : 'This error comes from your bank, not this app — even ₹1 fails when the bank-side limit is hit.'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {[
                  ['🏦', 'Daily UPI quota exhausted (most common)', 'Your bank counts every UPI payment across ALL your apps (GPay, PhonePe, Paytm…). Once the daily quota is over, even ₹1 fails with "limit exceeded". Fix: pay from a different bank account inside your UPI app, or retry after midnight.'],
                  ['📥', 'Receiver daily collection cap', 'One UPI ID can only receive a fixed amount per day. When many members pay together, switch to the alternate receiver below.'],
                  ['📲', 'Intent blocked by the app', 'Some bank apps reject direct deep-links. Use "Retry in alternate format", or scan the QR from inside your UPI app instead.'],
                  ['🧾', 'Per-transaction cap', 'This page blocks anything above ₹1,00,000 (the NPCI cap). Your own bank may cap lower — split the amount into two payments.'],
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => launchWith({ withTr: true })}
                  style={{ width: '100%', padding: '13px', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer' }}
                >
                  🔁 Retry in Alternate Format
                </button>

                <div style={{ display: 'flex', gap: 8 }}>
                  {fallbackValid && (
                    <button
                      type="button"
                      onClick={() => launchWith({ receiver: fallbackVpa.trim() })}
                      style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1.5px solid ${t.accent}`, background: t.accentBg, color: t.accent, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
                    >
                      Alternate Receiver
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setFailHelp(false); setShowQr(true) }}
                    style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1.5px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
                  >
                    📷 Pay via QR
                  </button>
                </div>

                <button type="button" onClick={() => setFailHelp(false)} style={sheetButton}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── QR SHEET: scanning from inside the UPI app is the reliable
                fallback when a deep-link is blocked. Available on mobile too. */}
        {showQr && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Scan to pay"
            onClick={closeSheet(setShowQr)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9600,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            }}
          >
            <div style={{ ...sheetStyle, borderTop: `2px solid ${t.accent}`, textAlign: 'center' }}>
              <div style={{ width: 44, height: 4, borderRadius: 999, background: t.border, margin: '0 auto 14px' }} />
              <div style={{ fontSize: 16, fontWeight: 900, color: t.text, marginBottom: 4 }}>
                Scan with your UPI app
              </div>
              <div style={{ fontSize: 12.5, color: t.textSub, marginBottom: 14 }}>
                Open GPay / PhonePe / Paytm → Scan → confirm the amount.
              </div>

              {upiUrl ? (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                  <div style={{ padding: 12, borderRadius: 16, background: '#fff' }}>
                    <QRCodeCanvas value={upiUrl} size={196} includeMargin={false} level="M" />
                  </div>
                </div>
              ) : (
                <p style={{ ...mutedStyle, marginBottom: 14 }}>
                  Enter a valid amount on the page first, then reopen this code.
                </p>
              )}

              <div style={{
                display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 13px',
                borderRadius: 12, background: t.inputBg, border: `1px solid ${t.inputBorder || t.border}`,
                fontSize: 12.5, textAlign: 'left', marginBottom: 6,
              }}>
                <span style={{ color: t.textSub, flexShrink: 0 }}>Paying to</span>
                <span style={{ color: t.text, wordBreak: 'break-all', textAlign: 'right' }}>{receiver}</span>
              </div>

              <button type="button" onClick={() => setShowQr(false)} style={{ ...sheetButton, marginTop: 8 }}>
                Close
              </button>
            </div>
          </div>
        )}

        <GlobalStyles />
      </div>
    </ThemeCtx.Provider>
  )
}
