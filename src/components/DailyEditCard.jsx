// src/components/DailyEditCard.jsx
import React, { useState, useEffect, useRef } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme, useAuth } from '../admin/context'
import { getSurveyTargetWeek } from '../common/utils'
import { submitSurveyRow } from '../lib/submitSurvey'
import { isRotiItem, isCountInput } from '../hooks/useSurvey'
import { fetchUserSurveyRow } from '../lib/surveyRows'

export const getCardMealInfo = (weeklyMenu, appSettings = {}) => {
  const NOW = new Date()
  const curMin = NOW.getHours() * 60 + NOW.getMinutes()
  const dayIdx = NOW.getDay()
  const map = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' }
  const targetMapKey = map[dayIdx === 0 ? 6 : dayIdx] || 'monday'
  const targetMenu = (weeklyMenu && weeklyMenu[targetMapKey]) || { lunch: [], dinner: [] }
  let targetMeal = 'lunch'
  let targetDishes = targetMenu.lunch || []
  if (curMin >= 12 * 60 && curMin < 16 * 60) {
    targetMeal = 'dinner'
    targetDishes = targetMenu.dinner || []
  }
  return { day: targetMapKey, meal: targetMeal, dishes: targetDishes }
}

export const getSurveyCloseHour = (appSettings = {}) => {
  const v = parseInt(appSettings.survey_close_hour, 10)
  return isNaN(v) ? 11 : v
}

export const getEditCloseTime = (appSettings, mealType) => {
  if (mealType === 'lunch') return parseInt(appSettings.lunch_edit_close, 10) || 11
  return parseInt(appSettings.dinner_edit_close, 10) || 15
}

const SkeletonDish = ({ t }) => (
  <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid ' + t.border }}>
    <div style={{ width: 32, height: 32, borderRadius: 10, background: t.inputBg }} />
  </div>
)

const SkeletonBlock = ({ t, count = 3 }) => (
  <div style={{ marginBottom: 12 }}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonDish key={i} t={t} />
    ))}
  </div>
)

export default function DailyEditCard({ weeklyMenu, isOpen = true, onClose = () => {}, onComplete = () => {}, appSettings = {} }) {
  const { user } = useAuth()
  const t = useTheme()
  const [userResponses, setUserResponses] = useState({})
  const [dataLoading, setDataLoading] = useState(false)

  const mi = weeklyMenu ? getCardMealInfo(weeklyMenu, appSettings) : null

  useEffect(() => {
    const load = async () => {
      if (!user || !mi) return
      setDataLoading(true)
      try {
        const weekId = getSurveyTargetWeek(appSettings)
        const res = await fetchUserSurveyRow(user.id, weekId)
        const data = res && res.data
        if (!data) return
        const dayKey = mi.day.substring(0, 3).toLowerCase()
        const mealKey = mi.meal === 'lunch' ? 'l' : 'd'
        const status = data[dayKey + '_' + mealKey + '_status']
        if (status !== 'Applied') return
        const respMap = {}
        mi.dishes.forEach((dish, idx) => {
          const v = data[dayKey + '_' + mealKey + '_dish_' + (idx + 1)]
          if (v !== undefined && v !== null) respMap[dish] = v
        })
        setUserResponses(respMap)
      } finally {
        setDataLoading(false)
      }
    }
    load()
  }, [user, weeklyMenu, appSettings])

  const saveAllResponses = async () => {
    if (!user || dataLoading || !mi) return
    setDataLoading(true)
    try {
      const weekId = getSurveyTargetWeek(appSettings)
      const dayKey = mi.day.substring(0, 3).toLowerCase()
      const res = await fetchUserSurveyRow(user.id, weekId)
      const existing = res && res.data
      if (!existing) return
      const dishValues = {}
      mi.dishes.forEach((d, idx) => {
        const col = dayKey + '_' + (mi.meal === 'lunch' ? 'l' : 'd') + '_dish_' + (idx + 1)
        const val = userResponses[d]
        if (val !== undefined) {
          if (isRotiItem(d)) dishValues['dish_' + (idx + 1)] = val === 'yes' ? 'Yes' : 'No'
          else if (isCountInput(appSettings, mi.day, mi.meal, idx)) dishValues['dish_' + (idx + 1)] = val === 'no' ? 'No' : val
          else dishValues['dish_' + (idx + 1)] = val
        } else if (existing[col] !== undefined && existing[col] !== null) {
          dishValues['dish_' + (idx + 1)] = existing[col]
        }
      })
      const r = await submitSurveyRow({
        userId: user.id,
        weekId,
        day: dayKey,
        meal: mi.meal,
        status: 'Applied',
        dishValues,
        dishSnapshot: mi.dishes,
        thaliNumber: existing.thali_number || null,
        email: existing.email || user.email || null,
      })
      if (r.error) throw r.error
      onComplete()
    } catch (e) {
      setDataLoading(false)
    }
  }

  const cardStyle = { position: 'relative', borderRadius: 20, padding: 22, background: 'rgba(255,255,255,0.03)', border: '1px solid ' + t.border, marginBottom: 20 }
  const headerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }
  const badgeStyle = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: isOpen ? 'rgba(76,175,80,0.08)' : 'transparent', border: '1px solid ' + (isOpen ? 'rgba(76,175,80,0.25)' : t.border) }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {mi && mi.meal === 'lunch' ? <Sun size={16} color="#fff" /> : <Moon size={16} color="#fff" />}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: t.accent, textTransform: 'uppercase' }}>Daily Quick Edit</div>
            <div style={{ fontSize: 13, color: t.text }}>{mi ? mi.day + ' ' + mi.meal : 'Meal'}</div>
          </div>
        </div>
        <div style={badgeStyle}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.successText, display: 'inline-block' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: t.successText }}>Open</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {dataLoading ? <SkeletonBlock t={t} count={3} /> : <div style={{ fontSize: 12, color: t.textSub }}>Menu being prepared...</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button onClick={saveAllResponses} disabled={dataLoading} style={{ minWidth: 120, padding: '10px 16px', borderRadius: 11, background: t.accentGrad, color: '#fff', border: 'none', cursor: 'pointer' }}>
          {dataLoading ? 'Saving...' : 'Submit All Changes'}
        </button>
        <button onClick={onClose} disabled={dataLoading} style={{ padding: '10px 8px', borderRadius: 10, border: '1px solid ' + t.accent, background: 'transparent', color: t.accent, cursor: 'pointer' }}>
          Close
        </button>
      </div>
    </div>
  )
}
