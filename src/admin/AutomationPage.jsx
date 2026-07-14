import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/firebaseClient'
import {
  Clock, RefreshCw, Bell, BarChart3, Calendar, Send,
  Sun, Moon, Activity, CheckCircle, XCircle, AlertTriangle,
  Zap, Timer, MessageSquare, Settings, Shield
} from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Btn, StatCard, Badge, Grid, Alert, SectionHeader } from './ui'
import { getWeekDate } from '../common/utils'
import SurveyAccessManager from './SurveyAccessManager'

const STATUS_COLORS = {
  auto: { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: 'AUTO', border: 'rgba(99,102,241,0.3)' },
  open: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'OPEN', border: 'rgba(16,185,129,0.3)' },
  closed: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'CLOSED', border: 'rgba(239,68,68,0.3)' },
}

const isTimingOpen = (type, settings) => {
  const now = new Date()
  const day = now.getDay()
  const minute = now.getHours() * 60 + now.getMinutes()

  if (type === 'survey') {
    const openH = parseInt(settings.survey_open_hour) || 20
    const closeH = parseInt(settings.survey_close_hour) || 10
    if (day === 6 && now.getHours() >= openH) return true
    if (day === 0) return true
    if (day === 1 && now.getHours() < closeH) return true
    return false
  }

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
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: activeColor,
          animation: isLiveOpen ? 'pulse 2s infinite' : 'none',
        }} />
      )}
      {label}
    </span>
  )
}

