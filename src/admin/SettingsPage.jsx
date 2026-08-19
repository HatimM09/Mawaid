// src/admin/SettingsPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/firebaseClient'
import { Save, RefreshCw, Calendar, Send, Clock, Trash2, Upload, Download, FileSpreadsheet } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Btn, Alert, Input, SectionHeader } from './ui'
import { getSurveyTargetWeek, getCalendarWeekDate, addWeeks, DAYS } from '../common/utils'
import { fetchWeekRows } from '../lib/surveyRows'
import { DEFAULT_MENU } from '../common/constants'
import { isSurveyOpen } from '../hooks/useSurvey'

const formatWeekLabel = (weekStart) => {
  const d = new Date(weekStart + 'T00:00:00')
  const end = new Date(d)
  end.setDate(end.getDate() + 5)
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}–${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}



// ── CSV Menu Import helpers ──
const DAY_ALIASES = {
  monday: 'monday', mon: 'monday',
  tuesday: 'tuesday', tue: 'tuesday', tues: 'tuesday',
  wednesday: 'wednesday', wed: 'wednesday',
  thursday: 'thursday', thu: 'thursday', thur: 'thursday',
  friday: 'friday', fri: 'friday',
  saturday: 'saturday', sat: 'saturday',
  sunday: 'sunday', sun: 'sunday',
}
const MAX_DISHES_PER_MEAL = 14

// RFC-4180-ish parser (handles quoted cells, commas, CRLF)
const parseCSVRows = (text) => {
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
    } else if (c === ',') {
      row.push(cur); cur = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur); cur = ''
      if (row.some(x => x.trim() !== '')) rows.push(row)
      row = []
    } else cur += c
  }
  if (cur !== '' || row.length) {
    row.push(cur)
    if (row.some(x => x.trim() !== '')) rows.push(row)
  }
  return rows
}

// Expected headers like "Monday Lunch", "Monday Dinner", "Tuesday Lunch", ...
const parseMenuCSV = (text) => {
  const rows = parseCSVRows(text)
  if (!rows.length) return { columns: [], byMeal: {} }
  const headers = rows[0].map(h => String(h).trim())

  const columns = headers.map((h, idx) => {
    const mealMatch = h.match(/\b(lunch|dinner)\b/i)
    if (!mealMatch) return null
    const meal = mealMatch[1].toLowerCase()
    const dayPart = h.replace(/\b(lunch|dinner|menu)\b/ig, '').trim().toLowerCase()
    const day = DAY_ALIASES[dayPart]
    if (!day) return null
    return { day, meal, idx }
  }).filter(Boolean)

  const byMeal = {}
  columns.forEach(({ day, meal }, i) => {
    const key = `${day}_${meal}`
    byMeal[key] = { day, meal, dishes: [] }
  })

  rows.slice(1).forEach(row => {
    columns.forEach(({ day, meal, idx }) => {
      const cell = row[idx] || ''
      ;(cell.split(/[;,\n]+/).map(s => s.trim()).filter(Boolean)).forEach(dish => {
        byMeal[`${day}_${meal}`].dishes.push(dish)
      })
    })
  })

  // Cap dish count and de-duplicate
  Object.keys(byMeal).forEach(key => {
    byMeal[key].dishes = [...new Set(byMeal[key].dishes)].slice(0, MAX_DISHES_PER_MEAL)
  })

  return { columns, byMeal }
}

const capDay = (d) => d ? d.charAt(0).toUpperCase() + d.slice(1) : d

// Build a ready-to-edit template seeded with the current/default menu
const buildMenuCSVTemplate = (seed = DEFAULT_MENU) => {
  const dayKeys = DAYS
  const mk = m => m.charAt(0).toUpperCase() + m.slice(1)
  const headers = dayKeys.flatMap(d => [`${mk(d)} Lunch`, `${mk(d)} Dinner`])
  const data = dayKeys.flatMap(d => [seed[d]?.lunch || '', seed[d]?.dinner || ''])
  const quote = s => `"${String(s || '').replace(/"/g, '""')}"`
  const lines = [headers.join(','), data.map(quote).join(',')]
  return lines.join('\n')
}

