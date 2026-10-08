// ═══════════════════════════════════════════════════════════════
// AL-MAWAID — WhatsApp bot pure logic
// ═══════════════════════════════════════════════════════════════

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_TO_NUM = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
export const STAR_LABELS = { 1: '😞 Poor', 2: '😐 Fair', 3: '🙂 Good', 4: '😄 Great', 5: '🤩 Excellent' }
const ROTI_KEYWORDS = ['roti', 'naan', 'paratha', 'bread', 'chapati', 'puri']

export const DEFAULT_MENU = {
  monday:    { lunch: 'Chola, Kulcha, Shreekhand, Dal, Chawal', dinner: 'FMB Menu' },
  tuesday:   { lunch: 'American Choupsey, Wafers, Butter Khichdi', dinner: 'Roti, Veg Jaipuri, Chicken Pulao, Soup' },
  wednesday: { lunch: 'Vegetable Sandwich, Bhel Salad, Corn Pulao', dinner: 'Roti, White Chicken, Manchurian Rice, Gravy' },
  thursday:  { lunch: 'Chicken 65, Corn Munch Salad, Dal Makhni, Chawal', dinner: 'Roti, Mango Custard, Matar Paneer, Tuwar Pulao, Palidu' },
  friday:    { lunch: 'FMB Menu', dinner: 'Roti, Gobi Matar, Chicken Kashmiri Pulao, Soup' },
  saturday:  { lunch: 'Chana Bateta, Dal Makhni, Chawal', dinner: 'Roti, Chicken Tarkari, Veg Coconut Rice, Kung Pao Gravy' },
}

export const MEAL_ORDER = DAY_KEYS.flatMap(d => (['l', 'd']).map(m => ({ day: d, meal: m })))

export function mealLabel(day, meal) {
  const dayName = DAYS[DAY_KEYS.indexOf(day)] || day
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${meal === 'l' ? 'Lunch' : 'Dinner'} 🍽️`
}

export function statusPill(v) {
  if (v === 'Applied' || v === 'opted_in') return '✅ Applied'
  if (v === 'Skipped' || v === 'opted_out') return '❌ Skipped'
  return '⬜ —'
}

export function toLocalDateStr(d) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function weekdayName(d) {
  return WEEKDAY_NAMES[d.getUTCDay()]
}

export function calendarWeekMonday(now) {
  const day = now.getUTCDay()
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1)
  return toLocalDateStr(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff)))
}

export function addDaysStr(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return toLocalDateStr(new Date(Date.UTC(y, m - 1, d + days)))
}

export function parseHm(val, defaultH, defaultM) {
  const p = String(val || '').split(':').map(Number)
  return (p.length === 2 && !isNaN(p[0]) && !isNaN(p[1]))
    ? { h: p[0], m: p[1] }
    : { h: defaultH, m: defaultM }
}

export function formatHm(h, m) {
  const period = h >= 12 ? 'PM' : 'AM'
  let hh = h % 12
  if (hh === 0) hh = 12
  return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''} ${period}`
}

