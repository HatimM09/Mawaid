// src/admin/NotificationsAdminPage.jsx
// Notification Center — 65/35 split pane design with live preview & history sidebar
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Clock, Users, User, Trash2,
  Calendar, CheckCircle2,
  Bell, Megaphone, BookTemplate, LayoutList, BarChart3,
  Search, Eye, Save, Clock3,
  XCircle, RefreshCw,
  Target,
  X, Upload, Rocket
} from 'lucide-react'
import { supabase, db, C, getCol, getDocRef } from '../lib/firebaseClient'
import {
  T, PageWrap, PageTitle, AdminCard, Badge, Btn, Spinner,
  Modal, SlideDrawer, fmtDateTime
} from './ui'

const STATUS_COLORS = {
  pending: '#f59e0b',
  sending: '#60a5fa',
  sent: '#34d399',
  failed: '#ef4444',
  scheduled: '#a78bfa'
}

const TONES = [
  { value: 'var(--accent-primary)', label: 'Golden', color: '#c5a059' },
  { value: '#34d399', label: 'Forest Green', color: '#34d399' },
  { value: '#ef4444', label: 'Ruby', color: '#ef4444' },
  { value: '#60a5fa', label: 'Sky Blue', color: '#60a5fa' },
]

const CHANNEL_OPTIONS = [
  { value: 'in-app', label: 'In-App' },
  { value: 'push', label: 'Push' },
  { value: 'email', label: 'Email' },
]

const DELIVERY_OPTIONS = [
  { value: 'now', label: 'Now' },
  { value: 'schedule', label: 'Schedule for later' },
]

const DEFAULT_FORM = {
  title: '',
  body: '',
  sender_name: 'Admin',
  scheduled_at: '',
  target_type: 'all',
  target_user_id: '',
  tone: 'var(--accent-primary)',
  media_url: '',
  channel: 'in-app',
  delivery: 'now',
}

