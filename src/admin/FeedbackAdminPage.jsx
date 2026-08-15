// src/admin/FeedbackAdminPage.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/firebaseClient'
import { RefreshCw, Search, Star, Download } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Table, Badge, Btn, StatCard, fmtDateTime } from './ui'
import { AdminTableSkeleton } from '../common/Skeleton'
import { getCalendarWeekDate } from '../common/utils'
import { downloadWeeklyFeedbackPdf, getFeedbackWeekId } from './feedbackReportPdf'
import toast from 'react-hot-toast'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday']

const Stars = ({ n }) => (
  <div style={{ display: 'flex', gap: 2, whiteSpace: 'nowrap', flexShrink: 0 }}>
    {[1,2,3,4,5].map(i => (
      <Star key={i} size={11} fill={i <= n ? '#c49c5a' : 'none'} color={i <= n ? '#c49c5a' : T.border} />
    ))}
    <span style={{ marginLeft: 2, fontSize: 11, color: T.textSub, fontWeight: 600, minWidth: 16 }}>{n}</span>
  </div>
)

export default function FeedbackAdminPage() {
  const [loading, setLoading] = useState(true)
  const [feedbacks, setFeedbacks] = useState([])
  const [allFeedbacks, setAllFeedbacks] = useState([])
  const [users, setUsers]   = useState({})
  const [dayFilter, setDayFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [weekFilter, setWeekFilter] = useState('latest')
  const [menu, setMenu] = useState({})
  const [totals, setTotals] = useState({ count: 0, recentCount: 0, avgLunch: 0, avgDinner: 0 })

  // ── Initial load on mount ──
  useEffect(() => { load() }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: fb }, { data: us }, { data: mn }] = await Promise.all([
      supabase.from('daily_feedback').select('*').order('created_at', { ascending: false }),
      supabase.from('user_stats').select('user_id,name,email,thali_number'),
      supabase.from('weekly_menu').select('*').eq('week_start', getCalendarWeekDate())
    ])
    const uMap = {}
    ;(us || []).forEach(u => { uMap[u.user_id] = u })
    setUsers(uMap)
    
    if (mn && mn.length > 0) {
      const menuMap = {}
      mn.forEach(row => { menuMap[row.day_name] = { lunch: row.lunch, dinner: row.dinner } })
      setMenu(menuMap)
    }

    const data = fb || []
    setAllFeedbacks(data)
    setFeedbacks(data)
    buildStats(data)
    setLoading(false)
  }, [])

  // ── REALTIME SUBSCRIPTION (replaces 60s polling) ──
  useEffect(() => {
    const channel = supabase
      .channel('feedback-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_feedback' }, () => {
        load()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  const buildStats = (data) => {
    const avg = arr => arr.length ? +(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2) : 0
    const allLunch  = data.filter(r => r.lunch_stars).map(r => r.lunch_stars)
    const allDinner = data.filter(r => r.dinner_stars).map(r => r.dinner_stars)
    setTotals({
      count: data.length,
      avgLunch:  avg(allLunch),
      avgDinner: avg(allDinner),
    })
  }

  const now = new Date()
  const recentCount = allFeedbacks.filter(r => (now - new Date(r.created_at)) / (1000 * 60 * 60) < 24).length

  // ── Weekly PDF report ──
  const weeks = [...new Set(allFeedbacks.map(r => getFeedbackWeekId(r.created_at)).filter(Boolean))].sort().reverse()
  const selectedWeek = weekFilter === 'latest' ? (weeks[0] || null) : weekFilter
  const weekCount = selectedWeek ? allFeedbacks.filter(r => getFeedbackWeekId(r.created_at) === selectedWeek).length : 0

  const handleDownloadPdf = () => {
    if (!selectedWeek) return
    downloadWeeklyFeedbackPdf({ weekId: selectedWeek, feedbacks: allFeedbacks, users })
    toast.success(`Weekly feedback PDF downloaded (${weekCount} response${weekCount === 1 ? '' : 's'})`)
  }

  const filtered = feedbacks.filter(r => {
    const u = users[r.user_id] || {}
    const q = search.toLowerCase()
    const matchSearch = !q || (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q) || String(u.thali_number||'').includes(q)
    const matchDay = dayFilter === 'all' || r.day === dayFilter
    // Auto-hide feedback older than 1 day, unless showAll is toggled
    const within24h = (now - new Date(r.created_at)) / (1000 * 60 * 60) < 24
    const matchTime = showAll || within24h
    return matchSearch && matchDay && matchTime
  })

  const rows = filtered.map(r => {
    const u = users[r.user_id] || {}
    const dayMenu = menu[r.day] || {}
    const lunchDishes = dayMenu.lunch || ''
    const dinnerDishes = dayMenu.dinner || ''

    return [
      <div>
        <div style={{ fontWeight: 600, color: T.text, fontSize: 13 }}>{u.name || '—'}</div>
        <div style={{ color: T.textSub, fontSize: 11 }}>#{u.thali_number || '—'}</div>
      </div>,
      <Badge color="#c49c5a">{r.day}</Badge>,
      <div style={{ whiteSpace: 'nowrap' }}>
        <Stars n={r.lunch_stars}  />
        <div style={{ fontSize: 9, color: T.textSub, marginTop: 2, fontStyle: 'italic', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{lunchDishes || '—'}</div>
      </div>,
      <div style={{ whiteSpace: 'nowrap' }}>
        <Stars n={r.dinner_stars} />
        <div style={{ fontSize: 9, color: T.textSub, marginTop: 2, fontStyle: 'italic', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{dinnerDishes || '—'}</div>
      </div>,
      <div style={{ maxWidth: 180, overflow: 'hidden' }}>
        <div style={{ fontSize: 11, color: T.accent, fontWeight: 700 }}>Lunch</div>
        <span style={{ color: T.textSub, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.lunch_comment || '—'}</span>
        <div style={{ fontSize: 11, color: '#5e9ce0', fontWeight: 700, marginTop: 4 }}>Dinner</div>
        <span style={{ color: T.textSub, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.dinner_comment || '—'}</span>
      </div>,
      fmtDateTime(r.created_at),
    ]
  })

  return (
    <PageWrap>
      <PageTitle>Meal Feedback</PageTitle>

      {/* Stats */}
      <div className="feedback-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard icon="📋" label="Total" value={totals.count} />
        <StatCard icon="🕐" label="Last 24h" value={recentCount} color="#e09855" />
        <StatCard icon="🍛" label="Avg Lunch"  value={`${totals.avgLunch}★`}  color="#c49c5a" />
        <StatCard icon="🌙" label="Avg Dinner" value={`${totals.avgDinner}★`} color="#5e9ce0" />
      </div>

      {/* Weekly PDF Report */}
      <AdminCard style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>📄 Weekly Report</div>
          <div style={{ fontSize: 12, color: T.textSub, marginTop: 4 }}>
            {selectedWeek
              ? `${weekCount} response${weekCount === 1 ? '' : 's'} for the week of ${new Date(selectedWeek + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : 'No feedback recorded yet'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={weekFilter} onChange={e => setWeekFilter(e.target.value)}
            style={{ padding: '11px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
            {weeks.length > 0 && <option value="latest">Latest Week</option>}
            {weeks.length === 0 && <option value="latest">No weeks</option>}
            {weeks.map(w => (
              <option key={w} value={w}>
                Week of {new Date(w + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </option>
            ))}
          </select>
          <Btn onClick={handleDownloadPdf} disabled={!selectedWeek}>
            <Download size={15} /> Download PDF
          </Btn>
        </div>
      </AdminCard>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={14} color={T.textSub} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input name="searchFeedback" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search thali user…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 36px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <select name="feedbackDayFilter" value={dayFilter} onChange={e => setDayFilter(e.target.value)}
          style={{ padding: '11px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
          <option value="all">All Days</option>
          {DAYS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
        </select>
        <Btn variant={showAll ? 'solid' : 'outline'} size="sm" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Showing All' : 'Recent Only'}
        </Btn>
        <Btn variant="outline" onClick={load}><RefreshCw size={15} />Refresh</Btn>
      </div>

      {loading ? <AdminTableSkeleton rows={5} /> : (
        <AdminCard style={{ padding: 0 }}>
          <Table
            headers={['Thali User', 'Day', 'Lunch (Menu)', 'Dinner (Menu)', 'Comments', 'Submitted']}
            rows={rows}
            emptyMsg="No feedback found."
          />
        </AdminCard>
      )}
    </PageWrap>
  )
}
