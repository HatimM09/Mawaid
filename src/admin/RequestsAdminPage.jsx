import React, { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { RefreshCw, Search, CheckCircle, Clock, XCircle, ShieldAlert, Lock } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Table, Badge, Btn, Spinner, fmtDate, fmtDateTime } from './ui'

const STATUS_COLORS = { pending: '#e09855', approved: '#5eba82', rejected: '#e05555' }
const STATUS_ICONS  = { pending: <Clock size={13} />, approved: <CheckCircle size={13} />, rejected: <XCircle size={13} /> }

export default function RequestsAdminPage() {
  const context = useOutletContext() || { role: 'khidmat' }
  const { role } = context
  const isAdmin = role === 'admin'
  const [loading, setLoading]   = useState(true)
  const [requests, setRequests] = useState([])
  const [users, setUsers]       = useState({})
  const [statusFilter, setStatusFilter] = useState('pending')
  const [typeFilter, setTypeFilter]     = useState('all')
  const [search, setSearch]             = useState('')
  const [types, setTypes]               = useState([])

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: req }, { data: us }] = await Promise.all([
      supabase.from('thali_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('user_stats').select('user_id,name,email,thali_number'),
    ])
    const uMap = {}
    ;(us || []).forEach(u => { uMap[u.user_id] = u })
    setUsers(uMap)
    const data = req || []
    setRequests(data)
    setTypes([...new Set(data.map(r => r.request_type).filter(Boolean))])
    setLoading(false)
  }

  const updateStatus = async (id, status) => {
    await supabase.from('thali_requests').update({ status }).eq('id', id)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const filtered = requests.filter(r => {
    const u = users[r.user_id] || {}
    const q = search.toLowerCase()
    const matchSearch = !q || (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q) || String(u.thali_number||'').includes(q)
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    const matchType   = typeFilter   === 'all' || r.request_type === typeFilter
    return matchSearch && matchStatus && matchType
  })

  const rows = filtered.map(r => {
    const u = users[r.user_id] || {}
    const status = r.status || 'pending'
    return [
      <div>
        <div style={{ fontWeight: 600, color: T.text, fontSize: 13 }}>{u.name || '—'}</div>
        <div style={{ color: T.textSub, fontSize: 11 }}>#{u.thali_number || '—'}</div>
      </div>,
      <Badge color="#9b8de0">{r.request_type || '—'}</Badge>,
      <div style={{ fontSize: 13, color: T.textSub, maxWidth: 220, lineHeight: 1.5 }}>
        {r.request_type === 'extra' && r.extra_items ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {r.extra_items.map((item, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: 6, fontSize: 11 }}>
                <span style={{ color: T.accent, fontWeight: 700 }}>{item.qty}x</span> {item.name}
              </div>
            ))}
          </div>
        ) : r.details || '—'}
      </div>,
      <div>
        {r.request_type === 'miqaat' ? (
          <Badge color={T.accent}>MIQAAT MODE</Badge>
        ) : r.from_date ? (
          <div style={{ fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: T.accent }}>{fmtDate(r.from_date)}</span>
            {r.to_date ? (
              <> <span style={{ opacity: 0.5 }}>→</span> <span style={{ fontWeight: 700, color: T.accent }}>{fmtDate(r.to_date)}</span></>
            ) : (
              <Badge color={T.success} style={{ marginLeft: 6, fontSize: 8 }}>Permanent</Badge>
            )}
          </div>
        ) : r.date ? (
          <div style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>{fmtDate(r.date)}</div>
        ) : (
          <span style={{ opacity: 0.3 }}>—</span>
        )}
      </div>,
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {STATUS_ICONS[status]}
        <Badge color={STATUS_COLORS[status]}>{status}</Badge>
      </div>,
      <div style={{ fontSize: 11, color: T.textSub, opacity: 0.8 }}>{fmtDateTime(r.created_at)}</div>,
      <div style={{ display: 'flex', gap: 6 }}>
        {isAdmin ? (
          <>
            {status !== 'approved' && (
              <Btn size="sm" variant="outline" onClick={() => updateStatus(r.id, 'approved')}>
                Approve
              </Btn>
            )}
            {status !== 'rejected' && (
              <Btn size="sm" variant="danger" onClick={() => updateStatus(r.id, 'rejected')}>
                Reject
              </Btn>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.6 }}>
            <Lock size={12} color={T.textSub} />
            <span style={{ fontSize: 11, color: T.textSub, fontWeight: 700 }}>Admin Only</span>
          </div>
        )}
      </div>,
    ]
  })

  // Summary counts
  const pendingCount  = requests.filter(r => (!r.status || r.status === 'pending')).length
  const approvedCount = requests.filter(r => r.status === 'approved').length
  const rejectedCount = requests.filter(r => r.status === 'rejected').length

  return (
    <PageWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <PageTitle>Thali Requests</PageTitle>
        {!isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(212, 175, 55, 0.1)', padding: '8px 16px', borderRadius: 12, border: '1px solid rgba(212, 175, 55, 0.3)' }}>
            <ShieldAlert size={16} color="var(--accent-gold)" />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Resolution Reserved for Admin
            </div>
          </div>
        )}
      </div>

      {/* Quick counts */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Pending',  count: pendingCount,  color: '#e09855' },
          { label: 'Approved', count: approvedCount, color: '#5eba82' },
          { label: 'Rejected', count: rejectedCount, color: '#e05555' },
        ].map(({ label, count, color }, idx) => (
          <div key={label} className="stagger-item" style={{
            flex: 1, minWidth: 140,
            background: T.card, border: `1px solid ${color}28`,
            borderRadius: 14, padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 14,
            animationDelay: `${idx * 0.1}s`
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search thali user…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 36px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '11px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {types.length > 0 && (
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            style={{ padding: '11px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
            <option value="all">All Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <Btn variant="outline" onClick={load}><RefreshCw size={15} />Refresh</Btn>
      </div>

      {loading ? <Spinner /> : (
        <AdminCard style={{ padding: 0 }}>
          <Table
            headers={['Thali User', 'Type', 'Request Details', 'Dates / Schedule', 'Status', 'Submitted At', 'Actions']}
            rows={rows}
            emptyMsg="No requests found."
          />
        </AdminCard>
      )}
    </PageWrap>
  )
}
