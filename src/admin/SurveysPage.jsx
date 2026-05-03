// src/admin/SurveysPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { RefreshCw, Search, Filter, Utensils, Download, User as UserIcon, Calendar as CalendarIcon } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Table, Badge, Btn, Spinner, Grid, fmtDate, fmtDateTime } from './ui'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MEALS = ['lunch', 'dinner']

const TooltipStyle = {
  contentStyle: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 13 },
  cursor: { fill: 'rgba(196,156,90,0.06)' },
}

export default function SurveysPage() {
  const weeklyMenu = useWeeklyMenu() || {}
  const [loading, setLoading] = useState(true)
  const [responses, setResponses] = useState([])
  const [users, setUsers] = useState({})
  const [viewMode, setViewMode] = useState('daily') // Default to daily as requested
  const [dayFilter, setDayFilter] = useState('monday')
  const [mealFilter, setMealFilter] = useState('lunch')
  const [search, setSearch] = useState('')
  const [chartData, setChartData] = useState([])

  const getWeekDate = () => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(now.setDate(diff))
    return monday.toISOString().split('T')[0]
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const currentWeekId = getWeekDate()
      const [{ data: flat }, { data: us }] = await Promise.all([
        supabase.from('survey_submissions_flat').select('*').eq('week_id', currentWeekId).order('updated_at', { ascending: false }),
        supabase.from('user_stats').select('user_id,name,email,thali_number'),
      ])
      
      const uMap = {}
      ;(us || []).forEach(u => { uMap[u.user_id] = u })
      setUsers(uMap)

      // Transform flat rows into normalized response objects
      const normalized = []
      ;(flat || []).forEach(row => {
        DAYS.forEach(day => {
          const dayKey = day.substring(0, 3).toLowerCase()
          MEALS.forEach(meal => {
            const mealKey = meal === 'lunch' ? 'l' : 'd'
            const status = row[`${dayKey}_${mealKey}_status`]
            if (status) {
              const dishResponses = {}
              const dishes = weeklyMenu[day]?.[meal] || []
              dishes.forEach((d, i) => {
                const val = row[`${dayKey}_${mealKey}_dish_${i + 1}`]
                if (val !== undefined && val !== null) {
                  dishResponses[d] = val === 'Yes' ? 'yes' : val === 'No' ? 'no' : parseInt(val)
                }
              })
              normalized.push({
                id: `${row.user_id}_${day}_${meal}`,
                user_id: row.user_id,
                day,
                meal,
                wants_food: status === 'Applied',
                dish_responses: dishResponses,
                created_at: row.updated_at
              })
            }
          })
        })
      })
      
      setResponses(normalized)
      buildChart(normalized)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [weeklyMenu])

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

    if (viewMode === 'aggregate') {
      const matchDay = dayFilter === 'all' || r.day === dayFilter
      const matchMeal = mealFilter === 'all' || r.meal === mealFilter
      return matchSearch && matchDay && matchMeal
    } else {
      return matchSearch && r.day === dayFilter && r.meal === mealFilter
    }
  })

  // AGGREGATE SUMMARY
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

  // TABLE ROWS - AGGREGATE VIEW
  const aggregateRows = filtered.map(r => {
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
            {d}: <strong style={{ color: T.accent }}>{p}%</strong>
          </span>
        ))}
      </div>,
      <div style={{ fontSize: 11, color: T.textSub }}>{fmtDateTime(r.created_at)}</div>,
    ]
  })

  // DAILY BREAKDOWN (Pivoted Table)
  const dailyDishes = weeklyMenu[dayFilter]?.[mealFilter] || []
  const dailyHeaders = ['Thali User', ...dailyDishes, 'Submitted']
  const dailyRows = filtered.map(r => {
    const u = users[r.user_id] || {}
    const qtys = r.dish_responses || {}

    const dishCells = dailyDishes.map(dish => {
      const val = qtys[dish];
      if (r.wants_food === false) return <span style={{ color: T.danger, opacity: 0.5 }}>SKIPPED</span>
      if (val === undefined) return <span style={{ color: T.textSub, opacity: 0.3 }}>N/A</span>

      const isRoti = dish.toLowerCase().includes('roti') || dish.toLowerCase().includes('naan');
      if (isRoti) {
        return <Badge color={val === 'yes' ? T.accent : T.danger} variant={val === 'yes' ? 'solid' : 'outline'}>{val.toUpperCase()}</Badge>
      }

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${val}%`, background: val > 50 ? T.accentGrad : T.accent, opacity: val > 0 ? 1 : 0.2 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: val > 0 ? T.text : T.textSub }}>{val}%</span>
        </div>
      )
    })

    return [
      <div>
        <div style={{ fontWeight: 600, color: T.text, fontSize: 13 }}>{u.name || '—'}</div>
        <div style={{ color: T.textSub, fontSize: 11 }}>Thali #{u.thali_number || '—'}</div>
      </div>,
      ...dishCells,
      <div style={{ fontSize: 10, color: T.textSub }}>{fmtDate(r.created_at)}</div>,
    ]
  })

  return (
    <PageWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <PageTitle sub="Detailed thali user-wise portions and aggregation">Survey Analytics</PageTitle>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant={viewMode === 'daily' ? 'solid' : 'outline'} size="sm" onClick={() => setViewMode('daily')}>
            <UserIcon size={14} /> <span className="desktop-only">Full Breakdown</span><span className="mobile-only" style={{ display: 'none' }}>Daily</span>
          </Btn>
          <Btn variant={viewMode === 'aggregate' ? 'solid' : 'outline'} size="sm" onClick={() => setViewMode('aggregate')}>
            <Utensils size={14} /> <span className="desktop-only">Aggregate Summary</span><span className="mobile-only" style={{ display: 'none' }}>Summary</span>
          </Btn>
          <Btn variant="outline" size="sm" onClick={() => {
            const csv = dailyHeaders.join(',') + "\n" +
              filtered.map(r => {
                const u = users[r.user_id] || {}
                const qtys = r.dish_responses || {}
                const dishVals = dailyDishes.map(d => qtys[d] || (r.wants_food === false ? 'SKIPPED' : 'N/A'))
                return [`"${u.name}"`, ...dishVals, `"${r.created_at}"`].join(',')
              }).join("\n")
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `detailed_survey_${dayFilter}_${mealFilter}.csv`
            a.click()
          }}><Download size={14} /> Export</Btn>
        </div>
      </div>

      <Grid cols={3} style={{ marginBottom: 24 }}>
        <AdminCard className="stagger-item" style={{ animationDelay: '0.05s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Utensils size={18} color={T.accent} />
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
              {viewMode === 'daily' ? `${dayFilter.toUpperCase()} Targets` : 'Responses'}
            </div>
          </div>
          {summary.length === 0 ? (
            <div style={{ fontSize: 12, color: T.textSub }}>No results found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {summary.map(s => (
                <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: `1px solid ${T.border}`, paddingBottom: 6 }}>
                  <span style={{ color: T.text, fontSize: 12 }}>{s.name}</span>
                  <span style={{ color: T.accent, fontWeight: 700 }}>{s.portions}</span>
                </div>
              ))}
            </div>
          )}
        </AdminCard>

        <AdminCard className="stagger-item" style={{ gridColumn: 'span 2', animationDelay: '0.1s' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 18 }}>Activity Trends</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ left: -20, bottom: -10 }}>
              <CartesianGrid stroke={T.border} vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fill: T.textSub, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.textSub, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...TooltipStyle} />
              <Bar dataKey="lunch" fill="#c49c5a" radius={[4, 4, 0, 0]} name="Lunch" />
              <Bar dataKey="dinner" fill="#5e9ce0" radius={[4, 4, 0, 0]} name="Dinner" />
            </BarChart>
          </ResponsiveContainer>
        </AdminCard>
      </Grid>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
          <Search size={14} color={T.textSub} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search thali user…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 36px', borderRadius: 12, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: T.inputBg, padding: '4px', borderRadius: 14, border: `1px solid ${T.border}`, overflowX: 'auto', maxWidth: '85vw' }}>
            {DAYS.map(day => (
              <button key={day} onClick={() => setDayFilter(day)}
                style={{ flexShrink: 0, padding: '6px 10px', borderRadius: 10, border: 'none', background: dayFilter === day ? T.accentGrad : 'transparent', color: dayFilter === day ? '#fff' : T.textSub, fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}>
                {day.charAt(0).toUpperCase() + day.slice(1, 3)}
              </button>
            ))}
            {viewMode === 'aggregate' && (
              <button onClick={() => setDayFilter('all')} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: dayFilter === 'all' ? T.accentGrad : 'transparent', color: dayFilter === 'all' ? '#fff' : T.textSub, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>ALL</button>
            )}
          </div>

          <div style={{ display: 'flex', background: T.inputBg, padding: '4px', borderRadius: 14, border: `1px solid ${T.border}` }}>
            {MEALS.map(meal => (
              <button key={meal} onClick={() => setMealFilter(meal)}
                style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: mealFilter === meal ? (meal === 'lunch' ? '#c49c5a' : '#5e9ce0') : 'transparent', color: mealFilter === meal ? '#fff' : T.textSub, fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}>
                {meal.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
          <Btn variant="ghost" onClick={() => load()} className="clickable"><RefreshCw size={15} className={loading ? 'spin' : ''} /></Btn>
        </div>
      </div>

      {loading && responses.length === 0 ? <Spinner /> : (
        <AdminCard style={{ padding: 0, overflow: 'hidden' }}>
          {viewMode === 'aggregate' ? (
            <Table
              headers={['Thali User', 'Day', 'Meal', 'Quantities Selected', 'Submitted']}
              rows={aggregateRows}
              emptyMsg="No results matching filters."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table
                headers={dailyHeaders}
                rows={dailyRows}
                emptyMsg={`No responses found for ${dayFilter} ${mealFilter}.`}
              />
            </div>
          )}
        </AdminCard>
      )}
      <style>{`.spin { animation: spin 1s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </PageWrap>
  )
}
