import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/firebaseClient'
import { useNavigate } from 'react-router-dom'
import {
  Clock, RefreshCw, BarChart3, Calendar, Send,
  Sun, Moon, Activity, Zap, Timer, Settings,
  Lock, CheckCircle2
} from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Btn, StatCard, Grid, Alert, SectionHeader, Modal } from './ui'
import { getSurveyTargetWeek } from '../common/utils'
import { fetchWeekRows } from '../lib/surveyRows'
import { isSurveyOpen, getSurveyWindowConfig, getSurveyWindowLabel, getSurveyWindowStatus } from '../hooks/useSurvey'

const STATUS_COLORS = {
  auto: { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: 'AUTO', border: 'rgba(99,102,241,0.3)' },
  open: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'OPEN', border: 'rgba(16,185,129,0.3)' },
  closed: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'CLOSED', border: 'rgba(239,68,68,0.3)' },
}

const DAYS_OPTIONS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
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

function StatusBadge({ status, liveStatus }) {
  const isLiveOpen = status === 'auto' && liveStatus === 'open'
  const isLiveClosed = status === 'auto' && liveStatus === 'closed'
  const sc = STATUS_COLORS[status] || STATUS_COLORS.closed
  const activeColor = isLiveOpen ? '#10b981' : isLiveClosed ? '#ef4444' : sc.color
  const activeBg = isLiveOpen ? 'rgba(16,185,129,0.12)' : isLiveClosed ? 'rgba(239,68,68,0.12)' : sc.bg
  const label = isLiveOpen ? 'LIVE: OPEN' : isLiveClosed ? 'LIVE: CLOSED' : sc.label
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 900,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      background: activeBg, color: activeColor,
      border: `1px solid ${activeColor}40`,
    }}>
      {(isLiveOpen || isLiveClosed) && (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: activeColor, animation: isLiveOpen ? 'pulse 2s infinite' : 'none' }} />
      )}
      {label}
    </span>
  )
}

function LiveWindowBadge({ isOpen }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 900,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      background: isOpen ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
      color: isOpen ? '#10b981' : '#ef4444',
      border: `1px solid ${isOpen ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', animation: isOpen ? 'pulse 2s infinite' : 'none' }} />
      {isOpen ? 'LIVE: OPEN' : 'LIVE: CLOSED'}
    </span>
  )
}

function AutomationCard({ icon, title, description, status, liveStatus, onToggle, stats, loading, action }) {
  return (
    <AdminCard style={{ display: 'flex', flexDirection: 'column', gap: 16, border: `1px solid ${STATUS_COLORS[status]?.border || 'rgba(197,160,89,0.15)'}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: T.accent }}>{icon}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 2 }}>{title}</div>
            <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.4 }}>{description}</div>
          </div>
        </div>
        <StatusBadge status={status} liveStatus={liveStatus} />
      </div>
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.08)' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color || T.text }}>{s.value}</div>
              <div style={{ fontSize: 9, color: T.textSub, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
      {onToggle ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[['auto', 'AUTO', '#6366f1'], ['open', 'OPEN', '#10b981'], ['closed', 'CLOSED', '#ef4444']].map(([val, label, color]) => (
            <button key={val} onClick={() => onToggle(val)} disabled={loading} style={{ flex: 1, padding: '8px 6px', borderRadius: 8, cursor: 'pointer', background: status === val ? `${color}18` : 'transparent', border: status === val ? `1px solid ${color}40` : '1px solid transparent', color: status === val ? color : T.textSub, fontSize: 10, fontWeight: 900, letterSpacing: '0.06em', transition: 'all 0.2s', fontFamily: 'inherit', opacity: loading ? 0.5 : 1 }}>{label}</button>
          ))}
        </div>
      ) : action ? <div>{action}</div> : null}
    </AdminCard>
  )
}

