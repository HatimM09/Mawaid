import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Modal, Btn, Input, Select, Badge, Spinner, T } from './ui'
import { Search, Shield, Save, X, Trash2 } from 'lucide-react'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export default function SurveyAccessManager({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  
  const [overrides, setOverrides] = useState({})
  
  const [day, setDay] = useState('all') // 'all' or specific day
  const [meal, setMeal] = useState('both') // 'lunch', 'dinner', 'both'
  const [type, setType] = useState('edit') // 'fill', 'edit' -> functionally we just grant access

  useEffect(() => {
    if (isOpen) {
      loadOverrides()
      loadUsers()
    }
  }, [isOpen])

  const loadOverrides = async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'user_overrides').maybeSingle()
      if (data && data.value) {
        const parsed = typeof data.value === 'string'
          ? JSON.parse(data.value)
          : data.value
        setOverrides(parsed || {})
      } else {
        setOverrides({})
      }
    } catch (e) {
      setOverrides({})
    }
  }

  const loadUsers = async () => {
    const { data } = await supabase.from('user_stats').select('user_id, name, thali_number, email')
    if (data) setUsers(data)
  }

  const saveOverrides = async (newOverrides) => {
    setLoading(true)
    const { error } = await supabase.from('app_settings').upsert([
      { key: 'user_overrides', value: JSON.stringify(newOverrides) }
    ], { onConflict: 'key' })
    
    if (error) {
      alert("Failed to save: " + error.message)
    } else {
      setOverrides(newOverrides)
    }
    setLoading(false)
    return !error
  }

  const handleGrant = async () => {
    if (!selectedUser) return
    const uid = selectedUser.user_id
    
    let current = { ...(overrides[uid] || {}) }
    
    if (day === 'all') {
      current.all = true
    } else {
      if (!current[day]) current[day] = {}
      if (meal === 'both') {
        current[day].lunch = true
        current[day].dinner = true
      } else {
        current[day][meal] = true
      }
    }

    const newOverrides = { ...overrides, [uid]: current }
    const success = await saveOverrides(newOverrides)
    if (success) {
      setSelectedUser(null)
      setSearch('')
    }
  }

  const handleRevoke = async (uid, dayKey) => {
    let current = { ...(overrides[uid] || {}) }
    if (dayKey === 'all') {
      delete current.all
    } else {
      delete current[dayKey]
    }
    
    let newOverrides = { ...overrides }
    if (Object.keys(current).length === 0) {
      delete newOverrides[uid]
    } else {
      newOverrides[uid] = current
    }
    
    await saveOverrides(newOverrides)
  }
  
  const handleRevokeAllUser = async (uid) => {
    let newOverrides = { ...overrides }
    delete newOverrides[uid]
    await saveOverrides(newOverrides)
  }

  const filteredUsers = search.trim() ? users.filter(u => 
    (u.name || '').toLowerCase().includes(search.toLowerCase()) || 
    String(u.thali_number || '').includes(search)
  ).slice(0, 5) : []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Survey Access Control" maxWidth={600}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: T.textSub, marginBottom: 16 }}>
          Grant specific users permission to fill or edit their survey outside of normal windows.
        </p>

        {/* User Search */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={16} color={T.textSub} style={{ position: 'absolute', left: 12, top: 12 }} />
          <input 
            value={search} 
            onChange={e => { setSearch(e.target.value); setSelectedUser(null) }} 
            placeholder="Search member by name or thali #..."
            style={{ 
              width: '100%', boxSizing: 'border-box', padding: '10px 14px 10px 36px', 
              borderRadius: 12, background: T.inputBg, border: `1px solid ${T.inputBorder}`, 
              color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' 
            }}
          />
          {search.trim() && !selectedUser && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: T.cardHover, border: `1px solid ${T.border}`, borderRadius: 12, marginTop: 4, zIndex: 10, overflow: 'hidden' }}>
              {filteredUsers.length > 0 ? filteredUsers.map(u => (
                <div key={u.user_id} onClick={() => { setSelectedUser(u); setSearch('') }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: T.textSub }}>Thali #{u.thali_number}</div>
                </div>
              )) : (
                <div style={{ padding: '10px 14px', fontSize: 13, color: T.textSub }}>No members found.</div>
              )}
            </div>
          )}
        </div>

        {/* Grant UI */}
        {selectedUser && (
          <div style={{ background: T.accentBg, border: `1px solid ${T.accentBorder}`, borderRadius: 16, padding: 16, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{selectedUser.name}</div>
                <div style={{ fontSize: 12, color: T.textSub }}>Thali #{selectedUser.thali_number}</div>
              </div>
              <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: T.textSub, marginBottom: 6, textTransform: 'uppercase' }}>Day</label>
                <Select value={day} onChange={e => setDay(e.target.value)}>
                  <option value="all">All Days</option>
                  {DAYS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </Select>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: T.textSub, marginBottom: 6, textTransform: 'uppercase' }}>Meal</label>
                <Select value={meal} onChange={e => setMeal(e.target.value)} disabled={day === 'all'}>
                  <option value="both">Both Meals</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                </Select>
              </div>
            </div>

            <Btn variant="primary" onClick={handleGrant} disabled={loading} style={{ width: '100%', borderRadius: 12 }}>
              {loading ? 'Saving...' : 'Grant Access'}
            </Btn>
          </div>
        )}

        {/* Active Overrides List */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.textSub, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active User Overrides
          </div>
          {(!overrides || Object.keys(overrides).length === 0) ? (
            <div style={{ padding: 20, textAlign: 'center', color: T.textSub, fontSize: 13, background: T.inputBg, borderRadius: 12 }}>
              No custom survey access granted.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(overrides || {}).map(([uid, perms]) => {
                const u = users.find(x => x.user_id === uid) || { name: 'Unknown User', thali_number: '?' }
                return (
                  <div key={uid} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{u.name}</div>
                        <div style={{ fontSize: 12, color: T.textSub }}>Thali #{u.thali_number}</div>
                      </div>
                      <button onClick={() => handleRevokeAllUser(uid)} style={{ background: 'rgba(224,85,85,0.1)', border: 'none', color: '#e05555', padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Trash2 size={12} /> Revoke All
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {perms.all && (
                        <Badge color={T.success} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          All Days <X size={10} style={{ cursor: 'pointer' }} onClick={() => handleRevoke(uid, 'all')} />
                        </Badge>
                      )}
                      {Object.entries(perms).map(([d, m]) => {
                        if (d === 'all') return null
                        const mealStr = m.lunch && m.dinner ? 'Both' : m.lunch ? 'Lunch' : 'Dinner'
                        return (
                          <Badge key={d} color={T.accent} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {d.charAt(0).toUpperCase() + d.slice(1)}: {mealStr}
                            <X size={10} style={{ cursor: 'pointer' }} onClick={() => handleRevoke(uid, d)} />
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
