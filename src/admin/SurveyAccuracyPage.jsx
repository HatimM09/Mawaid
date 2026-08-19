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
  RefreshCw, Search, ChevronDown, ChevronUp, Calendar, Trash2
} from 'lucide-react'
import { supabase } from '../lib/firebaseClient'
import { getSurveyTargetWeek, DAYS, toLocalDateStr, isStoppedOnDay } from '../common/utils'
import { getSlotDishes } from '../hooks/useSurvey'
import { fetchWeekRows, fetchAllUserRows, eraseSurveySlot } from '../lib/surveyRows'
import {
  T, PageWrap, PageTitle, AdminCard, Badge, Btn, Spinner, Grid,
  StatCard, Modal, Alert, fmtDateTime, fmtDate, ErrorBanner
} from './ui'

const SLOT_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const SLOT_MEALS = ['l', 'd']
const SLOT_STATUSES = ['Applied', 'Skipped', 'opted_in', 'opted_out']

const flagLabel = {
  complete: '✅ Complete',
  partial: '⚠️ Partial',
  noResponse: '⌛ No response',
  failed: '❌ Failed saves',
  stopped: '⏹️ Stopped',
}

// Format a stored dish value for display: Yes/No, percentage, or count (×N).
const fmtDishVal = (raw) => {
  if (raw === 'Yes' || raw === 'yes') return { text: '✅', color: '#22c55e' }
  if (raw === 'No' || raw === 'no') return { text: '❌', color: '#ef4444' }
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return { text: `×${raw.trim()}`, color: '#a78bfa' }
  if (typeof raw === 'string' && raw.trim().endsWith('%')) return { text: raw.trim(), color: T.accent }
  if (typeof raw === 'number') return { text: `${raw}%`, color: T.accent }
  return { text: String(raw ?? '—'), color: T.textSub }
}

