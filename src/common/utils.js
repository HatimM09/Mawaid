// Shared utilities for Al-Mawaid

// @deprecated — use getSurveyTargetWeek() instead. Kept only for backward compatibility.
export const getWeekDate = (surveyOpenHour = 20) => getSurveyTargetWeek(surveyOpenHour, false)

// ── Survey window helpers (duplicated from useSurvey to avoid circular import) ──
const _DAY_TO_NUM = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }

const _parseSurveyWindowFromSettings = (appSettings = {}) => {
  let startDayRaw = appSettings.survey_window_start_day
  let startTimeRaw = appSettings.survey_window_start_time
  let endDayRaw = appSettings.survey_window_end_day
  let endTimeRaw = appSettings.survey_window_end_time
  if (startDayRaw == null && startTimeRaw == null && endDayRaw == null && endTimeRaw == null) {
    if (appSettings.survey_open_hour != null || appSettings.survey_close_hour != null) {
      const openHour = parseInt(appSettings.survey_open_hour, 10)
      const closeHour = parseInt(appSettings.survey_close_hour, 10)
      return {
        startDay: 6,
        startTime: { h: isNaN(openHour) ? 20 : openHour, m: 0 },
        endDay: 1,
        endTime: { h: isNaN(closeHour) ? 11 : closeHour, m: 0 },
      }
    }
  }
  const normalizeDay = (v, fallback) => {
    if (v == null || v === '') return fallback
    if (typeof v === 'number' && v >= 0 && v <= 6) return v
    const s = String(v).toLowerCase().trim()
    if (_DAY_TO_NUM[s] != null) return _DAY_TO_NUM[s]
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

const _isSurveyWindowOpen = (appSettings = {}, now = new Date()) => {
  const cfg = _parseSurveyWindowFromSettings(appSettings)
  const nowDay = now.getDay()
  const nowMin = nowDay * 1440 + now.getHours() * 60 + now.getMinutes()
  const startMin = cfg.startDay * 1440 + cfg.startTime.h * 60 + cfg.startTime.m
  const endMin = cfg.endDay * 1440 + cfg.endTime.h * 60 + cfg.endTime.m
  if (startMin === endMin) return false
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin
  return nowMin >= startMin || nowMin < endMin
}

/**
 * Returns the Monday of the survey target week (YYYY-MM-DD) — the week the
 * weekly survey is planning and the tracker displays.
 *
 * Now supports new admin-configurable window (survey_window_start_day/time,
 * survey_window_end_day/time). When called as getSurveyTargetWeek(appSettings)
 * it shifts to NEXT Monday when the window is open (so fills land in the
 * correct week). Legacy signature getSurveyTargetWeek(openHour, forceOpen) is
 * kept for backward compatibility.
 */
export const getSurveyTargetWeek = (surveyOpenHour = 20, forceOpen = false) => {
  // New signature: first arg is appSettings object — now fully dynamic
  // Survey week follows the admin's live window, not hardcoded Sat→Mon.
  // When window is open (including admin FORCE OPEN), we target NEXT calendar Monday
  // so fill/resume/edit lands in the week being planned; when closed we target current Monday.
  if (surveyOpenHour && typeof surveyOpenHour === 'object' && !Array.isArray(surveyOpenHour)) {
    const appSettings = surveyOpenHour
    if (appSettings.survey_target_week && /^\d{4}-\d{2}-\d{2}$/.test(appSettings.survey_target_week)) {
      return appSettings.survey_target_week
    }
    const now = new Date()
    const day = now.getDay()
    const curDiff = now.getDate() - day + (day === 0 ? -6 : 1)
    const curMonday = new Date(now.getFullYear(), now.getMonth(), curDiff)
    const curStr = toLocalDateStr(curMonday)
    const statusRaw = String(appSettings.survey_window_status ?? appSettings.survey_status ?? 'auto').toLowerCase().trim()
    const status = statusRaw === 'open' || statusRaw === 'closed' ? statusRaw : 'auto'
    let isOpen
    if (status === 'open') isOpen = true
    else if (status === 'closed') isOpen = false
    else isOpen = _isSurveyWindowOpen(appSettings, now)
    if (!isOpen) return curStr
    // window open → next week
    const next = new Date(curMonday.getFullYear(), curMonday.getMonth(), curMonday.getDate() + 7)
    return toLocalDateStr(next)
  }
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
  const monday = new Date(now.getFullYear(), now.getMonth(), diff)
  return toLocalDateStr(monday)
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
  const monday = new Date(now.getFullYear(), now.getMonth(), diff)
  return toLocalDateStr(monday)
}

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export const MEALS = ['lunch', 'dinner']

// ── Survey cadence (admin toggle: 1 week vs 2 weeks at once) ──
export const SURVEY_CADENCE_ONE = '1_week'
export const SURVEY_CADENCE_TWO = '2_weeks'

export const getSurveyCadence = (appSettings = {}) => {
  const raw = String(appSettings.survey_cadence || appSettings.surveyCadence || SURVEY_CADENCE_ONE).toLowerCase().trim()
  if (raw === '2' || raw === '2_weeks' || raw === '2weeks' || raw === 'two' || raw === 'biweekly' || raw === 'fortnight') return SURVEY_CADENCE_TWO
  return SURVEY_CADENCE_ONE
}
export const isTwoWeekCadence = (appSettings = {}) => getSurveyCadence(appSettings) === SURVEY_CADENCE_TWO
export const getSurveyCadenceLabel = (appSettings = {}) => isTwoWeekCadence(appSettings) ? '2 Weeks (12 days)' : '1 Week (6 days)'
export const getSurveyTotalSlots = (appSettings = {}) => isTwoWeekCadence(appSettings) ? 24 : 12

/**
 * Returns the ordered list of target week_ids (YYYY-MM-DD Mondays) the survey is planning.
 * 1_week → [W1]   2_weeks → [W1, W2=W1+7d]
 */
export const getSurveyTargetWeeks = (appSettings = {}) => {
  const w1 = getSurveyTargetWeek(appSettings)
  if (!isTwoWeekCadence(appSettings)) return [w1]
  const w2 = addWeeks(w1, 1)
  return [w1, w2]
}

export const formatWeekRange = (weekId) => {
  try {
    const [y, m, d] = String(weekId).split('-').map(Number)
    const start = new Date(y, m - 1, d)
    const end = new Date(y, m - 1, d + 5)
    const fmt = (dt) => dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    return `${fmt(start)} — ${fmt(end)}`
  } catch { return String(weekId || '') }
}

export const formatWeekShort = (weekId) => {
  try {
    const [y, m, d] = String(weekId).split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return String(weekId || '') }
}

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

/**
 * Returns the week_id (YYYY-MM-DD Monday) that OWNS a given real date for
 * survey-response storage. Dates inside the current calendar week belong to
 * the calendar week (where daily edits live); anything else belongs to the
 * survey target week. This is the link that keeps Daily Edit writes visible
 * in My Surveys and Admin Survey Tracking regardless of window state.
 */
export const getOwningWeekId = (date, appSettings = {}) => {
  const cal = getCalendarWeekDate()
  const target = getSurveyTargetWeek(appSettings)
  if (cal === target) return cal
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  const calStart = new Date(cal + 'T00:00:00')
  const calEnd = new Date(calStart)
  calEnd.setDate(calEnd.getDate() + 6)
  calEnd.setHours(23, 59, 59)
  return (d >= calStart && d <= calEnd) ? cal : target
}

/**
 * Does the given weekday NAME refer to a date inside the current calendar
 * week right now? (Today always does; tomorrow does too — except when today
 * is Sunday, because tomorrow is next week's Monday.)
 */
export const dayBelongsToCalendarWeek = (dayName) => {
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const t = new Date().getDay()
  const todayName = names[t]
  const tomorrowName = names[(t + 1) % 7]
  return dayName === todayName || (dayName === tomorrowName && t !== 0)
}

export const addWeeks = (dateStr, weeks) => {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + weeks * 7)
  return toLocalDateStr(date)
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

// ── Time parsing ──
// Parse "HH:MM" strings into {h, m} — used by survey windows, edit windows,
// and automation timing across the whole app. Centralised here so every
// consumer shares one implementation.
export const parseHm = (val, defaultH, defaultM) => {
  const p = (val || '').split(':').map(Number)
  return (p.length === 2 && !isNaN(p[0]) && !isNaN(p[1]))
    ? { h: p[0], m: p[1] }
    : { h: defaultH, m: defaultM }
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

// ── Stop-thali timeline helper ──
// A stop WITH a to_date is bounded: "no thali" only inside [from_date, to_date].
// A stop without a to_date stays active until a newer resume/stop overrides it.
export const isStoppedOnDay = (reqs, selDateStr, meal) => {
  let stopped = false
  ;(reqs || [])
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach(sr => {
      const coversMeal = !sr.meal_type || sr.meal_type === 'both' || sr.meal_type === meal
      if (!coversMeal) return
      const from = sr.from_date ? String(sr.from_date) : null
      const to = sr.to_date ? String(sr.to_date) : null
      if (from && selDateStr < from) return
      if (sr.kind === 'resume') {
        stopped = false
      } else if (sr.kind === 'stop') {
        stopped = to ? selDateStr <= to : true
      }
    })
  return stopped
}

/**
 * Robustly parse dish values from string, array, or CSV/newline-separated lists.
 * Handles commas, newlines, semicolons, bullets (•), and pipes (|).
 */
export const parseDishArray = (val) => {
  if (!val) return []
  if (Array.isArray(val)) {
    return val.map(s => String(s || '').trim()).filter(Boolean)
  }
  if (typeof val === 'string') {
    return val
      .split(/[\n\r,;•|]+/)
      .map(s => s.trim().replace(/^["']+|["']+$/g, ''))
      .filter(Boolean)
  }
  return []
}

