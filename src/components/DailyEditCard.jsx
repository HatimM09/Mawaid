// @refresh reset
// src/components/DailyEditCard.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Sun, Moon, Check, X, Clock, Sparkles, Plus, Minus, RefreshCw } from 'lucide-react'
import { useTheme, useAuth } from '../admin/context'
import { getCalendarWeekDate, getOwningWeekId, getSurveyTargetWeek, dayBelongsToCalendarWeek, parseDishArray, addWeeks } from '../common/utils'
import { submitSurveyRow } from '../lib/submitSurvey'
import {
  isRotiItem,
  isCountInput,
  canEditMeal,
  getEditWindow,
  normalizeDishValue,
  denormalizeDishValue,
  getPctColor,
  mergeDishSnapshot,
  getSlotDishes
} from '../hooks/useSurvey'
import { fetchUserSurveyRow } from '../lib/surveyRows'
import { supabase } from '../lib/firebaseClient'

export const getCardMealInfo = (weeklyMenu = {}, appSettings = {}) => {
  const now = new Date()
  const dayIdx = now.getDay() // 0 = Sun, 1 = Mon, ...
  const hour = now.getHours()
  const calWeek = getCalendarWeekDate()
  const targetWeek = getSurveyTargetWeek(appSettings)
  const nextCalWeek = addWeeks(calWeek, 1)

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayName = dayNames[dayIdx]
  const todayKey = todayName === 'sunday' ? 'saturday' : todayName

  const nextDayIdx = (dayIdx + 1) % 7
  const nextDayName = dayNames[nextDayIdx]
  const tomorrowKey = nextDayName === 'sunday' ? 'monday' : nextDayName

  // Resolve which week owns the target day
  const resolveWeek = (dayName) => {
    if (dayIdx === 6 && dayName === 'monday') return nextCalWeek
    if (dayIdx === 0 && dayName === 'monday') return calWeek
    if (dayName === todayName) return calWeek
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    d.setHours(12, 0, 0, 0)
    return getOwningWeekId(d, appSettings) || targetWeek || calWeek
  }

  const tomorrowWeek = resolveWeek(tomorrowKey)
  const todayWeek = resolveWeek(todayName)

  // 1. Check if today's lunch is editable
  if (dayIdx !== 0 && canEditMeal(todayKey, calWeek, 'lunch', appSettings)) {
    const dishes = (weeklyMenu && weeklyMenu[todayKey]?.lunch) || []
    return { day: todayKey, meal: 'lunch', dishes, weekId: todayWeek }
  }

  // 2. Check if today's dinner is editable
  if (dayIdx !== 0 && canEditMeal(todayKey, calWeek, 'dinner', appSettings)) {
    const dishes = (weeklyMenu && weeklyMenu[todayKey]?.dinner) || []
    return { day: todayKey, meal: 'dinner', dishes, weekId: todayWeek }
  }

  // 3. Check if tomorrow's lunch is editable (e.g. opens previous night 8 PM)
  if (canEditMeal(tomorrowKey, tomorrowWeek, 'lunch', appSettings)) {
    const dishes = (weeklyMenu && weeklyMenu[tomorrowKey]?.lunch) || []
    return { day: tomorrowKey, meal: 'lunch', dishes, weekId: tomorrowWeek }
  }

  // 4. Check if tomorrow's dinner is editable
  if (canEditMeal(tomorrowKey, tomorrowWeek, 'dinner', appSettings)) {
    const dishes = (weeklyMenu && weeklyMenu[tomorrowKey]?.dinner) || []
    return { day: tomorrowKey, meal: 'dinner', dishes, weekId: tomorrowWeek }
  }

  // Fallback: If weekend or after Saturday dinner, automatically target next week's Monday lunch
  const isWeekendOrSatNight = dayIdx === 0 || (dayIdx === 6 && hour >= 16)
  if (isWeekendOrSatNight) {
    return { day: 'monday', meal: 'lunch', dishes: (weeklyMenu && weeklyMenu['monday']?.lunch) || [], weekId: nextCalWeek }
  }

  const isEvening = hour >= 16
  const targetDay = isEvening ? tomorrowKey : todayKey
  const targetMeal = (hour >= 11 && hour < 16) ? 'dinner' : 'lunch'
  const targetWeekId = isEvening ? tomorrowWeek : todayWeek
  const targetDishes = (weeklyMenu && weeklyMenu[targetDay]?.[targetMeal]) || []

  return { day: targetDay, meal: targetMeal, dishes: targetDishes, weekId: targetWeekId }
}

