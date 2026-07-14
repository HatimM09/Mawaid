import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/firebaseClient'
import { useAuth } from '../admin/context'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { DAYS, getWeekDate } from '../common/utils'
import { isRotiItem, isCountInput, canEditMeal, isSurveyOpen, useSurveyAutoSave, normalizeDishValue, denormalizeDishValue, hasUserOverride } from '../hooks/useSurvey'

const THEME = {
  bg: '#0d0d1a', card: 'rgba(255,255,255,0.03)', cardActive: 'rgba(255,255,255,0.06)',
  border: 'rgba(139,92,246,0.15)', borderActive: 'rgba(139,92,246,0.4)',
  accent: '#D4AF37', accentGrad: 'linear-gradient(135deg, #D4AF37, #B8860B)',
  accentBg: 'rgba(212,175,55,0.1)', text: '#f0f0f5', textSub: 'rgba(240,240,245,0.5)',
  inputBg: 'rgba(255,255,255,0.05)', successText: '#4CAF50'
}

const SkeletonDish = () => (
  <div style={{ padding: '10px 14px', borderRadius: 12, background: THEME.card, border: `1px solid ${THEME.border}`, marginBottom: 8 }}>
    <div style={{ height: 14, width: '60%', borderRadius: 6, background: THEME.border, marginBottom: 10 }} />
    <div style={{ display: 'flex', gap: 6 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ flex: 1, height: 32, borderRadius: 8, background: THEME.border }} />
      ))}
    </div>
  </div>
)

