// src/admin/SurveyWriteLogPage.jsx
// Survey Write Log — every member survey save (success or error) is recorded
// in survey_write_log by the submit-survey edge function. This page makes
// failed saves visible in-app so nothing fails silently again.
import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Search, ChevronDown, ChevronUp, FileWarning, CheckCircle2, XCircle, Activity, ClipboardList } from 'lucide-react'
import { supabase } from '../lib/firebaseClient'
import {
  T, PageWrap, PageTitle, AdminCard, Badge, Btn, Spinner, Grid, StatCard,
  SectionHeader, fmtDateTime
} from './ui'

const PAGE_SIZE = 250

const actionLabel = (a) => a === 'draft' ? 'Draft' : a === 'submit' ? 'Submit' : a || '—'
const actionColor = (a) => a === 'draft' ? '#a78bfa' : a === 'submit' ? T.accent : T.textSub

// Compact human summary of what a payload wrote (e.g. "3 slots · 2 Applied").
const summarizePayload = (payload) => {
  if (!payload || typeof payload !== 'object') return ''
  const slots = Object.keys(payload).filter(k => /_(l|d)_status$/.test(k))
  if (!slots.length) {
    const dishKeys = Object.keys(payload).filter(k => /_(l|d)_dish_\d+$/.test(k))
    return dishKeys.length ? `${dishKeys.length} dish answer${dishKeys.length === 1 ? '' : 's'}` : 'draft'
  }
  const applied = slots.filter(k => payload[k] === 'Applied').length
  const skipped = slots.filter(k => payload[k] === 'Skipped').length
  const other = slots.length - applied - skipped
  const parts = []
  if (applied) parts.push(`${applied} Applied`)
  if (skipped) parts.push(`${skipped} Skipped`)
  if (other) parts.push(`${other} other`)
  return `${slots.length} slot${slots.length === 1 ? '' : 's'} · ${parts.join(' · ') || '—'}`
}

