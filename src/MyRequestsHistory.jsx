// src/MyRequestsHistory.jsx
// Monthly grouped request history with WhatsApp share + auto-hide completed requests

import React, { useState, useEffect } from 'react'
import { supabase } from './admin/supabaseClient'
import { useTheme, useAuth } from './admin/context'
import { ChevronDown, MessageCircle, Clock, CheckCircle, XCircle, CalendarDays, Share2 } from 'lucide-react'

const statusColor = (s) => s === 'pending' ? '#d4882a' : s === 'approved' ? '#5eba82' : '#e05555'
const statusIcon = (s) => s === 'pending' ? <Clock size={14} /> : s === 'approved' ? <CheckCircle size={14} /> : <XCircle size={14} />
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
  const [allRequests, setAllRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedMonth, setExpandedMonth] = useState(null)
  const [helpline, setHelpline] = useState('')

  useEffect(() => {
    loadAll()
    supabase.from('app_settings').select('*').eq('key', 'helpline_number').maybeSingle()
      .then(({ data }) => { if (data) setHelpline(data.value) })
  }, [user.id])

  const loadAll = async () => {
    setLoading(true)
    const { data } = await supabase.from('thali_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setAllRequests(data || [])
    setLoading(false)
    if (data?.length > 0) {
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
      Loading requests...
    </div>
  )

  if (allRequests.length === 0) return (
    <div style={{ textAlign: 'center', padding: 40, color: t.textSub, opacity: 0.6, fontSize: 14 }}>
      <CalendarDays size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
      <div>No requests found.</div>
    </div>
  )

  return (
    <div>
      {helpline && (
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

      {monthKeys.map(mk => {
        const isExpanded = expandedMonth === mk
        const requests = grouped[mk]
        const pendingCount = requests.filter(r => r.status === 'pending' || !r.status).length

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
                background: pendingCount > 0 ? t.accentBg : t.inputBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                color: pendingCount > 0 ? t.accent : t.textSub
              }}>
                <CalendarDays size={18} />
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: t.accent }}>{getMonthLabel(mk)}</div>
                <div style={{ fontSize: 11, color: t.textSub, marginTop: 1 }}>{requests.length} request{requests.length > 1 ? 's' : ''}{pendingCount > 0 ? ` - ${pendingCount} pending` : ''}</div>
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

                      {r.from_date && (
                        <div style={{ fontSize: 11, color: t.textSub }}>
                          {formatDate(r.from_date)}{r.to_date ? ` → ${formatDate(r.to_date)}` : ''}
                        </div>
                      )}
                      {r.details && <div style={{ fontSize: 12, color: t.textBody, marginTop: 4 }}>{r.details}</div>}
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
    </div>
  )
}

