// src/admin/DailySurveyTracking.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/firebaseClient'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { 
  Search, RefreshCw, ChevronRight, Check, X, Filter, 
  Calendar, Utensils, User as UserIcon, Clock, ChevronDown, ChevronUp, Scan
} from 'lucide-react'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'
import { 
  T, PageWrap, PageTitle, AdminCard, Badge, Btn, Spinner, Grid,
  SectionHeader, Modal, PackingTVView, fmtDate, ErrorBanner
} from './ui'

import { getWeekDate, DAYS, toLocalDateStr } from '../common/utils'
import { getPctColor, getSlotDishes } from '../hooks/useSurvey'

// Decide whether a member's thali is stopped on the given date for the given meal,
// based on their pending/approved stop & resume requests (sorted by created_at, so
// the most recent request that affects the day wins).
// A stop WITH a to_date is strictly bounded: the member is "No Thali" only inside
// [from_date, to_date] and is treated as eating again right after to_date (so the
// tracker shows their real survey response once the stop period ends). A stop
// without a to_date stays active until a newer resume/stop request overrides it.
const isStoppedOnDay = (reqs, selDateStr, meal) => {
  let stopped = false
  ;(reqs || [])
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach(sr => {
      const coversMeal = !sr.meal_type || sr.meal_type === 'both' || sr.meal_type === meal
      if (!coversMeal) return
      const from = sr.from_date ? String(sr.from_date) : null
      const to = sr.to_date ? String(sr.to_date) : null
      if (from && selDateStr < from) return // request not active yet
      if (sr.kind === 'resume') {
        stopped = false // resumed eating from this request's from_date onward
      } else if (sr.kind === 'stop') {
        stopped = to ? selDateStr <= to : true // within range -> stopped; after to_date -> eating again
      }
    })
  return stopped
}

// Pick the stop request whose dates best describe the current stopped period
// (prefer the newest stop that actually covers the day, else the newest stop).
const pickStopInfo = (reqs, selDateStr, meal) => {
  const stops = (reqs || []).filter(r => r.kind === 'stop')
  const covering = stops
    .filter(r => isStoppedOnDay([r], selDateStr, meal))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
  const newest = stops.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
  return (covering || newest) || null
}

