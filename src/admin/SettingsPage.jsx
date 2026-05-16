// src/admin/SettingsPage.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Save, RefreshCw, Info, ShieldCheck, Lock, Unlock, Clock, AlertTriangle, ClipboardList, Users, ChevronRight, X, Calendar } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Btn, Alert, Input, SectionHeader } from './ui'
import { useAuth } from './context'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday']

const DEFAULT_MENU = {
  monday:    { lunch: 'Chola, Kulcha, Shreekhand, Dal, Chawal', dinner: 'FMB Menu' },
  tuesday:   { lunch: 'American Choupsey, Wafers, Butter Khichdi', dinner: 'Roti, Veg Jaipuri, Chicken Pulao, Soup' },
  wednesday: { lunch: 'Vegetable Sandwich, Bhel Salad, Corn Pulao', dinner: 'Roti, White Chicken, Manchurian Rice, Gravy' },
  thursday:  { lunch: 'Chicken 65, Corn Munch Salad, Dal Makhni, Chawal', dinner: 'Roti, Mango Custard, Matar Paneer, Tuwar Pulao, Palidu' },
  friday:    { lunch: 'FMB Menu', dinner: 'Roti, Gobi Matar, Chicken Kashmiri Pulao, Soup' },
  saturday:  { lunch: 'Chana Bateta, Dal Makhni, Chawal', dinner: 'Roti, Chicken Tarkari, Veg Coconut Rice, Kung Pao Gravy' },
}

