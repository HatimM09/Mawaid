import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/firebaseClient'
import { Modal, Btn, Select, Badge, T } from './ui'
import { Search, Shield, Users, X, Trash2 } from 'lucide-react'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export default function SurveyAccessManager({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])

  const [overrides, setOverrides] = useState({})

  const [allDays, setAllDays] = useState(false)
  const [days, setDays] = useState([])
  const [meal, setMeal] = useState('both')

  useEffect(() => {
    if (isOpen) {
      loadOverrides()
      loadUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const toggleUser = (u) => {
    setSelectedUsers(prev =>
      prev.some(x => x.user_id === u.user_id)
        ? prev.filter(x => x.user_id !== u.user_id)
        : [...prev, u]
    )
  }

  const toggleDay = (d) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  const handleGrant = async () => {
    if (!selectedUsers.length) return
    if (!allDays && days.length === 0) return

    const newOverrides = { ...overrides }
    selectedUsers.forEach(u => {
      const uid = u.user_id
      let current = { ...(overrides[uid] || {}) }
      if (allDays) {
        current.all = true
      } else {
        days.forEach(d => {
          if (!current[d]) current[d] = {}
          if (meal === 'both') {
            current[d].lunch = true
            current[d].dinner = true
          } else {
            current[d][meal] = true
          }
        })
      }
      newOverrides[uid] = current
    })

    const success = await saveOverrides(newOverrides)
    if (success) {
      setSelectedUsers([])
      setSearch('')
      setDays([])
      setAllDays(false)
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
  ).slice(0, 6) : []

  const selectedIds = new Set(selectedUsers.map(u => u.user_id))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Survey Access Control" maxWidth={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <p style={{ fontSize: 13, color: T.textSub, margin: 0 }}>
          Grant one or more members permission to re-select their survey outside the normal window. Select multiple members and multiple days at once.
        </p>

        {/* Selected Members */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Selected Members ({selectedUsers.length})
            </div>
            {selectedUsers.length > 0 && (
              <button onClick={() => setSelectedUsers([])} style={{ background: 'none', border: 'none', color: '#e05555', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Clear all
              </button>
            )}
          </div>
          {selectedUsers.length === 0 ? (
            <div style={{ padding: '14px 12px', textAlign: 'center', color: T.textSub, fontSize: 12, background: T.inputBg, borderRadius: 10 }}>
              No members selected yet. Search below to add members.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selectedUsers.map(u => (
                <span key={u.user_id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10,
                  background: T.accentBg, border: `1px solid ${T.accentBorder}`, fontSize: 12, fontWeight: 700,
                  color: T.text, fontFamily: 'inherit',
                }}>
                  <Users size={12} color={T.accent} />
                  {u.name} · #{u.thali_number}
                  <button onClick={() => toggleUser(u)} aria-label={`Remove ${u.name}`} style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', padding: 0, display: 'flex' }}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* User Search */}
        <div style={{ position: 'relative' }}>
          <Search size={16} color={T.textSub} style={{ position: 'absolute', left: 12, top: 13, zIndex: 1 }} />
          <input
            name="searchAccess"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members by name or thali #..."
            style={{
              width: '100%', boxSizing: 'border-box', padding: '12px 14px 12px 36px',
              borderRadius: 12, background: T.inputBg, border: `1px solid ${T.inputBorder}`,
              color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit',
            }}
          />
          {search.trim() && (
            <div style={{
              marginTop: 4,
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 12, maxHeight: 240, overflowY: 'auto',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)', zIndex: 10, position: 'relative',
            }}>
              {filteredUsers.length > 0 ? filteredUsers.map(u => {
                const isSel = selectedIds.has(u.user_id)
                return (
                  <div key={u.user_id} onClick={() => toggleUser(u)}
                    style={{
                      padding: '12px 14px', cursor: 'pointer', borderBottom: `1px solid ${T.border}`,
                      display: 'flex', alignItems: 'center', gap: 10, background: isSel ? T.accentBg : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.accentBg }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSel ? T.accentBg : 'transparent' }}
                  >
                    <span style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      border: `2px solid ${isSel ? T.accent : T.border}`, background: isSel ? T.accent : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSel && <span style={{ fontSize: 11, fontWeight: 900, color: '#000' }}>✓</span>}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: T.textSub }}>Thali #{u.thali_number}</div>
                    </div>
                  </div>
                )
              }) : (
                <div style={{ padding: '14px', fontSize: 13, color: T.textSub, textAlign: 'center' }}>No members found.</div>
              )}
            </div>
          )}
        </div>

        {/* Grant UI */}
        {selectedUsers.length > 0 && (
          <div style={{ background: T.accentBg, border: `1px solid ${T.accentBorder}`, borderRadius: 16, padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.textSub, marginBottom: 8, textTransform: 'uppercase' }}>
                Days to Grant
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" onClick={() => { setAllDays(!allDays); setDays([]) }}
                  style={{
                    padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 800, fontFamily: 'inherit',
                    background: allDays ? T.accentGrad : 'transparent', color: allDays ? '#000' : T.textSub,
                    border: `1.5px solid ${allDays ? 'transparent' : T.border}`,
                  }}>
                  All Days
                </button>
                {DAYS.map(d => {
                  const on = !allDays && days.includes(d)
                  return (
                    <button key={d} type="button" onClick={() => toggleDay(d)} disabled={allDays}
                      style={{
                        padding: '8px 14px', borderRadius: 10, cursor: allDays ? 'not-allowed' : 'pointer',
                        fontSize: 12, fontWeight: 800, fontFamily: 'inherit', textTransform: 'capitalize',
                        background: on ? T.accentGrad : 'transparent', color: on ? '#000' : T.textSub,
                        border: `1.5px solid ${on ? 'transparent' : T.border}`, opacity: allDays ? 0.45 : 1,
                      }}>
                      {d}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="accessMeal" style={{ display: 'block', fontSize: 11, fontWeight: 800, color: T.textSub, marginBottom: 6, textTransform: 'uppercase' }}>Meal</label>
              <Select id="accessMeal" name="accessMeal" value={meal} onChange={e => setMeal(e.target.value)} disabled={allDays}>
                <option value="both">Both Meals</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </Select>
            </div>

            <Btn variant="primary" onClick={handleGrant} disabled={loading || (!allDays && days.length === 0)} style={{ width: '100%', padding: '14px 20px', fontSize: 15, fontWeight: 800 }}>
              {loading ? 'Saving...' : `Grant Access (${selectedUsers.length} member${selectedUsers.length > 1 ? 's' : ''})`}
            </Btn>
          </div>
        )}

        {/* Active Overrides List */}
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.textSub, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active User Overrides
          </div>
          {(!overrides || Object.keys(overrides).length === 0) ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: T.textSub, fontSize: 13, background: T.inputBg, borderRadius: 12 }}>
              No custom survey access granted.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
              {Object.entries(overrides || {}).map(([uid, perms]) => {
                const u = users.find(x => x.user_id === uid) || { name: 'Unknown User', thali_number: '?' }
                return (
                  <div key={uid} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: T.textSub }}>Thali #{u.thali_number}</div>
                      </div>
                      <button onClick={() => handleRevokeAllUser(uid)}
                        style={{ background: 'rgba(224,85,85,0.1)', border: 'none', color: '#e05555', padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                        <Trash2 size={12} /> Revoke All
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {perms.all && (
                        <Badge color={T.success} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}>
                          All Days <X size={10} style={{ cursor: 'pointer' }} onClick={() => handleRevoke(uid, 'all')} />
                        </Badge>
                      )}
                      {Object.entries(perms).map(([d, m]) => {
                        if (d === 'all') return null
                        const mealStr = m.lunch && m.dinner ? 'Both' : m.lunch ? 'Lunch' : 'Dinner'
                        return (
                          <Badge key={d} color={T.accent} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}>
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
