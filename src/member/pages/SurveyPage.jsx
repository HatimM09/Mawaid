import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ClipboardList, Lock, CheckCircle2, Pencil, ArrowRight,
  Calendar, Clock3, Sun, Moon, AlertCircle, RefreshCw
} from 'lucide-react'
import { supabase } from '../../lib/firebaseClient'
import { useWeeklyMenu } from '../../common/useWeeklyMenu'
import { useAuth, useTheme } from '../../admin/context'
import {
  getSurveyTargetWeek, getSurveyTargetWeeks,
  formatWeekRange
} from '../../common/utils'
import { WeeklyMenuSkeleton } from '../../common/Skeleton'
import SurveyModal from '../../components/SurveyModal'
import { DAYS } from '../constants'
import { isSurveyOpen, canEditMeal, getSurveyWindowLabel } from '../survey'
import { fetchUserSurveyRows } from '../../lib/surveyRows'
import { getDishSnapshot } from '../../hooks/useSurvey'

export default function SurveyPage({ appSettings = {} }) {
  const t = useTheme()
  const { user } = useAuth()
  const weekIds = useMemo(() => getSurveyTargetWeeks(appSettings), [appSettings])
  const primaryWeekId = weekIds[0] || getSurveyTargetWeek(appSettings)
  const weeklyMenu = useWeeklyMenu(primaryWeekId)

  const activeWeekId = primaryWeekId

  const [showSurvey, setShowSurvey] = useState(false)
  const [openDay, setOpenDay] = useState(null)
  const [openMeal, setOpenMeal] = useState(null)
  const [surveyMap, setSurveyMap] = useState({}) // weekId -> flat row
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const initialLoadDone = useRef(false)

  const activeUserId = user?.id || user?.user_id
  const surveyOpen = isSurveyOpen(appSettings, activeUserId)
  const totalMeals = 12

  const loadSurvey = useCallback(async () => {
    if (!activeUserId) return
    const isFirst = !initialLoadDone.current
    if (isFirst) setLoading(true)
    else setIsSyncing(true)
    try {
      const { data: map } = await fetchUserSurveyRows(activeUserId, [primaryWeekId])
      setSurveyMap(map || {})
      initialLoadDone.current = true
    } catch {
      setSurveyMap({})
    }
    setLoading(false)
    setIsSyncing(false)
  }, [activeUserId, primaryWeekId])

  const silentRefresh = useCallback(async () => {
    if (!activeUserId) return
    setIsSyncing(true)
    try {
      const { data: map } = await fetchUserSurveyRows(activeUserId, [primaryWeekId])
      if (map) setSurveyMap(map)
    } catch {}
    setIsSyncing(false)
  }, [activeUserId, primaryWeekId])

  useEffect(() => { loadSurvey() }, [loadSurvey])

  // Realtime updates
  useEffect(() => {
    if (!activeUserId) return
    let debounce = null
    const ch = supabase.channel(`survey-page-realtime-${activeUserId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'survey_day_responses',
        filter: `user_id=eq.${activeUserId}`
      }, () => {
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(() => silentRefresh(), 250)
      })
      .subscribe()
    return () => {
      if (debounce) clearTimeout(debounce)
      supabase.removeChannel(ch)
    }
  }, [activeUserId, silentRefresh])

  const isAnyMealEditable = useMemo(() => (
    DAYS.some(d =>
      canEditMeal(d, primaryWeekId, 'lunch', appSettings) || canEditMeal(d, primaryWeekId, 'dinner', appSettings)
    )
  ), [primaryWeekId, appSettings])

  const toPill = (v) => (
    v === 'Applied' || v === 'opted_in' ? 'Applied' :
    v === 'Skipped' || v === 'opted_out' ? 'Skipped' : 'pending'
  )

  const globalFilled = useMemo(() => {
    const row = surveyMap[primaryWeekId]
    if (!row) return 0
    let c = 0
    DAYS.forEach(d => {
      const dk = d.substring(0, 3).toLowerCase()
      if (row[`${dk}_l_status`]) c++
      if (row[`${dk}_d_status`]) c++
    })
    return Math.min(12, c)
  }, [surveyMap, primaryWeekId])

  const isWeeklyComplete = globalFilled >= 12
  const isWindowEditable = surveyOpen && isWeeklyComplete
  const progressPct = Math.min(100, Math.round(globalFilled / 12 * 100))

  const editable = surveyOpen || isAnyMealEditable
  const canOpenEditor = editable || isWindowEditable
  const windowLabel = getSurveyWindowLabel(appSettings)

  const actionLabel = isWindowEditable
    ? 'Edit Survey Responses'
    : isWeeklyComplete
      ? 'Survey Submitted & Confirmed'
      : globalFilled === 0
        ? 'Start Weekly Survey (12 Meals)'
        : `Resume Survey (${12 - globalFilled} remaining)`

  if (loading && !initialLoadDone.current) return <WeeklyMenuSkeleton />
  if (!weeklyMenu) return <WeeklyMenuSkeleton />

  // Status Chip Details
  const statusMeta = (() => {
    if (isWindowEditable) {
      return {
        label: 'Submitted · Editable',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.3)',
      }
    }
    if (isWeeklyComplete) {
      return {
        label: 'Confirmed & Locked',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.3)',
      }
    }
    if (surveyOpen) {
      return {
        label: 'Survey Open',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.3)',
      }
    }
    if (isAnyMealEditable) {
      return {
        label: 'Edit Window Active',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.3)',
      }
    }
    return {
      label: 'Survey Closed',
      color: t.textSub,
      bg: t.inputBg,
      border: t.border,
    }
  })()

  // Status explanatory description
  const statusDescription = (() => {
    if (isWindowEditable) {
      return `Your preferences are recorded. The survey window remains open until ${windowLabel} — tap below to make any adjustments.`
    }
    if (isWeeklyComplete) {
      return `All ${totalMeals} meal selections are submitted and confirmed. Your thali will be prepared according to your choices.`
    }
    if (surveyOpen) {
      return `The weekly survey is live until ${windowLabel}. Please choose your meals for each day below.`
    }
    return `The survey window is currently closed. Scheduled to open ${windowLabel}.`
  })()

  // Helper to extract dish responses for a given day and meal
  const getDishItems = (weekId, day, meal) => {
    const flat = surveyMap[weekId]
    const dk = day.substring(0, 3).toLowerCase()
    const mk = meal === 'lunch' ? 'l' : 'd'
    const srcStatus = flat?.[`${dk}_${mk}_status`]
    if (!srcStatus || srcStatus !== 'Applied') return []

    const menuDishes = (() => {
      if (weeklyMenu.__byWeek) {
        return (weeklyMenu.__byWeek[weekId]?.[day] || weeklyMenu.__byWeek[weekId]?.[dk] || {})[meal] || []
      }
      return (weeklyMenu[day] || {})[meal] || []
    })()

    const cleanMenu = Array.isArray(menuDishes) ? menuDishes.filter(Boolean) : []
    const snapshotList = getDishSnapshot(flat, day, meal) || []
    const cleanSnapshot = Array.isArray(snapshotList) ? snapshotList.filter(Boolean) : []
    const dishes = cleanMenu.length > 0
      ? cleanMenu
      : cleanSnapshot.length > 0
        ? cleanSnapshot
        : Array.from({ length: 5 }, (_, i) => `Dish ${i + 1}`).filter((_, i) => flat?.[`${dk}_${mk}_dish_${i + 1}`])

    return dishes.map((d, i) => {
      let pos = i
      if (cleanSnapshot.length > 0 && cleanSnapshot.includes(d)) {
        pos = cleanSnapshot.indexOf(d)
      }
      const val = flat?.[`${dk}_${mk}_dish_${pos + 1}`]
      if (val === undefined || val === null || val === '') return null
      return { dish: d, val }
    }).filter(Boolean)
  }

  // Active week summary data
  const activeFlat = surveyMap[activeWeekId] || null
  const activeDaySummary = DAYS.map(day => {
    const dk = day.substring(0, 3).toLowerCase()
    const lunchStatus = toPill(activeFlat?.[`${dk}_l_status`])
    const dinnerStatus = toPill(activeFlat?.[`${dk}_d_status`])
    return { day, lunchStatus, dinnerStatus }
  })

  return (
    <main style={{
      maxWidth: 680,
      margin: '0 auto',
      padding: '16px 16px calc(110px + env(safe-area-inset-bottom, 20px))',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Header & Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.accent }}>
            Al-Mawaid Food Service
          </div>
          <h1 style={{ margin: '3px 0 0', fontSize: 22, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display', serif" }}>
            Weekly Survey
          </h1>
        </div>
        {isSyncing && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: t.accentBg,
            border: `1px solid ${t.accentBorder}`,
            fontSize: 11,
            fontWeight: 700,
            color: t.accent
          }}>
            <RefreshCw size={11} className="spin" /> Syncing
          </div>
        )}
      </div>

      {/* Minimal Status & Progress Card */}
      <div style={{
        padding: '18px',
        borderRadius: 20,
        background: t.card,
        border: `1px solid ${t.border}`,
        marginBottom: 18,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        {/* Status badges row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 11px',
            borderRadius: 999,
            background: statusMeta.bg,
            border: `1px solid ${statusMeta.border}`,
            color: statusMeta.color,
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusMeta.color }} />
            {statusMeta.label}
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: t.textSub, fontWeight: 600 }}>
            <Clock3 size={13} color={t.accent} />
            <span>{windowLabel}</span>
          </div>
        </div>

        {/* Informative text */}
        <p style={{ margin: '0 0 14px', fontSize: 13, color: t.textSub, lineHeight: 1.55 }}>
          {statusDescription}
        </p>

        {/* Progress Bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: t.textSub }}>
              Progress
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>
              {globalFilled} of {totalMeals} meals ({progressPct}%)
            </span>
          </div>
          <div style={{
            height: 7,
            borderRadius: 999,
            background: t.inputBg,
            border: `1px solid ${t.border}`,
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${progressPct}%`,
              borderRadius: 999,
              background: progressPct === 100 ? '#10b981' : t.accentGrad,
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={() => {
            if (canOpenEditor) {
              setOpenDay(null)
              setOpenMeal(null)
              setShowSurvey(true)
            }
          }}
          disabled={!canOpenEditor}
          style={{
            width: '100%',
            padding: '13px 18px',
            borderRadius: 14,
            border: 'none',
            background: isWeeklyComplete && !isWindowEditable
              ? t.inputBg
              : t.accentGrad,
            color: isWeeklyComplete && !isWindowEditable
              ? '#10b981'
              : '#0a0a0a',
            fontSize: 14,
            fontWeight: 800,
            cursor: canOpenEditor ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: canOpenEditor && (!isWeeklyComplete || isWindowEditable)
              ? `0 4px 16px ${t.accent}30`
              : 'none',
            opacity: !canOpenEditor && !isWeeklyComplete ? 0.6 : 1
          }}
        >
          {isWindowEditable ? (
            <>
              <Pencil size={16} />
              <span>{actionLabel}</span>
            </>
          ) : isWeeklyComplete ? (
            <>
              <CheckCircle2 size={16} color="#10b981" />
              <span>{actionLabel}</span>
            </>
          ) : (
            <>
              <span>{actionLabel}</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>

      {/* Week Day Breakdown Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        padding: '0 4px'
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>
          Daily Schedule (12 Meals)
        </div>
        <div style={{ fontSize: 11.5, color: t.textSub, fontWeight: 600 }}>
          {formatWeekRange(activeWeekId)}
        </div>
      </div>

      {/* Day-by-Day Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activeDaySummary.map(({ day, lunchStatus, dinnerStatus }, idx) => {
          const [y, m, d] = activeWeekId.split('-').map(Number)
          const dayDate = new Date(y, m - 1, d + idx)
          const dateLabel = dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

          const canEditThisDay = isWindowEditable
            ? true
            : isWeeklyComplete
              ? (canEditMeal(day, activeWeekId, 'lunch', appSettings) || canEditMeal(day, activeWeekId, 'dinner', appSettings))
              : canOpenEditor

          const lunchDishes = getDishItems(activeWeekId, day, 'lunch')
          const dinnerDishes = getDishItems(activeWeekId, day, 'dinner')

          return (
            <div
              key={day}
              style={{
                padding: '14px 16px',
                borderRadius: 16,
                background: t.card,
                border: `1px solid ${t.border}`,
                transition: 'border-color 0.2s'
              }}
            >
              {/* Day Header Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: t.accentBg,
                    border: `1px solid ${t.accentBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 900,
                    color: t.accent
                  }}>
                    {day.slice(0, 2).toUpperCase()}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, textTransform: 'capitalize', color: t.text, fontFamily: "'DM Sans', sans-serif" }}>
                    {weeklyMenu?.[day]?.en || day}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: t.textSub, background: t.inputBg, border: `1px solid ${t.border}`, padding: '2px 8px', borderRadius: 999 }}>
                    {dateLabel}
                  </span>
                </div>

                {canEditThisDay ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenDay(day)
                      setOpenMeal(null)
                      setShowSurvey(true)
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 8,
                      border: `1px solid ${t.accentBorder}`,
                      background: t.accentBg,
                      color: t.accent,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif"
                    }}
                  >
                    <Pencil size={11} /> Edit Day
                  </button>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: t.textSub, opacity: 0.6 }}>
                    <Lock size={11} /> Locked
                  </span>
                )}
              </div>

              {/* Meals (Lunch & Dinner) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { mealKey: 'lunch', label: 'Lunch', status: lunchStatus, dishes: lunchDishes, icon: <Sun size={13} color="#f59e0b" /> },
                  { mealKey: 'dinner', label: 'Dinner', status: dinnerStatus, dishes: dinnerDishes, icon: <Moon size={13} color="#818cf8" /> }
                ].map(({ mealKey, label, status, dishes, icon }) => {
                  const isApplied = status === 'Applied'
                  const isSkipped = status === 'Skipped'
                  const isPending = status === 'pending'

                  return (
                    <div
                      key={mealKey}
                      onClick={() => {
                        if (canEditThisDay) {
                          setOpenDay(day)
                          setOpenMeal(mealKey)
                          setShowSurvey(true)
                        }
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: t.inputBg,
                        border: `1px solid ${t.border}`,
                        cursor: canEditThisDay ? 'pointer' : 'default',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: t.text }}>
                          {icon}
                          <span>{label}</span>
                        </div>

                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: isApplied ? 'rgba(16,185,129,0.12)' : isSkipped ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.05)',
                          color: isApplied ? '#10b981' : isSkipped ? '#ef4444' : t.textSub,
                          border: `1px solid ${isApplied ? 'rgba(16,185,129,0.25)' : isSkipped ? 'rgba(239,68,68,0.20)' : t.border}`
                        }}>
                          {isApplied ? 'Requested' : isSkipped ? 'Skipped' : 'Pending'}
                        </span>
                      </div>

                      {/* Dishes Breakdown when food was requested */}
                      {isApplied && dishes.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingTop: 6, borderTop: `1px solid ${t.border}` }}>
                          {dishes.map(({ dish, val }) => {
                            const isRoti = ['roti', 'naan', 'paratha', 'bread', 'chapati', 'puri'].some(k => dish.toLowerCase().includes(k))
                            const isYes = String(val).toLowerCase() === 'yes'
                            const isNo = String(val).toLowerCase() === 'no'
                            const isCount = !isRoti && !String(val).endsWith('%') && !isYes && !isNo
                            const displayVal = isRoti ? (isYes ? 'Yes' : 'No') : isCount ? `${val} portion${val === 1 ? '' : 's'}` : val

                            return (
                              <span
                                key={dish}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: 8,
                                  background: isNo ? 'rgba(239,68,68,0.08)' : t.card,
                                  color: isNo ? '#ef4444' : t.text,
                                  border: `1px solid ${isNo ? 'rgba(239,68,68,0.20)' : t.border}`,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <span style={{ color: t.textSub }}>{dish}:</span>
                                <strong style={{ fontWeight: 800, color: isNo ? '#ef4444' : t.accent }}>
                                  {displayVal}
                                </strong>
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Survey Fill / Edit Modal */}
      {showSurvey && (
        <SurveyModal
          onClose={() => {
            setShowSurvey(false)
            silentRefresh()
          }}
          appSettings={appSettings}
          initialDay={openDay}
          initialMeal={openMeal}
          initialWeekId={activeWeekId}
        />
      )}
    </main>
  )
}
