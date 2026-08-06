// src/components/DailyEditCard.jsx
// Time-based meal card + helpers

import React, { useState, useEffect, useRef } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme, useAuth } from '../admin/context'
import { supabase } from '../lib/firebaseClient'
import { getCalendarWeekDate, DAYS } from '../common/utils'
import { isRotiItem, isCountInput } from '../hooks/useSurvey'

// ── Skeleton Placeholder ──
const SkeletonDish = ({ t }) => (
  <div style={{
    padding: '10px 14px', borderRadius: 12,
    background: t.card,
    border: `1px solid ${t.border}`,
    marginBottom: 8
  }}>
    <div style={{
      height: 14, width: '60%', borderRadius: 6,
      background: t.border,
      marginBottom: 10,
      animation: 'skeletonPulse 1.5s ease-in-out infinite'
    }} />
    <div style={{ display: 'flex', gap: 6 }}>
      {[0,1,2,3,4].map(i => (
        <div key={i} style={{
          flex: 1, height: 32, borderRadius: 8,
          background: t.border,
          animation: `skeletonPulse 1.5s ease-in-out ${i * 0.1}s infinite`
        }} />
      ))}
    </div>
  </div>
)

const SkeletonBlock = ({ t, count = 3 }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{
      height: 16, width: '40%', borderRadius: 6,
      background: t.border, marginBottom: 12,
      animation: 'skeletonPulse 1.5s ease-in-out infinite'
    }} />
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonDish key={i} t={t} />
    ))}
  </div>
)

export const getCardMealInfo = (weeklyMenu, appSettings = {}) => {
  const now = new Date()
  const curMin = now.getHours() * 60 + now.getMinutes()
  const map = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' }
  const dayIdx = now.getDay()
  if (dayIdx === 0) return null  // Sunday — no card

  // Parse configurable timings from appSettings (fall back to sensible defaults)
  const parseHm = (val, defaultH, defaultM) => {
    const p = (val || '').split(':').map(Number)
    return (p.length === 2 && !isNaN(p[0]) && !isNaN(p[1]))
      ? { h: p[0], m: p[1] }
      : { h: defaultH, m: defaultM }
  }

  const lunchClose = parseHm(appSettings.lunch_edit_close, 11, 0)
  const dinnerOpen = parseHm(appSettings.dinner_edit_open, 12, 0)
  const dinnerClose = parseHm(appSettings.dinner_edit_close, 15, 30)
  const nextLunchOpen = parseHm(appSettings.lunch_edit_open, 20, 0)

  const LUNCH_CLOSE = lunchClose.h * 60 + lunchClose.m
  const DINNER_START = dinnerOpen.h * 60 + dinnerOpen.m
  const DINNER_END = dinnerClose.h * 60 + dinnerClose.m
  const NEXT_LUNCH_START = nextLunchOpen.h * 60 + nextLunchOpen.m

  let targetDay, targetMeal

  if (curMin < LUNCH_CLOSE) {
    // Midnight to lunch close → Today's Lunch
    targetDay = map[dayIdx]
    targetMeal = 'lunch'
  } else if (curMin >= DINNER_START && curMin < DINNER_END) {
    // Dinner open to dinner close → Today's Dinner
    targetDay = map[dayIdx]
    targetMeal = 'dinner'
  } else if (curMin >= NEXT_LUNCH_START) {
    // Next lunch open to midnight → Next day's Lunch
    if (dayIdx === 6) {
      targetDay = 'monday'  // Saturday → Monday
    } else {
      targetDay = map[dayIdx + 1]
    }
    targetMeal = 'lunch'
  } else {
    // Gap periods (between meals) → no card
    return null
  }

  const dishes = weeklyMenu?.[targetDay]?.[targetMeal] || []
  return { day: targetDay, meal: targetMeal, dishes }
}

export const getSurveyCloseHour = (appSettings = {}) => {
  const h = parseInt(appSettings.survey_close_hour);
  return !isNaN(h) && h >= 0 && h <= 23 ? h : 10;
}

export const getEditCloseTime = (appSettings, mealType) => {
  const key = mealType === 'lunch' ? 'lunch_edit_close' : 'dinner_edit_close';
  const val = appSettings[key];
  if (!val) return mealType === 'lunch' ? { h: 11, m: 0 } : { h: 15, m: 30 };
  const parts = val.split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { h: parts[0], m: parts[1] };
  return mealType === 'lunch' ? { h: 11, m: 0 } : { h: 15, m: 30 };
}

