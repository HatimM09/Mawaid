// src/admin/SurveyAccuracyPage.jsx
// Weekly Survey Accuracy — flags members with partial, missing, or failed
// submissions for a chosen week so nobody can silently slip through.
//
// Sources:
//   - survey_submissions_flat  → which of the 12 slots each member answered
//   - survey_write_log         → saves rejected by submit-survey (failed writes)
//   - thali_requests           → stop/resume, so members who stopped thali are
//                                excluded from the expected count (not failures)
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Target, Download, Clock, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, Search, ChevronDown, ChevronUp, Calendar
} from 'lucide-react'
import { supabase } from '../lib/firebaseClient'
import { getWeekDate, DAYS, toLocalDateStr } from '../common/utils'
import {
  T, PageWrap, PageTitle, AdminCard, Badge, Btn, Spinner, Grid,
  StatCard, fmtDateTime, fmtDate, ErrorBanner
} from './ui'

const SLOT_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const SLOT_MEALS = ['l', 'd']
const SLOT_STATUSES = ['Applied', 'Skipped', 'opted_in', 'opted_out']

// ── Stop-thali timeline (same semantics as DailySurveyTracking) ──
// A stop WITH a to_date is bounded: "no thali" only inside [from_date, to_date].
// A stop without a to_date stays active until a newer resume/stop overrides it.
const isStoppedOnDay = (reqs, selDateStr, meal) => {
  let stopped = false
  ;(reqs || [])
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach(sr => {
      const coversMeal = !sr.meal_type || sr.meal_type === 'both' || sr.meal_type === meal
      if (!coversMeal) return
      const from = sr.from_date ? String(sr.from_date) : null
      const to = sr.to_date ? String(sr.to_date) : null
      if (from && selDateStr < from) return
      if (sr.kind === 'resume') {
        stopped = false
      } else if (sr.kind === 'stop') {
        stopped = to ? selDateStr <= to : true
      }
    })
  return stopped
}

const statusColor = (s) => {
  if (s === 'Applied') return '#22c55e'
  if (s === 'Skipped') return '#ef4444'
  if (s === 'opted_in') return '#eab308'
  if (s === 'opted_out') return '#f97316'
  return 'transparent'
}

const flagLabel = {
  complete: '✅ Complete',
  partial: '⚠️ Partial',
  noResponse: '⌛ No response',
  failed: '❌ Failed saves',
  stopped: '⏹️ Stopped',
}

