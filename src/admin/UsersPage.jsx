// src/admin/UsersPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, supabaseUrl, supabaseAnonKey } from './supabaseClient'
import { createClient } from '@supabase/supabase-js'
import { Search, RefreshCw, UserPlus, Edit2, Trash2, X, Shield, Phone, MapPin, UserCheck, QrCode, Download, Printer } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
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
  const [qrPrintMode, setQrPrintMode] = useState(false)
  const [qrDetailUser, setQrDetailUser] = useState(null)
  const [showAllQr, setShowAllQr] = useState(false)
  const sentinelRef = useRef(null)

  // ── Infinite Scroll: auto-load when sentinel is visible (stable ref avoids stale closures) ──
  const loadRef = useRef(null)
  // ── Infinite Scroll: auto-load when sentinel is visible (stable ref avoids stale closures) ──
  useEffect(() => {
    if (!hasMore || fetchingMore || loading || users.length === 0) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !fetchingMore && !loading) {
          loadRef.current(false)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, fetchingMore, loading, users.length])

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

  loadRef.current = load

  useEffect(() => { 
    load(true)
  }, [load])

  // --- REAL-TIME SUBSCRIPTION (stable ref to avoid re-subscribing on pagination) ---
  useEffect(() => {
    const channel = supabase
      .channel('users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_stats' }, () => {
        loadRef.current(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    const isNew = !editForm.id
    try {
      setLoading(true)
      if (isNew) {
        const tempClient = createClient(supabaseUrl, supabaseAnonKey, { 
          auth: { persistSession: false, autoRefreshToken: false, storageKey: 'dummy-auth-token' } 
        })
        const authPassword = editForm.password || `Mawaid@${editForm.thali_number || '123'}`
        const { data: authData, error: authError } = await tempClient.auth.signUp({
          email: editForm.email,
          password: authPassword,
          options: {
            data: {
              name: editForm.name,
              thali_number: editForm.thali_number,
              avatar_url: editForm.avatar_url
            }
          }
        })

        if (authError) throw authError
        
        // Use the new user ID
        editForm.id = authData.user.id
        editForm.user_id = authData.user.id
      }

      // Create a clean object for the database without the password
      const { password, ...dataToSave } = editForm
      
      const { error } = await supabase
        .from('user_stats')
        .upsert([dataToSave])
      
      if (error) throw error
      setSuccess(isNew ? 'Member created & Auth enabled' : 'Member updated successfully')
      setTimeout(() => { setEditForm(null); setIsAdding(false); load(true) }, 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Download individual user QR as JPG ──
  const downloadUserQr = (userId, userName) => {
    const qrEl = document.getElementById(`user-qr-${userId}`)
    if (!qrEl) return
    const canvas = qrEl.querySelector('canvas')
    if (!canvas) return
    const safeName = (userName || 'user').replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const link = document.createElement('a')
    link.download = `al-mawaid-${safeName}-${new Date().toISOString().split('T')[0]}.jpg`
    link.href = canvas.toDataURL('image/jpeg', 0.92)
    link.click()
  }

  // ── Print all QR labels ──
  const printAllQrLabels = () => {
    setQrPrintMode(true)
    // Close detail overlay if open
    setQrDetailUser(null)
    // A small delay to let the print-optimized content render
    setTimeout(() => {
      window.print()
    }, 200)
  }

  // ── Close print overlay with Escape key ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && qrPrintMode) {
        setQrPrintMode(false)
      }
    }
    const handlePrint = () => {
      if (qrPrintMode) {
        setQrPrintMode(false)
      }
    }
    window.addEventListener('afterprint', handlePrint)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('afterprint', handlePrint)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [qrPrintMode])

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* QR Code mini + download */}
      <div id={`user-qr-${u.user_id || u.id}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div
          onClick={() => setQrDetailUser(u)}
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: '#fff', padding: 2, cursor: 'pointer',
            border: `1px solid ${T.borderGlass || 'rgba(197,160,89,0.15)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)'; }}
          title="View & Download QR"
        >
          <QRCodeCanvas value={`ALMAWAID:${u.user_id || u.id}`} size={28} level="H" style={{ display: 'block', borderRadius: 4 }} />
        </div>          <button onClick={(e) => { e.stopPropagation(); downloadUserQr(u.user_id || u.id, u.name || u.thali_number) }}
          style={{
            padding: '4px 6px', borderRadius: 6, border: `1px solid ${T.border}`,
            background: 'transparent', color: T.textSub, cursor: 'pointer', fontSize: 9, fontWeight: 700,
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(197,160,89,0.08)'; e.currentTarget.style.color = T.accent; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.textSub; }}
          title="Download JPG"
        >
          <Download size={9} /> JPG
        </button>
        <button onClick={(e) => { e.stopPropagation(); printAllQrLabels() }}
          style={{
            padding: '4px 6px', borderRadius: 6, border: `1px solid rgba(96,165,250,0.2)`,
            background: 'transparent', color: '#60a5fa', cursor: 'pointer', fontSize: 9, fontWeight: 700,
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96,165,250,0.08)'; e.currentTarget.style.color = '#93c5fd'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#60a5fa'; }}
          title="Print / Save as PDF"
        >
          <Printer size={9} /> PDF
        </button>
      </div>
      {/* Actions */}
      {isAdmin ? (
        <>
          <Btn size="sm" variant="outline" onClick={() => setEditForm(u)} title="Edit"><Edit2 size={13} /></Btn>
          <Btn size="sm" variant="danger" onClick={() => handleDelete(u)} title="Delete"><Trash2 size={13} /></Btn>
        </>
      ) : (
        <span style={{ fontSize: 11, color: T.textSub, opacity: 0.5, marginLeft: 8 }}>View Only</span>
      )}
    </div>,
  ])

  return (
    <PageWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <PageTitle>Thali Users Database</PageTitle>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn variant="outline" onClick={() => setShowAllQr(!showAllQr)}>
            <QrCode size={16} />
            <span className="desktop-only">{showAllQr ? 'Hide QR Grid' : 'QR Code Gallery'}</span>
          </Btn>
          <Btn variant="outline" onClick={printAllQrLabels}>
            <Printer size={16} /> <span className="desktop-only">Print All Labels</span>
          </Btn>
          {isAdmin && (
            <Btn onClick={() => {            setEditForm({ name: '', email: '', thali_number: '', phone: '', address: '', password: '', avatar_url: '', snack_defaults: { dish_1: 0, dish_2: 0, dish_3: 0, dish_4: 0 } }); setIsAdding(true); }}>
              <UserPlus size={16} /> <span className="desktop-only">Add Thali User</span><span className="mobile-only" style={{ display: 'none' }}>Add</span>
            </Btn>
          )}
        </div>
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
            name="searchUsers"
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
              headers={['User Identity', 'Thali #', 'Contact', 'Address', 'Joined On', 'QR Code & Actions']}
              rows={rows}
              emptyMsg="No thali users found matching your search."
            />
          </AdminCard>
          
          {/* Infinite scroll sentinel + load more indicator */}
          {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, paddingBottom: 40, transition: 'all 0.3s' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: fetchingMore ? '16px 0' : 0,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              }}>
                {fetchingMore && (
                  <>
                    <RefreshCw size={18} className="spin" style={{ color: T.accent }} />
                    <span style={{ fontSize: 13, color: T.textSub, fontWeight: 600 }}>Loading more users…</span>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── QR CODE GALLERY (expandable grid) ── */}
      {showAllQr && (
        <AdminCard style={{ marginTop: 20, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <QrCode size={18} color={T.accent} />
              <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>All Member QR Codes</span>
              <Badge color={T.accent}>{filtered.length} members</Badge>
            </div>
            <Btn size="sm" variant="outline" onClick={printAllQrLabels}>
              <Printer size={14} /> Print All
            </Btn>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: 16,
          }}>
            {filtered.map(u => (
              <div key={u.user_id || u.id} style={{
                textAlign: 'center',
                padding: 14, borderRadius: 14,
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${T.border}`,
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(197,160,89,0.06)'; e.currentTarget.style.borderColor = 'rgba(197,160,89,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = T.border; }}
              >
                <div style={{ background: '#fff', borderRadius: 10, padding: 6, display: 'inline-block', marginBottom: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  <QRCodeCanvas value={`ALMAWAID:${u.user_id || u.id}`} size={80} level="H" style={{ display: 'block', cursor: 'pointer' }}
                    onClick={() => setQrDetailUser(u)}
                  />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.accent }}>#{u.thali_number || '—'}</div>
                <div style={{ fontSize: 11, color: T.textSub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || u.email || ''}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'center' }}>
                  <button onClick={() => downloadUserQr(u.user_id || u.id, u.name || u.thali_number)}
                    style={{
                      padding: '3px 8px', borderRadius: 6, border: `1px solid ${T.border}`,
                      background: 'transparent', color: T.textSub, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                      fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3,
                    }}
                  >
                    <Download size={8} /> JPG
                  </button>
                  <button onClick={() => printAllQrLabels()}
                    style={{
                      padding: '3px 8px', borderRadius: 6, border: `1px solid rgba(96,165,250,0.2)`,
                      background: 'transparent', color: '#60a5fa', cursor: 'pointer', fontSize: 9, fontWeight: 700,
                      fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3,
                    }}
                  >
                    <Printer size={8} /> PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      {/* ── QR DETAIL OVERLAY (individual user) ── */}
      {qrDetailUser && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(16px)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }} onClick={() => setQrDetailUser(null)}>
          <AdminCard style={{
            maxWidth: 340, width: '100%', position: 'relative', textAlign: 'center',
            boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
          }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setQrDetailUser(null)}
              style={{
                position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.05)',
                border: 'none', color: T.textSub, cursor: 'pointer', padding: 8, borderRadius: 10,
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={18} />
            </button>

            <div style={{ marginBottom: 16, paddingTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Member QR Code</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.accent, marginTop: 4 }}>
                <span style={{ color: T.textSub, fontSize: 14 }}>Thali #{qrDetailUser.thali_number || '—'}</span>
              </div>
            </div>

            <div id={`user-qr-detail-${qrDetailUser.user_id || qrDetailUser.id}`} style={{
              background: '#fff', borderRadius: 16, padding: 16, display: 'inline-block',
              marginBottom: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}>
              <QRCodeCanvas value={`ALMAWAID:${qrDetailUser.user_id || qrDetailUser.id}`} size={200} level="H" />
            </div>

            <div style={{ fontSize: 12, color: T.textSub, marginBottom: 16, fontFamily: 'monospace', wordBreak: 'break-all', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 8 }}>
              ALMAWAID:{qrDetailUser.user_id || qrDetailUser.id}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <Btn style={{ flex: 1 }} onClick={() => {
                const qrEl = document.getElementById(`user-qr-detail-${qrDetailUser.user_id || qrDetailUser.id}`)
                if (!qrEl) return
                const canvas = qrEl.querySelector('canvas')
                if (!canvas) return
                const link = document.createElement('a')
                link.download = `al-mawaid-${(qrDetailUser.name || 'user').replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.jpg`
                link.href = canvas.toDataURL('image/jpeg', 0.92)
                link.click()
              }}>
                <Download size={14} /> Download JPG
              </Btn>
              <Btn variant="outline" style={{ flex: 1 }} onClick={() => {
                setQrDetailUser(null)
                printAllQrLabels()
              }}>
                <Printer size={14} /> Print All / PDF
              </Btn>
            </div>
          </AdminCard>
        </div>
      )}

      {/* ── PRINT OVERLAY (all QR labels in a print-friendly grid) ── */}
      {qrPrintMode && (
        <div className="qr-print-overlay" style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: '#fff', overflow: 'auto',
          padding: '40px 30px', boxSizing: 'border-box',
        }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: '#000', margin: 0, fontFamily: "'DM Sans',sans-serif" }}>Al-Mawaid — Member QR Code Labels</h1>
              <p style={{ fontSize: 13, color: '#666', marginTop: 6, fontFamily: "'DM Sans',sans-serif" }}>
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} • {filtered.length} members
              </p>
              <p style={{ fontSize: 11, color: '#999', marginTop: 4, fontFamily: "'DM Sans',sans-serif" }}>
                Scan with wireless scanner for quick check-in. Print on A4, cut along labels.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 16,
            }}>
              {filtered.map(u => (
                <div key={u.user_id || u.id} className="qr-label-print" style={{
                  textAlign: 'center',
                  border: '1.5px dashed #ddd',
                  borderRadius: 12,
                  padding: '16px 12px',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                  background: '#fafafa',
                }}>
                  <div style={{ marginBottom: 8 }}>
                    <QRCodeCanvas value={`ALMAWAID:${u.user_id || u.id}`} size={120} level="H" style={{ display: 'block', margin: '0 auto' }} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#b8860b', fontFamily: "'DM Sans',sans-serif" }}>#{u.thali_number || '—'}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#222', marginTop: 2, fontFamily: "'DM Sans',sans-serif" }}>{u.name || 'User'}</div>
                  <div style={{ fontSize: 8, color: '#999', marginTop: 4, fontFamily: 'monospace', wordBreak: 'break-all' }}>ALMAWAID:{u.user_id?.slice(0, 12) || u.id?.slice(0, 12) || ''}…</div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: 40 }} className="no-print">
              <button onClick={() => setQrPrintMode(false)}
                style={{
                  padding: '12px 32px', borderRadius: 10, background: '#111',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#333'}
                onMouseLeave={e => e.currentTarget.style.background = '#111'}
              >
                ✕ Close &mdash; or press Esc
              </button>
            </div>
          </div>
        </div>
      )}

      {editForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)', zIndex: 100,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 20px',
          overflowY: 'auto',
        }}>
          <AdminCard style={{ width: '100%', maxWidth: 480, position: 'relative', boxShadow: '0 32px 64px rgba(0,0,0,0.5)', marginTop: 40, marginBottom: 40 }}>
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
              <Input label="Email (Primary Key)" name="userEmail" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} disabled={!isAdding} required />
              <Grid cols={2}>
                <Input label="Full Name" name="userName" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                <Input label="Thali Number" name="userThali" value={editForm.thali_number} onChange={e => setEditForm({...editForm, thali_number: e.target.value})} />
              </Grid>
              <Input label="Phone Number" name="userPhone" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
              <Input label="Residential Address" name="userAddress" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />

              <SectionHeader>Snack Defaults (Lunch Dish 1–4)</SectionHeader>
              <p style={{ color: T.textSub, fontSize: 12, margin: '0 0 12px' }}>Set the default count for each snack dish. Users can only reduce these values when filling their weekly survey.</p>
              <Grid cols={4}>
                {['dish_1','dish_2','dish_3','dish_4'].map((dishKey, i) => (
                  <Input
                    key={dishKey}
                    label={`Dish ${i + 1}`}
                    name={dishKey}
                    type="number"
                    min="0"
                    value={editForm.snack_defaults?.[dishKey] ?? 0}
                    onChange={e => setEditForm({
                      ...editForm,
                      snack_defaults: { ...editForm.snack_defaults, [dishKey]: parseInt(e.target.value, 10) || 0 }
                    })}
                  />
                ))}
              </Grid>
              
              <SectionHeader>Auth & Profile</SectionHeader>
              <Grid cols={2}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Input label="Profile Picture URL" name="userAvatar" value={editForm.avatar_url} onChange={e => setEditForm({...editForm, avatar_url: e.target.value})} placeholder="https://..." />
                  {editForm.avatar_url && (
                    <img src={editForm.avatar_url} alt="Preview" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${T.border}` }} />
                  )}
                </div>
                {isAdding && <Input label="Assign Password" name="userPassword" type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} placeholder="Min 6 chars" required />}
              </Grid>
              
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

      <style>{`
        .spin { animation: spin 1s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }
        .admin-page-wrap { animation: fadeSlideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

        /* Print-optimized QR label layout */
        @media print {
          body > *:not(.qr-print-overlay) { display: none !important; }
          .qr-print-overlay {
            position: static !important;
            background: #fff !important;
            padding: 20px !important;
          }
          .qr-print-overlay .no-print { display: none !important; }
          .qr-label-print {
            border: 1px solid #ccc !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .qr-label-print canvas { margin: 0 auto !important; }
        }
      `}</style>
    </PageWrap>
  )
}

