// ═════════════════════════════════════════════════════════════════════════════
// AL-MAWAID — Dues & Payments Management Hub
//
// Features:
// 1. Native NPCI UPI Split & Collection Card (Dynamic QR, 1-Tap Pay, Save QR to Gallery, 12-digit UTR Verification)
// 2. Management Portal with Multiple Selection (Checkboxes, Select All, Bulk Cash, Bulk Paid, Bulk Unpaid)
// 3. Quick Row Actions: CASH 💵, PAID ✅, UNPAID 🔄, Forfeit, WhatsApp, In-App Alert
// 4. Automated 25th of Month Dues Cycle: Auto-runs on 25th + Manual "Run 25th Cycle Now" button
// 5. Clean, modular, duplicate-free architecture with PDF receipts download
// ═════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  CreditCard, CheckCircle2, Check, QrCode, Receipt, ShieldCheck,
  Clock, RefreshCw, AlertCircle, Sparkles, ChevronRight, X, Download,
  ArrowLeft, Info, Send, Users, Search, Filter, MessageSquare, Phone,
  CheckSquare, Square, Edit3, SlidersHorizontal, BellRing, Eye, EyeOff,
  UserX, UserCheck, ToggleLeft, ToggleRight, Smartphone, Copy, Play, Zap, Banknote
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/firebaseClient'
import { useAuth, useTheme } from '../../admin/context'
import { BackHeader, Card, Btn, EmptyState } from '../ui'
import { downloadPayslipPdf } from '../../lib/payslipPdf'
import GooglePayStandeeCard, { generateUpiString } from '../GooglePayStandeeCard'

// ── Reusable Utilities ──
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const monthLabelOf = (key) => {
  try {
    const [y, m] = key.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  } catch { return key }
}
const formatInr = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const isValidVpa = (v) => /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test((v || '').trim())

