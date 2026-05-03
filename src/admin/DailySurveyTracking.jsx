// src/admin/DailySurveyTracking.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { 
  Search, RefreshCw, ChevronRight, Check, X, Filter, 
  Calendar, Utensils, User as UserIcon, Clock, ChevronDown, ChevronUp
} from 'lucide-react'
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
  const [meal, setMeal] = useState(() => new Date().getHours() < 16 ? 'lunch' : 'dinner')
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const getWeekDate = () => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(now.setDate(diff))
    return monday.toISOString().split('T')[0]
  }

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)
    
    try {
      const currentWeekId = getWeekDate()
      const [{ data: flat }, { data: us }] = await Promise.all([
        supabase.from('survey_submissions_flat').select('*').eq('week_id', currentWeekId),
        supabase.from('user_stats').select('user_id, name, thali_number, email')
      ])
      
      const dayKey = day.substring(0, 3).toLowerCase()
      const mealKey = meal === 'lunch' ? 'l' : 'd'
      const statusKey = `${dayKey}_${mealKey}_status`
      
      const results = (us || []).map(u => {
        const resp = (flat || []).find(r => r.user_id === u.user_id)
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
  }, [load])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter(u => 
      (u.name || '').toLowerCase().includes(q) || 
      String(u.thali_number || '').includes(q)
    )
  }, [users, search])

  const yesMembers = filtered.filter(u => u.status === 'Applied')
  const noMembers = filtered.filter(u => u.status === 'Not Applied')
  const noResponse = filtered.filter(u => !u.status)

  if (loading && users.length === 0) return <Spinner />

  return (
    <PageWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <PageTitle sub={`Tracking survey responses for ${day.toUpperCase()} ${meal.toUpperCase()}`}>Daily Survey Tracker</PageTitle>
        <Btn variant="outline" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Syncing...' : 'Sync Now'}
        </Btn>
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

      {/* User Details Modal */}
      <Modal 
        isOpen={!!selectedUser} 
        onClose={() => setSelectedUser(null)}
        title={`${selectedUser?.name}'s Survey Details`}
        maxWidth={500}
      >
        {selectedUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 60, height: 60, borderRadius: 14, background: T.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, color: '#fff' }}>
                {selectedUser.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{selectedUser.name}</div>
                <div style={{ fontSize: 13, color: T.textSub }}>Thali #{selectedUser.thali_number} • {selectedUser.email}</div>
              </div>
            </div>

            <div style={{ padding: 16, borderRadius: 14, background: T.inputBg, border: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.textSub }}>MEAL STATUS</span>
                <Badge color={selectedUser.status === 'Applied' ? T.success : T.danger}>
                  {selectedUser.status === 'Applied' ? 'YES (TAKING THALI)' : 'NO (SKIPPING)'}
                </Badge>
              </div>

              {selectedUser.status === 'Applied' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, borderBottom: `1px solid ${T.border}`, paddingBottom: 6 }}>DISH-WISE PORTIONS</div>
                  {Object.entries(selectedUser.dishResponses || {}).map(([dish, val]) => (
                    <div key={dish} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: T.text }}>{dish}</span>
                      <span style={{ fontWeight: 800, color: T.accent }}>
                        {val === 'yes' ? '✅ YES' : val === 'no' ? '❌ NO' : `${val}%`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0', color: T.textSub, fontStyle: 'italic' }}>
                  Member has opted out of this meal.
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: T.textSub, textAlign: 'center' }}>
              Last updated: {selectedUser.updated_at ? new Date(selectedUser.updated_at).toLocaleString() : 'N/A'}
            </div>

            <Btn style={{ width: '100%' }} onClick={() => setSelectedUser(null)}>Close Details</Btn>
          </div>
        )}
      </Modal>

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
