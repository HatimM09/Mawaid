// Unit tests for the WhatsApp bot's pure logic (logic.ts).
// Covers the rules mirrored from the member app: survey window,
// target-week resolution, date + dish-input parsing.
// Run: npm test
import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  toLocalDateStr, calendarWeekMonday, addDaysStr,
  isSurveyOpen, getSurveyTargetWeek, resolveServingWeekId,
  parseDishArray, isRotiItem, parseDishInput,
  parseDateInput, normalizePhone, verifySignature,
} from './logic.ts'

// Build a tz-frame Date the way the bot passes dates into logic.ts:
// the bot shifts the clock into the community timezone first (IST =
// UTC+5:30) and then reads only UTC accessors, so the UTC fields of
// the Date we construct here ARE the local wall-clock values.
const ist = (y: number, mo: number, d: number, h: number, m: number) =>
  new Date(Date.UTC(y, mo - 1, d, h, m))

describe('calendar math', () => {
  it('toLocalDateStr formats a shifted date', () => {
    expect(toLocalDateStr(new Date(Date.UTC(2026, 9, 6)))).toBe('2026-10-06')
  })

  it('calendarWeekMonday returns the Monday of the same week', () => {
    // 2026-10-07 is a Wednesday
    expect(calendarWeekMonday(new Date(Date.UTC(2026, 9, 7)))).toBe('2026-10-05')
  })

  it('calendarWeekMonday on a Sunday rolls back to the previous Monday', () => {
    // 2026-10-11 is a Sunday
    expect(calendarWeekMonday(new Date(Date.UTC(2026, 9, 11)))).toBe('2026-10-05')
  })

  it('addDaysStr crosses month boundaries', () => {
    expect(addDaysStr('2026-10-30', 7)).toBe('2026-11-06')
  })
})

describe('survey window (Sat 20:00 → Mon 11:00 IST, like the member app)', () => {
  const settings = {
    survey_window_start_day: 'saturday',
    survey_window_start_time: '20:00',
    survey_window_end_day: 'monday',
    survey_window_end_time: '11:00',
  }

  it('closed before the window opens', () => {
    expect(isSurveyOpen(settings, ist(2026, 10, 10, 19, 59))).toBe(false) // Sat 19:59
  })
  it('open at the start minute', () => {
    expect(isSurveyOpen(settings, ist(2026, 10, 10, 20, 0))).toBe(true) // Sat 20:00
  })
  it('still open late Monday morning', () => {
    expect(isSurveyOpen(settings, ist(2026, 10, 12, 10, 59))).toBe(true) // Mon 10:59
  })
  it('closed at the end minute (window is exclusive)', () => {
    expect(isSurveyOpen(settings, ist(2026, 10, 12, 11, 0))).toBe(false) // Mon 11:00
  })
  it('closed midweek', () => {
    expect(isSurveyOpen(settings, ist(2026, 10, 14, 10, 0))).toBe(false) // Wed
  })
  it('admin override beats the schedule', () => {
    expect(isSurveyOpen({ ...settings, survey_window_status: 'closed' }, ist(2026, 10, 11, 12, 0))).toBe(false)
    expect(isSurveyOpen({ ...settings, survey_status: 'open' }, ist(2026, 10, 14, 12, 0))).toBe(true)
  })
})

describe('survey target week resolution', () => {
  const settings = {
    survey_window_start_day: 'saturday',
    survey_window_start_time: '20:00',
    survey_window_end_day: 'monday',
    survey_window_end_time: '11:00',
  }

  it('closed → the current calendar Monday', () => {
    // Wed 2026-10-07 → calendar Monday 2026-10-05
    expect(getSurveyTargetWeek(settings, ist(2026, 10, 7, 12, 0))).toBe('2026-10-05')
  })
  it('open (Sat night) → next Monday', () => {
    // Sat 2026-10-10 20:30 → calendar Monday 10-05, window open → 10-12
    expect(getSurveyTargetWeek(settings, ist(2026, 10, 10, 20, 30))).toBe('2026-10-12')
  })
  it('open (Sunday) → next Monday', () => {
    expect(getSurveyTargetWeek(settings, ist(2026, 10, 11, 9, 0))).toBe('2026-10-12')
  })
  it('forced open midweek still targets next Monday', () => {
    expect(getSurveyTargetWeek({ ...settings, survey_window_status: 'open' }, ist(2026, 10, 7, 12, 0))).toBe('2026-10-12')
  })
  it('admin target override wins', () => {
    expect(getSurveyTargetWeek({ ...settings, survey_target_week: '2026-11-02' }, ist(2026, 10, 10, 20, 30))).toBe('2026-11-02')
  })
})

