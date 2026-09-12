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
import { submitSurveyRow, beginSurvey } from '../lib/submitSurvey'
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
                style={{ flex: 1, minHeight: 44, padding: '12px 2px', borderRadius: 12, border: `1.5px solid ${isSel ? color : T.border}`, background: isSel ? optGrad(color) : 'transparent', color: isSel ? color : T.textSub, fontSize: 13, fontWeight: isSel ? 900 : 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s ease', transform: isSel ? 'scale(1.03)' : 'scale(1)', boxShadow: isSel ? optShadow(color) : 'none', letterSpacing: '0.01em', position: 'relative', overflow: 'hidden', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>
                {isSel && <Sheen />}{pct === 0 ? '0%' : pct + '%'}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Main SurveyModal — now supports 1-week (12 slots) and 2-week (24 slots)
// with zero jumble: each week is a sealed segment, responses keyed by weekId.
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
  // Also keep live sync so toggling cadence mid-session updates without reopen
  useEffect(() => { setLiveAppSettings(appSettings || {}) }, [appSettings])

  const weekIds = useMemo(() => getSurveyTargetWeeks(liveAppSettings), [liveAppSettings])
  const isTwoWeeks = weekIds.length === 2
  const totalSlots = isTwoWeeks ? 24 : 12
  const primaryWeekId = weekIds[0]
  // useWeeklyMenu now accepts array for dual fetch
  const weeklyMenuRaw = useWeeklyMenu(isTwoWeeks ? weekIds : primaryWeekId)

  const resolveWeekMenu = useCallback((weekId, day) => {
    if (isTwoWeeks && weeklyMenuRaw?.__byWeek?.[weekId]) return getMenuForWeekDay(weeklyMenuRaw, weekId, day)
    return weeklyMenuRaw?.[day] || weeklyMenuRaw?.[cap(day)] || weeklyMenuRaw?.[day.substring(0,3).toLowerCase()] || { lunch: [], dinner: [] }
  }, [weeklyMenuRaw, isTwoWeeks])

  // Active position: week index + day index
  const initialWeekIdx = useMemo(() => {
    if (initialWeekId && weekIds.includes(initialWeekId)) return weekIds.indexOf(initialWeekId)
    return 0
  }, [initialWeekId, weekIds])
  const initialDayIdx = useMemo(() => {
    if (!initialDay) return 0
    const idx = DAYS.findIndex(d => d.toLowerCase() === String(initialDay).toLowerCase())
    return idx !== -1 ? idx : 0
  }, [initialDay])

  const [activeWeekIdx, setActiveWeekIdx] = useState(initialWeekIdx)
  const [currentDayIndex, setCurrentDayIndex] = useState(initialDayIdx)
  const [weekData, setWeekData] = useState(() => createInitialWeekDataForWeeks(weekIds))
  const dirtyRef = useRef(new Set()) // "weekId|dk"

  const [existingMap, setExistingMap] = useState({}) // weekId -> flat
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

  // Keep weekData shape synced when weekIds change (e.g. admin flips cadence)
  useEffect(() => {
    setWeekData(prev => {
      const next = { ...prev }
      weekIds.forEach(wid => { if (!next[wid]) { next[wid] = {}; DAYS.forEach(d => { const dk=d.substring(0,3).toLowerCase(); if(!next[wid][dk]) next[wid][dk]=createEmptyDay() }) } })
      // prune removed weeks
      Object.keys(next).forEach(k => { if (!weekIds.includes(k)) delete next[k] })
      return next
    })
  }, [weekIds])

  const activeWeekId = weekIds[activeWeekIdx] || weekIds[0]
  const currentDay = DAYS[currentDayIndex] || 'monday'
  const currentDayName = cap(currentDay)
  const dayKey = currentDay.substring(0, 3).toLowerCase()

  const activeDayState = (weekData[activeWeekId] && weekData[activeWeekId][dayKey]) || createEmptyDay()
  const { lunchWantsFood, lunchResponses, dinnerWantsFood, dinnerResponses } = activeDayState

  // Menu for active slot
  const activeMenu = useMemo(() => resolveWeekMenu(activeWeekId, currentDay), [resolveWeekMenu, activeWeekId, currentDay])
  const lunchDishes = useMemo(() => {
    if (activeMenu?.lunch?.length) return activeMenu.lunch
    const snap = getSlotDishes(existingMap[activeWeekId], currentDay, 'lunch', [])
    if (snap?.length) return snap
    return parseDishArray(DEFAULT_MENU[dayKey]?.lunch)
  }, [activeMenu, existingMap, activeWeekId, currentDay, dayKey])
  const dinnerDishes = useMemo(() => {
    if (activeMenu?.dinner?.length) return activeMenu.dinner
    const snap = getSlotDishes(existingMap[activeWeekId], currentDay, 'dinner', [])
    if (snap?.length) return snap
    return parseDishArray(DEFAULT_MENU[dayKey]?.dinner)
  }, [activeMenu, existingMap, activeWeekId, currentDay, dayKey])

  const surveyOpen = isSurveyOpen(liveAppSettings, user?.id)
  const lunchEditable = canEditMeal(currentDay, activeWeekId, 'lunch', liveAppSettings)
  const dinnerEditable = canEditMeal(currentDay, activeWeekId, 'dinner', liveAppSettings)
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

  // Progress per week + global
  const totalFilled = useMemo(() => {
    let c = 0
    weekIds.forEach(wid => {
      const fm = existingMap[wid]
      // prefer flat counts, but also include in-memory dirty? Use existingMap as source of truth after save + weekData overlay for local pending?
      // For real-time progress, count from weekData (includes unsaved) merged with existing? Use weekData overlay.
      const wd = weekData[wid]
      if (!wd) return
      DAYS.forEach(d => {
        const dk = d.substring(0,3).toLowerCase()
        const st = wd[dk]
        if (!st) return
        if (st.lunchWantsFood !== null) c++
        if (st.dinnerWantsFood !== null) c++
        // However dirty unsaved counts as "filled" for progress; but still need server truth for lock.
      })
    })
    return c
  }, [weekIds, weekData, existingMap])
  const pctGlobal = totalSlots ? Math.round((totalFilled/totalSlots)*100) : 0
  const weekFilled = useMemo(() => {
    const out = {}
    weekIds.forEach(wid => {
      let c=0
      const wd = weekData[wid]
      if (wd) DAYS.forEach(d => { const dk=d.substring(0,3).toLowerCase(); const st=wd[dk]; if(st?.lunchWantsFood!==null) c++; if(st?.dinnerWantsFood!==null) c++ })
      out[wid]=c
    })
    return out
  }, [weekIds, weekData])

  // Escape
  useEffect(() => { const h=(e)=>{ if(e.key==='Escape') onClose() }; window.addEventListener('keydown',h); return()=>window.removeEventListener('keydown',h)}, [onClose])
  useEffect(()=>{ if(!errorToast) return; const t=setTimeout(()=>setErrorToast(null),4000); return()=>clearTimeout(t)}, [errorToast])
  useEffect(()=>{ if(!syncMsg) return; const t=setTimeout(()=>setSyncMsg(null),2400); return()=>clearTimeout(t)}, [syncMsg])

  // Hydrate helper
  const hydrateFromRows = useCallback((rowsMap) => {
    setWeekData(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      weekIds.forEach(wid => {
        const row = rowsMap[wid]
        if (!row) return
        DAYS.forEach(d => {
          const dk=d.substring(0,3).toLowerCase()
          const dirtyKey = `${wid}|${dk}`
          if (dirtyRef.current.has(dirtyKey)) return
          const lVal = row[`${dk}_l_status`]
          const dVal = row[`${dk}_d_status`]
          const dayMenu = resolveWeekMenu(wid, d)
          const lDishes = dayMenu?.lunch?.length ? dayMenu.lunch : (getSlotDishes(row,d,'lunch', []).length ? getSlotDishes(row,d,'lunch', []) : parseDishArray(DEFAULT_MENU[dk]?.lunch))
          const dDishes = dayMenu?.dinner?.length ? dayMenu.dinner : (getSlotDishes(row,d,'dinner', []).length ? getSlotDishes(row,d,'dinner', []) : parseDishArray(DEFAULT_MENU[dk]?.dinner))
          if (!next[wid]) next[wid]={}
          if (!next[wid][dk]) next[wid][dk]=createEmptyDay()
          const entry = { ...next[wid][dk] }
          if (lVal==='Applied' || lVal==='opted_in') {
            entry.lunchWantsFood=true
            const m={}; lDishes.forEach((dish,i)=>{ const raw=row[`${dk}_l_dish_${i+1}`]; if(raw!==undefined && raw!==null && raw!=='') m[dish]=normalizeDishValue(raw,dish,isCountInput(liveAppSettings,d,'lunch',i)); else m[dish]= isRotiItem(dish)?'yes': isCountInput(liveAppSettings,d,'lunch',i)?{status:'yes',value:1}:100 }); entry.lunchResponses=m
          } else if(lVal==='Skipped'||lVal==='opted_out'){ entry.lunchWantsFood=false; entry.lunchResponses={} }
          if (dVal==='Applied' || dVal==='opted_in') {
            entry.dinnerWantsFood=true
            const m={}; dDishes.forEach((dish,i)=>{ const raw=row[`${dk}_d_dish_${i+1}`]; if(raw!==undefined && raw!==null && raw!=='') m[dish]=normalizeDishValue(raw,dish,isCountInput(liveAppSettings,d,'dinner',i)); else m[dish]= isRotiItem(dish)?'yes': isCountInput(liveAppSettings,d,'dinner',i)?{status:'yes',value:1}:100 }); entry.dinnerResponses=m
          } else if(dVal==='Skipped'||dVal==='opted_out'){ entry.dinnerWantsFood=false; entry.dinnerResponses={} }
          next[wid][dk]=entry
        })
      })
      return next
    })
  }, [weekIds, resolveWeekMenu, liveAppSettings])

  // Load
  const loadData = useCallback(async () => {
    try {
      if (user?.id) {
        const { data: u } = await supabase.from('user_stats').select('thali_number,email,snack_defaults').eq('user_id', user.id).maybeSingle()
        if (u) { setUserData(prev=> prev.thali_no?prev:{thali_no:u.thali_number||'', email:u.email||user?.email||''}); if(u.snack_defaults) setSnackDefaults(prev=>prev||u.snack_defaults) }
      }
      const { data: map } = await fetchUserSurveyRows(user?.id, weekIds)
      setExistingMap(map||{})
      setDataLoaded(true)
      if (map) {
        hydrateFromRows(map)
        // locked if every week 12/12
        const allLocked = weekIds.every(wid => {
          const r=map[wid]; if(!r) return false
          return DAYS.every(d=>{ const dk=d.substring(0,3).toLowerCase(); return r[`${dk}_l_status`] && r[`${dk}_d_status`] })
        })
        setSurveySubmitted(allLocked)
      }
    } catch { setDataLoaded(true) }
  }, [user?.id, weekIds, hydrateFromRows])
  useEffect(()=>{ loadData() }, [loadData])

  // Realtime
  useEffect(()=>{
    if(!user?.id) return
    const ch=supabase.channel(`survey-sync-${user.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'survey_day_responses',filter:`user_id=eq.${user.id}`}, async()=>{
        const {data:map}=await fetchUserSurveyRows(user?.id, weekIds)
        if(map){ setExistingMap(map); hydrateFromRows(map) }
      }).subscribe()
    return()=>supabase.removeChannel(ch)
  },[user?.id, weekIds, hydrateFromRows])

  // Position to first incomplete
  const positionedRef=useRef(false)
  useEffect(()=>{
    if(!dataLoaded || positionedRef.current || initialDay) return
    positionedRef.current=true
    for(let wi=0; wi<weekIds.length; wi++){
      const wid=weekIds[wi]
      const row=existingMap[wid]
      const idx=DAYS.findIndex(d=>{ const dk=d.substring(0,3).toLowerCase(); return !row?.[`${dk}_l_status`] || !row?.[`${dk}_d_status`] })
      if(idx!==-1){ setActiveWeekIdx(wi); setCurrentDayIndex(idx); break }
    }
  },[dataLoaded, existingMap, weekIds, initialDay])

  useEffect(()=>{
    if(initialDay||!dataLoaded||surveySubmitted||Object.values(existingMap).some(Boolean)) return
    if(!localStorage.getItem('almawaid_survey_intro_seen')) setShowIntro(true)
  },[dataLoaded, surveySubmitted, existingMap, initialDay])

  const handleStartSurvey = ()=>{
    try{ localStorage.setItem('almawaid_survey_intro_seen','1')}catch{}
    setShowIntro(false)
    if(user?.id && weekIds.length) beginSurvey(user.id, weekIds)
    setActiveWeekIdx(0); setCurrentDayIndex(0)
  }

  // Build payload
  const buildPayloadForSlot = useCallback((wid, dayIdx)=>{
    const tDay=DAYS[dayIdx]||currentDay
    const tDayKey=tDay.substring(0,3).toLowerCase()
    const tState=(weekData[wid]&&weekData[wid][tDayKey])||createEmptyDay()
    const tMenu=resolveWeekMenu(wid, tDay)
    const tLunchDishes=tMenu?.lunch?.length ? tMenu.lunch : (getSlotDishes(existingMap[wid], tDay,'lunch', []).length?getSlotDishes(existingMap[wid], tDay,'lunch', []): parseDishArray(DEFAULT_MENU[tDayKey]?.lunch))
    const tDinnerDishes=tMenu?.dinner?.length ? tMenu.dinner : (getSlotDishes(existingMap[wid], tDay,'dinner', []).length?getSlotDishes(existingMap[wid], tDay,'dinner', []): parseDishArray(DEFAULT_MENU[tDayKey]?.dinner))
    const lStatus=tState.lunchWantsFood===true?'Applied': tState.lunchWantsFood===false?'Skipped':null
    const dStatus=tState.dinnerWantsFood===true?'Applied': tState.dinnerWantsFood===false?'Skipped':null
    const payload={ user_id:user?.id, week_id:wid, day:tDayKey, thali_number:userData.thali_no, email:userData.email||'', updated_at:new Date().toISOString() }
    let snap=mergeDishSnapshot(existingMap[wid], tDay,'lunch', tLunchDishes)
    snap=mergeDishSnapshot({dish_snapshot:snap}, tDay,'dinner', tDinnerDishes)
    payload.dish_snapshot=snap
    if(lStatus) payload[`${tDayKey}_l_status`]=lStatus
    if(dStatus) payload[`${tDayKey}_d_status`]=dStatus
    if(lStatus==='Applied'){ tLunchDishes.forEach((dish,idx)=>{ const val=tState.lunchResponses?.[dish]; const isCount=isCountInput(liveAppSettings,tDay,'lunch',idx); if(val!==undefined&&val!==null) payload[`${tDayKey}_l_dish_${idx+1}`]=denormalizeDishValue(val,dish,isCount); else payload[`${tDayKey}_l_dish_${idx+1}`]= isRotiItem(dish)?'Yes': isCount?'1':'100%' }) }
    if(dStatus==='Applied'){ tDinnerDishes.forEach((dish,idx)=>{ const val=tState.dinnerResponses?.[dish]; const isCount=isCountInput(liveAppSettings,tDay,'dinner',idx); if(val!==undefined&&val!==null) payload[`${tDayKey}_d_dish_${idx+1}`]=denormalizeDishValue(val,dish,isCount); else payload[`${tDayKey}_d_dish_${idx+1}`]= isRotiItem(dish)?'Yes': isCount?'1':'100%' }) }
    return payload
  }, [currentDay, weekData, existingMap, user?.id, userData, liveAppSettings, resolveWeekMenu])

  const saveSlot = async (wid, dayIdx)=>{
    if(loading) return false
    const tDay=DAYS[dayIdx]||currentDay
    const tDayKey=tDay.substring(0,3).toLowerCase()
    const tState=weekData[wid]?.[tDayKey]
    if(!tState || (tState.lunchWantsFood===null && tState.dinnerWantsFood===null)) return true
    setLoading(true)
    try{
      const payload=buildPayloadForSlot(wid, dayIdx)
      const { error }=await submitSurveyRow(payload)
      if(error) throw error
      dirtyRef.current.delete(`${wid}|${tDayKey}`)
      const { data: map }=await fetchUserSurveyRows(user?.id, weekIds)
      if(map) setExistingMap(map)
      setSyncMsg(`Saved ${cap(tDay)} · ${formatWeekRange(wid)}`)
      return true
    }catch(err){ setErrorToast(`Save failed: ${err?.message||'Please try again.'}`); return false }
    finally{ setLoading(false) }
  }

  // Lunch/Dinner handlers for active slot
  const updateActive = (updater)=>{
    const key=`${activeWeekId}|${dayKey}`
    dirtyRef.current.add(key)
    setWeekData(prev=>{
      const wd = JSON.parse(JSON.stringify(prev))
      if(!wd[activeWeekId]) wd[activeWeekId]={}
      if(!wd[activeWeekId][dayKey]) wd[activeWeekId][dayKey]=createEmptyDay()
      wd[activeWeekId][dayKey]=updater(wd[activeWeekId][dayKey])
      return wd
    })
  }
  const handleOptInLunch=()=>{
    updateActive(prev=>{
      const next={...prev, lunchWantsFood:true}
      const lMap={...next.lunchResponses}
      lunchDishes.forEach((d,idx)=>{
        if(lMap[d]===undefined||lMap[d]===null){
          if(isRotiItem(d)) lMap[d]='yes'
          else if(isCountInput(liveAppSettings,currentDay,'lunch',idx)){ const mx=snackDefaults?.[`dish_${idx+1}`]??99; lMap[d]=mx===0?'no':{status:'yes',value:1} }
          else lMap[d]=100
        }
      })
      next.lunchResponses=lMap
      return next
    })
  }
  const handleSkipLunch=()=>{
    updateActive(prev=>({...prev, lunchWantsFood:false, lunchResponses:{}}))
    setTimeout(()=> dinnerCardRef.current?.scrollIntoView({behavior:'smooth', block:'nearest'}),180)
  }
  const handleOptInDinner=()=>{
    updateActive(prev=>{
      const next={...prev, dinnerWantsFood:true}
      const dMap={...next.dinnerResponses}
      dinnerDishes.forEach((d,idx)=>{
        if(dMap[d]===undefined||dMap[d]===null){
          if(isRotiItem(d)) dMap[d]='yes'
          else if(isCountInput(liveAppSettings,currentDay,'dinner',idx)){ const mx=snackDefaults?.[`dish_${idx+1}`]??99; dMap[d]=mx===0?'no':{status:'yes',value:1} }
          else dMap[d]=100
        }
      })
      next.dinnerResponses=dMap
      return next
    })
  }
  const handleSkipDinner=()=>{
    updateActive(prev=>({...prev, dinnerWantsFood:false, dinnerResponses:{}}))
    setTimeout(()=> bottomNavRef.current?.scrollIntoView({behavior:'smooth', block:'nearest'}),180)
  }
  const handleLunchDish=useCallback((dish,val)=>{
    const key=`${activeWeekId}|${dayKey}`; dirtyRef.current.add(key)
    setWeekData(prev=>{
      const wd=JSON.parse(JSON.stringify(prev))
      wd[activeWeekId][dayKey].lunchResponses[ dish ]=val
      return wd
    })
  },[activeWeekId, dayKey])
  const handleDinnerDish=useCallback((dish,val)=>{
    const key=`${activeWeekId}|${dayKey}`; dirtyRef.current.add(key)
    setWeekData(prev=>{
      const wd=JSON.parse(JSON.stringify(prev))
      wd[activeWeekId][dayKey].dinnerResponses[ dish ]=val
      return wd
    })
  },[activeWeekId, dayKey])
  const selectAll=(meal)=>{
    const dishes=meal==='lunch'?lunchDishes:dinnerDishes
    const key=`${activeWeekId}|${dayKey}`; dirtyRef.current.add(key)
    const res={}; dishes.forEach((d,idx)=>{
      if(isRotiItem(d)) res[d]='yes'
      else if(isCountInput(liveAppSettings,currentDay,meal,idx)){ const mx=snackDefaults?.[`dish_${idx+1}`]??99; res[d]= mx===0?'no':{status:'yes',value:1} } else res[d]=100
    })
    setWeekData(prev=>{
      const wd=JSON.parse(JSON.stringify(prev))
      const fld=meal==='lunch'?'lunchResponses':'dinnerResponses'
      wd[activeWeekId][dayKey][fld]={...wd[activeWeekId][dayKey][fld], ...res}
      return wd
    })
  }
  const clearAll=(meal)=>{
    const dishes=meal==='lunch'?lunchDishes:dinnerDishes
    const key=`${activeWeekId}|${dayKey}`; dirtyRef.current.add(key)
    const res={}; dishes.forEach((d,idx)=>{
      if(isRotiItem(d)) res[d]='no'
      else if(isCountInput(liveAppSettings,currentDay,meal,idx)) res[d]='no'
      else res[d]=0
    })
    setWeekData(prev=>{
      const wd=JSON.parse(JSON.stringify(prev))
      const fld=meal==='lunch'?'lunchResponses':'dinnerResponses'
      wd[activeWeekId][dayKey][fld]={...wd[activeWeekId][dayKey][fld], ...res}
      return wd
    })
  }

  // Navigation: linear across weeks Mon-Sat W1 then Mon-Sat W2
  const globalIndex = activeWeekIdx*6 + currentDayIndex
  const totalDays = weekIds.length*6
  const canGoPrev = globalIndex>0
  const canGoNext = globalIndex < totalDays-1

  const navigateToGlobal = async (nextGlobal)=>{
    const nextW = Math.floor(nextGlobal/6)
    const nextD = nextGlobal%6
    if(nextW<0||nextW>=weekIds.length) return
    if(dirtyRef.current.has(`${activeWeekId}|${dayKey}`) || lunchWantsFood!==null || dinnerWantsFood!==null){
      await saveSlot(activeWeekId, currentDayIndex)
    }
    setActiveWeekIdx(nextW); setCurrentDayIndex(nextD)
    modalScrollRef.current?.scrollTo({top:0, behavior:'smooth'})
  }
  const handleSelectDay = async (wIdx, dIdx)=>{
    const nxt = wIdx*6 + dIdx
    if(nxt===globalIndex) return
    await navigateToGlobal(nxt)
  }
  const handleWeekSwitch = async (wIdx)=>{
    if(wIdx===activeWeekIdx) return
    if(dirtyRef.current.has(`${activeWeekId}|${dayKey}`) || lunchWantsFood!==null) await saveSlot(activeWeekId, currentDayIndex)
    setActiveWeekIdx(wIdx)
    // keep same day index if possible, else 0
    if(currentDayIndex>=DAYS.length) setCurrentDayIndex(0)
    modalScrollRef.current?.scrollTo({top:0, behavior:'smooth'})
  }
  const goToNextDay = async ()=>{
    if(!isDayComplete){ setErrorToast(`Complete both Lunch & Dinner for ${currentDayName} first.`); return }
    await saveSlot(activeWeekId, currentDayIndex)
    if(canGoNext) { const ng=globalIndex+1; setActiveWeekIdx(Math.floor(ng/6)); setCurrentDayIndex(ng%6); modalScrollRef.current?.scrollTo({top:0, behavior:'smooth'}) }
  }
  const goToPrevDay = async ()=>{
    if(!canGoPrev) return
    if(isDayComplete || dirtyRef.current.has(`${activeWeekId}|${dayKey}`)) await saveSlot(activeWeekId, currentDayIndex)
    const ng=globalIndex-1; setActiveWeekIdx(Math.floor(ng/6)); setCurrentDayIndex(ng%6); modalScrollRef.current?.scrollTo({top:0, behavior:'smooth'})
  }

  const handleSubmitWeekly = async ()=>{
    if(!isDayComplete){ setErrorToast(`Complete both Lunch & Dinner for ${currentDayName} first.`); return }
    const saved=await saveSlot(activeWeekId, currentDayIndex)
    if(!saved) return
    const { data: freshMap }=await fetchUserSurveyRows(user?.id, weekIds)
    if(freshMap) setExistingMap(freshMap)
    const missing=[]
    weekIds.forEach(wid=>{
      const r=freshMap?.[wid]
      DAYS.forEach(d=>{
        const dk=d.substring(0,3).toLowerCase()
        if(!r?.[`${dk}_l_status`]) missing.push({weekId:wid, day:d, meal:'lunch'})
        if(!r?.[`${dk}_d_status`]) missing.push({weekId:wid, day:d, meal:'dinner'})
      })
    })
    if(missing.length>0){
      setSubmitResult({ type:'missing', title: isTwoWeeks?'Fortnight incomplete':'Survey incomplete', message:`${missing.length} slot${missing.length>1?'s':''} still need filling before locking.`, missingSlots: missing })
      return
    }
    setLoading(true)
    try{
      if(user?.id){
        const nowIso=new Date().toISOString()
        await supabase.from('survey_day_responses').update({submitted_at:nowIso, updated_at:nowIso}).eq('user_id', user.id).in('week_id', weekIds)
      }
      setSurveySubmitted(true); setShowSuccess(true); setTimeout(()=>{setShowSuccess(false); onClose()},2400)
    }catch(e){ console.warn('stamp',e); setSurveySubmitted(true); setShowSuccess(true); setTimeout(()=>{setShowSuccess(false); onClose()},2400) }
    finally{ setLoading(false) }
  }

  // INTRO
  if(showIntro){
    return (
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:10001, background:T.overlay, backdropFilter:'blur(14px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'clamp(10px,3vw,28px)' }}>
        <style>{SURVEY_STYLES}</style>
        <div onClick={e=>e.stopPropagation()} style={{ background:T.modalBg, borderRadius:24, padding:'clamp(22px,4vw,34px)', maxWidth:620, width:'100%', border:`1.5px solid ${T.modalBorder}`, boxShadow:'0 30px 80px rgba(0,0,0,0.55)', position:'relative', textAlign:'center', animation:'surveyModalIn 0.35s ease-out' }}>
          <button onClick={onClose} style={{ position:'absolute', top:14, right:14, background:T.softBg, border:`1px solid ${T.border}`, borderRadius:8, width:32, height:32, color:T.textSub, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', touchAction:'manipulation' }}><X size={16}/></button>
          <div style={{ width:64, height:64, borderRadius:20, background:T.accentBg, border:`1.5px solid ${T.accent}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:28 }}>{isTwoWeeks?'🗓️':'📋'}</div>
          <h2 style={{ margin:'0 0 6px', fontSize:22, fontWeight:800, color:T.text, fontFamily:"'Playfair Display',serif" }}>{isTwoWeeks?'Fortnight Meal Survey':'Weekly Meal Survey'}</h2>
          <p style={{ margin:'0 0 8px', fontSize:13, color:T.textSub, lineHeight:1.65, fontFamily:"'DM Sans',sans-serif" }}>{isTwoWeeks?`Fill both weeks at once — ${formatWeekRange(weekIds[0])} + ${formatWeekRange(weekIds[1])} · 24 meals in one flow.`:'Fill meal preferences for each day — Monday through Saturday.'}</p>
          {isTwoWeeks && <div style={{ margin:'0 auto 16px', display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:999, background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.22)', color:'#818cf8', fontSize:11, fontWeight:800, fontFamily:"'DM Sans',sans-serif" }}><Layers size={12}/> 2 Weeks · Sealed Segments · No Overlay</div>}
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:22, textAlign:'left' }}>
            {[
              ['☀️', 'Lunch & Dinner per day'],
              ['💾', 'Save & Continue day by day'],
              ['✅', `Submit locks all ${totalSlots} meals`]
            ].map(([ic,tx],i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}><div style={{ width:28, height:28, borderRadius:8, background:T.accentBg, display:'flex', alignItems:'center', justifyContent:'center' }}>{ic}</div><span style={{ fontSize:12.5, color:T.textSub, fontFamily:"'DM Sans',sans-serif" }}>{tx}</span></div>))}
          </div>
          <button onClick={handleStartSurvey} type="button" style={{ width:'100%', minHeight:48, padding:'14px', borderRadius:14, border:'none', background:T.accentGrad, color:'#000', cursor:'pointer', fontSize:15, fontWeight:900, fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8, touchAction:'manipulation' }}>Start {isTwoWeeks?'Fortnight':'Survey'} <Play size={16}/></button>
        </div>
      </div>
    )
  }
  if(showSuccess){
    return (
      <div style={{ position:'fixed', inset:0, zIndex:10001, display:'flex', alignItems:'center', justifyContent:'center', background:T.successOverlay, backdropFilter:'blur(20px)' }}>
        <style>{SURVEY_STYLES}</style>
        <div style={{ textAlign:'center', animation:'surveySuccess 0.6s ease-out' }}>
          <div style={{ width:84, height:84, borderRadius:'50%', background:'linear-gradient(135deg,#4CAF50,#2E7D32)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', boxShadow:'0 0 60px rgba(76,175,80,0.4)', animation:'surveyGlow 2s ease-in-out infinite' }}><Check size={44} color="#fff" strokeWidth={3}/></div>
          <h2 style={{ margin:'0 0 8px', fontSize:28, fontWeight:800, color:'#4CAF50', fontFamily:"'Playfair Display',serif" }}>{isTwoWeeks?'Fortnight Submitted!':'Survey Submitted!'}</h2>
          <p style={{ margin:0, fontSize:14, color:T.textSub, fontFamily:"'DM Sans',sans-serif" }}>Your {totalSlots} meal preferences are locked. Shukran! 🤲</p>
        </div>
      </div>
    )
  }
  // If submitted but weekly window is still OPEN, allow instant edit on any day — do NOT show locked screen.
  // Locked only when window is closed.
  if(surveySubmitted && !initialDay && !surveyOpen){
    return (
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:10001, background:T.overlay, backdropFilter:'blur(14px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'clamp(10px,3vw,28px)' }}>
        <style>{SURVEY_STYLES}</style>
        <div onClick={e=>e.stopPropagation()} style={{ background:T.modalBg, borderRadius:24, padding:'clamp(24px,4vw,36px)', maxWidth:560, width:'100%', border:`1.5px solid ${T.modalBorder}`, boxShadow:'0 30px 80px rgba(0,0,0,0.55)', position:'relative', textAlign:'center', animation:'surveyModalIn 0.35s ease-out' }}>
          <button onClick={onClose} style={{ position:'absolute', top:14, right:14, background:T.softBg, border:`1px solid ${T.border}`, borderRadius:8, width:32, height:32, color:T.textSub, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', touchAction:'manipulation' }}><X size={16}/></button>
          <div style={{ width:68, height:68, borderRadius:20, background:'rgba(76,175,80,0.15)', border:'1.5px solid rgba(76,175,80,0.4)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', color:'#4CAF50' }}><Lock size={32}/></div>
          <h2 style={{ margin:'0 0 8px', fontSize:22, fontWeight:800, color:T.text, fontFamily:"'Playfair Display',serif" }}>{isTwoWeeks?'Fortnight Locked':'Weekly Survey Locked'}</h2>
          <p style={{ margin:'0 0 20px', fontSize:13.5, color:T.textSub, lineHeight:1.6, fontFamily:"'DM Sans',sans-serif" }}>You have already filled and submitted your full {isTwoWeeks?'fortnight':'weekly'} survey for {isTwoWeeks? `${formatWeekRange(weekIds[0])} + ${formatWeekRange(weekIds[1])}`: formatWeekRange(primaryWeekId)}. No further submissions are permitted — window is now closed.</p>
          <div style={{ padding:'14px 18px', borderRadius:16, background:'rgba(76,175,80,0.08)', border:'1px solid rgba(76,175,80,0.25)', marginBottom:22, textAlign:'left' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}><Check size={18} color="#4CAF50" strokeWidth={2.5}/><span style={{ fontSize:13, fontWeight:800, color:'#4CAF50', fontFamily:"'DM Sans',sans-serif" }}>All {totalSlots} Meals Recorded & Locked</span></div>
            <div style={{ fontSize:12, color:T.textSub, fontFamily:"'DM Sans',sans-serif", lineHeight:1.5 }}>Your meal portion preferences are saved in the system. Shukran! 🤲</div>
          </div>
          <button onClick={onClose} type="button" style={{ width:'100%', minHeight:46, padding:'12px', borderRadius:14, border:'none', background:T.accentGrad, color:'#000', cursor:'pointer', fontSize:14, fontWeight:900, fontFamily:"'DM Sans',sans-serif", touchAction:'manipulation' }}>Close</button>
        </div>
      </div>
    )
  }

  // ── MAIN MODAL ──
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:10001, background:T.overlay, backdropFilter:'blur(14px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'clamp(8px,2.5vw,20px)', overflowY:'auto' }}>
      <style>{SURVEY_STYLES}</style>
      <div ref={modalScrollRef} onClick={e=>e.stopPropagation()} style={{ background:T.modalBg, borderRadius:24, padding:'clamp(14px,3vw,22px)', maxWidth:780, width:'100%', boxSizing:'border-box', border:`1.5px solid ${T.modalBorder}`, boxShadow:'0 30px 80px rgba(0,0,0,0.55)', position:'relative', overflowX:'hidden', overflowY:'auto', maxHeight:'calc(100dvh - 24px)', WebkitOverflowScrolling:'touch', animation:'surveyModalIn 0.35s ease-out' }}>
        {loading && (<div style={{ position:'absolute', inset:0, zIndex:999, borderRadius:24, background:T.loadingOverlay, backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}><div style={{ width:40, height:40, borderRadius:'50%', border:`3px solid`, borderColor:`${T.accent} transparent ${T.accent} ${T.accent}`, animation:'spin 0.8s linear infinite' }} /><div style={{ fontSize:13, color:T.accent, fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>Saving…</div></div>)}
        {errorToast && (<div style={{ position:'sticky', top:0, zIndex:998, marginBottom:12, padding:'12px 16px', borderRadius:12, background:'rgba(244,67,54,0.15)', border:`1px solid ${T.noColor}`, display:'flex', alignItems:'center', gap:10 }}><AlertTriangle size={18} color={T.noColor}/><span style={{ flex:1, fontSize:12, color:T.text, fontFamily:"'DM Sans',sans-serif" }}>{errorToast}</span><button onClick={()=>setErrorToast(null)} style={{ background:'transparent', border:'none', color:T.textSub, cursor:'pointer', touchAction:'manipulation' }}><X size={14}/></button></div>)}

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase', color:T.accent, fontFamily:"'DM Sans',sans-serif", marginBottom:2, display:'flex', alignItems:'center', gap:6 }}><CalendarRange size={10}/>{isTwoWeeks?`Fortnight Survey · ${totalSlots} Meals`:'Weekly Survey'}</div>
            <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:T.text, fontFamily:"'Playfair Display',serif" }}>📅 {currentDayName} <span style={{ fontSize:13, fontWeight:600, color:T.textSub, fontFamily:"'DM Sans',sans-serif" }}>· {formatWeekRange(activeWeekId)}</span></h2>
            <div style={{ fontSize:11, color:T.textSub, fontFamily:"'DM Sans',sans-serif", marginTop:2 }}>{isTwoWeeks? `Week ${activeWeekIdx+1} of 2` : `Day ${currentDayIndex+1} of 6`} · Slot {globalIndex+1} of {totalDays} days</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {syncMsg && <span style={{ fontSize:11, color:T.yesColor, fontWeight:800, fontFamily:"'DM Sans',sans-serif" }}>✓ {syncMsg}</span>}
            <button onClick={onClose} style={{ background:T.softBg, border:'none', cursor:'pointer', padding:8, borderRadius:10, color:T.textSub, display:'flex', alignItems:'center', justifyContent:'center', touchAction:'manipulation' }}><X size={18}/></button>
          </div>
        </div>

        {surveySubmitted && surveyOpen && (
          <div style={{ marginBottom:12, padding:'8px 12px', borderRadius:10, background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.25)', fontSize:11, color:'#f59e0b', fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>Submitted — window open. Tap any day to edit.</div>
        )}

        {/* Powerful progress — global + per week */}
        <div style={{ marginBottom:12, padding:10, borderRadius:16, background:'rgba(255,255,255,0.03)', border:`1px solid ${T.border}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:T.textSub, fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:6 }}><Layers size={12} color={T.accent}/> {isTwoWeeks?'Fortnight':'Weekly'} Progress</span>
            <span style={{ fontSize:12, fontWeight:900, color:T.text, background:T.accentBg, border:`1px solid ${T.accentBorder}`, padding:'2px 8px', borderRadius:999 }}>{totalFilled} / {totalSlots} meals · {pctGlobal}%</span>
          </div>
          <div style={{ height:10, borderRadius:999, background:T.inputBg, border:`1px solid ${T.border}`, overflow:'hidden', padding:2, position:'relative' }}>
            <div style={{ height:'100%', width:`${pctGlobal}%`, borderRadius:999, background: pctGlobal===100?'linear-gradient(90deg,#10b981,#34d399)':T.accentGrad, boxShadow: pctGlobal>0?`0 2px 12px ${T.accent}30`:'none', transition:'width 0.6s cubic-bezier(0.32,0.72,0,1)', position:'relative', overflow:'hidden' }}>
              <span style={{ position:'absolute', inset:0, background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)', transform:'translateX(-100%)', animation: pctGlobal>0?'shimmer 1.6s ease-in-out infinite':'none' }} />
            </div>
          </div>
          {isTwoWeeks && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
              {weekIds.map((wid, idx)=>(
                <div key={wid} style={{ padding:'6px 8px', borderRadius:10, background: idx===activeWeekIdx?T.accentBg:'rgba(255,255,255,0.03)', border:`1px solid ${idx===activeWeekIdx?T.accentBorder:T.border}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontSize:10, fontWeight:800, color: idx===activeWeekIdx?T.accent: T.textSub, fontFamily:"'DM Sans',sans-serif" }}>WEEK {idx+1} · {formatWeekRange(wid)}</span>
                    <span style={{ fontSize:10, fontWeight:800, color: (weekFilled[wid]||0)===12?'#10b981':T.textSub }}>{weekFilled[wid]||0}/12</span>
                  </div>
                  <div style={{ display:'flex', gap:3 }}>{Array.from({length:12}).map((_,i)=>(<span key={i} style={{ flex:1, height:4, borderRadius:999, background: i<(weekFilled[wid]||0)? (idx===0?'#6366f1':'#10b981'): 'rgba(255,255,255,0.08)', border:`1px solid ${i<(weekFilled[wid]||0)?'rgba(255,255,255,0.12)':'transparent'}` }}/>))}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Week switcher + Reference strip — polished for web (side-by-side) & mobile (stacked) */}
        {isTwoWeeks && (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:8, padding:6, borderRadius:14, background:T.inputBg, border:`1px solid ${T.border}` }}>
              {weekIds.map((wid, idx)=>{
                const isActive= idx===activeWeekIdx
                const filled=weekFilled[wid]||0
                const done=filled===12
                return (
                  <button key={wid} type="button" onClick={()=>handleWeekSwitch(idx)}
                    style={{ flex:1, padding:'10px 10px', borderRadius:10, border:`1.5px solid ${isActive?T.accent: done?'#10b981':'transparent'}`, background: isActive?T.accentBg: done?'rgba(16,185,129,0.08)':'transparent', color: isActive?T.accent: done?'#10b981':T.textSub, fontWeight: isActive?900:700, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, transition:'all 0.2s', boxShadow: isActive?`0 4px 14px ${T.accentBg}`:'none', touchAction:'manipulation' }}>
                    <span style={{ fontSize:12, display:'flex', alignItems:'center', gap:6 }}>{done?'✅': isActive?'●': '○'} Week {idx+1}</span>
                    <span style={{ fontSize:10, opacity:0.9, fontWeight:700 }}>{formatWeekRange(wid)}</span>
                    <span style={{ fontSize:10, fontWeight:800 }}>{filled}/12</span>
                  </button>
                )
              })}
            </div>
            {/* Referrable other-week strip — tap to jump, shows per-day status for quick reference */}
            <div style={{ marginBottom:12, padding:'8px 10px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:`1px solid ${T.border}`, display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', alignItems:'center' }}>
              <span style={{ fontSize:10, fontWeight:800, color:T.textSub, whiteSpace:'nowrap' }}>Other week:</span>
              {(weekData[weekIds[1-activeWeekIdx]] ? DAYS : []).map((d, idx)=>{
                const dk=d.substring(0,3).toLowerCase()
                const otherWid=weekIds[1-activeWeekIdx]
                const st=weekData[otherWid]?.[dk]
                const doneLocal=st && st.lunchWantsFood!==null && st.dinnerWantsFood!==null
                const row=existingMap[otherWid]
                const doneServer=row && row[`${dk}_l_status`] && row[`${dk}_d_status`]
                const done=doneLocal||doneServer
                const pending= !done && (st?.lunchWantsFood!==null || st?.dinnerWantsFood!==null)
                return (
                  <button key={d} onClick={()=>handleSelectDay(1-activeWeekIdx, idx)} style={{ flex:'0 0 auto', padding:'5px 8px', borderRadius:999, border:`1px solid ${done? '#10b981': pending? '#f59e0b' : T.border}`, background: done?'rgba(16,185,129,0.12)': pending?'rgba(245,158,11,0.10)':'transparent', color: done?'#10b981': pending?'#f59e0b':T.textSub, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                    {cap(d).substring(0,3)} {done?'✓': pending?'·': '○'}
                  </button>
                )
              })}
              <span style={{ marginLeft:'auto', fontSize:10, color:T.textSub, whiteSpace:'nowrap' }}>{weekFilled[weekIds[1-activeWeekIdx]]||0}/12</span>
            </div>
          </>
        )}

        {/* Day Navigation Tabs — scoped to active week only (6, not 12) */}
        <div style={{ display:'flex', gap:6, marginBottom:14, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
          {DAYS.map((d, idx)=>{
            const dk=d.substring(0,3).toLowerCase()
            const isCur = idx===currentDayIndex
            const dayLocal= weekData[activeWeekId]?.[dk]
            const isDoneLocal= dayLocal && dayLocal.lunchWantsFood!==null && dayLocal.dinnerWantsFood!==null
            const row=existingMap[activeWeekId]
            const isDoneServer= row && row[`${dk}_l_status`] && row[`${dk}_d_status`]
            const isDone=isDoneLocal||isDoneServer
            return (
              <button key={d} type="button" onClick={()=>handleSelectDay(activeWeekIdx, idx)}
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
                <div style={{ fontSize:15, fontWeight:800, color:T.text, fontFamily:"'Playfair Display',serif" }}>☀️ {currentDayName} Lunch <span style={{ fontSize:11, color:T.textSub, fontWeight:600 }}>· Week {activeWeekIdx+1}</span></div>
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
                <span style={{ fontSize:13, fontWeight:800, color:T.accent, fontFamily:"'DM Sans',sans-serif" }}>Lunch Dishes <span style={{ fontSize:10, color:T.textSub }}>· {formatWeekRange(activeWeekId)}</span></span>
                <div style={{ display:'flex', gap:6 }}>
                  <button type="button" onClick={()=>selectAll('lunch')} style={{ minHeight:32, padding:'4px 10px', borderRadius:8, border:`1px solid ${T.accent}`, background:T.accentBg, color:T.accent, fontSize:11, fontWeight:800, cursor:'pointer', touchAction:'manipulation' }}>All Yes</button>
                  <button type="button" onClick={()=>clearAll('lunch')} style={{ minHeight:32, padding:'4px 10px', borderRadius:8, border:`1px solid ${T.border}`, background:'transparent', color:T.textSub, fontSize:11, fontWeight:700, cursor:'pointer', touchAction:'manipulation' }}>Clear</button>
                </div>
              </div>
              {lunchDishes.length>0 ? lunchDishes.map((dish,idx)=>(<DishRow key={`lunch-${activeWeekId}-${dish}-${idx}`} dish={dish} idx={idx} mealType="lunch" value={lunchResponses[dish]} onChange={handleLunchDish} T={T} appSettings={liveAppSettings} currentDay={currentDay} snackDefaults={snackDefaults} />)) : (
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
                <div style={{ fontSize:15, fontWeight:800, color:T.text, fontFamily:"'Playfair Display',serif" }}>🌙 {currentDayName} Dinner <span style={{ fontSize:11, color:T.textSub, fontWeight:600 }}>· Week {activeWeekIdx+1}</span></div>
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
                <span style={{ fontSize:13, fontWeight:800, color:T.accent, fontFamily:"'DM Sans',sans-serif" }}>Dinner Dishes <span style={{ fontSize:10, color:T.textSub }}>· {formatWeekRange(activeWeekId)}</span></span>
                <div style={{ display:'flex', gap:6 }}>
                  <button type="button" onClick={()=>selectAll('dinner')} style={{ minHeight:32, padding:'4px 10px', borderRadius:8, border:`1px solid ${T.accent}`, background:T.accentBg, color:T.accent, fontSize:11, fontWeight:800, cursor:'pointer', touchAction:'manipulation' }}>All Yes</button>
                  <button type="button" onClick={()=>clearAll('dinner')} style={{ minHeight:32, padding:'4px 10px', borderRadius:8, border:`1px solid ${T.border}`, background:'transparent', color:T.textSub, fontSize:11, fontWeight:700, cursor:'pointer', touchAction:'manipulation' }}>Clear</button>
                </div>
              </div>
              {dinnerDishes.length>0 ? dinnerDishes.map((dish,idx)=>(<DishRow key={`dinner-${activeWeekId}-${dish}-${idx}`} dish={dish} idx={idx} mealType="dinner" value={dinnerResponses[dish]} onChange={handleDinnerDish} T={T} appSettings={liveAppSettings} currentDay={currentDay} snackDefaults={snackDefaults} />)) : (
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
              <ChevronLeft size={16}/> {cap(DAYS[Math.floor((globalIndex-1)/1)%6 <0?0: (globalIndex-1)%6]).substring(0,3)} {Math.floor((globalIndex-1)/6)!==activeWeekIdx?`·W${Math.floor((globalIndex-1)/6)+1}`:''}
            </button>
          )}
          {canGoNext ? (
            <button type="button" onClick={goToNextDay} disabled={loading || !isDayComplete}
              style={{ marginLeft: canGoPrev? 'auto': undefined, flex: canGoPrev?undefined:1, minHeight:48, padding:'13px 22px', borderRadius:12, border:'none', background: isDayComplete && !loading ? T.accentGrad : T.border, color: isDayComplete && !loading ? '#000' : 'rgba(0,0,0,0.35)', cursor: isDayComplete && !loading ? 'pointer' : 'not-allowed', fontSize:13.5, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:"'DM Sans',sans-serif", boxShadow: isDayComplete?`0 8px 20px ${T.accentBg}`:'none', opacity: isDayComplete?1:0.65, transition:'all 0.25s', touchAction:'manipulation' }}>
              💾 Save & Continue {(() => { const ng=globalIndex+1; const d=DAYS[ng%6]; const w=Math.floor(ng/6)+1; return `${cap(d)}${isTwoWeeks?` · W${w}`:''}` })()} <ChevronRight size={16}/>
            </button>
          ) : (
            <button type="button" onClick={handleSubmitWeekly} disabled={loading || !isDayComplete}
              style={{ marginLeft: canGoPrev? 'auto': undefined, flex: canGoPrev?undefined:1, minHeight:48, padding:'14px 24px', borderRadius:12, border:'none', background: isDayComplete && !loading ? 'linear-gradient(135deg,#10b981,#059669)' : T.border, color: isDayComplete && !loading ? '#fff' : 'rgba(0,0,0,0.35)', cursor: isDayComplete && !loading ? 'pointer' : 'not-allowed', fontSize:14, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:"'DM Sans',sans-serif", boxShadow: isDayComplete? '0 8px 24px rgba(16,185,129,0.35)':'none', opacity: isDayComplete?1:0.65, transition:'all 0.25s', touchAction:'manipulation' }}>
              {loading? 'Submitting…': `✅ Submit ${isTwoWeeks?`Fortnight (${totalSlots})`:'Weekly Survey'}`}
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
                  {submitResult.missingSlots.slice(0,24).map((s,i)=>(
                    <span key={`${s.weekId}-${s.day}-${s.meal}-${i}`} style={{ fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:100, background:'rgba(255,152,0,0.12)', color:'#FF9800' }}>{cap(s.day).substring(0,3)} {s.meal} · {formatWeekRange(s.weekId)}</span>
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
