// src/admin/SettingsPage.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Save, RefreshCw, Info, Calendar, Send, Clock } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Btn, Alert, Input, Select, SectionHeader } from './ui'
import { getWeekDate } from '../common/utils'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const addWeeks = (dateStr, weeks) => {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().split('T')[0]
}

const DEFAULT_MENU = {
  Monday:    { lunch: 'Chola, Kulcha, Shreekhand, Dal, Chawal', dinner: 'FMB Menu' },
  Tuesday:   { lunch: 'American Choupsey, Wafers, Butter Khichdi', dinner: 'Roti, Veg Jaipuri, Chicken Pulao, Soup' },
  Wednesday: { lunch: 'Vegetable Sandwich, Bhel Salad, Corn Pulao', dinner: 'Roti, White Chicken, Manchurian Rice, Gravy' },
  Thursday:  { lunch: 'Chicken 65, Corn Munch Salad, Dal Makhni, Chawal', dinner: 'Roti, Mango Custard, Matar Paneer, Tuwar Pulao, Palidu' },
  Friday:    { lunch: 'FMB Menu', dinner: 'Roti, Gobi Matar, Chicken Kashmiri Pulao, Soup' },
  Saturday:  { lunch: 'Chana Bateta, Dal Makhni, Chawal', dinner: 'Roti, Chicken Tarkari, Veg Coconut Rice, Kung Pao Gravy' },
}

