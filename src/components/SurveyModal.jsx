import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight, Check, AlertTriangle, Play, Sun, Moon, Lock, CalendarRange, Layers } from 'lucide-react'
import { supabase } from '../lib/firebaseClient'
import { useAuth, useTheme } from '../admin/context'
import { useWeeklyMenu, getMenuForWeekDay } from '../common/useWeeklyMenu'
import { DAYS, getSurveyTargetWeek, getSurveyTargetWeeks, getSurveyCadence, isTwoWeekCadence, getSurveyTotalSlots, formatWeekRange, parseDishArray } from '../common/utils'
import { DEFAULT_MENU } from '../common/constants'
import {
  isRotiItem, isCountInput, canEditMeal, isSurveyOpen,
  normalizeDishValue, denormalizeDishValue, getPctColor,
  mergeDishSnapshot, getSlotDishes,
} from '../hooks/useSurvey'
import { submitSurveyRow, submitSurveyRows, submitSurvey, beginSurvey } from '../lib/submitSurvey'
import { fetchUserSurveyRow, fetchUserSurveyRows } from '../lib/surveyRows'

// ── Static theme (fallback / default) ──────────────────────────────
const BASE_THEME = {
  bg: '#0d0d1a',
  card: 'rgba(255,255,255,0.03)',
  border: 'rgba(139,92,246,0.15)',
  accent: '#D4AF37',
  accentGrad: 'linear-gradient(135deg,#D4AF37,#B8860B)',
  accentBg: 'rgba(212,175,55,0.1)',
  accentBorder: 'rgba(212,175,55,0.3)',
  text: '#f0f0f5',
  textSub: 'rgba(240,240,245,0.5)',
  inputBg: 'rgba(255,255,255,0.05)',
  yesColor: '#4CAF50',
  yesBg: 'rgba(76,175,80,0.15)',
  noColor: '#F44336',
  noBg: 'rgba(244,67,54,0.15)',
  overlay: 'rgba(5,5,10,0.80)',
  successOverlay: 'rgba(0,0,0,0.90)',
  modalBg: 'linear-gradient(165deg,#12121f 0%,#0d0d1a 60%)',
  modalBorder: 'rgba(212,175,55,0.35)',
  loadingOverlay: 'rgba(13,13,26,0.85)',
  softBg: 'rgba(255,255,255,0.03)',
  softBorder: 'rgba(255,255,255,0.05)',
}