function AutomationCard({ icon, title, description, status, liveStatus, onToggle, stats, loading }) {
  return (
    <AdminCard style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      border: `1px solid ${STATUS_COLORS[status]?.border || 'rgba(197,160,89,0.15)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            color: T.accent,
          }}>{icon}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 2 }}>{title}</div>
            <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.4 }}>{description}</div>
          </div>
        </div>
        <StatusBadge status={status} liveStatus={liveStatus} />
      </div>
      {stats && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8,
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.08)',
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color || T.text }}>{s.value}</div>
              <div style={{ fontSize: 9, color: T.textSub, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {[['auto', 'AUTO', '#6366f1'], ['open', 'OPEN', '#10b981'], ['closed', 'CLOSED', '#ef4444']].map(([val, label, color]) => (
          <button
            key={val}
            onClick={() => onToggle(val)}
            disabled={loading}
            style={{
              flex: 1, padding: '8px 6px', borderRadius: 8, cursor: 'pointer',
              background: status === val ? `${color}18` : 'transparent',
              border: status === val ? `1px solid ${color}40` : '1px solid transparent',
              color: status === val ? color : T.textSub,
              fontSize: 10, fontWeight: 900, letterSpacing: '0.06em',
              transition: 'all 0.2s', fontFamily: 'inherit',
              opacity: loading ? 0.5 : 1,
            }}
          >{label}</button>
        ))}
      </div>
    </AdminCard>
  )
}

export default function AutomationPage() {
  const [settings, setSettings] = useState({})
  const [surveyStatus, setSurveyStatus] = useState('auto')
  const [lunchEditStatus, setLunchEditStatus] = useState('auto')
  const [dinnerEditStatus, setDinnerEditStatus] = useState('auto')
  const [surveyMsg, setSurveyMsg] = useState('')
  const [surveyOpenHour, setSurveyOpenHour] = useState(20)
  const [surveyCloseHour, setSurveyCloseHour] = useState(10)
  const [liveSurveyStatus, setLiveSurveyStatus] = useState(null)
  const [liveLunchStatus, setLiveLunchStatus] = useState(null)
  const [liveDinnerStatus, setLiveDinnerStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [quickSaving, setQuickSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [isAccessManagerOpen, setIsAccessManagerOpen] = useState(false)

  const [scheduledCount, setScheduledCount] = useState(0)
  const [pendingSurveyCount, setPendingSurveyCount] = useState(0)
  const [todayApplied, setTodayApplied] = useState(0)
  const [todayFeedback, setTodayFeedback] = useState(0)
  const [totalMembers, setTotalMembers] = useState(0)

  const loadRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const { data: appSettings } = await supabase.from('app_settings').select('*')
      const s = {}
      if (appSettings) {
        appSettings.forEach(row => { s[row.key] = row.value })
        setSettings(s)
        setSurveyStatus(s.survey_status || 'auto')
        setLunchEditStatus(s.lunch_edit_status || 'auto')
        setDinnerEditStatus(s.dinner_edit_status || 'auto')
        setSurveyMsg(s.survey_msg || '')
        setSurveyOpenHour(parseInt(s.survey_open_hour) || 20)
        setSurveyCloseHour(parseInt(s.survey_close_hour) || 10)
      }
      setLiveSurveyStatus(isTimingOpen('survey', s) ? 'open' : 'closed')
      setLiveLunchStatus(isTimingOpen('lunch', s) ? 'open' : 'closed')
      setLiveDinnerStatus(isTimingOpen('dinner', s) ? 'open' : 'closed')

      const today = new Date()
      const day = today.getDay()
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
      const dayKey = dayNames[day]
      const mealKey = today.getHours() < 15 ? 'l' : 'd'
      const statusField = `${dayKey}_${mealKey}_status`
      const isSunday = day === 0

      const weekId = getWeekDate()

      const [
        { count: sc },
        { count: ps },
        { count: ta },
        { count: tf },
        { count: tm },
      ] = await Promise.all([
        supabase.from('broadcast_schedule').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
        isSunday
          ? { count: 0 }
          : supabase.from('survey_submissions_flat').select('id', { count: 'exact', head: true }).eq('week_id', weekId).not(statusField, 'eq', 'Applied').not(statusField, 'eq', 'Skipped'),
        isSunday
          ? { count: 0 }
          : supabase.from('survey_submissions_flat').select('id', { count: 'exact', head: true }).eq('week_id', weekId).eq(statusField, 'Applied'),
        supabase.from('daily_feedback').select('id', { count: 'exact', head: true }),
        supabase.from('user_stats').select('user_id', { count: 'exact', head: true }),
      ])

      setScheduledCount(sc)
      setPendingSurveyCount(ps)
      setTodayApplied(ta)
      setTodayFeedback(tf)
      setTotalMembers(tm)
    } catch (e) {
      console.error('Automation load error:', e)
    }
    setLoading(false)
  }, [])

  loadRef.current = load

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('automation-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => { loadRef.current() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_schedule' }, () => { loadRef.current() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_submissions_flat' }, () => { loadRef.current() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_feedback' }, () => { loadRef.current() })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveSurveyStatus(isTimingOpen('survey', settings) ? 'open' : 'closed')
      setLiveLunchStatus(isTimingOpen('lunch', settings) ? 'open' : 'closed')
      setLiveDinnerStatus(isTimingOpen('dinner', settings) ? 'open' : 'closed')
    }, 30000)
    return () => clearInterval(timer)
  }, [settings])

  const handleToggle = async (key, value) => {
    setSaving(true)
    setMsg('')
    try {
      const { error } = await supabase.from('app_settings').upsert(
        { key, value },
        { onConflict: 'key' }
      )
      if (error) throw error
      if (key === 'survey_status') setSurveyStatus(value)
      if (key === 'lunch_edit_status') setLunchEditStatus(value)
      if (key === 'dinner_edit_status') setDinnerEditStatus(value)
      setMsg('Automation setting updated')
      setTimeout(() => setMsg(''), 2000)
    } catch (e) {
      setMsg(`Error: ${e.message}`)
    }
    setSaving(false)
  }

  const quickSaveSurveySettings = async () => {
    setQuickSaving(true)
    setMsg('')
    const toSave = [
      { key: 'survey_status', value: surveyStatus },
      { key: 'survey_msg', value: surveyMsg || 'Survey opens Saturday at 8:00 PM and closes Monday at 11:00 AM.' },
      { key: 'survey_open_hour', value: surveyOpenHour.toString() },
      { key: 'survey_close_hour', value: surveyCloseHour.toString() },
    ]
    let err = null
    for (const row of toSave) {
      const { error } = await supabase.from('app_settings')
        .upsert(row, { onConflict: 'key' })
      if (error) { err = error; break }
    }
    setQuickSaving(false)
    if (err) {
      setMsg(`Quick save failed: ${err.message}`)
    } else {
      const now = new Date().toLocaleTimeString()
      setMsg(`✅ Survey settings applied at ${now}`)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  const autoProcesses = [
    {
      key: 'survey_status',
      title: 'Survey Window',
      description: 'Auto-opens Saturday 8PM, closes Monday 11AM. Members can submit their weekly meal preferences.',
      icon: <Calendar size={18} />,
      status: surveyStatus,
      liveStatus: liveSurveyStatus,
      stats: [
        { label: 'Applied Today', value: todayApplied, color: '#10b981' },
        { label: 'Pending', value: pendingSurveyCount, color: '#f59e0b' },
        { label: 'Total Members', value: totalMembers, color: T.accent },
      ],
    },
    {
      key: 'lunch_edit_status',
      title: 'Lunch Edit Window',
      description: 'Auto-opens previous night 8PM, closes same day 11AM. Members can modify lunch preferences.',
      icon: <Sun size={18} />,
      status: lunchEditStatus,
      liveStatus: liveLunchStatus,
      stats: [
        { label: 'Window', value: `${settings.lunch_edit_open || '20:00'} - ${settings.lunch_edit_close || '11:00'}`, color: T.text },
        { label: 'Status', value: liveLunchStatus === 'open' ? 'Open Now' : 'Closed', color: liveLunchStatus === 'open' ? '#10b981' : '#ef4444' },
      ],
    },
    {
      key: 'dinner_edit_status',
      title: 'Dinner Edit Window',
      description: 'Auto-opens 12PM, closes 3:30PM. Members can modify dinner preferences for same day.',
      icon: <Moon size={18} />,
      status: dinnerEditStatus,
      liveStatus: liveDinnerStatus,
      stats: [
        { label: 'Window', value: `${settings.dinner_edit_open || '12:00'} - ${settings.dinner_edit_close || '15:30'}`, color: T.text },
        { label: 'Status', value: liveDinnerStatus === 'open' ? 'Open Now' : 'Closed', color: liveDinnerStatus === 'open' ? '#10b981' : '#ef4444' },
      ],
    },
  ]

  const systemProcesses = [
    {
      title: 'Survey Reminders',
      description: 'Auto-sends push notifications every 30 min to members with pending surveys.',
      icon: <Bell size={18} />,
      status: 'auto',
      liveStatus: 'open',
      stats: [
        { label: 'Pending Today', value: pendingSurveyCount, color: '#f59e0b' },
        { label: 'Reminder Interval', value: '30 min', color: T.accent },
      ],
    },
    {
      title: 'Daily Survey Digest',
      description: 'Sends daily summary to admins at 6PM with applied/skipped/pending counts.',
      icon: <BarChart3 size={18} />,
      status: 'auto',
      liveStatus: 'open',
      stats: [
        { label: 'Meals Tracked', value: todayApplied, color: '#10b981' },
        { label: 'Feedback Today', value: todayFeedback, color: '#6366f1' },
      ],
    },
    {
      title: 'Scheduled Broadcasts',
      description: 'Upcoming automated notifications and menu publish schedules.',
      icon: <Send size={18} />,
      status: 'auto',
      liveStatus: null,
      stats: [
        { label: 'Scheduled', value: scheduledCount, color: '#6366f1' },
        { label: 'Auto-publish', value: settings.publish_at ? 'Set' : 'Not Set', color: settings.publish_at ? '#10b981' : T.textSub },
      ],
    },
    {
      title: 'Auto Survey Window',
      description: 'Auto-closes survey Monday 11:30AM. Auto-opens Saturday 8PM via Cloud Functions.',
      icon: <Timer size={18} />,
      status: 'auto',
      liveStatus: liveSurveyStatus,
      stats: [
        { label: 'Auto-Close', value: 'Mon 11:30 AM', color: '#ef4444' },
        { label: 'Auto-Open', value: 'Sat 8:00 PM', color: '#10b981' },
      ],
    },
  ]

  if (loading) {
    return (
      <PageWrap>
        <PageTitle>Automation</PageTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {[1,2,3,4,5,6].map(i => (
            <AdminCard key={i} style={{ height: 180 }}>
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
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <PageTitle sub="Manage automated processes and view real-time system status">
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Zap size={28} color={T.accent} />
            Automation
          </span>
        </PageTitle>
        <Btn variant="ghost" onClick={() => load()} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
        </Btn>
      </div>

      {msg && (
        <div style={{ marginBottom: 20 }}>
          <Alert msg={msg} type={msg.includes('Error') ? 'error' : 'success'} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard icon={<Activity size={20} />} label="Live Window Status" value={liveSurveyStatus === 'open' ? 'SURVEY OPEN' : 'SURVEY CLOSED'} color={liveSurveyStatus === 'open' ? '#10b981' : '#ef4444'} sub={liveSurveyStatus === 'open' ? 'Members can submit' : 'Opens Saturday 8PM'} />
        <StatCard icon={<BarChart3 size={20} />} label="Today's Applied" value={todayApplied} color="#6366f1" sub={`Out of ${totalMembers} members`} />
        <StatCard icon={<Timer size={20} />} label="Scheduled Broadcasts" value={scheduledCount} color="#f59e0b" sub="Awaiting delivery" />
        <StatCard icon={<Bell size={20} />} label="Pending Surveys" value={pendingSurveyCount} color={pendingSurveyCount > 0 ? '#f59e0b' : '#10b981'} sub={pendingSurveyCount > 0 ? 'Reminders active' : 'All caught up'} />
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: T.textSub, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
          <Clock size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          Time-based Automations
        </div>
        <Grid cols={3} gap={16}>
          {autoProcesses.map(p => (
            <AutomationCard
              key={p.key}
              icon={p.icon}
              title={p.title}
              description={p.description}
              status={p.status}
              liveStatus={p.liveStatus}
              stats={p.stats}
              loading={saving}
              onToggle={(val) => handleToggle(p.key, val)}
            />
          ))}
        </Grid>
      </div>

      <div>
        <div style={{ fontSize: 11, color: T.textSub, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
          <Settings size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          System Automations
        </div>
        <Grid cols={4} gap={16}>
          {systemProcesses.map((p, i) => (
            <AutomationCard
              key={i}
              icon={p.icon}
              title={p.title}
              description={p.description}
              status={p.status}
              liveStatus={p.liveStatus}
              stats={p.stats}
              onToggle={() => {}}
              loading={false}
            />
          ))}
        </Grid>
      </div>

      {/* Survey Configuration */}
      <AdminCard style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
          <SectionHeader style={{ marginBottom: 0 }}>🛠️ Survey Access Controls</SectionHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Btn type="button" variant="outline" onClick={() => setIsAccessManagerOpen(true)}>
              <Shield size={16} /> User Overrides
            </Btn>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800,
              background: surveyStatus === 'open' ? 'rgba(16,185,129,0.12)' : surveyStatus === 'closed' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
              color: surveyStatus === 'open' ? '#10b981' : surveyStatus === 'closed' ? '#ef4444' : '#6366f1',
              border: `1px solid ${surveyStatus === 'open' ? 'rgba(16,185,129,0.3)' : surveyStatus === 'closed' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}`,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: surveyStatus === 'open' ? 'pulse 2s infinite' : 'none' }} />
              Survey: {surveyStatus.toUpperCase()}
            </div>
            <button
              type="button"
              onClick={quickSaveSurveySettings}
              disabled={quickSaving}
              style={{
                padding: '8px 18px', borderRadius: 10, border: 'none',
                background: 'var(--accent-grad)', color: '#000',
                fontSize: 12, fontWeight: 900, cursor: quickSaving ? 'not-allowed' : 'pointer',
                opacity: quickSaving ? 0.6 : 1, transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {quickSaving ? '⏳ Saving…' : '⚡ Apply Now'}
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 16 }}>
          <div>
            <label style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Survey Window Timing
            </label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 10, color: T.textSub }}>Opens Saturday</span>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <input type="number" min={0} max={23} value={surveyOpenHour} onChange={e => setSurveyOpenHour(e.target.value)}
                    style={{ width: 60, padding: '8px', borderRadius: 6, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, fontWeight: 700, textAlign: 'center', outline: 'none', fontFamily: 'inherit' }}
                  />
                  <span style={{ fontSize: 12, color: T.textSub, display: 'flex', alignItems: 'center' }}>:00</span>
                </div>
              </div>
              <span style={{ color: T.accent }}>→</span>
              <div>
                <span style={{ fontSize: 10, color: T.textSub }}>Closes Monday</span>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <input type="number" min={0} max={23} value={surveyCloseHour} onChange={e => setSurveyCloseHour(e.target.value)}
                    style={{ width: 60, padding: '8px', borderRadius: 6, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, fontWeight: 700, textAlign: 'center', outline: 'none', fontFamily: 'inherit' }}
                  />
                  <span style={{ fontSize: 12, color: T.textSub, display: 'flex', alignItems: 'center' }}>:00</span>
                </div>
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="surveyMsg" style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Survey Notice (shown when closed)
            </label>
            <textarea
              id="surveyMsg"
              value={surveyMsg}
              onChange={e => setSurveyMsg(e.target.value)}
              rows={2}
              placeholder="Survey opens Saturday at 8:00 PM."
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical',
                padding: '10px 12px', borderRadius: 8,
                background: T.inputBg, border: `1px solid ${T.inputBorder}`,
                color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
      </AdminCard>

      <SurveyAccessManager isOpen={isAccessManagerOpen} onClose={() => setIsAccessManagerOpen(false)} />
    </PageWrap>
  )
}
