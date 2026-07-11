// src/admin/FeedbackAdminPage.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { supabase, db, C, getCol, getDocRef } from '../lib/firebaseClient'
import { RefreshCw, Search, Star } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Table, Badge, Btn, StatCard, fmtDateTime } from './ui'
import { AdminTableSkeleton } from '../common/Skeleton'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { getWeekDate } from '../common/utils'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday']
const TooltipStyle = {
  contentStyle: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 13 },
  cursor: { fill: 'rgba(196,156,90,0.06)' },
}

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
  const [avgData, setAvgData] = useState([])
  const [menu, setMenu] = useState({})
  const [totals, setTotals] = useState({ count: 0, recentCount: 0, avgLunch: 0, avgDinner: 0 })

  // ── Initial load on mount ──
  useEffect(() => { load() }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: fb }, { data: us }, { data: mn }] = await Promise.all([
      supabase.from('daily_feedback').select('*').order('created_at', { ascending: false }),
      supabase.from('user_stats').select('user_id,name,email,thali_number'),
      supabase.from('weekly_menu').select('*').eq('week_start', getWeekDate())
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
    // Avg per day
    const map = {}
    data.forEach(r => {
      if (!map[r.day]) map[r.day] = { lunch: [], dinner: [] }
      if (r.lunch_stars)  map[r.day].lunch.push(r.lunch_stars)
      if (r.dinner_stars) map[r.day].dinner.push(r.dinner_stars)
    })
    const avg = arr => arr.length ? +(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2) : 0
    setAvgData(DAYS.map(d => {
      const e = map[d] || { lunch: [], dinner: [] }
      return { day: d.slice(0,2).toUpperCase(), lunch: avg(e.lunch), dinner: avg(e.dinner) }
    }))
    // Overall
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

      {/* Chart */}
      <AdminCard style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 18 }}>Avg Rating by Day</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={avgData} margin={{ left: -20 }}>
            <CartesianGrid stroke={T.border} vertical={false} />
            <XAxis dataKey="day" tick={{ fill: T.textSub, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0,5]} tick={{ fill: T.textSub, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip {...TooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12, color: T.textSub }} />
            <Bar dataKey="lunch"  fill="#c49c5a" radius={[5,5,0,0]} name="Lunch"  />
            <Bar dataKey="dinner" fill="#5e9ce0" radius={[5,5,0,0]} name="Dinner" />
          </BarChart>
        </ResponsiveContainer>
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
