import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/firebaseClient'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import {
  Search, RefreshCw, Filter, Utensils, User as UserIcon, Calendar, Clock,
  Check, X, ChevronDown, ChevronUp, Bell, Settings, BarChart3, Download
} from 'lucide-react'
import {
  T, PageWrap, PageTitle, AdminCard, Badge, Btn, Spinner, Modal,
  SectionHeader, SurveyResponseDisplay, PackingTVView, fmtDate, ErrorBanner
} from './ui'
import { getSurveyTargetWeek, DAYS, MEALS, getDayKey, getMealKey } from '../common/utils'
import { getSlotDishes } from '../hooks/useSurvey'
import { fetchWeekRows, fetchAllUserRows } from '../lib/surveyRows'

const TABS = ['overview', 'tracking', 'automation']

export default function SurveyDashboard() {
  const navigate = useNavigate()
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

  // Automation state (read-only here — settings are managed on the Automation page)
  const [autoSettings, setAutoSettings] = useState({
    survey_status: 'auto',
    lunch_edit_status: 'auto',
    dinner_edit_status: 'auto',
    survey_open_hour: '20',
    lunch_edit_open: '20:00',
    lunch_edit_close: '11:00',
    dinner_edit_open: '12:00',
    dinner_edit_close: '15:30',
  })

  const loadAvailableWeeks = useCallback(async () => {
    const [normal, ovr] = await Promise.all([
      fetchAllUserRows(),
      supabase.from('survey_day_responses').select('week_id'),
    ])
    const allData = [...(normal.data || []), ...(ovr.data || [])]
    if (allData.length) {
      const weeks = [...new Set(allData.map(r => r.week_id))].sort().reverse()
      setAvailableWeeks(weeks)
    }
  }, [])

  const loadOverviewStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const currentWeekId = getSurveyTargetWeek(autoSettings)

      // Load merged rows for the week — day responses are the single store
      const { data: submissions } = await fetchWeekRows(currentWeekId)
      // Overlay override day-statuses so override-only users are counted too
      const { data: overrideRows } = await supabase
        .from('survey_day_responses')
        .select('user_id, day, l_status, d_status')
        .eq('week_id', currentWeekId)
      const effectiveMap = {}
      ;(submissions || []).forEach(sub => { effectiveMap[sub.user_id] = sub })
      ;(overrideRows || []).forEach(o => {
        const dk = String(o.day || '').substring(0, 3).toLowerCase()
        const existing = effectiveMap[o.user_id] || { user_id: o.user_id }
        if (o.l_status) existing[`${dk}_l_status`] = o.l_status
        if (o.d_status) existing[`${dk}_d_status`] = o.d_status
        effectiveMap[o.user_id] = existing
      })
      const effectiveSubs = Object.values(effectiveMap)

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
          effectiveSubs.forEach(sub => {
            const status = sub[`${dk}_${mk}_status`]
            if (status === 'Applied') applied++
            else if (status === 'Skipped') skipped++
          })
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
      const currentWeekId = getSurveyTargetWeek(autoSettings)
      const weekId = trackWeekFilter !== 'all' ? trackWeekFilter : currentWeekId
      const dk = getDayKey(trackDay)
      const mk = getMealKey(trackMeal)
      const statusCol = `${dk}_${mk}_status`
      const menu = weeklyMenu[trackDay]?.[trackMeal] || []

      const { data: allUsers } = await supabase.from('user_stats').select('*')
      // Load merged rows for the week — day responses are the single store
      const { data: submissions } = await fetchWeekRows(weekId)
      // Overlay override day-statuses so override-only users appear in the grid
      const { data: overrideRows } = await supabase
        .from('survey_day_responses')
        .select('user_id, day, l_status, d_status')
        .eq('week_id', weekId)
      const effectiveMap = {}
      ;(submissions || []).forEach(sub => { effectiveMap[sub.user_id] = sub })
      ;(overrideRows || []).forEach(o => {
        const dk = String(o.day || '').substring(0, 3).toLowerCase()
        const existing = effectiveMap[o.user_id] || { user_id: o.user_id }
        if (o.l_status) existing[`${dk}_l_status`] = o.l_status
        if (o.d_status) existing[`${dk}_d_status`] = o.d_status
        effectiveMap[o.user_id] = existing
      })
      const effectiveSubs = Object.values(effectiveMap)

      const subMap = {}
      const subTimeMap = {}
      const dishMap = {}
      effectiveSubs.forEach(sub => {
        subMap[sub.user_id] = sub[statusCol]
        subTimeMap[sub.user_id] = sub.updated_at
        if (sub[statusCol] === 'Applied') {
          dishMap[sub.user_id] = {}
          getSlotDishes(sub, trackDay, trackMeal, menu).forEach((dish, idx) => {
            const val = sub[`${dk}_${mk}_dish_${idx + 1}`]
            if (val !== undefined && val !== null) dishMap[sub.user_id][dish] = val
          })
        }
      })

      const list = (allUsers || [])
        .filter(u => u.role === 'member')
        .map(u => ({
          ...u,
          status: subMap[u.user_id] || 'Not Submitted',
          dishResponses: dishMap[u.user_id] || {},
          updated_at: subTimeMap[u.user_id] || null,
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

  // Auto-refresh on realtime changes — watch both tables for override saves
  useEffect(() => {
    const channel = supabase
      .channel('survey-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_day_responses' }, () => {
        if (activeTab === 'overview') loadOverviewStats()
        if (activeTab === 'tracking') loadTrackData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_day_responses' }, () => {
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

  const sendReminderNow = async () => {
    try {
      const currentWeekId = getSurveyTargetWeek(autoSettings)
      const dk = getDayKey(trackDay)
      const mk = getMealKey(trackMeal)
      const statusCol = `${dk}_${mk}_status`

      const pendingUsers = trackUsers.filter(u => u.status === 'Not Submitted')
      let sent = 0
      for (const u of pendingUsers) {
        await supabase.from('notifications').insert({
          user_id: u.user_id, title: '📋 Survey Reminder',
          message: `Please submit your ${trackDay} ${trackMeal} survey.`, url: '/survey', type: 'survey_reminder'
        })
        sent++
      }
      alert(`Sent reminders to ${sent} user(s)`)
    } catch (err) {
      alert('Error sending reminders: ' + err.message)
    }
  }

  const exportCSV = () => {
    const quote = s => `"${String(s ?? '').replace(/"/g, '""')}"`
    const currentWeekId = trackWeekFilter !== 'all' ? trackWeekFilter : getSurveyTargetWeek(autoSettings)
    const menuDishes = weeklyMenu[trackDay]?.[trackMeal] || []

    const headers = ['"Member Name"', '"Thali #"', '"Week"', '"Day"', '"Meal"', '"Status"', ...menuDishes.map(d => quote(d)), '"Last Updated"']

    let appliedCount = 0
    let skippedCount = 0
    let pendingCount = 0
    const dishTotals = {}
    menuDishes.forEach(d => { dishTotals[d] = 0 })

    const dataRows = trackUsers.map(u => {
      if (u.status === 'Applied') appliedCount++
      else if (u.status === 'Skipped') skippedCount++
      else pendingCount++

      const dishVals = menuDishes.map(dish => {
        if (u.status !== 'Applied') return u.status === 'Skipped' ? 'SKIPPED' : 'PENDING'
        const val = u.dishResponses[dish]
        if (val === undefined || val === null) return 'N/A'
        const isRoti = dish.toLowerCase().includes('roti') || dish.toLowerCase().includes('naan')
        if (isRoti) {
          const yes = String(val).toLowerCase() === 'yes'
          if (yes) dishTotals[dish] = (dishTotals[dish] || 0) + 1
          return yes ? 'YES' : 'NO'
        }
        const isCount = (typeof val === 'string' && !val.endsWith('%') && String(val).toLowerCase() !== 'yes' && String(val).toLowerCase() !== 'no') || typeof val === 'number'
        const numVal = parseInt(val) || 0
        dishTotals[dish] = (dishTotals[dish] || 0) + numVal
        return isCount ? `${numVal} person${numVal === 1 ? '' : 's'}` : `${numVal}%`
      })

      return [
        quote(u.name || 'Unknown'),
        quote(u.thali_number || '—'),
        quote(currentWeekId),
        quote(trackDay.charAt(0).toUpperCase() + trackDay.slice(1)),
        quote(trackMeal.charAt(0).toUpperCase() + trackMeal.slice(1)),
        quote(u.status),
        ...dishVals.map(quote),
        quote(u.updated_at ? new Date(u.updated_at).toLocaleString('en-GB') : '—')
      ].join(',')
    })

    const summaryRow = [
      quote('TOTALS / SUMMARY'),
      quote(`Applied: ${appliedCount} | Skipped: ${skippedCount} | Pending: ${pendingCount}`),
      quote(currentWeekId), quote(trackDay), quote(trackMeal), '',
      ...menuDishes.map(d => quote(`Total: ${dishTotals[d] || 0}`)),
      ''
    ].join(',')

    const csv = '\uFEFF' + [headers.join(','), ...dataRows, '', summaryRow].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `al_mawaid_tracking_${trackDay}_${trackMeal}_${currentWeekId}.csv`
    a.click()
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
                {u.updated_at && (
                  <div style={{ fontSize: 9, color: T.textSub, fontWeight: 500, marginTop: 2, opacity: 0.7 }}>
                    📅 {new Date(u.updated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
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
                {selectedUser.updated_at && (
                  <div style={{ fontSize: 10, color: T.textSub, fontWeight: 600, marginTop: 6 }}>
                    Last edited: {new Date(selectedUser.updated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
              {Object.keys(selectedUser.dishResponses).length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textSub, marginBottom: 8, textTransform: 'uppercase' }}>Dish Responses</div>
                  {Object.entries(selectedUser.dishResponses).map(([dish, val]) => (
                    <div key={dish} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                      <span>{dish}</span>
                      <span style={{ fontWeight: 700, color: T.accent }}>
                        {val === 'Yes' || val === 'yes' ? '✅ Yes' : val === 'No' || val === 'no' ? '❌ No' : val == null ? '—' : (typeof val === 'string' && val.endsWith('%') ? `${parseInt(val) || 0}%` : `${parseInt(val) || 0} person${(parseInt(val) || 0) === 1 ? '' : 's'}`)}
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
    return (
      <div style={{ maxWidth: 600 }}>
        <AdminCard>
          <SectionHeader>Automation</SectionHeader>
          <p style={{ fontSize: 13, color: T.textSub, lineHeight: 1.6, marginBottom: 18 }}>
            All access controls and timing settings (survey window, lunch &amp; dinner edit
            windows, user overrides) are now managed from the <strong style={{ color: T.text }}>Automation</strong> page.
          </p>
          <Btn onClick={() => navigate('/admin/automation')} style={{ width: '100%', padding: 14, fontSize: 15 }}>
            <Settings size={16} /> Open Automation Settings
          </Btn>
        </AdminCard>
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