export default function SurveyModal({ onClose, appSettings = {} }) {
  const { user } = useAuth()
  const weeklyMenu = useWeeklyMenu() || {}
  const [currentDayIndex, setCurrentDayIndex] = useState(0)
  const [currentMeal, setCurrentMeal] = useState('lunch')
  const [wantsFood, setWantsFood] = useState(null)
  const wantsFoodRef = useRef(null)
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(false)
  const [existingData, setExistingData] = useState(null)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [userData, setUserData] = useState({ thali_no: '', email: user?.email })
  const [surveySubmitted, setSurveySubmitted] = useState(false)
  const { autoSaveStatus, scheduleSave } = useSurveyAutoSave()
  const saveTimerRef = useRef(null)
  const advancingRef = useRef(false)
  const justLoadedRef = useRef(false)

  const [editResponseMode, setEditResponseMode] = useState(false)
  const currentWeekId = getWeekDate(appSettings)
  const currentDay = DAYS[currentDayIndex]
  const menu = weeklyMenu[currentDay] || { lunch: [], dinner: [] }
  const dayKey = currentDay.substring(0, 3).toLowerCase()
  const mealKey = currentMeal === 'lunch' ? 'l' : 'd'
  const isEditable = canEditMeal(currentDay, currentWeekId, currentMeal, appSettings, user?.id)
  const surveyOpen = isSurveyOpen(appSettings, user?.id)
  const postSubmitEditUsed = existingData?.edit_metadata?.[`${dayKey}_${mealKey}_used`] || false
  const canPostSubmitEdit = surveySubmitted && isEditable && !postSubmitEditUsed
  const editBlocked = !isEditable || (surveySubmitted && postSubmitEditUsed && isEditable) || (!surveyOpen && !isEditable)
  const totalSlots = 12
  const currentSlot = currentDayIndex * 2 + (currentMeal === 'lunch' ? 0 : 1)
  const isLast = currentDayIndex === 5 && currentMeal === 'dinner'
  const dishes = menu[currentMeal] || []

  const dayStatusSummary = DAYS.map((day) => {
    const dk = day.substring(0, 3).toLowerCase()
    const lStatus = existingData?.[`${dk}_l_status`]
    const dStatus = existingData?.[`${dk}_d_status`]
    if (lStatus && dStatus) return 'complete'
    if (lStatus || dStatus) return 'partial'
    return 'pending'
  })

  const allSlotsFilled = existingData && DAYS.every(day => {
    const dk = day.substring(0, 3).toLowerCase()
    return existingData[`${dk}_l_status`] && existingData[`${dk}_d_status`]
  })

  const loadExisting = useCallback(async () => {
    try {
      if (!userData.thali_no) {
        const { data: u } = await supabase.from('user_stats').select('thali_number, email').eq('user_id', user?.id).maybeSingle()
        if (u) setUserData({ thali_no: u.thali_number || '', email: u.email || user?.email })
      }
      const { data } = await supabase.from('survey_submissions_flat')
        .select('*').eq('user_id', user?.id)
        .order('week_id', { ascending: false }).limit(1).maybeSingle()
      let existing = null
      if (data && data.week_id === currentWeekId) existing = data
      setExistingData(existing)
      setDataLoaded(true)
      // Check if survey was already submitted (all 12 slots filled or local flag set)
      const localSubmitted = localStorage.getItem(`survey_submitted_${currentWeekId}_${user?.id}`) === '1'
      const allDone = existing && DAYS.every(day => {
        const dk = day.substring(0, 3).toLowerCase()
        return existing[`${dk}_l_status`] && existing[`${dk}_d_status`]
      })
      setSurveySubmitted(!!allDone || localSubmitted)
      if (existing && surveyOpen && !allDone && !localSubmitted) {
        for (let d = 0; d < 6; d++) {
          const day = DAYS[d]
          const dk = day.substring(0, 3).toLowerCase()
          for (const meal of ['lunch', 'dinner']) {
            const mk = meal === 'lunch' ? 'l' : 'd'
            if (!existing[`${dk}_${mk}_status`]) {
              setCurrentDayIndex(d)
              setCurrentMeal(meal)
              return
            }
          }
        }
      }
    } catch {
      setDataLoaded(true)
    }
  }, [user, currentWeekId, surveyOpen, userData.thali_no])

  useEffect(() => { loadExisting() }, [loadExisting])

  const populateFromExisting = useCallback(() => {
    justLoadedRef.current = true
    if (!existingData) { setWantsFood(null); setResponses({}); return }
    const statusKey = `${dayKey}_${mealKey}_status`
    const status = existingData[statusKey]
    if (status) {
      wantsFoodRef.current = status === 'Applied'
      if (status === 'Applied') {
        setWantsFood(true)
        const dishRes = {}
        dishes.forEach((dish, idx) => {
          const val = existingData[`${dayKey}_${mealKey}_dish_${idx + 1}`]
          if (val !== undefined && val !== null) {
            dishRes[dish] = normalizeDishValue(val, dish, isCountInput(appSettings, currentDay, currentMeal, idx))
          }
        })
        setResponses(dishRes)
      } else { setWantsFood(false); setResponses({}) }
    } else { setWantsFood(null); setResponses({}) }
  }, [existingData, dayKey, mealKey, dishes, appSettings, currentDay, currentMeal])

  useEffect(() => {
    if (!dataLoaded) return
    populateFromExisting()
  }, [currentDayIndex, currentMeal, dataLoaded])

  useEffec
  // ── Restore draft from localStorage on mount ──
  useEffect(() => {
    if (!dataLoaded) return
    const draft = loadDraft()
    if (draft && !existingData) {
      console.log('[SurveyModal] Draft restored from localStorage')
      if (draft.responses && Object.keys(draft.responses).length > 0) {
        setResponses(draft.responses)
      }
    }
  }, [dataLoaded])
t(() => {
    setEditResponseMode(false)
  }, [currentDayIndex, currentMeal])

  useEffect(() => {
    if (!dataLoaded) return
    if (!editResponseMode && surveySubmitted) return
    if (wantsFood === null && Object.keys(responses).length === 0) return
    if (advancingRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (wantsFoodRef.current === null && wantsFood === null) return
      await saveCurrentSlot()
    }, 600)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [wantsFood, responses, currentDayIndex, currentMeal, dataLoaded, editResponseMode])

  useEffect(() => {
    if (justLoadedRef.current || surveySubmitted) { justLoadedRef.current = false; return }
    if (advancingRef.current) return
    if (!wantsFood) return
    const allDishesFilled = dishes.every(dish => {
      const resp = responses[dish]
      if (isRotiItem(dish)) return resp === 'yes' || resp === 'no'
      if (isCountInput(appSettings, currentDay, currentMeal, dishes.indexOf(dish))) {
        return resp && resp.status === 'yes' && resp.value > 0
      }
      return typeof resp === 'number'
    })
    if (allDishesFilled && !isLast) {
      advancingRef.current = true
      setTimeout(async () => { await saveCurrentSlot(); goToNext(); advancingRef.current = false }, 300)
    }
  }, [responses, currentDayIndex, currentMeal, dishes])


  // ── Auto-save responses to localStorage as draft ──
  useEffect(() => {
    if (Object.keys(responses).length === 0) return
    if (initialLoadRef?.current) return
    const timer = setTimeout(() => {
      saveDraft({ responses, updatedAt: new Date().toISOString() })
    }, 800)
    return () => clearTimeout(timer)
  }, [responses])
  const goToPrev = () => {
    if (currentSlot === 0) return
    if (currentMeal === 'lunch') { setCurrentMeal('dinner'); setCurrentDayIndex(currentDayIndex - 1) }
    else { setCurrentMeal('lunch') }
    setWantsFood(null); setResponses({})
  }

  const goToNext = () => {
    if (isLast) return
    if (currentMeal === 'lunch') { setCurrentMeal('dinner') }
    else { setCurrentDayIndex(currentDayIndex + 1); setCurrentMeal('lunch') }
    setWantsFood(null); setResponses({})
  }

  const saveAndLockEdit = async () => {
    if (wantsFoodRef.current === null) return
    if (loading) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setLoading(true)
    try {
      const updateObj = {
        user_id: user?.id, week_id: currentWeekId,
        thali_number: userData.thali_no, email: userData.email,
        updated_at: new Date().toISOString()
      }
      const status = wantsFoodRef.current ? 'Applied' : 'Skipped'
      updateObj[`${dayKey}_${mealKey}_status`] = status
      const currentEditCount = existingData?.edit_metadata?.[`${dayKey}_${mealKey}`] || 0
      const editMeta = { ...(existingData?.edit_metadata || {}), [`${dayKey}_${mealKey}`]: currentEditCount + 1 }
      editMeta[`${dayKey}_${mealKey}_used`] = true
      updateObj.edit_metadata = editMeta
      if (wantsFoodRef.current) {
        dishes.forEach((dish, idx) => {
          const val = responses[dish]
          const isCount = isCountInput(appSettings, currentDay, currentMeal, idx)
          if (val !== undefined) updateObj[`${dayKey}_${mealKey}_dish_${idx + 1}`] = denormalizeDishValue(val, dish, isCount)
        })
      }
      const { error } = await supabase.from('survey_submissions_flat')
        .upsert([updateObj], { onConflict: 'user_id,week_id' })
      if (error) throw error
      const { data: refreshed } = await supabase.from('survey_submissions_flat')
        .select('*').eq('user_id', user?.id).eq('week_id', currentWeekId).maybeSingle()
      if (refreshed) setExistingData(refreshed)
      setEditResponseMode(false)
    } catch (err) {
      console.error('Save edit error:', err)
    } finally { setLoading(false) }
  }

  const saveCurrentSlot = async () => {
    if (wantsFoodRef.current === null) return
    if (loading) return
    setLoading(true)
    try {
      const updateObj = {
        user_id: user?.id, week_id: currentWeekId,
        thali_number: userData.thali_no, email: userData.email,
        updated_at: new Date().toISOString()
      }
      const status = wantsFood ? 'Applied' : 'Skipped'
      updateObj[`${dayKey}_${mealKey}_status`] = status
      const currentEditCount = existingData?.edit_metadata?.[`${dayKey}_${mealKey}`] || 0
      const editMeta = { ...(existingData?.edit_metadata || {}), [`${dayKey}_${mealKey}`]: currentEditCount + 1 }
      updateObj.edit_metadata = editMeta
      if (wantsFood) {
        dishes.forEach((dish, idx) => {
          const val = responses[dish]
          const isCount = isCountInput(appSettings, currentDay, currentMeal, idx)
          if (val !== undefined) updateObj[`${dayKey}_${mealKey}_dish_${idx + 1}`] = denormalizeDishValue(val, dish, isCount)
        })
      }
      const { error } = await supabase.from('survey_submissions_flat')
        .upsert([updateObj], { onConflict: 'user_id,week_id' })
      if (error) throw error
      const { data: refreshed } = await supabase.from('survey_submissions_flat')
        .select('*').eq('user_id', user?.id).eq('week_id', currentWeekId).maybeSingle()
      if (refreshed) setExistingData(refreshed)
    } catch (err) {
      console.error('Save error:', err)
    } finally { setLoading(false) }
  }

  const handleSubmitFullWeek = async () => {
    await saveCurrentSlot()
    if (isLast) {
      setSurveySubmitted(true)
      await supabase.from('notifications').insert({
        user_id: user?.id, title: 'Weekly Survey Submitted',
        message: 'Your full week survey (Mon–Sat) has been saved.',
        url: '/post', type: 'survey'
      })
      // Notify admins that a user submitted their survey
      try {
        await supabase.functions.invoke('sendPush', {
          body: {
            title: '📋 Survey Response Received',
            body: `${userData.thali_no || user?.email || 'A user'} submitted their full week survey.`,
            url: '/admin/survey-tracking',
            target_type: 'admins',
          }
        })
      } catch (e) { console.warn('[SurveyModal] Admin push skipped:', e) }
      // Block further edits for this week by setting a local flag
      localStorage.setItem(`survey_submitted_${currentWeekId}_${user?.id}`, '1')
      clearDraft()
      onClose()
    }
  }

  const DayBar = () => (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, padding: '0 4px' }}>
      {DAYS.map((day, idx) => {
        const summary = dayStatusSummary[idx]
        const color = summary === 'complete' ? '#4CAF50' : summary === 'partial' ? '#FF9800' : THEME.border
        const isActive = idx === currentDayIndex
        return (
          <button key={day} onClick={() => setCurrentDayIndex(idx)} style={{
            flex: 1, padding: '8px 4px', borderRadius: 10, border: `1.5px solid ${isActive ? THEME.accent : color}`,
            background: isActive ? THEME.accentBg : 'transparent', cursor: 'pointer',
            color: isActive ? THEME.accent : THEME.textSub, fontSize: 10, fontWeight: 700, textAlign: 'center',
            transition: 'all 0.2s', fontFamily: "'DM Sans',sans-serif"
          }}>
            <div>{day.charAt(0).toUpperCase() + day.slice(1, 3)}</div>
            <div style={{ fontSize: 8, marginTop: 2 }}>{summary === 'complete' ? '✓' : summary === 'partial' ? '◐' : '○'}</div>
          </button>
        )
      })}
    </div>
  )

  const DishSelector = ({ dish, idx }) => {
    const isRoti = isRotiItem(dish)
    const isCount = !isRoti && isCountInput(appSettings, currentDay, currentMeal, idx)
    const resp = responses[dish]

    if (isRoti) {
      return (
        <div style={{ marginBottom: 8, padding: '10px 14px', borderRadius: 12, background: THEME.card, border: `1px solid ${resp ? THEME.accent : THEME.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text, marginBottom: 8, fontFamily: "'DM Sans',sans-serif" }}>{dish}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['yes', 'no'].map(opt => (
              <button key={opt} onClick={() => setResponses(prev => ({ ...prev, [dish]: opt }))} style={{
                flex: 1, padding: '8px', borderRadius: 8,
                border: `1.5px solid ${resp === opt ? '#4CAF50' : THEME.border}`,
                background: resp === opt ? 'rgba(76,175,80,0.12)' : 'transparent',
                color: resp === opt ? '#4CAF50' : THEME.textSub,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif"
              }}>{opt === 'yes' ? '✅ Yes' : '❌ No'}</button>
            ))}
          </div>
        </div>
      )
    }

    if (isCount) {
      const isSkipped = resp === 'no'
      const value = resp?.value || 0
      return (
        <div style={{ marginBottom: 8, padding: '10px 14px', borderRadius: 12, background: THEME.card, border: `1px solid ${resp && resp.status === 'yes' ? THEME.accent : isSkipped ? '#F4433660' : THEME.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text, marginBottom: 8, fontFamily: "'DM Sans',sans-serif" }}>{dish}</div>
          {isSkipped ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#F44336', fontWeight: 700 }}>❌ Skipped</span>
              <button onClick={() => setResponses(prev => ({ ...prev, [dish]: { status: 'yes', value: 1 } }))} style={{
                marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${THEME.accent}`,
                background: THEME.accentBg, color: THEME.accent,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif"
              }}>✅ Add back</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setResponses(prev => ({ ...prev, [dish]: { status: 'yes', value: Math.max(0, value - 1) } }))} style={{
                width: 36, height: 36, borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.inputBg, color: THEME.text, cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>−</button>
              <span style={{ fontSize: 20, fontWeight: 800, color: THEME.accent, minWidth: 40, textAlign: 'center', fontFamily: "'DM Sans',sans-serif" }}>{value}</span>
              <button onClick={() => setResponses(prev => ({ ...prev, [dish]: { status: 'yes', value: Math.min(99, value + 1) } }))} style={{
                width: 36, height: 36, borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.inputBg, color: THEME.text, cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>+</button>
              <button onClick={() => setResponses(prev => ({ ...prev, [dish]: 'no' }))} style={{
                marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${THEME.border}`,
                background: 'transparent', color: THEME.textSub,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif"
              }}>Skip</button>
            </div>
          )}
        </div>
      )
    }

    return (
      <div style={{ marginBottom: 8, padding: '10px 14px', borderRadius: 12, background: THEME.card, border: `1px solid ${resp !== undefined ? THEME.accent : THEME.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text, marginBottom: 8, fontFamily: "'DM Sans',sans-serif" }}>{dish}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 25, 50, 75, 100].map(pct => (
            <button key={pct} onClick={() => setResponses(prev => ({ ...prev, [dish]: pct }))} style={{
              flex: 1, padding: '8px 4px', borderRadius: 8,
              border: `1.5px solid ${resp === pct ? THEME.accent : THEME.border}`,
              background: resp === pct ? THEME.accentBg : 'transparent',
              color: resp === pct ? THEME.accent : THEME.textSub,
              fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: '0.2s', fontFamily: "'DM Sans',sans-serif"
            }}>{pct === 0 ? '0%' : pct + '%'}</button>
          ))}
        </div>
      </div>
    )
  }

  if (!dataLoaded) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', padding: 20 }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ background: THEME.card, borderRadius: 32, padding: 32, maxWidth: 600, width: '100%', border: `1px solid ${THEME.border}` }}>
          {[1, 2, 3].map(i => <SkeletonDish key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', padding: 'clamp(12px, 3vw, 24px)', backdropFilter: 'blur(15px)', overflowY: 'auto'
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: THEME.card, borderRadius: 32, padding: 'clamp(20px, 5vw, 32px)',
        maxWidth: 600, width: '100%', border: `1.5px solid ${THEME.borderActive}`,
        boxShadow: '0 40px 100px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, background: THEME.accentGrad, borderRadius: '50%', filter: 'blur(60px)', opacity: 0.08 }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: THEME.accent, fontFamily: "'DM Sans',sans-serif", marginBottom: 4 }}>Weekly Survey</div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: THEME.text, fontFamily: "'Playfair Display',serif" }}>
              {currentDay.charAt(0).toUpperCase() + currentDay.slice(1)} &bull; {currentMeal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {autoSaveStatus === 'saving' && <span style={{ fontSize: 11, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif" }}>Saving...</span>}
            {autoSaveStatus === 'saved' && <span style={{ fontSize: 11, color: THEME.successText, fontFamily: "'DM Sans',sans-serif" }}>✓ Saved</span>}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 10, color: THEME.textSub, display: 'flex' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        <DayBar />

        {surveySubmitted && !editResponseMode && canPostSubmitEdit && (
          <div style={{ padding: 20, borderRadius: 16, background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(184,134,11,0.02))', border: `1px solid ${THEME.accent}`, marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: THEME.accent, marginBottom: 8, fontFamily: "'DM Sans',sans-serif" }}>📝 Survey Submitted — Edit Available</div>
            <div style={{ fontSize: 13, color: THEME.textSub, marginBottom: 14, fontFamily: "'DM Sans',sans-serif" }}>You can edit your response for this meal slot once. After saving, further edits will be locked.</div>
            <button onClick={() => setEditResponseMode(true)} style={{
              padding: '12px 28px', borderRadius: 12, border: 'none',
              background: THEME.accentGrad, color: '#000', cursor: 'pointer',
              fontSize: 14, fontWeight: 800, fontFamily: "'DM Sans',sans-serif",
              boxShadow: `0 6px 16px ${THEME.accentBg}`
            }}>✏️ Edit Response</button>
          </div>
        )}

        {surveySubmitted && !editResponseMode && !canPostSubmitEdit && (
          <div style={{ padding: 20, borderRadius: 16, background: 'linear-gradient(135deg, rgba(76,175,80,0.1), rgba(76,175,80,0.02))', border: `1px solid #4CAF50`, marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#4CAF50', marginBottom: 6, fontFamily: "'DM Sans',sans-serif" }}>✅ Survey Already Submitted</div>
            <div style={{ fontSize: 13, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif" }}>You have already submitted your full week survey (Mon–Sat). Responses cannot be modified after submission.</div>
          </div>
        )}

        {editBlocked && !surveySubmitted && (
          <div style={{ padding: 16, borderRadius: 12, background: THEME.accentBg, border: `1px solid ${THEME.accent}`, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: THEME.accent, marginBottom: 4, fontFamily: "'DM Sans',sans-serif" }}>⏰ Edit Window Closed</div>
            <div style={{ fontSize: 12, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif" }}>The editing period for this meal has passed. Survey opens Sat 8PM – Mon 11AM for weekly submissions.</div>
          </div>
        )}

        {(wantsFood === null || editResponseMode) && !editBlocked && (!surveySubmitted || editResponseMode) && (
          <div style={{ marginBottom: 16, padding: 20, borderRadius: 16, background: 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(184,134,11,0.02))', border: `1px solid ${THEME.accent}` }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: THEME.text, marginBottom: 12, fontFamily: "'Playfair Display',serif" }}>
              {editResponseMode ? `Edit your response for ${currentMeal} on ${currentDay}` : `Would you like ${currentMeal} on ${currentDay}?`}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => { wantsFoodRef.current = true; setWantsFood(true) }} style={{
                flex: 1, padding: '14px', borderRadius: 12, border: '1.5px solid #4CAF50',
                background: 'rgba(76,175,80,0.1)', color: '#4CAF50', cursor: 'pointer',
                fontSize: 15, fontWeight: 800, fontFamily: "'DM Sans',sans-serif"
              }}>✅ Yes, I want</button>
              <button onClick={async () => { wantsFoodRef.current = false; setWantsFood(false); if (editResponseMode) { await saveAndLockEdit() } else { await saveCurrentSlot(); goToNext() } }} style={{
                flex: 1, padding: '14px', borderRadius: 12, border: '1.5px solid #F44336',
                background: 'rgba(244,67,54,0.1)', color: '#F44336', cursor: 'pointer',
                fontSize: 15, fontWeight: 800, fontFamily: "'DM Sans',sans-serif"
              }}>❌ No, I'll skip</button>
            </div>
          </div>
        )}

        {(wantsFood && !editBlocked && !surveySubmitted) || (wantsFood && editResponseMode) ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: THEME.accent, marginBottom: 12, fontFamily: "'DM Sans',sans-serif" }}>
              {editResponseMode ? `Edit your portions for ${currentMeal}` : `Select your portions for ${currentMeal}`}
            </div>
            <div style={{ marginBottom: 16 }}>
              {dishes.length > 0 ? dishes.map((dish, idx) => <DishSelector key={idx} dish={dish} idx={idx} />)
                : <div style={{ padding: 16, textAlign: 'center', color: THEME.textSub, fontSize: 13, fontStyle: 'italic' }}>Menu being prepared...</div>}
            </div>
            {editResponseMode && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={saveAndLockEdit} disabled={loading} style={{
                  marginLeft: 'auto', padding: '12px 24px', borderRadius: 12, border: 'none',
                  background: THEME.accentGrad, color: '#000', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13,
                  fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif",
                  boxShadow: `0 8px 20px ${THEME.accentBg}`, opacity: loading ? 0.6 : 1
                }}>{loading ? 'Saving...' : '💾 Save Edit'}</button>
                <button onClick={() => { setEditResponseMode(false); populateFromExisting() }} style={{
                  padding: '12px 20px', borderRadius: 12, border: `1px solid ${THEME.border}`, background: 'transparent',
                  color: THEME.textSub, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans',sans-serif"
                }}>Cancel</button>
              </div>
            )}
          </div>
        ) : null}

        {!surveySubmitted && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, position: 'relative', zIndex: 1 }}>
            {currentSlot > 0 && (
              <button onClick={goToPrev} style={{
                padding: '12px 20px', borderRadius: 12, border: `1px solid ${THEME.border}`, background: 'transparent',
                color: THEME.textSub, cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif"
              }}><ChevronLeft size={16} /> Previous</button>
            )}

            {!isLast && wantsFood && (
              <button onClick={async () => { await saveCurrentSlot(); goToNext() }} style={{
                marginLeft: currentSlot > 0 ? 'auto' : 0, padding: '12px 24px', borderRadius: 12, border: 'none',
                background: THEME.accentGrad, color: '#000', cursor: 'pointer', fontSize: 13,
                fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif",
                boxShadow: `0 8px 20px ${THEME.accentBg}`
              }}>Save & Continue <ChevronRight size={16} /></button>
            )}

            {!isLast && wantsFood === false && (
              <button onClick={async () => { await saveCurrentSlot(); goToNext() }} style={{
                marginLeft: currentSlot > 0 ? 'auto' : 0, padding: '12px 20px', borderRadius: 12, border: `1px solid ${THEME.border}`,
                background: 'transparent', color: THEME.textSub, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif"
              }}>Continue <ChevronRight size={16} /></button>
            )}

            {isLast && (
              <button onClick={handleSubmitFullWeek} style={{
                marginLeft: 'auto', padding: '12px 24px', borderRadius: 12, border: 'none',
                background: THEME.accentGrad, color: '#000', cursor: 'pointer', fontSize: 13,
                fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif",
                boxShadow: `0 8px 20px ${THEME.accentBg}`
              }}>✅ Submit for Whole Week</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
