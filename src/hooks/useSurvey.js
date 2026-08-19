import { useState, useEffect, useCallback, useRef } from 'react'
import { DAYS, parseHm } from '../common/utils'

export const isRotiItem = (dish) => {
  const rotiKeywords = ['roti', 'naan', 'paratha', 'bread', 'chapati', 'puri']
  return rotiKeywords.some(k => dish.toLowerCase().includes(k))
}

export const getPctColor = (pct) => {
  if (pct === 0) return '#F44336'
  if (pct === 25) return '#FFC107'
  if (pct === 50) return '#2196F3'
  if (pct === 75) return '#9E9E9E'
  if (pct === 100) return '#4CAF50'
  return undefined
}

export const hasUserOverride = (appSettings = {}, userId = null, dayName = null, mealType = null) => {
  if (!userId || !appSettings.user_overrides) return false;
  try {
    const overrides = typeof appSettings.user_overrides === 'string'
      ? JSON.parse(appSettings.user_overrides)
      : appSettings.user_overrides;
    const userOverride = overrides[userId];
    if (!userOverride) return false;
    if (userOverride.all) return true;
    if (dayName) {
      const dayOverride = userOverride[dayName.toLowerCase()];
      if (dayOverride) {
        if (mealType) return !!dayOverride[mealType];
        return !!(dayOverride.lunch || dayOverride.dinner || dayOverride.all);
      }
    } else {
      return Object.keys(userOverride).length > 0;
    }
  } catch { }
  return false;
}

export const isSurveyOpen = (appSettings = {}, userId = null) => {
  if (userId && hasUserOverride(appSettings, userId)) return true
  if (appSettings.survey_status === 'open') return true
  if (appSettings.survey_status === 'closed') return false
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const openHour = parseInt(appSettings.survey_open_hour, 10)
  const closeHour = parseInt(appSettings.survey_close_hour, 10)
  const open = isNaN(openHour) ? 20 : openHour
  const close = isNaN(closeHour) ? 11 : closeHour
  if (day === 6 && hour >= open) return true
  if (day === 0) return true
  if (day === 1 && hour < close) return true
  return false
}

export const canEditMeal = (dayName, weekId, mealType, appSettings = {}, userId = null) => {
  if (hasUserOverride(appSettings, userId, dayName, mealType)) return true
  if (isSurveyOpen(appSettings)) return true
  if (mealType === 'lunch' && appSettings.lunch_edit_status === 'closed') return false
  if (mealType === 'lunch' && appSettings.lunch_edit_status === 'open') return true
  if (mealType === 'dinner' && appSettings.dinner_edit_status === 'closed') return false
  if (mealType === 'dinner' && appSettings.dinner_edit_status === 'open') return true
  const now = new Date()
  const weekStart = new Date(weekId)
  const dayIdx = DAYS.indexOf(dayName)
  if (dayIdx === -1) return false
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
  return meal === 'lunch' && idx <= 3
}

export const normalizeDishValue = (val, dish, isCount) => {
  if (val === undefined || val === null) return null
  if (isRotiItem(dish)) return val === 'yes' || val === 'Yes' ? 'yes' : 'no'
  if (isCount) {
    if (val === 'no' || val === 'No') return 'no'
    return { status: 'yes', value: parseInt(val) || 0 }
  }
  if (typeof val === 'string' && val.endsWith('%')) return parseInt(val) || 0
  if (val === 'yes' || val === 'Yes') return 100
  if (val === 'no' || val === 'No') return 0
  if (typeof val === 'number') return val
  return 0
}

export const denormalizeDishValue = (val, dish, isCount) => {
  if (val === 'yes') return isRotiItem(dish) ? 'Yes' : 'Yes'
  if (val === 'no') return 'No'
  if (isRotiItem(dish)) return val === 'yes' ? 'Yes' : 'No'
  if (isCount) {
    if (val === 'no' || val === null) return 'No'
    if (val?.status === 'yes') return String(val.value)
    return 'No'
  }
  if (typeof val === 'number') return `${val}%`
  return 'No'
}

// ── Dish-snapshot helpers ──
// Responses are stored positionally (mon_l_dish_1…6) with NO dish identity.
// To keep responses correctly labelled even when the admin later edits the
// menu, every writer stores the dish list it saved against in `dish_snapshot`
// (keyed by slot, e.g. { "mon_l": ["Dish A", …] }) and every reader resolves
// dish names from that snapshot, falling back to the current menu.

export const getSlotKey = (day, meal) =>
  `${day.substring(0, 3).toLowerCase()}_${meal === 'lunch' ? 'l' : 'd'}`

export const getDishSnapshot = (row, day, meal) => {
  try {
    const snap = row?.dish_snapshot
    if (!snap) return null
    const obj = typeof snap === 'string' ? JSON.parse(snap) : snap
    const list = obj?.[getSlotKey(day, meal)]
    return Array.isArray(list) && list.length ? list : null
  } catch {
    return null
  }
}

// Dish names to use for a slot: the saved snapshot if present, else the menu.
export const getSlotDishes = (row, day, meal, fallbackDishes = []) =>
  getDishSnapshot(row, day, meal) || (Array.isArray(fallbackDishes) ? fallbackDishes : [])

// Merge the dish list being saved into the row's snapshot (keeps all slots).
export const mergeDishSnapshot = (existing, day, meal, dishes) => {
  if (!Array.isArray(dishes) || dishes.length === 0) {
    return existing?.dish_snapshot || {}
  }
  const prev = existing?.dish_snapshot
  let obj = {}
  try {
    obj = typeof prev === 'string' ? JSON.parse(prev) : (prev && typeof prev === 'object' ? { ...prev } : {})
  } catch {
    obj = {}
  }
  obj[getSlotKey(day, meal)] = dishes
  return obj
}

export function useSurveyAutoSave() {
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle')
  const saveTimerRef = useRef(null)

  const debouncedSave = useCallback(async (saveFn) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setAutoSaveStatus('saving')
    try {
      await saveFn()
      setAutoSaveStatus('saved')
      setTimeout(() => setAutoSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000)
    } catch {
      setAutoSaveStatus('idle')
    }
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
  const openHour = parseInt(appSettings.survey_open_hour, 10)
  const closeHour = parseInt(appSettings.survey_close_hour, 10)
  const open = isNaN(openHour) ? 20 : openHour
  const close = isNaN(closeHour) ? 11 : closeHour
  const fmt = h => {
    const hh = h % 12 === 0 ? 12 : h % 12
    return `${hh}:00 ${h >= 12 ? 'PM' : 'AM'}`
  }
  if (appSettings.survey_status === 'open') return 'Survey window is open (Admin Override)!'
  if (isSurveyOpen(appSettings, userId)) return `Survey window is open! (Sat ${fmt(open)} \u2013 Mon ${fmt(close)})`
  return `Survey window opens Saturday ${fmt(open)} and closes Monday ${fmt(close)}.`
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