export function parseSurveyWindow(s = {}) {
  const startDayRaw = s.survey_window_start_day
  const startTimeRaw = s.survey_window_start_time
  const endDayRaw = s.survey_window_end_day
  const endTimeRaw = s.survey_window_end_time

  if (startDayRaw == null && startTimeRaw == null && endDayRaw == null && endTimeRaw == null) {
    if (s.survey_open_hour != null || s.survey_close_hour != null) {
      const openHour = parseInt(String(s.survey_open_hour), 10)
      const closeHour = parseInt(String(s.survey_close_hour), 10)
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
    const str = String(v).toLowerCase().trim()
    if (DAY_TO_NUM[str] != null) return DAY_TO_NUM[str]
    const n = parseInt(str, 10)
    if (!isNaN(n) && n >= 0 && n <= 6) return n
    return fallback
  }

  const start = parseHm(startTimeRaw, 20, 0)
  const end = parseHm(endTimeRaw, 11, 0)
  return {
    startDay: normalizeDay(startDayRaw, 6),
    startTime: { h: start.h, m: start.m },
    endDay: normalizeDay(endDayRaw, 1),
    endTime: { h: end.h, m: end.m },
  }
}

export function isSurveyOpen(appSettings, now) {
  const raw = String(appSettings.survey_window_status ?? appSettings.survey_status ?? 'auto').toLowerCase().trim()
  if (raw === 'open') return true
  if (raw === 'closed') return false
  const cfg = parseSurveyWindow(appSettings)
  const nowDay = now.getUTCDay()
  const nowMin = nowDay * 1440 + now.getUTCHours() * 60 + now.getUTCMinutes()
  const startMin = cfg.startDay * 1440 + cfg.startTime.h * 60 + cfg.startTime.m
  const endMin = cfg.endDay * 1440 + cfg.endTime.h * 60 + cfg.endTime.m
  if (startMin === endMin) return false
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin
  return nowMin >= startMin || nowMin < endMin
}

export function getSurveyTargetWeek(appSettings, now) {
  const override = String(appSettings.survey_target_week || '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(override)) return override
  const curMonday = calendarWeekMonday(now)
  const raw = String(appSettings.survey_window_status ?? appSettings.survey_status ?? 'auto').toLowerCase().trim()
  const isOpen = raw === 'open' ? true : raw === 'closed' ? false : isSurveyOpen(appSettings, now)
  return isOpen ? addDaysStr(curMonday, 7) : curMonday
}

export function getSurveyWindowLabel(appSettings) {
  const cfg = parseSurveyWindow(appSettings)
  const dayName = (d) => WEEKDAY_NAMES[d].charAt(0).toUpperCase() + WEEKDAY_NAMES[d].slice(1)
  return `${dayName(cfg.startDay)} ${formatHm(cfg.startTime.h, cfg.startTime.m)} – ${dayName(cfg.endDay)} ${formatHm(cfg.endTime.h, cfg.endTime.m)}`
}

export function formatWeekRange(weekId) {
  try {
    const [y, m, d] = weekId.split('-').map(Number)
    const start = new Date(Date.UTC(y, m - 1, d))
    const end = new Date(Date.UTC(y, m - 1, d + 5))
    const fmt = (dt) => dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    return `${fmt(start)} — ${fmt(end)}`
  } catch { return weekId }
}

export function parseDishArray(val) {
  if (!val) return []
  if (Array.isArray(val)) return val.map(x => String(x || '').trim()).filter(Boolean)
  return String(val)
    .split(/[\n\r,;•|]+/)
    .map(x => x.trim().replace(/^["']+|["']+$/g, ''))
    .filter(Boolean)
}

export function isRotiItem(dish) {
  const d = dish.toLowerCase()
  return ROTI_KEYWORDS.some(k => d.includes(k))
}

export function isCountInput(appSettings, dayNameFull, meal, idx) {
  try {
    const config = appSettings.dish_input_config
    if (!config) return false
    const parsed = typeof config === 'string' ? JSON.parse(String(config)) : config
    const key = `${dayNameFull.toLowerCase()}_${meal}`
    const types = parsed?.[key]
    return Boolean(types && types[idx] === 'count')
  } catch { return false }
}

export function resolveServingWeekId(appSettings, now) {
  if (now.getUTCDay() === 0) return getSurveyTargetWeek(appSettings, now)
  return calendarWeekMonday(now)
}

export function menuForDay(menuMap, dayKey) {
  const m = menuMap[dayKey]
  if (m && (m.lunch.length || m.dinner.length)) return m
  const full = DAYS[DAY_KEYS.indexOf(dayKey)] || dayKey
  const fallback = DEFAULT_MENU[full]
  if (!fallback) return null
  return {
    lunch: m?.lunch?.length ? m.lunch : parseDishArray(fallback.lunch),
    dinner: m?.dinner?.length ? m.dinner : parseDishArray(fallback.dinner),
  }
}

export function parseDishInput(raw, dishList, appSettings, dayKey, mealKey) {
  const trimmed = raw.trim()
  if (trimmed === '-' || trimmed.toLowerCase() === 'skip') {
    return { values: dishList.map(() => null) }
  }
  const parts = trimmed.split(/[,/]/).map(p => p.trim()).filter(p => p.length > 0)
  const dayNameFull = DAYS[DAY_KEYS.indexOf(dayKey)] || dayKey
  const mealName = mealKey === 'l' ? 'lunch' : 'dinner'
  const values = []
  for (let i = 0; i < dishList.length && i < 5; i++) {
    const dish = dishList[i]
    const part = parts[i]
    if (part == null || part === '-' || part === '') { values.push(null); continue }
    const p = part.toLowerCase()
    if (isRotiItem(dish)) {
      if (['yes', 'y', 'ha', 'haan', '1', '✅'].includes(p)) values.push('Yes')
      else if (['no', 'n', 'nahi', '0', '❌'].includes(p)) values.push('No')
      else return { values: [], error: `"${part}" isn't yes/no for *${dish}*.` }
    } else if (isCountInput(appSettings, dayNameFull, mealName, i)) {
      if (['no', 'n', '0', '❌'].includes(p)) values.push('No')
      else {
        const n = parseInt(p, 10)
        if (isNaN(n) || n < 0 || n > 20) return { values: [], error: `"${part}" isn't a count (0–20) for *${dish}*.` }
        values.push(String(n))
      }
    } else {
      if (['no', 'n', '❌'].includes(p)) values.push('0%')
      else if (['yes', 'y', '✅'].includes(p)) values.push('100%')
      else {
        const n = parseInt(p.endsWith('%') ? p.slice(0, -1) : p, 10)
        if (isNaN(n) || n < 0 || n > 100) return { values: [], error: `"${part}" isn't a 0–100 value for *${dish}*.` }
        values.push(`${n}%`)
      }
    }
  }
  return { values }
}

export function parseDateInput(raw, now) {
  const v = raw.trim().toLowerCase()
  if (v === 'today') return toLocalDateStr(now)
  if (v === 'tomorrow') return toLocalDateStr(new Date(now.getTime() + 86400_000))
  const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    const [, y, mo, d] = m
    const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
    if (dt.getUTCMonth() + 1 !== Number(mo)) return null
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const m2 = v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (m2) {
    const [, d, mo, y] = m2
    const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
    if (dt.getUTCMonth() + 1 !== Number(mo)) return null
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

export function normalizePhone(v) {
  let digits = String(v || '').replace(/[^\d]/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  return digits.slice(-10)
}
