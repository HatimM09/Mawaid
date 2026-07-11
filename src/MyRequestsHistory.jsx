import React, { useState, useEffect } from 'react'
import { supabase, db, C, getCol, getDocRef } from './lib/firebaseClient'
import { useTheme, useAuth } from './admin/context'
import { ChevronDown, MessageCircle, Clock, CheckCircle, XCircle, CalendarDays, Share2, AlertCircle, LifeBuoy } from 'lucide-react'

const statusColor = (s) => s === 'pending' ? '#d4882a' : s === 'approved' ? '#5eba82' : s === 'rejected' ? '#e05555' : '#7aabb8'
const statusIcon = (s) => s === 'pending' ? <Clock size={14} /> : s === 'approved' ? <CheckCircle size={14} /> : s === 'rejected' ? <XCircle size={14} /> : <AlertCircle size={14} />
const typeEmoji = (t) => t === 'resume' ? '▶️' : t === 'stop' ? '⏹️' : t === 'extra' ? '➕' : t === 'miqaat' ? '🕌' : '📋'

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getMonthKey(d) {
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-')
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[parseInt(m) - 1]} ${y}`
}

export default function MyRequestsHistory() {
  const t = useTheme()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('content')
  const [allRequests, setAllRequests] = useState([])
  const [allQueries, setAllQueries] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedMonth, setExpandedMonth] = useState(null)
  const [helpline, setHelpline] = useState('')
  const [expandedQuery, setExpandedQuery] = useState(null)

  useEffect(() => {
    loadAll()
    supabase.from('app_settings').select('*').eq('key', 'helpline_number').maybeSingle()
      .then(({ data }) => { if (data) setHelpline(data.value) })
  }, [user.id])

  const loadAll = async () => {
    setLoading(true)
    const [reqRes, queryRes] = await Promise.all([
      supabase.from('thali_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('queries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
    ])
    setAllRequests(reqRes.data || [])
    setAllQueries(queryRes.data || [])
    setLoading(false)
    if (reqRes.data?.length > 0) {
      const current = getMonthKey(new Date().toISOString())
      setExpandedMonth(current)
    }
  }

  const grouped = {}
  allRequests.forEach(r => {
    const mk = getMonthKey(r.created_at)
    if (!grouped[mk]) grouped[mk] = []
    grouped[mk].push(r)
  })
  const monthKeys = Object.keys(grouped).sort().reverse()

  const whatsappShare = (r) => {
    const helplineClean = helpline ? helpline.replace(/[^0-9]/g, '') : ''
    if (!helplineClean) return
    const typeLabel = r.request_type === 'resume' ? 'Resume Thali' : r.request_type === 'stop' ? 'Stop Thali' : r.request_type === 'extra' ? 'Extra Food' : r.request_type === 'miqaat' ? 'Miqaat' : 'Request'
    const dateStr = r.from_date ? ` (From: ${formatDate(r.from_date)}${r.to_date ? ` To: ${formatDate(r.to_date)}` : ''})` : ''
    const details = r.details ? ` - ${r.details}` : ''
    const msg = `Al-Mawaid: ${typeLabel}${dateStr}${details} [Status: ${r.status || 'pending'}]`
    window.open(`https://wa.me/${helplineClean}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: t.textSub, opacity: 0.6 }}>
      <div className="spin" style={{ width: 28, height: 28, border: '2.5px solid var(--border-light)', borderTop: '2.5px solid var(--accent-primary)', borderRadius: '50%', margin: '0 auto 16px' }} />
      Loading...
    </div>
  )

  const pendingRequests = allRequests.filter(r => !r.status || r.status === 'pending')
  const approvedRequests = allRequests.filter(r => r.status === 'approved')
  const openQueries = allQueries.filter(q => !q.status || q.status === 'open')
  const resolvedQueries = allQueries.filter(q => q.status === 'resolved')

  return (
    <div>
      {/* Bifurcated Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: t.card, borderRadius: 13, padding: 5, border: `1px solid ${t.border}` }}>
        {[
          { id: 'content', label: `📋 Content (${allRequests.length})`, count: pendingRequests.length },
          { id: 'issues', label: `❓ Issues (${allQueries.length})`, count: openQueries.length }
        ].map(({ id, label, count }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 9, border: 'none',
              background: activeTab === id ? t.accentGrad : 'transparent',
              color: activeTab === id ? '#fff' : t.textSub,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              fontFamily: "'DM Sans',sans-serif", transition: 'all 0.25s',
              position: 'relative'
            }}>
            {label}
            {count > 0 && activeTab !== id && (
              <span style={{
                position: 'absolute', top: 4, right: 8,
                minWidth: 16, height: 16, borderRadius: 8,
                background: '#e05555', color: '#fff',
                fontSize: 9, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px'
              }}>{count > 9 ? '9+' : count}</span>
            )}
          </button>
        ))}
      </div>

      {helpline && activeTab === 'content' && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 14,
          background: 'rgba(37, 211, 102, 0.08)', border: '1px solid rgba(37, 211, 102, 0.25)',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <MessageCircle size={20} color="#25D366" />
          <div style={{ flex: 1, fontSize: 13, color: t.text }}>
            <span style={{ fontWeight: 700 }}>Need help?</span> Share your requests with Al-Mawaid team on WhatsApp.
          </div>
        </div>
      )}

      {activeTab === 'content' && (
        <>
          {/* Quick Stats */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Pending', count: pendingRequests.length, color: '#d4882a' },
              { label: 'Approved', count: approvedRequests.length, color: '#5eba82' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{
                flex: 1, background: t.card, border: `1px solid ${color}28`,
                borderRadius: 12, padding: '12px', textAlign: 'center'
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{count}</div>
                <div style={{ fontSize: 10, color: t.textSub, fontWeight: 600, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {allRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: t.textSub, opacity: 0.6, fontSize: 14 }}>
              <CalendarDays size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div>No requests found.</div>
            </div>
          ) : monthKeys.map(mk => {
            const isExpanded = expandedMonth === mk
            const requests = grouped[mk]
            const monthPendingCount = requests.filter(r => r.status === 'pending' || !r.status).length

            return (
              <div key={mk} style={{ marginBottom: 12, borderRadius: 16, overflow: 'hidden', border: `1px solid ${isExpanded ? t.borderActive : t.border}`, background: t.card }}>
                <button
                  onClick={() => setExpandedMonth(isExpanded ? null : mk)}
                  style={{
                    width: '100%', padding: '14px 16px', background: 'transparent',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    gap: 10, color: t.text
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: monthPendingCount > 0 ? t.accentBg : t.inputBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    color: monthPendingCount > 0 ? t.accent : t.textSub
                  }}>
                    <CalendarDays size={18} />
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: t.accent }}>{getMonthLabel(mk)}</div>
                    <div style={{ fontSize: 11, color: t.textSub, marginTop: 1 }}>{requests.length} request{requests.length > 1 ? 's' : ''}{monthPendingCount > 0 ? ` - ${monthPendingCount} pending` : ''}</div>
                  </div>
                  <div style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                    <ChevronDown size={18} color={t.textSub} />
                  </div>
                </button>

                <div style={{
                  maxHeight: isExpanded ? '2000px' : '0px',
                  opacity: isExpanded ? 1 : 0,
                  overflow: 'hidden',
                  transition: 'all 0.4s ease-in-out',
                }}>
                  <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {requests.map(r => (
                      <div key={r.id} style={{
                        padding: '12px 14px', borderRadius: 12,
                        background: t.inputBg, border: `1px solid ${t.border}`,
                        display: 'flex', gap: 10, alignItems: 'flex-start'
                      }}>
                        <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{typeEmoji(r.request_type)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                              {r.request_type === 'resume' ? 'Resume Thali' : r.request_type === 'stop' ? 'Stop Thali' : r.request_type === 'extra' ? 'Extra Food' : r.request_type === 'miqaat' ? 'Miqaat Pirsu' : 'Request'}
                            </span>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: 6,
                              fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                              background: `${statusColor(r.status || 'pending')}20`,
                              color: statusColor(r.status || 'pending'),
                              border: `1px solid ${statusColor(r.status || 'pending')}30`
                            }}>
                              {statusIcon(r.status || 'pending')}
                              {r.status || 'pending'}
                            </span>
                          </div>

                          {r.status === 'approved' && (
                            <div style={{ fontSize: 11, color: '#5eba82', fontWeight: 700, marginBottom: 2 }}>
                              ✅ Approved — your request has been accepted
                            </div>
                          )}

                          {r.meal_type && (
                            <div style={{ fontSize: 11, color: '#9b8de0', fontWeight: 600, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Meal: {r.meal_type === 'both' ? 'Both (Lunch & Dinner)' : r.meal_type.charAt(0).toUpperCase() + r.meal_type.slice(1)}
                            </div>
                          )}
                          {r.from_date && (
                            <div style={{ fontSize: 11, color: t.textSub }}>
                              {formatDate(r.from_date)}{r.to_date ? ` → ${formatDate(r.to_date)}` : ''}
                            </div>
                          )}
                          {r.details && <div style={{ fontSize: 12, color: t.textBody, marginTop: 4 }}>{r.details}</div>}
                          {r.extra_items && (
                            <div style={{ fontSize: 11, color: t.textSub, marginTop: 4 }}>
                              {r.extra_items.map(i => `${i.name} x${i.qty}`).join(', ')}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => whatsappShare(r)}
                          title="Share on WhatsApp"
                          style={{
                            padding: '6px 8px', borderRadius: 8, border: 'none',
                            background: '#25D36615', color: '#25D366', cursor: 'pointer',
                            fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                            fontWeight: 700, flexShrink: 0, transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#25D36625'}
                          onMouseLeave={e => e.currentTarget.style.background = '#25D36615'}
                        >
                          <MessageCircle size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )}

      {activeTab === 'issues' && (
        <>
          {/* Quick Stats */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Open', count: openQueries.length, color: '#d4882a' },
              { label: 'Resolved', count: resolvedQueries.length, color: '#5eba82' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{
                flex: 1, background: t.card, border: `1px solid ${color}28`,
                borderRadius: 12, padding: '12px', textAlign: 'center'
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{count}</div>
                <div style={{ fontSize: 10, color: t.textSub, fontWeight: 600, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {allQueries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: t.textSub, opacity: 0.6, fontSize: 14 }}>
              <LifeBuoy size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div>No issues or queries raised yet.</div>
            </div>
          ) : allQueries.map(q => {
            const status = q.status || 'open'
            const isExpanded = expandedQuery === q.id
            return (
              <div key={q.id} style={{
                marginBottom: 12, borderRadius: 16, overflow: 'hidden',
                border: `1px solid ${isExpanded ? t.borderActive : t.border}`, background: t.card
              }}>
                <button
                  onClick={() => setExpandedQuery(isExpanded ? null : q.id)}
                  style={{
                    width: '100%', padding: '14px 16px', background: 'transparent',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    gap: 10, color: t.text, textAlign: 'left'
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: status === 'open' ? 'rgba(212,136,42,0.15)' : 'rgba(94,186,130,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {status === 'open' ? <Clock size={16} color="#d4882a" /> : <CheckCircle size={16} color="#5eba82" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{q.subject || 'Query'}</div>
                    <div style={{ fontSize: 11, color: t.textSub, marginTop: 1 }}>
                      {new Date(q.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
                    background: `${statusColor(status)}20`, color: statusColor(status),
                    border: `1px solid ${statusColor(status)}30`, marginRight: 8
                  }}>
                    {status.toUpperCase()}
                  </span>
                  <div style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                    <ChevronDown size={16} color={t.textSub} />
                  </div>
                </button>

                <div style={{
                  maxHeight: isExpanded ? '1000px' : '0px',
                  opacity: isExpanded ? 1 : 0,
                  overflow: 'hidden',
                  transition: 'all 0.4s ease-in-out',
                }}>
                  <div style={{ padding: '0 16px 16px' }}>
                    {q.comment && (
                      <div style={{
                        padding: '12px 14px', borderRadius: 12, marginBottom: 8,
                        background: t.inputBg, border: `1px solid ${t.border}`,
                        fontSize: 13, color: t.textBody, lineHeight: 1.6, whiteSpace: 'pre-wrap'
                      }}>
                        {q.comment}
                      </div>
                    )}
                    {q.media && q.media.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {q.media.map((m, i) => m.path && m.type === 'image' && (
                          <img key={i} src={m.path} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
                        ))}
                      </div>
                    )}
                    {q.admin_reply && (
                      <div style={{
                        marginTop: 8, padding: '10px 12px', borderRadius: 10,
                        background: 'rgba(94,186,130,0.08)', border: '1px solid rgba(94,186,130,0.2)',
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#5eba82', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Admin Reply</div>
                        <div style={{ fontSize: 13, color: t.text, lineHeight: 1.6 }}>{q.admin_reply}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
