import React, { useState, useEffect, useCallback } from 'react'
import { ClipboardList, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/firebaseClient'
import { useWeeklyMenu } from '../../common/useWeeklyMenu'
import { useAuth, useTheme } from '../../admin/context'
import { getSurveyTargetWeek, getCalendarWeekDate } from '../../common/utils'
import { WeeklyMenuSkeleton } from '../../common/Skeleton'
import SurveyModal from '../../components/SurveyModal'
import { DAYS } from '../constants'
import { hasUserOverride, isSurveyOpen, canEditMeal, getSurveyWindowMessage } from '../survey'
import { MealStatusPill } from './WeeklyMenuPage'

export default function SurveyPage({ appSettings = {} }) {
  const t = useTheme()
  const { user } = useAuth()
  const weeklyMenu = useWeeklyMenu(getCalendarWeekDate())
  const currentWeekId = getSurveyTargetWeek(parseInt(appSettings.survey_open_hour, 10) || 20, appSettings.survey_status === 'open')
  // The survey editor opens as a centered pop-up modal (no page scrolling).
  const [showSurvey, setShowSurvey] = useState(false)
  // Day tapped on a week card — deep-links the modal straight to that day.
  const [openDay, setOpenDay] = useState(null)
  const [surveyData, setSurveyData] = useState(null)
  const [loading, setLoading] = useState(true)

  const surveyOpen = isSurveyOpen(appSettings, user.id)
  const hasOverride = hasUserOverride(appSettings, user.id)

  const isAnyMealEditable = DAYS.some(d =>
    canEditMeal(d, currentWeekId, 'lunch', appSettings, user.id) ||
    canEditMeal(d, currentWeekId, 'dinner', appSettings, user.id)
  )

  const loadSurvey = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('survey_submissions_flat')
        .select('*').eq('user_id', user.id).eq('week_id', currentWeekId).maybeSingle()
      setSurveyData(data || null)
    } catch { setSurveyData(null) }
    setLoading(false)
  }, [user.id, currentWeekId])

  useEffect(() => { loadSurvey() }, [loadSurvey])

  useEffect(() => {
    const ch = supabase.channel('survey-tab-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_submissions_flat', filter: `user_id=eq.${user.id}` }, () => loadSurvey())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user.id, loadSurvey])

  const fullySubmitted = !!surveyData && DAYS.every(day => {
    const dk = day.substring(0, 3).toLowerCase()
    return surveyData[`${dk}_l_status`] && surveyData[`${dk}_d_status`]
  })

  const daySummary = DAYS.map(day => {
    const dk = day.substring(0, 3).toLowerCase()
    const l = surveyData?.[`${dk}_l_status`]
    const d = surveyData?.[`${dk}_d_status`]
    if (l && d) return { day, status: 'complete' }
    if (l || d) return { day, status: 'partial' }
    return { day, status: 'pending' }
  })

  // Sequential chain (Mon → Sat): while the survey is being filled, day cards for
  // later days stay locked until every earlier day is complete — nobody can jump
  // straight to Tuesday. Once the whole week is submitted, all days unlock for editing.
  const firstIncompleteIndex = daySummary.findIndex(d => d.status !== 'complete')

  const editable = surveyOpen || isAnyMealEditable
  // After the full week is submitted, editing stays available — the modal lets
  // the user pick ANY day and re-save. So the button always opens the editor.
  const canOpenEditor = editable || fullySubmitted
  const actionLabel = hasOverride
    ? (fullySubmitted ? 'Re-select Weekly Survey' : 'Start Weekly Survey')
    : !fullySubmitted && editable ? 'Start Weekly Survey' : !fullySubmitted ? 'View Responses' : 'Edit Responses'

  if (loading || !weeklyMenu) return <WeeklyMenuSkeleton />

  const completedDays = daySummary.filter(d => d.status === 'complete').length
  const progressPct = Math.round((completedDays / 6) * 100)
  const live = canOpenEditor
  const statusLabel = hasOverride
    ? 'Admin Override Active'
    : surveyOpen
      ? 'Survey Live'
      : isAnyMealEditable
        ? 'Edit Window Live'
        : fullySubmitted
          ? 'Responses Saved'
          : 'Survey Closed'
  const statusColor = (hasOverride || surveyOpen)
    ? t.successText
    : isAnyMealEditable
      ? '#FF9800'
      : fullySubmitted
        ? '#4CAF50'
        : t.textSub
  const statusMsg = hasOverride
    ? 'The Al-Mawaid team has granted you access. Your preferences will be recorded.'
    : surveyOpen
      ? getSurveyWindowMessage(appSettings, user.id)
      : isAnyMealEditable
        ? 'Daily edit windows are live — lunch closes 11:00 AM, dinner closes 3:30 PM.'
        : fullySubmitted
          ? 'Your weekly plan is saved. Tap Edit Responses to tweak any day anytime.'
          : 'The weekly survey opens Saturday 8:00 PM. Come back then to plan your week.'

  return (
    <main style={{ flex: 1, padding: '16px 16px calc(110px + env(safe-area-inset-bottom, 20px))', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

      {/* ══ PREMIUM SURVEY BOX ══ */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: '30px 52px 30px 52px',
        padding: 'clamp(22px, 5vw, 30px)',
        background: `linear-gradient(160deg, ${t.accentBg} 0%, ${t.card} 58%)`,
        border: `1.5px solid ${live ? t.accentBorder : t.border}`,
        boxShadow: live
          ? `0 26px 60px ${t.accent}22, 0 4px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.09)`
          : '0 20px 50px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
        backdropFilter: 'blur(30px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(30px) saturate(1.8)',
        marginBottom: 20,
      }}>
        {/* Ambient gold glows */}
        <div style={{ position: 'absolute', top: -70, right: -60, width: 210, height: 210, background: t.accentGrad, borderRadius: '50%', filter: 'blur(80px)', opacity: 0.16, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -50, width: 190, height: 190, background: t.accent, borderRadius: '50%', filter: 'blur(95px)', opacity: 0.08, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '46%', background: 'linear-gradient(180deg, rgba(255,255,255,0.08), transparent)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Top row: gold medallion + status pill */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 18, flexShrink: 0,
                background: t.accentGrad,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 14px 30px ${t.accentBg}, inset 0 1px 0 rgba(255,255,255,0.4)`,
              }}>
                <ClipboardList size={26} color="#000" strokeWidth={2.2} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.accent, fontFamily: "'DM Sans',sans-serif", marginBottom: 3 }}>
                  Weekly Food Survey
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display',serif", lineHeight: 1.15 }}>
                  Plan your week
                </div>
              </div>
            </div>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 14px', borderRadius: 100,
              background: live ? 'rgba(76,175,80,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${live ? 'rgba(76,175,80,0.35)' : t.border}`,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: statusColor,
                boxShadow: live ? `0 0 10px ${statusColor}` : 'none',
                animation: live ? 'pulse 2s infinite' : undefined,
              }} />
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: statusColor, fontFamily: "'DM Sans',sans-serif" }}>{statusLabel}</span>
            </div>
          </div>

          {/* Message */}
          <p style={{ margin: '0 0 20px', fontSize: 13, color: t.textSub, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif", maxWidth: 470 }}>
            {statusMsg}
          </p>

          {/* Progress bar */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>Weekly Progress</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>{completedDays} / 6 days · {progressPct}%</span>
            </div>
            <div style={{ height: 9, borderRadius: 100, background: t.inputBg, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progressPct}%`,
                background: t.accentGrad,
                borderRadius: 100,
                transition: 'width 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: `0 0 14px ${t.accent}80`,
              }} />
            </div>
          </div>

          {/* CTA — pops the survey modal up */}
          <button
            onClick={() => { setOpenDay(null); setShowSurvey(true) }}
            style={{
              width: '100%', padding: '15px 20px', borderRadius: 16,
              background: canOpenEditor ? t.accentGrad : 'rgba(255,255,255,0.06)',
              color: canOpenEditor ? '#000' : t.textSub,
              fontSize: 14, fontWeight: 900, border: 'none',
              cursor: canOpenEditor ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: canOpenEditor ? `0 12px 30px ${t.accentBg}, inset 0 1px 0 rgba(255,255,255,0.3)` : 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: "'DM Sans',sans-serif",
              letterSpacing: '0.02em',
            }}
            onMouseEnter={e => { if (canOpenEditor) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 16px 38px ${t.accentBg}, inset 0 1px 0 rgba(255,255,255,0.3)` } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = canOpenEditor ? `0 12px 30px ${t.accentBg}, inset 0 1px 0 rgba(255,255,255,0.3)` : 'none' }}
          >
            <ClipboardList size={17} />
            {hasOverride
              ? (fullySubmitted ? 'Re-select Weekly Survey' : 'Start Weekly Survey')
              : (fullySubmitted ? 'Edit Responses' : actionLabel)}
            <ChevronRight size={16} style={{ marginLeft: 2 }} />
          </button>
        </div>
      </div>

      {/* ══ WEEK AT A GLANCE — full week-name day cards ══ */}
      <div style={{
        borderRadius: 26, padding: 20,
        background: t.card, border: `1px solid ${t.border}`,
        backdropFilter: 'blur(30px) saturate(2.5)',
        WebkitBackdropFilter: 'blur(30px) saturate(2.5)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: t.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.accentBorder}` }}>
              <ClipboardList size={16} color={t.accent} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display',serif", lineHeight: 1.1 }}>This Week's Meals</div>
              <div style={{ fontSize: 10.5, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginTop: 2 }}>{fullySubmitted ? 'Tap any day card to edit a response' : 'Fill days in order — Mon to Sat'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 9.5, color: t.textSub, fontFamily: "'DM Sans',sans-serif", fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4CAF50' }} /> Applied</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F44336' }} /> Skipped</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: t.borderActive }} /> Pending</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {daySummary.map(({ day, status }, idx) => {
            const dk = day.substring(0, 3).toLowerCase()
            const lStatus = surveyData?.[`${dk}_l_status`]
            const dStatus = surveyData?.[`${dk}_d_status`]
            const [y, m, d] = currentWeekId.split('-').map(Number)
            const dayDate = new Date(y, m - 1, d + idx)
            const dateLabel = dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            const complete = status === 'complete'
            const partial = status === 'partial'
            const statusColor = complete ? '#4CAF50' : partial ? '#FF9800' : t.textSub
            const statusIcon = complete ? '✓✓' : partial ? '◐' : '○'
            const statusText = complete ? 'Both meals saved' : partial ? 'Partially filled' : 'Not filled yet'
            // While filling, only days up to the first incomplete one are reachable
            const locked = !fullySubmitted && idx > firstIncompleteIndex
            return (
              <button
                key={day}
                onClick={locked ? undefined : () => { setOpenDay(day); setShowSurvey(true) }}
                disabled={locked}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 14px', borderRadius: 18, cursor: locked ? 'not-allowed' : 'pointer',
                  opacity: locked ? 0.55 : 1,
                  background: complete
                    ? 'linear-gradient(145deg, rgba(76,175,80,0.1), rgba(76,175,80,0.02))'
                    : partial
                      ? 'linear-gradient(145deg, rgba(255,152,0,0.1), rgba(255,152,0,0.02))'
                      : t.card,
                  border: `1.5px solid ${complete ? 'rgba(76,175,80,0.32)' : partial ? 'rgba(255,152,0,0.32)' : t.border}`,
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  textAlign: 'left', fontFamily: "'DM Sans',sans-serif",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 10px 24px ${statusColor}22` }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {/* Day medallion */}
                <div style={{
                  width: 46, height: 46, borderRadius: 15, flexShrink: 0,
                  background: complete ? 'linear-gradient(135deg, #4CAF50, #2E7D32)' : t.accentGrad,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 19, fontWeight: 800, color: '#fff',
                  fontFamily: "'Playfair Display',serif",
                  boxShadow: complete ? '0 8px 20px rgba(76,175,80,0.35)' : `0 8px 20px ${t.accentBg}`,
                }}>
                  {day.charAt(0).toUpperCase()}
                </div>

                {/* Day name + status + meal pills */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display',serif", textTransform: 'capitalize' }}>{day}</span>
                    <span style={{ fontSize: 10.5, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{dateLabel}</span>
                  </div>
                  <div style={{ fontSize: 11, color: statusColor, fontWeight: 800, marginTop: 3, fontFamily: "'DM Sans',sans-serif" }}>
                    {statusIcon} {statusText}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <MealStatusPill label="Lunch" status={lStatus} t={t} />
                    <MealStatusPill label="Dinner" status={dStatus} t={t} />
                  </div>
                </div>

                {/* Edit affordance (or lock for chain-gated days) */}
                {locked ? (
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, color: t.textSub, fontSize: 10.5, fontWeight: 800, fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap' }}>
                    🔒 Fill earlier days
                  </div>
                ) : (
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, color: t.accent, fontSize: 11.5, fontWeight: 900, fontFamily: "'DM Sans',sans-serif" }}>
                    Edit <ChevronRight size={15} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Survey editor — centered pop-up modal (deep-links to the tapped day) */}
      {showSurvey && <SurveyModal onClose={() => { setShowSurvey(false); loadSurvey() }} appSettings={appSettings} initialDay={openDay} />}

    </main>
  )
}
