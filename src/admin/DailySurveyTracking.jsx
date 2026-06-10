// src/admin/DailySurveyTracking.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { 
  Search, RefreshCw, ChevronRight, Check, X, Filter, 
  Calendar, Utensils, User as UserIcon, Clock, ChevronDown, ChevronUp, Scan
} from 'lucide-react'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'
import { 
  T, PageWrap, PageTitle, AdminCard, Badge, Btn, Spinner, Grid,
  SectionHeader, Modal, PackingTVView, fmtDate, ErrorBanner
} from './ui'
import SurveyAccessManager from './SurveyAccessManager'
import { Shield } from 'lucide-react'
import { getWeekDate, DAYS } from '../common/utils'

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
  const [isAccessManagerOpen, setIsAccessManagerOpen] = useState(false)
  const [weekFilter, setWeekFilter] = useState('all')
  const [availableWeeks, setAvailableWeeks] = useState([])
  const [dishInputConfig, setDishInputConfig] = useState({})

  // Helper to check if a dish at a given index is count or percentage
  const getInputType = (d, m, idx) => {
    const key = `${d.charAt(0).toUpperCase() + d.slice(1)}_${m}`
    const config = dishInputConfig[key]
    return config?.[idx] || (m === 'lunch' && idx <= 3 ? 'count' : 'percentage')
  }

  const processDirectScan = async (userId) => {
    try {
      const { data: u } = await supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle()
      if (!u) {
        alert('User not found!')
        return
      }
      
      const dayKey = day.substring(0, 3).toLowerCase()
      const mealKey = meal === 'lunch' ? 'l' : 'd'
      const weekId = getWeekDate()
      
      const { data: row } = await supabase.from('survey_submissions_flat')
        .select('*').eq('user_id', userId).eq('week_id', weekId).maybeSingle()
      
      const dishRes = {}
      if (row && row[`${dayKey}_${mealKey}_status`] === 'Applied') {
        const dishes = weeklyMenu[day]?.[meal] || []
        dishes.forEach((d, i) => {
          const val = row[`${dayKey}_${mealKey}_dish_${i + 1}`]
          if (val !== undefined && val !== null) {
            dishRes[d] = val === 'Yes' ? 'yes' : val === 'No' ? 'no' : val
          }
        })
      }

      setSelectedUser({
        ...u,
        status: row ? row[`${dayKey}_${mealKey}_status`] : 'Not Submitted',
        dishResponses: dishRes,
        currentDay: day,
        currentMeal: meal
      })
    } catch (e) {
      console.error(e)
      alert('Error fetching user data: ' + e.message)
    }
  }

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
  }, [day, meal, weeklyMenu])

  const handleWirelessScan = async (userId) => {
    await processDirectScan(userId)
  }

  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)
    
    try {
      // Load dish input config
      const { data: settingsData } = await supabase.from('app_settings').select('*').eq('key', 'dish_input_config').maybeSingle()
      if (settingsData) {
        try { setDishInputConfig(JSON.parse(settingsData.value)) } catch {}
      }

      const { data: resultsRaw, error } = await supabase
        .from('user_stats')
        .select(`
          user_id, name, thali_number, email, avatar_url,
          survey_submissions_flat (*)
        `)
      
      if (error) throw error
      setLoadError(null)
      
      // Collect distinct week_ids for filter
      const allWeeks = [...new Set((resultsRaw || []).flatMap(u => {
        const subs = Array.isArray(u.survey_submissions_flat) ? u.survey_submissions_flat : (u.survey_submissions_flat ? [u.survey_submissions_flat] : [])
        return subs.map(s => s.week_id).filter(Boolean)
      }))].sort().reverse()
      setAvailableWeeks(allWeeks)
      
      const dayKey = day.substring(0, 3).toLowerCase()
      const mealKey = meal === 'lunch' ? 'l' : 'd'
      const statusKey = `${dayKey}_${mealKey}_status`
      
      const results = (resultsRaw || []).map(u => {
        const submissionData = Array.isArray(u.survey_submissions_flat) ? u.survey_submissions_flat : (u.survey_submissions_flat ? [u.survey_submissions_flat] : [])
        let resp
        if (weekFilter === 'all') {
          // Find the latest submission (by week_id)
          resp = submissionData.sort((a, b) => (b.week_id || '').localeCompare(a.week_id || ''))[0]
        } else {
          resp = submissionData.find(r => r.week_id === weekFilter)
        }
        const status = resp ? resp[statusKey] : null
        const dishResponses = {}
        if (status === 'Applied') {
          const dishes = weeklyMenu[day]?.[meal] || []
          dishes.forEach((d, i) => {
            const val = resp[`${dayKey}_${mealKey}_dish_${i + 1}`]
            if (val !== undefined && val !== null) {
              dishResponses[d] = val === 'Yes' ? 'yes' : val === 'No' ? 'no' : val
            }
          })
        }
        return { 
          ...u, 
          status, 
          dishResponses, 
          week_id: resp ? resp.week_id : null,
          updated_at: resp ? resp.updated_at : null 
        }
      })
      
      setUsers(results)
    } catch (e) {
      console.error('DailySurveyTracking load error:', e)
      setLoadError(e?.message || 'Failed to load survey tracking data')
    }
    setLoading(false)
    setRefreshing(false)
  }, [day, meal, weeklyMenu, weekFilter])

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
      const scanner = new Html5QrcodeScanner("qr-reader", {
        fps: 10,
        qrbox: 250,
        supportedScanTypes: [
          Html5QrcodeScanType.SCAN_TYPE_CAMERA,
          Html5QrcodeScanType.SCAN_TYPE_FILE
        ],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
      });
      const handleScan = async (decodedText) => {
        if (decodedText.startsWith('ALMAWAID:')) {
          const userId = decodedText.split(':')[1];
          try {
            await scanner.clear();
          } catch (e) {
            console.error("Failed to clear scanner", e);
          }
          setIsScanning(false);
          await processDirectScan(userId);
        }
      };

      scanner.render(handleScan, (error) => {});
      return () => {
        scanner.clear().catch(e => console.error("Scanner cleanup failed", e));
      };
    }
  }, [isScanning, day, meal, weeklyMenu])

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
      if (!dishStats[dish]) dishStats[dish] = { total: 0, count: 0, yesNoCount: 0, yesCount: 0, isCount: false }
      if (val === 'yes' || val === 'no') {
        dishStats[dish].yesNoCount++
        if (val === 'yes') dishStats[dish].yesCount++
      } else if (typeof val === 'string' && val.endsWith('%')) {
        dishStats[dish].count++
        dishStats[dish].total += (parseInt(val) || 0)
      } else {
        dishStats[dish].count++
        dishStats[dish].total += (parseInt(val) || 0)
        dishStats[dish].isCount = true
      }
    })
  })

  if (loading && users.length === 0) return <Spinner />

  return (
    <PageWrap>
      <div className="tracker-dashboard">
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
          <PageTitle style={{ margin: 0 }}>Daily Survey Tracker</PageTitle>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="outline" onClick={() => setIsAccessManagerOpen(true)}>
              <Shield size={16} /> Access
            </Btn>
            <Btn variant="primary" onClick={() => setIsScanning(true)}>
              <Scan size={16} /> Scan Tiffin
            </Btn>
            <Btn variant="outline" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
              {refreshing ? 'Syncing...' : 'Sync Now'}
            </Btn>
          </div>
        </div>

        {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

        {/* Day, Meal, Search & Sleek Dish Percentages Capsule Row */}
        <div style={{ 
          display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', 
          alignItems: 'center', background: 'rgba(212, 175, 55, 0.03)', 
          padding: '8px 16px', borderRadius: 20, border: `1px solid ${T.border}`
        }}>
          {/* Day Filters */}
          <div style={{ display: 'flex', background: T.inputBg, padding: 3, borderRadius: 12, border: `1px solid ${T.border}`, overflowX: 'auto' }}>
            {DAYS.map(d => (
              <button key={d} onClick={() => setDay(d)}
                style={{ 
                  flexShrink: 0, padding: '6px 12px', borderRadius: 8, border: 'none', 
                  background: day === d ? T.accentGrad : 'transparent', 
                  color: day === d ? '#fff' : T.textSub, 
                  fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: '0.2s' 
                }}>
                {d.charAt(0).toUpperCase() + d.slice(1, 3)}
              </button>
            ))}
          </div>

          {/* Meal Filters */}
          <div style={{ display: 'flex', background: T.inputBg, padding: 3, borderRadius: 12, border: `1px solid ${T.border}` }}>
            {['lunch', 'dinner'].map(m => (
              <button key={m} onClick={() => setMeal(m)}
                style={{ 
                  padding: '6px 12px', borderRadius: 8, border: 'none', 
                  background: meal === m ? (m === 'lunch' ? T.accentGrad : '#5e9ce0') : 'transparent', 
                  color: meal === m ? '#fff' : T.textSub, 
                  fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: '0.2s' 
                }}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Week Filter */}
          <select value={weekFilter} onChange={e => setWeekFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.border}`, color: T.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none' }}>
            <option value="all">Latest Week</option>
            {availableWeeks.map(w => (
              <option key={w} value={w}>{new Date(w + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</option>
            ))}
          </select>
          
          {/* Search Bar */}
          <div style={{ flex: '1 1 200px', position: 'relative' }}>
            <Search size={14} color={T.textSub} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input 
              name="searchTracking"
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search thali or name..."
              style={{ 
                width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 32px', 
                borderRadius: 10, background: T.inputBg, border: `1px solid ${T.inputBorder}`, 
                color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' 
              }}
            />
          </div>

          {/* Inline Dish Percentages Capsule Strip */}
          {Object.keys(dishStats).length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: T.textSub, letterSpacing: '0.05em', textTransform: 'uppercase', marginRight: 4 }}>Surveys:</div>
              {Object.entries(dishStats).map(([dish, stat]) => {
                const isYesNo = stat.yesNoCount > 0
                const avg = isYesNo 
                  ? (stat.yesNoCount ? Math.round((stat.yesCount / stat.yesNoCount) * 100) : 0)
                  : (stat.count ? Math.round(stat.total / stat.count) : 0)
                const unit = isYesNo ? '%' : (stat.isCount ? '' : '%')
                
                return (
                  <div key={dish} style={{ 
                    display: 'flex', alignItems: 'center', gap: 6, 
                    background: T.inputBg, padding: '5px 10px', 
                    borderRadius: 10, border: `1px solid ${T.border}`
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.textSub, textTransform: 'uppercase' }}>{dish}</span>
                    <span style={{ fontSize: 11, fontWeight: 900, color: T.accent }}>{avg}{unit}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 3-Column Side-By-Side Flex Layout */}
        <div className="tracker-row">
          {/* YES Column */}
          <div className="tracker-col">
            <AdminCard className="col-card" style={{ borderTop: `4px solid ${T.success}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <SectionHeader style={{ margin: 0, fontSize: 13 }}>✅ YES THALI ({yesMembers.length})</SectionHeader>
                <Badge color={T.success} style={{ padding: '2px 8px' }}>Applied</Badge>
              </div>
              <div className="col-body">
                {yesMembers.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: T.textSub, fontSize: 12 }}>No one has applied yet.</div>
                ) : yesMembers.map(u => (
                  <MemberRow key={u.user_id} user={u} onClick={() => setSelectedUser(u)} />
                ))}
              </div>
            </AdminCard>
          </div>

          {/* NO Column */}
          <div className="tracker-col">
            <AdminCard className="col-card" style={{ borderTop: `4px solid ${T.danger}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <SectionHeader style={{ margin: 0, fontSize: 13 }}>❌ NO THALI ({noMembers.length})</SectionHeader>
                <Badge color={T.danger} style={{ padding: '2px 8px' }}>Skipped</Badge>
              </div>
              <div className="col-body">
                {noMembers.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: T.textSub, fontSize: 12 }}>No opt-outs yet.</div>
                ) : noMembers.map(u => (
                  <MemberRow key={u.user_id} user={u} onClick={() => setSelectedUser(u)} />
                ))}
              </div>
            </AdminCard>
          </div>

          {/* NO RESPONSE Column */}
          <div className="tracker-col">
            <AdminCard className="col-card" style={{ borderTop: `4px solid var(--text-tertiary)` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <SectionHeader style={{ margin: 0, fontSize: 13 }}>⌛ PENDING RESPONSE ({noResponse.length})</SectionHeader>
                <Badge color="var(--text-tertiary)" style={{ padding: '2px 8px' }}>Pending</Badge>
              </div>
              <div className="col-body">
                {noResponse.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: T.textSub, fontSize: 12 }}>All users have responded!</div>
                ) : noResponse.map(u => (
                  <PendingMemberRow key={u.user_id} user={u} />
                ))}
              </div>
            </AdminCard>
          </div>
        </div>
      </div>

      {/* CSS Styles injection for viewport height side-by-side dashboard */}
      <style>{`
        .tracker-dashboard {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 200px);
          min-height: 480px;
          box-sizing: border-box;
          overflow: hidden;
        }
        .tracker-row {
          display: flex;
          gap: 16px;
          flex: 1;
          min-height: 0;
          width: 100%;
        }
        .tracker-col {
          flex: 1;
          min-width: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .col-card {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          padding: 16px !important;
          box-sizing: border-box;
          overflow: hidden;
        }
        .col-body {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-right: 4px;
        }
        /* Custom sleek scrollbars for independent columns */
        .col-body::-webkit-scrollbar {
          width: 5px;
        }
        .col-body::-webkit-scrollbar-track {
          background: transparent;
        }
        .col-body::-webkit-scrollbar-thumb {
          background: rgba(212, 175, 55, 0.2);
          border-radius: 4px;
        }
        .col-body::-webkit-scrollbar-thumb:hover {
          background: rgba(212, 175, 55, 0.4);
        }
        .spin { animation: spin 1s linear infinite } 
        @keyframes spin { to { transform: rotate(360deg) } }

        @media (max-width: 768px) {
          .tracker-dashboard {
            height: auto;
            overflow: visible;
          }
          .tracker-row {
            flex-direction: column;
            height: auto;
          }
          .tracker-col {
            height: 450px;
            margin-bottom: 16px;
          }
        }
      `}</style>

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

      <SurveyAccessManager isOpen={isAccessManagerOpen} onClose={() => setIsAccessManagerOpen(false)} />

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
                {(Object.values(user.dishResponses || {}).reduce((acc, v) => {
                  if (v === 'yes' || v === 'no') return acc
                  const n = parseInt(v) || 0
                  return acc + (typeof v === 'string' && v.endsWith('%') ? n / 100 : n)
                }, 0)).toFixed(1)}
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
                {val === 'yes' ? '100%' : val === 'no' ? '0%' : (typeof val === 'string' && val.endsWith('%') ? val : `${val}`)}
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

function PendingMemberRow({ user }) {
  return (
    <div style={{ 
      padding: '10px 14px', borderRadius: 12, background: T.inputBg, border: `1px solid ${T.border}`,
      display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.textSub
    }}>
      <div style={{ 
        width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.03)', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: T.accent 
      }}>
        {user.thali_number}
      </div>
      <div style={{ fontWeight: 600, color: T.text }}>{user.name}</div>
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
