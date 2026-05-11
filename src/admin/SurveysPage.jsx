// src/admin/SurveysPage.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { RefreshCw, Search, Filter, Utensils, Download, User as UserIcon, Calendar as CalendarIcon, Scan, X } from 'lucide-react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { T, PageWrap, PageTitle, AdminCard, Table, Badge, Btn, Spinner, Grid, Modal, SectionHeader, SurveyResponseDisplay, PackingTVView, fmtDate, fmtDateTime } from './ui'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const weeklyMenu = useWeeklyMenu() || {}
  const [loading, setLoading] = useState(true)
  const [responses, setResponses] = useState([])
  const [users, setUsers] = useState({})
  const [viewMode, setViewMode] = useState('daily')
  
  // URL Param handling
  const urlUserId = searchParams.get('userId')
  const [focusedUserId, setFocusedUserId] = useState(urlUserId)
  
  const [dayFilter, setDayFilter] = useState(() => {
    const d = new Date().getDay()
    return d === 0 ? 'monday' : DAYS[d-1]
  })
  const [mealFilter, setMealFilter] = useState(() => (new Date().getHours() + new Date().getMinutes() / 60) < 15.5 ? 'lunch' : 'dinner')
  const [search, setSearch] = useState('')
  const [chartData, setChartData] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [isScanning, setIsScanning] = useState(false)

  // --- AUTO LOAD URL USER ---
  useEffect(() => {
    if (urlUserId) {
      processDirectScan(urlUserId)
    }
  }, [urlUserId, responses]) // Also depend on responses so it can find them if they load later

  // --- WIRELESS SCANNER SUPPORT ---
  const scanBuffer = useRef('')
  const scanTimeout = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        if (scanBuffer.current.startsWith('ALMAWAID:')) {
          const id = scanBuffer.current.split(':')[1]
          processDirectScan(id)
        }
        scanBuffer.current = ''
        return
      }

      if (e.key.length === 1) {
        scanBuffer.current += e.key
      }

      if (scanTimeout.current) clearTimeout(scanTimeout.current)
      scanTimeout.current = setTimeout(() => {
        if (!scanBuffer.current.includes(':')) {
           scanBuffer.current = ''
        }
      }, 50)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (scanTimeout.current) clearTimeout(scanTimeout.current)
    }
  }, [responses])

  const handleWirelessScan = (userId) => {
    // Find response in currently loaded data
    const resp = responses.find(r => r.user_id === userId && r.day === dayFilter && r.meal === mealFilter)
    if (resp) {
      const u = users[userId] || {}
      setSelectedUser({
        ...u,
        status: resp.wants_food ? 'Applied' : 'Skipped',
        dishResponses: resp.dish_responses
      })
    } else {
      // Fallback: try to fetch from DB if not in current view
      processDirectScan(userId)
    }
  }

  const processDirectScan = async (userId) => {
    try {
      const { data: u } = await supabase.from('user_stats').select('*').eq('user_id', userId).single()
      if (!u) return
      
      const dayKey = dayFilter.substring(0, 3).toLowerCase()
      const mealKey = mealFilter === 'lunch' ? 'l' : 'd'
      const weekId = getWeekDate()
      
      const { data: row } = await supabase.from('survey_submissions_flat')
        .select('*').eq('user_id', userId).eq('week_id', weekId).single()
      
      const dishRes = {}
      if (row && row[`${dayKey}_${mealKey}_status`] === 'Applied') {
        const dishes = weeklyMenu[dayFilter]?.[mealFilter] || []
        dishes.forEach((d, i) => {
          const val = row[`${dayKey}_${mealKey}_dish_${i + 1}`]
          dishRes[d] = val === 'Yes' ? 'yes' : val === 'No' ? 'no' : parseInt(val)
        })
      }

      setSelectedUser({
        ...u,
        status: row ? row[`${dayKey}_${mealKey}_status`] : 'Not Submitted',
        dishResponses: dishRes
      })
    } catch (e) { console.error(e) }
  }

  // --- CAMERA SCANNER ---
  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
      scanner.render((decodedText) => {
        if (decodedText.startsWith('ALMAWAID:')) {
          const userId = decodedText.split(':')[1];
          handleWirelessScan(userId);
          setIsScanning(false);
          scanner.clear();
        }
      }, (error) => {});
      return () => scanner.clear();
    }
  }, [isScanning, responses])

  const getWeekDate = () => {
    const now = new Date()
    const day = now.getDay()
    const hour = now.getHours()
    let diff = now.getDate() - day + (day === 0 ? -6 : 1)
    // If we are in the Saturday 8PM+ or Sunday window, surveys target next week's Monday
    if (day === 0 || (day === 6 && hour >= 20)) {
      diff += 7
    }
    const monday = new Date(now.setDate(diff))
    return monday.toISOString().split('T')[0]
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const currentWeekId = getWeekDate()
      const { data: flat, error } = await supabase
        .from('survey_submissions_flat')
        .select('*, user_stats(*)')
        .eq('week_id', currentWeekId)
        .order('updated_at', { ascending: false })
      
      if (error) throw error

      // Map users for the UI stats if needed
      const uMap = {}
      ;(flat || []).forEach(row => { 
        if (row.user_stats) uMap[row.user_id] = row.user_stats 
      })
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
        <div>
          <PageTitle sub="Thali Distribution & Response Tracking">Survey Central</PageTitle>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Btn variant="primary" onClick={() => setIsScanning(true)} style={{ height: 48, padding: '0 24px', borderRadius: 14 }}>
            <Scan size={18} /> <span className="desktop-only">Launch Scanner</span><span className="mobile-only">Scan</span>
          </Btn>
          <Btn variant="outline" onClick={() => {
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
          }} style={{ height: 48, width: 48, padding: 0, borderRadius: 14 }}><Download size={20} /></Btn>
        </div>
      </div>

      {/* PACKING STATION TV OVERLAY */}
      {selectedUser && (
        <PackingTVView 
          user={selectedUser} 
          onClose={() => {
            setSelectedUser(null)
            setSearchParams({})
          }} 
        />
      )}

      <Grid cols={3} style={{ marginBottom: 32 }}>
          <AdminCard className="stagger-item" style={{ animationDelay: '0.05s', background: T.accentBg, border: `2px solid ${T.accentBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Utensils size={22} color={T.accent} />
              <div style={{ fontSize: 16, fontWeight: 800, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {viewMode === 'daily' ? `${dayFilter.toUpperCase()} Targets` : 'Total portions'}
              </div>
            </div>
            {summary.length === 0 ? (
              <div style={{ fontSize: 14, color: T.textSub, textAlign: 'center', padding: '20px 0' }}>No responses for this session.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {summary.map(s => (
                  <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: T.text, fontSize: 15, fontWeight: 700 }}>{s.name}</span>
                      <span style={{ color: T.textSub, fontSize: 11 }}>Total: {s.raw}%</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: T.accent, fontSize: 24, fontWeight: 900 }}>{s.portions}</div>
                      <div style={{ fontSize: 10, color: T.textSub, textTransform: 'uppercase', fontWeight: 800 }}>Portions</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>

          <AdminCard className="stagger-item" style={{ gridColumn: 'span 2', animationDelay: '0.1s' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 18 }}>Weekly Engagement</div>
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant={viewMode === 'daily' ? 'solid' : 'outline'} size="sm" onClick={() => setViewMode('daily')}>
            <UserIcon size={14} /> <span className="desktop-only">Portion Breakdown</span><span className="mobile-only">Daily</span>
          </Btn>
          <Btn variant={viewMode === 'aggregate' ? 'solid' : 'outline'} size="sm" onClick={() => setViewMode('aggregate')}>
            <Utensils size={14} /> <span className="desktop-only">Submission Log</span><span className="mobile-only">Log</span>
          </Btn>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: T.inputBg, padding: '4px', borderRadius: 14, border: `1px solid ${T.border}`, overflowX: 'auto', maxWidth: '85vw' }}>
            {DAYS.map(day => (
              <button key={day} onClick={() => setDayFilter(day)}
                style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 10, border: 'none', background: dayFilter === day ? T.accentGrad : 'transparent', color: dayFilter === day ? '#fff' : T.textSub, fontSize: 10, fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}>
                {day.charAt(0).toUpperCase() + day.slice(1, 3)}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', background: T.inputBg, padding: '4px', borderRadius: 14, border: `1px solid ${T.border}` }}>
            {MEALS.map(meal => (
              <button key={meal} onClick={() => setMealFilter(meal)}
                style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: mealFilter === meal ? (meal === 'lunch' ? '#c49c5a' : '#5e9ce0') : 'transparent', color: mealFilter === meal ? '#fff' : T.textSub, fontSize: 10, fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}>
                {meal.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
          <Btn variant="ghost" onClick={() => load()} className="clickable"><RefreshCw size={15} className={loading ? 'spin' : ''} /></Btn>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 260, position: 'relative', marginBottom: 24 }}>
        <Search size={16} color={T.textSub} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Quick search member name or thali #..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '14px 14px 14px 44px', borderRadius: 16, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      {loading && responses.length === 0 ? <Spinner /> : (
        <AdminCard style={{ padding: 0, overflow: 'hidden', borderRadius: 24 }}>
          {viewMode === 'aggregate' ? (
            <Table
              headers={['Thali User', 'Day', 'Meal', 'Quantities Selected', 'Submitted']}
              rows={aggregateRows}
              emptyMsg="No survey logs found for this filter."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table
                headers={dailyHeaders}
                rows={dailyRows}
                emptyMsg={`No portions assigned for ${dayFilter} ${mealFilter}.`}
              />
            </div>
          )}
        </AdminCard>
      )}
      <style>{`.spin { animation: spin 1s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
      
      {/* SCANNER MODAL */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)', padding: 20 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 450 }}>
            <button onClick={() => setIsScanning(false)} style={{ position: 'absolute', top: -60, right: 0, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} /></button>
            <div style={{ background: '#fff', borderRadius: 32, padding: 20, overflow: 'hidden', boxShadow: '0 50px 100px rgba(0,0,0,0.5)' }}>
              <div id="qr-reader" style={{ width: '100%' }}></div>
            </div>
            <div style={{ color: '#fff', textAlign: 'center', marginTop: 32 }}>
               <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 900 }}>Scan Member QR</h3>
               <p style={{ opacity: 0.7, fontSize: 14 }}>Align the thali QR code within the frame</p>
            </div>
          </div>
        </div>
      )}

      {/* RESPONSE MODAL (BACKUP) */}
      <Modal isOpen={!!selectedUser && !urlUserId} onClose={() => setSelectedUser(null)} title="Identity Verified" maxWidth={460}>
        {selectedUser && (
          <SurveyResponseDisplay 
            user={selectedUser} 
            meal={mealFilter} 
            day={dayFilter} 
            onClose={() => setSelectedUser(null)} 
          />
        )}
      </Modal>
    </PageWrap>
  )
}
