import React, { useState, useEffect, useCallback } from 'react'
import { ClipboardList, ChevronRight, Lock, CheckCircle2, Pencil } from 'lucide-react'
import { supabase } from '../../lib/firebaseClient'
import { useWeeklyMenu } from '../../common/useWeeklyMenu'
import { useAuth, useTheme } from '../../admin/context'
import { getSurveyTargetWeek } from '../../common/utils'
import { WeeklyMenuSkeleton } from '../../common/Skeleton'
import SurveyModal from '../../components/SurveyModal'
import { MealStatusPill } from './WeeklyMenuPage'
import { DAYS } from '../constants'
import { isSurveyOpen, canEditMeal, getSurveyWindowLabel } from '../survey'
import { fetchUserSurveyRow } from '../../lib/surveyRows'
import { getSlotDishes } from '../../hooks/useSurvey'

export default function SurveyPage({ appSettings = {} }) {
  const t = useTheme()
  const { user } = useAuth()
  const currentWeekId = getSurveyTargetWeek(appSettings)
  const weeklyMenu = useWeeklyMenu(currentWeekId)
  const [showSurvey, setShowSurvey] = useState(false)
  const [openDay, setOpenDay] = useState(null)
  const [openMeal, setOpenMeal] = useState(null)
  const [surveyData, setSurveyData] = useState(null)
  const [loading, setLoading] = useState(true)

  const surveyOpen = isSurveyOpen(appSettings, user.id)

  const loadSurvey = useCallback(async () => {
    setLoading(true)
    try {
      const { data: normal } = await fetchUserSurveyRow(user.id, currentWeekId)
      setSurveyData(normal || null)
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

  const isAnyMealEditable = DAYS.some(d =>
    canEditMeal(d, currentWeekId, 'lunch', appSettings) ||
    canEditMeal(d, currentWeekId, 'dinner', appSettings)
  )

  const daySummary = DAYS.map(day => {
    const dk = day.substring(0, 3).toLowerCase()
    const lunchVal = surveyData?.[`${dk}_l_status`]
    const dinnerVal = surveyData?.[`${dk}_d_status`]
    // Normalize to pill-compatible values: 'Applied' | 'Skipped' | 'pending'
    const toPill = (v) => v === 'Applied' || v === 'opted_in' ? 'Applied' : v === 'Skipped' || v === 'opted_out' ? 'Skipped' : 'pending'
    const lunchStatus = toPill(lunchVal)
    const dinnerStatus = toPill(dinnerVal)
    return { day, lunchStatus, dinnerStatus, lunchRaw: lunchVal, dinnerRaw: dinnerVal }
  })

  // Filled = any response (Applied or Skipped) counts as answered for completion/lock. Applied count kept for progress display if needed.
  const filledMeals = daySummary.reduce((sum, d) => sum + (d.lunchStatus !== 'pending' ? 1 : 0) + (d.dinnerStatus !== 'pending' ? 1 : 0), 0)
  const completedMeals = filledMeals
  const totalMeals = 12 // 6 days × 2 meals
  const progressPct = totalMeals > 0 ? Math.round((filledMeals / totalMeals) * 100) : 0

  const firstIncompleteIndex = daySummary.findIndex(d => d.lunchStatus === 'pending' || d.dinnerStatus === 'pending')

  const editable = surveyOpen || isAnyMealEditable
  const canOpenEditor = editable
  const isWeeklyComplete = completedMeals >= totalMeals
  const windowLabel = getSurveyWindowLabel(appSettings)
  const actionLabel = isWeeklyComplete ? 'Survey Completed' : completedMeals === 0 ? 'Start Weekly Survey' : 'Resume Survey'

  if (loading || !weeklyMenu) return <WeeklyMenuSkeleton />

  const statusLabel = surveyOpen ? 'Survey Live' : isAnyMealEditable ? 'Edit Window Live' : isWeeklyComplete ? 'Completed — Locked' : 'Survey Closed'
  const statusColor = surveyOpen ? t.successText : isAnyMealEditable ? '#FF9800' : isWeeklyComplete ? '#4CAF50' : t.textSub
  const statusMsg = surveyOpen
    ? `Survey is open • ${windowLabel} — new, partial resume & haven't filled can all submit.`
    : isWeeklyComplete
      ? 'Weekly survey completed. Main button is locked — use Edit below each day to tweak.'
      : `Survey is closed. Opens ${windowLabel}.`

  const renderMealDishes = (day, meal, status) => {
    if (!status || status !== 'Applied') return null
    const dk = day.substring(0, 3).toLowerCase()
    const mk = meal === 'lunch' ? 'l' : 'd'
    const menuDishes = (weeklyMenu[day] || {})[meal] || []
    const sourceData = surveyData
    const dishList = getSlotDishes(sourceData, day, meal, menuDishes)
    const dishes = dishList.length > 0
      ? dishList
      : Array.from({ length: 5 }, (_, i) => `Dish ${i + 1}`).filter((_, i) => {
        const val = sourceData?.[`${dk}_${mk}_dish_${i + 1}`]
        return val !== undefined && val !== null && val !== ''
      })
    if (!dishes || dishes.length === 0) return null

    const items = dishes.map((d, i) => {
      const val = sourceData?.[`${dk}_${mk}_dish_${i + 1}`]
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

  const mainClassName = 'flex flex-col items-start gap-4 p-6 max-w-[800px] mx-auto'

  return (
    <main className={mainClassName}>

      {/* Survey Card */}
      <div style={{
        position: 'relative',
        borderRadius: 20,
        padding: 'clamp(22px, 5vw, 28px)',
        background: t.card,
        border: `1px solid ${t.border}`,
        boxShadow: surveyOpen
          ? `0 8px 32px ${t.accent}12, 0 1px 3px rgba(0,0,0,0.15)`
          : '0 2px 12px rgba(0,0,0,0.1)',
        marginBottom: 20,
      }}>

        {/* Header */}
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
            background: surveyOpen ? 'rgba(76,175,80,0.08)' : 'transparent',
            border: `1px solid ${surveyOpen ? 'rgba(76,175,80,0.25)' : t.border}`,
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
            <span style={{ fontSize: 11, fontWeight: 800, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>{completedMeals} / {totalMeals} meals</span>
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

        {/* CTA — minimal, locks when weekly filled */}
        {isWeeklyComplete ? (
          <div style={{ width: '100%', padding: '12px 16px', borderRadius: 14, background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.25)', display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'DM Sans',sans-serif" }}>
            <div style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(76,175,80,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={14} color="#4CAF50" /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#4CAF50', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} /> {actionLabel} <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(76,175,80,0.15)', color: '#4CAF50', fontWeight: 900 }}>LOCKED</span></div>
              <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>Survey already filled. Edit individual days below (when window is open).</div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setOpenDay(null); setOpenMeal(null); setShowSurvey(true) }}
            disabled={!canOpenEditor}
            style={{
              width: '100%', padding: '13px 20px', borderRadius: 14,
              background: canOpenEditor ? t.accentGrad : t.inputBg,
              color: canOpenEditor ? '#fff' : t.textSub,
              fontSize: 13, fontWeight: 800, border: 'none',
              cursor: canOpenEditor ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: "'DM Sans',sans-serif",
              letterSpacing: '0.01em',
              opacity: canOpenEditor ? 1 : 0.6,
            }}
            onMouseDown={e => { if (canOpenEditor) e.currentTarget.style.transform = 'scale(0.98)' }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            {actionLabel}
            <ChevronRight size={15} style={{ marginLeft: 2 }} />
          </button>
        )}
        {!surveyOpen && !isWeeklyComplete && (
          <div style={{ marginTop: 8, fontSize: 11, color: t.textSub, fontFamily: "'DM Sans',sans-serif", textAlign: 'center' }}>Window: {windowLabel}</div>
        )}
      </div>

      {/* Week at a glance */}
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
              <div style={{ fontSize: 10, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginTop: 1 }}>
                Fill days in order — Mon to Sat
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 9, color: t.textSub, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50' }} /> Saved</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF9800' }} /> Partial</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: t.border }} /> Pending</span>
          </div>
        </div>

        {/* Day tabs — minimal, edit per-day is always below (main CTA locks when complete) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {daySummary.map(({ day, lunchStatus, dinnerStatus }, idx) => {
            const dk = day.substring(0, 3).toLowerCase()
            const [y, m, d] = currentWeekId.split('-').map(Number)
            const dayDate = new Date(y, m - 1, d + idx)
            const dateLabel = dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            const isFilled = (s) => s !== 'pending'
            const complete = isFilled(lunchStatus) && isFilled(dinnerStatus)
            const partial = isFilled(lunchStatus) || isFilled(dinnerStatus)
            const rowColor = complete ? '#4CAF50' : partial ? '#FF9800' : t.textSub
            const locked = !canOpenEditor && idx > firstIncompleteIndex
            const canEditThisDay = !locked

            return (
              <div
                key={day}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 14,
                  background: 'transparent',
                  border: `1px solid ${complete ? 'rgba(76,175,80,0.22)' : partial ? 'rgba(255,152,0,0.22)' : t.border}`,
                  borderLeft: `3px solid ${rowColor}`,
                  textAlign: 'left', fontFamily: "'DM Sans',sans-serif",
                  opacity: locked ? 0.55 : 1,
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: complete ? 'rgba(76,175,80,0.12)' : t.accentBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: complete ? '#4CAF50' : t.accent,
                  fontFamily: "'Playfair Display', serif",
                }}>
                  {day.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display',serif", textTransform: 'capitalize' }}>{day}</span>
                    <span style={{ fontSize: 10, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{dateLabel}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                    <MealStatusPill label="Lunch" status={lunchStatus} t={t} />
                    <MealStatusPill label="Dinner" status={dinnerStatus} t={t} />
                  </div>
                  {renderMealDishes(day, 'lunch', surveyData?.[`${dk}_l_status`])}
                  {renderMealDishes(day, 'dinner', surveyData?.[`${dk}_d_status`])}
                </div>

                {/* Per-day Edit — minimal, never scrolling the whole form */}
                {canEditThisDay ? (
                  <button
                    onClick={() => { setOpenDay(day); setOpenMeal(null); setShowSurvey(true) }}
                    style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                      padding: '7px 12px', borderRadius: 10,
                      background: complete ? 'rgba(76,175,80,0.10)' : t.accentBg,
                      border: `1px solid ${complete ? 'rgba(76,175,80,0.30)' : t.accentBorder}`,
                      color: complete ? '#4CAF50' : t.accent,
                      fontSize: 11, fontWeight: 800, cursor: 'pointer',
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                ) : (
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, color: t.textSub, fontSize: 10, fontWeight: 700 }}>
                    <Lock size={11} /> Locked
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Survey editor */}
      {showSurvey && (
        <SurveyModal
          onClose={() => { setShowSurvey(false); loadSurvey() }}
          appSettings={appSettings}
          initialDay={openDay}
          initialMeal={openMeal}
        />
      )}

    </main>
  )
}