export default function DailyEditCard({ weeklyMenu, isOpen = true, onClose = () => {}, onComplete = () => {}, appSettings }) {
  const t = useTheme()
  const { user } = useAuth()
  const [userResponses, setUserResponses] = useState({})
  const [saving, setSaving] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Load user's saved survey responses
  useEffect(() => {
    if (!user || !weeklyMenu || !isOpen) return
    setDataLoading(true)
    const loadData = async () => {
      const weekId = getCalendarWeekDate()
      const mi = getCardMealInfo(weeklyMenu, appSettings)
      if (!mi) return
      const dayKey = mi.day.substring(0, 3).toLowerCase()
      const mealKey = mi.meal === 'lunch' ? 'l' : 'd'
      const { data } = await supabase
        .from('survey_submissions_flat')
        .select('*').eq('user_id', user.id).eq('week_id', weekId).maybeSingle()
      if (!data) return
      const status = data[dayKey + '_' + mealKey + '_status']
      if (status !== 'Applied') return
      const respMap = {}
      mi.dishes.forEach((dish, idx) => {
        const val = data[dayKey + '_' + mealKey + '_dish_' + (idx + 1)]
        if (val !== undefined && val !== null) {
          if (val === 'Yes') respMap[dish] = 'yes'
          else if (val === 'No') respMap[dish] = 'no'
          else {
            const isCount = isCountInput(appSettings, mi.day, mi.meal, idx)
            if (isCount) {
              respMap[dish] = parseInt(val) || 0
            } else if (typeof val === 'string' && val.endsWith('%')) {
              respMap[dish] = parseInt(val)
            } else if (typeof val === 'number') {
              respMap[dish] = val
            }
          }
        }
      })
      setUserResponses(respMap)
    }
    loadData().finally(() => setDataLoading(false))
  }, [user, weeklyMenu, isOpen, appSettings])

  const saveAllResponses = async () => {
    if (!user || saving) return
    setSaving(true)
    try {
      const mi = getCardMealInfo(weeklyMenu, appSettings)
      if (!mi) return
      const weekId = getCalendarWeekDate()
      const dayKey = mi.day.substring(0, 3).toLowerCase()
      const mealKey = mi.meal === 'lunch' ? 'l' : 'd'
      const statusKey = dayKey + '_' + mealKey + '_status'
      const { data: existing } = await supabase.from('survey_submissions_flat')
        .select('*').eq('user_id', user.id).eq('week_id', weekId).maybeSingle()
      const upsertObj = {
        user_id: user.id,
        week_id: weekId,
        [statusKey]: 'Applied',
        updated_at: new Date().toISOString()
      }
      mi.dishes.forEach((d, idx) => {
        const colName = dayKey + '_' + mealKey + '_dish_' + (idx + 1)
        const val = userResponses[d]
        if (val !== undefined) {
          const isCount = isCountInput(appSettings, mi.day, mi.meal, idx)
          if (isRotiItem(d)) {
            upsertObj[colName] = val === 'yes' ? 'Yes' : 'No'
          } else if (isCount) {
            upsertObj[colName] = val === 'no' ? 'No' : (typeof val === 'number' ? val : parseInt(val) || 0)
          } else {
            upsertObj[colName] = typeof val === 'number' ? val + '%' : (val === 'yes' ? 'Yes' : 'No')
          }
        } else if (existing && existing[colName] !== undefined && existing[colName] !== null) {
          upsertObj[colName] = existing[colName]
        }
      })
      const { error } = await supabase
        .from('survey_submissions_flat')
        .upsert([upsertObj], { onConflict: 'user_id,week_id' })
      if (error) throw error
      onCompleteRef.current()
    } catch (err) {
      console.error('Error saving quick edit:', err)
    } finally {
      setSaving(false)
    }
  }

  const setDishResponse = (dish, value) => {
    setUserResponses(prev => ({ ...prev, [dish]: value }))
  }

  const mealInfo = weeklyMenu ? getCardMealInfo(weeklyMenu, appSettings) : null

  // ── Premium selected-state helpers ──
  const YC = '#4CAF50'
  const NC = '#F44336'
  const optGrad = (c) => `linear-gradient(145deg, ${c}2e 0%, ${c}0f 55%, ${c}05 100%)`
  const optShadow = (c) => `0 6px 18px ${c}40, inset 0 1px 0 rgba(255,255,255,0.12)`
  const pctColor = (p) => (p === 0 ? NC : p === 25 ? '#FFC107' : p === 50 ? '#2196F3' : p === 75 ? '#9E9E9E' : YC)
  const sheen = (color) => (
    <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(180deg, rgba(255,255,255,0.16), transparent)', pointerEvents: 'none' }} />
  )
  const checkBadge = (color) => (
    <span style={{ position: 'absolute', top: 4, right: 4, width: 17, height: 17, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px ${color}70`, zIndex: 2 }}>
      <span style={{ fontSize: 9, fontWeight: 900, color: '#0d0d1a', lineHeight: 1 }}>✓</span>
    </span>
  )

  if (!mealInfo || !isOpen) return null

  // ── Modal/Popup wrapper ──
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.82)', padding: 16,
        backdropFilter: 'blur(12px)', overflowY: 'auto'
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 500, width: '100%',
          borderRadius: 24, padding: '24px',
          background: t.accentBg,
          border: `1.5px solid ${t.accent}`,
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 28px 70px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, background: t.accentGrad, borderRadius: '50%', filter: 'blur(60px)', opacity: 0.15 }} />
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px ' + t.accentBg }}>
            {mealInfo.meal === 'lunch' ? <Sun size={16} color="#fff" /> : <Moon size={16} color="#fff" />}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>
              {mealInfo.day.charAt(0).toUpperCase() + mealInfo.day.slice(1)} &bull; {mealInfo.meal.toUpperCase()}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display',serif", lineHeight: 1.3 }}>
              Quick Edit &bull; {mealInfo.meal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}
            </div>
          </div>
        </div>

        {dataLoading ? (
          <SkeletonBlock t={t} count={Math.max(mealInfo.dishes.length || 3, 3)} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {mealInfo.dishes.length > 0 ? mealInfo.dishes.map((dish, idx) => {
              const resp = userResponses[dish]
              const isCount = !isRotiItem(dish) && isCountInput(appSettings, mealInfo.day, mealInfo.meal, idx)
              const isRoti = isRotiItem(dish)
              let selColor = null
              if (isRoti) selColor = resp === 'yes' ? YC : resp === 'no' ? NC : null
              else if (isCount) selColor = resp === 'no' ? NC : typeof resp === 'number' ? YC : null
              else if (typeof resp === 'number') selColor = pctColor(resp)
              const statusLabel = isRoti
                ? (resp === 'yes' ? '✅ Selected' : resp === 'no' ? '❌ Skipped' : '')
                : isCount
                  ? (resp === 'no' ? '❌ Skipped' : typeof resp === 'number' ? `✅ ${resp} ${resp === 1 ? 'person' : 'persons'}` : '')
                  : (typeof resp === 'number' ? `${resp}%` : '')
              return (
                <div key={idx} style={{
                  padding: '12px 14px', borderRadius: 14,
                  position: 'relative', overflow: 'hidden',
                  background: selColor ? `linear-gradient(145deg, ${selColor}1a, ${t.card})` : t.inputBg,
                  border: `1.5px solid ${selColor || t.border}`,
                  boxShadow: selColor ? `0 6px 20px ${selColor}22` : 'none',
                  fontSize: 13, fontWeight: 600, color: t.textBody,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}>
                  {selColor && (
                    <div style={{ position: 'absolute', top: -22, right: -22, width: 96, height: 96, borderRadius: '50%', background: selColor, filter: 'blur(42px)', opacity: 0.14, pointerEvents: 'none' }} />
                  )}
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{dish}</span>
                      {selColor && (
                        <span style={{
                          fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
                          padding: '3px 10px', borderRadius: 100,
                          background: `${selColor}1a`, color: selColor, border: `1px solid ${selColor}50`,
                        }}>{statusLabel}</span>
                      )}
                    </div>
                    {isRoti ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[['yes', YC, '✅ Yes'], ['no', NC, '❌ No']].map(([val, color, label]) => {
                          const isSel = resp === val
                          return (
                            <button key={val} onClick={() => setDishResponse(dish, val)} disabled={saving}
                              style={{
                                flex: 1, padding: '10px 8px', borderRadius: 11,
                                border: `1.5px solid ${isSel ? color : t.border}`,
                                background: isSel ? optGrad(color) : 'transparent',
                                color: isSel ? color : t.textSub,
                                fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: isSel ? 'scale(1.03)' : 'scale(1)',
                                boxShadow: isSel ? optShadow(color) : 'none',
                                position: 'relative', overflow: 'hidden', opacity: saving ? 0.6 : 1,
                              }}
                              onMouseEnter={e => { if (!isSel) { e.currentTarget.style.background = `${color}0d`; e.currentTarget.style.borderColor = `${color}55` } }}
                              onMouseLeave={e => { if (!isSel) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = t.border } }}
                            >
                              {isSel && sheen(color)}
                              {isSel && checkBadge(color)}
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    ) : isCount ? (
                      typeof resp === 'number' ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: `linear-gradient(145deg, ${YC}1f, ${t.card})`, borderRadius: 12,
                            padding: '4px 6px', border: `1px solid ${YC}40`, boxShadow: `0 4px 14px ${YC}18`,
                          }}>
                            <button onClick={() => setDishResponse(dish, Math.max(0, resp - 1))} disabled={saving}
                              style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${YC}50`, background: t.inputBg, color: t.text, cursor: 'pointer', fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>−</button>
                            <div style={{ textAlign: 'center', minWidth: 44 }}>
                              <div style={{ fontSize: 22, fontWeight: 900, color: YC, lineHeight: 1, textShadow: `0 0 12px ${YC}55` }}>{resp}</div>
                              <div style={{ fontSize: 8, color: t.textSub, fontWeight: 700 }}>{resp === 1 ? 'person' : 'persons'}</div>
                            </div>
                            <button onClick={() => setDishResponse(dish, resp + 1)} disabled={saving}
                              style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${YC}50`, background: t.inputBg, color: t.text, cursor: 'pointer', fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>+</button>
                          </div>
                          <button onClick={() => setDishResponse(dish, 'no')} disabled={saving}
                            style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${NC}50`, background: 'transparent', color: NC, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>❌ Skip</button>
                        </div>
                      ) : resp === 'no' ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: NC, fontWeight: 800 }}>❌ Skipped</span>
                          <button onClick={() => setDishResponse(dish, 1)} disabled={saving}
                            style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${t.accent}`, background: `linear-gradient(145deg, ${t.accent}22, transparent)`, color: t.accent, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>✅ Add back</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setDishResponse(dish, 1)} disabled={saving}
                            style={{ flex: 1, padding: '10px 8px', borderRadius: 11, border: `1.5px solid ${YC}`, background: optGrad(YC), color: YC, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', position: 'relative', overflow: 'hidden' }}>✅ Yes</button>
                          <button onClick={() => setDishResponse(dish, 'no')} disabled={saving}
                            style={{ flex: 1, padding: '10px 8px', borderRadius: 11, border: `1.5px solid ${NC}`, background: optGrad(NC), color: NC, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>❌ No</button>
                        </div>
                      )
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[0, 25, 50, 75, 100].map(pct => {
                          const isSel = resp === pct
                          const pc = pctColor(pct)
                          return (
                            <button key={pct} onClick={() => setDishResponse(dish, pct)} disabled={saving}
                              style={{
                                flex: 1, padding: '9px 4px', borderRadius: 10,
                                border: `1.5px solid ${isSel ? pc : t.border}`,
                                background: isSel ? optGrad(pc) : 'transparent',
                                color: isSel ? pc : t.textSub,
                                fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: isSel ? 'scale(1.05)' : 'scale(1)',
                                boxShadow: isSel ? optShadow(pc) : 'none',
                                position: 'relative', overflow: 'hidden', opacity: saving ? 0.6 : 1,
                              }}
                              onMouseEnter={e => { if (!isSel) { e.currentTarget.style.background = `${pc}0d`; e.currentTarget.style.borderColor = `${pc}55` } }}
                              onMouseLeave={e => { if (!isSel) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = t.border } }}
                            >
                              {isSel && sheen(pc)}
                              {pct === 0 ? '0%' : pct + '%'}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            }) : <div style={{ fontSize: 12, color: t.textSub, fontStyle: 'italic' }}>Menu being prepared...</div>}
          </div>
        )}

        {/* Submit All & Close buttons */}
        <button
          onClick={saveAllResponses}
          disabled={saving}
          style={{
            width: '100%', padding: 14, borderRadius: 14,
            border: 'none',
            background: saving ? t.border : (t.accentGrad || t.accent),
            color: '#000', fontSize: 15, fontWeight: 900,
            cursor: saving ? 'not-allowed' : 'pointer', marginTop: 8,
            fontFamily: "'DM Sans',sans-serif",
            boxShadow: saving ? 'none' : `0 8px 24px ${t.accentBg || 'rgba(224, 160, 60, 0.25)'}`,
            opacity: saving ? 0.6 : 1
          }}
        >
          {saving ? 'Saving...' : 'Submit All Changes'}
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: 12, borderRadius: 12,
            border: `1px solid ${t.border}`,
            background: 'transparent',
            color: t.textSub, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', marginTop: 8,
            fontFamily: "'DM Sans',sans-serif"
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
