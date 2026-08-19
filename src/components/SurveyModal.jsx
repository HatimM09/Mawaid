import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight, Check, AlertTriangle, Play } from 'lucide-react'
import { supabase } from '../lib/firebaseClient'
import { useAuth, useTheme } from '../admin/context'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { DAYS, getSurveyTargetWeek } from '../common/utils'
import { isRotiItem, isCountInput, canEditMeal, isSurveyOpen, useSurveyAutoSave, normalizeDishValue, denormalizeDishValue, hasUserOverride, getPctColor, mergeDishSnapshot, getSlotDishes } from '../hooks/useSurvey'
import { submitSurveyRow, beginSurvey } from '../lib/submitSurvey'
import { fetchLatestUserSurveyRow, fetchUserSurveyRow } from '../lib/surveyRows'

// Fallback palette (deep dark) — the live component derives its palette from the
// active app theme via buildSurveyTheme(useTheme()), so the pop-up and its cards
// always match the app's theme (Deep Topaz / Radiant Dawn / Royal Gold & Black).
const THEME = {
  bg: '#0d0d1a', card: 'rgba(255,255,255,0.03)', cardActive: 'rgba(255,255,255,0.06)',
  border: 'rgba(139,92,246,0.15)', borderActive: 'rgba(139,92,246,0.4)',
  accent: '#D4AF37', accentGrad: 'linear-gradient(135deg, #D4AF37, #B8860B)',
  accentBg: 'rgba(212,175,55,0.1)', text: '#f0f0f5', textSub: 'rgba(240,240,245,0.5)',
  inputBg: 'rgba(255,255,255,0.05)', successText: '#4CAF50',
  yesColor: '#4CAF50', yesBg: 'rgba(76,175,80,0.15)',
  noColor: '#F44336', noBg: 'rgba(244,67,54,0.15)',
}

