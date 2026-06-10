// Shared utilities for Al-Mawaid

/**
 * Returns the Monday of the target survey week as YYYY-MM-DD.
 * During the survey window (Saturday 8PM+ through Sunday), it advances
 * to the NEXT Monday since users are filling for the upcoming week.
 */
export const getWeekDate = () => {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  let diff = now.getDate() - day + (day === 0 ? -6 : 1)
  if (day === 0 || (day === 6 && hour >= 20)) {
    diff += 7
  }
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
export const MEALS = ['lunch', 'dinner']

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
