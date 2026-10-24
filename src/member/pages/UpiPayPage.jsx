// ═════════════════════════════════════════════════════════════════════════════
// AL-MAWAID — Pay page (`/pay`, `/upi-pay`)
//
// NO GATEWAY, NO FEES, NO AUTO-DEBIT, NO PIN.
//
// Two ways to reach the locked receiver, both read-only:
//   1. Tap the QR or "Open UPI app" → the shell fires ACTION_VIEW with the exact
//      payload the QR encodes (receiver ID only, no amount). The member types
//      the amount inside GPay / PhonePe / Paytm / their bank app and approves it
//      there. Native goes through Capacitor AppLauncher; the web/PWA uses a
//      plain `upi://pay` anchor.
//   2. Copy the receiver UPI ID and paste it inside their own app.
//
// WHY THE INTENT CARRIES NO AMOUNT:
//   The QR already works for real transfers, so the hand-off sends the same
//   payload a scan sends — the amount is typed inside the UPI app. Google Pay
//   can still answer an app-originated `upi://pay` intent with "Payment limit
//   exceeded" (its own app-intent check), so Copy UPI ID and the QR stay on the
//   page as the fallback when that happens.
//
// WHAT THIS PAGE NEVER DOES:
//   • It never asks for a UPI PIN, never enters one, never sees it.
//   • It never initiates a debit, mandate, collect request or auto-debit.
//   • It writes NOTHING to the database — no self-reported receipts exist.
//     Management confirms the money in the bank and marks dues Paid/Pending
//     from Payments Hub (that flow is untouched).
//   • It holds no money — so there is no custody, no license, and no fee.
// ═════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  ShieldCheck, Copy, Check, AlertTriangle, ChevronLeft, QrCode, Smartphone,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../../lib/firebaseClient'
import { ThemeCtx } from '../../admin/context'
import { THEMES } from '../theme'
import { GeoBg, GlobalStyles, Card, Btn } from '../ui'

const DEFAULT_RECEIVER = '6375250267@okbizaxis'
const DEFAULT_PAYEE = 'Fleeksocks'
const DEFAULT_DUE = 1500
const UPI_TXN_LIMIT = 100000

const isValidVpa = (v) => /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test((v || '').trim())
// ONE payload for both the QR and the app hand-off: receiver only. No amount,
// no transaction reference — the payer types the amount inside their UPI app,
// exactly as they would after scanning, so nothing is pushed at the bank.
const buildUpiUri = (vpa, name) =>
  `upi://pay?pa=${vpa}&pn=${encodeURIComponent(name || DEFAULT_PAYEE)}&cu=INR`

const isNativePlatform = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()

