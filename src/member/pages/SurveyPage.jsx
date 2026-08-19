import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { ClipboardList, ChevronRight, Sparkles, CheckCircle2, Clock } from 'lucide-react'
import { supabase } from '../../lib/firebaseClient'
import { useWeeklyMenu } from '../../common/useWeeklyMenu'
import { useAuth, useTheme } from '../../admin/context'
import { getSurveyTargetWeek } from '../../common/utils'
import { WeeklyMenuSkeleton } from '../../common/Skeleton'
import SurveyModal from '../../components/SurveyModal'
import { DAYS } from '../constants'
import { hasUserOverride, isSurveyOpen, canEditMeal, getSurveyWindowMessage } from '../survey'
import { MealStatusPill } from './WeeklyMenuPage'
import { fetchUserSurveyRow } from '../../lib/surveyRows'
import { getSlotDishes } from '../../hooks/useSurvey'

export default function SurveyPage({ appSettings = {} }) {
  const t = useTheme()
  const { user } = useAuth()
  const currentWeekId = getSurveyTargetWeek(parseInt(appSettings.survey_open_hour, 10) || 20, appSettings.survey_status === 'open')
  const weeklyMenu = useWeeklyMenu(currentWeekId)
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

  // Survey data now lives in survey_day_responses (merged flat shape);
  // survey_submissions_flat is legacy / historical fallback.
  const loadSurvey = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await fetchUserSurveyRow(user.id, currentWeekId)
      setSurveyData(data || null)
    } catch { setSurveyData(null) }
    setLoading(false)
  }, [user.id, currentWeekId])

  useEffect(() => { loadSurvey() }, [loadSurvey])

  useEffect(() => {
    const ch = supabase.channel('survey-tab-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_day_responses', filter: `user_id=eq.${user.id}` }, () => loadSurvey())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user.id, loadSurvey])

  // ── Override-aware expected slots ──
  // A member with admin-granted access (user_overrides) may only have specific
  // day/meal slots to fill. "All days" grants are the full Mon–Sat week; subset
  // grants must count ONLY the granted meals — otherwise the saved override
  // data would never register as submitted here, and un-granted days would
  // wrongly lock the granted ones.
  const grantedSlots = useMemo(() => {
    if (!hasOverride || !appSettings.user_overrides) return null
    try {
      const overrides = typeof appSettings.user_overrides === 'string'
        ? JSON.parse(appSettings.user_overrides)
        : appSettings.user_overrides
      const o = overrides[user.id]
      if (!o || o.all) return null
      const slots = []
      DAYS.forEach(day => {
        const dayOverride = o[day.toLowerCase()]
        if (dayOverride) {
          if (dayOverride.lunch) slots.push({ day, meal: 'lunch' })
          if (dayOverride.dinner) slots.push({ day, meal: 'dinner' })
        }
      })
      return slots.length ? slots : null
    } catch { return null }
  }, [hasOverride, appSettings.user_overrides, user.id])

  const expectedSlots = grantedSlots || DAYS.flatMap(day => [{ day, meal: 'lunch' }, { day, meal: 'dinner' }])
  const mealsForDay = (day) => {
    if (grantedSlots) return grantedSlots.filter(s => s.day === day).map(s => s.meal)
    return ['lunch', 'dinner']
  }

  const fullySubmitted = !!surveyData && expectedSlots.every(slot => {
    const dk = slot.day.substring(0, 3).toLowerCase()
    const mk = slot.meal === 'lunch' ? 'l' : 'd'
    return surveyData[`${dk}_${mk}_status`]
  })

  const daySummary = DAYS.map(day => {
    const dk = day.substring(0, 3).toLowerCase()
    const meals = mealsForDay(day)
    const statuses = meals.map(m => surveyData?.[`${dk}_${m === 'lunch' ? 'l' : 'd'}_status`])
    if (statuses.length === 0) return { day, status: 'pending' }
    if (statuses.every(Boolean)) return { day, status: 'complete' }
    if (statuses.some(Boolean)) return { day, status: 'partial' }
    return { day, status: 'pending' }
  })

  // Sequential chain (Mon → Sat): while the survey is being filled, day cards for
  // later days stay locked until every earlier day is complete — nobody can jump
  // straight to Tuesday. Once the whole week is submitted, all days unlock for editing.
  // For override users only GRANTED days count toward the chain, so a grant that
  // skips Monday never locks Friday.
  const firstIncompleteIndex = grantedSlots
    ? daySummary.findIndex(d => d.status !== 'complete' && mealsForDay(d.day).length > 0)
    : daySummary.findIndex(d => d.status !== 'complete')

  const editable = surveyOpen || isAnyMealEditable
  const canOpenEditor = editable || fullySubmitted
  const actionLabel = hasOverride
    ? 'Fill Override Survey'
    : !fullySubmitted && editable ? 'Start Weekly Survey' : !fullySubmitted ? 'View Responses' : 'Edit Responses'

  if (loading || !weeklyMenu) return <WeeklyMenuSkeleton />

  const completedDays = daySummary.filter(d => d.status === 'complete').length
  const totalDays = grantedSlots ? new Set(grantedSlots.map(s => s.day)).size : 6
  const progressPct = Math.round((completedDays / totalDays) * 100)
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
    ? 'The Al-Mawaid team has granted you special custom access. Your selections are synchronized directly with kitchen prep and tiffin packing.'
    : surveyOpen
      ? getSurveyWindowMessage(appSettings, user.id)
      : isAnyMealEditable
        ? 'Daily edit windows are live — lunch closes 11:00 AM, dinner closes 3:30 PM.'
        : fullySubmitted
          ? 'Your weekly plan is saved. Tap Edit Responses to tweak any day anytime.'
          : 'The weekly survey opens Saturday 8:00 PM. Come back then to plan your week.'

  // Helper to render dish breakdown pills under each meal
  const renderMealDishes = (day, meal, status) => {
    if (!status || status !== 'Applied') return null
    const dk = day.substring(0, 3).toLowerCase()
    const mk = meal === 'lunch' ? 'l' : 'd'
    const dayKey = day.toLowerCase()
    const menuDishes = (weeklyMenu[dayKey] || weeklyMenu[day])?.[meal] || []
    const dishList = getSlotDishes(surveyData, day, meal, menuDishes)
    const dishes = dishList.length > 0
      ? dishList
      : Array.from({ length: 14 }, (_, i) => `Dish ${i + 1}`).filter((_, i) => {
          const val = surveyData?.[`${dk}_${mk}_dish_${i + 1}`]
          return val !== undefined && val !== null && val !== ''
        })
    if (!dishes || dishes.length === 0) return null

    const items = dishes.map((d, i) => {
      const val = surveyData?.[`${dk}_${mk}_dish_${i + 1}`]
      if (val === undefined || val === null || val === '') return null
      return { dish: d, val }
    }).filter(Boolean)

    if (items.length === 0) return null

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
        {items.map(({ dish, val }) => {
          const isRoti = ['roti', 'naan', 'paratha', 'bread', 'chapati', 'puri'].some(k => dish.toLowerCase().includes(k))
          const isYes = String(val).toLowerCase() === 'yes'
          const isNo = String(val).toLowerCase() === 'no'
          const isCount = !isRoti && !String(val).endsWith('%') && !isYes && !isNo
          const displayVal = isRoti ? (isYes ? 'YES' : 'NO') : isCount ? `${val} ppl` : val
          const color = isNo ? '#ef4444' : isYes ? '#4CAF50' : t.accent
          const bg = isNo ? 'rgba(239,68,68,0.08)' : isYes ? 'rgba(76,175,80,0.12)' : t.accentBg
          const bd = isNo ? 'rgba(239,68,68,0.25)' : isYes ? 'rgba(76,175,80,0.3)' : t.accentBorder
          return (
            <span key={dish} style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 8px', borderRadius: 6,
              background: bg, color, border: `1px solid ${bd}`,
              fontFamily: "'DM Sans',sans-serif", display: 'inline-flex', alignItems: 'center', gap: 3
            }}>
              <span style={{ color: t.textSub, fontWeight: 600 }}>{dish}:</span>
              <strong>{displayVal}</strong>
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <main style={{ flex: 1, padding: '16px 16px calc(110px + env(safe-area-inset-bottom, 20px))', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

      {/* ══ SURVEY CARD ══ */}
      {hasOverride ? (
        /* ── LUXURY REDESIGNED OVERRIDE SURVEY CARD ── */
        <div style={{
          position: 'relative',
          borderRadius: 24,
          padding: 'clamp(22px, 5vw, 28px)',
          background: `linear-gradient(145deg, rgba(16, 185, 129, 0.14) 0%, ${t.card} 55%, rgba(212, 175, 55, 0.09) 100%)`,
          border: '1.5px solid rgba(16, 185, 129, 0.45)',
          boxShadow: '0 16px 40px rgba(16, 185, 129, 0.18), 0 4px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
          marginBottom: 22,
          overflow: 'hidden',
        }}>
          {/* Subtle decorative glow orbs */}
          <div style={{
            position: 'absolute', top: -40, right: -40, width: 160, height: 160,
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)',
            filter: 'blur(30px)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -30, left: -30, width: 130, height: 130,
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(212, 175, 55, 0.2) 0%, transparent 70%)',
            filter: 'blur(30px)', pointerEvents: 'none',
          }} />

          {/* Top Tag Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '6px 14px', borderRadius: 100,
              background: 'rgba(16, 185, 129, 0.18)',
              border: '1px solid rgba(16, 185, 129, 0.5)',
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.2)',
            }}>
              <Sparkles size={13} color="#10b981" />
              <span style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#10b981', fontFamily: "'DM Sans',sans-serif" }}>
                Admin Override Active
              </span>
            </div>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 10,
              background: fullySubmitted ? 'rgba(16,185,129,0.18)' : 'rgba(255,152,0,0.14)',
              border: `1px solid ${fullySubmitted ? 'rgba(16,185,129,0.45)' : 'rgba(255,152,0,0.4)'}`,
              fontSize: 11, fontWeight: 800, color: fullySubmitted ? '#10b981' : '#FF9800',
              fontFamily: "'DM Sans',sans-serif",
            }}>
              {fullySubmitted ? <CheckCircle2 size={13} color="#10b981" /> : <Clock size={13} color="#FF9800" />}
              {fullySubmitted ? 'All Granted Meals Saved' : `${completedDays} / ${totalDays} Days Completed`}
            </div>
          </div>

          {/* Card Title & Icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{
              width: 50, height: 50, borderRadius: 16, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(16,185,129,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid rgba(16,185,129,0.5)',
              boxShadow: '0 6px 20px rgba(16,185,129,0.25)',
            }}>
              <ClipboardList size={24} color="#10b981" strokeWidth={2.3} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display',serif", lineHeight: 1.15 }}>
                Override Food Survey
              </div>
              <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginTop: 3 }}>
                Admin-granted custom window · Select your preferences
              </div>
            </div>
          </div>

          <p style={{ margin: '0 0 16px', fontSize: 13, color: t.textSub, lineHeight: 1.55, fontFamily: "'DM Sans',sans-serif" }}>
            {statusMsg}
          </p>

          {/* Progress Bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>Granted Schedule Completion</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#10b981', fontFamily: "'DM Sans',sans-serif" }}>{progressPct}% Done</span>
            </div>
            <div style={{ height: 8, borderRadius: 100, background: t.inputBg, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)',
                borderRadius: 100,
                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 12px rgba(16,185,129,0.6)',
              }} />
            </div>
          </div>

          {/* Main Action Button */}
          <button
            onClick={() => { setOpenDay(null); setShowSurvey(true) }}
            style={{
              width: '100%', padding: '15px 22px', borderRadius: 14,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff', fontSize: 14, fontWeight: 900, border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 8px 24px rgba(16,185,129,0.35)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: "'DM Sans',sans-serif",
              letterSpacing: '0.01em',
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.985)' }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            🚀 {fullySubmitted ? 'Update Override Survey' : 'Fill Override Survey'}
            <ChevronRight size={17} />
          </button>
        </div>
      ) : (
        /* ── STANDARD WEEKLY SURVEY CARD ── */
        <div style={{
          position: 'relative',
          borderRadius: 20,
          padding: 'clamp(22px, 5vw, 28px)',
          background: t.card,
          border: `1px solid ${live ? t.accentBorder : t.border}`,
          borderLeft: `3px solid ${live ? t.accent : t.border}`,
          boxShadow: live
            ? `0 8px 32px ${t.accent}12, 0 1px 3px rgba(0,0,0,0.15)`
            : '0 2px 12px rgba(0,0,0,0.1)',
          marginBottom: 20,
        }}>
          {/* Header: icon + title + status */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                background: t.accentBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${t.accentBorder}`,
              }}>
                <ClipboardList size={20} color={t.accent} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display',serif", lineHeight: 1.2 }}>
                  Weekly Food Survey
                </div>
                <div style={{ fontSize: 11, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginTop: 2, letterSpacing: '0.02em' }}>
                  Plan your meals for the coming week
                </div>
              </div>
            </div>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 100,
              background: live ? 'rgba(76,175,80,0.08)' : 'transparent',
              border: `1px solid ${live ? 'rgba(76,175,80,0.25)' : t.border}`,
              flexShrink: 0,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: statusColor,
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: statusColor, fontFamily: "'DM Sans',sans-serif" }}>{statusLabel}</span>
            </div>
          </div>

          {/* Message */}
          <p style={{ margin: '0 0 16px', fontSize: 13, color: t.textSub, lineHeight: 1.55, fontFamily: "'DM Sans',sans-serif", maxWidth: 480 }}>
            {statusMsg}
          </p>

          {/* Progress bar */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>Weekly Progress</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>{completedDays} / {totalDays} days</span>
            </div>
            <div style={{ height: 6, borderRadius: 100, background: t.inputBg, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progressPct}%`,
                background: t.accentGrad,
                borderRadius: 100,
                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              }} />
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => { setOpenDay(null); setShowSurvey(true) }}
            style={{
              width: '100%', padding: '13px 20px', borderRadius: 14,
              background: canOpenEditor ? t.accentGrad : t.inputBg,
              color: canOpenEditor ? '#fff' : t.textSub,
              fontSize: 13, fontWeight: 800, border: 'none',
              cursor: canOpenEditor ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: "'DM Sans',sans-serif",
              letterSpacing: '0.01em',
            }}
            onMouseDown={e => { if (canOpenEditor) e.currentTarget.style.transform = 'scale(0.98)' }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            {fullySubmitted ? 'Edit Responses' : actionLabel}
            <ChevronRight size={15} style={{ marginLeft: 2 }} />
          </button>
        </div>
      )}

      {/* ══ GRANTED MEALS BREAKDOWN (Override Users) OR WEEK AT A GLANCE (Regular Users) ══ */}
      {hasOverride ? (
        /* ── OVERRIDE GRANTED MEALS LIST ── */
        <div style={{
          borderRadius: 20, padding: 18,
          background: t.card, border: '1px solid rgba(16, 185, 129, 0.25)',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16,185,129,0.3)' }}>
                <ClipboardList size={14} color="#10b981" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display',serif", lineHeight: 1.1 }}>
                  Your Granted Schedule & Saved Preferences
                </div>
                <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginTop: 1 }}>
                  Tap any day below to fill or update your preferences
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 9, color: t.textSub, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Saved</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF9800' }} /> Partial</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: t.border }} /> Pending</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {daySummary
              .filter(d => mealsForDay(d.day).length > 0)
              .map(({ day, status }, idx) => {
                const dk = day.substring(0, 3).toLowerCase()
                const lStatus = surveyData?.[`${dk}_l_status`]
                const dStatus = surveyData?.[`${dk}_d_status`]
                const dayMeals = mealsForDay(day)
                const [y, m, d] = currentWeekId.split('-').map(Number)
                const dayDate = new Date(y, m - 1, d + DAYS.indexOf(day))
                const dateLabel = dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                const complete = status === 'complete'
                const partial = status === 'partial'
                const rowColor = complete ? '#10b981' : partial ? '#FF9800' : t.textSub

                return (
                  <button
                    key={day}
                    onClick={() => { setOpenDay(day); setShowSurvey(true) }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '14px 16px', borderRadius: 16, cursor: 'pointer',
                      background: 'transparent',
                      border: `1px solid ${complete ? 'rgba(16,185,129,0.3)' : partial ? 'rgba(255,152,0,0.3)' : t.border}`,
                      borderLeft: `3px solid ${rowColor}`,
                      transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      textAlign: 'left', fontFamily: "'DM Sans',sans-serif",
                    }}
                    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.985)' }}
                    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: complete ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 800, color: '#10b981',
                      fontFamily: "'Playfair Display',serif", marginTop: 2
                    }}>
                      {day.charAt(0).toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14.5, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display',serif", textTransform: 'capitalize' }}>{day}</span>
                        <span style={{ fontSize: 10.5, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{dateLabel}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '2px 6px', borderRadius: 5 }}>
                          {dayMeals.length === 2 ? 'Both Meals' : dayMeals[0] === 'lunch' ? 'Lunch Only' : 'Dinner Only'}
                        </span>
                      </div>

                      {/* Meal Pills */}
                      <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                        {dayMeals.includes('lunch') && <MealStatusPill label="Lunch" status={lStatus} t={t} />}
                        {dayMeals.includes('dinner') && <MealStatusPill label="Dinner" status={dStatus} t={t} />}
                      </div>

                      {/* Saved Dish Breakdown */}
                      {dayMeals.includes('lunch') && renderMealDishes(day, 'lunch', lStatus)}
                      {dayMeals.includes('dinner') && renderMealDishes(day, 'dinner', dStatus)}
                    </div>

                    <ChevronRight size={16} style={{ flexShrink: 0, color: '#10b981', opacity: 0.8, marginTop: 12 }} />
                  </button>
                )
              })}
          </div>
        </div>
      ) : (
        /* ── REGULAR WEEK AT A GLANCE ── */
        <div style={{
          borderRadius: 20, padding: 18,
          background: t.card, border: `1px solid ${t.border}`,
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: t.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.accentBorder}` }}>
                <ClipboardList size={14} color={t.accent} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display',serif", lineHeight: 1.1 }}>This Week's Meals</div>
                <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginTop: 1 }}>{fullySubmitted ? 'Tap any day to edit a response' : 'Fill days in order — Mon to Sat'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 9, color: t.textSub, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50' }} /> Saved</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF9800' }} /> Partial</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: t.border }} /> Pending</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {daySummary.map(({ day, status }, idx) => {
              const dk = day.substring(0, 3).toLowerCase()
              const lStatus = surveyData?.[`${dk}_l_status`]
              const dStatus = surveyData?.[`${dk}_d_status`]
              const [y, m, d] = currentWeekId.split('-').map(Number)
              const dayDate = new Date(y, m - 1, d + idx)
              const dateLabel = dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              const complete = status === 'complete'
              const partial = status === 'partial'
              const rowColor = complete ? '#4CAF50' : partial ? '#FF9800' : t.textSub
              const locked = !fullySubmitted && idx > firstIncompleteIndex
              return (
                <button
                  key={day}
                  onClick={locked ? undefined : () => { setOpenDay(day); setShowSurvey(true) }}
                  disabled={locked}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 12px', borderRadius: 14, cursor: locked ? 'not-allowed' : 'pointer',
                    opacity: locked ? 0.45 : 1,
                    background: 'transparent',
                    border: `1px solid ${complete ? 'rgba(76,175,80,0.25)' : partial ? 'rgba(255,152,0,0.25)' : t.border}`,
                    borderLeft: `3px solid ${rowColor}`,
                    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left', fontFamily: "'DM Sans',sans-serif",
                  }}
                  onMouseDown={e => { if (!locked) e.currentTarget.style.transform = 'scale(0.985)' }}
                  onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  {/* Day letter */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    background: complete ? 'rgba(76,175,80,0.12)' : t.accentBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, color: complete ? '#4CAF50' : t.accent,
                    fontFamily: "'Playfair Display',serif",
                  }}>
                    {day.charAt(0).toUpperCase()}
                  </div>

                  {/* Day info + meal pills */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display',serif", textTransform: 'capitalize' }}>{day}</span>
                      <span style={{ fontSize: 10, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{dateLabel}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                      <MealStatusPill label="Lunch" status={lStatus} t={t} />
                      <MealStatusPill label="Dinner" status={dStatus} t={t} />
                    </div>

                    {/* Saved Dish Breakdown */}
                    {renderMealDishes(day, 'lunch', lStatus)}
                    {renderMealDishes(day, 'dinner', dStatus)}
                  </div>

                  {/* Affordance */}
                  {locked ? (
                    <div style={{ flexShrink: 0, color: t.textSub, fontSize: 9.5, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap' }}>
                      Locked
                    </div>
                  ) : (
                    <ChevronRight size={14} style={{ flexShrink: 0, color: t.accent, opacity: 0.7 }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Survey editor — centered pop-up modal (deep-links to the tapped day) */}
      {showSurvey && <SurveyModal onClose={() => { setShowSurvey(false); loadSurvey() }} appSettings={appSettings} initialDay={openDay} />}

    </main>
  )
}
