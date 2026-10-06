import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  CreditCard, ArrowUpRight, CheckCircle2, Copy, Check, QrCode,
  Receipt, ShieldCheck, Clock, RefreshCw, AlertCircle, Sparkles,
  ChevronRight, X, Download, FileText, ArrowLeft, Info, Send,
  Users, Search, Filter, MessageSquare, Phone, CheckSquare, Edit3,
  SlidersHorizontal, BellRing, Eye, EyeOff, UserX, UserCheck, ToggleLeft, ToggleRight
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/firebaseClient'
import { useAuth, useTheme } from '../../admin/context'
import { BackHeader, Card, Btn, EmptyState } from '../ui'
import { downloadPayslipPdf } from '../../lib/payslipPdf'

export default function PaymentsPage({ onBack, appSettings = {} }) {
  const t = useTheme()
  const { user } = useAuth()

  // Settings & Configuration
  const [configuredUpiId, setConfiguredUpiId] = useState(appSettings.upi_id || 'murtazacool558@okhdfcbank')
  const [fallbackUpiId, setFallbackUpiId] = useState(appSettings.upi_id_2 || '')
  const [payeeName, setPayeeName] = useState(appSettings.upi_payee_name || 'Al-Mawaid')
  const [defaultDue, setDefaultDue] = useState(Number(appSettings.default_payment_due || 1500))
  const [paymentTitle, setPaymentTitle] = useState(appSettings.payment_title || 'Monthly Thali Contribution')
  const [isPaymentActive, setIsPaymentActive] = useState(appSettings.payment_enabled !== 'false')

  // User & Role State
  const [userProfile, setUserProfile] = useState(null)
  const [isManager, setIsManager] = useState(false)
  const [portalMode, setPortalMode] = useState('payer') // 'payer' | 'manager'
  
  // Data State
  const [myPayments, setMyPayments] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [allPayments, setAllPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Payment Form State (Payer)
  const [amount, setAmount] = useState(defaultDue.toString())
  const [customNote, setCustomNote] = useState('')
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [paymentMethodTab, setPaymentMethodTab] = useState('instant') // 'instant' | 'qr'
  const [showQRModal, setShowQRModal] = useState(false)
  // Manager-only manual record (members never type UTR — slips auto-generate)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  // Auto pay-slip state (member): receipt generated the moment they return
  // from their UPI app — no manual entry needed.
  const [lastSlip, setLastSlip] = useState(null)
  const [showSlipModal, setShowSlipModal] = useState(false)
  const [finalizingPay, setFinalizingPay] = useState(false)
  const finalizingRef = useRef(false)
  // Unfinished-attempt recovery banner (debited-but-no-receipt safety net)
  const [showPendingBanner, setShowPendingBanner] = useState(false)
  const [showRefundPolicy, setShowRefundPolicy] = useState(false)
  // Pre-pay confirmation sheet: member verifies the EXACT receiver + amount
  // before anything fires. Never launches blind.
  const [confirmPay, setConfirmPay] = useState(null) // {appType, partIdx, total, partAmount, partsCount, receiver, payee, note}
  const [failHelp, setFailHelp] = useState(false)
  // The exact plan that was fired (drives the desktop QR so it can never
  // disagree with the launched intent).
  const [firedPlan, setFiredPlan] = useState(null)
  const failPending = useMemo(() => (failHelp ? readPendingPay() : null), [failHelp, readPendingPay])

  // Record Form state
  const [utrNumber, setUtrNumber] = useState('')
  const [recordAmount, setRecordAmount] = useState('')
  const [recordNote, setRecordNote] = useState('')
  const [submittingRecord, setSubmittingRecord] = useState(false)

  // Dynamic synchronization when appSettings change from realtime or parent
  useEffect(() => {
    if (appSettings.upi_id) setConfiguredUpiId(appSettings.upi_id)
    if (appSettings.upi_id_2 !== undefined) setFallbackUpiId(appSettings.upi_id_2 || '')
    if (appSettings.upi_payee_name) setPayeeName(appSettings.upi_payee_name)
    if (appSettings.default_payment_due) {
      const newDue = Number(appSettings.default_payment_due)
      setDefaultDue(newDue)
      setAmount(newDue.toString())
    }
    if (appSettings.payment_title) setPaymentTitle(appSettings.payment_title)
    if (appSettings.payment_enabled !== undefined) setIsPaymentActive(appSettings.payment_enabled !== 'false')
  }, [appSettings])

  // Manager State
  const [managerSearch, setManagerSearch] = useState('')
  const [managerFilter, setManagerFilter] = useState('all') // 'all' | 'unpaid' | 'paid' | 'forfeit' | 'submitted'
  const [hideForfeited, setHideForfeited] = useState(false)
  const [selectedUserToPay, setSelectedUserToPay] = useState(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [bulkNotifying, setBulkNotifying] = useState(false)

  // Fully Controllable Notification Modal State
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [notifyTargetUser, setNotifyTargetUser] = useState(null) // null = all unpaid, or single user object
  const [notifyTitle, setNotifyTitle] = useState('Thali Contribution Reminder')
  const [notifyBody, setNotifyBody] = useState('')
  const [notifyTemplate, setNotifyTemplate] = useState('standard') // 'standard' | 'urgent' | 'final' | 'custom'

  // Check if current user is Mulla Murtaza Mohammadhussain Hamid or Admin
  const checkManagerStatus = useCallback((profile) => {
    if (!profile) return false
    const name = (profile.name || '').toLowerCase()
    const email = (profile.email || '').toLowerCase()
    const role = (profile.role || '').toLowerCase()

    const isMurtaza = name.includes('murtaza') || name.includes('hamid') || email.includes('murtaza')
    const hasAdminRole = role === 'admin' || role === 'supervisor' || role === 'payment_manager'
    return isMurtaza || hasAdminRole
  }, [])

  // Load User Data & Payment History
  const loadData = useCallback(async () => {
    if (!user?.id) return
    try {
      // 1. Current user stats
      const { data: stats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      
      let managerFlag = false
      if (stats) {
        setUserProfile(stats)
        managerFlag = checkManagerStatus(stats)
        setIsManager(managerFlag)
        if (managerFlag && portalMode === 'payer') {
          setPortalMode('manager')
        }
      }

      // 2. Personal payment history
      const { data: myHist, error: myErr } = await supabase
        .from('user_payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!myErr && myHist) {
        setMyPayments(myHist)
      }

      // 3. If manager, load all users and all payment records
      if (managerFlag) {
        const [usersRes, paymentsRes] = await Promise.all([
          supabase.from('user_stats').select('user_id, name, thali_number, email, phone, role, payment_exempt').order('thali_number', { ascending: true, nullsFirst: false }),
          supabase.from('user_payments').select('*').order('created_at', { ascending: false })
        ])

        if (usersRes.data) {
          setAllUsers(usersRes.data.filter(u => u.role === 'member' || !u.role))
        }
        if (paymentsRes.data) {
          setAllPayments(paymentsRes.data)
        }
      }
    } catch (err) {
      console.error('Error fetching payment data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id, checkManagerStatus, portalMode])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Setup note when profile loads
  useEffect(() => {
    if (userProfile?.thali_number) {
      setCustomNote(`Thali #${userProfile.thali_number} - ${paymentTitle}`)
    } else {
      setCustomNote(paymentTitle)
    }
  }, [userProfile, paymentTitle])

  // Copy UPI ID to clipboard
  const handleCopyUpi = (showExtendedToast = false) => {
    navigator.clipboard.writeText(configuredUpiId)
    setCopiedUpi(true)
    if (showExtendedToast) {
      toast.success(`Copied "${configuredUpiId}"! Open your UPI app & select "Pay to UPI ID" to bypass bank web limits.`, {
        duration: 5000,
        icon: '📋'
      })
    } else {
      toast.success('UPI ID copied to clipboard!')
    }
    setTimeout(() => setCopiedUpi(false), 2500)
  }

  // Construct 100% fail-safe P2P UPI URL matching NPCI specifications
  // CRITICAL FIX: 'tr' (Transaction Ref ID) must NOT be passed to P2P personal VPAs.
  // When 'tr' is present without a registered merchant code, Indian banks (HDFC, SBI, ICICI, etc.)
  // treat the payment as an unverified merchant intent and reject with "Payment limit exceeded" / "Bank limit exceeded".
  //
  // RELIABILITY RULES (why "bank limit exceeded" happens and how we prevent it):
  //  1. Amount is always sent with 2 decimals (am=1500.00) — bare integers are
  //     rejected by several PSPs as a malformed collect request.
  //  2. One tap never exceeds the UPI per-transaction cap (₹1,00,000). Bigger
  //     dues are auto-split into parts paid one after another.
  //  3. The primary Pay button fires the generic upi://pay intent (system app
  //     chooser with receiver + amount prefilled) instead of a hardcoded
  //     single-app deep link that fails when that app is missing/mishandled.
  //  4. The receiver VPA is format-validated before launch so a misconfigured
  //     ID fails loudly here instead of inside the bank app.
  const UPI_TXN_LIMIT = 100000
  const numericAmount = Math.max(0, parseFloat(amount) || 0)
  // NPCI-safe: always two decimals, e.g. 1500.00
  const formattedAmount = numericAmount.toFixed(2)
  const sanitizedNote = (customNote || `Al-Mawaid Thali Contribution`).replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 45).trim()

  const isValidVpa = (v) => /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test((v || '').trim())
  const isUpiIdValid = useMemo(() => isValidVpa(configuredUpiId), [configuredUpiId])
  const isFallbackValid = useMemo(() => isValidVpa(fallbackUpiId), [fallbackUpiId])

  // Split dues above the per-transaction cap into bank-safe parts.
  const payParts = useMemo(() => {
    if (!(numericAmount > 0)) return []
    const parts = []
    let remaining = Math.round(numericAmount * 100) / 100
    while (remaining > 0) {
      const take = Math.min(UPI_TXN_LIMIT, remaining)
      parts.push(Number(take.toFixed(2)))
      remaining = Number((remaining - take).toFixed(2))
    }
    return parts
  }, [numericAmount])
  const needsSplit = payParts.length > 1

  // ── Monthly dues engine ──
  // Every month carries an expected contribution (defaultDue). Paid = sum of
  // this member's recorded payments in that calendar month.
  const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const monthLabelOf = (key) => {
    try {
      const [y, m] = key.split('-').map(Number)
      return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    } catch { return key }
  }
  const monthOptions = useMemo(() => {
    const out = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      out.push({ key: monthKeyOf(d), label: monthLabelOf(monthKeyOf(d)), current: i === 0 })
    }
    return out
  }, [])
  const currentMonthKey = monthKeyOf(new Date())
  const paidByMonth = useMemo(() => {
    const map = {}
    ;(myPayments || []).forEach(p => {
      if (!p?.created_at) return
      const k = monthKeyOf(new Date(p.created_at))
      map[k] = (map[k] || 0) + (Number(p.amount) || 0)
    })
    return map
  }, [myPayments])
  const monthStatusOf = useCallback((key) => {
    const paid = paidByMonth[key] || 0
    if (paid >= defaultDue) return 'paid'
    if (paid > 0) return 'partial'
    return 'unpaid'
  }, [paidByMonth, defaultDue])
  const currentBalance = Math.max(0, Number((defaultDue - (paidByMonth[currentMonthKey] || 0)).toFixed(2)))

  // Generate UPI URI. Pure P2P by default (no 'tr'); pass { withTr: true } for
  // the alternate bank-compatible format (unique reference attached).
  const generateUpiUrl = useCallback((appType = 'upi', partAmount = null, opts = {}) => {
    const cleanUpi = (opts.receiver || configuredUpiId || 'murtazacool558@okhdfcbank').trim()
    const cleanPayee = (opts.payee || payeeName || 'Al-Mawaid').trim()
    const amt = partAmount != null ? Number(partAmount).toFixed(2) : formattedAmount
    const note = opts.note || sanitizedNote

    // Clean query parameters to ensure pure P2P transfer
    const params = [
      `pa=${encodeURIComponent(cleanUpi)}`,
      `pn=${encodeURIComponent(cleanPayee)}`,
      `am=${encodeURIComponent(amt)}`,
      `cu=INR`,
      `tn=${encodeURIComponent(note)}`
    ]
    if (opts.withTr) {
      const ref = (opts.tr || `AM${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)
      params.push(`tr=${encodeURIComponent(ref)}`)
    }
    const query = params.join('&')

    if (appType === 'gpay') return `tez://upi/pay?${query}`
    if (appType === 'phonepe') return `phonepe://pay?${query}`
    if (appType === 'paytm') return `paytmmp://pay?${query}`
    return `upi://pay?${query}`
  }, [configuredUpiId, payeeName, formattedAmount, sanitizedNote])

  const upiUrl = useMemo(() => generateUpiUrl('upi'), [generateUpiUrl])

  // Detect Mobile device vs Desktop
  const isMobileDevice = useMemo(() => {
    if (typeof window === 'undefined') return true
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }, [])

  // Universal Payment Trigger.
  // Default is the generic upi://pay intent: Android shows the app chooser with
  // the receiver UPI ID + exact amount prefilled, so the member pays inside
  // their own trusted UPI app (safest + most compatible). App-specific deep
  // links are offered as secondary shortcuts only.
  //
  // No manual UTR typing: the attempt is stashed as a pending payment, and the
  // moment the member returns from their UPI app a receipt row is auto-created
  // (status 'submitted' for manager verification) with a downloadable pay slip.
  const [activePart, setActivePart] = useState(0)
  const pendingKey = useMemo(() => `almawaid_pending_pay_${user?.id || 'anon'}`, [user?.id])

  const stashPendingPay = useCallback((entry) => {
    try { localStorage.setItem(pendingKey, JSON.stringify(entry)) } catch (e) { console.debug('[pay] pending stash unavailable', e && e.message) }
  }, [pendingKey])
  const clearPendingPay = useCallback(() => {
    try { localStorage.removeItem(pendingKey) } catch (e) { console.debug('[pay] pending clear unavailable', e && e.message) }
  }, [pendingKey])
  const readPendingPay = useCallback(() => {
    try {
      const raw = localStorage.getItem(pendingKey)
      return raw ? JSON.parse(raw) : null
    } catch (e) { console.debug('[pay] pending read unavailable', e && e.message); return null }
  }, [pendingKey])

  const handleLaunchPayment = (appType = 'upi', partIdx = 0, amountOverride = null) => {
    // ── SECURITY WALL: every launch must pass all checks or it never fires ──
    if (!user?.id) {
      toast.error('Please sign in again to pay securely.')
      return
    }
    const total = amountOverride != null ? Number(amountOverride) : numericAmount
    if (!Number.isFinite(total) || !(total >= 1)) {
      toast.error('Please enter a valid amount (minimum ₹1).')
      return
    }
    if (total > 100 * UPI_TXN_LIMIT) {
      toast.error('Amount is unusually large. Please contact support to pay this.')
      return
    }
    if (!isUpiIdValid) {
      toast.error('Receiver UPI ID is not configured correctly. Please contact support.')
      return
    }
    if (!(payeeName || '').trim()) {
      toast.error('Receiver name is missing. Please contact support.')
      return
    }
    // One attempt at a time: finish or discard the previous one first.
    const existing = readPendingPay()
    if (existing && existing.launchedAt && (Date.now() - existing.launchedAt) < 30 * 60 * 1000) {
      setShowPendingBanner(true)
      toast.error('Please complete or discard your unfinished payment first.')
      return
    }
    // Cooldown: no rapid double-taps / duplicate intents.
    const lastLaunch = Number(localStorage.getItem(`almawaid_last_launch_${user.id}`) || 0)
    if (Date.now() - lastLaunch < 10000) {
      toast.error('Please wait a moment before paying again.')
      return
    }
    const parts = (() => {
      const out = []
      let remaining = Math.round(total * 100) / 100
      while (remaining > 0) {
        const take = Math.min(UPI_TXN_LIMIT, remaining)
        out.push(Number(take.toFixed(2)))
        remaining = Number((remaining - take).toFixed(2))
      }
      return out
    })()
    const partAmount = parts[partIdx] != null ? parts[partIdx] : total
    if (!(partAmount > 0) || partAmount > UPI_TXN_LIMIT) {
      toast.error(`Each payment must be between ₹1 and ₹${UPI_TXN_LIMIT.toLocaleString('en-IN')}`)
      return
    }
    setActivePart(partIdx)
    // Show the confirm sheet with the EXACT intent payload — member verifies
    // receiver + amount before anything leaves the app.
    setConfirmPay({
      appType, partIdx, total, partAmount, partsCount: parts.length,
      receiver: (configuredUpiId || '').trim(),
      payee: (payeeName || 'Al-Mawaid').trim(),
      note: parts.length > 1 ? `${sanitizedNote} (Part ${partIdx + 1}/${parts.length})` : sanitizedNote,
    })
  }

  // Actually fire a confirmed intent. `withTr` selects the alternate
  // bank-compatible format; `receiverOverride` pays the fallback VPA.
  const firePayment = (plan, { withTr = false, receiverOverride = null } = {}) => {
    if (!plan || finalizingRef.current) return
    const receiver = (receiverOverride || plan.receiver || '').trim()
    if (!isValidVpa(receiver)) {
      toast.error('Receiver UPI ID is invalid. Payment blocked for your safety.')
      return
    }
    const partAmount = Number(Number(plan.partAmount).toFixed(2))
    if (!Number.isFinite(partAmount) || !(partAmount >= 1) || partAmount > UPI_TXN_LIMIT) {
      toast.error('Payment amount failed re-validation. Please start again.')
      return
    }
    // Stash BEFORE leaving to the bank app — the auto-receipt is built from this.
    // client_ref makes every attempt idempotent: a double return can never
    // create two dues records for one payment.
    const clientRef = `${user.id}-${monthKeyOf(new Date())}-${partAmount.toFixed(2)}-${Date.now()}`
    stashPendingPay({
      clientRef,
      amount: partAmount,
      note: plan.note,
      upi: receiver,
      payee: plan.payee,
      month: monthKeyOf(new Date()),
      launchedAt: Date.now(),
      format: withTr ? 'with-tr' : 'p2p',
    })
    try { localStorage.setItem(`almawaid_last_launch_${user.id}`, String(Date.now())) } catch (e) { console.debug('[pay] launch stamp unavailable', e && e.message) }
    setConfirmPay(null)
    setFailHelp(false)
    setFiredPlan({ appType: plan.appType, partAmount, receiver, payee: plan.payee, note: plan.note, format: withTr ? 'with-tr' : 'p2p' })

    if (!isMobileDevice) {
      // Desktop / Laptop: Show high-res QR code for scanning
      setShowQRModal(true)
      return
    }

    // Mobile: fire the intent; receiver + amount arrive prefilled in the UPI app
    try {
      const targetUrl = generateUpiUrl(plan.appType, partAmount, {
        receiver, payee: plan.payee, note: plan.note, withTr,
      })
      const link = document.createElement('a')
      link.href = targetUrl
      link.rel = 'noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      // No record modal anymore — the receipt auto-generates on return.
    } catch (e) {
      console.warn('Direct app launch failed, falling back to standard UPI:', e)
      const fallbackUrl = generateUpiUrl('upi', partAmount, { receiver, payee: plan.payee, note: plan.note, withTr })
      window.location.href = fallbackUrl
    }
  }

  // Auto-receipt: called when the member returns from their UPI app (or taps
  // "I've Paid" on the QR modal). Creates the dues record + pay slip with zero
  // typing. Status stays 'submitted' until a manager verifies it.
  // SECURITY: amount comes ONLY from the stashed attempt (re-validated), and
  // client_ref makes repeat returns idempotent — one payment, one record.
  const finalizeAutoPayment = useCallback(async (pending) => {
    if (!pending || finalizingRef.current || !user?.id) return false
    const safeAmount = Number(pending.amount)
    if (!Number.isFinite(safeAmount) || !(safeAmount >= 1) || safeAmount > UPI_TXN_LIMIT) {
      toast.error('This saved attempt looks invalid and was discarded for your safety.')
      clearPendingPay()
      setShowPendingBanner(false)
      return false
    }
    finalizingRef.current = true
    setFinalizingPay(true)
    try {
      // Idempotency: a double return / double tap must not duplicate dues.
      if (pending.clientRef) {
        const { data: dup } = await supabase
          .from('user_payments')
          .select('*')
          .eq('user_id', user.id)
          .eq('metadata->>client_ref', pending.clientRef)
          .limit(1)
        if (dup && dup.length) {
          setLastSlip(dup[0])
          setShowSlipModal(true)
          clearPendingPay()
          setShowPendingBanner(false)
          setFiredPlan(null)
          toast.success('Receipt already saved — showing it again, no double charge recorded.')
          return true
        }
      }
      const payload = {
        user_id: user.id,
        user_name: userProfile?.name || user?.email?.split('@')[0] || 'User',
        user_email: userProfile?.email || user?.email || '',
        thali_number: userProfile?.thali_number ? String(userProfile.thali_number) : '',
        amount: safeAmount,
        currency: 'INR',
        status: 'submitted',
        transaction_ref: 'AUTO-UPI',
        upi_id: pending.upi || configuredUpiId,
        payee_name: pending.payee || payeeName,
        payment_method: 'UPI Auto',
        note: pending.note || paymentTitle,
        metadata: { client_ref: pending.clientRef || null, source: 'auto-return', month: pending.month || null },
        created_at: new Date().toISOString()
      }
      const { data, error } = await supabase.from('user_payments').insert([payload]).select().single()
      if (error) throw error

      setMyPayments(prev => [data, ...prev])
      setAllPayments(prev => [data, ...prev])
      setLastSlip(data)
      setShowSlipModal(true)
      clearPendingPay()
      setShowPendingBanner(false)
      setFiredPlan(null)
      toast.success('Payment recorded — your receipt is ready!')

      // Notify managers (same channel as manual records)
      try {
        const { data: managers } = await supabase
          .from('user_stats')
          .select('user_id')
          .or('name.ilike.%Murtaza%,email.ilike.%murtaza%,role.eq.admin')
        if (managers && managers.length > 0) {
          await supabase.from('notices').insert(managers.map(mgr => ({
            title: '💳 New Payment Received',
            body: `${userProfile?.name || 'A Member'} (Thali #${userProfile?.thali_number || '—'}) paid ₹${Number(pending.amount)}. Auto-recorded — please verify in Payments Hub.`,
            sender_name: 'Al-Mawaid Payments',
            target_user_id: mgr.user_id,
            tone: '#34d399',
            created_at: new Date().toISOString()
          })))
        }
      } catch (noticeErr) {
        console.warn('Manager notify notice failed:', noticeErr)
      }
      return true
    } catch (err) {
      console.error('Auto payment record failed:', err)
      toast.error('Could not save your receipt. Please check connection and try again.')
      return false
    } finally {
      finalizingRef.current = false
      setFinalizingPay(false)
    }
  }, [user?.id, user?.email, userProfile, configuredUpiId, payeeName, paymentTitle, clearPendingPay])

  // On open: surface any unfinished attempt (debited-but-no-receipt safety net).
  useEffect(() => {
    if (isManager) return
    const pending = readPendingPay()
    if (pending && pending.launchedAt && (Date.now() - pending.launchedAt) < 30 * 60 * 1000) {
      setShowPendingBanner(true)
    }
  }, [readPendingPay, isManager])

  // Dispute / refund request on a recorded payment. Flags the row and opens a
  // support ticket managers already triage (with reply + resolve alerts).
  const raiseDispute = useCallback(async (payment) => {
    if (!payment?.id || !user?.id) return
    if (!window.confirm(`Raise a refund / issue request for ₹${Number(payment.amount).toFixed(2)} paid on ${new Date(payment.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}?\n\nOur team will verify with the bank and refund or adjust your dues.`)) return
    try {
      const dispute = { status: 'open', raised_at: new Date().toISOString(), amount: Number(payment.amount) }
      const { error: updErr } = await supabase
        .from('user_payments')
        .update({ metadata: { ...(payment.metadata || {}), dispute } })
        .eq('id', payment.id)
      if (updErr) throw updErr
      const ref = payment.transaction_ref || 'AUTO-UPI'
      await supabase.from('queries').insert([{
        user_id: user.id,
        subject: `Refund Request — ₹${Number(payment.amount).toFixed(2)}`,
        comment: `[Refund Request] Payment of ₹${Number(payment.amount).toFixed(2)} on ${new Date(payment.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} (Ref: ${ref}). Issue: amount debited but ${payment.status === 'verified' ? 'needs refund/adjustment' : 'receipt needs verification'}. Please verify with the bank and refund or adjust my dues.`,
        status: 'open',
      }])
      setMyPayments(prev => prev.map(p => p.id === payment.id ? { ...p, metadata: { ...(p.metadata || {}), dispute } } : p))
      toast.success('Refund request raised — our team will verify and refund if the debit is confirmed.')
    } catch (e) {
      console.error('[dispute] failed:', e)
      toast.error('Could not raise the request. Please try again or contact support.')
    }
  }, [user?.id])

  // When the member comes back from their bank/UPI app, the stashed attempt
  // becomes a real dues record + pay slip automatically.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || isManager) return
      const pending = readPendingPay()
      if (!pending || !pending.launchedAt) return
      const awayMs = Date.now() - pending.launchedAt
      if (awayMs < 4000 || awayMs > 30 * 60 * 1000) {
        if (awayMs > 30 * 60 * 1000) clearPendingPay()
        return
      }
      finalizeAutoPayment(pending)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [readPendingPay, clearPendingPay, finalizeAutoPayment, isManager])

  // Monthly dues self-reminder: once per month, an unpaid member gets one
  // Alerts-tab entry (badge + inbox) pointing at Dues & Payments.
  useEffect(() => {
    if (loading || !user?.id || isManager) return
    if (monthStatusOf(currentMonthKey) !== 'unpaid') return
    const flag = `almawaid_dues_reminder_${currentMonthKey}`
    let seen = null
    try { seen = localStorage.getItem(flag) } catch (e) { console.debug('[dues-reminder] storage unavailable', e && e.message) }
    if (seen) return
    let cancelled = false
    ;(async () => {
      try {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        const { data: existing } = await supabase
          .from('notices')
          .select('id')
          .eq('target_user_id', user.id)
          .like('title', '%Thali Contribution Due%')
          .gte('created_at', monthStart)
          .limit(1)
        if (cancelled || (existing && existing.length)) return
        await supabase.from('notices').insert([{
          title: `Thali Contribution Due — ${monthLabelOf(currentMonthKey)}`,
          body: `Your contribution of ₹${Number(defaultDue).toFixed(2)} for ${monthLabelOf(currentMonthKey)} is pending. Tap to pay securely via UPI.`,
          message: `Your contribution of ₹${Number(defaultDue).toFixed(2)} for ${monthLabelOf(currentMonthKey)} is pending.`,
          sender_name: 'Al-Mawaid Dues',
          target_user_id: user.id,
          tone: '#f59e0b',
          type: 'reminder',
          url: '/profile/payments',
          scheduled_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }])
        try { localStorage.setItem(flag, '1') } catch (e) { console.debug('[dues-reminder] storage unavailable', e && e.message) }
      } catch (e) {
        console.warn('[dues-reminder] skipped:', e?.message || e)
      }
    })()
    return () => { cancelled = true }
  }, [loading, user?.id, isManager, monthStatusOf, currentMonthKey, defaultDue])

  // Manager-only manual record (cash / bank transfer). Members never reach
  // here — their receipts auto-generate when they return from the UPI app.
  const handleRecordPayment = async (e) => {
    e?.preventDefault()
    if (!isManager) return
    const targetUser = selectedUserToPay || userProfile
    const payAmt = parseFloat(recordAmount) || numericAmount
    if (payAmt <= 0) {
      toast.error('Please enter a valid amount paid')
      return
    }

    setSubmittingRecord(true)
    try {
      const payload = {
        user_id: targetUser?.user_id || user.id,
        user_name: targetUser?.name || user?.email?.split('@')[0] || 'User',
        user_email: targetUser?.email || user?.email || '',
        thali_number: targetUser?.thali_number ? String(targetUser.thali_number) : '',
        amount: payAmt,
        currency: 'INR',
        status: isManager ? 'verified' : 'submitted',
        transaction_ref: utrNumber.trim() || (isManager ? 'MANUAL_RECORD' : null),
        upi_id: configuredUpiId,
        payee_name: payeeName,
        payment_method: 'UPI Pay',
        note: recordNote || paymentTitle,
        created_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('user_payments')
        .insert([payload])
        .select()
        .single()

      if (error) throw error

      // ── AUTO-NOTIFY MULLA MURTAZA HAMID ON NEW PAYMENT ──
      if (!isManager) {
        try {
          const { data: managers } = await supabase
            .from('user_stats')
            .select('user_id')
            .or('name.ilike.%Murtaza%,email.ilike.%murtaza%,role.eq.admin')

          if (managers && managers.length > 0) {
            const managerNotices = managers.map(mgr => ({
              title: '💳 New Payment Received',
              body: `${userProfile?.name || 'A Member'} (Thali #${userProfile?.thali_number || '—'}) paid ₹${payAmt}. UTR: ${utrNumber || 'GPay Ref'}. Recorded in Payments Hub.`,
              sender_name: 'Al-Mawaid Payments',
              target_user_id: mgr.user_id,
              tone: '#34d399',
              created_at: new Date().toISOString()
            }))
            await supabase.from('notices').insert(managerNotices)
          }
        } catch (noticeErr) {
          console.warn('Manager notify notice failed:', noticeErr)
        }
      }

      toast.success(isManager ? `Payment recorded for ${targetUser?.name || 'User'}!` : 'Payment logged! Receipt recorded.')
      
      if (targetUser?.user_id === user.id) {
        setMyPayments(prev => [data, ...prev])
      }
      setAllPayments(prev => [data, ...prev])

      setShowRecordModal(false)
      setSelectedUserToPay(null)
      setUtrNumber('')
    } catch (err) {
      console.error('Error saving payment record:', err)
      toast.error('Failed to log payment. Please check connection.')
    } finally {
      setSubmittingRecord(false)
    }
  }

  // Verify / Approve a payment (Manager action)
  const handleVerifyPayment = async (paymentId) => {
    try {
      const { error } = await supabase
        .from('user_payments')
        .update({ status: 'verified', updated_at: new Date().toISOString() })
        .eq('id', paymentId)

      if (error) throw error
      toast.success('Payment marked as Verified!')
      setAllPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'verified' } : p))
      setMyPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'verified' } : p))
    } catch (err) {
      console.error('Error verifying payment:', err)
      toast.error('Failed to verify payment')
    }
  }

  // ── MANAGER: Toggle Forfeit / Exempt Status for a user ──
  const handleToggleForfeitUser = async (targetUser) => {
    const newExemptStatus = !targetUser.payment_exempt
    try {
      const { error } = await supabase
        .from('user_stats')
        .update({ payment_exempt: newExemptStatus, updated_at: new Date().toISOString() })
        .eq('user_id', targetUser.user_id)

      if (error) throw error
      toast.success(newExemptStatus ? `${targetUser.name || 'User'} marked as Forfeited / Exempt` : `${targetUser.name || 'User'} restored to active payment`)
      setAllUsers(prev => prev.map(u => u.user_id === targetUser.user_id ? { ...u, payment_exempt: newExemptStatus } : u))
    } catch (err) {
      console.error('Error toggling forfeit status:', err)
      toast.error('Could not update forfeit status')
    }
  }

  // ── MANAGER: Toggle Global Payment Dues Display / Active State ──
  const handleTogglePaymentDisplay = async () => {
    const nextState = !isPaymentActive
    setIsPaymentActive(nextState)
    try {
      await supabase.from('app_settings').upsert({ key: 'payment_enabled', value: String(nextState) })
      toast.success(nextState ? 'Payment Dues are now VISIBLE to all members' : 'Payment Dues are now HIDDEN from members')
    } catch (err) {
      console.error('Error updating payment_enabled:', err)
      toast.error('Could not update payment display')
      setIsPaymentActive(!nextState)
    }
  }

  // ── MANAGER: Open Custom Notification Modal ──
  const handleOpenNotifyModal = (targetUser = null) => {
    setNotifyTargetUser(targetUser)
    if (targetUser) {
      setNotifyTitle(`Payment Reminder - ${paymentTitle}`)
      setNotifyBody(`Dear ${targetUser.name || 'Member'}, your thali contribution of ₹${defaultDue} is pending. Please open your Al-Mawaid app and pay via your UPI app.`)
    } else {
      const activeUnpaidCount = allUsers.filter(u => !u.payment_exempt && allPayments.filter(p => p.user_id === u.user_id).length === 0).length
      setNotifyTitle(`Thali Contribution Reminder`)
      setNotifyBody(`Dear Member, your monthly thali contribution of ₹${defaultDue} is due. Please pay via your UPI app on your portal. Thank you for your support.`)
    }
    setNotifyTemplate('standard')
    setShowNotifyModal(true)
  }

  // ── MANAGER: Apply Notification Template ──
  const handleSelectTemplate = (tempKey) => {
    setNotifyTemplate(tempKey)
    const nameStr = notifyTargetUser?.name || 'Member'
    if (tempKey === 'standard') {
      setNotifyTitle('Thali Contribution Reminder')
      setNotifyBody(`Dear ${nameStr}, this is a gentle reminder that your thali contribution of ₹${defaultDue} is due. Please pay via your UPI app on the Al-Mawaid portal.`)
    } else if (tempKey === 'urgent') {
      setNotifyTitle('⚠️ Urgent: Payment Due')
      setNotifyBody(`Dear ${nameStr}, your thali contribution of ₹${defaultDue} is pending. Kindly clear the dues via your UPI app today to avoid any interruption in thali services.`)
    } else if (tempKey === 'final') {
      setNotifyTitle('🔔 Final Notice: Thali Contribution')
      setNotifyBody(`Salam ${nameStr}, this is the final reminder for this month's thali contribution of ₹${defaultDue}. Please pay using your UPI app (UPI: ${configuredUpiId}).`)
    }
  }

  // ── MANAGER: Execute Notification Dispatch ──
  const handleSendCustomNotification = async (e) => {
    e.preventDefault()
    if (!notifyTitle.trim() || !notifyBody.trim()) {
      toast.error('Please enter both title and message')
      return
    }

    setBulkNotifying(true)
    try {
      if (notifyTargetUser) {
        // Single user notification
        await supabase.from('notices').insert([{
          title: notifyTitle.trim(),
          body: notifyBody.trim(),
          sender_name: 'Mulla Murtaza Hamid (Payments)',
          target_user_id: notifyTargetUser.user_id,
          tone: '#34d399',
          created_at: new Date().toISOString()
        }])
        toast.success(`Reminder sent to ${notifyTargetUser.name || 'Member'}!`)
      } else {
        // Bulk notification to all active unpaid users
        const unpaidList = allUsers.filter(u => {
          if (u.payment_exempt) return false
          const userPayments = allPayments.filter(p => p.user_id === u.user_id)
          return userPayments.length === 0
        })

        if (unpaidList.length === 0) {
          toast.success('No active unpaid members to notify.')
          setShowNotifyModal(false)
          return
        }

        const notices = unpaidList.map(u => ({
          title: notifyTitle.trim(),
          body: notifyBody.replace(/Dear Member/g, `Dear ${u.name || 'Member'}`).trim(),
          sender_name: 'Mulla Murtaza Hamid (Payments)',
          target_user_id: u.user_id,
          tone: '#34d399',
          created_at: new Date().toISOString()
        }))

        for (let i = 0; i < notices.length; i += 50) {
          const chunk = notices.slice(i, i + 50)
          await supabase.from('notices').insert(chunk)
        }

        toast.success(`📢 Notification delivered to ${unpaidList.length} members!`)
      }

      setShowNotifyModal(false)
    } catch (err) {
      console.error('Error dispatching notifications:', err)
      toast.error('Could not send notification')
    } finally {
      setBulkNotifying(false)
    }
  }

  // ── MANAGER: WhatsApp Reminder ──
  const handleWhatsAppReminder = (targetUser) => {
    if (!targetUser.phone) {
      toast.error(`No phone number found for ${targetUser.name}`)
      return
    }
    const cleanPhone = targetUser.phone.replace(/[^\d]/g, '')
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
    const text = encodeURIComponent(
      `Salam ${targetUser.name || 'Bhai'},\n\nThis is a gentle reminder regarding your Al-Mawaid Thali contribution of *₹${defaultDue}* for ${paymentTitle}.\n\nPlease pay directly via your UPI app to UPI ID: *${configuredUpiId}*.\n\nThank you,\n*Mulla Murtaza Hamid*\nAl-Mawaid Management`
    )
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank')
  }

  // ── MANAGER: Save App Payment Settings ──
  const handleSaveSettings = async (e) => {
    e.preventDefault()
    try {
      const items = [
        { key: 'upi_id', value: configuredUpiId.trim() },
        { key: 'upi_id_2', value: (fallbackUpiId || '').trim() },
        { key: 'upi_payee_name', value: payeeName.trim() },
        { key: 'default_payment_due', value: String(defaultDue) },
        { key: 'payment_title', value: paymentTitle.trim() },
        { key: 'payment_enabled', value: String(isPaymentActive) }
      ]

      for (const item of items) {
        const { error } = await supabase.from('app_settings').upsert(item)
        if (error) throw error
      }

      toast.success('Payment settings updated! All users will see the new due amount.')
      setShowSettingsModal(false)
      loadData()
    } catch (err) {
      console.error('Error saving settings:', err)
      toast.error('Could not save settings')
    }
  }

  // ── Metrics Calculations for Manager ──
  const managerMetrics = useMemo(() => {
    const totalUsersCount = allUsers.length
    const forfeitUsers = allUsers.filter(u => u.payment_exempt)
    const forfeitCount = forfeitUsers.length
    const activeMembers = allUsers.filter(u => !u.payment_exempt)

    const paidUsersSet = new Set(allPayments.filter(p => p.status === 'verified' || p.status === 'submitted').map(p => p.user_id))
    
    // Count paid among active members
    const paidCount = activeMembers.filter(u => paidUsersSet.has(u.user_id)).length
    const unpaidCount = Math.max(0, activeMembers.length - paidCount)
    const totalAmountCollected = allPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    const totalAmountPending = unpaidCount * defaultDue

    return {
      totalUsersCount,
      activeMembersCount: activeMembers.length,
      paidCount,
      unpaidCount,
      forfeitCount,
      totalAmountCollected,
      totalAmountPending,
      collectionRate: activeMembers.length > 0 ? Math.round((paidCount / activeMembers.length) * 100) : 0
    }
  }, [allUsers, allPayments, defaultDue])

  // Filtered Users List for Manager
  const filteredUsersList = useMemo(() => {
    return allUsers.map(u => {
      const userPayments = allPayments.filter(p => p.user_id === u.user_id)
      const latest = userPayments[0]
      const totalPaid = userPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
      
      let status = 'unpaid'
      if (u.payment_exempt) {
        status = 'forfeit'
      } else if (latest) {
        status = latest.status === 'verified' ? 'paid' : 'submitted'
      }

      return {
        ...u,
        payments: userPayments,
        latestPayment: latest,
        totalPaid,
        status
      }
    }).filter(u => {
      if (hideForfeited && u.status === 'forfeit') return false

      if (managerFilter === 'paid' && u.status !== 'paid') return false
      if (managerFilter === 'unpaid' && u.status !== 'unpaid') return false
      if (managerFilter === 'forfeit' && u.status !== 'forfeit') return false
      if (managerFilter === 'submitted' && u.status !== 'submitted') return false

      if (managerSearch.trim()) {
        const q = managerSearch.toLowerCase()
        const nameMatch = (u.name || '').toLowerCase().includes(q)
        const thaliMatch = String(u.thali_number || '').includes(q)
        const phoneMatch = String(u.phone || '').includes(q)
        return nameMatch || thaliMatch || phoneMatch
      }
      return true
    })
  }, [allUsers, allPayments, managerFilter, managerSearch, hideForfeited])

  return (
    <main style={{
      flex: 1,
      padding: '16px 16px calc(120px + env(safe-area-inset-bottom, 0px))',
      maxWidth: 740, margin: '0 auto', width: '100%',
      boxSizing: 'border-box', overflowX: 'hidden', minWidth: 0,
    }}>
      <BackHeader title={isManager && portalMode === 'manager' ? "Payment Management Hub" : "Dues & Payments"} onBack={onBack} />

      {/* Role Switcher Banner */}
      {isManager && (
        <div style={{
          display: 'flex',
          background: t.card,
          padding: 4,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
          marginBottom: 16
        }}>
          <button
            onClick={() => setPortalMode('manager')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 12,
              border: 'none',
              background: portalMode === 'manager' ? t.accentGrad : 'transparent',
              color: portalMode === 'manager' ? '#0a0d14' : t.textSub,
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s'
            }}
          >
            <Users size={16} />
            <span>All Users Tracking (Manager)</span>
          </button>

          <button
            onClick={() => setPortalMode('payer')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 12,
              border: 'none',
              background: portalMode === 'payer' ? t.accentGrad : 'transparent',
              color: portalMode === 'payer' ? '#0a0d14' : t.textSub,
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s'
            }}
          >
            <CreditCard size={16} />
            <span>Pay Dues</span>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 1: MANAGER DASHBOARD (Full Tracking, Forfeit & Toggles)
         ══════════════════════════════════════════════════════════════════════ */}
      {isManager && portalMode === 'manager' && (
        <div>
          {/* Manager Header Card */}
          <div style={{
            background: 'linear-gradient(135deg, #162036 0%, #0d121f 100%)',
            borderRadius: 24,
            border: `1.5px solid ${t.accentBorder || 'rgba(197,160,89,0.35)'}`,
            padding: '20px',
            marginBottom: 20,
            boxShadow: '0 12px 36px rgba(0,0,0,0.35)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: t.accent, background: t.accentBg, padding: '3px 8px', borderRadius: 12, border: `1px solid ${t.accentBorder}` }}>
                    👑 Payment Manager
                  </span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                    Mulla Murtaza Hamid
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'Playfair Display', serif" }}>
                  {paymentTitle}
                </h2>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                  Standard Due: ₹{defaultDue.toLocaleString('en-IN')} • UPI: {configuredUpiId}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* Global Display / Hide Toggle */}
                <button
                  onClick={handleTogglePaymentDisplay}
                  style={{
                    background: isPaymentActive ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
                    border: `1px solid ${isPaymentActive ? 'rgba(52,211,153,0.35)' : 'rgba(239,68,68,0.35)'}`,
                    borderRadius: 10,
                    padding: '8px 10px',
                    color: isPaymentActive ? '#34d399' : '#f87171',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 700
                  }}
                  title={isPaymentActive ? "Payment banner is VISIBLE to users" : "Payment banner is HIDDEN from users"}
                >
                  {isPaymentActive ? <Eye size={14} /> : <EyeOff size={14} />}
                  <span>{isPaymentActive ? 'Display: ON' : 'Display: OFF'}</span>
                </button>

                <button
                  onClick={() => setShowSettingsModal(true)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 700
                  }}
                  title="Configure Dues & UPI"
                >
                  <SlidersHorizontal size={14} />
                  <span>Config</span>
                </button>

                <button
                  onClick={() => { setRefreshing(true); loadData() }}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    borderRadius: 10,
                    padding: '8px 10px',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Refresh"
                >
                  <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
                </button>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 8px', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Active Users</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 2 }}>{managerMetrics.activeMembersCount}</div>
              </div>
              <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52,211,153,0.2)', padding: '10px 8px', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#34d399', textTransform: 'uppercase', fontWeight: 700 }}>Paid</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#34d399', marginTop: 2 }}>{managerMetrics.paidCount}</div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 8px', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#f87171', textTransform: 'uppercase', fontWeight: 700 }}>Unpaid</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#f87171', marginTop: 2 }}>{managerMetrics.unpaidCount}</div>
              </div>
              <div style={{ background: 'rgba(148, 163, 184, 0.1)', border: '1px solid rgba(148,163,184,0.2)', padding: '10px 8px', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Forfeit / Exempt</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#94a3b8', marginTop: 2 }}>{managerMetrics.forfeitCount}</div>
              </div>
            </div>

            {/* Bulk Reminder Action Button */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => handleOpenNotifyModal(null)}
                disabled={bulkNotifying || managerMetrics.unpaidCount === 0}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 14,
                  border: 'none',
                  background: managerMetrics.unpaidCount > 0 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: managerMetrics.unpaidCount > 0 ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: managerMetrics.unpaidCount > 0 ? '0 6px 20px rgba(245, 158, 11, 0.35)' : 'none'
                }}
              >
                <BellRing size={16} />
                <span>
                  {bulkNotifying ? 'Sending Reminders…' : `📢 Notify Active Unpaid (${managerMetrics.unpaidCount})`}
                </span>
              </button>

              <button
                onClick={() => {
                  setSelectedUserToPay(null)
                  setRecordAmount(String(defaultDue))
                  setShowRecordModal(true)
                }}
                style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <CheckSquare size={16} color="#34d399" />
                <span>Record Payment</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <label htmlFor="managerSearchInput" style={{ display: 'none' }}>Search Members</label>
              <Search size={16} color={t.textSub} style={{ position: 'absolute', left: 12 }} />
              <input
                id="managerSearchInput"
                name="managerSearch"
                type="text"
                autoComplete="off"
                value={managerSearch}
                onChange={(e) => setManagerSearch(e.target.value)}
                placeholder="Search member, thali #, phone…"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 12,
                  border: `1px solid ${t.border}`,
                  background: t.card,
                  color: t.text,
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: `All (${allUsers.length})` },
                { id: 'unpaid', label: `Unpaid (${managerMetrics.unpaidCount})` },
                { id: 'paid', label: `Paid (${managerMetrics.paidCount})` },
                { id: 'forfeit', label: `Forfeited (${managerMetrics.forfeitCount})` }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setManagerFilter(f.id)}
                  style={{
                    padding: '8px 11px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    border: managerFilter === f.id ? `1px solid ${t.accent}` : `1px solid ${t.border}`,
                    background: managerFilter === f.id ? t.accentBg : t.card,
                    color: managerFilter === f.id ? t.accent : t.textSub,
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Member Payments Directory List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredUsersList.map(member => {
              const isPaid = member.status === 'paid'
              const isSubmitted = member.status === 'submitted'
              const isUnpaid = member.status === 'unpaid'
              const isForfeit = member.status === 'forfeit'

              return (
                <div
                  key={member.user_id}
                  style={{
                    background: t.card,
                    borderRadius: 16,
                    border: `1px solid ${isPaid ? 'rgba(52,211,153,0.3)' : isSubmitted ? 'rgba(251,191,36,0.3)' : isForfeit ? 'rgba(148,163,184,0.3)' : t.border}`,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
                          {member.name || 'Member'}
                        </span>
                        {member.thali_number && (
                          <span style={{
                            fontSize: 11, fontWeight: 800,
                            padding: '2px 8px', borderRadius: 8,
                            background: t.accentBg, color: t.accent,
                            border: `1px solid ${t.accentBorder}`
                          }}>
                            Thali #{member.thali_number}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 12, color: t.textSub, marginTop: 3 }}>
                        {member.phone || member.email || 'No contact details'}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isPaid && (
                        <span style={{
                          fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                          padding: '4px 10px', borderRadius: 12,
                          background: 'rgba(52, 211, 153, 0.15)', color: '#34d399',
                          border: '1px solid rgba(52, 211, 153, 0.4)',
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          <Check size={12} /> Paid ₹{member.totalPaid}
                        </span>
                      )}

                      {isSubmitted && (
                        <span style={{
                          fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                          padding: '4px 10px', borderRadius: 12,
                          background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24',
                          border: '1px solid rgba(251, 191, 36, 0.4)',
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          <Clock size={12} /> Under Review
                        </span>
                      )}

                      {isUnpaid && (
                        <span style={{
                          fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                          padding: '4px 10px', borderRadius: 12,
                          background: 'rgba(239, 68, 68, 0.12)', color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          Due ₹{defaultDue}
                        </span>
                      )}

                      {isForfeit && (
                        <span style={{
                          fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                          padding: '4px 10px', borderRadius: 12,
                          background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8',
                          border: '1px solid rgba(148, 163, 184, 0.35)',
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          <UserX size={12} /> Forfeited / Exempt
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Payment Details & Actions */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: `1px solid ${t.border}`,
                    paddingTop: 8,
                    marginTop: 2,
                    flexWrap: 'wrap',
                    gap: 6
                  }}>
                    <div style={{ fontSize: 11, color: t.textSub }}>
                      {member.latestPayment ? (
                        <span>
                          Paid on {new Date(member.latestPayment.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {member.latestPayment.transaction_ref && ` • Ref: ${member.latestPayment.transaction_ref}`}
                        </span>
                      ) : isForfeit ? (
                        <span style={{ color: '#94a3b8' }}>Exempted from collection</span>
                      ) : (
                        <span style={{ color: '#f87171', opacity: 0.9 }}>Pending payment</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {/* Forfeit / Unforfeit Toggle Action */}
                      <button
                        onClick={() => handleToggleForfeitUser(member)}
                        style={{
                          background: isForfeit ? 'rgba(52,211,153,0.1)' : 'rgba(148,163,184,0.1)',
                          border: `1px solid ${isForfeit ? 'rgba(52,211,153,0.3)' : 'rgba(148,163,184,0.3)'}`,
                          borderRadius: 8,
                          padding: '5px 8px',
                          color: isForfeit ? '#34d399' : '#94a3b8',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        title={isForfeit ? "Restore user to active dues" : "Mark user as Forfeit / Exempt from dues"}
                      >
                        {isForfeit ? <UserCheck size={12} /> : <UserX size={12} />}
                        <span>{isForfeit ? 'Un-Forfeit' : 'Forfeit'}</span>
                      </button>

                      {/* If Unpaid (and not forfeit), show Remind & Pay Actions */}
                      {isUnpaid && (
                        <>
                          <button
                            onClick={() => handleWhatsAppReminder(member)}
                            style={{
                              background: 'rgba(37,211,102,0.12)',
                              border: '1px solid rgba(37,211,102,0.3)',
                              borderRadius: 8,
                              padding: '5px 10px',
                              color: '#25D366',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            title="Send WhatsApp Reminder"
                          >
                            <MessageSquare size={12} />
                            <span>WhatsApp</span>
                          </button>

                          <button
                            onClick={() => handleOpenNotifyModal(member)}
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: `1px solid ${t.border}`,
                              borderRadius: 8,
                              padding: '5px 10px',
                              color: t.text,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            title="Send In-App Reminder"
                          >
                            <BellRing size={12} />
                            <span>Notify</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedUserToPay(member)
                              setRecordAmount(String(defaultDue))
                              setShowRecordModal(true)
                            }}
                            style={{
                              background: t.accentBg,
                              border: `1px solid ${t.accentBorder}`,
                              borderRadius: 8,
                              padding: '5px 10px',
                              color: t.accent,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <CheckSquare size={12} />
                            <span>Mark Paid</span>
                          </button>
                        </>
                      )}

                      {/* If Submitted UTR, show Verify button */}
                      {isSubmitted && (
                        <button
                          onClick={() => handleVerifyPayment(member.latestPayment.id)}
                          style={{
                            background: 'rgba(52, 211, 153, 0.2)',
                            border: '1px solid #34d399',
                            borderRadius: 8,
                            padding: '5px 12px',
                            color: '#34d399',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <ShieldCheck size={13} />
                          <span>Verify UTR</span>
                        </button>
                      )}

                      {/* If Paid, view receipt */}
                      {isPaid && member.latestPayment && (
                        <button
                          onClick={() => setSelectedReceipt(member.latestPayment)}
                          style={{
                            background: 'transparent',
                            border: `1px solid ${t.border}`,
                            borderRadius: 8,
                            padding: '4px 10px',
                            color: t.textSub,
                            fontSize: 11,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <Receipt size={12} />
                          <span>Receipt</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 2: INDIVIDUAL PAYER SCREEN (UPI + Personal Receipts)
         ══════════════════════════════════════════════════════════════════════ */}
      {(!isManager || portalMode === 'payer') && (
        <div style={{ width: '100%', boxSizing: 'border-box' }}>
          {/* ══════════════════════════════════════════════════════════════════════
              PAYMENT CARD CONTAINER (Strictly contained, Zero Overlap, Mobile-Optimized)
             ══════════════════════════════════════════════════════════════════════ */}
          <div style={{
            position: 'relative',
            borderRadius: 22,
            overflow: 'hidden',
            background: t.card,
            border: `1.5px solid ${t.borderActive || t.border}`,
            boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
            padding: '18px 16px',
            marginBottom: 20,
            boxSizing: 'border-box',
            width: '100%'
          }}>
            {/* Gold ribbon — professional dues identity in every theme */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 4,
              background: 'linear-gradient(90deg,#B8860B,#F0C239,#10b981,#B8860B)',
            }} />
            {/* Header: Title, Thali # & Refresh */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                <span style={{
                  fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: t.accent, background: t.accentBg, padding: '3px 8px', borderRadius: 12,
                  border: `1px solid ${t.accentBorder}`, whiteSpace: 'nowrap'
                }}>
                  {paymentTitle}
                </span>

                {userProfile?.thali_number && (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    Thali #{userProfile.thali_number}
                  </span>
                )}

                {userProfile?.payment_exempt && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 8, background: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.3)', whiteSpace: 'nowrap' }}>
                    Exempt
                  </span>
                )}
              </div>

              <button
                onClick={() => { setRefreshing(true); loadData() }}
                style={{
                  background: t.inputBg, border: 'none', borderRadius: 8,
                  padding: '6px 8px', color: t.textSub, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, flexShrink: 0
                }}
                title="Refresh Status"
              >
                <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
                <span>Sync</span>
              </button>
            </div>

            {/* Unfinished-attempt recovery: money may have left the bank with no receipt yet */}
            {showPendingBanner && (() => {
              const pending = readPendingPay()
              if (!pending) return null
              return (
                <div style={{
                  marginBottom: 14, padding: '12px 14px', borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(245,158,11,0.08))',
                  border: '1.5px solid rgba(239,68,68,0.45)',
                  boxShadow: '0 6px 20px rgba(239,68,68,0.15)',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#f87171', marginBottom: 2 }}>
                    ⚠️ Unfinished payment of ₹{Number(pending.amount).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11.5, color: t.textSub, lineHeight: 1.5, marginBottom: 10 }}>
                    If money left your bank account, complete your receipt now. If you cancelled in the bank app, discard it — nothing was recorded.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => finalizeAutoPayment(pending)}
                      disabled={finalizingPay}
                      style={{ flex: 2, padding: '10px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 12.5, fontWeight: 900, cursor: finalizingPay ? 'wait' : 'pointer', opacity: finalizingPay ? 0.7 : 1 }}
                    >
                      {finalizingPay ? 'Saving…' : '✅ Complete My Receipt'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { clearPendingPay(); setFiredPlan(null); setShowPendingBanner(false) }}
                      style={{ flex: 1, padding: '10px', borderRadius: 11, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      onClick={() => setFailHelp(true)}
                      style={{ flex: 1, padding: '10px', borderRadius: 11, border: '1px solid rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.10)', color: '#fcd34d', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
                    >
                      Payment failed?
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Amount Label & Dynamic Editable Amount Box */}
            <div style={{
              background: t.inputBg, borderRadius: 16, padding: '14px 14px 12px',
              border: `1px solid ${t.inputBorder || t.border}`, marginBottom: 14, boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Payable Contribution
                </span>
                <span style={{ fontSize: 10, color: t.accent, fontWeight: 600 }}>
                  Tap amount to edit
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: t.accent, lineHeight: 1 }}>₹</span>
                <input
                  id="payerAmountInput"
                  name="payerAmount"
                  type="number"
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `1.5px dashed ${t.accent}`,
                    color: t.text,
                    fontSize: 28,
                    fontWeight: 800,
                    fontFamily: "'Playfair Display', serif",
                    width: '140px',
                    outline: 'none',
                    padding: '2px 4px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Quick Amount Selector Chips (Fit cleanly in grid) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginTop: 10 }}>
                {[500, 1000, 1500, 2000, 3000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(val.toString())}
                    style={{
                      padding: '5px 2px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 700,
                      border: `1px solid ${Number(amount) === val ? t.accent : t.border}`,
                      background: Number(amount) === val ? t.accentBg : t.inputBg,
                      color: Number(amount) === val ? t.accent : t.textSub,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                      boxSizing: 'border-box',
                      minWidth: 0
                    }}
                  >
                    ₹{val}
                  </button>
                ))}
              </div>
            </div>

            {/* ── MONTHLY DUES TRACKER (6-month strip + current-month due banner) ── */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Monthly Tracking
                </span>
                <span style={{ fontSize: 10, color: t.textSub }}>
                  ₹{Number(defaultDue).toFixed(2)}/month
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                {monthOptions.map(m => {
                  const st = monthStatusOf(m.key)
                  const paid = paidByMonth[m.key] || 0
                  const color = st === 'paid' ? '#34d399' : st === 'partial' ? '#fbbf24' : t.textSub
                  const bg = st === 'paid' ? t.successBg : st === 'partial' ? 'rgba(251,191,36,0.10)' : t.inputBg
                  return (
                    <div
                      key={m.key}
                      title={`${m.label}: ${st === 'paid' ? 'Paid' : st === 'partial' ? `₹${paid.toFixed(2)} paid` : 'Unpaid'}`}
                      style={{
                        padding: '7px 2px', borderRadius: 10, textAlign: 'center',
                        background: bg, border: `1.5px solid ${m.current ? t.accent : t.border}`,
                        boxShadow: m.current ? `0 0 0 1px ${t.accent}55` : 'none',
                        minWidth: 0
                      }}
                    >
                      <div style={{ fontSize: 9, fontWeight: 800, color: m.current ? t.accent : t.textSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.label.split(' ')[0]}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 900, color, lineHeight: 1.3 }}>
                        {st === 'paid' ? '✓' : st === 'partial' ? '◐' : '○'}
                      </div>
                    </div>
                  )
                })}
              </div>
              {currentBalance > 0 ? (
                <div style={{
                  marginTop: 8, padding: '10px 12px', borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(245,158,11,0.04))',
                  border: '1.5px solid rgba(245,158,11,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#fcd34d' }}>
                      {monthLabelOf(currentMonthKey)} dues pending
                    </div>
                    <div style={{ fontSize: 11, color: t.textSub }}>
                      Balance ₹{currentBalance.toFixed(2)}
                      {(paidByMonth[currentMonthKey] || 0) > 0 && ` (₹${Number(paidByMonth[currentMonthKey]).toFixed(2)} received)`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAmount(currentBalance.toFixed(2))
                      setPaymentMethodTab('instant')
                      setTimeout(() => handleLaunchPayment('upi', 0, currentBalance), 50)
                    }}
                    style={{
                      padding: '10px 16px', borderRadius: 11, border: 'none',
                      background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff',
                      fontSize: 12.5, fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap',
                      boxShadow: '0 4px 14px rgba(16,185,129,0.4)'
                    }}
                  >
                    Pay Balance
                  </button>
                </div>
              ) : (
                <div style={{
                  marginTop: 8, padding: '9px 12px', borderRadius: 12,
                  background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.35)',
                  fontSize: 12, fontWeight: 800, color: '#34d399', textAlign: 'center'
                }}>
                  ✅ {monthLabelOf(currentMonthKey)} contribution cleared — Shukran!
                </div>
              )}
            </div>

            {/* ── PAYMENT METHOD SELECTOR (Instant Pay + Scan QR) ── */}
            <div style={{
              display: 'flex',
              background: t.inputBg,
              padding: 3,
              borderRadius: 12,
              border: `1px solid ${t.inputBorder || t.border}`,
              marginBottom: 14,
              boxSizing: 'border-box'
            }}>
              <button
                type="button"
                onClick={() => setPaymentMethodTab('instant')}
                style={{
                  flex: 1,
                  padding: '7px 6px',
                  borderRadius: 9,
                  border: 'none',
                  background: paymentMethodTab === 'instant' ? t.accentBg : 'transparent',
                  color: paymentMethodTab === 'instant' ? t.accent : t.textSub,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  boxSizing: 'border-box',
                  minWidth: 0
                }}
              >
                <Sparkles size={12} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Instant Pay</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethodTab('qr')}
                style={{
                  flex: 1,
                  padding: '7px 6px',
                  borderRadius: 9,
                  border: 'none',
                  background: paymentMethodTab === 'qr' ? t.accentBg : 'transparent',
                  color: paymentMethodTab === 'qr' ? t.accent : t.textSub,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  boxSizing: 'border-box',
                  minWidth: 0
                }}
              >
                <QrCode size={12} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Scan QR</span>
              </button>
            </div>

            {/* ── METHOD 1: INSTANT APP PAY ── */}
            {paymentMethodTab === 'instant' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Receiver confirmation — member sees exactly where money goes */}
                <div style={{
                  background: t.inputBg, borderRadius: 12, padding: '10px 12px',
                  border: `1px solid ${t.inputBorder || t.border}`, boxSizing: 'border-box'
                }}>
                  <div style={{ fontSize: 9, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: 4 }}>
                    Paying securely to
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{payeeName}</div>
                      <div style={{ fontSize: 11.5, color: t.textSub, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isUpiIdValid ? configuredUpiId : '⚠️ Receiver UPI not configured'}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: t.accent, whiteSpace: 'nowrap' }}>
                      ₹{formattedAmount}
                    </div>
                  </div>
                </div>

                {needsSplit ? (
                  <div style={{
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)',
                    borderRadius: 12, padding: '10px 12px', fontSize: 11.5, color: '#fcd34d', lineHeight: 1.5
                  }}>
                    ⚠️ Dues exceed the ₹1,00,000 per-payment bank cap, so pay in {payParts.length} safe parts below. Each part opens prefilled and auto-generates its receipt.
                  </div>
                ) : null}

                {/* Primary Pay Button — generic UPI chooser, receiver + amount prefilled */}
                {needsSplit ? payParts.map((part, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={finalizingPay}
                    onClick={() => handleLaunchPayment('upi', i)}
                    style={{
                      width: '100%',
                      padding: '13px 16px',
                      borderRadius: 14,
                      border: activePart === i ? '2px solid #10b981' : 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                      color: '#ffffff',
                      fontSize: 15,
                      fontWeight: 800,
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)',
                      boxSizing: 'border-box'
                    }}
                  >
                    <CreditCard size={18} />
                    <span>Pay Part {i + 1}/{payParts.length} · ₹{Number(part).toFixed(2)}</span>
                    <ArrowUpRight size={16} />
                  </button>
                )) : (
                  <button
                    type="button"
                    disabled={finalizingPay}
                    onClick={() => handleLaunchPayment('upi')}
                    style={{
                      width: '100%',
                      opacity: finalizingPay ? 0.7 : 1,
                      padding: '13px 16px',
                      borderRadius: 14,
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                      color: '#ffffff',
                      fontSize: 15,
                      fontWeight: 800,
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)',
                      boxSizing: 'border-box'
                    }}
                  >
                    <CreditCard size={18} />
                    <span>Pay ₹{formattedAmount}</span>
                    <ArrowUpRight size={16} />
                  </button>
                )}
                <div style={{ fontSize: 10.5, color: t.textSub, textAlign: 'center', lineHeight: 1.5 }}>
                  Opens your UPI app with receiver &amp; amount already filled — just approve inside your bank app.
                  {' '}<button type="button" onClick={() => setShowRefundPolicy(true)} style={{ background: 'none', border: 'none', padding: 0, color: t.accent, fontSize: 10.5, fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>Refund Policy</button>
                </div>

                {/* Secondary Fast App Shortcuts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleLaunchPayment('gpay')}
                    style={{
                      padding: '8px 4px',
                      borderRadius: 10,
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#6ee7b7',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxSizing: 'border-box'
                    }}
                  >
                    GPay
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLaunchPayment('phonepe')}
                    style={{
                      padding: '8px 4px',
                      borderRadius: 10,
                      border: '1px solid rgba(103, 58, 183, 0.35)',
                      background: 'rgba(103, 58, 183, 0.12)',
                      color: '#c4b5fd',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxSizing: 'border-box'
                    }}
                  >
                    PhonePe
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLaunchPayment('paytm')}
                    style={{
                      padding: '8px 4px',
                      borderRadius: 10,
                      border: '1px solid rgba(0, 186, 242, 0.35)',
                      background: 'rgba(0, 186, 242, 0.12)',
                      color: '#7dd3fc',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxSizing: 'border-box'
                    }}
                  >
                    Paytm
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethodTab('qr')}
                    style={{
                      padding: '8px 4px',
                      borderRadius: 10,
                      border: `1px solid ${t.inputBorder || t.border}`,
                      background: t.inputBg,
                      color: t.text,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxSizing: 'border-box'
                    }}
                  >
                    Scan QR
                  </button>
                </div>
              </div>
            )}

            {/* ── METHOD 2: INLINE QR CODE ── */}
            {paymentMethodTab === 'qr' && (
              <div style={{
                background: t.inputBg, borderRadius: 16, padding: '14px',
                textAlign: 'center', border: `1px solid ${t.inputBorder || t.border}`, boxSizing: 'border-box'
              }}>
                {needsSplit ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 11.5, color: '#fcd34d', lineHeight: 1.5 }}>
                      ⚠️ Dues exceed the ₹1,00,000 bank cap — scan &amp; pay each part separately.
                    </div>
                    {payParts.map((part, i) => (
                      <div key={i}>
                        <div style={{
                          background: '#ffffff', padding: 12, borderRadius: 14,
                          display: 'inline-block', margin: '0 auto 8px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                        }}>
                          <QRCodeCanvas value={generateUpiUrl('upi', part)} size={160} level="H" />
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: t.accent, marginBottom: 2 }}>
                          Part {i + 1}/{payParts.length} · ₹{Number(part).toFixed(2)}
                        </div>
                        <div style={{ fontSize: 11, color: t.textSub, fontFamily: 'monospace', marginBottom: 6 }}>
                          {configuredUpiId}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div style={{
                      background: '#ffffff', padding: 12, borderRadius: 14,
                      display: 'inline-block', margin: '0 auto 8px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                    }}>
                      <QRCodeCanvas value={upiUrl} size={160} level="H" />
                    </div>

                    <div style={{ fontSize: 16, fontWeight: 800, color: t.accent, marginBottom: 2 }}>
                      ₹{formattedAmount}
                    </div>
                    <div style={{ fontSize: 11, color: t.textSub, fontFamily: 'monospace', marginBottom: 10 }}>
                      {configuredUpiId}
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => handleCopyUpi(true)}
                  style={{
                    width: '100%', padding: '8px', borderRadius: 10,
                    border: `1px solid ${t.inputBorder || t.border}`, background: t.inputBg,
                    color: t.text, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5
                  }}
                >
                  {copiedUpi ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
                  <span>{copiedUpi ? 'UPI ID Copied!' : 'Copy UPI ID'}</span>
                </button>
              </div>
            )}

            {/* Receipts auto-generate when you pay — nothing to type. */}
          </div>

          {/* Personal Transaction Tracking History */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: t.text, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>
              My Payment History
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: t.textSub, fontSize: 13 }}>
              Loading your payment records…
            </div>
          ) : myPayments.length === 0 ? (
            <div style={{ padding: '36px 20px', borderRadius: 18, background: t.card, border: `1px solid ${t.border}`, textAlign: 'center', boxSizing: 'border-box' }}>
              <Receipt size={36} color={t.accent} style={{ opacity: 0.5, marginBottom: 10 }} />
              <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: t.text }}>No payment records yet</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: t.textSub }}>
                Pay securely above — your receipt generates automatically and appears here.
              </p>
              <Btn primary onClick={() => handleLaunchPayment('upi')} style={{ padding: '10px 20px', fontSize: 13, display: 'inline-flex' }}>
                Pay Dues Now
              </Btn>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myPayments.map(p => {
                const isVerified = p.status === 'verified'
                const dateStr = new Date(p.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedReceipt(p)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 16,
                      background: t.card,
                      border: `1px solid ${t.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      cursor: 'pointer',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: isVerified ? 'rgba(52, 211, 153, 0.12)' : 'rgba(197, 160, 89, 0.12)',
                      border: `1px solid ${isVerified ? 'rgba(52, 211, 153, 0.3)' : 'rgba(197, 160, 89, 0.3)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {isVerified ? <ShieldCheck size={20} color="#34d399" /> : <Clock size={20} color={t.accent} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
                          ₹{parseFloat(p.amount).toLocaleString('en-IN')}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
                          padding: '2px 7px', borderRadius: 10,
                          background: isVerified ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                          color: isVerified ? '#34d399' : '#fbbf24',
                          border: `1px solid ${isVerified ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`
                        }}>
                          {isVerified ? 'Verified' : 'Submitted'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {dateStr} {p.transaction_ref && `• Ref: ${p.transaction_ref}`}
                      </div>
                      {p.metadata?.dispute?.status === 'open' ? (
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', marginTop: 3 }}>
                          ⚖️ Refund request under review
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); raiseDispute(p) }}
                          style={{ background: 'none', border: 'none', padding: '3px 0 0', color: t.textSub, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', opacity: 0.8 }}
                        >
                          Report an issue / request refund
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        title="Download PDF receipt"
                        aria-label="Download PDF receipt"
                        onClick={(e) => {
                          e.stopPropagation()
                          downloadPayslipPdf({
                            payment: p,
                            memberName: userProfile?.name || p.user_name,
                            thaliNumber: userProfile?.thali_number || p.thali_number,
                            payeeUpi: p.upi_id || configuredUpiId,
                            payeeName: p.payee_name || payeeName,
                            monthLabel: monthLabelOf(monthKeyOf(new Date(p.created_at))),
                          })
                        }}
                        style={{
                          background: t.accentBg, border: `1px solid ${t.accentBorder}`,
                          color: t.accent, borderRadius: 10, padding: '7px 8px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Download size={14} />
                      </button>
                      <span style={{ fontSize: 11, color: t.accent, fontWeight: 700 }}>Receipt</span>
                      <ChevronRight size={15} color={t.textSub} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── QR CODE MODAL (bottom sheet — PWA safe) ── */}
      {showQRModal && (
        <div
          onClick={() => setShowQRModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.card, borderRadius: '24px 24px 0 0',
              borderTop: `2px solid ${t.accent}`,
              maxWidth: 420, width: '100%', padding: '14px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
              textAlign: 'center', boxSizing: 'border-box',
              maxHeight: '92dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
            }}
          >
            <div style={{ width: 44, height: 4, borderRadius: 999, background: t.border, margin: '0 auto 14px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display', serif" }}>
                Scan to Pay via UPI
              </div>
              <button onClick={() => setShowQRModal(false)} style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#ffffff', padding: 16, borderRadius: 18, display: 'inline-block', margin: '0 auto 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
              <QRCodeCanvas value={firedPlan ? generateUpiUrl('upi', firedPlan.partAmount, { receiver: firedPlan.receiver, payee: firedPlan.payee, note: firedPlan.note, withTr: firedPlan.format === 'with-tr' }) : (needsSplit && payParts[activePart] != null ? generateUpiUrl('upi', payParts[activePart]) : upiUrl)} size={210} level="H" />
            </div>

            <div style={{ fontSize: 20, fontWeight: 800, color: t.accent, marginBottom: 2 }}>
              {firedPlan
                ? `₹${Number(firedPlan.partAmount).toFixed(2)}`
                : needsSplit && payParts[activePart] != null
                  ? `Part ${activePart + 1}/${payParts.length} · ₹${Number(payParts[activePart]).toFixed(2)}`
                  : `₹${formattedAmount}`}
            </div>
            <div style={{ fontSize: 11, color: t.textSub, fontFamily: 'monospace', marginBottom: 10 }}>
              → {firedPlan ? firedPlan.receiver : configuredUpiId}
            </div>
            {needsSplit && !firedPlan && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                {payParts.map((part, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActivePart(i)}
                    style={{
                      padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                      border: `1.5px solid ${activePart === i ? t.accent : t.border}`,
                      background: activePart === i ? t.accentBg : 'transparent',
                      color: activePart === i ? t.accent : t.textSub,
                    }}
                  >
                    Part {i + 1}
                  </button>
                ))}
              </div>
            )}

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: t.inputBg, padding: '5px 12px', borderRadius: 10,
              fontSize: 12, color: t.textSub, fontFamily: 'monospace', marginBottom: 12,
              border: `1px solid ${t.inputBorder || t.border}`
            }}>
              <span>{configuredUpiId}</span>
              <button
                onClick={() => handleCopyUpi(true)}
                style={{ background: 'transparent', border: 'none', color: t.accent, cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                title="Copy UPI ID"
              >
                {copiedUpi ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
              </button>
            </div>

            <div style={{
              background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.25)',
              borderRadius: 12, padding: '8px 12px', fontSize: 11, color: '#a7f3d0',
              lineHeight: 1.4, marginBottom: 16, textAlign: 'left'
            }}>
              ✨ <b>Tip:</b> Scanning QR or copying UPI directly in your app bypasses browser web-intent bank limit errors.
            </div>

            <Btn primary onClick={() => {
              // Paid via QR scan: finalize from the stashed attempt (or current amount).
              const pending = readPendingPay()
              if (pending && pending.amount > 0) {
                setShowQRModal(false)
                finalizeAutoPayment(pending)
              } else if (numericAmount > 0) {
                setShowQRModal(false)
                stashPendingPay({
                  amount: Number(numericAmount.toFixed(2)),
                  note: sanitizedNote,
                  upi: (configuredUpiId || '').trim(),
                  payee: (payeeName || 'Al-Mawaid').trim(),
                  month: monthKeyOf(new Date()),
                  launchedAt: Date.now(),
                })
                finalizeAutoPayment(readPendingPay())
              }
            }} disabled={finalizingPay} style={{ width: '100%', padding: '12px' }}>
              {finalizingPay ? 'Saving Receipt…' : '✅ I’ve Paid — Get My Receipt'}
            </Btn>
          </div>
        </div>
      )}

      {/* ── MANAGER MANUAL RECORD MODAL (bottom sheet; members never type UTR — receipts auto-generate) ── */}
      {showRecordModal && isManager && (
        <div
          onClick={() => setShowRecordModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.card, borderRadius: '24px 24px 0 0',
              borderTop: `2px solid ${t.accent}`,
              maxWidth: 460, width: '100%',
              maxHeight: '92dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              padding: '14px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ width: 44, height: 4, borderRadius: 999, background: t.border, margin: '0 auto 14px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display', serif" }}>
                  {selectedUserToPay ? `Record Payment for ${selectedUserToPay.name}` : "Record Payment Details"}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: t.textSub }}>
                  Manually record cash or direct bank transfer
                </p>
              </div>
              <button onClick={() => setShowRecordModal(false)} style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label htmlFor="recordAmountInput" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Amount Paid (₹) *
                </label>
                <input
                  id="recordAmountInput"
                  name="recordAmount"
                  type="number"
                  min="1"
                  step="any"
                  autoComplete="off"
                  required
                  value={recordAmount}
                  onChange={(e) => setRecordAmount(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 16, fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div>
                <label htmlFor="recordUtrInput" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  UPI Reference / UTR Number {isManager ? "(Optional)" : "(Optional)"}
                </label>
                <input
                  id="recordUtrInput"
                  name="recordUtr"
                  type="text"
                  autoComplete="off"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="e.g. 427819283921"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 14, fontFamily: 'monospace', outline: 'none' }}
                />
              </div>

              <div>
                <label htmlFor="recordNoteInput" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Remark / Note
                </label>
                <input
                  id="recordNoteInput"
                  name="recordNote"
                  type="text"
                  autoComplete="off"
                  value={recordNote}
                  onChange={(e) => setRecordNote(e.target.value)}
                  placeholder="e.g. Monthly Contribution"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 13, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowRecordModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
                <Btn primary type="submit" disabled={submittingRecord} style={{ flex: 1, padding: '12px' }}>
                  {submittingRecord ? 'Saving…' : 'Save Payment'}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── AUTO PAY-SLIP MODAL (bottom sheet — PWA safe, never cut off) ── */}
      {showSlipModal && lastSlip && (
        <div
          onClick={() => setShowSlipModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.card, borderRadius: '24px 24px 0 0',
              borderTop: `2px solid ${t.accent}`,
              maxWidth: 460, width: '100%',
              maxHeight: '92dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              padding: '14px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
              boxSizing: 'border-box',
              animation: 'slipUp 0.32s cubic-bezier(0.32,0.72,0,1)',
            }}
          >
            <style>{`@keyframes slipUp { from { transform: translateY(48px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
            <div style={{ width: 44, height: 4, borderRadius: 999, background: t.border, margin: '0 auto 14px' }} />
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%', margin: '0 auto 10px',
                background: 'linear-gradient(135deg,#10b981,#059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(16,185,129,0.4)'
              }}>
                <Check size={30} color="#fff" strokeWidth={3} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: t.text, fontFamily: "'Playfair Display', serif" }}>
                Payment Recorded
              </div>
              <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
                Receipt auto-generated · pending manager verification
              </div>
            </div>

            <div style={{
              marginTop: 14, borderRadius: 16, overflow: 'hidden',
              border: `1.5px solid ${t.accentBorder || t.border}`, boxSizing: 'border-box'
            }}>
              <div style={{ background: 'linear-gradient(135deg,#131b2e,#0a0e1a)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: t.accent }}>AL-MAWAID RECEIPT</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                    {new Date(lastSlip.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {new Date(lastSlip.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>₹{Number(lastSlip.amount).toFixed(2)}</div>
                  <div style={{
                    display: 'inline-block', fontSize: 9.5, fontWeight: 900, padding: '2px 8px', borderRadius: 999,
                    background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2
                  }}>
                    {String(lastSlip.status || 'submitted').toUpperCase()}
                  </div>
                </div>
              </div>
              <div style={{ background: t.bg, padding: '12px 16px' }}>
                {[
                  ['Member', userProfile?.name || lastSlip.user_name || '—'],
                  ...(userProfile?.thali_number || lastSlip.thali_number ? [['Thali', `#${userProfile?.thali_number || lastSlip.thali_number}`]] : []),
                  ['Paid To', `${lastSlip.payee_name || payeeName} · ${lastSlip.upi_id || configuredUpiId}`],
                  ['Reference', lastSlip.transaction_ref || '—'],
                  ...(lastSlip.note ? [['Remark', lastSlip.note]] : []),
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: `1px dashed ${t.border}`, fontSize: 12.5 }}>
                    <span style={{ color: t.textSub, fontWeight: 600, flexShrink: 0 }}>{k}</span>
                    <span style={{ color: t.text, fontWeight: 700, textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowSlipModal(false)}
                style={{ flex: 1, padding: '13px', borderRadius: 13, border: `1.5px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => downloadPayslipPdf({
                  payment: lastSlip,
                  memberName: userProfile?.name || lastSlip.user_name,
                  thaliNumber: userProfile?.thali_number || lastSlip.thali_number,
                  payeeUpi: lastSlip.upi_id || configuredUpiId,
                  payeeName: lastSlip.payee_name || payeeName,
                  monthLabel: monthLabelOf(monthKeyOf(new Date(lastSlip.created_at))),
                })}
                style={{
                  flex: 2, padding: '13px', borderRadius: 13, border: 'none',
                  background: 'linear-gradient(135deg,#B8860B,#D4AF37)', color: '#0a0a0a',
                  fontSize: 14, fontWeight: 900, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 6px 18px rgba(212,175,55,0.35)'
                }}
              >
                <Download size={16} /> Download PDF Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRE-PAY CONFIRM SHEET: exact receiver + amount before anything fires ── */}
      {confirmPay && (
        <div
          onClick={() => setConfirmPay(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.card, borderRadius: '24px 24px 0 0',
              borderTop: `2px solid ${t.accent}`,
              maxWidth: 460, width: '100%',
              maxHeight: '92dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              padding: '14px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ width: 44, height: 4, borderRadius: 999, background: t.border, margin: '0 auto 14px' }} />
            <div style={{ fontSize: 16, fontWeight: 900, color: t.text, textAlign: 'center' }}>
              Confirm Your Payment
            </div>
            <div style={{ fontSize: 11.5, color: t.textSub, textAlign: 'center', marginTop: 2, marginBottom: 12 }}>
              Check receiver &amp; amount — this exact request opens in your UPI app.
            </div>

            <div style={{ borderRadius: 14, overflow: 'hidden', border: `1.5px solid ${t.accentBorder || t.border}`, marginBottom: 12 }}>
              <div style={{ background: 'linear-gradient(135deg,#131b2e,#0a0e1a)', padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                  {confirmPay.partsCount > 1 ? `Part ${confirmPay.partIdx + 1} of ${confirmPay.partsCount}` : payeeName} · {confirmPay.payee}
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', margin: '2px 0' }}>
                  ₹{Number(confirmPay.partAmount).toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: t.accent, fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
                  → {confirmPay.receiver}
                </div>
              </div>
              <div style={{ background: t.inputBg, padding: '10px 14px', fontSize: 10.5, color: t.textSub, fontFamily: 'monospace', lineHeight: 1.7, overflowWrap: 'anywhere' }}>
                pa={confirmPay.receiver}<br />
                pn={confirmPay.payee}<br />
                am={Number(confirmPay.partAmount).toFixed(2)} · cu=INR<br />
                tn={confirmPay.note}
              </div>
            </div>

            <div style={{ fontSize: 11, color: t.textSub, lineHeight: 1.55, marginBottom: 12 }}>
              ⚠️ If your bank says <b>“limit exceeded” even for ₹1</b>, your bank&apos;s <b>daily UPI quota</b> (counted across all UPI apps) is likely exhausted — try another account in your UPI app, or pay after midnight.
            </div>

            <button
              type="button"
              onClick={() => firePayment(confirmPay)}
              style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer', boxShadow: '0 6px 18px rgba(16,185,129,0.35)', marginBottom: 8 }}
            >
              Pay ₹{Number(confirmPay.partAmount).toFixed(2)} in My UPI App
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => firePayment(confirmPay, { withTr: true })}
                style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1.5px solid ${t.accent}`, background: t.accentBg, color: t.accent, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
              >
                Try Alternate Format
              </button>
              {isFallbackValid && confirmPay.receiver !== fallbackUpiId.trim() && (
                <button
                  type="button"
                  onClick={() => firePayment(confirmPay, { receiverOverride: fallbackUpiId.trim() })}
                  style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1.5px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
                >
                  Use Alternate Receiver
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmPay(null)}
                style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT-FAILED DIAGNOSTICS SHEET ── */}
      {failHelp && (
        <div
          onClick={() => setFailHelp(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.card, borderRadius: '24px 24px 0 0',
              borderTop: '2px solid #ef4444',
              maxWidth: 460, width: '100%',
              maxHeight: '92dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              padding: '14px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ width: 44, height: 4, borderRadius: 999, background: t.border, margin: '0 auto 14px' }} />
            <div style={{ fontSize: 16, fontWeight: 900, color: t.text, textAlign: 'center' }}>
              Bank Rejected the Payment?
            </div>
            <div style={{ fontSize: 11.5, color: t.textSub, textAlign: 'center', marginTop: 2, marginBottom: 12 }}>
              {failPending ? `Attempted ₹${Number(failPending.amount).toFixed(2)} → ${failPending.upi || ''}` : 'Here is what usually causes it and what to do.'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {[
                ['🏦', 'Daily UPI quota exhausted (most common)', 'Your bank counts every UPI payment across ALL your apps (GPay, PhonePe, Paytm…). Once the daily quota is over, even ₹1 fails with “limit exceeded”. Fix: pay from a different bank account inside your UPI app, or retry after midnight.'],
                ['📥', 'Receiver daily collection cap', 'One UPI ID can only receive a fixed amount per day. When many members pay together, switch to the alternate receiver below.'],
                ['📲', 'Intent blocked by the app', 'Some bank apps reject direct deep-links. Use “Try alternate format”, or Scan QR from inside your UPI app instead.'],
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

            {failPending && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    const plan = {
                      appType: 'upi', partIdx: 0, total: failPending.amount, partAmount: failPending.amount,
                      partsCount: 1, receiver: failPending.upi, payee: failPending.payee, note: failPending.note,
                    }
                    firePayment(plan, { withTr: true })
                  }}
                  style={{ width: '100%', padding: '13px', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer' }}
                >
                  🔁 Retry in Alternate Format
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  {isFallbackValid && (failPending.upi || '') !== fallbackUpiId.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        const plan = {
                          appType: 'upi', partIdx: 0, total: failPending.amount, partAmount: failPending.amount,
                          partsCount: 1, receiver: failPending.upi, payee: failPending.payee, note: failPending.note,
                        }
                        firePayment(plan, { receiverOverride: fallbackUpiId.trim() })
                      }}
                      style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1.5px solid ${t.accent}`, background: t.accentBg, color: t.accent, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
                    >
                      Alternate Receiver
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setFailHelp(false); setShowQRModal(true) }}
                    style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1.5px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}
                  >
                    📷 Pay via QR
                  </button>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setFailHelp(false)}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── REFUND POLICY SHEET (bottom sheet — PWA safe) ── */}
      {showRefundPolicy && (
        <div
          onClick={() => setShowRefundPolicy(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.card, borderRadius: '24px 24px 0 0',
              borderTop: `2px solid ${t.accent}`,
              maxWidth: 460, width: '100%',
              maxHeight: '92dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              padding: '14px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ width: 44, height: 4, borderRadius: 999, background: t.border, margin: '0 auto 14px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: t.accentBg, border: `1px solid ${t.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={20} color={t.accent} />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 900, color: t.text, fontFamily: "'Playfair Display', serif" }}>
                  Payment Protection &amp; Refunds
                </div>
                <div style={{ fontSize: 11.5, color: t.textSub }}>
                  Every rupee is accounted — here is exactly what happens if anything goes wrong.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {[
                ['🛡️', 'Secured checkout', 'Every tap is validated before your bank app opens: correct receiver UPI ID, exact amount, and the ₹1,00,000 per-payment bank cap. Invalid or duplicate attempts are blocked on-device — a bad payment can never be fired.'],
                ['⏳', 'Failed or cancelled payments', 'If you cancel inside your bank app, or the app never opens, nothing is recorded and no dues change. An unfinished attempt stays recoverable for 30 minutes, then auto-discards.'],
                ['💸', 'Debited but no receipt?', 'Use “Complete My Receipt” on the safety banner, or tap “Report an issue / request refund” on the payment row. Your request goes straight to the management team with the amount, date and reference.'],
                ['↩️', 'Refund promise', 'Confirmed debits that didn’t reach Al-Mawaid are refunded to source or adjusted against next month’s dues within 7 working days of verification. Bank auto-reversals for failed UPI debits typically reflect in 3–5 working days on their own.'],
                ['🧾', 'Proof always kept', 'Every payment keeps a downloadable PDF receipt with reference number. Keep your bank UTR — it makes verification instant.'],
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

            <button
              type="button"
              onClick={() => setShowRefundPolicy(false)}
              style={{ width: '100%', marginTop: 16, padding: '13px', borderRadius: 13, border: 'none', background: t.accentGrad, color: '#0a0a0a', fontSize: 14, fontWeight: 900, cursor: 'pointer' }}
            >
              Got It — Pay Securely
            </button>
          </div>
        </div>
      )}

      {/* ── MANAGER CONFIG / SETTINGS MODAL ── */}
      {showSettingsModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{ background: t.card, borderRadius: 24, border: `1.5px solid ${t.accentBorder}`, maxWidth: 420, width: '100%', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display', serif" }}>
                Payment Configuration
              </h3>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label htmlFor="configDueInput" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Standard Due Amount (₹)
                </label>
                <input
                  id="configDueInput"
                  name="configDue"
                  type="number"
                  min="1"
                  step="any"
                  autoComplete="off"
                  required
                  value={defaultDue}
                  onChange={(e) => setDefaultDue(Number(e.target.value))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 15, fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div>
                <label htmlFor="configUpiInput" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Receiver UPI ID (VPA)
                </label>
                <input
                  id="configUpiInput"
                  name="configUpi"
                  type="text"
                  autoComplete="off"
                  required
                  value={configuredUpiId}
                  onChange={(e) => setConfiguredUpiId(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 14, fontFamily: 'monospace', outline: 'none' }}
                />
              </div>

              <div>
                <label htmlFor="configUpi2Input" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Alternate Receiver UPI ID (optional fallback)
                </label>
                <input
                  id="configUpi2Input"
                  name="configUpi2"
                  type="text"
                  autoComplete="off"
                  value={fallbackUpiId}
                  onChange={(e) => setFallbackUpiId(e.target.value)}
                  placeholder="Second VPA used when the primary hits its daily collection cap"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 14, fontFamily: 'monospace', outline: 'none' }}
                />
              </div>

              <div>
                <label htmlFor="configPayeeInput" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Payee / Business Name
                </label>
                <input
                  id="configPayeeInput"
                  name="configPayee"
                  type="text"
                  autoComplete="off"
                  required
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 14, outline: 'none' }}
                />
              </div>

              <div>
                <label htmlFor="configTitleInput" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Payment Cycle / Title
                </label>
                <input
                  id="configTitleInput"
                  name="configTitle"
                  type="text"
                  autoComplete="off"
                  required
                  value={paymentTitle}
                  onChange={(e) => setPaymentTitle(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 14, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowSettingsModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
                <Btn primary type="submit" style={{ flex: 1, padding: '12px' }}>
                  Save Settings
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DIGITAL RECEIPT VIEW MODAL (bottom sheet — PWA safe) ── */}
      {selectedReceipt && (
        <div
          onClick={() => setSelectedReceipt(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.card, borderRadius: '24px 24px 0 0',
              borderTop: `2px solid ${t.accent}`,
              maxWidth: 420, width: '100%',
              maxHeight: '92dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              padding: '14px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
              boxSizing: 'border-box', position: 'relative',
            }}
          >
            <div style={{ width: 44, height: 4, borderRadius: 999, background: t.border, margin: '0 auto 14px' }} />
            <button onClick={() => setSelectedReceipt(null)} style={{ position: 'absolute', top: 22, right: 18, background: t.inputBg, border: 'none', color: t.textSub, cursor: 'pointer', borderRadius: 8, padding: 4 }}>
              <X size={18} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <CheckCircle2 size={28} color="#fff" />
              </div>
              <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display', serif" }}>
                Payment Receipt
              </h3>
              <span style={{ fontSize: 11, color: t.textSub, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Al-Mawaid Portal
              </span>
            </div>

            <div style={{ background: t.inputBg, borderRadius: 16, padding: 16, border: `1px solid ${t.inputBorder || t.border}`, marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: t.textSub }}>Member</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{selectedReceipt.user_name || 'Member'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: t.textSub }}>Amount</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: t.accent }}>₹{parseFloat(selectedReceipt.amount).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: t.textSub }}>Status</span>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: selectedReceipt.status === 'verified' ? '#34d399' : '#fbbf24' }}>
                  {selectedReceipt.status === 'verified' ? 'Verified' : 'Submitted'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: t.textSub }}>Date</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
                  {new Date(selectedReceipt.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {selectedReceipt.thali_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: t.textSub }}>Thali #</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>#{selectedReceipt.thali_number}</span>
                </div>
              )}
              {selectedReceipt.transaction_ref && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: t.textSub }}>UTR / Ref #</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.text, fontFamily: 'monospace' }}>{selectedReceipt.transaction_ref}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn primary onClick={() => setSelectedReceipt(null)} style={{ flex: 1, padding: '12px' }}>
                Close
              </Btn>
              <button
                type="button"
                onClick={() => downloadPayslipPdf({
                  payment: selectedReceipt,
                  memberName: userProfile?.name || selectedReceipt.user_name,
                  thaliNumber: userProfile?.thali_number || selectedReceipt.thali_number,
                  payeeUpi: selectedReceipt.upi_id || configuredUpiId,
                  payeeName: selectedReceipt.payee_name || payeeName,
                  monthLabel: monthLabelOf(monthKeyOf(new Date(selectedReceipt.created_at))),
                })}
                style={{
                  flex: 1.4, padding: '12px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg,#B8860B,#D4AF37)', color: '#0a0a0a',
                  fontSize: 13.5, fontWeight: 900, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 6px 18px rgba(212,175,55,0.35)'
                }}
              >
                <Download size={15} /> PDF Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FULLY CONTROLLABLE NOTIFICATION MODAL (For Mulla Murtaza Hamid) ── */}
      {showNotifyModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: t.card,
            borderRadius: 24,
            border: `1.5px solid ${t.accentBorder}`,
            maxWidth: 460, width: '100%',
            padding: 24,
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.accent, background: t.accentBg, padding: '2px 8px', borderRadius: 10, border: `1px solid ${t.accentBorder}` }}>
                    📢 Custom Alert Dispatch
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display', serif" }}>
                  {notifyTargetUser ? `Send Reminder to ${notifyTargetUser.name}` : `Notify All Active Unpaid Members (${managerMetrics.unpaidCount})`}
                </h3>
              </div>
              <button
                onClick={() => setShowNotifyModal(false)}
                style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Template Selector */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.textSub, marginBottom: 6 }}>
                Choose Template Preset
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'standard', label: 'Standard Reminder' },
                  { id: 'urgent', label: 'Urgent ⚠️' },
                  { id: 'final', label: 'Final Notice 🔔' }
                ].map(temp => (
                  <button
                    key={temp.id}
                    type="button"
                    onClick={() => handleSelectTemplate(temp.id)}
                    style={{
                      padding: '6px 11px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 700,
                      border: notifyTemplate === temp.id ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
                      background: notifyTemplate === temp.id ? t.accentBg : 'rgba(255,255,255,0.04)',
                      color: notifyTemplate === temp.id ? t.accent : t.textSub,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {temp.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendCustomNotification} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label htmlFor="notifyTitleInput" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Notification Title *
                </label>
                <input
                  id="notifyTitleInput"
                  name="notifyTitle"
                  type="text"
                  autoComplete="off"
                  required
                  value={notifyTitle}
                  onChange={(e) => setNotifyTitle(e.target.value)}
                  placeholder="e.g. Thali Contribution Reminder"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '11px 13px',
                    borderRadius: 12,
                    border: `1px solid ${t.border}`,
                    background: t.bg,
                    color: t.text,
                    fontSize: 14,
                    fontWeight: 700,
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label htmlFor="notifyBodyInput" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Message Content *
                </label>
                <textarea
                  id="notifyBodyInput"
                  name="notifyBody"
                  autoComplete="off"
                  required
                  rows={4}
                  value={notifyBody}
                  onChange={(e) => {
                    setNotifyBody(e.target.value)
                    setNotifyTemplate('custom')
                  }}
                  placeholder="Write message to appear in member's app and notifications…"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '11px 13px',
                    borderRadius: 12,
                    border: `1px solid ${t.border}`,
                    background: t.bg,
                    color: t.text,
                    fontSize: 13,
                    lineHeight: 1.5,
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Delivery Channels Info */}
              <div style={{
                background: 'rgba(0,0,0,0.25)',
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 11,
                color: t.textSub,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <Sparkles size={14} color={t.accent} style={{ flexShrink: 0 }} />
                <span>
                  Delivers as live in-app toast, unread badge notification, and push alert to member{notifyTargetUser ? '' : 's'}.
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowNotifyModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 12,
                    border: `1px solid ${t.border}`,
                    background: 'transparent',
                    color: t.textSub,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <Btn
                  primary
                  type="submit"
                  disabled={bulkNotifying}
                  style={{ flex: 1.5, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Send size={15} />
                  <span>{bulkNotifying ? 'Dispatching…' : 'Send Notification'}</span>
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}



