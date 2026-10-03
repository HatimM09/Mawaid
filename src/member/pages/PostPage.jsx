import React, { useState, useEffect, useRef } from 'react'
import {
  ChevronDown, X, MessageCircle, Camera, PlayCircle, PauseCircle,
  Sparkles, PlusCircle, MinusCircle, HelpCircle, Send, CheckCircle2,
  FileText
} from 'lucide-react'
import { supabase } from '../../lib/firebaseClient'
import { useAuth, useTheme } from '../../admin/context'
import { getCalendarWeekDate, toLocalDateStr } from '../../common/utils'
import { ListPageSkeleton } from '../../common/Skeleton'
import { Card, ErrorBanner, SectionLabel, Spinner } from '../ui'

export default function PostPage() {
  const t = useTheme()
  const [subTab, setSubTab] = useState('requests')

  const tabs = [
    { id: 'requests', label: 'Thali Requests', icon: <FileText size={16} /> },
    { id: 'queries', label: 'Queries & Help', icon: <HelpCircle size={16} /> }
  ]

  return (
    <main style={{
      flex: 1,
      padding: '16px 16px calc(110px + env(safe-area-inset-bottom, 20px))',
      maxWidth: 800,
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Luxury Segmented Tabs */}
      <div style={{
        display: 'flex',
        gap: 6,
        marginBottom: 20,
        background: t.card,
        borderRadius: 18,
        padding: 6,
        border: `1.5px solid ${t.border}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
      }}>
        {tabs.map(({ id, label, icon }) => {
          const isActive = subTab === id
          return (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 14,
                border: 'none',
                background: isActive ? t.accentGrad : 'transparent',
                color: isActive ? '#000' : t.textSub,
                fontWeight: isActive ? 900 : 700,
                fontSize: 13.5,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              <span style={{ color: isActive ? '#000' : t.accent }}>{icon}</span>
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {subTab === 'requests' && <ThaliRequestsSection />}
      {subTab === 'queries' && <QueriesSection />}
    </main>
  )
}

const RCard = ({ activeRequest, type, t, children }) => {
  const isActive = activeRequest === type
  return (
    <div style={{
      marginBottom: 14,
      borderRadius: 22,
      border: `1.5px solid ${isActive ? t.borderActive || t.accent : t.border}`,
      background: isActive ? t.cardActive || t.card : t.card,
      overflow: 'hidden',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: isActive ? '0 12px 32px rgba(0,0,0,0.3)' : '0 4px 14px rgba(0,0,0,0.1)'
    }}>
      {children}
    </div>
  )
}

const HdrBtn = ({ type, icon, label, desc, activeRequest, openRequest, t, gradient }) => {
  const isActive = activeRequest === type
  return (
    <button
      onClick={() => openRequest(type)}
      style={{
        width: '100%',
        padding: '16px 18px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        textAlign: 'left'
      }}
    >
      <div style={{
        width: 46,
        height: 46,
        borderRadius: 14,
        background: gradient || t.accentGrad,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        flexShrink: 0,
        boxShadow: '0 6px 16px rgba(0,0,0,0.2)'
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: isActive ? t.accent : t.text, fontFamily: "'Playfair Display', serif" }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: t.textSub, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
          {desc}
        </div>
      </div>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: t.inputBg,
        border: `1px solid ${t.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isActive ? t.accent : t.textSub,
        transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.3s'
      }}>
        <ChevronDown size={16} />
      </div>
    </button>
  )
}

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

  const inp = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    boxSizing: 'border-box',
    background: t.inputBg,
    border: `1px solid ${t.inputBorder}`,
    color: t.text,
    fontSize: 14,
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif"
  }

  const resetAll = () => {
    setResumeFrom('')
    setResumeMealType(null)
    setStopDays([])
    setStopFrom('')
    setStopTo('')
    setStopMealType(null)
    setMiqaatOption(null)
    setExtraItems([{ name: '', qty: 1 }])
    setExtraMode('addition')
    setError('')
    setSuccess('')
  }

  const openRequest = (type) => {
    resetAll()
    setActiveRequest(activeRequest === type ? null : type)
  }

  const addExtraItem = () => setExtraItems(prev => [...prev, { name: '', qty: 1 }])
  const removeExtraItem = i => setExtraItems(prev => prev.filter((_, idx) => idx !== i))
  const updateExtraItem = (i, field, val) => setExtraItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

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
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      let payload = { user_id: user.id, request_type: type, status: 'pending' }
      if (type === 'resume') {
        if (!resumeMealType) throw new Error('Please select a meal option (Lunch, Dinner, or Both)')
        if (!resumeFrom) throw new Error('Please select a date to resume')
        payload = { ...payload, from_date: resumeFrom, to_date: null, meal_type: resumeMealType }
      } else if (type === 'stop') {
        if (!stopMealType) throw new Error('Please select a meal option (Lunch, Dinner, or Both)')
        if (!stopDays.length) throw new Error('Please select at least one day in the current week')
        payload = { ...payload, from_date: stopFrom, to_date: stopTo, meal_type: stopMealType }
      } else if (type === 'miqaat') {
        if (!miqaatOption) throw new Error('Please select an option')
        payload = { ...payload, details: `Option ${miqaatOption}` }
      } else if (type === 'extra') {
        const valid = extraItems.filter(i => i.name.trim())
        if (!valid.length) throw new Error('Please add at least one item')
        payload = { ...payload, extra_items: valid, extra_mode: extraMode }
      }

      const { error: dbErr } = await supabase.from('thali_requests').insert([payload])
      if (dbErr) throw dbErr

      try {
        const typeLabels = { resume: 'Resume Thali', stop: 'Stop Thali', extra: 'Extra Food', miqaat: 'Miqaat Pirsu' }
        const labelText = typeLabels[type] || type
        let userName = 'A member'
        try {
          const { data: profile } = await supabase.from('user_stats').select('name, thali_number').eq('user_id', user.id).maybeSingle()
          if (profile?.name) userName = profile.name
          if (profile?.thali_number) userName += ` (#${profile.thali_number})`
        } catch { /* ignore */ }

        await supabase.functions.invoke('send-push', {
          body: {
            title: '📋 New ' + labelText + ' Request',
            body: userName + ' submitted a ' + labelText + ' request.',
            target_type: 'admins',
            notify_in_app: true,
            type: 'new_request',
            sender_name: 'Al-Mawaid',
            url: '/admin/requests'
          }
        })
      } catch (notifyErr) {
        console.warn('Admin notification error:', notifyErr)
      }

      const extraLabel = extraMode === 'deduction' ? 'Deduction' : 'Extra Food'
      setSuccess(`✅ ${type === 'resume' ? 'Resume' : type === 'stop' ? 'Stop' : extraLabel} request submitted successfully!`)
      resetAll()
      setActiveRequest(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {success && (
        <div style={{
          marginBottom: 16,
          padding: 14,
          borderRadius: 14,
          background: 'rgba(16,185,129,0.12)',
          border: '1px solid rgba(16,185,129,0.3)',
          color: '#34d399',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: "'DM Sans', sans-serif"
        }}>
          {success}
        </div>
      )}

      {/* Resume Thali Card */}
      <RCard activeRequest={activeRequest} type="resume" t={t}>
        <HdrBtn
          activeRequest={activeRequest}
          openRequest={openRequest}
          t={t}
          type="resume"
          gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
          icon={<PlayCircle size={22} />}
          label="Resume Thali"
          desc="Restart your daily lunch or dinner thali delivery"
        />
        {activeRequest === 'resume' && (
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ marginBottom: 14 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSub, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Select Meal Option
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { id: 'lunch', label: 'Lunch Only' },
                  { id: 'dinner', label: 'Dinner Only' },
                  { id: 'both', label: 'Both Meals' }
                ].map(({ id, label }) => {
                  const sel = resumeMealType === id
                  return (
                    <button
                      key={id}
                      onClick={() => setResumeMealType(id)}
                      style={{
                        padding: '12px 8px',
                        borderRadius: 12,
                        border: `1.5px solid ${sel ? t.accent : t.border}`,
                        background: sel ? t.accentBg : t.inputBg,
                        color: sel ? t.accent : t.text,
                        fontWeight: sel ? 900 : 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif",
                        transition: 'all 0.2s'
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="resumeFrom" style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSub, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Resume Effective From Date
              </label>
              <input
                type="date"
                id="resumeFrom"
                name="resumeFrom"
                value={resumeFrom}
                min={today}
                onChange={e => setResumeFrom(e.target.value)}
                style={inp}
              />
            </div>

            {error && <ErrorBanner msg={error} />}

            <button
              onClick={() => handleSubmit('resume')}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 14,
                border: 'none',
                background: submitting ? t.border : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                fontWeight: 900,
                cursor: submitting ? 'wait' : 'pointer',
                fontSize: 14.5,
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: '0 6px 18px rgba(16,185,129,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <CheckCircle2 size={18} /> {submitting ? 'Submitting...' : 'Submit Resume Request'}
            </button>
          </div>
        )}
      </RCard>

      {/* Stop Thali Card */}
      <RCard activeRequest={activeRequest} type="stop" t={t}>
        <HdrBtn
          activeRequest={activeRequest}
          openRequest={openRequest}
          t={t}
          type="stop"
          gradient="linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
          icon={<PauseCircle size={22} />}
          label="Stop Thali"
          desc="Pause your thali service for specific days"
        />
        {activeRequest === 'stop' && (
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ marginBottom: 14 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSub, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Select Meal Option to Pause
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { id: 'lunch', label: 'Lunch Only' },
                  { id: 'dinner', label: 'Dinner Only' },
                  { id: 'both', label: 'Both Meals' }
                ].map(({ id, label }) => {
                  const sel = stopMealType === id
                  return (
                    <button
                      key={id}
                      onClick={() => setStopMealType(id)}
                      style={{
                        padding: '12px 8px',
                        borderRadius: 12,
                        border: `1.5px solid ${sel ? '#ef4444' : t.border}`,
                        background: sel ? 'rgba(239,68,68,0.12)' : t.inputBg,
                        color: sel ? '#ef4444' : t.text,
                        fontWeight: sel ? 900 : 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif",
                        transition: 'all 0.2s'
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSub, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Select Days to Pause (This Week)
              </label>
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
                        flex: '1 0 46px',
                        height: 60,
                        borderRadius: 14,
                        border: `1.5px solid ${isSel ? '#ef4444' : isToday ? t.accent : t.border}`,
                        background: isSel ? 'rgba(239,68,68,0.18)' : isToday ? t.accentBg : t.inputBg,
                        color: isSel ? '#ef4444' : isToday ? t.accent : (isPast ? 'rgba(255,255,255,0.3)' : t.text),
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 3,
                        fontFamily: "'DM Sans', sans-serif",
                        opacity: isPast ? 0.45 : 1
                      }}
                    >
                      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.04em' }}>{stopDayLabels[i]}</span>
                      <span style={{ fontSize: 15, fontWeight: 900 }}>{new Date(d + 'T00:00:00').getDate()}</span>
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize: 11.5, color: t.textSub, marginTop: 8, lineHeight: 1.5 }}>
                {stopDays.length > 0 ? (
                  <>
                    <strong style={{ color: '#ef4444' }}>Selected Pause:</strong>{' '}
                    {new Date(stopFrom + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {stopTo !== stopFrom && <> → {new Date(stopTo + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</>}
                  </>
                ) : (
                  'Select one or more days you want to pause your thali delivery.'
                )}
              </div>
            </div>

            {error && <ErrorBanner msg={error} />}

            <button
              onClick={() => handleSubmit('stop')}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 14,
                border: 'none',
                background: submitting ? t.border : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                color: '#fff',
                fontWeight: 900,
                cursor: submitting ? 'wait' : 'pointer',
                fontSize: 14.5,
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: '0 6px 18px rgba(239,68,68,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <PauseCircle size={18} /> {submitting ? 'Submitting...' : 'Submit Stop Request'}
            </button>
          </div>
        )}
      </RCard>

      {/* Miqaat Pirsu Card */}
      <RCard activeRequest={activeRequest} type="miqaat" t={t}>
        <HdrBtn
          activeRequest={activeRequest}
          openRequest={openRequest}
          t={t}
          type="miqaat"
          gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
          icon={<Sparkles size={22} />}
          label="Miqaat Pirsu"
          desc="Select your preferred Miqaat thaal arrangement"
        />
        {activeRequest === 'miqaat' && (
          <div style={{ padding: '0 20px 20px' }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSub, marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Choose Miqaat Option
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setMiqaatOption(n)}
                  style={{
                    height: 52,
                    borderRadius: 14,
                    border: `1.5px solid ${miqaatOption === n ? t.accent : t.border}`,
                    background: miqaatOption === n ? t.accentBg : t.inputBg,
                    color: miqaatOption === n ? t.accent : t.text,
                    fontWeight: 900,
                    fontSize: 20,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                    transition: 'all 0.2s'
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            {error && <ErrorBanner msg={error} />}

            <button
              onClick={() => handleSubmit('miqaat')}
              disabled={submitting || !miqaatOption}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 14,
                border: 'none',
                background: submitting ? t.border : t.accentGrad,
                color: '#000',
                fontWeight: 900,
                cursor: submitting || !miqaatOption ? 'not-allowed' : 'pointer',
                fontSize: 14.5,
                fontFamily: "'DM Sans', sans-serif",
                opacity: !miqaatOption ? 0.5 : 1,
                boxShadow: '0 6px 18px rgba(212,175,55,0.3)'
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Miqaat Selection'}
            </button>
          </div>
        )}
      </RCard>

      {/* Extra Food / Item Adjustments */}
      <RCard activeRequest={activeRequest} type="extra" t={t}>
        <HdrBtn
          activeRequest={activeRequest}
          openRequest={openRequest}
          t={t}
          type="extra"
          gradient="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
          icon={extraMode === 'deduction' ? <MinusCircle size={22} /> : <PlusCircle size={22} />}
          label="Food Quantity Adjustment"
          desc="Add extra portions or request ingredient deductions"
        />
        {activeRequest === 'extra' && (
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="extraMode" style={{ display: 'block', fontSize: 11, fontWeight: 800, color: t.textSub, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Adjustment Type
              </label>
              <select
                id="extraMode"
                name="extraMode"
                value={extraMode}
                onChange={e => setExtraMode(e.target.value)}
                style={{ ...inp, cursor: 'pointer', fontWeight: 700 }}
              >
                <option value="addition">➕ Addition — Add extra food / rotis</option>
                <option value="deduction">➖ Deduction — Reduce / remove items</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {extraItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    name={`extraItem${i}`}
                    value={item.name}
                    placeholder={extraMode === 'deduction' ? `e.g. Rice portion (Item ${i + 1})` : `e.g. Extra Roti, Dal (Item ${i + 1})`}
                    onChange={e => updateExtraItem(i, 'name', e.target.value)}
                    style={{ ...inp, flex: 1 }}
                  />
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {(extraMode === 'deduction' ? [0, 1, 2] : [1, 2, 3, 4]).map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => updateExtraItem(i, 'qty', n)}
                        style={{
                          width: 34,
                          height: 38,
                          borderRadius: 10,
                          border: `1.5px solid ${item.qty === n ? t.accent : t.border}`,
                          background: item.qty === n ? t.accentBg : t.inputBg,
                          color: item.qty === n ? t.accent : t.textSub,
                          fontWeight: 800,
                          fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {extraItems.length > 1 && (
                    <button
                      onClick={() => removeExtraItem(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#ef4444' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {extraItems.length < 6 && (
              <button
                onClick={addExtraItem}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: 12,
                  border: `1.5px dashed ${t.accent}`,
                  background: 'transparent',
                  color: t.accent,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <PlusCircle size={15} /> Add Another Item
              </button>
            )}

            {error && <ErrorBanner msg={error} />}

            <button
              onClick={() => handleSubmit('extra')}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 14,
                border: 'none',
                background: submitting ? t.border : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#fff',
                fontWeight: 900,
                cursor: submitting ? 'wait' : 'pointer',
                fontSize: 14.5,
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: '0 6px 18px rgba(59,130,246,0.3)'
              }}
            >
              {submitting ? 'Submitting…' : extraMode === 'deduction' ? 'Submit Deduction Request' : 'Submit Extra Food Request'}
            </button>
          </div>
        )}
      </RCard>

      <div style={{ marginTop: 28 }}>
        <SectionLabel>Recent Pending Requests</SectionLabel>
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
    const { data } = await supabase
      .from('thali_requests')
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

  const statusColor = s => s === 'pending' ? '#f59e0b' : s === 'approved' ? '#10b981' : '#ef4444'

  if (loading) return <Spinner />
  if (requests.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '24px 16px',
        borderRadius: 16,
        background: t.card,
        border: `1px solid ${t.border}`,
        color: t.textSub,
        fontSize: 13
      }}>
        No pending requests at the moment.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {requests.map(r => (
        <div
          key={r.id}
          style={{
            padding: '14px 18px',
            borderRadius: 16,
            background: t.card,
            border: `1px solid ${t.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
        >
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: t.text, fontFamily: "'DM Sans', sans-serif" }}>
              {r.request_type === 'resume' ? '▶️ Resume Thali' : r.request_type === 'stop' ? '⏸️ Stop Thali' : r.request_type === 'extra' ? '➕ Food Adjustment' : '🕌 Miqaat Pirsu'}
            </div>
            <div style={{ fontSize: 11.5, color: t.textSub, marginTop: 3 }}>
              {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div style={{
            fontSize: 11,
            fontWeight: 800,
            padding: '4px 12px',
            borderRadius: 999,
            background: `${statusColor(r.status)}20`,
            color: statusColor(r.status),
            border: `1px solid ${statusColor(r.status)}40`,
            textTransform: 'uppercase'
          }}>
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
      const { data } = await supabase
        .from('queries')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(20)

      setQueries(data || [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
    if (mediaFiles.length + files.length > 4) {
      setError('Max 4 media files allowed')
      return
    }
    setMediaFiles(prev => [
      ...prev,
      ...files.map(file => ({
        file,
        url: URL.createObjectURL(file),
        type: file.type.startsWith('image/') ? 'image' : 'video',
        name: file.name
      }))
    ])
    e.target.value = ''
  }

  const removeMedia = i => {
    setMediaFiles(prev => {
      URL.revokeObjectURL(prev[i].url)
      return prev.filter((_, idx) => idx !== i)
    })
  }

  const handleSubmit = async () => {
    if (!comment.trim() && !mediaFiles.length) return setError('Please enter a description or attach a photo')
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const uploadedUrls = []
      for (const item of mediaFiles) {
        const ext = item.file.name.split('.').pop()
        const path = `queries/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('query-media').upload(path, item.file)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('query-media').getPublicUrl(path)
          uploadedUrls.push({ type: item.type, name: item.file.name, path: urlData.publicUrl })
        }
      }

      const { error: dbErr } = await supabase.from('queries').insert([{
        user_id: user.id,
        subject: comment.substring(0, 50) + (comment.length > 50 ? '...' : ''),
        comment: comment.trim(),
        media: uploadedUrls,
        status: 'open'
      }])
      if (dbErr) throw dbErr

      try {
        let userName = 'A member'
        try {
          const { data: profile } = await supabase.from('user_stats').select('name, thali_number').eq('user_id', user.id).maybeSingle()
          if (profile?.name) userName = profile.name
          if (profile?.thali_number) userName += ` (#${profile.thali_number})`
        } catch { /* ignore */ }

        await supabase.functions.invoke('send-push', {
          body: {
            title: '📩 New Query from ' + userName,
            body: userName + ': "' + comment.substring(0, 80) + (comment.length > 80 ? '…"' : '"'),
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

      setSuccess('✅ Query submitted! Our admin team will respond shortly.')
      setComment('')
      setMediaFiles([])
      loadQueries()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const statusColor = s => s === 'open' ? '#f59e0b' : s === 'resolved' ? '#10b981' : '#38bdf8'

  return (
    <div>
      <Card style={{ marginBottom: 20, padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display', serif", display: 'flex', alignItems: 'center', gap: 8 }}>
            <HelpCircle size={18} color={t.accent} /> Submit an Inquiry
          </div>
          {helpline && (
            <a
              href={`https://wa.me/${helpline.replace(/[^\d]/g, '')}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                background: '#25D366',
                color: '#fff',
                fontSize: 11,
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(37,211,102,0.25)'
              }}
            >
              <MessageCircle size={13} /> WhatsApp Helpline
            </a>
          )}
        </div>

        <textarea
          name="query"
          value={comment}
          onChange={e => setComment(e.target.value)}
          style={{
            width: '100%',
            minHeight: 90,
            padding: 14,
            borderRadius: 14,
            boxSizing: 'border-box',
            background: t.inputBg,
            border: `1px solid ${t.inputBorder}`,
            color: t.text,
            fontSize: 14,
            resize: 'vertical',
            outline: 'none',
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: 12
          }}
          placeholder="Describe your inquiry, dietary question, or feedback..."
        />

        {mediaFiles.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            {mediaFiles.map((item, i) => (
              <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${t.border}`, flexShrink: 0 }}>
                {item.type === 'image' ? (
                  <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: t.inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎬</div>
                )}
                <button
                  onClick={() => removeMedia(i)}
                  style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.8)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, color: '#fff' }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />

        {mediaFiles.length < 4 && (
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: 12,
              border: `1.5px dashed ${t.accentBorder}`,
              background: t.accentBg,
              color: t.accent,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            <Camera size={15} /> Attach Photo / Evidence ({mediaFiles.length}/4)
          </button>
        )}

        {error && <ErrorBanner msg={error} />}
        {success && (
          <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', fontSize: 13.5, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
            {success}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 14,
            border: 'none',
            background: submitting ? t.border : t.accentGrad,
            color: '#000',
            fontWeight: 900,
            cursor: submitting ? 'wait' : 'pointer',
            fontSize: 14.5,
            fontFamily: "'DM Sans', sans-serif",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 6px 18px rgba(212,175,55,0.3)'
          }}
        >
          <Send size={16} /> {submitting ? 'Submitting...' : 'Send Inquiry to Admin'}
        </button>
      </Card>

      <SectionLabel>Active Queries & Inquiries</SectionLabel>
      {loading ? (
        <ListPageSkeleton count={3} />
      ) : queries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 36, color: t.textSub, fontSize: 13.5, fontFamily: "'DM Sans', sans-serif" }}>
          No active queries at this time.
        </div>
      ) : (
        queries.map(q => (
          <Card key={q.id} style={{ marginBottom: 12, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <div>
                <span style={{ display: 'block', fontSize: 11.5, color: t.textSub, marginBottom: 4 }}>
                  {new Date(q.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: `${statusColor(q.status)}20`, color: statusColor(q.status), border: `1px solid ${statusColor(q.status)}38` }}>
                  {q.status?.toUpperCase()}
                </span>
              </div>
            </div>
            {q.comment && (
              <p style={{ margin: '0 0 10px', fontSize: 14, color: t.text, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
                {q.comment}
              </p>
            )}
            {q.media && q.media.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {q.media.map((m, i) => m.path && m.type === 'image' && (
                  <img key={i} src={m.path} alt="" style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover' }} />
                ))}
              </div>
            )}
            {q.admin_reply && (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 13, color: t.accent, lineHeight: 1.5 }}>
                💬 <strong>Admin Reply:</strong> {q.admin_reply}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  )
}
