// src/admin/DailySurveyTracking.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/firebaseClient'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { 
  Search, RefreshCw, ChevronRight, Check, X, Filter, 
  Calendar, Utensils, User as UserIcon, Clock, ChevronDown, ChevronUp, Scan, Trash2,
  Tv, Sparkles, CheckCircle2, XCircle, ArrowUpRight
} from 'lucide-react'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'
import { 
  T, PageWrap, PageTitle, AdminCard, Badge, Btn, Spinner, Grid,
  SectionHeader, Modal, PackingTVView, ErrorBanner, SrBadge
} from './ui'

import { 
  getSurveyTargetWeek, getCalendarWeekDate,
  DAYS, toLocalDateStr, isStoppedOnDay, parseDishArray,
  getSurveyTargetWeeks, formatWeekRange, formatWeekShort,
  getCurrentMealByTime, resolveTrackerWeekId
} from '../common/utils'
import { getPctColor, isRotiItem, isCountInput } from '../hooks/useSurvey'
import { fetchUserSurveyRow, fetchAllUserRows, flattenDayRows, buildMealDishMap, fetchWeekRows, fetchLatestUserSurveyRow } from '../lib/surveyRows'
import { resolveScannedUser, extractScanTarget, cleanThaliComparable } from './scanParser'
import { playScanSound } from './scanAudio'

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
  const [appSettings, setAppSettings] = useState({})
  const surveyWeekId = useCallback(() => getSurveyTargetWeek(appSettings), [appSettings])
  const targetWeek = useMemo(() => getSurveyTargetWeek(appSettings), [appSettings])
  const weeklyMenu = useWeeklyMenu(targetWeek) || {}
  const [searchParams] = useSearchParams()
  const urlMeal = searchParams.get('meal')
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState(() => {
    const now = new Date()
    const d = now.getDay()
    const mins = now.getHours() * 60 + now.getMinutes()
    // After 7 PM (19:00), dinner is finished; kitchen packs next day's lunch
    let effectiveDayIdx = (mins >= 19 * 60) ? (d + 1) % 7 : d
    if (effectiveDayIdx === 0) effectiveDayIdx = 1 
    return ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][effectiveDayIdx]
  })
  const getAutoMeal = useCallback(() => getCurrentMealByTime(), [])
  const [meal, setMeal] = useState(() => {
    if (urlMeal === 'lunch' || urlMeal === 'dinner') return urlMeal
    return getAutoMeal()
  })
  const [mealOverride, setMealOverride] = useState(false)
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState([])
  const usersRef = useRef([])
  const lastScanRef = useRef({ id: '', time: 0 })
  useEffect(() => {
    usersRef.current = users
  }, [users])

  const [selectedUser, setSelectedUser] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isScanning, setIsScanning] = useState(() => searchParams.get('scan') === 'true')
  useEffect(() => {
    const scanVal = searchParams.get('scan')
    const tvVal = searchParams.get('tv')
    if (scanVal === 'true') {
      setIsScanning(true)
    } else if (scanVal) {
      processDirectScan(scanVal)
    } else if (tvVal === 'true' && !selectedUser) {
      if (usersRef.current && usersRef.current.length > 0) {
        setSelectedUser(usersRef.current[0])
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('tv') === 'true' && !selectedUser && users.length > 0) {
      setSelectedUser(users[0])
    }
  }, [searchParams, users])
  const [weekFilter, setWeekFilter] = useState('all')
  const [availableWeeks, setAvailableWeeks] = useState([])
  const [dishInputConfig, setDishInputConfig] = useState({})
  const [mobileColTab, setMobileColTab] = useState('yes')
  // Menu resolved for the week that owns the selected day (calendar vs target)
  const [displayMenu, setDisplayMenu] = useState({})

  // Helper to check if a dish at a given index is count or percentage
  const getInputType = (d, m, idx) => {
    const key = `${d.toLowerCase()}_${m}`
    const config = dishInputConfig[key]
    return config?.[idx] || (m === 'lunch' && idx <= 3 ? 'count' : 'percentage')
  }

  const processDirectScan = async (rawInput) => {
    // Auto-fullscreen on scan — must be synchronous before any await to preserve user gesture
    document.documentElement.requestFullscreen().catch(() => {})
    try {
      if (!rawInput) return

      const targetStr = String(rawInput).trim()

      // Debounce duplicate scans within 1.2 seconds
      const now = Date.now()
      if (lastScanRef.current.id === targetStr && (now - lastScanRef.current.time) < 1200) {
        return
      }
      lastScanRef.current = { id: targetStr, time: now }

      const u = await resolveScannedUser(rawInput, usersRef.current || [])
      if (!u) {
        playScanSound('skip')
        alert('Member not found for scan: ' + targetStr)
        return
      }

      // 1. FAST PATH: Check if user is already loaded in the tracker table
      const compThali = cleanThaliComparable(u.thali_number || '')
      const compUserId = cleanThaliComparable(u.user_id || u.id || '')
      const cached = (usersRef.current || []).find(x => {
        if (!x) return false
        if (x.user_id && u.user_id && String(x.user_id).trim().toLowerCase() === String(u.user_id).trim().toLowerCase()) return true
        if (x.id && u.id && String(x.id).trim().toLowerCase() === String(u.id).trim().toLowerCase()) return true
        if (x.thali_number && u.thali_number && cleanThaliComparable(x.thali_number) === compThali) return true
        if (compUserId && x.user_id && cleanThaliComparable(x.user_id) === compUserId) return true
        return false
      })

      if (cached) {
        playScanSound(cached.status === 'Applied' ? 'proceed' : 'neutral')
        setSelectedUser(cached)
        return
      }

      const targetUserId = u.user_id || u.id
      const dayKey = day.substring(0, 3).toLowerCase()
      const mealKey = meal === 'lunch' ? 'l' : 'd'
      const statusKey = `${dayKey}_${mealKey}_status`

      // Same algorithm as the list loader — a scan can never disagree with
      // the on-screen columns about which week a day belongs to.
      const activeWeekId = resolveTrackerWeekId(appSettings, weekFilter)

      // Fetch survey row for this user in activeWeekId
      let row = {}
      const safeThali = cleanThaliComparable(u.thali_number || '')
      try {
        let query = supabase
          .from('survey_day_responses')
          .select('*')
          .eq('week_id', activeWeekId)

        if (targetUserId && safeThali) {
          query = query.or(`user_id.eq.${targetUserId},thali_number.eq.${safeThali}`)
        } else if (targetUserId) {
          query = query.eq('user_id', targetUserId)
        } else if (safeThali) {
          query = query.eq('thali_number', safeThali)
        }

        const { data: dayRows } = await query

        if (dayRows && dayRows.length > 0) {
          const flats = flattenDayRows(dayRows)
          row = flats[0] || {}
        }
      } catch (e) {
        console.warn('[processDirectScan] error fetching dayRows:', e)
      }

      if (!row || !row[statusKey]) {
        try {
          const { data: single } = await fetchUserSurveyRow(targetUserId, activeWeekId)
          if (single) row = single
        } catch { /* fallback row lookup is best-effort */ }
      }

      if (!row || !row[statusKey]) {
        try {
          const { data: latest } = await fetchLatestUserSurveyRow(targetUserId)
          if (latest) row = latest
        } catch { /* fallback latest lookup is best-effort */ }
      }

      const resolvedWeekId = activeWeekId

      // Check for an active stop-thali request covering this day+meal
      const dayIdx = DAYS.indexOf(day)
      const trackingWeek = new Date(resolvedWeekId + 'T00:00:00')
      const selDate = new Date(trackingWeek)
      selDate.setDate(trackingWeek.getDate() + (dayIdx === -1 ? 0 : dayIdx))
      const selDateStr = toLocalDateStr(selDate)
      let isStopped = false
      let stopInfo = null
      let isStoppedLunch = false
      let isStoppedDinner = false

      try {
        const { data: stopReqs } = await supabase
          .from('thali_requests')
          .select('request_type, status, from_date, to_date, meal_type, created_at')
          .eq('user_id', targetUserId)
          .in('request_type', ['stop'])
          .in('status', ['pending', 'approved'])
        const { data: resumeReqs } = await supabase
          .from('thali_requests')
          .select('request_type, status, from_date, to_date, meal_type, created_at')
          .eq('user_id', targetUserId)
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
        isStoppedLunch = isStoppedOnDay(allReqs, selDateStr, 'lunch')
        isStoppedDinner = isStoppedOnDay(allReqs, selDateStr, 'dinner')
      } catch (e) { console.warn(e) }

      // Fetch fresh weekly menu specifically for resolvedWeekId
      let freshMenu = {}
      try {
        const { data: menuRows } = await supabase.from('weekly_menu').select('day_name,lunch,dinner').eq('week_start', resolvedWeekId)
        ;(menuRows || []).forEach(r => {
          const k = String(r.day_name || '').toLowerCase()
          freshMenu[k] = {
            lunch: parseDishArray(r.lunch),
            dinner: parseDishArray(r.dinner),
          }
        })
      } catch { /* menu fetch is best-effort; scan falls back to cached menus */ }
      const dayNameLower = day.toLowerCase()
      let dayMenu = freshMenu[dayNameLower] || (weeklyMenu.__byWeek?.[resolvedWeekId]?.[dayNameLower]) || displayMenu[dayNameLower] || weeklyMenu[dayNameLower] || weeklyMenu[day] || {}

      // Fallback: if dayMenu is missing lunch or dinner, query latest menu for this day_name
      if (!dayMenu.lunch?.length || !dayMenu.dinner?.length) {
        try {
          const { data: fallbackRows } = await supabase
            .from('weekly_menu')
            .select('day_name,lunch,dinner')
            .ilike('day_name', dayNameLower)
            .order('created_at', { ascending: false })
            .limit(1)
          if (fallbackRows && fallbackRows.length > 0) {
            dayMenu = {
              lunch: dayMenu.lunch?.length ? dayMenu.lunch : parseDishArray(fallbackRows[0].lunch),
              dinner: dayMenu.dinner?.length ? dayMenu.dinner : parseDishArray(fallbackRows[0].dinner),
            }
          }
        } catch { /* ignore fallback error */ }
      }

      const scanBuildDishMap = (mealName, menuList) =>
        buildMealDishMap(row, day, mealName, menuList, isRotiItem)

      const lunchMap = scanBuildDishMap('lunch', dayMenu.lunch || [])
      const dinnerMap = scanBuildDishMap('dinner', dayMenu.dinner || [])
      const curMealMap = meal === 'lunch' ? lunchMap : dinnerMap

      const buildDishTypes = (mealName, menuList, dishMap) => {
        const types = {}
        const list = Array.isArray(menuList) ? menuList.filter(Boolean) : []
        Object.keys(dishMap).filter(k => k !== '_status').forEach((d, idx) => {
          if (isRotiItem(d)) { types[d] = 'roti'; return }
          let pos = list.indexOf(d)
          if (pos === -1) pos = idx
          types[d] = (getInputType(day, mealName, pos) === 'count' || isCountInput(appSettings, day, mealName, pos)) ? 'count' : 'percentage'
        })
        return types
      }

      const lunchTypes = buildDishTypes('lunch', dayMenu.lunch || [], lunchMap)
      const dinnerTypes = buildDishTypes('dinner', dayMenu.dinner || [], dinnerMap)
      const curTypes = meal === 'lunch' ? lunchTypes : dinnerTypes

      const curStatus = isStopped ? 'Skipped' : curMealMap._status

      setSelectedUser({
        ...u,
        week_id: resolvedWeekId,
        week_range: formatWeekRange(resolvedWeekId),
        stopped: isStopped,
        stopInfo,
        status: curStatus,
        dishResponses: curMealMap,
        dishTypes: curTypes,
        lunch: { status: isStoppedLunch ? 'Skipped' : lunchMap._status, dishes: lunchMap, dishTypes: lunchTypes },
        dinner: { status: isStoppedDinner ? 'Skipped' : dinnerMap._status, dishes: dinnerMap, dishTypes: dinnerTypes },
        currentDay: day,
        currentMeal: meal
      })
    } catch (e) {
      console.error(e)
      alert('Error fetching user data: ' + e.message)
    }
  }

  // --- WIRELESS & USB HARDWARE SCANNER SUPPORT ---
  const scanBufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const processDirectScanRef = useRef(processDirectScan)
  useEffect(() => {
    processDirectScanRef.current = processDirectScan
  })

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      const now = Date.now()
      if (now - lastKeyTimeRef.current > 180) {
        scanBufferRef.current = ''
      }
      lastKeyTimeRef.current = now

      if (e.key === 'Enter') {
        const text = scanBufferRef.current.trim()
        scanBufferRef.current = ''
        if (text && text.length >= 1) {
          e.preventDefault()
          processDirectScanRef.current?.(text)
        }
      } else if (e.key.length === 1) {
        scanBufferRef.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-switch meal & day based on time
  const advancedDayRef = useRef(null)
  useEffect(() => {
    const tick = () => {
      if (!mealOverride) {
        const autoMeal = getAutoMeal()
        if (autoMeal !== meal) setMeal(autoMeal)
      }
      // After 7 PM (19:00), advance day once per day
      const now = new Date()
      const mins = now.getHours() * 60 + now.getMinutes()
      const todayStr = now.toDateString()
      if (mins >= 19 * 60 && advancedDayRef.current !== todayStr) {
        const dayIdx = DAYS.indexOf(day)
        if (dayIdx !== -1) {
          advancedDayRef.current = todayStr
          setDay(DAYS[(dayIdx + 1) % DAYS.length])
        }
      }
      if (mins < 19 * 60) advancedDayRef.current = null
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
      // Load app settings (dish input config, survey open hour, status, user overrides)
      const { data: allSettings } = await supabase.from('app_settings').select('*')
      const settingsMap = {}
      ;(allSettings || []).forEach(r => { if (r && r.key) settingsMap[r.key] = r.value })

      if (settingsMap.dish_input_config) {
        try { setDishInputConfig(JSON.parse(settingsMap.dish_input_config)) } catch { /* ignore malformed dish input config */ }
      }

      setAppSettings(prev => JSON.stringify(prev) === JSON.stringify(settingsMap) ? prev : settingsMap)

      const { data: users, error: usersError } = await supabase
        .from('user_stats')
        .select('user_id, name, thali_number, email, avatar_url')
      if (usersError) throw usersError

      // Load ALL merged survey rows (per user+week: live day rows first,
      // legacy flat mirror as the fallback for historical weeks).
      const { data: allRowsData, error: subsError } = await fetchAllUserRows()
      if (subsError) throw subsError
      const allRows = allRowsData || []

      // Collect distinct week_ids for filter
      const targetWeeksList = getSurveyTargetWeeks(settingsMap)
      const cal = getCalendarWeekDate()
      const effectiveWeek = resolveTrackerWeekId(settingsMap, weekFilter)

      // Ensure effectiveWeek rows are explicitly loaded so nothing is truncated by limits:
      try {
        const { data: effectiveWeekRows } = await fetchWeekRows(effectiveWeek)
        if (effectiveWeekRows && effectiveWeekRows.length > 0) {
          effectiveWeekRows.forEach(ew => {
            const idx = allRows.findIndex(r => r.week_id === ew.week_id && (
              (r.user_id && ew.user_id && String(r.user_id).trim() === String(ew.user_id).trim()) ||
              (r.thali_number && ew.thali_number && String(r.thali_number).trim() === String(ew.thali_number).trim())
            ))
            if (idx >= 0) {
              allRows[idx] = { ...allRows[idx], ...ew }
            } else {
              allRows.unshift(ew)
            }
          })
        }
      } catch (err) {
        console.warn('Error fetching effectiveWeek rows:', err)
      }

      const allWeeks = [...new Set([
        ...targetWeeksList,
        cal,
        ...(allRows || []).map(s => s.week_id).filter(Boolean)
      ])].filter(Boolean).sort().reverse()
      setAvailableWeeks(allWeeks)

      // Thali stop/resume requests — used to mark a member as "no thali" (stopped)
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
      const trackingWeek = new Date(effectiveWeek + 'T00:00:00')
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

      const buildDishMap = (r, dayName, mealName, menuList) =>
        buildMealDishMap(r, dayName || day, mealName, menuList, isRotiItem)

      // Resolve the menus for all target weeks & candidate weeks
      const weekMenusMap = {}
      try {
        const { data: menuRows, error: menuErr } = await supabase
          .from('weekly_menu')
          .select('day_name,lunch,dinner,week_start')
          .in('week_start', allWeeks)
        if (!menuErr && menuRows && menuRows.length) {
          menuRows.forEach(r => {
            const ws = r.week_start || effectiveWeek
            if (!weekMenusMap[ws]) weekMenusMap[ws] = {}
            const k = String(r.day_name || '').toLowerCase()
            weekMenusMap[ws][k] = {
              lunch: parseDishArray(r.lunch),
              dinner: parseDishArray(r.dinner),
            }
          })
        }
      } catch { /* menu load is best-effort; fall back to cached menus */ }

      const activeDisplayMenu = weekMenusMap[effectiveWeek] || (weeklyMenu.__byWeek?.[effectiveWeek]) || weeklyMenu || {}
      setDisplayMenu(activeDisplayMenu)

      const cleanThali = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '')

      const matchUserRow = (r, u) => {
        if (!r || !u) return false
        if (r.user_id && u.user_id && String(r.user_id).trim() === String(u.user_id).trim()) return true
        if (r.thali_number && u.thali_number) {
          const ctR = cleanThali(r.thali_number)
          const ctU = cleanThali(u.thali_number)
          if (ctR && ctU && ctR === ctU) return true
        }
        if (r.user_id && u.thali_number && cleanThali(r.user_id) === cleanThali(u.thali_number)) return true
        if (u.user_id && r.thali_number && cleanThali(u.user_id) === cleanThali(r.thali_number)) return true
        if (r.email && u.email && r.email.toLowerCase().trim() === u.email.toLowerCase().trim()) return true
        return false
      }

      const results = (users || []).map(u => {
        const candidates = (allRows || []).filter(r => matchUserRow(r, u))

        // Match responses for the active effectiveWeek; fallback to latest candidate response if any
        let resp = candidates.find(r => r.week_id === effectiveWeek)
        if (!resp && candidates.length > 0) {
          resp = candidates[0]
        }
        if (!resp) resp = {}

        const userWeekId = effectiveWeek
        const userWeekMenu = weekMenusMap[userWeekId] || (weeklyMenu.__byWeek?.[userWeekId]) || activeDisplayMenu || {}
        const dayKeyLower = day.toLowerCase()
        const dayMenu = userWeekMenu[dayKeyLower] || userWeekMenu[day] || activeDisplayMenu[dayKeyLower] || {}
        const buildCurMeal = buildDishMap(resp, day, meal, dayMenu[meal] || [])
        const buildLunch = buildDishMap(resp, day, 'lunch', dayMenu.lunch || [])
        const buildDinner = buildDishMap(resp, day, 'dinner', dayMenu.dinner || [])
        const stoppedInfo = stoppedMap[u.user_id]
        const isStopped = !!stoppedInfo
        const baseStatus = buildCurMeal._status
        const dayKey = day.substring(0, 3).toLowerCase()
        const mealKey = meal === 'lunch' ? 'l' : 'd'
        const isOverride = (resp && (resp._isOverride || resp.edit_metadata?.[`${dayKey}_${mealKey}_override`]))
        // Per-dish COUNT vs PORTION map from the tracker's menu order, so the
        // TV popup never guesses the type from the value or grid position.
        const typesFor = (mealName, menuList) => {
          const types = {}
          const list = Array.isArray(menuList) ? menuList.filter(Boolean) : []
          const dishMap = mealName === 'lunch' ? buildLunch : mealName === 'dinner' ? buildDinner : buildCurMeal
          Object.keys(dishMap).filter(k => k !== '_status').forEach((d, idx) => {
            if (isRotiItem(d)) { types[d] = 'roti'; return }
            let pos = list.indexOf(d)
            if (pos === -1) pos = idx
            types[d] = (getInputType(day, mealName, pos) === 'count' || isCountInput(settingsMap, day, mealName, pos)) ? 'count' : 'percentage'
          })
          return types
        }
        const lunchTypes = typesFor('lunch', dayMenu.lunch || [])
        const dinnerTypes = typesFor('dinner', dayMenu.dinner || [])
        const curTypes = meal === 'lunch' ? lunchTypes : dinnerTypes
        return { 
          ...u, 
          _isOverride: !!isOverride,
          stopped: isStopped,
          stopInfo: stoppedInfo || null,
          status: isStopped ? 'Skipped' : baseStatus,
          dishResponses: buildCurMeal,
          dishTypes: curTypes,
          lunch: { status: stoppedLunchMap[u.user_id] ? 'Skipped' : buildLunch._status, dishes: buildLunch, dishTypes: lunchTypes },
          dinner: { status: stoppedDinnerMap[u.user_id] ? 'Skipped' : buildDinner._status, dishes: buildDinner, dishTypes: dinnerTypes },
          currentDay: day,
          currentMeal: meal,
          week_id: userWeekId,
          week_range: formatWeekRange(userWeekId),
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

    // REALTIME SUBSCRIPTION — watch tables so saves appear live
    const surveySub = supabase
      .channel('daily-survey-tracking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_day_responses' }, () => {
        load(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_menu' }, () => {
        load(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
        load(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(surveySub)
    }
  }, [load])

  useEffect(() => {
    if (!isScanning) return
    let scanner = null
    let isCancelled = false

    const timer = setTimeout(() => {
      if (isCancelled) return
      const el = document.getElementById("qr-reader")
      if (!el) return

      try {
        scanner = new Html5QrcodeScanner("qr-reader", {
          fps: 10,
          qrbox: 250,
          supportedScanTypes: [
            Html5QrcodeScanType.SCAN_TYPE_CAMERA,
            Html5QrcodeScanType.SCAN_TYPE_FILE
          ],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        })

        const handleScan = async (decodedText) => {
          if (!decodedText) return
          try {
            await scanner?.clear()
          } catch (e) {
            console.warn("Failed to clear scanner", e)
          }
          setIsScanning(false)
          await processDirectScan(decodedText)
        }

        scanner.render((text) => handleScan(text).catch(e => console.error('Scan handler error:', e)), () => {})
      } catch (err) {
        console.warn('QR scanner initialization deferred:', err)
      }
    }, 80)

    return () => {
      isCancelled = true
      clearTimeout(timer)
      if (scanner) {
        try { scanner.clear().catch(() => {}) } catch {}
      }
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

  const menuDishes = displayMenu[day]?.[meal] || weeklyMenu[day]?.[meal] || []
  const dishStats = {}

  // Initialize for all dishes in today's menu
  menuDishes.forEach((dish, idx) => {
    const isRoti = isRotiItem(dish)
    const isCount = !isRoti && (getInputType(day, meal, idx) === 'count' || isCountInput(appSettings, day, meal, idx))
    dishStats[dish] = {
      dish,
      isRoti,
      isCount,
      isPct: !isRoti && !isCount,
      yesCount: 0,
      noCount: 0,
      totalCount: 0,
      totalPct: 0,
      validResponses: 0,
    }
  })

  yesMembers.forEach(u => {
    Object.entries(u.dishResponses || {}).forEach(([dish, val]) => {
      if (dish === '_status' || val === null || val === undefined || val === '') return

      if (!dishStats[dish]) {
        const isRoti = isRotiItem(dish)
        const isCount = !isRoti && typeof val === 'string' && !val.endsWith('%') && !['yes', 'no'].includes(String(val).toLowerCase())
        dishStats[dish] = {
          dish,
          isRoti,
          isCount,
          isPct: !isRoti && !isCount,
          yesCount: 0,
          noCount: 0,
          totalCount: 0,
          totalPct: 0,
          validResponses: 0,
        }
      }

      const stat = dishStats[dish]
      const strVal = String(val).trim().toLowerCase()

      if (stat.isRoti) {
        const isExplicitNo = strVal === 'no' || strVal === 'false' || strVal === '0' || strVal === '0%' || strVal === 'skip' || strVal === 'skipped'
        if (isExplicitNo) {
          stat.noCount++
        } else {
          stat.yesCount++
          const num = parseInt(strVal, 10)
          if (!isNaN(num) && num > 0 && !strVal.endsWith('%')) {
            stat.totalCount += num
          } else {
            stat.totalCount += 1
          }
        }
        stat.validResponses++
      } else if (stat.isCount) {
        if (strVal !== 'no') {
          const num = parseInt(val) || 0
          stat.totalCount += num
        }
        stat.validResponses++
      } else {
        // Percentage
        if (strVal === 'no') {
          stat.totalPct += 0
        } else {
          const pct = parseInt(val) || 0
          stat.totalPct += pct
        }
        stat.validResponses++
      }
    })
  })

  if (loading && users.length === 0) return <Spinner />

  return (
    <PageWrap>
      <div className="tracker-dashboard">
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 999,
                background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)',
                fontSize: 10, fontWeight: 800, color: 'var(--accent-primary)',
                letterSpacing: '0.12em', textTransform: 'uppercase'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', boxShadow: '0 0 8px var(--accent-primary)' }} />
                LIVE DISH AUDIT &amp; PACKING STATION
              </span>
              <span style={{ fontSize: 11, color: T.textSub, fontWeight: 600 }}>
                {meal === 'lunch' ? '☀️ Lunch Window' : '🌙 Dinner Window'} · {day.toUpperCase()}
              </span>
            </div>
            <PageTitle style={{ margin: 0 }}>Daily Survey Tracker</PageTitle>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn 
              variant="primary" 
              onClick={() => {
                const sample = yesMembers[0] || users[0] || { currentDay: day, currentMeal: meal, name: 'Live Packing Station', thali_number: '—' }
                setSelectedUser(sample)
              }}
              style={{
                background: 'linear-gradient(135deg, #c5a059 0%, #936c28 100%)',
                color: '#000', fontWeight: 900, boxShadow: '0 4px 16px rgba(197,160,89,0.3)',
                display: 'inline-flex', alignItems: 'center', gap: 8
              }}
            >
              <Tv size={16} /> <span>TV Live Screen</span>
            </Btn>
            <Btn variant="outline" onClick={() => setIsScanning(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Scan size={16} /> <span>Scan Tiffin</span>
            </Btn>
            <Btn variant="outline" onClick={() => load(true)} disabled={refreshing} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Sync Now'}</span>
            </Btn>
          </div>
        </div>

        {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

        {/* Day, Meal, Search & Sleek Dish Percentages Capsule Row */}
        <div style={{ 
          display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', 
          alignItems: 'center', background: 'var(--bg-surface)', 
          padding: '10px 16px', borderRadius: 20, border: `1px solid var(--border-light)`,
          boxShadow: '0 8px 30px rgba(0,0,0,0.1)'
        }}>
          {/* Day Filters */}
          <div style={{ display: 'flex', background: T.inputBg, padding: 3, borderRadius: 12, border: `1px solid ${T.border}`, overflowX: 'auto' }}>
            {DAYS.map(d => (
              <button key={d} onClick={() => setDay(d)}
                style={{ 
                  flexShrink: 0, padding: '7px 13px', borderRadius: 9, border: 'none', 
                  background: day === d ? T.accentGrad : 'transparent', 
                  color: day === d ? '#000' : T.textSub, 
                  fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)' 
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
                  padding: '7px 14px', borderRadius: 9, border: 'none', 
                  background: meal === m ? (m === 'lunch' ? T.accentGrad : 'linear-gradient(135deg, #5e9ce0 0%, #3b82f6 100%)') : 'transparent', 
                  color: meal === m ? (m === 'lunch' ? '#000' : '#fff') : T.textSub, 
                  fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
                  display: 'flex', alignItems: 'center', gap: 6
                }}>
                <span>{m === 'lunch' ? '☀️' : '🌙'}</span>
                <span>{m.toUpperCase()}</span>
              </button>
            ))}
          </div>

          {/* Week Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.inputBg, padding: '6px 12px', borderRadius: 12, border: `1px solid ${T.border}` }}>
            <Calendar size={13} color="var(--accent-primary)" />
            <select value={weekFilter} onChange={e => setWeekFilter(e.target.value)} name="weekFilter"
              style={{ background: 'transparent', border: 'none', color: T.text, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
              <option value="all">⚡ Auto / Latest Week</option>
              {availableWeeks.map(w => (
                <option key={w} value={w}>{formatWeekRange(w)} ({formatWeekShort(w)})</option>
              ))}
            </select>
          </div>
          
          {/* Search Bar */}
          <div style={{ flex: '1 1 200px', position: 'relative' }}>
            <Search size={14} color={T.textSub} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input 
              name="searchTracking"
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search thali or name..."
              style={{ 
                width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px', 
                borderRadius: 12, background: T.inputBg, border: `1px solid ${T.inputBorder}`, 
                color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' 
              }}
            />
          </div>

          {/* Inline Dish Stats Strip - shows total piece counts */}
          {Object.keys(dishStats).length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: T.textSub, letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: 2 }}>PORTIONS:</div>
              {Object.entries(dishStats).map(([dish, stat]) => {
                let displayVal = ''
                let unit = ''
                let statColor = 'var(--accent-primary)'

                if (stat.isRoti) {
                  displayVal = `${stat.yesCount}/${stat.yesCount + stat.noCount}`
                  unit = 'rotis'
                  const ratio = (stat.yesCount + stat.noCount > 0) ? (stat.yesCount / (stat.yesCount + stat.noCount)) : 0
                  statColor = ratio >= 0.5 ? '#10b981' : '#ef4444'
                } else if (stat.isCount) {
                  displayVal = `${stat.totalCount}`
                  unit = stat.totalCount === 1 ? 'person' : 'persons'
                  statColor = stat.totalCount > 0 ? '#10b981' : T.textSub
                } else {
                  const denominator = yesMembers.length > 0 ? yesMembers.length : Math.max(1, stat.validResponses)
                  const avgPct = Math.round(stat.totalPct / denominator)
                  const portions = (stat.totalPct / 100).toFixed(1)
                  displayVal = `${avgPct}% (${portions} thalis)`
                  unit = ''
                  statColor = getPctColor(avgPct) || 'var(--accent-primary)'
                }

                return (
                  <div key={dish} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--input-bg)', padding: '5px 12px',
                    borderRadius: 12, border: `1px solid ${statColor ? `${statColor}40` : T.border}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.textSub, textTransform: 'uppercase' }}>{dish}</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: statColor, fontFamily: "'Space Grotesk', monospace", fontVariantNumeric: 'tabular-nums' }}>
                      {displayVal}{unit && <span style={{ fontSize: 9.5, fontWeight: 700, color: T.textSub, marginLeft: 3 }}>{unit}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Mobile Column Switcher (visible on screens <= 960px) */}
        <div className="mobile-col-switcher" style={{ display: 'none', gap: 8, marginBottom: 14, width: '100%', flexWrap: 'wrap' }}>
          {[
            { id: 'yes', label: `✅ YES (${yesMembers.length})`, color: T.success },
            { id: 'no', label: `❌ NO (${noMembers.length})`, color: T.danger },
            { id: 'pending', label: `⌛ PENDING (${noResponse.length})`, color: 'var(--text-tertiary)' },
            { id: 'all', label: `ALL (${filtered.length})`, color: 'var(--accent-primary)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setMobileColTab(tab.id)}
              style={{
                flex: 1, minWidth: 100, padding: '9px 8px', borderRadius: 12, border: 'none',
                background: mobileColTab === tab.id ? tab.color : 'var(--input-bg)',
                color: mobileColTab === tab.id ? (tab.id === 'yes' ? '#000' : '#fff') : 'var(--text-tertiary)',
                fontWeight: 800, fontSize: 11.5, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
                boxShadow: mobileColTab === tab.id ? `0 4px 12px ${tab.color}35` : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 3-Column Side-By-Side Flex Layout */}
        <div className="tracker-row">
          {/* YES Column */}
          <div className={`tracker-col ${mobileColTab === 'yes' || mobileColTab === 'all' ? 'col-active' : ''}`}>
            <AdminCard className="col-card" style={{ borderTop: `4px solid ${T.success}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
                <SectionHeader style={{ margin: 0, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✅ YES THALI</span>
                </SectionHeader>
                <div style={{
                  padding: '2px 10px', borderRadius: 999,
                  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                  color: '#10b981', fontSize: 12, fontWeight: 900,
                  fontFamily: "'Space Grotesk', monospace", fontVariantNumeric: 'tabular-nums'
                }}>
                  {yesMembers.length}
                </div>
              </div>
              <div className="col-body">
                {yesMembers.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: T.textSub, fontSize: 13 }}>No one has applied yet.</div>
                ) : yesMembers.map((u, idx) => (
                  <MemberRow key={u.user_id} user={u} index={idx + 1} onClick={() => { document.documentElement.requestFullscreen().catch(() => {}); setSelectedUser(u) }} />
                ))}
              </div>
            </AdminCard>
          </div>

          {/* NO Column */}
          <div className={`tracker-col ${mobileColTab === 'no' || mobileColTab === 'all' ? 'col-active' : ''}`}>
            <AdminCard className="col-card" style={{ borderTop: `4px solid ${T.danger}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
                <SectionHeader style={{ margin: 0, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>❌ NO THALI</span>
                </SectionHeader>
                <div style={{
                  padding: '2px 10px', borderRadius: 999,
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444', fontSize: 12, fontWeight: 900,
                  fontFamily: "'Space Grotesk', monospace", fontVariantNumeric: 'tabular-nums'
                }}>
                  {noMembers.length}
                </div>
              </div>
              <div className="col-body">
                {noMembers.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: T.textSub, fontSize: 13 }}>No opt-outs yet.</div>
                ) : noMembers.map((u, idx) => (
                  <MemberRow key={u.user_id} user={u} index={idx + 1} onClick={() => { document.documentElement.requestFullscreen().catch(() => {}); setSelectedUser(u) }} />
                ))}
              </div>
            </AdminCard>
          </div>

          {/* NO RESPONSE Column */}
          <div className={`tracker-col ${mobileColTab === 'pending' || mobileColTab === 'all' ? 'col-active' : ''}`}>
            <AdminCard className="col-card" style={{ borderTop: `4px solid var(--text-tertiary)` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
                <SectionHeader style={{ margin: 0, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⌛ PENDING RESPONSE</span>
                </SectionHeader>
                <div style={{
                  padding: '2px 10px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-light)',
                  color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 900,
                  fontFamily: "'Space Grotesk', monospace", fontVariantNumeric: 'tabular-nums'
                }}>
                  {noResponse.length}
                </div>
              </div>
              <div className="col-body">
                {noResponse.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: T.textSub, fontSize: 13 }}>All users have responded!</div>
                ) : noResponse.map((u, idx) => (
                  <PendingMemberRow key={u.user_id} user={u} index={idx + 1} onClick={() => { document.documentElement.requestFullscreen().catch(() => {}); setSelectedUser(u) }} />
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
          height: calc(100vh - 180px);
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
          padding: 18px !important;
          box-sizing: border-box;
          overflow: hidden;
          background: var(--bg-surface) !important;
          border-radius: 20px !important;
        }
        .col-body {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
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

        @media (max-width: 960px) {
          .mobile-col-switcher {
            display: flex !important;
          }
          .tracker-dashboard {
            height: auto !important;
            overflow: visible !important;
          }
          .tracker-row {
            flex-direction: column !important;
            height: auto !important;
          }
          .tracker-col {
            display: none !important;
            height: auto !important;
          }
          .tracker-col.col-active {
            display: flex !important;
            height: auto !important;
          }
          .col-card {
            height: auto !important;
            max-height: 75vh !important;
          }
        }
      `}</style>

      {/* QR Scanner Modal */}
      {isScanning && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
          zIndex: 10005, display: 'flex', flexDirection: 'column',
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
          key={selectedUser.user_id || selectedUser.id || selectedUser.thali_number}
          user={selectedUser} 
          meal={meal}
          day={day} 
          onClose={() => setSelectedUser(null)}
          dishInputConfig={dishInputConfig}
          onMealToggle={(m) => { setMeal(m); setMealOverride(true) }}
          onTriggerCameraScan={() => setIsScanning(true)}
        />
      )}

      <style>{`.spin { animation: spin 1s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </PageWrap>
  )
}

function PendingMemberRow({ user, index, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        padding: '12px 16px', borderRadius: 14, background: 'var(--input-bg)', border: '1px solid var(--border-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', transition: 'all 0.25s cubic-bezier(0.32, 0.72, 0, 1)'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent-primary)';
        e.currentTarget.style.background = 'var(--bg-card-hover)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-light)';
        e.currentTarget.style.background = 'var(--input-bg)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
        {index != null && <SrBadge num={index} />}
        <div style={{ 
          minWidth: 46, height: 28, padding: '0 8px', borderRadius: 8,
          background: 'rgba(255,255,255,0.04)', 
          border: '1px solid var(--border-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 900, color: 'var(--text-tertiary)',
          fontFamily: "'Space Grotesk', monospace",
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0
        }}>
          #{user.thali_number || '—'}
        </div>
        <div style={{
          fontWeight: 600, color: 'var(--text-primary)', fontSize: 14,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>
          {user.name || 'Member'}
        </div>
      </div>
      <ChevronRight size={16} color="var(--text-tertiary)" style={{ flexShrink: 0, marginLeft: 8 }} />
    </div>
  )
}

function MemberRow({ user, index, onClick }) {
  const dishPills = []
  if (user.dishResponses) {
    Object.entries(user.dishResponses).forEach(([dish, val]) => {
      if (dish === '_status' || val === null || val === undefined || val === '') return
      const isRoti = isRotiItem(dish)
      const strVal = String(val).trim().toLowerCase()
      if (isRoti) {
        if (!['no', 'false', 'skip'].includes(strVal)) {
          const num = parseInt(strVal, 10)
          dishPills.push(!isNaN(num) && num > 0 && !strVal.endsWith('%') ? `${num} Roti` : 'Roti')
        }
      } else if (strVal.endsWith('%') || !isNaN(Number(strVal))) {
        const n = parseInt(strVal)
        if (n > 0) dishPills.push(`${dish.substring(0, 10)}: ${n}%`)
      } else if (strVal !== 'no') {
        dishPills.push(`${dish.substring(0, 10)}: ${val}`)
      }
    })
  }

  return (
    <div 
      onClick={onClick}
      style={{ 
        padding: '12px 16px', borderRadius: 14, background: 'var(--input-bg)', border: '1px solid var(--border-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.32, 0.72, 0, 1)'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent-primary)';
        e.currentTarget.style.background = 'var(--bg-card-hover)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-light)';
        e.currentTarget.style.background = 'var(--input-bg)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
        {index != null && <SrBadge num={index} />}
        <div style={{
          minWidth: 46, height: 28, padding: '0 8px', borderRadius: 8,
          background: user.stopped ? 'rgba(239,68,68,0.12)' : 'rgba(212,175,55,0.1)',
          border: `1.5px solid ${user.stopped ? '#ef4444' : 'var(--accent-primary)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 900, color: user.stopped ? '#ef4444' : 'var(--accent-primary)',
          fontFamily: "'Space Grotesk', monospace",
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
          boxShadow: user.stopped ? '0 0 10px rgba(239,68,68,0.2)' : '0 0 10px rgba(212,175,55,0.15)'
        }}>
          #{user.thali_number || '—'}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {user.name || 'Member'}
          </div>
          {user.stopped ? (
            <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 800, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ⏹️ STOP THALI{user.stopInfo?.from_date ? ` · ${user.stopInfo.from_date}` + (user.stopInfo.to_date && user.stopInfo.to_date !== user.stopInfo.from_date ? ` → ${user.stopInfo.to_date}` : '') : ''}
            </div>
          ) : user._isOverride ? (
            <div style={{ fontSize: 10, color: '#10b981', fontWeight: 800, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>OVERRIDE</span>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {dishPills.slice(0, 3).map((pill, pi) => (
                <span key={pi} style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 6,
                  background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)',
                  color: 'var(--accent-primary)', whiteSpace: 'nowrap'
                }}>
                  {pill}
                </span>
              ))}
              {dishPills.length > 3 && (
                <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)', fontWeight: 700 }}>+{dishPills.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
      <ChevronRight size={16} color="var(--text-tertiary)" style={{ flexShrink: 0, marginLeft: 8 }} />
    </div>
  )
}
