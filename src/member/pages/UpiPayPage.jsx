// ═════════════════════════════════════════════════════════════════════════════
// AL-MAWAID — Pay page (`/pay`, `/upi-pay`)
//
// ONE ACTION: "Copy UPI ID & Open UPI App" — the zero-fee, zero-merchant path.
// The locked receiver VPA goes to the clipboard, then the bare `upi://pay`
// scheme opens the UPI app chooser with NO parameters at all. The member
// pastes the ID inside their own app and types the amount there, so the bank
// sees a fully user-initiated P2P transfer. This is the only flow that avoids
// the "Payment limit exceeded" / "bank limit exceeded" rejection that PSPs
// apply to app-opened intents carrying payment parameters.
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
  ShieldCheck, Copy, Check, AlertTriangle, ChevronLeft,
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
  const [opened, setOpened] = useState(false)
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
  const canPay = paymentsEnabled && receiverIsConfigured && !loading && amountValid

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

  // Opens the UPI app chooser. A bare `upi://pay` carries no parameters, so no
  // prefilled-intent fraud check runs.
  const openUpi = useCallback(async (target = 'upi://pay') => {
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

  const guard = () => {
    if (!paymentsEnabled) {
      toast.error('Payments are currently paused. Please contact management.')
      return false
    }
    if (!receiverIsConfigured) {
      toast.error('Receiver UPI ID is not configured correctly. Please contact management.')
      return false
    }
    if (!amountValid) {
      toast.error(`Enter an amount between ₹1 and ₹${UPI_TXN_LIMIT.toLocaleString('en-IN')} first.`)
      return false
    }
    if (Date.now() - tapGapRef.current < 1200) return false
    tapGapRef.current = Date.now()
    return true
  }

  // THE flow: copy the locked receiver VPA, then open the bare app chooser.
  const handleCopyAndOpen = async () => {
    if (!guard()) return
    const copiedOk = await copyReceiver()
    if (copiedOk) flashCopied()
    setOpened(true)
    if (copiedOk) {
      toast.success(`UPI ID copied — paste it in your app and enter ₹${formatInr(numericAmount)}.`, { duration: 5000 })
    } else {
      toast('Could not auto-copy. Long-press the UPI ID above to copy it, then open your UPI app.', { duration: 5000, icon: '📋' })
    }
    setTimeout(() => { openUpi() }, OPEN_DELAY_MS)
  }

  const handleCopyOnly = async () => {
    const ok = await copyReceiver()
    if (ok) {
      flashCopied()
      toast.success('UPI ID copied.')
    } else {
      toast.error('Could not copy. Select the UPI ID manually.')
    }
  }

  const t = THEMES[themeId] || THEMES.dark
  const labelStyle = {
    display: 'block', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: t.textSub, opacity: 0.8,
    fontFamily: "'DM Sans', sans-serif",
  }
  const mutedStyle = { margin: 0, fontSize: 12.5, color: t.textSub, opacity: 0.72, lineHeight: 1.6 }
  const statusText = (
    <>App opening — long-press the UPI ID field → <strong>Paste</strong> → enter ₹{formatInr(numericAmount)} → approve with your PIN.</>
  )

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
                {title || 'Thali Contribution'} · zero fees
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
              onClick={handleCopyOnly}
              disabled={loading}
              aria-label={`Copy receiver UPI ID ${receiver}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                marginTop: 16, padding: '11px 12px', borderRadius: 12,
                background: t.accentBg, border: `1px solid ${t.accentBorder}`,
                color: t.text, cursor: 'pointer', textAlign: 'left',
                fontFamily: "'DM Sans', sans-serif",
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
              onClick={handleCopyAndOpen}
              disabled={!canPay}
              style={{ width: '100%', marginTop: 16, padding: '15px 20px', fontSize: 15 }}
            >
              <Copy size={17} />
              {loading ? 'Loading…' : amountValid ? 'Copy UPI ID & Open UPI App' : 'Enter an amount'}
            </Btn>
          </Card>

          {opened && (
            <div style={{
              marginTop: 12, padding: '11px 13px', borderRadius: 12,
              background: t.successBg, border: `1px solid ${t.successBorder}`,
              color: t.successText, fontSize: 12.5, lineHeight: 1.6,
            }}>
              {statusText}
            </div>
          )}

          <p style={{ margin: '14px 2px 0', ...mutedStyle }}>
            Your bank moves the money — this page never sees your PIN and never holds funds.
          </p>

          {/* ── Details, folded away ── */}
          <details style={{ marginTop: 14 }}>
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
              <li>Tap Copy UPI ID &amp; Open UPI App — the ID is copied and the app chooser opens.</li>
              <li>Pick any app, long-press the UPI ID field → Paste.</li>
              <li>Type the amount, approve with your UPI PIN.</li>
            </ol>
            <p style={{ margin: '10px 0 0', ...mutedStyle }}>
              The app is opened with no payment parameters and you type everything inside it, so the
              bank treats this as a normal bank-to-bank transfer — your own daily limit (usually up to
              ₹1,00,000) applies, not an app-imposed cap.
            </p>
            <p style={{ margin: '10px 0 0', ...mutedStyle }}>
              <strong style={{ color: '#ef4444' }}>Refused?</strong> Your bank&apos;s daily UPI quota is
              likely used up across all apps — switch the bank account inside your UPI app, or retry after
              midnight. A mistyped ID is the only other cause: paste it, don&apos;t type it.
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
