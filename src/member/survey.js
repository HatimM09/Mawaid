// Survey window logic shared by the member app.
// The core helpers are re-exported from hooks/useSurvey.js so there is a single
// source of truth (SurveyModal, DailyEditCard and the survey hooks use that copy).
import { hasUserOverride, isSurveyOpen, canEditMeal } from '../hooks/useSurvey'

export { hasUserOverride, isSurveyOpen, canEditMeal }

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
  if (isSurveyOpen(appSettings, userId)) return `Survey window is open! (Sat ${fmt(open)} – Mon ${fmt(close)})`
  return `Survey window opens Saturday ${fmt(open)} and closes Monday ${fmt(close)}.`
}

// Format minutes since midnight into a friendly 12-hour label
export const formatEditTime = (h, m) => {
  const period = h >= 12 ? 'PM' : 'AM'
  let hh = h % 12
  if (hh === 0) hh = 12
  return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''} ${period}`
}

// Daily quick-edit window (open → close) for a meal, from appSettings with defaults
export const getEditWindow = (appSettings = {}, mealType) => {
  const parseHm = (val, defaultH, defaultM) => {
    const p = (val || '').split(':').map(Number)
    return (p.length === 2 && !isNaN(p[0]) && !isNaN(p[1])) ? { h: p[0], m: p[1] } : { h: defaultH, m: defaultM }
  }
  const open = mealType === 'lunch' ? parseHm(appSettings.lunch_edit_open, 20, 0) : parseHm(appSettings.dinner_edit_open, 12, 0)
  const close = mealType === 'lunch' ? parseHm(appSettings.lunch_edit_close, 11, 0) : parseHm(appSettings.dinner_edit_close, 15, 30)
  return { open: formatEditTime(open.h, open.m), close: formatEditTime(close.h, close.m) }
}
