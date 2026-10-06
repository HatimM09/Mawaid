import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight, Check, AlertTriangle, Play, Sun, Moon, Lock, CalendarRange, Layers } from 'lucide-react'
import { supabase } from '../lib/firebaseClient'
import { useAuth } from '../admin/context'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { DAYS, getSurveyTargetWeek, formatWeekRange, parseDishArray } from '../common/utils'
import { DEFAULT_MENU } from '../common/constants'
import {
  isRotiItem, isCountInput, canEditMeal, isSurveyOpen,
  normalizeDishValue, denormalizeDishValue, getPctColor,
  mergeDishSnapshot, getSlotDishes,
} from '../hooks/useSurvey'
import { submitSurveyRow, submitSurveyRows, beginSurvey } from '../lib/submitSurvey'
import { fetchUserSurveyRow } from '../lib/surveyRows'

// ── Bright survey theme (always vivid/high-contrast) ────────────────────
// The survey is the one place every member must tap through, so it uses its
// own bright celebratory palette regardless of the app's dark/light theme:
// warm cream sheet, dark cocoa text, vivid green/red/amber/blue choices.
const BASE_THEME = {
  bg: '#FFF9EF',
  card: '#FFFFFF',
  border: '#F0DDAE',
  accent: '#D97706',
  accentGrad: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
  accentBg: '#FEF3C7',
  accentBorder: '#F59E0B',
  text: '#3A2C14',
  textSub: '#8A7A63',
  inputBg: '#FFFFFF',
  yesColor: '#16A34A',
  yesBg: '#DCFCE7',
  noColor: '#DC2626',
  noBg: '#FEE2E2',
  overlay: 'rgba(24,16,4,0.72)',
  successOverlay: 'rgba(255,251,235,0.97)',
  modalBg: 'linear-gradient(165deg,#FFFEFB 0%,#FFF7E6 60%,#FFFBEB 100%)',
  modalBorder: '#F59E0B',
  loadingOverlay: 'rgba(255,251,235,0.9)',
  softBg: '#FFF7E6',
  softBorder: '#F3DFAE',
}

function buildTheme() {
  return { ...BASE_THEME }
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '')

