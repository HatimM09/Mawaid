import React, { useState, useEffect, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/firebaseClient'
import { RefreshCw, Search, CheckCircle, Clock, XCircle, ShieldAlert, Lock } from 'lucide-react'
import { T, PageWrap, PageTitle, AdminCard, Table, Badge, Btn, fmtDate, fmtDateTime } from './ui'
import { AdminTableSkeleton } from '../common/Skeleton'

const STATUS_COLORS = { pending: '#e09855', approved: '#5eba82', rejected: '#e05555' }
const STATUS_ICONS  = { pending: <Clock size={13} />, approved: <CheckCircle size={13} />, rejected: <XCircle size={13} /> }

export default function RequestsAdminPage() {
  const context = useOutletContext() || { role: 'khidmat' }
  const { role } = context
  const isAdmin = role === 'admin'
  const [loading, setLoading]   = useState(true)
  const [requests, setRequests] = useState([])
  const [allRequests, setAllRequests] = useState([])
  const [users, setUsers]       = useState({})
  const [statusFilter, setStatusFilter] = useState('pending')
  const [typeFilter, setTypeFilter]     = useState('all')
  const [search, setSearch]             = useState('')
  const [showAll, setShowAll]           = useState(false)
  const [modeFilter, setModeFilter]     = useState('all')
  const [types, setTypes]               = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: req }, { data: us }] = await Promise.all([
      supabase.from('thali_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('user_stats').select('user_id,name,email,thali_number'),
    ])
    const uMap = {}
    ;(us || []).forEach(u => { uMap[u.user_id] = u })
    setUsers(uMap)
    const data = req || []
    setAllRequests(data)
    setRequests(data)
    setTypes([...new Set(data.map(r => r.request_type).filter(Boolean))])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // --- REAL-TIME SUBSCRIPTION ---
  useEffect(() => {
    const channel = supabase
      .channel('requests-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'thali_requests' }, () => {
        load()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  const updateStatus = async (id, status) => {
    const reqObj = requests.find(r => r.id === id)
    const userId = reqObj?.user_id
    const userName = users[userId]?.name || 'User'
    const userThali = users[userId]?.thali_number

    // 1-time-only guard: if this request already has the target status, do nothing
    // (prevents duplicate notifications from double-clicks or realtime re-loads).
    try {
      const { data: latest } = await supabase.from('thali_requests').select('status').eq('id', id).maybeSingle()
      if (latest && (latest.status || 'pending') === status) return
    } catch {}

    if (status === 'approved' && reqObj) {
      try {
        if (reqObj.request_type === 'change' && reqObj.details) {
          const thaliMatch = reqObj.details.match(/#?([A-Za-z0-9/_-]+)/)
          if (thaliMatch) {
            const newThaliNum = thaliMatch[1]
            await supabase.from('user_stats').update({ thali_number: newThaliNum }).eq('user_id', reqObj.user_id)
          }
        } else if (reqObj.request_type === 'stop') {
          // Date-bounded stops (e.g. "stop 11–12 Aug") must NOT remove the member's
          // thali number from their profile — it is their identity (QR, stickers,
          // packing). Only remember it in the request details so a later resume can
          // restore it for members whose number was wiped by older builds.
          if (userThali) {
            await supabase.from('thali_requests').update({ details: `Thali: ${userThali} (Paused)` }).eq('id', id)
          }
        } else if (reqObj.request_type === 'resume') {
          const { data: lastStopReq } = await supabase
            .from('thali_requests')
            .select('details')
            .eq('user_id', reqObj.user_id)
            .eq('request_type', 'stop')
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (lastStopReq && lastStopReq.details) {
            const thaliMatch = lastStopReq.details.match(/Thali:\s*#?([A-Za-z0-9\/_-]+)/)
            if (thaliMatch) {
              const oldThali = thaliMatch[1].trim()
              await supabase.from('user_stats').update({ thali_number: oldThali }).eq('user_id', reqObj.user_id)
            }
          }
        }
      } catch (e) {
        console.error('Auto profile update failed:', e)
      }
    }
    
    await supabase.from('thali_requests').update({ status }).eq('id', id)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))

    // Send notification to user
    if (userId && (status === 'approved' || status === 'rejected')) {
      try {
        const typeLabels = {
          resume: 'Resume Thali',
          stop: 'Stop Thali',
          extra: 'Extra Food',
          miqaat: 'Miqaat Pirsu',
          change: 'Thali Change'
        }
        const typeLabel = typeLabels[reqObj?.request_type] || reqObj?.request_type || 'Request'
        
        const title = status === 'approved'
          ? 'Al-Mawaid · Request approved'
          : 'Al-Mawaid · Request update'
        const body = status === 'approved'
          ? `Your ${typeLabel} request was approved. You’re all set.`
          : `Your ${typeLabel} request couldn’t be approved. Open the app for details.`

        // Insert in-app notification for real-time toast
        await supabase.from('notifications').insert({
          user_id: userId,
          title,
          message: body,
          url: '/post',
          type: status === 'approved' ? 'request_approved' : 'request_rejected',
          sender_name: 'Al-Mawaid'
        })

        // Send push notification for when app is closed
        await supabase.functions.invoke('send-push', {
          body: {
            title,
            body,
            target_type: 'specific',
            user_id: userId,
            url: '/post'
          }
        })
      } catch (notifyErr) {
        console.warn('Notification failed:', notifyErr)
      }
    }
  }

  const now = new Date()
  const allCount = allRequests.length
  const pendingCount = allRequests.filter(r => (!r.status || r.status === 'pending')).length

  const filtered = requests.filter(r => {
    const u = users[r.user_id] || {}
    const q = search.toLowerCase()
    const matchSearch = !q || (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q) || String(u.thali_number||'').includes(q)
    const matchStatus = statusFilter === 'all' || (r.status || 'pending') === statusFilter
    const matchType   = typeFilter   === 'all' || r.request_type === typeFilter
    const matchMode   = modeFilter   === 'all' || (r.extra_mode || 'addition') === modeFilter
    // Auto-hide non-pending requests older than 24h, unless showAll is toggled.
    // Approved stop/resume requests that carry dates stay visible until the last
    // covered date (to_date, or from_date for resumes) has passed.
    const isPending = !r.status || r.status === 'pending'
    const within24h = (now - new Date(r.updated_at || r.created_at)) / (1000 * 60 * 60) < 24
    const activeUntil = r.to_date || r.from_date
    const stillActive = r.status !== 'rejected' && !!activeUntil && new Date(activeUntil + 'T23:59:59') >= now
    const matchTime = showAll || isPending || within24h || stillActive
    return matchSearch && matchStatus && matchType && matchMode && matchTime
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
      <div style={{ fontSize: 13, color: T.textSub, maxWidth: 220, lineHeight: 1.65 }}>
        {r.request_type === 'extra' && r.extra_items ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {r.extra_mode === 'deduction'
              ? <Badge color="#e05555" style={{ marginBottom: 2, alignSelf: 'flex-start' }}>➖ Deduction</Badge>
              : <Badge color="#5eba82" style={{ marginBottom: 2, alignSelf: 'flex-start' }}>➕ Addition</Badge>}
            {r.extra_items.map((item, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: 6, fontSize: 11 }}>
                <span style={{ color: r.extra_mode === 'deduction' ? '#e05555' : T.accent, fontWeight: 700 }}>
                  {r.extra_mode === 'deduction' ? `Deduct ${item.qty}x` : `${item.qty}x`}
                </span> {item.name}
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
        ) : (                      <span style={{ opacity: 0.3 }}>—</span>
                      )}
                      {r.meal_type && (
                        <div style={{ marginTop: 4, fontSize: 10, fontWeight: 600, color: '#9b8de0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Meal: {r.meal_type === 'both' ? 'Both' : r.meal_type}
                        </div>
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
            {status === 'pending' && (
              <Btn size="sm" variant="outline" onClick={() => updateStatus(r.id, 'approved')}>
                Approve
              </Btn>
            )}
            {status === 'pending' && (
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

  const approvedCount = allRequests.filter(r => r.status === 'approved').length
  const rejectedCount = allRequests.filter(r => r.status === 'rejected').length

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
          <input name="searchRequests" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search thali user…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 36px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <select name="requestStatusFilter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '11px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {types.length > 0 && (
          <select name="requestTypeFilter" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            style={{ padding: '11px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.inputBorder}`, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
            <option value="all">All Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[{ id: 'addition', label: '➕ Addition', color: '#5eba82' }, { id: 'deduction', label: '➖ Deduction', color: '#e05555' }].map(m => {
            const active = modeFilter === m.id
            return (
              <button key={m.id} name={`modeFilter_${m.id}`} onClick={() => setModeFilter(active ? 'all' : m.id)}
                style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${active ? m.color : T.inputBorder}`, background: active ? `${m.color}1a` : T.card, color: active ? m.color : T.textSub, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                {m.label}
              </button>
            )
          })}
        </div>
        <Btn variant={showAll ? 'solid' : 'outline'} size="sm" onClick={() => setShowAll(!showAll)}>
          {showAll ? `All (${allCount})` : `Pending (${pendingCount})`}
        </Btn>
        <Btn variant="outline" onClick={load}><RefreshCw size={15} />Refresh</Btn>
      </div>

      {loading ? <AdminTableSkeleton rows={5} /> : (
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
