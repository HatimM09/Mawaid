// ═════════════════════════════════════════════════════════════════════════════
// AL-MAWAID — Pay page (`/pay`, `/upi-pay`)
//
// Native NPCI UPI Split & Collection Module
// 100% Free, 0% Commission, No Gateway Fees
// ═════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  ShieldCheck, Copy, Check, AlertTriangle, ChevronLeft, QrCode, Smartphone,
  Download, Clock, CheckCircle2
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../../lib/firebaseClient'
import { ThemeCtx } from '../../admin/context'
import { THEMES } from '../theme'
import { GeoBg, GlobalStyles, Card, Btn } from '../ui'

const DEFAULT_RECEIVER = '6375250267@okbizaxis'
const DEFAULT_PAYEE = 'Al-Mawaid'
const DEFAULT_DUE = 1500
const UPI_TXN_LIMIT = 100000

const isValidVpa = (v) => /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test((v || '').trim())
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const formatInr = (n) =>
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

// NPCI UPI URI Specification Generator
const generateUpiString = ({ upiId, payeeName, amount, note, mc }) => {
  const params = new URLSearchParams({
    pa: (upiId || '').trim(),
    pn: (payeeName || DEFAULT_PAYEE).trim(),
    cu: 'INR'
  })
  if (amount && Number(amount) > 0) {
    params.set('am', Number(amount).toFixed(2))
  }
  if (note) {
    params.set('tn', note.trim())
  }
  if (mc && String(mc).trim().length === 4) {
    params.set('mc', String(mc).trim())
  }
  return `upi://pay?${params.toString()}`
}

const isNativePlatform = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()

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
    window.location.href = uri
    return true
  }
}

