import React, { useState, useEffect, useCallback } from 'react'
import { ClipboardList, ChevronRight, Lock, CheckCircle2, Pencil, Sparkles, ArrowUpRight, CalendarDays, Clock3, ShieldCheck, Timer } from 'lucide-react'
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
    const toPill = (v) => v === 'Applied' || v === 'opted_in' ? 'Applied' : v === 'Skipped' || v === 'opted_out' ? 'Skipped' : 'pending'
    const lunchStatus = toPill(lunchVal)
    const dinnerStatus = toPill(dinnerVal)
    return { day, lunchStatus, dinnerStatus, lunchRaw: lunchVal, dinnerRaw: dinnerVal }
  })

  const filledMeals = daySummary.reduce((sum, d) => sum + (d.lunchStatus !== 'pending' ? 1 : 0) + (d.dinnerStatus !== 'pending' ? 1 : 0), 0)
  const completedMeals = filledMeals
  const totalMeals = 12
  const progressPct = totalMeals > 0 ? Math.round((filledMeals / totalMeals) * 100) : 0

  const firstIncompleteIndex = daySummary.findIndex(d => d.lunchStatus === 'pending' || d.dinnerStatus === 'pending')

  const editable = surveyOpen || isAnyMealEditable
  const canOpenEditor = editable
  const isWeeklyComplete = completedMeals >= totalMeals
  const windowLabel = getSurveyWindowLabel(appSettings)
  const actionLabel = isWeeklyComplete ? 'Survey Completed' : completedMeals === 0 ? 'Start Weekly Survey' : 'Resume Survey'

  if (loading || !weeklyMenu) return <WeeklyMenuSkeleton />

  const statusLabel = surveyOpen ? 'Survey Live' : isAnyMealEditable ? 'Edit Window Live' : isWeeklyComplete ? 'Completed — Locked' : 'Survey Closed'
  const statusColor = surveyOpen ? '#10b981' : isAnyMealEditable ? '#FF9800' : isWeeklyComplete ? '#4CAF50' : t.textSub
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {items.map(({ dish, val }) => {
          const isRoti = ['roti', 'naan', 'paratha', 'bread', 'chapati', 'puri'].some(k => dish.toLowerCase().includes(k))
          const isYes = String(val).toLowerCase() === 'yes'
          const isNo = String(val).toLowerCase() === 'no'
          const isCount = !isRoti && !String(val).endsWith('%') && !isYes && !isNo
          const displayVal = isRoti ? (isYes ? 'YES' : 'NO') : isCount ? `${val} ppl` : val
          const color = isNo ? '#ef4444' : isYes ? '#10b981' : t.accent
          const bg = isNo ? 'rgba(239,68,68,0.08)' : isYes ? 'rgba(16,185,129,0.10)' : 'rgba(255,255,255,0.04)'
          const bd = isNo ? 'rgba(239,68,68,0.20)' : isYes ? 'rgba(16,185,129,0.22)' : t.border
          return (
            <span key={dish} style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.01em',
              padding: '4px 9px', borderRadius: 999,
              background: bg, color, border: `1px solid ${bd}`,
              fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif", display: 'inline-flex', alignItems: 'center', gap: 4,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
            }}>
              <span style={{ color: t.textSub, fontWeight: 600, opacity: 0.9 }}>{dish}:</span>
              <strong style={{ fontWeight: 800 }}>{displayVal}</strong>
            </span>
          )
        })}
      </div>
    )
  }

  const weekRangeLabel = (() => {
    try {
      const [y, m, d] = currentWeekId.split('-').map(Number)
      const start = new Date(y, m - 1, d)
      const end = new Date(y, m - 1, d + 5)
      const fmt = (dt) => dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      return `${fmt(start)} — ${fmt(end)} • ${currentWeekId}`
    } catch { return currentWeekId }
  })()

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '18px 16px 32px', position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=Geist:wght@400;500;600&display=swap');
        @keyframes shimmer { 0%{ transform: translateX(-100%) } 100%{ transform: translateX(200%) } }
        @keyframes pulseDot { 0%,100%{ transform: scale(1); opacity:1 } 50%{ transform: scale(1.25); opacity:0.85 } }
        @keyframes entry { from{ opacity:0; transform: translateY(10px) } to{ opacity:1; transform: translateY(0) } }
      `}</style>

      {/* ambient orbs */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 32 }}>
        <div style={{ position: 'absolute', top: -60, right: -40, width: 360, height: 360, background: `radial-gradient(circle at 30% 30%, ${t.accent}18, transparent 60%)`, filter: 'blur(18px)', opacity: 0.9 }} />
        <div style={{ position: 'absolute', top: 120, left: -80, width: 420, height: 420, background: 'radial-gradient(circle at 50% 50%, rgba(16,185,129,0.10), transparent 65%)', filter: 'blur(22px)', opacity: 0.7 }} />
      </div>

      {/* ── PREMIUM SURVEY HERO — Double Bezel ── */}
      <div style={{
        position: 'relative',
        padding: 6,
        borderRadius: 32,
        background: surveyOpen ? `linear-gradient(135deg, rgba(16,185,129,0.22), rgba(212,175,55,0.14))` : `linear-gradient(135deg, ${t.border} , transparent)`,
        border: `1px solid ${surveyOpen ? 'rgba(16,185,129,0.22)' : t.border}`,
        boxShadow: surveyOpen ? '0 30px 80px rgba(0,0,0,0.35), 0 10px 30px rgba(16,185,129,0.12)' : '0 16px 40px rgba(0,0,0,0.18)',
        animation: 'entry 0.6s cubic-bezier(0.32,0.72,0,1)',
        marginBottom: 18,
      }}>
        <div style={{
          borderRadius: 26,
          background: `linear-gradient(180deg, ${t.card} 0%, rgba(0,0,0,0.06) 100%), ${t.card}`,
          border: `1px solid ${t.border}`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.12)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* top hairline */}
          <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${t.accent}55, transparent)`, opacity: surveyOpen ? 1 : 0.55 }} />

          <div style={{ padding: '22px 22px 18px' }}>
            {/* eyebrow + status */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 220 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                  background: `linear-gradient(135deg, ${t.accentBg}, rgba(255,255,255,0.04))`,
                  border: `1px solid ${t.accentBorder}`,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 8px 18px rgba(0,0,0,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', inset: -1, background: `radial-gradient(180px 80px at 30% 20%, ${t.accent}22, transparent 60%)` }} />
                  <ClipboardList size={22} color={t.accent} strokeWidth={1.8} style={{ position: 'relative' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 9px', borderRadius: 999,
                      background: 'rgba(255,255,255,0.06)', border: `1px solid ${t.border}`,
                      fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.textSub,
                      fontFamily: "'Plus Jakarta Sans',sans-serif"
                    }}>
                      <Sparkles size={10} color={t.accent} /> Weekly Ritual
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, color: t.textSub, fontFamily: "'Plus Jakarta Sans',sans-serif", opacity: 0.85 }}>
                      <CalendarDays size={12} /> {weekRangeLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: t.text, fontFamily: "'Fraunces','Playfair Display',serif", lineHeight: 1.15, letterSpacing: '-0.02em', marginTop: 6 }}>
                    Weekly Food Survey
                  </div>
                  <div style={{ fontSize: 12.5, color: t.textSub, fontFamily: "'Plus Jakarta Sans',sans-serif", marginTop: 4, letterSpacing: '0.01em', maxWidth: 480, lineHeight: 1.5 }}>
                    Plan your meals for the coming week — curated menu, precise portions, zero waste.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', borderRadius: 999,
                  background: surveyOpen ? 'rgba(16,185,129,0.10)' : isWeeklyComplete ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${surveyOpen ? 'rgba(16,185,129,0.28)' : isWeeklyComplete ? 'rgba(16,185,129,0.22)' : t.border}`,
                  boxShadow: surveyOpen ? '0 6px 16px rgba(16,185,129,0.12)' : 'none',
                  backdropFilter: 'blur(8px)'
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, boxShadow: `0 0 0 6px ${statusColor}18`, animation: surveyOpen ? 'pulseDot 1.8s ease-in-out infinite' : 'none' }} />
                  <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', color: statusColor, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{statusLabel}</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.textSub, fontFamily: "'Plus Jakarta Sans',sans-serif", opacity: 0.9 }}>
                  <Clock3 size={12} /> {windowLabel}
                </span>
              </div>
            </div>

            <p style={{ margin: '14px 0 16px', fontSize: 12.5, color: t.textSub, lineHeight: 1.6, fontFamily: "'Plus Jakarta Sans',sans-serif", maxWidth: 640, opacity: 0.95 }}>
              {statusMsg}
            </p>

            {/* progress */}
            <div style={{ padding: 14, borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: `1px solid ${t.border}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.textSub, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                  <Timer size={12} color={t.accent} /> Weekly Progress
                  <span style={{ width: 1, height: 12, background: t.border, display: 'inline-block' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: t.textSub }}>{progressPct}%</span>
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 800, color: t.text, fontFamily: "'Geist','Plus Jakarta Sans',sans-serif",
                  padding: '4px 10px', borderRadius: 999, background: t.accentBg, border: `1px solid ${t.accentBorder}`
                }}>
                  {completedMeals} / {totalMeals} meals
                </span>
              </div>
              <div style={{ height: 10, borderRadius: 999, background: t.inputBg, border: `1px solid ${t.border}`, overflow: 'hidden', position: 'relative', padding: 2 }}>
                <div style={{
                  height: '100%', width: `${progressPct}%`, borderRadius: 999,
                  background: progressPct === 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : t.accentGrad,
                  boxShadow: progressPct > 0 ? `0 2px 12px ${t.accent}30` : 'none',
                  transition: 'width 0.9s cubic-bezier(0.32,0.72,0,1)', position: 'relative', overflow: 'hidden'
                }}>
                  <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)', transform: 'translateX(-100%)', animation: progressPct > 0 ? 'shimmer 1.6s ease-in-out infinite' : 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <span key={i} style={{
                    flex: 1, height: 4, borderRadius: 999,
                    background: i < completedMeals ? t.accent : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${i < completedMeals ? t.accentBorder : 'transparent'}`,
                    opacity: i < completedMeals ? 1 : 0.6, transition: 'all 0.5s ease'
                  }} />
                ))}
              </div>
            </div>

              <div style={{ marginTop: 16 }}>
                <button
                  onClick={() => { setOpenDay(null); setOpenMeal(null); setShowSurvey(true) }}
                  type="button"
                  className="group"
                  style={{
                    width: '100%', padding: '6px 6px 6px 18px', borderRadius: 999,
                    background: isWeeklyComplete ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.06))' : canOpenEditor ? t.accentGrad : t.inputBg,
                    color: isWeeklyComplete ? '#10b981' : canOpenEditor ? '#0a0a0a' : t.textSub,
                    fontSize: 14, fontWeight: 800,
                    border: `1px solid ${isWeeklyComplete ? 'rgba(16,185,129,0.3)' : canOpenEditor ? t.accentBorder : t.border}`,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    transition: 'transform 0.45s cubic-bezier(0.32,0.72,0,1), box-shadow 0.45s ease',
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                    letterSpacing: '0.01em',
                    boxShadow: canOpenEditor ? `0 10px 28px ${t.accent}28, inset 0 1px 0 rgba(255,255,255,0.22)` : 'none',
                  }}
                  onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.99)' }}
                  onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 999, background: isWeeklyComplete ? 'rgba(16,185,129,0.18)' : canOpenEditor ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${isWeeklyComplete ? 'rgba(16,185,129,0.25)' : canOpenEditor ? 'rgba(0,0,0,0.08)' : t.border}` }}>
                      {isWeeklyComplete ? <CheckCircle2 size={14} color="#10b981" /> : <ClipboardList size={14} color={canOpenEditor ? '#0a0a0a' : t.textSub} />}
                    </span>
                    {actionLabel}
                    <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, letterSpacing: '0.06em' }}>• {windowLabel}</span>
                  </span>
                  <span style={{
                    width: 44, height: 44, borderRadius: 999, flexShrink: 0,
                    background: isWeeklyComplete ? 'rgba(16,185,129,0.15)' : canOpenEditor ? '#0a0a0a' : 'rgba(255,255,255,0.06)',
                    color: isWeeklyComplete ? '#10b981' : canOpenEditor ? '#fff' : t.textSub,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${isWeeklyComplete ? 'rgba(16,185,129,0.25)' : canOpenEditor ? 'rgba(255,255,255,0.10)' : t.border}`,
                    transition: 'transform 0.45s cubic-bezier(0.32,0.72,0,1)'
                  }} className="group-hover:translate-x-[2px]">
                    <ArrowUpRight size={18} strokeWidth={2.2} />
                  </span>
                </button>
              </div>
          </div>
        </div>
      </div>

      {/* ── WEEK AT A GLANCE — Bento ── */}
      <div style={{
        borderRadius: 28, padding: 6,
        background: `linear-gradient(135deg, ${t.border}, transparent)`,
        border: `1px solid ${t.border}`,
        boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
        animation: 'entry 0.6s cubic-bezier(0.32,0.72,0,1) 0.08s both'
      }}>
        <div style={{
          borderRadius: 22, padding: 18,
          background: t.card, border: `1px solid ${t.border}`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: t.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.accentBorder}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}>
                <CalendarDays size={16} color={t.accent} strokeWidth={1.9} />
              </div>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: t.text, fontFamily: "'Fraunces','Playfair Display',serif", lineHeight: 1.1, letterSpacing: '-0.01em' }}>This Week's Meals</div>
                <div style={{ fontSize: 11, color: t.textSub, fontFamily: "'Plus Jakarta Sans',sans-serif", marginTop: 2, letterSpacing: '0.04em' }}>
                  Fill days in order — Mon to Sat • {weekRangeLabel}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 9.5, color: t.textSub, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)', color: '#10b981' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Saved</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.18)', color: '#FF9800' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF9800' }} /> Partial</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.border}` }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: t.border }} /> Pending</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {daySummary.map(({ day, lunchStatus, dinnerStatus }, idx) => {
              const dk = day.substring(0, 3).toLowerCase()
              const [y, m, d] = currentWeekId.split('-').map(Number)
              const dayDate = new Date(y, m - 1, d + idx)
              const dateLabel = dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              const isFilled = (s) => s !== 'pending'
              const complete = isFilled(lunchStatus) && isFilled(dinnerStatus)
              const partial = isFilled(lunchStatus) || isFilled(dinnerStatus)
              const rowAccent = complete ? '#10b981' : partial ? '#FF9800' : t.border
              // Card edit: editable if survey is open OR daily meal window is open for lunch/dinner
              const canEditLunch = canEditMeal(day, currentWeekId, 'lunch', appSettings)
              const canEditDinner = canEditMeal(day, currentWeekId, 'dinner', appSettings)
              const canEditThisDay = surveyOpen || canEditLunch || canEditDinner
              const locked = !canEditThisDay

              return (
                <div
                  key={day}
                  onClick={() => { setOpenDay(day); setOpenMeal(null); setShowSurvey(true) }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 14px', borderRadius: 18,
                    background: complete ? 'linear-gradient(135deg, rgba(16,185,129,0.06), transparent)' : partial ? 'linear-gradient(135deg, rgba(255,152,0,0.05), transparent)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${complete ? 'rgba(16,185,129,0.22)' : partial ? 'rgba(255,152,0,0.18)' : t.border}`,
                    borderLeft: `3px solid ${rowAccent}`,
                    textAlign: 'left', fontFamily: "'Plus Jakarta Sans',sans-serif",
                    cursor: 'pointer',
                    boxShadow: complete ? '0 6px 18px rgba(16,185,129,0.08), inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                    transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1), box-shadow 0.3s ease',
                    animation: `entry 0.5s cubic-bezier(0.32,0.72,0,1) ${0.06 * idx}s both`
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = complete ? '0 6px 18px rgba(16,185,129,0.08), inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.03)' }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: complete ? 'rgba(16,185,129,0.12)' : `linear-gradient(135deg, ${t.accentBg}, rgba(255,255,255,0.03))`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, color: complete ? '#10b981' : t.accent,
                    fontFamily: "'Fraunces',serif",
                    border: `1px solid ${complete ? 'rgba(16,185,129,0.22)' : t.accentBorder}`,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)'
                  }}>
                    {day.slice(0, 2).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: t.text, fontFamily: "'Fraunces',serif", textTransform: 'capitalize', letterSpacing: '-0.01em' }}>{day}</span>
                      <span style={{ fontSize: 10.5, color: t.textSub, fontFamily: "'Plus Jakarta Sans',sans-serif", padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.border}` }}>{dateLabel}</span>
                      {complete && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={10} /> Done</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <MealStatusPill label="Lunch" status={lunchStatus} t={t} />
                      <MealStatusPill label="Dinner" status={dinnerStatus} t={t} />
                    </div>
                    {renderMealDishes(day, 'lunch', surveyData?.[`${dk}_l_status`])}
                    {renderMealDishes(day, 'dinner', surveyData?.[`${dk}_d_status`])}
                  </div>

                  {canEditThisDay ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenDay(day); setOpenMeal(null); setShowSurvey(true) }}
                      className="group/btn"
                      style={{
                        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7,
                        padding: '9px 14px', borderRadius: 999,
                        background: complete ? 'rgba(16,185,129,0.10)' : t.accentBg,
                        border: `1px solid ${complete ? 'rgba(16,185,129,0.26)' : t.accentBorder}`,
                        color: complete ? '#10b981' : t.accent,
                        fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                        transition: 'transform 0.35s cubic-bezier(0.32,0.72,0,1), background 0.2s ease'
                      }}
                    >
                      <span style={{ width: 20, height: 20, borderRadius: 999, background: complete ? 'rgba(16,185,129,0.16)' : 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${complete ? 'rgba(16,185,129,0.22)' : 'rgba(0,0,0,0.06)'}` }}>
                        <Pencil size={11} />
                      </span>
                      {complete ? 'Edit' : 'Fill'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenDay(day); setOpenMeal(null); setShowSurvey(true) }}
                      style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, color: t.textSub, fontSize: 11, fontWeight: 700, padding: '8px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.border}`, cursor: 'pointer' }}
                    >
                      <Lock size={12} /> View
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

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
