// src/admin/SettingsPage.jsx
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/firebaseClient'
import { Save, RefreshCw, Calendar, Send, Clock, Trash2, Upload, Download, FileSpreadsheet } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Btn, Alert, Input, Select, SectionHeader } from './ui'
import { getWeekDate, getCalendarWeekDate, addWeeks } from '../common/utils'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday']

const formatWeekLabel = (weekStart) => {
  const d = new Date(weekStart + 'T00:00:00')
  const end = new Date(d)
  end.setDate(end.getDate() + 5)
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}–${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

const DEFAULT_MENU = {
  monday:    { lunch: 'Chola, Kulcha, Shreekhand, Dal, Chawal', dinner: 'FMB Menu' },
  tuesday:   { lunch: 'American Choupsey, Wafers, Butter Khichdi', dinner: 'Roti, Veg Jaipuri, Chicken Pulao, Soup' },
  wednesday: { lunch: 'Vegetable Sandwich, Bhel Salad, Corn Pulao', dinner: 'Roti, White Chicken, Manchurian Rice, Gravy' },
  thursday:  { lunch: 'Chicken 65, Corn Munch Salad, Dal Makhni, Chawal', dinner: 'Roti, Mango Custard, Matar Paneer, Tuwar Pulao, Palidu' },
  friday:    { lunch: 'FMB Menu', dinner: 'Roti, Gobi Matar, Chicken Kashmiri Pulao, Soup' },
  saturday:  { lunch: 'Chana Bateta, Dal Makhni, Chawal', dinner: 'Roti, Chicken Tarkari, Veg Coconut Rice, Kung Pao Gravy' },
}

const StatusToggle = ({ label, value, onChange, liveStatus }) => {
  const options = [
    { id: 'closed', label: '🔒 CLOSED', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' },
    { id: 'auto', label: '📅 AUTO', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.3)' },
    { id: 'open', label: '✅ OPEN', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)' }
  ]

  // When in AUTO mode, show live OPEN/CLOSED status based on current time
  const isLiveOpen = value === 'auto' && liveStatus === 'open'
  const isLiveClosed = value === 'auto' && liveStatus === 'closed'
  const showLiveBadge = value === 'auto' && liveStatus

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: T.textSub, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
        {showLiveBadge && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 10, fontSize: 9, fontWeight: 900,
            background: isLiveOpen ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            color: isLiveOpen ? '#10b981' : '#ef4444',
            border: `1px solid ${isLiveOpen ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: isLiveOpen ? '#10b981' : '#ef4444',
              animation: isLiveOpen ? 'pulse 2s infinite' : 'none'
            }} />
            {isLiveOpen ? 'OPEN' : 'CLOSED'}
          </div>
        )}
      </div>
      <div style={{ 
        display: 'flex', 
        background: T.inputBg, 
        padding: 4, 
        borderRadius: 14, 
        border: `1px solid ${T.inputBorder}`, 
        gap: 6,
        boxSizing: 'border-box'
      }}>
        {options.map(opt => {
          const active = value === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: 10,
                border: active ? `1px solid ${opt.color}` : '1px solid transparent',
                background: active ? opt.bg : 'transparent',
                color: active ? opt.color : T.textSub,
                fontSize: 13,
                fontWeight: active ? 900 : 700,
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                outline: 'none',
                fontFamily: 'inherit'
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Helper to check if a timing window is currently open based on configured auto-timings ──
const isTimingOpen = (type, appSettings) => {
  const now = new Date()
  const day = now.getDay()
  const minute = now.getHours() * 60 + now.getMinutes()

  if (type === 'lunch') {
    const openParts = (appSettings.lunch_edit_open || '20:00').split(':').map(Number)
    const closeParts = (appSettings.lunch_edit_close || '11:00').split(':').map(Number)
    const openMin = ((openParts[0] || 20) * 60 + (openParts[1] || 0))
    const closeMin = ((closeParts[0] || 11) * 60 + (closeParts[1] || 0))
    // If openMin > closeMin: prev-night window (e.g., 20:00 prev night to 11:00 same day)
    // If openMin <= closeMin: same-day window (e.g., 06:00 to 11:00)
    if (openMin > closeMin) {
      if (minute < closeMin) return true
      if (minute >= openMin) return true
    } else {
      if (minute >= openMin && minute < closeMin) return true
    }
    return false
  }

  if (type === 'dinner') {
    const openParts = (appSettings.dinner_edit_open || '12:00').split(':').map(Number)
    const closeParts = (appSettings.dinner_edit_close || '15:30').split(':').map(Number)
    const openMin = ((openParts[0] || 12) * 60 + (openParts[1] || 0))
    const closeMin = ((closeParts[0] || 15) * 60 + (closeParts[1] || 30))
    return minute >= openMin && minute < closeMin
  }

  return false
}

// ── Survey window (auto mode): Sat 8PM – Mon 11AM ──
const surveyTimingOpenNow = () => {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  if (day === 6 && hour >= 20) return true
  if (day === 0) return true
  if (day === 1 && hour < 11) return true
  return false
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
  const [lunchEditStatus, setLunchEditStatus] = useState('auto')
  const [dinnerEditStatus, setDinnerEditStatus] = useState('auto')
  const [helpline, setHelpline] = useState('')
  const [lunchEditOpen, setLunchEditOpen] = useState('20:00')
  const [lunchEditClose, setLunchEditClose] = useState('11:00')
  const [dinnerEditOpen, setDinnerEditOpen] = useState('12:00')
  const [dinnerEditClose, setDinnerEditClose] = useState('15:30')
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
  const [targetWeek, setTargetWeek] = useState(() => getWeekDate())
  const [publishAt, setPublishAt] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [dishInputConfig, setDishInputConfig] = useState({})
  const [clearing, setClearing] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [switchingWeek, setSwitchingWeek] = useState(false)

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
        setLunchEditStatus(draft.lunch_edit_status || 'auto')
        setDinnerEditStatus(draft.dinner_edit_status || 'auto')
        setHelpline(draft.helpline_number || '')
        setLunchEditOpen(draft.lunch_edit_open || '20:00')
        setLunchEditClose(draft.lunch_edit_close || '11:00')
        setDinnerEditOpen(draft.dinner_edit_open || '12:00')
        setDinnerEditClose(draft.dinner_edit_close || '15:30')
        if (draft.dish_input_config) setDishInputConfig(draft.dish_input_config)
        if (draft.menu) setMenu(draft.menu)
        if (draft.publishAt) setPublishAt(draft.publishAt)
        if (draft.week_target) setTargetWeek(draft.week_target)
        setHasDraft(true)
      } else {
        const { data: settings } = await supabase.from('app_settings').select('*')
        if (settings) {
          settings.forEach(row => {
            if (row.key === 'lunch_edit_status') setLunchEditStatus(row.value)
            if (row.key === 'dinner_edit_status') setDinnerEditStatus(row.value)
            if (row.key === 'helpline_number') setHelpline(row.value)
            if (row.key === 'lunch_edit_open') setLunchEditOpen(row.value)
            if (row.key === 'lunch_edit_close') setLunchEditClose(row.value)
            if (row.key === 'dinner_edit_open') setDinnerEditOpen(row.value)
            if (row.key === 'dinner_edit_close') setDinnerEditClose(row.value)
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
        lunch_edit_status: lunchEditStatus,
        dinner_edit_status: dinnerEditStatus,
        helpline_number: helpline,
        lunch_edit_open: lunchEditOpen,
        lunch_edit_close: lunchEditClose,
        dinner_edit_open: dinnerEditOpen,
        dinner_edit_close: dinnerEditClose,
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
  }, [menu, lunchEditStatus, dinnerEditStatus, helpline, lunchEditOpen, lunchEditClose, dinnerEditOpen, dinnerEditClose, dishInputConfig, publishAt])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg({ text: '', type: 'success' })

    const draft = {
      lunch_edit_status: lunchEditStatus,
      dinner_edit_status: dinnerEditStatus,
      helpline_number: helpline,
      lunch_edit_open: lunchEditOpen,
      lunch_edit_close: lunchEditClose,
      dinner_edit_open: dinnerEditOpen,
      dinner_edit_close: dinnerEditClose,
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

        {/* Meal Edit Controls */}
        <AdminCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
            <SectionHeader style={{ marginBottom: 0 }}>✏️ Meal Edit Controls</SectionHeader>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
            <StatusToggle label="Lunch Edits" value={lunchEditStatus} onChange={(v) => { markDirty(); setLunchEditStatus(v) }}
              liveStatus={lunchEditStatus === 'auto' ? (isTimingOpen('lunch', { lunch_edit_open: lunchEditOpen, lunch_edit_close: lunchEditClose }) ? 'open' : 'closed') : undefined} />
            <StatusToggle label="Dinner Edits" value={dinnerEditStatus} onChange={(v) => { markDirty(); setDinnerEditStatus(v) }}
              liveStatus={dinnerEditStatus === 'auto' ? (isTimingOpen('dinner', { dinner_edit_open: dinnerEditOpen, dinner_edit_close: dinnerEditClose }) ? 'open' : 'closed') : undefined} />
          </div>
          <div style={{
            marginTop: 16, padding: 16, borderRadius: 12,
            background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <Clock size={14} color="#6366f1" />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auto Timing Configuration</span>
              <span style={{ fontSize: 10, color: T.textSub, marginLeft: 'auto', opacity: 0.6 }}>Used when status is 📅 AUTO</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                padding: '14px 16px', borderRadius: 10,
                background: T.inputBg, border: `1px solid ${T.inputBorder}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 16 }}>☀️</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Lunch Edit Window</span>
                  <span style={{ fontSize: 10, color: T.textSub, opacity: 0.6 }}>prev night → same day</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
                  <div>
                    <label htmlFor="lunchEditOpen" style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Opens (prev night)</label>
                    <input type="time" id="lunchEditOpen" name="lunchEditOpen" value={lunchEditOpen} onChange={e => { markDirty(); setLunchEditOpen(e.target.value) }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, boxSizing: 'border-box', background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ fontSize: 16, color: T.accent, padding: '0 4px' }}>→</div>
                  <div>
                    <label htmlFor="lunchEditClose" style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Closes (same day)</label>
                    <input type="time" id="lunchEditClose" name="lunchEditClose" value={lunchEditClose} onChange={e => { markDirty(); setLunchEditClose(e.target.value) }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, boxSizing: 'border-box', background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{
                padding: '14px 16px', borderRadius: 10,
                background: T.inputBg, border: `1px solid ${T.inputBorder}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 16 }}>🌙</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Dinner Edit Window</span>
                  <span style={{ fontSize: 10, color: T.textSub, opacity: 0.6 }}>same day</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
                  <div>
                    <label htmlFor="dinnerEditOpen" style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Opens (same day)</label>
                    <input type="time" id="dinnerEditOpen" name="dinnerEditOpen" value={dinnerEditOpen} onChange={e => { markDirty(); setDinnerEditOpen(e.target.value) }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, boxSizing: 'border-box', background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ fontSize: 16, color: T.accent, padding: '0 4px' }}>→</div>
                  <div>
                    <label htmlFor="dinnerEditClose" style={{ display: 'block', color: T.textSub, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Closes (same day)</label>
                    <input type="time" id="dinnerEditClose" name="dinnerEditClose" value={dinnerEditClose} onChange={e => { markDirty(); setDinnerEditClose(e.target.value) }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, boxSizing: 'border-box', background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 10, color: T.textSub, marginTop: 12, opacity: 0.7, lineHeight: 1.65 }}>
              💡 When a meal's edit window closes <strong>the UI automatically shifts to the next meal</strong>. These timings are used when the corresponding toggle above is set to <strong>📅 AUTO</strong>. Changes take effect immediately via Realtime.
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
                      { key: 'lunch_edit_status', value: lunchEditStatus },
                      { key: 'dinner_edit_status', value: dinnerEditStatus },
                      { key: 'helpline_number', value: helpline || '+91 98765 43210' },
                      { key: 'lunch_edit_open', value: lunchEditOpen },
                      { key: 'lunch_edit_close', value: lunchEditClose },
                      { key: 'dinner_edit_open', value: dinnerEditOpen },
                      { key: 'dinner_edit_close', value: dinnerEditClose },
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
                            const surveyOpen = surveyCfg.survey_status === 'open'
                              || (!surveyCfg.survey_status && surveyTimingOpenNow())
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
