// Shared utilities for Al-Mawaid

/**
 * Returns the Monday of the target survey week as YYYY-MM-DD.
 * During the survey window (Saturday from surveyOpenHour through Sunday),
 * it advances to the NEXT Monday since users are filling for the upcoming week.
 * The open/close hour come from app_settings.survey_open_hour (default 20 = 8PM).
 */
export const getWeekDate = (surveyOpenHour = 20) => {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const openHour = parseInt(surveyOpenHour, 10)
  const open = isNaN(openHour) ? 20 : openHour
  let diff = now.getDate() - day + (day === 0 ? -6 : 1)
  if (day === 0 || (day === 6 && hour >= open)) {
    diff += 7
  }
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

/**
 * Returns the Monday of the survey target week (YYYY-MM-DD) — the week the
 * weekly survey is planning and the tracker displays.
 *
 * Identical to getWeekDate() EXCEPT when the survey is force-opened
 * (app_settings.survey_status = 'open'): members can then fill the weekly
 * survey at ANY hour, so Saturday shifts to the NEXT Monday all day instead of
 * only after the open hour. Without this, a Saturday-morning fill lands in the
 * PREVIOUS week's row — invisible in the current-week tracker view and later
 * deleted by its auto-cleanup. Daily-edit flows keep using getWeekDate().
 */
export const getSurveyTargetWeek = (surveyOpenHour = 20, forceOpen = false) => {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const open = parseInt(surveyOpenHour, 10)
  const openHour = isNaN(open) ? 20 : open
  let diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const satShift = day === 6 && (forceOpen || hour >= openHour)
  if (day === 0 || satShift) {
    diff += 7
  }
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

/**
 * Returns the Monday of the CURRENT calendar week as YYYY-MM-DD.
 * Unlike getWeekDate(), this never shifts forward during the survey
 * window (Sat 8PM – Mon 11AM). It is used wherever the app must keep
 * showing the CURRENT week's menu (Menu page, Today's menu & feedback)
 * while the weekly survey form targets the NEXT week's menu.
 */
export const getCalendarWeekDate = () => {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
export const MEALS = ['lunch', 'dinner']

/**
 * Format a Date as the local calendar date YYYY-MM-DD.
 * Unlike date.toISOString().split('T')[0] this never shifts the date when the
 * device is in a positive-UTC-offset timezone (local midnight becomes the
 * previous day in UTC), which caused stop-thali date ranges to be compared
 * against the wrong day.
 */
export const toLocalDateStr = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const getDayKey = (day) => day.substring(0, 3).toLowerCase()
export const getMealKey = (meal) => meal === 'lunch' ? 'l' : 'd'

export const addWeeks = (dateStr, weeks) => {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + weeks * 7)
  return date.toISOString().split('T')[0]
}

/**
 * Plays a short notification chime using the Web Audio API.
 * No external audio files required.
 */
/**
 * Check if a dish response value represents a count (vs percentage).
 * Count values are stored as raw numbers ("2"), percentage values as "25%", and yes/no as "Yes"/"No".
 */
export const isCountValue = (val) => {
  if (val === 'yes' || val === 'no' || val === 'Yes' || val === 'No') return false
  if (typeof val === 'string' && val.endsWith('%')) return false
  return true
}

/**
 * Parse a dish response value to a display number.
 * For count values ("2"): returns 2
 * For percentage values ("25%"): returns 25
 * For yes/no: returns 0
 */
export const parseDishValue = (val) => {
  if (val === 'yes' || val === 'no' || val === 'Yes' || val === 'No') return 0
  return parseInt(val) || 0
}

export const playNotificationChime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime

    // First tone (higher pitch)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)       // A5
    osc1.frequency.exponentialRampToValueAtTime(660, now + 0.2)
    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.15, now + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.3)

    // Second tone (lower, slightly delayed)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(660, now + 0.1)  // E5
    gain2.gain.setValueAtTime(0, now + 0.1)
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.1)
    osc2.stop(now + 0.5)

    // Auto-close after sound finishes
    setTimeout(() => ctx.close(), 600)
  } catch {
    // Audio not available — silently ignore
  }
}