export default function SettingsPage() {
  const [menu, setMenu]         = useState(DEFAULT_MENU)
  const [surveyMsg, setSurveyMsg] = useState('')
  const [helpline, setHelpline] = useState('')
  const [surveyStatus, setSurveyStatus] = useState('closed')
  const [allowEdits, setAllowEdits] = useState(false)
  const [editLimit, setEditLimit] = useState(2)
  const [lunchEditStatus, setLunchEditStatus] = useState('closed')
  const [dinnerEditStatus, setDinnerEditStatus] = useState('closed')
  const [userList, setUserList] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [userDayAccess, setUserDayAccess] = useState({}) // { userId: { Monday: ['lunch', 'dinner'], ... } }
  const [userSearch, setUserSearch] = useState('')
  const [activeAccessUser, setActiveAccessUser] = useState(null)
  const [activeAccessDay, setActiveAccessDay] = useState(null)
  const { user } = useAuth()
  

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState({ text: '', type: 'success' })

  const instantUpdate = async (key, value, stateSetter) => {
    stateSetter(value)
    try {
      const { error } = await supabase.from('app_settings').upsert({ key, value: value.toString() }, { onConflict: 'key' })
      if (error) throw error
    } catch (e) {
      setMsg({ text: `Failed to update ${key}: ${e.message}`, type: 'error' })
    }
  }

  useEffect(() => { load() }, [])

  const load = async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    // Load general settings
    const { data: settings } = await supabase.from('app_settings').select('*').order('id', { ascending: true })
    if (settings) {
      settings.forEach(row => {
        if (!row.key) return
        const val = row.value
        if (row.key === 'survey_msg')    setSurveyMsg(val)
        if (row.key === 'helpline_number') setHelpline(val)
        if (row.key === 'survey_status')   setSurveyStatus(val)
        if (row.key === 'allow_edits')     setAllowEdits(val === 'true')
        if (row.key === 'edit_limit')      setEditLimit(parseInt(val) || 2)
        if (row.key === 'lunch_edit_status')  setLunchEditStatus(val || 'closed')
        if (row.key === 'dinner_edit_status') setDinnerEditStatus(val || 'closed')
        if (row.key === 'user_day_access') {
          try {
            const raw = JSON.parse(val) || {}
            const normalized = {}
            Object.keys(raw).forEach(uid => {
              normalized[uid] = {}
              Object.keys(raw[uid]).forEach(day => {
                normalized[uid][day.toLowerCase()] = raw[uid][day]
              })
            })
            setUserDayAccess(normalized)
          } catch (e) {
            console.error("Failed to parse user_day_access", e)
          }
        }
      })
    }
    // Load all users for the selection list
    const { data: users } = await supabase.from('user_stats').select('user_id, name, thali_number, avatar_url').order('name')
    if (users) setUserList(users)
    // Load weekly menu from dedicated table
    const { data: menuData } = await supabase.from('weekly_menu').select('*')
    if (menuData && menuData.length > 0) {
      const formatted = {}
      menuData.forEach(row => {
        formatted[row.day_name.toLowerCase()] = { lunch: row.lunch, dinner: row.dinner, ar: row.day_ar }
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
      { key: 'survey_msg',        value: surveyMsg },
      { key: 'helpline_number',   value: helpline },
      { key: 'survey_status',     value: surveyStatus },
      { key: 'allow_edits',       value: allowEdits.toString() },
      { key: 'edit_limit',        value: editLimit.toString() },
      { key: 'lunch_edit_status',  value: lunchEditStatus },
      { key: 'dinner_edit_status', value: dinnerEditStatus },
      { key: 'user_day_access',    value: JSON.stringify(userDayAccess) },
    ]
    
    // Explicitly specify 'key' as the conflict target
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
    if (!error) {
      // Re-load to confirm sync
      await load(true)
    }
    setMsg(error
      ? { text: error.message, type: 'error' }
      : { text: 'Settings saved successfully! Portal updated.', type: 'success' }
    )
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setMsg({ text: 'Link copied to clipboard!', type: 'success' })
    setTimeout(() => setMsg({ text: '', type: 'success' }), 3000)
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
      <style>{`
        @keyframes pop {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slideUp {
          0% { transform: translateY(10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <PageTitle sub="Manage weekly menu, survey access, and app configuration">Settings</PageTitle>

      {/* COMMAND STATUS OVERVIEW */}
      <AdminCard style={{ marginBottom: 24, background: 'rgba(212,175,55,0.05)', border: `2px solid ${T.accentBorder}` }}>
        <SectionHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={20} color={T.accent} />
            <span>Active Command Status</span>
          </div>
        </SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div style={{ padding: 14, borderRadius: 12, background: surveyStatus === 'open' ? T.successBg : T.dangerBg, border: `1px solid ${surveyStatus === 'open' ? T.success : T.danger}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: surveyStatus === 'open' ? T.success : T.danger, marginBottom: 4 }}>WEEKLY SURVEY</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.text }}>{surveyStatus?.toUpperCase()}</div>
          </div>
          <div style={{ padding: 14, borderRadius: 12, background: lunchEditStatus === 'open' ? T.successBg : T.dangerBg, border: `1px solid ${lunchEditStatus === 'open' ? T.success : T.danger}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: lunchEditStatus === 'open' ? T.success : T.danger, marginBottom: 4 }}>LUNCH EDITS</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.text }}>{lunchEditStatus?.toUpperCase()}</div>
          </div>
          <div style={{ padding: 14, borderRadius: 12, background: dinnerEditStatus === 'open' ? T.successBg : T.dangerBg, border: `1px solid ${dinnerEditStatus === 'open' ? T.success : T.danger}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: dinnerEditStatus === 'open' ? T.success : T.danger, marginBottom: 4 }}>DINNER EDITS</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.text }}>{dinnerEditStatus?.toUpperCase()}</div>
          </div>
          <div style={{ padding: 14, borderRadius: 12, background: allowEdits ? T.successBg : T.dangerBg, border: `1px solid ${allowEdits ? T.success : T.danger}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: allowEdits ? T.success : T.danger, marginBottom: 4 }}>USER PERMISSIONS</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.text }}>{allowEdits ? 'ALLOWED' : 'RESTRICTED'}</div>
          </div>
        </div>
      </AdminCard>

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Survey Controls */}
        <AdminCard>
          <SectionHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={20} color={T.accent} />
              <span>Survey & Edit Master Controls</span>
            </div>
          </SectionHeader>
          
          {(
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
                {/* Weekly Survey Master Switch */}
                <div style={{ padding: 20, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <ClipboardList size={18} color={T.accent} />
                    <label style={{ fontSize: 12, fontWeight: 800, color: T.text, letterSpacing: '0.05em' }}>WEEKLY SURVEY WINDOW</label>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button 
                      type="button"
                      onClick={() => instantUpdate('survey_status', 'open', setSurveyStatus)}
                      style={{ 
                        flex: 1, padding: '12px', borderRadius: 12, border: `2px solid ${surveyStatus === 'open' ? T.success : T.border}`,
                        background: surveyStatus === 'open' ? T.successBg : 'transparent', color: surveyStatus === 'open' ? T.success : T.textSub,
                        fontWeight: 800, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      <Unlock size={14} style={{ marginRight: 6 }} /> OPEN
                    </button>
                    <button 
                      type="button"
                      onClick={() => instantUpdate('survey_status', 'closed', setSurveyStatus)}
                      style={{ 
                        flex: 1, padding: '12px', borderRadius: 12, border: `2px solid ${surveyStatus === 'closed' ? T.danger : T.border}`,
                        background: surveyStatus === 'closed' ? T.dangerBg : 'transparent', color: surveyStatus === 'closed' ? T.danger : T.textSub,
                        fontWeight: 800, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      <Lock size={14} style={{ marginRight: 6 }} /> CLOSED
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: T.textSub, marginTop: 12, lineHeight: 1.5 }}>
                    Master switch for the Monday-Saturday weekly survey. When closed, users cannot submit new weekly forms.
                  </p>
                </div>

                {/* Daily Edit Master Switch */}
                <div style={{ padding: 20, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <Clock size={18} color={T.accent} />
                    <label style={{ fontSize: 12, fontWeight: 800, color: T.text, letterSpacing: '0.05em' }}>DAILY MEAL EDITS</label>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Lunch Edits</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" onClick={() => instantUpdate('lunch_edit_status', 'open', setLunchEditStatus)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer', background: lunchEditStatus === 'open' ? T.success : T.border, color: lunchEditStatus === 'open' ? '#fff' : T.textSub }}>OPEN</button>
                        <button type="button" onClick={() => instantUpdate('lunch_edit_status', 'closed', setLunchEditStatus)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer', background: lunchEditStatus === 'closed' ? T.danger : T.border, color: lunchEditStatus === 'closed' ? '#fff' : T.textSub }}>CLOSE</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Dinner Edits</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" onClick={() => instantUpdate('dinner_edit_status', 'open', setDinnerEditStatus)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer', background: dinnerEditStatus === 'open' ? T.success : T.border, color: dinnerEditStatus === 'open' ? '#fff' : T.textSub }}>OPEN</button>
                        <button type="button" onClick={() => instantUpdate('dinner_edit_status', 'closed', setDinnerEditStatus)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer', background: dinnerEditStatus === 'closed' ? T.danger : T.border, color: dinnerEditStatus === 'closed' ? '#fff' : T.textSub }}>CLOSE</button>
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: T.textSub, marginTop: 12, lineHeight: 1.5 }}>
                    Manually enable/disable daily response editing. Overrides all standard time logic.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, paddingTop: 24, borderTop: `1px solid ${T.border}` }}>
                <div>
                  <Input 
                    label="Edit Limit (per meal)" 
                    type="number" 
                    value={editLimit} 
                    onChange={e => setEditLimit(parseInt(e.target.value) || 0)} 
                    min="0"
                  />
                  <p style={{ fontSize: 10, color: T.textSub, marginTop: 4 }}>Set to 0 for unlimited edits.</p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 8, letterSpacing: '0.05em' }}>GLOBAL EDIT PERMISSION</label>
                  <button 
                    type="button"
                    onClick={() => instantUpdate('allow_edits', !allowEdits, setAllowEdits)}
                    style={{ 
                      width: '100%', padding: '12px', borderRadius: 12, border: `2px solid ${allowEdits ? T.accent : T.border}`,
                      background: allowEdits ? T.accentBg : 'transparent', color: allowEdits ? T.accent : T.textSub,
                      fontWeight: 800, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {allowEdits ? 'ALLOWED' : 'RESTRICTED'}
                  </button>
                  <p style={{ fontSize: 10, color: T.textSub, marginTop: 8 }}>Master permission for users to modify their own responses.</p>
                </div>
              </div>
            </div>
          )}
        </AdminCard>

        {/* Per-User Access Control */}
        <AdminCard>
          <SectionHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={20} color={T.accent} />
              <span>User Access & Meal Specification</span>
            </div>
          </SectionHeader>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ position: 'relative' }}>
              <Input 
                placeholder="Search member by name or thali..." 
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>

            <div style={{ 
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
              gap: 12, maxHeight: 400, overflowY: 'auto', paddingRight: 4 
            }}>
              {userList
                .filter(u => !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.thali_number?.toString().includes(userSearch))
                .map(u => {
                  const hasCustom = Object.values(userDayAccess[u.user_id] || {}).some(m => m.length > 0)
                  return (
                    <div 
                      key={u.user_id} 
                      onClick={() => { setActiveAccessUser(u); setActiveAccessDay(null); }}
                      style={{ 
                        padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
                        background: hasCustom ? 'rgba(212,175,55,0.08)' : T.card,
                        border: `1px solid ${hasCustom ? T.accent : T.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = T.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = hasCustom ? T.accent : T.border; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ 
                          width: 38, height: 38, borderRadius: '50%', background: T.accentGrad, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          fontWeight: 900, color: '#000', fontSize: 12, overflow: 'hidden',
                          border: `2px solid ${hasCustom ? T.accent : 'rgba(255,255,255,0.1)'}`,
                          boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                        }}>
                          {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (u.name?.charAt(0) || '#')}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{u.name}</div>
                          <div style={{ fontSize: 10, color: T.textSub }}>Thali #{u.thali_number}</div>
                        </div>
                      </div>
                      <ChevronRight size={14} color={T.textSub} />
                    </div>
                  )
                })}
            </div>
          </div>
        </AdminCard>

        {/* Access Specification Modal */}
        {activeAccessUser && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }} onClick={() => setActiveAccessUser(null)}>
            <AdminCard style={{ 
              maxWidth: 500, width: '100%', position: 'relative', 
              boxShadow: '0 30px 60px rgba(0,0,0,0.5)', animation: 'pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' 
            }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setActiveAccessUser(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: T.textSub, cursor: 'pointer' }}>
                <X size={20} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                <div style={{ 
                  width: 64, height: 64, borderRadius: '50%', background: T.accentGrad, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  fontWeight: 900, color: '#000', fontSize: 24, overflow: 'hidden',
                  border: `3px solid ${T.accent}`,
                  boxShadow: `0 8px 24px rgba(212,175,55,0.3)`
                }}>
                  {activeAccessUser.avatar_url ? <img src={activeAccessUser.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : activeAccessUser.name?.charAt(0)}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: T.accent, fontSize: 18 }}>{activeAccessUser.name}</h3>
                  <div style={{ fontSize: 13, color: T.textSub }}>Set specific access for Thali #{activeAccessUser.thali_number}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button 
                      onClick={() => {
                        const url = `${window.location.origin}/?openSurvey=true`
                        copyToClipboard(url)
                      }}
                      style={{ 
                        padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 800, 
                        background: 'rgba(255,255,255,0.05)', color: T.accent, border: `1px solid ${T.accentBorder}`,
                        cursor: 'pointer'
                      }}
                    >
                      COPY SURVEY LINK
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <SectionHeader>Select Day</SectionHeader>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      type="button"
                      onClick={async () => {
                        const nextAccess = {}
                        DAYS.forEach(d => nextAccess[d] = ['lunch', 'dinner'])
                        setUserDayAccess(prev => ({ ...prev, [activeAccessUser.user_id]: nextAccess }))
                        
                        try {
                          const { data: current } = await supabase.from('app_settings').select('value').eq('key', 'user_day_access').maybeSingle()
                          const accessMap = typeof current?.value === 'string' ? JSON.parse(current.value) : (current?.value || {})
                          accessMap[activeAccessUser.user_id] = nextAccess
                          await supabase.from('app_settings').upsert({ key: 'user_day_access', value: JSON.stringify(accessMap) }, { onConflict: 'key' })
                        } catch (e) {}
                      }}
                      style={{ fontSize: 10, fontWeight: 800, color: T.success, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      ENABLE ALL
                    </button>
                    <button 
                      type="button"
                      onClick={async () => {
                        setUserDayAccess(prev => ({ ...prev, [activeAccessUser.user_id]: {} }))
                        try {
                          const { data: current } = await supabase.from('app_settings').select('value').eq('key', 'user_day_access').maybeSingle()
                          const accessMap = typeof current?.value === 'string' ? JSON.parse(current.value) : (current?.value || {})
                          delete accessMap[activeAccessUser.user_id]
                          await supabase.from('app_settings').upsert({ key: 'user_day_access', value: JSON.stringify(accessMap) }, { onConflict: 'key' })
                        } catch (e) {}
                      }}
                      style={{ fontSize: 10, fontWeight: 800, color: T.danger, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      CLEAR ALL
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {DAYS.map(day => {
                    const access = (userDayAccess[activeAccessUser.user_id] || {})[day] || []
                    const active = activeAccessDay === day
                    const hasAny = access.length > 0
                    return (
                      <button 
                        key={day}
                        type="button"
                        onClick={() => setActiveAccessDay(day)}
                        style={{
                          padding: '12px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800,
                          border: `1.5px solid ${active ? T.accent : (hasAny ? T.success : T.border)}`,
                          background: active ? T.accentBg : (hasAny ? 'rgba(16,185,129,0.05)' : 'transparent'),
                          color: active ? T.accent : (hasAny ? T.success : T.textSub),
                          cursor: 'pointer', transition: '0.2s'
                        }}
                      >
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </button>
                    )
                  })}
                </div>

                {activeAccessDay && (
                  <div style={{ 
                    marginTop: 20, padding: 20, borderRadius: 18, 
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`,
                    animation: 'slideUp 0.3s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <Calendar size={16} color={T.accent} />
                      <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Grant Access for {activeAccessDay}</span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {['lunch', 'dinner'].map(meal => {
                        const userMap = userDayAccess[activeAccessUser.user_id] || {}
                        const dayMeals = userMap[activeAccessDay] || []
                        const isActive = dayMeals.includes(meal)
                        
                        const toggle = async () => {
                          const nextMeals = isActive ? dayMeals.filter(m => m !== meal) : [...dayMeals, meal]
                          const newMapForUser = { ...userMap, [activeAccessDay]: nextMeals }
                          
                          // Functional update for local state
                          setUserDayAccess(prev => ({ ...prev, [activeAccessUser.user_id]: newMapForUser }))
                          
                          // Instant Update to DB (Robust fetch-merge-save)
                          try {
                            const { data: current } = await supabase.from('app_settings').select('value').eq('key', 'user_day_access').maybeSingle()
                            const accessMap = typeof current?.value === 'string' ? JSON.parse(current.value) : (current?.value || {})
                            accessMap[activeAccessUser.user_id] = newMapForUser
                            await supabase.from('app_settings').upsert({ key: 'user_day_access', value: JSON.stringify(accessMap) }, { onConflict: 'key' })
                            setMsg({ text: `Access updated for ${activeAccessUser.name} on ${activeAccessDay}`, type: 'success' })
                          } catch (e) {
                            setMsg({ text: `Failed to sync access: ${e.message}`, type: 'error' })
                          }
                        }

                        return (
                          <button
                            key={meal}
                            type="button"
                            onClick={toggle}
                            style={{
                              padding: '16px', borderRadius: 14, fontSize: 13, fontWeight: 900,
                              textTransform: 'uppercase', letterSpacing: '0.05em',
                              border: `2px solid ${isActive ? T.success : T.border}`,
                              background: isActive ? T.successBg : 'transparent',
                              color: isActive ? T.success : T.textSub,
                              cursor: 'pointer', transition: '0.2s',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
                            }}
                          >
                            <span style={{ fontSize: 20 }}>{meal === 'lunch' ? '☀️' : '🌙'}</span>
                            {meal} {isActive ? 'Enabled' : 'Disabled'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
              
              <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
                <Btn style={{ flex: 1, padding: '16px', fontSize: 16, fontWeight: 900, height: 'auto' }} onClick={() => setActiveAccessUser(null)}>Done</Btn>
              </div>
            </AdminCard>
          </div>
        )}



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
                  {day.charAt(0).toUpperCase() + day.slice(1)}
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
