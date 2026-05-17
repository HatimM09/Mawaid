// src/admin/SettingsPage.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Save, RefreshCw, Info } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Btn, Alert, Input, Select, SectionHeader } from './ui'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const DEFAULT_MENU = {
  Monday:    { lunch: 'Chola, Kulcha, Shreekhand, Dal, Chawal', dinner: 'FMB Menu' },
  Tuesday:   { lunch: 'American Choupsey, Wafers, Butter Khichdi', dinner: 'Roti, Veg Jaipuri, Chicken Pulao, Soup' },
  Wednesday: { lunch: 'Vegetable Sandwich, Bhel Salad, Corn Pulao', dinner: 'Roti, White Chicken, Manchurian Rice, Gravy' },
  Thursday:  { lunch: 'Chicken 65, Corn Munch Salad, Dal Makhni, Chawal', dinner: 'Roti, Mango Custard, Matar Paneer, Tuwar Pulao, Palidu' },
  Friday:    { lunch: 'FMB Menu', dinner: 'Roti, Gobi Matar, Chicken Kashmiri Pulao, Soup' },
  Saturday:  { lunch: 'Chana Bateta, Dal Makhni, Chawal', dinner: 'Roti, Chicken Tarkari, Veg Coconut Rice, Kung Pao Gravy' },
}

const StatusToggle = ({ label, value, onChange }) => {
  const isOpen = value === 'open'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ color: T.textSub, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</label>
      <button 
        type="button"
        onClick={() => onChange(isOpen ? 'closed' : 'open')}
        style={{
          padding: '14px 20px',
          borderRadius: 12,
          border: `2px solid ${isOpen ? '#10b981' : '#ef4444'}`,
          background: isOpen ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: isOpen ? '#10b981' : '#ef4444',
          fontSize: 15,
          fontWeight: 800,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10
        }}
      >
        {isOpen ? '✅ OPEN' : '🔒 CLOSED'}
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [menu, setMenu]         = useState(DEFAULT_MENU)
  const [surveyStatus, setSurveyStatus] = useState('open')
  const [lunchEditStatus, setLunchEditStatus] = useState('closed')
  const [dinnerEditStatus, setDinnerEditStatus] = useState('closed')
  const [surveyMsg, setSurveyMsg] = useState('')
  const [helpline, setHelpline] = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState({ text: '', type: 'success' })

  useEffect(() => { load() }, [])

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
      })
    }
    // Load weekly menu from dedicated table
    const { data: menuData } = await supabase.from('weekly_menu').select('*')
    if (menuData && menuData.length > 0) {
      const formatted = {}
      menuData.forEach(row => {
        formatted[row.day_name] = { lunch: row.lunch, dinner: row.dinner, ar: row.day_ar }
      })
      setMenu(formatted)
    } else {
      setMenu(DEFAULT_MENU)
    }
    setLoading(false)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg({ text: '', type: 'success' })

    // 1. Save general settings
    const settingsRows = [
      { key: 'survey_status', value: surveyStatus },
      { key: 'lunch_edit_status', value: lunchEditStatus },
      { key: 'dinner_edit_status', value: dinnerEditStatus },
      { key: 'survey_msg',   value: surveyMsg },
      { key: 'helpline_number', value: helpline },
    ]
    const { error: settingsError } = await supabase.from('app_settings').upsert(settingsRows, { onConflict: 'key' })

    // 2. Save weekly menu
    const menuRows = Object.entries(menu).map(([day, val]) => ({
      day_name: day,
      day_ar: val.ar || '',
      lunch: val.lunch,
      dinner: val.dinner
    }))
    const { error: menuError } = await supabase.from('weekly_menu').upsert(menuRows, { onConflict: 'day_name' })

    setSaving(false)
    const error = settingsError || menuError
    setMsg(error
      ? { text: error.message, type: 'error' }
      : { text: 'Settings saved successfully!', type: 'success' }
    )
  }

  const updateMenu = (day, meal, val) => {
    setMenu(prev => ({ ...prev, [day]: { ...prev[day], [meal]: val } }))
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
          <SectionHeader>🛠️ Survey Access Controls</SectionHeader>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <StatusToggle label="Global Survey Status" value={surveyStatus} onChange={setSurveyStatus} />
            <StatusToggle label="Lunch Edits" value={lunchEditStatus} onChange={setLunchEditStatus} />
            <StatusToggle label="Dinner Edits" value={dinnerEditStatus} onChange={setDinnerEditStatus} />
          </div>
        </AdminCard>

        {/* Survey Banner */}
        <AdminCard>
          <SectionHeader>📢 Survey Notice</SectionHeader>
          <div>
            <label style={{ display: 'block', color: T.textSub, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
              Custom Message (shown when survey is closed)
            </label>
            <textarea
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <SectionHeader>🍽️ Weekly Menu</SectionHeader>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto',
              background: T.accentBg, border: `1px solid ${T.accentBorder}`,
              borderRadius: 8, padding: '4px 10px', fontSize: 11, color: T.accent,
            }}>
              <Info size={12} /> Changes saved to database
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {DAYS.map(day => (
              <div key={day}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.accent, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${T.border}` }}>
                  {day}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', color: T.textSub, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Lunch</label>
                    <textarea
                      value={menu[day]?.lunch || ''}
                      onChange={e => updateMenu(day, 'lunch', e.target.value)}
                      rows={2}
                      style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px 12px', borderRadius: 8, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: T.textSub, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Dinner</label>
                    <textarea
                      value={menu[day]?.dinner || ''}
                      onChange={e => updateMenu(day, 'dinner', e.target.value)}
                      rows={2}
                      style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px 12px', borderRadius: 8, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
              </div>
            ))}
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
