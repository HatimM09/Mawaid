import React, { useState, useEffect, useMemo, useCallback } from 'react'
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

export default function PaymentsPage({ onBack, appSettings = {} }) {
  const t = useTheme()
  const { user } = useAuth()

  // Settings & Configuration
  const [configuredUpiId, setConfiguredUpiId] = useState(appSettings.upi_id || 'murtazacool558@okhdfcbank')
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
  const [showQRModal, setShowQRModal] = useState(false)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState(null)

  // Record Form state
  const [utrNumber, setUtrNumber] = useState('')
  const [recordAmount, setRecordAmount] = useState('')
  const [recordNote, setRecordNote] = useState('')
  const [submittingRecord, setSubmittingRecord] = useState(false)

  // Dynamic synchronization when appSettings change from realtime or parent
  useEffect(() => {
    if (appSettings.upi_id) setConfiguredUpiId(appSettings.upi_id)
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
  const handleCopyUpi = () => {
    navigator.clipboard.writeText(configuredUpiId)
    setCopiedUpi(true)
    toast.success('UPI ID copied to clipboard!')
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  // Construct fail-safe UPI URL matching NPCI & Google Pay specifications
  const numericAmount = Math.max(1, parseFloat(amount) || 0)
  const sanitizedNote = (customNote || `Al-Mawaid Thali Contribution`).replace(/[^a-zA-Z0-9 -]/g, '').trim()
  const txnRefId = useMemo(() => `ALM${Date.now().toString().slice(-8)}`, [amount])

  const upiUrl = useMemo(() => {
    const cleanUpi = (configuredUpiId || 'murtazacool558@okhdfcbank').trim()
    const cleanPayee = (payeeName || 'Al-Mawaid').trim()
    const query = [
      `pa=${encodeURIComponent(cleanUpi)}`,
      `pn=${encodeURIComponent(cleanPayee)}`,
      `am=${numericAmount.toFixed(2)}`,
      `cu=INR`,
      `tn=${encodeURIComponent(sanitizedNote)}`,
      `tr=${encodeURIComponent(txnRefId)}`
    ].join('&')

    return `upi://pay?${query}`
  }, [configuredUpiId, payeeName, numericAmount, sanitizedNote, txnRefId])

  // Detect Mobile device vs Desktop
  const isMobileDevice = useMemo(() => {
    if (typeof window === 'undefined') return true
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }, [])

  // Initiate Payment via Google Pay / UPI with zero errors & smart device fallback
  const handlePayViaGooglePay = () => {
    if (numericAmount <= 0) {
      toast.error('Please enter a valid amount (minimum ₹1)')
      return
    }

    setRecordAmount(numericAmount.toString())
    setRecordNote(sanitizedNote)

    if (!isMobileDevice) {
      // Desktop / Laptop: Show high-res QR code for scanning
      setShowQRModal(true)
      return
    }

    // Mobile: Launch Google Pay via standard UPI protocol
    try {
      // Setup tracking modal on return
      setTimeout(() => {
        setShowRecordModal(true)
      }, 1500)

      // Use hidden link trigger for universal browser compatibility (avoids popup blockers)
      const link = document.createElement('a')
      link.href = upiUrl
      link.rel = 'noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) {
      console.warn('Direct UPI launch failed, opening QR fallback:', e)
      setShowQRModal(true)
    }
  }

  // Submit payment record into Supabase & Notify Mulla Murtaza Hamid
  const handleRecordPayment = async (e) => {
    e?.preventDefault()
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
        payment_method: 'Google Pay',
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
      setNotifyBody(`Dear ${targetUser.name || 'Member'}, your thali contribution of ₹${defaultDue} is pending. Please open your Al-Mawaid app and pay via Google Pay.`)
    } else {
      const activeUnpaidCount = allUsers.filter(u => !u.payment_exempt && allPayments.filter(p => p.user_id === u.user_id).length === 0).length
      setNotifyTitle(`Thali Contribution Reminder`)
      setNotifyBody(`Dear Member, your monthly thali contribution of ₹${defaultDue} is due. Please pay via Google Pay on your portal. Thank you for your support.`)
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
      setNotifyBody(`Dear ${nameStr}, this is a gentle reminder that your thali contribution of ₹${defaultDue} is due. Please pay via Google Pay on the Al-Mawaid portal.`)
    } else if (tempKey === 'urgent') {
      setNotifyTitle('⚠️ Urgent: Payment Due')
      setNotifyBody(`Dear ${nameStr}, your thali contribution of ₹${defaultDue} is pending. Kindly clear the dues via Google Pay today to avoid any interruption in thali services.`)
    } else if (tempKey === 'final') {
      setNotifyTitle('🔔 Final Notice: Thali Contribution')
      setNotifyBody(`Salam ${nameStr}, this is the final reminder for this month's thali contribution of ₹${defaultDue}. Please pay using Google Pay (UPI: ${configuredUpiId}).`)
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
      `Salam ${targetUser.name || 'Bhai'},\n\nThis is a gentle reminder regarding your Al-Mawaid Thali contribution of *₹${defaultDue}* for ${paymentTitle}.\n\nPlease pay directly via Google Pay to UPI ID: *${configuredUpiId}*.\n\nThank you,\n*Mulla Murtaza Hamid*\nAl-Mawaid Management`
    )
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank')
  }

  // ── MANAGER: Save App Payment Settings ──
  const handleSaveSettings = async (e) => {
    e.preventDefault()
    try {
      const items = [
        { key: 'upi_id', value: configuredUpiId.trim() },
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
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 740, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
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
            <span>My Google Pay</span>
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
              <Search size={16} color={t.textSub} style={{ position: 'absolute', left: 12 }} />
              <input
                type="text"
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
          VIEW 2: INDIVIDUAL PAYER SCREEN (Google Pay + Personal Receipts)
         ══════════════════════════════════════════════════════════════════════ */}
      {(!isManager || portalMode === 'payer') && (
        <div>
          {/* Outstanding Due & Quick Pay Banner */}
          <div style={{
            position: 'relative',
            borderRadius: 24,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #131b2e 0%, #0a0d18 100%)',
            border: `1.5px solid ${t.borderActive || 'rgba(197,160,89,0.3)'}`,
            boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
            padding: '24px 20px',
            marginBottom: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: t.accent, background: t.accentBg, padding: '3px 9px', borderRadius: 20, border: `1px solid ${t.accentBorder}` }}>
                    {paymentTitle}
                  </span>
                  {userProfile?.thali_number && (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                      Thali #{userProfile.thali_number}
                    </span>
                  )}
                  {userProfile?.payment_exempt && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.3)' }}>
                      Exempt / Forfeited
                    </span>
                  )}
                </div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: "'DM Sans', sans-serif" }}>
                  Amount Due to Pay
                </h2>
              </div>

              <button
                onClick={() => { setRefreshing(true); loadData() }}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  borderRadius: 10,
                  padding: 6,
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Refresh payments"
              >
                <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
              </button>
            </div>

            {/* Editable Amount Display */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: t.accent }}>₹</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px dashed ${t.accent}`,
                  color: '#ffffff',
                  fontSize: 34,
                  fontWeight: 800,
                  fontFamily: "'Playfair Display', serif",
                  width: '180px',
                  outline: 'none',
                  padding: '0 4px'
                }}
              />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginLeft: 4 }}>
                (Tap to edit)
              </span>
            </div>

            {/* Quick Amount Selector Pills */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              {[500, 1000, 1500, 2000, 3000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val.toString())}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    border: `1px solid ${Number(amount) === val ? t.accent : 'rgba(255,255,255,0.12)'}`,
                    background: Number(amount) === val ? t.accentBg : 'rgba(255,255,255,0.04)',
                    color: Number(amount) === val ? t.accent : 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ₹{val}
                </button>
              ))}
            </div>

            {/* Receiver UPI Info Strip */}
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 14,
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 18,
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Receiver UPI VPA
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4f8', fontFamily: 'monospace', marginTop: 1 }}>
                  {configuredUpiId}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleCopyUpi}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 10px',
                    color: '#fff',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer'
                  }}
                >
                  {copiedUpi ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
                  <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={() => setShowQRModal(true)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 10px',
                    color: '#fff',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer'
                  }}
                  title="Show QR Code"
                >
                  <QrCode size={13} />
                  <span>QR</span>
                </button>
              </div>
            </div>

            {/* Main Action Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handlePayViaGooglePay}
                style={{
                  flex: 1,
                  padding: '14px 18px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'linear-gradient(135deg, #4285F4 0%, #34A853 50%, #FBBC05 75%, #EA4335 100%)',
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 800,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 6px 20px rgba(66, 133, 244, 0.35)',
                  transition: 'transform 0.15s ease',
                }}
              >
                <div style={{ background: '#fff', padding: '2px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#4285F4', fontFamily: 'sans-serif' }}>G</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#EA4335', fontFamily: 'sans-serif' }}>P</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#FBBC05', fontFamily: 'sans-serif' }}>a</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#34A853', fontFamily: 'sans-serif' }}>y</span>
                </div>
                <span>Pay ₹{numericAmount}</span>
                <ArrowUpRight size={16} />
              </button>

              <button
                onClick={() => {
                  setSelectedUserToPay(null)
                  setRecordAmount(numericAmount.toString())
                  setRecordNote(upiTransactionNote)
                  setShowRecordModal(true)
                }}
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: `1px solid ${t.border}`,
                  background: 'rgba(255,255,255,0.06)',
                  color: t.text,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Receipt size={16} color={t.accent} />
                <span>Record UTR</span>
              </button>
            </div>
          </div>

          {/* Personal Transaction Tracking History */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.text, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>
              My Payment History
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: t.textSub, fontSize: 13 }}>
              Loading your payment records…
            </div>
          ) : myPayments.length === 0 ? (
            <div style={{ padding: '36px 20px', borderRadius: 18, background: t.card, border: `1px solid ${t.border}`, textAlign: 'center' }}>
              <Receipt size={36} color={t.accent} style={{ opacity: 0.5, marginBottom: 10 }} />
              <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: t.text }}>No payment records yet</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: t.textSub }}>
                When you make a payment via Google Pay or submit your UTR reference, your receipts will appear here.
              </p>
              <Btn primary onClick={handlePayViaGooglePay} style={{ padding: '10px 20px', fontSize: 13, display: 'inline-flex' }}>
                Pay with Google Pay Now
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
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
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
                      <div style={{ fontSize: 12, color: t.textSub }}>
                        {dateStr} {p.transaction_ref && `• Ref: ${p.transaction_ref}`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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

      {/* ── QR CODE MODAL ── */}
      {showQRModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: t.card, borderRadius: 24, border: `1.5px solid ${t.accentBorder}`,
            maxWidth: 360, width: '100%', padding: 24, textAlign: 'center'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display', serif" }}>
                Scan with Google Pay
              </div>
              <button onClick={() => setShowQRModal(false)} style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#ffffff', padding: 16, borderRadius: 16, display: 'inline-block', margin: '0 auto 16px' }}>
              <QRCodeCanvas value={upiUrl} size={220} level="H" />
            </div>

            <div style={{ fontSize: 18, fontWeight: 800, color: t.accent, marginBottom: 4 }}>
              ₹{numericAmount.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: 12, color: t.textSub, fontFamily: 'monospace', marginBottom: 16 }}>
              {configuredUpiId}
            </div>

            <Btn primary onClick={() => { setShowQRModal(false); setShowRecordModal(true) }} style={{ width: '100%' }}>
              I have paid — Enter UTR
            </Btn>
          </div>
        </div>
      )}

      {/* ── RECORD PAYMENT / UTR MODAL ── */}
      {showRecordModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{ background: t.card, borderRadius: 24, border: `1.5px solid ${t.border}`, maxWidth: 420, width: '100%', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display', serif" }}>
                  {isManager && selectedUserToPay ? `Record Payment for ${selectedUserToPay.name}` : "Record Payment Details"}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: t.textSub }}>
                  {isManager ? "Manually record cash or direct bank transfer" : "Log your transaction for verification"}
                </p>
              </div>
              <button onClick={() => setShowRecordModal(false)} style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Amount Paid (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={recordAmount}
                  onChange={(e) => setRecordAmount(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 16, fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Google Pay UPI Reference / UTR # {isManager ? "(Optional)" : "(Optional)"}
                </label>
                <input
                  type="text"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="e.g. 427819283921"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 14, fontFamily: 'monospace', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Remark / Note
                </label>
                <input
                  type="text"
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Standard Due Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  value={defaultDue}
                  onChange={(e) => setDefaultDue(Number(e.target.value))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 15, fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Receiver UPI ID (VPA)
                </label>
                <input
                  type="text"
                  required
                  value={configuredUpiId}
                  onChange={(e) => setConfiguredUpiId(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 14, fontFamily: 'monospace', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Payee / Business Name
                </label>
                <input
                  type="text"
                  required
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 12, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 14, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Payment Cycle / Title
                </label>
                <input
                  type="text"
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

      {/* ── DIGITAL RECEIPT VIEW MODAL ── */}
      {selectedReceipt && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{ background: t.card, borderRadius: 24, border: `1.5px solid ${t.borderActive || t.border}`, maxWidth: 380, width: '100%', padding: 24, position: 'relative' }}>
            <button onClick={() => setSelectedReceipt(null)} style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.06)', border: 'none', color: t.textSub, cursor: 'pointer', borderRadius: 8, padding: 4 }}>
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

            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 16, padding: 16, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 18 }}>
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

            <Btn primary onClick={() => setSelectedReceipt(null)} style={{ width: '100%' }}>
              Close
            </Btn>
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Notification Title *
                </label>
                <input
                  type="text"
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                  Message Content *
                </label>
                <textarea
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
