import React, { useState, useEffect, useMemo } from 'react'
import { Utensils, Sun, Moon, ChevronDown, Calendar } from 'lucide-react'
import { useWeeklyMenu } from '../../common/useWeeklyMenu'
import { useAuth, useTheme } from '../../admin/context'
import { getCalendarWeekDate, addWeeks, isTwoWeekCadence } from '../../common/utils'
import { getSlotDishes } from '../../hooks/useSurvey'
import { WeeklyMenuSkeleton } from '../../common/Skeleton'
import { DAYS, getTodayKey } from '../constants'
import { fetchUserSurveyRow } from '../../lib/surveyRows'
import { supabase } from '../../lib/firebaseClient'

const formatWeekSpan = (weekStart) => {
  try {
    const d = new Date(weekStart + 'T00:00:00')
    const end = new Date(d)
    end.setDate(end.getDate() + 5)
    return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  } catch {
    return weekStart
  }
}

export default function WeeklyMenuPage({ appSettings = {} }) {
  const t = useTheme()
  const calendarWeekId = getCalendarWeekDate()
  const nextWeekId = addWeeks(calendarWeekId, 1)
  const week2Id = addWeeks(calendarWeekId, 2)
  const isFortnight = isTwoWeekCadence(appSettings)
  
  const [selectedWeekId, setSelectedWeekId] = useState(calendarWeekId)
  const weeklyMenu = useWeeklyMenu(selectedWeekId)
  const todayKey = getTodayKey()
  const [expandedDay, setExpandedDay] = useState(todayKey)
  const { user } = useAuth()
  const [userSurvey, setUserSurvey] = useState(null)

  const weekOptions = useMemo(() => {
    if (isFortnight) {
      return [
        { id: calendarWeekId, label: 'This Week' },
        { id: nextWeekId, label: 'Week 1' },
        { id: week2Id, label: 'Week 2' },
      ]
    }
    return [
      { id: calendarWeekId, label: 'This Week' },
      { id: nextWeekId, label: 'Next Week' },
    ]
  }, [isFortnight, calendarWeekId, nextWeekId, week2Id])

  // Check if current calendar week has any dishes
  const hasCurrentDishes = useMemo(() => {
    if (!weeklyMenu) return false
    return DAYS.some(d => (weeklyMenu[d]?.lunch?.length || 0) > 0 || (weeklyMenu[d]?.dinner?.length || 0) > 0)
  }, [weeklyMenu])

  // Fetch user survey response for the selected week
  useEffect(() => {
    let active = true
    const fetchSurvey = async () => {
      if (!user?.id) return
      const { data: normal } = await fetchUserSurveyRow(user.id, selectedWeekId)
      if (active) setUserSurvey(normal || null)
    }
    fetchSurvey()
    return () => { active = false }
  }, [user?.id, selectedWeekId])

  // Position-aware response lookup: when the row carries a dish_snapshot, the
  // value for a dish is read from the position the dish held when it was saved,
  // so values stay attached to the right dish even after menu edits.
  const getDishResp = (day, meal, idx, dishName) => {
    if (!userSurvey) return null
    const dayKey = day.substring(0, 3).toLowerCase()
    const mealKey = meal === 'lunch' ? 'l' : 'd'
    const dishes = getSlotDishes(userSurvey, day, meal, weeklyMenu[day]?.[meal] || [])
    let pos = idx
    if (dishName) {
      const p = dishes.indexOf(dishName)
      if (p !== -1) pos = p
    }
    const col = `${dayKey}_${mealKey}_dish_${pos + 1}`
    const val = userSurvey[col]
    if (val === 'Yes') return 'yes'
    if (val === 'No') return 'no'
    if (typeof val === 'string' && val.endsWith('%')) return parseInt(val.replace('%', ''))
    if (typeof val === 'string' && /^\d+$/.test(val)) return parseInt(val)
    return null
  }

  if (!weeklyMenu) return <WeeklyMenuSkeleton />

  return (
    <main style={{ flex: 1, padding: '16px 16px calc(110px + env(safe-area-inset-bottom, 20px))', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Dynamic Header with Dropdown */}
      <div style={{
        marginBottom: 24, padding: '24px', borderRadius: 32,
        background: t.cardActive, border: `1.5px solid ${t.borderActive}`,
        position: 'relative', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
      }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 140, height: 140, background: t.accentGrad, borderRadius: '50%', filter: 'blur(50px)', opacity: 0.15 }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
                <Utensils size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', color: t.accent, textTransform: 'uppercase', fontFamily: "'DM Sans',sans-serif" }}>Culinary Journey</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display',serif" }}>Weekly Menu</div>
              </div>
            </div>

            {/* Week Switcher */}
            <div style={{ display: 'inline-flex', background: t.inputBg, padding: 4, borderRadius: 14, border: `1px solid ${t.border}`, gap: 4 }}>
              {weekOptions.map(opt => {
                const active = selectedWeekId === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedWeekId(opt.id)}
                    style={{
                      padding: '6px 12px', borderRadius: 10, border: 'none',
                      background: active ? t.accentGrad : 'transparent',
                      color: active ? '#000' : t.textSub,
                      fontSize: 11, fontWeight: active ? 900 : 700, cursor: 'pointer',
                      transition: 'all 0.2s', fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: t.textSub, fontFamily: "'DM Sans', sans-serif" }}>
            <Calendar size={13} color={t.accent} />
            <span>Week: <strong style={{ color: t.text }}>{formatWeekSpan(selectedWeekId)}</strong></span>
            {!hasCurrentDishes && selectedWeekId === calendarWeekId && (
              <span style={{ marginLeft: 'auto', fontSize: 10.5, color: t.accent, background: t.accentBg, padding: '2px 8px', borderRadius: 6, border: `1px solid ${t.border}` }}>
                Previewing available menu
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Days */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {DAYS.map((day) => {
          const menu = weeklyMenu[day] || { en: '', ar: '', lunch: [], dinner: [] }
          const isToday = day === todayKey
          const isExpanded = day === expandedDay

          return (
            <div
              key={day}
              id={`day-card-${day}`}
              onClick={() => setExpandedDay(isExpanded ? null : day)}
              style={{
                borderRadius: 28,
                background: isExpanded ? 'rgba(255, 215, 0, 0.05)' : t.card,
                border: `1.5px solid ${isToday ? t.accent : isExpanded ? t.borderActive : t.border}`,
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: isExpanded ? '0 15px 45px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              {isToday && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  background: t.accentGrad, color: '#000', padding: '4px 12px',
                  borderRadius: 100, fontSize: 10, fontWeight: 900, letterSpacing: '0.1em',
                  boxShadow: '0 4px 10px rgba(184,134,11,0.4)'
                }}>TODAY</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 16,
                    background: isExpanded ? t.accentGrad : t.inputBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, fontWeight: 800, color: isExpanded ? '#000' : t.accent,
                    border: `1px solid ${isExpanded ? 'transparent' : t.border}`,
                    transition: 'all 0.3s'
                  }}>
                    {day.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: isExpanded ? t.accent : t.text, fontFamily: "'Playfair Display',serif" }}>
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginTop: 2, opacity: 0.85, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[...(menu.lunch || []), ...(menu.dinner || [])].slice(0, 3).join(' • ') || (menu.ar ? menu.ar : 'Special Menu Coming Soon')}
                    </div>
                  </div>
                </div>
                <div style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.4s' }}>
                  <ChevronDown size={20} color={isExpanded ? t.accent : t.textSub} />
                </div>
              </div>

              {/* Collapsible Content */}
              <div style={{
                maxHeight: isExpanded ? '1000px' : '0px',
                opacity: isExpanded ? 1 : 0,
                overflow: 'hidden',
                transition: 'all 0.5s ease-in-out',
                marginTop: isExpanded ? 24 : 0
              }}>
                {menu.ar && (
                  <div style={{
                    textAlign: 'center', marginBottom: 20, padding: '12px',
                    borderRadius: 20, background: 'rgba(212,175,55,0.05)',
                    fontFamily: "'Amiri',serif", fontSize: 18, color: t.accent
                  }}>{menu.ar}</div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                  {/* Lunch Card */}
                  <div style={{
                    padding: '16px', borderRadius: 24,
                    background: t.card, border: `1px solid ${t.border}`,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #FF9500, #FFCC00)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Sun size={16} color="#fff" />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: t.text }}>LUNCH FEAST</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {menu.lunch.length > 0 ? menu.lunch.map((dish, idx) => {
                        const resp = getDishResp(day, 'lunch', idx, dish)
                        return (
                          <div key={dish} style={{
                            padding: '8px 16px', borderRadius: 14,
                            background: resp === 'yes' ? 'rgba(76, 175, 80, 0.1)' : resp === 'no' ? 'rgba(244, 67, 54, 0.1)' : t.inputBg,
                            border: `1px solid ${resp === 'yes' ? '#4CAF50' : resp === 'no' ? '#F44336' : t.border}`,
                            fontSize: 13, fontWeight: 600, color: t.textBody,
                            display: 'flex', alignItems: 'center', gap: '8px'
                          }}>
                            {dish}
                            {resp !== null && (
                              <span style={{ fontWeight: '800', color: resp === 'yes' ? '#4CAF50' : resp === 'no' ? '#F44336' : t.accent }}>
                                {resp === 'yes' ? '✅' : resp === 'no' ? '❌' : (typeof resp === 'number' && resp <= 100 && resp % 25 === 0 ? `${resp}%` : `${resp} person${resp === 1 ? '' : 's'}`)}
                              </span>
                            )}
                          </div>
                        )
                      }) : <div style={{ fontSize: 12, color: t.textSub, fontStyle: 'italic' }}>👨‍🍳 Menu is being prepared by Al-Mawaid team</div>}
                    </div>
                  </div>

                  {/* Dinner Card */}
                  <div style={{
                    padding: '16px', borderRadius: 24,
                    background: t.card, border: `1px solid ${t.border}`,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #5856D6, #AF52DE)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Moon size={16} color="#fff" />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: t.text }}>DINNER DELIGHT</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {menu.dinner.length > 0 ? menu.dinner.map((dish, idx) => {
                        const resp = getDishResp(day, 'dinner', idx, dish)
                        return (
                          <div key={dish} style={{
                            padding: '8px 16px', borderRadius: 14,
                            background: resp === 'yes' ? 'rgba(76, 175, 80, 0.1)' : resp === 'no' ? 'rgba(244, 67, 54, 0.1)' : t.inputBg,
                            border: `1px solid ${resp === 'yes' ? '#4CAF50' : resp === 'no' ? '#F44336' : t.border}`,
                            fontSize: 13, fontWeight: 600, color: t.textBody,
                            display: 'flex', alignItems: 'center', gap: '8px'
                          }}>
                            {dish}
                            {resp !== null && (
                              <span style={{ fontWeight: '800', color: resp === 'yes' ? '#4CAF50' : resp === 'no' ? '#F44336' : t.accent }}>
                                {resp === 'yes' ? '✅' : resp === 'no' ? '❌' : (typeof resp === 'number' && resp <= 100 && resp % 25 === 0 ? `${resp}%` : `${resp} person${resp === 1 ? '' : 's'}`)}
                              </span>
                            )}
                          </div>
                        )
                      }) : <div style={{ fontSize: 12, color: t.textSub, fontStyle: 'italic' }}>👨‍🍳 Menu is being prepared by Al-Mawaid team</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}

// ── Mini status pill for a single meal (lunch/dinner) on the week cards ──
export const MealStatusPill = ({ label, status, t }) => {
  const applied = status === 'Applied'
  const skipped = status === 'Skipped'
  const color = applied ? '#4CAF50' : skipped ? '#F44336' : t.textSub
  const bg = applied ? 'rgba(76,175,80,0.12)' : skipped ? 'rgba(244,67,54,0.12)' : 'rgba(255,255,255,0.04)'
  const bd = applied ? 'rgba(76,175,80,0.3)' : skipped ? 'rgba(244,67,54,0.3)' : t.border
  const icon = applied ? '✓' : skipped ? '✕' : '○'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 100, fontSize: 9.5, fontWeight: 800,
      background: bg, color, border: `1px solid ${bd}`,
      fontFamily: "'DM Sans',sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {icon} {label}
    </span>
  )
}
