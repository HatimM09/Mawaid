import React, { useState, useEffect, useRef } from 'react'
import { ChevronUp, ChevronDown, X, MessageCircle, Camera } from 'lucide-react'
import { supabase } from '../../lib/firebaseClient'
import { useAuth, useTheme } from '../../admin/context'
import { getCalendarWeekDate, toLocalDateStr } from '../../common/utils'
import { ListPageSkeleton } from '../../common/Skeleton'
import { Card, ErrorBanner, SectionLabel, Spinner } from '../ui'

export default function PostPage() {
  const t = useTheme()
  const [subTab, setSubTab] = useState('requests')
  return (
    <main style={{ flex: 1, padding: '16px 16px calc(110px + env(safe-area-inset-bottom, 20px))', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, background: t.card, borderRadius: 13, padding: 5, border: `1px solid ${t.border}` }}>
        {[{ id: 'requests', label: '📋 Requests' }, { id: 'queries', label: '❓ Queries' }].map(({ id, label }) => (
          <button key={id} onClick={() => setSubTab(id)}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: 'none', background: subTab === id ? t.accentGrad : 'transparent', color: subTab === id ? '#fff' : t.textSub, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.25s' }}>
            {label}
          </button>
        ))}
      </div>
      {subTab === 'requests' && <ThaliRequestsSection />}
      {subTab === 'queries' && <QueriesSection />}
    </main>
  )
}

const RCard = ({ activeRequest, type, t, children }) => (
  <div style={{ marginBottom: 10, borderRadius: 14, border: `1px solid ${activeRequest === type ? t.borderActive : t.border}`, background: activeRequest === type ? t.cardActive : t.card, overflow: 'hidden' }}>{children}</div>
)

