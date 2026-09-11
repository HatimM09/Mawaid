import { useState, useEffect, useCallback, useRef } from 'react'
import { DAYS, parseHm, getSurveyCadence, isTwoWeekCadence, getSurveyTotalSlots, getSurveyTargetWeeks, formatWeekRange } from '../common/utils'

export const isRotiItem = (dish) => {
  const rotiKeywords = ['roti', 'naan', 'paratha', 'bread', 'chapati', 'puri']
  return rotiKeywords.some(k => dish.toLowerCase().includes(k))
}

// Canonical percentage → color scale shared by member option buttons,
// daily-edit buttons and the admin tracker totals. Each step has its own
// distinct hue: red (none) → amber (quarter) → blue (half) →
// cyan (three-quarter) → green (full). Grey is reserved for empty/inactive.
export const getPctColor = (pct) => {
  if (pct === 0) return '#ef4444'
  if (pct === 25) return '#f59e0b'
  if (pct === 50) return '#3b82f6'
  if (pct === 75) return '#22d3ee'
  if (pct === 100) return '#10b981'
  return undefined
}

// ── Admin-configurable survey window (day + time from-to) + admin override ──
// Admin picks start Day+Time and end Day+Time (e.g. Sat 20:00 → Mon 11:00) in Automation.
// survey_window_status = 'auto' | 'open' | 'closed' gives admin instant open/close rights
// that override the weekly schedule. Linked directly to Automation weekly day/time controls.

const DAY_TO_NUM = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
const NUM_TO_DAY_CAP = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const parseSurveyWindow = (appSettings = {}) => {
  // New keys (authoritative). Fallback to legacy sat 20:00 → mon 11:00 for existing installs.
  let startDayRaw = appSettings.survey_window_start_day
  let startTimeRaw = appSettings.survey_window_start_time
  let endDayRaw = appSettings.survey_window_end_day
  let endTimeRaw = appSettings.survey_window_end_time

  // Back-compat: if new keys absent, derive from legacy hour settings
  if (startDayRaw == null && startTimeRaw == null && endDayRaw == null && endTimeRaw == null) {
    if (appSettings.survey_open_hour != null || appSettings.survey_close_hour != null) {
      const openHour = parseInt(appSettings.survey_open_hour, 10)
      const closeHour = parseInt(appSettings.survey_close_hour, 10)
      return {
        startDay: 6, // Saturday
        startTime: { h: isNaN(openHour) ? 20 : openHour, m: 0 },
        endDay: 1, // Monday
        endTime: { h: isNaN(closeHour) ? 11 : closeHour, m: 0 },
      }
    }
  }

  const normalizeDay = (v, fallback) => {
    if (v == null || v === '') return fallback
    if (typeof v === 'number' && v >= 0 && v <= 6) return v
    const s = String(v).toLowerCase().trim()
    if (DAY_TO_NUM[s] != null) return DAY_TO_NUM[s]
    const n = parseInt(s, 10)
    if (!isNaN(n) && n >= 0 && n <= 6) return n
    return fallback
  }

  const startDay = normalizeDay(startDayRaw, 6)
  const endDay = normalizeDay(endDayRaw, 1)
  const startTime = parseHm(startTimeRaw, 20, 0)
  const endTime = parseHm(endTimeRaw, 11, 0)
  return { startDay, startTime, endDay, endTime }
}

export const getSurveyWindowConfig = (appSettings = {}) => parseSurveyWindow(appSettings)

export const getSurveyWindowStatus = (appSettings = {}) => {
  const raw = (appSettings.survey_window_status ?? appSettings.survey_status ?? 'auto')
  const v = String(raw).toLowerCase().trim()
  return v === 'open' || v === 'closed' ? v : 'auto'
}