const StatusToggle = ({ label, value, onChange }) => {
  const options = [
    { id: 'closed', label: '🔒 CLOSED', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' },
    { id: 'auto', label: '📅 AUTO', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.3)' },
    { id: 'open', label: '✅ OPEN', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)' }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ color: T.textSub, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</label>
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

export default function SettingsPage() {
  const [menu, setMenu]         = useState(DEFAULT_MENU)
  const [surveyStatus, setSurveyStatus] = useState('auto')
  const [lunchEditStatus, setLunchEditStatus] = useState('auto')
  const [dinnerEditStatus, setDinnerEditStatus] = useState('auto')
  const [surveyMsg, setSurveyMsg] = useState('')
  const [helpline, setHelpline] = useState('')
  const [surveyCloseHour, setSurveyCloseHour] = useState(8)
  const [lunchEditClose, setLunchEditClose] = useState('11:00')
  const [dinnerEditClose, setDinnerEditClose] = useState('15:30')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [quickSaving, setQuickSaving] = useState(false)
  const [msg, setMsg]           = useState({ text: '', type: 'success' })

  // Weekly menu publish state
  const thisWeek = getWeekDate()
  const nextWeek = addWeeks(thisWeek, 1)
  const [selectedWeek, setSelectedWeek] = useState(thisWeek)
  const [publishAt, setPublishAt] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [dishInputConfig, setDishInputConfig] = useState({})

  useEffect(() => { load() }, [selectedWeek])

  const load = async () => {
    setLoading(true)
    // Load general settings
    const { data: settings } = await supabase.from('app_settings').select('*')
    if (settings) {
      settings.forEach(row => {
        if (row.key === 'survey_status') setSurveyStatus(row.value)
        if (row.key === 'lunch_edit_status') setLunchEditStatus(row.value)
        if (row.key === 'dinner_edit_status') setDinnerEditStatus(row.value)
        if (row.key === 'survey_msg')    setSurveyMsg(row.value)
        if (row.key === 'helpline_number') setHelpline(row.value)
        if (row.key === 'survey_close_hour') setSurveyCloseHour(row.value)
        if (row.key === 'lunch_edit_close') setLunchEditClose(row.value)
        if (row.key === 'dinner_edit_close') setDinnerEditClose(row.value)
        if (row.key === 'dish_input_config') { try { setDishInputConfig(JSON.parse(row.value)) } catch(e) { setDishInputConfig({}) } }
      })
    }
    // Load weekly menu for selected week
    const { data: menuData } = await supabase
      .from('weekly_menu')
      .select('*')
      .eq('week_start', selectedWeek)
    if (menuData && menuData.length > 0) {
      const formatted = {}
      let hasPublishAt = null
      menuData.forEach(row => {
        formatted[row.day_name] = { lunch: row.lunch, dinner: row.dinner, ar: row.day_ar }
        if (row.publish_at) hasPublishAt = row.publish_at
      })
      setMenu(formatted)
      setPublishAt(hasPublishAt ? new Date(hasPublishAt).toISOString().slice(0, 16) : '')
    } else {
      setMenu(DEFAULT_MENU)
      setPublishAt('')
    }
    setLoading(false)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg({ text: '', type: 'success' })

    const settingsToSave = [
      { key: 'survey_status',    value: surveyStatus },
      { key: 'lunch_edit_status', value: lunchEditStatus },
      { key: 'dinner_edit_status', value: dinnerEditStatus },
      { key: 'survey_msg',       value: surveyMsg },
      { key: 'helpline_number',  value: helpline },
      { key: 'survey_close_hour', value: surveyCloseHour },
      { key: 'lunch_edit_close',  value: lunchEditClose },
      { key: 'dinner_edit_close', value: dinnerEditClose },
    ]

    let settingsError = null
    for (const row of settingsToSave) {
      const { data: existing } = await supabase
        .from('app_settings').select('id').eq('key', row.key).maybeSingle()
      if (existing) {
        const { error } = await supabase
          .from('app_settings').update({ value: row.value, updated_at: new Date().toISOString() }).eq('key', row.key)
        if (error) { settingsError = error; break }
      } else {
        const { error } = await supabase
          .from('app_settings').insert({ key: row.key, value: row.value })
        if (error) { settingsError = error; break }
      }
    }

    // 2. Save weekly menu with selected week and publish_at
    const publishTimestamp = publishAt ? new Date(publishAt).toISOString() : null
    const menuRows = Object.entries(menu).map(([day, val]) => ({
      day_name: day,
      week_start: selectedWeek,
      day_ar: val.ar || '',
      lunch: val.lunch,
      dinner: val.dinner,
      publish_at: publishTimestamp,
    }))
    const { error: menuError } = await supabase
      .from('weekly_menu')
      .upsert(menuRows, { onConflict: 'week_start,day_name' })

    // Send notification if menu is published for next week
    if (!menuError && publishTimestamp) {
      const publishDate = new Date(publishTimestamp)
      const now = new Date()
      // If publish_at is in the future, schedule a notification
      if (publishDate > now) {
        try {
          await supabase.functions.invoke('send-push', {
            body: {
              title: '📅 Next Week\'s Menu Published',
              body: `The menu for the week of ${selectedWeek} is now available! Check it out.`,
              target_type: 'all',
              url: '/menu'
            }
          })
        } catch (notifyErr) {
          console.warn('Menu publish notification failed:', notifyErr)
        }
      } else {
        // Published immediately - send notification now
        try {
          await supabase.functions.invoke('send-push', {
            body: {
              title: '🍽️ This Week\'s Menu Updated',
              body: 'The menu has been updated. Check out what\'s cooking!',
              target_type: 'all',
              url: '/menu'
            }
          })
        } catch (notifyErr) {
          console.warn('Menu update notification failed:', notifyErr)
        }
      }
    }

    // 3. Save dish input config
    let configError = null
    const { data: existingConfig } = await supabase
      .from('app_settings').select('id').eq('key', 'dish_input_config').maybeSingle()
    if (existingConfig) {
      const { error } = await supabase.from('app_settings')
        .update({ value: JSON.stringify(dishInputConfig), updated_at: new Date().toISOString() })
        .eq('key', 'dish_input_config')
      if (error) configError = error
    } else {
      const { error } = await supabase.from('app_settings')
        .insert({ key: 'dish_input_config', value: JSON.stringify(dishInputConfig) })
      if (error) configError = error
    }

    setSaving(false)
    const error = settingsError || menuError || configError
    const now = new Date().toLocaleTimeString()
    setMsg(error
      ? { text: `Save failed: ${error.message}`, type: 'error' }
      : { text: `✅ Settings saved at ${now}`, type: 'success' }
    )
  }

  const updateMenu = (day, meal, val) => {
    setMenu(prev => ({ ...prev, [day]: { ...prev[day], [meal]: val } }))
  }

  // Dish-level helpers — keeps individual fields synced with comma-separated text
  const getDishes = (day, meal) => {
    const text = menu[day]?.[meal] || ''
    return text.split(',').map(d => d.trim())
  }

  const setDish = (day, meal, idx, val) => {
    const dishes = getDishes(day, meal)
    dishes[idx] = val
    updateMenu(day, meal, dishes.join(', '))
  }

  const addDish = (day, meal) => {
    const curr = menu[day]?.[meal] || ''
    updateMenu(day, meal, curr ? curr + ', ' : '')
  }

  const removeDish = (day, meal, idx) => {
    let dishes = getDishes(day, meal)
    dishes = dishes.filter((_, i) => i !== idx)
    updateMenu(day, meal, dishes.join(', '))
  }

  // Dish input type helpers — 'count' or 'percentage'
  const getInputType = (day, meal, idx) => {
    const key = `${day}_${meal}`
    const config = dishInputConfig[key]
    return config?.[idx] || (meal === 'lunch' && idx <= 3 ? 'count' : 'percentage')
  }

  const toggleInputType = (day, meal, idx) => {
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

  // Quick-save just the survey toggles (no page scroll needed)
  const quickSaveSurveySettings = async () => {
    setQuickSaving(true)
    const toSave = [
      { key: 'survey_status',     value: surveyStatus },
      { key: 'lunch_edit_status', value: lunchEditStatus },
      { key: 'dinner_edit_status', value: dinnerEditStatus },
    ]
    let err = null
    for (const row of toSave) {
      const { error } = await supabase.from('app_settings')
        .update({ value: row.value, updated_at: new Date().toISOString() })
        .eq('key', row.key)
      if (error) { err = error; break }
    }
    setQuickSaving(false)
    if (err) {
      setMsg({ text: `Quick save failed: ${err.message}`, type: 'error' })
    } else {
      const now = new Date().toLocaleTimeString()
      setMsg({ text: `✅ Survey settings applied at ${now}`, type: 'success' })
    }
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

        {/* Survey Controls */}
        <AdminCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
            <SectionHeader style={{ marginBottom: 0 }}>🛠️ Survey Access Controls</SectionHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Live status pill */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                background: surveyStatus === 'open' ? 'rgba(16,185,129,0.12)' : surveyStatus === 'closed' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
                color: surveyStatus === 'open' ? '#10b981' : surveyStatus === 'closed' ? '#ef4444' : '#6366f1',
                border: `1px solid ${surveyStatus === 'open' ? 'rgba(16,185,129,0.3)' : surveyStatus === 'closed' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}`,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: surveyStatus === 'open' ? 'pulse 2s infinite' : 'none' }} />
                Survey: {surveyStatus.toUpperCase()}
              </div>
              <button
                type="button"
                onClick={quickSaveSurveySettings}
                disabled={quickSaving}
                style={{
                  padding: '8px 18px', borderRadius: 10, border: 'none',
                  background: 'var(--accent-grad)', color: '#000',
                  fontSize: 12, fontWeight: 900, cursor: quickSaving ? 'not-allowed' : 'pointer',
                  opacity: quickSaving ? 0.6 : 1, transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {quickSaving ? '⏳ Saving…' : '⚡ Apply Now'}
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
            <StatusToggle label="Global Survey Status" value={surveyStatus} onChange={setSurveyStatus} />
            <StatusToggle label="Lunch Edits" value={lunchEditStatus} onChange={setLunchEditStatus} />
            <StatusToggle label="Dinner Edits" value={dinnerEditStatus} onChange={setDinnerEditStatus} />
          </div>
          <p style={{ fontSize: 11, color: T.textSub, margin: '12px 0 0', opacity: 0.7 }}>
            💡 Click <strong>⚡ Apply Now</strong> to instantly push survey toggle changes to all users — no page reload needed.
          </p>
        </AdminCard>

        {/* Response Time Configuration */}
        <AdminCard>
          <SectionHeader>⏰ Response Time Settings</SectionHeader>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <div>
              <label style={{ display: 'block', color: T.textSub, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Survey Close Hour (Mon)</label>
              <input type="number" name="surveyCloseHour" min={0} max={23} value={surveyCloseHour} onChange={e => setSurveyCloseHour(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, boxSizing: 'border-box', background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <p style={{ fontSize: 10, color: T.textSub, marginTop: 4, opacity: 0.7 }}>0-23 (Default: 8 for 8AM)</p>
            </div>
            <div>
              <label style={{ display: 'block', color: T.textSub, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Lunch Edit Close Time</label>
              <input type="time" name="lunchEditClose" value={lunchEditClose} onChange={e => setLunchEditClose(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, boxSizing: 'border-box', background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <p style={{ fontSize: 10, color: T.textSub, marginTop: 4, opacity: 0.7 }}>HH:MM (Default: 11:00)</p>
            </div>
            <div>
              <label style={{ display: 'block', color: T.textSub, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Dinner Edit Close Time</label>
              <input type="time" name="dinnerEditClose" value={dinnerEditClose} onChange={e => setDinnerEditClose(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, boxSizing: 'border-box', background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <p style={{ fontSize: 10, color: T.textSub, marginTop: 4, opacity: 0.7 }}>HH:MM (Default: 15:30)</p>
            </div>
          </div>
          <p style={{ fontSize: 11, color: T.textSub, marginTop: 12, opacity: 0.7 }}>
            💡 These times control when users can edit their meal selections. Changes take effect immediately via Realtime.
          </p>
        </AdminCard>

        {/* Survey Banner */}
        <AdminCard>
          <SectionHeader>📢 Survey Notice</SectionHeader>
          <div>
            <label style={{ display: 'block', color: T.textSub, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
              Custom Message (shown when survey is closed)
            </label>
            <textarea
              name="surveyMsg"
              value={surveyMsg}
              onChange={e => setSurveyMsg(e.target.value)}
              rows={3}
              placeholder="Survey opens Saturday at 8:00 PM."
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical',
                padding: '12px 14px', borderRadius: 10,
                background: T.inputBg, border: `1px solid ${T.inputBorder}`,
                color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
        </AdminCard>

        {/* Helpline Settings */}
        <AdminCard>
          <SectionHeader>📞 Helpline Settings</SectionHeader>
          <div>
            <Input 
              label="Al Mawaid Helpline Number (WhatsApp)" 
              name="helpline"
              value={helpline} 
              onChange={e => setHelpline(e.target.value)} 
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
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <select
                value={selectedWeek}
                onChange={e => setSelectedWeek(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: 8, fontSize: 12,
                  background: T.inputBg, border: `1px solid ${T.inputBorder}`,
                  color: T.text, outline: 'none', fontFamily: 'inherit', cursor: 'pointer'
                }}
              >
                <option value={thisWeek}>Week of {thisWeek} (Current)</option>
                <option value={nextWeek}>Week of {nextWeek} (Next)</option>
              </select>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: T.accentBg, border: `1px solid ${T.accentBorder}`,
                borderRadius: 8, padding: '4px 10px', fontSize: 11, color: T.accent,
              }}>
                <Info size={12} /> {selectedWeek === thisWeek ? 'Current week' : 'Next week'}
              </div>
            </div>
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
                          <label style={{ display: 'block', color: T.textSub, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{meal} <span style={{ fontSize: 9, opacity: 0.4, fontWeight: 400, textTransform: 'none' }}>(dish 1–5 shown by default)</span></label>
                        </div>
                        {[...Array(Math.max(5, dishes.length))].map((_, idx) => {
                          const dishVal = dishes[idx] || ''
                          const isOverflow = idx >= 5
                          return (
                            <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: isOverflow ? 4 : 5 }}>
                              <div style={{
                                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                                background: T.accentBg, border: `1px solid ${T.accentBorder}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 9, fontWeight: 900, color: T.accent, marginTop: 8,
                              }}>{idx + 1}</div>
                              <div style={{ flex: 1 }}>
                                <input
                                  type="text"
                                  placeholder={`Dish ${idx + 1}`}
                                  value={dishVal}
                                  onChange={e => setDish(day, meal, idx, e.target.value)}
                                  style={{
                                    width: '100%', boxSizing: 'border-box',
                                    padding: '10px 12px', borderRadius: 8,
                                    background: idx >= dishes.length ? 'rgba(255,255,255,0.02)' : T.inputBg,
                                    border: `1px solid ${idx >= dishes.length ? 'rgba(255,255,255,0.06)' : T.inputBorder}`,
                                    color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
                                    transition: 'border-color 0.2s, background 0.2s',
                                  }}
                                  onFocus={e => {
                                    e.currentTarget.style.borderColor = T.accent
                                    e.currentTarget.style.background = T.inputBg
                                  }}
                                  onBlur={e => {
                                    e.currentTarget.style.borderColor = idx >= dishes.length ? 'rgba(255,255,255,0.06)' : T.inputBorder
                                    e.currentTarget.style.background = idx >= dishes.length ? 'rgba(255,255,255,0.02)' : T.inputBg
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
                                  marginTop: 6, opacity: isOverflow ? 0.5 : 0.2,
                                  transition: 'opacity 0.2s', fontFamily: 'inherit',
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = isOverflow ? '1' : '0.5'}
                                onMouseLeave={e => e.currentTarget.style.opacity = isOverflow ? '0.5' : '0.2'}
                                title={isOverflow ? 'Remove dish' : 'Clear dish'}
                              >×</button>
                            </div>
                          )
                        })}
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
                          <button
                            type="button"
                            onClick={() => addDish(day, meal)}
                            style={{
                              background: 'none', border: `1px dashed ${T.accentBorder}`, borderRadius: 8,
                              color: T.accent, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              padding: '6px 16px', fontFamily: 'inherit', transition: '0.2s',
                              width: '100%',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = T.accentBg}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
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
              Set when this week's menu becomes visible to users. Until published, users will see the previous week's menu.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label style={{ display: 'block', color: T.textSub, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Schedule Publish At
                </label>
                <input
                  type="datetime-local"
                  value={publishAt}
                  onChange={e => setPublishAt(e.target.value)}
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
                    setPublishAt(now.toISOString().slice(0, 16))
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
                    const publishTimestamp = new Date().toISOString()
                    const menuRows = Object.entries(menu).map(([day, val]) => ({
                      day_name: day,
                      week_start: selectedWeek,
                      day_ar: val.ar || '',
                      lunch: val.lunch,
                      dinner: val.dinner,
                      publish_at: publishTimestamp,
                    }))
                    const { error: saveErr } = await supabase
                      .from('weekly_menu')
                      .upsert(menuRows, { onConflict: 'week_start,day_name' })
                    if (saveErr) {
                      setMsg({ text: `Save failed: ${saveErr.message}`, type: 'error' })
                    } else {
                      await supabase.functions.invoke('send-push', {
                        body: {
                          title: '🍽️ New Weekly Menu Available',
                          body: `The menu for week of ${selectedWeek} is now live! Check it out in the app.`,
                          url: '/',
                          target_type: 'all',
                        }
                      }).catch(() => {})
                      setPublishAt(publishTimestamp.slice(0, 16))
                      setMsg({ text: `✅ Menu published and push notification sent!`, type: 'success' })
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Btn type="button" variant="ghost" onClick={load}><RefreshCw size={15} />Reset</Btn>
          <Btn type="submit" disabled={saving} size="lg">
            <Save size={16} />
            {saving ? 'Saving…' : 'Save All Settings'}
          </Btn>
        </div>
      </form>
    </PageWrap>
  )
}
