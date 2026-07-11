import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, db, C, getCol, getDocRef } from '../lib/firebaseClient'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import {
  Search, RefreshCw, Filter, Utensils, User as UserIcon, Calendar, Clock,
  Check, X, ChevronDown, ChevronUp, Bell, Settings, BarChart3, Download
} from 'lucide-react'
import {
  T, PageWrap, PageTitle, AdminCard, Badge, Btn, Spinner, Grid, Modal,
  SectionHeader, SurveyResponseDisplay, PackingTVView, fmtDate, ErrorBanner
} from './ui'
import { getWeekDate, DAYS, MEALS, getDayKey, getMealKey } from '../common/utils'

const TABS = ['overview', 'tracking', 'automation']

export default function SurveyDashboard() {
  const weeklyMenu = useWeeklyMenu() || {}
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)

  // Overview state
  const [overviewStats, setOverviewStats] = useState({})
  const [users, setUsers] = useState({})

  // Tracking state
  const [trackDay, setTrackDay] = useState(() => {
    const d = new Date().getDay()
    if (d === 0) return 'monday'
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d]
  })
  const [trackMeal, setTrackMeal] = useState(() => (new Date().getHours() + new Date().getMinutes() / 60) < 15.5 ? 'lunch' : 'dinner')
  const [trackUsers, setTrackUsers] = useState([])
  const [trackSearch, setTrackSearch] = useState('')
  const [trackWeekFilter, setTrackWeekFilter] = useState('all')
  const [availableWeeks, setAvailableWeeks] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)

  // Automation state
  const [autoSettings, setAutoSettings] = useState({
    survey_status: 'auto',
    lunch_edit_status: 'auto',
    dinner_edit_status: 'auto',
    survey_open_hour: '20',
    lunch_edit_open: '20:00',
    lunch_edit_close: '11:00',
    dinner_edit_open: '12:00',
    dinner_edit_close: '15:30',
    reminders_enabled: true,
    digest_enabled: true,
  })
  const [autoSaving, setAutoSaving] = useState(false)
  const [autoSaved, setAutoSaved] = useState(false)

  const loadAvailableWeeks = useCallback(async () => {
    const { data } = await supabase.from('survey_submissions_flat').select('week_id', { count: true, distinct: true })
    if (data) {
      const weeks = [...new Set(data.map(r => r.week_id))].sort().reverse()
      setAvailableWeeks(weeks)
    }
  }, [])

  const loadOverviewStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const currentWeekId = getWeekDate()
      const allDays = DAYS.map(d => getDayKey(d))
      const mealKeys = ['l', 'd']
      const cols = allDays.flatMap(dk => mealKeys.map(mk => `${dk}_${mk}_status`))
      cols.push('user_id', 'week_id')

      const { data: submissions } = await supabase.from('survey_submissions_flat')
        .select(cols.join(',')).eq('week_id', currentWeekId)
      const { data: allUsers } = await supabase.from('user_stats').select('*')

      if (allUsers) {
        const userMap = {}
        allUsers.forEach(u => { userMap[u.user_id] = u })
        setUsers(userMap)
      }

      const stats = {}
      let totalUsers = allUsers?.length || 0

      DAYS.forEach(day => {
        const dk = getDayKey(day)
        MEALS.forEach(meal => {
          const mk = getMealKey(meal)
          const key = `${day}_${meal}`
          let applied = 0, skipped = 0, pending = 0
          if (submissions) {
            submissions.forEach(sub => {
              const status = sub[`${dk}_${mk}_status`]
              if (status === 'Applied') applied++
              else if (status === 'Skipped') skipped++
            })
          }
          pending = totalUsers - applied - skipped
          stats[key] = { applied, skipped, pending }
        })
      })

      const total = Object.values(stats).reduce((acc, s) => ({
        applied: acc.applied + s.applied,
        skipped: acc.skipped + s.skipped,
        pending: acc.pending + s.pending,
      }), { applied: 0, skipped: 0, pending: 0 })

      setOverviewStats({ stats, total, totalUsers })
    } catch (err) {
      console.error('Error loading overview:', err)
    }
    setStatsLoading(false)
  }, [])

  const loadTrackData = useCallback(async () => {
    setLoading(true)
    try {
      const currentWeekId = getWeekDate()
      const weekId = trackWeekFilter !== 'all' ? trackWeekFilter : currentWeekId
      const dk = getDayKey(trackDay)
      const mk = getMealKey(trackMeal)
      const statusCol = `${dk}_${mk}_status`

      const { data: allUsers } = await supabase.from('user_stats').select('*')
      const { data: submissions } = await supabase.from('survey_submissions_flat')
        .select(`user_id, ${statusCol}`)
        .eq('week_id', weekId)

      const subMap = {}
      if (submissions) {
        submissions.forEach(sub => { subMap[sub.user_id] = sub[statusCol] })
      }

      const dishCols = []
      const menu = weeklyMenu[trackDay]?.[trackMeal] || []
      menu.forEach((_, idx) => { dishCols.push(`${dk}_${mk}_dish_${idx + 1}`) })

      const detailedSubs = dishCols.length > 0
        ? await supabase.from('survey_submissions_flat')
          .select(`user_id, ${dishCols.join(',')}`)
          .eq('week_id', weekId)
        : null

      const dishMap = {}
      if (detailedSubs?.data) {
        detailedSubs.data.forEach(sub => {
          if (subMap[sub.user_id] === 'Applied') {
            dishMap[sub.user_id] = {}
            menu.forEach((dish, idx) => {
              const val = sub[`${dk}_${mk}_dish_${idx + 1}`]
              if (val !== undefined && val !== null) dishMap[sub.user_id][dish] = val
            })
          }
        })
      }

      const list = (allUsers || [])
        .filter(u => u.role === 'member')
        .map(u => ({
          ...u,
          status: subMap[u.user_id] || 'Not Submitted',
          dishResponses: dishMap[u.user_id] || {},
        }))
        .sort((a, b) => {
          const order = { Applied: 0, Skipped: 1, 'Not Submitted': 2 }
          return (order[a.status] || 3) - (order[b.status] || 3)
        })

      setTrackUsers(list)
    } catch (err) {
      console.error('Error loading tracking:', err)
    }
    setLoading(false)
  }, [trackDay, trackMeal, trackWeekFilter, weeklyMenu])

  const loadAutoSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('*')
    if (data) {
      const settings = {}
      data.forEach(row => { settings[row.key] = row.value })
      setAutoSettings(prev => ({ ...prev, ...settings }))
    }
  }, [])

  useEffect(() => {
    loadAvailableWeeks()
    loadAutoSettings()
    if (activeTab === 'overview') loadOverviewStats()
    if (activeTab === 'tracking') loadTrackData()
  }, [activeTab])

  // Auto-refresh on realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('survey-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_submissions_flat' }, () => {
        if (activeTab === 'overview') loadOverviewStats()
        if (activeTab === 'tracking') loadTrackData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeTab])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'overview') loadOverviewStats()
      if (activeTab === 'tracking') loadTrackData()
    }, 60000)
    return () => clearInterval(interval)
  }, [activeTab])

  const saveAutoSettings = async () => {
    setAutoSaving(true)
    try {
      const entries = Object.entries(autoSettings)
      for (const [key, value] of entries) {
        await supabase.from('app_settings').upsert(
          { key, value: String(value) },
          { onConflict: 'key' }
        )
      }
      setAutoSaved(true)
      setTimeout(() => setAutoSaved(false), 3000)
    } catch (err) {
      console.error('Error saving automation settings:', err)
    }
    setAutoSaving(false)
  }

  const sendReminderNow = async () => {
    try {
      const currentWeekId = getWeekDate()
      const dk = getDayKey(trackDay)
      const mk = getMealKey(trackMeal)
      const statusCol = `${dk}_${mk}_status`

      const pendingUsers = trackUsers.filter(u => u.status === 'Not Submitted')
      let sent = 0
      for (const u of pendingUsers) {
        await supabase.from('notifications').insert({
          user_id: u.user_id, title: '📋 Survey Reminder',
          message: `Please submit your ${trackDay} ${trackMeal} survey.`, url: '/', type: 'survey_reminder'
        })
        sent++
      }
      alert(`Sent reminders to ${sent} user(s)`)
    } catch (err) {
      alert('Error sending reminders: ' + err.message)
    }
  }

  const exportCSV = () => {
    const rows = [['User', 'Thali', 'Status', 'Dish', 'Response']]
    trackUsers.forEach(u => {
      const dishEntries = Object.entries(u.dishResponses)
      if (dishEntries.length === 0) {
        rows.push([u.name || 'Unknown', u.thali_number || '', u.status, '', ''])
      } else {
        dishEntries.forEach(([dish, resp]) => {
          rows.push([u.name || 'Unknown', u.thali_number || '', u.status, dish, resp])
        })
      }
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `survey-${trackDay}-${trackMeal}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const OverviewTab = () => {
    if (statsLoading) return <Spinner />
    const { stats, total, totalUsers } = overviewStats

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <AdminCard>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.accent }}>{total?.applied || 0}</div>
            <div style={{ fontSize: 11, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total Applied</div>
          </AdminCard>
          <AdminCard>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444' }}>{total?.skipped || 0}</div>
            <div style={{ fontSize: 11, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total Skipped</div>
          </AdminCard>
          <AdminCard>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{total?.pending || 0}</div>
            <div style={{ fontSize: 11, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total Pending</div>
          </AdminCard>
          <AdminCard>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.accent }}>{totalUsers || 0}</div>
            <div style={{ fontSize: 11, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total Members</div>
          </AdminCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {DAYS.map(day => (
            <AdminCard key={day}>
              <SectionHeader>{day.charAt(0).toUpperCase() + day.slice(1)}</SectionHeader>
              {MEALS.map(meal => {
                const key = `${day}_${meal}`
                const s = stats?.[key]
                if (!s) return null
                const total = s.applied + s.skipped + s.pending
                const pct = total > 0 ? Math.round((s.applied / totalUsers) * 100) : 0
                return (
                  <div key={meal} style={{ marginBottom: 8, padding: '8px 12px', borderRadius: 8, background: T.inputBg }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700 }}>{meal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}</span>
                      <span style={{ color: T.accent }}>{pct}%</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                      <span style={{ color: '#4CAF50' }}>✅ {s.applied}</span>
                      <span style={{ color: '#ef4444' }}>❌ {s.skipped}</span>
                      <span style={{ color: '#f59e0b' }}>⏳ {s.pending}</span>
                    </div>
                    <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: T.border, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: T.accentGrad, borderRadius: 2, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                )
              })}
            </AdminCard>
          ))}
        </div>
      </div>
    )
  }

  const TrackingTab = () => {
    const filtered = trackUsers.filter(u => {
      if (!trackSearch) return true
      const q = trackSearch.toLowerCase()
      return (u.name || '').toLowerCase().includes(q) || (u.thali_number || '').includes(q)
    })

    const applied = filtered.filter(u => u.status === 'Applied').length
    const skipped = filtered.filter(u => u.status === 'Skipped').length
    const pending = filtered.filter(u => u.status === 'Not Submitted').length

    return (
      <div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <select value={trackDay} onChange={e => setTrackDay(e.target.value)} style={selectStyle}>
            {DAYS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
          </select>
          <select value={trackMeal} onChange={e => setTrackMeal(e.target.value)} style={selectStyle}>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
          </select>
          <select value={trackWeekFilter} onChange={e => setTrackWeekFilter(e.target.value)} style={selectStyle}>
            <option value="all">Current Week</option>
            {availableWeeks.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span style={{ color: '#4CAF50' }}>✅ {applied}</span>
              <span style={{ color: '#ef4444' }}>❌ {skipped}</span>
              <span style={{ color: '#f59e0b' }}>⏳ {pending}</span>
            </div>
            <Btn onClick={loadTrackData} size="sm"><RefreshCw size={14} /></Btn>
            <Btn onClick={exportCSV} size="sm"><Download size={14} /> CSV</Btn>
            <Btn onClick={sendReminderNow} size="sm"><Bell size={14} /> Remind</Btn>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textSub }} />
            <input placeholder="Search name or thali..." value={trackSearch}
              onChange={e => setTrackSearch(e.target.value)}
              style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(u => (
            <div key={u.user_id} onClick={() => setSelectedUser(u)}
              style={{
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                background: u.status === 'Applied' ? 'rgba(76,175,80,0.06)' : u.status === 'Skipped' ? 'rgba(244,67,54,0.06)' : 'rgba(245,158,11,0.06)',
                border: `1px solid ${u.status === 'Applied' ? 'rgba(76,175,80,0.2)' : u.status === 'Skipped' ? 'rgba(244,67,54,0.2)' : 'rgba(245,158,11,0.2)'}`,
                transition: 'all 0.2s'
              }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: T.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                {(u.name || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{u.name || 'Unknown'}</div>
                <div style={{ fontSize: 11, color: T.textSub }}>Thali #{u.thali_number || '—'}</div>
              </div>
              <Badge color={u.status === 'Applied' ? '#4CAF50' : u.status === 'Skipped' ? '#ef4444' : '#f59e0b'}>
                {u.status === 'Applied' ? '✅ Applied' : u.status === 'Skipped' ? '❌ Skipped' : '⏳ Pending'}
              </Badge>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: T.textSub, fontSize: 14 }}>No users found</div>}
        </div>

        {selectedUser && (
          <Modal onClose={() => setSelectedUser(null)}>
            <div style={{ padding: 24, maxWidth: 500 }}>
              <SectionHeader>{selectedUser.name || 'Unknown'}</SectionHeader>
              <div style={{ fontSize: 12, color: T.textSub, marginBottom: 16 }}>Thali #{selectedUser.thali_number || '—'}</div>
              <div style={{ padding: 12, borderRadius: 8, background: T.inputBg, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Status: <Badge color={selectedUser.status === 'Applied' ? '#4CAF50' : '#ef4444'}>{selectedUser.status}</Badge></div>
              </div>
              {Object.keys(selectedUser.dishResponses).length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textSub, marginBottom: 8, textTransform: 'uppercase' }}>Dish Responses</div>
                  {Object.entries(selectedUser.dishResponses).map(([dish, val]) => (
                    <div key={dish} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                      <span>{dish}</span>
                      <span style={{ fontWeight: 700, color: T.accent }}>
                        {val === 'Yes' ? '✅' : val === 'No' ? '❌' : typeof val === 'string' && val.endsWith('%') ? val : val}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Modal>
        )}
      </div>
    )
  }

  const AutomationTab = () => {
    const update = (key, val) => setAutoSettings(prev => ({ ...prev, [key]: val }))

    return (
      <div style={{ maxWidth: 600 }}>
        <AdminCard style={{ marginBottom: 20 }}>
          <SectionHeader>Survey Window</SectionHeader>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Status</label>
            <select value={autoSettings.survey_status} onChange={e => update('survey_status', e.target.value)} style={selectStyle}>
              <option value="auto">Auto (Sat 8PM – Mon 11AM)</option>
              <option value="open">Open (Override)</option>
              <option value="closed">Closed (Override)</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Survey Open Hour</label>
            <select value={autoSettings.survey_open_hour} onChange={e => update('survey_open_hour', e.target.value)} style={selectStyle}>
              {[18, 19, 20, 21, 22].map(h => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
        </AdminCard>

        <AdminCard style={{ marginBottom: 20 }}>
          <SectionHeader>Daily Edit Windows</SectionHeader>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Lunch Edit</label>
            <select value={autoSettings.lunch_edit_status} onChange={e => update('lunch_edit_status', e.target.value)} style={selectStyle}>
              <option value="auto">Auto</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <Grid cols={2}>
            <div>
              <label style={labelStyle}>Opens at</label>
              <input type="time" value={autoSettings.lunch_edit_open} onChange={e => update('lunch_edit_open', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Closes at</label>
              <input type="time" value={autoSettings.lunch_edit_close} onChange={e => update('lunch_edit_close', e.target.value)} style={inputStyle} />
            </div>
          </Grid>
          <div style={{ margin: '12px 0' }}>
            <label style={labelStyle}>Dinner Edit</label>
            <select value={autoSettings.dinner_edit_status} onChange={e => update('dinner_edit_status', e.target.value)} style={selectStyle}>
              <option value="auto">Auto</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <Grid cols={2}>
            <div>
              <label style={labelStyle}>Opens at</label>
              <input type="time" value={autoSettings.dinner_edit_open} onChange={e => update('dinner_edit_open', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Closes at</label>
              <input type="time" value={autoSettings.dinner_edit_close} onChange={e => update('dinner_edit_close', e.target.value)} style={inputStyle} />
            </div>
          </Grid>
        </AdminCard>

        <AdminCard style={{ marginBottom: 20 }}>
          <SectionHeader>Automated Notifications</SectionHeader>
          <div style={{ marginBottom: 12 }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={autoSettings.reminders_enabled === true || autoSettings.reminders_enabled === 'true'}
                onChange={e => update('reminders_enabled', e.target.checked)} style={{ width: 18, height: 18 }} />
              Send reminders for pending surveys (every 30 min)
            </label>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={autoSettings.digest_enabled === true || autoSettings.digest_enabled === 'true'}
                onChange={e => update('digest_enabled', e.target.checked)} style={{ width: 18, height: 18 }} />
              Send daily digest to admins (6PM)
            </label>
          </div>
        </AdminCard>

        <Btn onClick={saveAutoSettings} disabled={autoSaving} style={{ width: '100%', padding: 14, fontSize: 15 }}>
          {autoSaving ? 'Saving...' : autoSaved ? '✓ Settings Saved' : 'Save Automation Settings'}
        </Btn>
      </div>
    )
  }

  return (
    <PageWrap>
      <PageTitle>Survey Dashboard</PageTitle>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: activeTab === tab ? T.accentGrad : T.card,
              color: activeTab === tab ? '#000' : T.text, cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
              display: 'flex', alignItems: 'center', gap: 8
            }}>
            {tab === 'overview' && <BarChart3 size={16} />}
            {tab === 'tracking' && <UserIcon size={16} />}
            {tab === 'automation' && <Settings size={16} />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'tracking' && <TrackingTab />}
      {activeTab === 'automation' && <AutomationTab />}
    </PageWrap>
  )
}

const selectStyle = {
  padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.border}`,
  background: T.inputBg, color: T.text, fontSize: 13, outline: 'none',
  fontFamily: "'DM Sans',sans-serif", cursor: 'pointer'
}

const inputStyle = {
  padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.border}`,
  background: T.inputBg, color: T.text, fontSize: 13, outline: 'none',
  width: '100%', boxSizing: 'border-box', fontFamily: "'DM Sans',sans-serif"
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700, color: T.textSub,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
  fontFamily: "'DM Sans',sans-serif"
}
