// src/admin/UsersPage.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { Search, RefreshCw, UserPlus, Edit2, Trash2, X, Shield, Phone, MapPin, UserCheck } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Table, Badge, Btn, Spinner, Input, Grid, SectionHeader, fmtDate, Alert } from './ui'
import { useOutletContext } from 'react-router-dom'

export default function UsersPage() {
  const context = useOutletContext() || { role: 'khidmat' }
  const { role } = context
  const isAdmin = role === 'admin'
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [isAdding, setIsAdding] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [limit] = useState(30)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [fetchingMore, setFetchingMore] = useState(false)

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true)
      setPage(0)
      setHasMore(true)
    } else {
      setFetchingMore(true)
    }

    const currentPage = isInitial ? 0 : page
    const { data, error } = await supabase
      .from('user_stats')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(currentPage * limit, (currentPage + 1) * limit - 1)
    
    if (error) {
      setError('Failed to load users')
    } else {
      if (isInitial) setUsers(data || [])
      else setUsers(prev => [...prev, ...(data || [])])
      
      if ((data || []).length < limit) setHasMore(false)
      if (!isInitial) setPage(p => p + 1)
    }
    setLoading(false)
    setFetchingMore(false)
  }, [limit, page])

  useEffect(() => { 
    load(true)
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    const isNew = !editForm.id
    
    try {
      const { error } = await supabase
        .from('user_stats')
        .upsert([editForm])
      
      if (error) throw error
      setSuccess(isNew ? 'Member added successfully' : 'Member updated successfully')
      setTimeout(() => { setEditForm(null); setIsAdding(false); load(true) }, 1000)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (user) => {
    if (!window.confirm(`Are you sure you want to delete ${user.name || 'this user'}?`)) return
    try {
      const { error } = await supabase
        .from('user_stats')
        .delete()
        .eq('id', user.id)
      
      if (error) throw error
      setSuccess('Member deleted')
      load(true)
    } catch (err) {
      setError(err.message)
    }
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return (u.name || u.email || '').toLowerCase().includes(q)
      || String(u.thali_number || '').includes(q)
      || (u.phone || '').includes(q)
  })

  // Quick Stats
  const stats = {
    total: users.length,
    active: users.filter(u => u.name && u.thali_number).length,
    missingInfo: users.filter(u => !u.thali_number || !u.name).length
  }

  const rows = filtered.map(u => [
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: u.avatar_url ? `url(${u.avatar_url}) center/cover` : T.accentGrad,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, color: '#fff', border: `1px solid ${T.border}`
      }}>
        {!u.avatar_url && (u.name || u.email || 'U').charAt(0).toUpperCase()}
      </div>
      <div>
        <div style={{ fontWeight: 600, color: T.text, fontSize: 13 }}>{u.name || '—'}</div>
        <div style={{ color: T.textSub, fontSize: 11 }}>{u.email}</div>
      </div>
    </div>,
    <Badge color={u.thali_number ? T.accent : T.danger}>{u.thali_number ? `#${u.thali_number}` : 'No Thali'}</Badge>,
    <div style={{ fontSize: 13, color: T.text }}>{u.phone || '—'}</div>,
    <div style={{ fontSize: 12, color: T.textSub, maxWidth: 180 }}>{u.address || '—'}</div>,
    <div style={{ fontSize: 12, color: T.textSub }}>{fmtDate(u.created_at)}</div>,
    <div style={{ display: 'flex', gap: 8 }}>
      {isAdmin ? (
        <>
          <Btn size="sm" variant="outline" onClick={() => setEditForm(u)} title="Edit"><Edit2 size={13} /></Btn>
          <Btn size="sm" variant="danger" onClick={() => handleDelete(u)} title="Delete"><Trash2 size={13} /></Btn>
        </>
      ) : (
        <span style={{ fontSize: 11, color: T.textSub, opacity: 0.5 }}>View Only</span>
      )}
    </div>,
  ])

  return (
    <PageWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <PageTitle sub="Full management of thali user profiles and database status">Thali Users Database</PageTitle>
        {isAdmin && (
          <Btn onClick={() => { setEditForm({ name: '', email: '', thali_number: '', phone: '', address: '' }); setIsAdding(true); }}>
            <UserPlus size={16} /> <span className="desktop-only">Add Thali User</span><span className="mobile-only" style={{ display: 'none' }}>Add</span>
          </Btn>
        )}
      </div>

      <Grid cols={3} style={{ marginBottom: 24 }}>
        <AdminCard className="stagger-item" style={{ textAlign: 'center', animationDelay: '0.05s' }}>
          <div style={{ fontSize: 11, color: T.textSub, textTransform: 'uppercase', marginBottom: 4 }}>Total Thali Users</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.accent }}>{stats.total}</div>
        </AdminCard>
        <AdminCard className="stagger-item" style={{ textAlign: 'center', animationDelay: '0.1s' }}>
          <div style={{ fontSize: 11, color: T.textSub, textTransform: 'uppercase', marginBottom: 4 }}>Complete Profiles</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.success }}>{stats.active}</div>
        </AdminCard>
        <AdminCard className="stagger-item" style={{ textAlign: 'center', animationDelay: '0.15s' }}>
          <div style={{ fontSize: 11, color: T.textSub, textTransform: 'uppercase', marginBottom: 4 }}>Incomplete</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.danger }}>{stats.missingInfo}</div>
        </AdminCard>
      </Grid>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
          <Search size={15} color={T.textSub} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, thali or phone…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '12px 14px 12px 40px', borderRadius: 12,
              background: T.inputBg, border: `1px solid ${T.inputBorder}`,
              color: T.text, fontSize: 14, outline: 'none', transition: 'border 0.2s',
            }}
          />
        </div>
        <Btn variant="ghost" onClick={() => load()} title="Sync manually"><RefreshCw size={15} className={loading ? 'spin' : ''} /></Btn>
      </div>

      {loading && users.length === 0 ? <Spinner /> : (
        <>
          <AdminCard style={{ padding: 0, overflow: 'hidden' }}>
            <Table
              headers={['User Identity', 'Thali #', 'Contact', 'Address', 'Joined On', 'Actions']}
              rows={rows}
              emptyMsg="No thali users found matching your search."
            />
          </AdminCard>
          
          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, paddingBottom: 40 }}>
              <Btn 
                variant="outline" 
                onClick={() => load(false)} 
                disabled={fetchingMore}
                style={{ minWidth: 160 }}
              >
                {fetchingMore ? <RefreshCw size={15} className="spin" /> : 'Load More Thali Users'}
              </Btn>
            </div>
          )}
        </>
      )}

      {/* Edit/Add Modal */}
      {editForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <AdminCard style={{ width: '100%', maxWidth: 480, position: 'relative', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}>
            <button 
              onClick={() => setEditForm(null)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: T.textSub, cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <h2 style={{ color: T.accent, marginTop: 0, marginBottom: 8, fontSize: 20 }}>
              {isAdding ? 'Add New Thali User' : 'Edit Thali User Details'}
            </h2>
            <p style={{ color: T.textSub, fontSize: 13, marginBottom: 24 }}> Ensure all information is accurate for food delivery.</p>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input label="Email (Primary Key)" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} disabled={!isAdding} required />
              <Grid cols={2}>
                <Input label="Full Name" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                <Input label="Thali Number" value={editForm.thali_number} onChange={e => setEditForm({...editForm, thali_number: e.target.value})} type="number" />
              </Grid>
              <Input label="Phone Number" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
              <Input label="Residential Address" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
              <Input label="City" value={editForm.city} onChange={e => setEditForm({...editForm, city: e.target.value})} />
              
              {error && <Alert msg={error} />}
              {success && <Alert msg={success} type="success" />}

              <div style={{ marginTop: 12, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <Btn variant="ghost" type="button" onClick={() => setEditForm(null)}>Cancel</Btn>
                <Btn type="submit" disabled={loading}>{isAdding ? 'Create Thali User' : 'Save Changes'}</Btn>
              </div>
            </form>
          </AdminCard>
        </div>
      )}

      <style>{`.spin { animation: spin 1s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </PageWrap>
  )
}

