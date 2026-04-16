// src/admin/SurveysPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { RefreshCw, Search, Filter, Utensils, Download } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Table, Badge, Btn, Spinner, Grid, fmtDate, fmtDateTime } from './ui'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday']
const MEALS = ['lunch','dinner']

const TooltipStyle = {
  contentStyle: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 13 },
  cursor: { fill: 'rgba(196,156,90,0.06)' },
}

export default function SurveysPage() {
  const [loading, setLoading]     = useState(true)
  const [responses, setResponses] = useState([])
  const [users, setUsers]         = useState({})
  const [dayFilter, setDayFilter] = useState('all')
  const [mealFilter, setMealFilter] = useState('all')
  const [search, setSearch]       = useState('')
  const [chartData, setChartData] = useState([])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const [{ data: resp }, { data: us }] = await Promise.all([
      supabase.from('survey_responses').select('*').order('created_at', { ascending: false }),
      supabase.from('user_stats').select('user_id,name,email,thali_number'),
    ])
    const uMap = {}
    ;(us || []).forEach(u => { uMap[u.user_id] = u })
    setUsers(uMap)
    setResponses(resp || [])
    buildChart(resp || [])
    setLoading(false)
  }, [])

  useEffect(() => { 
    load()
    const interval = setInterval(() => load(true), 60000)
    return () => clearInterval(interval)
  }, [load])

  const buildChart = (data) => {
    const map = {}
    data.forEach(r => {
      const key = r.day
      if (!map[key]) map[key] = { day: key, lunch: 0, dinner: 0 }
      map[key][r.meal] = (map[key][r.meal] || 0) + 1
    })
    setChartData(DAYS.map(d => map[d] || { day: d, lunch: 0, dinner: 0 }).map(r => ({
      ...r, day: r.day.charAt(0).toUpperCase() + r.day.slice(1, 3)
    })))
  }

  const filtered = responses.filter(r => {
    const u = users[r.user_id] || {}
    const q = search.toLowerCase()
    const matchSearch = !q || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || String(u.thali_number || '').includes(q)
    const matchDay  = dayFilter  === 'all' || r.day  === dayFilter
    const matchMeal = mealFilter === 'all' || r.meal === mealFilter
    return matchSearch && matchDay && matchMeal
  })

  // AUTOMATIC QUANTITY AGGREGATION
  const summary = useMemo(() => {
    const counts = {}
    const activeData = filtered.filter(f => f.wants_food)
    
    activeData.forEach(r => {
      const q = r.dish_responses || {}
      Object.entries(q).forEach(([dish, pct]) => {
        if (!counts[dish]) counts[dish] = 0
        counts[dish] += (parseInt(pct) || 0)
      })
    })

    return Object.entries(counts).map(([name, totalPct]) => ({
      name,
      portions: (totalPct / 100).toFixed(1),
      raw: totalPct
    }))
  }, [filtered])

  const rows = filtered.map(r => {
    const u = users[r.user_id] || {}
    const qtys = r.dish_responses || {}
    return [
      <div>
        <div style={{ fontWeight: 600, color: T.text, fontSize: 13 }}>{u.name || '—'}</div>
        <div style={{ color: T.textSub, fontSize: 11 }}>Thali #{u.thali_number || '—'}</div>
      </div>,
      <Badge color={r.meal === 'lunch' ? '#c49c5a' : '#5e9ce0'}>{r.day.toUpperCase()}</Badge>,
      <Badge variant="outline">{r.meal}</Badge>,
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 300 }}>
        {r.wants_food === false ? (
          <span style={{ color: T.danger, fontSize: 11, fontWeight: 700 }}>OPTED OUT (SKIP)</span>
        ) : Object.entries(qtys).map(([d, p]) => (
          <span key={d} style={{ fontSize: 11, background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 6, border: `1px solid ${T.border}` }}>
            {d}: <strong style={{color: T.accent}}>{p}%</strong>
          </span>
        ))}
      </div>,
      <div style={{ fontSize: 11, color: T.textSub }}>{fmtDateTime(r.created_at)}</div>,
    ]
  })

  return (
    <PageWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <PageTitle sub="Real-time aggregation of food quantities for the kitchen">Survey Analysis</PageTitle>
        <Btn variant="outline" onClick={() => {
          const csv = "Member,Day,Meal,Wants Food,Quantities,Date\n" + 
            filtered.map(r => {
              const u = users[r.user_id] || {}
              return `"${u.name}",${r.day},${r.meal},${r.wants_food},"${JSON.stringify(r.dish_responses)}",${r.created_at}`
            }).join("\n")
          const blob = new Blob([csv], { type: 'text/csv' })
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = `surveys_${new Date().toISOString().slice(0,10)}.csv`
          a.click()
        }}><Download size={14} /> Export CSV</Btn>
      </div>

      <Grid cols={3} style={{ marginBottom: 24 }}>
        <AdminCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Utensils size={18} color={T.accent} />
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Kitchen Summary</div>
          </div>
          {summary.length === 0 ? (
            <div style={{ fontSize: 12, color: T.textSub }}>No quantities to aggregate for current filters.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {summary.map(s => (
                <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: `1px solid ${T.border}`, paddingBottom: 6 }}>
                  <span style={{ color: T.text }}>{s.name}</span>
                  <span style={{ color: T.accent, fontWeight: 700 }}>{s.portions} FULL</span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: T.textSub, marginTop: 4 }}>* Calculated by summing portion percentages</div>
            </div>
          )}
        </AdminCard>

        <AdminCard style={{ gridColumn: 'span 2' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 18 }}>Weekly Submission Trend</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ left: -20, bottom: -10 }}>
              <CartesianGrid stroke={T.border} vertical={false} />
              <XAxis dataKey="day" tick={{ fill: T.textSub, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.textSub, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...TooltipStyle} />
              <Bar dataKey="lunch"  fill="#c49c5a" radius={[4,4,0,0]} name="Lunch"  />
              <Bar dataKey="dinner" fill="#5e9ce0" radius={[4,4,0,0]} name="Dinner" />
            </BarChart>
          </ResponsiveContainer>
        </AdminCard>
      </Grid>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={14} color={T.textSub} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member, email or thali…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 36px', borderRadius: 12, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <select value={dayFilter} onChange={e => setDayFilter(e.target.value)}
          style={{ padding: '11px 14px', borderRadius: 12, background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
          <option value="all">All Days</option>
          {DAYS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
        </select>
        <select value={mealFilter} onChange={e => setMealFilter(e.target.value)}
          style={{ padding: '11px 14px', borderRadius: 12, background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
          <option value="all">All Meals</option>
          {MEALS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
        </select>
        <Btn variant="ghost" onClick={() => load()} title="Sync manually"><RefreshCw size={15} className={loading ? 'spin' : ''} /></Btn>
      </div>

      {loading && responses.length === 0 ? <Spinner /> : (
        <AdminCard style={{ padding: 0, overflow: 'hidden' }}>
          <Table
            headers={['Member', 'Day', 'Meal', 'Quantities selected by member', 'Submitted On']}
            rows={rows}
            emptyMsg="No survey responses found matching filters."
          />
        </AdminCard>
      )}
      <style>{`.spin { animation: spin 1s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </PageWrap>
  )
}