// Map the app's active theme onto the survey modal's palette.
const buildSurveyTheme = (t) => {
  const light = t.id === 'bright'
  return {
    ...THEME,
    bg: t.bg, card: t.card, cardActive: t.cardActive,
    border: t.border, borderActive: t.borderActive,
    accent: t.accent, accentGrad: t.accentGrad, accentBg: t.accentBg,
    text: t.text, textSub: t.textSub, inputBg: t.inputBg, successText: t.successText,
    overlay: light ? 'rgba(45,36,22,0.5)' : 'rgba(5,5,10,0.78)',
    successOverlay: light ? 'rgba(253,251,247,0.92)' : 'rgba(0,0,0,0.9)',
    modalBg: light
      ? 'linear-gradient(165deg, #ffffff 0%, #faf4e8 60%)'
      : 'linear-gradient(165deg, #12121f 0%, #0d0d1a 60%)',
    modalBorder: light ? 'rgba(184,134,11,0.4)' : 'rgba(212,175,55,0.35)',
    loadingOverlay: light ? 'rgba(253,251,247,0.88)' : 'rgba(13,13,26,0.85)',
    softBg: light ? 'rgba(184,134,11,0.07)' : 'rgba(255,255,255,0.03)',
    softBorder: light ? 'rgba(184,134,11,0.18)' : 'rgba(255,255,255,0.05)',
    rowBg: light
      ? 'linear-gradient(145deg, rgba(184,134,11,0.08), rgba(184,134,11,0.03))'
      : 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
    rowBgHover: light
      ? 'linear-gradient(145deg, rgba(184,134,11,0.15), rgba(184,134,11,0.05))'
      : 'linear-gradient(145deg, rgba(212,175,55,0.14), rgba(212,175,55,0.04))',
  }
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
@keyframes surveyModalIn { 0% { opacity: 0; transform: translateY(32px) scale(0.96); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes surveyBackdropIn { 0% { opacity: 0; } 100% { opacity: 1; } }
`

const SkeletonDish = ({ theme: TH = THEME }) => (
  <div style={{ padding: '10px 14px', borderRadius: 12, background: TH.card, border: `1px solid ${TH.border}`, marginBottom: 8 }}>
    <div style={{ height: 14, width: '60%', borderRadius: 6, background: TH.border, marginBottom: 10 }} />
    <div style={{ display: 'flex', gap: 6 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ flex: 1, height: 32, borderRadius: 8, background: TH.border }} />
      ))}
    </div>
  </div>
)

export default function SurveyModal({ onClose, appSettings = {}, initialDay }) {
  const { user } = useAuth()
  // Theme-matched palette — the pop-up and its cards follow the active app theme.
  const appT = useTheme()
  const THEME = useMemo(() => buildSurveyTheme(appT), [appT])
  const weeklyMenu = useWeeklyMenu(getSurveyTargetWeek(parseInt(appSettings?.survey_open_hour, 10) || 20, appSettings?.survey_status === 'open')) || {}
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
  const { autoSaveStatus } = useSurveyAutoSave()
  const saveTimerRef = useRef(null)
  const justLoadedRef = useRef(false)

  const [editResponseMode, setEditResponseMode] = useState(false)
  const initialLoadRef = useRef(true)
  // Review step: once the user fills the final slot (Saturday dinner) they land
  // on a review screen (day list with ✏️ Edit) instead of jumping straight to
  // Submit — so they can go back and change any day before submitting.
  const [reviewMode, setReviewMode] = useState(false)

  // ── NEW UX STATE ──
  const [showIntro, setShowIntro] = useState(false)
  const [errorToast, setErrorToast] = useState(null)
  const [syncMsg, setSyncMsg] = useState(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [viewDay, setViewDay] = useState(DAYS[0])
  // Premium submit-result popup: exact status shown when the final submit
  // button is hit — filled (success celebration), missing slots, or an error.
  const [submitResult, setSubmitResult] = useState(null)
  // Day-scoped flow (opened from a Survey-page day card): first show the
  // Lunch/Dinner picker, then the chosen meal's dish-card editor.
  const [mealPicked, setMealPicked] = useState(false)

  const surveyOpenHour = parseInt(appSettings?.survey_open_hour, 10)
  const currentWeekId = getSurveyTargetWeek(isNaN(surveyOpenHour) ? 20 : surveyOpenHour, appSettings?.survey_status === 'open')
  const draftKey = `survey_draft_${currentWeekId}_${user?.id}`
  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(draftKey)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }
  const saveDraft = (data) => {
    try { localStorage.setItem(draftKey, JSON.stringify(data)) } catch { return }
  }
  const clearDraft = () => {
    try { localStorage.removeItem(draftKey) } catch { return }
  }
  const currentDay = DAYS[currentDayIndex]
  const menu = weeklyMenu[currentDay] || { lunch: [], dinner: [] }
  const dayKey = currentDay.substring(0, 3).toLowerCase()
  const mealKey = currentMeal === 'lunch' ? 'l' : 'd'
  const isEditable = canEditMeal(currentDay, currentWeekId, currentMeal, appSettings, user?.id)
  const surveyOpen = isSurveyOpen(appSettings, user?.id)
  const userHasOverride = hasUserOverride(appSettings, user?.id)

  // ── Post-submit edit gating ──
  // Two routines per the product flow:
  //  1) WHOLE-WEEK edits in the survey: live only while the admin-assigned weekly
  //     survey window is open (Sat open-hour → Mon close-hour, or an admin
  //     Open/Closed override). Override users can always edit their granted meals.
  //  2) DAILY lunch/dinner routine: after the weekly window closes, each meal is
  //     edited from the daily edit cards (Home) inside its own lunch/dinner edit
  //     window (lunch_edit_open/close, dinner_edit_open/close from the admin).
  const wholeWeekEditable = surveyOpen || userHasOverride
  const dayCanBeEdited = (day) => {
    if (userHasOverride) {
      // Override users may only edit the meals the admin granted them.
      return slotList.some(s => s.day === day)
    }
    return wholeWeekEditable
  }
  // The weekly survey window message reflects the admin-configured hours.
  const getWindowHint = () => {
    const openHour = parseInt(appSettings?.survey_open_hour, 10)
    const closeHour = parseInt(appSettings?.survey_close_hour, 10)
    const open = isNaN(openHour) ? 20 : openHour
    const close = isNaN(closeHour) ? 11 : closeHour
    const fmt = h => {
      const hh = h % 12 === 0 ? 12 : h % 12
      return `${hh}:00 ${h >= 12 ? 'PM' : 'AM'}`
    }
    return `Whole-week edits: Sat ${fmt(open)} – Mon ${fmt(close)}. After that, daily lunch/dinner edits follow the admin's per-meal windows.`
  }

  // ── Override-scoped survey: when admin grants specific day/meal access, show ONLY those slots ──
  const overrideSlots = useMemo(() => {
    if (!user?.id || !appSettings.user_overrides) return null
    try {
      const overrides = typeof appSettings.user_overrides === 'string'
        ? JSON.parse(appSettings.user_overrides)
        : appSettings.user_overrides
      const o = overrides[user.id]
      if (!o || o.all) return null
      const slots = []
      DAYS.forEach((day) => {
        const dayOverride = o[day.toLowerCase()]
        if (dayOverride) {
          if (dayOverride.lunch) slots.push({ day, meal: 'lunch' })
          if (dayOverride.dinner) slots.push({ day, meal: 'dinner' })
        }
      })
      return slots.length ? slots : null
    } catch { return null }
  }, [appSettings.user_overrides, user?.id])

  const slotList = useMemo(() => {
    if (overrideSlots) return overrideSlots
    return DAYS.flatMap(day => [{ day, meal: 'lunch' }, { day, meal: 'dinner' }])
  }, [overrideSlots])

  const dayIndices = useMemo(() => [...new Set(slotList.map(s => DAYS.indexOf(s.day)))], [slotList])
  const totalSlots = slotList.length
  const currentSlot = Math.max(0, slotList.findIndex(s => s.day === currentDay && s.meal === currentMeal))
  const isLast = currentSlot === slotList.length - 1
  // Dish names for the current slot. Prefer the live menu (so a newly published
  // dish can still be answered), but fall back to the saved dish_snapshot — an
  // Applied slot must keep showing what the user selected even if the admin has
  // since changed or unpublished the week's menu rows.
  const liveDishes = menu[currentMeal] || []
  const dishes = liveDishes.length > 0 ? liveDishes : getSlotDishes(existingData, currentDay, currentMeal, [])
  const hasDishes = dishes.length > 0
  const allDishesAnswered = wantsFood && dishes.every(dish => {
    const resp = responses[dish]
    if (isRotiItem(dish)) return resp === 'yes' || resp === 'no'
    if (isCountInput(appSettings, currentDay, currentMeal, dishes.indexOf(dish))) {
      return resp === 'no' || (resp && resp.status === 'yes' && resp.value > 0)
    }
    return typeof resp === 'number'
  })

  // A day counts as complete only when EVERY meal the user actually has in this
  // fill flow is saved. Full-week users have both meals every day (unchanged);
  // override users granted only lunch or only dinner per day must not show as
  // "partial" forever just because the un-granted meal was never answered.
  const dayStatusSummary = DAYS.map((day) => {
    const dk = day.substring(0, 3).toLowerCase()
    const daySlots = slotList.filter(s => s.day === day)
    if (daySlots.length === 0) return 'pending'
    const statuses = daySlots.map(s => {
      const mk = s.meal === 'lunch' ? 'l' : 'd'
      return existingData?.[`${dk}_${mk}_status`]
    })
    if (statuses.every(Boolean)) return 'complete'
    if (statuses.some(Boolean)) return 'partial'
    return 'pending'
  })

  // Post-submit edits are always allowed: once the full week is submitted the user
  // may open ANY day and re-edit any meal, as often as they like. slotLocked still
  // guards fresh fills outside the survey/edit windows.

  // Whole-week editing in the survey modal is only available while the weekly
  // survey window is open (or for override users). After it closes, the daily
  // lunch/dinner edits happen through the daily edit cards on the Home page.
  // While FILLING, slots are also locked when the meal isn't editable.
  const slotLocked = surveySubmitted ? !wholeWeekEditable : !isEditable


  // ── ESCAPE KEY TO CLOSE ──
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // If the weekly window closes while the user is mid-edit of a submitted survey,
  // drop back to the submitted plan (day list) instead of a locked edit screen.
  useEffect(() => {
    if (surveySubmitted && editResponseMode && !wholeWeekEditable) {
      setEditResponseMode(false)
      setWantsFood(null)
      setResponses({})
    }
  }, [surveySubmitted, editResponseMode, wholeWeekEditable])

  // ── AUTO-CLEAR ERROR TOAST ──
  useEffect(() => {
    if (!errorToast) return
    const t = setTimeout(() => setErrorToast(null), 4000)
    return () => clearTimeout(t)
  }, [errorToast])

  // ── AUTO-CLEAR "Synced ✓" FEEDBACK ──
  useEffect(() => {
    if (!syncMsg) return
    const t = setTimeout(() => setSyncMsg(null), 2200)
    return () => clearTimeout(t)
  }, [syncMsg])

  const positionedOnOpenRef = useRef(false)

  const loadExisting = useCallback(async () => {
    try {
      {
        const { data: u } = await supabase.from('user_stats').select('thali_number, email, snack_defaults').eq('user_id', user?.id).maybeSingle()
        if (u) {
          if (!userData.thali_no) setUserData({ thali_no: u.thali_number || '', email: u.email || user?.email })
          const sd = u.snack_defaults || null
          setSnackDefaults(prev => (prev || sd))
        }
      }
      const { data } = await fetchLatestUserSurveyRow(user?.id)
      let existing = null
      if (data && data.week_id === currentWeekId) existing = data
      setExistingData(existing)
      setDataLoaded(true)
      const localSubmitted = localStorage.getItem(`survey_submitted_${currentWeekId}_${user?.id}`) === '1'
      const allDone = existing && slotList.every(slot => {
        const dk = slot.day.substring(0, 3).toLowerCase()
        const mk = slot.meal === 'lunch' ? 'l' : 'd'
        return existing[`${dk}_${mk}_status`]
      })
      // For override users: direct filling mode only (do not show edit view screen)
      const isSubmitted = userHasOverride ? false : (!!allDone || localSubmitted)
      setSurveySubmitted(isSubmitted)
    } catch {
      setDataLoaded(true)
    }
  }, [user, currentWeekId, userData.thali_no, slotList, userHasOverride])

  useEffect(() => { loadExisting() }, [loadExisting])

  // ── Single initial positioning on open ──
  // Positions the modal onto the first granted/unanswered slot ONCE when opened.
  // Never re-runs on state changes or background syncs so the user is never yanked away.
  useEffect(() => {
    if (!dataLoaded || positionedOnOpenRef.current || slotList.length === 0) return
    positionedOnOpenRef.current = true

    if (initialDay) {
      const daySlot = slotList.find(s => s.day === initialDay)
      if (daySlot) {
        setCurrentDayIndex(DAYS.indexOf(daySlot.day))
        setCurrentMeal(daySlot.meal)
        setViewDay(daySlot.day)
      } else {
        const idx = DAYS.indexOf(initialDay)
        if (idx !== -1) {
          setCurrentDayIndex(idx)
          setViewDay(initialDay)
        }
      }
      return
    }

    // Find first slot missing a status
    const missing = slotList.find(s => {
      const dk = s.day.substring(0, 3).toLowerCase()
      const mk = s.meal === 'lunch' ? 'l' : 'd'
      return !existingData?.[`${dk}_${mk}_status`]
    })
    const target = missing || slotList[0]
    setCurrentDayIndex(DAYS.indexOf(target.day))
    setCurrentMeal(target.meal)
    setViewDay(target.day)
  }, [dataLoaded, slotList, existingData, initialDay])

  // ── LIVE SYNC: the week's row changing anywhere (this device, another
  // device, an admin) is reflected in the open modal within seconds. ──
  useEffect(() => {
    if (!user?.id) return
    const ch = supabase.channel(`survey-modal-sync-${user.id}-${currentWeekId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'survey_day_responses',
        filter: `user_id=eq.${user.id}`,
      }, async () => {
        const { data } = await fetchUserSurveyRow(user?.id, currentWeekId)
        if (data) setExistingData(data)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id, currentWeekId])

  const populateFromExisting = useCallback(() => {
    if (!existingData) { setWantsFood(null); wantsFoodRef.current = null; setResponses({}); return }
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
    } else { setWantsFood(null); wantsFoodRef.current = null; setResponses({}) }
  }, [existingData, dayKey, mealKey, dishes, appSettings, currentDay, currentMeal])

  // editResponseMode is included so that entering edit mode on the SAME day the
  // user is currently viewing (e.g. the last slot when entering the review step)
  // still repopulates the saved values instead of showing a blank form.
  useEffect(() => {
    if (!dataLoaded) return
    populateFromExisting()
  }, [currentDayIndex, currentMeal, dataLoaded, editResponseMode, populateFromExisting])

  // ── Deep-link: when opened from a Survey-page day card, scope the modal to
  // that day — first a Lunch/Dinner picker, then the chosen meal's editor. ──
  useEffect(() => {
    if (!dataLoaded) return
    if (!initialDay) return
    const idx = DAYS.indexOf(initialDay)
    if (idx === -1) return
    // Always land on the tapped day — for un-granted days (override users) the
    // MealPicker's empty state handles the "No meals granted" case.
    setCurrentDayIndex(idx)
    setViewDay(initialDay)
    setMealPicked(false)
    setEditResponseMode(false)
  }, [dataLoaded, initialDay])

  // Day-scoped picker: choosing a meal opens that meal's dish-card editor.
  const handlePickMeal = (meal) => {
    setCurrentMeal(meal)
    setMealPicked(true)
    if (surveySubmitted && wholeWeekEditable) setEditResponseMode(true)
  }

  // ── Show intro once per session if not submitted and no existing partial data ──
  useEffect(() => {
    if (initialDay) return  // deep-linked from a day card — go straight to that day
    if (dataLoaded && !surveySubmitted && !existingData) {
      const seen = localStorage.getItem('almawaid_survey_intro_seen')
      if (!seen) {
        setShowIntro(true)
      }
    }
  }, [dataLoaded, surveySubmitted, existingData, initialDay])
  // Mark intro as seen when user starts survey
  const handleStartSurvey = useCallback(() => {
    try { localStorage.setItem('almawaid_survey_intro_seen', '1') } catch { return }
    setShowIntro(false)
  }, [])

  // ── Restore the in-progress draft (fill flow only) ──
  // Restores the slot the user left off on, even when earlier slots are already
  // saved — only when that slot itself has no saved status yet.
  useEffect(() => {
    if (!dataLoaded) return
    const draft = loadDraft()
    if (draft && draft.day === currentDay && draft.meal === currentMeal && !surveySubmitted) {
      const statusKey = `${dayKey}_${mealKey}_status`
      if (!existingData?.[statusKey]) {
        wantsFoodRef.current = draft.wantsFood ?? null
        setWantsFood(draft.wantsFood ?? null)
        if (draft.responses && Object.keys(draft.responses).length > 0) setResponses(draft.responses)
      }
    }
    initialLoadRef.current = false
  }, [dataLoaded])

  // ── Explicit save only ──
  // The fill flow saves ONLY when the user taps "Save & Continue" / "Previous"
  // or "Submit Weekly Survey". There is no background auto-save, so nothing is
  // committed to the database (and no "Saving…" indicator flashes) until the
  // user acts — the form never skips ahead on its own.

  // ── Auto-save responses to localStorage as draft (fill flow only) ──
  // While editing a submitted survey we must NOT overwrite the in-progress fill
  // draft — post-submit edits are only persisted via the "Save Edit" button.
  // The draft also stores wantsFood + the slot, so a stray close (✕/Escape)
  // before "Save & Continue" never erases the slot the user was filling.
  useEffect(() => {
    if (wantsFood === null && Object.keys(responses).length === 0) return
    if (initialLoadRef?.current) return
    if (editResponseMode) return
    const timer = setTimeout(() => {
      saveDraft({ day: currentDay, meal: currentMeal, wantsFood, responses, updatedAt: new Date().toISOString() })
    }, 800)
    return () => clearTimeout(timer)
  }, [responses, wantsFood, currentDay, currentMeal, editResponseMode])

  // ── ALERT when not all dishes are selected / navigation guards ──
  const guardAnswered = useCallback(() => {
    if (wantsFood === true && !allDishesAnswered) {
      window.alert('⚠️ Please answer all dishes above before moving on. Every dish needs your selection.')
      return false
    }
    return true
  }, [wantsFood, allDishesAnswered])

  const saveCurrentIfNeeded = useCallback(async () => {
    // Locked slots (edit window closed) can't be changed, and post-submit edit
    // mode only persists via the explicit "Save Edit" button — never auto-save
    // while just navigating between menus.
    const curWants = wantsFoodRef.current !== null ? wantsFoodRef.current : wantsFood
    if (curWants === null || loading || slotLocked || editResponseMode) return null
    return saveCurrentSlot()
  }, [wantsFood, loading, slotLocked, editResponseMode])

  const moveToSlot = (slot, dir) => {
    if (!slot) return
    setAnimatingDayDir(dir)
    setCurrentDayIndex(DAYS.indexOf(slot.day))
    setCurrentMeal(slot.meal)
    setViewDay(slot.day)
    setWantsFood(null)
    wantsFoodRef.current = null
    setResponses({})
    setTimeout(() => setAnimatingDayDir(null), 350)
  }

  const goToPrev = async () => {
    if (currentSlot === 0) return
    if (!slotLocked && !editResponseMode && !guardAnswered()) return
    await saveCurrentIfNeeded()
    // Post-submit edit mode keeps editing the previous slot; fill/browse moves
    // plainly (lock guards are skipped so saved slots stay readable).
    setEditResponseMode(editResponseMode)
    if (currentSlot > 0) {
      moveToSlot(slotList[currentSlot - 1], 'left')
    }
  }

  const goToNext = async () => {
    if (isLast) return
    if (!slotLocked && !editResponseMode && !guardAnswered()) return
    const saveResult = await saveCurrentIfNeeded()
    const latestData = saveResult?.refreshed || existingData
    // Day-card gate: the current day's card must have BOTH meals answered and
    // synced before advancing to the next day — no skipping half-finished days.
    // Override users may be granted ONLY lunch or ONLY dinner per day, so the
    // gate only applies when both meals actually belong to this fill flow;
    // a dinner-only (or lunch-only) day is complete once its one meal is saved.
    if (!slotLocked && !editResponseMode && currentMeal === 'dinner') {
      const next = slotList[currentSlot + 1]
      if (next && next.day !== currentDay) {
        const dayHasLunch = slotList.some(s => s.day === currentDay && s.meal === 'lunch')
        const dayHasDinner = slotList.some(s => s.day === currentDay && s.meal === 'dinner')
        if (dayHasLunch && dayHasDinner) {
          const dk = currentDay.substring(0, 3).toLowerCase()
          const lunchStatus = latestData?.[`${dk}_l_status`]
          const dinnerStatus = latestData?.[`${dk}_d_status`]
          if (!lunchStatus || !dinnerStatus) {
            window.alert("⚠️ Please complete this day's card — both Lunch and Dinner must be answered before moving on.")
            return
          }
        }
      }
    }
    // Post-submit edit mode keeps editing the previous slot; fill/browse moves
    // plainly (lock guards are skipped so saved slots stay readable).
    setEditResponseMode(editResponseMode)
    if (currentSlot < slotList.length - 1) {
      moveToSlot(slotList[currentSlot + 1], 'right')
    }
  }

  const buildUpdateObj = (isEdit = false) => {
    const isWants = wantsFoodRef.current !== null ? wantsFoodRef.current : wantsFood
    const status = isWants ? 'Applied' : 'Skipped'
    const updateObj = {
      user_id: user?.id, week_id: currentWeekId, day: dayKey,
      thali_number: userData.thali_no, email: userData.email || '',
      updated_at: new Date().toISOString(),
      dish_snapshot: mergeDishSnapshot(existingData, currentDay, currentMeal, dishes),
      _isOverride: userHasOverride || false
    }
    updateObj[`${dayKey}_${mealKey}_status`] = status
    const currentEditCount = existingData?.edit_metadata?.[`${dayKey}_${mealKey}`] || 0
    const editMeta = { ...(existingData?.edit_metadata || {}), [`${dayKey}_${mealKey}`]: currentEditCount + 1 }
    // Display marker for the submitted-view badge — informational only, never a gate.
    if (isEdit) editMeta[`${dayKey}_${mealKey}_edited`] = true
    if (userHasOverride) editMeta[`${dayKey}_${mealKey}_override`] = true
    updateObj.edit_metadata = editMeta
    if (status === 'Applied') {
      dishes.forEach((dish, idx) => {
        const val = responses[dish]
        const isCount = isCountInput(appSettings, currentDay, currentMeal, idx)
        if (val !== undefined && val !== null) {
          updateObj[`${dayKey}_${mealKey}_dish_${idx + 1}`] = denormalizeDishValue(val, dish, isCount)
        }
      })
    }
    return updateObj
  }

  // Re-read the week's row after a write so every reader in the modal
  // (day list, review, day-card gate) sees the freshly committed values.
  const refetchExisting = async () => {
    const { data: refreshed } = await fetchUserSurveyRow(user?.id, currentWeekId)
    if (refreshed) setExistingData(refreshed)
    return refreshed || null
  }

  const saveAndLockEdit = async () => {
    if (wantsFoodRef.current === null && wantsFood === null) return
    if (loading) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setLoading(true)
    try {
      const { error } = await submitSurveyRow(buildUpdateObj(true))
      if (error) throw error
      await refetchExisting()
      setEditResponseMode(false)
      setViewDay(currentDay)
      setSyncMsg(`Synced ✓ ${dayKey} ${mealKey}`)
    } catch (err) {
      console.error('Save edit error:', err)
      setErrorToast(`Failed to save edit: ${err?.message || 'Please try again.'} Your answer is kept locally and the team has been notified.`)
    } finally { setLoading(false) }
  }

  const saveCurrentSlot = async () => {
    const curWants = wantsFoodRef.current !== null ? wantsFoodRef.current : wantsFood
    if (curWants === null) return null
    if (loading) return null
    setLoading(true)
    try {
      const { error } = await submitSurveyRow(buildUpdateObj(false))
      if (error) throw error
      const refreshed = await refetchExisting()
      const status = curWants ? 'Applied' : 'Skipped'
      setSyncMsg(`Synced ✓ ${dayKey} ${mealKey}`)
      return { status, refreshed }
    } catch (err) {
      console.error('Save error:', err)
      setErrorToast(`Failed to save: ${err?.message || 'Your draft is preserved locally.'} The team has been notified.`)
      return null
    } finally { setLoading(false) }
  }

  // ── DIRECT WEEKLY SUBMIT (no separate review screen) ──
  const finalizeSubmit = async () => {
    setLoading(true)
    setErrorToast(null)
    try {
      // The in-app "Weekly Survey Submitted" notification is best-effort only:
      // members are not allowed to INSERT into notifications (RLS — the member
      // insert policy was removed), so a failure here must never block the
      // submission success state or the saved survey data.
      try {
        await supabase.from('notifications').insert({
          user_id: user?.id, title: 'Weekly Survey Submitted',
          message: overrideSlots
            ? `Your granted survey meals (${slotList.length} slot${slotList.length === 1 ? '' : 's'}) have been saved.`
            : 'Your full week survey (Mon–Sat) has been saved.',
          url: '/post', type: 'survey'
        })
      } catch (notifErr) {
        console.warn('[SurveyModal] Survey notification skipped (RLS):', notifErr)
      }
      try {
        await supabase.functions.invoke('send-push', {
          body: {
            title: 'Al-Mawaid · Weekly survey in',
            body: overrideSlots
              ? `Thali ${userData.thali_no || '—'} submitted override survey responses.`
              : `Thali ${userData.thali_no || '—'} submitted the full week meal plan.`,
            url: '/admin/survey-tracking',
            target_type: 'admins',
          }
        })
      } catch (e) { console.warn('[SurveyModal] Admin push skipped:', e) }
      localStorage.setItem(`survey_submitted_${currentWeekId}_${user?.id}`, '1')
      clearDraft()
      setSurveySubmitted(true)
      setReviewMode(false)
      setShowSuccess(true)
      setTimeout(() => { setShowSuccess(false) }, 2400)
    } catch (e) {
      console.error('Confirm submit error:', e)
      setErrorToast('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitWeekly = async () => {
    // From the review screen there is no single "current" slot to validate —
    // the missing-slot check below catches anything still unfilled.
    if (!reviewMode) {
      if (wantsFood === null) {
        setSubmitResult({ type: 'missing', title: '⚠️ This slot is not answered', message: 'Please choose Yes or No for this meal before submitting.' })
        return
      }
      if (wantsFood === true && !allDishesAnswered) {
        setSubmitResult({ type: 'missing', title: '⚠️ Not every dish is answered', message: 'Please answer all the dishes for this meal before submitting your weekly survey.' })
        return
      }
    }
    await saveCurrentSlot()
    let fresh
    try {
      const { data } = await fetchUserSurveyRow(user?.id, currentWeekId)
      fresh = data
    } catch (e) {
      console.error('Re-fetch error:', e)
      setSubmitResult({ type: 'error', title: '❌ Something went wrong', message: e?.message || 'Could not verify your saved answers. Your answers are kept locally — please try again.' })
      return
    }
    if (fresh) setExistingData(fresh)
    const missing = slotList.filter(slot => {
      const dk = slot.day.substring(0, 3).toLowerCase()
      const mk = slot.meal === 'lunch' ? 'l' : 'd'
      return !(fresh?.[`${dk}_${mk}_status`])
    })
    if (missing.length > 0) {
      setSubmitResult({
        type: 'missing',
        title: '⚠️ Survey not fully filled',
        message: `Your survey is missing ${missing.length} slot${missing.length === 1 ? '' : 's'} before it can be submitted. Fill them first, then tap Submit again.`,
        missingSlots: missing,
        filled: slotList.length - missing.length,
        total: slotList.length,
      })
      return
    }
    try {
      await finalizeSubmit()
    } catch (e) {
      console.error('Confirm submit error:', e)
      setSubmitResult({ type: 'error', title: '❌ Something went wrong', message: e?.message || 'Your survey could not be submitted. Your answers are kept locally — please try again.' })
    }
  }

  // ── REVIEW STEP: reached from the final slot (Saturday dinner). Saves the
  // current slot first, then shows the day list with ✏️ Edit so the user can
  // go back and review/change any day. Submit lives on the review screen. ──
  const openReview = async () => {
    if (loading) return
    if (!guardAnswered()) return
    await saveCurrentSlot()
    setReviewMode(true)
    setEditResponseMode(false)
  }

  // Return from the review screen back to the last slot of the fill flow.
  const backToFilling = () => {
    setReviewMode(false)
    setEditResponseMode(false)
    const last = slotList[slotList.length - 1]
    setCurrentDayIndex(DAYS.indexOf(last.day))
    setCurrentMeal(last.meal)
  }

  // ── BATCH SELECT / CLEAR ALL ──
  const selectAllDishes = useCallback(() => {
    const newResponses = {}
    dishes.forEach((dish, idx) => {
      if (isRotiItem(dish)) {
        newResponses[dish] = 'yes'
      } else if (isCountInput(appSettings, currentDay, currentMeal, idx)) {
        newResponses[dish] = { status: 'yes', value: Math.min(snackDefaults?.[`dish_${idx + 1}`] ?? 1, 1) }
      } else {
        newResponses[dish] = 100
      }
    })
    setResponses(prev => ({ ...prev, ...newResponses }))
  }, [dishes, appSettings, currentDay, currentMeal, snackDefaults])

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

  const [animatingDayDir, setAnimatingDayDir] = useState(null)

  // ── DAY MEAL PICKER: shown when a Survey-page day card is tapped. Only this
  // day's two meals are offered — picking one opens its dish-card editor. ──
  const MealPicker = () => {
    const meals = ['lunch', 'dinner'].filter(m => slotList.some(s => s.day === currentDay && s.meal === m))
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 15, flexShrink: 0,
            background: THEME.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, color: '#000', fontFamily: "'Playfair Display',serif",
            boxShadow: `0 8px 20px ${THEME.accentBg}`,
          }}>
            {currentDay.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: THEME.text, fontFamily: "'Playfair Display',serif", textTransform: 'capitalize' }}>{currentDay}</div>
            <div style={{ fontSize: 11, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif", marginTop: 2 }}>Choose a meal to plan or edit</div>
          </div>
        </div>

        {meals.length === 0 ? (
          <div style={{ padding: 18, borderRadius: 14, background: THEME.cardActive, border: `1px solid ${THEME.border}`, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif" }}>🔒 No meals granted</div>
            <div style={{ fontSize: 12, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif", marginTop: 4 }}>This day is outside the access granted to you by the admin.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meals.map(m => {
              const dk = currentDay.substring(0, 3).toLowerCase()
              const mk = m === 'lunch' ? 'l' : 'd'
              const mStatus = existingData?.[`${dk}_${mk}_status`]
              const applied = mStatus === 'Applied'
              const skipped = mStatus === 'Skipped'
              const editableMeal = canEditMeal(currentDay, currentWeekId, m, appSettings, user?.id)
              const locked = surveySubmitted ? !wholeWeekEditable : !editableMeal
              const statusColor = applied ? THEME.yesColor : skipped ? THEME.noColor : THEME.textSub
              const statusLabel = applied ? 'Saved' : skipped ? 'Skipped' : 'Not filled'
              return (
                <button
                  key={m}
                  onClick={() => handlePickMeal(m)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: 16, borderRadius: 16, cursor: 'pointer',
                    background: THEME.rowBg,
                    border: `1.5px solid ${THEME.border}`,
                    color: THEME.text, textAlign: 'left', fontFamily: "'DM Sans',sans-serif",
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = THEME.accent; e.currentTarget.style.background = THEME.rowBgHover; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = THEME.border; e.currentTarget.style.background = THEME.rowBg; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <div style={{
                    width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                    background: THEME.accentGrad,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
                    boxShadow: `0 8px 20px ${THEME.accentBg}`,
                  }}>
                    {m === 'lunch' ? '☀️' : '🌙'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, textTransform: 'capitalize', fontFamily: "'DM Sans',sans-serif" }}>{m}</div>
                    <div style={{ fontSize: 11, color: statusColor, fontWeight: 800, marginTop: 3, fontFamily: "'DM Sans',sans-serif" }}>
                      {applied ? '✓' : skipped ? '✕' : '○'} {statusLabel}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, color: THEME.accent, fontSize: 11.5, fontWeight: 900, fontFamily: "'DM Sans',sans-serif" }}>
                    {locked ? 'View' : 'Edit'} <ChevronRight size={15} />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── LUNCH/DINNER selector for the day currently being edited ──
  const MealSwitcher = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: THEME.textSub, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap' }}>
        {initialDay ? 'Meal' : 'Editing'}
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 6, padding: 4, borderRadius: 14, background: THEME.softBg, border: `1px solid ${THEME.softBorder}` }}>
        {['lunch', 'dinner'].filter(m => slotList.some(s => s.day === currentDay && s.meal === m)).map(m => {
          const isActive = m === currentMeal
          const dk = currentDay.substring(0, 3).toLowerCase()
          const mk = m === 'lunch' ? 'l' : 'd'
          const mStatus = existingData?.[`${dk}_${mk}_status`]
          const mApplied = mStatus === 'Applied'
          const mSkipped = mStatus === 'Skipped'
          return (
            <button
              key={m}
              onClick={() => { setCurrentMeal(m); setWantsFood(null); wantsFoodRef.current = null; setResponses({}) }}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 10,
                border: `1.5px solid ${isActive ? THEME.accent : 'transparent'}`,
                background: isActive ? `linear-gradient(135deg, ${THEME.accentBg}, rgba(212,175,55,0.05))` : 'transparent',
                color: isActive ? THEME.accent : THEME.textSub,
                fontSize: 12, fontWeight: 800, cursor: 'pointer',
                fontFamily: "'DM Sans',sans-serif", transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: isActive ? `0 4px 12px ${THEME.accentBg}` : 'none',
              }}
            >
              {m === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}
              {mApplied && <span style={{ fontSize: 9, color: THEME.yesColor }}>✓</span>}
              {mSkipped && <span style={{ fontSize: 9, color: THEME.noColor }}>✕</span>}
            </button>
          )
        })}
      </div>
    </div>
  )

  // ── DAY LIST: vertical rows (Monday on top, Tuesday below, …) each with its
  // own status and an Edit option. Editing is live while the weekly survey window
  // is open; afterwards each meal follows the daily lunch/dinner edit windows. ──
  const DayList = () => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>📅 Your Week — tap Edit to change a day</span>
        <span style={{ fontSize: 10, color: THEME.accent, fontWeight: 700 }}>✏️ Edit</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dayIndices.map(idx => {
          const day = DAYS[idx]
          const summary = dayStatusSummary[idx]
          const isComplete = summary === 'complete'
          const isPartial = summary === 'partial'
          const isActive = day === viewDay
          const editable = dayCanBeEdited(day)
          const firstSlot = slotList.find(s => s.day === day) || slotList[0]
          const mealsInFlow = slotList.filter(s => s.day === day).length
          const statusIcon = isComplete ? '✓✓' : isPartial ? '◐' : '○'
          const statusColor = isComplete ? THEME.yesColor : isPartial ? '#FF9800' : THEME.textSub
          return (
            <div
              key={day}
              onClick={() => setViewDay(day)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                borderRadius: 14, cursor: 'pointer',
                background: isActive ? 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.03))' : THEME.card,
                border: `1.5px solid ${isActive ? THEME.accent : THEME.border}`,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isActive ? `0 4px 16px ${THEME.accentBg}` : 'none',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: isActive ? THEME.accentBg : THEME.cardActive,
                border: `1px solid ${isActive ? THEME.accent : THEME.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, fontWeight: 800, color: isActive ? THEME.accent : THEME.textSub,
                fontFamily: "'Playfair Display',serif",
              }}>
                {day.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: THEME.text, fontFamily: "'Playfair Display',serif" }}>{day}</div>
                <div style={{ fontSize: 11, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif", marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: statusColor, fontWeight: 800 }}>{statusIcon}</span>
                  <span>{isComplete ? (mealsInFlow > 1 ? 'Both meals saved' : 'Meal saved') : isPartial ? 'Partially filled' : 'Not filled'}</span>
                </div>
              </div>
              {editable ? (
                <button
                  onClick={(e) => { e.stopPropagation(); if (firstSlot) { setCurrentDayIndex(idx); setCurrentMeal(firstSlot.meal); setEditResponseMode(true); setWantsFood(null); wantsFoodRef.current = null; setResponses({}) } }}
                  style={{
                    padding: '8px 14px', borderRadius: 10, flexShrink: 0,
                    border: `1.5px solid ${THEME.accent}`, background: THEME.accentBg, color: THEME.accent,
                    fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = THEME.accentGrad; e.currentTarget.style.color = '#000' }}
                  onMouseLeave={e => { e.currentTarget.style.background = THEME.accentBg; e.currentTarget.style.color = THEME.accent }}
                >✏️ Edit</button>
              ) : (
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{
                    padding: '8px 12px', borderRadius: 10,
                    border: `1px solid ${THEME.border}`, background: THEME.softBg,
                    color: THEME.textSub, fontSize: 10.5, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
                    display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                  }}>
                    🔒 Window closed
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 10, fontSize: 10.5, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5, opacity: 0.9 }}>
        {getWindowHint()}
      </div>
    </div>
  )

  const [animatingDish, setAnimatingDish] = useState(null)
  const [, setAnimatingOpt] = useState(null)

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

    // ── Premium selected-state helpers ──
    const optGrad = (color) => `linear-gradient(145deg, ${color}2e 0%, ${color}0f 55%, ${color}05 100%)`
    const optShadow = (color) => `0 6px 20px ${color}40, inset 0 1px 0 rgba(255,255,255,0.12)`
    const sheen = (
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '52%', background: 'linear-gradient(180deg, rgba(255,255,255,0.16), transparent)', pointerEvents: 'none', borderRadius: 'inherit' }} />
    )
    const checkBadge = (color, size = 18) => (
      <span style={{
        position: 'absolute', top: 5, right: 5, width: size, height: size, borderRadius: '50%',
        background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 2px 10px ${color}70`, zIndex: 2,
        animation: 'surveyBadgePop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <span style={{ fontSize: size * 0.62, fontWeight: 900, color: '#0d0d1a', lineHeight: 1 }}>✓</span>
      </span>
    )
    const statusPill = (label, color) => (
      <span style={{
        fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em',
        padding: '3px 10px', borderRadius: 100, whiteSpace: 'nowrap',
        background: `${color}1a`, color,
        border: `1px solid ${color}55`,
        animation: 'surveyBadgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>{label}</span>
    )

    if (isRoti) {
      const sel = resp
      const selColor = sel === 'yes' ? THEME.yesColor : sel === 'no' ? THEME.noColor : null
      return (
        <div style={{
          marginBottom: 10, padding: '14px 16px', borderRadius: 16,
          position: 'relative', overflow: 'hidden',
          background: sel ? `linear-gradient(145deg, ${selColor}1a, ${THEME.card})` : THEME.card,
          border: `1.5px solid ${sel ? selColor : THEME.border}`,
          boxShadow: sel ? `0 8px 26px ${selColor}22` : 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: isAnimating ? 'surveyPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
        }}>
          {sel && (
            <div style={{ position: 'absolute', top: -24, right: -24, width: 110, height: 110, borderRadius: '50%', background: selColor, filter: 'blur(45px)', opacity: 0.15, pointerEvents: 'none' }} />
          )}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: THEME.text, fontFamily: "'DM Sans',sans-serif" }}>{dish}</div>
              {sel && statusPill(sel === 'yes' ? '✅ Selected' : '❌ Skipped', selColor)}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {['yes', 'no'].map(opt => {
                const isSelected = sel === opt
                const isYes = opt === 'yes'
                const color = isYes ? THEME.yesColor : THEME.noColor
                return (
                  <button
                    key={opt}
                    onClick={() => handleDishResponse(dish, opt)}
                    style={{
                      flex: 1, padding: '13px 8px', borderRadius: 12,
                      border: `1.5px solid ${isSelected ? color : THEME.border}`,
                      background: isSelected ? optGrad(color) : 'transparent',
                      color: isSelected ? color : THEME.textSub,
                      fontSize: 13, fontWeight: 800, cursor: 'pointer',
                      fontFamily: "'DM Sans',sans-serif",
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: isSelected ? 'scale(1.03) translateY(-1px)' : 'scale(1)',
                      boxShadow: isSelected ? optShadow(color) : 'none',
                      letterSpacing: '0.02em',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = `${color}0d`; e.currentTarget.style.borderColor = `${color}55` } }}
                    onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = THEME.border } }}
                  >
                    {isSelected && sheen}
                    {isSelected && checkBadge(color)}
                    {opt === 'yes' ? '✅ Yes, please' : '❌ No, skip'}
                  </button>
                )
              })}
            </div>
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
      const selColor = isYes ? THEME.yesColor : isSkipped ? THEME.noColor : null
      return (
        <div style={{
          marginBottom: 10, padding: '14px 16px', borderRadius: 16,
          position: 'relative', overflow: 'hidden',
          background: selColor ? `linear-gradient(145deg, ${selColor}1a, ${THEME.card})` : THEME.card,
          border: `1.5px solid ${selColor || THEME.border}`,
          boxShadow: selColor ? `0 8px 26px ${selColor}22` : 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: isAnimating ? 'surveyPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
        }}>
          {selColor && (
            <div style={{ position: 'absolute', top: -24, right: -24, width: 110, height: 110, borderRadius: '50%', background: selColor, filter: 'blur(45px)', opacity: 0.15, pointerEvents: 'none' }} />
          )}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: THEME.text, marginBottom: 12, fontFamily: "'DM Sans',sans-serif", display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span>{dish}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isYes && statusPill(`✅ ${value} ${value === 1 ? 'person' : 'persons'}`, THEME.yesColor)}
                {isSkipped && statusPill('❌ Skipped', THEME.noColor)}
                {maxCount != null && <span style={{ fontSize: 10, color: THEME.textSub, fontWeight: 700, background: THEME.cardActive, padding: '2px 8px', borderRadius: 6 }}>Max: {maxCount}</span>}
              </span>
            </div>
            {showToggle ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => handleDishResponse(dish, { status: 'yes', value: Math.min(maxVal, 1) })}
                  style={{
                    flex: 1, padding: '12px 8px', borderRadius: 12,
                    border: `1.5px solid ${THEME.yesColor}`, background: optGrad(THEME.yesColor), color: THEME.yesColor,
                    fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: `0 6px 18px ${THEME.yesColor}30`,
                    position: 'relative', overflow: 'hidden',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  {sheen}
                  ✅ Yes
                </button>
                <button onClick={() => handleDishResponse(dish, 'no')}
                  style={{
                    flex: 1, padding: '12px 8px', borderRadius: 12,
                    border: `1.5px solid ${THEME.noColor}`, background: optGrad(THEME.noColor), color: THEME.noColor,
                    fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative', overflow: 'hidden',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  {sheen}
                  ❌ No
                </button>
              </div>
            ) : isSkipped ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{
                  padding: '8px 16px', borderRadius: 10, background: optGrad(THEME.noColor),
                  border: `1px solid ${THEME.noColor}50`, color: THEME.noColor,
                  fontSize: 13, fontWeight: 800, fontFamily: "'DM Sans',sans-serif",
                }}>❌ Skipped</div>
                <button onClick={() => handleDishResponse(dish, { status: 'yes', value: Math.min(maxVal, 1) })}
                  style={{
                    marginLeft: 'auto', padding: '10px 20px', borderRadius: 12,
                    border: `1.5px solid ${THEME.accent}`, background: `linear-gradient(145deg, ${THEME.accent}22, transparent)`,
                    color: THEME.accent, fontSize: 13, fontWeight: 800,
                    cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: `0 4px 14px ${THEME.accent}22`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = THEME.accentGrad; e.currentTarget.style.color = '#000' }}
                  onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(145deg, ${THEME.accent}22, transparent)`; e.currentTarget.style.color = THEME.accent }}
                >✅ Add back</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: `linear-gradient(145deg, ${THEME.yesColor}1f, ${THEME.card})`, borderRadius: 14,
                  padding: '6px 8px', border: `1px solid ${THEME.yesColor}40`,
                  boxShadow: `0 4px 16px ${THEME.yesColor}18`,
                }}>
                  <button onClick={() => handleDishResponse(dish, { status: 'yes', value: Math.max(0, value - 1) })}
                    style={{
                      width: 48, height: 48, borderRadius: 12,
                      border: `1px solid ${THEME.yesColor}50`, background: THEME.inputBg,
                      color: THEME.text, cursor: 'pointer', fontSize: 26, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s', fontFamily: 'inherit', touchAction: 'manipulation',
                      minWidth: 48, WebkitTapHighlightColor: 'transparent',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = THEME.yesBg }}
                    onMouseLeave={e => { e.currentTarget.style.background = THEME.inputBg }}
                  >−</button>
                  <div style={{ textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontSize: 30, fontWeight: 900, color: THEME.yesColor, lineHeight: 1, fontFamily: "'DM Sans',sans-serif", textShadow: `0 0 14px ${THEME.yesColor}66` }}>{value}</div>
                    <div style={{ fontSize: 9, color: THEME.textSub, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>{value === 1 ? 'person' : 'persons'}</div>
                  </div>
                  <button onClick={() => { if (!atMax) handleDishResponse(dish, { status: 'yes', value: Math.min(maxVal, value + 1) }) }}
                    style={{
                      width: 48, height: 48, borderRadius: 12,
                      border: `1px solid ${atMax ? THEME.noColor + '40' : THEME.yesColor + '50'}`, background: THEME.inputBg,
                      color: atMax ? THEME.textSub : THEME.text,
                      cursor: atMax ? 'not-allowed' : 'pointer', fontSize: 26, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: atMax ? 0.4 : 1, transition: 'all 0.2s', fontFamily: 'inherit',
                      touchAction: 'manipulation', minWidth: 48, WebkitTapHighlightColor: 'transparent',
                    }}
                    onMouseEnter={e => { if (!atMax) e.currentTarget.style.background = THEME.yesBg }}
                    onMouseLeave={e => { if (!atMax) e.currentTarget.style.background = THEME.inputBg }}
                  >+</button>
                </div>
                <button onClick={() => handleDishResponse(dish, 'no')}
                  style={{
                    padding: '10px 18px', borderRadius: 12, border: `1.5px solid ${THEME.noColor}50`,
                    background: 'transparent', color: THEME.noColor,
                    fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = THEME.noBg }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >❌ Skip</button>
              </div>
            )}
          </div>
        </div>
      )
    }

    const pctColor = getPctColor(resp)
    const hasResp = resp !== undefined && resp !== null
    const selColor = pctColor || THEME.accent
    return (
      <div style={{
        marginBottom: 10, padding: '14px 16px', borderRadius: 16,
        position: 'relative', overflow: 'hidden',
        background: hasResp ? `linear-gradient(145deg, ${selColor}1a, ${THEME.card})` : THEME.card,
        border: `1.5px solid ${hasResp ? selColor : THEME.border}`,
        boxShadow: hasResp ? `0 8px 26px ${selColor}22` : 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: isAnimating ? 'surveyPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
      }}>
        {hasResp && (
          <div style={{ position: 'absolute', top: -24, right: -24, width: 110, height: 110, borderRadius: '50%', background: selColor, filter: 'blur(45px)', opacity: 0.15, pointerEvents: 'none' }} />
        )}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: THEME.text, fontFamily: "'DM Sans',sans-serif" }}>{dish}</div>
            {hasResp && statusPill(`${resp}% selected`, selColor)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 25, 50, 75, 100].map(pct => {
              const pc = getPctColor(pct)
              const isSelected = resp === pct
              const color = pc || THEME.accent
              return (
                <button
                  key={pct}
                  onClick={() => handleDishResponse(dish, pct)}
                  style={{
                    flex: 1, padding: '13px 4px', borderRadius: 12,
                    border: `1.5px solid ${isSelected ? color : THEME.border}`,
                    background: isSelected ? optGrad(color) : 'transparent',
                    color: isSelected ? color : THEME.textSub,
                    fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isSelected ? 'scale(1.06) translateY(-1px)' : 'scale(1)',
                    boxShadow: isSelected ? optShadow(color) : 'none',
                    letterSpacing: '0.02em',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = `${color}0d`; e.currentTarget.style.borderColor = `${color}55` } }}
                  onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = THEME.border } }}
                >
                  {isSelected && sheen}
                  {pct === 0 ? '0%' : pct + '%'}
                  {isSelected && checkBadge(color, 16)}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── SUBMITTED VIEW: days UI box + side edit response ──
  const startEditSlot = (day, meal) => {
    setEditResponseMode(true)
    setAnimatingDayDir(null)
    setCurrentDayIndex(DAYS.indexOf(day))
    setCurrentMeal(meal)
  }

  const SubmittedView = () => (
    <div>
      <div style={{
        padding: 18, borderRadius: 16, textAlign: 'center', marginBottom: 16,
        background: 'linear-gradient(135deg, rgba(76,175,80,0.14), rgba(76,175,80,0.03))',
        border: `1.5px solid #4CAF50`,
        animation: 'surveyFadeIn 0.4s ease-out',
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#4CAF50', marginBottom: 4, fontFamily: "'DM Sans',sans-serif" }}>
          ✅ Weekly Survey Submitted
        </div>
        <div style={{ fontSize: 12.5, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5 }}>
          {overrideSlots
            ? 'Your granted meals are saved. Tap a day tab below to edit any response.'
            : 'Your meal plan for this week is locked in. Tap a day tab below to edit any response.'}
        </div>
      </div>

      {/* Day list — vertical rows (Monday on top, Tuesday below…), each with its own Edit */}
      <DayList />

      {/* Side detail + edit */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {['lunch', 'dinner'].map(meal => {
          const dk = viewDay.substring(0, 3).toLowerCase()
          const mk = meal === 'lunch' ? 'l' : 'd'
          const status = existingData?.[`${dk}_${mk}_status`]
          const isApplied = status === 'Applied'
          const isSkipped = status === 'Skipped'
          const dishList = getSlotDishes(existingData, viewDay, meal, weeklyMenu[viewDay]?.[meal] || [])
          const editedAfterSubmit = existingData?.edit_metadata?.[`${dk}_${mk}_edited`] || false
          const appliedCount = dishList.filter((_, i) => {
            const v = existingData?.[`${dk}_${mk}_dish_${i + 1}`]
            return v !== undefined && v !== null && v !== 'No' && v !== 'no'
          }).length
          return (
            <div key={meal} style={{
              padding: 14, borderRadius: 14,
              background: isApplied
                ? 'linear-gradient(135deg, rgba(76,175,80,0.08), rgba(76,175,80,0.02))'
                : isSkipped
                  ? 'linear-gradient(135deg, rgba(244,67,54,0.06), rgba(244,67,54,0.01))'
                  : THEME.cardActive,
              border: `1.5px solid ${isApplied ? '#4CAF50' : isSkipped ? '#F4433660' : THEME.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: isApplied ? '#4CAF50' : isSkipped ? '#F44336' : THEME.textSub, fontFamily: "'DM Sans',sans-serif" }}>
                  {meal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}
                  <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.75 }}>
                    {isApplied ? `✅ ${appliedCount} item${appliedCount === 1 ? '' : 's'}` : isSkipped ? '❌ Skipped' : '○ Not filled'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editedAfterSubmit && <span style={{ fontSize: 10, color: THEME.textSub, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>✏️ Edited</span>}
                  <button
                    onClick={() => startEditSlot(viewDay, meal)}
                    style={{
                      padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${THEME.accent}`,
                      background: THEME.accentBg, color: THEME.accent,
                      fontSize: 11.5, fontWeight: 800, cursor: 'pointer',
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    ✏️ Edit Response
                  </button>
                </div>
              </div>
              {isApplied && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {dishList.length > 0 ? dishList.map((dish, i) => {
                    const v = existingData?.[`${dk}_${mk}_dish_${i + 1}`]
                    const isCount = isCountInput(appSettings, viewDay, meal, i)
                    const isRoti = isRotiItem(dish)
                    const skipped = v === undefined || v === null || v === 'No' || v === 'no'
                    const isPct = !skipped && !isCount && !isRoti && (typeof v === 'number' || String(v).endsWith('%'))
                    return (
                      <span key={i} style={{
                        fontSize: 10, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
                        color: skipped ? THEME.noColor : isRoti ? '#4CAF50' : THEME.accent,
                        background: skipped ? THEME.noBg : isRoti ? 'rgba(76,175,80,0.12)' : THEME.accentBg,
                        padding: '3px 8px', borderRadius: 6,
                      }}>
                        {dish}: <strong>{skipped ? '❌' : isRoti ? '✅' : isCount ? `${v} ppl` : isPct ? `${v}%` : v}</strong>
                      </span>
                    )
                  }) : <span style={{ fontSize: 11, color: THEME.textSub, fontStyle: 'italic', fontFamily: "'DM Sans',sans-serif" }}>Menu being prepared</span>}
                </div>
              )}
              {isSkipped && (
                <div style={{ fontSize: 11, color: THEME.noColor, fontFamily: "'DM Sans',sans-serif", opacity: 0.85 }}>
                  No meal this slot.
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── REVIEW SCREEN: shown once the final slot is filled — the whole week is
  // listed with ✏️ Edit on every day, so the user can go back and change any
  // day before tapping Submit Weekly Survey. ──
  const ReviewView = () => {
    // Count only the days the user actually has slots for (override users may be
    // granted a subset), so progress never exceeds 100%.
    const completed = dayIndices.filter(idx => dayStatusSummary[idx] === 'complete').length
    const total = dayIndices.length
    const pct = Math.round((completed / total) * 100)
    const allFilled = completed === total
    return (
      <div>
        {/* Banner */}
        <div style={{
          padding: 18, borderRadius: 16, textAlign: 'center', marginBottom: 16,
          background: allFilled
            ? 'linear-gradient(135deg, rgba(76,175,80,0.14), rgba(76,175,80,0.03))'
            : 'linear-gradient(135deg, rgba(255,152,0,0.12), rgba(255,152,0,0.02))',
          border: `1.5px solid ${allFilled ? '#4CAF50' : 'rgba(255,152,0,0.55)'}`,
          animation: 'surveyFadeIn 0.4s ease-out',
        }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: allFilled ? '#4CAF50' : '#FF9800', marginBottom: 4, fontFamily: "'DM Sans',sans-serif" }}>
            {allFilled ? '✅ Week filled — review your choices' : '📋 Review your week'}
          </div>
          <div style={{ fontSize: 12.5, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5 }}>
            {allFilled
              ? 'Everything is saved. Tap ✏️ Edit on any day to go back and change it before submitting.'
              : `You've filled ${completed} of ${total} day${total === 1 ? '' : 's'} — tap ✏️ Edit on a day to complete or change it.`}
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: THEME.textSub, fontFamily: "'DM Sans',sans-serif" }}>Weekly Progress</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: THEME.accent, fontFamily: "'DM Sans',sans-serif" }}>{completed} / {total} days · {pct}%</span>
          </div>
          <div style={{ height: 9, borderRadius: 100, background: THEME.inputBg, border: `1px solid ${THEME.border}`, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: THEME.accentGrad, borderRadius: 100, transition: 'width 0.9s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: `0 0 14px ${THEME.accent}80` }} />
          </div>
        </div>

        <DayList />

        {/* Nav: back to the fill flow + final submit */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={backToFilling} style={{
            padding: '12px 20px', borderRadius: 12, border: `1px solid ${THEME.border}`, background: 'transparent',
            color: THEME.textSub, cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif"
          }}><ChevronLeft size={16} /> Back to filling</button>
          <button onClick={handleSubmitWeekly} disabled={loading} style={{
            marginLeft: 'auto', padding: '12px 24px', borderRadius: 12, border: 'none',
            background: loading ? THEME.border : THEME.accentGrad,
            color: loading ? 'rgba(0,0,0,0.3)' : '#000',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif",
            boxShadow: loading ? 'none' : `0 8px 20px ${THEME.accentBg}`,
            opacity: loading ? 0.6 : 1, transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 12px 28px ${THEME.accentBg}` } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : `0 8px 20px ${THEME.accentBg}` }}
          >{loading ? 'Submitting...' : '✅ Submit Weekly Survey'}</button>
        </div>
      </div>
    )
  }

  // ── LOCKED SLOT VIEW: shown when a slot already has a saved response but the
  // edit window is closed — the response stays readable (read-only) and the user
  // can still move between menus via the nav row. ──
  const LockedSlotView = () => {
    const savedStatus = existingData?.[`${dayKey}_${mealKey}_status`]
    const isApplied = savedStatus === 'Applied'
    const dishList = getSlotDishes(existingData, currentDay, currentMeal, menu[currentMeal] || [])
    const fmtVal = (v, isCount, isRoti) => {
      if (v === undefined || v === null) return null
      if (v === 'No' || v === 'no') return '❌'
      if (isRoti) return '✅'
      if (isCount) return `${v} ppl`
      if (typeof v === 'number') return `${v}%`
      if (typeof v === 'string' && v.endsWith('%')) return v
      return String(v)
    }
    return (
      <div style={{
        marginBottom: 16, padding: 14, borderRadius: 14,
        background: isApplied
          ? 'linear-gradient(135deg, rgba(76,175,80,0.08), rgba(76,175,80,0.02))'
          : 'linear-gradient(135deg, rgba(244,67,54,0.06), rgba(244,67,54,0.01))',
        border: `1.5px solid ${isApplied ? '#4CAF50' : '#F4433660'}`,
        fontFamily: "'DM Sans',sans-serif",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: isApplied ? '#4CAF50' : '#F44336' }}>
            {isApplied ? '✅ Your saved response' : '❌ Skipped — no meal this slot'}
          </span>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: THEME.textSub, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            🔒 read-only · window closed
          </span>
        </div>
        {isApplied && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {dishList.length > 0 ? dishList.map((dish, i) => {
              const v = existingData?.[`${dayKey}_${mealKey}_dish_${i + 1}`]
              const isCount = isCountInput(appSettings, currentDay, currentMeal, i)
              const isRoti = isRotiItem(dish)
              const skipped = v === undefined || v === null || v === 'No' || v === 'no'
              return (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 700,
                  color: skipped ? THEME.noColor : isRoti ? '#4CAF50' : THEME.accent,
                  background: skipped ? THEME.noBg : isRoti ? 'rgba(76,175,80,0.12)' : THEME.accentBg,
                  padding: '3px 8px', borderRadius: 6,
                }}>
                  {dish}: <strong>{skipped ? '❌' : fmtVal(v, isCount, isRoti)}</strong>
                </span>
              )
            }) : <span style={{ fontSize: 11, color: THEME.textSub, fontStyle: 'italic' }}>Menu being prepared</span>}
          </div>
        )}
      </div>
    )
  }

  // ── INTRO SCREEN ──
  if (!dataLoaded) {
    return (
      <div style={{ background: THEME.card, borderRadius: 24, padding: 'clamp(14px, 3vw, 22px)', maxWidth: 800, width: '100%', margin: '0 auto', border: `1px solid ${THEME.border}` }}>
        <style>{SURVEY_STYLES}</style>
        {[1, 2, 3].map(i => <SkeletonDish key={i} theme={THEME} />)}
      </div>
    )
  }

  if (showIntro && !surveySubmitted) {
    return (
      <>
        <style>{SURVEY_STYLES}</style>
        <div style={{
          background: THEME.card, borderRadius: 24, padding: 'clamp(20px, 4vw, 32px)',
          maxWidth: 800, width: '100%', margin: '0 auto', border: `1.5px solid ${THEME.borderActive}`,
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)', position: 'relative', textAlign: 'center'
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
              { icon: '📅', text: `${totalSlots} slot${totalSlots === 1 ? '' : 's'} to fill${overrideSlots ? ' — only your granted meals' : ' — Mon lunch through Sat dinner'}` },
              { icon: '💾', text: 'Auto-saves as you go — resume where you left off' },
              { icon: '✏️', text: 'Review your week before submitting — tap Edit to change any day' },
              { icon: '✅', text: 'Save & Continue to move to the next meal' },
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
      </>
    )
  }

  // ── SUCCESS CELEBRATION SCREEN ──
  if (showSuccess) {
    return (
      <>
        <style>{SURVEY_STYLES}</style>
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', background: THEME.successOverlay, backdropFilter: 'blur(20px)', padding: 20 }}>
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
            <p style={{ margin: 0, fontSize: 11, color: THEME.textSub, opacity: 0.7, fontFamily: "'DM Sans',sans-serif" }}>
              You can still edit any response below.
            </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{SURVEY_STYLES}</style>
      {/* ── POP-UP OVERLAY: the survey now opens as a centered modal, so clicking
          Edit / Start never forces the user to scroll the page. ── */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 10001,
          background: THEME.overlay,
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'clamp(10px, 3vw, 28px)', overflowY: 'auto',
          animation: 'surveyBackdropIn 0.3s ease-out',
        }}
      >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: THEME.modalBg,
          borderRadius: 28, padding: 'clamp(14px, 3vw, 22px)',
          maxWidth: 800, width: '100%', boxSizing: 'border-box',
          border: `1.5px solid ${THEME.modalBorder}`,
          boxShadow: '0 40px 100px rgba(0,0,0,0.65), 0 0 0 1px rgba(212,175,55,0.07), inset 0 1px 0 rgba(255,255,255,0.06)',
          position: 'relative', overflowX: 'hidden', overflowY: 'auto',
          maxHeight: 'calc(100dvh - 40px)',
          animation: 'surveyModalIn 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* ── LOADING OVERLAY ── */}
        {loading && !showSuccess && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 999, borderRadius: 28,
            background: THEME.loadingOverlay, backdropFilter: 'blur(8px)',
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
              {!surveySubmitted && !initialDay && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: THEME.accentBg, color: THEME.accent
                }}>
                  Slot {currentSlot + 1}/{totalSlots}
                </span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: THEME.text, fontFamily: "'Playfair Display',serif" }}>
              {initialDay && !mealPicked
                ? `${currentDay} • Pick a meal`
                : surveySubmitted && !editResponseMode
                  ? 'Your Submitted Plan'
                  : editResponseMode
                    ? `Edit ${currentDay} • ${currentMeal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}`
                    : `${currentDay} • ${currentMeal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}`}
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
            {syncMsg && (
              <span style={{
                fontSize: 11, color: THEME.yesColor, fontWeight: 700,
                fontFamily: "'DM Sans',sans-serif",
                display: 'flex', alignItems: 'center', gap: 4,
                animation: 'surveyPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>
                <span style={{ fontSize: 13 }}>✓</span>
                {syncMsg}
              </span>
            )}
            <button onClick={onClose} style={{ background: THEME.softBg, border: 'none', cursor: 'pointer', padding: 10, borderRadius: 10, color: THEME.textSub, display: 'flex', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = THEME.cardActive; e.currentTarget.style.color = THEME.text }}
              onMouseLeave={e => { e.currentTarget.style.background = THEME.softBg; e.currentTarget.style.color = THEME.textSub }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {initialDay && !mealPicked ? (
          <MealPicker />
        ) : surveySubmitted && !editResponseMode ? (
          <SubmittedView />
        ) : reviewMode && !editResponseMode ? (
          <ReviewView />
        ) : (
          <>
            {/* Editing a submitted (or reviewed) day: day list on top for switching
                days, then the lunch/dinner routine for the selected day */}
            {(surveySubmitted || reviewMode) && editResponseMode ? (
              <div style={{ marginBottom: 16 }}>
                {/* Week day list always shown while editing — even when the modal
                    was deep-linked to a single day — so the user can jump to any
                    other day's menu instead of being stuck on one day. */}
                <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>📅 Your Week</span>
                  <button onClick={() => { setEditResponseMode(false); setViewDay(currentDay) }}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: THEME.accent, fontSize: 10, fontWeight: 800,
                      fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                    <ChevronLeft size={12} /> {reviewMode ? 'Back to review' : 'Back to plan'}
                  </button>
                </div>
                <DayList />
                {/* Lunch/Dinner routine for the day being edited */}
                <MealSwitcher />
              </div>
            ) : !surveySubmitted && initialDay ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textSub, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans',sans-serif" }}>
                    📅 Day {DAYS.indexOf(currentDay) + 1} of {DAYS.length} — {currentDay}
                  </div>
                  <div style={{ fontSize: 10, color: THEME.accent, fontWeight: 800, fontFamily: "'DM Sans',sans-serif" }}>
                    Fill in order · Mon → Sat
                  </div>
                </div>
                <MealSwitcher />
              </div>
            ) : !surveySubmitted && !reviewMode ? (
              /* During the fill flow the day tabs are hidden — the week is filled
                 in order (Mon → Sat) using the Previous / Save & Continue buttons.
                 Day tabs only appear in the review step or after submitting. */
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textSub, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans',sans-serif" }}>
                  📅 Day {DAYS.indexOf(currentDay) + 1} of {DAYS.length} — {currentDay}
                </div>
                <div style={{ fontSize: 10, color: THEME.accent, fontWeight: 800, fontFamily: "'DM Sans',sans-serif" }}>
                  Fill in order · Mon → Sat
                </div>
              </div>
            ) : null}

            {/* ── Slide transition wrapper ── */}
            <div key={`${currentDayIndex}-${currentMeal}${editResponseMode ? '-edit' : ''}`} style={{
              animation: animatingDayDir === 'right' ? 'surveySlideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1)' :
                         animatingDayDir === 'left' ? 'surveySlideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1)' : undefined,
            }}>

            {slotLocked && <div style={{ padding: 16, borderRadius: 12, background: THEME.accentBg, border: `1px solid ${THEME.accent}`, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: THEME.accent, marginBottom: 4, fontFamily: "'DM Sans',sans-serif" }}>🔒 Not Currently Bookable</div>
                <div style={{ fontSize: 12, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif" }}>
                  {userHasOverride
                    ? 'This meal is outside the access granted to you by the admin.'
                    : 'The survey window is currently closed. It opens Saturday 8:00 PM and closes Monday 11:00 AM.'}
                </div>
              </div>}

            {/* An Applied/Skipped slot that can't be edited right now is still
                readable — show exactly what was saved instead of a blank lock. */}
            {slotLocked && existingData?.[`${dayKey}_${mealKey}_status`] && <LockedSlotView />}

            {!hasDishes && !slotLocked && !surveySubmitted && !editResponseMode && (
              <div style={{ marginBottom: 16, padding: 16, borderRadius: 12, background: THEME.cardActive, border: `1px solid ${THEME.border}`, textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textSub, marginBottom: 4, fontFamily: "'DM Sans',sans-serif" }}>
                  📋 Menu not yet available
                </div>
                <div style={{ fontSize: 12, color: THEME.textSub, fontFamily: "'DM Sans',sans-serif" }}>
                  This meal slot will be skipped. You can update it later when the menu is ready.
                </div>
              </div>
            )}

            {(wantsFood === null || wantsFood === false) && !slotLocked && (!surveySubmitted || editResponseMode) && (
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
                    wantsFoodRef.current = true; setWantsFood(true)
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
                      wantsFoodRef.current = false; setWantsFood(false)
                      if (editResponseMode) { await saveAndLockEdit() }
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

            {(wantsFood && !slotLocked && !surveySubmitted) || (wantsFood && editResponseMode) ? (
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
                {wantsFood && !allDishesAnswered && !editResponseMode && (
                  <div style={{
                    marginBottom: 16, padding: '11px 14px', borderRadius: 12,
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
                    color: '#f59e0b', fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'DM Sans',sans-serif"
                  }}>
                    <span style={{ fontSize: 13 }}>⚠️</span>
                    <span>Please answer all items above to continue — the Save & Continue button will save your answers once every dish is filled.</span>
                  </div>
                )}
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

            {/* ── NAVIGATION: Previous / Save & Continue / Review — the week is
                filled in order (Mon → Sat); no day tabs and no auto-save. On the
                final slot the primary action opens the Review step. ── */}
            {!reviewMode && !(surveySubmitted && !editResponseMode) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, position: 'relative', zIndex: 1 }}>
                {currentSlot > 0 && (
                  <button onClick={goToPrev} style={{
                    padding: '12px 20px', borderRadius: 12, border: `1px solid ${THEME.border}`, background: 'transparent',
                    color: THEME.textSub, cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif"
                  }}><ChevronLeft size={16} /> Previous</button>
                )}

                {!isLast && wantsFood !== null && !slotLocked && !editResponseMode && (
                  <button onClick={goToNext} disabled={loading}
                    style={{
                      marginLeft: currentSlot > 0 ? 'auto' : 0, padding: '12px 22px', borderRadius: 12, border: 'none',
                      background: loading ? THEME.border : THEME.accentGrad, color: loading ? 'rgba(0,0,0,0.3)' : '#000',
                      cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 900,
                      display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif",
                      boxShadow: loading ? 'none' : `0 8px 20px ${THEME.accentBg}`,
                      opacity: loading ? 0.6 : 1, transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 12px 28px ${THEME.accentBg}` } }}
                    onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 20px ${THEME.accentBg}` } }}
                  >💾 Save & Continue <ChevronRight size={16} /></button>
                )}

                {/* When the slot is locked (window closed) or being edited, the
                    nav still moves between menus — browsing never requires the
                    slot to be currently bookable. */}
                {!isLast && (slotLocked || editResponseMode) && (
                  <button onClick={goToNext}
                    style={{
                      marginLeft: currentSlot > 0 ? 'auto' : 0, padding: '12px 22px', borderRadius: 12,
                      border: `1px solid ${THEME.border}`, background: 'transparent',
                      color: THEME.text, cursor: 'pointer', fontSize: 13, fontWeight: 800,
                      display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif",
                    }}
                  >Next menu <ChevronRight size={16} /></button>
                )}

                {isLast && !slotLocked && !surveySubmitted && (
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {userHasOverride || initialDay ? (
                      /* Override flow or Day-scoped deep-link: direct submit button on final slot */
                      <button onClick={handleSubmitWeekly}
                        disabled={loading}
                        style={{
                          padding: '12px 24px', borderRadius: 12, border: 'none',
                          background: loading ? THEME.border : THEME.accentGrad,
                          color: loading ? 'rgba(0,0,0,0.3)' : '#000',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif",
                          boxShadow: loading ? 'none' : `0 8px 20px ${THEME.accentBg}`,
                          opacity: loading ? 0.6 : 1,
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 12px 28px ${THEME.accentBg}` } }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : `0 8px 20px ${THEME.accentBg}` }}
                      >{loading ? 'Submitting...' : (userHasOverride ? '🚀 Submit Override Survey' : '✅ Submit Weekly Survey')}</button>
                    ) : (
                      /* Full-week fill flow: the final slot hands off to the review step */
                      <button onClick={openReview}
                        disabled={loading}
                        style={{
                          padding: '12px 22px', borderRadius: 12, border: 'none',
                          background: loading ? THEME.border : THEME.accentGrad,
                          color: loading ? 'rgba(0,0,0,0.3)' : '#000',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif",
                          boxShadow: loading ? 'none' : `0 8px 20px ${THEME.accentBg}`,
                          opacity: loading ? 0.6 : 1,
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 12px 28px ${THEME.accentBg}` } }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : `0 8px 20px ${THEME.accentBg}` }}
                      >{loading ? 'Saving...' : '📋 Review & Submit'} <ChevronRight size={16} /></button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      </div>

      {/* ── PREMIUM SUBMIT-RESULT POPUP: exact status when the final submit
          button is hit — missing slots or a save error. Success uses the
          dedicated celebration screen above. ── */}
      {submitResult && (
        <>
          <style>{SURVEY_STYLES}</style>
          <div style={{
            position: 'fixed', inset: 0, zIndex: 10002,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(5,5,10,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            padding: 20, animation: 'surveyBackdropIn 0.3s ease-out',
          }}>
            <div style={{
              background: THEME.modalBg,
              borderRadius: 24, padding: '28px 24px', width: '100%', maxWidth: 420, boxSizing: 'border-box',
              border: `1.5px solid ${submitResult.type === 'missing' ? 'rgba(255,152,0,0.55)' : 'rgba(244,67,54,0.55)'}`,
              boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
              textAlign: 'center',
              animation: 'surveyModalIn 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
                background: submitResult.type === 'missing'
                  ? 'linear-gradient(135deg, #FF9800, #F57C00)'
                  : 'linear-gradient(135deg, #F44336, #D32F2F)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 40px ${submitResult.type === 'missing' ? 'rgba(255,152,0,0.4)' : 'rgba(244,67,54,0.4)'}`,
                animation: 'surveyPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>
                <span style={{ fontSize: 32 }}>{submitResult.type === 'missing' ? '⚠️' : '❌'}</span>
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800, color: submitResult.type === 'missing' ? '#FF9800' : '#F44336', fontFamily: "'Playfair Display',serif" }}>
                {submitResult.title}
              </h3>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: THEME.textSub, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>
                {submitResult.message}
              </p>
              {submitResult.missingSlots && submitResult.missingSlots.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 6 }}>
                  {submitResult.missingSlots.map(s => (
                    <span key={`${s.day}-${s.meal}`} style={{
                      fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 100,
                      background: 'rgba(255,152,0,0.12)', color: '#FF9800', border: '1px solid rgba(255,152,0,0.3)',
                      fontFamily: "'DM Sans',sans-serif",
                    }}>{s.day.substring(0, 3).toUpperCase()} {s.meal}</span>
                  ))}
                </div>
              )}
              {submitResult.filled !== undefined && (
                <div style={{ fontSize: 12, fontWeight: 800, color: THEME.text, fontFamily: "'DM Sans',sans-serif", marginBottom: 14 }}>
                  Filled <span style={{ color: submitResult.type === 'missing' ? '#FF9800' : '#F44336' }}>{submitResult.filled}</span> of {submitResult.total} slot{submitResult.total === 1 ? '' : 's'}
                </div>
              )}
              <button onClick={() => setSubmitResult(null)} style={{
                width: '100%', padding: 14, borderRadius: 14, border: 'none',
                background: submitResult.type === 'missing' ? 'linear-gradient(135deg, #FF9800, #F57C00)' : 'linear-gradient(135deg, #F44336, #D32F2F)',
                color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", marginTop: 16,
                boxShadow: `0 8px 24px ${submitResult.type === 'missing' ? 'rgba(255,152,0,0.35)' : 'rgba(244,67,54,0.35)'}`,
              }}>
                {submitResult.type === 'missing' ? 'Fill Missing Slots' : 'Try Again'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