export default function DailySurveyTracking() {
  const weeklyMenu = useWeeklyMenu() || {}
  const [searchParams] = useSearchParams()
  const urlMeal = searchParams.get('meal')
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState(() => {
    const d = new Date().getDay()
    // Default to Monday if Sunday (since survey is for next week usually, but here we just pick current)
    if (d === 0) return 'monday' 
    return ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][d]
  })
  const getAutoMeal = useCallback(() => {
    const h = new Date().getHours() + new Date().getMinutes() / 60
    if (h >= 20 || h < 14) return 'lunch'
    return 'dinner'
  }, [])
  const [meal, setMeal] = useState(() => {
    if (urlMeal === 'lunch' || urlMeal === 'dinner') return urlMeal
    return getAutoMeal()
  })
  const [mealOverride, setMealOverride] = useState(false)
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [weekFilter, setWeekFilter] = useState('all')
  const [availableWeeks, setAvailableWeeks] = useState([])
  const [dishInputConfig, setDishInputConfig] = useState({})
  const [surveyOpenHour, setSurveyOpenHour] = useState(20)

  // Survey target week based on the configured open hour (default Sat 8PM)
  const surveyWeekId = () => getWeekDate(surveyOpenHour)

  // Helper to check if a dish at a given index is count or percentage
  const getInputType = (d, m, idx) => {
    const key = `${d.toLowerCase()}_${m}`
    const config = dishInputConfig[key]
    return config?.[idx] || (m === 'lunch' && idx <= 3 ? 'count' : 'percentage')
  }

  const processDirectScan = async (userId) => {
    // Auto-fullscreen on scan — must be synchronous before any await to preserve user gesture
    document.documentElement.requestFullscreen().catch(() => {})
    try {
      const { data: u } = await supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle()
      if (!u) {
        alert('User not found!')
        return
      }
      
      const dayKey = day.substring(0, 3).toLowerCase()
      const mealKey = meal === 'lunch' ? 'l' : 'd'
      const weekId = surveyWeekId()
      
      const { data: row } = await supabase.from('survey_submissions_flat')
        .select('*').eq('user_id', userId).eq('week_id', weekId).maybeSingle()

      // Check for an active stop-thali request covering this day+meal
      const dayIdx = DAYS.indexOf(day)
      const trackingWeek = new Date(surveyWeekId() + 'T00:00:00')
      const selDate = new Date(trackingWeek)
      selDate.setDate(trackingWeek.getDate() + (dayIdx === -1 ? 0 : dayIdx))
      const selDateStr = toLocalDateStr(selDate)
      let isStopped = false
      let stopInfo = null
      try {
        const { data: stopReqs } = await supabase
          .from('thali_requests')
          .select('request_type, status, from_date, to_date, meal_type, created_at')
          .eq('user_id', userId)
          .in('request_type', ['stop'])
          .in('status', ['pending', 'approved'])
        const { data: resumeReqs } = await supabase
          .from('thali_requests')
          .select('request_type, status, from_date, to_date, meal_type, created_at')
          .eq('user_id', userId)
          .in('request_type', ['resume'])
          .in('status', ['pending', 'approved'])
        const allReqs = [
          ...(stopReqs || []).map(r => ({ ...r, kind: 'stop' })),
          ...(resumeReqs || []).map(r => ({ ...r, kind: 'resume' })),
        ]
        if (isStoppedOnDay(allReqs, selDateStr, meal)) {
          isStopped = true
          const info = pickStopInfo(allReqs, selDateStr, meal)
          stopInfo = { from_date: info?.from_date, to_date: info?.to_date, meal_type: info?.meal_type }
        }
      } catch (e) { console.warn(e) }
      
      const buildDishMap = (dayName, mealName, fallbackList) => {
        const mk = mealName === 'lunch' ? 'l' : 'd'
        const dishList = getSlotDishes(row, dayName, mealName, fallbackList)
        const result = {}
        result._status = row ? row[`${dayKey}_${mk}_status`] : null
        dishList.forEach((d, i) => {
          const val = row ? row[`${dayKey}_${mk}_dish_${i + 1}`] : null
          if (val !== undefined && val !== null && val !== '') {
            const rotiKw = ['roti', 'naan', 'paratha', 'bread', 'chapati', 'puri']
            if (rotiKw.some(k => d.toLowerCase().includes(k))) {
              result[d] = String(val).toLowerCase() === 'yes' ? 'yes' : 'no'
            } else {
              const lowerVal = String(val).toLowerCase()
              result[d] = lowerVal === 'yes' ? 'yes' : lowerVal === 'no' ? 'no' : val
            }
          } else {
            result[d] = null
          }
        })
        return result
      }

      const lunchMap = buildDishMap(day, 'lunch', weeklyMenu[day]?.lunch || [])
      const dinnerMap = buildDishMap(day, 'dinner', weeklyMenu[day]?.dinner || [])

      setSelectedUser({
        ...u,
        stopped: isStopped,
        stopInfo,
        status: isStopped ? 'Skipped' : lunchMap._status,
        dishResponses: buildDishMap(day, meal, weeklyMenu[day]?.[meal] || []),
        lunch: { status: isStopped ? 'Skipped' : lunchMap._status, dishes: lunchMap },
        dinner: { status: isStopped ? 'Skipped' : dinnerMap._status, dishes: dinnerMap },
        currentDay: day,
        currentMeal: meal
      })
    } catch (e) {
      console.error(e)
      alert('Error fetching user data: ' + e.message)
    }
  }

  // --- WIRELESS SCANNER SUPPORT ---
  useEffect(() => {
    let scanBuffer = ''
    let lastKeyTime = Date.now()

    const handleKeyDown = (e) => {
      const now = Date.now()
      if (now - lastKeyTime > 100) scanBuffer = ''
      lastKeyTime = now

      if (e.key === 'Enter') {
        if (scanBuffer.startsWith('ALMAWAID:')) {
          const userId = scanBuffer.split(':')[1]
          handleWirelessScan(userId)
          scanBuffer = ''
        }
      } else if (e.key.length === 1) {
        scanBuffer += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [day, meal, weeklyMenu])

  // Auto-switch meal & day based on time
  const advancedDayRef = useRef(null)
  useEffect(() => {
    const tick = () => {
      if (!mealOverride) {
        const autoMeal = getAutoMeal()
        if (autoMeal !== meal) setMeal(autoMeal)
      }
      // After 8 PM, advance day once per day
      const h = new Date().getHours()
      const todayStr = new Date().toDateString()
      if (h >= 20 && advancedDayRef.current !== todayStr) {
        const dayIdx = DAYS.indexOf(day)
        if (dayIdx !== -1) {
          advancedDayRef.current = todayStr
          setDay(DAYS[(dayIdx + 1) % DAYS.length])
        }
      }
      if (h < 20) advancedDayRef.current = null
    }
    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [meal, day, getAutoMeal, mealOverride])

  const handleWirelessScan = async (userId) => {
    await processDirectScan(userId)
  }

  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)
    
    try {
      // Auto-cleanup: delete submissions older than 1 week
      try {
        const currentWeek = surveyWeekId()
        const prevWeek = new Date(currentWeek)
        prevWeek.setDate(prevWeek.getDate() - 7)
        const cutoff = prevWeek.toISOString().split('T')[0]
        const { data: oldRows } = await supabase
          .from('survey_submissions_flat')
          .select('week_id').lt('week_id', cutoff)
        if (oldRows && oldRows.length) {
          const oldWeeks = [...new Set(oldRows.map(r => r.week_id))].filter(Boolean)
          for (const ow of oldWeeks) {
            await supabase.from('survey_submissions_flat').delete().eq('week_id', ow)
          }
        }
      } catch (e) { console.warn('Cleanup error:', e) }

      // Load dish input config
      const { data: settingsData } = await supabase.from('app_settings').select('*').eq('key', 'dish_input_config').maybeSingle()
      if (settingsData) {
        try { setDishInputConfig(JSON.parse(settingsData.value)) } catch {}
      }

      // Load configured survey open hour so the tracked week matches the survey window
      const { data: openHourRow } = await supabase.from('app_settings').select('value').eq('key', 'survey_open_hour').maybeSingle()
      if (openHourRow) {
        const h = parseInt(openHourRow.value, 10)
        if (!isNaN(h)) setSurveyOpenHour(h)
      }

      const { data: users, error: usersError } = await supabase
        .from('user_stats')
        .select('user_id, name, thali_number, email, avatar_url')
      if (usersError) throw usersError

      const { data: submissions, error: subsError } = await supabase
        .from('survey_submissions_flat')
        .select('*')
      if (subsError) throw subsError

      // Thali stop/stop requests — used to mark a member as "no thali" (stopped)
      const { data: stopRequests } = await supabase
        .from('thali_requests')
        .select('user_id, request_type, status, from_date, to_date, meal_type, created_at')
        .in('request_type', ['stop'])
        .in('status', ['pending', 'approved'])

      // Resume requests must override stops: if the member stopped but then
      // resumed within the same week, they should show as eating again.
      const { data: resumeRequests } = await supabase
        .from('thali_requests')
        .select('user_id, request_type, status, from_date, to_date, meal_type, created_at')
        .in('request_type', ['resume'])
        .in('status', ['pending', 'approved'])

      const dayIdx = DAYS.indexOf(day)
      const trackingWeek = new Date(surveyWeekId() + 'T00:00:00')
      const selDate = new Date(trackingWeek)
      selDate.setDate(trackingWeek.getDate() + (dayIdx === -1 ? 0 : dayIdx))
      const selDateStr = toLocalDateStr(selDate)

      // Per-user effective stop status covering the selected day+meal.
      // Combine stops and resumes into a per-user timeline ordered by created_at;
      // the MOST RECENT request that affects the day wins, and a dated stop only
      // stops the member inside [from_date, to_date] — after to_date the member
      // shows their real survey response again.
      const stoppedMap = {}
      const stoppedLunchMap = {}
      const stoppedDinnerMap = {}
      const allReqs = [
        ...(stopRequests || []).map(r => ({ ...r, kind: 'stop' })),
        ...(resumeRequests || []).map(r => ({ ...r, kind: 'resume' })),
      ]
      const reqByUser = {}
      ;(allReqs || []).forEach(sr => {
        if (!reqByUser[sr.user_id]) reqByUser[sr.user_id] = []
        reqByUser[sr.user_id].push(sr)
      })
      Object.entries(reqByUser || {}).forEach(([userId, reqs]) => {
        if (isStoppedOnDay(reqs, selDateStr, meal)) {
          const info = pickStopInfo(reqs, selDateStr, meal)
          stoppedMap[userId] = {
            stopped: true,
            meal_type: info?.meal_type,
            from_date: info?.from_date,
            to_date: info?.to_date,
          }
        }
        // Per-meal precision: track lunch/dinner stops separately so a lunch-only
        // stop never marks the member as skipped for dinner (and vice versa).
        if (isStoppedOnDay(reqs, selDateStr, 'lunch')) stoppedLunchMap[userId] = true
        if (isStoppedOnDay(reqs, selDateStr, 'dinner')) stoppedDinnerMap[userId] = true
      })

      setLoadError(null)

      // Merge submissions into user records
      const subMap = {}
      for (const s of submissions || []) {
        if (!subMap[s.user_id]) subMap[s.user_id] = []
        subMap[s.user_id].push(s)
      }
      const resultsRaw = (users || []).map(u => ({
        ...u,
        survey_submissions_flat: subMap[u.user_id] || []
      }))

      // Collect distinct week_ids for filter
      const allWeeks = [...new Set((submissions || []).map(s => s.week_id).filter(Boolean))].sort().reverse()
      setAvailableWeeks(allWeeks)
      
      const dayKey = day.substring(0, 3).toLowerCase()
      const mealKey = meal === 'lunch' ? 'l' : 'd'
      const statusKey = `${dayKey}_${mealKey}_status`
      
      const buildDishMap = (r, dayName, mealName, fallbackList) => {
        const mk = mealName === 'lunch' ? 'l' : 'd'
        const dishList = getSlotDishes(r, dayName, mealName, fallbackList)
        const result = {}
        result._status = r ? r[`${dayKey}_${mk}_status`] : null
        dishList.forEach((d, i) => {
          const val = r ? r[`${dayKey}_${mk}_dish_${i + 1}`] : null
          if (val !== undefined && val !== null && val !== '') {
            const rotiKw = ['roti', 'naan', 'paratha', 'bread', 'chapati', 'puri']
            if (rotiKw.some(k => d.toLowerCase().includes(k))) {
              result[d] = String(val).toLowerCase() === 'yes' ? 'yes' : 'no'
            } else {
              const lowerVal = String(val).toLowerCase()
              result[d] = lowerVal === 'yes' ? 'yes' : lowerVal === 'no' ? 'no' : val
            }
          } else {
            result[d] = null
          }
        })
        return result
      }

      const results = (resultsRaw || []).map(u => {
        const submissionData = Array.isArray(u.survey_submissions_flat) ? u.survey_submissions_flat : (u.survey_submissions_flat ? [u.survey_submissions_flat] : [])
        let resp
        if (weekFilter === 'all') {
          resp = submissionData.sort((a, b) => (b.week_id || '').localeCompare(a.week_id || ''))[0]
        } else {
          resp = submissionData.find(r => r.week_id === weekFilter)
        }
        const buildCurMeal = buildDishMap(resp, day, meal, weeklyMenu[day]?.[meal] || [])
        const buildLunch = buildDishMap(resp, day, 'lunch', weeklyMenu[day]?.lunch || [])
        const buildDinner = buildDishMap(resp, day, 'dinner', weeklyMenu[day]?.dinner || [])
        const stoppedInfo = stoppedMap[u.user_id]
        const isStopped = !!stoppedInfo
        const baseStatus = buildCurMeal._status
        return { 
          ...u, 
          stopped: isStopped,
          stopInfo: stoppedInfo || null,
          status: isStopped ? 'Skipped' : baseStatus,
          dishResponses: buildCurMeal,
          lunch: { status: stoppedLunchMap[u.user_id] ? 'Skipped' : buildLunch._status, dishes: buildLunch },
          dinner: { status: stoppedDinnerMap[u.user_id] ? 'Skipped' : buildDinner._status, dishes: buildDinner },
          currentDay: day,
          currentMeal: meal,
          week_id: resp ? resp.week_id : null,
          updated_at: resp ? resp.updated_at : null 
        }
      })
      
      setUsers(results)
    } catch (e) {
      console.error('DailySurveyTracking load error:', e)
      setLoadError(e?.message || 'Failed to load survey tracking data')
    }
    setLoading(false)
    setRefreshing(false)
  }, [day, meal, weeklyMenu, weekFilter])

  useEffect(() => {
    load()

    // REALTIME SUBSCRIPTION
    const surveySub = supabase
      .channel('survey_tracking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_submissions_flat' }, () => {
        load(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(surveySub)
    }
  }, [load])

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
          await processDirectScan(userId);
        }
      };

      scanner.render((text) => handleScan(text).catch(e => console.error('Scan handler error:', e)), (error) => {});
      return () => {
        scanner.clear().catch(e => console.error("Scanner cleanup failed", e));
      };
    }
  }, [isScanning, day, meal, weeklyMenu])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter(u => 
      (u.name || '').toLowerCase().includes(q) || 
      String(u.thali_number || '').includes(q)
    )
  }, [users, search])

  const yesMembers = filtered.filter(u => u.status === 'Applied')
  const noMembers = filtered.filter(u => u.status === 'Skipped')
  const noResponse = filtered.filter(u => !u.status)

  const dishStats = {}
  const menuDishes = weeklyMenu[day]?.[meal] || []
  menuDishes.forEach(dish => {
    dishStats[dish] = { total: 0, count: 0, yesNoCount: 0, yesCount: 0, isCount: false, isPct: false }
  })
  yesMembers.forEach(u => {
    Object.entries(u.dishResponses || {}).forEach(([dish, val]) => {
      if (!dishStats[dish]) dishStats[dish] = { total: 0, count: 0, yesNoCount: 0, yesCount: 0, isCount: false, isPct: false }
      if (val === 'yes' || val === 'no') {
        dishStats[dish].yesNoCount++
        if (val === 'yes') dishStats[dish].yesCount++
      } else if (typeof val === 'string' && val.endsWith('%')) {
        dishStats[dish].count++
        dishStats[dish].total += (parseInt(val) || 0)
        dishStats[dish].isPct = true
      } else {
        dishStats[dish].count++
        dishStats[dish].total += (parseInt(val) || 0)
        dishStats[dish].isCount = true
      }
    })
  })

  if (loading && users.length === 0) return <Spinner />

  return (
    <PageWrap>
      <div className="tracker-dashboard">
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
          <PageTitle style={{ margin: 0 }}>Daily Survey Tracker</PageTitle>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="primary" onClick={() => setIsScanning(true)}>
              <Scan size={16} /> Scan Tiffin
            </Btn>
            <Btn variant="outline" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
              {refreshing ? 'Syncing...' : 'Sync Now'}
            </Btn>
          </div>
        </div>

        {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

        {/* Day, Meal, Search & Sleek Dish Percentages Capsule Row */}
        <div style={{ 
          display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', 
          alignItems: 'center', background: 'rgba(212, 175, 55, 0.03)', 
          padding: '8px 16px', borderRadius: 20, border: `1px solid ${T.border}`
        }}>
          {/* Day Filters */}
          <div style={{ display: 'flex', background: T.inputBg, padding: 3, borderRadius: 12, border: `1px solid ${T.border}`, overflowX: 'auto' }}>
            {DAYS.map(d => (
              <button key={d} onClick={() => setDay(d)}
                style={{ 
                  flexShrink: 0, padding: '6px 12px', borderRadius: 8, border: 'none', 
                  background: day === d ? T.accentGrad : 'transparent', 
                  color: day === d ? '#fff' : T.textSub, 
                  fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: '0.2s' 
                }}>
                {d.charAt(0).toUpperCase() + d.slice(1, 3)}
              </button>
            ))}
          </div>

          {/* Meal Filters */}
          <div style={{ display: 'flex', background: T.inputBg, padding: 3, borderRadius: 12, border: `1px solid ${T.border}` }}>
            {['lunch', 'dinner'].map(m => (
              <button key={m} onClick={() => { setMeal(m); setMealOverride(true) }}
                style={{ 
                  padding: '6px 12px', borderRadius: 8, border: 'none', 
                  background: meal === m ? (m === 'lunch' ? T.accentGrad : '#5e9ce0') : 'transparent', 
                  color: meal === m ? '#fff' : T.textSub, 
                  fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: '0.2s' 
                }}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Week Filter */}
          <select value={weekFilter} onChange={e => setWeekFilter(e.target.value)} name="weekFilter"
            style={{ padding: '6px 12px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.border}`, color: T.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none' }}>
            <option value="all">Latest Week</option>
            {availableWeeks.map(w => (
              <option key={w} value={w}>{new Date(w + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</option>
            ))}
          </select>
          
          {/* Search Bar */}
          <div style={{ flex: '1 1 200px', position: 'relative' }}>
            <Search size={14} color={T.textSub} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input 
              name="searchTracking"
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search thali or name..."
              style={{ 
                width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 32px', 
                borderRadius: 10, background: T.inputBg, border: `1px solid ${T.inputBorder}`, 
                color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' 
              }}
            />
          </div>

          {/* Inline Dish Stats Strip - shows total piece counts */}
          {Object.keys(dishStats).length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: T.textSub, letterSpacing: '0.05em', textTransform: 'uppercase', marginRight: 4 }}>Totals:</div>
              {Object.entries(dishStats).map(([dish, stat]) => {
                const isYesNo = stat.yesNoCount > 0
                const avgPct = stat.isPct && stat.count ? Math.round(stat.total / stat.count) : null
                const displayVal = isYesNo
                  ? `${stat.yesCount}/${stat.yesNoCount}`
                  : (stat.isCount ? stat.total : (stat.count ? Math.round(stat.total / stat.count) : 0))
                const unit = isYesNo ? 'yes' : (stat.isCount ? `person${stat.total === 1 ? '' : 's'}` : '%')
                const statColor = avgPct !== null ? getPctColor(avgPct) : (isYesNo && stat.yesNoCount > 0 ? (stat.yesCount / stat.yesNoCount >= 0.5 ? '#4CAF50' : '#F44336') : T.accent)

                return (
                  <div key={dish} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: T.inputBg, padding: '5px 10px',
                    borderRadius: 10, border: `1px solid ${statColor ? `${statColor}40` : T.border}`
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.textSub, textTransform: 'uppercase' }}>{dish}</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: statColor || T.accent }}>{displayVal}<span style={{ fontSize: 9, fontWeight: 700, color: T.textSub, marginLeft: 2 }}>{unit}</span></span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 3-Column Side-By-Side Flex Layout */}
        <div className="tracker-row">
          {/* YES Column */}
          <div className="tracker-col">
            <AdminCard className="col-card" style={{ borderTop: `4px solid ${T.success}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <SectionHeader style={{ margin: 0, fontSize: 13 }}>✅ YES THALI ({yesMembers.length})</SectionHeader>
                <Badge color={T.success} style={{ padding: '2px 8px' }}>Applied</Badge>
              </div>
              <div className="col-body">
                {yesMembers.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: T.textSub, fontSize: 12 }}>No one has applied yet.</div>
                ) : yesMembers.map(u => (
                  <MemberRow key={u.user_id} user={u} onClick={() => { document.documentElement.requestFullscreen().catch(() => {}); setSelectedUser(u) }} />
                ))}
              </div>
            </AdminCard>
          </div>

          {/* NO Column */}
          <div className="tracker-col">
            <AdminCard className="col-card" style={{ borderTop: `4px solid ${T.danger}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <SectionHeader style={{ margin: 0, fontSize: 13 }}>❌ NO THALI ({noMembers.length})</SectionHeader>
                <Badge color={T.danger} style={{ padding: '2px 8px' }}>Skipped</Badge>
              </div>
              <div className="col-body">
                {noMembers.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: T.textSub, fontSize: 12 }}>No opt-outs yet.</div>
                ) : noMembers.map(u => (
                  <MemberRow key={u.user_id} user={u} onClick={() => { document.documentElement.requestFullscreen().catch(() => {}); setSelectedUser(u) }} />
                ))}
              </div>
            </AdminCard>
          </div>

          {/* NO RESPONSE Column */}
          <div className="tracker-col">
            <AdminCard className="col-card" style={{ borderTop: `4px solid var(--text-tertiary)` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <SectionHeader style={{ margin: 0, fontSize: 13 }}>⌛ PENDING RESPONSE ({noResponse.length})</SectionHeader>
                <Badge color="var(--text-tertiary)" style={{ padding: '2px 8px' }}>Pending</Badge>
              </div>
              <div className="col-body">
                {noResponse.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: T.textSub, fontSize: 12 }}>All users have responded!</div>
                ) : noResponse.map(u => (
                  <PendingMemberRow key={u.user_id} user={u} onClick={() => { document.documentElement.requestFullscreen().catch(() => {}); setSelectedUser(u) }} />
                ))}
              </div>
            </AdminCard>
          </div>
        </div>
      </div>

      {/* CSS Styles injection for viewport height side-by-side dashboard */}
      <style>{`
        .tracker-dashboard {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 200px);
          min-height: 480px;
          box-sizing: border-box;
          overflow: hidden;
        }
        .tracker-row {
          display: flex;
          gap: 16px;
          flex: 1;
          min-height: 0;
          width: 100%;
        }
        .tracker-col {
          flex: 1;
          min-width: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .col-card {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          padding: 16px !important;
          box-sizing: border-box;
          overflow: hidden;
        }
        .col-body {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-right: 4px;
        }
        /* Custom sleek scrollbars for independent columns */
        .col-body::-webkit-scrollbar {
          width: 5px;
        }
        .col-body::-webkit-scrollbar-track {
          background: transparent;
        }
        .col-body::-webkit-scrollbar-thumb {
          background: rgba(212, 175, 55, 0.2);
          border-radius: 4px;
        }
        .col-body::-webkit-scrollbar-thumb:hover {
          background: rgba(212, 175, 55, 0.4);
        }
        .spin { animation: spin 1s linear infinite } 
        @keyframes spin { to { transform: rotate(360deg) } }

        @media (max-width: 768px) {
          .tracker-dashboard {
            height: auto;
            overflow: visible;
          }
          .tracker-row {
            flex-direction: column;
            height: auto;
          }
          .tracker-col {
            height: 450px;
            margin-bottom: 16px;
          }
        }
      `}</style>

      {/* QR Scanner Modal */}
      {isScanning && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
          zIndex: 3000, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
            <button 
              onClick={() => setIsScanning(false)}
              style={{ position: 'absolute', top: -50, right: 0, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={32} />
            </button>
            <AdminCard style={{ padding: 10, background: '#fff' }}>
              <div id="qr-reader" style={{ width: '100%' }}></div>
            </AdminCard>
            <p style={{ color: '#fff', textAlign: 'center', marginTop: 20, fontWeight: 600 }}>
              Scan Tiffin QR Code
            </p>
          </div>
        </div>
      )}

      {/* Packing Station TV View (Pop-up) */}
      {selectedUser && (
        <PackingTVView 
          user={selectedUser} 
          meal={meal}
          day={day} 
          onClose={() => setSelectedUser(null)}
        />
      )}

      <style>{`.spin { animation: spin 1s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </PageWrap>
  )
}

function PendingMemberRow({ user, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        padding: '16px 22px', borderRadius: 14, background: T.inputBg, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', gap: 14, fontSize: 15, color: T.textSub,
        cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = T.accent;
        e.currentTarget.style.background = T.cardHover;
        e.currentTarget.style.transform = 'translateX(4px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.border;
        e.currentTarget.style.background = T.inputBg;
        e.currentTarget.style.transform = 'translateX(0)';
      }}
    >
      <div style={{ 
        width: 24, height: 24, borderRadius: 8, background: 'rgba(212,175,55,0.08)', 
        border: '1px solid rgba(212,175,55,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 900, color: '#ffffff',
        textShadow: '0 0 8px rgba(212,175,55,0.3)'
      }}>
        #{user.thali_number}
      </div>
      <div style={{ fontWeight: 600, color: '#ffffff', textShadow: '0 0 6px rgba(255,255,255,0.08)' }}>{user.name}</div>
      <ChevronRight size={18} color={T.textSub} style={{ marginLeft: 'auto' }} />
    </div>
  )
}

function MemberRow({ user, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        padding: '18px 24px', borderRadius: 16, background: T.inputBg, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = T.accent;
        e.currentTarget.style.background = T.cardHover;
        e.currentTarget.style.transform = 'translateX(4px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.border;
        e.currentTarget.style.background = T.inputBg;
        e.currentTarget.style.transform = 'translateX(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 8,
          background: user.stopped ? 'rgba(239,68,68,0.15)' : 'rgba(212,175,55,0.1)',
          border: `1px solid ${user.stopped ? 'rgba(239,68,68,0.45)' : 'rgba(212,175,55,0.35)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 900, color: '#ffffff',
          textShadow: '0 0 8px rgba(212,175,55,0.3)'
        }}>
          #{user.thali_number}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#ffffff', textShadow: '0 0 6px rgba(255,255,255,0.08)' }}>{user.name}</div>
          {user.stopped ? (
            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 800, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ⏹️ STOP THALI{user.stopInfo?.from_date ? ` · ${user.stopInfo.from_date}` + (user.stopInfo.to_date && user.stopInfo.to_date !== user.stopInfo.from_date ? ` → ${user.stopInfo.to_date}` : '') : ''}
            </div>
          ) : user.updated_at && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500, marginTop: 2, opacity: 0.7 }}>
              📅 {new Date(user.updated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
      <ChevronRight size={18} color={T.textSub} />
    </div>
  )
}
