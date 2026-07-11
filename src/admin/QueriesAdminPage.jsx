import React, { useState, useEffect, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase, db, C, getCol, getDocRef } from '../lib/firebaseClient'
import { RefreshCw, Search, Send, ChevronDown, ChevronUp, ShieldAlert, Lock } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Badge, Btn, fmtDateTime } from './ui'
import { AdminTableSkeleton } from '../common/Skeleton'

const STATUS_COLORS = { open: '#e09855', resolved: '#5eba82', in_progress: '#9aabb8' }

export default function QueriesAdminPage() {
  const context = useOutletContext() || { role: 'khidmat' }
  const { role } = context
  const isAdmin = role === 'admin'
  const [loading, setLoading]   = useState(true)
  const [queries, setQueries]   = useState([])
  const [allQueries, setAllQueries] = useState([])
  const [users, setUsers]       = useState({})
  const [statusFilter, setStatusFilter] = useState('open')
  const [search, setSearch]     = useState('')
  const [showAll, setShowAll]   = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [reply, setReply]       = useState('')
  const [sending, setSending]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: q }, { data: us }] = await Promise.all([
      supabase.from('queries').select('*').order('created_at', { ascending: false }),
      supabase.from('user_stats').select('user_id,name,email,thali_number'),
    ])
    const uMap = {}
    ;(us || []).forEach(u => { uMap[u.user_id] = u })
    setUsers(uMap)
    const data = q || []
    setAllQueries(data)
    setQueries(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // --- REAL-TIME SUBSCRIPTION ---
  useEffect(() => {
    const channel = supabase
      .channel('queries-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queries' }, () => {
        load()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  const updateStatus = async (id, status) => {
    const updateObj = { status, updated_at: new Date().toISOString() }
    if (status === 'resolved') {
      updateObj.admin_reply = 'Resolved by Al-Mawaid Administration.'
    }
    const { error } = await supabase.from('queries').update(updateObj).eq('id', id)
    if (error) {
      console.error('[Queries] Update failed:', error.message)
      return
    }
    setQueries(prev => prev.map(q => q.id === id ? { ...q, ...updateObj } : q))
  }

  const sendReply = async (q) => {
    if (!reply.trim()) return
    setSending(true)
    const updateObj = {
      admin_reply: reply.trim(),
      status: 'resolved',
      updated_at: new Date().toISOString()
    }
    const { error } = await supabase.from('queries').update(updateObj).eq('id', q.id)
    setSending(false)
    if (!error) {
      setQueries(prev => prev.map(item => item.id === q.id ? { ...item, ...updateObj } : item))
      setReply('')
      setExpanded(null)
    }
  }

  const now = new Date()
  const openCount     = allQueries.filter(q => q.status === 'open' || !q.status).length
  const resolvedCount = allQueries.filter(q => q.status === 'resolved').length

  const filtered = queries.filter(q => {
    const u = users[q.user_id] || {}
    const s = search.toLowerCase()
    const matchSearch = !s || (u.name||'').toLowerCase().includes(s) || (q.comment||'').toLowerCase().includes(s)
    const matchStatus = statusFilter === 'all' || (q.status || 'open') === statusFilter
    // Auto-hide resolved queries older than 24h, unless showAll is toggled
    const isOpen = !q.status || q.status === 'open'
    const within24h = (now - new Date(q.updated_at || q.created_at)) / (1000 * 60 * 60) < 24
    const matchTime = showAll || isOpen || within24h
    return matchSearch && matchStatus && matchTime
  })

  return (
    <PageWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <PageTitle>User Tickets</PageTitle>
        {!isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(212, 175, 55, 0.1)', padding: '8px 16px', borderRadius: 12, border: '1px solid rgba(212, 175, 55, 0.3)' }}>
            <ShieldAlert size={16} color="var(--accent-gold)" />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Admin Resolution Required
            </div>
          </div>
        )}
      </div>

      {/* Quick counts */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[{ label: 'Open', count: openCount, color: '#e09855' }, { label: 'Resolved', count: resolvedCount, color: '#5eba82' }].map(({ label, count, color }) => (
          <div key={label} style={{
            flex: 1, background: T.card, border: `1px solid ${color}28`,
            borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color }}>{count}</div>
              <div style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={14} color={T.textSub} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input name="searchQueries" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search thali user or comment…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 36px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <select name="queryStatusFilter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '11px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="in_progress">In Progress</option>
        </select>
        <Btn variant={showAll ? 'solid' : 'outline'} size="sm" onClick={() => setShowAll(!showAll)}>
          {showAll ? `All (${allQueries.length})` : `Open (${openCount})`}
        </Btn>
        <Btn variant="outline" onClick={load}><RefreshCw size={15} />Refresh</Btn>
      </div>

      {loading ? <AdminTableSkeleton rows={5} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: T.textSub }}>No queries found.</div>
          )}
          {filtered.map(q => {
            const u = users[q.user_id] || {}
            const status = q.status || 'open'
            const isExpanded = expanded === q.id
            return (
              <AdminCard key={q.id} style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: T.accentGrad, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff',
                  }}>
                    {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: T.text, fontSize: 14 }}>{u.name || '—'}</span>
                      <span style={{ color: T.textSub, fontSize: 12 }}>#{u.thali_number || '—'}</span>
                      <Badge color={STATUS_COLORS[status]}>{status}</Badge>
                      <span style={{ marginLeft: 'auto', color: T.textSub, fontSize: 11 }}>{fmtDateTime(q.created_at)}</span>
                    </div>
                    {q.subject && (
                      <div style={{ fontWeight: 600, color: T.accent, fontSize: 13, marginBottom: 4 }}>{q.subject}</div>
                    )}
                    <div style={{ color: T.textSub, fontSize: 13, lineHeight: 1.6 }}>{q.comment}</div>

                    {q.admin_reply && (
                      <div style={{
                        marginTop: 12, padding: '12px 14px', borderRadius: 10,
                        background: 'rgba(94,186,130,0.08)', border: '1px solid rgba(94,186,130,0.2)',
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#5eba82', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Admin Reply</div>
                        <div style={{ color: T.text, fontSize: 13, lineHeight: 1.6 }}>{q.admin_reply}</div>
                      </div>
                    )}
                  </div>
                  {!isAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.6, alignSelf: 'flex-start' }}>
                      <Lock size={14} color={T.textSub} />
                      <span style={{ fontSize: 11, color: T.textSub, fontWeight: 700 }}>Admin Only</span>
                    </div>
                  )}
                  {isAdmin && (
                    <button onClick={() => { setExpanded(isExpanded ? null : q.id); setReply('') }}
                      style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', padding: 4, display: 'flex' }}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                    <div style={{ marginBottom: 10 }}>
                      <label htmlFor="queryReply" style={{ display: 'block', color: T.textSub, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Reply</label>
                      <textarea
                        id="queryReply"
                        name="queryReply"
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        rows={3}
                        placeholder="Type your reply…"
                        style={{
                          width: '100%', boxSizing: 'border-box', resize: 'vertical',
                          padding: '12px 14px', borderRadius: 10,
                          background: T.inputBg, border: `1px solid ${T.inputBorder}`,
                          color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {status !== 'resolved' && (
                        <Btn size="sm" variant="ghost" onClick={() => updateStatus(q.id, 'in_progress')}>Mark In Progress</Btn>
                      )}
                      {status !== 'resolved' && (
                        <Btn size="sm" variant="ghost" onClick={() => updateStatus(q.id, 'resolved')}>Mark Resolved</Btn>
                      )}
                      <Btn size="sm" onClick={() => sendReply(q)} disabled={sending || !reply.trim()}>
                        <Send size={14} />
                        {sending ? 'Sending…' : 'Send Reply'}
                      </Btn>
                    </div>
                  </div>
                )}
              </AdminCard>
            )
          })}
        </div>
      )}
    </PageWrap>
  )
}