function buildTheme(appT) {
  if (!appT) return BASE_THEME
  const light = appT.id === 'bright'
  return {
    ...BASE_THEME,
    bg: appT.bg || BASE_THEME.bg,
    card: appT.card || BASE_THEME.card,
    border: appT.border || BASE_THEME.border,
    accent: appT.accent || BASE_THEME.accent,
    accentGrad: appT.accentGrad || BASE_THEME.accentGrad,
    accentBg: appT.accentBg || BASE_THEME.accentBg,
    accentBorder: appT.accentBorder || BASE_THEME.accentBorder,
    text: appT.text || BASE_THEME.text,
    textSub: appT.textSub || BASE_THEME.textSub,
    inputBg: appT.inputBg || BASE_THEME.inputBg,
    overlay: light ? 'rgba(45,36,22,0.55)' : 'rgba(5,5,10,0.80)',
    successOverlay: light ? 'rgba(253,251,247,0.94)' : 'rgba(0,0,0,0.90)',
    modalBg: light
      ? 'linear-gradient(165deg,#ffffff 0%,#faf4e8 60%)'
      : 'linear-gradient(165deg,#12121f 0%,#0d0d1a 60%)',
    modalBorder: light ? 'rgba(184,134,11,0.4)' : 'rgba(212,175,55,0.35)',
    loadingOverlay: light ? 'rgba(253,251,247,0.88)' : 'rgba(13,13,26,0.85)',
    softBg: light ? 'rgba(184,134,11,0.07)' : 'rgba(255,255,255,0.03)',
    softBorder: light ? 'rgba(184,134,11,0.18)' : 'rgba(255,255,255,0.05)',
  }
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
// ────────────────────────────────────────────────────────────────────
function DishRow({ dish, idx, mealType, value, onChange, T, appSettings, currentDay, snackDefaults }) {
  const isRoti = isRotiItem(dish)
  const isCount = !isRoti && isCountInput(appSettings, currentDay, mealType, idx)
  const profileCount = snackDefaults?.[`dish_${idx + 1}`]
  const maxVal = (profileCount !== undefined && profileCount !== null && profileCount >= 0) ? profileCount : 99
  const optGrad = (color) => `linear-gradient(145deg,${color}30 0%,${color}10 55%,${color}05 100%)`
  const optShadow = (color) => `0 6px 20px ${color}40,inset 0 1px 0 rgba(255,255,255,0.12)`
  const Sheen = () => (<span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(180deg,rgba(255,255,255,0.14),transparent)', pointerEvents: 'none', borderRadius: 'inherit' }} />)
  const StatusPill = ({ label, color }) => (<span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 10px', borderRadius: 100, whiteSpace: 'nowrap', background: `${color}1a`, color, border: `1px solid ${color}55`, animation: 'surveyBadgePop 0.3s ease' }}>{label}</span>)

  if (isRoti) {
    const selColor = value === 'yes' ? T.yesColor : value === 'no' ? T.noColor : null
    return (
      <div style={{ marginBottom: 8, padding: '12px 14px', borderRadius: 14, position: 'relative', overflow: 'hidden', background: selColor ? `linear-gradient(145deg,${selColor}1a,${T.card})` : T.card, border: `1.5px solid ${selColor || T.border}`, boxShadow: selColor ? `0 6px 18px ${selColor}18` : 'none', transition: 'all 0.25s' }}>
        {selColor && <div style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: selColor, filter: 'blur(36px)', opacity: 0.14, pointerEvents: 'none' }} />}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, fontFamily: "'DM Sans',sans-serif" }}>{dish}</div>
            {value && <StatusPill label={value === 'yes' ? '✅ Selected' : '❌ Skipped'} color={selColor} />}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['yes', 'no'].map(opt => {
              const isSel = value === opt
              const color = opt === 'yes' ? T.yesColor : T.noColor
              return (
                <button key={opt} type="button" onClick={() => onChange(dish, opt)}
                  style={{ flex: 1, minHeight: 44, padding: '12px 8px', borderRadius: 12, border: `1.5px solid ${isSel ? color : T.border}`, background: isSel ? optGrad(color) : 'transparent', color: isSel ? color : T.textSub, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.22s', transform: isSel ? 'scale(1.02)' : 'scale(1)', boxShadow: isSel ? optShadow(color) : 'none', position: 'relative', overflow: 'hidden', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
                  {isSel && <Sheen />}{opt === 'yes' ? '✅ Yes, please' : '❌ No, skip'}
                </button>
              )
            })}
          </div>
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
    const selColor = isYes ? T.yesColor : isSkipped ? T.noColor : null
    return (
      <div style={{ marginBottom: 8, padding: '12px 14px', borderRadius: 14, position: 'relative', overflow: 'hidden', background: selColor ? `linear-gradient(145deg,${selColor}1a,${T.card})` : T.card, border: `1.5px solid ${selColor || T.border}`, boxShadow: selColor ? `0 6px 18px ${selColor}18` : 'none', transition: 'all 0.25s' }}>
        {selColor && <div style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: selColor, filter: 'blur(36px)', opacity: 0.14, pointerEvents: 'none' }} />}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, marginBottom: 10, fontFamily: "'DM Sans',sans-serif", display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{dish}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isYes && <StatusPill label={`✅ ${countNum} ${countNum === 1 ? 'person' : 'persons'}`} color={T.yesColor} />}
              {isSkipped && <StatusPill label="❌ Skipped" color={T.noColor} />}
              {maxVal < 99 && <span style={{ fontSize: 10, color: T.accent, fontWeight: 800, background: T.accentBg, padding: '3px 8px', borderRadius: 6, border: `1px solid ${T.border}` }}>Max: {maxVal}</span>}
            </span>
          </div>
          {showInitial && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => onChange(dish, { status: 'yes', value: Math.max(1, Math.min(maxVal || 99, 1)) })}
                style={{ flex: 1, minHeight: 44, padding: '12px 8px', borderRadius: 12, border: `1.5px solid ${T.yesColor}`, background: optGrad(T.yesColor), color: T.yesColor, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.22s', boxShadow: `0 6px 18px ${T.yesColor}30`, position: 'relative', overflow: 'hidden', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
                <Sheen />✅ Yes, I want</button>
              <button type="button" onClick={() => onChange(dish, 'no')}
                style={{ flex: 1, minHeight: 44, padding: '12px 8px', borderRadius: 12, border: `1.5px solid ${T.noColor}`, background: optGrad(T.noColor), color: T.noColor, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.22s', position: 'relative', overflow: 'hidden', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
                <Sheen />❌ No, skip</button>
            </div>
          )}
          {isSkipped && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ padding: '9px 16px', borderRadius: 10, background: optGrad(T.noColor), border: `1px solid ${T.noColor}50`, color: T.noColor, fontSize: 13, fontWeight: 800, fontFamily: "'DM Sans',sans-serif" }}>❌ Skipped</div>
              <button type="button" onClick={() => onChange(dish, { status: 'yes', value: Math.max(1, Math.min(maxVal || 99, 1)) })}
                style={{ marginLeft: 'auto', minHeight: 42, padding: '10px 20px', borderRadius: 12, border: `1.5px solid ${T.accent}`, background: `linear-gradient(145deg,${T.accentBg},transparent)`, color: T.accent, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>✅ Add back</button>
            </div>
          )}
          {isYes && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: `linear-gradient(145deg,${T.yesColor}1f,${T.card})`, borderRadius: 14, padding: '6px 8px', border: `1px solid ${T.yesColor}40`, boxShadow: `0 4px 16px ${T.yesColor}18` }}>
                <button type="button" onClick={() => onChange(dish, { status: 'yes', value: Math.max(1, countNum - 1) })} disabled={countNum <= 1}
                  style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${countNum <= 1 ? T.border : T.yesColor + '50'}`, background: T.inputBg, color: countNum <= 1 ? T.textSub : T.text, cursor: countNum <= 1 ? 'not-allowed' : 'pointer', fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: countNum <= 1 ? 0.4 : 1, transition: 'all 0.2s', touchAction: 'manipulation' }}>−</button>
                <div style={{ textAlign: 'center', minWidth: 60 }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: T.yesColor, lineHeight: 1, fontFamily: "'DM Sans',sans-serif" }}>{countNum}</div>
                  <div style={{ fontSize: 9.5, color: T.textSub, fontWeight: 700 }}>{countNum === 1 ? 'person' : 'persons'}</div>
                </div>
                <button type="button" onClick={() => { if (!atMax) onChange(dish, { status: 'yes', value: Math.min(maxVal, countNum + 1) }) }} disabled={atMax}
                  style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${atMax ? T.border : T.yesColor + '50'}`, background: T.inputBg, color: atMax ? T.textSub : T.text, cursor: atMax ? 'not-allowed' : 'pointer', fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: atMax ? 0.35 : 1, transition: 'all 0.2s', touchAction: 'manipulation' }}>+</button>
              </div>
              <button type="button" onClick={() => onChange(dish, 'no')}
                style={{ marginLeft: 'auto', minHeight: 42, padding: '11px 18px', borderRadius: 12, border: `1.5px solid ${T.noColor}50`, background: 'transparent', color: T.noColor, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>❌ Skip</button>
            </div>
          )}
        </div>
      </div>
    )
  }
  const pctColor = getPctColor(value)
  const hasResp = typeof value === 'number'
  const selColor2 = pctColor || T.accent
  return (
    <div style={{ marginBottom: 8, padding: '12px 14px', borderRadius: 14, position: 'relative', overflow: 'hidden', background: hasResp ? `linear-gradient(145deg,${selColor2}1a,${T.card})` : T.card, border: `1.5px solid ${hasResp ? selColor2 : T.border}`, boxShadow: hasResp ? `0 6px 18px ${selColor2}18` : 'none', transition: 'all 0.25s' }}>
      {hasResp && <div style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: selColor2, filter: 'blur(36px)', opacity: 0.14, pointerEvents: 'none' }} />}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, fontFamily: "'DM Sans',sans-serif" }}>{dish}</div>
          {hasResp && <StatusPill label={`${value}% selected`} color={selColor2} />}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 25, 50, 75, 100].map(pct => {
            const pc = getPctColor(pct)
            const isSel = value === pct
            const color = pc || T.accent
            return (
              <button key={pct} type="button" onClick={() => onChange(dish, pct)}
                style={{ flex: 1, minHeight: 44, padding: '12px 2px', borderRadius: 12, border: `1.5px solid ${isSel ? color : T.border}`, background: isSel ? optGrad(color) : 'transparent', color: isSel ? color : T.textSub, fontSize: 13, fontWeight: isSel ? 900 : 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s ease', transform: isSel ? 'scale(1.03)' : 'scale(1)', outline: isSel ? `2px solid ${color}44` : 'none', outlineOffset: 1 }}
              >
                {pct}%
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Main SurveyModal — streamlined for 1-week (12 meals: Mon-Sat Lunch & Dinner)
// ────────────────────────────────────────────────────────────────────

export default function SurveyModal({ onClose, appSettings = {}, initialDay, initialMeal, initialWeekId }) {
  const { user } = useAuth()
  const appT = useTheme()
  const T = useMemo(() => buildTheme(appT), [appT])
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

  // Validation
  const isDishAnswered = useCallback((dish, val, isCount) => {
    if (isRotiItem(dish)) return val === 'yes' || val === 'no'
    if (isCount) return val === 'no' || (val && typeof val === 'object' && val.status === 'yes' && val.value > 0)
    return typeof val === 'number'
  }, [])
  const isLunchComplete = lunchWantsFood === false || (lunchWantsFood === true && lunchDishes.length === 0) || (lunchWantsFood === true && lunchDishes.length > 0 && lunchDishes.every((dish, idx) => isDishAnswered(dish, lunchResponses[dish], isCountInput(liveAppSettings, currentDay, 'lunch', idx))))
  const isDinnerComplete = dinnerWantsFood === false || (dinnerWantsFood === true && dinnerDishes.length === 0) || (dinnerWantsFood === true && dinnerDishes.length > 0 && dinnerDishes.every((dish, idx) => isDishAnswered(dish, dinnerResponses[dish], isCountInput(liveAppSettings, currentDay, 'dinner', idx))))
  const isDayComplete = lunchWantsFood !== null && dinnerWantsFood !== null && isLunchComplete && isDinnerComplete

  // Progress (12 meals max)
  const totalFilled = useMemo(() => {
    let c = 0
    DAYS.forEach(d => {
      const dk = d.substring(0,3).toLowerCase()
      const st = weekData[dk]
      if (st) {
        if (st.lunchWantsFood !== null) c++
        if (st.dinnerWantsFood !== null) c++
      }
    })
    return Math.min(12, c)
  }, [weekData])
  const pctGlobal = Math.round((totalFilled / totalSlots) * 100)

  useEffect(()=>{ if(!errorToast) return; const t=setTimeout(()=>setErrorToast(null),4000); return()=>clearTimeout(t)}, [errorToast])
  useEffect(()=>{ if(!syncMsg) return; const t=setTimeout(()=>setSyncMsg(null),2400); return()=>clearTimeout(t)}, [syncMsg])

  // Hydrate helper
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
          const m = {}; lDishes.forEach((dish, i) => { const raw = row[`${dk}_l_dish_${i+1}`]; if (raw !== undefined && raw !== null && raw !== '') m[dish] = normalizeDishValue(raw, dish, isCountInput(liveAppSettings, d, 'lunch', i)); else m[dish] = isRotiItem(dish) ? 'yes' : isCountInput(liveAppSettings, d, 'lunch', i) ? { status: 'yes', value: 1 } : 100 }); entry.lunchResponses = m
        } else if (lVal === 'Skipped' || lVal === 'opted_out') { entry.lunchWantsFood = false; entry.lunchResponses = {} }
        if (dVal === 'Applied' || dVal === 'opted_in') {
          entry.dinnerWantsFood = true
          const m = {}; dDishes.forEach((dish, i) => { const raw = row[`${dk}_d_dish_${i+1}`]; if (raw !== undefined && raw !== null && raw !== '') m[dish] = normalizeDishValue(raw, dish, isCountInput(liveAppSettings, d, 'dinner', i)); else m[dish] = isRotiItem(dish) ? 'yes' : isCountInput(liveAppSettings, d, 'dinner', i) ? { status: 'yes', value: 1 } : 100 }); entry.dinnerResponses = m
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
        if (val !== undefined && val !== null && val !== '') {
          payload[`${tDayKey}_l_dish_${idx+1}`] = denormalizeDishValue(val, dish, isCount)
        } else {
          payload[`${tDayKey}_l_dish_${idx+1}`] = isRotiItem(dish) ? 'Yes' : isCount ? '1' : '100%'
        }
      })
    }
    if (dStatus === 'Applied') {
      tDinnerDishes.forEach((dish, idx) => {
        const val = tState.dinnerResponses?.[dish] ?? existingRow?.[`${tDayKey}_d_dish_${idx+1}`]
        const isCount = isCountInput(liveAppSettings, tDay, 'dinner', idx)
        if (val !== undefined && val !== null && val !== '') {
          payload[`${tDayKey}_d_dish_${idx+1}`] = denormalizeDishValue(val, dish, isCount)
        } else {
          payload[`${tDayKey}_d_dish_${idx+1}`] = isRotiItem(dish) ? 'Yes' : isCount ? '1' : '100%'
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
  const handleOptInLunch = () => {
    updateActive(prev => {
      const next = { ...prev, lunchWantsFood: true }
      const lMap = { ...next.lunchResponses }
      lunchDishes.forEach((d, idx) => {
        if (lMap[d] === undefined || lMap[d] === null) {
          if (isRotiItem(d)) lMap[d] = 'yes'
          else if (isCountInput(liveAppSettings, currentDay, 'lunch', idx)) { const mx = snackDefaults?.[`dish_${idx+1}`] ?? 99; lMap[d] = mx === 0 ? 'no' : { status: 'yes', value: 1 } }
          else lMap[d] = 100
        }
      })
      next.lunchResponses = lMap
      return next
    })
  }
  const handleSkipLunch = () => {
    updateActive(prev => ({ ...prev, lunchWantsFood: false, lunchResponses: {} }))
    setTimeout(() => dinnerCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 180)
  }
  const handleOptInDinner = () => {
    updateActive(prev => {
      const next = { ...prev, dinnerWantsFood: true }
      const dMap = { ...next.dinnerResponses }
      dinnerDishes.forEach((d, idx) => {
        if (dMap[d] === undefined || dMap[d] === null) {
          if (isRotiItem(d)) dMap[d] = 'yes'
          else if (isCountInput(liveAppSettings, currentDay, 'dinner', idx)) { const mx = snackDefaults?.[`dish_${idx+1}`] ?? 99; dMap[d] = mx === 0 ? 'no' : { status: 'yes', value: 1 } }
          else dMap[d] = 100
        }
      })
      next.dinnerResponses = dMap
      return next
    })
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

    // Verify all 6 days are answered either in weekData or existingRow
    const missing = []
    let firstMissingDayIdx = -1
    DAYS.forEach((d, idx) => {
      const dk = d.substring(0,3).toLowerCase()
      const localSt = weekData[dk]
      const hasLocalLunch = localSt && localSt.lunchWantsFood !== null
      const hasLocalDinner = localSt && localSt.dinnerWantsFood !== null
      const hasServerLunch = Boolean(existingRow?.[`${dk}_l_status`])
      const hasServerDinner = Boolean(existingRow?.[`${dk}_d_status`])

      if (!hasLocalLunch && !hasServerLunch) {
        missing.push({ day: d, meal: 'lunch' })
        if (firstMissingDayIdx === -1) firstMissingDayIdx = idx
      }
      if (!hasLocalDinner && !hasServerDinner) {
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
      <div ref={modalScrollRef} onClick={e=>e.stopPropagation()} style={{ background:T.modalBg, borderRadius:24, padding:'clamp(14px,3vw,22px)', maxWidth:780, width:'100%', boxSizing:'border-box', border:`1.5px solid ${T.modalBorder}`, boxShadow:'0 30px 80px rgba(0,0,0,0.55)', position:'relative', overflowX:'hidden', overflowY:'auto', maxHeight:'calc(100dvh - 24px)', WebkitOverflowScrolling:'touch', animation:'surveyModalIn 0.35s ease-out' }}>
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
        <div style={{ marginBottom:12, padding:10, borderRadius:16, background:'rgba(255,255,255,0.03)', border:`1px solid ${T.border}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing: '0.12em', textTransform:'uppercase', color:T.textSub, fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:6 }}><Layers size={12} color={T.accent}/> Weekly Progress</span>
            <span style={{ fontSize:12, fontWeight:900, color:T.text, background:T.accentBg, border:`1px solid ${T.accentBorder}`, padding:'2px 8px', borderRadius:999 }}>{totalFilled} / 12 meals · {pctGlobal}%</span>
          </div>
          <div style={{ height:10, borderRadius:999, background:T.inputBg, border:`1px solid ${T.border}`, overflow:'hidden', padding:2, position:'relative' }}>
            <div style={{ height:'100%', width:`${pctGlobal}%`, borderRadius:999, background: pctGlobal===100?'linear-gradient(90deg,#10b981,#34d399)':T.accentGrad, boxShadow: pctGlobal>0?`0 2px 12px ${T.accent}30`:'none', transition:'width 0.6s cubic-bezier(0.32,0.72,0,1)', position:'relative', overflow:'hidden' }}>
              <span style={{ position:'absolute', inset:0, background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)', transform:'translateX(-100%)', animation: pctGlobal>0?'shimmer 1.6s ease-in-out infinite':'none' }} />
            </div>
          </div>
        </div>

        {/* Day Navigation Tabs — 6 days Mon-Sat */}
        <div style={{ display:'flex', gap:6, marginBottom:14, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
          {DAYS.map((d, idx)=>{
            const dk = d.substring(0,3).toLowerCase()
            const isCur = idx === currentDayIndex
            const dayLocal = weekData[dk]
            const isDoneLocal = dayLocal && dayLocal.lunchWantsFood !== null && dayLocal.dinnerWantsFood !== null
            const isDoneServer = existingRow && existingRow[`${dk}_l_status`] && existingRow[`${dk}_d_status`]
            const isDone = isDoneLocal || isDoneServer
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
        <div style={{ marginBottom:14, padding:'16px 18px', borderRadius:18, background: lunchWantsFood===true?`linear-gradient(145deg,${T.accentBg},${T.card})`:T.card, border:`1.5px solid ${lunchWantsFood===true?T.accent: lunchWantsFood===false?T.noColor+'60':T.border}`, boxShadow: lunchWantsFood===true?`0 8px 24px ${T.accentBg}`:'none', transition:'all 0.28s' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:T.accentBg, display:'flex', alignItems:'center', justifyContent:'center' }}><Sun size={18} color={T.accent}/></div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:T.text, fontFamily:"'Playfair Display',serif" }}>☀️ {currentDayName} Lunch</div>
                <div style={{ fontSize:11, color:T.textSub, fontFamily:"'DM Sans',sans-serif" }}>{lunchWantsFood===null?`Would you like Lunch?`: lunchWantsFood? 'Dishes selected':'Lunch skipped'}</div>
              </div>
            </div>
            {lunchWantsFood!==null && (<span style={{ fontSize:10.5, fontWeight:900, padding:'3px 10px', borderRadius:100, background: lunchWantsFood?T.yesBg:T.noBg, color: lunchWantsFood?T.yesColor:T.noColor, border:`1px solid ${lunchWantsFood?T.yesColor:T.noColor}50` }}>{lunchWantsFood? (isLunchComplete?'✅ Complete':'⏳ In progress'):'❌ Skipped'}</span>)}
          </div>
          <div style={{ display:'flex', gap:10, marginBottom: lunchWantsFood===true?14:0 }}>
            <button type="button" onClick={handleOptInLunch} style={{ flex:1, minHeight:46, padding:'13px 14px', borderRadius:12, border:`2px solid ${lunchWantsFood===true?T.yesColor:T.border}`, background: lunchWantsFood===true?T.yesBg:'rgba(76,175,80,0.05)', color:T.yesColor, cursor:'pointer', fontSize:13.5, fontWeight:800, fontFamily:"'DM Sans',sans-serif", transition:'all 0.22s', transform: lunchWantsFood===true?'scale(1.01)':'scale(1)', boxShadow: lunchWantsFood===true?`0 4px 16px ${T.yesColor}30`:'none', touchAction:'manipulation', WebkitTapHighlightColor:'transparent' }}>✅ Yes, I want food</button>
            <button type="button" onClick={handleSkipLunch} style={{ flex:1, minHeight:46, padding:'13px 14px', borderRadius:12, border:`2px solid ${lunchWantsFood===false?T.noColor:T.border}`, background: lunchWantsFood===false?T.noBg:'rgba(244,67,54,0.05)', color:T.noColor, cursor:'pointer', fontSize:13.5, fontWeight:800, fontFamily:"'DM Sans',sans-serif", transition:'all 0.22s', transform: lunchWantsFood===false?'scale(1.01)':'scale(1)', touchAction:'manipulation', WebkitTapHighlightColor:'transparent' }}>❌ No, I'll skip</button>
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
                <div style={{ padding:'20px 14px', textAlign:'center', color:T.textSub, background:'rgba(255,255,255,0.02)', borderRadius:12, border:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>👨‍🍳</div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.text }}>👨‍🍳 Menu is being prepared by Al-Mawaid team</div>
                  <div style={{ fontSize:11, color:T.textSub, marginTop:2 }}>Dishes for this week will appear once finalized.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* DINNER CARD */}
        <div ref={dinnerCardRef} style={{ marginBottom:18, padding:'16px 18px', borderRadius:18, background: dinnerWantsFood===true?`linear-gradient(145deg,rgba(139,92,246,0.07),${T.card})`:T.card, border:`1.5px solid ${dinnerWantsFood===true?'rgba(139,92,246,0.4)': dinnerWantsFood===false?T.noColor+'60':T.border}`, boxShadow: dinnerWantsFood===true?'0 8px 24px rgba(139,92,246,0.12)':'none', transition:'all 0.28s' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'rgba(139,92,246,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}><Moon size={18} color="#a78bfa"/></div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:T.text, fontFamily:"'Playfair Display',serif" }}>🌙 {currentDayName} Dinner</div>
                <div style={{ fontSize:11, color:T.textSub, fontFamily:"'DM Sans',sans-serif" }}>{dinnerWantsFood===null?`Would you like Dinner?`: dinnerWantsFood? 'Dishes selected':'Dinner skipped'}</div>
              </div>
            </div>
            {dinnerWantsFood!==null && (<span style={{ fontSize:10.5, fontWeight:900, padding:'3px 10px', borderRadius:100, background: dinnerWantsFood?T.yesBg:T.noBg, color: dinnerWantsFood?T.yesColor:T.noColor, border:`1px solid ${dinnerWantsFood?T.yesColor:T.noColor}50` }}>{dinnerWantsFood? (isDinnerComplete?'✅ Complete':'⏳ In progress'):'❌ Skipped'}</span>)}
          </div>
          <div style={{ display:'flex', gap:10, marginBottom: dinnerWantsFood===true?14:0 }}>
            <button type="button" onClick={handleOptInDinner} style={{ flex:1, minHeight:46, padding:'13px 14px', borderRadius:12, border:`2px solid ${dinnerWantsFood===true?T.yesColor:T.border}`, background: dinnerWantsFood===true?T.yesBg:'rgba(76,175,80,0.05)', color:T.yesColor, cursor:'pointer', fontSize:13.5, fontWeight:800, fontFamily:"'DM Sans',sans-serif", transition:'all 0.22s', transform: dinnerWantsFood===true?'scale(1.01)':'scale(1)', boxShadow: dinnerWantsFood===true?`0 4px 16px ${T.yesColor}30`:'none', touchAction:'manipulation', WebkitTapHighlightColor:'transparent' }}>✅ Yes, I want food</button>
            <button type="button" onClick={handleSkipDinner} style={{ flex:1, minHeight:46, padding:'13px 14px', borderRadius:12, border:`2px solid ${dinnerWantsFood===false?T.noColor:T.border}`, background: dinnerWantsFood===false?T.noBg:'rgba(244,67,54,0.05)', color:T.noColor, cursor:'pointer', fontSize:13.5, fontWeight:800, fontFamily:"'DM Sans',sans-serif", transition:'all 0.22s', transform: dinnerWantsFood===false?'scale(1.01)':'scale(1)', touchAction:'manipulation', WebkitTapHighlightColor:'transparent' }}>❌ No, I'll skip</button>
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
                <div style={{ padding:'20px 14px', textAlign:'center', color:T.textSub, background:'rgba(255,255,255,0.02)', borderRadius:12, border:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>👨‍🍳</div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.text }}>👨‍🍳 Menu is being prepared by Al-Mawaid team</div>
                  <div style={{ fontSize:11, color:T.textSub, marginTop:2 }}>Dishes for this week will appear once finalized.</div>
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

