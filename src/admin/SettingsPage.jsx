// src/admin/SettingsPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/firebaseClient'
import { Save, RefreshCw, Calendar, Send, Clock, Trash2, Upload, Download, FileSpreadsheet } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Btn, Alert, Input, SectionHeader } from './ui'
import { getSurveyTargetWeek, getSurveyTargetWeeks, getSurveyCadence, getCalendarWeekDate, addWeeks, DAYS } from '../common/utils'
import { fetchWeekRows, fetchWeekRowsMulti } from '../lib/surveyRows'
import { DEFAULT_MENU } from '../common/constants'
import { isSurveyOpen } from '../hooks/useSurvey'
import { queryClient } from '../lib/queryClient'

const formatWeekLabel = (weekStart) => {
  const d = new Date(weekStart + 'T00:00:00')
  const end = new Date(d)
  end.setDate(end.getDate() + 5)
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}–${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}



// ── CSV Menu Import helpers ──
const DAY_ALIASES = {
  monday: 'monday', mon: 'monday', mo: 'monday',
  tuesday: 'tuesday', tue: 'tuesday', tues: 'tuesday', tu: 'tuesday',
  wednesday: 'wednesday', wed: 'wednesday', we: 'wednesday',
  thursday: 'thursday', thu: 'thursday', thur: 'thursday', thurs: 'thursday', th: 'thursday',
  friday: 'friday', fri: 'friday', fr: 'friday',
  saturday: 'saturday', sat: 'saturday', sa: 'saturday',
  sunday: 'sunday', sun: 'sunday', su: 'sunday',
}

const ARABIC_DAYS = {
  monday: 'الإثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
  sunday: 'الأحد',
}

const MAX_DISHES_PER_MEAL = 14

// RFC-4180 parser (handles quoted cells, commas, CRLF, semicolons, tabs)
const parseCSVRows = (text) => {
  if (!text) return []
  // Auto-detect delimiter if predominantly semicolon or tab
  const firstLine = text.split(/\r?\n/)[0] || ''
  const delimiter = (firstLine.split(';').length > firstLine.split(',').length) ? ';' :
                    (firstLine.split('\t').length > firstLine.split(',').length) ? '\t' : ','

  const rows = []
  let row = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      row.push(cur); cur = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur); cur = ''
      if (row.some(x => String(x).trim() !== '')) rows.push(row)
      row = []
    } else cur += c
  }
  if (cur !== '' || row.length) {
    row.push(cur)
    if (row.some(x => String(x).trim() !== '')) rows.push(row)
  }
  return rows
}