export default function SurveyAccuracyPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(null)

  const [surveyOpenHour, setSurveyOpenHour] = useState(20)
  const [selectedWeek, setSelectedWeek] = useState('') // '' = follow current survey week
  const [availableWeeks, setAvailableWeeks] = useState([])
  const [includeStaff, setIncludeStaff] = useState(false)

  const [users, setUsers] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [writeErrors, setWriteErrors] = useState([])
  const [stopReqs, setStopReqs] = useState([])

  const [statusFilter, setStatusFilter] = useState('all') // all|complete|partial|noResponse|failed|stopped
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})

  const currentWeek = useMemo(() => getWeekDate(surveyOpenHour), [surveyOpenHour])
  const weekId = selectedWeek || currentWeek

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)
    setLoadError(null)
    try {
      // Survey open hour → the "current" target week matches the survey window
      const { data: openHourRow } = await supabase
        .from('app_settings').select('value').eq('key', 'survey_open_hour').maybeSingle()
      if (openHourRow) {
        const h = parseInt(openHourRow.value, 10)
        if (!isNaN(h)) setSurveyOpenHour(h)
      }

      const wId = selectedWeek || getWeekDate(openHourRow ? parseInt(openHourRow.value, 10) || 20 : 20)

      const [usersRes, subsRes, errRes, reqsRes] = await Promise.all([
        supabase
          .from('user_stats')
          .select('user_id, name, thali_number, email, avatar_url, role')
          .order('name'),
        supabase.from('survey_submissions_flat').select('*').eq('week_id', wId),
        supabase
          .from('survey_write_log')
          .select('user_id, action, error, created_at, payload')
          .eq('week_id', wId)
          .eq('status', 'error'),
        supabase
          .from('thali_requests')
          .select('user_id, request_type, status, from_date, to_date, meal_type, created_at')
          .in('request_type', ['stop', 'resume'])
          .in('status', ['pending', 'approved']),
      ])

      const memberData = (usersRes.data || []).filter(u => includeStaff || u.role === 'member')
      setUsers(memberData)
      setSubmissions(subsRes.data || [])
      setWriteErrors(errRes.data || [])
      setStopReqs(reqsRes.data || [])

      // Weeks available in any submission (for the dropdown)
      const { data: allSubs } = await supabase
        .from('survey_submissions_flat')
        .select('week_id')
      const weeks = [...new Set((allSubs || []).map(s => s.week_id).filter(Boolean))].sort().reverse()
      setAvailableWeeks(weeks)
    } catch (e) {
      console.error('SurveyAccuracy load error:', e)
      setLoadError(e?.message || 'Failed to load survey accuracy data.')
    }
    setLoading(false)
    setRefreshing(false)
  }, [selectedWeek, includeStaff])

  useEffect(() => { load() }, [load])

  // Realtime — new member saves or failed writes appear live.
  useEffect(() => {
    const ch = supabase
      .channel('survey-accuracy')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_submissions_flat' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_write_log' }, () => load(true))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  // ── Per-member accuracy rows ──
  const rows = useMemo(() => {
    const subMap = {}
    ;(submissions || []).forEach(s => { subMap[s.user_id] = s })

    const errMap = {}
    ;(writeErrors || []).forEach(e => {
      if (!errMap[e.user_id]) errMap[e.user_id] = []
      errMap[e.user_id].push(e)
    })
    ;Object.keys(errMap).forEach(uid => errMap[uid].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))

    const reqByUser = {}
    ;(stopReqs || []).forEach(r => {
      if (!reqByUser[r.user_id]) reqByUser[r.user_id] = []
      reqByUser[r.user_id].push({ ...r, kind: r.request_type })
    })

    const weekStart = new Date(weekId + 'T00:00:00')

    return (users || []).map(u => {
      const row = subMap[u.user_id]
      const reqs = reqByUser[u.user_id] || []
      let stopped = 0
      const slotStatus = {}
      SLOT_DAYS.forEach((dk, di) => {
        SLOT_MEALS.forEach(mk => {
          const slotDate = new Date(weekStart.getTime() + di * 24 * 60 * 60 * 1000)
          const dateStr = toLocalDateStr(slotDate)
          const mealName = mk === 'l' ? 'lunch' : 'dinner'
          const key = `${dk}_${mk}_status`
          const st = row ? row[key] : null
          slotStatus[key] = SLOT_STATUSES.includes(st) ? st : null
          if (isStoppedOnDay(reqs, dateStr, mealName)) stopped++
        })
      })

      const answered = Object.values(slotStatus).filter(Boolean).length
      const applied = Object.values(slotStatus).filter(s => s === 'Applied').length
      const skipped = Object.values(slotStatus).filter(s => s === 'Skipped').length
      const expected = 12 - stopped

      let flag
      if (expected === 0) flag = 'stopped'
      else if (answered === 0) flag = 'noResponse'
      else if (answered >= expected) flag = 'complete'
      else flag = 'partial'

      const errors = errMap[u.user_id] || []
      return {
        ...u,
        row,
        slotStatus,
        answered,
        applied,
        skipped,
        stopped,
        expected,
        submitted_at: row?.submitted_at || null,
        updated_at: row?.updated_at || null,
        errors,
        flag,
        failed: errors.length > 0,
      }
    })
  }, [users, submissions, writeErrors, stopReqs, weekId])

  const stats = useMemo(() => {
    const base = rows.filter(r => r.flag !== 'stopped')
    return {
      expected: base.length,
      complete: base.filter(r => r.flag === 'complete').length,
      partial: base.filter(r => r.flag === 'partial').length,
      noResponse: base.filter(r => r.flag === 'noResponse').length,
      stopped: rows.filter(r => r.flag === 'stopped').length,
      failed: rows.filter(r => r.failed).length,
    }
  }, [rows])

  const q = search.toLowerCase()
  const filtered = rows.filter(r => {
    if (statusFilter === 'failed' && !r.failed) return false
    if (statusFilter !== 'all' && statusFilter !== 'failed' && r.flag !== statusFilter) return false
    if (!q) return true
    return (
      (r.name || '').toLowerCase().includes(q) ||
      String(r.thali_number || '').includes(q)
    )
  })

  const exportCsv = () => {
    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const header = ['Name', 'Thali #', 'Week', 'Answered', 'Expected', 'Applied', 'Skipped', 'Stopped slots', 'Submitted', 'Failed saves', 'Latest error', 'Flag']
    const lines = rows.map(r => [
      r.name, r.thali_number, weekId,
      `${r.answered}/${r.expected}`, r.expected, r.applied, r.skipped, r.stopped,
      r.submitted_at ? new Date(r.submitted_at).toLocaleString('en-GB') : '',
      r.errors.length,
      r.errors[r.errors.length - 1]?.error || '',
      flagLabel[r.flag] || r.flag,
    ].map(esc).join(','))
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `survey-accuracy-${weekId}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (loading) return <Spinner />

  return (
    <PageWrap>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <PageTitle sub="Flags members with partial, missing, or failed submissions — weekly">
          Survey Accuracy
        </PageTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.inputBg, padding: '6px 12px', borderRadius: 12, border: `1px solid ${T.border}` }}>
            <Calendar size={14} color={T.accent} />
            <select
              name="weekSelect"
              value={selectedWeek}
              onChange={e => setSelectedWeek(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: T.text, fontSize: 12.5, fontWeight: 700, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <option value="">Current week ({fmtDate(weekId)})</option>
              {availableWeeks.map(w => (
                <option key={w} value={w}>{fmtDate(w)}</option>
              ))}
            </select>
          </div>
          <Btn variant="outline" onClick={exportCsv} style={{ padding: '8px 14px' }}>
            <Download size={14} /> CSV
          </Btn>
          <Btn variant="outline" onClick={() => load(true)} disabled={refreshing} style={{ padding: '8px 14px' }}>
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Syncing…' : 'Refresh'}
          </Btn>
        </div>
      </div>

      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

      {/* ── STAT CARDS ── */}
      <Grid cols={3} style={{ marginBottom: 18 }}>
        <StatCard icon={<Target size={18} />} label="Expected to respond" value={stats.expected} color={T.accent} sub="members not stopped this week" />
        <StatCard icon={<CheckCircle2 size={18} />} label="Complete" value={stats.complete} color={T.success} sub="all expected slots answered" />
        <StatCard icon={<AlertTriangle size={18} />} label="Partial" value={stats.partial} color="#f59e0b" sub="some slots still unanswered" />
        <StatCard icon={<Clock size={18} />} label="No response" value={stats.noResponse} color={T.textSub} sub="no answers for this week" />
        <StatCard icon={<XCircle size={18} />} label="Failed saves" value={stats.failed} color="#ef4444" sub="writes rejected by submit-survey" />
        <StatCard icon={<Clock size={18} />} label="Stopped (excluded)" value={stats.stopped} color="#a78bfa" sub="thali stopped all week" />
      </Grid>

      {/* ── FILTERS ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: T.inputBg, padding: 3, borderRadius: 12, border: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
          {[['all', 'All'], ['complete', '✅ Complete'], ['partial', '⚠️ Partial'], ['noResponse', '⌛ No response'], ['failed', '❌ Failed'], ['stopped', '⏹️ Stopped']].map(([v, label]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              style={{
                padding: '6px 13px', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: statusFilter === v ? T.accentGrad : 'transparent',
                color: statusFilter === v ? '#000' : T.textSub,
                fontSize: 11, fontWeight: 800, fontFamily: 'inherit', transition: '0.2s'
              }}>
              {label}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: T.textSub, cursor: 'pointer' }}>
          <input type="checkbox" checked={includeStaff} onChange={e => setIncludeStaff(e.target.checked)} style={{ accentColor: T.accent }} />
          Include staff roles
        </label>
        <div style={{ flex: '1 1 200px', position: 'relative', maxWidth: 340, marginLeft: 'auto' }}>
          <Search size={14} color={T.textSub} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            name="searchAccuracy"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search member or thali…"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px', borderRadius: 10,
              background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text,
              fontSize: 13, outline: 'none', fontFamily: 'inherit'
            }}
          />
        </div>
      </div>

      {/* ── TABLE ── */}
      <AdminCard style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: T.textSub, fontSize: 13 }}>
            {rows.length === 0 ? 'No members found for this week.' : 'No members match the current filters.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 900 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: T.textSub, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: `1px solid ${T.border}` }}>
                  <th style={{ padding: '12px 16px' }}>Member</th>
                  <th style={{ padding: '12px 16px', minWidth: 130 }}>Progress</th>
                  <th style={{ padding: '12px 16px' }}>Applied</th>
                  <th style={{ padding: '12px 16px' }}>Skipped</th>
                  <th style={{ padding: '12px 16px' }}>Submitted</th>
                  <th style={{ padding: '12px 16px' }}>Failed saves</th>
                  <th style={{ padding: '12px 16px' }}>Flag</th>
                  <th style={{ padding: '12px 12px', width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const isOpen = !!expanded[r.user_id]
                  const pct = r.expected ? Math.round((r.answered / r.expected) * 100) : 0
                  const rowColor = r.failed ? 'rgba(239,68,68,0.04)' : (r.flag === 'partial' ? 'rgba(245,158,11,0.04)' : 'transparent')
                  const flagColor = r.flag === 'complete' ? T.success : r.flag === 'partial' ? '#f59e0b' : r.flag === 'failed' ? '#ef4444' : r.flag === 'stopped' ? '#a78bfa' : T.textSub
                  return (
                    <React.Fragment key={r.user_id}>
                      <tr style={{ borderBottom: `1px solid ${T.border}`, color: T.text, background: rowColor }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700 }}>{r.name || 'Unknown'}</div>
                          <div style={{ fontSize: 10.5, color: T.textSub }}>{r.thali_number ? `#${r.thali_number}` : r.email || ''}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: T.inputBg, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: r.failed ? '#ef4444' : (r.flag === 'complete' ? T.success : r.flag === 'partial' ? '#f59e0b' : 'rgba(255,255,255,0.15)') }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: T.textSub, whiteSpace: 'nowrap' }}>{r.answered}/{r.expected}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#22c55e', fontWeight: 700 }}>{r.applied || '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#ef4444', fontWeight: 700 }}>{r.skipped || '—'}</td>
                        <td style={{ padding: '12px 16px', color: T.textSub, fontSize: 11.5 }}>
                          {r.submitted_at ? <span style={{ color: T.success, fontWeight: 700 }}>✅ {fmtDateTime(r.submitted_at)}</span> : '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {r.failed ? (
                            <Badge color="#ef4444" style={{ padding: '3px 9px', fontSize: 10 }}>
                              {r.errors.length} × failed
                            </Badge>
                          ) : (
                            <span style={{ color: T.textSub, fontSize: 11.5 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge color={flagColor} style={{ padding: '3px 9px', fontSize: 10 }}>{flagLabel[r.flag]}</Badge>
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          <button
                            onClick={() => setExpanded(prev => ({ ...prev, [r.user_id]: !prev[r.user_id] }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, display: 'flex', alignItems: 'center' }}
                            aria-label={isOpen ? 'Collapse details' : 'Expand details'}
                          >
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td colSpan={8} style={{ padding: '0 16px 16px' }}>
                            {/* Slot grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
                              {SLOT_DAYS.map((dk, di) => (
                                <div key={dk} style={{ background: T.inputBg, borderRadius: 10, padding: 10, border: `1px solid ${T.border}` }}>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                                    {DAYS[di].charAt(0).toUpperCase() + DAYS[di].slice(1)}
                                  </div>
                                  {SLOT_MEALS.map(mk => {
                                    const key = `${dk}_${mk}_status`
                                    const st = r.slotStatus[key]
                                    return (
                                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11 }}>
                                        <span style={{ width: 42, color: T.textSub, fontWeight: 700 }}>{mk === 'l' ? 'Lunch' : 'Dinner'}</span>
                                        <span style={{
                                          width: 10, height: 10, borderRadius: '50%',
                                          background: statusColor(st) || 'rgba(255,255,255,0.12)',
                                          flexShrink: 0
                                        }} />
                                        <span style={{ color: T.text, fontWeight: 600 }}>{st || '—'}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              ))}
                            </div>
                            {/* Failed write entries */}
                            {r.errors.length > 0 ? (
                              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                                  ❌ Rejected saves ({r.errors.length})
                                </div>
                                {r.errors.map((e, i) => (
                                  <div key={i} style={{ display: 'flex', gap: 10, fontSize: 11.5, color: T.text, marginTop: 5 }}>
                                    <span style={{ color: T.textSub, whiteSpace: 'nowrap' }}>{fmtDateTime(e.created_at)}</span>
                                    <span style={{ color: '#ef4444', fontWeight: 600, wordBreak: 'break-word' }}>{e.error}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: T.textSub }}>
                                No failed saves this week.
                              </div>
                            )}
                            {r.updated_at && (
                              <div style={{ fontSize: 10.5, color: T.textSub, marginTop: 8, opacity: 0.7 }}>
                                Last updated {fmtDateTime(r.updated_at)}
                              </div>
                            )}
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

      <div style={{ marginTop: 16, fontSize: 11, color: T.textSub, lineHeight: 1.6 }}>
        <strong style={{ color: T.accent }}>Accuracy rules:</strong> a member is <strong>Complete</strong> when all expected slots
        (12 minus days they stopped thali) are answered, <strong>Partial</strong> when some remain, <strong>No response</strong> when none
        are answered, and <strong>Failed saves</strong> when the submit-survey function rejected any write this week — check the
        Survey Write Log for the full payload. Members whose thali was stopped the entire week are excluded from the expected count.
      </div>
    </PageWrap>
  )
}
