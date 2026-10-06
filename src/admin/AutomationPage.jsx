import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../lib/firebaseClient'
import { useNavigate } from 'react-router-dom'
import {
  Clock, RefreshCw, BarChart3, Calendar, Send,
  Sun, Moon, Activity, Zap, Timer, Settings,
  Lock, CheckCircle2, AlertTriangle, Sparkles,
  Sliders, MessageSquare, ChevronRight, Check,
  Radio, Shield, Power, Eye, Info
} from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Btn, StatCard, Grid, Alert, SectionHeader, Modal } from './ui'
import { getSurveyTargetWeek, getSurveyTargetWeeks, getSurveyCadence, getSurveyTotalSlots, formatWeekRange } from '../common/utils'
import { fetchWeekRows, fetchWeekRowsMulti } from '../lib/surveyRows'
import { isSurveyOpen, getSurveyWindowConfig, getSurveyWindowLabel, getSurveyWindowStatus } from '../hooks/useSurvey'

const DAYS_OPTIONS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
]

const WINDOW_PRESETS = [
  { label: 'Standard (Sat 8 PM → Mon 11 AM)', startDay: 'saturday', startTime: '20:00', endDay: 'monday', endTime: '11:00' },
  { label: 'Weekend (Fri 8 PM → Sun 11 PM)', startDay: 'friday', startTime: '20:00', endDay: 'sunday', endTime: '23:00' },
  { label: 'Extended (Fri 12 PM → Tue 12 PM)', startDay: 'friday', startTime: '12:00', endDay: 'tuesday', endTime: '12:00' },
  { label: 'Mid-Week (Mon 8 PM → Wed 11 AM)', startDay: 'monday', startTime: '20:00', endDay: 'wednesday', endTime: '11:00' },
]

const BROADCAST_TEMPLATES = [
  {
    title: '📢 Weekly Survey Now Open!',
    body: 'The meal survey for the upcoming week is now open. Please submit your preferences before the window closes.',
  },
  {
    title: '⏰ Survey Closes in 2 Hours!',
    body: 'Friendly reminder: The weekly meal survey is closing shortly. Please lock in your portions now.',
  },
  {
    title: '🍲 Today\'s Menu Updated',
    body: 'Today\'s thali menu has been finalized. Check out the dishes and daily routine in the app.',
  },
  {
    title: '✨ Special Niyaaz Announcement',
    body: 'Mubarak! A special Niyaaz meal is planned for this week. Please review your survey to participate.',
  },
]

const isTimingOpen = (type, settings) => {
  const now = new Date()
  const minute = now.getHours() * 60 + now.getMinutes()
  if (type === 'lunch') {
    const openParts = (settings.lunch_edit_open || '20:00').split(':').map(Number)
    const closeParts = (settings.lunch_edit_close || '11:00').split(':').map(Number)
    const openMin = (openParts[0] || 20) * 60 + (openParts[1] || 0)
    const closeMin = (closeParts[0] || 11) * 60 + (closeParts[1] || 0)
    if (openMin > closeMin) {
      if (minute < closeMin) return true
      if (minute >= openMin) return true
    } else {
      if (minute >= openMin && minute < closeMin) return true
    }
    return false
  }
  if (type === 'dinner') {
    const openParts = (settings.dinner_edit_open || '12:00').split(':').map(Number)
    const closeParts = (settings.dinner_edit_close || '15:30').split(':').map(Number)
    const openMin = (openParts[0] || 12) * 60 + (openParts[1] || 0)
    const closeMin = (closeParts[0] || 15) * 60 + (closeParts[1] || 30)
    return minute >= openMin && minute < closeMin
  }
  return false
}

