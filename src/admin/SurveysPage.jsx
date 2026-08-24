// src/admin/SurveysPage.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/firebaseClient'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { RefreshCw, Search, Filter, Utensils, Download, User as UserIcon, Calendar as CalendarIcon, Scan, X, Trash2 } from 'lucide-react'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'
import { T, PageWrap, PageTitle, AdminCard, Table, Badge, Btn, Spinner, Grid, Modal, SectionHeader, SurveyResponseDisplay, PackingTVView, fmtDate, fmtDateTime, ErrorBanner } from './ui'
import { getSurveyTargetWeek, DAYS, MEALS } from '../common/utils'
import { getSlotDishes } from '../hooks/useSurvey'
import { fetchUserSurveyRow, fetchAllUserRows, eraseSurveySlot } from '../lib/surveyRows'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'


const TooltipStyle = {
  contentStyle: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 13 },
  cursor: { fill: 'rgba(196,156,90,0.06)' },
}

export default function SurveysPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [appSettings, setAppSettings] = useState({})
  const surveyWeekId = useCallback(() => getSurveyTargetWeek(appSettings), [appSettings])
  const weeklyMenu = useWeeklyMenu(surveyWeekId()) || {}
  const [loading, setLoading] = useState(true)
  const [responses, setResponses] = useState([])
  const [users, setUsers] = useState({})
  const [viewMode, setViewMode] = useState('aggregate')
  
  // URL Param handling
  const urlUserId = searchParams.get('userId')
  const [focusedUserId, setFocusedUserId] = useState(urlUserId)
  
  const [dayFilter, setDayFilter] = useState(() => {
    const d = new Date().getDay()
    // Default to today's day name if it's a weekday (Mon-Sat), else Monday
    const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
    const today = dayNames[d]
    return ['monday','tuesday','wednesday','thursday','friday','saturday'].includes(today) ? today : 'monday'
  })
  const [mealFilter, setMealFilter] = useState(() => {
    const h = new Date().getHours() + new Date().getMinutes() / 60
    return (h >= 20 || h < 14) ? 'lunch' : 'dinner'
  })
  const [search, setSearch] = useState('')
  const [chartData, setChartData] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [weekFilter, setWeekFilter] = useState('all')
  const [availableWeeks, setAvailableWeeks] = useState([])
  const [dishInputConfig, setDishInputConfig] = useState({})

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
        week_id: resp?.week_id || null,
        status: resp.wants_food ? 'Applied' : 'Skipped',
        dishResponses: resp.dish_responses,
        currentDay: dayFilter,
        currentMeal: mealFilter
      })
    } else {
      // Fallback: try to fetch from DB if not in current view
      processDirectScan(userId)
    }
  }

  const buildAllDishes = (row, dayName, mealName, fallbackList) => {
    const dk = dayName.substring(0, 3).toLowerCase()
    const mk = mealName === 'lunch' ? 'l' : 'd'
    const snapshotList = getSlotDishes(row, dayName, mealName, null)
    const dishList = snapshotList && snapshotList.length ? snapshotList : (Array.isArray(fallbackList) && fallbackList.length ? fallbackList : [])
    const res = {}
    res._status = row ? row[`${dk}_${mk}_status`] : 'Not Submitted'
    dishList.forEach((d, i) => {
      const v = row ? row[`${dk}_${mk}_dish_${i + 1}`] : null
      if (v !== undefined && v !== null && v !== '') {
        const rotiKw = ['roti', 'naan', 'paratha', 'bread', 'chapati', 'puri']
        if (rotiKw.some(k => d.toLowerCase().includes(k))) {
          res[d] = String(v).toLowerCase() === 'yes' ? 'yes' : 'no'
        } else {
          const lv = String(v).toLowerCase()
          if (lv === 'yes' || lv === 'no') res[d] = lv
          else res[d] = v
        }
      } else {
        res[d] = null
      }
    })
    return res
  }

  const processDirectScan = async (userId) => {
    try {
      const { data: u } = await supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle()
      if (!u) return
      
      const dayKey = dayFilter.substring(0, 3).toLowerCase()
      const mealKey = mealFilter === 'lunch' ? 'l' : 'd'
      const weekId = surveyWeekId()
      
      const { data: row } = await fetchUserSurveyRow(userId, weekId)
      
      // Fresh menu for this week so scan shows real dish names, not Dish1
      let freshMenu = {}
      try {
        const { data: menuRows } = await supabase.from('weekly_menu').select('day_name,lunch,dinner').eq('week_start', weekId)
        ;(menuRows || []).forEach(r => {
          const k = String(r.day_name || '').toLowerCase()
          freshMenu[k] = {
            lunch: r.lunch ? r.lunch.split(',').map(s => s.trim()).filter(Boolean) : [],
            dinner: r.dinner ? r.dinner.split(',').map(s => s.trim()).filter(Boolean) : [],
          }
        })
      } catch {}
      const dayMenu = freshMenu[dayFilter.toLowerCase()] || weeklyMenu[dayFilter.toLowerCase()] || weeklyMenu[dayFilter] || {}
      const buildCur = buildAllDishes(row, dayFilter, mealFilter, dayMenu[mealFilter] || [])
      const buildLunch = buildAllDishes(row, dayFilter, 'lunch', dayMenu.lunch || [])
      const buildDinner = buildAllDishes(row, dayFilter, 'dinner', dayMenu.dinner || [])

      setSelectedUser({
        ...u,
        week_id: weekId,
        status: buildCur._status,
        dishResponses: buildCur,
        lunch: { status: buildLunch._status, dishes: buildLunch },
        dinner: { status: buildDinner._status, dishes: buildDinner },
        currentDay: dayFilter,
        currentMeal: mealFilter,
        dishInputConfig: dishInputConfig
      })
    } catch (e) { console.error(e) }
  }

  // --- CAMERA SCANNER ---
  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner("qr-reader", {
        fps: 10,
        qrbox: 250,
        supportedScanTypes: [
          Html5QrcodeScanType.SCAN_TYPE_CAMERA,
          Html5QrcodeScanType.SCAN_TYPE_FILE
        ],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
      });
      const handleScan = async (decodedText) => {
        if (decodedText.startsWith('ALMAWAID:')) {
          const userId = decodedText.split(':')[1];
          try {
            await scanner.clear();
          } catch (e) {
            console.error("Failed to clear scanner", e);
          }
          setIsScanning(false);
          handleWirelessScan(userId);
        }
      };

      scanner.render(handleScan, (error) => {});
      return () => {
        scanner.clear().catch(e => console.error("Scanner cleanup failed", e));
      };
    }
  }, [isScanning, responses])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      // Auto-cleanup: delete submissions older than 1 week (keep current + 1 previous)
      try {
        const currentWeek = surveyWeekId()
        const prevWeek = new Date(currentWeek)
        prevWeek.setDate(prevWeek.getDate() - 7)
        const cutoff = prevWeek.toISOString().split('T')[0]
        const { data: oldRows } = await supabase
          .from('survey_day_responses')
          .select('week_id').lt('week_id', cutoff)
        if (oldRows && oldRows.length) {
          const oldWeeks = [...new Set(oldRows.map(r => r.week_id))].filter(Boolean)
          for (const ow of oldWeeks) {
            await supabase.from('survey_day_responses').delete().eq('week_id', ow)
            try { await supabase.from('survey_submissions_flat').delete().eq('week_id', ow) } catch {}
          }
        }
        // Prune previous weeks' weekly_menu rows
        try {
          await supabase.from('weekly_menu').delete().lt('week_start', currentWeek)
        } catch {}
      } catch (e) { console.warn('Cleanup error:', e) }

      // Load full app_settings so week matches member side (dynamic day/time + force status)
      const { data: allSettings } = await supabase.from('app_settings').select('*')
      const settingsMap = {}
      ;(allSettings || []).forEach(r => { if (r && r.key) settingsMap[r.key] = r.value })
      if (settingsMap.dish_input_config) {
        try { setDishInputConfig(JSON.parse(settingsMap.dish_input_config)) } catch {}
      }
      setAppSettings(prev => JSON.stringify(prev) === JSON.stringify(settingsMap) ? prev : settingsMap)

      const { data: rows, error } = await fetchAllUserRows()
      
      if (error) throw error
      setLoadError(null)

      // Attach user_stats for the UI (name, thali number)
      const { data: userStatsRows } = await supabase.from('user_stats').select('*')
      const statsMap = new Map((userStatsRows || []).map(u => [u.user_id, u]))
      const thaliMap = new Map((userStatsRows || []).filter(u => u.thali_number).map(u => [String(u.thali_number).trim(), u]))
      const emailMap = new Map((userStatsRows || []).filter(u => u.email).map(u => [u.email.toLowerCase().trim(), u]))
      const merged = (rows || []).map(r => ({
        ...r,
        user_stats: statsMap.get(r.user_id) || (r.thali_number && thaliMap.get(String(r.thali_number).trim())) || (r.email && emailMap.get(r.email.toLowerCase().trim())) || null
      }))
      merged.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))

      // Collect distinct week_ids for the filter
      const weeks = [...new Set(merged.map(r => r.week_id).filter(Boolean))].sort().reverse()
      setAvailableWeeks(weeks)

      // Map users for the UI stats if needed
      const uMap = {}
      merged.forEach(row => { 
        if (row.user_stats) uMap[row.user_id] = row.user_stats 
      })
      setUsers(uMap)

      // Helper to check if dish is roti
      const isRotiItem = (dish) => {
        const rotiKeywords = ['roti', 'naan', 'paratha', 'bread', 'chapati', 'puri']
        return rotiKeywords.some(k => dish.toLowerCase().includes(k))
      }
      
      // Transform merged rows into normalized response objects
      const normalized = []
      merged.forEach(row => {
        DAYS.forEach(day => {
          const dayKey = day.substring(0, 3).toLowerCase()
          MEALS.forEach(meal => {
            const mealKey = meal === 'lunch' ? 'l' : 'd'
            const status = row[`${dayKey}_${mealKey}_status`]
            if (status) {
              const dishResponses = {}
              const dayMenu = weeklyMenu[day.toLowerCase()] || weeklyMenu[day] || {}
              const dishList = getSlotDishes(row, day, meal, dayMenu[meal] || [])
              const dishes = dishList.length > 0
                ? dishList
                : Array.from({ length: 14 }, (_, i) => `Dish ${i + 1}`).filter((_, i) => row && row[`${dayKey}_${mealKey}_dish_${i + 1}`] !== undefined && row[`${dayKey}_${mealKey}_dish_${i + 1}`] !== null && row[`${dayKey}_${mealKey}_dish_${i + 1}`] !== '')
              dishes.forEach((d, i) => {
                const val = row[`${dayKey}_${mealKey}_dish_${i + 1}`]
                if (val !== undefined && val !== null && val !== '') {
                  const lowerVal = String(val).toLowerCase()
                  if (isRotiItem(d)) {
                    dishResponses[d] = lowerVal === 'yes' ? 'yes' : 'no'
                  } else {
                    dishResponses[d] = lowerVal === 'yes' ? 'yes' : lowerVal === 'no' ? 'no' : val
                  }
                }
              })
              normalized.push({
                id: `${row.user_id}_${day}_${meal}`,
                user_id: row.user_id,
                day,
                meal,
                week_id: row.week_id,
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
    } catch (e) {
      console.error('SurveysPage load error:', e)
      setLoadError(e?.message || 'Failed to load survey responses')
    }
    setLoading(false)
  }, [weeklyMenu, weekFilter])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 60000)
    return () => clearInterval(interval)
  }, [load])

  // --- REAL-TIME SUBSCRIPTION ---
  useEffect(() => {
    const channel = supabase
      .channel('surveys-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_day_responses' }, () => {
        load(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
        load(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
    const matchWeek = weekFilter === 'all' || r.week_id === weekFilter

    if (viewMode === 'aggregate') {
      const matchDay = dayFilter === 'all' || r.day === dayFilter
      const matchMeal = mealFilter === 'all' || r.meal === mealFilter
      return matchSearch && matchWeek && matchDay && matchMeal
    } else {
      return matchSearch && matchWeek && r.day === dayFilter && r.meal === mealFilter
    }
  })

  // AGGREGATE SUMMARY - shows total piece counts
  const summary = useMemo(() => {
    const counts = {}
    const isCountDish = {}
    const isPctDish = {}
    const activeData = filtered.filter(f => f.wants_food)
    activeData.forEach(r => {
      const q = r.dish_responses || {}
      Object.entries(q).forEach(([dish, val]) => {
        if (!counts[dish]) {
          counts[dish] = 0
          isCountDish[dish] = (typeof val === 'number') || (typeof val === 'string' && !val.endsWith('%') && String(val).toLowerCase() !== 'yes' && String(val).toLowerCase() !== 'no')
          isPctDish[dish] = typeof val === 'string' && val.endsWith('%')
        }
        if (isCountDish[dish]) {
          counts[dish] += (parseInt(val) || 0)
        } else if (isPctDish[dish]) {
          counts[dish] += (parseInt(val) || 0)
        } else if (val === 'yes') {
          counts[dish] = (counts[dish] || 0) + 1
        }
      })
    })
    return Object.entries(counts).map(([name, total]) => ({
      name,
      portions: isCountDish[name] ? String(total) : isPctDish[name] ? (total / 100).toFixed(1) : String(total),
      raw: total,
      isCount: isCountDish[name],
      isPct: isPctDish[name]
    }))
  }, [filtered])

  // Erase individual survey portion entry from Supabase
  const handleEraseRow = async (r) => {
    if (!r.user_id || !r.week_id) return
    const u = users[r.user_id] || {}
    const who = u.name ? `${u.name} (#${u.thali_number || '—'})` : `Thali #${u.thali_number || '—'}`
    const dayKey = (r.day || '').substring(0, 3).toLowerCase()
    if (!window.confirm(`Erase ${r.day.toUpperCase()} ${r.meal.toUpperCase()} response for ${who}?\n\nThis will permanently delete this portion from Supabase.`)) {
      return
    }
    try {
      const { error } = await eraseSurveySlot(r.user_id, r.week_id, dayKey, r.meal)
      if (error) throw error
      await load(true)
    } catch (e) {
      console.error('Erase failed:', e)
      alert('Erase failed: ' + (e?.message || 'Please try again.'))
    }
  }

  // TABLE ROWS - AGGREGATE VIEW
  const aggregateRows = filtered.map(r => {
    const u = users[r.user_id] || {}
    const qtys = r.dish_responses || {}
    return [
      <div>
        <div style={{ fontWeight: 600, color: T.text, fontSize: 13 }}>{u.name || '—'}</div>
        <div style={{ color: T.textSub, fontSize: 11 }}>Thali #{u.thali_number || '—'}</div>
      </div>,
      <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600 }}>{r.week_id ? new Date(r.week_id + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</div>,
      <Badge color={r.meal === 'lunch' ? '#c49c5a' : '#5e9ce0'}>{r.day.toUpperCase()}</Badge>,
      <Badge variant="outline">{r.meal}</Badge>,
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 300 }}>
        {r.wants_food === false ? (
          <span style={{ color: T.danger, fontSize: 11, fontWeight: 700 }}>OPTED OUT (SKIP)</span>
        ) : Object.entries(qtys).map(([d, p]) => {
          const isRoti = ['roti', 'naan', 'paratha', 'bread', 'chapati', 'puri'].some(k => d.toLowerCase().includes(k))
          const isCount = (typeof p === 'number') || (typeof p === 'string' && !p.endsWith('%') && String(p).toLowerCase() !== 'yes' && String(p).toLowerCase() !== 'no')
          const numVal = parseInt(p) || 0
          if (isRoti) {
            const yes = String(p).toLowerCase() === 'yes'
            return (
              <span key={d} style={{ fontSize: 11, background: yes ? 'rgba(197,160,89,0.1)' : 'rgba(239,68,68,0.05)', padding: '2px 8px', borderRadius: 6, border: `1px solid ${yes ? T.accentBorder : 'rgba(239,68,68,0.15)'}`, fontWeight: 700, color: yes ? T.accent : T.danger }}>
                {d}: {yes ? 'YES' : 'NO'}
              </span>
            )
          }
          return (
            <span key={d} style={{ fontSize: 11, background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 6, border: `1px solid ${T.border}` }}>
              {d}: <strong style={{ color: T.accent }}>{isCount ? `${numVal} person${numVal === 1 ? '' : 's'}` : `${numVal}%`}</strong>
            </span>
          )
        })}
      </div>,
      <div style={{ fontSize: 11, color: T.textSub }}>{fmtDateTime(r.created_at)}</div>,
      <button
        type="button"
        onClick={() => handleEraseRow(r)}
        title="Erase response from Supabase"
        style={{
          padding: '6px 10px', borderRadius: 8,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 700,
        }}
      >
        <Trash2 size={12} /> Erase
      </button>
    ]
  })

  // DAILY BREAKDOWN (Pivoted Table)
  const dailyDishes = weeklyMenu[dayFilter]?.[mealFilter] || []
  const dailyHeaders = ['Thali User', ...dailyDishes, 'Submitted', 'Action']
  const dailyRows = filtered.map(r => {
    const u = users[r.user_id] || {}
    const qtys = r.dish_responses || {}

    const dishCells = dailyDishes.map(dish => {
      const val = qtys[dish];
      if (r.wants_food === false) return <span style={{ color: T.danger, opacity: 0.5 }}>SKIPPED</span>
      if (val === undefined || val === null) return <span style={{ color: T.textSub, opacity: 0.3 }}>N/A</span>

      const isRoti = dish.toLowerCase().includes('roti') || dish.toLowerCase().includes('naan');
      if (isRoti) {
        const yes = String(val).toLowerCase() === 'yes'
        return <Badge color={yes ? T.accent : T.danger} variant={yes ? 'solid' : 'outline'}>{yes ? 'YES' : 'NO'}</Badge>
      }

      const isCount = (typeof val === 'string' && !val.endsWith('%') && String(val).toLowerCase() !== 'yes' && String(val).toLowerCase() !== 'no') || typeof val === 'number'
      const numVal = parseInt(val) || 0

      if (isCount) {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: T.accent }}>
              {numVal} <span style={{ fontSize: 10, fontWeight: 600, color: T.textSub }}>person{numVal === 1 ? '' : 's'}</span>
            </span>
          </div>
        )
      }

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${numVal}%`, background: numVal > 50 ? T.accentGrad : T.accent, opacity: numVal > 0 ? 1 : 0.2 }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.accent }}>
            {numVal}%
          </span>
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
      <button
        type="button"
        onClick={() => handleEraseRow(r)}
        title="Erase response from Supabase"
        style={{
          padding: '6px 10px', borderRadius: 8,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 700,
        }}
      >
        <Trash2 size={12} /> Erase
      </button>
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
          }} aria-label="Export CSV" style={{ height: 48, width: 48, padding: 0, borderRadius: 14 }}><Download size={20} /></Btn>
        </div>
      </div>

      {/* PACKING STATION TV OVERLAY */}
      {selectedUser && (
        <PackingTVView 
          user={selectedUser} 
          meal={mealFilter}
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
                      <span style={{ color: T.textSub, fontSize: 11 }}>{s.isCount ? 'Total persons' : s.isPct ? 'Total portions' : 'Yes count'}: {s.raw}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: T.accent, fontSize: 28, fontWeight: 900 }}>{s.portions}</div>
                      <div style={{ fontSize: 10, color: T.textSub, textTransform: 'uppercase', fontWeight: 800 }}>{s.isCount ? 'Persons' : s.isPct ? 'Portions' : 'Members'}</div>
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
            <button onClick={() => setDayFilter('all')}
              style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 10, border: 'none', background: dayFilter === 'all' ? T.accentGrad : 'transparent', color: dayFilter === 'all' ? '#fff' : T.textSub, fontSize: 10, fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}>
              All
            </button>
            {DAYS.map(day => (
              <button key={day} onClick={() => setDayFilter(day)}
                style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 10, border: 'none', background: dayFilter === day ? T.accentGrad : 'transparent', color: dayFilter === day ? '#fff' : T.textSub, fontSize: 10, fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}>
                {day.charAt(0).toUpperCase() + day.slice(1, 3)}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', background: T.inputBg, padding: '4px', borderRadius: 14, border: `1px solid ${T.border}` }}>
            <button onClick={() => setMealFilter('all')}
              style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: mealFilter === 'all' ? T.accentGrad : 'transparent', color: mealFilter === 'all' ? '#fff' : T.textSub, fontSize: 10, fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}>
              All
            </button>
            {MEALS.map(meal => (
              <button key={meal} onClick={() => setMealFilter(meal)}
                style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: mealFilter === meal ? (meal === 'lunch' ? '#c49c5a' : '#5e9ce0') : 'transparent', color: mealFilter === meal ? '#fff' : T.textSub, fontSize: 10, fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}>
                {meal.charAt(0).toUpperCase() + meal.slice(1)}
              </button>
            ))}
          </div>

          <select value={weekFilter} onChange={e => setWeekFilter(e.target.value)} name="weekFilter"
            style={{ padding: '6px 12px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.border}`, color: T.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none' }}>
            <option value="all">ALL WEEKS</option>
            {availableWeeks.map(w => (
              <option key={w} value={w}>{new Date(w + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</option>
            ))}
          </select>

          <Btn variant="ghost" onClick={() => load()} className="clickable"><RefreshCw size={15} className={loading ? 'spin' : ''} /></Btn>
        </div>
      </div>

      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

      <div style={{ flex: 1, minWidth: 260, position: 'relative', marginBottom: 24 }}>
        <Search size={16} color={T.textSub} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input name="searchSurveys" value={search} onChange={e => setSearch(e.target.value)} placeholder="Quick search member name or thali #..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '14px 14px 14px 44px', borderRadius: 16, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      {loading && responses.length === 0 ? <Spinner /> : (
        <AdminCard style={{ padding: 0, overflow: 'hidden', borderRadius: 24 }}>
          {viewMode === 'aggregate' ? (
            <Table
              headers={['Thali User', 'Week', 'Day', 'Meal', 'Quantities Selected', 'Submitted', 'Action']}
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
            <button onClick={() => setIsScanning(false)} aria-label="Close scanner" style={{ position: 'absolute', top: -60, right: 0, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} /></button>
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