export const isSurveyOpen = (appSettings = {}, userId = null) => {
  const mode = getSurveyWindowStatus(appSettings)
  if (mode === 'open') return true
  if (mode === 'closed') return false
  const cfg = parseSurveyWindow(appSettings)
  const now = new Date()
  const nowDay = now.getDay()
  const nowMin = nowDay * 1440 + now.getHours() * 60 + now.getMinutes()
  const startMin = cfg.startDay * 1440 + cfg.startTime.h * 60 + cfg.startTime.m
  const endMin = cfg.endDay * 1440 + cfg.endTime.h * 60 + cfg.endTime.m
  if (startMin === endMin) return false
  if (startMin < endMin) {
    return nowMin >= startMin && nowMin < endMin
  }
  // wraps across week boundary (e.g. Sat 20:00 → Mon 11:00)
  return nowMin >= startMin || nowMin < endMin
}

export const getSurveyWindowLabel = (appSettings = {}) => {
  const cfg = parseSurveyWindow(appSettings)
  const fmt = (h, m) => formatEditTime(h, m)
  const sDay = NUM_TO_DAY_CAP[cfg.startDay]
  const eDay = NUM_TO_DAY_CAP[cfg.endDay]
  return `${sDay} ${fmt(cfg.startTime.h, cfg.startTime.m)} – ${eDay} ${fmt(cfg.endTime.h, cfg.endTime.m)}`
}

export const canEditMeal = (dayName, weekId, mealType, appSettings = {}) => {
  // Daily edit is independent of weekly survey window — AUTO follows its own meal window
  if (mealType === 'lunch' && appSettings.lunch_edit_status === 'closed') return false
  if (mealType === 'lunch' && appSettings.lunch_edit_status === 'open') return true
  if (mealType === 'dinner' && appSettings.dinner_edit_status === 'closed') return false
  if (mealType === 'dinner' && appSettings.dinner_edit_status === 'open') return true
  const now = new Date()
  const dayIdx = DAYS.indexOf(dayName)
  if (dayIdx === -1) return false

  let weekStart
  if (weekId && typeof weekId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(weekId)) {
    weekStart = new Date(weekId + 'T00:00:00')
  } else {
    const curDiff = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)
    weekStart = new Date(now)
    weekStart.setDate(curDiff)
    weekStart.setHours(0, 0, 0, 0)
  }
  const mealDate = new Date(weekStart)
  mealDate.setDate(mealDate.getDate() + dayIdx)

  if (mealType === 'lunch') {
    const open = parseHm(appSettings.lunch_edit_open, 20, 0)
    const close = parseHm(appSettings.lunch_edit_close, 11, 0)
    const openDate = new Date(mealDate)
    openDate.setDate(openDate.getDate() - 1)
    openDate.setHours(open.h, open.m, 0, 0)
    const closeDate = new Date(mealDate)
    closeDate.setHours(close.h, close.m, 0, 0)
    return now >= openDate && now < closeDate
  }
  const open = parseHm(appSettings.dinner_edit_open, 12, 0)
  const close = parseHm(appSettings.dinner_edit_close, 15, 30)
  const openDate = new Date(mealDate)
  openDate.setHours(open.h, open.m, 0, 0)
  const closeDate = new Date(mealDate)
  closeDate.setHours(close.h, close.m, 0, 0)
  return now >= openDate && now < closeDate
}

export const isCountInput = (appSettings, dayName, meal, idx) => {
  try {
    const config = appSettings?.dish_input_config
    if (config) {
      const parsed = typeof config === 'string' ? JSON.parse(config) : config
      const key = `${dayName.toLowerCase()}_${meal}`
      const types = parsed[key]
      if (types && types[idx]) return types[idx] === 'count'
    }
  } catch { }
  return false
}

export const getDishType = (dish, dayName, meal, idx, appSettings) => {
  if (isRotiItem(dish)) return 'roti'
  if (isCountInput(appSettings, dayName, meal, idx)) return 'count'
  return 'percentage'
}