export default function NotificationsAdminPage() {
  // ── State ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Data
  const [notices, setNotices] = useState([])
  const [users, setUsers] = useState([])
  const [templates, setTemplates] = useState([])
  const [schedule, setSchedule] = useState([])
  const [pushSubs, setPushSubs] = useState(0)
  const [realPushSubs, setRealPushSubs] = useState(0)

  // Form
  const [form, setForm] = useState(DEFAULT_FORM)
  const [activeView, setActiveView] = useState('compose') // 'compose' or 'history'

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [detailNotice, setDetailNotice] = useState(null)

  // Stats
  const [stats, setStats] = useState({
    total: 0, sent: 0, pending: 0, failed: 0, scheduled: 0, templates: 0
  })

  // Realtime
  const scheduleChannel = useRef(null)
  const noticesChannel = useRef(null)
  const pushSubsChannel = useRef(null)

  // Drag-and-drop state
  const [dragOver, setDragOver] = useState(false)
  const [droppedFile, setDroppedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef(null)

  // Presets dropdown
  const [presetOpen, setPresetOpen] = useState(false)

  // Save template modal
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')

  // ── Fetch Data ──────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [nRes, uRes, tRes, sRes, pRes, psRes] = await Promise.all([
        supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('user_stats').select('user_id, name, thali_number').order('name'),
        supabase.from('broadcast_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('broadcast_schedule').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }),
        supabase.from('push_subscriptions').select('user_id, token_type, subscription_json, fcm_token'),
      ])

      if (nRes.data) setNotices(nRes.data)
      if (uRes.data) setUsers(uRes.data)
      if (tRes.data) setTemplates(tRes.data)
      if (sRes.data) setSchedule(sRes.data)
      if (pRes.count !== null) setPushSubs(pRes.count)

      // Calculate real subscribers (users with valid push tokens)
      const validSubs = psRes.data?.filter(s => 
        (s.token_type === 'expo' && s.fcm_token) ||
        (s.token_type === 'webpush' && s.subscription_json)
      ) || []
      const uniqueUsersWithValidSubs = new Set(validSubs.map(s => s.user_id)).size
      setRealPushSubs(uniqueUsersWithValidSubs)

      const scheduleData = sRes.data || []
      setStats({
        total: nRes.data?.length || 0,
        sent: scheduleData.filter(s => s.status === 'sent').length,
        pending: scheduleData.filter(s => s.status === 'pending').length,
        failed: scheduleData.filter(s => s.status === 'failed').length,
        scheduled: scheduleData.filter(s => s.status === 'scheduled').length,
        templates: tRes.data?.length || 0,
      })
    } catch (err) {
      console.error('Error fetching data:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Realtime subscriptions ───────────────────────────────────
  useEffect(() => {
    // Listen for broadcast_schedule changes (scheduled broadcast status updates)
    scheduleChannel.current = supabase
      .channel('broadcast-schedule-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'broadcast_schedule' },
        () => fetchAll()
      )
      .subscribe()

    // Listen for notices table changes (new broadcasts composed from any admin)
    noticesChannel.current = supabase
      .channel('notices-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notices' },
        () => fetchAll()
      )
      .subscribe()

    // Listen for push_subscriptions changes so subscriber count updates live
    pushSubsChannel.current = supabase
      .channel('push-subs-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'push_subscriptions' },
        () => fetchAll()
      )
      .subscribe()

    return () => {
      if (scheduleChannel.current) supabase.removeChannel(scheduleChannel.current)
      if (noticesChannel.current) supabase.removeChannel(noticesChannel.current)
      if (pushSubsChannel.current) supabase.removeChannel(pushSubsChannel.current)
    }
  }, [fetchAll])

  // ── Helpers ──────────────────────────────────────────────────
  const getTargetCount = (targetType, targetUserId) => {
    if (targetType === 'specific' && targetUserId) return 1
    if (targetType === 'all' || targetType === 'admins') return realPushSubs || users.length
    return users.length
  }

  // ── Send Broadcast ───────────────────────────────────────────
  const handleSend = async () => {
    if (!form.title || !form.body) {
      alert('Title and Message are required')
      return
    }
    setSubmitting(true)

    const targetCount = getTargetCount(form.target_type, form.target_user_id)
    const now = new Date().toISOString()
    const isScheduled = form.delivery === 'schedule' && form.scheduled_at

    const payload = {
      title: form.title,
      body: form.body,
      sender_name: form.sender_name,
      media: form.media_url ? [form.media_url] : [],
      scheduled_at: isScheduled ? form.scheduled_at : now,
      target_user_id: form.target_type === 'specific' ? form.target_user_id : null,
      tone: form.tone,
      channel: form.channel,
      created_at: now,
    }

    const { data: noticeData, error: noticeError } = await supabase
      .from('notices')
      .insert([payload])
      .select()
      .single()

    if (noticeError) {
      alert('Error saving notice: ' + noticeError.message)
      setSubmitting(false)
      return
    }

    const scheduleEntry = {
      notice_id: noticeData.id,
      title: form.title,
      body: form.body,
      sender_name: form.sender_name,
      tone: form.tone,
      media_url: form.media_url,
      target_type: form.target_type,
      target_user_id: form.target_type === 'specific' ? form.target_user_id : null,
      channel: form.channel,
      status: isScheduled ? 'scheduled' : 'sending',
      scheduled_for: isScheduled ? form.scheduled_at : now,
      total_targets: targetCount,
      sent_count: 0,
      failed_count: 0,
      created_by: (await supabase.auth.getUser()).data?.user?.id,
    }

    await supabase.from('broadcast_schedule').insert([scheduleEntry])

    if (!isScheduled) {
      let sentCount = 0
      let failedCount = 0
      if (form.channel === 'push') {
        try {
          const { data: pushResult, error: pushError } = await supabase.functions.invoke('sendPush', {
            body: {
              title: form.title,
              body: form.body,
              user_id: form.target_type === 'specific' ? form.target_user_id : null,
              target_type: form.target_type === 'all' ? null : form.target_type,
              image_url: form.media_url || undefined,
              sender_name: form.sender_name,
            }
          })
          if (pushError) throw pushError
          sentCount = pushResult?.sent || 0
          failedCount = pushResult?.failed || 0
        } catch (err) {
          console.error('Push trigger error:', err)
          failedCount = targetCount
        }
      } else {
        sentCount = targetCount
      }

      await supabase.from('broadcast_schedule')
        .update({ status: failedCount > 0 && sentCount === 0 ? 'failed' : 'sent', sent_at: now, sent_count: sentCount, failed_count: failedCount })
        .eq('notice_id', noticeData.id)
    }

    setForm(DEFAULT_FORM)
    setDroppedFile(null)
    setUploadProgress(0)
    fetchAll()
    setSubmitting(false)
  }

  // ── Save as Template ─────────────────────────────────────────
  const saveAsTemplate = async () => {
    if (!saveTemplateName.trim()) return
    const { error } = await supabase.from('broadcast_templates').insert([{
      name: saveTemplateName.trim(),
      title: form.title,
      body: form.body,
      sender_name: form.sender_name,
      tone: form.tone,
      media_url: form.media_url,
      target_type: form.target_type,
      created_by: (await supabase.auth.getUser()).data?.user?.id,
    }])
    if (error) {
      alert('Error saving template: ' + error.message)
    } else {
      setShowSaveModal(false)
      setSaveTemplateName('')
      fetchAll()
    }
  }

  // ── Upload file to Supabase Storage ──────────────────────────
  const uploadFile = async (file) => {
    if (!file) return
    setUploading(true)
    setUploadProgress(0)

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file)
    setForm(prev => ({ ...prev, media_url: localUrl }))
    setDroppedFile(file)

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `broadcast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

    try {
      const { data, error } = await supabase.storage
        .from('broadcast-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) throw error

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('broadcast-media')
        .getPublicUrl(fileName)

      setForm(prev => ({ ...prev, media_url: publicUrl }))
      setUploadProgress(100)
    } catch (err) {
      console.error('Upload error:', err)
      alert('Failed to upload image: ' + err.message)
      // Keep local preview but user will see it didn't persist
    }
    setUploading(false)
  }

  // ── File drop handler ───────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      uploadFile(file)
    } else if (file) {
      alert('Please drop an image file (PNG, JPEG, WebP, GIF)')
    }
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      uploadFile(file)
    }
  }, [])

  const handleRemoveFile = useCallback(() => {
    setDroppedFile(null)
    setUploadProgress(0)
    setForm(prev => ({ ...prev, media_url: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // ── Load template ────────────────────────────────────────────
  const loadTemplate = (tpl) => {
    setDroppedFile(null)
    setUploadProgress(0)
    setForm({
      title: tpl.title || '',
      body: tpl.body || '',
      sender_name: tpl.sender_name || 'Admin',
      scheduled_at: '',
      target_type: tpl.target_type || 'all',
      target_user_id: '',
      tone: tpl.tone || 'var(--accent-primary)',
      media_url: tpl.media_url || '',
      channel: 'in-app',
      delivery: 'now',
    })
    setActiveView('compose')
    setPresetOpen(false)
  }

  // ── Delete actions ───────────────────────────────────────────
  const deleteNotice = async (id) => {
    if (!window.confirm('Delete this broadcast?')) return
    await supabase.from('notices').delete().eq('id', id)
    await supabase.from('broadcast_schedule').delete().eq('notice_id', id)
    fetchAll()
    if (detailNotice?.id === id) setDetailNotice(null)
  }

  const deleteScheduleEntry = async (id) => {
    if (!window.confirm('Delete this schedule entry?')) return
    await supabase.from('broadcast_schedule').delete().eq('id', id)
    fetchAll()
  }

  // ── Resend ───────────────────────────────────────────────────
  const resendBroadcast = async (entry) => {
    const { error } = await supabase.from('broadcast_schedule')
      .update({ status: 'sending', failed_count: 0 })
      .eq('id', entry.id)
    if (error) return

    let sentCount = 0
    let failedCount = 0
    if (entry.channel === 'push') {
      try {
        const { data: pushResult, error: pushError } = await supabase.functions.invoke('sendPush', {
          body: {
            title: entry.title,
            body: entry.body,
            user_id: entry.target_type === 'specific' ? entry.target_user_id : null,
            target_type: entry.target_type === 'all' ? null : entry.target_type,
            url: entry.media_url || '/',
            image_url: entry.media_url || undefined,
            sender_name: entry.sender_name || 'Admin',
          }
        })
        if (pushError) throw pushError
        sentCount = pushResult?.sent || 0
        failedCount = pushResult?.failed || 0
      } catch (err) {
        console.error('Push trigger error:', err)
        failedCount = entry.total_targets || 1
      }
    } else {
      sentCount = entry.total_targets || 1
    }

    await supabase.from('broadcast_schedule')
      .update({ status: failedCount > 0 && sentCount === 0 ? 'failed' : 'sent', sent_at: new Date().toISOString(), sent_count: sentCount, failed_count: failedCount })
      .eq('id', entry.id)
    fetchAll()
  }

  // ── Filtered data ────────────────────────────────────────────
  const recentBroadcasts = notices.filter(n => {
    const match = schedule.find(s => s.notice_id === n.id)
    return !match || match.status !== 'scheduled'
  }).slice(0, 15)

  const scheduledBroadcasts = schedule.filter(s =>
    s.status === 'scheduled' || s.status === 'pending'
  ).slice(0, 15)

  const filteredHistory = [...notices].filter(n => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return n.title?.toLowerCase().includes(q) ||
      n.body?.toLowerCase().includes(q) ||
      n.sender_name?.toLowerCase().includes(q)
  }).slice(0, 20)

  // ── Status color for history items ───────────────────────────
  const getNoticeStatus = (notice) => {
    const entry = schedule.find(s => s.notice_id === notice.id)
    return entry?.status || 'sent'
  }

  // ── Relative time ────────────────────────────────────────────
  const timeAgo = (dateStr) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
    const days = Math.floor(hrs / 24)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }

  // ── Live Mobile Preview ──────────────────────────────────────
  const MobilePreview = () => (
    <div style={{
      width: '100%', maxWidth: 320, margin: '0 auto',
      background: 'rgba(10, 8, 6, 0.8)', borderRadius: 28,
      border: '2px solid rgba(212, 175, 55, 0.12)',
      overflow: 'hidden', position: 'relative',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
      backdropFilter: 'blur(20px)'
    }}>
      {/* Phone notch */}
      <div style={{
        display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4
      }}>
        <div style={{
          width: 90, height: 6, borderRadius: 20,
          background: 'rgba(255,255,255,0.15)',
        }} />
      </div>

      {/* Notification card inside phone */}
      <div style={{ padding: '12px 16px 20px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(197, 160, 89, 0.08), rgba(197, 160, 89, 0.02))',
          borderRadius: 20, overflow: 'hidden',
          border: `1px solid ${form.tone || '#c5a059'}25`,
          boxShadow: `0 8px 25px rgba(0,0,0,0.3)`
        }}>
          {/* Image banner */}
          {(form.media_url || droppedFile) && (
            <div style={{
              width: '100%', height: 120,
              background: `url(${form.media_url}) center/cover no-repeat`,
              borderBottom: '1px solid rgba(255,255,255,0.05)'
            }} />
          )}

          {/* Notification header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 16px 10px'
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: form.tone || 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 900, color: '#000', flexShrink: 0
            }}>
              {form.sender_name?.charAt(0) || 'A'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4f8' }}>
                {form.sender_name || 'Admin'}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(240, 244, 248, 0.4)' }}>
                Al-Mawaid • {form.channel === 'push' ? 'Push Notification' : 'In-App Message'}
              </div>
            </div>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
          </div>

          {/* Title */}
          <div style={{ padding: '0 16px', marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f0f4f8', lineHeight: 1.3 }}>
              {form.title || 'Notification Title'}
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              fontSize: 12, color: 'rgba(240, 244, 248, 0.65)',
              lineHeight: 1.6, whiteSpace: 'pre-wrap',
              maxHeight: 60, overflow: 'hidden'
            }}>
              {form.body || 'Your notification message will appear here...'}
            </div>
          </div>

          {/* Accent bar */}
          <div style={{
            height: 3,
            background: `linear-gradient(90deg, ${form.tone || '#c5a059'}, ${form.tone || '#c5a059'}88)`,
          }} />
        </div>

        {/* Phone bottom indicator */}
        <div style={{
          display: 'flex', justifyContent: 'center', marginTop: 14
        }}>
          <div style={{
            fontSize: 9, color: 'rgba(240, 244, 248, 0.2)',
            letterSpacing: '0.2em', textTransform: 'uppercase'
          }}>
            Al-Mawaid Notification
          </div>
        </div>
      </div>
    </div>
  )

  // ── Loading ─────────────────────────────────────────────────
  if (loading) return <Spinner />

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <PageWrap>
      {/* ── HEADER ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: 28, flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <PageTitle sub="Create and manage broadcast notifications">
            Notification Center
          </PageTitle>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge color={T.accent}><Megaphone size={12} /> {realPushSubs} Enabled / {pushSubs} Total</Badge>
          <RefreshCw
            size={16} color={T.textSub}
            style={{ cursor: 'pointer', flexShrink: 0 }}
            onClick={fetchAll}
          />
        </div>
      </div>

      {/* ── SUB NAV TABS ── */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 28,
        borderBottom: '1px solid rgba(212, 175, 55, 0.1)',
        paddingBottom: 0
      }}>
        <button
          onClick={() => setActiveView('compose')}
          style={{
            padding: '12px 28px', border: 'none',
            background: 'none', color: activeView === 'compose' ? T.accent : 'var(--text-tertiary)',
            fontWeight: 800, fontSize: 14, cursor: 'pointer',
            fontFamily: 'inherit', letterSpacing: '0.02em',
            borderBottom: activeView === 'compose' ? `2px solid ${T.accent}` : '2px solid transparent',
            transition: 'all 0.2s', marginBottom: -1,
            opacity: activeView === 'compose' ? 1 : 0.6
          }}
        >
          + New Broadcast
        </button>
        <button
          onClick={() => setActiveView('history')}
          style={{
            padding: '12px 28px', border: 'none',
            background: 'none', color: activeView === 'history' ? T.accent : 'var(--text-tertiary)',
            fontWeight: 800, fontSize: 14, cursor: 'pointer',
            fontFamily: 'inherit', letterSpacing: '0.02em',
            borderBottom: activeView === 'history' ? `2px solid ${T.accent}` : '2px solid transparent',
            transition: 'all 0.2s', marginBottom: -1,
            opacity: activeView === 'history' ? 1 : 0.6
          }}
        >
          History
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* COMPOSE VIEW — 65/35 SPLIT                                     */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeView === 'compose' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 380px',
          gap: 28,
          alignItems: 'start'
        }}>
          {/* ── LEFT PANE: Creation Form + Preview ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {/* Creation Form */}
            <AdminCard style={{ padding: 28 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Row 1: Title + Char counter */}
                <div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 8
                  }}>
                    <label htmlFor="notificationTitle" style={{
                      color: 'var(--text-tertiary)', fontSize: 10,
                      fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>Title</label>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.5 }}>
                      {form.title.length}/60
                    </span>
                  </div>
                  <input
                    id="notificationTitle"
                    name="notificationTitle"
                    placeholder="Menu Update"
                    value={form.title}
                    maxLength={60}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '12px 16px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
                      color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* Row 2: Sender + Char counter */}
                <div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 8
                  }}>
                    <label htmlFor="senderName" style={{
                      color: 'var(--text-tertiary)', fontSize: 10,
                      fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>Sender</label>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.5 }}>
                      {form.sender_name.length}/50
                    </span>
                  </div>
                  <input
                    id="senderName"
                    name="senderName"
                    placeholder="Al-Mawaid Office"
                    value={form.sender_name}
                    maxLength={50}
                    onChange={e => setForm({ ...form, sender_name: e.target.value })}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '12px 16px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
                      color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* Row 3: Message */}
                <div>
                  <label htmlFor="notificationBody" style={{
                    display: 'block', color: 'var(--text-tertiary)', fontSize: 10,
                    fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8,
                  }}>Message</label>
                  <textarea
                    id="notificationBody"
                    name="notificationBody"
                    placeholder="Add notification text..."
                    value={form.body}
                    onChange={e => setForm({ ...form, body: e.target.value })}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      minHeight: 100, padding: 12, borderRadius: 12, resize: 'vertical',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
                      color: T.text, outline: 'none', fontFamily: 'inherit', fontSize: 14,
                      lineHeight: 1.65
                    }}
                  />
                </div>

                {/* Row 4: Accent Tone + Channel (inline) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Accent Tone Picker */}
                  <div>
                    <div style={{
                      display: 'block', color: 'var(--text-tertiary)', fontSize: 10,
                      fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10,
                    }}>Accent Tone</div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {TONES.map(t => (
                        <div
                          key={t.value}
                          onClick={() => setForm({ ...form, tone: t.value })}
                          style={{
                            width: 28, height: 28, borderRadius: '50%', background: t.color,
                            cursor: 'pointer',
                            border: form.tone === t.value ? '2px solid #fff' : '2px solid transparent',
                            boxShadow: form.tone === t.value ? `0 0 10px ${t.color}` : 'none',
                            transition: 'all 0.2s',
                            position: 'relative'
                          }}
                          title={t.label}
                        >
                          {form.tone === t.value && (
                            <div style={{
                              position: 'absolute', top: '50%', left: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: 8, height: 8, borderRadius: '50%',
                              background: '#000', opacity: 0.3
                            }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Channel Selector */}
                  <div>
                    <label htmlFor="channel" style={{
                      display: 'block', color: 'var(--text-tertiary)', fontSize: 10,
                      fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10,
                    }}>Channel</label>
                    <select
                      id="channel"
                      name="channel"
                      value={form.channel}
                      onChange={e => setForm({ ...form, channel: e.target.value })}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '10px 14px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
                        color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
                      }}
                    >
                      {CHANNEL_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 5: Image Upload (Drag & Drop) */}
                <div>
                  <label htmlFor="imageUpload" style={{
                    display: 'block', color: 'var(--text-tertiary)', fontSize: 10,
                    fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8,
                  }}>Attached Image</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleFileSelect}
                    id="imageUpload"
                    name="imageUpload"
                    style={{ display: 'none' }}
                  />
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${dragOver ? T.accent : 'rgba(212, 175, 55, 0.15)'}`,
                      borderRadius: 14,
                      background: dragOver ? 'rgba(197, 160, 89, 0.05)' : 'rgba(255,255,255,0.01)',
                      padding: 16,
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14
                    }}
                  >
                    {uploading ? (
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 10,
                            background: 'rgba(197, 160, 89, 0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: '50%',
                              border: '2px solid rgba(197, 160, 89, 0.2)',
                              borderTop: '2px solid #c5a059',
                              animation: 'spin 0.8s linear infinite'
                            }} />
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                            Uploading image...
                          </div>
                        </div>
                        <div style={{
                          width: '100%', height: 3, borderRadius: 10,
                          background: 'rgba(197, 160, 89, 0.1)', overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${uploadProgress}%`,
                            height: '100%',
                            background: 'var(--accent-primary)',
                            borderRadius: 10,
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>
                    ) : form.media_url || droppedFile ? (
                      <>
                        <div style={{
                          width: 60, height: 60, borderRadius: 10, overflow: 'hidden',
                          flexShrink: 0,
                          background: `url(${form.media_url}) center/cover no-repeat`,
                          border: '1px solid rgba(212, 175, 55, 0.15)'
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {droppedFile?.name || 'Image attached'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {form.media_url?.startsWith('http') ? '✅ Uploaded to storage' : 'Preview only'}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveFile() }}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)', border: 'none',
                            color: '#ef4444', width: 28, height: 28, borderRadius: 8,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'inherit', flexShrink: 0
                          }}
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{
                          width: 44, height: 44, borderRadius: 10,
                          background: 'rgba(197, 160, 89, 0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Upload size={18} color={T.accent} />
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                          Drop an image here or <span style={{ color: T.accent, fontWeight: 700 }}>browse</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Row 6: Dropdowns (Target, Delivery, Presets) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {/* Target Audience */}
                  <select
                    name="targetType"
                    value={form.target_type}
                    onChange={e => setForm({ ...form, target_type: e.target.value })}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '10px 12px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
                      color: 'var(--text-primary)', fontSize: 12, outline: 'none', fontFamily: 'inherit',
                    }}
                    title="Target Audience"
                  >
                    <option value="all">Audience: All Users</option>
                    <option value="admins">Audience: Admins Only</option>
                    <option value="opt_in">Audience: Opted In</option>
                    <option value="opt_out">Audience: Opted Out</option>
                    <option value="specific">Audience: Specific User</option>
                  </select>

                  {/* Delivery Timing */}
                  <select
                    name="delivery"
                    value={form.delivery}
                    onChange={e => setForm({ ...form, delivery: e.target.value })}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '10px 12px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
                      color: 'var(--text-primary)', fontSize: 12, outline: 'none', fontFamily: 'inherit',
                    }}
                    title="Delivery"
                  >
                    {DELIVERY_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>Delivery: {o.label}</option>
                    ))}
                  </select>

                  {/* Broadcast Presets */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setPresetOpen(!presetOpen)}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '10px 12px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
                        color: 'var(--text-primary)', fontSize: 12, outline: 'none', fontFamily: 'inherit',
                        textAlign: 'left', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8
                      }}
                    >
                      <BookTemplate size={14} color={T.textSub} />
                      <span style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>Broadcast Presets</span>
                      <span style={{ marginLeft: 'auto' }}>▾</span>
                    </button>
                    {presetOpen && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                        marginTop: 4,
                        background: '#1a1d26', borderRadius: 12,
                        border: '1px solid rgba(212, 175, 55, 0.15)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                        maxHeight: 200, overflowY: 'auto'
                      }}>
                        {templates.length === 0 ? (
                          <div style={{ padding: 14, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                            No saved presets
                          </div>
                        ) : (
                          templates.map(tpl => (
                            <button
                              key={tpl.id}
                              onClick={() => {
                                loadTemplate(tpl)
                                setPresetOpen(false)
                              }}
                              style={{
                                display: 'block', width: '100%', textAlign: 'left',
                                padding: '10px 14px', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.03)',
                                background: 'none', color: T.text, fontSize: 12, cursor: 'pointer',
                                fontFamily: 'inherit',
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >
                              <div style={{ fontWeight: 700 }}>{tpl.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                {tpl.title || 'No title'}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Save as Template button row */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setSaveTemplateName(form.title || 'Untitled')
                      setShowSaveModal(true)
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 10,
                      background: 'rgba(197, 160, 89, 0.06)', border: '1px solid rgba(197, 160, 89, 0.12)',
                      color: T.accent, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      fontFamily: 'inherit', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(197, 160, 89, 0.12)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(197, 160, 89, 0.06)' }}
                  >
                    <Save size={14} /> Save as Preset
                  </button>
                </div>

                {/* Conditional: Schedule picker */}
                {form.delivery === 'schedule' && (
                  <input
                    name="scheduledAt"
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '12px 16px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
                      color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                )}

                {/* Conditional: Specific user picker */}
                {form.target_type === 'specific' && (
                  <select
                    name="targetUserId"
                    value={form.target_user_id}
                    onChange={e => setForm({ ...form, target_user_id: e.target.value })}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '12px 16px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
                      color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
                    }}
                  >
                    <option value="">-- Choose User --</option>
                    {users.map(u => (
                      <option key={u.user_id} value={u.user_id}>
                        #{u.thali_number} {u.name}
                      </option>
                    ))}
                  </select>
                )}

                {/* Target count indicator */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 10,
                  background: 'rgba(197, 160, 89, 0.04)', border: '1px solid rgba(197, 160, 89, 0.1)',
                  fontSize: 11, color: 'var(--text-tertiary)'
                }}>
                  <Target size={14} color={T.accent} />
                  Will reach <strong style={{ color: T.accent }}>
{form.target_type === 'specific' && form.target_user_id ? 1 :
                      form.target_type === 'all' ? realPushSubs :
                      form.target_type === 'admins' ? realPushSubs :
                      users.length}
                  </strong> recipient{form.target_type === 'specific' && form.target_user_id ? '' : 's'}
                  {form.delivery === 'schedule' && form.scheduled_at
                    ? ` at ${new Date(form.scheduled_at).toLocaleString()}`
                    : ' immediately'}
                </div>
              </div>
            </AdminCard>

            {/* ── FOOTER BUTTONS ── */}
            <div style={{ display: 'flex', gap: 16 }}>
              <button
                onClick={handleSend}
                disabled={submitting}
                style={{
                  flex: 1, height: 54,
                  background: '#fff',
                  border: 'none', borderRadius: 14,
                  color: '#0a0d14', fontWeight: 900, fontSize: 16,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: '0 8px 25px rgba(255,255,255,0.15)',
                  transition: 'all 0.2s',
                  opacity: submitting ? 0.6 : 1
                }}
                onMouseEnter={e => { if (!submitting) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(255,255,255,0.2)' } }}
                onMouseLeave={e => { if (!submitting) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(255,255,255,0.15)' } }}
              >
                <Rocket size={20} color="#0a0d14" />
                {submitting ? 'Sending...' : 'Send Now'}
              </button>
              <button
                onClick={() => {
                  if (form.delivery !== 'schedule') {
                    setForm(prev => ({ ...prev, delivery: 'schedule' }))
                  } else {
                    handleSend()
                  }
                }}
                disabled={submitting}
                style={{
                  height: 54, padding: '0 28px',
                  background: 'transparent',
                  border: '1.5px solid rgba(212, 175, 55, 0.3)',
                  borderRadius: 14,
                  color: 'var(--text-primary)', fontWeight: 800, fontSize: 14,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.2s',
                  opacity: submitting ? 0.5 : 1
                }}
                onMouseEnter={e => { if (!submitting) { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = 'rgba(197, 160, 89, 0.05)' } }}
                onMouseLeave={e => { if (!submitting) { e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.3)'; e.currentTarget.style.background = 'transparent' } }}
              >
                <Calendar size={18} />
                {form.delivery === 'schedule' && form.scheduled_at ? 'Confirm Schedule' : 'Schedule'}
              </button>
            </div>
          </div>

          {/* ── RIGHT PANE: Live Preview + Quick Stats ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 16 }}>
            {/* Live Mobile Preview */}
            <AdminCard style={{
              padding: 24,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: 'linear-gradient(180deg, rgba(197, 160, 89, 0.03) 0%, transparent 100%)'
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18,
                fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.1em'
              }}>
                <Eye size={14} /> Preview
              </div>
              <MobilePreview />
              <div style={{
                marginTop: 14, fontSize: 10, color: 'var(--text-tertiary)',
                textAlign: 'center', opacity: 0.5
              }}>
                Real-time preview updates as you type
              </div>
            </AdminCard>

            {/* Quick Stats */}
            <AdminCard style={{ padding: 20 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <BarChart3 size={14} /> Quick Stats
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Sent Today', value: stats.sent, color: '#34d399' },
                  { label: 'Scheduled', value: stats.scheduled, color: '#a78bfa' },
                  { label: 'Templates', value: stats.templates, color: T.accent },
                  { label: 'Subscribers', value: pushSubs, color: '#60a5fa' },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding: '12px', borderRadius: 12, textAlign: 'center',
                    background: `${item.color}08`,
                    border: `1px solid ${item.color}15`
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4, fontWeight: 600 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </AdminCard>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HISTORY VIEW — Unified Sidebar Style                       */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeView === 'history' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 380px',
          gap: 28,
          alignItems: 'start'
        }}>
          {/* ── MAIN CONTENT: Full broadcast list ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '0 14px', borderRadius: 14,
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212, 175, 55, 0.1)'
            }}>
              <Search size={16} color="var(--text-tertiary)" />
              <input
                name="searchBroadcasts"
                placeholder="Search broadcasts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent', border: 'none', color: T.text,
                  outline: 'none', padding: '12px 8px', fontSize: 14, flex: 1,
                  fontFamily: 'inherit'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-tertiary)',
                    cursor: 'pointer', padding: 4, display: 'flex'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Broadcast List */}
            <AdminCard style={{ padding: 20 }}>
              {filteredHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
                  <LayoutList size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>No broadcasts yet</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    {searchQuery ? 'Try a different search term' : 'Create your first broadcast to see it here'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredHistory.map(notice => {
                    const status = getNoticeStatus(notice)
                    const entry = schedule.find(s => s.notice_id === notice.id)
                    return (
                      <div
                        key={notice.id}
                        onClick={() => setDetailNotice(detailNotice?.id === notice.id ? null : notice)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '14px 16px', borderRadius: 14,
                          background: detailNotice?.id === notice.id ? 'rgba(197, 160, 89, 0.05)' : 'rgba(255,255,255,0.01)',
                          border: `1px solid ${detailNotice?.id === notice.id ? 'rgba(197, 160, 89, 0.2)' : 'transparent'}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { if (detailNotice?.id !== notice.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' } }}
                        onMouseLeave={e => { if (detailNotice?.id !== notice.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.01)' } }}
                      >
                        {/* Icon */}
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: `${notice.tone || T.accent}12`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <Bell size={16} color={notice.tone || T.accent} />
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>
                            {notice.title}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                            {timeAgo(notice.created_at)}
                            {entry?.total_targets ? ` • ${entry.total_targets} recipients` : ''}
                          </div>
                        </div>

                        {/* Status badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20,
                            background: `${STATUS_COLORS[status] || '#34d399'}15`,
                            color: STATUS_COLORS[status] || '#34d399',
                            fontSize: 9, fontWeight: 800,
                            border: `1px solid ${STATUS_COLORS[status] || '#34d399'}30`
                          }}>
                            {status === 'sent' ? 'Sent' : status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailNotice(notice) }}
                            style={{
                              background: 'rgba(197, 160, 89, 0.08)', border: 'none',
                              color: T.accent, width: 28, height: 28, borderRadius: 8,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: 'inherit', fontSize: 12
                            }}
                            title="View details"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteNotice(notice.id) }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.08)', border: 'none',
                              color: '#ef4444', width: 28, height: 28, borderRadius: 8,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: 'inherit', fontSize: 12
                            }}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </AdminCard>
          </div>

          {/* ── RIGHT SIDEBAR: Unified History ── */}
          <div style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Recent History Panel */}
            <AdminCard style={{ padding: 20 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <Clock3 size={14} /> Recent Broadcasts
                </div>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.5 }}>
                  Latest {recentBroadcasts.length}
                </span>
              </div>

              {recentBroadcasts.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>
                  No broadcasts yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recentBroadcasts.map(notice => {
                    const status = getNoticeStatus(notice)
                    const entry = schedule.find(s => s.notice_id === notice.id)
                    return (
                      <div
                        key={notice.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 12,
                          background: 'rgba(255,255,255,0.02)',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onClick={() => setDetailNotice(notice)}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: `${notice.tone || T.accent}10`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <Bell size={12} color={notice.tone || T.accent} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {notice.title}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                            {timeAgo(notice.created_at)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 12,
                            background: `${STATUS_COLORS[status] || '#34d399'}15`,
                            color: STATUS_COLORS[status] || '#34d399',
                            fontSize: 8, fontWeight: 800,
                          }}>
                            {status === 'sent' ? 'Sent' : status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailNotice(notice) }}
                            style={{
                              background: 'none', border: 'none',
                              color: 'var(--text-tertiary)', cursor: 'pointer',
                              padding: 2, display: 'flex', opacity: 0.4,
                              fontFamily: 'inherit'
                            }}
                            title="View"
                          >
                            <Eye size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </AdminCard>

            {/* Scheduled Broadcasts Panel */}
            <AdminCard style={{ padding: 20 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <Calendar size={14} /> Scheduled
                </div>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.5 }}>
                  {scheduledBroadcasts.length} queued
                </span>
              </div>

              {scheduledBroadcasts.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>
                  No scheduled broadcasts
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {scheduledBroadcasts.map(entry => (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.02)',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: `${STATUS_COLORS[entry.status] || '#a78bfa'}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Clock size={12} color={STATUS_COLORS[entry.status] || '#a78bfa'} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {entry.title}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                          {entry.scheduled_for ? new Date(entry.scheduled_for).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : timeAgo(entry.created_at)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12,
                          background: `${STATUS_COLORS[entry.status] || '#a78bfa'}15`,
                          color: STATUS_COLORS[entry.status] || '#a78bfa',
                          fontSize: 8, fontWeight: 800,
                        }}>
                          {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                        </span>
                        <button
                          onClick={() => deleteScheduleEntry(entry.id)}
                          style={{
                            background: 'none', border: 'none',
                            color: '#ef4444', cursor: 'pointer',
                            padding: 2, display: 'flex', opacity: 0.4,
                            fontFamily: 'inherit'
                          }}
                          title="Cancel"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AdminCard>
          </div>

          {/* ── Detail Slide Drawer ── */}
          <SlideDrawer
            isOpen={!!detailNotice}
            onClose={() => setDetailNotice(null)}
            title="Broadcast Details"
            width={480}
          >
            {detailNotice && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: 20, borderRadius: 16,
                  background: `${detailNotice.tone || T.accent}10`,
                  border: `1px solid ${detailNotice.tone || T.accent}30`
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: detailNotice.tone || T.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Bell size={24} color="#000" />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{detailNotice.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      by {detailNotice.sender_name || 'Admin'} • {fmtDateTime(detailNotice.created_at)}
                    </div>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)',
                    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10
                  }}>Message</div>
                  <div style={{
                    padding: 16, borderRadius: 14,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212, 175, 55, 0.1)',
                    fontSize: 13, color: T.text, lineHeight: 1.6, whiteSpace: 'pre-wrap'
                  }}>
                    {detailNotice.body || 'No message content'}
                  </div>
                </div>

                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Sender', value: detailNotice.sender_name || 'Admin Office' },
                    { label: 'Target', value: detailNotice.target_user_id ? 'Specific User' : 'All Users' },
                    { label: 'Scheduled', value: detailNotice.scheduled_at ? fmtDateTime(detailNotice.scheduled_at) : 'Immediate' },
                    { label: 'Channel', value: detailNotice.channel || 'In-App' },
                  ].map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', borderRadius: 10,
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212, 175, 55, 0.06)'
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* Delivery Status */}
                {(() => {
                  const entry = schedule.find(s => s.notice_id === detailNotice.id)
                  if (!entry) return null
                  return (
                    <div>
                      <div style={{
                        fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)',
                        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10
                      }}>Delivery Status</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          { label: 'Status', value: entry.status, color: STATUS_COLORS[entry.status] },
                          { label: 'Targets', value: entry.total_targets || '—' },
                          { label: 'Sent', value: entry.sent_count || 0, color: '#34d399' },
                          { label: 'Failed', value: entry.failed_count || 0, color: '#ef4444' },
                        ].map((item, i) => (
                          <div key={i} style={{
                            padding: '14px', borderRadius: 12, textAlign: 'center',
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212, 175, 55, 0.08)'
                          }}>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>{item.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: item.color || T.text }}>
                              {item.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <Btn
                    variant="outline"
                    style={{ flex: 1 }}
                    onClick={() => setDetailNotice(null)}
                  >
                    Close
                  </Btn>
                  <Btn
                    variant="danger"
                    style={{ flex: 1 }}
                    onClick={() => deleteNotice(detailNotice.id)}
                  >
                    <Trash2 size={16} /> Delete
                  </Btn>
                </div>
              </div>
            )}
          </SlideDrawer>
        </div>
      )}

      {/* ── Save as Template Modal ── */}
      <Modal
        isOpen={showSaveModal}
        onClose={() => { setShowSaveModal(false); setSaveTemplateName('') }}
        title="Save as Preset"
        maxWidth={400}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
            Save this broadcast as a reusable preset for quick access later.
          </p>
          <input
            name="presetName"
            label="Preset Name"
            placeholder="e.g. Weekly Menu Update, Holiday Greeting"
            value={saveTemplateName}
            onChange={e => setSaveTemplateName(e.target.value)}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '12px 16px', borderRadius: 12,
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
              color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <Btn
              variant="outline"
              style={{ flex: 1 }}
              onClick={() => { setShowSaveModal(false); setSaveTemplateName('') }}
            >
              Cancel
            </Btn>
            <Btn
              style={{ flex: 1 }}
              onClick={saveAsTemplate}
              disabled={!saveTemplateName.trim()}
            >
              <Save size={16} /> Save
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Global Styles ── */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 1024px) {
          .notification-grid { grid-template-columns: 1fr !important; }
        }
        select {
          color-scheme: dark;
        }
        select option {
          background: #1a1d26;
          color: #f0f4f8;
        }
        select option:checked {
          background: #c5a059;
          color: #000;
        }
      `}</style>
    </PageWrap>
  )
}
