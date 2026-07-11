import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/firebaseClient'
import { useAuth } from '../admin/context'
import { getWeekDate, DAYS } from '../common/utils'

export const isRotiItem = (dish) => {
  const rotiKeywords = ['roti', 'naan', 'paratha', 'bread', 'chapati', 'puri']
  return rotiKeywords.some(k => dish.toLowerCase().includes(k))
}

export const isPortionItem = (dish) => {
  const portionKeywords = ["pulav", "pulao", "dal chawal", "dhal chawal", "biryani", "khichdi", "khichadi", "rice", "pilaf", "polo"]
  return portionKeywords.some(k => dish.toLowerCase().includes(k))
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
  if (day === 6 && hour >= 20) return true
  if (day === 0) return true
  if (day === 1 && hour < 11) return true
  return false
}

const parseHm = (val, defaultH, defaultM) => {
  const p = (val || '').split(':').map(Number)
  return (p.length === 2 && !isNaN(p[0]) && !isNaN(p[1])) ? { h: p[0], m: p[1] } : { h: defaultH, m: defaultM }
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

export function useSurveyData(weeklyMenu, appSettings = {}) {
  const { user } = useAuth()
  const [surveyData, setSurveyData] = useState(null)
  const [loading, setLoading] = useState(true)
  const currentWeekId = getWeekDate(appSettings)

  const loadSurvey = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try {
      const { data } = await supabase.from('survey_submissions_flat')
        .select('*').eq('user_id', user.id)
        .order('week_id', { ascending: false }).limit(1).maybeSingle()
      if (data && data.week_id === currentWeekId) {
        setSurveyData(data)
      } else {
        setSurveyData(null)
      }
    } catch { setSurveyData(null) }
    setLoading(false)
  }, [user, currentWeekId])

  useEffect(() => { loadSurvey() }, [loadSurvey])

  const getSlotStatus = useCallback((day, meal) => {
    if (!surveyData) return null
    const dk = day.substring(0, 3).toLowerCase()
    const mk = meal === 'lunch' ? 'l' : 'd'
    return surveyData[`${dk}_${mk}_status`] || null
  }, [surveyData])

  const getDishResponse = useCallback((day, meal, dishIdx) => {
    if (!surveyData) return null
    const dk = day.substring(0, 3).toLowerCase()
    const mk = meal === 'lunch' ? 'l' : 'd'
    const val = surveyData[`${dk}_${mk}_dish_${dishIdx + 1}`]
    if (val === undefined || val === null) return null
    if (val === 'Yes') return 'yes'
    if (val === 'No') return 'no'
    if (typeof val === 'string' && val.endsWith('%')) return parseInt(val.replace('%', ''))
    if (typeof val === 'string' && /^\d+$/.test(val)) return parseInt(val)
    return val
  }, [surveyData])

  const getEditCount = useCallback((day, meal) => {
    if (!surveyData) return 0
    const dk = day.substring(0, 3).toLowerCase()
    const mk = meal === 'lunch' ? 'l' : 'd'
    return (surveyData.edit_metadata || {})[`${dk}_${mk}`] || 0
  }, [surveyData])

  const dayStatusSummary = DAYS.map((day) => {
    const dk = day.substring(0, 3).toLowerCase()
    const lStatus = surveyData?.[`${dk}_l_status`]
    const dStatus = surveyData?.[`${dk}_d_status`]
    if (lStatus && dStatus) return 'complete'
    if (lStatus || dStatus) return 'partial'
    return 'pending'
  })

  const refresh = loadSurvey

  return { surveyData, loading, currentWeekId, dayStatusSummary, getSlotStatus, getDishResponse, getEditCount, refresh }
}

export function useSurveyAutoSave() {
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle')
  const saveTimerRef = useRef(null)
  const savingRef = useRef(false)

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

export function useSurveyWindow(appSettings = {}) {
  const { user } = useAuth()
  const surveyOpen = isSurveyOpen(appSettings, user?.id)
  const currentWeekId = getWeekDate(appSettings)

  const isAnyMealEditable = DAYS.some(d =>
    canEditMeal(d, currentWeekId, 'lunch', appSettings, user?.id) ||
    canEditMeal(d, currentWeekId, 'dinner', appSettings, user?.id)
  )

  const getSurveyWindowMessage = () => {
    if (appSettings.survey_status === 'open') return 'Survey window is open (Admin Override)!'
    if (surveyOpen) return 'Survey window is open! (Sat 8PM – Mon 11AM)'
    return 'Survey window opens Saturday 8:00 PM and closes Monday 11:00 AM.'
  }

  return { surveyOpen, isAnyMealEditable, currentWeekId, getSurveyWindowMessage }
}