export default function SurveyWriteLogPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [entries, setEntries] = useState([])
  const [userMap, setUserMap] = useState({})
  const [statusFilter, setStatusFilter] = useState('all') // all | success | error
  const [actionFilter, setActionFilter] = useState('all') // all | submit | draft
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})
  const [errorMsg, setErrorMsg] = useState('')

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from('user_stats')
      .select('user_id, name, thali_number')
    const map = {}
    ;(data || []).forEach(u => { map[u.user_id] = u })
    setUserMap(map)
  }, [])

  const load = useCallback(async (isSilent = false, append = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)
    setErrorMsg('')
    try {
      const rangeFrom = append ? entries.length : 0
      let query = supabase
        .from('survey_write_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(rangeFrom, rangeFrom + PAGE_SIZE - 1)
      if (statusFilter === 'success') query = query.eq('status', 'success')
      if (statusFilter === 'error') query = query.eq('status', 'error')
      if (actionFilter === 'submit' || actionFilter === 'draft') query = query.eq('action', actionFilter)
      const { data, error } = await query
      if (error) throw error
      if (append) {
        setEntries(prev => {
          const seen = new Set(prev.map(e => e.id))
          return [...prev, ...(data || []).filter(e => !seen.has(e.id))]
        })
      } else {
        setEntries(data || [])
      }
    } catch (e) {
      console.error('SurveyWriteLog load error:', e)
      setErrorMsg(e?.message || 'Failed to load the write log.')
    }
    setLoading(false)
    setRefreshing(false)
  }, [statusFilter, actionFilter, entries.length])

  useEffect(() => { loadUsers() }, [loadUsers])
  useEffect(() => { load() }, [load])

  // Realtime — new survey writes (from members) appear live.
  useEffect(() => {
    const ch = supabase
      .channel('survey-write-log')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_write_log' }, () => {
        load(true)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  const stats = {
    total: entries.length,
    ok: entries.filter(e => e.status === 'success').length,
    error: entries.filter(e => e.status === 'error').length,
    draft: entries.filter(e => e.action === 'draft').length,
  }

  const q = search.toLowerCase()
  const filtered = entries.filter(e => {
    if (!q) return true
    const u = userMap[e.user_id] || {}
    const hay = [
      u.name, String(u.thali_number || ''), e.week_id, e.error, e.action,
      summarizePayload(e.payload)
    ].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })

  if (loading) return <Spinner />

  return (
    <PageWrap>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <PageTitle sub="Every member survey save — successes and failures, in real time">
            Survey Write Log
          </PageTitle>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge color={stats.error > 0 ? '#ef4444' : T.success} style={{ padding: '6px 12px' }}>
            <FileWarning size={12} /> {stats.error} failed
          </Badge>
          <Btn variant="outline" onClick={() => load(true)} disabled={refreshing} style={{ padding: '8px 16px' }}>
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Syncing…' : 'Refresh'}
          </Btn>
        </div>
      </div>

      {errorMsg && (
        <div style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 12.5 }}>
          {errorMsg}
        </div>
      )}

      {/* ── STAT CARDS ── */}
      <Grid cols={4} style={{ marginBottom: 20 }}>
        <StatCard icon={<ClipboardList size={18} />} label="Logged writes" value={stats.total} color={T.accent} sub="this page" />
        <StatCard icon={<CheckCircle2 size={18} />} label="Succeeded" value={stats.ok} color={T.success} sub="written to survey_day_responses" />
        <StatCard icon={<XCircle size={18} />} label="Failed" value={stats.error} color="#ef4444" sub="rejected by submit-survey" />
        <StatCard icon={<Activity size={18} />} label="Drafts" value={stats.draft} color="#a78bfa" sub="auto-saved dish answers" />
      </Grid>

      {/* ── FILTERS ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: T.inputBg, padding: 3, borderRadius: 12, border: `1px solid ${T.border}` }}>
          {[['all', 'All'], ['success', '✅ Success'], ['error', '❌ Errors']].map(([v, label]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              style={{
                padding: '6px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: statusFilter === v ? T.accentGrad : 'transparent',
                color: statusFilter === v ? '#000' : T.textSub,
                fontSize: 11, fontWeight: 800, fontFamily: 'inherit', transition: '0.2s'
              }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', background: T.inputBg, padding: 3, borderRadius: 12, border: `1px solid ${T.border}` }}>
          {[['all', 'All actions'], ['submit', 'Submit'], ['draft', 'Draft']].map(([v, label]) => (
            <button key={v} onClick={() => setActionFilter(v)}
              style={{
                padding: '6px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: actionFilter === v ? T.accentGrad : 'transparent',
                color: actionFilter === v ? '#000' : T.textSub,
                fontSize: 11, fontWeight: 800, fontFamily: 'inherit', transition: '0.2s'
              }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ flex: '1 1 220px', position: 'relative', maxWidth: 420 }}>
          <Search size={14} color={T.textSub} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            name="searchWriteLog"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search member, thali, week or error…"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px', borderRadius: 10,
              background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text,
              fontSize: 13, outline: 'none', fontFamily: 'inherit'
            }}
          />
        </div>
      </div>

      {/* ── LOG TABLE ── */}
      <AdminCard style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: T.textSub, fontSize: 13 }}>
            {stats.total === 0
              ? 'No survey writes logged yet — they appear here as members submit surveys.'
              : 'No entries match the current filters.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 820 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: T.textSub, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: `1px solid ${T.border}` }}>
                  <th style={{ padding: '12px 16px' }}>Time</th>
                  <th style={{ padding: '12px 16px' }}>Member</th>
                  <th style={{ padding: '12px 16px' }}>Week</th>
                  <th style={{ padding: '12px 16px' }}>Action</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Summary / Error</th>
                  <th style={{ padding: '12px 16px', width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const u = userMap[e.user_id] || {}
                  const isError = e.status === 'error'
                  const isOpen = !!expanded[e.id]
                  return (
                    <React.Fragment key={e.id}>
                      <tr style={{ borderBottom: `1px solid ${T.border}`, color: T.text, background: isError ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: T.textSub, fontSize: 11.5 }}>{fmtDateTime(e.created_at)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700 }}>{u.name || 'Unknown'}</div>
                          <div style={{ fontSize: 10.5, color: T.textSub }}>{u.thali_number ? `#${u.thali_number}` : ''}</div>
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: T.textSub }}>{e.week_id || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge color={actionColor(e.action)} style={{ padding: '3px 9px', fontSize: 10 }}>{actionLabel(e.action)}</Badge>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge color={isError ? '#ef4444' : T.success} style={{ padding: '3px 9px', fontSize: 10 }}>
                            {isError ? '❌ Failed' : '✅ Saved'}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: 360 }}>
                          {isError ? (
                            <div style={{ color: '#ef4444', fontWeight: 600, wordBreak: 'break-word' }}>{e.error || 'Unknown error'}</div>
                          ) : (
                            <div style={{ color: T.textSub }}>{summarizePayload(e.payload)}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          <button
                            onClick={() => setExpanded(prev => ({ ...prev, [e.id]: !prev[e.id] }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, display: 'flex', alignItems: 'center' }}
                            aria-label={isOpen ? 'Collapse payload' : 'Expand payload'}
                          >
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td colSpan={7} style={{ padding: '0 16px 16px' }}>
                            <div style={{ background: T.inputBg, borderRadius: 10, padding: 12, overflowX: 'auto' }}>
                              <SectionHeader style={{ marginBottom: 8 }}>Payload</SectionHeader>
                              <pre style={{ margin: 0, fontSize: 11, color: T.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', lineHeight: 1.5 }}>
                                {JSON.stringify(e.payload || {}, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {/* ── LOAD MORE ── */}
      {entries.length >= PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <Btn variant="outline" onClick={() => load(true, true)}>
            Load more
          </Btn>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 11, color: T.textSub, lineHeight: 1.6 }}>
        Logged by the <strong style={{ color: T.accent }}>submit-survey</strong> edge function on every member save. Entries accumulate —
        older rows can be pruned from the <strong>survey_write_log</strong> table in Supabase whenever needed.
      </div>
    </PageWrap>
  )
}