export const normalizeDishValue = (val, dish, isCount) => {
  if (val === undefined || val === null || val === '') return null
  if (isRotiItem(dish)) return String(val).toLowerCase() === 'yes' ? 'yes' : 'no'
  if (isCount) {
    if (String(val).toLowerCase() === 'no') return 'no'
    if (typeof val === 'object' && val?.status) return val
    const n = parseInt(val)
    return isNaN(n) ? 'no' : { status: 'yes', value: n }
  }
  if (typeof val === 'object' && val?.status) {
    return val.status === 'yes' ? (val.value || 1) : 0
  }
  if (typeof val === 'string' && val.endsWith('%')) return parseInt(val) || 0
  const lv = String(val).toLowerCase()
  if (lv === 'yes') return 100
  if (lv === 'no') return 0
  if (typeof val === 'number') return val
  const parsed = parseInt(val)
  return isNaN(parsed) ? 0 : parsed
}

export const denormalizeDishValue = (val, dish, isCount) => {
  if (val === 'yes' || val === 'Yes') return isRotiItem(dish) ? 'Yes' : 'Yes'
  if (val === 'no' || val === 'No') return 'No'
  if (isRotiItem(dish)) return String(val).toLowerCase() === 'yes' ? 'Yes' : 'No'
  if (isCount) {
    if (val === 'no' || val === 'No' || val === null) return 'No'
    if (typeof val === 'object' && val?.status === 'yes') return String(val.value)
    if (typeof val === 'number' || typeof val === 'string') return String(val)
    return 'No'
  }
  if (typeof val === 'number') return `${val}%`
  if (typeof val === 'string' && val.endsWith('%')) return val
  return 'No'
}

// ── Survey cadence re-exports (so consumers import from one place) ──
export { getSurveyCadence, isTwoWeekCadence, getSurveyTotalSlots, getSurveyTargetWeeks, formatWeekRange }

// Count helpers for 1 vs 2 week progress
export const countFilledSlots = (flatRow, weekIds) => {
  if (!flatRow) return 0
  const weeks = Array.isArray(weekIds) ? weekIds : [weekIds].filter(Boolean)
  // flatRow may be single-week flat OR map weekId->flat or multi-week combined flat
  // Detect shape: if flatRow has weekId-scoped keys like "2026-01-05_mon_l_status" we handle both
  let total = 0
  for (const wid of weeks) {
    // try nested map
    const row = flatRow[wid] ? flatRow[wid] : flatRow
    if (!row) continue
    // If row contains week-prefixed keys, count those; else count mon_ etc only when wid matches row.week_id
    const isMultiKey = Object.keys(row).some(k => /^\d{4}-\d{2}-\d{2}_/.test(k))
    if (isMultiKey) {
      const prefix = `${wid}_`
      for (const k of Object.keys(row)) {
        if (k.startsWith(prefix) && k.endsWith('_status') && row[k]) total++
      }
    } else {
      // single-week flat
      if (weeks.length > 1 && row.week_id && row.week_id !== wid) continue
      const DKS = ['mon','tue','wed','thu','fri','sat']
      for (const dk of DKS) for (const mk of ['l','d']) if (row[`${dk}_${mk}_status`]) total++
      if (weeks.length > 1) break // counted once already in multi-flat shape?
    }
  }
  // If flatRow was a single combined object counting above would double count, so fallback simple scan:
  if (weeks.length > 1 && total === 0 && flatRow) {
    for (const k of Object.keys(flatRow)) {
      if (/^\d{4}-\d{2}-\d{2}_[a-z]{3}_[ld]_status$/.test(k) && flatRow[k]) total++
      else if (/^[a-z]{3}_[ld]_status$/.test(k) && flatRow[k]) total++
    }
    // dedup single-week keys when multi-week map not used: above counts 12 max, so for 2-week combined need per-week loop
    if (total <= 12) {
      // try per-day status embedded flat
      return total
    }
  }
  return total
}

