// src/admin/SettingsPage.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Save, RefreshCw, Info } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Btn, Alert, Input, SectionHeader } from './ui'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const DEFAULT_MENU = {
  Monday:    { lunch: 'Chola, Kulcha, Shreekhand, Dal, Chawal', dinner: 'FMB Menu' },
  Tuesday:   { lunch: 'American Choupsey, Wafers, Butter Khichdi', dinner: 'Roti, Veg Jaipuri, Chicken Pulao, Soup' },
  Wednesday: { lunch: 'Vegetable Sandwich, Bhel Salad, Corn Pulao', dinner: 'Roti, White Chicken, Manchurian Rice, Gravy' },
  Thursday:  { lunch: 'Chicken 65, Corn Munch Salad, Dal Makhni, Chawal', dinner: 'Roti, Mango Custard, Matar Paneer, Tuwar Pulao, Palidu' },
  Friday:    { lunch: 'FMB Menu', dinner: 'Roti, Gobi Matar, Chicken Kashmiri Pulao, Soup' },
  Saturday:  { lunch: 'Chana Bateta, Dal Makhni, Chawal', dinner: 'Roti, Chicken Tarkari, Veg Coconut Rice, Kung Pao Gravy' },
}

export default function SettingsPage() {
  const [menu, setMenu]         = useState(DEFAULT_MENU)
  const [upiId, setUpiId]       = useState('shydrabadwala53@okhdfcbank')
  const [upiAmt, setUpiAmt]     = useState('400.00')
  const [surveyMsg, setSurveyMsg] = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState({ text: '', type: 'success' })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('app_settings').select('*')
    if (data) {
      data.forEach(row => {
        if (row.key === 'weekly_menu')   setMenu(JSON.parse(row.value) || DEFAULT_MENU)
        if (row.key === 'upi_id')        setUpiId(row.value)
        if (row.key === 'upi_amount')    setUpiAmt(row.value)
        if (row.key === 'survey_msg')    setSurveyMsg(row.value)
      })
    }
    setLoading(false)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg({ text: '', type: 'success' })
    const rows = [
      { key: 'weekly_menu',  value: JSON.stringify(menu) },
      { key: 'upi_id',       value: upiId },
      { key: 'upi_amount',   value: upiAmt },
      { key: 'survey_msg',   value: surveyMsg },
    ]
    const { error } = await supabase.from('app_settings')
      .upsert(rows, { onConflict: 'key' })
    setSaving(false)
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

        {/* Payment */}
        <AdminCard>
          <SectionHeader>💳 Payment Settings</SectionHeader>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Input label="UPI ID" value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@bank" />
            <Input label="Fixed Amount (₹)" type="number" value={upiAmt} onChange={e => setUpiAmt(e.target.value)} placeholder="400" />
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