const HdrBtn = ({ type, emoji, label, desc, activeRequest, openRequest, t }) => (
  <button onClick={() => openRequest(type)} style={{ width: '100%', padding: 15, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}>
    <div style={{ width: 44, height: 44, borderRadius: 12, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{emoji}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: activeRequest === type ? t.accent : t.text, fontFamily: "'DM Sans',sans-serif" }}>{label}</div>
      <div style={{ fontSize: 12, color: t.textSub, marginTop: 1, fontFamily: "'DM Sans',sans-serif" }}>{desc}</div>
    </div>
    {activeRequest === type ? <ChevronUp size={14} color={t.accent} /> : <ChevronDown size={14} color={t.accent} />}
  </button>
)

function ThaliRequestsSection() {
  const t = useTheme(), { user } = useAuth()
  const [activeRequest, setActiveRequest] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [resumeFrom, setResumeFrom] = useState('')
  const [resumeMealType, setResumeMealType] = useState(null)
  const [stopDays, setStopDays] = useState([])
  const [stopFrom, setStopFrom] = useState('')
  const [stopTo, setStopTo] = useState('')
  const [stopMealType, setStopMealType] = useState(null)
  const [miqaatOption, setMiqaatOption] = useState(null)
  const [extraItems, setExtraItems] = useState([{ name: '', qty: 1 }])
  const [extraMode, setExtraMode] = useState('addition')
  const today = toLocalDateStr(new Date())
  const inp = { width: '100%', padding: '11px 13px', borderRadius: 11, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif" }

  const resetAll = () => { setResumeFrom(''); setResumeMealType(null); setStopDays([]); setStopFrom(''); setStopTo(''); setStopMealType(null); setMiqaatOption(null); setExtraItems([{ name: '', qty: 1 }]); setExtraMode('addition'); setError(''); setSuccess('') }
  const openRequest = (type) => { resetAll(); setActiveRequest(activeRequest === type ? null : type) }
  const addExtraItem = () => setExtraItems(prev => [...prev, { name: '', qty: 1 }])
  const removeExtraItem = i => setExtraItems(prev => prev.filter((_, idx) => idx !== i))
  const updateExtraItem = (i, field, val) => setExtraItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  // ── Stop Thali weekly (Mon–Sun) calendar for the CURRENT week ──
  // Dates are stored as real local calendar dates so they match the admin's
  // survey tracking (which compares against the same local-date format).
  const stopWeekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(getCalendarWeekDate() + 'T00:00:00')
    d.setDate(d.getDate() + i)
    return toLocalDateStr(d)
  })
  const stopDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const toggleStopDay = (d) => {
    const next = stopDays.includes(d) ? stopDays.filter(x => x !== d) : [...stopDays, d]
    setStopDays(next)
    if (next.length) {
      const sorted = [...next].sort()
      setStopFrom(sorted[0])
      setStopTo(sorted[sorted.length - 1])
    } else {
      setStopFrom('')
      setStopTo('')
    }
  }

  const handleSubmit = async (type) => {
    setError(''); setSuccess(''); setSubmitting(true)
    try {
      let payload = { user_id: user.id, request_type: type, status: 'pending' }
      if (type === 'resume') {        if (!resumeMealType) throw new Error('Please select a meal option (Lunch, Dinner, or Both)');        if (!resumeFrom) throw new Error('Please select a date');        payload = { ...payload, from_date: resumeFrom, to_date: null, meal_type: resumeMealType }      }
      else if (type === 'stop') {        if (!stopMealType) throw new Error('Please select a meal option (Lunch, Dinner, or Both)');        if (!stopDays.length) throw new Error('Please select at least one day in the current week');        payload = { ...payload, from_date: stopFrom, to_date: stopTo, meal_type: stopMealType }      }
      else if (type === 'miqaat') { if (!miqaatOption) throw new Error('Please select an option'); payload = { ...payload, details: `Option ${miqaatOption}` } }
      else if (type === 'extra') { const valid = extraItems.filter(i => i.name.trim()); if (!valid.length) throw new Error('Please add at least one item'); payload = { ...payload, extra_items: valid, extra_mode: extraMode } }
      const { error: dbErr } = await supabase.from('thali_requests').insert([payload])
      if (dbErr) throw dbErr
      
      // Notify admins about the new request (in-app rows + push via edge function)
      try {
        const typeLabels = { resume: 'Resume Thali', stop: 'Stop Thali', extra: 'Extra Food', miqaat: 'Miqaat Pirsu' }
        const typeLabel = typeLabels[type] || type
        // Fetch user's name from profile
        let userName = 'A user'
        try {
          const { data: profile } = await supabase.from('user_stats').select('name, thali_number').eq('user_id', user.id).maybeSingle()
          if (profile?.name) userName = profile.name
          if (profile?.thali_number) userName += ` (#${profile.thali_number})`
        } catch { /* ignore */ }
        await supabase.functions.invoke('send-push', {
          body: {
            title: '📋 New ' + typeLabel + ' Request',
            body: userName + ' submitted a ' + typeLabel + ' request.',
            target_type: 'admins',
            notify_in_app: true,
            type: 'new_request',
            sender_name: 'Al-Mawaid',
            url: '/admin/requests'
          }
        })
      } catch (notifyErr) {
        console.warn('Admin request notification failed:', notifyErr)
      }
      
      const extraLabel = extraMode === 'deduction' ? 'Deduction' : 'Extra Food'
      setSuccess(`✅ ${type === 'resume' ? 'Resume' : type === 'stop' ? 'Stop' : extraLabel} request submitted!`)
      resetAll(); setActiveRequest(null)
    } catch (err) { setError(err.message) } finally { setSubmitting(false) }
  }



  return (
    <div>
      {success && <div style={{ marginBottom: 12, padding: 13, borderRadius: 12, background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.successText, fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{success}</div>}
      <RCard activeRequest={activeRequest} type="resume" t={t}>
        <HdrBtn activeRequest={activeRequest} openRequest={openRequest} t={t} type="resume" emoji="▶️" label="Resume Thali" desc="Restart your thali service" />
        {activeRequest === 'resume' && (
          <div style={{ padding: '0 16px 16px' }}>
            {!resumeMealType ? (
              <div style={{ marginBottom: 12 }}>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>SELECT MEAL TO RESUME</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['lunch', 'dinner', 'both'].map(m => (
                    <button key={m} onClick={() => setResumeMealType(m)}
                      style={{ flex: 1, padding: '12px 8px', borderRadius: 11, border: `1.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", textTransform: 'capitalize' }}>
                      {m === 'both' ? 'Both' : m}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accentBorder}`, textAlign: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>Meal: {resumeMealType === 'both' ? 'Both (Lunch & Dinner)' : resumeMealType.charAt(0).toUpperCase() + resumeMealType.slice(1)}</span>
                  <button onClick={() => setResumeMealType(null)} style={{ marginLeft: 10, background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>Change</button>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="resumeFrom" style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>RESUME FROM</label>
                  <input type="date" id="resumeFrom" name="resumeFrom" value={resumeFrom} min={today} onChange={e => setResumeFrom(e.target.value)} style={inp} />
                </div>
                {error && <ErrorBanner msg={error} />}
                <button onClick={() => handleSubmit('resume')} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting...' : 'Submit Resume Request'}</button>
              </>
            )}
          </div>
        )}
      </RCard>
      <RCard activeRequest={activeRequest} type="stop" t={t}>
        <HdrBtn activeRequest={activeRequest} openRequest={openRequest} t={t} type="stop" emoji="⏹️" label="Stop Thali" desc="Pause your thali service" />
        {activeRequest === 'stop' && (
          <div style={{ padding: '0 16px 16px' }}>
            {!stopMealType ? (
              <div style={{ marginBottom: 12 }}>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>SELECT MEAL TO STOP</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['lunch', 'dinner', 'both'].map(m => (
                    <button key={m} onClick={() => setStopMealType(m)}
                      style={{ flex: 1, padding: '12px 8px', borderRadius: 11, border: `1.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", textTransform: 'capitalize' }}>
                      {m === 'both' ? 'Both' : m}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accentBorder}`, textAlign: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>Meal: {stopMealType === 'both' ? 'Both (Lunch & Dinner)' : stopMealType.charAt(0).toUpperCase() + stopMealType.slice(1)}</span>
                  <button onClick={() => setStopMealType(null)} style={{ marginLeft: 10, background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>Change</button>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>SELECT DAYS THIS WEEK (MON–SUN)</label>
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                    {stopWeekDays.map((d, i) => {
                      const isSel = stopDays.includes(d)
                      const isToday = d === toLocalDateStr(new Date())
                      const isPast = d < toLocalDateStr(new Date())
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleStopDay(d)}
                          style={{
                            flex: '0 0 auto', width: 44, height: 58, borderRadius: 12,
                            border: `1.5px solid ${isSel ? '#e05555' : isToday ? t.accentBorder : t.border}`,
                            background: isSel ? 'rgba(224,85,85,0.18)' : isToday ? t.accentBg : t.inputBg,
                            color: isSel ? '#e05555' : isToday ? t.accent : (isPast ? 'rgba(255,255,255,0.25)' : t.text),
                            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                            fontFamily: "'DM Sans',sans-serif", opacity: isPast ? 0.45 : 1,
                          }}
                        >
                          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em' }}>{stopDayLabels[i]}</span>
                          <span style={{ fontSize: 14, fontWeight: 800 }}>{new Date(d + 'T00:00:00').getDate()}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: t.textSub, marginTop: 8, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.6 }}>
                    {stopDays.length > 0
                      ? <><strong style={{ color: '#e05555' }}>Stop selected:</strong> {new Date(stopFrom + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} {stopTo !== stopFrom && <>→ {new Date(stopTo + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</>}</>
                      : 'Pick the days you want to pause. For next week, submit this request and it will be reviewed.'}
                  </div>
                </div>
                {error && <ErrorBanner msg={error} />}
                <button onClick={() => handleSubmit('stop')} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : 'linear-gradient(135deg,#e05555,#c03030)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting...' : 'Submit Stop Request'}</button>
              </>
            )}
          </div>
        )}
      </RCard>
      <RCard activeRequest={activeRequest} type="miqaat" t={t}>
        <HdrBtn activeRequest={activeRequest} openRequest={openRequest} t={t} type="miqaat" emoji="🕌" label="Miqaat Pirsu" desc="Select your Miqaat option" />
        {activeRequest === 'miqaat' && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => setMiqaatOption(n)}
                  style={{ flex: 1, height: 48, borderRadius: 12, border: `1.5px solid ${miqaatOption === n ? t.accent : t.border}`, background: miqaatOption === n ? t.accentBg : 'transparent', color: miqaatOption === n ? t.accent : t.textSub, fontWeight: 800, fontSize: 18, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s' }}>
                  {n}
                </button>
              ))}
            </div>
            {error && <ErrorBanner msg={error} />}
            <button onClick={() => handleSubmit('miqaat')} disabled={submitting || !miqaatOption} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif", opacity: !miqaatOption ? 0.5 : 1 }}>{submitting ? 'Submitting…' : 'Submit Miqaat Option'}</button>
          </div>
        )}
      </RCard>
      <RCard activeRequest={activeRequest} type="extra" t={t}>
        <HdrBtn activeRequest={activeRequest} openRequest={openRequest} t={t} type="extra" emoji={extraMode === 'deduction' ? '➖' : '➕'} label="Add Extra Food" desc="Add or deduct thali items" />
        {activeRequest === 'extra' && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="extraMode" style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>ADJUSTMENT TYPE</label>
              <select id="extraMode" name="extraMode" value={extraMode} onChange={e => setExtraMode(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                <option value="addition">➕ Addition — add extra items</option>
                <option value="deduction">➖ Deduction — reduce / remove items</option>
              </select>
            </div>
            {extraItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input type="text" name={`extraItem${i}`} value={item.name} placeholder={extraMode === 'deduction' ? `Item ${i + 1} to deduct` : `Item ${i + 1}`} onChange={e => updateExtraItem(i, 'name', e.target.value)} style={{ ...inp, flex: 1 }} />
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {(extraMode === 'deduction' ? [0, 1, 2] : [1, 2, 3, 4]).map(n => (
                    <button key={n} onClick={() => updateExtraItem(i, 'qty', n)}
                      style={{ width: 32, height: 36, borderRadius: 9, border: `1.5px solid ${item.qty === n ? t.accent : t.border}`, background: item.qty === n ? t.accentBg : 'transparent', color: item.qty === n ? t.accent : t.textSub, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>{n}</button>
                  ))}
                </div>
                {extraItems.length > 1 && <button onClick={() => removeExtraItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={15} color="#e05555" /></button>}
              </div>
            ))}
            {extraItems.length < 6 && <button onClick={addExtraItem} style={{ width: '100%', padding: 10, borderRadius: 11, border: `1px dashed ${t.accent}`, background: 'transparent', color: t.accent, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 10, fontFamily: "'DM Sans',sans-serif" }}>+ Add Another Item</button>}
            {error && <ErrorBanner msg={error} />}
            <button onClick={() => handleSubmit('extra')} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting…' : extraMode === 'deduction' ? '➖ Submit Deduction Request' : '➕ Submit Extra Food Request'}</button>
          </div>
        )}
      </RCard>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>Recent Requests</SectionLabel>
        <RecentRequestsList />
      </div>
    </div>
  )
}

function RecentRequestsList() {
  const t = useTheme(), { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPending = async () => {
    if (!user?.id) return
    const { data } = await supabase.from('thali_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5)
    setRequests(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchPending()
    const channel = supabase
      .channel('recent-requests-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'thali_requests', filter: `user_id=eq.${user.id}` }, () => {
        fetchPending()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  const statusColor = (s) => s === 'pending' ? '#d4882a' : s === 'approved' ? '#5eba82' : '#e05555'

  if (loading) return <Spinner />
  if (requests.length === 0) return <div style={{ textAlign: 'center', padding: 20, color: t.textSub, fontSize: 13, opacity: 0.6 }}>No active requests.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {requests.map(r => (
        <div key={r.id} style={{ padding: 14, borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>
              {r.request_type === 'resume' ? '▶️ Resume' : r.request_type === 'stop' ? '⏹️ Stop' : r.request_type === 'extra' ? '➕ Extra' : '🕌 Miqaat'}
            </div>
            <div style={{ fontSize: 11, color: t.textSub, marginTop: 2, fontFamily: "'DM Sans',sans-serif" }}>{new Date(r.created_at).toLocaleDateString()}</div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: `${statusColor(r.status)}15`, color: statusColor(r.status), border: `1px solid ${statusColor(r.status)}30`, textTransform: 'uppercase' }}>
            {r.status || 'PENDING'}
          </div>
        </div>
      ))}
    </div>
  )
}

function QueriesSection() {
  const t = useTheme(), { user } = useAuth()
  const [queries, setQueries] = useState([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [mediaFiles, setMediaFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [helpline, setHelpline] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    supabase.from('app_settings').select('*').eq('key', 'helpline_number').maybeSingle()
      .then(({ data }) => { if (data) setHelpline(data.value) })
  }, [])

  useEffect(() => {
    loadQueries()
    const channel = supabase
      .channel('queries-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queries', filter: `user_id=eq.${user.id}` }, () => {
        loadQueries()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])
  const loadQueries = async () => {
    try {
      const { data } = await supabase.from('queries')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(20)

      setQueries(data || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
    if (mediaFiles.length + files.length > 4) { setError('Max 4 files'); return }
    setMediaFiles(prev => [...prev, ...files.map(file => ({ file, url: URL.createObjectURL(file), type: file.type.startsWith('image/') ? 'image' : 'video', name: file.name }))])
    e.target.value = ''
  }
  const removeMedia = i => { setMediaFiles(prev => { URL.revokeObjectURL(prev[i].url); return prev.filter((_, idx) => idx !== i) }) }
  const handleSubmit = async () => {
    if (!comment.trim() && !mediaFiles.length) return setError('Add a comment or attach a file')
    setError(''); setSuccess(''); setSubmitting(true)
    try {
      const uploadedUrls = []
      for (const item of mediaFiles) {
        const ext = item.file.name.split('.').pop()
        const path = `queries/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('query-media').upload(path, item.file)
        if (!upErr) { const { data: urlData } = supabase.storage.from('query-media').getPublicUrl(path); uploadedUrls.push({ type: item.type, name: item.file.name, path: urlData.publicUrl }) }
      }
      const { error: dbErr } = await supabase.from('queries').insert([{
        user_id: user.id,
        subject: comment.substring(0, 50) + (comment.length > 50 ? '...' : ''),
        comment: comment.trim(),
        media: uploadedUrls,
        status: 'open'
      }])
      if (dbErr) throw dbErr

      // Notify admins about the new query (in-app rows + push via edge function)
      try {
        // Fetch user's name from profile
        let userName = 'A user'
        try {
          const { data: profile } = await supabase.from('user_stats').select('name, thali_number').eq('user_id', user.id).maybeSingle()
          if (profile?.name) userName = profile.name
          if (profile?.thali_number) userName += ` (#${profile.thali_number})`
        } catch { /* ignore */ }
        await supabase.functions.invoke('send-push', {
          body: {
            title: '📩 New Query from ' + userName,
            body: userName + ' submitted: "' + comment.substring(0, 80) + (comment.length > 80 ? '…"' : '"'),
            target_type: 'admins',
            notify_in_app: true,
            type: 'new_query',
            sender_name: 'Al-Mawaid',
            url: '/admin/queries'
          }
        })
      } catch (notifyErr) {
        console.warn('Admin query notification failed:', notifyErr)
      }

      setSuccess('✅ Query submitted! Our team will respond shortly.')
      setComment(''); setMediaFiles([]); loadQueries()
    } catch (err) { setError(err.message) } finally { setSubmitting(false) }
  }
  const statusColor = s => s === 'open' ? '#d4882a' : s === 'resolved' ? '#5eba82' : '#7aabb8'

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif" }}>✉️ New Query</div>
          {helpline && (
            <a href={`https://wa.me/${helpline.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, background: '#25D366', color: '#fff', fontSize: 10, fontWeight: 800, textDecoration: 'none', boxShadow: '0 4px 10px rgba(37,211,102,0.2)' }}>
              <MessageCircle size={12} /> WhatsApp Helpline
            </a>
          )}
        </div>
        <textarea name="query" value={comment} onChange={e => setComment(e.target.value)} style={{ width: '100%', minHeight: 78, padding: 12, borderRadius: 11, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: "'DM Sans',sans-serif", marginBottom: 10 }} placeholder="Describe your query or issue…" />
        {mediaFiles.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {mediaFiles.map((item, i) => (
              <div key={i} style={{ position: 'relative', width: 68, height: 68, borderRadius: 10, overflow: 'hidden', border: `1px solid ${t.border}`, flexShrink: 0 }}>
                {item.type === 'image' ? <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: t.inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎬</div>}
                <button onClick={() => removeMedia(i)} style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.72)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={10} color="#fff" /></button>
              </div>
            ))}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
        {mediaFiles.length < 4 && (
          <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: 10, borderRadius: 11, border: `1px dashed ${t.accentBorder}`, background: t.accentBg, color: t.accent, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: "'DM Sans',sans-serif" }}>
            <Camera size={14} /> Attach Photo / Video ({mediaFiles.length}/4)
          </button>
        )}
        {error && <ErrorBanner msg={error} />}
        {success && <div style={{ marginBottom: 10, padding: 11, borderRadius: 10, background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.successText, fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{success}</div>}
        <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting…' : '📨 Submit Query'}</button>
      </Card>
      <SectionLabel>My Queries</SectionLabel>
      {loading ? <ListPageSkeleton count={3} /> : queries.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: t.textSub, fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>No queries yet.</div> : queries.map(q => (
        <Card key={q.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <div>
              <span style={{ display: 'block', fontSize: 11, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginBottom: 4 }}>{new Date(q.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: `${statusColor(q.status)}20`, color: statusColor(q.status), border: `1px solid ${statusColor(q.status)}38`, fontFamily: "'DM Sans',sans-serif" }}>{q.status?.toUpperCase()}</span>
            </div>

          </div>
          {q.comment && <p style={{ margin: '0 0 8px', fontSize: 14, color: t.textBody, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>{q.comment}</p>}
          {q.media && q.media.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {q.media.map((m, i) => m.path && m.type === 'image' && <img key={i} src={m.path} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />)}
            </div>
          )}
          {q.admin_reply && <div style={{ marginTop: 8, padding: 10, borderRadius: 9, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 13, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>💬 <strong>Reply:</strong> {q.admin_reply}</div>}
        </Card>
      ))}
    </div>
  )
}
