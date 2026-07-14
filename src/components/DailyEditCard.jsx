// src/components/DailyEditCard.jsx
// Time-based meal card + helpers

import React, { useState, useEffect } from 'react'
import { Sun, Moon, X } from 'lucide-react'
import { useTheme, useAuth } from '../admin/context'
import { supabase } from '../lib/firebaseClient'
import { getWeekDate, DAYS } from '../common/utils'
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

export default function DailyEditCard({ weeklyMenu, isOpen = true, onClose = () => {}, appSettings }) {
  const t = useTheme()
  const { user } = useAuth()
  const [userResponses, setUserResponses] = useState({})
  const [saving, setSaving] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)

  // Load user's saved survey responses
  useEffect(() => {
    if (!user || !weeklyMenu || !isOpen) return
    setDataLoading(true)
    const loadData = async () => {
      const weekId = getWeekDate()
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
  }, [user, weeklyMenu, isOpen])

  const saveResponse = async (dish, value) => {
    if (!user || saving) return
    setSaving(true)
    try {
      const mi = getCardMealInfo(weeklyMenu, appSettings)
      if (!mi) return
      const weekId = getWeekDate()
      const dayKey = mi.day.substring(0, 3).toLowerCase()
      const mealKey = mi.meal === 'lunch' ? 'l' : 'd'
      const dishIdx = mi.dishes.indexOf(dish)
      if (dishIdx === -1) return
      const newResponses = { ...userResponses, [dish]: value }
      setUserResponses(newResponses)
      const statusKey = dayKey + '_' + mealKey + '_status'
      // Load existing submission to merge with current state (avoid data loss)
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
        const val = newResponses[d]
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
    } catch (err) {
      console.error('Error saving quick edit:', err)
    } finally {
      setSaving(false)
    }
  }

  const mealInfo = weeklyMenu ? getCardMealInfo(weeklyMenu, appSettings) : null
  
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
        
        {/* Header with close button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)', border: 'none',
              cursor: 'pointer', padding: 8, borderRadius: 10,
              color: t.textSub, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0
            }}
          >
            <X size={20} />
          </button>
        </div>

        {dataLoading ? (
          <SkeletonBlock t={t} count={Math.max(mealInfo.dishes.length || 3, 3)} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {mealInfo.dishes.length > 0 ? mealInfo.dishes.map((dish, idx) => {
              const resp = userResponses[dish]
              const isCount = !isRotiItem(dish) && isCountInput(appSettings, mealInfo.day, mealInfo.meal, idx)
              return (
                <div key={idx} style={{
                  padding: '10px 14px', borderRadius: 12,
                  background: resp === 'yes' ? 'rgba(76, 175, 80, 0.12)' : resp === 'no' ? 'rgba(244, 67, 54, 0.12)' : resp !== undefined ? t.accentBg : t.inputBg,
                  border: `1px solid ${resp ? t.accent : t.border}`,
                  fontSize: 13, fontWeight: 600, color: t.textBody
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span>{dish}</span>
                    {resp !== undefined && (
                      <span style={{ fontSize: 13, fontWeight: 800, color: resp === 'yes' ? '#4CAF50' : resp === 'no' ? '#F44336' : t.accent }}>
                        {isRotiItem(dish) ? (resp === 'yes' ? '✅' : '❌') : isCount ? (resp === 'no' ? '❌' : (typeof resp === 'number' ? resp : 0)) : (typeof resp === 'number' ? resp + '%' : resp)}
                      </span>
                    )}
                  </div>
                  {isRotiItem(dish) ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => saveResponse(dish, 'yes')} disabled={saving}
                        style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1.5px solid ${resp === 'yes' ? '#4CAF50' : t.border}`, background: resp === 'yes' ? 'rgba(76,175,80,0.12)' : 'transparent', color: resp === 'yes' ? '#4CAF50' : t.textSub, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✅ Yes</button>
                      <button onClick={() => saveResponse(dish, 'no')} disabled={saving}
                        style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1.5px solid ${resp === 'no' ? '#F44336' : t.border}`, background: resp === 'no' ? 'rgba(244,67,54,0.12)' : 'transparent', color: resp === 'no' ? '#F44336' : t.textSub, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>❌ No</button>
                    </div>
                  ) : isCount ? (
                    resp === 'no' ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: '#F44336', fontWeight: 700 }}>❌ Skipped</span>
                        <button onClick={() => saveResponse(dish, 1)} disabled={saving} style={{
                          marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${t.accent}`,
                          background: t.accentBg, color: t.accent,
                          fontSize: 12, fontWeight: 700, cursor: 'pointer'
                        }}>✅ Add back</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={() => saveResponse(dish, Math.max(0, (typeof resp === 'number' ? resp : 0) - 1))} disabled={saving} style={{
                          width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>−</button>
                        <span style={{ fontSize: 20, fontWeight: 800, color: t.accent, minWidth: 40, textAlign: 'center' }}>{typeof resp === 'number' ? resp : 0}</span>
                        <button onClick={() => saveResponse(dish, (typeof resp === 'number' ? resp : 0) + 1)} disabled={saving} style={{
                          width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>+</button>
                        <button onClick={() => saveResponse(dish, 'no')} disabled={saving} style={{
                          marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${t.border}`,
                          background: 'transparent', color: t.textSub,
                          fontSize: 12, fontWeight: 700, cursor: 'pointer'
                        }}>Skip</button>
                      </div>
                    )
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[0, 25, 50, 75, 100].map(pct => (
                        <button key={pct} onClick={() => saveResponse(dish, pct)} disabled={saving}
                          style={{
                            flex: 1, padding: '8px 4px', borderRadius: 8,
                            border: `1.5px solid ${resp === pct ? t.accent : t.border}`,
                            background: resp === pct ? t.accentBg : 'transparent',
                            color: resp === pct ? t.accent : t.textSub,
                            fontSize: 11, fontWeight: 800, cursor: 'pointer',
                            transition: '0.2s', opacity: saving ? 0.6 : 1
                          }}>{pct === 0 ? '0%' : pct + '%'}</button>
                      ))}
                    </div>
                  )}
                </div>
              )
            }) : <div style={{ fontSize: 12, color: t.textSub, fontStyle: 'italic' }}>Menu being prepared...</div>}
          </div>
        )}

        {/* Close button at bottom */}
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