const cleanDishList = (dishes) => {
  const result = []
  dishes.forEach(d => {
    if (!d) return
    // Split on common list delimiters (newlines, commas, semicolons, bullets, slashes between words)
    const pieces = String(d).split(/[\n\r\t;•|]+|,\s*|\s*\/\s*(?=[A-Za-z0-9])/)
    pieces.forEach(p => {
      let cleaned = p.trim().replace(/^[-*•–—\d.)\s]+/, '').trim()
      cleaned = cleaned.replace(/^["']+|["']+$/g, '').trim()
      if (cleaned.length > 0 && !result.includes(cleaned)) {
        result.push(cleaned)
      }
    })
  })
  return result.slice(0, MAX_DISHES_PER_MEAL)
}

const matchDay = (str) => {
  if (!str) return null
  const s = String(str).toLowerCase().replace(/[^a-z]/g, '')
  for (const [alias, canonical] of Object.entries(DAY_ALIASES)) {
    if (s === alias || s.startsWith(alias)) return canonical
  }
  return null
}

const matchMeal = (str) => {
  if (!str) return null
  const s = String(str).toLowerCase()
  if (/\b(lunch|l)\b/i.test(s) || s.includes('lunch')) return 'lunch'
  if (/\b(dinner|d)\b/i.test(s) || s.includes('dinner')) return 'dinner'
  return null
}

// Robust Multi-Format Menu CSV parser (12 meals: Mon-Sat Lunch & Dinner)
const parseMenuCSV = (text) => {
  const rows = parseCSVRows(text)
  if (!rows.length) return { columns: [], byMeal: {} }

  const byMeal = {}
  DAYS.forEach(d => {
    byMeal[`${d}_lunch`] = { day: d, meal: 'lunch', dishes: [] }
    byMeal[`${d}_dinner`] = { day: d, meal: 'dinner', dishes: [] }
  })

  const headers = rows[0].map(h => String(h || '').trim())

  // Detection Strategy 1: Columnar format (e.g. "Monday Lunch", "Monday Dinner" / "Mon (Lunch)")
  const columnarMatches = headers.map((h, idx) => {
    const meal = matchMeal(h)
    if (!meal) return null
    const cleanH = h.toLowerCase().replace(/\b(lunch|dinner|menu|items?|dishes?|w1|w2|week\s*\d)\b/gi, '').trim()
    const day = matchDay(cleanH)
    if (!day) return null
    return { day, meal, idx }
  }).filter(Boolean)

  if (columnarMatches.length >= 2) {
    rows.slice(1).forEach(row => {
      columnarMatches.forEach(({ day, meal, idx }) => {
        const cell = row[idx]
        if (cell && String(cell).trim()) {
          byMeal[`${day}_${meal}`].dishes.push(cell)
        }
      })
    })
  } else {
    // Detection Strategy 2: Tabular format (e.g. Columns: Day, Lunch, Dinner or Day, Meal, Dishes)
    let dayCol = -1
    let lunchCol = -1
    let dinnerCol = -1
    let mealCol = -1
    let dishCol = -1

    headers.forEach((h, idx) => {
      const low = h.toLowerCase()
      if (/^day\b|^day_name|^weekday/i.test(low)) dayCol = idx
      else if (low === 'lunch' || low.includes('lunch')) lunchCol = idx
      else if (low === 'dinner' || low.includes('dinner')) dinnerCol = idx
      else if (low === 'meal' || low === 'meal_type') mealCol = idx
      else if (low === 'dish' || low === 'dishes' || low === 'menu' || low === 'items') dishCol = idx
    })

    if (dayCol === -1 && rows.length > 1) {
      const col0Days = rows.slice(1, 5).filter(r => matchDay(r[0]))
      if (col0Days.length > 0) dayCol = 0
    }

    if (dayCol !== -1 && lunchCol !== -1 && dinnerCol !== -1) {
      rows.slice(1).forEach(row => {
        const day = matchDay(row[dayCol])
        if (!day) return
        if (row[lunchCol]) byMeal[`${day}_lunch`].dishes.push(row[lunchCol])
        if (row[dinnerCol]) byMeal[`${day}_dinner`].dishes.push(row[dinnerCol])
      })
    } else if (dayCol !== -1 && mealCol !== -1 && dishCol !== -1) {
      rows.slice(1).forEach(row => {
        const day = matchDay(row[dayCol])
        const meal = matchMeal(row[mealCol])
        if (!day || !meal) return
        if (row[dishCol]) byMeal[`${day}_${meal}`].dishes.push(row[dishCol])
      })
    } else if (dayCol !== -1 && lunchCol !== -1) {
      rows.slice(1).forEach(row => {
        const day = matchDay(row[dayCol])
        if (!day) return
        if (row[lunchCol]) byMeal[`${day}_lunch`].dishes.push(row[lunchCol])
      })
    }
  }

  // Clean, split, and deduplicate all dishes
  const activeMeals = {}
  Object.keys(byMeal).forEach(key => {
    byMeal[key].dishes = cleanDishList(byMeal[key].dishes)
    if (byMeal[key].dishes.length > 0) {
      activeMeals[key] = byMeal[key]
    }
  })

  return { columns: columnarMatches, byMeal: activeMeals }
}

const BLANK_MENU = {
  monday: { lunch: '', dinner: '', ar: 'الإثنين' },
  tuesday: { lunch: '', dinner: '', ar: 'الثلاثاء' },
  wednesday: { lunch: '', dinner: '', ar: 'الأربعاء' },
  thursday: { lunch: '', dinner: '', ar: 'الخميس' },
  friday: { lunch: '', dinner: '', ar: 'الجمعة' },
  saturday: { lunch: '', dinner: '', ar: 'السبت' },
}

const capDay = (d) => d ? d.charAt(0).toUpperCase() + d.slice(1) : d

// Build a clean, ready-to-edit 1-week (12-meal) template
const buildMenuCSVTemplate = (seed = BLANK_MENU, forWeek = '') => {
  const dayKeys = DAYS
  const mk = m => m.charAt(0).toUpperCase() + m.slice(1)
  const quote = s => `"${String(s || '').replace(/"/g, '""')}"`

  const headers = dayKeys.flatMap(d => [`${mk(d)} Lunch`, `${mk(d)} Dinner`])
  const data = dayKeys.flatMap(d => [seed[d]?.lunch || 'Biryani, Roti, Salad', seed[d]?.dinner || 'Dal Rice, Sabzi'])
  const lines = [headers.join(','), data.map(quote).join(',')]
  return '\uFEFF' + lines.join('\n')
}

export default function SettingsPage() {
  const [menu, setMenu]         = useState(BLANK_MENU)
  const [helpline, setHelpline] = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState({ text: '', type: 'success' })

  // Weekly menu publish state
  // The admin edits/publishes ONE menu target at a time: the current calendar
  // week (what users see now) or the next week (what the survey form will show
  // once published). Default = the survey week so preparing next week's menu
  // during the Saturday window flows naturally.
  const calendarWeek = getCalendarWeekDate()
  const nextWeek = addWeeks(calendarWeek, 1)
  const week2 = addWeeks(calendarWeek, 2)
  const [targetWeek, setTargetWeek] = useState(() => getSurveyTargetWeek())
  const [surveyCadence, setSurveyCadence] = useState('1_week')
  const [publishAt, setPublishAt] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [dishInputConfig, setDishInputConfig] = useState({})
  const [clearing, setClearing] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [switchingWeek, setSwitchingWeek] = useState(false)
  // Fortnight menu cache: weekId -> menu
  const [fortnightCache, setFortnightCache] = useState({})

  // ── Weekly survey submission tracking + reminders ──
  const [weeklyTrack, setWeeklyTrack] = useState({ loading: false, submitted: [], pending: [], weekStart: '' })
  const [reminding, setReminding] = useState(false)

  const loadWeeklyTracking = useCallback(async () => {
    let settings = {}
    try {
      const { data: appSettings } = await supabase.from('app_settings').select('*')
      if (appSettings) appSettings.forEach(row => { settings[row.key] = row.value })
    } catch { /* ignore */ }
    const weekStart = getSurveyTargetWeek(settings)
    setWeeklyTrack(p => ({ ...p, loading: true, weekStart }))
    try {
      const [{ data: users }, { data: mergedRows }, { data: overrideRows }] = await Promise.all([
        supabase.from('user_stats').select('user_id, name, thali_number, email'),
        fetchWeekRows(weekStart),
        supabase.from('survey_day_responses').select('user_id, day, l_status, d_status').eq('week_id', weekStart),
      ])
      // Override-only users have no normal rows — treat any override response
      // for the week as "submitted" so reminders don't ping users who replied.
      const submittedIds = new Set((mergedRows || []).map(s => s.user_id))
      ;(overrideRows || []).forEach(o => submittedIds.add(o.user_id))
      const allUsers = (users || []).filter(u => u.user_id)
      setWeeklyTrack({
        loading: false,
        weekStart,
        submitted: allUsers.filter(u => submittedIds.has(u.user_id)),
        pending: allUsers.filter(u => !submittedIds.has(u.user_id)),
      })
    } catch (e) {
      console.error('Weekly tracking load error:', e)
      setWeeklyTrack(p => ({ ...p, loading: false }))
    }
  }, [])

  useEffect(() => { loadWeeklyTracking() }, [loadWeeklyTracking])

  const sendReminders = async () => {
    if (!weeklyTrack.pending.length) return
    setReminding(true)
    try {
      let notified = 0
      for (const u of weeklyTrack.pending) {
        try {
          await supabase.from('notifications').insert({
            user_id: u.user_id,
            title: '📋 Weekly Food Survey Reminder',
            message: 'You haven’t submitted your weekly food survey yet. Please fill it before the survey window closes.',
            url: '/survey',
            type: 'survey_reminder',
            sender_name: 'Al-Mawaid'
          })
          await supabase.functions.invoke('send-push', {
            body: {
              title: 'Al-Mawaid · Weekly Survey Reminder',
              body: 'Your weekly menu selections are still pending. Please submit before the survey window closes.',
              target_type: 'specific',
              user_id: u.user_id,
              url: '/survey'
            }
          })
          notified++
        } catch (e) { console.warn('Reminder failed for', u.user_id, e) }
      }
      setMsg({ text: `✅ Reminder sent to ${notified} member${notified === 1 ? '' : 's'} (${weeklyTrack.pending.length} pending in total).`, type: 'success' })
    } catch (e) {
      setMsg({ text: `Reminder failed: ${e.message}`, type: 'error' })
    }
    setReminding(false)
  }

  // Auto-save (debounced draft writer) + CSV import state
  const dirtyRef = useRef(false)
  const loadedRef = useRef(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [autoSavedAt, setAutoSavedAt] = useState(null)
  const fileInputRef = useRef(null)
  const [csvStatus, setCsvStatus] = useState(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const markDirty = () => { dirtyRef.current = true }

  useEffect(() => { load() }, [])

  // Keep cadence live (admin may flip it in Automation page)
  useEffect(() => {
    const ch = supabase.channel('settings-cadence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.survey_cadence' }, async (payload) => {
        const v = payload?.new?.value || payload?.old?.value
        if (v) setSurveyCadence(String(v).toLowerCase().includes('2') ? '2_weeks' : '1_week')
      })
      .subscribe()
    // initial fetch
    supabase.from('app_settings').select('value').eq('key', 'survey_cadence').maybeSingle().then(({ data }) => {
      if (data?.value) setSurveyCadence(String(data.value).toLowerCase().includes('2') ? '2_weeks' : '1_week')
    })
    return () => supabase.removeChannel(ch)
  }, [])

  const load = async (silent = false) => {
    // Silent (background realtime) refresh: skip the loading screen and never
    // overwrite state while the admin still has unsaved edits in progress.
    if (!silent) {
      setLoading(true)
    } else if (dirtyRef.current) {
      return
    }
    const commit = (fn) => {
      if (silent && dirtyRef.current) return false
      fn()
      return true
    }
    try {
      const { data: draftRow } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'draft_data')
        .maybeSingle()

      if (draftRow && draftRow.value) {
        const draft = JSON.parse(draftRow.value)
        commit(() => setHelpline(draft.helpline_number || ''))
        if (draft.dish_input_config) commit(() => setDishInputConfig(draft.dish_input_config))
        if (draft.drafts_by_week) {
          commit(() => setFortnightCache(draft.drafts_by_week))
          const currentDraft = draft.drafts_by_week[targetWeek]
          if (currentDraft?.menu) {
            commit(() => setMenu(currentDraft.menu))
            commit(() => setPublishAt(currentDraft.publishAt || ''))
          } else if (draft.menu && (draft.week_target === targetWeek || !draft.week_target)) {
            commit(() => setMenu(draft.menu))
            commit(() => setPublishAt(draft.publishAt || ''))
          }
        } else if (draft.menu) {
          commit(() => setMenu(draft.menu))
          if (draft.publishAt) commit(() => setPublishAt(draft.publishAt))
        }
        if (draft.week_target && !silent) commit(() => setTargetWeek(draft.week_target))
        setHasDraft(true)
      } else {
        const { data: settings } = await supabase.from('app_settings').select('*')
        if (settings) {
          settings.forEach(row => {
            if (row.key === 'helpline_number') commit(() => setHelpline(row.value))
            if (row.key === 'dish_input_config') { try { commit(() => setDishInputConfig(JSON.parse(row.value))) } catch(e) { commit(() => setDishInputConfig({})) } }
          })
        }
        const { data: menuData } = await supabase
          .from('weekly_menu')
          .select('*')
          .eq('week_start', targetWeek)
        if (menuData && menuData.length > 0) {
          const formatted = {}
          let hasPublishAt = null
          menuData.forEach(row => {
            formatted[row.day_name] = { lunch: row.lunch ? row.lunch.split(',').map(s => s.trim()).filter(Boolean).join(', ') : '', dinner: row.dinner ? row.dinner.split(',').map(s => s.trim()).filter(Boolean).join(', ') : '', ar: row.day_ar }
            if (row.publish_at) hasPublishAt = row.publish_at
          })
          commit(() => setMenu(formatted))
          commit(() => setPublishAt(hasPublishAt ? new Date(hasPublishAt).toISOString().slice(0, 16) : ''))
        } else {
          commit(() => setMenu(BLANK_MENU))
          commit(() => setPublishAt(''))
        }
        setHasDraft(false)
      }
    } catch (e) {
      console.error('Settings load error:', e)
    }
    if (!silent) dirtyRef.current = false
    setLoading(false)
    loadedRef.current = true
  }

  const loadRef = useRef(load)
  loadRef.current = load

  // ── SWITCH THE WEEK THE MENU EDITOR TARGETS ──
  // Cache current week's edits into fortnightCache so switching This Week / W1 / W2 never loses or overwrites data
  const changeTargetWeek = async (week) => {
    if (week === targetWeek) return
    // Stash current week's menu and publishAt into cache
    const updatedCache = { ...fortnightCache, [targetWeek]: { menu, publishAt } }
    setFortnightCache(updatedCache)

    setSwitchingWeek(true)
    setTargetWeek(week)

    // Check if the target week has cached in-memory edits
    if (updatedCache[week]?.menu) {
      setMenu(updatedCache[week].menu)
      setPublishAt(updatedCache[week].publishAt || '')
      setSwitchingWeek(false)
      return
    }

    try {
      const { data: menuData } = await supabase
        .from('weekly_menu')
        .select('*')
        .eq('week_start', week)
      if (menuData && menuData.length > 0) {
        const formatted = {}
        let hasPublishAt = null
        menuData.forEach(row => {
          formatted[row.day_name] = { lunch: row.lunch ? row.lunch.split(',').map(s => s.trim()).filter(Boolean).join(', ') : '', dinner: row.dinner ? row.dinner.split(',').map(s => s.trim()).filter(Boolean).join(', ') : '', ar: row.day_ar }
          if (row.publish_at) hasPublishAt = row.publish_at
        })
        setMenu(formatted)
        setPublishAt(hasPublishAt ? new Date(hasPublishAt).toISOString().slice(0, 16) : '')
      } else {
        setMenu(BLANK_MENU)
        setPublishAt('')
      }
    } catch (e) {
      console.error('Settings week switch error:', e)
    }
    setSwitchingWeek(false)
  }

  // ── REALTIME SUBSCRIPTION ──
  useEffect(() => {
    const channel = supabase
      .channel('settings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
        const key = payload?.new?.key ?? payload?.old?.key
        if (key === 'draft_data') return
        loadRef.current(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ── AUTO-SAVE ──
  useEffect(() => {
    if (!loadedRef.current || !dirtyRef.current) return
    const timer = setTimeout(async () => {
      dirtyRef.current = false
      setAutoSaving(true)
      const currentCache = {
        ...fortnightCache,
        [targetWeek]: { menu, publishAt }
      }
      const draft = {
        helpline_number: helpline,
        dish_input_config: dishInputConfig,
        drafts_by_week: currentCache,
        menu: menu,
        publishAt: publishAt,
        week_target: targetWeek,
      }
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'draft_data', value: JSON.stringify(draft) }, { onConflict: 'key' })
      setAutoSaving(false)
      if (!error) {
        setHasDraft(true)
        setAutoSavedAt(new Date())
      }
    }, 900)
    return () => clearTimeout(timer)
  }, [menu, helpline, dishInputConfig, publishAt, targetWeek, fortnightCache])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg({ text: '', type: 'success' })

    const currentCache = {
      ...fortnightCache,
      [targetWeek]: { menu, publishAt }
    }
    const draft = {
      helpline_number: helpline,
      dish_input_config: dishInputConfig,
      drafts_by_week: currentCache,
      menu: menu,
      publishAt: publishAt,
      week_target: targetWeek,
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'draft_data', value: JSON.stringify(draft) }, { onConflict: 'key' })

    setSaving(false)
    if (error) {
      setMsg({ text: `Save failed: ${error.message}`, type: 'error' })
    } else {
      setHasDraft(true)
      setMsg({ text: `✅ Draft saved. Use "Publish & Notify" to make changes live.`, type: 'success' })
    }
  }

  const updateMenu = (day, meal, val) => {
    markDirty()
    setMenu(prev => ({ ...prev, [day]: { ...prev[day], [meal]: val } }))
  }

  // Dish-level helpers — keeps individual fields synced with comma-separated text
  const getDishes = (day, meal) => {
    const text = menu[day]?.[meal] || ''
    return text ? text.split(', ') : []
  }

  const setDish = (day, meal, idx, val) => {
    const dishes = getDishes(day, meal)
    dishes[idx] = val
    updateMenu(day, meal, dishes.join(', '))
  }

  const addDish = (day, meal) => {
    const dishes = getDishes(day, meal)
    updateMenu(day, meal, [...dishes, ''].join(', '))
  }

  const removeDish = (day, meal, idx) => {
    let dishes = getDishes(day, meal)
    dishes = dishes.filter((_, i) => i !== idx)
    updateMenu(day, meal, dishes.filter(Boolean).join(', '))
  }

  // Dish input type helpers — 'count' or 'percentage'
  const getInputType = (day, meal, idx) => {
    const key = `${day}_${meal}`
    const config = dishInputConfig[key]
    return config?.[idx] || (meal === 'lunch' && idx <= 3 ? 'count' : 'percentage')
  }

  const toggleInputType = (day, meal, idx) => {
    markDirty()
    const key = `${day}_${meal}`
    setDishInputConfig(prev => {
      const config = { ...prev }
      if (!config[key]) config[key] = []
      const types = [...(config[key] || [])]
      const current = types[idx] || (meal === 'lunch' && idx <= 3 ? 'count' : 'percentage')
      types[idx] = current === 'count' ? 'percentage' : 'count'
      config[key] = types
      return config
    })
  }

  // ── CSV Menu Import ──
  const formatMealsToMenu = (byMeal) => {
    const next = { ...BLANK_MENU }
    Object.values(byMeal).forEach(({ day, meal, dishes }) => {
      if (!next[day]) next[day] = { lunch: '', dinner: '', ar: '' }
      next[day] = { ...next[day], [meal]: dishes.join(', ') }
    })
    return next
  }

  const [csvDragOver, setCsvDragOver] = useState(false)
  const [csvSummary, setCsvSummary] = useState(null)

  const handleCSVFile = async (file) => {
    if (!file) return
    setCsvLoading(true)
    setCsvStatus(null)
    setCsvSummary(null)
    try {
      const text = await file.text()
      const parsed = parseMenuCSV(text)
      const keys = Object.keys(parsed.byMeal)
      
      if (!keys.length) {
        setCsvStatus({
          type: 'error',
          text: 'Could not detect menu dishes. Please check that your CSV has headings like "Monday Lunch", "Monday Dinner", etc.'
        })
      } else {
        const newMenu = formatMealsToMenu(parsed.byMeal)
        setMenu(newMenu)
        markDirty()

        const totalDishes = keys.reduce((sum, k) => sum + parsed.byMeal[k].dishes.length, 0)
        const summary = DAYS.map(d => ({
          day: d,
          lunchCount: parsed.byMeal[`${d}_lunch`]?.dishes?.length || 0,
          dinnerCount: parsed.byMeal[`${d}_dinner`]?.dishes?.length || 0,
        }))
        setCsvSummary(summary)

        setCsvStatus({
          type: 'success',
          text: `✅ Successfully imported ${keys.length} meals (${totalDishes} dishes total) for ${targetWeek === calendarWeek ? 'This Week' : 'Next Week'} (${targetWeek}). Menu updated below and ready to publish!`
        })
      }
    } catch (e) {
      setCsvStatus({ type: 'error', text: `CSV import failed: ${e.message}` })
    } finally {
      setCsvLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const downloadCSVTemplate = () => {
    const csvContent = buildMenuCSVTemplate(menu, targetWeek)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `al_mawaid_weekly_menu_${targetWeek}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setCsvStatus({
      type: 'success',
      text: `✅ Clean weekly template (12 meals) downloaded with UTF-8 encoding. Open in Excel/Google Sheets, fill dishes, and upload.`
    })
  }

  if (loading) return (
    <PageWrap>
      <PageTitle>Settings</PageTitle>
      <div style={{ color: T.textSub, padding: '40px 0', textAlign: 'center' }}>Loading settings…</div>
    </PageWrap>
  )

  return (
    <PageWrap>
      <PageTitle>Settings</PageTitle>

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Helpline Settings */}
        <AdminCard>
          <SectionHeader>📞 Helpline</SectionHeader>
          <div>
            <Input 
              label="Helpline Number (WhatsApp)" 
              name="helpline"
              value={helpline} 
              onChange={e => { markDirty(); setHelpline(e.target.value) }} 
              placeholder="+91 98765 43210" 
            />
          </div>
        </AdminCard>

        {/* Weekly Menu — isolated per week_start (12 meals per week) */}
        <AdminCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            <SectionHeader style={{ marginBottom: 0 }}>🍽️ Weekly Menu</SectionHeader>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Week selector — This Week or Next Week only */}
              <div style={{
                display: 'inline-flex', background: T.inputBg, padding: 4, borderRadius: 14,
                border: `1px solid ${T.inputBorder}`, gap: 4,
              }}>
                {[
                  { id: calendarWeek, label: `This Week · ${formatWeekLabel(calendarWeek)}` },
                  { id: nextWeek, label: `Next Week · ${formatWeekLabel(nextWeek)}` }
                ].map(opt => {
                  const active = targetWeek === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={switchingWeek}
                      onClick={() => changeTargetWeek(opt.id)}
                      style={{
                        flex: 1, padding: '8px 14px', borderRadius: 10, border: 'none',
                        background: active ? T.accentGrad : 'transparent',
                        color: active ? '#000' : T.textSub,
                        fontSize: 11, fontWeight: active ? 900 : 700, cursor: switchingWeek ? 'wait' : 'pointer',
                        whiteSpace: 'nowrap', transition: 'all 0.2s', fontFamily: 'inherit',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: targetWeek === calendarWeek ? 'rgba(16,185,129,0.1)' : T.accentBg,
                border: `1px solid ${targetWeek === calendarWeek ? 'rgba(16,185,129,0.3)' : T.accentBorder}`,
                borderRadius: 8, padding: '4px 10px', fontSize: 11,
                color: targetWeek === calendarWeek ? '#34d399' : T.accent,
              }}>
                <Calendar size={12} /> {targetWeek === calendarWeek ? `Live now · ${targetWeek}` : `Survey week · ${targetWeek}`}
              </div>
            </div>
          </div>

          {targetWeek !== calendarWeek && (
            <div style={{
              marginBottom: 18, padding: '10px 14px', borderRadius: 10, fontSize: 12,
              background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.20)', color: T.textSub,
            }}>
              Editing next week's survey menu (12 meals).
            </div>
          )}

          {/* CSV Menu Import (Optimized & Frictionless) */}
          <div
            onDragOver={e => { e.preventDefault(); setCsvDragOver(true) }}
            onDragLeave={() => setCsvDragOver(false)}
            onDrop={e => {
              e.preventDefault()
              setCsvDragOver(false)
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleCSVFile(e.dataTransfer.files[0])
              }
            }}
            style={{
              marginBottom: 20, padding: 20, borderRadius: 18,
              boxSizing: 'border-box',
              background: csvDragOver
                ? 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(16,185,129,0.1))'
                : 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(99,102,241,0.02))',
              border: `2px ${csvDragOver ? 'dashed #818cf8' : 'solid rgba(99,102,241,0.25)'}`,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <FileSpreadsheet size={18} color="#818cf8" />
              <span style={{ fontSize: 13.5, fontWeight: 900, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Simple CSV Menu Importer
              </span>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                12 Meals (Mon–Sat)
              </span>
              {autoSaving && <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textSub }}>Auto-saving…</span>}
              {!autoSaving && autoSavedAt && !csvStatus && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#34d399', whiteSpace: 'nowrap' }}>● Auto-saved {autoSavedAt.toLocaleTimeString()}</span>
              )}
            </div>
            
            <p style={{ fontSize: 12, color: T.textSub, margin: '0 0 14px', lineHeight: 1.5 }}>
              Drag & drop your CSV file here, or click to upload. Sets up all 12 meal slots for <b style={{ color: T.text }}>{targetWeek === calendarWeek ? 'This Week' : 'Next Week'} ({targetWeek})</b>.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>
              <button
                type="button"
                disabled={csvLoading}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={{
                  flex: '1 1 220px', padding: '13px 18px', borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: '#6366f1', color: '#fff', border: 'none', cursor: csvLoading ? 'wait' : 'pointer',
                  fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
                  boxShadow: '0 6px 18px rgba(99,102,241,0.35)',
                  transition: 'all 0.2s',
                }}
              >
                <Upload size={17} /> {csvLoading ? 'Reading & Parsing…' : 'Upload CSV Menu'}
              </button>

              <button
                type="button"
                onClick={downloadCSVTemplate}
                style={{
                  flex: '0 0 auto', padding: '13px 16px', borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.03)', color: '#a5b4fc',
                  border: `1.5px dashed rgba(129,140,248,0.45)`,
                  cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
              >
                <Download size={15} /> Download Sample CSV
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={e => handleCSVFile(e.target.files && e.target.files[0])}
            />

            {/* Rich Import Status & 1-Click Publish */}
            {csvStatus && (
              <div style={{
                marginTop: 14, padding: '14px 16px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5,
                background: csvStatus.type === 'success' ? 'rgba(16,185,129,0.09)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${csvStatus.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: csvStatus.type === 'success' ? '#34d399' : '#f87171',
                fontWeight: 600,
              }}>
                <div style={{ marginBottom: csvSummary ? 10 : 0 }}>
                  {csvStatus.text}
                </div>

                {csvSummary && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {csvSummary.map(s => (
                      <span
                        key={s.day}
                        style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8,
                          background: (s.lunchCount > 0 && s.dinnerCount > 0) ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                          color: (s.lunchCount > 0 && s.dinnerCount > 0) ? '#34d399' : '#f59e0b',
                          border: `1px solid ${(s.lunchCount > 0 && s.dinnerCount > 0) ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
                        }}
                      >
                        {capDay(s.day).substring(0, 3)}: {s.lunchCount}L / {s.dinnerCount}D
                      </span>
                    ))}
                  </div>
                )}

                {csvStatus.type === 'success' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      disabled={publishing}
                      onClick={async () => {
                        setPublishing(true)
                        try {
                          const rows = Object.entries(menu).map(([day, val]) => ({
                            day_name: day,
                            week_start: targetWeek,
                            day_ar: val.ar || '',
                            lunch: val.lunch,
                            dinner: val.dinner,
                            publish_at: null,
                          }))
                          const { error: pErr } = await supabase.from('weekly_menu').upsert(rows, { onConflict: 'week_start,day_name' })
                          if (pErr) throw pErr
                          queryClient.invalidateQueries({ queryKey: ['weeklyMenu'] })
                          await supabase.from('app_settings').delete().eq('key', 'draft_data')
                          setHasDraft(false)
                          setMsg({ text: `🚀 Menu published live to ${targetWeek}! Members will now see this menu.`, type: 'success' })
                        } catch (err) {
                          setMsg({ text: `Publish error: ${err.message}`, type: 'error' })
                        } finally {
                          setPublishing(false)
                        }
                      }}
                      style={{
                        padding: '8px 16px', borderRadius: 8, border: 'none',
                        background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 900,
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                      }}
                    >
                      🚀 Publish Live to {targetWeek === calendarWeek ? 'This Week' : 'Next Week'} Now
                    </button>
                    <span style={{ fontSize: 11, color: T.textSub }}>or review edits below</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:`1px solid ${T.border}`, fontSize:11 }}>
            <span style={{ fontWeight:800, color:T.text }}>Per dish:</span>
            <span style={{ padding:'3px 8px', borderRadius:999, background:T.accentBg, border:`1px solid ${T.accentBorder}`, color:T.accent, fontWeight:800 }}>123 = Count</span>
            <span style={{ padding:'3px 8px', borderRadius:999, background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.25)', color:'#34d399', fontWeight:800 }}>% = Percentage</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {DAYS.map(day => (
              <div key={day}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.accent, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${T.border}` }}>
                  {day}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {['lunch', 'dinner'].map(meal => {
                    const dishes = getDishes(day, meal)
                    return (
                      <div key={meal}>
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ display: 'block', color: T.textSub, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{meal}</div>
                        </div>
                        {[...Array(Math.max(1, dishes.length))].map((_, idx) => {
                          const dishVal = dishes[idx] || ''
                          const isEmpty = idx >= dishes.length - (dishes[dishes.length - 1] === '' ? 1 : 0) || !dishes[idx]
                          return (
                            <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
                              <div style={{
                                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                                background: T.accentBg, border: `1px solid ${T.accentBorder}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 9, fontWeight: 900, color: T.accent, marginTop: 8,
                              }}>{idx + 1}</div>
                              <div style={{ flex: 1 }}>
                                <input
                                  type="text"
                                  name={`dish_${day}_${meal}_${idx}`}
                                  placeholder={`Dish ${idx + 1}`}
                                  value={dishVal}
                                  onChange={e => setDish(day, meal, idx, e.target.value)}
                                  style={{
                                    width: '100%', boxSizing: 'border-box',
                                    padding: '10px 12px', borderRadius: 8,
                                    background: isEmpty ? 'rgba(255,255,255,0.02)' : T.inputBg,
                                    border: `1px solid ${isEmpty ? 'rgba(255,255,255,0.06)' : T.inputBorder}`,
                                    color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
                                    transition: 'border-color 0.2s, background 0.2s',
                                  }}
                                  onFocus={e => {
                                    e.currentTarget.style.borderColor = T.accent
                                    e.currentTarget.style.background = T.inputBg
                                  }}
                                  onBlur={e => {
                                    e.currentTarget.style.borderColor = isEmpty ? 'rgba(255,255,255,0.06)' : T.inputBorder
                                    e.currentTarget.style.background = isEmpty ? 'rgba(255,255,255,0.02)' : T.inputBg
                                  }}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleInputType(day, meal, idx)}
                                title={`Input type: ${getInputType(day, meal, idx)}`}
                                style={{
                                  width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                                  background: getInputType(day, meal, idx) === 'count' ? T.accentBg : 'rgba(16,185,129,0.15)',
                                  border: `1px solid ${getInputType(day, meal, idx) === 'count' ? T.accentBorder : 'rgba(16,185,129,0.3)'}`,
                                  color: getInputType(day, meal, idx) === 'count' ? T.accent : '#34d399',
                                  fontSize: 9, fontWeight: 900, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  marginTop: 6, fontFamily: 'inherit', lineHeight: 1,
                                  padding: 0, minWidth: 30, minHeight: 30,
                                  transition: 'all 0.2s',
                                }}
                              >
                                {getInputType(day, meal, idx) === 'count' ? '123' : '%'}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeDish(day, meal, idx)}
                                style={{
                                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: '#ef4444', fontSize: 16, fontWeight: 700, lineHeight: 1,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  marginTop: 6, opacity: 0.5,
                                  transition: 'opacity 0.2s', fontFamily: 'inherit',
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                                title="Remove dish"
                              >×</button>
                            </div>
                          )
                        })}
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
                          <button
                            type="button"
                            onClick={() => addDish(day, meal)}
                            style={{
                              background: T.accentBg, border: `1px dashed ${T.accentBorder}`, borderRadius: 8,
                              color: T.accent, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              padding: '8px 16px', fontFamily: 'inherit', transition: '0.2s',
                              width: '100%',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = T.accent; e.currentTarget.style.color = '#000' }}
                            onMouseLeave={e => { e.currentTarget.style.background = T.accentBg; e.currentTarget.style.color = T.accent }}
                          >+ Add Dish</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </AdminCard>

        {/* Weekly Tracking */}
        <AdminCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <SectionHeader style={{ marginBottom: 0 }}>📊 Survey Submission Status ({targetWeek})</SectionHeader>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn type="button" size="sm" variant="outline" onClick={loadWeeklyTracking} disabled={weeklyTrack.loading}>
                <RefreshCw size={13} className={weeklyTrack.loading ? 'spin' : ''} /> Refresh
              </Btn>
              {weeklyTrack.pending.length > 0 && (
                <Btn type="button" size="sm" onClick={sendReminders} disabled={reminding}>
                  <Send size={13} /> Remind {weeklyTrack.pending.length} Pending
                </Btn>
              )}
            </div>
          </div>

          {weeklyTrack.loading ? (
            <div style={{ color: T.textSub, fontSize: 12, padding: '14px 0', textAlign: 'center' }}>Loading submission status…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Submitted */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#34d399', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  ✅ Submitted ({weeklyTrack.submitted.length})
                </div>
                {weeklyTrack.submitted.length === 0 ? (
                  <div style={{ padding: '14px', borderRadius: 10, background: T.inputBg, color: T.textSub, fontSize: 12, textAlign: 'center' }}>No submissions recorded yet for this week.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                    {weeklyTrack.submitted.map(u => (
                      <div key={u.user_id} style={{ padding: '8px 12px', borderRadius: 10, background: T.inputBg, border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Unknown'}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#34d399', background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: 20 }}>#{u.thali_number || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Pending */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#f87171', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>⏳ Pending</div>
                {weeklyTrack.pending.length === 0 ? (
                  <div style={{ padding: '14px', borderRadius: 10, background: T.inputBg, color: T.textSub, fontSize: 12, textAlign: 'center' }}>All members have submitted. 🎉</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                    {weeklyTrack.pending.map(u => (
                      <div key={u.user_id} style={{ padding: '8px 12px', borderRadius: 10, background: T.inputBg, border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Unknown'}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#f87171', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: 20 }}>#{u.thali_number || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </AdminCard>

        {/* ── Publish & Notify Card ── */}
        <AdminCard>
          <SectionHeader>🚀 Publish Menu &amp; Notify Members</SectionHeader>
          <p style={{ fontSize: 12, color: T.textSub, margin: '0 0 18px', lineHeight: 1.6 }}>
            Publishes the <strong style={{ color: T.accent }}>{targetWeek === calendarWeek ? 'This Week' : 'Next Week'}</strong> menu ({targetWeek}) to the database
            and immediately sends a push notification + in-app alert to <strong style={{ color: T.text }}>all members</strong>.
          </p>
          <button
            type="button"
            disabled={publishing}
            onClick={async () => {
              if (!window.confirm(`Publish menu for ${targetWeek} and notify ALL members now?`)) return
              setPublishing(true)
              setMsg({ text: '', type: 'success' })
              try {
                const publishTimestamp = new Date().toISOString()

                // 1. Save helpline + dish config
                await supabase.from('app_settings').upsert([
                  { key: 'helpline_number', value: helpline || '+91 98765 43210' },
                  { key: 'dish_input_config', value: JSON.stringify(dishInputConfig) },
                ], { onConflict: 'key' })

                // 2. Upsert menu rows for selected week only
                const menuRows = Object.entries(menu).map(([day, val]) => ({
                  day_name: day,
                  week_start: targetWeek,
                  day_ar: val.ar || ARABIC_DAYS[day] || '',
                  lunch: val.lunch,
                  dinner: val.dinner,
                  publish_at: null,
                }))
                const { error: menuErr } = await supabase
                  .from('weekly_menu')
                  .upsert(menuRows, { onConflict: 'week_start,day_name' })
                if (menuErr) throw menuErr

                queryClient.invalidateQueries({ queryKey: ['weeklyMenu'] })

                // 3. Clear draft
                await supabase.from('app_settings').delete().eq('key', 'draft_data')
                setHasDraft(false)

                // 4. In-app notifications to all members (chunked)
                const { data: allUsers } = await supabase.from('user_stats').select('user_id').limit(5000)
                const notifRows = (allUsers || []).map(u => ({
                  user_id: u.user_id,
                  title: '🍽️ New Weekly Menu Available',
                  message: `The menu for ${targetWeek === calendarWeek ? 'this week' : 'next week'} (${targetWeek}) is now live! Check it out in the app.`,
                  type: 'menu',
                  url: '/menu',
                  sender_name: 'Al-Mawaid',
                }))
                for (let i = 0; i < notifRows.length; i += 200) {
                  await supabase.from('notifications').insert(notifRows.slice(i, i + 200))
                }

                // 5. Push notification to all devices
                try {
                  await supabase.functions.invoke('send-push', {
                    body: {
                      title: '🍽️ Al-Mawaid · New Menu is Live',
                      body: `The ${targetWeek === calendarWeek ? "this week's" : "next week's"} thali menu (${targetWeek}) is ready — tap to see lunch & dinner!`,
                      target_type: 'all',
                      user_id: null,
                      url: '/menu',
                      notify_in_app: false,
                      sender_name: 'Al-Mawaid',
                    }
                  })
                } catch (pushErr) {
                  console.warn('[Settings] Push notification failed (menu published OK):', pushErr)
                }

                setMsg({ text: `✅ Menu published for ${targetWeek} — all members have been notified!`, type: 'success' })
              } catch (err) {
                setMsg({ text: `Publish failed: ${err.message}`, type: 'error' })
              } finally {
                setPublishing(false)
              }
            }}
            style={{
              width: '100%', padding: '16px 24px', borderRadius: 14, border: 'none',
              background: publishing ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff', fontSize: 15, fontWeight: 900,
              cursor: publishing ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: publishing ? 'none' : '0 6px 24px rgba(16,185,129,0.35)',
              transition: 'all 0.2s', fontFamily: 'inherit',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={e => { if (!publishing) e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <Send size={18} />
            {publishing
              ? 'Publishing & Notifying Members…'
              : `Publish ${targetWeek === calendarWeek ? 'This Week' : 'Next Week'} Menu & Notify All Members`
            }
          </button>
        </AdminCard>

        {msg.text && <Alert msg={msg.text} type={msg.type} />}

        {hasDraft && (
          <AdminCard>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '6px 0', flexWrap: 'wrap',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, flex: 1,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#f59e0b', flexShrink: 0,
                  animation: 'pulse 2s infinite',
                }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>
                    Unpublished Changes
                  </div>
                  <div style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>
                    Your draft is saved but not yet visible to users. Click <strong>"Publish & Notify"</strong> above to make changes live.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm('Discard all draft changes? This cannot be undone.')) return
                  await supabase.from('app_settings').delete().eq('key', 'draft_data')
                  setHasDraft(false)
                  setMsg({ text: 'Draft discarded. Reloading published settings...', type: 'info' })
                  load()
                }}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
              >
                Discard Draft
              </button>
            </div>
          </AdminCard>
        )}

        {/* Cache & Reset */}
        <AdminCard>
          <SectionHeader>🧹 Cache & Reset</SectionHeader>
          <p style={{ fontSize: 12, color: T.textSub, margin: '0 0 12px' }}>
            Clear all cached data on this device — service worker caches, local storage, and auth sessions.
            Menu and all server data in the database will not be affected.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn
              type="button"
              variant="danger"
              disabled={clearing}
              onClick={async () => {
                if (!window.confirm('Clear all cached data on this device? This will not affect the database or menu.')) return
                setClearing(true)
                try {
                  const keys = ['al_mawaid_portal', 'al_mawaid_mock_user', 'al_mawaid_restricted', 'al-mawaid-auth-token']
                  keys.forEach(k => localStorage.removeItem(k))
                  if ('caches' in window) {
                    const cacheKeys = await caches.keys()
                    await Promise.all(cacheKeys.map(k => caches.delete(k)))
                  }
                  const reg = await navigator.serviceWorker?.getRegistration()
                  if (reg) await reg.unregister()
                  setMsg({ text: '✅ Cache cleared. Reloading...', type: 'success' })
                  setTimeout(() => window.location.reload(), 1500)
                } catch (e) {
                  setMsg({ text: `Clear failed: ${e.message}`, type: 'error' })
                  setClearing(false)
                }
              }}
            >
              <Trash2 size={15} /> {clearing ? 'Clearing...' : 'Clear Device Cache & Reload'}
            </Btn>
          </div>
        </AdminCard>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{ marginRight: 'auto', fontSize: 11, color: T.textSub, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: autoSaving ? '#f59e0b' : '#34d399', display: 'inline-block' }} />
            {autoSaving ? 'Saving your changes…' : autoSavedAt ? `Auto-saved · ${autoSavedAt.toLocaleTimeString()}` : 'Your changes are saved automatically.'}
          </div>
          <Btn type="button" variant="ghost" onClick={load}><RefreshCw size={15} />Reset</Btn>
          <Btn type="submit" disabled={saving} size="lg">
            <Save size={16} />
            {saving ? 'Saving…' : 'Save Draft'}
          </Btn>
        </div>
      </form>
    </PageWrap>
  )
}