export default function UpiPayPage() {
  const [receiverVpa, setReceiverVpa] = useState('')
  const [merchantCode, setMerchantCode] = useState('')
  const [payeeName, setPayeeName] = useState(DEFAULT_PAYEE)
  const [title, setTitle] = useState('Monthly Thali Contribution')
  const [paymentsEnabled, setPaymentsEnabled] = useState(true)

  const [sessionUser, setSessionUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [balance, setBalance] = useState(null)
  const [currentMonthPayment, setCurrentMonthPayment] = useState(null)

  const [amount, setAmount] = useState('')
  const [utrNumber, setUtrNumber] = useState('')
  const [submittingUtr, setSubmittingUtr] = useState(false)
  const [copied, setCopied] = useState(false)
  const [opening, setOpening] = useState(false)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const tapGapRef = useRef(0)
  const copiedTimerRef = useRef(null)
  const [themeId] = useState(() => localStorage.getItem('almawaid_theme') || 'dark')

  useEffect(() => () => clearTimeout(copiedTimerRef.current), [])

  // ── Load Settings & User Payment Status ──
  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        let userObj = null
        try {
          const { data } = await supabase.auth.getUser()
          userObj = data?.user || null
          if (alive) setSessionUser(userObj)
        } catch { /* offline / guest */ }

        const { data: rows, error: cfgErr } = await supabase
          .from('app_settings')
          .select('key,value')
          .in('key', ['upi_id', 'upi_mc', 'upi_payee_name', 'default_payment_due', 'payment_title', 'payment_enabled'])
        if (!alive) return
        if (cfgErr) setLoadError('Could not verify receiver UPI ID. Showing default.')

        const map = {}
        ;(rows || []).forEach(r => { map[r.key] = r.value })
        setReceiverVpa(String(map.upi_id || '').trim())
        if (map.upi_mc) setMerchantCode(String(map.upi_mc).trim())
        if (map.upi_payee_name) setPayeeName(String(map.upi_payee_name).trim())
        if (map.payment_title) setTitle(String(map.payment_title).trim())
        if (map.payment_enabled != null) setPaymentsEnabled(String(map.payment_enabled) !== 'false')

        const due = Number(map.default_payment_due)
        const safeDue = Number.isFinite(due) && due > 0 ? due : DEFAULT_DUE

        if (!userObj) {
          setAmount(String(safeDue))
        } else {
          const currentMonth = monthKeyOf(new Date())
          const [statsRes, payRes] = await Promise.all([
            supabase.from('user_stats')
              .select('user_id, name, thali_number, email, payment_exempt')
              .eq('user_id', userObj.id)
              .maybeSingle(),
            supabase.from('user_payments')
              .select('*')
              .eq('user_id', userObj.id)
              .order('created_at', { ascending: false }),
          ])
          if (!alive) return
          setProfile(statsRes.data || null)

          const monthPays = (payRes.data || []).filter(p => p.created_at && monthKeyOf(new Date(p.created_at)) === currentMonth)
          const latestMonthPay = monthPays[0] || null
          setCurrentMonthPayment(latestMonthPay)

          const paid = monthPays.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
          const owed = Math.max(0, Number((safeDue - paid).toFixed(2)))
          setBalance(owed)
          setAmount(statsRes.data?.payment_exempt || owed <= 0 ? '' : String(owed))
        }
      } catch {
        if (alive) setLoadError('Could not load payment settings.')
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
  const amountValid = Number.isFinite(numericAmount) && numericAmount >= 1 && numericAmount <= UPI_TXN_LIMIT
  const canCopy = paymentsEnabled && receiverIsConfigured && !loading

  // Full UPI Deep-Link
  const upiUri = useMemo(() => {
    return generateUpiString({
      upiId: receiver,
      payeeName,
      amount: amountValid ? numericAmount : undefined,
      note: `${title} - ${profile?.name || 'Member'} ${profile?.thali_number ? `(#${profile.thali_number})` : ''}`,
      mc: merchantCode
    })
  }, [receiver, payeeName, amountValid, numericAmount, title, profile, merchantCode])

  const flashCopied = useCallback(() => {
    setCopied(true)
    clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2500)
  }, [])

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

  const handleCopy = async () => {
    if (!paymentsEnabled) {
      toast.error('Payments are currently paused. Please contact management.')
      return
    }
    if (!receiverIsConfigured) {
      toast.error('Receiver UPI ID is not configured.')
      return
    }
    if (Date.now() - tapGapRef.current < 1200) return
    tapGapRef.current = Date.now()

    const ok = await copyReceiver()
    setNotice('copy')
    if (ok) {
      flashCopied()
      toast.success('UPI ID copied. Open your UPI app and paste it.', { duration: 4000 })
    }
  }

  const handleOpenUpi = async () => {
    if (!paymentsEnabled) {
      toast.error('Payments are currently paused.')
      return
    }
    if (!receiverIsConfigured) {
      toast.error('Receiver UPI ID is not configured.')
      return
    }
    if (loading || opening) return

    setOpening(true)
    const opened = await launchUpiApp(upiUri)
    setOpening(false)

    if (!opened) {
      setNotice('copy')
      toast.error('Could not open UPI app. Copy UPI ID or scan the QR code.', { duration: 5000 })
      return
    }
    setNotice('open')
    toast.success(`Opening your UPI app...`, { duration: 4000 })
  }

  // ── Save QR Image to Gallery / Downloads ──
  const handleSaveQrImage = () => {
    const canvas = document.getElementById('upi-pay-qr-canvas')
    if (!canvas) {
      toast.error('QR Code not ready.')
      return
    }
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `AlMawaid-UPI-QR.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast.success('QR saved to Gallery / Downloads! Open GPay/PhonePe and choose Upload from Gallery.')
    } catch {
      toast.error('Could not save QR image.')
    }
  }

  // ── Submit UTR Verification ──
  const handleSubmitUtr = async (e) => {
    e.preventDefault()
    if (!sessionUser) {
      toast.error('Please log in to submit UTR confirmation.')
      return
    }
    const cleanUtr = utrNumber.trim()
    if (!cleanUtr || cleanUtr.length < 4) {
      toast.error('Please enter the 12-digit UPI Ref / UTR number.')
      return
    }

    setSubmittingUtr(true)
    try {
      const payload = {
        user_id: sessionUser.id,
        user_name: profile?.name || sessionUser.email?.split('@')[0] || 'Member',
        user_email: profile?.email || sessionUser.email || '',
        thali_number: profile?.thali_number ? String(profile.thali_number) : '',
        amount: numericAmount || DEFAULT_DUE,
        currency: 'INR',
        status: 'submitted',
        transaction_ref: cleanUtr,
        upi_id: receiver,
        payee_name: payeeName,
        payment_method: 'UPI Pay',
        note: `${title} - Pay Page Submission`,
        created_at: new Date().toISOString()
      }

      const { data, error } = await supabase.from('user_payments').insert([payload]).select().single()
      if (error) throw error

      setCurrentMonthPayment(data)
      setUtrNumber('')
      toast.success('UTR submitted! Your payment is marked Under Review.')
    } catch (err) {
      console.error('Submit UTR error:', err)
      toast.error('Could not submit UTR. Please retry.')
    } finally {
      setSubmittingUtr(false)
    }
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
          {/* Header */}
          <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <button
              onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = '/'))}
              aria-label="Go back"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: t.accent, flexShrink: 0 }}
            >
              <ChevronLeft size={20} />
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{
                margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '0.02em',
                color: t.accent, fontFamily: "'Playfair Display',serif",
              }}>
                Pay via UPI
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: t.textSub, opacity: 0.72 }}>
                {title} · 100% Free · 0% Commission
              </p>
            </div>
            <img
              src="/al-mawaid.png"
              alt=""
              style={{ width: 38, height: 38, objectFit: 'contain', opacity: 0.95 }}
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

          {/* Current Month Status Banner if applicable */}
          {currentMonthPayment?.status === 'verified' && (
            <div style={{
              marginBottom: 14, padding: '12px 14px', borderRadius: 12,
              background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)',
              color: '#34d399', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8
            }}>
              <CheckCircle2 size={18} />
              <span>Your contribution is settled for this month! ✅</span>
            </div>
          )}

          {currentMonthPayment?.status === 'submitted' && (
            <div style={{
              marginBottom: 14, padding: '12px 14px', borderRadius: 12,
              background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)',
              color: '#fbbf24', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8
            }}>
              <Clock size={18} />
              <span>UTR {currentMonthPayment.transaction_ref} submitted · Under Review 🕒</span>
            </div>
          )}

          {/* ── Main Payment Card ── */}
          <Card style={{ padding: '20px 18px', marginBottom: 14 }}>
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
                  color: t.text, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>

            {/* Dynamic QR Code Canvas */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: '#ffffff', padding: 14, borderRadius: 14, marginTop: 16
            }}>
              <QRCodeCanvas
                id="upi-pay-qr-canvas"
                value={upiUri}
                size={180}
                level="M"
              />
              <span style={{ fontSize: 11, color: '#475569', fontWeight: 700, marginTop: 6 }}>
                Scan with GPay, PhonePe, Paytm, BHIM
              </span>
            </div>

            {/* Save QR Image Button */}
            <button
              type="button"
              onClick={handleSaveQrImage}
              style={{
                width: '100%', marginTop: 10, padding: '10px 14px', borderRadius: 12,
                border: `1px solid ${t.border}`, background: 'rgba(255,255,255,0.04)',
                color: t.text, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              <Download size={14} color={t.accent} />
              <span>Save QR to Gallery</span>
            </button>

            {/* Direct 1-Tap Pay Button */}
            <Btn
              onClick={handleOpenUpi}
              disabled={!canCopy || opening}
              style={{ width: '100%', marginTop: 12, padding: '14px 20px', fontSize: 15 }}
            >
              <Smartphone size={17} />
              {opening ? 'Opening UPI app…' : `Pay ₹${formatInr(numericAmount || DEFAULT_DUE)} via UPI App`}
            </Btn>

            {/* Copy UPI ID Button */}
            <button
              type="button"
              onClick={handleCopy}
              disabled={!canCopy}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                marginTop: 10, padding: '11px 12px', borderRadius: 12,
                background: t.accentBg, border: `1px solid ${t.accentBorder}`,
                color: t.text, cursor: canCopy ? 'pointer' : 'not-allowed',
                textAlign: 'left', fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <ShieldCheck size={16} color={t.accent} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                <strong style={{ color: t.text }}>{payeeName}:</strong>{' '}
                <span style={{ color: t.accent, wordBreak: 'break-all' }}>{receiver}</span>
              </span>
              {copied ? <Check size={15} color={t.accent} /> : <Copy size={15} color={t.accent} />}
            </button>
          </Card>

          {/* Verification Section */}
          <Card style={{ padding: '16px 18px', marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: t.textSub, marginBottom: 8 }}>
              After paying, enter the 12-digit UPI Ref / UTR No:
            </label>
            <form onSubmit={handleSubmitUtr} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                maxLength={16}
                placeholder="e.g. 429810394812"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 10,
                  border: `1px solid ${t.border}`, background: t.inputBg,
                  color: t.text, fontSize: 13, fontFamily: 'monospace', outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={submittingUtr || !utrNumber.trim()}
                style={{
                  padding: '10px 16px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
                  fontSize: 12.5, fontWeight: 800, cursor: 'pointer'
                }}
              >
                {submittingUtr ? 'Marking…' : 'Mark Paid'}
              </button>
            </form>
          </Card>

          <p style={{ margin: '12px 2px 0', ...mutedStyle, textAlign: 'center' }}>
            Direct bank-to-bank UPI payment. 0% platform fee, 100% free.
          </p>
        </main>
      </div>
    </ThemeCtx.Provider>
  )
}