describe('serving week for menus', () => {
  const settings = {}
  it('on a Sunday uses the survey target week (window is open then)', () => {
    // Sun 2026-10-11 09:00 — default window Sat20:00→Mon11:00 is OPEN,
    // so the tracker/menu week has already rolled over to next Monday.
    expect(resolveServingWeekId(settings, ist(2026, 10, 11, 9, 0))).toBe('2026-10-12')
  })
  it('midweek uses the calendar Monday', () => {
    expect(resolveServingWeekId(settings, ist(2026, 10, 7, 12, 0))).toBe('2026-10-05')
  })
})

describe('date input parsing', () => {
  const now = ist(2026, 10, 7, 12, 0)
  it('today / tomorrow', () => {
    expect(parseDateInput('today', now)).toBe('2026-10-07')
    expect(parseDateInput('tomorrow', now)).toBe('2026-10-08')
  })
  it('ISO and DD-MM-YYYY', () => {
    expect(parseDateInput('2026-10-15', now)).toBe('2026-10-15')
    expect(parseDateInput('15/10/2026', now)).toBe('2026-10-15')
    expect(parseDateInput('15-10-2026', now)).toBe('2026-10-15')
  })
  it('rejects invalid dates and junk', () => {
    expect(parseDateInput('2026-13-40', now)).toBe(null)
    expect(parseDateInput('2026-02-31', now)).toBe(null)
    expect(parseDateInput('next friday', now)).toBe(null)
  })
})

describe('dish input parsing (canonical DB forms)', () => {
  const dishes = ['Rice', 'Dal', 'Roti', 'Soup']
  const settings = {}

  it('positional values: percentages by default, roti yes/no, extras ignored', () => {
    const r = parseDishInput('2,1,yes,no,50', dishes, settings, 'mon', 'l')
    expect(r.values).toEqual(['2%', '1%', 'Yes', '0%'])
  })
  it('whole skip leaves every dish blank', () => {
    const r = parseDishInput('-', dishes, settings, 'mon', 'l')
    expect(r.values).toEqual([null, null, null, null])
  })
  it('missing parts stay blank; extra parts ignored', () => {
    const r = parseDishInput('2', dishes, settings, 'mon', 'l')
    expect(r.values).toEqual(['2%', null, null, null])
  })
  it('invalid roti value errors', () => {
    const r = parseDishInput('2,1,maybe', dishes, settings, 'mon', 'l')
    expect(r.error).toBeTruthy()
    expect(r.values).toEqual([])
  })
  it('count dishes configured via dish_input_config', () => {
    const cfg = { dish_input_config: JSON.stringify({ monday_lunch: ['count'] }) }
    const r = parseDishInput('2', ['Rice', 'Dal'], cfg, 'mon', 'l')
    expect(r.values).toEqual(['2', null])
    // '0' on a count dish means No
    const r2 = parseDishInput('0', ['Rice', 'Dal'], cfg, 'mon', 'l')
    expect(r2.values).toEqual(['No', null])
  })
})

describe('menu + phone helpers', () => {
  it('parseDishArray splits on commas, pipes, newlines and bullets', () => {
    expect(parseDishArray('Rice, Dal | Roti\nSoup • Salad')).toEqual(['Rice', 'Dal', 'Roti', 'Soup', 'Salad'])
  })
  it('isRotiItem matches the app keywords', () => {
    expect(isRotiItem('Chapati')).toBe(true)
    expect(isRotiItem('Naan')).toBe(true)
    expect(isRotiItem('Chawal')).toBe(false)
  })
  it('normalizePhone strips country codes and separators', () => {
    expect(normalizePhone('919876543210')).toBe('9876543210')
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210')
    expect(normalizePhone('9876543210')).toBe('9876543210')
  })
})

// Gates every inbound webhook call: a mistake here means silent 401s from Meta.
describe('Meta webhook signature (X-Hub-Signature-256)', () => {
  const secret = 'test-app-secret-123'
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: '1' }] })
  // Reference digest exactly as Meta documents it (HMAC-SHA256 hex).
  const valid = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')

  it('accepts a correctly signed body', async () => {
    expect(await verifySignature(body, valid, secret)).toBe(true)
  })
  it('rejects a tampered body', async () => {
    expect(await verifySignature(body + ' ', valid, secret)).toBe(false)
  })
  it('rejects a signature from a different secret', async () => {
    expect(await verifySignature(body, valid, 'wrong-secret')).toBe(false)
  })
  it('rejects missing and malformed headers', async () => {
    expect(await verifySignature(body, null, secret)).toBe(false)
    expect(await verifySignature(body, 'abc123', secret)).toBe(false)
    expect(await verifySignature(body, '', secret)).toBe(false)
  })
  it('skips checking when no app secret is configured', async () => {
    expect(await verifySignature(body, null, '')).toBe(true)
  })
})