export default function DailyEditCard({
  weeklyMenu,
  mealInfo: propMealInfo,
  isOpen = true,
  onClose = () => {},
  onComplete = () => {},
  appSettings = {}
}) {
  const { user } = useAuth()
  const t = useTheme()

  const mi = useMemo(() => {
    if (propMealInfo && propMealInfo.day && propMealInfo.meal) {
      const dishes = (weeklyMenu && weeklyMenu[propMealInfo.day]?.[propMealInfo.meal]) || propMealInfo.dishes || []
      // Use explicit weekId when provided; otherwise resolve via owning week (cadence-aware) to avoid writing to wrong week_id (e.g., W2)
      const resolvedWeek = propMealInfo.weekId || getOwningWeekId(new Date(), appSettings) || getSurveyTargetWeek(appSettings)
      return {
        day: propMealInfo.day,
        meal: propMealInfo.meal,
        dishes,
        weekId: resolvedWeek
      }
    }
    return getCardMealInfo(weeklyMenu, appSettings)
  }, [propMealInfo, weeklyMenu, appSettings])

  const [wantsMeal, setWantsMeal] = useState(true)
  const [dishResponses, setDishResponses] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [userData, setUserData] = useState({ thali_no: '', email: user?.email })
  const [snackDefaults, setSnackDefaults] = useState(null)
  const [existingData, setExistingData] = useState(null)
  const [fetchedDishes, setFetchedDishes] = useState(null)

  // Admin-assigned per-dish count limit (UsersPage → "default count"). Members
  // can only reduce these values — same rule as the weekly survey modal.
  const getMaxCount = (idx) => {
    const v = snackDefaults?.[`dish_${idx + 1}`]
    return (v !== undefined && v !== null && v >= 1) ? v : null // null = uncapped
  }

  const dayKey = mi.day.substring(0, 3).toLowerCase()
  const mealKey = mi.meal === 'lunch' ? 'l' : 'd'
  const isLunch = mi.meal === 'lunch'
  const MealIcon = isLunch ? Sun : Moon

  const liveDishes = (fetchedDishes && fetchedDishes.length > 0) ? fetchedDishes : (mi.dishes || [])
  const dishes = liveDishes.length > 0 ? liveDishes : getSlotDishes(existingData, mi.day, mi.meal, [])

  // Lock body scroll when modal is open on mobile
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Load existing saved response and fresh menu from Supabase — fast, no blocking refresh
  const loadExisting = useCallback(async (isManual = false) => {
    if (!user || !mi || !isOpen) return
    // Only show full spinner on first load or manual refresh; silent background sync otherwise
    const isFirstLoad = !existingData && !fetchedDishes
    if (isFirstLoad || isManual) { setLoading(true) }
    setSavedSuccess(false)
    try {
      // 1. Fetch fresh dishes from weekly_menu for this specific week and day
      let currentDishes = (fetchedDishes && fetchedDishes.length > 0) ? fetchedDishes : (mi.dishes || [])
      try {
        const { data: menuRow } = await supabase
          .from('weekly_menu')
          .select('day_name, lunch, dinner')
          .eq('week_start', mi.weekId)
          .ilike('day_name', mi.day)
          .maybeSingle()
        if (menuRow) {
          const fresh = parseDishArray(mi.meal === 'lunch' ? menuRow.lunch : menuRow.dinner)
          if (fresh.length > 0) {
            currentDishes = fresh
            setFetchedDishes(fresh)
          }
        }
      } catch (menuErr) {
        console.warn('[DailyEditCard] Menu fetch fallback:', menuErr)
      }

      // 2. Fetch user profile stats and latest survey row
      const [uRes, rowRes] = await Promise.all([
        supabase.from('user_stats').select('thali_number, email, snack_defaults').eq('user_id', user.id).maybeSingle(),
        fetchUserSurveyRow(user.id, mi.weekId)
      ])

      if (uRes.data) {
        setUserData({
          thali_no: uRes.data.thali_number || '',
          email: uRes.data.email || user.email
        })
        if (uRes.data.snack_defaults) setSnackDefaults(uRes.data.snack_defaults)
      }

      const row = rowRes.data
      setExistingData(row || null)

      const activeDishes = (currentDishes && currentDishes.length > 0)
        ? currentDishes
        : getSlotDishes(row, mi.day, mi.meal, [])

      if (row) {
        const status = row[`${dayKey}_${mealKey}_status`]
        if (status === 'Skipped') {
          setWantsMeal(false)
        } else {
          setWantsMeal(true)
          const map = {}
          activeDishes.forEach((dish, idx) => {
            const rawVal = row[`${dayKey}_${mealKey}_dish_${idx + 1}`]
            if (rawVal !== undefined && rawVal !== null) {
              map[dish] = normalizeDishValue(rawVal, dish, isCountInput(appSettings, mi.day, mi.meal, idx))
            } else {
              if (isRotiItem(dish)) map[dish] = 'yes'
              else if (isCountInput(appSettings, mi.day, mi.meal, idx)) map[dish] = { status: 'yes', value: 1 }
              else map[dish] = 100
            }
          })
          setDishResponses(map)
        }
      } else {
        setWantsMeal(true)
        const map = {}
        activeDishes.forEach((dish, idx) => {
          if (isRotiItem(dish)) map[dish] = 'yes'
          else if (isCountInput(appSettings, mi.day, mi.meal, idx)) map[dish] = { status: 'yes', value: 1 }
          else map[dish] = 100
        })
        setDishResponses(map)
      }
    } catch (e) {
      console.warn('DailyEditCard load error:', e)
    } finally {
      setLoading(false)
    }
  }, [user?.id, mi.day, mi.meal, mi.weekId, dayKey, mealKey, isOpen, appSettings, mi.dishes])

  useEffect(() => {
    if (isOpen) {
      loadExisting()
    }
  }, [isOpen, loadExisting])

  const handleDishChange = (dish, val) => {
    setDishResponses(prev => ({
      ...prev,
      [dish]: val
    }))
  }

  const handleSave = async () => {
    if (!user || saving || !mi) return
    setSaving(true)
    try {
      const status = wantsMeal ? 'Applied' : 'Skipped'
      const dishValues = {}
      if (wantsMeal) {
        dishes.forEach((d, idx) => {
          const val = dishResponses[d]
          const isCount = isCountInput(appSettings, mi.day, mi.meal, idx)
          if (val !== undefined && val !== null) {
            dishValues[`dish_${idx + 1}`] = denormalizeDishValue(val, d, isCount)
          } else {
            dishValues[`dish_${idx + 1}`] = isRotiItem(d) ? 'Yes' : isCount ? '1' : '100%'
          }
        })
      }
      const activeUserId = user?.id || user?.user_id
      const res = await submitSurveyRow({
        user_id: activeUserId,
        week_id: mi.weekId,
        day: dayKey,
        meal: mi.meal,
        status,
        dishValues,
        dish_snapshot: mergeDishSnapshot(existingData, mi.day, mi.meal, dishes),
        thali_number: userData.thali_no,
        email: userData.email,
        updated_at: new Date().toISOString()
      })
      if (res.error) throw res.error
      // Instant optimistic close — no 1s delay, no page refresh. Parent realtime syncs automatically.
      setSavedSuccess(true)
      // Quick haptic / close — user can edit again immediately if needed
      setTimeout(() => {
        setSavedSuccess(false)
        onComplete() // parent will silently refresh via realtime, no skeleton
        onClose()
      }, 450)
    } catch (e) {
      console.error('DailyEditCard save error:', e)
      window.alert('Failed to save daily edit: ' + (e.message || 'Please try again'))
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const windowInfo = getEditWindow(appSettings, mi.meal)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10005,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(10px, 3vw, 20px)',
        animation: 'fadeIn 0.25s ease-out'
      }}
    >
      <style>{`
        @keyframes modalUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: 'min(90dvh, 680px)',
          borderRadius: 24,
          background: t.modalBg || t.cardActive || '#12121e',
          border: `1.5px solid ${t.accentBorder || t.border}`,
          boxShadow: '0 28px 70px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          animation: 'modalUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        {/* Ambient Top Glow */}
        <div style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          background: t.accentGrad,
          borderRadius: '50%',
          filter: 'blur(45px)',
          opacity: 0.14,
          pointerEvents: 'none'
        }} />

        {/* Modal Header */}
        <div style={{
          padding: '16px 18px',
          borderBottom: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          background: 'rgba(255,255,255,0.02)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: t.accentGrad,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 6px 14px ${t.accentBg}`,
              flexShrink: 0
            }}>
              <MealIcon size={18} color="#fff" />
            </div>
            <div>
              <div style={{
                fontSize: 9.5,
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: t.accent,
                textTransform: 'uppercase',
                fontFamily: "'DM Sans', sans-serif"
              }}>
                Daily Quick Edit
              </div>
              <div style={{
                fontSize: 16,
                fontWeight: 800,
                color: t.text,
                fontFamily: "'Playfair Display', serif",
                textTransform: 'capitalize',
                lineHeight: 1.2
              }}>
                {mi.day} {mi.meal}
              </div>
              <div style={{
                fontSize: 10.5,
                color: t.textSub,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 2,
                fontFamily: "'DM Sans', sans-serif"
              }}>
                <Clock size={11} color={t.accent} />
                Window: {windowInfo.open} – {windowInfo.close}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => loadExisting(true)}
              disabled={loading}
              type="button"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${t.border}`,
                borderRadius: 10,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: t.textSub,
                cursor: loading ? 'wait' : 'pointer',
                transition: 'all 0.2s'
              }}
              title="Refresh latest menu and choices"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>

            <button
              onClick={onClose}
              type="button"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${t.border}`,
                borderRadius: 10,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: t.textSub,
                cursor: 'pointer',
                transition: 'all 0.2s',
                flexShrink: 0
              }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Meal Opt-in Segmented Toggle */}
        <div style={{
          padding: '10px 18px',
          background: 'rgba(0,0,0,0.18)',
          borderBottom: `1px solid ${t.border}`,
          flexShrink: 0
        }}>
          <div style={{
            display: 'flex',
            gap: 6,
            padding: 3,
            borderRadius: 12,
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${t.border}`
          }}>
            <button
              type="button"
              onClick={() => setWantsMeal(true)}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 9,
                border: 'none',
                background: wantsMeal ? t.accentGrad : 'transparent',
                color: wantsMeal ? '#000' : t.textSub,
                fontSize: 11.5,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: 'nowrap'
              }}
            >
              🍽️ I Want {mi.meal === 'lunch' ? 'Lunch' : 'Dinner'}
            </button>
            <button
              type="button"
              onClick={() => setWantsMeal(false)}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 9,
                border: 'none',
                background: !wantsMeal ? 'rgba(239,68,68,0.18)' : 'transparent',
                color: !wantsMeal ? '#f87171' : t.textSub,
                fontSize: 11.5,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: 'nowrap'
              }}
            >
              ✕ Skip This Meal
            </button>
          </div>
        </div>

        {/* Scrollable Dish List Container */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}>
          {loading ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: t.textSub, fontSize: 13 }}>
              Loading your meal items…
            </div>
          ) : !wantsMeal ? (
            <div style={{
              padding: '24px 16px',
              borderRadius: 16,
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.2)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f87171', marginBottom: 4 }}>
                Meal Marked as Skipped
              </div>
              <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>
                You have chosen to skip {mi.day} {mi.meal}. Tap "Submit All Changes" below to update.
              </div>
            </div>
          ) : dishes.length === 0 ? (
            <div style={{
              padding: '28px 18px',
              borderRadius: 16,
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${t.border}`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>👨‍🍳</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: t.text, marginBottom: 4, fontFamily: "'Playfair Display', serif" }}>
                Menu is being prepared by Al-Mawaid team
              </div>
              <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>
                The Al-Mawaid team is preparing the dishes for this meal. You can still confirm your attendance or choose to skip.
              </div>
            </div>
          ) : (
            dishes.map((dish, idx) => {
              const isCount = isCountInput(appSettings, mi.day, mi.meal, idx)
              const isRoti = isRotiItem(dish)
              const curVal = dishResponses[dish]

              return (
                <div
                  key={dish + idx}
                  style={{
                    padding: '11px 13px',
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${t.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <span style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        background: t.accentBg,
                        border: `1px solid ${t.accentBorder}`,
                        color: t.accent,
                        fontSize: 10,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {idx + 1}
                      </span>
                      <span style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: t.text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {dish}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: isRoti ? 'rgba(16,185,129,0.1)' : isCount ? 'rgba(99,102,241,0.1)' : 'rgba(212,175,55,0.1)',
                      color: isRoti ? '#34d399' : isCount ? '#818cf8' : t.accent,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      flexShrink: 0
                    }}>
                      {isRoti ? 'Roti' : isCount ? 'Qty' : 'Portion'}
                    </span>
                  </div>

                  {/* Responsive controls */}
                  {isRoti ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {['yes', 'no'].map(opt => {
                        const active = curVal === opt || (opt === 'yes' && curVal === 100)
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleDishChange(dish, opt)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 9,
                              border: `1px solid ${active ? (opt === 'yes' ? '#10b981' : '#ef4444') : t.border}`,
                              background: active ? (opt === 'yes' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)') : 'transparent',
                              color: active ? (opt === 'yes' ? '#34d399' : '#f87171') : t.textSub,
                              fontSize: 11.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              fontFamily: "'DM Sans', sans-serif"
                            }}
                          >
                            {opt === 'yes' ? '✓ Yes' : '✕ No'}
                          </button>
                        )
                      })}
                    </div>
                  ) : isCount ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleDishChange(dish, 'no')}
                        style={{
                          padding: '7px 12px',
                          borderRadius: 9,
                          border: `1px solid ${curVal === 'no' ? '#ef4444' : t.border}`,
                          background: curVal === 'no' ? 'rgba(239,68,68,0.15)' : 'transparent',
                          color: curVal === 'no' ? '#f87171' : t.textSub,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        No
                      </button>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: curVal && typeof curVal === 'object' && curVal.status === 'yes' ? t.accentBg : 'transparent',
                        border: `1px solid ${curVal && typeof curVal === 'object' && curVal.status === 'yes' ? t.accentBorder : t.border}`,
                        borderRadius: 9,
                        padding: '3px 6px',
                        marginLeft: 'auto'
                      }}>
                        <button
                          type="button"
                          onClick={() => {
                            const curNum = (typeof curVal === 'object' && curVal?.status === 'yes') ? (curVal.value || 1) : 1
                            if (curNum <= 1) handleDishChange(dish, 'no')
                            else handleDishChange(dish, { status: 'yes', value: curNum - 1 })
                          }}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.06)',
                            border: 'none',
                            color: t.text,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Minus size={13} />
                        </button>
                        <span style={{
                          fontSize: 12.5,
                          fontWeight: 800,
                          color: t.text,
                          minWidth: 26,
                          textAlign: 'center'
                        }}>
                          {(typeof curVal === 'object' && curVal?.status === 'yes') ? curVal.value : typeof curVal === 'number' ? curVal : 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const curNum = (typeof curVal === 'object' && curVal?.status === 'yes') ? (curVal.value || 0) : 0
                            const maxCount = getMaxCount(idx)
                            const next = Math.min(maxCount || 20, curNum + 1)
                            if (next !== curNum) handleDishChange(dish, { status: 'yes', value: next })
                          }}
                          disabled={(() => {
                            const maxCount = getMaxCount(idx)
                            const curNum = (typeof curVal === 'object' && curVal?.status === 'yes') ? (curVal.value || 0) : 0
                            return maxCount !== null && curNum >= maxCount
                          })()}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.06)',
                            border: 'none',
                            color: t.text,
                            opacity: (() => {
                              const maxCount = getMaxCount(idx)
                              const curNum = (typeof curVal === 'object' && curVal?.status === 'yes') ? (curVal.value || 0) : 0
                              return maxCount !== null && curNum >= maxCount ? 0.35 : 1
                            })(),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      {(() => {
                        const maxCount = getMaxCount(idx)
                        return maxCount !== null && maxCount < 20 ? (
                          <span style={{
                            fontSize: 9, fontWeight: 800, color: t.accent,
                            background: t.accentBg, padding: '2px 7px', borderRadius: 6,
                            border: `1px solid ${t.accentBorder}`, whiteSpace: 'nowrap',
                            fontFamily: "'DM Sans',sans-serif"
                          }}>
                            Max {maxCount} (Assigned)
                          </span>
                        ) : null
                      })()}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
                      {[0, 25, 50, 75, 100].map(pct => {
                        const active = curVal === pct || (pct === 100 && curVal === 'yes') || (pct === 0 && curVal === 'no')
                        const color = getPctColor(pct) || t.accent
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => handleDishChange(dish, pct)}
                            style={{
                              padding: '7px 2px',
                              borderRadius: 8,
                              border: `1px solid ${active ? color : t.border}`,
                              background: active ? `${color}25` : 'transparent',
                              color: active ? color : t.textSub,
                              fontSize: 10.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                              transition: 'all 0.12s',
                              fontFamily: "'DM Sans', sans-serif",
                              textAlign: 'center'
                            }}
                          >
                            {pct}%
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Modal Action Footer */}
        <div style={{
          padding: '12px 18px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          borderTop: `1px solid ${t.border}`,
          background: 'rgba(255,255,255,0.02)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexShrink: 0
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '11px 16px',
              borderRadius: 12,
              border: `1px solid ${t.border}`,
              background: 'transparent',
              color: t.textSub,
              fontSize: 12,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              flex: 1,
              padding: '11px 18px',
              borderRadius: 12,
              border: 'none',
              background: savedSuccess ? 'linear-gradient(135deg, #10b981, #059669)' : t.accentGrad,
              color: savedSuccess ? '#fff' : '#000',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: saving || loading ? 'not-allowed' : 'pointer',
              boxShadow: `0 6px 16px ${t.accentBg}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.2s'
            }}
          >
            {savedSuccess ? (
              <>
                <Check size={15} /> Saved & Synced!
              </>
            ) : saving ? (
              'Saving…'
            ) : (
              <>
                <Sparkles size={15} /> Submit All Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