export default function AutomationPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('hub') // 'hub' | 'survey' | 'meals' | 'broadcast'

  // Settings State
  const [settings, setSettings] = useState({})
  const [surveyCadence, setSurveyCadence] = useState('1_week')
  const [surveyWindowStartDay, setSurveyWindowStartDay] = useState('saturday')
  const [surveyWindowStartTime, setSurveyWindowStartTime] = useState('20:00')
  const [surveyWindowEndDay, setSurveyWindowEndDay] = useState('monday')
  const [surveyWindowEndTime, setSurveyWindowEndTime] = useState('11:00')
  const [surveyWindowStatus, setSurveyWindowStatus] = useState('auto')
  const [lunchEditStatus, setLunchEditStatus] = useState('auto')
  const [dinnerEditStatus, setDinnerEditStatus] = useState('auto')
  const [surveyMsg, setSurveyMsg] = useState('')
  const [lunchEditOpen, setLunchEditOpen] = useState('20:00')
  const [lunchEditClose, setLunchEditClose] = useState('11:00')
  const [dinnerEditOpen, setDinnerEditOpen] = useState('12:00')
  const [dinnerEditClose, setDinnerEditClose] = useState('15:30')

  // Live status
  const [liveSurveyStatus, setLiveSurveyStatus] = useState(null)
  const [liveLunchStatus, setLiveLunchStatus] = useState(null)
  const [liveDinnerStatus, setLiveDinnerStatus] = useState(null)

  // Loading & UX
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [quickSaving, setQuickSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Broadcast state
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [broadcasting, setBroadcasting] = useState(false)

  // Migration state
  const [migrating, setMigrating] = useState(false)
  const [migrateResult, setMigrateResult] = useState(null)

  const handleMigrateFlatData = async () => {
    if (migrating) return
    setMigrating(true)
    setMigrateResult(null)
    try {
      const { data, error } = await supabase.rpc('migrate_all_flat_responses_to_day_responses')
      if (error) throw error
      setMigrateResult({ success: true, message: `✅ Survey migration completed successfully! Source rows: ${data?.source_flat_rows ?? 0}, Total day responses: ${data?.total_day_response_rows ?? 0}` })
    } catch (e) {
      setMigrateResult({ success: false, message: `Migration error: ${e.message || 'Please run migration SQL in Supabase'}` })
    } finally {
      setMigrating(false)
    }
  }

  // Analytics
  const [scheduledCount, setScheduledCount] = useState(0)
  const [pendingSurveyCount, setPendingSurveyCount] = useState(0)
  const [todayApplied, setTodayApplied] = useState(0)
  const [totalMembers, setTotalMembers] = useState(0)
  const [delivered24h, setDelivered24h] = useState(0)
  const [failed24h, setFailed24h] = useState(0)

  const loadRef = useRef(null)

  const computeLive = (s) => isSurveyOpen(s) ? 'open' : 'closed'

  const load = useCallback(async () => {
    try {
      const { data: appSettings } = await supabase.from('app_settings').select('*')
      const s = {}
      if (appSettings) {
        appSettings.forEach(row => { s[row.key] = row.value })
        setSettings(s)
        setSurveyCadence(getSurveyCadence(s))
        setSurveyWindowStartDay((s.survey_window_start_day || 'saturday').toLowerCase())
        setSurveyWindowStartTime(s.survey_window_start_time || '20:00')
        setSurveyWindowEndDay((s.survey_window_end_day || 'monday').toLowerCase())
        setSurveyWindowEndTime(s.survey_window_end_time || '11:00')
        setSurveyWindowStatus(getSurveyWindowStatus(s))
        setLunchEditStatus(s.lunch_edit_status || 'auto')
        setDinnerEditStatus(s.dinner_edit_status || 'auto')
        setSurveyMsg(s.survey_msg || '')
        setLunchEditOpen(s.lunch_edit_open || '20:00')
        setLunchEditClose(s.lunch_edit_close || '11:00')
        setDinnerEditOpen(s.dinner_edit_open || '12:00')
        setDinnerEditClose(s.dinner_edit_close || '15:30')
      }
      setLiveSurveyStatus(computeLive(s))
      setLiveLunchStatus(isTimingOpen('lunch', s) ? 'open' : 'closed')
      setLiveDinnerStatus(isTimingOpen('dinner', s) ? 'open' : 'closed')

      const today = new Date()
      const day = today.getDay()
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
      const dayKey = dayNames[day]
      const mealKey = today.getHours() < 15 ? 'l' : 'd'
      const statusField = `${dayKey}_${mealKey}_status`
      const isSunday = day === 0
      const weekIds = getSurveyTargetWeeks(s)
      const weekId = weekIds[0]

      const [
        { count: sc },
        { data: weekRows },
        { count: tm },
        { data: overrideRows },
      ] = await Promise.all([
        supabase.from('broadcast_schedule').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
        fetchWeekRows(weekId),
        supabase.from('user_stats').select('user_id', { count: 'exact', head: true }),
        supabase.from('survey_day_responses').select('user_id, day, l_status, d_status').eq('week_id', weekId),
      ])
      const byUser = new Map()
      ;(weekRows || []).forEach(r => byUser.set(r.user_id, r))
      ;(overrideRows || []).forEach(o => {
        const dk = String(o.day || '').substring(0, 3).toLowerCase()
        const existing = byUser.get(o.user_id) || { user_id: o.user_id }
        if (o.l_status) existing[`${dk}_l_status`] = o.l_status
        if (o.d_status) existing[`${dk}_d_status`] = o.d_status
        byUser.set(o.user_id, existing)
      })
      const rows = [...byUser.values()]
      const pendingSurvey = isSunday ? 0 : rows.filter(r => { const v = r[statusField]; return v !== 'Applied' && v !== 'Skipped' }).length
      const todayAppliedCount = isSunday ? 0 : rows.filter(r => r[statusField] === 'Applied').length
      setScheduledCount(sc || 0)
      setPendingSurveyCount(pendingSurvey)
      setTodayApplied(todayAppliedCount)
      setTotalMembers(tm || 0)
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      const { data: recentBc } = await supabase.from('broadcast_schedule').select('sent_count, failed_count').gte('sent_at', since).limit(200)
      setDelivered24h((recentBc || []).reduce((n, s) => n + (s.sent_count || 0), 0))
      setFailed24h((recentBc || []).reduce((n, s) => n + (s.failed_count || 0), 0))
      setHasUnsavedChanges(false)
    } catch (e) { console.error('Automation load error:', e) }
    setLoading(false)
  }, [])

  loadRef.current = load
  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase.channel('automation-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => { loadRef.current() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_schedule' }, () => { loadRef.current() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_day_responses' }, () => { loadRef.current() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_feedback' }, () => { loadRef.current() })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveSurveyStatus(prev => {
        const next = computeLive(settings) ? 'open' : 'closed'
        return prev === next ? prev : next
      })
      setLiveLunchStatus(prev => {
        const next = isTimingOpen('lunch', settings) ? 'open' : 'closed'
        return prev === next ? prev : next
      })
      setLiveDinnerStatus(prev => {
        const next = isTimingOpen('dinner', settings) ? 'open' : 'closed'
        return prev === next ? prev : next
      })
    }, 15000)
    return () => clearInterval(timer)
  }, [settings])

  // Instant toggle handler for live overrides
  const handleToggle = async (key, value) => {
    setSaving(true); setMsg('')
    const nextSettings = { ...settings, [key]: value }
    setSettings(nextSettings)
    if (key === 'survey_cadence') {
      setSurveyCadence(value)
    }
    if (key === 'survey_window_status') {
      setSurveyWindowStatus(value)
      setLiveSurveyStatus(computeLive(nextSettings))
    }
    if (key === 'lunch_edit_status') {
      setLunchEditStatus(value)
      setLiveLunchStatus(value === 'open' ? 'open' : value === 'closed' ? 'closed' : (isTimingOpen('lunch', nextSettings) ? 'open' : 'closed'))
    }
    if (key === 'dinner_edit_status') {
      setDinnerEditStatus(value)
      setLiveDinnerStatus(value === 'open' ? 'open' : value === 'closed' ? 'closed' : (isTimingOpen('dinner', nextSettings) ? 'open' : 'closed'))
    }
    try {
      const { error } = await supabase.from('app_settings').upsert({ key, value }, { onConflict: 'key' })
      if (error) throw error
      setMsg('✅ Automation override updated successfully')
      setTimeout(() => setMsg(''), 2500)
    } catch (e) { setMsg(`Error: ${e.message}`) }
    setSaving(false)
  }

  // Save all custom window timings
  const saveAllTimings = async () => {
    setQuickSaving(true); setMsg('')
    const toSave = [
      { key: 'survey_cadence', value: surveyCadence },
      { key: 'survey_window_status', value: surveyWindowStatus },
      { key: 'survey_window_start_day', value: surveyWindowStartDay.toLowerCase() },
      { key: 'survey_window_start_time', value: surveyWindowStartTime },
      { key: 'survey_window_end_day', value: surveyWindowEndDay.toLowerCase() },
      { key: 'survey_window_end_time', value: surveyWindowEndTime },
      { key: 'survey_msg', value: surveyMsg || `Survey opens ${getSurveyWindowLabel({ survey_window_start_day: surveyWindowStartDay, survey_window_start_time: surveyWindowStartTime, survey_window_end_day: surveyWindowEndDay, survey_window_end_time: surveyWindowEndTime })}.` },
      { key: 'lunch_edit_status', value: lunchEditStatus },
      { key: 'lunch_edit_open', value: lunchEditOpen },
      { key: 'lunch_edit_close', value: lunchEditClose },
      { key: 'dinner_edit_status', value: dinnerEditStatus },
      { key: 'dinner_edit_open', value: dinnerEditOpen },
      { key: 'dinner_edit_close', value: dinnerEditClose },
    ]
    const nextSettings = { ...settings }
    toSave.forEach(r => { nextSettings[r.key] = r.value })
    setSettings(nextSettings)
    setLiveSurveyStatus(computeLive(nextSettings))
    setLiveLunchStatus(lunchEditStatus === 'open' ? 'open' : lunchEditStatus === 'closed' ? 'closed' : (isTimingOpen('lunch', nextSettings) ? 'open' : 'closed'))
    setLiveDinnerStatus(dinnerEditStatus === 'open' ? 'open' : dinnerEditStatus === 'closed' ? 'closed' : (isTimingOpen('dinner', nextSettings) ? 'open' : 'closed'))

    try { await supabase.from('app_settings').delete().in('key', ['survey_open_hour', 'survey_close_hour']).then(() => {}) } catch {}
    let err = null
    for (const row of toSave) {
      const { error } = await supabase.from('app_settings').upsert(row, { onConflict: 'key' })
      if (error) { err = error; break }
    }
    setQuickSaving(false)
    if (err) { setMsg(`Save failed: ${err.message}`) }
    else {
      setHasUnsavedChanges(false)
      setMsg(`✅ All automation timings saved and live across the system!`)
      setTimeout(() => setMsg(''), 3500)
    }
  }

  // Send Broadcast
  const sendBroadcast = async () => {
    const title = broadcastTitle.trim(); const body = broadcastBody.trim()
    if (!title || !body) { setMsg('Broadcast title and message are required'); return }
    setBroadcasting(true); setMsg(''); const now = new Date().toISOString()
    try {
      const { data: noticeData, error: noticeError } = await supabase.from('notices').insert([{ title, message: body, body, sender_name: 'Al-Mawaid', media: [], scheduled_at: now, target_user_id: null, tone: 'var(--accent-primary)', channel: 'push', created_at: now }]).select().single()
      if (noticeError) throw noticeError
      const { data: all } = await supabase.from('user_stats').select('user_id').limit(5000)
      const userIds = (all || []).map(u => u.user_id).filter(Boolean)
      let sent = 0, failed = 0
      try {
        const { data: pushResult, error: pushError } = await supabase.functions.invoke('send-push', { body: { title, body, target_type: 'all', url: '/profile/notifications', sender_name: 'Al-Mawaid' } })
        if (pushError) throw pushError
        sent = pushResult?.sent || 0; failed = pushResult?.failed || 0
      } catch (err) { console.error('Broadcast push trigger error:', err); failed = userIds.length }
      const adminUser = (await supabase.auth.getUser()).data?.user?.id || null
      await supabase.from('broadcast_schedule').insert([{ notice_id: noticeData.id, title, body, sender_name: 'Al-Mawaid', tone: 'var(--accent-primary)', media_url: '', target_type: 'all', channel: 'push', status: failed > 0 && sent === 0 ? 'failed' : 'sent', scheduled_for: now, total_targets: userIds.length, sent_count: sent, failed_count: failed, created_by: adminUser }])
      setMsg(`✅ Broadcast sent to ${userIds.length} member(s) · ${sent} push delivered, ${failed} failed`); setShowBroadcast(false); setBroadcastTitle(''); setBroadcastBody(''); setTimeout(() => setMsg(''), 5000)
    } catch (e) { console.error('Broadcast error:', e); setMsg(`Broadcast failed: ${e.message}`) }
    setBroadcasting(false)
  }

  const windowLabel = getSurveyWindowLabel({
    survey_window_start_day: surveyWindowStartDay,
    survey_window_start_time: surveyWindowStartTime,
    survey_window_end_day: surveyWindowEndDay,
    survey_window_end_time: surveyWindowEndTime,
  })

  const isLiveSurveyOpen = liveSurveyStatus === 'open'
  const isLiveLunchOpen = liveLunchStatus === 'open'
  const isLiveDinnerOpen = liveDinnerStatus === 'open'

  if (loading) {
    return (
      <PageWrap>
        <PageTitle>Automation Center</PageTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {[1, 2, 3, 4].map(i => (
            <AdminCard key={i} style={{ height: 180, opacity: 0.6 }}>
              <div style={{ width: '60%', height: 14, borderRadius: 7, background: T.border, marginBottom: 12 }} />
              <div style={{ width: '100%', height: 10, borderRadius: 5, background: T.border, marginBottom: 8 }} />
              <div style={{ width: '80%', height: 10, borderRadius: 5, background: T.border }} />
            </AdminCard>
          ))}
        </div>
      </PageWrap>
    )
  }

  return (
    <PageWrap>
      <style>{`
        @keyframes pulseGlow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.65; transform: scale(0.98); } }
        @keyframes popIn { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── HEADER WITH ACTIONS ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <PageTitle>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Zap size={26} color={T.accent} />
              Automation
            </span>
          </PageTitle>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasUnsavedChanges && (
            <button
              onClick={saveAllTimings}
              disabled={quickSaving}
              style={{
                padding: '9px 18px', borderRadius: 12, border: 'none',
                background: 'var(--accent-grad)', color: '#000', fontSize: 12, fontWeight: 900,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 4px 16px rgba(212,175,55,0.25)', animation: 'popIn 0.3s ease',
              }}
            >
              <Check size={15} /> {quickSaving ? 'Saving…' : 'Apply Changes'}
            </button>
          )}
          <Btn variant="ghost" onClick={() => load()} disabled={loading} title="Refresh Live States">
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </Btn>
        </div>
      </div>

      {msg && (
        <div style={{ marginBottom: 16, animation: 'popIn 0.3s ease' }}>
          <Alert msg={msg} type={msg.includes('Error') || msg.includes('failed') ? 'error' : 'success'} />
        </div>
      )}

      {/* ── REAL-TIME STATUS HUD (4 LIVE CARDS) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* Weekly Survey Live Card */}
        <AdminCard style={{
          position: 'relative', overflow: 'hidden',
          border: `1.5px solid ${isLiveSurveyOpen ? '#10b98160' : '#ef444450'}`,
          background: isLiveSurveyOpen ? 'linear-gradient(135deg, rgba(16,185,129,0.08), transparent)' : 'linear-gradient(135deg, rgba(239,68,68,0.08), transparent)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} color={isLiveSurveyOpen ? '#10b981' : '#ef4444'} />
              <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Weekly Survey</span>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 20,
              background: isLiveSurveyOpen ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: isLiveSurveyOpen ? '#10b981' : '#ef4444',
              border: `1px solid ${isLiveSurveyOpen ? '#10b98140' : '#ef444440'}`,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: isLiveSurveyOpen ? 'pulseGlow 1.8s infinite' : 'none' }} />
              {isLiveSurveyOpen ? 'LIVE: OPEN' : 'LIVE: CLOSED'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: T.textSub, marginBottom: 12 }}>{windowLabel}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              ['auto', 'AUTO', '#6366f1'],
              ['open', 'FORCE OPEN', '#10b981'],
              ['closed', 'FORCE CLOSED', '#ef4444'],
            ].map(([val, label, color]) => (
              <button
                key={val}
                onClick={() => handleToggle('survey_window_status', val)}
                disabled={saving}
                style={{
                  flex: 1, padding: '5px 2px', borderRadius: 8, fontSize: 9.5, fontWeight: 900,
                  cursor: 'pointer', border: surveyWindowStatus === val ? `1px solid ${color}` : '1px solid transparent',
                  background: surveyWindowStatus === val ? `${color}20` : T.inputBg,
                  color: surveyWindowStatus === val ? color : T.textSub,
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </AdminCard>

        {/* Lunch Edit Live Card */}
        <AdminCard style={{
          position: 'relative', overflow: 'hidden',
          border: `1.5px solid ${isLiveLunchOpen ? '#10b98160' : '#ef444450'}`,
          background: isLiveLunchOpen ? 'linear-gradient(135deg, rgba(16,185,129,0.08), transparent)' : 'linear-gradient(135deg, rgba(239,68,68,0.08), transparent)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sun size={18} color={isLiveLunchOpen ? '#10b981' : '#ef4444'} />
              <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Lunch Window</span>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 20,
              background: isLiveLunchOpen ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: isLiveLunchOpen ? '#10b981' : '#ef4444',
              border: `1px solid ${isLiveLunchOpen ? '#10b98140' : '#ef444440'}`,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: isLiveLunchOpen ? 'pulseGlow 1.8s infinite' : 'none' }} />
              {isLiveLunchOpen ? 'OPEN NOW' : 'CLOSED'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: T.textSub, marginBottom: 12 }}>{lunchEditOpen} (prev night) → {lunchEditClose} (same day)</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              ['auto', 'AUTO', '#6366f1'],
              ['open', 'OPEN', '#10b981'],
              ['closed', 'CLOSED', '#ef4444'],
            ].map(([val, label, color]) => (
              <button
                key={val}
                onClick={() => handleToggle('lunch_edit_status', val)}
                disabled={saving}
                style={{
                  flex: 1, padding: '5px 2px', borderRadius: 8, fontSize: 9.5, fontWeight: 900,
                  cursor: 'pointer', border: lunchEditStatus === val ? `1px solid ${color}` : '1px solid transparent',
                  background: lunchEditStatus === val ? `${color}20` : T.inputBg,
                  color: lunchEditStatus === val ? color : T.textSub,
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </AdminCard>

        {/* Dinner Edit Live Card */}
        <AdminCard style={{
          position: 'relative', overflow: 'hidden',
          border: `1.5px solid ${isLiveDinnerOpen ? '#10b98160' : '#ef444450'}`,
          background: isLiveDinnerOpen ? 'linear-gradient(135deg, rgba(16,185,129,0.08), transparent)' : 'linear-gradient(135deg, rgba(239,68,68,0.08), transparent)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Moon size={18} color={isLiveDinnerOpen ? '#10b981' : '#ef4444'} />
              <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Dinner Window</span>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 20,
              background: isLiveDinnerOpen ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: isLiveDinnerOpen ? '#10b981' : '#ef4444',
              border: `1px solid ${isLiveDinnerOpen ? '#10b98140' : '#ef444440'}`,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: isLiveDinnerOpen ? 'pulseGlow 1.8s infinite' : 'none' }} />
              {isLiveDinnerOpen ? 'OPEN NOW' : 'CLOSED'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: T.textSub, marginBottom: 12 }}>{dinnerEditOpen} → {dinnerEditClose} (same day)</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              ['auto', 'AUTO', '#6366f1'],
              ['open', 'OPEN', '#10b981'],
              ['closed', 'CLOSED', '#ef4444'],
            ].map(([val, label, color]) => (
              <button
                key={val}
                onClick={() => handleToggle('dinner_edit_status', val)}
                disabled={saving}
                style={{
                  flex: 1, padding: '5px 2px', borderRadius: 8, fontSize: 9.5, fontWeight: 900,
                  cursor: 'pointer', border: dinnerEditStatus === val ? `1px solid ${color}` : '1px solid transparent',
                  background: dinnerEditStatus === val ? `${color}20` : T.inputBg,
                  color: dinnerEditStatus === val ? color : T.textSub,
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </AdminCard>

        {/* Broadcast & Push Live Card */}
        <AdminCard style={{
          position: 'relative', overflow: 'hidden',
          border: `1.5px solid ${T.border}`,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08), transparent)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Send size={18} color="#6366f1" />
              <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Broadcasts</span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
              {scheduledCount} Scheduled
            </span>
          </div>
          <div style={{ fontSize: 11, color: T.textSub, marginBottom: 12 }}>
            Delivered: <strong style={{ color: '#10b981' }}>{delivered24h}</strong> · Failed: <strong style={{ color: failed24h > 0 ? '#ef4444' : T.textSub }}>{failed24h}</strong> (24h)
          </div>
          <button
            onClick={() => setActiveTab('broadcast')}
            style={{
              width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)',
              background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontSize: 11, fontWeight: 800,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Send size={12} /> Instant Broadcast Composer
          </button>
        </AdminCard>
      </div>

      {/* ── WEEKLY CADENCE INFO (1 Week · 12 Meals) ── */}
      <AdminCard style={{ marginBottom: 18, padding: 16, border: `1.5px solid ${T.border}`, background: `linear-gradient(135deg, ${T.border}10, transparent)`, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, background: `radial-gradient(circle, ${T.accent}10, transparent 60%)`, filter: 'blur(20px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', position: 'relative' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Calendar size={18} color={T.accent} />
              <span style={{ fontSize: 14, fontWeight: 900, color: T.text, letterSpacing: '-0.01em' }}>Survey Cadence</span>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: 'rgba(212,175,55,0.12)', color: T.accent, border: `1px solid ${T.accentBorder}` }}>1 WEEK · 12 MEALS</span>
            </div>
            <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.5 }}>
              Standard Weekly Schedule — 6 days (Mon–Sat) × 2 meals = 12 meals · Target: {formatWeekRange(getSurveyTargetWeek(settings))}
            </div>
          </div>
        </div>
      </AdminCard>

      {/* ── FAST CATEGORY TABS ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, borderBottom: `1px solid ${T.border}`, paddingBottom: 10, overflowX: 'auto' }}>
        {[
          { id: 'hub', label: '⚡ All & Quick Hub', icon: <Zap size={14} /> },
          { id: 'survey', label: '📅 Weekly Survey Window', icon: <Calendar size={14} /> },
          { id: 'meals', label: '🍲 Daily Meal Timings', icon: <Clock size={14} /> },
          { id: 'broadcast', label: '📢 Instant Broadcast Studio', icon: <Send size={14} /> },
        ].map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '9px 16px', borderRadius: 12, border: isActive ? `1.5px solid ${T.accent}` : `1px solid ${T.border}`,
                background: isActive ? T.accentBg : T.inputBg,
                color: isActive ? T.accent : T.textSub,
                fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── TAB 1: ALL & QUICK HUB ── */}
      {(activeTab === 'hub' || activeTab === 'survey') && (
        <AdminCard style={{ marginBottom: 20, border: `1.5px solid ${isLiveSurveyOpen ? '#10b98160' : T.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={20} color={T.accent} />
                Weekly Survey Window Settings
              </div>

            </div>
            <button
              type="button"
              onClick={saveAllTimings}
              disabled={quickSaving}
              style={{
                padding: '9px 18px', borderRadius: 10, border: 'none',
                background: 'var(--accent-grad)', color: '#000', fontSize: 12, fontWeight: 900,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {quickSaving ? 'Saving…' : '⚡ Apply Survey Window'}
            </button>
          </div>

          {/* Quick Presets */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textSub, marginBottom: 8 }}>
              ⚡ 1-Click Presets:
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {WINDOW_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSurveyWindowStartDay(p.startDay)
                    setSurveyWindowStartTime(p.startTime)
                    setSurveyWindowEndDay(p.endDay)
                    setSurveyWindowEndTime(p.endTime)
                    setHasUnsavedChanges(true)
                  }}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.border}`,
                    background: T.inputBg, color: T.text, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.text }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* From & To Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'end', marginBottom: 16 }}>
            {/* From */}
            <div style={{ padding: 12, borderRadius: 12, background: T.inputBg, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#10b981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> From — Survey Opens
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: T.textSub, marginBottom: 4 }}>Day</label>
                  <select
                    value={surveyWindowStartDay}
                    onChange={e => { setSurveyWindowStartDay(e.target.value); setHasUnsavedChanges(true) }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none' }}
                  >
                    {DAYS_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: T.textSub, marginBottom: 4 }}>Time</label>
                  <input
                    type="time"
                    value={surveyWindowStartTime}
                    onChange={e => { setSurveyWindowStartTime(e.target.value); setHasUnsavedChanges(true) }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, boxSizing: 'border-box', background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 16, fontSize: 18, color: T.accent, fontWeight: 900 }}>→</div>

            {/* To */}
            <div style={{ padding: 12, borderRadius: 12, background: T.inputBg, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} /> To — Survey Closes
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: T.textSub, marginBottom: 4 }}>Day</label>
                  <select
                    value={surveyWindowEndDay}
                    onChange={e => { setSurveyWindowEndDay(e.target.value); setHasUnsavedChanges(true) }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none' }}
                  >
                    {DAYS_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: T.textSub, marginBottom: 4 }}>Time</label>
                  <input
                    type="time"
                    value={surveyWindowEndTime}
                    onChange={e => { setSurveyWindowEndTime(e.target.value); setHasUnsavedChanges(true) }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, boxSizing: 'border-box', background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Closed Banner Message */}
          <div>
            <label style={{ display: 'block', color: T.textSub, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
              Closed Banner Message (displayed to members when survey window is closed)
            </label>
            <input
              value={surveyMsg}
              onChange={e => { setSurveyMsg(e.target.value); setHasUnsavedChanges(true) }}
              placeholder={`e.g. Survey opens ${windowLabel}.`}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, outline: 'none' }}
            />
          </div>

          {/* Database Migration & Parity Tool */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={14} color={T.accent} />
                Flat Responses → Day Responses Database Sync
              </div>
              <div style={{ fontSize: 11, color: T.textSub, marginTop: 2 }}>
                Migrates all historical survey submissions from flat tables into canonical <code>survey_day_responses</code> without data loss or mismatch.
              </div>
            </div>
            <button
              type="button"
              onClick={handleMigrateFlatData}
              disabled={migrating}
              style={{
                padding: '8px 16px', borderRadius: 8, border: `1px solid ${T.border}`,
                background: T.inputBg, color: T.accent, fontSize: 11.5, fontWeight: 800,
                cursor: migrating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <RefreshCw size={13} style={{ animation: migrating ? 'spin 1s linear infinite' : 'none' }} />
              {migrating ? 'Migrating…' : 'Sync All Survey Responses'}
            </button>
          </div>
          {migrateResult && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: migrateResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${migrateResult.success ? '#10b981' : '#ef4444'}`, color: migrateResult.success ? '#10b981' : '#ef4444', fontSize: 11.5, fontWeight: 700 }}>
              {migrateResult.message}
            </div>
          )}
        </AdminCard>
      )}

      {/* ── TAB 2: DAILY MEAL EDIT TIMINGS ── */}
      {(activeTab === 'hub' || activeTab === 'meals') && (
        <AdminCard style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={20} color={T.accent} />
                Daily Meal Edit Windows (Lunch & Dinner)
              </div>
              <div style={{ fontSize: 12, color: T.textSub, marginTop: 4 }}>
                Controls when members can modify their portions for the same day.
              </div>
            </div>
            <button
              type="button"
              onClick={saveAllTimings}
              disabled={quickSaving}
              style={{
                padding: '9px 18px', borderRadius: 10, border: 'none',
                background: 'var(--accent-grad)', color: '#000', fontSize: 12, fontWeight: 900,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {quickSaving ? 'Saving…' : '⚡ Apply Meal Timings'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Lunch Edit Box */}
            <div style={{ padding: 14, borderRadius: 14, background: T.inputBg, border: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sun size={18} color="#f59e0b" />
                  <strong style={{ fontSize: 13.5, color: T.text }}>Lunch Edit Window</strong>
                </div>
                <span style={{ fontSize: 10, color: T.textSub }}>Opens prev night → closes same day</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Opens (prev night)</label>
                  <input
                    type="time"
                    value={lunchEditOpen}
                    onChange={e => { setLunchEditOpen(e.target.value); setHasUnsavedChanges(true) }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, boxSizing: 'border-box', background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none' }}
                  />
                </div>
                <div style={{ fontSize: 16, color: T.accent, padding: '0 4px' }}>→</div>
                <div>
                  <label style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Closes (same day)</label>
                  <input
                    type="time"
                    value={lunchEditClose}
                    onChange={e => { setLunchEditClose(e.target.value); setHasUnsavedChanges(true) }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, boxSizing: 'border-box', background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* Dinner Edit Box */}
            <div style={{ padding: 14, borderRadius: 14, background: T.inputBg, border: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Moon size={18} color="#a78bfa" />
                  <strong style={{ fontSize: 13.5, color: T.text }}>Dinner Edit Window</strong>
                </div>
                <span style={{ fontSize: 10, color: T.textSub }}>Opens afternoon → closes evening</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Opens (same day)</label>
                  <input
                    type="time"
                    value={dinnerEditOpen}
                    onChange={e => { setDinnerEditOpen(e.target.value); setHasUnsavedChanges(true) }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, boxSizing: 'border-box', background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none' }}
                  />
                </div>
                <div style={{ fontSize: 16, color: T.accent, padding: '0 4px' }}>→</div>
                <div>
                  <label style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Closes (same day)</label>
                  <input
                    type="time"
                    value={dinnerEditClose}
                    onChange={e => { setDinnerEditClose(e.target.value); setHasUnsavedChanges(true) }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, boxSizing: 'border-box', background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </AdminCard>
      )}

      {/* ── TAB 3: INSTANT BROADCAST STUDIO ── */}
      {(activeTab === 'hub' || activeTab === 'broadcast') && (
        <AdminCard style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Send size={20} color={T.accent} />
                Instant Broadcast Studio
              </div>
              <div style={{ fontSize: 12, color: T.textSub, marginTop: 4 }}>
                Send instant push notification + in-app notice to all {totalMembers} members.
              </div>
            </div>
            <Btn onClick={() => navigate('/admin/notifications')}>
              <Settings size={14} /> Full Notifications Center
            </Btn>
          </div>

          {/* Quick Templates */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: T.textSub, marginBottom: 8 }}>
              ⚡ 1-Click Broadcast Templates:
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {BROADCAST_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setBroadcastTitle(tpl.title)
                    setBroadcastBody(tpl.body)
                    setShowBroadcast(true)
                  }}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: `1px solid ${T.border}`,
                    background: T.inputBg, color: T.text, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.text }}
                >
                  {tpl.title}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {/* Inline Compose Form */}
            <div style={{ padding: 14, borderRadius: 14, background: T.inputBg, border: `1px solid ${T.border}` }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: T.textSub, textTransform: 'uppercase', marginBottom: 4 }}>
                  Notice Title ({60 - broadcastTitle.length} chars left)
                </label>
                <input
                  value={broadcastTitle}
                  maxLength={60}
                  onChange={e => setBroadcastTitle(e.target.value)}
                  placeholder="e.g. Weekly Survey is Now Open!"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: T.textSub, textTransform: 'uppercase', marginBottom: 4 }}>
                  Message Content ({500 - broadcastBody.length} chars left)
                </label>
                <textarea
                  value={broadcastBody}
                  maxLength={500}
                  rows={3}
                  onChange={e => setBroadcastBody(e.target.value)}
                  placeholder="Type your announcement to all members..."
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setBroadcastTitle(''); setBroadcastBody('') }}
                  style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSub, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={sendBroadcast}
                  disabled={broadcasting || !broadcastTitle.trim() || !broadcastBody.trim()}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: (!broadcastTitle.trim() || !broadcastBody.trim() || broadcasting) ? T.border : 'var(--accent-grad)',
                    color: (!broadcastTitle.trim() || !broadcastBody.trim() || broadcasting) ? T.textSub : '#000',
                    fontSize: 12, fontWeight: 900, cursor: (!broadcastTitle.trim() || !broadcastBody.trim() || broadcasting) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Send size={13} /> {broadcasting ? 'Sending…' : `Broadcast to ${totalMembers} Members`}
                </button>
              </div>
            </div>

            {/* Live Push Preview */}
            <div style={{ padding: 14, borderRadius: 14, background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: T.accent, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={12} /> Member Push Preview
              </div>
              <div style={{
                padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,0.1)`,
                boxShadow: '0 8px 20px rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#000', fontWeight: 900 }}>M</div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: T.text }}>Al-Mawaid</span>
                  <span style={{ fontSize: 9, color: T.textSub, marginLeft: 'auto' }}>now</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 2 }}>{broadcastTitle || 'Notification Title'}</div>
                <div style={{ fontSize: 11.5, color: T.textSub, lineHeight: 1.4 }}>{broadcastBody || 'Notification message will appear here on member mobile screens.'}</div>
              </div>
            </div>
          </div>
        </AdminCard>
      )}

      {/* ── BROADCAST MODAL (FOR TRIGGERING FROM ANY TAB) ── */}
      <Modal isOpen={showBroadcast} onClose={() => setShowBroadcast(false)} title="📢 Send Instant Broadcast" maxWidth={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.5 }}>
            Sends an instant push notification + in-app alert to all {totalMembers} members.
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: T.textSub, marginBottom: 6, textTransform: 'uppercase' }}>Title</label>
            <input
              value={broadcastTitle}
              maxLength={60}
              onChange={e => setBroadcastTitle(e.target.value)}
              placeholder="Al-Mawaid Announcement"
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: T.textSub, marginBottom: 6, textTransform: 'uppercase' }}>Message</label>
            <textarea
              value={broadcastBody}
              maxLength={500}
              onChange={e => setBroadcastBody(e.target.value)}
              rows={4}
              placeholder="Type your broadcast message..."
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '12px 14px', borderRadius: 12, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', lineHeight: 1.6 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setShowBroadcast(false)} disabled={broadcasting}>Cancel</Btn>
            <Btn onClick={sendBroadcast} disabled={broadcasting}>
              {broadcasting ? 'Broadcasting…' : <><Send size={14} /> Send to All</>}
            </Btn>
          </div>
        </div>
      </Modal>

    </PageWrap>
  )
}