// Simpler: compute from surveyData array map
export const computeProgress = (appSettings, surveyDataMap) => {
  const total = getSurveyTotalSlots(appSettings)
  const filled = (() => {
    if (!surveyDataMap) return 0
    if (Array.isArray(surveyDataMap)) {
      // array of flats
      return surveyDataMap.reduce((n, row) => {
        if (!row) return n
        let c = 0
        for (const dk of ['mon','tue','wed','thu','fri','sat']) for (const mk of ['l','d']) if (row[`${dk}_${mk}_status`]) c++
        return n + c
      }, 0)
    }
    if (typeof surveyDataMap === 'object') {
      const rows = Object.values(surveyDataMap).filter(Boolean)
      if (rows.length) return rows.reduce((n, row) => { let c=0; for(const dk of ['mon','tue','wed','thu','fri','sat']) for(const mk of ['l','d']) if(row[`${dk}_${mk}_status`]) c++; return n+c }, 0)
    }
    return 0
  })()
  return { filled, total, pct: total? Math.round(filled/total*100):0 }
}

// ── Dish-snapshot helpers ──
export const getSlotKey = (day, meal) =>
  `${day.substring(0, 3).toLowerCase()}_${meal === 'lunch' ? 'l' : 'd'}`

export const getDishSnapshot = (row, day, meal) => {
  try {
    const snap = row?.dish_snapshot
    if (!snap) return null
    const obj = typeof snap === 'string' ? JSON.parse(snap) : snap
    const list = obj?.[getSlotKey(day, meal)]
    return Array.isArray(list) && list.length ? list : null
  } catch { return null }
}

export const getSlotDishes = (row, day, meal, fallbackDishes = []) =>
  getDishSnapshot(row, day, meal) || (Array.isArray(fallbackDishes) ? fallbackDishes : [])

export const mergeDishSnapshot = (existing, day, meal, dishes) => {
  if (!Array.isArray(dishes) || dishes.length === 0) {
    return existing?.dish_snapshot || {}
  }
  const prev = existing?.dish_snapshot
  let obj = {}
  try {
    obj = typeof prev === 'string' ? JSON.parse(prev) : (prev && typeof prev === 'object' ? { ...prev } : {})
  } catch { obj = {} }
  obj[getSlotKey(day, meal)] = dishes
  return obj
}

// ── Auto-save hook ──
export const useSurveyAutoSave = () => {
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle')
  const saveTimerRef = useRef(null)

  const debouncedSave = useCallback(async (saveFn) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setAutoSaveStatus('saving')
    try {
      await saveFn()
      setAutoSaveStatus('saved')
      setTimeout(() => setAutoSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000)
    } catch { setAutoSaveStatus('idle') }
  }, [])

  const scheduleSave = useCallback(async (saveFn, delay = 600) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    return new Promise((resolve) => {
      saveTimerRef.current = setTimeout(async () => {
        resolve(await debouncedSave(saveFn))
      }, delay)
    })
  }, [debouncedSave])

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [])

  return { autoSaveStatus, scheduleSave, setAutoSaveStatus }
}

// ── Survey window messages (used by member app) ──

export const getSurveyWindowMessage = (appSettings = {}, userId = null) => {
  const mode = getSurveyWindowStatus(appSettings)
  const label = getSurveyWindowLabel(appSettings)
  if (mode === 'open') return `Survey forced OPEN by admin — bypassing schedule (${label}).`
  if (mode === 'closed') return `Survey forced CLOSED by admin — will not open at ${label}.`
  if (isSurveyOpen(appSettings, userId)) return `Survey window is open! (${label})`
  return `Survey window opens ${label}.`
}

export const formatEditTime = (h, m) => {
  const period = h >= 12 ? 'PM' : 'AM'
  let hh = h % 12
  if (hh === 0) hh = 12
  return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''} ${period}`
}

export const getEditWindow = (appSettings = {}, mealType) => {
  const open = mealType === 'lunch' ? parseHm(appSettings.lunch_edit_open, 20, 0) : parseHm(appSettings.dinner_edit_open, 12, 0)
  const close = mealType === 'lunch' ? parseHm(appSettings.lunch_edit_close, 11, 0) : parseHm(appSettings.dinner_edit_close, 15, 30)
  return { open: formatEditTime(open.h, open.m), close: formatEditTime(close.h, close.m) }
}