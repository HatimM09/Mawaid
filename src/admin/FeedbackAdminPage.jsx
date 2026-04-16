// src/admin/FeedbackAdminPage.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { RefreshCw, Search, Star } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Table, Badge, Btn, Spinner, StatCard, fmtDateTime } from './ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday']
const TooltipStyle = {
  contentStyle: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 13 },
  cursor: { fill: 'rgba(196,156,90,0.06)' },
}

const Stars = ({ n }) => (
  <div style={{ display: 'flex', gap: 2 }}>
    {[1,2,3,4,5].map(i => (
      <Star key={i} size={13} fill={i <= n ? '#c49c5a' : 'none'} color={i <= n ? '#c49c5a' : T.border} />
    ))}
    <span style={{ marginLeft: 4, fontSize: 12, color: T.textSub }}>{n}</span>
  </div>
)

export default function FeedbackAdminPage() {
  const [loading, setLoading] = useState(true)
  const [feedbacks, setFeedbacks] = useState([])
  const [users, setUsers]   = useState({})
  const [dayFilter, setDayFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [avgData, setAvgData] = useState([])
  const [totals, setTotals] = useState({ count: 0, avgLunch: 0, avgDinner: 0 })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: fb }, { data: us }] = await Promise.all([
      supabase.from('daily_feedback').select('*').order('created_at', { ascending: false }),
      supabase.from('user_stats').select('user_id,name,email,thali_number'),
    ])
    const uMap = {}
    ;(us || []).forEach(u => { uMap[u.user_id] = u })
    setUsers(uMap)
    const data = fb || []
    setFeedbacks(data)
    buildStats(data)
    setLoading(false)
  }

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

  const filtered = feedbacks.filter(r => {
    const u = users[r.user_id] || {}
    const q = search.toLowerCase()
    const matchSearch = !q || (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q) || String(u.thali_number||'').includes(q)
    const matchDay = dayFilter === 'all' || r.day === dayFilter
    return matchSearch && matchDay
  })

  const rows = filtered.map(r => {
    const u = users[r.user_id] || {}
    return [
      <div>
        <div style={{ fontWeight: 600, color: T.text, fontSize: 13 }}>{u.name || '—'}</div>
        <div style={{ color: T.textSub, fontSize: 11 }}>#{u.thali_number || '—'}</div>
      </div>,
      <Badge color="#c49c5a">{r.day}</Badge>,
      r.lunch_stars  ? <Stars n={r.lunch_stars}  /> : <span style={{ color: T.textSub, fontSize: 12 }}>—</span>,
      r.dinner_stars ? <Stars n={r.dinner_stars} /> : <span style={{ color: T.textSub, fontSize: 12 }}>—</span>,
      r.comment ? <span style={{ color: T.textSub, fontSize: 12, maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.comment}</span> : '—',
      fmtDateTime(r.created_at),
    ]
  })

  return (
    <PageWrap>
      <PageTitle sub={`${feedbacks.length} feedback entries`}>Meal Feedback</PageTitle>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard icon="📋" label="Total Feedbacks" value={totals.count} />
        <StatCard icon="🍛" label="Avg Lunch Rating"  value={`${totals.avgLunch}★`}  color="#c49c5a" />
        <StatCard icon="🌙" label="Avg Dinner Rating" value={`${totals.avgDinner}★`} color="#5e9ce0" />
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 36px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <select value={dayFilter} onChange={e => setDayFilter(e.target.value)}
          style={{ padding: '11px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
          <option value="all">All Days</option>
          {DAYS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
        </select>
        <Btn variant="outline" onClick={load}><RefreshCw size={15} />Refresh</Btn>
      </div>

      {loading ? <Spinner /> : (
        <AdminCard style={{ padding: 0 }}>
          <Table
            headers={['Member', 'Day', 'Lunch', 'Dinner', 'Comment', 'Submitted']}
            rows={rows}
            emptyMsg="No feedback found."
          />
        </AdminCard>
      )}
    </PageWrap>
  )
}
