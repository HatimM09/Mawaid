// ═════════════════════════════════════════════════════════════════════════════
// AL-MAWAID — Pay page (`/pay`, `/upi-pay`)
//
// ONE FLOW ONLY: "Copy & Open" — the zero-fee, zero-merchant-account path.
//
// WHY THIS WORKS WHEN DIRECT LINKS FAIL:
//   Banks/PSPs reject app-opened intents that arrive WITH payment parameters
//   ("Payment limit exceeded", "bank limit exceeded") because a prefilled
//   amount looks like a merchant/collect request the app never verified.
//   When the member pastes the UPI ID inside their own UPI app and types the
//   amount there, the bank treats it as a fully user-initiated P2P transfer —
//   the one flow that never hits that rejection, and it uses the member's own
//   daily limit (up to ₹1,00,000) instead of a lower app-imposed cap.
//
// THE FLOW:
//   1. Tap "Copy UPI ID & Open UPI App"
//   2. The receiver VPA is copied to the clipboard (one tap)
//   3. The generic `upi://pay` scheme opens the UPI app chooser (no params,
//      so no fraud check fires)
//   4. In the app: long-press the UPI ID field → Paste → enter the amount →
//      UPI PIN. Money goes bank → bank.
//
// WHAT THIS PAGE NEVER DOES:
//   • It never asks for a UPI PIN, never enters one, never sees it.
//   • It writes NOTHING to the database — no self-reported receipts exist.
//     Management confirms the money in the bank and marks dues Paid/Pending
//     from Payments Hub (that flow is untouched).
//   • It holds no money — so there is no custody, no license, and no fee.
// ═════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  ShieldCheck, Copy, Check, AlertTriangle, ChevronLeft, ExternalLink, Info,
} from 'lucide-react'
import { supabase } from '../../lib/firebaseClient'
import { ThemeCtx } from '../../admin/context'
import { THEMES } from '../theme'
import { GeoBg, GlobalStyles, Card, Btn } from '../ui'

const DEFAULT_RECEIVER = 'murtazacool558@okhdfcbank'
const DEFAULT_PAYEE = 'Al-Mawaid'
const DEFAULT_DUE = 1500
const UPI_TXN_LIMIT = 100000
const OPEN_DELAY_MS = 350 // let the clipboard write settle before leaving the page