// Native shell: AppLauncher fires ACTION_VIEW, which surfaces the UPI app
// chooser (GPay / PhonePe / Paytm / bank app). Web/PWA: an anchor with the same
// URI, which the OS still resolves. Returns false when nothing accepted it.
async function launchUpiApp(uri) {
  if (isNativePlatform()) {
    try {
      const { AppLauncher } = await import('@capacitor/app-launcher')
      const { completed } = await AppLauncher.openUrl({ url: uri })
      if (completed) return true
    } catch (err) {
      console.warn('[UpiPay] Native UPI launch failed, trying the web handler', err)
    }
  }
  try {
    const a = document.createElement('a')
    a.href = uri
    a.rel = 'noopener noreferrer'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return true
  } catch {
    return false
  }
}
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const formatInr = (n) =>
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export default function UpiPayPage() {
  const [receiverVpa, setReceiverVpa] = useState('')
  const [payeeName, setPayeeName] = useState(DEFAULT_PAYEE)
  const [title, setTitle] = useState('Monthly Thali Contribution')
  const [paymentsEnabled, setPaymentsEnabled] = useState(true)

  const [profile, setProfile] = useState(null)
  const [balance, setBalance] = useState(null) // null = unknown

  const [amount, setAmount] = useState('')
  const [copied, setCopied] = useState(false)
  const [opening, setOpening] = useState(false)
  const [notice, setNotice] = useState('') // '' | 'copy' | 'open'
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const tapGapRef = useRef(0)
  const copiedTimerRef = useRef(null)

  const [themeId] = useState(() => localStorage.getItem('almawaid_theme') || 'dark')

  useEffect(() => () => clearTimeout(copiedTimerRef.current), [])

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
  const canCopy = paymentsEnabled && receiverIsConfigured && !loading

  const flashCopied = useCallback(() => {
    setCopied(true)
    clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2500)
  }, [])

  // Async clipboard first, with the legacy textarea path for older Android
  // WebViews that have no `navigator.clipboard`.
  const copyReceiver = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(receiver)
      return true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = receiver
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        return ok
      } catch { return false }
    }
  }, [receiver])

  // Copies the locked VPA and shows the manual steps — the fallback when a PSP
  // refuses an app-originated intent (see the header note).
  const handleCopy = async () => {
    if (!paymentsEnabled) {
      toast.error('Payments are currently paused. Please contact management.')
      return
    }
    if (!receiverIsConfigured) {
      toast.error('Receiver UPI ID is not configured correctly. Please contact management.')
      return
    }
    if (Date.now() - tapGapRef.current < 1200) return
    tapGapRef.current = Date.now()

    const ok = await copyReceiver()
    setNotice('copy')
    if (ok) {
      flashCopied()
      toast.success('UPI ID copied. Open your UPI app and paste it.', { duration: 4500 })
    } else {
      toast('Could not auto-copy. Long-press the UPI ID above, then paste it in your UPI app.', {
        duration: 5000, icon: '📋',
      })
    }
  }

  // Hand-off to the installed UPI app (QR payload: receiver only). If no app
  // accepts the intent, fall back to the copy flow instead of a dead tap.
  const handleOpenUpi = async () => {
    if (!paymentsEnabled) {
      toast.error('Payments are currently paused. Please contact management.')
      return
    }
    if (!receiverIsConfigured) {
      toast.error('Receiver UPI ID is not configured correctly. Please contact management.')
      return
    }
    if (loading || opening) return

    setOpening(true)
    const opened = await launchUpiApp(buildUpiUri(receiver, payeeName))
    setOpening(false)

    if (!opened) {
      setNotice('copy')
      toast.error('No UPI app accepted the request. Copy the UPI ID and paste it in your app.', {
        duration: 5500,
      })
      return
    }
    setNotice('open')
    toast.success(`Opening your UPI app — enter ${amountLabel} there.`, { duration: 5000 })
  }

  const t = THEMES[themeId] || THEMES.dark
  const labelStyle = {
    display: 'block', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: t.textSub, opacity: 0.8,
    fontFamily: "'DM Sans', sans-serif",
  }
  const mutedStyle = { margin: 0, fontSize: 12.5, color: t.textSub, opacity: 0.72, lineHeight: 1.6 }
  const amountLabel = amountValid ? `₹${formatInr(numericAmount)}` : 'the amount'

  return (
    <ThemeCtx.Provider value={t}>
      <div style={{
        minHeight: '100dvh', background: t.bgGrad, color: t.text,
        fontFamily: "'DM Sans','Segoe UI',-apple-system,sans-serif",
        position: 'relative', overflowX: 'hidden',
      }}>
        <GeoBg t={t} />
        <GlobalStyles />

        <main style={{
          position: 'relative', zIndex: 1, maxWidth: 440, margin: '0 auto',
          padding: 'calc(env(safe-area-inset-top, 12px) + 20px) clamp(16px, 4vw, 22px) 48px',
        }}>
          {/* ── Header ── */}
          <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <button
              onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = '/'))}
              aria-label="Go back"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: t.accent, flexShrink: 0 }}
            >
              <ChevronLeft size={20} />
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{
                margin: 0, fontSize: 25, fontWeight: 700, letterSpacing: '0.02em',
                color: t.accent, fontFamily: "'Playfair Display',serif",
              }}>
                Pay via UPI
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: t.textSub, opacity: 0.72 }}>
                {title || 'Thali Contribution'} · no fees, no auto-debit
              </p>
            </div>
            <img
              src="/al-mawaid.png"
              alt=""
              style={{ width: 38, height: 38, objectFit: 'contain', opacity: 0.95, filter: 'drop-shadow(0 2px 8px rgba(196,156,90,0.4))' }}
            />
          </header>

          {loadError && (
            <div style={{
              marginBottom: 14, padding: '11px 13px', borderRadius: 12,
              background: 'rgba(220,60,60,0.09)', border: '1px solid rgba(220,60,60,0.28)',
              color: '#e05555', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />{loadError}
            </div>
          )}

          {!paymentsEnabled && (
            <div style={{
              marginBottom: 14, padding: '11px 13px', borderRadius: 12,
              background: 'rgba(220,180,60,0.12)', border: '1px solid rgba(220,180,60,0.45)',
              color: '#e8c268', fontSize: 12.5, lineHeight: 1.55,
            }}>
              Payments are paused by management — you can look, but not pay right now.
            </div>
          )}

          {/* ── Single action card ── */}
          <Card style={{ padding: '20px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <label htmlFor="upi-amount" style={labelStyle}>Amount</label>
              {balance !== null && balance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(balance))}
                  style={{
                    background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer',
                    color: t.accent, fontSize: 12, fontWeight: 800, fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  ₹{formatInr(balance)} due
                </button>
              )}
              {balance !== null && balance <= 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: t.successText || '#34d399' }}>
                  Settled this month
                </span>
              )}
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              marginTop: 6, paddingBottom: 8,
              borderBottom: `1px solid ${amountValid || amount === '' ? t.inputBorder : '#e05555'}`,
            }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: t.accent, lineHeight: 1 }}>₹</span>
              <input
                id="upi-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="1"
                max={UPI_TXN_LIMIT}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  flex: 1, width: '100%', minWidth: 0, padding: 0,
                  background: 'transparent', border: 'none', outline: 'none',
                  color: t.text, fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>

            {amount.trim() !== '' && !amountValid && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#e05555' }}>
                Enter between ₹1 and ₹{UPI_TXN_LIMIT.toLocaleString('en-IN')}.
              </p>
            )}
            {amountValid && (
              <p style={{ ...mutedStyle, marginTop: 8 }}>
                Type this same amount inside your UPI app.
                {profile?.payment_exempt ? ' Your account is marked exempt — pay only if you wish to.' : ''}
              </p>
            )}

            {/* Receiver — tap to copy */}
            <button
              type="button"
              onClick={handleCopy}
              disabled={!canCopy}
              aria-label={`Copy receiver UPI ID ${receiver}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                marginTop: 16, padding: '11px 12px', borderRadius: 12,
                background: t.accentBg, border: `1px solid ${t.accentBorder}`,
                color: t.text, cursor: canCopy ? 'pointer' : 'not-allowed',
                textAlign: 'left', fontFamily: "'DM Sans', sans-serif",
                opacity: canCopy ? 1 : 0.6,
              }}
            >
              <ShieldCheck size={17} color={t.accent} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: t.text }}>
                  {loading ? 'Loading…' : payeeName}
                </span>
                <span style={{
                  display: 'block', marginTop: 2, fontSize: 12, color: t.accent,
                  fontWeight: 600, wordBreak: 'break-all',
                }}>
                  {loading ? '…' : receiver}
                </span>
              </span>
              {copied ? <Check size={16} color={t.accent} /> : <Copy size={16} color={t.accent} style={{ opacity: 0.7 }} />}
            </button>

            <Btn
              onClick={handleOpenUpi}
              disabled={!canCopy || opening}
              style={{ width: '100%', marginTop: 16, padding: '15px 20px', fontSize: 15 }}
            >
              <Smartphone size={17} />
              {loading ? 'Loading…' : opening ? 'Opening UPI app…' : 'Open UPI app to pay'}
            </Btn>
            <Btn
              variant="outline"
              onClick={handleCopy}
              disabled={!canCopy}
              style={{ width: '100%', marginTop: 10, padding: '13px 20px', fontSize: 14 }}
            >
              <Copy size={16} />
              {loading ? 'Loading…' : copied ? 'UPI ID copied' : 'Copy UPI ID'}
            </Btn>
          </Card>

          {notice === 'copy' && (
            <div style={{
              marginTop: 12, padding: '11px 13px', borderRadius: 12,
              background: t.successBg, border: `1px solid ${t.successBorder}`,
              color: t.successText, fontSize: 12.5, lineHeight: 1.65,
            }}>
              {copied ? 'Copied.' : 'If it did not copy, long-press the UPI ID above.'} Now open
              GPay / PhonePe / Paytm yourself → <strong>Pay</strong> → <strong>To UPI ID</strong> →
              paste → enter {amountLabel} → approve with your PIN.
            </div>
          )}

          {notice === 'open' && (
            <div style={{
              marginTop: 12, padding: '11px 13px', borderRadius: 12,
              background: t.successBg, border: `1px solid ${t.successBorder}`,
              color: t.successText, fontSize: 12.5, lineHeight: 1.65,
            }}>
              Choose your UPI app and enter {amountLabel} there — the receiver ID is already filled
              in. Nothing opened? Tap the QR below, or use <strong>Copy UPI ID</strong>.
            </div>
          )}

          <p style={{ margin: '14px 2px 0', ...mutedStyle }}>
            This page never charges or debits anything. No gateway, no commission, no auto-debit —
            the full amount reaches the receiver.
          </p>

          {/* ── QR: tap to open the UPI app, or scan it from a second phone ── */}
          <details open style={{ marginTop: 12 }}>
            <summary style={{
              cursor: 'pointer', fontSize: 12.5, fontWeight: 800,
              color: t.textSub, opacity: 0.8, padding: '8px 2px',
              fontFamily: "'DM Sans', sans-serif",
              listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <QrCode size={15} /> Tap the QR to open your UPI app
            </summary>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleOpenUpi}
                disabled={!canCopy || opening}
                aria-label="Open your UPI app to pay"
                style={{
                  padding: 0, border: 'none', background: 'transparent', lineHeight: 0,
                  borderRadius: 14, cursor: canCopy ? 'pointer' : 'not-allowed',
                  opacity: canCopy ? 1 : 0.6,
                  boxShadow: `0 0 0 1px ${t.accentBorder}, 0 12px 30px rgba(0,0,0,0.35)`,
                }}
              >
                <div style={{ background: '#ffffff', padding: 12, borderRadius: 14, lineHeight: 0 }}>
                  <QRCodeCanvas value={buildUpiUri(receiver, payeeName)} size={168} level="M" />
                </div>
              </button>
            </div>
            <p style={{ ...mutedStyle, marginTop: 8 }}>
              Tap it on this phone, or scan it with another phone. The QR carries only the receiver
              ID — type the amount inside your UPI app.
            </p>
          </details>

          {/* ── Details, folded away ── */}
          <details style={{ marginTop: 10 }}>
            <summary style={{
              cursor: 'pointer', fontSize: 12.5, fontWeight: 800,
              color: t.textSub, opacity: 0.8, padding: '8px 2px',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              How it works &amp; if a payment fails
            </summary>
            <ol style={{
              margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5,
              color: t.textSub, lineHeight: 1.7,
            }}>
              <li>Tap Open UPI app (or tap / scan the QR) and choose GPay / PhonePe / Paytm.</li>
              <li>Or tap Copy UPI ID, then Pay → To UPI ID → Paste inside your app.</li>
              <li>Type the amount, approve with your UPI PIN.</li>
            </ol>
            <p style={{ margin: '10px 0 0', ...mutedStyle }}>
              The intent carries the receiver ID only, exactly like a QR scan — the amount is typed
              in your app. Google Pay sometimes refuses app-opened intents with &ldquo;Payment limit
              exceeded&rdquo;; use Copy UPI ID or the QR in that case, and your own daily UPI limit
              (usually up to ₹1,00,000) is what applies.
            </p>
            <p style={{ margin: '10px 0 0', ...mutedStyle }}>
              <strong style={{ color: '#ef4444' }}>Refused?</strong> If a bank error still appears
              inside your UPI app, it is a bank-side limit: your daily UPI quota is used up across all
              apps, or the receiver&apos;s bank has reached its inbound cap. Switch the bank account
              inside the UPI app, lower the amount, or retry after midnight. A mistyped ID is the only
              other cause: paste it, don&apos;t type it.
            </p>
            <p style={{ margin: '10px 0 0', ...mutedStyle }}>
              Management confirms the money in the bank and marks your dues in Payments Hub. Nothing is
              recorded from this page.
            </p>
          </details>
        </main>
      </div>
    </ThemeCtx.Provider>
  )
}
