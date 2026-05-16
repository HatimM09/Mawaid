// src/admin/DailySurveyTracking.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { 
  Search, RefreshCw, ChevronRight, Check, X, Filter, 
  Calendar, Utensils, User as UserIcon, Clock, ChevronDown, ChevronUp, Scan
} from 'lucide-react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { 
  T, PageWrap, PageTitle, AdminCard, Badge, Btn, Spinner, Grid, 
  SectionHeader, Modal, fmtDate, PackingTVView
} from './ui'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export default function DailySurveyTracking() {
  const weeklyMenu = useWeeklyMenu() || {}
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState(() => {
    const d = new Date().getDay()
    // Default to Monday if Sunday (since survey is for next week usually, but here we just pick current)
    if (d === 0) return 'monday' 
    return ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][d]
  })
  const [meal, setMeal] = useState(() => (new Date().getHours() + new Date().getMinutes() / 60) < 15.5 ? 'lunch' : 'dinner')
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  // --- WIRELESS SCANNER SUPPORT ---
  useEffect(() => {
    let scanBuffer = ''
    let lastKeyTime = Date.now()

    const handleKeyDown = (e) => {
      const now = Date.now()
      if (now - lastKeyTime > 100) scanBuffer = ''
      lastKeyTime = now

      if (e.key === 'Enter') {
        if (scanBuffer.startsWith('ALMAWAID:')) {
          const userId = scanBuffer.split(':')[1]
          handleWirelessScan(userId)
          scanBuffer = ''
        }
      } else if (e.key.length === 1) {
        scanBuffer += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [users])

  const handleWirelessScan = (userId) => {
    const user = users.find(u => u.user_id === userId)
    if (user) setSelectedUser(user)
  }

  const getWeekDate = () => {
    const now = new Date()
    const day = now.getDay()
    const hour = now.getHours()
    let diff = now.getDate() - day + (day === 0 ? -6 : 1)
    // Saturday 8PM+ or Sunday: surveys target next week's Monday
    if (day === 0 || (day === 6 && hour >= 20)) {
      diff += 7
    }
    const monday = new Date(now.setDate(diff))
    return monday.toISOString().split('T')[0]
  }

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)
    
    try {
      const { data: resultsRaw, error } = await supabase
        .from('user_stats')
        .select(`
          user_id, name, thali_number, email,
          survey_submissions_flat (*)
        `)
      
      if (error) throw error
      const currentWeekId = getWeekDate()
      
      const dayKey = day.substring(0, 3).toLowerCase()
      const mealKey = meal === 'lunch' ? 'l' : 'd'
      const statusKey = `${dayKey}_${mealKey}_status`
      
      const results = (resultsRaw || []).map(u => {
        const submissionData = Array.isArray(u.survey_submissions_flat) ? u.survey_submissions_flat : (u.survey_submissions_flat ? [u.survey_submissions_flat] : [])
        const resp = submissionData.find(r => r.week_id === currentWeekId)
        const status = resp ? resp[statusKey] : null
        const dishResponses = {}
        if (status === 'Applied') {
          const dishes = weeklyMenu[day]?.[meal] || []
          dishes.forEach((d, i) => {
            const val = resp[`${dayKey}_${mealKey}_dish_${i + 1}`]
            dishResponses[d] = val === 'Yes' ? 'yes' : val === 'No' ? 'no' : parseInt(val)
          })
        }
        return { 
          ...u, 
          status, 
          dishResponses, 
          updated_at: resp ? resp.updated_at : null 
        }
      })
      
      setUsers(results)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
    setRefreshing(false)
  }, [day, meal, weeklyMenu])

  useEffect(() => {
    load()

    // REALTIME SUBSCRIPTION
    const surveySub = supabase
      .channel('survey_tracking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_submissions_flat' }, () => {
        load(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(surveySub)
    }
  }, [load])

  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
      scanner.render((decodedText) => {
        if (decodedText.startsWith('ALMAWAID:')) {
          const userId = decodedText.split(':')[1];
          const user = users.find(u => u.user_id === userId);
          if (user) {
            setSelectedUser(user);
            setIsScanning(false);
            scanner.clear();
          }
        }
      }, (error) => {
        // console.warn(error);
      });
      return () => scanner.clear();
    }
  }, [isScanning, users])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter(u => 
      (u.name || '').toLowerCase().includes(q) || 
      String(u.thali_number || '').includes(q)
    )
  }, [users, search])

  const yesMembers = filtered.filter(u => u.status === 'Applied')
  const noMembers = filtered.filter(u => u.status === 'Skipped')
  const noResponse = filtered.filter(u => !u.status)

  if (loading && users.length === 0) return <Spinner />

  return (
    <PageWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <PageTitle>Daily Survey Tracker</PageTitle>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="primary" onClick={() => setIsScanning(true)}>
            <Scan size={16} /> Scan Tiffin
          </Btn>
          <Btn variant="outline" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Syncing...' : 'Sync Now'}
          </Btn>
        </div>
      </div>

      {/* Day & Meal Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ 
          display: 'flex', background: T.inputBg, padding: 4, borderRadius: 14, 
          border: `1px solid ${T.border}`, overflowX: 'auto', maxWidth: '100%',
          scrollbarWidth: 'none', msOverflowStyle: 'none'
        }} className="scroll-touch">
          <style>{`.scroll-touch::-webkit-scrollbar { display: none; }`}</style>
          {DAYS.map(d => (
            <button key={d} onClick={() => setDay(d)}
              style={{ 
                flexShrink: 0, padding: 'clamp(6px, 2vw, 10px) clamp(10px, 3vw, 16px)', borderRadius: 10, border: 'none', 
                background: day === d ? T.accentGrad : 'transparent', 
                color: day === d ? '#fff' : T.textSub, 
                fontSize: 'clamp(10px, 2.5vw, 12px)', fontWeight: 700, cursor: 'pointer', transition: '0.2s' 
              }}>
              {d.charAt(0).toUpperCase() + d.slice(1, 3)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', background: T.inputBg, padding: 4, borderRadius: 14, border: `1px solid ${T.border}`, flexShrink: 0 }}>
          {['lunch', 'dinner'].map(m => (
            <button key={m} onClick={() => setMeal(m)}
              style={{ 
                padding: '8px 16px', borderRadius: 10, border: 'none', 
                background: meal === m ? (m === 'lunch' ? T.accentGrad : '#5e9ce0') : 'transparent', 
                color: meal === m ? '#fff' : T.textSub, 
                fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: '0.2s' 
              }}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <Search size={14} color={T.textSub} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search by name or thali #..."
            style={{ 
              width: '100%', boxSizing: 'border-box', padding: '12px 14px 12px 36px', 
              borderRadius: 12, background: T.inputBg, border: `1px solid ${T.inputBorder}`, 
              color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' 
            }}
          />
        </div>
      </div>

      {/* Member Lists */}
      <Grid cols={2}>
        {/* YES List */}
        <AdminCard style={{ borderTop: `4px solid ${T.success}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <SectionHeader style={{ margin: 0 }}>✅ YES THALI ({yesMembers.length})</SectionHeader>
            <Badge color={T.success}>Applied</Badge>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {yesMembers.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: T.textSub, fontSize: 13 }}>No one has applied yet.</div>
            ) : yesMembers.map(u => (
              <MemberRow key={u.user_id} user={u} onClick={() => setSelectedUser(u)} />
            ))}
          </div>
        </AdminCard>

        {/* NO List */}
        <AdminCard style={{ borderTop: `4px solid ${T.danger}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <SectionHeader style={{ margin: 0 }}>❌ NO THALI ({noMembers.length})</SectionHeader>
            <Badge color={T.danger}>Skipped</Badge>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {noMembers.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: T.textSub, fontSize: 13 }}>No opt-outs yet.</div>
            ) : noMembers.map(u => (
              <MemberRow key={u.user_id} user={u} onClick={() => setSelectedUser(u)} />
            ))}
          </div>
        </AdminCard>
      </Grid>

      {/* No Response Card */}
      <AdminCard style={{ marginTop: 24, background: 'rgba(212, 175, 55, 0.02)' }}>
        <SectionHeader>⌛ NO RESPONSE YET ({noResponse.length})</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {noResponse.map(u => (
            <div key={u.user_id} style={{ 
              padding: '10px 14px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.border}`,
              fontSize: 13, color: T.textSub
            }}>
              <span style={{ fontWeight: 700, color: T.accent }}>#{u.thali_number}</span> {u.name}
            </div>
          ))}
        </div>
      </AdminCard>

      {/* QR Scanner Modal */}
      {isScanning && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
          zIndex: 3000, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
            <button 
              onClick={() => setIsScanning(false)}
              style={{ position: 'absolute', top: -50, right: 0, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={32} />
            </button>
            <AdminCard style={{ padding: 10, background: '#fff' }}>
              <div id="qr-reader" style={{ width: '100%' }}></div>
            </AdminCard>
            <p style={{ color: '#fff', textAlign: 'center', marginTop: 20, fontWeight: 600 }}>
              Scan Tiffin QR Code
            </p>
          </div>
        </div>
      )}

      {/* Packing Station TV View (Pop-up) */}
      {selectedUser && (
        <PackingTVView 
          user={selectedUser} 
          meal={meal} 
          day={day} 
          onClose={() => setSelectedUser(null)} 
        />
      )}

      <style>{`.spin { animation: spin 1s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </PageWrap>
  )
}


function MemberRow({ user, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        padding: '12px 16px', borderRadius: 14, background: T.inputBg, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        gap: 12
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = T.accent;
        e.currentTarget.style.background = T.cardHover;
        e.currentTarget.style.transform = 'translateX(4px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.border;
        e.currentTarget.style.background = T.inputBg;
        e.currentTarget.style.transform = 'translateX(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: T.accent, flexShrink: 0 }}>
          {user.thali_number}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
      </div>

      {user.status === 'Applied' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto', marginRight: 4 }}>
          {Object.entries(user.dishResponses || {}).map(([dish, val]) => (
            <div key={dish} style={{ 
              fontSize: 9, fontWeight: 800, color: T.accent, 
              background: 'rgba(212, 175, 55, 0.1)', padding: '2px 6px', borderRadius: 6,
              border: '1px solid rgba(212, 175, 55, 0.2)', whiteSpace: 'nowrap'
            }}>
              {val === 'yes' ? '100%' : val === 'no' ? '0%' : `${val}%`}
            </div>
          ))}
        </div>
      )}

      <ChevronRight size={14} color={T.textSub} style={{ flexShrink: 0, opacity: 0.5 }} />
    </div>
  )
}