export default function SettingsPage() {
  const [menu, setMenu]         = useState(DEFAULT_MENU)
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
  const [targetWeek, setTargetWeek] = useState(() => getSurveyTargetWeek())
  const [publishAt, setPublishAt] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [dishInputConfig, setDishInputConfig] = useState({})
  const [clearing, setClearing] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [switchingWeek, setSwitchingWeek] = useState(false)

  // ── Weekly survey submission tracking + reminders ──
  const [weeklyTrack, setWeeklyTrack] = useState({ loading: false, submitted: [], pending: [], weekStart: '' })
  const [reminding, setReminding] = useState(false)

  const loadWeeklyTracking = useCallback(async () => {
    let openHour = 20
    let hourRow
    let statusRow
    try {
      const [hr, sr] = await Promise.all([
        supabase.from('app_settings').select('value').eq('key', 'survey_open_hour').maybeSingle(),
        supabase.from('app_settings').select('value').eq('key', 'survey_status').maybeSingle(),
      ])
      hourRow = hr
      statusRow = sr
    } catch {
      hourRow = { data: null }
    }
    const parsed = parseInt(hourRow?.value, 10)
    if (!isNaN(parsed)) openHour = parsed
    const weekStart = getSurveyTargetWeek(openHour, statusRow?.value === 'open')
    setWeeklyTrack(p => ({ ...p, loading: true, weekStart }))
    try {
      const [{ data: users }, { data: mergedRows }] = await Promise.all([
        supabase.from('user_stats').select('user_id, name, thali_number, email'),
        fetchWeekRows(weekStart),
      ])
      const submittedIds = new Set((mergedRows || []).map(s => s.user_id))
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
            message: 'You haven’t submitted your weekly food survey yet. Please fill it before the window closes (Mon 11 AM).',
            url: '/',
            type: 'survey_reminder',
            sender_name: 'Al-Mawaid'
          })
          await supabase.functions.invoke('send-push', {
            body: {
              title: 'Al-Mawaid · Weekly Survey Reminder',
              body: 'Your weekly menu selections are still pending. Submit before Monday 11:00 AM.',
              target_type: 'specific',
              user_id: u.user_id,
              url: '/'
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

  const load = async () => {
    setLoading(true)
    try {
      const { data: draftRow } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'draft_data')
        .maybeSingle()

      if (draftRow && draftRow.value) {
        const draft = JSON.parse(draftRow.value)
        setHelpline(draft.helpline_number || '')
        if (draft.dish_input_config) setDishInputConfig(draft.dish_input_config)
        if (draft.menu) setMenu(draft.menu)
        if (draft.publishAt) setPublishAt(draft.publishAt)
        if (draft.week_target) setTargetWeek(draft.week_target)
        setHasDraft(true)
      } else {
        const { data: settings } = await supabase.from('app_settings').select('*')
        if (settings) {
          settings.forEach(row => {
            if (row.key === 'helpline_number') setHelpline(row.value)
            if (row.key === 'dish_input_config') { try { setDishInputConfig(JSON.parse(row.value)) } catch(e) { setDishInputConfig({}) } }
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
          setMenu(formatted)
          setPublishAt(hasPublishAt ? new Date(hasPublishAt).toISOString().slice(0, 16) : '')
        } else {
          setMenu(DEFAULT_MENU)
          setPublishAt('')
        }
        setHasDraft(false)
      }
    } catch (e) {
      console.error('Settings load error:', e)
    }
    setLoading(false)
    loadedRef.current = true
  }

  const loadRef = useRef(load)
  loadRef.current = load

  // ── SWITCH THE WEEK THE MENU EDITOR TARGETS ──
  // Lets the admin prepare & publish NEXT week's menu on any day (even before
  // Saturday 8PM) without touching the current week users still see.
  const changeTargetWeek = async (week) => {
    if (week === targetWeek) return
    if (dirtyRef.current && !window.confirm('You have unsaved edits in the current week. Switch and discard them?')) return
    setSwitchingWeek(true)
    setTargetWeek(week)
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
        setMenu(DEFAULT_MENU)
        setPublishAt('')
      }
      dirtyRef.current = false
      setHasDraft(false)
    } catch (e) {
      console.error('Settings week switch error:', e)
    }
    setSwitchingWeek(false)
  }

  // ── REALTIME SUBSCRIPTION ──
  useEffect(() => {
    const channel = supabase
      .channel('settings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
        loadRef.current()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ── AUTO-SAVE ──
  // Debounces any user edit and writes the working state to the draft automatically,
  // so the admin only ever needs to hit "Publish & Notify".
  useEffect(() => {
    if (!loadedRef.current || !dirtyRef.current) return
    const timer = setTimeout(async () => {
      dirtyRef.current = false
      setAutoSaving(true)
      const draft = {
        helpline_number: helpline,
        dish_input_config: dishInputConfig,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, helpline, dishInputConfig, publishAt])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg({ text: '', type: 'success' })

    const draft = {
      helpline_number: helpline,
      dish_input_config: dishInputConfig,
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
  const applyCSVMenu = (byMeal) => {
    const next = { ...menu }
    Object.values(byMeal).forEach(({ day, meal, dishes }) => {
      if (!next[day]) next[day] = { lunch: '', dinner: '', ar: '' }
      next[day] = { ...next[day], [meal]: dishes.join(', ') }
    })
    setMenu(next)
    markDirty()
  }

  const handleCSVFile = async (file) => {
    if (!file) return
    setCsvLoading(true)
    setCsvStatus(null)
    try {
      const text = await file.text()
      const { columns, byMeal } = parseMenuCSV(text)
      const keys = Object.keys(byMeal)
      if (!keys.length) {
        setCsvStatus({ type: 'error', text: 'Could not find day+meal columns. Use headers like "Monday Lunch", "Monday Dinner", ...' })
      } else {
        applyCSVMenu(byMeal)
        const total = keys.reduce((sum, k) => sum + byMeal[k].dishes.length, 0)
        setCsvStatus({ type: 'success', text: `Imported ${keys.length} meals (${total} dishes). Auto-saved as draft — hit "Publish & Notify" when ready.` })
      }
    } catch (e) {
      setCsvStatus({ type: 'error', text: `CSV parse failed: ${e.message}` })
    } finally {
      setCsvLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const downloadCSVTemplate = () => {
    const blob = new Blob(['\uFEFF' + buildMenuCSVTemplate(menu)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `al_mawaid_menu_${targetWeek}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setCsvStatus({ type: 'success', text: 'Template downloaded. Fill the cells under each "Day Meal" heading, save as CSV, then upload it here.' })
  }

  if (loading) return (
    <PageWrap>
      <PageTitle>Settings</PageTitle>
      <div style={{ color: T.textSub, padding: '40px 0', textAlign: 'center' }}>Loading settings…</div>
    </PageWrap>
  )

  return (
    <PageWrap>
      <PageTitle sub="Manage weekly menu, payment, and app configuration">Settings</PageTitle>

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Helpline Settings */}
        <AdminCard>
          <SectionHeader>📞 Helpline Settings</SectionHeader>
          <div>
            <Input 
              label="Al Mawaid Helpline Number (WhatsApp)" 
              name="helpline"
              value={helpline} 
              onChange={e => { markDirty(); setHelpline(e.target.value) }} 
              placeholder="+91 98765 43210" 
            />
            <p style={{ fontSize: 11, color: T.textSub, marginTop: 8 }}>
              This number will be shown on the Khidmat team page for users to contact.
            </p>
          </div>
        </AdminCard>

        {/* Weekly Menu */}
        <AdminCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            <SectionHeader style={{ marginBottom: 0 }}>🍽️ Weekly Menu</SectionHeader>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Menu target week selector — current vs next week */}
              <div style={{
                display: 'inline-flex', background: T.inputBg, padding: 4, borderRadius: 14,
                border: `1px solid ${T.inputBorder}`, gap: 4,
              }}>
                {[{ id: calendarWeek, label: `This Week · ${formatWeekLabel(calendarWeek)}` },
                  { id: nextWeek, label: `Next Week · ${formatWeekLabel(nextWeek)}` }].map(opt => {
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
              marginBottom: 18, padding: '12px 16px', borderRadius: 12, fontSize: 12, lineHeight: 1.6,
              background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)', color: T.textSub,
            }}>
              <strong style={{ color: '#a5b4fc' }}>Preparing next week's menu.</strong> This menu is shown to users in the{' '}
              <strong style={{ color: T.text }}>weekly survey form</strong> (Sat 8PM – Mon 11AM) so they can choose dishes.
              Your members still see the <strong style={{ color: T.text }}>current week's menu</strong> on the Menu page and feedback
              until the new week begins on <strong style={{ color: '#a5b4fc' }}>{new Date(nextWeek + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</strong>.
            </div>
          )}

          {/* CSV Menu Import */}
          <div style={{
            marginBottom: 20, padding: 18, borderRadius: 16,
            boxSizing: 'border-box',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.07), rgba(99,102,241,0.02))',
            border: '1px solid rgba(99,102,241,0.22)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <FileSpreadsheet size={15} color="#818cf8" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Import Menu from CSV</span>
              {autoSaving && <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textSub }}>Auto-saving…</span>}
              {!autoSaving && autoSavedAt && !csvStatus && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#34d399', whiteSpace: 'nowrap' }}>● Auto-saved {autoSavedAt.toLocaleTimeString()}</span>
              )}
            </div>
            <p style={{ fontSize: 12, color: T.textSub, margin: '0 0 12px', lineHeight: 1.6 }}>
              Upload a CSV whose headings are <strong style={{ color: '#c7d2fe' }}>Monday Lunch, Monday Dinner, Tuesday Lunch</strong> … The dishes under each heading auto-fill the matching day &amp; meal. Leave a cell empty when a meal is finished.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>
              <button
                type="button"
                disabled={csvLoading}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={{
                  flex: '1 1 240px', padding: '14px 16px', borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: '#6366f1', color: '#fff', border: 'none', cursor: csvLoading ? 'wait' : 'pointer',
                  fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
                  boxShadow: '0 8px 20px rgba(99,102,241,0.35)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 26px rgba(99,102,241,0.45)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(99,102,241,0.3)' }}
              >
                <Upload size={18} /> {csvLoading ? 'Reading file…' : 'Upload CSV Menu'}
              </button>
              <button
                type="button"
                onClick={downloadCSVTemplate}
                style={{
                  flex: '0 0 auto', padding: '14px 16px', borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'transparent', color: '#a5b4fc',
                  border: `1.5px dashed rgba(129,140,248,0.5)`,
                  cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <Download size={16} /> Template
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={e => handleCSVFile(e.target.files && e.target.files[0])}
            />
            {csvStatus && (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5,
                background: csvStatus.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${csvStatus.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: csvStatus.type === 'success' ? '#34d399' : '#f87171',
                fontWeight: 600,
              }}>
                {csvStatus.text}
              </div>
            )}
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

        {/* Weekly Survey Submission Tracker */}
        <AdminCard>
          <SectionHeader>📋 Weekly Survey Submission</SectionHeader>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
            <div style={{ flex: '1 1 180px', padding: '14px 16px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#34d399' }}>{weeklyTrack.loading ? '…' : weeklyTrack.submitted.length}</div>
              <div style={{ fontSize: 11, color: T.textSub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Submitted</div>
            </div>
            <div style={{ flex: '1 1 180px', padding: '14px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#f87171' }}>{weeklyTrack.loading ? '…' : weeklyTrack.pending.length}</div>
              <div style={{ fontSize: 11, color: T.textSub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Pending</div>
            </div>
            <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
              <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.5 }}>
                Survey week: <strong style={{ color: T.accent }}>{weeklyTrack.weekStart ? new Date(weeklyTrack.weekStart + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</strong>
              </div>
              <Btn type="button" disabled={reminding || !weeklyTrack.pending.length || weeklyTrack.loading} onClick={sendReminders} style={{ padding: '10px 16px', fontSize: 13 }}>
                <Send size={14} /> {reminding ? 'Sending reminders…' : `Send Reminder to ${weeklyTrack.pending.length} pending`}
              </Btn>
            </div>
          </div>

          {weeklyTrack.loading ? (
            <div style={{ color: T.textSub, padding: '16px 0', textAlign: 'center' }}>Loading submissions…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Submitted */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#34d399', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>✅ Submitted</div>
                {weeklyTrack.submitted.length === 0 ? (
                  <div style={{ padding: '14px', borderRadius: 10, background: T.inputBg, color: T.textSub, fontSize: 12, textAlign: 'center' }}>No submissions yet.</div>
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

        {/* Publish Controls */}
        <AdminCard>
          <SectionHeader>📢 Publish Schedule</SectionHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 12, color: T.textSub, margin: 0 }}>
              Set when the <strong style={{ color: T.accent }}>{targetWeek === calendarWeek ? 'current' : 'next'}</strong> week's menu ({targetWeek}) becomes visible to users. Until published, users will not see it.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label htmlFor="publishAt" style={{ display: 'block', color: T.textSub, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Schedule Publish At
                </label>
                <input
                  type="datetime-local"
                  id="publishAt"
                  name="publishAt"
                  value={publishAt}
                  onChange={e => { markDirty(); setPublishAt(e.target.value) }}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 14px', borderRadius: 8,
                    background: T.inputBg, border: `1px solid ${T.inputBorder}`,
                    color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end', paddingBottom: 2 }}>
                <Btn
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    const now = new Date()
                    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
                    markDirty(); setPublishAt(now.toISOString().slice(0, 16))
                  }}
                >
                  <Clock size={14} /> Now
                </Btn>
                <Btn
                  type="button"
                  disabled={publishing}
                  onClick={async () => {
                    setPublishing(true)
                    setMsg({ text: '', type: 'success' })
                    const isFuture = publishAt && new Date(publishAt).getTime() > Date.now()
                    const publishTimestamp = isFuture ? new Date(publishAt).toISOString() : new Date().toISOString()

                    const settingsDefaults = [
                      { key: 'helpline_number', value: helpline || '+91 98765 43210' },
                      { key: 'dish_input_config', value: JSON.stringify(dishInputConfig) },
                    ]

                    const menuRows = Object.entries(menu).map(([day, val]) => ({
                      day_name: day,
                      week_start: targetWeek,
                      day_ar: val.ar || '',
                      lunch: val.lunch,
                      dinner: val.dinner,
                      publish_at: publishTimestamp,
                    }))

                    const { error: settingsErr } = await supabase
                      .from('app_settings')
                      .upsert(settingsDefaults, { onConflict: 'key' })

                    if (settingsErr) {
                      setMsg({ text: `Publish failed (settings): ${settingsErr.message}`, type: 'error' })
                    } else {
                      const { error: menuErr } = await supabase
                        .from('weekly_menu')
                        .upsert(menuRows, { onConflict: 'week_start,day_name' })

                      if (menuErr) {
                        setMsg({ text: `Publish failed (menu): ${menuErr.message}`, type: 'error' })
                      } else {
                        await supabase.from('app_settings').delete().eq('key', 'draft_data')
                        setHasDraft(false)
                        const publishingLiveWeek = targetWeek === calendarWeek

                        // Only announce when the LIVE (current calendar) week is published —
                        // the next week's menu reaches users through the survey form instead.
                        if (!isFuture && publishingLiveWeek) {
                          const { data: existingNotice } = await supabase
                            .from('notices').select('id').eq('type', 'menu')
                            .ilike('message', `%${targetWeek}%`).maybeSingle()
                          if (!existingNotice) {
                            try {
                              await supabase.from('notices').insert({
                                title: '🍽️ New Weekly Menu Available',
                                message: `The menu for week of ${targetWeek} is now live! Check it out in the app.`,
                                url: '/', type: 'menu',
                              })
                            } catch (_) { /* notice insert is best-effort */ }
                          }
                          try {
                            await supabase.functions.invoke('send-push', {
                              body: {
                                title: 'Al-Mawaid · New menu is live',
                                body: `This week’s thali menu (${targetWeek}) is ready — open the app to see lunch & dinner.`,
                                target_type: 'all',
                                user_id: null,
                                url: '/',
                              }
                            })
                          } catch (pushErr) {
                            console.warn('[Settings] Menu publish push notification failed:', pushErr)
                          }
                          setMsg({ text: `✅ Changes published and push notification sent!`, type: 'success' })
                        } else if (isFuture) {
                          setMsg({ text: `✅ Changes scheduled for ${new Date(publishAt).toLocaleString()}`, type: 'success' })
                        } else {
                          // Next week's menu published — if the weekly survey is open,
                          // notify members ONCE per week (dedup via app_settings marker)
                          // so they come and fill their meal choices.
                          try {
                            const { data: surveyRows } = await supabase.from('app_settings').select('key,value')
                            const surveyCfg = {}
                            ;(surveyRows || []).forEach(r => { surveyCfg[r.key] = r.value })
                            const surveyOpen = isSurveyOpen(surveyCfg)
                            if (surveyOpen) {
                              const { data: markerRow } = await supabase
                                .from('app_settings').select('value').eq('key', 'survey_notified_week').maybeSingle()
                              if (markerRow?.value !== targetWeek) {
                                await supabase.functions.invoke('send-push', {
                                  body: {
                                    title: '📝 Weekly Survey is Open',
                                    body: `Next week's menu is ready — fill your weekly survey (Sat 8PM – Mon 11AM) to choose your meals.`,
                                    target_type: 'all',
                                    notify_in_app: true,
                                    type: 'survey',
                                    sender_name: 'Al-Mawaid',
                                    url: '/'
                                  }
                                })
                                await supabase.from('app_settings')
                                  .upsert({ key: 'survey_notified_week', value: targetWeek, updated_at: new Date().toISOString() }, { onConflict: 'key' })
                              }
                            }
                          } catch (surveyErr) {
                            console.warn('Survey-open notification failed:', surveyErr)
                          }
                          setMsg({ text: `✅ Next week's menu (${targetWeek}) published — it will appear in the survey form and Menu page once that week begins.`, type: 'success' })
                        }
                        setPublishAt(publishTimestamp.slice(0, 16))
                      }
                    }
                    setPublishing(false)
                  }}
                >
                  <Send size={14} /> {publishing ? 'Publishing…' : 'Publish & Notify'}
                </Btn>
              </div>
            </div>
            {publishAt && (
              <div style={{
                fontSize: 11, color: T.textSub, marginTop: 4,
                padding: '8px 12px', borderRadius: 8,
                background: T.accentBg, border: `1px solid ${T.accentBorder}`,
              }}>
                <Calendar size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                {new Date(publishAt).getTime() > Date.now()
                  ? `Menu will go live on ${new Date(publishAt).toLocaleString()}`
                  : 'Menu is live and visible to users'}
              </div>
            )}
          </div>
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
