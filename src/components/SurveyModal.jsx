import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight, Check, AlertTriangle, Play } from 'lucide-react'
import { supabase } from '../lib/firebaseClient'
import { useAuth } from '../admin/context'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { DAYS, getWeekDate } from '../common/utils'
import { isRotiItem, isCountInput, canEditMeal, isSurveyOpen, useSurveyAutoSave, normalizeDishValue, denormalizeDishValue, hasUserOverride, getPctColor } from '../hooks/useSurvey'

const THEME = {
  bg: '#0d0d1a', card: 'rgba(255,255,255,0.03)', cardActive: 'rgba(255,255,255,0.06)',
  border: 'rgba(139,92,246,0.15)', borderActive: 'rgba(139,92,246,0.4)',
  accent: '#D4AF37', accentGrad: 'linear-gradient(135deg, #D4AF37, #B8860B)',
  accentBg: 'rgba(212,175,55,0.1)', text: '#f0f0f5', textSub: 'rgba(240,240,245,0.5)',
  inputBg: 'rgba(255,255,255,0.05)', successText: '#4CAF50',
  yesColor: '#4CAF50', yesBg: 'rgba(76,175,80,0.15)',
  noColor: '#F44336', noBg: 'rgba(244,67,54,0.15)',
}

const SURVEY_STYLES = `
@keyframes surveyPop { 0% { transform: scale(0.85); opacity: 0.5; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
@keyframes surveySlideIn { 0% { opacity: 0; transform: translateX(30px); } 100% { opacity: 1; transform: translateX(0); } }
@keyframes surveyGlow { 0%,100% { box-shadow: 0 0 6px rgba(76,175,80,0.2); } 50% { box-shadow: 0 0 18px rgba(76,175,80,0.5); } }
@keyframes surveyBadgePop { 0% { transform: scale(0); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
@keyframes surveyShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
@keyframes surveyCheck { 0% { transform: scale(0) rotate(-45deg); opacity: 0; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
@keyframes surveySuccess { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
@keyframes surveyFadeIn { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes surveyConfetti { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(-200px) rotate(720deg); opacity: 0; } }
`

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
  const [snackDefaults, setSnackDefaults] = useState(null)
  const [surveySubmitted, setSurveySubmitted] = useState(false)
  const { autoSaveStatus, scheduleSave } = useSurveyAutoSave()
  const saveTimerRef = useRef(null)
  const advancingRef = useRef(false)
  const justLoadedRef = useRef(false)

  const [editResponseMode, setEditResponseMode] = useState(false)
  const initialLoadRef = useRef(true)

  // ── NEW UX STATE ──
  const [showIntro, setShowIntro] = useState(true)
  const [errorToast, setErrorToast] = useState(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const currentWeekId = getWeekDate()
  const draftKey = `survey_draft_${currentWeekId}_${user?.id}`
  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(draftKey)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }
  const saveDraft = (data) => {
    try { localStorage.setItem(draftKey, JSON.stringify(data)) } catch {}
  }
  const clearDraft = () => {
    try { localStorage.removeItem(draftKey) } catch {}
  }
  const currentDay = DAYS[currentDayIndex]
  const menu = weeklyMenu[currentDay] || { lunch: [], dinner: [] }
  const dayKey = currentDay.substring(0, 3).toLowerCase()
  const mealKey = currentMeal === 'lunch' ? 'l' : 'd'
  const isEditable = canEditMeal(currentDay, currentWeekId, currentMeal, appSettings, user?.id)
  const surveyOpen = isSurveyOpen(appSettings, user?.id)
  const postSubmitEditUsed = existingData?.edit_metadata?.[`${dayKey}_${mealKey}_used`] || false
  const canPostSubmitEdit = surveySubmitted && isEditable && !postSubmitEditUsed
  const editBlocked = surveySubmitted ? (!isEditable || postSubmitEditUsed) : false
  const totalSlots = 12
  const currentSlot = currentDayIndex * 2 + (currentMeal === 'lunch' ? 0 : 1)
  const isLast = currentDayIndex === 5 && currentMeal === 'dinner'
  const dishes = menu[currentMeal] || []
  const hasDishes = dishes.length > 0

  const dayStatusSummary = DAYS.map((day) => {
    const dk = day.substring(0, 3).toLowerCase()
    const lStatus = existingData?.[`${dk}_l_status`]
    const dStatus = existingData?.[`${dk}_d_status`]
    if (lStatus && dStatus) return 'complete'
    if (lStatus || dStatus) return 'partial'
    return 'pending'
  })

  // ── ESCAPE KEY TO CLOSE ──
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // ── AUTO-CLEAR ERROR TOAST ──
  useEffect(() => {
    if (!errorToast) return
    const t = setTimeout(() => setErrorToast(null), 4000)
    return () => clearTimeout(t)
  }, [errorToast])

  const loadExisting = useCallback(async () => {
    try {
      if (!userData.thali_no) {
        const { data: u } = await supabase.from('user_stats').select('thali_number, email, snack_defaults').eq('user_id', user?.id).maybeSingle()
        if (u) {
          setUserData({ thali_no: u.thali_number || '', email: u.email || user?.email })
          setSnackDefaults(u.snack_defaults || null)
        }
      }
      const { data } = await supabase.from('survey_submissions_flat')
        .select('*').eq('user_id', user?.id)
        .order('week_id', { ascending: false }).limit(1).maybeSingle()
      let existing = null
      if (data && data.week_id === currentWeekId) existing = data
      setExistingData(existing)
      setDataLoaded(true)
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

  // ── Show intro once per session if not submitted and no existing partial data ──
  useEffect(() => {
    if (dataLoaded && !surveySubmitted && !existingData) {
      const seen = localStorage.getItem('almawaid_survey_intro_seen')
      if (!seen) {
        setShowIntro(true)
      }
    }
  }, [dataLoaded, surveySubmitted, existingData])
  // Mark intro as seen when user starts survey
  const handleStartSurvey = useCallback(() => {
    try { localStorage.setItem('almawaid_survey_intro_seen', '1') } catch {}
    setShowIntro(false)
  }, [])

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
    initialLoadRef.current = false
  }, [dataLoaded])

  useEffect(() => {
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

  // ── Auto-advance when all dishes filled (with 800ms delay instead of 300ms) ──
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
      setTimeout(async () => { await saveCurrentSlot(); goToNext(); advancingRef.current = false }, 800)
    }
  }, [responses, currentDayIndex, currentMeal, dishes])

  const skipTimerRef = useRef(null)
  // ── Auto-skip empty menu slots ──
  useEffect(() => {
    if (!dataLoaded || surveySubmitted || editResponseMode || showIntro) return
    if (wantsFood !== null) return
    if (dishes.length === 0 && !isEditable) {
      wantsFoodRef.current = false
      setWantsFood(false)
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current)
      skipTimerRef.current = setTimeout(async () => {
        await saveCurrentSlot()
        if (!isLast) goToNext()
      }, 300)
      return () => { if (skipTimerRef.current) clearTimeout(skipTimerRef.current) }
    }
  }, [dataLoaded, currentDayIndex, currentMeal, dishes, isEditable, surveySubmitted, editResponseMode, showIntro, wantsFood])

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
    setAnimatingDayDir('left')
    if (currentMeal === 'lunch') { setCurrentMeal('dinner'); setCurrentDayIndex(currentDayIndex - 1) }
    else { setCurrentMeal('lunch') }
    setWantsFood(null); setResponses({})
    setTimeout(() => setAnimatingDayDir(null), 350)
  }

  const goToNext = () => {
    if (isLast) return
    setAnimatingDayDir('right')
    if (currentMeal === 'lunch') { setCurrentMeal('dinner') }
    else { setCurrentDayIndex(currentDayIndex + 1); setCurrentMeal('lunch') }
    setWantsFood(null); setResponses({})
    setTimeout(() => setAnimatingDayDir(null), 350)
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
      setErrorToast('Failed to save edit. Please try again.')
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
      setErrorToast('Failed to save. Your draft is preserved locally.')
    } finally { setLoading(false) }
  }

  const handleSubmitFullWeek = async () => {
    await saveCurrentSlot()
    if (isLast) {
      setShowReview(true)
    }
  }

  // ── BATCH SELECT / CLEAR ALL ──
  const selectAllDishes = useCallback(() => {
    const newResponses = {}
    dishes.forEach((dish, idx) => {
      if (isRotiItem(dish)) {
        newResponses[dish] = 'yes'
      } else if (isCountInput(appSettings, currentDay, currentMeal, idx)) {
        newResponses[dish] = { status: 'yes', value: 1 }
      } else {
        newResponses[dish] = 100
      }
    })
    setResponses(prev => ({ ...prev, ...newResponses }))
  }, [dishes, appSettings, currentDay, currentMeal])

  const clearAllDishes = useCallback(() => {
    const newResponses = {}
    dishes.forEach((dish, idx) => {
      if (isRotiItem(dish)) {
        newResponses[dish] = 'no'
      } else if (isCountInput(appSettings, currentDay, currentMeal, idx)) {
        newResponses[dish] = 'no'
      } else {
        newResponses[dish] = 0
      }
    })
    setResponses(prev => ({ ...prev, ...newResponses }))
  }, [dishes, appSettings, currentDay, currentMeal])

  const allSlotsFilled = useMemo(() => {
    if (!existingData) return false
    return DAYS.every(day => {
      const dk = day.substring(0, 3).toLowerCase()
      return existingData[`${dk}_l_status`] && existingData[`${dk}_d_status`]
    })
  }, [existingData])

  const handleConfirmAll = async () => {
    if (!allSlotsFilled) return
    setLoading(true)
    setErrorToast(null)
    try {
      await supabase.from('notifications').insert({
        user_id: user?.id, title: 'Weekly Survey Submitted',
        message: 'Your full week survey (Mon–Sat) has been saved.',
        url: '/post', type: 'survey'
      })
      try {
        await supabase.functions.invoke('send-push', {
          body: {
            title: 'Al-Mawaid · Weekly survey in',
            body: `Thali ${userData.thali_no || '—'} submitted the full week meal plan.`,
            url: '/admin/survey-tracking',
            target_type: 'admins',
          }
        })
      } catch (e) { console.warn('[SurveyModal] Admin push skipped:', e) }
      localStorage.setItem(`survey_submitted_${currentWeekId}_${user?.id}`, '1')
      clearDraft()
      setSurveySubmitted(true)
      // ── Show success celebration before closing ──
      setShowSuccess(true)
      setTimeout(() => { setShowSuccess(false); onClose() }, 2200)
    } catch (e) {
      console.error('Confirm submit error:', e)
      setErrorToast('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const [showReview, setShowReview] = useState(false)
  const [animatingDayDir, setAnimatingDayDir] = useState(null)

  const handleDayChange = useCallback((newIdx) => {
    if (newIdx === currentDayIndex) return
    setAnimatingDayDir(newIdx > currentDayIndex ? 'right' : 'left')
    setCurrentDayIndex(newIdx)
    setWantsFood(null)
    setResponses({})
    setTimeout(() => setAnimatingDayDir(null), 350)
  }, [currentDayIndex])

  const DayBar = () => (
    <div style={{
      display: 'flex', gap: 5, marginBottom: 20, padding: '4px',
      background: 'rgba(255,255,255,0.02)', borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.04)'
    }}>
      {DAYS.map((day, idx) => {
        const summary = dayStatusSummary[idx]
        const isComplete = summary === 'complete'
        const isPartial = summary === 'partial'
        const isActive = idx === currentDayIndex
        const dotColor = isComplete ? THEME.yesColor : isPartial ? '#FF9800' : THEME.textSub
        return (
          <button
            key={day}
            onClick={() => handleDayChange(idx)}
            style={{
              flex: 1, padding: '9px 4px', borderRadius: 11,
              border: `1.5px solid ${isActive ? THEME.accent : 'transparent'}`,
              background: isActive ? `linear-gradient(135deg, ${THEME.accentBg}, rgba(212,175,55,0.04))` : 'transparent',
              cursor: 'pointer',
              color: isActive ? THEME.accent : isComplete ? THEME.yesColor : THEME.textSub,
              fontSize: 11, fontWeight: isActive ? 900 : 700, textAlign: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: "'DM Sans',sans-serif",
              position: 'relative',
              opacity: isActive ? 1 : isComplete ? 0.85 : 0.6,
            }}
            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = THEME.border; e.currentTarget.style.opacity = '1' } }}
            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.opacity = isComplete ? '0.85' : '0.6' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontSize: 10 }}>{day.charAt(0).toUpperCase() + day.slice(1, 3)}</span>
              {isComplete && <span style={{ fontSize: 8, color: THEME.yesColor }}>✓</span>}
              {isPartial && !isComplete && <span style={{ fontSize: 8, color: '#FF9800' }}>◐</span>}
            </div>
            <div style={{
              width: 4, height: 4, borderRadius: '50%',
              background: isActive ? THEME.accent : dotColor,
              margin: '3px auto 0',
              transition: 'all 0.3s',
              boxShadow: isActive ? `0 0 6px ${THEME.accent}` : 'none',
            }} />
          </button>
        )
      })}
    </div>
  )

  const [animatingDish, setAnimatingDish] = useState(null)
  const [animatingOpt, setAnimatingOpt] = useState(null)

  const handleDishResponse = useCallback((dish, value) => {
    setAnimatingDish(dish)
    setAnimatingOpt(value)
    setTimeout(() => setAnimatingDish(null), 400)
    setTimeout(() => setAnimatingOpt(null), 600)
    setResponses(prev => ({ ...prev, [dish]: value }))
  }, [])

  const DishSelector = ({ dish, idx, maxCount }) => {
    const isRoti = isRotiItem(dish)
    const isCount = !isRoti && isCountInput(appSettings, currentDay, currentMeal, idx)
    const resp = responses[dish]
    const isAnimating = animatingDish === dish

    if (isRoti) {
      const sel = resp
      return (
        <div style={{
          marginBottom: 10,
          padding: '12px 16px',
          borderRadius: 14,
          background: sel ? `linear-gradient(135deg, ${sel === 'yes' ? THEME.yesBg : THEME.noBg}, ${THEME.card})` : THEME.card,
          border: `1.5px solid ${sel ? (sel === 'yes' ? THEME.yesColor : THEME.noColor) : THEME.border}`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: isAnimating ? 'surveyPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: THEME.text, marginBottom: 10, fontFamily: "'DM Sans',sans-serif" }}>{dish}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['yes', 'no'].map(opt => {
              const isSelected = sel === opt
              const isYes = opt === 'yes'
              const color = isYes ? THEME.yesColor : THEME.noColor
              const bg = isYes ? THEME.yesBg : THEME.noBg
              return (
                <button
                  key={opt}
                  onClick={() => handleDishResponse(dish, opt)}
                  style={{
                    flex: 1, padding: '12px 8px', borderRadius: 10,
                    border: `2px solid ${isSelected ? color : THEME.border}`,
                    background: isSelected ? bg : 'transparent',
                    color: isSelected ? color : THEME.textSub,
                    fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                    boxShadow: isSelected ? `0 4px 12px ${color}30` : 'none',
                    letterSpacing: '0.02em',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {isSelected && (
                    <span style={{
                      position: 'absolute', top: -2, right: -2, width: 16, height: 16,
                      borderRadius: '0 10px 0 10px',
                      background: color,
                      animation: 'surveyBadgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}>
                      <span style={{ position: 'absolute', top: 0, right: 3, fontSize: 9, fontWeight: 900, color: '#000' }}>✓</span>
                    </span>
                  )}
                  {opt === 'yes' ? '✅ Yes, please' : '❌ No, skip'}
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    if (isCount) {
      const isYes = resp && resp.status === 'yes'
      const isSkipped = resp === 'no'
      const value = resp?.value || 0
      const maxVal = maxCount != null ? maxCount : 99
      const atMax = value >= maxVal
      const showToggle = resp === undefined || resp === null
      const borderColor = isYes ? THEME.yesColor : isSkipped ? THEME.noColor : THEME.border
      return (
        <div style={{
          marginBottom: 10, padding: '12px 16px', borderRadius: 14,
          background: isYes ? `linear-gradient(135deg, ${THEME.yesBg}, ${THEME.card})` :
                     isSkipped ? `linear-gradient(135deg, ${THEME.noBg}, ${THEME.card})` : THEME.card,
          border: `1.5px solid ${borderColor}`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: isAnimating ? 'surveyPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: THEME.text, marginBottom: 10, fontFamily: "'DM Sans',sans-serif", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{dish}</span>
            {maxCount != null && <span style={{ fontSize: 11, color: THEME.textSub, fontWeight: 500, background: THEME.cardActive, padding: '2px 8px', borderRadius: 6 }}>Max: {maxCount}</span>}
          </div>
          {showToggle ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => handleDishResponse(dish, { status: 'yes', value: 1 })}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 10,
                  border: `2px solid ${THEME.yesColor}`, background: THEME.yesBg, color: THEME.yesColor,
                  fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: `0 4px 12px ${THEME.yesColor}20`,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >✅ Yes</button>
              <button onClick={() => handleDishResponse(dish, 'no')}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 10,
                  border: `2px solid ${THEME.noColor}`, background: THEME.noBg, color: THEME.noColor,
                  fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >❌ No</button>
            </div>
          ) : isSkipped ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{
                padding: '6px 14px', borderRadius: 8, background: THEME.noBg,
                border: `1px solid ${THEME.noColor}40`, color: THEME.noColor,
                fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
              }}>❌ Skipped</div>
              <button onClick={() => handleDishResponse(dish, { status: 'yes', value: 1 })}
                style={{
                  marginLeft: 'auto', padding: '10px 20px', borderRadius: 10,
                  border: `1.5px solid ${THEME.accent}`, background: THEME.accentBg,
                  color: THEME.accent, fontSize: 13, fontWeight: 800,
                  cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = THEME.accentGrad; e.currentTarget.style.color = '#000' }}
                onMouseLeave={e => { e.currentTarget.style.background = THEME.accentBg; e.currentTarget.style.color = THEME.accent }}
              >✅ Add back</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: THEME.yesBg, borderRadius: 10,
                padding: '4px 6px', border: `1px solid ${THEME.yesColor}30`,
              }}>
                <button onClick={() => handleDishResponse(dish, { status: 'yes', value: Math.max(0, value - 1) })}
                  style={{
                    width: 36, height: 36, borderRadius: 9,
                    border: `1px solid ${THEME.yesColor}40`, background: THEME.inputBg,
                    color: THEME.text, cursor: 'pointer', fontSize: 18, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = THEME.yesBg }}
                  onMouseLeave={e => { e.currentTarget.style.background = THEME.inputBg }}
                >−</button>
                <div style={{ textAlign: 'center', minWidth: 48 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: THEME.yesColor, lineHeight: 1, fontFamily: "'DM Sans',sans-serif" }}>{value}</div>
                  <div style={{ fontSize: 9, color: THEME.textSub, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{value === 1 ? 'person' : 'persons'}</div>
                </div>
                <button onClick={() => { if (!atMax) handleDishResponse(dish, { status: 'yes', value: Math.min(maxVal, value + 1) }) }}
                  style={{
                    width: 36, height: 36, borderRadius: 9,
                    border: `1px solid ${atMax ? THEME.noColor + '40' : THEME.yesColor + '40'}`, background: THEME.inputBg,
                    color: atMax ? THEME.textSub : THEME.text,
                    cursor: atMax ? 'not-allowed' : 'pointer', fontSize: 18, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: atMax ? 0.4 : 1, transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!atMax) e.currentTarget.style.background = THEME.yesBg }}
                  onMouseLeave={e => { if (!atMax) e.currentTarget.style.background = THEME.inputBg }}
                >+</button>
              </div>
              <button onClick={() => handleDishResponse(dish, 'no')}
                style={{
                  padding: '10px 18px', borderRadius: 10, border: `1.5px solid ${THEME.noColor}50`,
                  background: 'transparent', color: THEME.noColor,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = THEME.noBg }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >❌ Skip</button>
            </div>
          )}
        </div>
      )
    }

    const pctColor = getPctColor(resp)
    const hasResp = resp !== undefined && resp !== null
    return (
      <div style={{
        marginBottom: 10, padding: '12px 16px', borderRadius: 14,
        background: hasResp ? `linear-gradient(135deg, ${pctColor ? `${pctColor}10` : THEME.accentBg}, ${THEME.card})` : THEME.card,
        border: `1.5px solid ${hasResp ? (pctColor || THEME.accent) : THEME.border}`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: isAnimating ? 'surveyPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: THEME.text, marginBottom: 10, fontFamily: "'DM Sans',sans-serif" }}>{dish}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 25, 50, 75, 100].map(pct => {
            const pc = getPctColor(pct)
            const isSelected = resp === pct
            return (
              <button
                key={pct}
                onClick={() => handleDishResponse(dish, pct)}
                style={{
                  flex: 1, padding: '12px 4px', borderRadius: 10,
                  border: `2px solid ${isSelected ? (pc || THEME.accent) : THEME.border}`,
                  background: isSelected ? (pc ? `${pc}20` : THEME.accentBg) : 'transparent',
                  color: isSelected ? (pc || THEME.accent) : THEME.textSub,
                  fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: isSelected ? `0 4px 16px ${pc ? `${pc}30` : `${THEME.accent}30`}` : 'none',
                  letterSpacing: '0.02em',
                  position: 'relative',
                }}
              >
                {pct === 0 ? '0%' : pct + '%'}
                {isSelected && (
                  <span style={{
                    position: 'absolute', top: -3, right: -3, width: 14, height: 14,
                    borderRadius: '50%', background: pc || THEME.accent,
                    animation: 'surveyBadgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 8, fontWeight: 900, color: '#000' }}>✓</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── INTRO SCREEN ──
  if (!dataLoaded) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', padding: 20 }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ background: THEME.card, borderRadius: 32, padding: 32, maxWidth: 600, width: '100%', border: `1px solid ${THEME.border}` }}>
          {[1, 2, 3].map(i => <SkeletonDish key={i} />)}
        </div>
      </div>
    )
  }

  if (showIntro && !surveySubmitted) {
    return (
      <>
        <style>{SURVEY_STYLES}</style>
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: 'clamp(8px, 2vw, 16px)', backdropFilter: 'blur(15px)' }} onClick={onClose}>
          <div onClick={e => e.stopPropagation()} style={{
            background: THEME.card, borderRadius: 28, padding: 'clamp(20px, 4vw, 36px)',
            maxWidth: 480, width: '100%', border: `1.5px solid ${THEME.borderActive}`,
            boxShadow: '0 40px 100px rgba(0,0,0,0.6)', position: 'relative', textAlign: 'center'
          }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, background: THEME.accentGrad, borderRadius: '50%', filter: 'blur(60px)', opacity: 0.08 }} />

            {/* Icon */}
            <div style={{
              width: 72, height: 72, borderRadius: 24,
              background: THEME.accentBg, border: `1.5px solid ${THEME.accent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', animation: 'surveyPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
              <span style={{ fontSize: 32 }}>📋</span>
            </div>

            <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: THEME.text, fontFamily: "'Playfair Display',serif" }}>
              Weekly Meal Plan
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: THEME.textSub, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>
              Fill in your preferences for the coming week — it takes about <strong style={{ color: THEME.accent }}>2–3 minutes</strong>.
            </p>

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, textAlign: 'left' }}>
              {[
                { icon: '📅', text: '12 slots to fill — Mon lunch through Sat dinner' },
                { icon: '💾', text: 'Auto-saves as you go — never lose progress' },
                { icon: '✏️', text: 'Can edit later if plans change' },
                { icon: '✅', text: 'Review everything before final submit' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0, animation: `surveyFadeIn 0.4s ease-out ${0.3 + i * 0.12}s forwards` }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: THEME.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{item.icon}</div>
                  <span style={{ fontSize: 12, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.4 }}>{item.text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleStartSurvey}
              style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: THEME.accentGrad, color: '#000', cursor: 'pointer',
                fontSize: 16, fontWeight: 900, fontFamily: "'DM Sans',sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: `0 8px 24px ${THEME.accentBg}`,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 32px ${THEME.accentBg}` }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 24px ${THEME.accentBg}` }}
            >
              Start Survey <Play size={18} />
            </button>

            <button onClick={onClose} style={{
              marginTop: 14, background: 'none', border: 'none', color: THEME.textSub,
              fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
              textDecoration: 'underline', opacity: 0.6
            }}>Not now</button>
          </div>
        </div>
      </>
    )
  }

  // ── SUCCESS CELEBRATION SCREEN ──
  if (showSuccess) {
    return (
      <>
        <style>{SURVEY_STYLES}</style>
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)', padding: 20 }}>
          <div style={{ textAlign: 'center', animation: 'surveySuccess 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            {/* Animated checkmark */}
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 60px rgba(76,175,80,0.4)',
              animation: 'surveyGlow 2s ease-in-out infinite',
            }}>
              <Check size={40} color="#fff" strokeWidth={3} />
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: '#4CAF50', fontFamily: "'Playfair Display',serif" }}>
              Survey Submitted!
            </h2>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif" }}>
              Your meal plan for this week is locked in. Shukran!
            </p>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(240,240,245,0.3)', fontFamily: "'DM Sans',sans-serif" }}>
              Tap anywhere or press Escape to close
            </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{SURVEY_STYLES}</style>
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', padding: 'clamp(8px, 2vw, 16px)', backdropFilter: 'blur(15px)'
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: THEME.card, borderRadius: 28, padding: 'clamp(12px, 3vw, 20px)',
        maxWidth: 520, width: '100%', maxHeight: 'calc(100dvh - 32px)',
        border: `1.5px solid ${THEME.borderActive}`,
        boxShadow: '0 40px 100px rgba(0,0,0,0.6)', position: 'relative',
        overflowX: 'hidden',
        overflowY: 'auto',
      }}>
        {/* ── LOADING OVERLAY ── */}
        {loading && !showSuccess && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 999, borderRadius: 28,
            background: 'rgba(13,13,26,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid', borderColor: `${THEME.accent} transparent ${THEME.accent} ${THEME.accent}`,
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 13, color: THEME.accent, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>
              Saving your plan…
            </div>
          </div>
        )}

        {/* ── ERROR TOAST ── */}
        {errorToast && (
          <div style={{
            position: 'absolute', top: 12, left: 12, right: 12, zIndex: 998,
            padding: '12px 16px', borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(244,67,54,0.15), rgba(244,67,54,0.05))',
            border: `1px solid ${THEME.noColor}60`,
            display: 'flex', alignItems: 'center', gap: 10,
            animation: 'surveyFadeIn 0.3s ease-out',
            backdropFilter: 'blur(10px)',
          }}>
            <AlertTriangle size={18} color={THEME.noColor} />
            <span style={{ flex: 1, fontSize: 12, color: THEME.text, fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>{errorToast}</span>
            <button onClick={() => setErrorToast(null)} style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', color: THEME.textSub,
              cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex'
            }}>
              <X size={14} />
            </button>
          </div>
        )}

        <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, background: THEME.accentGrad, borderRadius: '50%', filter: 'blur(60px)', opacity: 0.08 }} />

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: THEME.accent, fontFamily: "'DM Sans',sans-serif", marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              Weekly Survey
              {/* ── PERSISTENT STEP INDICATOR ── */}
              {!showReview && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: THEME.accentBg, color: THEME.accent
                }}>
                  Slot {currentSlot + 1}/{totalSlots}
                </span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: THEME.text, fontFamily: "'Playfair Display',serif" }}>
              {showReview ? 'Review & Confirm' : `${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)} • ${currentMeal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}`}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {autoSaveStatus === 'saving' && (
              <span style={{
                fontSize: 11, color: THEME.accent, fontWeight: 700,
                fontFamily: "'DM Sans',sans-serif",
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  border: '2px solid', borderColor: `${THEME.accent} transparent ${THEME.accent} ${THEME.accent}`,
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block',
                }} />
                Saving…
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span style={{
                fontSize: 11, color: THEME.yesColor, fontWeight: 700,
                fontFamily: "'DM Sans',sans-serif",
                display: 'flex', alignItems: 'center', gap: 4,
                animation: 'surveyPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>
                <span style={{ fontSize: 13 }}>✓</span>
                Saved
              </span>
            )}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 10, color: THEME.textSub, display: 'flex', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = THEME.text }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = THEME.textSub }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <DayBar />

        {/* ── Slide transition wrapper ── */}
        <div key={`${currentDayIndex}-${currentMeal}${showReview ? '-review' : ''}`} style={{
          animation: animatingDayDir === 'right' ? 'surveySlideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1)' :
                     animatingDayDir === 'left' ? 'surveySlideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1)' : undefined,
        }}>

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

        {!hasDishes && !editBlocked && !surveySubmitted && !editResponseMode && (
          <div style={{ marginBottom: 16, padding: 16, borderRadius: 12, background: THEME.cardActive, border: `1px solid ${THEME.border}`, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textSub, marginBottom: 4, fontFamily: "'DM Sans',sans-serif" }}>
              📋 Menu not yet available
            </div>
            <div style={{ fontSize: 12, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif" }}>
              This meal slot will be skipped. You can update it later when the menu is ready.
            </div>
          </div>
        )}

        {(wantsFood === null || wantsFood === false || editResponseMode) && !editBlocked && (!surveySubmitted || editResponseMode) && (
          <div style={{ marginBottom: 16, padding: 20, borderRadius: 16, background: 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(184,134,11,0.02))', border: `1px solid ${THEME.accent}` }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: THEME.text, marginBottom: 12, fontFamily: "'Playfair Display',serif" }}>
              {editResponseMode
                ? `Edit your response for ${currentMeal} on ${currentDay}`
                : wantsFood === false
                  ? `You currently skip ${currentMeal} on ${currentDay} — change your mind?`
                  : `Would you like ${currentMeal} on ${currentDay}?`}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => {
                wantsFoodRef.current = true; setWantsFood(true);
                if (editResponseMode) { setEditResponseMode(false) }
              }} style={{
                flex: 1, padding: '14px', borderRadius: 12,
                border: `2px solid ${wantsFood === true ? THEME.yesColor : THEME.border}`,
                background: wantsFood === true ? THEME.yesBg : 'rgba(76,175,80,0.05)',
                color: THEME.yesColor, cursor: 'pointer',
                fontSize: 15, fontWeight: 800, fontFamily: "'DM Sans',sans-serif",
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: wantsFood === true ? 'scale(1.02)' : 'scale(1)',
                boxShadow: wantsFood === true ? `0 4px 16px ${THEME.yesColor}30` : 'none',
              }}>✅ Yes, I want</button>
              {!editResponseMode && wantsFood === false ? (
                <button style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  border: `2px solid ${THEME.noColor}`,
                  background: THEME.noBg, color: THEME.noColor, cursor: 'not-allowed',
                  fontSize: 15, fontWeight: 800, fontFamily: "'DM Sans',sans-serif", opacity: 0.8,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }} disabled>❌ Currently Skipped</button>
              ) : (
                <button onClick={async () => {
                  wantsFoodRef.current = false; setWantsFood(false);
                  if (editResponseMode) { await saveAndLockEdit() }
                  else { await saveCurrentSlot(); goToNext() }
                }} style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  border: `2px solid ${wantsFood === false ? THEME.noColor : THEME.border}`,
                  background: wantsFood === false ? THEME.noBg : 'rgba(244,67,54,0.05)',
                  color: THEME.noColor, cursor: 'pointer',
                  fontSize: 15, fontWeight: 800, fontFamily: "'DM Sans',sans-serif",
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: wantsFood === false ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: wantsFood === false ? `0 4px 16px ${THEME.noColor}30` : 'none',
                }}>❌ No, I'll skip</button>
              )}
            </div>
          </div>
        )}

        {(wantsFood && !editBlocked && !surveySubmitted) || (wantsFood && editResponseMode) ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: THEME.accent, fontFamily: "'DM Sans',sans-serif" }}>
                {editResponseMode ? `Edit your portions for ${currentMeal}` : `Select your portions for ${currentMeal}`}
              </div>
              {/* ── BATCH SELECT / CLEAR ALL ── */}
              {hasDishes && !editResponseMode && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={selectAllDishes} style={{
                    padding: '6px 12px', borderRadius: 8, border: `1px solid ${THEME.accent}`,
                    background: THEME.accentBg, color: THEME.accent, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s'
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = THEME.accentGrad; e.currentTarget.style.color = '#000' }}
                    onMouseLeave={e => { e.currentTarget.style.background = THEME.accentBg; e.currentTarget.style.color = THEME.accent }}
                  >Select All</button>
                  <button onClick={clearAllDishes} style={{
                    padding: '6px 12px', borderRadius: 8, border: `1px solid ${THEME.border}`,
                    background: 'transparent', color: THEME.textSub, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s'
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = THEME.noColor; e.currentTarget.style.color = THEME.noColor }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = THEME.border; e.currentTarget.style.color = THEME.textSub }}
                  >Clear All</button>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              {hasDishes ? dishes.map((dish, idx) => (
                <DishSelector key={idx} dish={dish} idx={idx} maxCount={snackDefaults?.[`dish_${idx + 1}`] ?? null} />
              )) : <div style={{ padding: 16, textAlign: 'center', color: THEME.textSub, fontSize: 13, fontStyle: 'italic' }}>Menu being prepared...</div>}
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
        </div>{/* ── End slide transition wrapper ── */}

        {/* ── Previous Selections Summary ── */}
        {existingData && currentSlot > 0 && !surveySubmitted && !editResponseMode && (() => {
          const prevDayIdx = currentMeal === 'lunch' ? currentDayIndex - 1 : currentDayIndex
          if (prevDayIdx < 0) return null
          const prevDay = DAYS[prevDayIdx]
          const pdk = prevDay.substring(0, 3).toLowerCase()
          const prevMeals = currentMeal === 'lunch'
            ? [{ meal: 'dinner', mk: 'd' }]
            : [{ meal: 'lunch', mk: 'l' }, { meal: 'dinner', mk: 'd' }]
          const hasPrevData = prevMeals.some(({ mk }) => existingData[`${pdk}_${mk}_status`])
          if (!hasPrevData) return null
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans',sans-serif" }}>
                📋 Previous Day Summary ({prevDay.charAt(0).toUpperCase() + prevDay.slice(1)})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {prevMeals.map(({ meal, mk }) => {
                  const status = existingData[`${pdk}_${mk}_status`]
                  if (!status) return null
                  const isApplied = status === 'Applied'
                  const slotMenu = weeklyMenu[prevDay] || {}
                  const slotDishes = slotMenu[meal] || []
                  const prevDayIdx2 = DAYS.indexOf(prevDay)
                  const slotIdx = prevDayIdx2 * 2 + (meal === 'lunch' ? 0 : 1)
                  return (
                    <button
                      key={`${pdk}_${mk}`}
                      onClick={() => { setCurrentDayIndex(prevDayIdx2); setCurrentMeal(meal); setResponses({}) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 10,
                        background: THEME.cardActive, border: `1px solid ${THEME.border}`,
                        cursor: 'pointer', textAlign: 'left', color: THEME.text,
                        fontSize: 12, fontFamily: "'DM Sans',sans-serif",
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = THEME.accent; e.currentTarget.style.background = THEME.accentBg }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = THEME.border; e.currentTarget.style.background = THEME.cardActive }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, minWidth: 72, flexShrink: 0 }}>
                        {prevDay.charAt(0).toUpperCase() + prevDay.slice(1, 3)} {meal === 'lunch' ? '☀️' : '🌙'}
                      </div>
                      {isApplied ? (
                        <div style={{ flex: 1, fontSize: 10, color: THEME.textSub, lineHeight: 1.5 }}>
                          {slotDishes.map((dish, idx) => {
                            const val = existingData[`${pdk}_${mk}_dish_${idx + 1}`]
                            if (!val || val === 'No' || val === 'no') return null
                            const isCount = isCountInput(appSettings, prevDay, meal, idx)
                            return <span key={idx} style={{ marginRight: 8, whiteSpace: 'nowrap' }}>{dish}: <strong style={{ color: THEME.accent }}>{isCount ? `${val} person${val === '1' ? '' : 's'}` : val}</strong></span>
                          })}
                        </div>
                      ) : (
                        <div style={{ flex: 1, fontSize: 11, color: '#F44336', fontWeight: 600 }}>❌ Skipped</div>
                      )}
                    <div style={{ fontSize: 10, color: THEME.accent, flexShrink: 0 }}>✏️ Edit</div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {!surveySubmitted && !showReview && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, position: 'relative', zIndex: 1 }}>
            {currentSlot > 0 && (
              <button onClick={goToPrev} style={{
                padding: '12px 20px', borderRadius: 12, border: `1px solid ${THEME.border}`, background: 'transparent',
                color: THEME.textSub, cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif"
              }}><ChevronLeft size={16} /> Previous</button>
            )}

            {!isLast && wantsFood && (
              <button onClick={async () => { await saveCurrentSlot(); goToNext() }}
                style={{
                  marginLeft: currentSlot > 0 ? 'auto' : 0, padding: '12px 24px', borderRadius: 12, border: 'none',
                  background: THEME.accentGrad, color: '#000', cursor: 'pointer', fontSize: 13,
                  fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif",
                  boxShadow: `0 8px 20px ${THEME.accentBg}`,
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 12px 28px ${THEME.accentBg}` }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 20px ${THEME.accentBg}` }}
              >Save & Continue <ChevronRight size={16} /></button>
            )}

            {!isLast && wantsFood === false && (
              <button onClick={async () => { await saveCurrentSlot(); goToNext() }}
                style={{
                  marginLeft: currentSlot > 0 ? 'auto' : 0, padding: '12px 20px', borderRadius: 12, border: `1px solid ${THEME.border}`,
                  background: 'transparent', color: THEME.textSub, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif",
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = THEME.accent; e.currentTarget.style.color = THEME.accent }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = THEME.border; e.currentTarget.style.color = THEME.textSub }}
              >Continue <ChevronRight size={16} /></button>
            )}

            {isLast && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button onClick={handleSubmitFullWeek}
                  style={{
                    padding: '12px 24px', borderRadius: 12, border: 'none',
                    background: THEME.accentGrad, color: '#000', cursor: 'pointer', fontSize: 13,
                    fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif",
                    boxShadow: `0 8px 20px ${THEME.accentBg}`,
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 12px 28px ${THEME.accentBg}` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 20px ${THEME.accentBg}` }}
                >👁️ Review & Confirm</button>
              </div>
            )}
          </div>
        )}

        {/* ── REVIEW SCREEN ── */}
        {showReview && (
          <div style={{ marginTop: 8 }}>
            <div style={{
              padding: 'clamp(16px, 3vw, 24px)', borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(184,134,11,0.02))',
              border: `1.5px solid ${THEME.accent}`,
              marginBottom: 16
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: THEME.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4, fontFamily: "'DM Sans',sans-serif" }}>
                Step 12 of 12
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: THEME.text, fontFamily: "'Playfair Display',serif", marginBottom: 8 }}>
                👁️ Review Your Weekly Plan
              </div>
              <div style={{ fontSize: 13, color: THEME.textSub, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>
                Please review your meal selections for the week, then confirm to submit everything.
              </div>
            </div>

            {/* All 12 slots grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {DAYS.map((day, dIdx) => {
                const dk = day.substring(0, 3).toLowerCase()
                const dayMenu = weeklyMenu[day] || {}
                return ['lunch', 'dinner'].map((meal, mIdx) => {
                  const mk = meal === 'lunch' ? 'l' : 'd'
                  const slotIdx = dIdx * 2 + mIdx
                  const status = existingData?.[`${dk}_${mk}_status`]
                  const isApplied = status === 'Applied'
                  const isSkipped = status === 'Skipped'
                  const slotDishes = dayMenu[meal] || []

                  return (
                    <div
                      key={`${day}-${meal}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: 'clamp(10px, 1.5vw, 14px) clamp(12px, 2vw, 18px)',
                        borderRadius: 12,
                        background: isApplied
                          ? 'linear-gradient(135deg, rgba(76,175,80,0.08), rgba(76,175,80,0.02))'
                          : isSkipped
                            ? 'linear-gradient(135deg, rgba(244,67,54,0.06), rgba(244,67,54,0.01))'
                            : THEME.card,
                        border: `1.5px solid ${
                          isApplied ? '#4CAF50' : isSkipped ? '#F4433660' : THEME.border
                        }`,
                        textAlign: 'left', color: THEME.text,
                        fontSize: 12, fontFamily: "'DM Sans',sans-serif",
                        width: '100%', boxSizing: 'border-box'
                      }}
                    >
                      {/* Day + Meal label */}
                      <div style={{
                        minWidth: 72, flexShrink: 0,
                        fontSize: 11, fontWeight: 700,
                        color: isApplied ? '#4CAF50' : isSkipped ? '#F44336' : THEME.textSub
                      }}>
                        <div>{dIdx === 0 ? 'Mon' : dIdx === 1 ? 'Tue' : dIdx === 2 ? 'Wed' : dIdx === 3 ? 'Thu' : dIdx === 4 ? 'Fri' : 'Sat'}</div>
                        <div style={{ fontSize: 9, opacity: 0.7 }}>{meal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}</div>
                      </div>

                      {/* Arrow separator */}
                      <div style={{ color: isApplied ? '#4CAF50' : isSkipped ? '#F44336' : THEME.textSub, fontSize: 14 }}>
                        {isApplied ? '✓' : isSkipped ? '✕' : '○'}
                      </div>

                      {/* Dish selections summary */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isApplied ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
                            {slotDishes.length > 0 ? slotDishes.map((dish, dishIdx) => {
                              const rawVal = existingData?.[`${dk}_${mk}_dish_${dishIdx + 1}`]
                              if (!rawVal || rawVal === 'No' || rawVal === 'no') return null
                              const isCount = isCountInput(appSettings, day, meal, dishIdx)
                              const isRoti = isRotiItem(dish)
                              if (isRoti) {
                                return (
                                  <span key={dishIdx} style={{
                                    fontSize: 10, color: '#4CAF50', fontWeight: 600,
                                    background: 'rgba(76,175,80,0.1)', padding: '2px 6px', borderRadius: 4
                                  }}>
                                    {dish} ✅
                                  </span>
                                )
                              }
                              return (
                                <span key={dishIdx} style={{
                                  fontSize: 10, color: THEME.accent, fontWeight: 600,
                                  background: THEME.accentBg, padding: '2px 6px', borderRadius: 4
                                }}>
                                  {dish}: <strong>{isCount ? `${rawVal} person${rawVal === '1' ? '' : 's'}` : rawVal}</strong>
                                </span>
                              )
                            }) : <span style={{ fontSize: 10, color: THEME.textSub, fontStyle: 'italic' }}>Menu being prepared</span>}
                          </div>
                        ) : isSkipped ? (
                          <span style={{ fontSize: 10, color: '#F44336', fontWeight: 600 }}>Skipped — No meal this slot</span>
                        ) : (
                          <span style={{ fontSize: 10, color: THEME.textSub, fontStyle: 'italic' }}>Not yet filled</span>
                        )}
                      </div>

                      {/* Status indicator */}
                      <div style={{
                        fontSize: 10, color: THEME.accent, fontWeight: 700, flexShrink: 0,
                        padding: '4px 8px', borderRadius: 6,
                        background: THEME.accentBg
                      }}>
                        {isApplied ? '✅' : isSkipped ? '❌' : '⬜'}
                      </div>
                    </div>
                  )
                })
              })}
            </div>

            {/* Missing slots warning */}
            {!allSlotsFilled && (
              <div style={{
                padding: '12px 16px', borderRadius: 12,
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#f59e0b', fontSize: 12, fontWeight: 600,
                marginBottom: 12, fontFamily: "'DM Sans',sans-serif",
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                ⚠️ Some slots still need your response. Fill them above, then come back to confirm.
              </div>
            )}

            {/* Confirm & Submit button */}
            <div style={{ display: 'flex', gap: 8, position: 'relative', zIndex: 1 }}>
              <button
                onClick={() => setShowReview(false)}
                style={{
                  padding: '12px 20px', borderRadius: 12, border: `1px solid ${THEME.border}`,
                  background: 'transparent', color: THEME.textSub, cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = THEME.accent; e.currentTarget.style.color = THEME.accent }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = THEME.border; e.currentTarget.style.color = THEME.textSub }}
              >
                ← Back
              </button>
              <button
                onClick={handleConfirmAll}
                disabled={loading || !allSlotsFilled}
                style={{
                  flex: 1, padding: '14px 24px', borderRadius: 12, border: 'none',
                  background: loading || !allSlotsFilled ? THEME.border : THEME.accentGrad,
                  color: loading || !allSlotsFilled ? 'rgba(0,0,0,0.3)' : '#000',
                  cursor: loading || !allSlotsFilled ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 900,
                  fontFamily: "'DM Sans',sans-serif",
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: loading ? 'none' : !allSlotsFilled ? 'none' : `0 8px 20px ${THEME.accentBg}`,
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {loading ? 'Submitting...' : allSlotsFilled ? '✅ Confirm & Submit All' : 'Fill All Slots First'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}