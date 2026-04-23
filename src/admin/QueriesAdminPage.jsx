import React, { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { RefreshCw, Search, Send, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Badge, Btn, Spinner, fmtDateTime } from './ui'

const STATUS_COLORS = { open: '#e09855', resolved: '#5eba82', closed: '#9aabb8' }

export default function QueriesAdminPage() {
  const { role } = useOutletContext()
  const isAdmin = role === 'admin'
  const [loading, setLoading]   = useState(true)
  const [queries, setQueries]   = useState([])
  const [users, setUsers]       = useState({})
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState(null)
  const [reply, setReply]       = useState('')
  const [sending, setSending]   = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: q }, { data: us }] = await Promise.all([
      supabase.from('queries').select('*').order('created_at', { ascending: false }),
      supabase.from('user_stats').select('user_id,name,email,thali_number'),
    ])
    const uMap = {}
    ;(us || []).forEach(u => { uMap[u.user_id] = u })
    setUsers(uMap)
    setQueries(q || [])
    setLoading(false)
  }

  const updateStatus = async (id, status) => {
    await supabase.from('queries').update({ status }).eq('id', id)
    setQueries(prev => prev.map(q => q.id === id ? { ...q, status } : q))
  }

  const sendReply = async (q) => {
    if (!reply.trim()) return
    setSending(true)
    const { error } = await supabase.from('queries').update({
      admin_reply: reply.trim(),
      status: 'resolved',
      replied_at: new Date().toISOString(),
    }).eq('id', q.id)
    setSending(false)
    if (!error) {
      setQueries(prev => prev.map(item => item.id === q.id ? { ...item, admin_reply: reply.trim(), status: 'resolved' } : item))
      setReply('')
      setExpanded(null)
    }
  }

  const filtered = queries.filter(q => {
    const u = users[q.user_id] || {}
    const s = search.toLowerCase()
    const matchSearch = !s || (u.name||'').toLowerCase().includes(s) || (q.comment||'').toLowerCase().includes(s)
    const matchStatus = statusFilter === 'all' || q.status === statusFilter
    return matchSearch && matchStatus
  })

  const openCount     = queries.filter(q => q.status === 'open' || !q.status).length
  const resolvedCount = queries.filter(q => q.status === 'resolved').length

  return (
    <PageWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <PageTitle sub={`${queries.length} total queries`}>User Queries</PageTitle>
        {!isAdmin && <Badge color="var(--accent-orange)"><ShieldAlert size={12} style={{ marginRight: 6 }} /> Read-Only Mode (Khidmat)</Badge>}
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search thali user or comment…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 36px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '11px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <Btn variant="outline" onClick={load}><RefreshCw size={15} />Refresh</Btn>
      </div>

      {loading ? <Spinner /> : (
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
                      <label style={{ display: 'block', color: T.textSub, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Reply</label>
                      <textarea
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
                      {status !== 'closed' && (
                        <Btn size="sm" variant="ghost" onClick={() => updateStatus(q.id, 'closed')}>Mark Closed</Btn>
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