const isValidVpa = (v) => /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test((v || '').trim())
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export default function UpiPayPage() {
  const [receiverVpa, setReceiverVpa] = useState('')
  const [payeeName, setPayeeName] = useState(DEFAULT_PAYEE)
  const [title, setTitle] = useState('Monthly Thali Contribution')
  const [paymentsEnabled, setPaymentsEnabled] = useState(true)

  const [profile, setProfile] = useState(null)
  const [balance, setBalance] = useState(null) // null = unknown

  const [amount, setAmount] = useState('')
  const [copied, setCopied] = useState(false)
  const [opened, setOpened] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const tapGapRef = useRef(0)

  const [themeId] = useState(() => localStorage.getItem('almawaid_theme') || 'dark')

  // ── Load settings + this member's outstanding due ──
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
          .in('key', ['upi_id', 'upi_payee_name', 'default_payment_due', 'payment_title', 'payment_enabled'])
        if (!alive) return
        if (cfgErr) setLoadError('Could not verify the receiver UPI ID. Showing the default.')
        const map = {}
        ;(rows || []).forEach(r => { map[r.key] = r.value })
        setReceiverVpa(String(map.upi_id || '').trim())
        if (map.upi_payee_name) setPayeeName(String(map.upi_payee_name).trim())
        if (map.payment_title) setTitle(String(map.payment_title).trim())
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

  // Generic UPI scheme — deliberately WITHOUT parameters. A bare `upi://pay`
  // opens the app chooser without triggering the prefilled-intent fraud check
  // that produces "Payment limit exceeded".
  const openGenericUpi = useCallback(async () => {
    const target = 'upi://pay'
    const native = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
    if (native) {
      try {
        const { AppLauncher } = await import('@capacitor/app-launcher')
        const { completed } = await AppLauncher.openUrl({ url: target })
        if (completed) return
      } catch { /* fall back to anchor */ }
    }
    try {
      const link = document.createElement('a')
      link.href = target
      link.rel = 'noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch {
      window.location.href = target
    }
  }, [])

  // THE flow: copy the locked receiver VPA, then open the UPI app chooser.
  const handleCopyAndOpen = async () => {
    if (!paymentsEnabled) {
      toast.error('Payments are currently paused. Please contact management.')
      return
    }
    if (!receiverIsConfigured) {
      toast.error('Receiver UPI ID is not configured correctly. Please contact management.')
      return
    }
    if (!amountValid) {
      toast.error(`Enter an amount between ₹1 and ₹${UPI_TXN_LIMIT.toLocaleString('en-IN')} first.`)
      return
    }
    if (Date.now() - tapGapRef.current < 1200) return
    tapGapRef.current = Date.now()

    let copiedOk = false
    try {
      await navigator.clipboard.writeText(receiver)
      copiedOk = true
    } catch {
      // Older Android WebViews have no async clipboard — use the legacy path
      // so the ID still lands on the clipboard before the app switch.
      try {
        const ta = document.createElement('textarea')
        ta.value = receiver
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        copiedOk = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch { copiedOk = false }
    }

    setCopied(copiedOk)
    setOpened(true)
    if (copiedOk) {
      toast.success(`UPI ID copied — paste it in your app and enter ₹${numericAmount.toFixed(2)}.`, { duration: 5000 })
    } else {
      toast('Could not auto-copy. Long-press the UPI ID above to copy it, then open your UPI app.', { duration: 5000, icon: '📋' })
    }

    // Give the clipboard call a beat to settle before the OS switches apps.
    setTimeout(() => { openGenericUpi() }, OPEN_DELAY_MS)
  }

  const handleCopyOnly = async () => {
    try {
      await navigator.clipboard.writeText(receiver)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      toast.success('UPI ID copied.')
    } catch {
      toast.error('Could not copy. Select the UPI ID below manually.')
    }
  }

  const paymentTitleText = () => (title || 'Thali Contribution')

  const t = THEMES[themeId] || THEMES.dark
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
  const mutedStyle = { margin: 0, fontSize: 12.5, color: t.textSub, opacity: 0.75, lineHeight: 1.6 }
  const stepStyle = {
    display: 'flex', gap: 10, alignItems: 'flex-start',
    padding: '11px 12px', borderRadius: 13,
    background: t.inputBg, border: `1px solid ${t.inputBorder || t.border}`,
  }
  const stepNum = {
    width: 22, height: 22, borderRadius: 999, flexShrink: 0,
    background: t.accentBg, color: t.accent, border: `1px solid ${t.accentBorder}`,
    fontSize: 11.5, fontWeight: 900,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                {paymentTitleText()} · zero fees
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

          {/* Contract */}
          <div style={{
            marginBottom: 16, padding: '12px 14px', borderRadius: 12,
            background: t.accentBg, border: `1px solid ${t.accentBorder}`,
            color: t.textBody, fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 9,
            lineHeight: 1.6,
          }}>
            <Info size={15} style={{ flexShrink: 0, marginTop: 2, color: t.accent }} />
            <span>
              This page copies the receiver ID and opens your UPI app. You paste it there and approve with
              your PIN — <strong>your bank does the transfer</strong>. Management confirms the money and marks
              your dues in Payments Hub.
            </span>
          </div>

          {/* Amount */}
          <Card style={{ marginBottom: 14 }}>
            <label htmlFor="upi-amount" style={labelStyle}>
              Amount to pay (INR)
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
            <p style={{ ...mutedStyle, marginTop: 8 }}>
              Enter this exact amount inside your UPI app after pasting the ID.
              {profile?.payment_exempt ? ' Your account is marked exempt — pay only if you wish to.' : ''}
            </p>
          </Card>

          {/* Receiver — locked */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <ShieldCheck size={17} color={t.successText || t.accent} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.textSub }}>
                Receiver — verified
              </span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: t.text, marginBottom: 2 }}>{loading ? '…' : payeeName}</div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              marginTop: 8, padding: '11px 13px', borderRadius: 12,
              background: t.accentBg, border: `1px solid ${t.accentBorder}`,
              color: t.accent, fontSize: 14, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif", textAlign: 'left', minHeight: 44,
            }}>
              <span style={{ flex: 1, wordBreak: 'break-all', userSelect: 'all' }}>{loading ? '…' : receiver}</span>
              {copied ? <Check size={15} /> : <Copy size={15} style={{ opacity: 0.6 }} />}
            </div>
            <p style={{ ...mutedStyle, marginTop: 8 }}>
              Locked by the organisation — impossible to pay the wrong account from this page.
            </p>
          </Card>

          {/* THE flow */}
          {!paymentsEnabled && (
            <div style={{
              marginBottom: 10, padding: '11px 13px', borderRadius: 12,
              background: 'rgba(220,180,60,0.12)', border: '1px solid rgba(220,180,60,0.45)',
              color: '#e8c268', fontSize: 12.5, lineHeight: 1.55,
            }}>
              Payments are paused by management right now — the button below is disabled.
            </div>
          )}
          <Btn
            onClick={handleCopyAndOpen}
            disabled={!paymentsEnabled || !receiverIsConfigured || loading || !amountValid}
            style={{ width: '100%', padding: '16px 20px', fontSize: 16 }}
          >
            <ExternalLink size={18} />
            {amountValid ? `Copy UPI ID & Open UPI App` : 'Enter amount to continue'}
          </Btn>

          <button
            type="button"
            onClick={handleCopyOnly}
            style={{
              width: '100%', marginTop: 8, padding: '12px 14px', borderRadius: 12,
              background: 'transparent', border: `1px solid ${t.border}`,
              color: t.textSub, fontSize: 13, fontWeight: 800, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {copied ? '✓ UPI ID copied' : 'Copy UPI ID only'}
          </button>

          {opened && (
            <div style={{
              marginTop: 12, padding: '12px 14px', borderRadius: 12,
              background: t.successBg, border: `1px solid ${t.successBorder}`,
              color: t.successText, fontSize: 12.5, lineHeight: 1.6,
            }}>
              Your UPI app is opening. Inside it: long-press the UPI ID field → <strong>Paste</strong> → enter
              ₹{numericAmount > 0 ? numericAmount.toFixed(2) : 'the amount'} → approve with your UPI PIN.
            </div>
          )}

          {/* Instructions */}
          <Card style={{ marginTop: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.textSub, marginBottom: 12 }}>
              How this payment works
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['1', 'Tap the button above — the UPI ID is copied to your clipboard and your UPI apps open.'],
                ['2', 'Pick any app (GPay, PhonePe, Paytm, BHIM, bank app).'],
                ['3', 'Long-press the UPI ID field → Paste → enter the amount.'],
                ['4', 'Approve with your UPI PIN. Money goes straight to the receiver — no fees.'],
              ].map(([n, text]) => (
                <div key={n} style={stepStyle}>
                  <div style={stepNum}>{n}</div>
                  <div style={{ fontSize: 12.5, color: t.textSub, lineHeight: 1.55 }}>{text}</div>
                </div>
              ))}
            </div>
            <p style={{ ...mutedStyle, marginTop: 12 }}>
              Typing the amount yourself makes this a normal bank-to-bank UPI transfer — so the bank's
              &ldquo;limit exceeded&rdquo; block on app-opened links doesn't apply. Your own daily limit
              (usually up to ₹1,00,000) is what counts.
            </p>
          </Card>

          <p style={{ margin: '14px 0 0', fontSize: 11.5, color: t.textSub, opacity: 0.6, textAlign: 'center', lineHeight: 1.6 }}>
            {paymentsEnabled
              ? 'No gateway, no commission — this app only shows you where to pay. The transfer happens entirely inside your bank.'
              : 'Payments are currently paused for this organisation. Please contact management.'}
          </p>

          <div style={{
            marginTop: 16, padding: '12px 14px', borderRadius: 12,
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
            fontSize: 12, color: t.textSub, lineHeight: 1.6,
          }}>
            <strong style={{ color: '#ef4444' }}>Payment refused?</strong>{' '}
            If even a small amount fails, your bank's daily UPI quota (counted across all your UPI apps) is
            exhausted — switch to a different bank account inside your UPI app, or retry after midnight.
            A mis-typed UPI ID is the only other cause: paste it, don't type it.
          </div>
        </main>
      </div>
    </ThemeCtx.Provider>
  )
}
