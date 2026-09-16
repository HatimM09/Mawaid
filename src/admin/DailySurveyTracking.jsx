// src/admin/DailySurveyTracking.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/firebaseClient'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { 
  Search, RefreshCw, ChevronRight, Check, X, Filter, 
  Calendar, Utensils, User as UserIcon, Clock, ChevronDown, ChevronUp, Scan, Trash2
} from 'lucide-react'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'
import { 
  T, PageWrap, PageTitle, AdminCard, Badge, Btn, Spinner, Grid,
  SectionHeader, Modal, PackingTVView, fmtDate, ErrorBanner
} from './ui'

import { 
  getSurveyTargetWeek, getCalendarWeekDate, dayBelongsToCalendarWeek, 
  DAYS, DAY_KEYS, toLocalDateStr, isStoppedOnDay, parseDishArray,
  getSurveyTargetWeeks, formatWeekRange, formatWeekShort, isTwoWeekCadence 
} from '../common/utils'
import { getPctColor, getSlotDishes, isRotiItem, isCountInput } from '../hooks/useSurvey'
import { fetchUserSurveyRow, fetchAllUserRows, eraseSurveySlot, flattenDayRows } from '../lib/surveyRows'

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
  const targetWeeks = useMemo(() => getSurveyTargetWeeks(appSettings), [appSettings])
  const targetWeek = targetWeeks[0] || surveyWeekId()
  const weeklyMenuRaw = useWeeklyMenu(targetWeeks.length > 1 ? targetWeeks : targetWeek) || {}
  const weeklyMenu = targetWeeks.length > 1 ? (weeklyMenuRaw.__byWeek?.[targetWeek] || weeklyMenuRaw) : weeklyMenuRaw
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
  const usersRef = useRef([])
  useEffect(() => {
    usersRef.current = users
  }, [users])

  const [selectedUser, setSelectedUser] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [weekFilter, setWeekFilter] = useState('all')
  const [availableWeeks, setAvailableWeeks] = useState([])
  const [dishInputConfig, setDishInputConfig] = useState({})
  // Menu resolved for the week that owns the selected day (calendar vs target)
  const [displayMenu, setDisplayMenu] = useState({})

  // Helper to check if a dish at a given index is count or percentage
  const getInputType = (d, m, idx) => {
    const key = `${d.toLowerCase()}_${m}`
    const config = dishInputConfig[key]
    return config?.[idx] || (m === 'lunch' && idx <= 3 ? 'count' : 'percentage')
  }

  const processDirectScan = async (rawUserId) => {
    // Auto-fullscreen on scan — must be synchronous before any await to preserve user gesture
    document.documentElement.requestFullscreen().catch(() => {})
    try {
      const cleanId = String(rawUserId || '').trim().replace(/^ALMAWAID:/i, '').trim()
      if (!cleanId) {
        alert('Invalid QR code scanned.')
        return
      }

      const cleanThali = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const cleanTarget = cleanThali(cleanId)

      // 1. FAST PATH: Check if user is already loaded in the tracker table
      const cached = (usersRef.current || []).find(u => 
        (u.user_id && String(u.user_id).trim() === cleanId) ||
        (u.id && String(u.id).trim() === cleanId) ||
        (u.thali_number && String(u.thali_number).trim() === cleanId) ||
        (u.thali_number && cleanThali(u.thali_number) === cleanTarget) ||
        (u.email && String(u.email).toLowerCase().trim() === cleanId.toLowerCase())
      )

      if (cached) {
        setSelectedUser(cached)
        return
      }

      // 2. FALLBACK PATH: Query DB directly
      let { data: u } = await supabase.from('user_stats').select('*').eq('user_id', cleanId).maybeSingle()
      if (!u) {
        const { data: uById } = await supabase.from('user_stats').select('*').eq('id', cleanId).maybeSingle()
        u = uById
      }
      if (!u) {
        const { data: uByThali } = await supabase.from('user_stats').select('*').eq('thali_number', cleanId).maybeSingle()
        u = uByThali
      }
      if (!u && cleanTarget) {
        const { data: allU } = await supabase.from('user_stats').select('*')
        u = (allU || []).find(x => cleanThali(x.thali_number) === cleanTarget || (x.email && x.email.toLowerCase().trim() === cleanId.toLowerCase()))
      }

      if (!u) {
        alert('User not found!')
        return
      }

      const targetUserId = u.user_id || u.id
      const dayKey = day.substring(0, 3).toLowerCase()
      const mealKey = meal === 'lunch' ? 'l' : 'd'
      const statusKey = `${dayKey}_${mealKey}_status`

      const calWeek = getCalendarWeekDate()
      const targetWeeksList = getSurveyTargetWeeks(appSettings)
      const primaryTarget = targetWeeksList[0] || surveyWeekId()
      const isSunday = new Date().getDay() === 0
      const defaultWeek = isSunday ? primaryTarget : calWeek
      const activeWeekId = (weekFilter && weekFilter !== 'all') ? weekFilter : defaultWeek

      // Fetch survey row for this user in activeWeekId
      let row = {}
      try {
        const { data: dayRows } = await supabase
          .from('survey_day_responses')
          .select('*')
          .eq('week_id', activeWeekId)
          .or(`user_id.eq.${targetUserId},thali_number.eq.${u.thali_number || ''}`)

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
        } catch {}
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
      } catch {}
      const dayNameLower = day.toLowerCase()
      const dayMenu = freshMenu[dayNameLower] || (weeklyMenuRaw.__byWeek?.[resolvedWeekId]?.[dayNameLower]) || displayMenu[dayNameLower] || weeklyMenu[dayNameLower] || weeklyMenu[day] || {}

      const scanBuildDishMap = (mealName, menuList) => {
        const mk = mealName === 'lunch' ? 'l' : 'd'
        const dk = day.substring(0, 3).toLowerCase()
        const cleanMenuList = Array.isArray(menuList) ? menuList.filter(Boolean) : []
        const snapshotList = getSlotDishes(row, day, mealName, null)
        const cleanSnapshot = Array.isArray(snapshotList) ? snapshotList.filter(Boolean) : []
        const names = cleanMenuList.length > 0 ? cleanMenuList : (cleanSnapshot.length > 0 ? cleanSnapshot : [])
        const result = {}
        result._status = row ? row[`${dk}_${mk}_status`] : null

        names.forEach((d, idx) => {
          let pos = idx
          if (cleanSnapshot.length > 0 && cleanSnapshot.includes(d)) {
            pos = cleanSnapshot.indexOf(d)
          }
          const val = (row && pos >= 0) ? row[`${dk}_${mk}_dish_${pos + 1}`] : null
          if (val !== undefined && val !== null && val !== '') {
            if (isRotiItem(d)) {
              result[d] = String(val).toLowerCase() === 'yes' ? 'yes' : 'no'
            } else {
              const lowerVal = String(val).toLowerCase()
              if (lowerVal === 'yes' || lowerVal === 'no') result[d] = lowerVal
              else result[d] = val
            }
          } else {
            result[d] = null
          }
        })
        return result
      }

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

  // --- WIRELESS SCANNER SUPPORT ---
  useEffect(() => {
    let scanBuffer = ''
    let lastKeyTime = Date.now()

    const handleKeyDown = (e) => {
      const now = Date.now()
      if (now - lastKeyTime > 100) scanBuffer = ''
      lastKeyTime = now

      if (e.key === 'Enter') {
        const text = scanBuffer.trim()
        if (text) {
          const userId = text.replace(/^ALMAWAID:/i, '').trim()
          if (userId) {
            handleWirelessScan(userId)
          }
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
          .from('survey_day_responses')
          .select('week_id').lt('week_id', cutoff)
        if (oldRows && oldRows.length) {
          const oldWeeks = [...new Set(oldRows.map(r => r.week_id))].filter(Boolean)
          for (const ow of oldWeeks) {
            await supabase.from('survey_day_responses').delete().eq('week_id', ow)
          }
        }
      } catch (e) { console.warn('Cleanup error:', e) }

      // Load app settings (dish input config, survey open hour, status, user overrides)
      const { data: allSettings } = await supabase.from('app_settings').select('*')
      const settingsMap = {}
      ;(allSettings || []).forEach(r => { if (r && r.key) settingsMap[r.key] = r.value })

      if (settingsMap.dish_input_config) {
        try { setDishInputConfig(JSON.parse(settingsMap.dish_input_config)) } catch {}
      }

      setAppSettings(prev => JSON.stringify(prev) === JSON.stringify(settingsMap) ? prev : settingsMap)

      const targetWeekId = getSurveyTargetWeek(settingsMap)

      const { data: users, error: usersError } = await supabase
        .from('user_stats')
        .select('user_id, name, thali_number, email, avatar_url')
      if (usersError) throw usersError

      // Load ALL merged survey rows (per user+week: live day rows first,
      // legacy flat mirror as the fallback for historical weeks).
      const { data: allRows, error: subsError } = await fetchAllUserRows()
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
      const trackingWeek = new Date(targetWeekId + 'T00:00:00')
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

      // Merge merged rows into user records (one array per user, newest week first).
      // No override merging — each user's effective row is the normal row from survey_day_responses.
      const subMap = {}
      for (const s of allRows || []) {
        if (!subMap[s.user_id]) subMap[s.user_id] = []
        subMap[s.user_id].push(s)
      }

      setLoadError(null)

      // Collect distinct week_ids for filter
      const targetWeeksList = getSurveyTargetWeeks(settingsMap)
      const primaryTarget = targetWeeksList[0] || getSurveyTargetWeek(settingsMap)
      const cal = getCalendarWeekDate()
      const isSunday = new Date().getDay() === 0
      const defaultWeek = isSunday ? primaryTarget : cal
      const effectiveWeek = (weekFilter && weekFilter !== 'all') ? weekFilter : defaultWeek

      const allWeeks = [...new Set([
        ...targetWeeksList,
        cal,
        ...(allRows || []).map(s => s.week_id).filter(Boolean)
      ])].filter(Boolean).sort().reverse()
      setAvailableWeeks(allWeeks)
      
      const dayKey = day.substring(0, 3).toLowerCase()
      const mealKey = meal === 'lunch' ? 'l' : 'd'
      const statusKey = `${dayKey}_${mealKey}_status`
      
      const buildDishMap = (r, dayName, mealName, menuList) => {
        const mk = mealName === 'lunch' ? 'l' : 'd'
        const dk = String(dayName || day).substring(0, 3).toLowerCase()
        const cleanMenuList = Array.isArray(menuList) ? menuList.filter(Boolean) : []
        const snapshotList = getSlotDishes(r, dayName, mealName, null)
        const cleanSnapshot = Array.isArray(snapshotList) ? snapshotList.filter(Boolean) : []
        const names = cleanMenuList.length > 0 ? cleanMenuList : (cleanSnapshot.length > 0 ? cleanSnapshot : [])
        const result = {}
        result._status = r ? r[`${dk}_${mk}_status`] : null

        names.forEach((d, idx) => {
          let pos = idx
          if (cleanSnapshot.length > 0 && cleanSnapshot.includes(d)) {
            pos = cleanSnapshot.indexOf(d)
          }
          const val = (r && pos >= 0) ? r[`${dk}_${mk}_dish_${pos + 1}`] : null
          if (val !== undefined && val !== null && val !== '') {
            if (isRotiItem(d)) {
              result[d] = String(val).toLowerCase() === 'yes' ? 'yes' : 'no'
            } else {
              const lowerVal = String(val).toLowerCase()
              if (lowerVal === 'yes' || lowerVal === 'no') result[d] = lowerVal
              else result[d] = val
            }
          } else {
            result[d] = null
          }
        })
        return result
      }

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
      } catch {}

      const activeDisplayMenu = weekMenusMap[effectiveWeek] || (weeklyMenuRaw.__byWeek?.[effectiveWeek]) || weeklyMenu || {}
      setDisplayMenu(activeDisplayMenu)

      const cleanThali = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '')

      const matchUserRow = (r, u) => {
        if (!r || !u) return false
        if (r.user_id && u.user_id && r.user_id === u.user_id) return true
        if (r.thali_number && u.thali_number) {
          const ctR = cleanThali(r.thali_number)
          const ctU = cleanThali(u.thali_number)
          if (ctR && ctU && ctR === ctU) return true
        }
        if (r.email && u.email && r.email.toLowerCase().trim() === u.email.toLowerCase().trim()) return true
        return false
      }

      const results = (users || []).map(u => {
        const candidates = (allRows || []).filter(r => matchUserRow(r, u))

        // Strictly match responses for the active effectiveWeek
        const resp = candidates.find(r => r.week_id === effectiveWeek) || {}

        const userWeekId = effectiveWeek
        const userWeekMenu = weekMenusMap[userWeekId] || (weeklyMenuRaw.__byWeek?.[userWeekId]) || activeDisplayMenu || {}
        const dayKeyLower = day.toLowerCase()
        const dayMenu = userWeekMenu[dayKeyLower] || userWeekMenu[day] || activeDisplayMenu[dayKeyLower] || {}
        const buildCurMeal = buildDishMap(resp, day, meal, dayMenu[meal] || [])
        const buildLunch = buildDishMap(resp, day, 'lunch', dayMenu.lunch || [])
        const buildDinner = buildDishMap(resp, day, 'dinner', dayMenu.dinner || [])
        const stoppedInfo = stoppedMap[u.user_id]
        const isStopped = !!stoppedInfo
        const baseStatus = buildCurMeal._status
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
        const rawText = String(decodedText || '').trim()
        const userId = rawText.replace(/^ALMAWAID:/i, '').trim()
        if (userId) {
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
        if (strVal === 'yes') stat.yesCount++
        else if (strVal === 'no') stat.noCount++
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

          {/* Week Quick Select Tabs */}
          {targetWeeks.length > 1 && (
            <div style={{ display: 'flex', background: T.inputBg, padding: 3, borderRadius: 12, border: `1px solid ${T.border}` }}>
              {targetWeeks.map((tw, idx) => {
                const isSelected = weekFilter === tw
                return (
                  <button key={tw} onClick={() => setWeekFilter(tw)}
                    style={{
                      padding: '6px 12px', borderRadius: 8, border: 'none',
                      background: isSelected ? T.accentGrad : 'transparent',
                      color: isSelected ? '#fff' : T.textSub,
                      fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: '0.2s', whiteSpace: 'nowrap'
                    }}>
                    {formatWeekRange(tw)} (W{idx + 1})
                  </button>
                )
              })}
            </div>
          )}

          {/* Week Filter Dropdown */}
          <select value={weekFilter} onChange={e => setWeekFilter(e.target.value)} name="weekFilter"
            style={{ padding: '6px 12px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.border}`, color: T.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none' }}>
            <option value="all">⚡ Auto / Latest Week</option>
            {availableWeeks.map(w => (
              <option key={w} value={w}>{formatWeekRange(w)} ({formatWeekShort(w)})</option>
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
                let displayVal = ''
                let unit = ''
                let statColor = T.accent

                if (stat.isRoti) {
                  displayVal = `${stat.yesCount}/${stat.yesCount + stat.noCount}`
                  unit = 'yes'
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
                  statColor = getPctColor(avgPct) || T.accent
                }

                return (
                  <div key={dish} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: T.inputBg, padding: '5px 10px',
                    borderRadius: 10, border: `1px solid ${statColor ? `${statColor}40` : T.border}`
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.textSub, textTransform: 'uppercase' }}>{dish}</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: statColor }}>{displayVal}{unit && <span style={{ fontSize: 9, fontWeight: 700, color: T.textSub, marginLeft: 2 }}>{unit}</span>}</span>
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
          dishInputConfig={dishInputConfig}
          onMealToggle={(m) => { setMeal(m); setMealOverride(true) }}
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
          ) : user._isOverride ? (
            <div style={{ fontSize: 10, color: '#4CAF50', fontWeight: 800, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(76,175,80,0.15)', border: '1px solid rgba(76,175,80,0.3)' }}>OVERRIDE</span>
            </div>
          ) : user.updated_at && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500, marginTop: 2, opacity: 0.7 }}>
              {new Date(user.updated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
      <ChevronRight size={18} color={T.textSub} />
    </div>
  )
}