export default function AutomationPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState({})
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
  const [liveSurveyStatus, setLiveSurveyStatus] = useState(null)
  const [liveLunchStatus, setLiveLunchStatus] = useState(null)
  const [liveDinnerStatus, setLiveDinnerStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [quickSaving, setQuickSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [broadcasting, setBroadcasting] = useState(false)
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
      const weekId = getSurveyTargetWeek(s)

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
      setScheduledCount(sc)
      setPendingSurveyCount(pendingSurvey)
      setTodayApplied(todayAppliedCount)
      setTotalMembers(tm)
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      const { data: recentBc } = await supabase.from('broadcast_schedule').select('sent_count, failed_count').gte('sent_at', since).limit(200)
      setDelivered24h((recentBc || []).reduce((n, s) => n + (s.sent_count || 0), 0))
      setFailed24h((recentBc || []).reduce((n, s) => n + (s.failed_count || 0), 0))
    } catch (e) { console.error('Automation load error:', e) }
    setLoading(false)
  }, [])

  loadRef.current = load
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const channel = supabase.channel('automation-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => { loadRef.current() }).on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_schedule' }, () => { loadRef.current() }).on('postgres_changes', { event: '*', schema: 'public', table: 'survey_day_responses' }, () => { loadRef.current() }).on('postgres_changes', { event: '*', schema: 'public', table: 'daily_feedback' }, () => { loadRef.current() }).subscribe()
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
    }, 30000)
    return () => clearInterval(timer)
  }, [settings])

  const handleToggle = async (key, value) => {
    setSaving(true); setMsg('')
    const nextSettings = { ...settings, [key]: value }
    setSettings(nextSettings)
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
      setMsg('✅ Automation setting updated')
      setTimeout(() => setMsg(''), 2500)
    } catch (e) { setMsg(`Error: ${e.message}`) }
    setSaving(false)
  }

  const quickSaveSurveySettings = async () => {
    setQuickSaving(true); setMsg('')
    const toSave = [
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

    // Clean up legacy hour keys only — keep survey_window_status as the new override
    try { await supabase.from('app_settings').delete().in('key', ['survey_open_hour', 'survey_close_hour']).then(() => {}) } catch {}
    let err = null
    for (const row of toSave) {
      const { error } = await supabase.from('app_settings').upsert(row, { onConflict: 'key' })
      if (error) { err = error; break }
    }
    setQuickSaving(false)
    if (err) { setMsg(`Quick save failed: ${err.message}`) }
    else { const now = new Date().toLocaleTimeString(); setMsg(`✅ Survey & Edit windows updated at ${now} — ${surveyWindowStartDay} ${surveyWindowStartTime} → ${surveyWindowEndDay} ${surveyWindowEndTime}`); setTimeout(() => setMsg(''), 4000) }
  }

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
        const { data: pushResult, error: pushError } = await supabase.functions.invoke('send-push', { body: { title, body, target_type: 'all', url: '/', sender_name: 'Al-Mawaid' } })
        if (pushError) throw pushError
        sent = pushResult?.sent || 0; failed = pushResult?.failed || 0
      } catch (err) { console.error('Broadcast push trigger error:', err); failed = userIds.length }
      const adminUser = (await supabase.auth.getUser()).data?.user?.id || null
      await supabase.from('broadcast_schedule').insert([{ notice_id: noticeData.id, title, body, sender_name: 'Al-Mawaid', tone: 'var(--accent-primary)', media_url: '', target_type: 'all', channel: 'push', status: failed > 0 && sent === 0 ? 'failed' : 'sent', scheduled_for: now, total_targets: userIds.length, sent_count: sent, failed_count: failed, created_by: adminUser }])
      setMsg(`✅ Broadcast sent to ${userIds.length} member(s) · ${sent} push delivered, ${failed} failed`); setShowBroadcast(false); setBroadcastTitle(''); setBroadcastBody(''); setTimeout(() => setMsg(''), 5000)
    } catch (e) { console.error('Broadcast error:', e); setMsg(`Broadcast failed: ${e.message}`) }
    setBroadcasting(false)
  }

  const autoProcesses = [
    { key: 'lunch_edit_status', title: 'Lunch Edit Window', description: 'Auto-opens previous night 8PM, closes same day 11AM. Members can modify lunch preferences.', icon: <Sun size={18} />, status: lunchEditStatus, liveStatus: liveLunchStatus, stats: [{ label: 'Window', value: `${settings.lunch_edit_open || '20:00'} - ${settings.lunch_edit_close || '11:00'}`, color: T.text }, { label: 'Status', value: liveLunchStatus === 'open' ? 'Open Now' : 'Closed', color: liveLunchStatus === 'open' ? '#10b981' : '#ef4444' }] },
    { key: 'dinner_edit_status', title: 'Dinner Edit Window', description: 'Auto-opens 12PM, closes 3:30PM. Members can modify dinner preferences for same day.', icon: <Moon size={18} />, status: dinnerEditStatus, liveStatus: liveDinnerStatus, stats: [{ label: 'Window', value: `${settings.dinner_edit_open || '12:00'} - ${settings.dinner_edit_close || '15:30'}`, color: T.text }, { label: 'Status', value: liveDinnerStatus === 'open' ? 'Open Now' : 'Closed', color: liveDinnerStatus === 'open' ? '#10b981' : '#ef4444' }] },
  ]

  const systemProcesses = [{ title: 'Scheduled Broadcasts', description: 'Upcoming automated notifications and menu publish schedules.', icon: <Send size={18} />, status: 'auto', liveStatus: null, stats: [{ label: 'Scheduled', value: scheduledCount, color: '#6366f1' }, { label: 'Delivered 24h', value: delivered24h, color: '#10b981' }, { label: 'Failed 24h', value: failed24h, color: '#ef4444' }] }]

  if (loading) {
    return (
      <PageWrap><PageTitle>Automation</PageTitle><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>{[1,2,3,4].map(i => (<AdminCard key={i} style={{ height: 180 }}><div style={{ width: '60%', height: 14, borderRadius: 7, background: T.border, marginBottom: 12 }} /><div style={{ width: '100%', height: 10, borderRadius: 5, background: T.border, marginBottom: 8 }} /><div style={{ width: '80%', height: 10, borderRadius: 5, background: T.border }} /></AdminCard>))}</div></PageWrap>
    )
  }

  const windowLabel = getSurveyWindowLabel({ survey_window_start_day: surveyWindowStartDay, survey_window_start_time: surveyWindowStartTime, survey_window_end_day: surveyWindowEndDay, survey_window_end_time: surveyWindowEndTime })
  const isLiveOpen = liveSurveyStatus === 'open'

  return (
    <PageWrap>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <PageTitle sub="Admin controls when the weekly survey is visible. Members can fill as New, resume Partial, or complete Haven't filled — admin has full rights."><span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Zap size={28} color={T.accent} />Automation</span></PageTitle>
        <Btn variant="ghost" onClick={() => load()} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /></Btn>
      </div>
      {msg && (<div style={{ marginBottom: 20 }}><Alert msg={msg} type={msg.includes('Error') || msg.includes('failed') ? 'error' : 'success'} /></div>)}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard icon={<Activity size={20} />} label="Live Window Status" value={isLiveOpen ? 'SURVEY OPEN' : 'SURVEY CLOSED'} color={isLiveOpen ? '#10b981' : '#ef4444'} sub={isLiveOpen ? 'New · Partial · Haven\'t filled can submit' : windowLabel} />
        <StatCard icon={<BarChart3 size={20} />} label="Today's Applied" value={todayApplied} color="#6366f1" sub={`Out of ${totalMembers} members`} />
        <StatCard icon={<Timer size={20} />} label="Scheduled Broadcasts" value={scheduledCount} color="#f59e0b" sub={`${delivered24h} delivered in last 24h`} />
      </div>

      {/* ── NEW: Survey Live Window (From → To) ── */}
      <AdminCard style={{ marginBottom: 24, border: `1.5px solid ${isLiveOpen ? 'rgba(16,185,129,0.35)' : T.border}`, background: isLiveOpen ? 'linear-gradient(135deg, rgba(16,185,129,0.07), transparent 70%)' : T.card }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: isLiveOpen ? 'rgba(16,185,129,0.15)' : T.accentBg, border: `1px solid ${isLiveOpen ? 'rgba(16,185,129,0.35)' : T.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isLiveOpen ? '#10b981' : T.accent }}><Calendar size={20} /></div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: T.text, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>Survey Live Window <LiveWindowBadge isOpen={isLiveOpen} /></div>
              <div style={{ fontSize: 12, color: T.textSub, marginTop: 4, lineHeight: 1.5 }}>Pick the <strong style={{ color: T.text }}>From (Day + Time)</strong> and <strong style={{ color: T.text }}>To (Day + Time)</strong> when the weekly survey is visible. New members, Partial-resume, and Haven't-filled all use this same window. Admin retains full rights in the tracker.</div>
              <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: T.inputBg, border: `1px solid ${T.border}`, fontSize: 11, color: T.textSub }}><Clock size={12} /> Current: <strong style={{ color: T.accent }}>{windowLabel}</strong></div>
            </div>
          </div>
          <button type="button" onClick={quickSaveSurveySettings} disabled={quickSaving} style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: quickSaving ? T.border : 'var(--accent-grad)', color: quickSaving ? T.textSub : '#000', fontSize: 12, fontWeight: 900, cursor: quickSaving ? 'not-allowed' : 'pointer', opacity: quickSaving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>{quickSaving ? '⏳ Saving…' : '⚡ Apply Window'}</button>
        </div>

        {/* Admin override — linked to weekly day/time window */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 12, background: T.inputBg, border: `1px solid ${T.inputBorder}` }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textSub, display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={12} color={T.accent} /> Admin Control</span>
          <span style={{ fontSize: 11, color: T.textSub, opacity: 0.8 }}>Weekly day/time window is linked — override below takes instant effect:</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {[
              ['auto', 'AUTO', '#6366f1', 'Follows day/time window'],
              ['open', 'FORCE OPEN', '#10b981', 'Survey open for all members now'],
              ['closed', 'FORCE CLOSED', '#ef4444', 'Survey closed regardless of window'],
            ].map(([val, label, color, tip]) => (
              <button
                key={val}
                title={tip}
                onClick={() => handleToggle('survey_window_status', val)}
                disabled={saving}
                style={{
                  padding: '7px 12px', borderRadius: 8, cursor: saving ? 'wait' : 'pointer',
                  background: surveyWindowStatus === val ? `${color}18` : 'transparent',
                  border: surveyWindowStatus === val ? `1px solid ${color}40` : '1px solid transparent',
                  color: surveyWindowStatus === val ? color : T.textSub,
                  fontSize: 10, fontWeight: 900, letterSpacing: '0.06em', transition: 'all 0.2s', fontFamily: 'inherit', opacity: saving ? 0.5 : 1
                }}
              >{label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 14, alignItems: 'end' }}>
          {/* From */}
          <div style={{ padding: 14, borderRadius: 12, background: T.inputBg, border: `1px solid ${T.inputBorder}` }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.accent, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> From — Survey Opens</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textSub, marginBottom: 4 }}>Day</label>
                <select value={surveyWindowStartDay} onChange={e => setSurveyWindowStartDay(e.target.value)} style={{ width: '100%', padding: '10px 10px', borderRadius: 8, background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit' }}>
                  {DAYS_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textSub, marginBottom: 4 }}>Time</label>
                <input type="time" value={surveyWindowStartTime} onChange={e => setSurveyWindowStartTime(e.target.value)} style={{ width: '100%', padding: '10px 10px', borderRadius: 8, boxSizing: 'border-box', background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 18, fontSize: 18, color: T.accent, fontWeight: 900 }}>→</div>
          {/* To */}
          <div style={{ padding: 14, borderRadius: 12, background: T.inputBg, border: `1px solid ${T.inputBorder}` }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} /> To — Survey Closes</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textSub, marginBottom: 4 }}>Day</label>
                <select value={surveyWindowEndDay} onChange={e => setSurveyWindowEndDay(e.target.value)} style={{ width: '100%', padding: '10px 10px', borderRadius: 8, background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit' }}>
                  {DAYS_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textSub, marginBottom: 4 }}>Time</label>
                <input type="time" value={surveyWindowEndTime} onChange={e => setSurveyWindowEndTime(e.target.value)} style={{ width: '100%', padding: '10px 10px', borderRadius: 8, boxSizing: 'border-box', background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: isLiveOpen ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.06)', border: `1px solid ${isLiveOpen ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.18)'}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: T.textSub, lineHeight: 1.5, flexWrap: 'wrap' }}>
          {isLiveOpen ? <CheckCircle2 size={14} color="#10b981" /> : <Lock size={14} color="#ef4444" />}
          <span>
            {surveyWindowStatus === 'open' ? `Survey is FORCED OPEN by admin — weekly window (${windowLabel}) is bypassed. All members can fill/resume now.`
              : surveyWindowStatus === 'closed' ? `Survey is FORCED CLOSED by admin — weekly window (${windowLabel}) is paused.`
              : isLiveOpen ? 'Survey is currently LIVE — new fillers, partial-resume and haven\'t-filled members can all submit or edit their week.'
              : `Survey is currently CLOSED — members see: "${surveyMsg || `Opens ${windowLabel}`}"`}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.7 }}>{surveyWindowStatus !== 'auto' ? `Override: ${surveyWindowStatus.toUpperCase()} • Linked to weekly day/time` : 'Auto-linked to weekly day/time • Admin tracker has full rights'}</span>
        </div>

        <div style={{ marginTop: 12 }}>
          <label htmlFor="surveyMsg2" style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Closed Message (shown to members when survey is outside window)</label>
          <input id="surveyMsg2" value={surveyMsg} onChange={e => setSurveyMsg(e.target.value)} placeholder={`e.g. Survey opens ${windowLabel}.`} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        </div>
      </AdminCard>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: T.textSub, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}><Clock size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} /> Meal Edit Windows</div>
        <Grid cols={2} gap={16}>
          {autoProcesses.map(p => (<AutomationCard key={p.key} icon={p.icon} title={p.title} description={p.description} status={p.status} liveStatus={p.liveStatus} stats={p.stats} loading={saving} onToggle={(val) => handleToggle(p.key, val)} />))}
        </Grid>
      </div>

      <div>
        <div style={{ fontSize: 11, color: T.textSub, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}><Settings size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />System Automations</div>
        <Grid cols={4} gap={16}>
          {systemProcesses.map((p, i) => (<AutomationCard key={i} icon={p.icon} title={p.title} description={p.description} status={p.status} liveStatus={p.liveStatus} stats={p.stats} action={<Btn onClick={() => navigate('/admin/notifications')} style={{ width: '100%' }}><Settings size={14} /> Manage Broadcasts</Btn>} loading={false} />))}
        </Grid>
      </div>

      <SectionHeader style={{ marginTop: 32, marginBottom: 12 }}>📢 Send Broadcast</SectionHeader>
      <AdminCard style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}><Send size={20} color={T.accent} /><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Broadcast Now</div></div>
        <div style={{ fontSize: 12, color: T.textSub, marginBottom: 16, lineHeight: 1.4 }}>Create and send an instant broadcast notification to all members. Members receive a single in-app alert plus a native push when the app is closed.</div>
        <Btn onClick={() => setShowBroadcast(true)} style={{ width: '100%' }}><Send size={14} /> Broadcast</Btn>
      </AdminCard>

      <AdminCard style={{ marginTop: 8 }}>
        <SectionHeader style={{ marginBottom: 8 }}>🛠️ Meal Edit Window Timing</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ padding: '14px 16px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.inputBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><span style={{ fontSize: 15 }}>☀️</span><span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Lunch Edit Window</span><span style={{ fontSize: 10, color: T.textSub, opacity: 0.6 }}>prev night → same day</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
              <div><label style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Opens (prev night)</label><input type="time" value={lunchEditOpen} onChange={e => setLunchEditOpen(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, boxSizing: 'border-box', background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit' }} /></div>
              <div style={{ fontSize: 16, color: T.accent, padding: '0 4px' }}>→</div>
              <div><label style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Closes (same day)</label><input type="time" value={lunchEditClose} onChange={e => setLunchEditClose(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, boxSizing: 'border-box', background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit' }} /></div>
            </div>
          </div>
          <div style={{ padding: '14px 16px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.inputBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><span style={{ fontSize: 15 }}>🌙</span><span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Dinner Edit Window</span><span style={{ fontSize: 10, color: T.textSub, opacity: 0.6 }}>same day</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
              <div><label style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Opens (same day)</label><input type="time" value={dinnerEditOpen} onChange={e => setDinnerEditOpen(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, boxSizing: 'border-box', background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit' }} /></div>
              <div style={{ fontSize: 16, color: T.accent, padding: '0 4px' }}>→</div>
              <div><label style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Closes (same day)</label><input type="time" value={dinnerEditClose} onChange={e => setDinnerEditClose(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, boxSizing: 'border-box', background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit' }} /></div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <p style={{ flex: 1, fontSize: 10, color: T.textSub, opacity: 0.7, lineHeight: 1.65, margin: 0 }}>💡 Meal edit windows apply when Lunch/Dinner status is AUTO. Survey window above controls the weekly fill for all member types.</p>
          <button type="button" onClick={quickSaveSurveySettings} disabled={quickSaving} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: quickSaving ? T.border : 'var(--accent-grad)', color: quickSaving ? T.textSub : '#000', fontSize: 12, fontWeight: 800, cursor: quickSaving ? 'not-allowed' : 'pointer', opacity: quickSaving ? 0.6 : 1 }}>⚡ Apply Meal Windows</button>
        </div>
      </AdminCard>

      <Modal isOpen={showBroadcast} onClose={() => setShowBroadcast(false)} title="📢 Send Instant Broadcast" maxWidth={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.5 }}>Sends an instant push notification + in-app alert to every member. This cannot be undone.</div>
          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: T.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title</label><input value={broadcastTitle} maxLength={60} onChange={e => setBroadcastTitle(e.target.value)} placeholder="Al-Mawaid Announcement" style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }} /></div>
          <div><label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: T.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Message</label><textarea value={broadcastBody} maxLength={500} onChange={e => setBroadcastBody(e.target.value)} rows={4} placeholder="Type your broadcast message..." style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '12px 14px', borderRadius: 12, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', lineHeight: 1.6 }} /></div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}><Btn variant="ghost" onClick={() => setShowBroadcast(false)} disabled={broadcasting}>Cancel</Btn><Btn onClick={sendBroadcast} disabled={broadcasting}>{broadcasting ? 'Broadcasting…' : <><Send size={14} /> Send to All</>}</Btn></div>
        </div>
      </Modal>
    </PageWrap>
  )
}