// Native Capacitor / Web UPI App Launcher
const launchUpiApp = async (uri) => {
  if (typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()) {
    try {
      const { AppLauncher } = await import('@capacitor/app-launcher')
      const { completed } = await AppLauncher.openUrl({ url: uri })
      if (completed) return true
    } catch (err) {
      console.warn('[PaymentsPage] Native AppLauncher error, falling back to web:', err)
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

export default function PaymentsPage({ onBack, appSettings = {} }) {
  const t = useTheme()
  const { user } = useAuth()

  // ── Configuration State ──
  const [configuredUpiId, setConfiguredUpiId] = useState(appSettings.upi_id || '6375250267@okbizaxis')
  const [fallbackUpiId, setFallbackUpiId] = useState(appSettings.upi_id_2 || '')
  const [merchantCode, setMerchantCode] = useState(appSettings.upi_mc || '5812')
  const [payeeName, setPayeeName] = useState(appSettings.upi_payee_name || 'Al Mawaid')
  const [defaultDue, setDefaultDue] = useState(Number(appSettings.default_payment_due || 1500))
  const [paymentTitle, setPaymentTitle] = useState(appSettings.payment_title || 'Monthly Thali Contribution')
  const [isPaymentActive, setIsPaymentActive] = useState(appSettings.payment_enabled !== 'false')
  const [lastAutoCycleMonth, setLastAutoCycleMonth] = useState(appSettings.last_auto_dues_cycle_month || '')
  const [lastAutoCycleRun, setLastAutoCycleRun] = useState(appSettings.last_auto_dues_cycle_run || '')

  // ── User & Role State ──
  const [userProfile, setUserProfile] = useState(null)
  const [isManager, setIsManager] = useState(false)
  const [portalMode, setPortalMode] = useState('payer') // 'manager' | 'payer'

  // ── Data State ──
  const [myPayments, setMyPayments] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [allPayments, setAllPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // ── Multiple Selection State (Manager) ──
  const [selectedUserIds, setSelectedUserIds] = useState(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [bulkAmount, setBulkAmount] = useState(String(defaultDue || 1500))

  // ── Per-Member Row Custom Payment Amount State (Manager) ──
  const [rowAmounts, setRowAmounts] = useState({})
  const [dueInput, setDueInput] = useState(String(defaultDue || 1500))
  const [savingDue, setSavingDue] = useState(false)

  // ── Payer Split & UPI Form State ──
  const [payerAmount, setPayerAmount] = useState(String(defaultDue || 1500))
  const [payerAmountCustom, setPayerAmountCustom] = useState(false)
  const [payerUtr, setPayerUtr] = useState('')
  const [submittingPayerUtr, setSubmittingPayerUtr] = useState(false)
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [openingUpi, setOpeningUpi] = useState(false)
  const [showRefundPolicy, setShowRefundPolicy] = useState(false)

  // ── Manager Filter & Search State ──
  const [managerSearch, setManagerSearch] = useState('')
  const [managerFilter, setManagerFilter] = useState('all') // 'all' | 'unpaid' | 'paid' | 'submitted' | 'forfeit'
  const [runningAutoCycle, setRunningAutoCycle] = useState(false)

  // ── Modals State ──
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [selectedUserToRecord, setSelectedUserToRecord] = useState(null)
  const [recordAmount, setRecordAmount] = useState('')
  const [recordUtr, setRecordUtr] = useState('')
  const [recordMethod, setRecordMethod] = useState('Cash') // 'Cash' | 'UPI Pay'
  const [recordNote, setRecordNote] = useState('')
  const [submittingRecord, setSubmittingRecord] = useState(false)

  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [notifyTargetUser, setNotifyTargetUser] = useState(null) // null = all unpaid, or user object
  const [notifyTitle, setNotifyTitle] = useState('Thali Contribution Reminder')
  const [notifyBody, setNotifyBody] = useState('')
  const [notifyTemplate, setNotifyTemplate] = useState('standard')
  const [bulkNotifying, setBulkNotifying] = useState(false)

  // Sync settings when parent or realtime updates
  useEffect(() => {
    if (appSettings.upi_id) setConfiguredUpiId(appSettings.upi_id)
    if (appSettings.upi_id_2 !== undefined) setFallbackUpiId(appSettings.upi_id_2 || '')
    if (appSettings.upi_mc !== undefined) setMerchantCode(appSettings.upi_mc || '')
    if (appSettings.upi_payee_name) setPayeeName(appSettings.upi_payee_name)
    if (appSettings.default_payment_due) {
      const due = Number(appSettings.default_payment_due)
      setDefaultDue(due)
      setPayerAmount(String(due))
    }
    if (appSettings.payment_title) setPaymentTitle(appSettings.payment_title)
    if (appSettings.payment_enabled !== undefined) setIsPaymentActive(appSettings.payment_enabled !== 'false')
    if (appSettings.last_auto_dues_cycle_month) setLastAutoCycleMonth(appSettings.last_auto_dues_cycle_month)
    if (appSettings.last_auto_dues_cycle_run) setLastAutoCycleRun(appSettings.last_auto_dues_cycle_run)
  }, [appSettings])

  // Check if current user has manager privilege (Mulla Murtaza Mohammadhussain Hamid or Admin)
  const checkManagerStatus = useCallback((profile) => {
    if (!profile) return false
    const name = (profile.name || '').toLowerCase()
    const email = (profile.email || '').toLowerCase()
    const role = (profile.role || '').toLowerCase()
    const isMurtaza = name.includes('murtaza') || name.includes('hamid') || email.includes('murtaza')
    const hasAdminRole = role === 'admin' || role === 'supervisor' || role === 'payment_manager'
    return isMurtaza || hasAdminRole
  }, [])

  // ── Load User & Payment Data ──
  const loadData = useCallback(async () => {
    if (!user?.id) return
    try {
      // 1. Current user stats
      const { data: stats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      let mgrFlag = false
      if (stats) {
        setUserProfile(stats)
        mgrFlag = checkManagerStatus(stats)
        setIsManager(mgrFlag)
        if (mgrFlag && portalMode === 'payer') {
          setPortalMode('manager')
        }
      }

      // 2. Personal payment history
      const { data: myHist } = await supabase
        .from('user_payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (myHist) setMyPayments(myHist)

      // 3. Global App Settings (Rates, UPI, Due, etc.)
      const { data: globalSettings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'default_payment_due',
          'payment_title',
          'payment_enabled',
          'upi_id',
          'upi_id_2',
          'upi_mc',
          'upi_payee_name',
          'last_auto_dues_cycle_month',
          'last_auto_dues_cycle_run'
        ])

      if (globalSettings) {
        globalSettings.forEach(s => {
          if (s.key === 'default_payment_due' && s.value) {
            const d = Number(s.value)
            if (d > 0) {
              setDefaultDue(d)
              setDueInput(String(d))
              setBulkAmount(String(d))
            }
          }
          if (s.key === 'payment_title' && s.value) setPaymentTitle(s.value)
          if (s.key === 'payment_enabled' && s.value) setIsPaymentActive(s.value !== 'false')
          if (s.key === 'upi_id' && s.value) setConfiguredUpiId(s.value)
          if (s.key === 'upi_id_2' && s.value !== undefined) setFallbackUpiId(s.value)
          if (s.key === 'upi_mc' && s.value) setMerchantCode(s.value)
          if (s.key === 'upi_payee_name' && s.value) setPayeeName(s.value)
          if (s.key === 'last_auto_dues_cycle_month') setLastAutoCycleMonth(s.value)
          if (s.key === 'last_auto_dues_cycle_run') setLastAutoCycleRun(s.value)
        })
      }

      // 4. If manager, load all users & payments
      if (mgrFlag) {
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
      console.error('[PaymentsPage] loadData error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id, checkManagerStatus, portalMode])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Current Month Calculation & Personal Balance ──
  const currentMonthKey = monthKeyOf(new Date())
  const currentMonthLabel = monthLabelOf(currentMonthKey)

  const monthOptions = useMemo(() => {
    const list = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const k = monthKeyOf(d)
      list.push({ key: k, label: monthLabelOf(k), current: i === 0 })
    }
    return list
  }, [])

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

  const currentMonthPaid = paidByMonth[currentMonthKey] || 0
  const currentBalance = Math.max(0, Number((defaultDue - currentMonthPaid).toFixed(2)))

  // Auto-sync payerAmount with remaining balance unless user entered a custom amount
  useEffect(() => {
    if (!payerAmountCustom) {
      if (currentBalance > 0) {
        setPayerAmount(String(currentBalance))
      } else {
        setPayerAmount(String(defaultDue))
      }
    }
  }, [currentBalance, defaultDue, payerAmountCustom])

  // Helpers: per-member row custom amount in Manager portal
  const getMemberRowAmount = useCallback((member) => {
    if (rowAmounts[member.user_id] !== undefined) {
      return rowAmounts[member.user_id]
    }
    if (member.currentMonthPayment?.amount && Number(member.currentMonthPayment.amount) > 0) {
      return String(member.currentMonthPayment.amount)
    }
    return String(defaultDue || 1500)
  }, [rowAmounts, defaultDue])

  const setMemberRowAmount = useCallback((userId, val) => {
    setRowAmounts(prev => ({ ...prev, [userId]: val }))
  }, [])

  // ── Save Global Monthly Thali Due Rate ──
  const handleSaveDueRate = async () => {
    const val = parseFloat(dueInput)
    if (!val || val <= 0) {
      toast.error('Please enter a valid monthly rate amount')
      return
    }
    setSavingDue(true)
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'default_payment_due', value: String(val) })
      if (error) throw error

      setDefaultDue(val)
      if (!payerAmountCustom) {
        setPayerAmount(String(val))
      }
      toast.success(`Standard monthly due rate saved: ₹${formatInr(val)} per member!`)
    } catch (err) {
      console.error('[handleSaveDueRate] error:', err)
      toast.error('Failed to update due rate')
    } finally {
      setSavingDue(false)
    }
  }

  // Payer's latest payment for the current month
  const currentMonthMyPayment = useMemo(() => {
    return (myPayments || []).find(p => p?.created_at && monthKeyOf(new Date(p.created_at)) === currentMonthKey)
  }, [myPayments, currentMonthKey])

  // ── Automated 25th of Month Dues Engine ──
  // Runs automatically when date is 25th or later in the month and this month's cycle hasn't been executed
  const execute25thAutoCycle = useCallback(async (isManualTrigger = false) => {
    if (runningAutoCycle) return
    setRunningAutoCycle(true)
    try {
      // 1. Fetch active, non-exempt members
      const { data: members, error: memErr } = await supabase
        .from('user_stats')
        .select('user_id, name, thali_number')
        .eq('payment_exempt', false)
      if (memErr) throw memErr

      // 2. Fetch payments for this calendar month to identify who has not paid
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const { data: monthPays, error: payErr } = await supabase
        .from('user_payments')
        .select('user_id')
        .gte('created_at', monthStart)
      if (payErr) throw payErr

      const paidSet = new Set((monthPays || []).map(p => p.user_id))
      const unpaidMembers = (members || []).filter(m => !paidSet.has(m.user_id))

      if (unpaidMembers.length === 0) {
        if (isManualTrigger) toast.success(`All active members are already cleared for ${currentMonthLabel}!`)
      } else {
        // 3. Dispatch monthly dues reminders to notices
        const notices = unpaidMembers.map(m => ({
          target_user_id: m.user_id,
          title: `Thali Contribution Due — ${currentMonthLabel}`,
          body: `Dear ${m.name || 'Member'}, your monthly contribution of ₹${defaultDue} for ${currentMonthLabel} is due. Please pay securely via UPI.`,
          message: `Your contribution of ₹${defaultDue} for ${currentMonthLabel} is pending.`,
          sender_name: 'Al-Mawaid Dues',
          tone: '#f59e0b',
          type: 'reminder',
          url: '/pay',
          created_at: new Date().toISOString()
        }))

        // Chunk inserts to avoid Supabase limits
        for (let i = 0; i < notices.length; i += 50) {
          await supabase.from('notices').insert(notices.slice(i, i + 50))
        }

        toast.success(`⚡ 25th Auto-Cycle dispatched reminders to ${unpaidMembers.length} active unpaid members!`)
      }

      // 4. Record last_auto_dues_cycle in app_settings
      const nowIso = new Date().toISOString()
      await Promise.all([
        supabase.from('app_settings').upsert({ key: 'last_auto_dues_cycle_month', value: currentMonthKey }),
        supabase.from('app_settings').upsert({ key: 'last_auto_dues_cycle_run', value: nowIso })
      ])
      setLastAutoCycleMonth(currentMonthKey)
      setLastAutoCycleRun(nowIso)
    } catch (e) {
      console.error('[25th-Auto-Cycle] error:', e)
      if (isManualTrigger) toast.error('Could not run 25th Auto-Cycle. Please check connection.')
    } finally {
      setRunningAutoCycle(false)
    }
  }, [runningAutoCycle, currentMonthLabel, currentMonthKey, defaultDue])

  // Trigger 25th auto-cycle automatically on page mount if today >= 25th and not yet run this month
  useEffect(() => {
    if (loading || !isManager) return
    const todayDate = new Date().getDate()
    if (todayDate >= 25 && lastAutoCycleMonth !== currentMonthKey) {
      console.info(`[Auto-Cycle] Running 25th monthly dues cycle for ${currentMonthKey}...`)
      execute25thAutoCycle(false)
    }
  }, [loading, isManager, lastAutoCycleMonth, currentMonthKey, execute25thAutoCycle])

  // ── Dynamic UPI String for Payer ──
  const activePayAmount = Math.max(1, parseFloat(payerAmount) || currentBalance || defaultDue)
  const upiUri = useMemo(() => {
    return generateUpiString({
      upiId: configuredUpiId,
      payeeName: 'MURTUJA', // Bank KYC registered name matching Axis Bank records (prevents NPCI name-mismatch phishing blocks)
      amount: activePayAmount,
      note: `${paymentTitle} - ${userProfile?.name || 'Member'} ${userProfile?.thali_number ? `(#${userProfile.thali_number})` : ''}`,
      mc: merchantCode,
      tr: 'BCR2DN7TTKH2LLQF'
    })
  }, [configuredUpiId, activePayAmount, paymentTitle, userProfile, merchantCode])

  // ── Copy UPI ID ──
  const handleCopyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(configuredUpiId)
      setCopiedUpi(true)
      toast.success('UPI ID copied to clipboard!')
      setTimeout(() => setCopiedUpi(false), 2500)
    } catch {
      toast('Copied! Paste inside your UPI app.', { icon: '📋' })
    }
  }

  // ── Save QR Code to Gallery ──
  const handleSaveQrToGallery = () => {
    const canvas = document.getElementById('al-mawaid-payer-qr')
    if (!canvas) {
      toast.error('QR Code not ready yet.')
      return
    }
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `AlMawaid-UPI-QR-${activePayAmount}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast.success('QR saved to Downloads / Gallery! Open GPay/PhonePe and tap "Upload from Gallery".')
    } catch (e) {
      console.error('Download QR error:', e)
      toast.error('Could not save QR code automatically.')
    }
  }

  // ── 1-Tap Pay Button Handler ──
  const handle1TapPay = async () => {
    if (!isPaymentActive) {
      toast.error('Payments are temporarily paused by management.')
      return
    }
    setOpeningUpi(true)
    const success = await launchUpiApp(upiUri)
    setOpeningUpi(false)
    if (!success) {
      toast.error('Could not open UPI app directly. Please scan or save the QR code.')
    }
  }

  // ── Member Submit UTR / Mark as Paid ──
  const handleMemberSubmitUtr = async (e) => {
    e.preventDefault()
    const cleanUtr = payerUtr.trim()
    if (!cleanUtr || cleanUtr.length < 4) {
      toast.error('Please enter the UPI Reference / UTR Number (at least 4 digits)')
      return
    }

    setSubmittingPayerUtr(true)
    try {
      const payload = {
        user_id: user.id,
        user_name: userProfile?.name || user?.email?.split('@')[0] || 'Member',
        user_email: userProfile?.email || user?.email || '',
        thali_number: userProfile?.thali_number ? String(userProfile.thali_number) : '',
        amount: activePayAmount,
        currency: 'INR',
        status: 'submitted', // Under review by manager
        transaction_ref: cleanUtr,
        upi_id: configuredUpiId,
        payee_name: payeeName,
        payment_method: 'UPI Pay',
        note: `${paymentTitle} - Member UTR Submission`,
        created_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('user_payments')
        .insert([payload])
        .select()
        .single()

      if (error) throw error

      toast.success('UTR submitted! Your payment is marked "Under Review" pending manager verification.')
      setMyPayments(prev => [data, ...prev])
      setPayerUtr('')
    } catch (err) {
      console.error('[handleMemberSubmitUtr] error:', err)
      toast.error('Failed to submit UTR. Please check your connection.')
    } finally {
      setSubmittingPayerUtr(false)
    }
  }

  // ── Manager Metrics ──
  const managerMetrics = useMemo(() => {
    const totalUsers = allUsers.length
    const forfeitUsers = allUsers.filter(u => u.payment_exempt)
    const activeMembers = allUsers.filter(u => !u.payment_exempt)

    // Current month payments using reliable monthKeyOf
    const currentMonthPayments = allPayments.filter(p => p.created_at && monthKeyOf(new Date(p.created_at)) === currentMonthKey)
    const verifiedPayments = currentMonthPayments.filter(p => p.status === 'verified')
    const verifiedUserIds = new Set(verifiedPayments.map(p => p.user_id))
    const submittedUserIds = new Set(currentMonthPayments.filter(p => p.status === 'submitted').map(p => p.user_id))

    const cashUserIds = new Set(verifiedPayments.filter(p => p.payment_method === 'Cash' || p.transaction_ref === 'CASH').map(p => p.user_id))
    const upiPaidUserIds = new Set(verifiedPayments.filter(p => !(p.payment_method === 'Cash' || p.transaction_ref === 'CASH')).map(p => p.user_id))

    const cashCount = activeMembers.filter(u => cashUserIds.has(u.user_id)).length
    const upiCount = activeMembers.filter(u => upiPaidUserIds.has(u.user_id) && !cashUserIds.has(u.user_id)).length
    const paidCount = cashCount + upiCount
    const submittedCount = activeMembers.filter(u => submittedUserIds.has(u.user_id) && !verifiedUserIds.has(u.user_id)).length
    const unpaidCount = Math.max(0, activeMembers.length - paidCount - submittedCount)

    const totalAmountCollected = verifiedPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    const cashAmountCollected = verifiedPayments.filter(p => p.payment_method === 'Cash' || p.transaction_ref === 'CASH').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    const upiAmountCollected = totalAmountCollected - cashAmountCollected

    return {
      totalUsers,
      activeCount: activeMembers.length,
      paidCount,
      cashCount,
      upiCount,
      submittedCount,
      unpaidCount,
      forfeitCount: forfeitUsers.length,
      totalAmountCollected,
      cashAmountCollected,
      upiAmountCollected,
      totalAmountPending: unpaidCount * defaultDue
    }
  }, [allUsers, allPayments, defaultDue, currentMonthKey])

  // ── Filtered Users List with Computed Status ──
  const filteredUsersList = useMemo(() => {
    return allUsers.map(u => {
      const userPayments = allPayments.filter(p => p.user_id === u.user_id)
      // Strictly match current calendar month
      const monthPayments = userPayments.filter(p => p.created_at && monthKeyOf(new Date(p.created_at)) === currentMonthKey)
      // Sort newest first
      monthPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      // Prioritize verified payment if any exists, then submitted payment, then latest
      const verifiedPayment = monthPayments.find(p => p.status === 'verified')
      const submittedPayment = monthPayments.find(p => p.status === 'submitted')
      const currentMonthPayment = verifiedPayment || submittedPayment || monthPayments[0] || null

      const isCash = !!currentMonthPayment && (currentMonthPayment.payment_method === 'Cash' || currentMonthPayment.transaction_ref === 'CASH')

      let status = 'unpaid'
      if (u.payment_exempt) {
        status = 'forfeit'
      } else if (currentMonthPayment) {
        if (currentMonthPayment.status === 'verified') {
          status = isCash ? 'cash' : 'paid'
        } else if (currentMonthPayment.status === 'submitted') {
          status = 'submitted'
        }
      }

      return {
        ...u,
        payments: userPayments,
        currentMonthPayment,
        latestPayment: userPayments[0],
        status,
        isCash
      }
    }).filter(u => {
      if (managerFilter === 'cash' && u.status !== 'cash') return false
      if (managerFilter === 'paid' && u.status !== 'paid' && u.status !== 'cash') return false
      if (managerFilter === 'upipaid' && u.status !== 'paid') return false
      if (managerFilter === 'unpaid' && u.status !== 'unpaid') return false
      if (managerFilter === 'submitted' && u.status !== 'submitted') return false
      if (managerFilter === 'forfeit' && u.status !== 'forfeit') return false

      if (managerSearch.trim()) {
        const q = managerSearch.toLowerCase()
        const nameMatch = (u.name || '').toLowerCase().includes(q)
        const thaliMatch = String(u.thali_number || '').includes(q)
        const phoneMatch = String(u.phone || '').includes(q)
        return nameMatch || thaliMatch || phoneMatch
      }
      return true
    })
  }, [allUsers, allPayments, managerFilter, managerSearch, currentMonthKey])

  // ── Multi-Select Actions ──
  const allFilteredIds = useMemo(() => filteredUsersList.map(u => u.user_id), [filteredUsersList])
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedUserIds.has(id))

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds(new Set())
    } else {
      setSelectedUserIds(new Set(allFilteredIds))
    }
  }

  const toggleSelectMember = (userId) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  // ── Bulk Mark as CASH ──
  const handleBulkMarkCash = async () => {
    if (selectedUserIds.size === 0) return
    const count = selectedUserIds.size
    const amt = parseFloat(bulkAmount) || defaultDue
    if (!window.confirm(`Mark ${count} selected members as PAID by CASH (₹${formatInr(amt)} each = ₹${formatInr(count * amt)})?`)) return

    setBulkProcessing(true)
    try {
      const selectedMembers = allUsers.filter(u => selectedUserIds.has(u.user_id))
      const nowIso = new Date().toISOString()
      const targetIds = Array.from(selectedUserIds)

      // Clean up previous records for this month for these users to prevent duplicate rows
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      await supabase
        .from('user_payments')
        .delete()
        .in('user_id', targetIds)
        .gte('created_at', monthStart)

      const records = selectedMembers.map(u => ({
        user_id: u.user_id,
        user_name: u.name || 'Member',
        user_email: u.email || '',
        thali_number: u.thali_number ? String(u.thali_number) : '',
        amount: amt,
        currency: 'INR',
        status: 'verified',
        transaction_ref: 'CASH',
        upi_id: configuredUpiId,
        payee_name: payeeName,
        payment_method: 'Cash',
        note: `${paymentTitle} - Cash Payment`,
        created_at: nowIso
      }))

      const { data, error } = await supabase.from('user_payments').insert(records).select()
      if (error) throw error

      toast.success(`Successfully marked ${count} members as PAID by Cash (₹${formatInr(amt)} each)!`)
      setSelectedUserIds(new Set())
      // Immediately reflect in state: replace any month payments for these targets
      setAllPayments(prev => [
        ...(data || []),
        ...prev.filter(p => !(targetIds.includes(p.user_id) && monthKeyOf(new Date(p.created_at)) === currentMonthKey))
      ])
    } catch (err) {
      console.error('[BulkMarkCash] error:', err)
      toast.error('Bulk update failed. Please retry.')
    } finally {
      setBulkProcessing(false)
    }
  }

  // ── Bulk Mark as PAID (UPI / Online) ──
  const handleBulkMarkPaid = async () => {
    if (selectedUserIds.size === 0) return
    const count = selectedUserIds.size
    const amt = parseFloat(bulkAmount) || defaultDue
    if (!window.confirm(`Mark ${count} selected members as VERIFIED PAID via UPI (₹${formatInr(amt)} each = ₹${formatInr(count * amt)})?`)) return

    setBulkProcessing(true)
    try {
      const selectedMembers = allUsers.filter(u => selectedUserIds.has(u.user_id))
      const nowIso = new Date().toISOString()
      const targetIds = Array.from(selectedUserIds)

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      await supabase
        .from('user_payments')
        .delete()
        .in('user_id', targetIds)
        .gte('created_at', monthStart)

      const records = selectedMembers.map(u => ({
        user_id: u.user_id,
        user_name: u.name || 'Member',
        user_email: u.email || '',
        thali_number: u.thali_number ? String(u.thali_number) : '',
        amount: amt,
        currency: 'INR',
        status: 'verified',
        transaction_ref: 'VERIFIED_BY_ADMIN',
        upi_id: configuredUpiId,
        payee_name: payeeName,
        payment_method: 'UPI Pay',
        note: `${paymentTitle} - Verified Online`,
        created_at: nowIso
      }))

      const { data, error } = await supabase.from('user_payments').insert(records).select()
      if (error) throw error

      toast.success(`Successfully marked ${count} members as VERIFIED PAID (₹${formatInr(amt)} each)!`)
      setSelectedUserIds(new Set())
      setAllPayments(prev => [
        ...(data || []),
        ...prev.filter(p => !(targetIds.includes(p.user_id) && monthKeyOf(new Date(p.created_at)) === currentMonthKey))
      ])
    } catch (err) {
      console.error('[BulkMarkPaid] error:', err)
      toast.error('Bulk update failed. Please retry.')
    } finally {
      setBulkProcessing(false)
    }
  }

  // ── Bulk Mark as UNPAID (Revert) ──
  const handleBulkMarkUnpaid = async () => {
    if (selectedUserIds.size === 0) return
    const count = selectedUserIds.size
    if (!window.confirm(`Revert payment status to UNPAID for ${count} selected members this month?`)) return

    setBulkProcessing(true)
    try {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const targetIds = Array.from(selectedUserIds)

      const { error } = await supabase
        .from('user_payments')
        .delete()
        .in('user_id', targetIds)
        .gte('created_at', monthStart)

      if (error) throw error

      toast.success(`Reverted ${count} members to UNPAID for ${currentMonthLabel}.`)
      setSelectedUserIds(new Set())
      setAllPayments(prev => prev.filter(p => !(targetIds.includes(p.user_id) && monthKeyOf(new Date(p.created_at)) === currentMonthKey)))
    } catch (err) {
      console.error('[BulkMarkUnpaid] error:', err)
      toast.error('Could not revert payments.')
    } finally {
      setBulkProcessing(false)
    }
  }

  // ── Single Row Action: Mark as Cash ──
  const handleSingleMarkCash = async (member, customAmt) => {
    try {
      const nowIso = new Date().toISOString()
      const enteredVal = customAmt !== undefined ? customAmt : rowAmounts[member.user_id]
      const enteredAmt = parseFloat(enteredVal)
      const amt = !isNaN(enteredAmt) && enteredAmt > 0
        ? enteredAmt
        : (member.currentMonthPayment?.amount ? parseFloat(member.currentMonthPayment.amount) : defaultDue)

      let updatedData = null

      if (member.currentMonthPayment?.id) {
        // Update existing month payment to Cash & verified
        const res = await supabase
          .from('user_payments')
          .update({
            amount: amt,
            status: 'verified',
            payment_method: 'Cash',
            transaction_ref: 'CASH',
            note: `${paymentTitle} - Cash Payment`,
            updated_at: nowIso
          })
          .eq('id', member.currentMonthPayment.id)
          .select()
          .single()
        if (res.error) throw res.error
        updatedData = res.data
        setAllPayments(prev => prev.map(p => p.id === member.currentMonthPayment.id ? updatedData : p))
      } else {
        // Insert new Cash payment
        const payload = {
          user_id: member.user_id,
          user_name: member.name || 'Member',
          user_email: member.email || '',
          thali_number: member.thali_number ? String(member.thali_number) : '',
          amount: amt,
          currency: 'INR',
          status: 'verified',
          transaction_ref: 'CASH',
          upi_id: configuredUpiId,
          payee_name: payeeName,
          payment_method: 'Cash',
          note: `${paymentTitle} - Cash Payment`,
          created_at: nowIso
        }

        const res = await supabase.from('user_payments').insert([payload]).select().single()
        if (res.error) throw res.error
        updatedData = res.data
        setAllPayments(prev => [updatedData, ...prev])
      }

      if (member.user_id === user?.id && updatedData) {
        setMyPayments(prev => [updatedData, ...prev.filter(p => p.id !== updatedData.id)])
      }

      toast.success(`Marked ${member.name} as Paid by Cash (₹${formatInr(amt)})!`)
    } catch (err) {
      console.error('[handleSingleMarkCash] error:', err)
      toast.error('Failed to record Cash payment')
    }
  }

  // ── Single Row Action: Mark as Paid (Verify UPI) ──
  const handleSingleMarkPaid = async (member, customAmt) => {
    try {
      const nowIso = new Date().toISOString()
      const enteredVal = customAmt !== undefined ? customAmt : rowAmounts[member.user_id]
      const enteredAmt = parseFloat(enteredVal)
      const amt = !isNaN(enteredAmt) && enteredAmt > 0
        ? enteredAmt
        : (member.currentMonthPayment?.amount ? parseFloat(member.currentMonthPayment.amount) : defaultDue)

      let updatedData = null

      if (member.currentMonthPayment?.id) {
        // Update existing month payment to verified UPI
        const res = await supabase
          .from('user_payments')
          .update({
            amount: amt,
            status: 'verified',
            payment_method: member.currentMonthPayment.payment_method === 'Cash' ? 'UPI Pay' : (member.currentMonthPayment.payment_method || 'UPI Pay'),
            transaction_ref: member.currentMonthPayment.transaction_ref === 'CASH' ? 'VERIFIED_BY_ADMIN' : (member.currentMonthPayment.transaction_ref || 'VERIFIED_BY_ADMIN'),
            updated_at: nowIso
          })
          .eq('id', member.currentMonthPayment.id)
          .select()
          .single()
        if (res.error) throw res.error
        updatedData = res.data
        setAllPayments(prev => prev.map(p => p.id === member.currentMonthPayment.id ? updatedData : p))
      } else {
        // Insert new verified UPI record
        const payload = {
          user_id: member.user_id,
          user_name: member.name || 'Member',
          user_email: member.email || '',
          thali_number: member.thali_number ? String(member.thali_number) : '',
          amount: amt,
          currency: 'INR',
          status: 'verified',
          transaction_ref: 'VERIFIED_BY_ADMIN',
          upi_id: configuredUpiId,
          payee_name: payeeName,
          payment_method: 'UPI Pay',
          note: `${paymentTitle} - Verified Online`,
          created_at: nowIso
        }

        const res = await supabase.from('user_payments').insert([payload]).select().single()
        if (res.error) throw res.error
        updatedData = res.data
        setAllPayments(prev => [updatedData, ...prev])
      }

      if (member.user_id === user?.id && updatedData) {
        setMyPayments(prev => [updatedData, ...prev.filter(p => p.id !== updatedData.id)])
      }

      toast.success(`Marked ${member.name} as Verified Paid (₹${formatInr(amt)})!`)
    } catch (err) {
      console.error('[handleSingleMarkPaid] error:', err)
      toast.error('Failed to mark as Paid')
    }
  }

  // ── Single Row Action: Mark as Unpaid (Revert) ──
  const handleSingleMarkUnpaid = async (member) => {
    if (!window.confirm(`Revert ${member.name} to UNPAID for ${currentMonthLabel}?`)) return
    try {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const { error } = await supabase
        .from('user_payments')
        .delete()
        .eq('user_id', member.user_id)
        .gte('created_at', monthStart)

      if (error) throw error

      toast.success(`${member.name} reverted to Unpaid for this month.`)
      setAllPayments(prev => prev.filter(p => !(p.user_id === member.user_id && monthKeyOf(new Date(p.created_at)) === currentMonthKey)))
      if (member.user_id === user?.id) {
        setMyPayments(prev => prev.filter(p => !(monthKeyOf(new Date(p.created_at)) === currentMonthKey)))
      }
    } catch (err) {
      console.error('[handleSingleMarkUnpaid] error:', err)
      toast.error('Failed to revert payment')
    }
  }

  // ── Toggle Forfeit / Exempt ──
  const handleToggleForfeit = async (member) => {
    const nextVal = !member.payment_exempt
    try {
      const { error } = await supabase
        .from('user_stats')
        .update({ payment_exempt: nextVal, updated_at: new Date().toISOString() })
        .eq('user_id', member.user_id)

      if (error) throw error

      toast.success(nextVal ? `${member.name} marked as Forfeited / Exempt` : `${member.name} restored to active dues`)
      setAllUsers(prev => prev.map(u => u.user_id === member.user_id ? { ...u, payment_exempt: nextVal } : u))
    } catch (err) {
      console.error('Forfeit error:', err)
      toast.error('Could not update forfeit status')
    }
  }

  // ── WhatsApp Reminder ──
  const handleWhatsAppReminder = (member) => {
    if (!member.phone) {
      toast.error(`No phone number recorded for ${member.name}`)
      return
    }
    const clean = member.phone.replace(/[^\d]/g, '')
    const phone = clean.length === 10 ? `91${clean}` : clean
    const msg = encodeURIComponent(
      `Salam ${member.name || 'Bhai'},\n\nThis is a friendly reminder regarding your Al-Mawaid Thali contribution of *₹${defaultDue}* for *${paymentTitle}* (${currentMonthLabel}).\n\nPlease pay directly via UPI to: *${configuredUpiId}*.\n\nThank you,\n*Al-Mawaid Management*`
    )
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  // ── Custom Notification Dispatch ──
  const handleOpenNotifyModal = (targetUser = null) => {
    setNotifyTargetUser(targetUser)
    if (targetUser) {
      setNotifyTitle(`Payment Reminder - ${paymentTitle}`)
      setNotifyBody(`Dear ${targetUser.name || 'Member'}, your thali contribution of ₹${defaultDue} for ${currentMonthLabel} is pending. Please pay via your UPI app on the portal.`)
    } else {
      setNotifyTitle(`Thali Contribution Reminder — ${currentMonthLabel}`)
      setNotifyBody(`Dear Member, your monthly thali contribution of ₹${defaultDue} is due. Please pay via your UPI app on the Al-Mawaid portal. Shukran!`)
    }
    setNotifyTemplate('standard')
    setShowNotifyModal(true)
  }

  const handleApplyTemplate = (key) => {
    setNotifyTemplate(key)
    const name = notifyTargetUser?.name || 'Member'
    if (key === 'standard') {
      setNotifyTitle(`Thali Contribution Reminder — ${currentMonthLabel}`)
      setNotifyBody(`Dear ${name}, this is a gentle reminder that your thali contribution of ₹${defaultDue} for ${currentMonthLabel} is due. Please pay via UPI on your app.`)
    } else if (key === 'urgent') {
      setNotifyTitle(`⚠️ Urgent: Thali Contribution Due`)
      setNotifyBody(`Dear ${name}, your monthly thali contribution of ₹${defaultDue} is pending. Kindly clear the dues today to avoid any interruption in thali services.`)
    } else if (key === 'final') {
      setNotifyTitle(`🔔 Final Notice: ${paymentTitle}`)
      setNotifyBody(`Salam ${name}, this is the final reminder for this month's thali contribution of ₹${defaultDue}. Please pay using UPI ID: ${configuredUpiId}.`)
    }
  }

  const handleSendNotification = async (e) => {
    e.preventDefault()
    if (!notifyTitle.trim() || !notifyBody.trim()) {
      toast.error('Title and message are required')
      return
    }

    setBulkNotifying(true)
    try {
      if (notifyTargetUser) {
        await supabase.from('notices').insert([{
          title: notifyTitle.trim(),
          body: notifyBody.trim(),
          sender_name: 'Mulla Murtaza Hamid (Payments)',
          target_user_id: notifyTargetUser.user_id,
          tone: '#34d399',
          type: 'reminder',
          url: '/pay',
          created_at: new Date().toISOString()
        }])
        toast.success(`Reminder delivered to ${notifyTargetUser.name}!`)
      } else {
        const unpaidMembers = allUsers.filter(u => {
          if (u.payment_exempt) return false
          const hasPayment = allPayments.some(p => p.user_id === u.user_id && monthKeyOf(new Date(p.created_at)) === currentMonthKey)
          return !hasPayment
        })

        if (unpaidMembers.length === 0) {
          toast.success('No active unpaid members found.')
          setShowNotifyModal(false)
          return
        }

        const notices = unpaidMembers.map(u => ({
          title: notifyTitle.trim(),
          body: notifyBody.replace(/Dear Member/g, `Dear ${u.name || 'Member'}`).trim(),
          sender_name: 'Mulla Murtaza Hamid (Payments)',
          target_user_id: u.user_id,
          tone: '#34d399',
          type: 'reminder',
          url: '/pay',
          created_at: new Date().toISOString()
        }))

        for (let i = 0; i < notices.length; i += 50) {
          await supabase.from('notices').insert(notices.slice(i, i + 50))
        }
        toast.success(`📢 Dispatched reminders to ${unpaidMembers.length} active unpaid members!`)
      }
      setShowNotifyModal(false)
    } catch (err) {
      console.error('[handleSendNotification] error:', err)
      toast.error('Failed to dispatch notifications')
    } finally {
      setBulkNotifying(false)
    }
  }

  // ── Manual Payment Record by Manager ──
  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault()
    const amt = parseFloat(recordAmount) || defaultDue
    if (amt <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setSubmittingRecord(true)
    try {
      const target = selectedUserToRecord || userProfile
      const payload = {
        user_id: target?.user_id || user.id,
        user_name: target?.name || user?.email?.split('@')[0] || 'Member',
        user_email: target?.email || user?.email || '',
        thali_number: target?.thali_number ? String(target?.thali_number) : '',
        amount: amt,
        currency: 'INR',
        status: 'verified',
        transaction_ref: recordUtr.trim() || (recordMethod === 'Cash' ? 'CASH' : 'MANUAL_RECORD'),
        upi_id: configuredUpiId,
        payee_name: payeeName,
        payment_method: recordMethod,
        note: recordNote || `${paymentTitle} - Manual Record`,
        created_at: new Date().toISOString()
      }

      const { data, error } = await supabase.from('user_payments').insert([payload]).select().single()
      if (error) throw error

      toast.success(`Payment of ₹${amt} recorded for ${target?.name || 'Member'}!`)
      if (data) {
        setAllPayments(prev => [data, ...prev])
        if (target?.user_id === user.id) setMyPayments(prev => [data, ...prev])
      }
      setShowRecordModal(false)
      setSelectedUserToRecord(null)
      setRecordAmount('')
      setRecordUtr('')
      setRecordNote('')
    } catch (err) {
      console.error('Error saving manual record:', err)
      toast.error('Failed to save payment record')
    } finally {
      setSubmittingRecord(false)
    }
  }

  // ── Save Payment Settings ──
  const handleSaveSettings = async (e) => {
    e.preventDefault()
    try {
      const items = [
        { key: 'upi_id', value: configuredUpiId.trim() },
        { key: 'upi_id_2', value: (fallbackUpiId || '').trim() },
        { key: 'upi_mc', value: (merchantCode || '').trim() },
        { key: 'upi_payee_name', value: payeeName.trim() },
        { key: 'default_payment_due', value: String(defaultDue) },
        { key: 'payment_title', value: paymentTitle.trim() },
        { key: 'payment_enabled', value: String(isPaymentActive) }
      ]

      for (const item of items) {
        await supabase.from('app_settings').upsert(item)
      }

      toast.success('Settings saved successfully!')
      setShowSettingsModal(false)
      loadData()
    } catch (err) {
      console.error('Save settings error:', err)
      toast.error('Could not save settings')
    }
  }

  // ── Global Payment Display Toggle ──
  const handleTogglePaymentDisplay = async () => {
    const nextVal = !isPaymentActive
    setIsPaymentActive(nextVal)
    try {
      await supabase.from('app_settings').upsert({ key: 'payment_enabled', value: String(nextVal) })
      toast.success(nextVal ? 'Payment Dues are now VISIBLE to all members' : 'Payment Dues are now HIDDEN from members')
    } catch {
      setIsPaymentActive(!nextVal)
      toast.error('Failed to update visibility setting')
    }
  }

  return (
    <main style={{
      flex: 1, padding: '16px 16px calc(120px + env(safe-area-inset-bottom, 0px))',
      maxWidth: 780, margin: '0 auto', width: '100%', boxSizing: 'border-box'
    }}>
      <BackHeader
        title={isManager && portalMode === 'manager' ? "Payment Management Hub" : "Dues & Payments"}
        onBack={onBack}
      />

      {/* Role Switcher (for Manager/Admin) */}
      {isManager && (
        <div style={{
          display: 'flex', background: t.card, padding: 4, borderRadius: 16,
          border: `1px solid ${t.border}`, marginBottom: 16
        }}>
          <button
            onClick={() => setPortalMode('manager')}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 12, border: 'none',
              background: portalMode === 'manager' ? t.accentGrad : 'transparent',
              color: portalMode === 'manager' ? '#0a0d14' : t.textSub,
              fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s'
            }}
          >
            <Users size={16} />
            <span>Management Portal</span>
          </button>

          <button
            onClick={() => setPortalMode('payer')}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 12, border: 'none',
              background: portalMode === 'payer' ? t.accentGrad : 'transparent',
              color: portalMode === 'payer' ? '#0a0d14' : t.textSub,
              fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s'
            }}
          >
            <CreditCard size={16} />
            <span>Payer Screen</span>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 1: MANAGEMENT PORTAL (CASH, PAID, MULTIPLE SELECTION, 25th AUTO-CYCLE)
         ══════════════════════════════════════════════════════════════════════ */}
      {isManager && portalMode === 'manager' && (
        <div>
          {/* Manager Header & Metrics Dashboard Card */}
          <div style={{
            background: 'linear-gradient(135deg, #131c2e 0%, #0c121e 100%)',
            borderRadius: 24, border: `1.5px solid ${t.accentBorder || 'rgba(197,160,89,0.35)'}`,
            padding: '20px', marginBottom: 18, boxShadow: '0 12px 36px rgba(0,0,0,0.4)'
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
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#fff', fontFamily: "'Playfair Display', serif" }}>
                  {paymentTitle}
                </h2>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                  Standard Due: ₹{formatInr(defaultDue)} • UPI: {configuredUpiId}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  onClick={handleTogglePaymentDisplay}
                  style={{
                    background: isPaymentActive ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
                    border: `1px solid ${isPaymentActive ? 'rgba(52,211,153,0.35)' : 'rgba(239,68,68,0.35)'}`,
                    borderRadius: 10, padding: '7px 10px', color: isPaymentActive ? '#34d399' : '#f87171',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700
                  }}
                  title={isPaymentActive ? "Payment banner is VISIBLE to users" : "Payment banner is HIDDEN from users"}
                >
                  {isPaymentActive ? <Eye size={14} /> : <EyeOff size={14} />}
                  <span>{isPaymentActive ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  onClick={() => setShowSettingsModal(true)}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10, padding: '7px 10px', color: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700
                  }}
                  title="Configure Settings"
                >
                  <SlidersHorizontal size={14} />
                  <span>Config</span>
                </button>

                <button
                  onClick={() => { setRefreshing(true); loadData() }}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10,
                    padding: '7px 10px', color: '#fff', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center'
                  }}
                  title="Sync Data"
                >
                  <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
                </button>
              </div>
            </div>

            {/* Quick Setting: Monthly Thali Due Rate per Member */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.35)', padding: '10px 14px', borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.12)', marginBottom: 14, flexWrap: 'wrap', gap: 8
            }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>
                  Monthly Thali Due per Member
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                  Standard monthly rate applied to all active members
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '4px 8px'
                }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: t.accent, marginRight: 2 }}>₹</span>
                  <input
                    type="number"
                    min="1"
                    value={dueInput}
                    onChange={(e) => setDueInput(e.target.value)}
                    style={{
                      width: 75, background: 'transparent', border: 'none',
                      color: '#fff', fontSize: 14, fontWeight: 800, outline: 'none'
                    }}
                    placeholder="1500"
                  />
                </div>
                <button
                  onClick={handleSaveDueRate}
                  disabled={savingDue || Number(dueInput) === defaultDue || !dueInput}
                  style={{
                    padding: '7px 14px', borderRadius: 10, border: 'none',
                    background: (Number(dueInput) !== defaultDue && dueInput) ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.1)',
                    color: (Number(dueInput) !== defaultDue && dueInput) ? '#fff' : 'rgba(255,255,255,0.4)',
                    fontSize: 12, fontWeight: 800, cursor: (Number(dueInput) !== defaultDue && dueInput) ? 'pointer' : 'default',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {savingDue ? 'Saving…' : Number(dueInput) === defaultDue ? 'Saved ✓' : 'Save Rate'}
                </button>
              </div>
            </div>

            {/* Metrics Counter Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 14 }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '9px 4px', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Active</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginTop: 2 }}>{managerMetrics.activeCount}</div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16,185,129,0.3)', padding: '9px 4px', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#10b981', textTransform: 'uppercase', fontWeight: 800 }}>Cash</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981', marginTop: 2 }}>{managerMetrics.cashCount}</div>
              </div>
              <div style={{ background: 'rgba(52, 211, 153, 0.12)', border: '1px solid rgba(52,211,153,0.25)', padding: '9px 4px', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#34d399', textTransform: 'uppercase', fontWeight: 700 }}>UPI Paid</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#34d399', marginTop: 2 }}>{managerMetrics.upiCount}</div>
              </div>
              <div style={{ background: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251,191,36,0.25)', padding: '9px 4px', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#fbbf24', textTransform: 'uppercase', fontWeight: 700 }}>Review</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>{managerMetrics.submittedCount}</div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239,68,68,0.25)', padding: '9px 4px', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#f87171', textTransform: 'uppercase', fontWeight: 700 }}>Unpaid</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#f87171', marginTop: 2 }}>{managerMetrics.unpaidCount}</div>
              </div>
            </div>

            {/* ── 25TH OF MONTH AUTO-CYCLE STATUS BANNER ── */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.06) 100%)',
              border: '1.5px solid rgba(245,158,11,0.35)', borderRadius: 14,
              padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 10, flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fcd34d' }}>
                    Auto-Cycle: Every 25th of the Month
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
                    {lastAutoCycleMonth === currentMonthKey
                      ? `✅ Ran for ${currentMonthLabel} (${lastAutoCycleRun ? new Date(lastAutoCycleRun).toLocaleDateString('en-GB') : 'Active'})`
                      : new Date().getDate() >= 25
                        ? `⚠️ Ready to run for ${currentMonthLabel}`
                        : `⏰ Next scheduled run: 25th ${currentMonthLabel}`}
                  </div>
                </div>
              </div>

              <button
                onClick={() => execute25thAutoCycle(true)}
                disabled={runningAutoCycle}
                style={{
                  padding: '7px 12px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000',
                  fontSize: 11.5, fontWeight: 800, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: 4, boxShadow: '0 2px 8px rgba(245,158,11,0.3)'
                }}
              >
                <Play size={12} />
                <span>{runningAutoCycle ? 'Running…' : 'Run 25th Cycle Now'}</span>
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleOpenNotifyModal(null)}
                disabled={bulkNotifying || managerMetrics.unpaidCount === 0}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 12, border: 'none',
                  background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12.5,
                  fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 6
                }}
              >
                <BellRing size={15} color="#fbbf24" />
                <span>Notify Unpaid ({managerMetrics.unpaidCount})</span>
              </button>

              <button
                onClick={() => {
                  setSelectedUserToRecord(null)
                  setRecordAmount(String(defaultDue))
                  setRecordMethod('Cash')
                  setShowRecordModal(true)
                }}
                style={{
                  padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 12.5,
                  fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <CheckSquare size={15} color="#34d399" />
                <span>Record Single</span>
              </button>
            </div>
          </div>

          {/* Search, Filter & Multiple Selection Bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ flex: 1, minWidth: 190, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={15} color={t.textSub} style={{ position: 'absolute', left: 12 }} />
              <input
                type="text"
                value={managerSearch}
                onChange={(e) => setManagerSearch(e.target.value)}
                placeholder="Search member, thali #, phone…"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px',
                  borderRadius: 12, border: `1px solid ${t.border}`, background: t.card,
                  color: t.text, fontSize: 12.5, outline: 'none'
                }}
              />
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: `All (${allUsers.length})` },
                { id: 'unpaid', label: `Unpaid (${managerMetrics.unpaidCount})` },
                { id: 'cash', label: `💵 Cash (${managerMetrics.cashCount})` },
                { id: 'paid', label: `Paid (${managerMetrics.paidCount})` },
                { id: 'submitted', label: `Review (${managerMetrics.submittedCount})` },
                { id: 'forfeit', label: `Exempt (${managerMetrics.forfeitCount})` }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setManagerFilter(f.id)}
                  style={{
                    padding: '7px 10px', borderRadius: 10, fontSize: 11.5, fontWeight: 700,
                    border: managerFilter === f.id ? `1px solid ${t.accent}` : `1px solid ${t.border}`,
                    background: managerFilter === f.id ? t.accentBg : t.card,
                    color: managerFilter === f.id ? t.accent : t.textSub, cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── MULTIPLE SELECTION HEADER CONTROLS ── */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
            padding: '8px 12px', marginBottom: 12
          }}>
            <button
              onClick={toggleSelectAll}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, color: t.text,
                fontSize: 12.5, fontWeight: 700, padding: 0
              }}
            >
              {isAllSelected ? <CheckSquare size={17} color={t.accent} /> : <Square size={17} color={t.textSub} />}
              <span>{isAllSelected ? 'Deselect All' : `Select All (${filteredUsersList.length})`}</span>
            </button>

            {selectedUserIds.size > 0 && (
              <span style={{ fontSize: 12, fontWeight: 800, color: t.accent }}>
                {selectedUserIds.size} selected (₹{formatInr(selectedUserIds.size * (parseFloat(bulkAmount) || defaultDue))})
              </span>
            )}
          </div>

          {/* ── STICKY BULK ACTIONS BAR (When 1+ items selected) ── */}
          {selectedUserIds.size > 0 && (
            <div style={{
              position: 'sticky', top: 12, zIndex: 100, marginBottom: 14,
              background: 'linear-gradient(135deg, #1f293d 0%, #111827 100%)',
              border: `1.5px solid ${t.accent}`, borderRadius: 16,
              padding: '10px 14px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 8, flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  background: t.accentBg, color: t.accent, border: `1px solid ${t.accentBorder}`,
                  borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 900
                }}>
                  {selectedUserIds.size} SELECTED
                </span>

                {/* Bulk Amount Input */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8, padding: '3px 6px'
                }} title="Amount per member for bulk action">
                  <span style={{ fontSize: 11, fontWeight: 800, color: t.accent }}>₹</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={bulkAmount}
                    onChange={(e) => setBulkAmount(e.target.value)}
                    style={{
                      width: 58, background: 'transparent', border: 'none',
                      color: '#fff', fontSize: 12, fontWeight: 800, outline: 'none'
                    }}
                    placeholder={String(defaultDue)}
                  />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>each</span>
                </div>

                <button
                  onClick={() => setSelectedUserIds(new Set())}
                  style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', fontSize: 11 }}
                >
                  Clear
                </button>
              </div>

              {/* Bulk Action Buttons: CASH, PAID, UNPAID */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={handleBulkMarkCash}
                  disabled={bulkProcessing}
                  style={{
                    padding: '8px 12px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
                    fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: 4
                  }}
                >
                  <Banknote size={14} />
                  <span>Mark CASH (₹{formatInr(parseFloat(bulkAmount) || defaultDue)})</span>
                </button>

                <button
                  onClick={handleBulkMarkPaid}
                  disabled={bulkProcessing}
                  style={{
                    padding: '8px 12px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff',
                    fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: 4
                  }}
                >
                  <CheckCircle2 size={14} />
                  <span>Mark PAID (UPI)</span>
                </button>

                <button
                  onClick={handleBulkMarkUnpaid}
                  disabled={bulkProcessing}
                  style={{
                    padding: '8px 11px', borderRadius: 10, border: `1px solid rgba(239,68,68,0.4)`,
                    background: 'rgba(239,68,68,0.12)', color: '#f87171',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: 4
                  }}
                >
                  <RotateCcwIcon size={14} />
                  <span>Mark UNPAID</span>
                </button>
              </div>
            </div>
          )}

          {/* Member Directory List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredUsersList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', background: t.card, borderRadius: 16, border: `1px solid ${t.border}` }}>
                <Users size={32} color={t.textSub} style={{ opacity: 0.5, marginBottom: 8 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>No members found</div>
                <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>Try adjusting your search or filters</div>
              </div>
            ) : (
              filteredUsersList.map(member => {
                const isCash = member.status === 'cash'
                const isUpiPaid = member.status === 'paid'
                const isPaid = isCash || isUpiPaid
                const isSubmitted = member.status === 'submitted'
                const isUnpaid = member.status === 'unpaid'
                const isForfeit = member.status === 'forfeit'
                const isSelected = selectedUserIds.has(member.user_id)

                return (
                  <div
                    key={member.user_id}
                    style={{
                      background: t.card, borderRadius: 16,
                      border: `1.5px solid ${isSelected ? t.accent : isCash ? 'rgba(16,185,129,0.5)' : isUpiPaid ? 'rgba(52,211,153,0.35)' : isSubmitted ? 'rgba(251,191,36,0.35)' : isForfeit ? 'rgba(148,163,184,0.3)' : t.border}`,
                      padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 10,
                      boxShadow: isSelected ? `0 0 0 1px ${t.accent}` : isCash ? '0 2px 10px rgba(16,185,129,0.1)' : '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    {/* Top Row: Checkbox, Name, Thali # and Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <button
                          type="button"
                          onClick={() => toggleSelectMember(member.user_id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}
                        >
                          {isSelected ? <CheckSquare size={18} color={t.accent} /> : <Square size={18} color={t.textSub} />}
                        </button>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14.5, fontWeight: 700, color: t.text }}>
                              {member.name || 'Member'}
                            </span>
                            {member.thali_number && (
                              <span style={{
                                fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 7,
                                background: t.accentBg, color: t.accent, border: `1px solid ${t.accentBorder}`
                              }}>
                                #{member.thali_number}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11.5, color: t.textSub, marginTop: 2 }}>
                            {member.phone || member.email || 'No contact details'}
                          </div>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div style={{ flexShrink: 0 }}>
                        {isCash && (
                          <span style={{
                            fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase',
                            padding: '4px 8px', borderRadius: 10, background: 'rgba(16, 185, 129, 0.2)',
                            color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.5)',
                            display: 'flex', alignItems: 'center', gap: 4
                          }}>
                            <Banknote size={11} /> Cash ₹{formatInr(member.currentMonthPayment?.amount || defaultDue)}
                            {Number(member.currentMonthPayment?.amount || defaultDue) < defaultDue && (
                              <span style={{ color: '#fbbf24', fontSize: 9.5 }}> (Partial)</span>
                            )}
                          </span>
                        )}

                        {isUpiPaid && (
                          <span style={{
                            fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase',
                            padding: '4px 8px', borderRadius: 10, background: 'rgba(52, 211, 153, 0.15)',
                            color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.4)',
                            display: 'flex', alignItems: 'center', gap: 4
                          }}>
                            <Check size={11} /> Paid ₹{formatInr(member.currentMonthPayment?.amount || defaultDue)}
                            {Number(member.currentMonthPayment?.amount || defaultDue) < defaultDue && (
                              <span style={{ color: '#fbbf24', fontSize: 9.5 }}> (Partial)</span>
                            )}
                          </span>
                        )}

                        {isSubmitted && (
                          <span style={{
                            fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase',
                            padding: '4px 8px', borderRadius: 10, background: 'rgba(251, 191, 36, 0.15)',
                            color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.4)',
                            display: 'flex', alignItems: 'center', gap: 4
                          }}>
                            <Clock size={11} /> Review UTR
                          </span>
                        )}

                        {isUnpaid && (
                          <span style={{
                            fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase',
                            padding: '4px 8px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.12)',
                            color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)',
                            display: 'flex', alignItems: 'center', gap: 4
                          }}>
                            Due ₹{formatInr(defaultDue)}
                          </span>
                        )}

                        {isForfeit && (
                          <span style={{
                            fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase',
                            padding: '4px 8px', borderRadius: 10, background: 'rgba(148, 163, 184, 0.15)',
                            color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.35)',
                            display: 'flex', alignItems: 'center', gap: 4
                          }}>
                            <UserX size={11} /> Exempt
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Actions (CASH, PAID, UNPAID, FORFEIT, WHATSAPP, NOTIFY) */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderTop: `1px solid ${t.border}`, paddingTop: 8, marginTop: 2,
                      flexWrap: 'wrap', gap: 6
                    }}>
                      <div style={{ fontSize: 11, color: t.textSub }}>
                        {member.currentMonthPayment ? (
                          <span>
                            <strong style={{ color: isCash ? '#10b981' : '#34d399' }}>
                              {isCash ? '💵 Cash Received' : '📲 UPI Received'} (₹{formatInr(member.currentMonthPayment.amount || defaultDue)})
                            </strong>
                            {Number(member.currentMonthPayment.amount || defaultDue) < defaultDue && (
                              <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                                {' • '}₹{formatInr(Math.max(0, defaultDue - Number(member.currentMonthPayment.amount)))} remaining
                              </span>
                            )}
                            {' • '}
                            {new Date(member.currentMonthPayment.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            {member.currentMonthPayment.transaction_ref && member.currentMonthPayment.transaction_ref !== 'CASH' && ` (Ref: ${member.currentMonthPayment.transaction_ref})`}
                          </span>
                        ) : isForfeit ? (
                          <span style={{ color: '#94a3b8' }}>Exempt from payment</span>
                        ) : (
                          <span style={{ color: '#f87171' }}>Pending ₹{formatInr(defaultDue)} for {currentMonthLabel}</span>
                        )}
                      </div>

                      {/* Action Button Strip */}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Inline Payment Amount Input */}
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', background: t.inputBg,
                            border: `1.5px solid ${t.border}`, borderRadius: 8,
                            padding: '2px 6px', gap: 2, height: 28, boxSizing: 'border-box'
                          }}
                          title="Payment amount to record for this member"
                        >
                          <span style={{ fontSize: 11, fontWeight: 800, color: t.accent }}>₹</span>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={getMemberRowAmount(member)}
                            onChange={(e) => setMemberRowAmount(member.user_id, e.target.value)}
                            style={{
                              width: 55, background: 'transparent', border: 'none',
                              color: t.text, fontSize: 12, fontWeight: 800, outline: 'none'
                            }}
                            placeholder={String(defaultDue)}
                          />
                        </div>

                        {/* 1. Quick CASH Button */}
                        <button
                          onClick={() => handleSingleMarkCash(member)}
                          style={{
                            background: isCash ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(16,185,129,0.12)',
                            border: `1px solid ${isCash ? '#10b981' : 'rgba(16,185,129,0.35)'}`,
                            borderRadius: 8, padding: '5px 8px', color: isCash ? '#ffffff' : '#10b981', fontSize: 11,
                            fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, height: 28
                          }}
                          title={isCash ? "Paid by Cash" : "Mark paid in Cash"}
                        >
                          <Banknote size={12} />
                          <span>{isCash ? '✓ CASH' : 'CASH'}</span>
                        </button>

                        {/* 2. Quick PAID Button */}
                        <button
                          onClick={() => handleSingleMarkPaid(member)}
                          style={{
                            background: isUpiPaid ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'rgba(59,130,246,0.12)',
                            border: `1px solid ${isUpiPaid ? '#3b82f6' : 'rgba(59,130,246,0.35)'}`,
                            borderRadius: 8, padding: '5px 8px', color: isUpiPaid ? '#ffffff' : '#60a5fa', fontSize: 11,
                            fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, height: 28
                          }}
                          title={isUpiPaid ? "Paid via UPI" : "Mark verified paid (UPI/Online)"}
                        >
                          <CheckCircle2 size={12} />
                          <span>{isUpiPaid ? '✓ PAID' : 'PAID'}</span>
                        </button>

                        {/* 3. Revert to UNPAID (if currently paid, cash, or submitted) */}
                        {(isPaid || isSubmitted) && (
                          <button
                            onClick={() => handleSingleMarkUnpaid(member)}
                            style={{
                              background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)',
                              borderRadius: 8, padding: '5px 7px', color: '#f87171', fontSize: 11,
                              fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, height: 28
                            }}
                            title="Revert to Unpaid"
                          >
                            <RotateCcwIcon size={12} />
                            <span>Unpaid</span>
                          </button>
                        )}

                        {/* 4. Forfeit Toggle */}
                        <button
                          onClick={() => handleToggleForfeit(member)}
                          style={{
                            background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.25)',
                            borderRadius: 8, padding: '5px 7px', color: isForfeit ? '#34d399' : '#94a3b8',
                            fontSize: 11, fontWeight: 700, cursor: 'pointer'
                          }}
                          title={isForfeit ? "Restore active dues" : "Mark exempt"}
                        >
                          {isForfeit ? 'Un-Forfeit' : 'Forfeit'}
                        </button>

                        {/* 5. WhatsApp Reminder */}
                        {isUnpaid && (
                          <button
                            onClick={() => handleWhatsAppReminder(member)}
                            style={{
                              background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)',
                              borderRadius: 8, padding: '5px 7px', color: '#25D366', fontSize: 11,
                              fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3
                            }}
                            title="WhatsApp reminder"
                          >
                            <MessageSquare size={12} />
                          </button>
                        )}

                        {/* 6. Receipt Slip (if paid) */}
                        {isPaid && member.currentMonthPayment && (
                          <button
                            onClick={() => setSelectedReceipt(member.currentMonthPayment)}
                            style={{
                              background: 'transparent', border: `1px solid ${t.border}`,
                              borderRadius: 8, padding: '5px 7px', color: t.textSub, fontSize: 11,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3
                            }}
                            title="View receipt"
                          >
                            <Receipt size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 2: MEMBER / PAYER SPLIT COLLECTION CARD (Native Dynamic QR + 1-Tap Pay)
         ══════════════════════════════════════════════════════════════════════ */}
      {(!isManager || portalMode === 'payer') && (
        <div style={{ width: '100%', boxSizing: 'border-box' }}>
          {/* Main Collection / Split Card */}
          <div style={{
            background: t.card, borderRadius: 24, border: `1.5px solid ${t.borderActive || t.border}`,
            boxShadow: '0 12px 36px rgba(0,0,0,0.25)', padding: '20px 18px', marginBottom: 20,
            boxSizing: 'border-box', position: 'relative', overflow: 'hidden'
          }}>
            {/* Top Gold Bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 4,
              background: 'linear-gradient(90deg, #B8860B, #F0C239, #10b981, #B8860B)'
            }} />

            {/* Header: Title, Thali #, Sync */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: t.accent, background: t.accentBg, padding: '3px 8px', borderRadius: 12,
                    border: `1px solid ${t.accentBorder}`
                  }}>
                    {paymentTitle}
                  </span>
                  {userProfile?.thali_number && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub }}>
                      Thali #{userProfile.thali_number}
                    </span>
                  )}
                  {userProfile?.payment_exempt && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 8, background: 'rgba(148,163,184,0.15)', color: '#94a3b8' }}>
                      Exempt
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: t.textSub, marginTop: 3 }}>
                  Pay securely to: <strong>{payeeName}</strong>
                </div>
              </div>

              <button
                onClick={() => { setRefreshing(true); loadData() }}
                style={{
                  background: t.inputBg, border: 'none', borderRadius: 8, padding: '6px 8px',
                  color: t.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600
                }}
              >
                <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
                <span>Sync</span>
              </button>
            </div>

            {/* 6-Month Contribution Status Tracker Strip */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Monthly Contribution
                </span>
                <span style={{ fontSize: 10, color: t.textSub }}>₹{defaultDue}/month</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                {monthOptions.map(m => {
                  const st = monthStatusOf(m.key)
                  const paid = paidByMonth[m.key] || 0
                  const color = st === 'paid' ? '#34d399' : st === 'partial' ? '#fbbf24' : t.textSub
                  const bg = st === 'paid' ? t.successBg : st === 'partial' ? 'rgba(251,191,36,0.1)' : t.inputBg
                  return (
                    <div
                      key={m.key}
                      title={`${m.label}: ${st === 'paid' ? 'Paid' : st === 'partial' ? `₹${paid} paid` : 'Unpaid'}`}
                      style={{
                        padding: '6px 2px', borderRadius: 10, textAlign: 'center',
                        background: bg, border: `1.5px solid ${m.current ? t.accent : t.border}`, minWidth: 0
                      }}
                    >
                      <div style={{ fontSize: 9, fontWeight: 800, color: m.current ? t.accent : t.textSub }}>
                        {m.label.split(' ')[0]}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 900, color, lineHeight: 1.3 }}>
                        {st === 'paid' ? '✓' : st === 'partial' ? '◐' : '○'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Status Banner for Current Month ── */}
            {currentMonthPaid >= defaultDue ? (
              <div style={{
                background: 'rgba(52,211,153,0.12)', border: '1.5px solid rgba(52,211,153,0.35)',
                borderRadius: 14, padding: '14px 16px', marginBottom: 16, textAlign: 'center'
              }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <CheckCircle2 size={18} />
                  <span>{currentMonthLabel} Contribution Cleared ✅</span>
                </div>
                <div style={{ fontSize: 12, color: t.textSub, marginTop: 4 }}>
                  Paid ₹{formatInr(currentMonthPaid)} via {currentMonthMyPayment?.payment_method || 'UPI/Cash'}. Shukran!
                </div>
              </div>
            ) : currentMonthPaid > 0 ? (
              <div style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(217,119,6,0.10) 100%)',
                border: '1.5px solid rgba(245,158,11,0.45)', borderRadius: 14,
                padding: '14px 16px', marginBottom: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fcd34d', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={16} />
                    <span>Partial Payment Recorded ◐</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 900, background: 'rgba(245,158,11,0.25)', color: '#fcd34d', padding: '3px 8px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.4)' }}>
                    Partially Paid
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: '#fff', marginTop: 2 }}>
                  Paid so far: <strong style={{ color: '#34d399' }}>₹{formatInr(currentMonthPaid)}</strong> of ₹{formatInr(defaultDue)}.
                </div>
                <div style={{ fontSize: 12.5, color: '#fcd34d', fontWeight: 700, marginTop: 2 }}>
                  Remaining Balance Due: <span style={{ fontSize: 16, fontWeight: 900, color: '#f87171' }}>₹{formatInr(currentBalance)}</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                  Scan the QR code below or tap to pay the remaining ₹{formatInr(currentBalance)}.
                </div>
              </div>
            ) : currentMonthMyPayment?.status === 'submitted' ? (
              <div style={{
                background: 'rgba(251,191,36,0.12)', border: '1.5px solid rgba(251,191,36,0.35)',
                borderRadius: 14, padding: '12px 14px', marginBottom: 16, textAlign: 'center'
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Clock size={18} />
                  <span>Payment Under Verification 🕒</span>
                </div>
                <div style={{ fontSize: 11.5, color: t.textSub, marginTop: 3 }}>
                  UTR Ref: <strong>{currentMonthMyPayment.transaction_ref}</strong> submitted. Management will verify shortly.
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.35)',
                borderRadius: 14, padding: '12px 14px', marginBottom: 16, display: 'flex',
                alignItems: 'center', justifyContent: 'space-between', gap: 8
              }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fcd34d' }}>
                    {currentMonthLabel} Due Pending
                  </div>
                  <div style={{ fontSize: 11.5, color: t.textSub }}>
                    Monthly Contribution: <strong style={{ color: '#fff' }}>₹{formatInr(defaultDue)}</strong>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#f87171', background: 'rgba(239,68,68,0.15)', padding: '4px 8px', borderRadius: 8 }}>
                  Pending ⏳
                </span>
              </div>
            )}

            {/* Amount Input (Editable Split / Remaining Balance) */}
            <div style={{
              background: t.inputBg, border: `1px solid ${t.inputBorder || t.border}`,
              borderRadius: 14, padding: '10px 14px', marginBottom: 14
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.textSub }}>
                  {currentBalance > 0 && currentMonthPaid > 0 ? 'Amount to Pay (Remaining Balance)' : 'Amount to Pay (Locked Split)'}
                </label>
                {currentMonthPaid > 0 && currentBalance > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fcd34d' }}>
                    ₹{formatInr(currentMonthPaid)} paid • ₹{formatInr(currentBalance)} due
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: t.accent }}>₹</span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={payerAmount}
                  onChange={(e) => {
                    setPayerAmount(e.target.value)
                    setPayerAmountCustom(true)
                  }}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', color: t.text,
                    fontSize: 28, fontWeight: 800, outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* ── Official Google Pay Standee Card (NPCI Spec) ── */}
            <div style={{ marginBottom: 14 }}>
              <GooglePayStandeeCard
                qrId="al-mawaid-payer-qr"
                upiUri={upiUri}
                payeeName={payeeName}
                phoneNumber="+91 63752 50267"
                upiId={configuredUpiId}
                amount={activePayAmount}
                size={195}
              />
            </div>

            {/* Save QR to Gallery Button */}
            <button
              type="button"
              onClick={handleSaveQrToGallery}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 12,
                border: `1px solid ${t.border}`, background: 'rgba(255,255,255,0.06)',
                color: t.text, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                marginBottom: 10
              }}
            >
              <Download size={15} color={t.accent} />
              <span>Save QR to Gallery (For Single Phone Users)</span>
            </button>

            {/* 1-Tap Pay Button */}
            <button
              type="button"
              onClick={handle1TapPay}
              disabled={openingUpi || !isPaymentActive}
              style={{
                width: '100%', padding: '14px 18px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff',
                fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)', marginBottom: 10
              }}
            >
              <Smartphone size={18} />
              <span>{openingUpi ? 'Opening UPI App…' : `Pay ₹${formatInr(activePayAmount)} via UPI App`}</span>
            </button>

            {/* Copy UPI ID Button */}
            <button
              type="button"
              onClick={handleCopyUpiId}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 12, border: `1px solid ${t.border}`,
                background: 'transparent', color: t.textSub, fontSize: 12.5, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              {copiedUpi ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
              <span>{copiedUpi ? 'Copied to Clipboard!' : `Copy UPI ID: ${configuredUpiId}`}</span>
            </button>

            {/* Notice for First-Time Payers Seeing Bank Risk Warnings */}
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 10,
              background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)',
              color: t.textSub, fontSize: 11.5, lineHeight: 1.45
            }}>
              <strong style={{ color: t.text, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span>💡</span> Seeing "Transaction is Risky" or blocked on your phone?
              </strong>
              <span>
                UPI apps flag 1-tap browser links for some first-time payees. <strong>Fix:</strong> Tap <strong>Save QR to Gallery</strong> above ➔ Open GPay/PhonePe ➔ Scan QR ➔ <strong>Upload from Gallery</strong> to pay without any warning.
              </span>
            </div>

            {/* ── Member UTR Verification Section ── */}
            <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 14, marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 11.5, color: t.textSub, marginBottom: 6, fontWeight: 600 }}>
                After paying, enter the 12-digit UPI Ref / UTR No. to confirm:
              </label>
              <form onSubmit={handleMemberSubmitUtr} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  maxLength={16}
                  placeholder="e.g. 429810394812"
                  value={payerUtr}
                  onChange={(e) => setPayerUtr(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10,
                    border: `1px solid ${t.border}`, background: t.inputBg,
                    color: t.text, fontSize: 13, fontFamily: 'monospace', outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={submittingPayerUtr || !payerUtr.trim()}
                  style={{
                    padding: '10px 16px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
                    fontSize: 12.5, fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  {submittingPayerUtr ? 'Marking…' : 'Mark Paid'}
                </button>
              </form>
            </div>
          </div>

          {/* Member's Personal Payment Receipts History */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: t.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              My Payment Records &amp; Slips
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: t.textSub, fontSize: 13 }}>
              Loading your payment records…
            </div>
          ) : myPayments.length === 0 ? (
            <div style={{ padding: '30px 16px', borderRadius: 16, background: t.card, border: `1px solid ${t.border}`, textAlign: 'center' }}>
              <Receipt size={32} color={t.accent} style={{ opacity: 0.5, marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>No payment records yet</div>
              <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
                Scan or pay via UPI above, then submit your UTR to receive your verified slip.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myPayments.map(p => {
                const isVerified = p.status === 'verified'
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedReceipt(p)}
                    style={{
                      padding: '12px 14px', borderRadius: 14, background: t.card,
                      border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center',
                      gap: 12, cursor: 'pointer'
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: isVerified ? 'rgba(52, 211, 153, 0.12)' : 'rgba(251, 191, 36, 0.12)',
                      border: `1px solid ${isVerified ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {isVerified ? <ShieldCheck size={18} color="#34d399" /> : <Clock size={18} color="#fbbf24" />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: t.text }}>
                          ₹{formatInr(p.amount)}
                        </span>
                        <span style={{
                          fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase',
                          padding: '2px 6px', borderRadius: 6,
                          background: isVerified ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                          color: isVerified ? '#34d399' : '#fbbf24'
                        }}>
                          {isVerified ? 'Verified' : 'Review'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: t.textSub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {p.transaction_ref && ` • Ref: ${p.transaction_ref}`}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadPayslipPdf({
                          payment: p,
                          memberName: userProfile?.name || p.user_name,
                          thaliNumber: userProfile?.thali_number || p.thali_number,
                          payeeUpi: p.upi_id || configuredUpiId,
                          payeeName: p.payee_name || payeeName,
                          monthLabel: monthLabelOf(monthKeyOf(new Date(p.created_at)))
                        })
                      }}
                      style={{
                        background: t.accentBg, border: `1px solid ${t.accentBorder}`,
                        color: t.accent, borderRadius: 8, padding: '6px 8px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700
                      }}
                    >
                      <Download size={13} />
                      <span>PDF</span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL 1: DIGITAL RECEIPT SLIP ── */}
      {selectedReceipt && (
        <div
          onClick={() => setSelectedReceipt(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.card, borderRadius: '24px 24px 0 0', borderTop: `2px solid ${t.accent}`,
              maxWidth: 440, width: '100%', padding: '16px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 999, background: t.border, margin: '0 auto 14px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display', serif" }}>
                Payment Receipt
              </h3>
              <button onClick={() => setSelectedReceipt(null)} style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: t.inputBg, borderRadius: 14, padding: 14, border: `1px solid ${t.border}`, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: t.textSub }}>Member</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{selectedReceipt.user_name || 'Member'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: t.textSub }}>Amount</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: t.accent }}>₹{formatInr(selectedReceipt.amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: t.textSub }}>Status</span>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: selectedReceipt.status === 'verified' ? '#34d399' : '#fbbf24' }}>
                  {selectedReceipt.status === 'verified' ? 'Verified ✅' : 'Under Review 🕒'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: t.textSub }}>Method</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{selectedReceipt.payment_method || 'UPI Pay'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: t.textSub }}>Date</span>
                <span style={{ fontSize: 12, color: t.text }}>{new Date(selectedReceipt.created_at).toLocaleString('en-GB')}</span>
              </div>
              {selectedReceipt.transaction_ref && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: t.textSub }}>Ref / UTR</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.text, fontFamily: 'monospace' }}>{selectedReceipt.transaction_ref}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setSelectedReceipt(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={() => downloadPayslipPdf({
                  payment: selectedReceipt,
                  memberName: userProfile?.name || selectedReceipt.user_name,
                  thaliNumber: userProfile?.thali_number || selectedReceipt.thali_number,
                  payeeUpi: selectedReceipt.upi_id || configuredUpiId,
                  payeeName: selectedReceipt.payee_name || payeeName,
                  monthLabel: monthLabelOf(monthKeyOf(new Date(selectedReceipt.created_at)))
                })}
                style={{
                  flex: 1.5, padding: '12px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #B8860B, #D4AF37)', color: '#000',
                  fontSize: 13.5, fontWeight: 900, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 6
                }}
              >
                <Download size={15} />
                <span>Download PDF Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: MANUAL RECORD PAYMENT (Manager) ── */}
      {showRecordModal && isManager && (
        <div
          onClick={() => setShowRecordModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.card, borderRadius: '24px 24px 0 0', borderTop: `2px solid ${t.accent}`,
              maxWidth: 440, width: '100%', padding: '16px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 999, background: t.border, margin: '0 auto 14px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display', serif" }}>
                  Record Payment
                </h3>
                <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
                  {selectedUserToRecord ? `For ${selectedUserToRecord.name}` : 'Record Cash or Direct Transfer'}
                </div>
              </div>
              <button onClick={() => setShowRecordModal(false)} style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: t.textSub, marginBottom: 4 }}>
                  Payment Method *
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Cash', 'UPI Pay'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRecordMethod(m)}
                      style={{
                        flex: 1, padding: '9px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
                        border: recordMethod === m ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
                        background: recordMethod === m ? t.accentBg : t.inputBg,
                        color: recordMethod === m ? t.accent : t.textSub, cursor: 'pointer'
                      }}
                    >
                      {m === 'Cash' ? '💵 Cash' : '💳 UPI / Online'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: t.textSub, marginBottom: 4 }}>
                  Amount Paid (₹) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={recordAmount}
                  onChange={(e) => setRecordAmount(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
                    border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 16,
                    fontWeight: 700, outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: t.textSub, marginBottom: 4 }}>
                  UPI Reference / UTR Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 427819283921"
                  value={recordUtr}
                  onChange={(e) => setRecordUtr(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
                    border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13,
                    fontFamily: 'monospace', outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: t.textSub, marginBottom: 4 }}>
                  Note / Remark
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly Contribution"
                  value={recordNote}
                  onChange={(e) => setRecordNote(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
                    border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRecord}
                  style={{
                    flex: 1.5, padding: '11px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
                    fontSize: 13, fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  {submittingRecord ? 'Saving…' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: NOTIFICATIONS / ALERTS (Manager) ── */}
      {showNotifyModal && isManager && (
        <div
          onClick={() => setShowNotifyModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.card, borderRadius: 20, border: `1.5px solid ${t.accentBorder}`,
              maxWidth: 440, width: '100%', padding: '20px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>
                {notifyTargetUser ? `Notify ${notifyTargetUser.name}` : `Notify All Unpaid Members (${managerMetrics.unpaidCount})`}
              </h3>
              <button onClick={() => setShowNotifyModal(false)} style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Template Presets */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: t.textSub, marginBottom: 5 }}>
                Template
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { id: 'standard', label: 'Standard' },
                  { id: 'urgent', label: 'Urgent ⚠️' },
                  { id: 'final', label: 'Final Notice 🔔' }
                ].map(tmp => (
                  <button
                    key={tmp.id}
                    type="button"
                    onClick={() => handleApplyTemplate(tmp.id)}
                    style={{
                      flex: 1, padding: '6px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      border: notifyTemplate === tmp.id ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
                      background: notifyTemplate === tmp.id ? t.accentBg : t.inputBg,
                      color: notifyTemplate === tmp.id ? t.accent : t.textSub, cursor: 'pointer'
                    }}
                  >
                    {tmp.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: t.textSub, marginBottom: 4 }}>Title</label>
                <input
                  type="text"
                  required
                  value={notifyTitle}
                  onChange={(e) => setNotifyTitle(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: t.textSub, marginBottom: 4 }}>Message</label>
                <textarea
                  rows={3}
                  required
                  value={notifyBody}
                  onChange={(e) => setNotifyBody(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 12.5, outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowNotifyModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkNotifying}
                  style={{
                    flex: 1.5, padding: '10px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000',
                    fontSize: 12.5, fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  {bulkNotifying ? 'Dispatching…' : 'Send Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: SETTINGS CONFIGURATION (Manager) ── */}
      {showSettingsModal && isManager && (
        <div
          onClick={() => setShowSettingsModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: t.card, borderRadius: 20, border: `1.5px solid ${t.accentBorder}`,
              maxWidth: 420, width: '100%', padding: '20px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>
                Payment Configuration
              </h3>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: t.textSub, marginBottom: 3 }}>
                  Standard Due Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={defaultDue}
                  onChange={(e) => setDefaultDue(Number(e.target.value))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 14, fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: t.textSub, marginBottom: 3 }}>
                  Receiver UPI ID (VPA) *
                </label>
                <input
                  type="text"
                  required
                  value={configuredUpiId}
                  onChange={(e) => setConfiguredUpiId(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, fontFamily: 'monospace', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: t.textSub, marginBottom: 3 }}>
                  Payee / Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: t.textSub, marginBottom: 3 }}>
                  Cycle Title
                </label>
                <input
                  type="text"
                  required
                  value={paymentTitle}
                  onChange={(e) => setPaymentTitle(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: 13, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1.5, padding: '10px', borderRadius: 10, border: 'none',
                    background: t.accentGrad, color: '#000', fontSize: 13, fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

// Simple Revert / Rotate icon helper
function RotateCcwIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}