export default function SurveyAccuracyPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(null)

  const [surveyOpenHour, setSurveyOpenHour] = useState(20)
  const [surveyForceOpen, setSurveyForceOpen] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState('') // '' = follow current survey week
  const [availableWeeks, setAvailableWeeks] = useState([])
  const [includeStaff, setIncludeStaff] = useState(false)

  const [users, setUsers] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [writeErrors, setWriteErrors] = useState([])
  const [stopReqs, setStopReqs] = useState([])
  const [weeklyMenu, setWeeklyMenu] = useState({})

  const [statusFilter, setStatusFilter] = useState('all') // all|complete|partial|noResponse|failed|stopped
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})

  // ── Erase week ──
  const [eraseOpen, setEraseOpen] = useState(false)
  const [erasing, setErasing] = useState(false)
  const [eraseError, setEraseError] = useState(null)
  const [eraseResult, setEraseResult] = useState(null)

  const currentWeek = useMemo(() => getSurveyTargetWeek(surveyOpenHour, surveyForceOpen), [surveyOpenHour, surveyForceOpen])
  const weekId = selectedWeek || currentWeek

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)
    setLoadError(null)
    try {
      // Survey open hour → the "current" target week matches the survey window
      const [{ data: openHourRow }, { data: statusRow }] = await Promise.all([
        supabase
          .from('app_settings').select('value').eq('key', 'survey_open_hour').maybeSingle(),
        supabase
          .from('app_settings').select('value').eq('key', 'survey_status').maybeSingle(),
      ])
      if (openHourRow) {
        const h = parseInt(openHourRow.value, 10)
        if (!isNaN(h)) setSurveyOpenHour(h)
      }
      setSurveyForceOpen(statusRow?.value === 'open')

      const wId = selectedWeek || getSurveyTargetWeek(
        openHourRow ? parseInt(openHourRow.value, 10) || 20 : 20,
        statusRow?.value === 'open',
      )

      const [usersRes, weekRes, errRes, reqsRes] = await Promise.all([
        supabase
          .from('user_stats')
          .select('user_id, name, thali_number, email, avatar_url, role')
          .order('name'),
        fetchWeekRows(wId),
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
      const subs = weekRes.data || []

      // Submissions saved to the table whose user has no user_stats row (fresh
      // signups, or stats not yet back-filled) were INVISIBLE on this page,
      // because rows are driven from user_stats. Merge them in so every saved
      // response renders — they appear as "Unknown member" with their data.
      const knownIds = new Set(memberData.map(u => u.user_id))
      const orphans = [...new Set(subs.map(s => s.user_id).filter(Boolean))]
        .filter(id => !knownIds.has(id))
        .map(id => ({ user_id: id, name: null, thali_number: null, email: null, role: null, orphan: true }))

      setUsers([...memberData, ...orphans])
      setSubmissions(subs)
      setWriteErrors(errRes.data || [])
      setStopReqs(reqsRes.data || [])

      // Menu for the chosen week — fallback dish names when a member's row has
      // no dish_snapshot (e.g. submissions written before the snapshot feature).
      const { data: menuRows } = await supabase
        .from('weekly_menu')
        .select('day_name, lunch, dinner')
        .eq('week_start', wId)
      const menu = {}
      ;(menuRows || []).forEach(row => {
        menu[row.day_name.toLowerCase()] = {
          lunch: row.lunch ? row.lunch.split(',').map(s => s.trim()).filter(Boolean) : [],
          dinner: row.dinner ? row.dinner.split(',').map(s => s.trim()).filter(Boolean) : [],
        }
      })
      setWeeklyMenu(menu)

      // Weeks available in any submission (for the dropdown)
      const { data: allRows } = await fetchAllUserRows()
      const weeks = [...new Set((allRows || []).map(s => s.week_id).filter(Boolean))].sort().reverse()
      setAvailableWeeks(weeks)
    } catch (e) {
      console.error('SurveyAccuracy load error:', e)
      setLoadError(e?.message || 'Failed to load survey accuracy data.')
    }
    setLoading(false)
    setRefreshing(false)
  }, [selectedWeek, includeStaff])

  useEffect(() => { load() }, [load])

  // Realtime — new member saves, override saves, or failed writes appear live.
  useEffect(() => {
    const ch = supabase
      .channel('survey-accuracy')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_submissions_flat' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_day_responses' }, () => load(true))
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
      const stoppedSlots = {}
      const slotDone = {}
      const slotRated = {}
      SLOT_DAYS.forEach((dk, di) => {
        const dayName = DAYS[di]
        SLOT_MEALS.forEach(mk => {
          const slotDate = new Date(weekStart.getTime() + di * 24 * 60 * 60 * 1000)
          const dateStr = toLocalDateStr(slotDate)
          const mealName = mk === 'l' ? 'lunch' : 'dinner'
          const key = `${dk}_${mk}_status`
          const st = row ? row[key] : null
          slotStatus[key] = SLOT_STATUSES.includes(st) ? st : null
          const isStopped = isStoppedOnDay(reqs, dateStr, mealName)
          if (isStopped) {
            stopped++
            stoppedSlots[key] = true
          }

          // Dish ratings for this slot. An Applied meal is only complete when
          // EVERY dish on the menu (from the saved snapshot, else the week's
          // menu) actually has a rating — applied with zero or partial dish
          // ratings is NOT complete, because the kitchen can't cook what was
          // never rated.
          const dishes = getSlotDishes(row, dayName, mealName, weeklyMenu[dayName]?.[mealName] || [])
          const rated = dishes.reduce((acc, d, i) => {
            const raw = row?.[`${dk}_${mk}_dish_${i + 1}`]
            return acc + (raw !== undefined && raw !== null && raw !== '' ? 1 : 0)
          }, 0)
          slotRated[key] = { dishes: dishes.length, rated }

          if (isStopped) slotDone[key] = true
          else if (!st) slotDone[key] = false
          else if (st === 'Applied') slotDone[key] = dishes.length === 0 || rated === dishes.length
          else slotDone[key] = true // Skipped / opted_in / opted_out are complete answers
        })
      })

      const allSlotKeys = []
      SLOT_DAYS.forEach(dk => SLOT_MEALS.forEach(mk => allSlotKeys.push(`${dk}_${mk}_status`)))
      const answered = allSlotKeys.filter(k => slotDone[k] && !stoppedSlots[k]).length
      const applied = Object.values(slotStatus).filter(s => s === 'Applied').length
      const skipped = Object.values(slotStatus).filter(s => s === 'Skipped').length
      const expected = 12 - stopped

      let flag
      if (expected === 0) flag = 'stopped'
      else if (answered >= expected) flag = 'complete'
      else if (Object.values(slotStatus).some(Boolean)) flag = 'partial'
      else flag = 'noResponse'

      const errors = errMap[u.user_id] || []
      return {
        ...u,
        row,
        slotStatus,
        stoppedSlots,
        slotDone,
        slotRated,
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
  }, [users, submissions, writeErrors, stopReqs, weeklyMenu, weekId])

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

  // Erase the selected week from the BACKEND (survey_day_responses,
  // survey_submissions_flat, survey_write_log) in one transaction via the
  // erase_survey_week RPC — every admin view (Dashboard, Tracking, Accuracy,
  // Write Log) reads those same tables, so wiping the DB clears them all.
  const handleEraseWeek = async () => {
    setErasing(true)
    setEraseError(null)
    setEraseResult(null)
    try {
      const { data, error } = await supabase.rpc('erase_survey_week', { p_week_id: weekId })
      if (error) throw error
      setEraseResult(data)
      // If we erased a historical week that was pinned in the dropdown, fall
      // back to the live survey week so the view doesn't keep pointing at a
      // now-empty week.
      if (selectedWeek) setSelectedWeek('')
      await load(true)
    } catch (e) {
      console.error('Erase week error:', e)
      setEraseError(
        e?.message ||
        'Erase failed. Make sure the erase_survey_week migration (034) has been applied to the database.'
      )
    }
    setErasing(false)
  }

  const handleEraseSlot = async (userId, dayKey, meal, memberName) => {
    if (!userId || !weekId) return
    const who = memberName || 'this member'
    if (!window.confirm(`Erase ${dayKey.toUpperCase()} ${meal.toUpperCase()} response for ${who}?\n\nThis will permanently delete this meal portion from Supabase.`)) {
      return
    }
    try {
      const { error } = await eraseSurveySlot(userId, weekId, dayKey, meal)
      if (error) throw error
      await load(true)
    } catch (err) {
      console.error('Erase slot failed:', err)
      alert('Failed to erase portion: ' + (err?.message || 'Please try again.'))
    }
  }

  const handleEraseMemberWeek = async (userId, memberName) => {
    if (!userId || !weekId) return
    const who = memberName || 'this member'
    if (!window.confirm(`Erase ALL survey responses for ${who} for week of ${fmtDate(weekId)}?\n\nThis will permanently delete all lunch & dinner responses for this user from Supabase.`)) {
      return
    }
    try {
      for (const dk of SLOT_DAYS) {
        await eraseSurveySlot(userId, weekId, dk, 'lunch')
        await eraseSurveySlot(userId, weekId, dk, 'dinner')
      }
      await load(true)
    } catch (err) {
      console.error('Erase member week failed:', err)
      alert('Failed to erase member responses: ' + (err?.message || 'Please try again.'))
    }
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
          <Btn variant="danger" onClick={() => { setEraseError(null); setEraseResult(null); setEraseOpen(true) }} style={{ padding: '8px 14px' }}>
            <Trash2 size={14} /> Erase Week
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
                          <div style={{ fontWeight: 700 }}>{r.name || 'Unknown member'}</div>
                          <div style={{ fontSize: 10.5, color: T.textSub }}>
                            {r.thali_number ? `#${r.thali_number}` : r.email || (r.orphan ? `no profile · ${r.user_id.slice(0, 8)}` : '')}
                          </div>
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
                            {/* ── TOP MEMBER ACTIONS STRIP ── */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 12px', background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, flexWrap: 'wrap', gap: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: T.textSub }}>
                                Detailed meal breakdown for <strong style={{ color: T.text }}>{r.name || 'Member'}</strong>
                              </span>
                              {r.answered > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleEraseMemberWeek(r.user_id, r.name || r.thali_number)}
                                  style={{
                                    padding: '4px 10px', borderRadius: 8,
                                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                    color: '#ef4444', fontSize: 11, fontWeight: 700,
                                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5
                                  }}
                                >
                                  <Trash2 size={12} /> Erase All Responses for this Member
                                </button>
                              )}
                            </div>

                            {/* ── FULL SURVEY VIEW — every lunch & dinner menu card ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10, marginBottom: 12 }}>
                              {SLOT_DAYS.map((dk, di) => {
                                const dayName = DAYS[di]
                                const stopped = r.stoppedSlots || {}
                                return (
                                  <div key={dk} style={{ background: T.inputBg, borderRadius: 12, padding: 12, border: `1px solid ${T.border}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                      <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, textTransform: 'capitalize', fontFamily: "'Playfair Display',serif" }}>
                                        {dayName}
                                      </div>
                                      <div style={{ fontSize: 10, color: T.textSub, fontWeight: 700 }}>
                                        {r.slotDone?.[`${dk}_l_status`] && r.slotDone?.[`${dk}_d_status`]
                                          ? '✓✓ complete'
                                          : r.slotStatus[`${dk}_l_status`] || r.slotStatus[`${dk}_d_status`]
                                            ? '◐ partial'
                                            : '○ not answered'}
                                      </div>
                                    </div>
                                    {SLOT_MEALS.map(mk => {
                                      const mealName = mk === 'l' ? 'lunch' : 'dinner'
                                      const st = r.slotStatus[`${dk}_${mk}_status`]
                                      const isStopped = stopped[`${dk}_${mk}`]
                                      const row = r.row
                                      const dishes = getSlotDishes(row, dayName, mealName, weeklyMenu[dayName]?.[mealName] || [])
                                      const dishValues = {}
                                      dishes.forEach((d, i) => {
                                        const raw = row?.[`${dk}_${mk}_dish_${i + 1}`]
                                        if (raw !== undefined && raw !== null && raw !== '') dishValues[d] = raw
                                      })
                                      return (
                                        <div key={mk} style={{ background: T.card, borderRadius: 10, border: `1px solid ${T.border}`, padding: 10, marginBottom: 8 }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                                            <span style={{ fontSize: 11, fontWeight: 800, color: T.accent, fontFamily: "'DM Sans',sans-serif" }}>
                                              {mk === 'l' ? '☀️ Lunch' : '🌙 Dinner'}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                              {isStopped ? (
                                                <Badge color="#a78bfa" style={{ padding: '2px 8px', fontSize: 9 }}>⏹ Stopped</Badge>
                                              ) : st === 'Applied' && !r.slotDone?.[`${dk}_${mk}_status`] ? (
                                                <Badge color={r.slotRated?.[`${dk}_${mk}_status`]?.rated === 0 ? '#ef4444' : '#f59e0b'} style={{ padding: '2px 8px', fontSize: 9 }}>
                                                  {r.slotRated?.[`${dk}_${mk}_status`]?.rated === 0 ? '⚠️ Unrated' : '◐ Partial'}
                                                </Badge>
                                              ) : st ? (
                                                <Badge color={st === 'Applied' ? T.success : st === 'Skipped' ? '#ef4444' : '#eab308'} style={{ padding: '2px 8px', fontSize: 9 }}>
                                                  {st === 'Applied' ? '✅ Applied' : st === 'Skipped' ? '❌ Skipped' : st}
                                                </Badge>
                                              ) : (
                                                <Badge color={T.textSub} style={{ padding: '2px 8px', fontSize: 9 }}>—</Badge>
                                              )}
                                              {st && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleEraseSlot(r.user_id, dk, mealName, r.name || r.thali_number)}
                                                  title={`Erase ${dayName} ${mealName} response for ${r.name || 'member'} from Supabase`}
                                                  style={{
                                                    padding: '2px 6px', borderRadius: 6,
                                                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                                    color: '#ef4444', fontSize: 9.5, fontWeight: 700,
                                                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3
                                                  }}
                                                >
                                                  <Trash2 size={10} /> Erase
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                          {isStopped ? (
                                            <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600 }}>Thali stopped — not expected</div>
                                          ) : st === 'Skipped' ? (
                                            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>❌ Whole meal skipped</div>
                                          ) : st === 'Applied' && Object.keys(dishValues).length > 0 ? (
                                            <div>
                                              {Object.entries(dishValues).map(([dish, raw]) => (
                                                <div key={dish} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderBottom: `1px solid ${T.border}` }}>
                                                  <span style={{ fontSize: 11.5, color: T.text, fontFamily: "'DM Sans',sans-serif" }}>{dish}</span>
                                                  <span style={{ fontSize: 11.5, fontWeight: 800, color: fmtDishVal(raw).color, fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap' }}>{fmtDishVal(raw).text}</span>
                                                </div>
                                              ))}
                                              {dishes.length > Object.keys(dishValues).length && (
                                                <div style={{ fontSize: 10, color: T.textSub, marginTop: 4, opacity: 0.75 }}>
                                                  {Object.keys(dishValues).length}/{dishes.length} dishes rated
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <div style={{ fontSize: 11, color: st === 'Applied' ? '#ef4444' : T.textSub, fontWeight: 700 }}>
                                              {st === 'Applied' ? '⚠️ No dish ratings — not complete' : 'No response'}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )
                              })}
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
        (12 minus days they stopped thali) are answered — an <strong>Applied</strong> meal only counts when every dish on its menu has a rating.
        Applied with no dish ratings is <strong>not complete</strong>. <strong>Partial</strong> when some slots remain, <strong>No response</strong> when none
        are answered, and <strong>Failed saves</strong> when the submit-survey function rejected any write this week — check the
        Survey Write Log for the full payload. Members whose thali was stopped the entire week are excluded from the expected count.
      </div>

      {/* ── ERASE WEEK CONFIRMATION ── */}
      <Modal isOpen={eraseOpen} onClose={() => !erasing && setEraseOpen(false)} title="Erase survey week" maxWidth={520}>
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.6 }}>
              This is <strong style={{ color: '#ef4444' }}>permanent and cannot be undone</strong>. All survey data for the week
              of <strong style={{ color: T.accent }}>{fmtDate(weekId)}</strong> will be wiped from the database — and therefore from
              every admin view (Dashboard, Tracking, Accuracy, Write Log) and the member app.
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: T.textSub, lineHeight: 1.7, marginBottom: 14 }}>
            <strong style={{ color: T.text }}>This erases:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>{submissions.length} member submission{submissions.length === 1 ? '' : 's'} (survey_submissions_flat)</li>
              <li>per-day response rows (survey_day_responses)</li>
              <li>{writeErrors.length} write-log entr{writeErrors.length === 1 ? 'y' : 'ies'} — failed saves + audit trail</li>
            </ul>
            <div style={{ marginTop: 8 }}>
              Members can answer the week again if the survey is still open. One audit entry for this erase is kept in the write log.
            </div>
          </div>
          {eraseError && <Alert msg={eraseError} type="error" />}
          {eraseResult && (
            <Alert
              msg={`Erased ${eraseResult.submissions ?? 0} submissions, ${eraseResult.day_responses ?? 0} day rows and ${eraseResult.write_log ?? 0} log rows.`}
              type="success"
            />
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <Btn variant="outline" onClick={() => setEraseOpen(false)} disabled={erasing} style={{ padding: '10px 18px' }}>
              Cancel
            </Btn>
            <Btn variant="danger" onClick={handleEraseWeek} disabled={erasing} style={{ padding: '10px 18px' }}>
              <Trash2 size={14} /> {erasing ? 'Erasing…' : 'Erase week'}
            </Btn>
          </div>
        </div>
      </Modal>
    </PageWrap>
  )
}