const SURVEY_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&family=Playfair+Display:wght@700;800&display=swap');
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes surveyPop { 0%{transform:scale(0.85);opacity:0.5} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
@keyframes surveyBadgePop { 0%{transform:scale(0)} 50%{transform:scale(1.2)} 100%{transform:scale(1)} }
@keyframes surveyGlow { 0%,100%{box-shadow:0 0 6px rgba(76,175,80,0.2)} 50%{box-shadow:0 0 18px rgba(76,175,80,0.5)} }
@keyframes surveySuccess { 0%{transform:scale(0.3);opacity:0} 50%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
@keyframes surveyModalIn { 0%{opacity:0;transform:translateY(28px) scale(0.97)} 100%{opacity:1;transform:translateY(0) scale(1)} }
@keyframes surveyFadeIn { 0%{opacity:0;transform:translateY(8px)} 100%{opacity:1;transform:translateY(0)} }
@keyframes shimmer { 0%{ transform: translateX(-100%) } 100%{ transform: translateX(200%) } }
@keyframes dishPickPop { 0%{transform:scale(0.88)} 45%{transform:scale(1.07)} 70%{transform:scale(0.98)} 100%{transform:scale(1)} }
@keyframes dishCardFlash { 0%{box-shadow:0 0 0 0 rgba(245,158,11,0.55)} 100%{box-shadow:0 0 0 14px rgba(245,158,11,0)} }
@keyframes dishCheckBurst { 0%{transform:scale(0) rotate(-30deg);opacity:0} 55%{transform:scale(1.25) rotate(6deg);opacity:1} 100%{transform:scale(1) rotate(0)} }
.dish-pick-btn { -webkit-tap-highlight-color: transparent; }
.dish-pick-btn:active { transform: scale(0.94) !important; }
.dish-pick-pop { animation: dishPickPop 0.34s cubic-bezier(0.34,1.56,0.64,1); }
.dish-card-flash { animation: dishCardFlash 0.55s ease-out; }
.dish-check-burst { display:inline-block; animation: dishCheckBurst 0.4s cubic-bezier(0.34,1.56,0.64,1); }
.dish-count-pop { animation: dishPickPop 0.3s cubic-bezier(0.34,1.56,0.64,1); }
`

const createEmptyDay = () => ({ lunchWantsFood: null, lunchResponses: {}, dinnerWantsFood: null, dinnerResponses: {} })
const createInitialWeekDataForWeeks = (weekIds) => {
  const out = {}
  weekIds.forEach(wid => {
    out[wid] = {}
    DAYS.forEach(d => { out[wid][d.substring(0,3).toLowerCase()] = createEmptyDay() })
  })
  return out
}

// ────────────────────────────────────────────────────────────────────
// DishRow — defined OUTSIDE the main component so it is stable across renders
// Bright, explicit states: NOTHING is ever pre-selected. An unanswered dish
// shows a dashed amber "TAP TO CHOOSE" frame; a chosen dish shows a solid
// vivid frame plus a summary pill with the exact picked value.
// ────────────────────────────────────────────────────────────────────
const DISH_FONT = "'DM Sans',sans-serif"

function ChoiceBtn({ selected, color, onClick, children, style: extra = {}, popKey }) {
  return (
    <button key={popKey} type="button" onClick={onClick}
      className={selected ? 'dish-pick-btn dish-pick-pop' : 'dish-pick-btn'}
      style={{
        flex: 1, minHeight: 48, padding: '13px 8px', borderRadius: 13,
        border: selected ? `2px solid ${color}` : '2px solid #EADFC6',
        background: selected ? color : '#FFFFFF',
        color: selected ? '#FFFFFF' : '#6B5D43',
        fontSize: 13.5, fontWeight: 900, cursor: 'pointer', fontFamily: DISH_FONT,
        boxShadow: selected ? `0 6px 18px ${color}55` : '0 1px 3px rgba(90,70,30,0.10)',
        transition: 'all 0.18s', touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent', ...extra,
      }}>
      {children}
    </button>
  )
}

function DishRow({ dish, idx, mealType, value, onChange, T, appSettings, currentDay, snackDefaults }) {
  const isRoti = isRotiItem(dish)
  const isCount = !isRoti && isCountInput(appSettings, currentDay, mealType, idx)
  const profileCount = snackDefaults?.[`dish_${idx + 1}`]
  const maxVal = (profileCount !== undefined && profileCount !== null && profileCount >= 0) ? profileCount : 99

  // Human-readable summary of the CURRENT selection — always visible once chosen
  const summary = (() => {
    if (isRoti) {
      if (value === 'yes') return { label: '✅ YES — I want this', color: T.yesColor }
      if (value === 'no') return { label: '❌ NO — skip this', color: T.noColor }
      return null
    }
    if (isCount) {
      if (value && typeof value === 'object' && value.status === 'yes') {
        const n = value.value || 1
        return { label: `✅ ${n} ${n === 1 ? 'PERSON' : 'PERSONS'}`, color: T.yesColor }
      }
      if (value === 'no') return { label: '❌ SKIP THIS DISH', color: T.noColor }
      return null
    }
    if (typeof value === 'number') {
      const c = getPctColor(value) || T.accent
      return { label: value === 0 ? '❌ 0% — none for me' : `✅ ${value}% portion`, color: c }
    }
    return null
  })()
  const answered = !!summary
  const frameColor = answered ? summary.color : '#F59E0B'

  const cardStyle = {
    marginBottom: 10, padding: '13px 14px', borderRadius: 16, position: 'relative',
    background: answered ? '#FFFFFF' : '#FFFBEB',
    border: answered ? `2px solid ${frameColor}` : '2px dashed #F59E0B',
    boxShadow: answered ? `0 4px 16px ${frameColor}22` : 'none',
    transition: 'all 0.2s',
  }
  // Replay-key signature: changing selection remounts the flash + pill + pop.
  const sig = answered ? summary.label : 'pending'
  const flash = <div key={`flash-${dish}-${sig}`} className="dish-card-flash" style={{ position: 'absolute', inset: -2, borderRadius: 17, border: `2px solid ${frameColor}`, pointerEvents: 'none' }} />
  const titleStyle = { fontSize: 14, fontWeight: 800, color: '#3A2C14', fontFamily: DISH_FONT }
  const pendingPill = (
    <span style={{ fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 999, background: '#FEF3C7', color: '#B45309', border: '1.5px dashed #F59E0B', whiteSpace: 'nowrap', animation: 'surveyBadgePop 0.3s ease' }}>
      👆 TAP TO CHOOSE
    </span>
  )
  const donePill = answered && (
    <span key={`pill-${dish}-${sig}`} style={{ fontSize: 11, fontWeight: 900, padding: '4px 10px', borderRadius: 999, background: '#FFFFFF', color: summary.color, border: `2px solid ${summary.color}`, whiteSpace: 'nowrap', boxShadow: `0 2px 8px ${summary.color}33`, animation: 'surveyBadgePop 0.3s ease' }}>
      {summary.label}
    </span>
  )

  if (isRoti) {
    return (
      <div style={cardStyle}>
        {flash}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={titleStyle}>🫓 {dish}</div>
          {answered ? donePill : pendingPill}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ChoiceBtn popKey={`roti-yes-${value === 'yes'}`} selected={value === 'yes'} color={T.yesColor} onClick={() => onChange(dish, 'yes')}>✅ Yes, please</ChoiceBtn>
          <ChoiceBtn popKey={`roti-no-${value === 'no'}`} selected={value === 'no'} color={T.noColor} onClick={() => onChange(dish, 'no')}>❌ No, skip</ChoiceBtn>
        </div>
      </div>
    )
  }

  if (isCount) {
    const isYes = value && typeof value === 'object' && value.status === 'yes'
    const isSkipped = value === 'no'
    const countNum = isYes ? (value.value || 1) : 0
    const atMax = maxVal > 0 ? countNum >= maxVal : true
    const showInitial = value === undefined || value === null
    return (
      <div style={cardStyle}>
        {flash}
        <div style={{ fontSize: 14, fontWeight: 800, color: '#3A2C14', marginBottom: 10, fontFamily: DISH_FONT, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>🍛 {dish}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {answered ? donePill : pendingPill}
            {maxVal < 99 && <span style={{ fontSize: 10, color: T.accent, fontWeight: 800, background: T.accentBg, padding: '3px 8px', borderRadius: 6, border: `1px solid ${T.accentBorder}` }}>Max: {maxVal}</span>}
          </span>
        </div>
        {showInitial && (
          <div style={{ display: 'flex', gap: 10 }}>
            <ChoiceBtn popKey={`count-${dish}-init-yes`} selected={false} color={T.yesColor} onClick={() => onChange(dish, { status: 'yes', value: Math.max(1, Math.min(maxVal || 99, 1)) })}>✅ Yes, I want</ChoiceBtn>
            <ChoiceBtn popKey={`count-${dish}-init-no`} selected={false} color={T.noColor} onClick={() => onChange(dish, 'no')}>❌ No, skip</ChoiceBtn>
          </div>
        )}
        {isSkipped && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div key={`skip-${dish}`} className="dish-pick-pop" style={{ padding: '10px 18px', borderRadius: 12, background: T.noColor, color: '#fff', fontSize: 13, fontWeight: 900, fontFamily: DISH_FONT, boxShadow: `0 4px 14px ${T.noColor}44` }}>❌ Skipped</div>
            <button type="button" onClick={() => onChange(dish, { status: 'yes', value: Math.max(1, Math.min(maxVal || 99, 1)) })}
              className="dish-pick-btn"
              style={{ marginLeft: 'auto', minHeight: 44, padding: '10px 20px', borderRadius: 12, border: `2px solid ${T.accent}`, background: '#FFFFFF', color: T.accent, fontSize: 13, fontWeight: 900, cursor: 'pointer', fontFamily: DISH_FONT, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>↩️ Add back</button>
          </div>
        )}
        {isYes && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F0FDF4', borderRadius: 14, padding: '6px 8px', border: `2px solid ${T.yesColor}`, boxShadow: `0 4px 16px ${T.yesColor}22` }}>
              <button type="button" onClick={() => onChange(dish, { status: 'yes', value: Math.max(1, countNum - 1) })} disabled={countNum <= 1}
                className="dish-pick-btn"
                style={{ width: 44, height: 44, borderRadius: 12, border: `2px solid ${countNum <= 1 ? '#EADFC6' : T.yesColor}`, background: '#fff', color: countNum <= 1 ? '#B9A87F' : T.yesColor, cursor: countNum <= 1 ? 'not-allowed' : 'pointer', fontSize: 22, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: countNum <= 1 ? 0.5 : 1, transition: 'all 0.2s', touchAction: 'manipulation' }}>−</button>
              <div style={{ textAlign: 'center', minWidth: 64 }}>
                <div key={`count-${dish}-${countNum}`} className="dish-count-pop" style={{ fontSize: 30, fontWeight: 900, color: T.yesColor, lineHeight: 1, fontFamily: DISH_FONT }}>{countNum}</div>
                <div style={{ fontSize: 10, color: '#5F7A63', fontWeight: 800 }}>{countNum === 1 ? 'person' : 'persons'}</div>
              </div>
              <button type="button" onClick={() => { if (!atMax) onChange(dish, { status: 'yes', value: Math.min(maxVal, countNum + 1) }) }} disabled={atMax}
                className="dish-pick-btn"
                style={{ width: 44, height: 44, borderRadius: 12, border: `2px solid ${atMax ? '#EADFC6' : T.yesColor}`, background: atMax ? '#fff' : T.yesColor, color: atMax ? '#B9A87F' : '#fff', cursor: atMax ? 'not-allowed' : 'pointer', fontSize: 22, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: atMax ? 0.5 : 1, transition: 'all 0.2s', touchAction: 'manipulation' }}>+</button>
            </div>
            <button type="button" onClick={() => onChange(dish, 'no')}
              className="dish-pick-btn"
              style={{ marginLeft: 'auto', minHeight: 44, padding: '11px 18px', borderRadius: 12, border: `2px solid ${T.noColor}`, background: '#fff', color: T.noColor, fontSize: 12.5, fontWeight: 900, cursor: 'pointer', fontFamily: DISH_FONT, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>❌ Skip dish</button>
          </div>
        )}
      </div>
    )
  }

  // Percentage / portion dish — nothing pre-selected; user taps 0–100%
  return (
    <div style={cardStyle}>
      {flash}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={titleStyle}>🍽️ {dish}</div>
        {answered ? donePill : pendingPill}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 25, 50, 75, 100].map(pct => {
          const color = getPctColor(pct) || T.accent
          const isSel = value === pct
          return (
            <ChoiceBtn key={`pct-${dish}-${pct}`} popKey={`pct-${dish}-${pct}-${isSel ? 'on' : 'off'}`} selected={isSel} color={color}
              onClick={() => onChange(dish, pct)} style={{ fontSize: 14, padding: '13px 2px' }}>
              {isSel ? `✓ ${pct}%` : `${pct}%`}
            </ChoiceBtn>
          )
        })}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Main SurveyModal — streamlined for 1-week (12 meals: Mon-Sat Lunch & Dinner)
// ────────────────────────────────────────────────────────────────────

export default function SurveyModal({ onClose, appSettings = {}, initialDay, initialMeal, initialWeekId }) {
  const { user } = useAuth()
  // Bright survey sheet — intentionally independent of the app theme.
  const T = useMemo(() => buildTheme(), [])
  const [liveAppSettings, setLiveAppSettings] = useState(appSettings || {})
  useEffect(() => {
    if (appSettings && Object.keys(appSettings).length > 0) setLiveAppSettings(appSettings)
    else supabase.from('app_settings').select('*').then(({ data }) => {
      if (data && data.length) { const s = {}; data.forEach(r => { if (r && r.key) s[r.key] = r.value }); setLiveAppSettings(s) }
    }).catch(() => {})
  }, [appSettings])
  useEffect(() => { setLiveAppSettings(appSettings || {}) }, [appSettings])

  const targetWeekId = useMemo(() => initialWeekId || getSurveyTargetWeek(liveAppSettings), [initialWeekId, liveAppSettings])
  const totalSlots = 12
  const weeklyMenuRaw = useWeeklyMenu(targetWeekId)

  const resolveWeekMenu = useCallback((day) => {
    return weeklyMenuRaw?.[day] || weeklyMenuRaw?.[cap(day)] || weeklyMenuRaw?.[day.substring(0,3).toLowerCase()] || { lunch: [], dinner: [] }
  }, [weeklyMenuRaw])

  const initialDayIdx = useMemo(() => {
    if (!initialDay) return 0
    const idx = DAYS.findIndex(d => d.toLowerCase() === String(initialDay).toLowerCase())
    return idx !== -1 ? idx : 0
  }, [initialDay])

  const [currentDayIndex, setCurrentDayIndex] = useState(initialDayIdx)
  const [weekData, setWeekData] = useState(() => {
    const out = {}
    DAYS.forEach(d => { out[d.substring(0,3).toLowerCase()] = createEmptyDay() })
    return out
  })
  const dirtyRef = useRef(new Set()) // "dk"

  const [existingRow, setExistingRow] = useState(null)
  const [userData, setUserData] = useState({ thali_no: '', email: user?.email || '' })
  const [snackDefaults, setSnackDefaults] = useState(null)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [surveySubmitted, setSurveySubmitted] = useState(false)
  const [showIntro, setShowIntro] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorToast, setErrorToast] = useState(null)
  const [syncMsg, setSyncMsg] = useState(null)
  const [submitResult, setSubmitResult] = useState(null)

  const dinnerCardRef = useRef(null)
  const bottomNavRef = useRef(null)
  const modalScrollRef = useRef(null)

  const currentDay = DAYS[currentDayIndex] || 'monday'
  const currentDayName = cap(currentDay)
  const dayKey = currentDay.substring(0, 3).toLowerCase()

  const activeDayState = weekData[dayKey] || createEmptyDay()
  const { lunchWantsFood, lunchResponses, dinnerWantsFood, dinnerResponses } = activeDayState

  // Menu for active slot
  const activeMenu = useMemo(() => resolveWeekMenu(currentDay), [resolveWeekMenu, currentDay])
  const lunchDishes = useMemo(() => {
    if (activeMenu?.lunch?.length) return activeMenu.lunch
    const snap = getSlotDishes(existingRow, currentDay, 'lunch', [])
    if (snap?.length) return snap
    return parseDishArray(DEFAULT_MENU[dayKey]?.lunch)
  }, [activeMenu, existingRow, currentDay, dayKey])
  const dinnerDishes = useMemo(() => {
    if (activeMenu?.dinner?.length) return activeMenu.dinner
    const snap = getSlotDishes(existingRow, currentDay, 'dinner', [])
    if (snap?.length) return snap
    return parseDishArray(DEFAULT_MENU[dayKey]?.dinner)
  }, [activeMenu, existingRow, currentDay, dayKey])

  const surveyOpen = isSurveyOpen(liveAppSettings, user?.id)
  const lunchEditable = canEditMeal(currentDay, targetWeekId, 'lunch', liveAppSettings)
  const dinnerEditable = canEditMeal(currentDay, targetWeekId, 'dinner', liveAppSettings)
  const dayEditable = surveyOpen || lunchEditable || dinnerEditable

  // Validation — a dish counts as answered ONLY when the user tapped it.
  // Nothing is ever pre-filled: missing values stay unanswered (null).
  const isDishAnswered = useCallback((dish, val, isCount) => {
    if (isRotiItem(dish)) return val === 'yes' || val === 'no'
    if (isCount) return val === 'no' || (val && typeof val === 'object' && val.status === 'yes' && val.value > 0)
    return typeof val === 'number'
  }, [])

  // Strict per-meal completion: skipped counts as done; "wants food" counts
  // as done only when EVERY menu dish has an explicit user choice (local
  // state first, saved server row as fallback).
  const isMealDone = useCallback((dayName, meal) => {
    const dk = dayName.substring(0, 3).toLowerCase()
    const mk = meal === 'lunch' ? 'l' : 'd'
    const menu = resolveWeekMenu(dayName)?.[meal] || []
    const st = weekData[dk]
    const localWant = st ? (meal === 'lunch' ? st.lunchWantsFood : st.dinnerWantsFood) : null
    const localResp = st ? (meal === 'lunch' ? st.lunchResponses : st.dinnerResponses) : {}
    if (localWant === false) return true
    if (localWant === true) {
      if (menu.length === 0) return true
      return menu.every((dish, idx) => isDishAnswered(dish, localResp?.[dish], isCountInput(liveAppSettings, dayName, meal, idx)))
    }
    const srvStatus = existingRow?.[`${dk}_${mk}_status`]
    if (!srvStatus) return false
    if (srvStatus === 'Skipped' || srvStatus === 'opted_out') return true
    if (menu.length === 0) return true
    return menu.every((_, idx) => {
      const v = existingRow?.[`${dk}_${mk}_dish_${idx + 1}`]
      return v !== undefined && v !== null && v !== ''
    })
  }, [weekData, existingRow, resolveWeekMenu, liveAppSettings, isDishAnswered])

  const isLunchComplete = isMealDone(currentDay, 'lunch')
  const isDinnerComplete = isMealDone(currentDay, 'dinner')
  const isDayComplete = lunchWantsFood !== null && dinnerWantsFood !== null && isLunchComplete && isDinnerComplete

  // Visible "what I picked" counters for the open day
  const lunchPicked = lunchDishes.filter((d, i) => isDishAnswered(d, lunchResponses[d], isCountInput(liveAppSettings, currentDay, 'lunch', i))).length
  const dinnerPicked = dinnerDishes.filter((d, i) => isDishAnswered(d, dinnerResponses[d], isCountInput(liveAppSettings, currentDay, 'dinner', i))).length

  // Progress counts only fully-decided meals (12 max)
  const totalFilled = useMemo(() => {
    let c = 0
    DAYS.forEach(d => {
      if (isMealDone(d, 'lunch')) c++
      if (isMealDone(d, 'dinner')) c++
    })
    return Math.min(12, c)
  }, [isMealDone])
  const pctGlobal = Math.round((totalFilled / totalSlots) * 100)

  useEffect(()=>{ if(!errorToast) return; const t=setTimeout(()=>setErrorToast(null),4000); return()=>clearTimeout(t)}, [errorToast])
  useEffect(()=>{ if(!syncMsg) return; const t=setTimeout(()=>setSyncMsg(null),2400); return()=>clearTimeout(t)}, [syncMsg])

  // Hydrate helper — restores ONLY what the user explicitly saved.
  // Dishes without a saved value stay unanswered (never auto-filled).
  const hydrateFromRow = useCallback((row) => {
    if (!row) return
    setWeekData(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      DAYS.forEach(d => {
        const dk = d.substring(0,3).toLowerCase()
        if (dirtyRef.current.has(dk)) return
        const lVal = row[`${dk}_l_status`]
        const dVal = row[`${dk}_d_status`]
        const dayMenu = resolveWeekMenu(d)
        const lDishes = dayMenu?.lunch?.length ? dayMenu.lunch : (getSlotDishes(row, d, 'lunch', []).length ? getSlotDishes(row, d, 'lunch', []) : parseDishArray(DEFAULT_MENU[dk]?.lunch))
        const dDishes = dayMenu?.dinner?.length ? dayMenu.dinner : (getSlotDishes(row, d, 'dinner', []).length ? getSlotDishes(row, d, 'dinner', []) : parseDishArray(DEFAULT_MENU[dk]?.dinner))
        if (!next[dk]) next[dk] = createEmptyDay()
        const entry = { ...next[dk] }
        if (lVal === 'Applied' || lVal === 'opted_in') {
          entry.lunchWantsFood = true
          const m = {}
          lDishes.forEach((dish, i) => {
            const raw = row[`${dk}_l_dish_${i+1}`]
            if (raw !== undefined && raw !== null && raw !== '') {
              m[dish] = normalizeDishValue(raw, dish, isCountInput(liveAppSettings, d, 'lunch', i))
            }
          })
          entry.lunchResponses = m
        } else if (lVal === 'Skipped' || lVal === 'opted_out') { entry.lunchWantsFood = false; entry.lunchResponses = {} }
        if (dVal === 'Applied' || dVal === 'opted_in') {
          entry.dinnerWantsFood = true
          const m = {}
          dDishes.forEach((dish, i) => {
            const raw = row[`${dk}_d_dish_${i+1}`]
            if (raw !== undefined && raw !== null && raw !== '') {
              m[dish] = normalizeDishValue(raw, dish, isCountInput(liveAppSettings, d, 'dinner', i))
            }
          })
          entry.dinnerResponses = m
        } else if (dVal === 'Skipped' || dVal === 'opted_out') { entry.dinnerWantsFood = false; entry.dinnerResponses = {} }
        next[dk] = entry
      })
      return next
    })
  }, [resolveWeekMenu, liveAppSettings])

  const activeUserId = user?.id || user?.user_id

  // Load
  const loadData = useCallback(async () => {
    try {
      if (activeUserId) {
        const { data: u } = await supabase.from('user_stats').select('thali_number,email,snack_defaults').eq('user_id', activeUserId).maybeSingle()
        if (u) { setUserData(prev => prev.thali_no ? prev : { thali_no: u.thali_number || '', email: u.email || user?.email || '' }); if (u.snack_defaults) setSnackDefaults(prev => prev || u.snack_defaults) }
      }
      const { data: row } = await fetchUserSurveyRow(activeUserId, targetWeekId)
      setExistingRow(row || null)
      setDataLoaded(true)
      if (row) {
        hydrateFromRow(row)
        const allLocked = DAYS.every(d => {
          const dk = d.substring(0,3).toLowerCase()
          return row[`${dk}_l_status`] && row[`${dk}_d_status`]
        })
        setSurveySubmitted(allLocked)
      }
    } catch { setDataLoaded(true) }
  }, [activeUserId, targetWeekId, hydrateFromRow, user?.email])
  useEffect(() => { loadData() }, [loadData])

  // Realtime
  useEffect(() => {
    if (!activeUserId) return
    const ch = supabase.channel(`survey-sync-${activeUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_day_responses', filter: `user_id=eq.${activeUserId}` }, async () => {
        const { data: row } = await fetchUserSurveyRow(activeUserId, targetWeekId)
        if (row) { setExistingRow(row); hydrateFromRow(row) }
      }).subscribe()
    return () => supabase.removeChannel(ch)
  }, [activeUserId, targetWeekId, hydrateFromRow])

  // Position to first incomplete
  const positionedRef = useRef(false)
  useEffect(() => {
    if (!dataLoaded || positionedRef.current || initialDay) return
    positionedRef.current = true
    const idx = DAYS.findIndex(d => {
      const dk = d.substring(0,3).toLowerCase()
      return !existingRow?.[`${dk}_l_status`] || !existingRow?.[`${dk}_d_status`]
    })
    if (idx !== -1) setCurrentDayIndex(idx)
  }, [dataLoaded, existingRow, initialDay])

  useEffect(() => {
    if (initialDay || !dataLoaded || surveySubmitted || existingRow) return
    if (!localStorage.getItem('almawaid_survey_intro_seen')) setShowIntro(true)
  }, [dataLoaded, surveySubmitted, existingRow, initialDay])

  const handleStartSurvey = () => {
    try { localStorage.setItem('almawaid_survey_intro_seen', '1') } catch {}
    setShowIntro(false)
    if (activeUserId && targetWeekId) beginSurvey(activeUserId, [targetWeekId])
    setCurrentDayIndex(0)
  }

  // Build payload
  const buildPayloadForSlot = useCallback((dayIdx, isFinalSubmit = false) => {
    const tDay = DAYS[dayIdx] || currentDay
    const tDayKey = tDay.substring(0,3).toLowerCase()
    const tState = weekData[tDayKey] || createEmptyDay()
    const tMenu = resolveWeekMenu(tDay)
    const tLunchDishes = tMenu?.lunch?.length ? tMenu.lunch : (getSlotDishes(existingRow, tDay, 'lunch', []).length ? getSlotDishes(existingRow, tDay, 'lunch', []) : parseDishArray(DEFAULT_MENU[tDayKey]?.lunch))
    const tDinnerDishes = tMenu?.dinner?.length ? tMenu.dinner : (getSlotDishes(existingRow, tDay, 'dinner', []).length ? getSlotDishes(existingRow, tDay, 'dinner', []) : parseDishArray(DEFAULT_MENU[tDayKey]?.dinner))
    
    // Check local state first, fallback to existing row if untouched in this session
    let lStatus = tState.lunchWantsFood === true ? 'Applied' : tState.lunchWantsFood === false ? 'Skipped' : null
    let dStatus = tState.dinnerWantsFood === true ? 'Applied' : tState.dinnerWantsFood === false ? 'Skipped' : null
    if (!lStatus && existingRow?.[`${tDayKey}_l_status`]) lStatus = existingRow[`${tDayKey}_l_status`]
    if (!dStatus && existingRow?.[`${tDayKey}_d_status`]) dStatus = existingRow[`${tDayKey}_d_status`]

    const nowIso = new Date().toISOString()
    const payload = {
      user_id: activeUserId,
      week_id: targetWeekId,
      day: tDayKey,
      thali_number: userData.thali_no,
      email: userData.email || user?.email || '',
      updated_at: nowIso
    }
    if (isFinalSubmit) {
      payload.submitted_at = nowIso
    }

    let snap = mergeDishSnapshot(existingRow, tDay, 'lunch', tLunchDishes)
    snap = mergeDishSnapshot({ dish_snapshot: snap }, tDay, 'dinner', tDinnerDishes)
    payload.dish_snapshot = snap
    if (lStatus) payload[`${tDayKey}_l_status`] = lStatus
    if (dStatus) payload[`${tDayKey}_d_status`] = dStatus

    if (lStatus === 'Applied') {
      tLunchDishes.forEach((dish, idx) => {
        const val = tState.lunchResponses?.[dish] ?? existingRow?.[`${tDayKey}_l_dish_${idx+1}`]
        const isCount = isCountInput(liveAppSettings, tDay, 'lunch', idx)
        // Only explicit user choices are written — never invent a default.
        if (val !== undefined && val !== null && val !== '') {
          payload[`${tDayKey}_l_dish_${idx+1}`] = denormalizeDishValue(val, dish, isCount)
        }
      })
    }
    if (dStatus === 'Applied') {
      tDinnerDishes.forEach((dish, idx) => {
        const val = tState.dinnerResponses?.[dish] ?? existingRow?.[`${tDayKey}_d_dish_${idx+1}`]
        const isCount = isCountInput(liveAppSettings, tDay, 'dinner', idx)
        // Only explicit user choices are written — never invent a default.
        if (val !== undefined && val !== null && val !== '') {
          payload[`${tDayKey}_d_dish_${idx+1}`] = denormalizeDishValue(val, dish, isCount)
        }
      })
    }
    return payload
  }, [currentDay, weekData, existingRow, activeUserId, userData, user?.email, liveAppSettings, resolveWeekMenu, targetWeekId])

  const saveSlot = useCallback(async (dayIdx) => {
    if (loading) return false
    const tDay = DAYS[dayIdx] || currentDay
    const tDayKey = tDay.substring(0,3).toLowerCase()
    const tState = weekData[tDayKey]
    if (!tState || (tState.lunchWantsFood === null && tState.dinnerWantsFood === null)) return true
    setLoading(true)
    try {
      const payload = buildPayloadForSlot(dayIdx)
      const { error } = await submitSurveyRow(payload)
      if (error) throw error
      dirtyRef.current.delete(tDayKey)
      const { data: row } = await fetchUserSurveyRow(activeUserId, targetWeekId)
      if (row) setExistingRow(row)
      setSyncMsg(`Saved ${cap(tDay)} · ${formatWeekRange(targetWeekId)}`)
      return true
    } catch(err) { setErrorToast(`Save failed: ${err?.message || 'Please try again.'}`); return false }
    finally { setLoading(false) }
  }, [loading, currentDay, weekData, buildPayloadForSlot, activeUserId, targetWeekId])

  // Save ALL filled & dirty slots across the week
  const saveAllSlots = useCallback(async (isFinalSubmit = false) => {
    setLoading(true)
    try {
      const payloads = []
      for (let dIdx = 0; dIdx < DAYS.length; dIdx++) {
        const d = DAYS[dIdx]
        const dk = d.substring(0,3).toLowerCase()
        const st = weekData[dk]
        const hasLocal = st && (st.lunchWantsFood !== null || st.dinnerWantsFood !== null)
        const hasExisting = existingRow && (existingRow[`${dk}_l_status`] || existingRow[`${dk}_d_status`])
        if (hasLocal || hasExisting || isFinalSubmit) {
          payloads.push(buildPayloadForSlot(dIdx, isFinalSubmit))
        }
      }
      if (payloads.length > 0) {
        const res = await submitSurveyRows(payloads)
        if (res.error) throw res.error
        dirtyRef.current.clear()
        const { data: row } = await fetchUserSurveyRow(activeUserId, targetWeekId)
        if (row) setExistingRow(row)
      }
      return true
    } catch(err) { setErrorToast(`Save failed: ${err?.message || 'Please try again.'}`); return false }
    finally { setLoading(false) }
  }, [weekData, existingRow, buildPayloadForSlot, activeUserId, targetWeekId])

  const handleClose = useCallback(async () => {
    if (dirtyRef.current.size > 0 && !surveySubmitted) {
      try { await saveAllSlots(false) } catch {}
    }
    onClose()
  }, [onClose, surveySubmitted, saveAllSlots])

  // Escape key handler
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [handleClose])

  // Lunch/Dinner handlers for active slot
  const updateActive = (updater) => {
    dirtyRef.current.add(dayKey)
    setWeekData(prev => {
      const wd = JSON.parse(JSON.stringify(prev))
      if (!wd[dayKey]) wd[dayKey] = createEmptyDay()
      wd[dayKey] = updater(wd[dayKey])
      return wd
    })
  }
  // Tapping "Yes, I want food" only opens the dish list — every dish starts
  // UNSELECTED and the user must tap each one. No auto-select, ever.
  const handleOptInLunch = () => {
    updateActive(prev => ({ ...prev, lunchWantsFood: true }))
  }
  const handleSkipLunch = () => {
    updateActive(prev => ({ ...prev, lunchWantsFood: false, lunchResponses: {} }))
    setTimeout(() => dinnerCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 180)
  }
  const handleOptInDinner = () => {
    updateActive(prev => ({ ...prev, dinnerWantsFood: true }))
  }
  const handleSkipDinner = () => {
    updateActive(prev => ({ ...prev, dinnerWantsFood: false, dinnerResponses: {} }))
    setTimeout(() => bottomNavRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 180)
  }
  const handleLunchDish = useCallback((dish, val) => {
    dirtyRef.current.add(dayKey)
    setWeekData(prev => {
      const wd = JSON.parse(JSON.stringify(prev))
      wd[dayKey].lunchResponses[dish] = val
      return wd
    })
  }, [dayKey])
  const handleDinnerDish = useCallback((dish, val) => {
    dirtyRef.current.add(dayKey)
    setWeekData(prev => {
      const wd = JSON.parse(JSON.stringify(prev))
      wd[dayKey].dinnerResponses[dish] = val
      return wd
    })
  }, [dayKey])
  const selectAll = (meal) => {
    const dishes = meal === 'lunch' ? lunchDishes : dinnerDishes
    dirtyRef.current.add(dayKey)
    const res = {}; dishes.forEach((d, idx) => {
      if (isRotiItem(d)) res[d] = 'yes'
      else if (isCountInput(liveAppSettings, currentDay, meal, idx)) { const mx = snackDefaults?.[`dish_${idx+1}`] ?? 99; res[d] = mx === 0 ? 'no' : { status: 'yes', value: 1 } } else res[d] = 100
    })
    setWeekData(prev => {
      const wd = JSON.parse(JSON.stringify(prev))
      const fld = meal === 'lunch' ? 'lunchResponses' : 'dinnerResponses'
      wd[dayKey][fld] = { ...wd[dayKey][fld], ...res }
      return wd
    })
  }
  const clearAll = (meal) => {
    const dishes = meal === 'lunch' ? lunchDishes : dinnerDishes
    dirtyRef.current.add(dayKey)
    const res = {}; dishes.forEach((d, idx) => {
      if (isRotiItem(d)) res[d] = 'no'
      else if (isCountInput(liveAppSettings, currentDay, meal, idx)) res[d] = 'no'
      else res[d] = 0
    })
    setWeekData(prev => {
      const wd = JSON.parse(JSON.stringify(prev))
      const fld = meal === 'lunch' ? 'lunchResponses' : 'dinnerResponses'
      wd[dayKey][fld] = { ...wd[dayKey][fld], ...res }
      return wd
    })
  }

  // Navigation across Monday to Saturday (6 days, 12 meals)
  const canGoPrev = currentDayIndex > 0
  const canGoNext = currentDayIndex < DAYS.length - 1

  const handleSelectDay = async (dIdx) => {
    if (dIdx === currentDayIndex) return
    if (dirtyRef.current.has(dayKey) || lunchWantsFood !== null || dinnerWantsFood !== null) {
      await saveSlot(currentDayIndex)
    }
    setCurrentDayIndex(dIdx)
    modalScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const goToNextDay = async () => {
    if (!isDayComplete) { setErrorToast(`Complete both Lunch & Dinner for ${currentDayName} first.`); return }
    await saveSlot(currentDayIndex)
    if (canGoNext) {
      setCurrentDayIndex(prev => prev + 1)
      modalScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
  const goToPrevDay = async () => {
    if (!canGoPrev) return
    if (isDayComplete || dirtyRef.current.has(dayKey)) await saveSlot(currentDayIndex)
    setCurrentDayIndex(prev => prev - 1)
    modalScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmitWeekly = async () => {
    if (!isDayComplete) {
      setErrorToast(`Complete both Lunch & Dinner for ${currentDayName} first.`)
      return
    }

    // Every meal must be fully decided — skipped, or every dish explicitly chosen.
    const missing = []
    let firstMissingDayIdx = -1
    DAYS.forEach((d, idx) => {
      const lunchDone = isMealDone(d, 'lunch')
      const dinnerDone = isMealDone(d, 'dinner')
      if (!lunchDone) {
        missing.push({ day: d, meal: 'lunch' })
        if (firstMissingDayIdx === -1) firstMissingDayIdx = idx
      }
      if (!dinnerDone) {
        missing.push({ day: d, meal: 'dinner' })
        if (firstMissingDayIdx === -1) firstMissingDayIdx = idx
      }
    })

    if (missing.length > 0) {
      setSubmitResult({
        type: 'missing',
        title: 'Survey Incomplete',
        message: `${missing.length} meal${missing.length > 1 ? 's' : ''} still need filling before locking.`,
        missingSlots: missing
      })
      if (firstMissingDayIdx !== -1) {
        setCurrentDayIndex(firstMissingDayIdx)
      }
      return
    }

    setLoading(true)
    try {
      // Save all 6 days with submitted_at timestamp in survey_day_responses
      const saved = await saveAllSlots(true)
      if (!saved) return

      setSurveySubmitted(true)
      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        onClose()
      }, 2400)
    } catch(e) {
      console.warn('Survey submission error:', e)
      setErrorToast(`Submission failed: ${e?.message || 'Please try again.'}`)
    } finally {
      setLoading(false)
    }
  }

  // INTRO
  if (showIntro) {
    return (
      <div onClick={handleClose} style={{ position:'fixed', inset:0, zIndex:10001, background:T.overlay, backdropFilter:'blur(14px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'clamp(10px,3vw,28px)' }}>
        <style>{SURVEY_STYLES}</style>
        <div onClick={e=>e.stopPropagation()} style={{ background:T.modalBg, borderRadius:24, padding:'clamp(22px,4vw,34px)', maxWidth:620, width:'100%', border:`1.5px solid ${T.modalBorder}`, boxShadow:'0 30px 80px rgba(0,0,0,0.55)', position:'relative', textAlign:'center', animation:'surveyModalIn 0.35s ease-out' }}>
          <button onClick={handleClose} style={{ position:'absolute', top:14, right:14, background:T.softBg, border:`1px solid ${T.border}`, borderRadius:8, width:32, height:32, color:T.textSub, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', touchAction:'manipulation' }}><X size={16}/></button>
          <div style={{ width:64, height:64, borderRadius:20, background:T.accentBg, border:`1.5px solid ${T.accent}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:28 }}>📋</div>
          <h2 style={{ margin:'0 0 6px', fontSize:22, fontWeight:800, color:T.text, fontFamily:"'Playfair Display',serif" }}>Weekly Meal Survey</h2>
          <p style={{ margin:'0 0 8px', fontSize:13, color:T.textSub, lineHeight:1.65, fontFamily:"'DM Sans',sans-serif" }}>Fill meal preferences for each day — Monday through Saturday · 12 meals total ({formatWeekRange(targetWeekId)}).</p>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:22, textAlign:'left' }}>
            {[
              ['☀️', 'Lunch & Dinner per day (Mon–Sat)'],
              ['💾', 'Save & Continue day by day'],
              ['✅', 'Submit locks all 12 meals']
            ].map(([ic,tx],i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}><div style={{ width:28, height:28, borderRadius:8, background:T.accentBg, display:'flex', alignItems:'center', justifyContent:'center' }}>{ic}</div><span style={{ fontSize:12.5, color:T.textSub, fontFamily:"'DM Sans',sans-serif" }}>{tx}</span></div>))}
          </div>
          <button onClick={handleStartSurvey} type="button" style={{ width:'100%', minHeight:48, padding:'14px', borderRadius:14, border:'none', background:T.accentGrad, color:'#000', cursor:'pointer', fontSize:15, fontWeight:900, fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8, touchAction:'manipulation' }}>Start Survey <Play size={16}/></button>
        </div>
      </div>
    )
  }
  if (showSuccess) {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:10001, display:'flex', alignItems:'center', justifyContent:'center', background:T.successOverlay, backdropFilter:'blur(20px)' }}>
        <style>{SURVEY_STYLES}</style>
        <div style={{ textAlign:'center', animation:'surveySuccess 0.6s ease-out' }}>
          <div style={{ width:84, height:84, borderRadius:'50%', background:'linear-gradient(135deg,#4CAF50,#2E7D32)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', boxShadow:'0 0 60px rgba(76,175,80,0.4)', animation:'surveyGlow 2s ease-in-out infinite' }}><Check size={44} color="#fff" strokeWidth={3}/></div>
          <h2 style={{ margin:'0 0 8px', fontSize:28, fontWeight:800, color:'#4CAF50', fontFamily:"'Playfair Display',serif" }}>Survey Submitted!</h2>
          <p style={{ margin:0, fontSize:14, color:T.textSub, fontFamily:"'DM Sans',sans-serif" }}>Your 12 meal preferences are locked. Shukran! 🤲</p>
        </div>
      </div>
    )
  }
  if (surveySubmitted && !initialDay && !surveyOpen) {
    return (
      <div onClick={handleClose} style={{ position:'fixed', inset:0, zIndex:10001, background:T.overlay, backdropFilter:'blur(14px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'clamp(10px,3vw,28px)' }}>
        <style>{SURVEY_STYLES}</style>
        <div onClick={e=>e.stopPropagation()} style={{ background:T.modalBg, borderRadius:24, padding:'clamp(24px,4vw,36px)', maxWidth:560, width:'100%', border:`1.5px solid ${T.modalBorder}`, boxShadow:'0 30px 80px rgba(0,0,0,0.55)', position:'relative', textAlign:'center', animation:'surveyModalIn 0.35s ease-out' }}>
          <button onClick={handleClose} style={{ position:'absolute', top:14, right:14, background:T.softBg, border:`1px solid ${T.border}`, borderRadius:8, width:32, height:32, color:T.textSub, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', touchAction:'manipulation' }}><X size={16}/></button>
          <div style={{ width:68, height:68, borderRadius:20, background:'rgba(76,175,80,0.15)', border:'1.5px solid rgba(76,175,80,0.4)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', color:'#4CAF50' }}><Lock size={32}/></div>
          <h2 style={{ margin:'0 0 8px', fontSize:22, fontWeight:800, color:T.text, fontFamily:"'Playfair Display',serif" }}>Weekly Survey Locked</h2>
          <p style={{ margin:'0 0 20px', fontSize:13.5, color:T.textSub, lineHeight:1.6, fontFamily:"'DM Sans',sans-serif" }}>You have already filled and submitted your full weekly survey for {formatWeekRange(targetWeekId)}. No further submissions are permitted — window is now closed.</p>
          <div style={{ padding:'14px 18px', borderRadius:16, background:'rgba(76,175,80,0.08)', border:'1px solid rgba(76,175,80,0.25)', marginBottom:22, textAlign:'left' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}><Check size={18} color="#4CAF50" strokeWidth={2.5}/><span style={{ fontSize:13, fontWeight:800, color:'#4CAF50', fontFamily:"'DM Sans',sans-serif" }}>All 12 Meals Recorded & Locked</span></div>
            <div style={{ fontSize:12, color:T.textSub, fontFamily:"'DM Sans',sans-serif", lineHeight:1.5 }}>Your meal portion preferences are saved in the system. Shukran! 🤲</div>
          </div>
          <button onClick={handleClose} type="button" style={{ width:'100%', minHeight:46, padding:'12px', borderRadius:14, border:'none', background:T.accentGrad, color:'#000', cursor:'pointer', fontSize:14, fontWeight:900, fontFamily:"'DM Sans',sans-serif", touchAction:'manipulation' }}>Close</button>
        </div>
      </div>
    )
  }

  // ── MAIN MODAL ──
  return (
    <div onClick={handleClose} style={{ position:'fixed', inset:0, zIndex:10001, background:T.overlay, backdropFilter:'blur(14px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'clamp(8px,2.5vw,20px)', overflowY:'auto' }}>
      <style>{SURVEY_STYLES}</style>
      <div ref={modalScrollRef} onClick={e=>e.stopPropagation()} style={{ background:T.modalBg, borderRadius:24, padding:'clamp(14px,3vw,22px)', maxWidth:780, width:'100%', boxSizing:'border-box', border:`2px solid ${T.modalBorder}`, boxShadow:'0 30px 80px rgba(120,70,0,0.30)', position:'relative', overflowX:'hidden', overflowY:'auto', maxHeight:'calc(100dvh - 24px)', WebkitOverflowScrolling:'touch', animation:'surveyModalIn 0.35s ease-out' }}>
        {/* Bright rainbow ribbon — the survey sheet is always vivid */}
        <div style={{ height:6, borderRadius:999, background:'linear-gradient(90deg,#F59E0B,#16A34A,#3B82F6,#8B5CF6,#EC4899)', marginBottom:12 }} />
        {loading && (<div style={{ position:'absolute', inset:0, zIndex:999, borderRadius:24, background:T.loadingOverlay, backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}><div style={{ width:40, height:40, borderRadius:'50%', border:`3px solid`, borderColor:`${T.accent} transparent ${T.accent} ${T.accent}`, animation:'spin 0.8s linear infinite' }} /><div style={{ fontSize:13, color:T.accent, fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>Saving…</div></div>)}
        {errorToast && (<div style={{ position:'sticky', top:0, zIndex:998, marginBottom:12, padding:'12px 16px', borderRadius:12, background:'rgba(244,67,54,0.15)', border:`1px solid ${T.noColor}`, display:'flex', alignItems:'center', gap:10 }}><AlertTriangle size={18} color={T.noColor}/><span style={{ flex:1, fontSize:12, color:T.text, fontFamily:"'DM Sans',sans-serif" }}>{errorToast}</span><button onClick={()=>setErrorToast(null)} style={{ background:'transparent', border:'none', color:T.textSub, cursor:'pointer', touchAction:'manipulation' }}><X size={14}/></button></div>)}

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase', color:T.accent, fontFamily:"'DM Sans',sans-serif", marginBottom:2, display:'flex', alignItems:'center', gap:6 }}><CalendarRange size={10}/>Weekly Survey · 12 Meals</div>
            <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:T.text, fontFamily:"'Playfair Display',serif" }}>📅 {currentDayName} <span style={{ fontSize:13, fontWeight:600, color:T.textSub, fontFamily:"'DM Sans',sans-serif" }}>· {formatWeekRange(targetWeekId)}</span></h2>
            <div style={{ fontSize:11, color:T.textSub, fontFamily:"'DM Sans',sans-serif", marginTop:2 }}>Day {currentDayIndex+1} of 6 (Mon–Sat)</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {syncMsg && <span style={{ fontSize:11, color:T.yesColor, fontWeight:800, fontFamily:"'DM Sans',sans-serif" }}>✓ {syncMsg}</span>}
            <button onClick={handleClose} style={{ background:T.softBg, border:'none', cursor:'pointer', padding:8, borderRadius:10, color:T.textSub, display:'flex', alignItems:'center', justifyContent:'center', touchAction:'manipulation' }}><X size={18}/></button>
          </div>
        </div>

        {surveySubmitted && surveyOpen && (
          <div style={{ marginBottom:12, padding:'8px 12px', borderRadius:10, background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.25)', fontSize:11, color:'#f59e0b', fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>Submitted — window open. Tap any day to edit.</div>
        )}

        {/* Progress Bar (12 meals) */}
        <div style={{ marginBottom:12, padding:12, borderRadius:16, background:'#FFFFFF', border:'2px solid #F0DDAE', boxShadow:'0 2px 8px rgba(90,70,30,0.06)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing: '0.12em', textTransform:'uppercase', color:'#8A7A63', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:6 }}><Layers size={12} color={T.accent}/> Weekly Progress</span>
            <span style={{ fontSize:12, fontWeight:900, color:'#3A2C14', background:T.accentBg, border:`1.5px solid ${T.accentBorder}`, padding:'2px 10px', borderRadius:999 }}>{totalFilled} / 12 meals · {pctGlobal}%</span>
          </div>
          <div style={{ height:12, borderRadius:999, background:'#F5EAD0', border:'1px solid #EADFC6', overflow:'hidden', padding:2, position:'relative' }}>
            <div style={{ height:'100%', width:`${pctGlobal}%`, borderRadius:999, background: pctGlobal===100?'linear-gradient(90deg,#10b981,#34d399)':T.accentGrad, boxShadow: pctGlobal>0?`0 2px 12px ${T.accent}30`:'none', transition:'width 0.6s cubic-bezier(0.32,0.72,0,1)', position:'relative', overflow:'hidden' }}>
              <span style={{ position:'absolute', inset:0, background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)', transform:'translateX(-100%)', animation: pctGlobal>0?'shimmer 1.6s ease-in-out infinite':'none' }} />
            </div>
          </div>
        </div>

        {/* Day Navigation Tabs — 6 days Mon-Sat */}
        <div style={{ display:'flex', gap:6, marginBottom:14, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
          {DAYS.map((d, idx)=>{
            const isCur = idx === currentDayIndex
            // Tick only when both meals are truly decided (no auto-select).
            const isDone = isMealDone(d, 'lunch') && isMealDone(d, 'dinner')
            return (
              <button key={d} type="button" onClick={()=>handleSelectDay(idx)}
                style={{ flex:1, minWidth:50, minHeight:46, padding:'9px 4px', borderRadius:12, border:`1.5px solid ${isCur?T.accent: isDone?T.yesColor+'60':T.border}`, background: isCur?(T.accentBg||'rgba(212,175,55,0.12)'): isDone?'rgba(76,175,80,0.08)':T.card, color: isCur?T.accent: isDone?T.yesColor:T.textSub, fontSize:12, fontWeight: isCur?900:700, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, transition:'all 0.2s', touchAction:'manipulation', WebkitTapHighlightColor:'transparent', boxShadow: isCur?`0 4px 14px ${T.accentBg}`:'none' }}>
                <span>{cap(d).substring(0,3)}</span>
                <span style={{ fontSize:10, fontWeight:900 }}>{isDone?'✓':`D${idx+1}`}</span>
              </button>
            )
          })}
        </div>

        {/* LUNCH CARD */}
        <div style={{ marginBottom:14, padding:'16px 18px', borderRadius:20, background: lunchWantsFood===true?'#FFFBEB':'#FFFFFF', border:`2px solid ${lunchWantsFood===true?'#F59E0B': lunchWantsFood===false?T.noColor:'#F0DDAE'}`, boxShadow: lunchWantsFood===true?'0 8px 24px rgba(245,158,11,0.18)':'0 2px 8px rgba(90,70,30,0.06)', transition:'all 0.28s' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#FBBF24,#F59E0B)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(245,158,11,0.35)' }}><Sun size={20} color="#fff"/></div>
              <div>
                <div style={{ fontSize:16, fontWeight:900, color:'#3A2C14', fontFamily:"'Playfair Display',serif" }}>☀️ {currentDayName} Lunch</div>
                <div style={{ fontSize:11.5, color:'#8A7A63', fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>
                  {lunchWantsFood===null ? `Tap Yes below, then pick every dish 👇` : lunchWantsFood ? (isLunchComplete ? `✅ All ${lunchDishes.length} dishes selected` : `👆 Pick each dish — ${lunchPicked} of ${lunchDishes.length} done`) : 'Lunch skipped for this day'}
                </div>
              </div>
            </div>
            {lunchWantsFood!==null && (
              <span style={{ fontSize:11, fontWeight:900, padding:'4px 12px', borderRadius:100, background: lunchWantsFood ? (isLunchComplete ? '#16A34A' : '#F59E0B') : T.noColor, color:'#fff', boxShadow:`0 3px 10px ${lunchWantsFood ? (isLunchComplete ? '#16A34A55' : '#F59E0B55') : `${T.noColor}55`}` }}>
                {lunchWantsFood ? (isLunchComplete ? `✅ ${lunchPicked}/${lunchDishes.length} SELECTED` : `⏳ ${lunchPicked}/${lunchDishes.length} PICKED`) : '❌ SKIPPED'}
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:10, marginBottom: lunchWantsFood===true?14:0 }}>
            <button key={`lunch-yes-${lunchWantsFood===true}`} type="button" onClick={handleOptInLunch} className={lunchWantsFood===true ? 'dish-pick-btn dish-pick-pop' : 'dish-pick-btn'} style={{ flex:1, minHeight:48, padding:'13px 14px', borderRadius:13, border:`2px solid ${lunchWantsFood===true?'#16A34A':'#EADFC6'}`, background: lunchWantsFood===true?'#16A34A':'#FFFFFF', color: lunchWantsFood===true?'#fff':'#16A34A', cursor:'pointer', fontSize:14, fontWeight:900, fontFamily:"'DM Sans',sans-serif", transition:'all 0.22s', boxShadow: lunchWantsFood===true?'0 6px 18px #16A34A55':'0 1px 3px rgba(90,70,30,0.10)', touchAction:'manipulation', WebkitTapHighlightColor:'transparent' }}>{lunchWantsFood===true?'✓ YES — now pick dishes below':'✅ Yes, I want food'}</button>
            <button key={`lunch-no-${lunchWantsFood===false}`} type="button" onClick={handleSkipLunch} className={lunchWantsFood===false ? 'dish-pick-btn dish-pick-pop' : 'dish-pick-btn'} style={{ flex:1, minHeight:48, padding:'13px 14px', borderRadius:13, border:`2px solid ${lunchWantsFood===false?T.noColor:'#EADFC6'}`, background: lunchWantsFood===false?T.noColor:'#FFFFFF', color: lunchWantsFood===false?'#fff':T.noColor, cursor:'pointer', fontSize:14, fontWeight:900, fontFamily:"'DM Sans',sans-serif", transition:'all 0.22s', boxShadow: lunchWantsFood===false?`0 6px 18px ${T.noColor}55`:'0 1px 3px rgba(90,70,30,0.10)', touchAction:'manipulation', WebkitTapHighlightColor:'transparent' }}>❌ No, I'll skip</button>
          </div>
          {lunchWantsFood===true && (
            <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${T.border}`, animation:'surveyFadeIn 0.3s ease-out' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:13, fontWeight:800, color:T.accent, fontFamily:"'DM Sans',sans-serif" }}>Lunch Dishes <span style={{ fontSize:10, color:T.textSub }}>· {formatWeekRange(targetWeekId)}</span></span>
                <div style={{ display:'flex', gap:6 }}>
                  <button type="button" onClick={()=>selectAll('lunch')} style={{ minHeight:32, padding:'4px 10px', borderRadius:8, border:`1px solid ${T.accent}`, background:T.accentBg, color:T.accent, fontSize:11, fontWeight:800, cursor:'pointer', touchAction:'manipulation' }}>All Yes</button>
                  <button type="button" onClick={()=>clearAll('lunch')} style={{ minHeight:32, padding:'4px 10px', borderRadius:8, border:`1px solid ${T.border}`, background:'transparent', color:T.textSub, fontSize:11, fontWeight:700, cursor:'pointer', touchAction:'manipulation' }}>Clear</button>
                </div>
              </div>
              {lunchDishes.length>0 ? lunchDishes.map((dish,idx)=>(<DishRow key={`lunch-${targetWeekId}-${dish}-${idx}`} dish={dish} idx={idx} mealType="lunch" value={lunchResponses[dish]} onChange={handleLunchDish} T={T} appSettings={liveAppSettings} currentDay={currentDay} snackDefaults={snackDefaults} />)) : (
                <div style={{ padding:'20px 14px', textAlign:'center', background:'#FFFDF6', borderRadius:12, border:'2px dashed #F0DDAE' }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>👨‍🍳</div>
                  <div style={{ fontSize:13, fontWeight:800, color:'#3A2C14' }}>Menu is being prepared by Al-Mawaid team</div>
                  <div style={{ fontSize:11, color:'#8A7A63', marginTop:2 }}>Dishes for this week will appear once finalized.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* DINNER CARD */}
        <div ref={dinnerCardRef} style={{ marginBottom:18, padding:'16px 18px', borderRadius:20, background: dinnerWantsFood===true?'#F5F0FF':'#FFFFFF', border:`2px solid ${dinnerWantsFood===true?'#8B5CF6': dinnerWantsFood===false?T.noColor:'#DDD3F5'}`, boxShadow: dinnerWantsFood===true?'0 8px 24px rgba(139,92,246,0.20)':'0 2px 8px rgba(90,70,30,0.06)', transition:'all 0.28s' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#8B5CF6,#6D28D9)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(139,92,246,0.35)' }}><Moon size={20} color="#fff"/></div>
              <div>
                <div style={{ fontSize:16, fontWeight:900, color:'#3A2C14', fontFamily:"'Playfair Display',serif" }}>🌙 {currentDayName} Dinner</div>
                <div style={{ fontSize:11.5, color:'#8A7A63', fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>
                  {dinnerWantsFood===null ? `Tap Yes below, then pick every dish 👇` : dinnerWantsFood ? (isDinnerComplete ? `✅ All ${dinnerDishes.length} dishes selected` : `👆 Pick each dish — ${dinnerPicked} of ${dinnerDishes.length} done`) : 'Dinner skipped for this day'}
                </div>
              </div>
            </div>
            {dinnerWantsFood!==null && (
              <span style={{ fontSize:11, fontWeight:900, padding:'4px 12px', borderRadius:100, background: dinnerWantsFood ? (isDinnerComplete ? '#16A34A' : '#8B5CF6') : T.noColor, color:'#fff', boxShadow:'0 3px 10px rgba(0,0,0,0.15)' }}>
                {dinnerWantsFood ? (isDinnerComplete ? `✅ ${dinnerPicked}/${dinnerDishes.length} SELECTED` : `⏳ ${dinnerPicked}/${dinnerDishes.length} PICKED`) : '❌ SKIPPED'}
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:10, marginBottom: dinnerWantsFood===true?14:0 }}>
            <button key={`dinner-yes-${dinnerWantsFood===true}`} type="button" onClick={handleOptInDinner} className={dinnerWantsFood===true ? 'dish-pick-btn dish-pick-pop' : 'dish-pick-btn'} style={{ flex:1, minHeight:48, padding:'13px 14px', borderRadius:13, border:`2px solid ${dinnerWantsFood===true?'#16A34A':'#EADFC6'}`, background: dinnerWantsFood===true?'#16A34A':'#FFFFFF', color: dinnerWantsFood===true?'#fff':'#16A34A', cursor:'pointer', fontSize:14, fontWeight:900, fontFamily:"'DM Sans',sans-serif", transition:'all 0.22s', boxShadow: dinnerWantsFood===true?'0 6px 18px #16A34A55':'0 1px 3px rgba(90,70,30,0.10)', touchAction:'manipulation', WebkitTapHighlightColor:'transparent' }}>{dinnerWantsFood===true?'✓ YES — now pick dishes below':'✅ Yes, I want food'}</button>
            <button key={`dinner-no-${dinnerWantsFood===false}`} type="button" onClick={handleSkipDinner} className={dinnerWantsFood===false ? 'dish-pick-btn dish-pick-pop' : 'dish-pick-btn'} style={{ flex:1, minHeight:48, padding:'13px 14px', borderRadius:13, border:`2px solid ${dinnerWantsFood===false?T.noColor:'#EADFC6'}`, background: dinnerWantsFood===false?T.noColor:'#FFFFFF', color: dinnerWantsFood===false?'#fff':T.noColor, cursor:'pointer', fontSize:14, fontWeight:900, fontFamily:"'DM Sans',sans-serif", transition:'all 0.22s', boxShadow: dinnerWantsFood===false?`0 6px 18px ${T.noColor}55`:'0 1px 3px rgba(90,70,30,0.10)', touchAction:'manipulation', WebkitTapHighlightColor:'transparent' }}>❌ No, I'll skip</button>
          </div>
          {dinnerWantsFood===true && (
            <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${T.border}`, animation:'surveyFadeIn 0.3s ease-out' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:13, fontWeight:800, color:T.accent, fontFamily:"'DM Sans',sans-serif" }}>Dinner Dishes <span style={{ fontSize:10, color:T.textSub }}>· {formatWeekRange(targetWeekId)}</span></span>
                <div style={{ display:'flex', gap:6 }}>
                  <button type="button" onClick={()=>selectAll('dinner')} style={{ minHeight:32, padding:'4px 10px', borderRadius:8, border:`1px solid ${T.accent}`, background:T.accentBg, color:T.accent, fontSize:11, fontWeight:800, cursor:'pointer', touchAction:'manipulation' }}>All Yes</button>
                  <button type="button" onClick={()=>clearAll('dinner')} style={{ minHeight:32, padding:'4px 10px', borderRadius:8, border:`1px solid ${T.border}`, background:'transparent', color:T.textSub, fontSize:11, fontWeight:700, cursor:'pointer', touchAction:'manipulation' }}>Clear</button>
                </div>
              </div>
              {dinnerDishes.length>0 ? dinnerDishes.map((dish,idx)=>(<DishRow key={`dinner-${targetWeekId}-${dish}-${idx}`} dish={dish} idx={idx} mealType="dinner" value={dinnerResponses[dish]} onChange={handleDinnerDish} T={T} appSettings={liveAppSettings} currentDay={currentDay} snackDefaults={snackDefaults} />)) : (
                <div style={{ padding:'20px 14px', textAlign:'center', background:'#FFFDF6', borderRadius:12, border:'2px dashed #DDD3F5' }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>👨‍🍳</div>
                  <div style={{ fontSize:13, fontWeight:800, color:'#3A2C14' }}>Menu is being prepared by Al-Mawaid team</div>
                  <div style={{ fontSize:11, color:'#8A7A63', marginTop:2 }}>Dishes for this week will appear once finalized.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {!isDayComplete && (lunchWantsFood!==null || dinnerWantsFood!==null) && (
          <div style={{ marginBottom:14, padding:'10px 14px', borderRadius:12, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', color:'#f59e0b', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:8, fontFamily:"'DM Sans',sans-serif" }}>{!isLunchComplete?`⚠️ Please select your preferences for Lunch.`:`⚠️ Please select your preferences for Dinner.`}</div>
        )}

        {/* NAV */}
        <div ref={bottomNavRef} style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', paddingBottom:'calc(4px + env(safe-area-inset-bottom, 0px))' }}>
          {canGoPrev && (
            <button type="button" onClick={goToPrevDay} style={{ minHeight:46, padding:'12px 18px', borderRadius:12, border:`1px solid ${T.border}`, background:'transparent', color:T.textSub, cursor:'pointer', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:6, fontFamily:"'DM Sans',sans-serif", touchAction:'manipulation' }}>
              <ChevronLeft size={16}/> {cap(DAYS[currentDayIndex - 1]).substring(0,3)}
            </button>
          )}
          {canGoNext ? (
            <button type="button" onClick={goToNextDay} disabled={loading || !isDayComplete}
              style={{ marginLeft: canGoPrev? 'auto': undefined, flex: canGoPrev?undefined:1, minHeight:48, padding:'13px 22px', borderRadius:12, border:'none', background: isDayComplete && !loading ? T.accentGrad : T.border, color: isDayComplete && !loading ? '#000' : 'rgba(0,0,0,0.35)', cursor: isDayComplete && !loading ? 'pointer' : 'not-allowed', fontSize:13.5, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:"'DM Sans',sans-serif", boxShadow: isDayComplete?`0 8px 20px ${T.accentBg}`:'none', opacity: isDayComplete?1:0.65, transition:'all 0.25s', touchAction:'manipulation' }}>
              💾 Save & Continue {cap(DAYS[currentDayIndex + 1])} <ChevronRight size={16}/>
            </button>
          ) : (
            <button type="button" onClick={handleSubmitWeekly} disabled={loading || !isDayComplete}
              style={{ marginLeft: canGoPrev? 'auto': undefined, flex: canGoPrev?undefined:1, minHeight:48, padding:'14px 24px', borderRadius:12, border:'none', background: isDayComplete && !loading ? 'linear-gradient(135deg,#10b981,#059669)' : T.border, color: isDayComplete && !loading ? '#fff' : 'rgba(0,0,0,0.35)', cursor: isDayComplete && !loading ? 'pointer' : 'not-allowed', fontSize:14, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:"'DM Sans',sans-serif", boxShadow: isDayComplete? '0 8px 24px rgba(16,185,129,0.35)':'none', opacity: isDayComplete?1:0.65, transition:'all 0.25s', touchAction:'manipulation' }}>
              {loading? 'Submitting…': '✅ Submit Weekly Survey (12 Meals)'}
            </button>
          )}
        </div>

        {submitResult && (
          <div style={{ position:'fixed', inset:0, zIndex:10002, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(5,5,10,0.88)', backdropFilter:'blur(20px)', padding:20 }}>
            <div style={{ background:T.modalBg, borderRadius:22, padding:'28px 22px', width:'100%', maxWidth:460, border:`1.5px solid rgba(255,152,0,0.4)`, textAlign:'center', animation:'surveyModalIn 0.3s ease-out' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
              <h3 style={{ margin:'0 0 8px', fontSize:17, fontWeight:800, color:'#FF9800', fontFamily:"'Playfair Display',serif" }}>{submitResult.title}</h3>
              <p style={{ margin:'0 0 14px', fontSize:13, color:T.textSub, lineHeight:1.6, fontFamily:"'DM Sans',sans-serif" }}>{submitResult.message}</p>
              {submitResult.missingSlots && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginBottom:14 }}>
                  {submitResult.missingSlots.slice(0, 12).map((s, i) => (
                    <span key={`${s.day}-${s.meal}-${i}`} style={{ fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:100, background:'rgba(255,152,0,0.12)', color:'#FF9800' }}>{cap(s.day).substring(0,3)} {s.meal}</span>
                  ))}
                </div>
              )}
              <button type="button" onClick={()=>setSubmitResult(null)} style={{ width:'100%', minHeight:44, padding:'12px', borderRadius:12, border:'none', background:'#FF9800', color:'#fff', fontSize:13.5, fontWeight:800, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", touchAction:'manipulation' }}>Got it, I'll fix it</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

