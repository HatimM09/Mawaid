import React, { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { RefreshCw, Search, Send, ChevronDown, ChevronUp, ShieldAlert, Lock } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Badge, Btn, Spinner, fmtDateTime, Skeleton, SoundUI } from './ui'

const STATUS_COLORS = { open: '#e09855', resolved: '#5eba82', closed: '#9aabb8' }

export default function QueriesAdminPage() {
  const context = useOutletContext() || { role: 'khidmat' }
  const { role } = context
  const isAdmin = role === 'admin'
  const [loading, setLoading]   = useState(true)
  const [queries, setQueries]   = useState([])
  const [users, setUsers]       = useState({})
  const [statusFilter, setStatusFilter] = useState('open')
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState(null)
  const [reply, setReply]       = useState('')
  const [sending, setSending]   = useState(false)
  const [deductThali, setDeductThali] = useState(false)

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
    
    try {
      // 1. Update Query Status
      const { error: queryErr } = await supabase.from('queries').update({
        admin_reply: reply.trim(),
        status: 'resolved',
        replied_at: new Date().toISOString(),
        deduction_applied: deductThali
      }).eq('id', q.id)
      
      if (queryErr) throw queryErr
      
      SoundUI.success()

      // 2. Apply Thali Deduction if requested
      if (deductThali) {
        const today = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]
        const meal = new Date().getHours() < 16 ? 'l' : 'd'
        const dayKey = today === 'sun' ? 'mon' : today // Fallback if Sunday
        const column = `${dayKey.substring(0,3).toLowerCase()}_${meal}_status`
        
        // Find current week ID (re-using logic from other components)
        const now = new Date()
        const day = now.getDay()
        let diff = now.getDate() - day + (day === 0 ? -6 : 1)
        if (day === 0 || (day === 6 && now.getHours() >= 20)) diff += 7
        const weekId = new Date(now.setDate(diff)).toISOString().split('T')[0]

        await supabase.from('survey_submissions_flat').upsert({
          user_id: q.user_id,
          week_id: weekId,
          [column]: 'Skipped',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,week_id' })
      }

      setQueries(prev => prev.map(item => item.id === q.id ? { 
        ...item, 
        admin_reply: reply.trim(), 
        status: 'resolved',
        deduction_applied: deductThali 
      } : item))
      setReply('')
      setDeductThali(false)
      setExpanded(null)
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setSending(false)
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
        <Btn variant="outline" onClick={() => { SoundUI.click(); load(); }}><RefreshCw size={15} />Refresh</Btn>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Skeleton height={100} />
          <Skeleton height={100} />
          <Skeleton height={100} />
          <Skeleton height={100} />
        </div>
      ) : (
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
                    <button onClick={() => { SoundUI.click(); setExpanded(isExpanded ? null : q.id); setReply('') }}
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
                      />
                    </div>
                    
                    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(244,63,94,0.05)', borderRadius: 10, border: '1px solid rgba(244,63,94,0.1)' }}>
                      <input 
                        type="checkbox" 
                        id={`deduct-${q.id}`} 
                        checked={deductThali} 
                        onChange={e => setDeductThali(e.target.checked)} 
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                      />
                      <label htmlFor={`deduct-${q.id}`} style={{ fontSize: 13, fontWeight: 700, color: '#f43f5e', cursor: 'pointer' }}>
                        Deduct Thali for this query (Mark as Absent)
                      </label>
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
