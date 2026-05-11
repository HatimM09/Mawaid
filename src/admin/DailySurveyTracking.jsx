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
  SectionHeader, Modal, fmtDate 
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

  const dishStats = {}
  yesMembers.forEach(u => {
    Object.entries(u.dishResponses || {}).forEach(([dish, val]) => {
      if (!dishStats[dish]) dishStats[dish] = { totalPct: 0, count: 0, yesNoCount: 0, yesCount: 0 }
      if (val === 'yes' || val === 'no') {
        dishStats[dish].yesNoCount++
        if (val === 'yes') dishStats[dish].yesCount++
      } else {
        dishStats[dish].count++
        dishStats[dish].totalPct += (parseInt(val) || 0)
      }
    })
  })

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
        <div style={{ display: 'flex', background: T.inputBg, padding: 4, borderRadius: 14, border: `1px solid ${T.border}`, overflowX: 'auto' }}>
          {DAYS.map(d => (
            <button key={d} onClick={() => setDay(d)}
              style={{ 
                flexShrink: 0, padding: '8px 14px', borderRadius: 10, border: 'none', 
                background: day === d ? T.accentGrad : 'transparent', 
                color: day === d ? '#fff' : T.textSub, 
                fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: '0.2s' 
              }}>
              {d.charAt(0).toUpperCase() + d.slice(1, 3)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', background: T.inputBg, padding: 4, borderRadius: 14, border: `1px solid ${T.border}` }}>
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
        
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={14} color={T.textSub} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search by name or thali #..."
            style={{ 
              width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 36px', 
              borderRadius: 12, background: T.inputBg, border: `1px solid ${T.inputBorder}`, 
              color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' 
            }}
          />
        </div>
      </div>

      {/* Aggregate Dish Stats */}
      {Object.keys(dishStats).length > 0 && (
        <AdminCard style={{ marginBottom: 24, background: 'rgba(212, 175, 55, 0.04)' }}>
          <SectionHeader style={{ marginTop: 0 }}>📊 OVERALL MENU SURVEY PERCENTAGE</SectionHeader>
          <Grid cols={4}>
            {Object.entries(dishStats).map(([dish, stat]) => {
              const isYesNo = stat.yesNoCount > 0
              const avg = isYesNo 
                ? (stat.yesNoCount ? Math.round((stat.yesCount / stat.yesNoCount) * 100) : 0)
                : (stat.count ? Math.round(stat.totalPct / stat.count) : 0)
              
              return (
                <div key={dish} style={{ 
                  padding: '16px', borderRadius: 16, background: T.inputBg, border: `1px solid ${T.border}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
                }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: T.accent, marginBottom: 4 }}>
                    {avg}%
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: 'uppercase' }}>
                    {dish}
                  </div>
                  <div style={{ fontSize: 9, color: T.textSub, opacity: 0.7, marginTop: 4 }}>
                    {isYesNo ? `${stat.yesCount} of ${stat.yesNoCount} Yes` : `Avg of ${stat.count} responses`}
                  </div>
                </div>
              )
            })}
          </Grid>
        </AdminCard>
      )}

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

function SurveyResponseDisplay({ user, meal, day, onClose }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Info */}
      <div style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        padding: '12px 16px', borderRadius: 16, background: T.accentBg, border: `1px solid ${T.accentBorder}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ 
            width: 44, height: 44, borderRadius: 12, background: T.accentGrad, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontSize: 18, fontWeight: 900, color: '#fff', boxShadow: '0 4px 12px rgba(197, 160, 89, 0.3)'
          }}>
            {user.thali_number}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{user.name}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {day} • {meal}
            </div>
            {user.updated_at && (
              <div style={{ fontSize: 9, color: T.textSub, marginTop: 4, fontWeight: 600 }}>
                📅 {new Date(user.updated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Badge color={user.status === 'Applied' ? T.success : T.danger}>
            {user.status === 'Applied' ? 'CONFIRMED' : 'SKIPPED'}
          </Badge>
          {user.status === 'Applied' && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: T.accent, lineHeight: 1 }}>
                {(Object.values(user.dishResponses || {}).reduce((acc, v) => acc + (parseInt(v) || 0), 0) / 100).toFixed(1)}
              </div>
              <div style={{ fontSize: 9, fontWeight: 800, color: T.textSub, textTransform: 'uppercase' }}>Portions</div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Rectangle with Squares as requested */}
      <div style={{ 
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 12,
        padding: 20, borderRadius: 20, background: T.card, border: `1px solid ${T.border}`,
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
      }}>
        {user.status === 'Applied' ? (
          Object.entries(user.dishResponses || {}).map(([dish, val]) => (
            <div key={dish} style={{ 
              aspectRatio: '1/1', borderRadius: 18, background: T.inputBg, border: `1px solid ${T.border}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: 10, transition: 'all 0.3s'
            }}>
              <div style={{ 
                fontSize: 18, fontWeight: 900, color: T.accent, marginBottom: 4,
                textShadow: '0 0 10px rgba(197, 160, 89, 0.2)'
              }}>
                {val === 'yes' ? '100%' : val === 'no' ? '0%' : `${val}%`}
              </div>
              <div style={{ 
                fontSize: 9, fontWeight: 800, color: T.textSub, 
                textTransform: 'uppercase', letterSpacing: '0.02em',
                lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis'
              }}>
                {dish}
              </div>
            </div>
          ))
        ) : (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: T.textSub }}>
            <X size={40} style={{ opacity: 0.1, marginBottom: 12 }} />
            <div style={{ fontWeight: 700 }}>No response for this meal</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <Btn variant="outline" style={{ flex: 1 }} onClick={onClose}>Close</Btn>
        <Btn style={{ flex: 1 }} onClick={() => window.print()}>Print Label</Btn>
      </div>
    </div>
  )
}

function MemberRow({ user, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        padding: '12px 16px', borderRadius: 14, background: T.inputBg, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: T.accent }}>
          {user.thali_number}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{user.name}</div>
      </div>
      <ChevronRight size={16} color={T.textSub} />
    </div>
  )
}
