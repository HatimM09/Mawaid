// src/App.jsx — Al-Mawaid Food Survey System — FIXED v5
// Member App + Khidmat Guzar Portal + Admin Bridge — fully linked

import React, {
  useState, useEffect, useRef, createContext, useContext, useCallback
} from 'react'
import { Navigate } from 'react-router-dom'
import {
  Home, FileText, User, X, Star, Camera, Check, LogOut,
  Mail, Lock, Eye, EyeOff, AlertCircle, ChevronDown, ChevronUp,
  ClipboardList, ChevronLeft, ChevronRight, Phone, MapPin,
  Users, Wallet, Bell, LifeBuoy, Info, MessageCircle, Upload, Utensils,
  Sun, Moon, Medal, Package, Shield, Menu, QrCode, MessageSquare, HelpCircle
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from './admin/supabaseClient'
import { useWeeklyMenu } from './common/useWeeklyMenu'
import { AuthCtx, ThemeCtx, useAuth, useTheme } from './admin/context'
import { updateSystemTheme, Skeleton, SoundUI } from './admin/ui'
import KhidmatPortal from './admin/KhidmatPortal'
import InventoryManagerPortal from './admin/InventoryManagerPortal'
import LoginPage from './LoginPage'
import PushManager from './lib/PushManager'
import { Toaster } from 'react-hot-toast'
const THEMES = {
  dark: {
    id: 'dark', name: 'Deep Topaz', icon: '🌾',
    bg: '#8B6B38', bgGrad: 'radial-gradient(ellipse at 50% 0%, #8B6B38 0%, #4A3A2C 70%)',
    card: 'rgba(74, 58, 44, 0.45)', cardActive: 'rgba(224, 160, 60, 0.08)',
    border: 'rgba(224, 160, 60, 0.2)', borderActive: 'rgba(224, 160, 60, 0.55)',
    accent: '#E0A03C', accentGrad: 'linear-gradient(135deg, #E0A03C, #B8860B)',
    accentBg: 'rgba(224, 160, 60, 0.12)', accentBorder: 'rgba(224, 160, 60, 0.4)',
    text: '#FFF8E7', textSub: 'rgba(255, 248, 231, 0.55)', textBody: '#E8DCC8',
    navBg: 'rgba(74, 58, 44, 0.98)', navBorder: 'rgba(224, 160, 60, 0.25)',
    geo: 'rgba(224, 160, 60, 0.05)', spinnerBorder: 'rgba(224, 160, 60, 0.2)', spinnerTop: '#E0A03C',
    inputBg: 'rgba(74, 58, 44, 0.5)', inputBorder: 'rgba(224, 160, 60, 0.25)',
    loginCard: 'rgba(74, 58, 44, 0.94)', headerWave: '#4A3A2C',
    successBg: 'rgba(16, 185, 129, 0.1)', successBorder: 'rgba(16, 185, 129, 0.3)', successText: '#34d399',
  },
  bright: {
    id: 'bright', name: 'Radiant Dawn', icon: '🌅',
    bg: '#fdfbf7', bgGrad: 'radial-gradient(circle at top right, #fdfbf7 0%, #f4eee1 100%)',
    card: '#ffffff', cardActive: '#faf6ec',
    border: '#e8ddc5', borderActive: '#c4a460',
    accent: '#b8860b', accentGrad: 'linear-gradient(135deg, #dfb44a, #b8860b)',
    accentBg: 'rgba(184, 134, 11, 0.08)', accentBorder: 'rgba(184, 134, 11, 0.3)',
    text: '#2d2416', textSub: '#706454', textBody: '#4a3d2e',
    navBg: 'rgba(253, 251, 247, 0.98)', navBorder: '#e8ddc5',
    geo: 'rgba(184, 134, 11, 0.04)', spinnerBorder: 'rgba(184, 134, 11, 0.2)', spinnerTop: '#b8860b',
    inputBg: '#ffffff', inputBorder: '#e0d4bc',
    loginCard: '#ffffff', headerWave: '#f4eee1',
    successBg: '#ecfdf5', successBorder: '#a7f3d0', successText: '#047857',
  },
  royal: {
    id: 'royal', name: 'Royal Gold & Black', icon: '👑',
    bg: '#050505', bgGrad: 'radial-gradient(ellipse at 30% 0%, #1a1308 0%, #050505 60%)',
    card: 'rgba(212, 175, 55, 0.04)', cardActive: 'rgba(212, 175, 55, 0.08)',
    border: 'rgba(212, 175, 55, 0.15)', borderActive: 'rgba(212, 175, 55, 0.5)',
    accent: '#F0C239', accentGrad: 'linear-gradient(135deg, #F0C239 0%, #D4A017 50%, #B8860B 100%)',
    accentBg: 'rgba(240, 194, 57, 0.08)', accentBorder: 'rgba(240, 194, 57, 0.35)',
    text: '#FAF3E0', textSub: 'rgba(250, 243, 224, 0.55)', textBody: '#E8DCC8',
    navBg: 'rgba(5, 5, 5, 0.97)', navBorder: 'rgba(212, 175, 55, 0.25)',
    geo: 'rgba(240, 194, 57, 0.04)', spinnerBorder: 'rgba(240, 194, 57, 0.2)', spinnerTop: '#F0C239',
    inputBg: 'rgba(240, 194, 57, 0.04)', inputBorder: 'rgba(212, 175, 55, 0.2)',
    loginCard: 'rgba(10, 8, 3, 0.92)', headerWave: '#050505',
    successBg: 'rgba(16, 185, 129, 0.1)', successBorder: 'rgba(16, 185, 129, 0.3)', successText: '#34d399',
  },
}

// ══════════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ══════════════════════════════════════════════════════════════
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// WEEKLY_MENU global removed to avoid invalid hook call. 
// Components will now call useWeeklyMenu() internally.

const getTodayKey = () => {
  const map = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' }
  return map[new Date().getDay()] || 'monday'
}

const isSurveyOpen = (settings, userId) => {
  if (settings?.survey_status === 'open') return true
  try {
    const accessMap = typeof settings?.user_day_access === 'string' ? JSON.parse(settings.user_day_access) : (settings?.user_day_access || {})
    const userMap = accessMap[userId] || {}
    // If user has any custom access granted for any day this week
    if (Object.values(userMap).some(meals => Array.isArray(meals) && meals.length > 0)) return true
  } catch (e) {}
  return false
}

const getSurveyWindowMessage = (settings) => {
  return settings?.survey_msg || 'Weekly survey is currently closed.'
}

const getWeekDate = () => {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  let diff = now.getDate() - day + (day === 0 ? -6 : 1)
  // If we are in the Saturday 8PM+ or Sunday window, we are filling for the Monday coming in next week
  if (day === 0 || (day === 6 && hour >= 20)) {
    diff += 7
  }
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

const isRotiItem = (dish) => {
  const rotiKeywords = ['roti', 'naan', 'paratha', 'bread', 'chapati', 'puri']
  return rotiKeywords.some(k => dish.toLowerCase().includes(k))
}

const mapDishToCol = (day, meal, dish) => {
  const d = day.substring(0, 3).toLowerCase()
  const m = meal === 'lunch' ? 'l' : 'd'
  const dishKey = dish.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)
  return `${d}_${m}_${dishKey}`
}

const getUserCustomAccess = (settings, userId) => {
  try {
    const accessMap = typeof settings?.user_day_access === 'string' 
      ? JSON.parse(settings.user_day_access) 
      : (settings?.user_day_access || {})
    const userMap = accessMap[userId] || {}
    const normalized = {}
    Object.keys(userMap).forEach(k => normalized[k.toLowerCase()] = userMap[k])
    return normalized
  } catch(e) { return {} }
}

const canEditMeal = (dayName, weekId, mealType, settings, userId) => {
  const day = dayName?.toLowerCase()
  if (!day) return false

  // 1. Specific User Access (Bypasses global windows for filling)
  const userAccess = getUserCustomAccess(settings, userId)
  if (userAccess[day]?.includes(mealType)) return true

  // 2. Global Weekly Window
  if (settings?.survey_status === 'open') return true
  
  // 3. Global Daily Window
  const statusKey = mealType === 'lunch' ? 'lunch_edit_status' : 'dinner_edit_status'
  return settings?.[statusKey] === 'open'
}


// ══════════════════════════════════════════════════════════════
// SHARED UI PRIMITIVES
// ══════════════════════════════════════════════════════════════


const GeoBg = ({ t: tProp }) => {
  const ctx = useTheme(); const t = tProp || ctx
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.7 }}>
      <defs>
        <pattern id="geo" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M24 2L46 24L24 46L2 24Z" fill="none" stroke={t.geo} strokeWidth="0.7" />
          <circle cx="24" cy="24" r="4.5" fill="none" stroke={t.geo} strokeWidth="0.5" />
          <circle cx="0" cy="0" r="2" fill={t.geo} /><circle cx="48" cy="0" r="2" fill={t.geo} />
          <circle cx="0" cy="48" r="2" fill={t.geo} /><circle cx="48" cy="48" r="2" fill={t.geo} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#geo)" />
    </svg>
  )
}

const Spinner = ({ fullPage = true }) => {
  if (fullPage) return (
    <div style={{ flex: 1, padding: 30, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Skeleton height={140} />
      <Skeleton height={80} />
      <Skeleton height={200} />
      <Skeleton height={100} />
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
       <Skeleton width={34} height={34} circle />
    </div>
  )
}

const ErrorBanner = ({ msg }) => (
  <div style={{ margin: '8px 0', padding: '11px 14px', borderRadius: 10, background: 'rgba(220,60,60,0.09)', border: '1px solid rgba(220,60,60,0.28)', color: '#e05555', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'DM Sans',sans-serif" }}>
    <AlertCircle size={14} style={{ flexShrink: 0 }} />{msg}
  </div>
)

const Avatar = ({ avatarUrl, name, email, size = 56 }) => {
  const t = useTheme()
  const initials = (name || email || 'U').charAt(0).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `2px solid ${t.accent}`, boxShadow: `0 4px 16px ${t.accentBg}` }}>
      {avatarUrl
        ? <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ width: '100%', height: '100%', background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 800, color: '#fff', fontFamily: "'Playfair Display',serif" }}>{initials}</div>
      }
    </div>
  )
}

const SectionLabel = ({ children }) => {
  const t = useTheme()
  return <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', color: t.textSub, textTransform: 'uppercase', marginBottom: 14, fontFamily: "'DM Sans',sans-serif", opacity: .7 }}>{children}</div>
}

function Card({ children, style = {}, active, organic }) {
  const t = useTheme()
  const organicStyle = organic ? {
    borderRadius: '32px 64px 32px 64px',
    background: `linear-gradient(145deg, ${active ? t.cardActive : t.card}, rgba(0,0,0,0.1))`,
  } : {
    borderRadius: 32,
    background: active ? t.cardActive : t.card,
  }

  return (
    <div style={{
      ...organicStyle,
      padding: '24px',
      border: `1px solid ${active ? t.borderActive : t.border}`,
      backdropFilter: 'blur(30px) saturate(2.5)',
      WebkitBackdropFilter: 'blur(30px) saturate(2.5)',
      boxShadow: `0 20px 40px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -2px 6px rgba(0,0,0,0.15)`,
      position: 'relative',
      overflow: 'hidden',
      ...style
    }}>
      {/* 3D Glossy Highlight */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)',
        pointerEvents: 'none'
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}

const Btn = ({ children, onClick, disabled, style: extra = {}, variant = 'primary' }) => {
  const t = useTheme()
  const baseStyle = {
    padding: '14px 24px', borderRadius: 16, border: 'none',
    fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'DM Sans', sans-serif", transition: 'all 0.3s ease',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: 'fit-content', opacity: disabled ? 0.5 : 1, fontSize: 16
  }
  const variants = {
    primary: { background: t.accentGrad, color: '#000', boxShadow: `0 4px 15px ${t.accentBg}` },
    outline: { background: 'transparent', color: t.accent, border: `1px solid ${t.border}` },
    ghost: { background: 'transparent', color: t.textSub }
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...baseStyle, ...variants[variant], ...extra }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {children}
    </button>
  )
}

const Badge = ({ children, color, style = {} }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', padding: '6px 12px',
    borderRadius: 10, fontSize: 12, fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.08em', background: `${color}15` || 'rgba(212, 175, 55, 0.1)',
    color: color || '#D4AF37', border: `1px solid ${color}30` || 'rgba(212, 175, 55, 0.25)',
    fontFamily: "'DM Sans', sans-serif", ...style
  }}>
    {children}
  </div>
)



const BackHeader = ({ title, onBack }) => {
  const t = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><ChevronLeft size={20} color={t.accent} /></button>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif" }}>{title}</h2>
    </div>
  )
}

const EmptyState = ({ msg }) => {
  const t = useTheme()
  return <div style={{ textAlign: 'center', padding: 60, color: t.textSub, fontSize: 18, fontFamily: "'DM Sans',sans-serif" }}>{msg}</div>
}

const GlobalStyles = () => {
  const t = useTheme()
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@400;500;600;700;800&family=Amiri:wght@400;700&family=Outfit:wght@400;600;700;800&display=swap');
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
      .spin { animation: spin 0.8s linear infinite; }
      * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
      body { background: ${t.bg}; color: ${t.text}; margin: 0; transition: background 0.3s ease; }
      
      /* Modern Scrollbar */
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${t.borderActive}; border-radius: 10px; }
      ::-webkit-scrollbar-thumb:hover { background: ${t.accent}; }

      .mobile-bottom-nav {
        position: fixed; 
        bottom: calc(16px + env(safe-area-inset-bottom, 0px)); 
        left: 50%; 
        transform: translateX(-50%);
        width: min(480px, calc(100% - 24px));
        height: 68px;
        background: ${t.navBg || 'rgba(15, 20, 30, 0.85)'};
        backdrop-filter: blur(28px) saturate(2);
        -webkit-backdrop-filter: blur(28px) saturate(2);
        border: 1px solid ${t.accentBorder || 'rgba(212, 175, 55, 0.3)'};
        display: flex; align-items: center; justify-content: space-around;
        padding: 0 4px;
        z-index: 9000;
        border-radius: 22px;
        box-shadow: 0 25px 50px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.1);
        transition: all 0.3s ease;
      }
      .mobile-bottom-nav button {
        flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: none; border: none; cursor: pointer; color: ${t.textSub};
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        height: 100%;
        position: relative;
        padding-top: 4px;
      }
      .mobile-bottom-nav button.active { 
        color: ${t.accent}; 
      }
      .mobile-bottom-nav button div {
        width: 40px; height: 40px; border-radius: 14px;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .mobile-bottom-nav button.active div { 
        background: ${t.accentGrad}; 
        color: #000;
        box-shadow: 0 10px 20px ${t.accent}50;
        transform: translateY(-8px) scale(1.1);
        border-radius: 16px;
      }
      .mobile-bottom-nav button span {
        font-size: 9px; font-weight: 800; text-transform: uppercase;
        margin-top: 2px; opacity: 0.6; letter-spacing: 0.08em;
        transition: all 0.3s;
      }
      .mobile-bottom-nav button.active span {
        transform: translateY(-4px);
        opacity: 1;
        color: ${t.accent};
        font-weight: 900;
      }
      
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: 12px;
      }
      @media (max-width: 400px) {
        .stats-grid { grid-template-columns: repeat(2, 1fr); }
      }
      .scroll-touch { -webkit-overflow-scrolling: touch; }
    `}</style>
  )
}

// ══════════════════════════════════════════════════════════════
// SURVEY MODAL
// ══════════════════════════════════════════════════════════════
function SurveyModal({ startDay, onClose, appSettings, userStats }) {
  const t = THEMES.bright
  const { user } = useAuth()
  const weeklyMenu = useWeeklyMenu() || {}

  const currentWeekId = getWeekDate()
  
  // Filter days based on user specific access
  const visibleDays = React.useMemo(() => {
    const userAccess = getUserCustomAccess(appSettings, user.id)
    const userDays = Object.keys(userAccess).filter(d => Array.isArray(userAccess[d]) && userAccess[d].length > 0)
    if (userDays.length > 0) {
      return DAYS.filter(d => userDays.includes(d.toLowerCase()))
    }
    return DAYS
  }, [appSettings, user.id])

  const [currentDay, setCurrentDay] = useState(() => {
    if (startDay && visibleDays.includes(startDay.toLowerCase())) return startDay.toLowerCase()
    return visibleDays[0] || 'monday'
  })

  // Keep in sync if visibleDays changes (e.g. after settings load)
  useEffect(() => {
    if (currentDay && !visibleDays.includes(currentDay)) {
      setCurrentDay(visibleDays[0] || 'monday')
    }
  }, [visibleDays])
  const [currentMeal, setCurrentMeal] = useState('lunch')
  const [wantsFood, setWantsFood] = useState(null)
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(false)
  const [existingResponse, setExistingResponse] = useState(null)

  const [userData, setUserData] = useState({ thali_no: '', email: user.email })
  const currentDayIndexInVisible = visibleDays.indexOf(currentDay)
  const menu = weeklyMenu[currentDay] || { lunch: [], dinner: [] }
  const dayKey = currentDay.substring(0, 3).toLowerCase()
  const mealKey = currentMeal === 'lunch' ? 'l' : 'd'
  const isEditable = canEditMeal(currentDay, currentWeekId, currentMeal, appSettings, user.id, user?.email, userStats?.thali_number)
  const editCount = (existingResponse && !existingResponse.is_template) ? (existingResponse.edit_metadata?.[`${dayKey}_${mealKey}`] || 0) : 0
  const editLimit = parseInt(appSettings?.edit_limit) || 2

  // Get allowed meals for current day
  const dayMeals = React.useMemo(() => {
    const userAccess = getUserCustomAccess(appSettings, user.id)
    const meals = userAccess[currentDay.toLowerCase()] || []
    const hasAnyCustom = Object.keys(userAccess).some(k => Array.isArray(userAccess[k]) && userAccess[k].length > 0)
    if (hasAnyCustom) return meals
    return ['lunch', 'dinner']
  }, [appSettings, user.id, currentDay])

  const isUserAllowed = React.useMemo(() => {
    const userAccess = getUserCustomAccess(appSettings, user.id)
    return Object.keys(userAccess).some(k => Array.isArray(userAccess[k]) && userAccess[k].length > 0)
  }, [appSettings, user.id])

  const responseExists = !!(existingResponse && !existingResponse.is_template && existingResponse[`${dayKey}_${mealKey}_status`])
  const editBlocked = !isEditable || (responseExists && appSettings?.allow_edits !== 'true' && !isUserAllowed)

  useEffect(() => {
    if (dayMeals.length > 0 && !dayMeals.includes(currentMeal)) {
      setCurrentMeal(dayMeals[0])
    }
  }, [currentDay, dayMeals])

  useEffect(() => { loadExisting() }, [currentDay, currentMeal])

  const loadExisting = async () => {
    try {
      if (!userData.thali_no) {
        const { data: u } = await supabase.from('user_stats').select('thali_number, email').eq('user_id', user.id).maybeSingle()
        if (u) setUserData({ thali_no: u.thali_number || '', email: u.email || user.email })
      }

      const { data } = await supabase.from('survey_submissions_flat')
        .select('*').eq('user_id', user.id).order('week_id', { ascending: false }).limit(1).maybeSingle()

      if (data) {
        const currentWeekId = getWeekDate()
        const isFromOldWeek = data.week_id !== currentWeekId
        const dayKey = currentDay.substring(0, 3).toLowerCase()
        const mealKey = currentMeal === 'lunch' ? 'l' : 'd'
        const status = data[`${dayKey}_${mealKey}_status`]
        setExistingResponse({ ...data, is_template: isFromOldWeek })

        if (status && !isFromOldWeek) {
          setWantsFood(status === 'Applied')
          const activeDishes = menu[currentMeal] || []
          const dishRes = {}
          activeDishes.forEach((dish, idx) => {
            const val = data[`${dayKey}_${mealKey}_dish_${idx + 1}`]
            if (val !== undefined && val !== null) {
              if (val === 'Yes') dishRes[dish] = 'yes'
              else if (val === 'No') dishRes[dish] = 'no'
              else if (typeof val === 'string' && val.includes('Skip')) dishRes[dish] = 'Skipped'
              else dishRes[dish] = parseInt(val) || 0
            }
          })
          setResponses(dishRes)
        } else {
          setWantsFood(null); setResponses({})
        }
      } else {
        setExistingResponse(null); setWantsFood(null); setResponses({})
      }
    } catch (err) {
      console.error('Error loading survey:', err)
    }
  }

  const autoSave = async (newWantsFood, newResponses) => {
    if (newWantsFood === null || editBlocked) return
    
    try {
      const dayKey = currentDay.substring(0, 3).toLowerCase()
      const mealKey = currentMeal === 'lunch' ? 'l' : 'd'
      const currentEdits = (existingResponse && !existingResponse.is_template) ? (existingResponse.edit_metadata || {}) : {}
      const newEditCount = (currentEdits[`${dayKey}_${mealKey}`] || 0) + (existingResponse && !existingResponse.is_template ? 1 : 0)

      const currentWeekId = getWeekDate()
      const updateObj = {
        user_id: user.id,
        week_id: currentWeekId,
        thali_number: userData.thali_no,
        email: userData.email,
        [`${dayKey}_${mealKey}_status`]: newWantsFood ? 'Applied' : 'Skipped',
        edit_metadata: { ...currentEdits, [`${dayKey}_${mealKey}`]: newEditCount },
        updated_at: new Date().toISOString()
      }

      if (newWantsFood) {
        const activeDishes = menu[currentMeal] || []
        activeDishes.forEach((dish, idx) => {
          const colName = `${dayKey}_${mealKey}_dish_${idx + 1}`
          const val = newResponses[dish]
          if (val !== undefined) {
            updateObj[colName] = val === 'yes' ? 'Yes' : val === 'no' ? 'No' : `${val}%`
          }
        })
      }

      await supabase.from('survey_submissions_flat').upsert([updateObj], { onConflict: 'user_id,week_id' })
      
      // Update local state to reflect the new edit count and that it's no longer a template
      if (!existingResponse || existingResponse.is_template) {
        await supabase.rpc('increment_user_surveys', { p_user_id: user.id })
      }
      // Re-fetch to get latest metadata
      const { data: refreshed } = await supabase.from('survey_submissions_flat').select('*').eq('user_id', user.id).eq('week_id', currentWeekId).maybeSingle()
      if (refreshed) setExistingResponse(refreshed)

    } catch (err) {
      console.error('Auto-save error:', err)
    }
  }

  const handleResponseChange = (dish, val) => {
    const nextResponses = { ...responses, [dish]: val }
    setResponses(nextResponses)
    autoSave(wantsFood, nextResponses)
  }

  const handleStatusChange = (status) => {
    setWantsFood(status)
    autoSave(status, responses)
    if (!status) setTimeout(handleNext, 400)
  }

  const goToDay = (day) => {
    setCurrentDay(day); setCurrentMeal('lunch'); setWantsFood(null); setResponses({})
  }

  const handleNext = () => {
    const access = dayMeals 
    if (currentMeal === 'lunch' && access.includes('dinner')) {
      setCurrentMeal('dinner'); setWantsFood(null); setResponses({})
    } else if (currentDayIndexInVisible < visibleDays.length - 1) {
      const nextDay = visibleDays[currentDayIndexInVisible + 1]
      let nextDayAccess = ['lunch', 'dinner']
      try {
        const accessMap = JSON.parse(appSettings?.user_day_access || '{}')
        nextDayAccess = accessMap[user.id]?.[nextDay] || ['lunch', 'dinner']
      } catch(e) {}
      
      setCurrentDay(nextDay)
      setCurrentMeal(nextDayAccess.includes('lunch') ? 'lunch' : 'dinner')
      setWantsFood(null); setResponses({})
    } else {
      if (existingResponse?.is_template) {
        supabase.from('survey_submissions_flat').delete().eq('user_id', user.id).eq('week_id', existingResponse.week_id).then(() => {})
      }
      alert('🎉 Survey auto-saved! Shukran Jazeelan.')
      onClose()
    }
  }

  const handlePrev = () => {
    if (currentMeal === 'dinner') {
      setCurrentMeal('lunch'); setWantsFood(null); setResponses({})
    } else if (currentDayIndexInVisible > 0) {
      setCurrentDay(visibleDays[currentDayIndexInVisible - 1]); setCurrentMeal('dinner'); setWantsFood(null); setResponses({})
    }
  }


  const dishes = currentMeal === 'lunch' ? menu.lunch : menu.dinner
  const isFirst = currentDayIndexInVisible === 0 && (currentMeal === 'lunch' || !dayMeals.includes('lunch'))
  const isLast = currentDayIndexInVisible === visibleDays.length - 1 && (currentMeal === 'dinner' || !dayMeals.includes('dinner'))
  const progress = ((currentDayIndexInVisible * 2 + (currentMeal === 'lunch' ? 1 : 2)) / (visibleDays.length * 2)) * 100

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.82)', padding: 16, backdropFilter: 'blur(12px)', overflowY: 'auto' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: 32, padding: 22, maxWidth: 500, width: '100%', border: `1px solid ${t.borderActive}`, boxShadow: '0 28px 70px rgba(0,0,0,0.55)', maxHeight: '92vh', overflowY: 'auto', paddingBottom: 40 }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: t.inputBg, borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: t.accentGrad, borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>

        {/* Day pills */}
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 14, paddingBottom: 2, scrollbarWidth: 'none' }}>
          {visibleDays.map(day => (
            <button key={day} onClick={() => goToDay(day)}
              style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${currentDay === day ? t.accent : t.border}`, background: currentDay === day ? t.accentBg : 'transparent', color: currentDay === day ? t.accent : t.textSub, fontWeight: 700, fontSize: 10, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
              {weeklyMenu[day]?.en?.slice(0, 3) || day.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="/al-mawaid.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif" }}>{menu.en || currentDay}</h2>
            </div>
            <div style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginTop: 3 }}>
              {currentMeal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}<span style={{ margin: '0 6px', opacity: .3 }}>·</span>
              <span style={{ fontFamily: "'Amiri',serif", fontSize: 14 }}>{menu.ar}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} color={t.textSub} /></button>
        </div>

        {editBlocked && (
          <div style={{ marginBottom: 12, padding: 11, borderRadius: 10, background: 'rgba(220,140,40,0.10)', border: '1px solid rgba(220,140,40,0.28)', color: '#d4882a', fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
            {!isEditable ? `⚠️ This meal is locked by Admin — view only.` : `⚠️ Edit limit reached (${editLimit} times) — view only.`}
          </div>
        )}

        {/* Prev / Next */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={handlePrev} disabled={isFirst}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'transparent', color: isFirst ? t.border : t.textSub, fontSize: 13, fontWeight: 600, cursor: isFirst ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: "'DM Sans',sans-serif" }}>
            <ChevronLeft size={13} /> Prev
          </button>
          <button onClick={handleNext} disabled={loading}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: `1px solid ${t.accent}`, background: t.accentBg, color: t.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: "'DM Sans',sans-serif" }}>
            {isLast ? 'Finish ✓' : 'Next'} {!isLast && <ChevronRight size={13} />}
          </button>
        </div>

        {/* Content */}
        {editBlocked ? (
          <div style={{ padding: 14, background: t.inputBg, borderRadius: 12, border: `1px solid ${t.border}` }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{wantsFood ? 'Responded: Yes' : 'Responded: No (skipped)'}</p>
            {wantsFood && Object.entries(responses).map(([dish, val]) => (
              <div key={dish} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{dish}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>
                  {val === 'yes' ? '✅' : val === 'no' ? '❌' : (val === 0 ? '0%' : (val === 'Skipped' ? 'SKIP' : `${val}%`))}
                </span>
              </div>
            ))}
          </div>
        ) : wantsFood === null ? (
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 14, fontFamily: "'DM Sans',sans-serif" }}>
              Do you want {currentMeal} for {menu.en || currentDay}?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="stagger-item" onClick={() => handleStatusChange(true)}
                style={{ flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${t.accent}`, background: t.accentBg, color: t.accent, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>✅ Yes</button>
              <button className="stagger-item" onClick={() => handleStatusChange(false)}
                style={{ flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>❌ No</button>
            </div>
          </div>
        ) : wantsFood ? (
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 10, fontFamily: "'DM Sans',sans-serif" }}>Select portion for each dish:</p>
            {dishes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: t.inputBg, borderRadius: 16, border: `1px solid ${t.border}`, marginBottom: 16 }}>
                <Utensils size={24} color={t.textSub} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ margin: 0, fontSize: 14, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>No dishes listed for this meal.</p>
              </div>
            ) : dishes.map((dish, idx) => (
              <div key={dish} className="stagger-item" style={{ marginBottom: 10, padding: 12, background: t.inputBg, borderRadius: 11, animationDelay: `${0.1 + idx * 0.05}s` }}>
                <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{dish}</p>
                {isRotiItem(dish) ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['yes', 'no'].map(opt => (
                      <button key={opt} onClick={() => handleResponseChange(dish, opt)}
                        style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: `1.5px solid ${responses[dish] === opt ? (opt === 'yes' ? t.accent : '#e05555') : t.border}`, background: responses[dish] === opt ? (opt === 'yes' ? t.accentBg : 'rgba(220,80,80,0.09)') : 'transparent', color: responses[dish] === opt ? (opt === 'yes' ? t.accent : '#e05555') : t.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                        {opt === 'yes' ? '✅ Yes' : '❌ No'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {[0, 25, 50, 100].map(pct => (
                      <button key={pct} onClick={() => handleResponseChange(dish, pct)}
                        style={{ padding: '16px 4px', borderRadius: 14, border: `2px solid ${responses[dish] === pct ? t.accent : t.border}`, background: responses[dish] === pct ? t.accentBg : 'transparent', color: responses[dish] === pct ? t.accent : t.text, fontSize: 18, fontWeight: 800, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: '0.2s' }}>
                        {pct}%
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button onClick={handleNext} disabled={loading || Object.keys(responses).length < dishes.length}
              style={{ width: '100%', padding: 13, borderRadius: 11, border: 'none', marginTop: 6, background: Object.keys(responses).length < dishes.length ? t.border : t.accentGrad, color: '#fff', fontSize: 14, fontWeight: 700, cursor: Object.keys(responses).length < dishes.length ? 'not-allowed' : 'pointer', opacity: Object.keys(responses).length < dishes.length ? .5 : 1, fontFamily: "'DM Sans',sans-serif" }}>
              {isLast ? 'Complete Survey ✓' : 'Save & Next →'}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>Skipping this meal…</div>
        )}

      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// DAILY SURVEY MODAL (NEW)
// ══════════════════════════════════════════════════════════════
function DailySurveyModal({ onClose, appSettings, userStats }) {
  const t = THEMES.bright
  const { user } = useAuth()
  const weeklyMenu = useWeeklyMenu() || {}
  const [step, setStep] = useState(1) // 1: Lunch Yes/No, 2: Lunch Dishes, 3: Dinner Yes/No, 4: Roti (if any), 5: Dinner Dishes
  const [lunchStatus, setLunchStatus] = useState(null) // true/false
  const [dinnerStatus, setDinnerStatus] = useState(null) // true/false
  const [rotiStatus, setRotiStatus] = useState(null) // true/false
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(false)
  const [userData, setUserData] = useState({ thali_no: '', email: user.email })
  const [existingResponse, setExistingResponse] = useState(null)

  const today = getTodayKey()
  const menu = weeklyMenu[today] || { lunch: [], dinner: [] }
  const dayKey = today.substring(0, 3).toLowerCase()
  const currentWeekId = getWeekDate()

  const isLunchEditable = canEditMeal(today, currentWeekId, 'lunch', appSettings, user.id, user?.email, userStats?.thali_number)
  const isDinnerEditable = canEditMeal(today, currentWeekId, 'dinner', appSettings, user.id, user?.email, userStats?.thali_number)
  const editLimit = parseInt(appSettings?.edit_limit) || 2

  const dayMeals = React.useMemo(() => {
    const userAccess = getUserCustomAccess(appSettings, user.id)
    const meals = userAccess[today.toLowerCase()] || []
    
    // If user has specific access for today, use that
    if (meals.length > 0) return meals
    
    // If no specific access, check if global daily windows are open
    const globalMeals = []
    if (appSettings?.lunch_edit_status === 'open') globalMeals.push('lunch')
    if (appSettings?.dinner_edit_status === 'open') globalMeals.push('dinner')
    
    if (globalMeals.length > 0) return globalMeals

    // If global weekly is open, show both
    if (appSettings?.survey_status === 'open') return ['lunch', 'dinner']

    return [] // Default to empty if nothing is open
  }, [appSettings, user.id, today])

  useEffect(() => {
    if (dayMeals.length > 0 && !dayMeals.includes('lunch')) {
      if (dayMeals.includes('dinner')) setStep(3)
    }
  }, [dayMeals])

  useEffect(() => {
    supabase.from('user_stats').select('thali_number, email').eq('user_id', user.id).single()
      .then(({ data }) => { if (data) setUserData({ thali_no: data.thali_number || '', email: data.email || user.email }) })
    
    supabase.from('survey_submissions_flat').select('*').eq('user_id', user.id).eq('week_id', currentWeekId).maybeSingle()
      .then(({ data }) => {
        setExistingResponse(data)
        if (data) {
          if (data[`${dayKey}_l_status`]) {
            setLunchStatus(data[`${dayKey}_l_status`] === 'Applied')
            const res = {}
            menu.lunch.forEach((d, i) => {
              const val = data[`${dayKey}_l_dish_${i+1}`]
              if (val) res[d] = parseInt(val) || (val === 'Yes' ? 'yes' : 'no')
            })
            setResponses(prev => ({ ...prev, ...res }))
          }
          if (data[`${dayKey}_d_status`]) {
            setDinnerStatus(data[`${dayKey}_d_status`] === 'Applied')
            const res = {}
            const dinnerDishes = menu.dinner || []
            dinnerDishes.forEach((d, i) => {
              const val = data[`${dayKey}_d_dish_${i+1}`]
              if (val) {
                if (isRotiItem(d)) setRotiStatus(val === 'Yes')
                else res[d] = parseInt(val) || (val === 'Yes' ? 'yes' : 'no')
              }
            })
            setResponses(prev => ({ ...prev, ...res }))
          }
        }
      })
  }, [user.id])

  const lunchEditCount = existingResponse?.edit_metadata?.[`${dayKey}_l`] || 0
  const dinnerEditCount = existingResponse?.edit_metadata?.[`${dayKey}_d`] || 0
  const lunchExists = !!(existingResponse && existingResponse[`${dayKey}_l_status`])
  const dinnerExists = !!(existingResponse && existingResponse[`${dayKey}_d_status`])
  
  const isLunchAllowed = getUserCustomAccess(appSettings, user.id)[today.toLowerCase()]?.includes('lunch')
  const isDinnerAllowed = getUserCustomAccess(appSettings, user.id)[today.toLowerCase()]?.includes('dinner')

  const lunchBlocked = !isLunchEditable || (lunchExists && appSettings?.allow_edits !== 'true' && !isLunchAllowed)
  const dinnerBlocked = !isDinnerEditable || (dinnerExists && appSettings?.allow_edits !== 'true' && !isDinnerAllowed)

  const dinnerDishes = menu.dinner || []
  const rotiItems = dinnerDishes.filter(d => isRotiItem(d))
  const otherDinnerDishes = dinnerDishes.filter(d => !isRotiItem(d))

  const autoSave = async (overrides = {}) => {
    // Collect latest state including overrides
    const s = {
      lunch: overrides.lunchStatus !== undefined ? overrides.lunchStatus : lunchStatus,
      dinner: overrides.dinnerStatus !== undefined ? overrides.dinnerStatus : dinnerStatus,
      roti: overrides.rotiStatus !== undefined ? overrides.rotiStatus : rotiStatus,
      res: overrides.responses || responses
    }

    try {
      const currentWeekId = getWeekDate()
      
      // Fetch current metadata to update edit count
      const { data: current } = await supabase.from('survey_submissions_flat').select('edit_metadata').eq('user_id', user.id).eq('week_id', currentWeekId).maybeSingle()
      const currentEdits = current?.edit_metadata || {}
      
      // We increment edit count if this is an explicit update to an existing meal
      // For simplicity, we'll just track if we are changing something
      const newEdits = { ...currentEdits }
      if (overrides.lunchStatus !== undefined) newEdits[`${dayKey}_l`] = (newEdits[`${dayKey}_l`] || 0) + 1
      if (overrides.dinnerStatus !== undefined) newEdits[`${dayKey}_d`] = (newEdits[`${dayKey}_d`] || 0) + 1

      const updateObj = {
        user_id: user.id,
        week_id: currentWeekId,
        thali_number: userData.thali_no,
        email: userData.email,
        [`${dayKey}_l_status`]: s.lunch === null ? null : (s.lunch ? 'Applied' : 'Skipped'),
        [`${dayKey}_d_status`]: s.dinner === null ? null : (s.dinner ? 'Applied' : 'Skipped'),
        edit_metadata: newEdits,
        updated_at: new Date().toISOString()
      }

      if (s.lunch) {
        menu.lunch.forEach((dish, idx) => {
          const colName = `${dayKey}_l_dish_${idx + 1}`
          const val = s.res[dish]
          if (val !== undefined) updateObj[colName] = typeof val === 'number' ? `${val}%` : val === 'yes' ? 'Yes' : 'No'
        })
      }
      if (s.dinner) {
        rotiItems.forEach((dish, idx) => {
          const menuIdx = dinnerDishes.indexOf(dish)
          const realColName = `${dayKey}_d_dish_${menuIdx + 1}`
          updateObj[realColName] = s.roti ? 'Yes' : 'No'
        })
        otherDinnerDishes.forEach((dish) => {
          const menuIdx = dinnerDishes.indexOf(dish)
          const realColName = `${dayKey}_d_dish_${menuIdx + 1}`
          const val = s.res[dish]
          if (val !== undefined) updateObj[realColName] = typeof val === 'number' ? `${val}%` : val === 'yes' ? 'Yes' : 'No'
        })
      }

      await supabase.from('survey_submissions_flat').upsert([updateObj], { onConflict: 'user_id,week_id' })
    } catch (err) {
      console.error('Daily auto-save error:', err)
    }
  }

  const handleStatusSelect = (type, val) => {
    if (type === 'lunch') {
      setLunchStatus(val)
      autoSave({ lunchStatus: val })
      setTimeout(() => {
        if (val) {
          if (menu.lunch && menu.lunch.length > 0) setStep(2)
          else if (dayMeals.includes('dinner')) setStep(3)
          else { alert('🎉 Daily Survey auto-saved!'); onClose() }
        }
        else if (dayMeals.includes('dinner')) setStep(3)
        else { alert('🎉 Daily Survey auto-saved!'); onClose() }
      }, 400)
    } else if (type === 'dinner') {
      setDinnerStatus(val)
      autoSave({ dinnerStatus: val })
      if (!val) {
        setTimeout(() => { alert('🎉 Daily Survey auto-saved!'); onClose() }, 400)
      } else {
        setTimeout(() => {
          if (rotiItems.length > 0) setStep(4)
          else if (otherDinnerDishes.length > 0) setStep(5)
          else { alert('🎉 Daily Survey auto-saved!'); onClose() }
        }, 400)
      }
    } else if (type === 'roti') {
      setRotiStatus(val)
      autoSave({ rotiStatus: val })
      setTimeout(() => {
        if (otherDinnerDishes.length > 0) setStep(5)
        else { alert('🎉 Daily Survey auto-saved!'); onClose() }
      }, 400)
    }
  }

  const handlePortionSelect = (dish, val) => {
    const nextRes = { ...responses, [dish]: val }
    setResponses(nextRes)
    autoSave({ responses: nextRes })
  }

  const handleNext = () => {
    if (step === 1) {
      if (lunchStatus === null) return
      if (lunchStatus) setStep(2)
      else if (dayMeals.includes('dinner')) setStep(3)
      else { alert('🎉 Daily Survey auto-saved!'); onClose() }
    } else if (step === 2) {
      if (Object.keys(responses).filter(k => menu.lunch.includes(k)).length < menu.lunch.length) return
      if (dayMeals.includes('dinner')) setStep(3)
      else { alert('🎉 Daily Survey auto-saved!'); onClose() }
    } else if (step === 3) {
      if (dinnerStatus === null) return
      if (!dinnerStatus) onClose()
      else setStep(rotiItems.length > 0 ? 4 : 5)
    } else if (step === 4) {
      if (rotiStatus === null) return
      setStep(5)
    } else if (step === 5) {
      const dinnerDishesToCheck = otherDinnerDishes
      if (Object.keys(responses).filter(k => dinnerDishesToCheck.includes(k)).length < dinnerDishesToCheck.length) return
      alert('🎉 Daily Survey auto-saved!')
      onClose()
    }
  }


  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: 'clamp(12px, 3vw, 24px)', backdropFilter: 'blur(15px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: 32, padding: 'clamp(18px, 4vw, 32px)', maxWidth: 500, width: '100%', border: `1.5px solid ${t.borderActive}`, boxShadow: '0 30px 80px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto', paddingBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display',serif" }}>Daily Food Survey</div>
              <div style={{ fontSize: 11, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{today} • {userData.thali_no ? `Thali #${userData.thali_no}` : 'Loading...'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5 }}><X size={20} color={t.textSub} /></button>
        </div>

        <div style={{ minHeight: 200 }}>
          {step === 1 && isLunchEditable && dayMeals.includes('lunch') && (
            <div className="stagger-item">
              <SectionLabel>Part 1: Lunch</SectionLabel>
              {lunchBlocked && (
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: 'rgba(220,140,40,0.1)', border: '1px solid rgba(220,140,40,0.2)', color: '#d4882a', fontSize: 12 }}>
                  {!isLunchEditable ? '⚠️ Lunch is locked by Admin — view only.' : `⚠️ Lunch edit limit reached (${editLimit} times) — view only.`}
                </div>
              )}
              <p style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 20 }}>Did you have lunch today?</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button disabled={lunchBlocked} onClick={() => handleStatusSelect('lunch', true)} style={{ flex: 1, padding: '16px', borderRadius: 16, border: `2px solid ${lunchStatus === true ? t.accent : t.border}`, background: lunchStatus === true ? t.accentBg : 'transparent', color: lunchStatus === true ? t.accent : t.textSub, fontSize: 16, fontWeight: 700, cursor: lunchBlocked ? 'not-allowed' : 'pointer', opacity: lunchBlocked ? 0.6 : 1 }}>✅ Yes</button>
                <button disabled={lunchBlocked} onClick={() => handleStatusSelect('lunch', false)} style={{ flex: 1, padding: '16px', borderRadius: 16, border: `2px solid ${lunchStatus === false ? '#e05555' : t.border}`, background: lunchStatus === false ? 'rgba(224,85,85,0.1)' : 'transparent', color: lunchStatus === false ? '#e05555' : t.textSub, fontSize: 16, fontWeight: 700, cursor: lunchBlocked ? 'not-allowed' : 'pointer', opacity: lunchBlocked ? 0.6 : 1 }}>❌ No</button>
              </div>
            </div>
          )}

          {step === 2 && isLunchEditable && dayMeals.includes('lunch') && (
            <div className="stagger-item">

              <SectionLabel>Lunch Portions</SectionLabel>
              {lunchBlocked && (
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: 'rgba(220,140,40,0.1)', border: '1px solid rgba(220,140,40,0.2)', color: '#d4882a', fontSize: 12 }}>
                  ⚠️ Lunch is locked - view only.
                </div>
              )}
              <div style={{ maxHeight: '40vh', overflowY: 'auto', paddingRight: 5 }}>
                {menu.lunch.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', background: t.inputBg, borderRadius: 16, border: `1px solid ${t.border}`, marginBottom: 16 }}>
                    <p style={{ margin: 0, fontSize: 14, color: t.textSub }}>No specific dishes listed. You can just skip this step or respond "Yes" to lunch.</p>
                  </div>
                ) : menu.lunch.map(dish => (
                  <div key={dish} style={{ marginBottom: 18, padding: 14, background: t.inputBg, borderRadius: 16, border: `1px solid ${t.border}` }}>
                    <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: t.text }}>{dish}</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[0, 25, 50, 100].map(pct => (
                        <button key={pct} disabled={lunchBlocked} onClick={() => handlePortionSelect(dish, pct)}
                          style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1.5px solid ${responses[dish] === pct ? t.accent : t.border}`, background: responses[dish] === pct ? t.accentBg : 'transparent', color: responses[dish] === pct ? t.accent : t.textSub, fontSize: 12, fontWeight: 800, cursor: lunchBlocked ? 'not-allowed' : 'pointer' }}>{pct}%</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && isDinnerEditable && dayMeals.includes('dinner') && (
            <div className="stagger-item">
              <SectionLabel>Part 2: Dinner</SectionLabel>
              {dinnerBlocked && (
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: 'rgba(220,140,40,0.1)', border: '1px solid rgba(220,140,40,0.2)', color: '#d4882a', fontSize: 12 }}>
                  {!isDinnerEditable ? '⚠️ Dinner is locked by Admin — view only.' : `⚠️ Dinner edit limit reached (${editLimit} times) — view only.`}
                </div>
              )}
              <p style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 20 }}>Will you have dinner tonight?</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button disabled={dinnerBlocked} onClick={() => handleStatusSelect('dinner', true)} style={{ flex: 1, padding: '16px', borderRadius: 16, border: `2px solid ${dinnerStatus === true ? t.accent : t.border}`, background: dinnerStatus === true ? t.accentBg : 'transparent', color: dinnerStatus === true ? t.accent : t.textSub, fontSize: 16, fontWeight: 700, cursor: dinnerBlocked ? 'not-allowed' : 'pointer', opacity: dinnerBlocked ? 0.6 : 1 }}>✅ Yes</button>
                <button disabled={dinnerBlocked} onClick={() => handleStatusSelect('dinner', false)} style={{ flex: 1, padding: '16px', borderRadius: 16, border: `2px solid ${dinnerStatus === false ? '#e05555' : t.border}`, background: dinnerStatus === false ? 'rgba(224,85,85,0.1)' : 'transparent', color: dinnerStatus === false ? '#e05555' : t.textSub, fontSize: 16, fontWeight: 700, cursor: dinnerBlocked ? 'not-allowed' : 'pointer', opacity: dinnerBlocked ? 0.6 : 1 }}>❌ No</button>
              </div>
            </div>
          )}


          {step === 4 && (
            <div className="stagger-item">
              <SectionLabel>Dinner: Roti</SectionLabel>
              <p style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>We have {rotiItems.join(', ')} tonight.</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: t.accent, marginBottom: 20 }}>Did you eat Roti?</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => handleStatusSelect('roti', true)} style={{ flex: 1, padding: '16px', borderRadius: 16, border: `2px solid ${rotiStatus === true ? t.accent : t.border}`, background: rotiStatus === true ? t.accentBg : 'transparent', color: rotiStatus === true ? t.accent : t.textSub, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>✅ Yes</button>
                <button onClick={() => handleStatusSelect('roti', false)} style={{ flex: 1, padding: '16px', borderRadius: 16, border: `2px solid ${rotiStatus === false ? '#e05555' : t.border}`, background: rotiStatus === false ? 'rgba(224,85,85,0.1)' : 'transparent', color: rotiStatus === false ? '#e05555' : t.textSub, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>❌ No</button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="stagger-item">
              <SectionLabel>Dinner Portions</SectionLabel>
              <div style={{ maxHeight: '40vh', overflowY: 'auto', paddingRight: 5 }}>
                {otherDinnerDishes.length === 0 ? (
                  <p style={{ fontSize: 14, color: t.textSub, textAlign: 'center', padding: '20px 0' }}>No additional dishes for dinner.</p>
                ) : otherDinnerDishes.map(dish => (
                  <div key={dish} style={{ marginBottom: 18, padding: 14, background: t.inputBg, borderRadius: 16, border: `1px solid ${t.border}` }}>
                    <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: t.text }}>{dish}</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[0, 25, 50, 100].map(pct => (
                        <button key={pct} disabled={dinnerBlocked} onClick={() => handlePortionSelect(dish, pct)}
                          style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1.5px solid ${responses[dish] === pct ? t.accent : t.border}`, background: responses[dish] === pct ? t.accentBg : 'transparent', color: responses[dish] === pct ? t.accent : t.textSub, fontSize: 12, fontWeight: 800, cursor: dinnerBlocked ? 'not-allowed' : 'pointer' }}>{pct}%</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
          {step > 1 && <button onClick={() => setStep(prev => prev === 5 && rotiItems.length === 0 ? 3 : prev - 1)} style={{ flex: 1, padding: 14, borderRadius: 14, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontWeight: 700, cursor: 'pointer' }}>Back</button>}
          <button onClick={handleNext} disabled={loading} style={{ flex: 2, padding: 14, borderRadius: 14, border: 'none', background: t.accentGrad, color: '#000', fontWeight: 900, cursor: 'pointer', boxShadow: `0 8px 20px ${t.accentBg}` }}>
            {loading ? 'Submitting...' : (step === 3 && !dinnerStatus) || step === 5 ? 'Submit Survey ✓' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// THALI USER APP
// ══════════════════════════════════════════════════════════════
function ThaliUserApp({ theme, setTheme }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('home')
  const [showSurvey, setShowSurvey] = useState(false)
  const [showDailySurvey, setShowDailySurvey] = useState(false)
  const t = THEMES[theme] || THEMES.dark
  const [unreadCount, setUnreadCount] = useState(0)
  const [toastNotice, setToastNotice] = useState(null)

  const [appSettings, setAppSettings] = useState({
    survey_status: 'closed',
    allow_edits: 'false',
    edit_limit: '2',
    deadline_override: 'false',
    survey_msg: '',
    user_day_access: '{}'
  })
   const [settingsLoading, setSettingsLoading] = useState(true)
   const [userStats, setUserStats] = useState(null)

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('app_settings').select('*').order('id', { ascending: true })
      if (data) {
        const s = {}
        data.forEach(r => { if (r.key) s[r.key] = r.value })
        setAppSettings(prev => ({ ...prev, ...s }))
      }
    }
    const fetchUserStats = async () => {
      if (!user) return
      const { data } = await supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle()
      if (data) setUserStats(data)
    }
    const loadAll = async () => {
      await Promise.all([fetchSettings(), fetchUserStats()])
      setSettingsLoading(false)
    }
    loadAll()

    const channel = supabase.channel('settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => fetchSettings())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const surveyOpen = isSurveyOpen(appSettings, user?.id)
  const isAnyMealEditable = canEditMeal(getTodayKey(), getWeekDate(), 'lunch', appSettings, user?.id) || 
                           canEditMeal(getTodayKey(), getWeekDate(), 'dinner', appSettings, user?.id)

  // --- DEEP LINKING SUPPORT ---
  useEffect(() => {
    if (!settingsLoading && user) {
      const params = new URLSearchParams(window.location.search)
      if (params.get('openSurvey') === 'true') {
        const day = params.get('day')
        
        if (surveyOpen) {
          setShowSurvey(true)
          window.history.replaceState({}, '', window.location.pathname)
        } else if (isAnyMealEditable) {
          setShowDailySurvey(true)
          window.history.replaceState({}, '', window.location.pathname)
        }
      }
    }
  }, [settingsLoading, user, surveyOpen, isAnyMealEditable])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const loadUnread = async () => {
      if (!user) return
      const lastRead = localStorage.getItem('almawaid_last_notice_read') || '1970-01-01T00:00:00.000Z'
      const { count, error } = await supabase
        .from('notices')
        .select('*', { count: 'exact', head: true })
        .or(`target_user_id.is.null,target_user_id.eq.${user.id}`)
        .gt('created_at', lastRead)

      if (!error) setUnreadCount(count || 0)
    }
    loadUnread()

    const channel = supabase
      .channel('global-notices')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' }, (payload) => {
        const notice = payload.new
        const isForMe = !notice.target_user_id || notice.target_user_id === user?.id

        if (isForMe) {
          setToastNotice(notice)
          setUnreadCount(prev => prev + 1)
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notice.title || 'Al-Mawaid Alert', {
              body: notice.body || '', icon: '/al-mawaid.png', badge: '/al-mawaid.png'
            })
          }
          setTimeout(() => setToastNotice(null), 8000)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  const markNotificationsRead = useCallback(() => {
    localStorage.setItem('almawaid_last_notice_read', new Date().toISOString())
    setUnreadCount(0)
  }, [])

  const handleSetTheme = (id) => { setTheme(id); localStorage.setItem('almawaid_theme', id) }

  const LogoIcon = ({ size = 20, style = {} }) => (
    <img src="/al-mawaid.png" alt="" style={{ width: size, height: size, objectFit: 'contain', ...style }} />
  )
  const tabs = [
    { id: 'home', label: 'Home', Icon: Home },
    { id: 'menu', label: 'Menu', Icon: Utensils },
    { id: 'post', label: 'Requests', Icon: FileText },
    { id: 'profile', label: 'Profile', Icon: User },
  ]
  const tabLabels = { home: 'AL-MAWAID', menu: 'WEEKLY MENU', survey: 'DAILY SURVEY', post: 'REQUESTS', profile: 'PROFILE' }

  return (
    <ThemeCtx.Provider value={t}>
      <div style={{ fontFamily: "'DM Sans','Segoe UI',-apple-system,sans-serif", minHeight: '100dvh', background: t.bgGrad, color: t.text, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        <header style={{ position: 'relative', overflow: 'hidden', background: t.bgGrad, padding: 'calc(env(safe-area-inset-top, 8px) + 4px) 0 0', flexShrink: 0 }}>
          <GeoBg t={t} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '0 clamp(16px, 4vw, 32px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src="/al-mawaid.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(196,156,90,0.5))' }} />
                  <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: t.accent, fontWeight: 900, fontFamily: "'Cinzel', serif" }}>Al-Mawaid</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 10, color: t.textSub, opacity: .4, fontFamily: "'DM Sans',sans-serif" }}>
                  {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <button onClick={() => setActiveTab('profile')} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <Bell size={18} color={unreadCount > 0 ? t.accent : t.textSub} style={{ opacity: unreadCount > 0 ? 1 : 0.5 }} />
                  {unreadCount > 0 && (
                    <div style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, background: '#e05555', color: '#fff', fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 2px 6px rgba(224,85,85,0.5)', animation: 'pulse 2s infinite' }}>{unreadCount > 9 ? '9+' : unreadCount}</div>
                  )}
                </button>
              </div>
            </div>
            {activeTab === 'home' && (
              <div style={{ textAlign: 'center', marginBottom: 2 }}>
                <p style={{ fontFamily: "'Noto Nastaliq Urdu','Amiri',serif", fontSize: 15, color: t.accent, margin: 0, lineHeight: 1.6 }}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
              </div>
            )}
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: activeTab === 'home' ? 24 : 18, fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.1, color: t.accent, fontFamily: "'Playfair Display',serif" }}>{tabLabels[activeTab]}</h1>
            </div>
          </div>
          {/* Header cleared by removing wave and reducing heights for mobile */}
        </header>

        {/* ── Toast Notification Popup ── */}
        {toastNotice && (
          <div
            onClick={() => { setActiveTab('profile'); setToastNotice(null) }}
            style={{
              position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
              width: 'calc(100% - 32px)', maxWidth: 400, zIndex: 10000,
              background: 'rgba(20, 18, 12, 0.95)', border: `1.5px solid ${t.accentBorder}`,
              borderRadius: 20, padding: 16, display: 'flex', gap: 14,
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)', cursor: 'pointer',
              animation: 'slideDown 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bell size={20} color="#000" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: t.accent, marginBottom: 2 }}>{toastNotice.title}</div>
              <div style={{ fontSize: 12, color: t.textSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{toastNotice.body}</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setToastNotice(null) }} style={{ background: 'none', border: 'none', color: t.textSub, padding: 4, cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {activeTab === 'home' && <HomePage setActiveTab={setActiveTab} setShowSurvey={setShowSurvey} setShowDailySurvey={setShowDailySurvey} appSettings={appSettings} userStats={userStats} settingsLoading={settingsLoading} />}
        {activeTab === 'menu' && <WeeklyMenuPage />}

        {activeTab === 'post' && <PostPage />}
        {activeTab === 'profile' && <ProfilePage theme={theme} setTheme={handleSetTheme} markRead={markNotificationsRead} />}

        {showSurvey && <SurveyModal startDay={new URLSearchParams(window.location.search).get('day') || null} onClose={() => { setShowSurvey(false); window.history.replaceState({}, '', '/'); }} appSettings={appSettings} userStats={userStats} />}
        {showDailySurvey && <DailySurveyModal onClose={() => { setShowDailySurvey(false); setActiveTab('home') }} appSettings={appSettings} userStats={userStats} />}

        <nav className="mobile-bottom-nav">
          {tabs.map(({ id, label, Icon }) => {
            const active = activeTab === id
            return (
              <button key={id} onClick={() => setActiveTab(id)} className={active ? 'active' : ''}>
                <div>
                  <Icon size={22} />
                </div>
                <span>{label}</span>
              </button>
            )
          })}
        </nav>
        <GlobalStyles />
      </div>
    </ThemeCtx.Provider>
  )
}

// ══════════════════════════════════════════════════════════════
// HOME PAGE (Thali User)
// ══════════════════════════════════════════════════════════════
function HomePage({ setActiveTab, setShowSurvey, setShowDailySurvey, appSettings, userStats, settingsLoading }) {
  const t = useTheme()
  const { user } = useAuth()

  const weeklyMenu = useWeeklyMenu()
  const [showQR, setShowQR] = useState(false)
  const [profileData, setProfileData] = useState({ name: '', thali_number: '', avatar_url: '' })
  const [statsLoading, setStatsLoading] = useState(true)
  const [mySurvey, setMySurvey] = useState(null)
  const [surveyLoading, setSurveyLoading] = useState(true)
  const surveyOpen = isSurveyOpen(appSettings, user?.id)
  const todayKey = getTodayKey()
  const currentWeekId = getWeekDate()

  // Feedback State
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState({ lunch: false, dinner: false })
  const [lunchStars, setLunchStars] = useState(0)
  const [dinnerStars, setDinnerStars] = useState(0)
  const [lunchComment, setLunchComment] = useState('')
  const [dinnerComment, setDinnerComment] = useState('')
  const STAR_LABELS = { 1: '😞 Poor', 2: '😐 Fair', 3: '🙂 Good', 4: '😄 Great', 5: '🤩 Excellent' }

  useEffect(() => { 
    loadData()
    fetchSurvey()
    
    // Real-time subscription to survey updates
    const channel = supabase.channel(`user-survey-${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'survey_submissions_flat', 
        filter: `user_id=eq.${user.id}` 
      }, () => fetchSurvey())
      .subscribe()
    
    return () => supabase.removeChannel(channel)
  }, [user])

  const loadData = async () => {
    try {
      const { data } = await supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle()
      if (data) setProfileData({ name: data.name || '', thali_number: data.thali_number || '', avatar_url: data.avatar_url || '' })
    } catch { }
    setStatsLoading(false)
  }

  const fetchSurvey = async () => {
    setSurveyLoading(true)
    try {
      const { data } = await supabase.from('survey_submissions_flat')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_id', currentWeekId)
        .maybeSingle()
      setMySurvey(data)
    } catch { } finally { setSurveyLoading(false) }
  }

  const handleSubmitCombined = async () => {
    if (!lunchStars && !dinnerStars) return alert('Please rate at least one meal')
    setSubmittingFeedback(true)
    try {
      const { error: dbErr } = await supabase.from('daily_feedback').upsert([{
        user_id: user.id, day: todayKey,
        lunch_stars: lunchStars || null, lunch_emoji: lunchStars ? STAR_LABELS[lunchStars] : null,
        dinner_stars: dinnerStars || null, dinner_emoji: dinnerStars ? STAR_LABELS[dinnerStars] : null,
        comment: (lunchComment || dinnerComment).trim(),
        created_at: new Date().toISOString()
      }], { onConflict: 'user_id,day' })
      if (dbErr) throw dbErr
      setFeedbackSubmitted({ lunch: !!lunchStars, dinner: !!dinnerStars })
    } catch { } finally { setSubmittingFeedback(false) }
  }

  // Any meal editable in the current week?
  const isAnyMealEditable = DAYS.some(d => 
    canEditMeal(d, currentWeekId, 'lunch', appSettings, user?.id) || 
    canEditMeal(d, currentWeekId, 'dinner', appSettings, user?.id)
  )

  if (!weeklyMenu || statsLoading) return <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spin" style={{ width: 40, height: 40, border: '3px solid rgba(212,175,55,0.2)', borderTop: '3px solid #D4AF37', borderRadius: '50%' }} /></div>

  const params = new URLSearchParams(window.location.search)
  const forceDay = params.get('day')

  return (
    <main style={{ flex: 1, padding: '16px 16px calc(110px + env(safe-area-inset-bottom, 20px))', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Profile strip */}
      <Card active style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, padding: '14px 16px', borderRadius: 18, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, left: -20, width: 80, height: 80, background: t.accentGrad, borderRadius: '50%', filter: 'blur(40px)', opacity: 0.08 }} />
        <Avatar avatarUrl={profileData?.avatar_url} name={profileData?.name} size={46} />
        <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display',serif", lineHeight: 1.2 }}>{profileData?.name || 'Thali User'}</div>
          <div style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginTop: 2 }}>Thali #{profileData?.thali_number || '—'}</div>
        </div>
        <button onClick={() => setShowQR(true)} style={{ background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2, position: 'relative' }}>
          <QrCode size={22} color={t.accent} />
        </button>
      </Card>

      {showQR && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(10px)' }} onClick={() => setShowQR(false)}>
          <div style={{ background: '#fff', padding: 32, borderRadius: 32, textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', color: '#000', fontSize: 22, fontWeight: 800, fontFamily: "'Playfair Display',serif" }}>Member ID</h3>
            <div style={{ padding: 16, background: '#fff', borderRadius: 20, border: '2px solid #f0f0f0', display: 'inline-block' }}>
               <QRCodeCanvas value={`ALMAWAID:${user.id}`} size={220} level="H" />
            </div>
            <div style={{ marginTop: 20, fontSize: 18, fontWeight: 800, color: '#000', fontFamily: "'DM Sans',sans-serif" }}>#{profileData?.thali_number}</div>
            <button onClick={() => setShowQR(false)} style={{ marginTop: 24, padding: '12px 32px', borderRadius: 16, background: '#000', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 16, fontFamily: "'DM Sans',sans-serif", width: '100%' }}>Close</button>
          </div>
        </div>
      )}

      {/* Weekly Survey Section */}
      <Card organic style={{
        marginBottom: 20, borderRadius: 24,
        background: (surveyOpen || isAnyMealEditable) ? t.accentBg : 'rgba(0,0,0,0.2)',
        border: `1.5px solid ${(surveyOpen || isAnyMealEditable) ? t.accent : t.border}`,
        position: 'relative', overflow: 'hidden', padding: '24px'
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, background: t.accentGrad, borderRadius: '50%', filter: 'blur(60px)', opacity: 0.15 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: (surveyOpen || isAnyMealEditable) ? t.successText : t.textSub, boxShadow: (surveyOpen || isAnyMealEditable) ? `0 0 10px ${t.successText}` : 'none' }} />
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>{surveyOpen ? 'SURVEY LIVE' : (isAnyMealEditable ? 'EDITING WINDOW' : 'SURVEY CLOSED')}</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display',serif", lineHeight: 1.2 }}>Weekly Food Survey</div>
            {mySurvey && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {mySurvey[`${todayKey.substring(0,3)}_l_status`] && (
                  <Badge color={mySurvey[`${todayKey.substring(0,3)}_l_status`] === 'Applied' ? t.successText : '#e05555'} style={{ fontSize: 10, padding: '2px 8px' }}>
                    Lunch: {mySurvey[`${todayKey.substring(0,3)}_l_status`]}
                  </Badge>
                )}
                {mySurvey[`${todayKey.substring(0,3)}_d_status`] && (
                  <Badge color={mySurvey[`${todayKey.substring(0,3)}_d_status`] === 'Applied' ? t.successText : '#e05555'} style={{ fontSize: 10, padding: '2px 8px' }}>
                    Dinner: {mySurvey[`${todayKey.substring(0,3)}_d_status`]}
                  </Badge>
                )}
              </div>
            )}
            <div style={{ fontSize: 13, color: t.textSub, marginTop: mySurvey ? 8 : 8, fontFamily: "'DM Sans',sans-serif" }}>{surveyOpen ? getSurveyWindowMessage(appSettings) : (isAnyMealEditable ? 'Daily edit window is live.' : 'Weekly survey is closed. You can still view your responses.')}</div>
          </div>

          <button
            onClick={() => {
              if (settingsLoading) return
              const isGlobalWeekly = appSettings?.survey_status === 'open'
              const todayEditable = canEditMeal(todayKey, currentWeekId, 'lunch', appSettings, user?.id) || 
                                   canEditMeal(todayKey, currentWeekId, 'dinner', appSettings, user?.id)

              if (isGlobalWeekly) {
                setShowSurvey(true)
              } else if (todayEditable) {
                setShowDailySurvey(true)
              } else if (surveyOpen) {
                // User has access to some other day, show weekly modal to let them navigate
                setShowSurvey(true)
              } else {
                setShowSurvey(true) // Open in view-only mode
              }
            }}
            disabled={settingsLoading}
            style={{
              padding: '16px 28px', borderRadius: 16,
              background: settingsLoading ? 'rgba(255,255,255,0.05)' : ((surveyOpen || isAnyMealEditable) ? t.accentGrad : 'rgba(255,255,255,0.05)'),
              color: settingsLoading ? t.textSub : ((surveyOpen || isAnyMealEditable) ? '#000' : t.textSub),
              fontSize: 14, fontWeight: 900, border: 'none', cursor: settingsLoading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, boxShadow: (!settingsLoading && (surveyOpen || isAnyMealEditable)) ? `0 10px 25px ${t.accent}40` : 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: "'DM Sans',sans-serif"
            }}
          >
            {settingsLoading ? (
               <>
                 <div className="spin" style={{ width: 16, height: 16, border: `2px solid ${t.textSub}`, borderTopColor: 'transparent', borderRadius: '50%' }} />
                 Checking status...
               </>
            ) : (
               <>
                 <ClipboardList size={18} /> 
                 {surveyOpen 
                   ? (mySurvey ? 'Edit Weekly Survey' : 'Start Weekly Survey') 
                   : (isAnyMealEditable 
                       ? (mySurvey?.[`${todayKey.substring(0,3)}_l_status`] || mySurvey?.[`${todayKey.substring(0,3)}_d_status`] ? 'Edit Daily Survey' : 'Fill Daily Survey') 
                       : 'View Responses'
                     )}
               </>
            )}
          </button>
        </div>
      </Card>


      {/* Daily Feedback Section */}
      <Card organic style={{ marginBottom: 24 }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, background: t.accentGrad, borderRadius: '50%', filter: 'blur(60px)', opacity: 0.12 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 15px ${t.accentBg}` }}><Utensils size={16} color="#fff" /></div>
          <div style={{ fontSize: 18, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display',serif" }}>Today's Menu & Feedback</div>
        </div>

        {/* Current Day Menu & Feedback combined vertically */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
          {['lunch', 'dinner'].filter(meal => {
            // Filter feedback based on today's access
            const userAccess = getUserCustomAccess(appSettings, user.id)
            const hasAnyCustom = Object.keys(userAccess).some(k => Array.isArray(userAccess[k]) && userAccess[k].length > 0)
            if (hasAnyCustom) {
              return (userAccess[todayKey.toLowerCase()] || []).includes(meal)
            }
            return true // Fallback to both if no custom access
          }).map(meal => {
            const menuItems = weeklyMenu[todayKey]?.[meal] || []
            const menuText = menuItems.length ? menuItems.join(', ') : 'Preparation in progress...'
            const stars = meal === 'lunch' ? lunchStars : dinnerStars
            const setStars = meal === 'lunch' ? setLunchStars : setDinnerStars
            const submitted = feedbackSubmitted[meal]
            const Icon = meal === 'lunch' ? Sun : Moon

            return (
              <div key={meal} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 20, borderRadius: 20, border: `1px solid ${stars > 0 ? t.accentBorder : t.border}`, transition: 'border-color 0.3s', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05), 0 8px 20px rgba(0,0,0,0.1)' }}>
                {/* Menu Part */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: t.accent, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={14} /> {meal} Menu</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: t.textBody }}>{menuText}</div>
                </div>

                <hr style={{ border: 'none', borderTop: `1px solid ${t.border}`, margin: '0 0 16px' }} />

                {/* Rating Part */}
                <div style={{ fontSize: 11, fontWeight: 800, color: t.textSub, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans',sans-serif" }}>
                  Rate this meal
                </div>
                {submitted ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.successText, fontWeight: 600 }}><Check size={14} /> Rated!</div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      {[1, 2, 3, 4, 5].map(num => (
                        <button key={num} onClick={() => setStars(num)} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', transition: 'transform 0.2s', transform: stars >= num ? 'scale(1.15)' : 'scale(1)' }}>
                          <Star size={28} color={t.accent} fill={stars >= num ? t.accent : 'none'} strokeWidth={1.5} style={{ transition: 'fill 0.2s, color 0.2s', filter: stars >= num ? `drop-shadow(0 2px 8px ${t.accentBg})` : 'none' }} />
                        </button>
                      ))}
                    </div>
                    {stars > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: t.accent, opacity: 0.9, fontFamily: "'DM Sans',sans-serif" }}>{STAR_LABELS[stars]}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: t.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Comments</label>
          <textarea
            value={lunchComment}
            onChange={e => { setLunchComment(e.target.value); setDinnerComment(e.target.value) }}
            placeholder="Tell us what you liked or how we can improve..."
            style={{ width: '100%', padding: '14px 16px', borderRadius: 16, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text, fontSize: 14, resize: 'none', outline: 'none', fontFamily: "'DM Sans',sans-serif", minHeight: 80, boxSizing: 'border-box', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}
          />
        </div>
        <Btn onClick={handleSubmitCombined} disabled={submittingFeedback || (!lunchStars && !dinnerStars)} style={{ width: '100%', height: 52, fontSize: 15, borderRadius: 16 }}>
          {submittingFeedback ? 'Saving...' : 'Submit Feedback'}
        </Btn>
      </Card>
    </main>
  )
}

function WeeklyMenuPage() {
  const t = useTheme()
  const { user } = useAuth()
  const weeklyMenu = useWeeklyMenu()
  const todayKey = getTodayKey()
  const [expandedDay, setExpandedDay] = useState(todayKey)

  if (!weeklyMenu) return (
    <div style={{ padding: 20 }}>
      <Skeleton height={200} style={{ marginBottom: 20, borderRadius: 32 }} />
      {[1,2,3,4,5,6,7].map(i => <Skeleton key={i} height={80} style={{ marginBottom: 16, borderRadius: 28 }} />)}
    </div>
  )

  const jumpToDay = (day) => {
    SoundUI.click()
    setExpandedDay(day)
    const el = document.getElementById(`day-card-${day}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <main style={{ flex: 1, padding: '16px 16px calc(110px + env(safe-area-inset-bottom, 20px))', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{
        marginBottom: 24, padding: '24px', borderRadius: 32,
        background: t.cardActive, border: `1.5px solid ${t.borderActive}`,
        position: 'relative', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
      }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 140, height: 140, background: t.accentGrad, borderRadius: '50%', filter: 'blur(50px)', opacity: 0.15 }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
              <Utensils size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', color: t.accent, textTransform: 'uppercase', fontFamily: "'DM Sans',sans-serif" }}>Culinary Journey</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display',serif" }}>Weekly Menu</div>
            </div>
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
              {(() => {
                try {
                  const accessMap = JSON.parse(appSettings?.user_day_access || '{}')
                  const userMap = accessMap[user.id] || {}
                  const normalizedUserMap = {}
                  Object.keys(userMap).forEach(k => normalizedUserMap[k.toLowerCase()] = userMap[k])
                  
                  const meals = normalizedUserMap[day.toLowerCase()] || []
                  if (meals.length > 0) {
                    return (
                      <div style={{ 
                        position: 'absolute', top: isToday ? 42 : 12, right: 12, 
                        padding: '4px 10px', borderRadius: 20, 
                        background: 'rgba(212,175,55,0.1)', border: `1px solid ${t.accent}`, color: t.accent, 
                        fontSize: 8, fontWeight: 900, textTransform: 'uppercase', zIndex: 5
                      }}>
                        Scheduled Access
                      </div>
                    )
                  }
                } catch(e) {}
                return null
              })()}

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
                    <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginTop: 2, opacity: 0.7 }}>
                      {menu.en || 'Special Menu Coming Soon'}
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
                      {menu.lunch.length > 0 ? menu.lunch.map(dish => (
                        <div key={dish} style={{
                          padding: '8px 16px', borderRadius: 14,
                          background: t.inputBg, border: `1px solid ${t.border}`,
                          fontSize: 13, fontWeight: 600, color: t.textBody
                        }}>{dish}</div>
                      )) : <div style={{ fontSize: 12, color: t.textSub, fontStyle: 'italic' }}>Preparation in progress...</div>}
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
                      {menu.dinner.length > 0 ? menu.dinner.map(dish => (
                        <div key={dish} style={{
                          padding: '8px 16px', borderRadius: 14,
                          background: t.inputBg, border: `1px solid ${t.border}`,
                          fontSize: 13, fontWeight: 600, color: t.textBody
                        }}>{dish}</div>
                      )) : <div style={{ fontSize: 12, color: t.textSub, fontStyle: 'italic' }}>Stay tuned for the menu...</div>}
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

// ══════════════════════════════════════════════════════════════
// POST PAGE (Member)
// ══════════════════════════════════════════════════════════════
function PostPage() {
  const t = useTheme()
  const [subTab, setSubTab] = useState('requests')
  return (
    <main style={{ flex: 1, padding: '16px 16px calc(110px + env(safe-area-inset-bottom, 20px))', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, background: t.card, borderRadius: 13, padding: 5, border: `1px solid ${t.border}` }}>
        {[{ id: 'requests', label: '📋 Requests' }, { id: 'queries', label: '❓ Queries' }].map(({ id, label }) => (
          <button key={id} onClick={() => setSubTab(id)}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: 'none', background: subTab === id ? t.accentGrad : 'transparent', color: subTab === id ? '#fff' : t.textSub, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.25s' }}>
            {label}
          </button>
        ))}
      </div>
      {subTab === 'requests' && <ThaliRequestsSection />}
      {subTab === 'queries' && <QueriesSection />}
    </main>
  )
}

function ThaliRequestsSection() {
  const t = useTheme(), { user } = useAuth()
  const [activeRequest, setActiveRequest] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [resumeFrom, setResumeFrom] = useState('')
  const [resumeTo, setResumeTo] = useState('')
  const [stopFrom, setStopFrom] = useState('')
  const [stopTo, setStopTo] = useState('')
  const [miqaatOption, setMiqaatOption] = useState(null)
  const [extraItems, setExtraItems] = useState([{ name: '', qty: 1 }])
  const [refreshKey, setRefreshKey] = useState(0)
  const today = new Date().toISOString().split('T')[0]
  const inp = { width: '100%', padding: '11px 13px', borderRadius: 11, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif" }

  const resetAll = () => { setResumeFrom(''); setResumeTo(''); setStopFrom(''); setStopTo(''); setMiqaatOption(null); setExtraItems([{ name: '', qty: 1 }]); setError(''); setSuccess('') }
  const openRequest = (type) => { resetAll(); setActiveRequest(activeRequest === type ? null : type) }
  const addExtraItem = () => setExtraItems(prev => [...prev, { name: '', qty: 1 }])
  const removeExtraItem = i => setExtraItems(prev => prev.filter((_, idx) => idx !== i))
  const updateExtraItem = (i, field, val) => setExtraItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  const handleSubmit = async (type) => {
    setError(''); setSuccess(''); setSubmitting(true)
    try {
      let payload = { user_id: user.id, request_type: type, status: 'pending' }
      if (type === 'resume') { if (!resumeFrom) throw new Error('Please select a date'); payload = { ...payload, from_date: resumeFrom, to_date: null } }
      else if (type === 'stop') { if (!stopFrom || !stopTo) throw new Error('Please select both dates'); payload = { ...payload, from_date: stopFrom, to_date: stopTo } }
      else if (type === 'miqaat') { if (!miqaatOption) throw new Error('Please select an option'); payload = { ...payload, details: `Option ${miqaatOption}` } }
      else if (type === 'extra') { const valid = extraItems.filter(i => i.name.trim()); if (!valid.length) throw new Error('Please add at least one item'); payload = { ...payload, extra_items: valid } }
      const { error: dbErr } = await supabase.from('thali_requests').insert([payload])
      if (dbErr) throw dbErr
      setSuccess(`✅ ${type === 'resume' ? 'Resume' : type === 'stop' ? 'Stop' : 'Extra food'} request submitted!`)
      resetAll(); setActiveRequest(null)
      setRefreshKey(k => k + 1)
    } catch (err) { setError(err.message) } finally { setSubmitting(false) }
  }

  const RCard = ({ type, children }) => (
    <div style={{ marginBottom: 10, borderRadius: 14, border: `1px solid ${activeRequest === type ? t.borderActive : t.border}`, background: activeRequest === type ? t.cardActive : t.card, overflow: 'hidden' }}>{children}</div>
  )
  const HdrBtn = ({ type, emoji, label, desc }) => (
    <button onClick={() => openRequest(type)} style={{ width: '100%', padding: 15, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: activeRequest === type ? t.accent : t.text, fontFamily: "'DM Sans',sans-serif" }}>{label}</div>
        <div style={{ fontSize: 12, color: t.textSub, marginTop: 1, fontFamily: "'DM Sans',sans-serif" }}>{desc}</div>
      </div>
      {activeRequest === type ? <ChevronUp size={14} color={t.accent} /> : <ChevronDown size={14} color={t.accent} />}
    </button>
  )

  return (
    <div>
      {success && <div style={{ marginBottom: 12, padding: 13, borderRadius: 12, background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.successText, fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{success}</div>}
      <RCard type="resume">
        <HdrBtn type="resume" emoji="▶️" label="Resume Thali" desc="Restart your thali service" />
        {activeRequest === 'resume' && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>RESUME FROM</label>
              <input type="date" value={resumeFrom} min={today} onChange={e => setResumeFrom(e.target.value)} style={inp} />
            </div>
            {error && <ErrorBanner msg={error} />}
            <button onClick={() => handleSubmit('resume')} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting…' : '✅ Submit Resume Request'}</button>
          </div>
        )}
      </RCard>
      <RCard type="stop">
        <HdrBtn type="stop" emoji="⏹️" label="Stop Thali" desc="Pause your thali service" />
        {activeRequest === 'stop' && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>FROM</label><input type="date" value={stopFrom} min={today} onChange={e => setStopFrom(e.target.value)} style={inp} /></div>
              <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>TO</label><input type="date" value={stopTo} min={stopFrom || today} onChange={e => setStopTo(e.target.value)} style={inp} /></div>
            </div>
            {error && <ErrorBanner msg={error} />}
            <button onClick={() => handleSubmit('stop')} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : 'linear-gradient(135deg,#e05555,#c03030)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting…' : '⏹️ Submit Stop Request'}</button>
          </div>
        )}
      </RCard>
      <RCard type="miqaat">
        <HdrBtn type="miqaat" emoji="" label="Miqaat Pirsu" desc="Select your Miqaat option" />
        {activeRequest === 'miqaat' && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => setMiqaatOption(n)}
                  style={{ flex: 1, height: 48, borderRadius: 12, border: `1.5px solid ${miqaatOption === n ? t.accent : t.border}`, background: miqaatOption === n ? t.accentBg : 'transparent', color: miqaatOption === n ? t.accent : t.textSub, fontWeight: 800, fontSize: 18, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s' }}>
                  {n}
                </button>
              ))}
            </div>
            {error && <ErrorBanner msg={error} />}
            <button onClick={() => handleSubmit('miqaat')} disabled={submitting || !miqaatOption} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif", opacity: !miqaatOption ? 0.5 : 1 }}>{submitting ? 'Submitting…' : 'Submit Miqaat Option'}</button>
          </div>
        )}
      </RCard>
      <RCard type="extra">
        <HdrBtn type="extra" emoji="➕" label="Add Extra Food" desc="Request additional items" />
        {activeRequest === 'extra' && (
          <div style={{ padding: '0 16px 16px' }}>
            {extraItems.map((item, i) => (
              <div key={`extra-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input type="text" value={item.name} placeholder={`Item ${i + 1}`} onChange={e => updateExtraItem(i, 'name', e.target.value)} style={{ ...inp, flex: 1 }} />
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {[1, 2, 3, 4].map(n => (
                    <button key={n} onClick={() => updateExtraItem(i, 'qty', n)}
                      style={{ width: 32, height: 36, borderRadius: 9, border: `1.5px solid ${item.qty === n ? t.accent : t.border}`, background: item.qty === n ? t.accentBg : 'transparent', color: item.qty === n ? t.accent : t.textSub, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>{n}</button>
                  ))}
                </div>
                {extraItems.length > 1 && <button onClick={() => removeExtraItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={15} color="#e05555" /></button>}
              </div>
            ))}
            {extraItems.length < 6 && <button onClick={addExtraItem} style={{ width: '100%', padding: 10, borderRadius: 11, border: `1px dashed ${t.accent}`, background: 'transparent', color: t.accent, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 10, fontFamily: "'DM Sans',sans-serif" }}>+ Add Another Item</button>}
            {error && <ErrorBanner msg={error} />}
            <button onClick={() => handleSubmit('extra')} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting…' : '➕ Submit Extra Food Request'}</button>
          </div>
        )}
      </RCard>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>Recent Requests</SectionLabel>
        <RecentRequestsList refreshKey={refreshKey} />
      </div>
    </div>
  )
}

function RecentRequestsList({ refreshKey }) {
  const t = useTheme(), { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from('thali_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15)

      const now = new Date()
      const filtered = (data || []).filter(r => {
        if (r.status === 'pending' || !r.status) return true
        const updateTime = new Date(r.updated_at || r.created_at)
        const diffHours = (now - updateTime) / (1000 * 60 * 60)
        return diffHours < 24
      }).slice(0, 5)

      setRequests(filtered)
      setLoading(false)
    }
    fetchData()
  }, [user.id, refreshKey])

  const statusColor = (s) => s === 'pending' ? '#d4882a' : s === 'approved' ? '#5eba82' : '#e05555'

  if (loading) return <Spinner />
  if (requests.length === 0) return <div style={{ textAlign: 'center', padding: 20, color: t.textSub, fontSize: 13, opacity: 0.6 }}>No recent requests.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {requests.map(r => (
        <div key={r.id} style={{ padding: 14, borderRadius: 14, background: t.card, border: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>
              {r.request_type === 'resume' ? '▶️ Resume' : r.request_type === 'stop' ? '⏹️ Stop' : r.request_type === 'extra' ? '➕ Extra' : '🕌 Miqaat'}
            </div>
            <div style={{ fontSize: 11, color: t.textSub, marginTop: 2, fontFamily: "'DM Sans',sans-serif" }}>{new Date(r.created_at).toLocaleDateString()}</div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: `${statusColor(r.status)}15`, color: statusColor(r.status), border: `1px solid ${statusColor(r.status)}30`, textTransform: 'uppercase' }}>
            {r.status || 'PENDING'}
          </div>
        </div>
      ))}
    </div>
  )
}

function QueriesSection() {
  const t = useTheme(), { user } = useAuth()
  const [queries, setQueries] = useState([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [mediaFiles, setMediaFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [helpline, setHelpline] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    supabase.from('app_settings').select('*').eq('key', 'helpline_number').maybeSingle()
      .then(({ data }) => { if (data) setHelpline(data.value) })
  }, [])

  useEffect(() => { loadQueries() }, [])
  const loadQueries = async () => {
    try {
      const { data } = await supabase.from('queries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)

      const now = new Date()
      const filtered = (data || []).filter(q => {
        if (q.status === 'open' || !q.status) return true
        const updateTime = new Date(q.updated_at || q.created_at)
        const diffHours = (now - updateTime) / (1000 * 60 * 60)
        return diffHours < 24
      }).slice(0, 20)

      setQueries(filtered)
    } catch { } finally { setLoading(false) }
  }
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
    if (mediaFiles.length + files.length > 4) { setError('Max 4 files'); return }
    setMediaFiles(prev => [...prev, ...files.map(file => ({ file, url: URL.createObjectURL(file), type: file.type.startsWith('image/') ? 'image' : 'video', name: file.name }))])
    e.target.value = ''
  }
  const removeMedia = i => { setMediaFiles(prev => { URL.revokeObjectURL(prev[i].url); return prev.filter((_, idx) => idx !== i) }) }
  const handleSubmit = async () => {
    if (!comment.trim() && !mediaFiles.length) return setError('Add a comment or attach a file')
    setError(''); setSuccess(''); setSubmitting(true)
    try {
      const uploadedUrls = []
      for (const item of mediaFiles) {
        const ext = item.file.name.split('.').pop()
        const path = `queries/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('query-media').upload(path, item.file)
        if (!upErr) { const { data: urlData } = supabase.storage.from('query-media').getPublicUrl(path); uploadedUrls.push({ type: item.type, name: item.file.name, path: urlData.publicUrl }) }
      }
      const { error: dbErr } = await supabase.from('queries').insert([{
        user_id: user.id,
        subject: comment.substring(0, 50) + (comment.length > 50 ? '...' : ''),
        comment: comment.trim(),
        media: uploadedUrls,
        status: 'open'
      }])
      if (dbErr) throw dbErr
      setSuccess('✅ Query submitted! Our team will respond shortly.')
      setComment(''); setMediaFiles([]); loadQueries()
    } catch (err) { setError(err.message) } finally { setSubmitting(false) }
  }
  const statusColor = s => s === 'open' ? '#d4882a' : s === 'resolved' ? '#5eba82' : '#7aabb8'

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif" }}>✉️ New Query</div>
          {helpline && (
            <a href={`https://wa.me/${helpline.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, background: '#25D366', color: '#fff', fontSize: 10, fontWeight: 800, textDecoration: 'none', boxShadow: '0 4px 10px rgba(37,211,102,0.2)' }}>
              <MessageCircle size={12} /> WhatsApp Helpline
            </a>
          )}
        </div>
        <textarea value={comment} onChange={e => setComment(e.target.value)} style={{ width: '100%', minHeight: 78, padding: 12, borderRadius: 11, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: "'DM Sans',sans-serif", marginBottom: 10 }} placeholder="Describe your query or issue…" />
        {mediaFiles.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {mediaFiles.map((item, i) => (
              <div key={i} style={{ position: 'relative', width: 68, height: 68, borderRadius: 10, overflow: 'hidden', border: `1px solid ${t.border}`, flexShrink: 0 }}>
                {item.type === 'image' ? <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: t.inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎬</div>}
                <button onClick={() => removeMedia(i)} style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.72)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={10} color="#fff" /></button>
              </div>
            ))}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
        {mediaFiles.length < 4 && (
          <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: 10, borderRadius: 11, border: `1px dashed ${t.accentBorder}`, background: t.accentBg, color: t.accent, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: "'DM Sans',sans-serif" }}>
            <Camera size={14} /> Attach Photo / Video ({mediaFiles.length}/4)
          </button>
        )}
        {error && <ErrorBanner msg={error} />}
        {success && <div style={{ marginBottom: 10, padding: 11, borderRadius: 10, background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.successText, fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{success}</div>}
        <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting…' : '📨 Submit Query'}</button>
      </Card>
      <SectionLabel>My Queries</SectionLabel>
      {loading ? <Spinner /> : queries.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: t.textSub, fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>No queries yet.</div> : queries.map(q => (
        <Card key={q.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <div>
              <span style={{ display: 'block', fontSize: 11, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginBottom: 4 }}>{new Date(q.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: `${statusColor(q.status)}20`, color: statusColor(q.status), border: `1px solid ${statusColor(q.status)}38`, fontFamily: "'DM Sans',sans-serif" }}>{q.status?.toUpperCase()}</span>
            </div>

          </div>
          {q.comment && <p style={{ margin: '0 0 8px', fontSize: 14, color: t.textBody, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>{q.comment}</p>}
          {q.media && q.media.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {q.media.map((m, i) => m.path && m.type === 'image' && <img key={i} src={m.path} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />)}
            </div>
          )}
          {q.admin_reply && <div style={{ marginTop: 8, padding: 10, borderRadius: 9, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 13, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>💬 <strong>Reply:</strong> {q.admin_reply}</div>}
        </Card>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// PROFILE PAGE (Member)
// ══════════════════════════════════════════════════════════════
function ProfilePage({ theme, setTheme, markRead }) {
  const [activeSubPage, setActiveSubPage] = useState('main')
  if (activeSubPage === 'surveys') return <MySurveysPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'requests') return <MyRequestsPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'khidmat') return <KhidmatTeamPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'notifications') return <NotificationsPage onBack={() => setActiveSubPage('main')} markRead={markRead} />
  if (activeSubPage === 'support') return <SupportTicketsPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'about') return <AboutPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'reset_password') return <ResetPasswordPage onBack={() => setActiveSubPage('main')} />
  return <ProfileMainPage theme={theme} setTheme={setTheme} onNav={setActiveSubPage} />
}

function ProfileMainPage({ theme, setTheme, onNav }) {
  const t = useTheme(), { user, signOut } = useAuth()
  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)
  const [stats, setStats] = useState({ surveys: 0, requests: 0, queries: 0 })

  useEffect(() => { 
    const fetchData = async () => {
      setLoading(true)
      const [pRes, sRes, rRes, qRes] = await Promise.all([
        supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('survey_submissions_flat').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('thali_requests').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('queries').select('id', { count: 'exact' }).eq('user_id', user.id),
      ])
      
      if (pRes.data) setProfileData(pRes.data)
      setStats({
        surveys: sRes.count || 0,
        requests: rRes.count || 0,
        queries: qRes.count || 0
      })
      setLoading(false)
    }
    fetchData()
  }, [user.id])

  const NavCard = ({ label, icon, desc, onClick }) => (
    <button onClick={onClick} style={{ width: '100%', padding: '13px 16px', borderRadius: 14, border: `1px solid ${t.border}`, background: t.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, textAlign: 'left', transition: 'all 0.2s' }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{label}</div>
        <div style={{ fontSize: 12, color: t.textSub, marginTop: 1, fontFamily: "'DM Sans',sans-serif" }}>{desc}</div>
      </div>
      <ChevronRight size={15} color={t.textSub} />
    </button>
  )

  if (loading) return <Spinner />
  return (
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <Card active style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ width: 84, height: 84, margin: '0 auto 14px' }}><Avatar avatarUrl={profileData?.avatar_url} name={profileData?.name} email={user.email} size={84} /></div>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display',serif" }}>{profileData?.name || 'Thali User'}</h2>
        <div style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginBottom: 6 }}>{user.email}</div>
        {profileData?.thali_number && <div style={{ display: 'inline-block', padding: '4px 16px', borderRadius: 20, background: t.accentBg, border: `1px solid ${t.accentBorder}`, marginBottom: 6 }}><span style={{ fontSize: 13, color: t.accent, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>Thali #{profileData.thali_number}</span></div>}
        {profileData?.phone && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}><Phone size={12} color={t.textSub} /><span style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{profileData.phone}</span></div>}
        {profileData?.address && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}><MapPin size={12} color={t.textSub} /><span style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{profileData.address}</span></div>}
        <div style={{ fontSize: 11, color: t.textSub, marginTop: 10, opacity: .5, fontFamily: "'DM Sans',sans-serif" }}>Thali User since {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 12, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>ℹ️ To update your profile details, contact an admin.</div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Surveys', count: stats.surveys, icon: <ClipboardList size={14} />, color: t.accent },
          { label: 'Requests', count: stats.requests, icon: <MessageSquare size={14} />, color: '#5eba82' },
          { label: 'Queries', count: stats.queries, icon: <HelpCircle size={14} />, color: '#9b8de0' },
        ].map(s => (
          <div key={s.label} style={{ 
            background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, 
            padding: '12px 8px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' 
          }}>
            <div style={{ color: s.color, marginBottom: 4, display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: t.text, fontFamily: "'Playfair Display',serif" }}>{s.count}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <SectionLabel>My Activity</SectionLabel>
      <NavCard label="My Identity QR" icon={<QrCode size={19} color="#fff" />} desc="Show your QR code for thali collection" onClick={() => setShowQR(true)} />
      <NavCard label="My Surveys" icon={<ClipboardList size={19} color="#fff" />} desc="View your weekly survey responses" onClick={() => onNav('surveys')} />
      <NavCard label="My Requests" icon={<img src="/al-mawaid.png" alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />} desc="Resume, stop & extra food requests" onClick={() => onNav('requests')} />
      <NavCard label="Khidmat Guzaar" icon={<Users size={19} color="#fff" />} desc="Meet our Al-Mawaid team" onClick={() => onNav('khidmat')} />
      <NavCard label="Alerts" icon={<Bell size={19} color="#fff" />} desc="See notices and important updates" onClick={() => onNav('notifications')} />
      <NavCard label="Support Ticket" icon={<LifeBuoy size={19} color="#fff" />} desc="Raise general, thali, and delivery issues" onClick={() => onNav('support')} />
      <NavCard label="About" icon={<Info size={19} color="#fff" />} desc="Learn more about the app and services" onClick={() => onNav('about')} />
      <NavCard label="Reset Password" icon={<Lock size={19} color="#fff" />} desc="Update your account password" onClick={() => onNav('reset_password')} />
      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <SectionLabel>App Theme</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.values(THEMES).filter(th => th.id === 'dark' || th.id === 'bright').map(th => (
            <button key={th.id} onClick={() => setTheme(th.id)}
              style={{ padding: '12px 14px', borderRadius: 13, border: `1.5px solid ${theme === th.id ? th.accent : t.border}`, background: theme === th.id ? th.accentBg : t.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.25s' }}>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {[th.bg, th.accent, th.card].map((c, i) => <div key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: '1.5px solid rgba(255,255,255,0.12)' }} />)}
              </div>
              <div style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 700, color: theme === th.id ? th.accent : t.text, fontFamily: "'DM Sans',sans-serif" }}>{th.icon} {th.name}</div>
              {theme === th.id && <Check size={15} color={th.accent} />}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 24, marginBottom: 40, paddingBottom: 20 }}>
        <SectionLabel>Account</SectionLabel>
        <button
          onClick={signOut}
          style={{
            width: '100%', padding: '18px', borderRadius: 20,
            border: 'none',
            background: 'linear-gradient(135deg, #ff5c5c, #d93636)',
            color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            fontFamily: "'DM Sans',sans-serif", transition: 'all 0.3s',
            boxShadow: '0 8px 25px rgba(217, 54, 54, 0.4)',
            textTransform: 'uppercase', letterSpacing: '0.05em'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <LogOut size={20} strokeWidth={3} /> Logout from Al-Mawaid
        </button>
      </div>

      {showQR && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Card style={{ width: '100%', maxWidth: 360, textAlign: 'center', padding: 32, position: 'relative' }}>
            <button onClick={() => setShowQR(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: t.textSub, cursor: 'pointer' }}><X size={20}/></button>
            <div style={{ fontSize: 12, fontWeight: 900, color: t.accent, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>Member Identity</div>
            <div style={{ background: '#fff', padding: 20, borderRadius: 24, display: 'inline-block', marginBottom: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
              <QRCodeCanvas value={`ALMAWAID:${user.id}`} size={200} level="H" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display',serif" }}>{profileData?.name}</div>
            <div style={{ fontSize: 14, color: t.accent, fontWeight: 700, marginTop: 4 }}>Thali #{profileData?.thali_number}</div>
            <p style={{ fontSize: 12, color: t.textSub, marginTop: 16, lineHeight: 1.5 }}>Present this code at the distribution counter to verify your thali collection status.</p>
            <Btn style={{ width: '100%', marginTop: 24, borderRadius: 14 }} onClick={() => setShowQR(false)}>Close</Btn>
          </Card>
        </div>
      )}
    </main>
  )
}

function MySurveysPage({ onBack }) {
  const t = useTheme(), { user } = useAuth()
  const weeklyMenu = useWeeklyMenu() || {}
  const [surveys, setSurveys] = useState({})
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const currentWeekId = getWeekDate()
    supabase.from('survey_submissions_flat').select('*').eq('user_id', user.id).eq('week_id', currentWeekId).maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) return setSurveys({})
        const grouped = {}
        DAYS.forEach(day => {
          const dayKey = day.substring(0, 3).toLowerCase()
            ;['lunch', 'dinner'].forEach(meal => {
              const mealKey = meal === 'lunch' ? 'l' : 'd'
              const status = data[`${dayKey}_${mealKey}_status`]
              if (status) {
                const dishResponses = {}
                const dishes = weeklyMenu[day]?.[meal] || []
                dishes.forEach((d, i) => {
                  const val = data[`${dayKey}_${mealKey}_dish_${i + 1}`]
                  if (val !== undefined && val !== null) {
                    dishResponses[d] = val === 'Yes' ? 'yes' : val === 'No' ? 'no' : parseInt(val)
                  }
                })
                if (!grouped[day]) grouped[day] = {}
                grouped[day][meal] = {
                  wants_food: status === 'Applied',
                  dish_responses: dishResponses,
                  edit_count: (data.edit_metadata || {})[`${dayKey}_${mealKey}`] || 0
                }
              }
            })
        })
        setSurveys(grouped)
      }).finally(() => setLoading(false))
  }, [weeklyMenu])
  return (
    <main style={{ flex: 1, padding: '16px 16px 160px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <BackHeader title="My Surveys" onBack={onBack} />
      {loading ? <Spinner /> : DAYS.map(day => {
        const dayData = surveys[day]; if (!dayData) return null
        return (
          <Card key={day} active style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <img src="/al-mawaid.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif" }}>{weeklyMenu[day]?.en || day}</div>
            </div>
            {['lunch', 'dinner'].map(meal => {
              const r = dayData[meal]; if (!r) return null
              return (
                <div key={meal} style={{ marginBottom: 8, padding: 11, background: t.inputBg, borderRadius: 10, border: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>{meal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}</span>
                    <span style={{ fontSize: 10, color: (r.edit_count || 0) < 1 ? t.accent : '#e05555', fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>{(r.edit_count || 0) < 1 ? '1 edit left' : 'no edits left'}</span>
                  </div>
                  <div style={{ fontSize: 13, color: r.wants_food ? t.successText : '#e05555', fontWeight: 700, fontFamily: "'DM Sans',sans-serif", marginBottom: r.wants_food ? 6 : 0 }}>{r.wants_food ? '✅ Requested Food' : '❌ Skipped'}</div>
                  {r.wants_food && r.dish_responses && Object.entries(r.dish_responses).map(([dish, val]) => (
                    <div key={dish} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${t.border}` }}>
                      <span style={{ fontSize: 12, color: t.textBody, fontFamily: "'DM Sans',sans-serif" }}>{dish}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>{val === 'yes' ? '✅' : val === 'no' ? '❌' : `${val}%`}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </Card>
        )
      })}
      {Object.keys(surveys).length === 0 && !loading && <EmptyState msg="No surveys submitted yet." />}
    </main>
  )
}

function MyRequestsPage({ onBack }) {
  const t = useTheme(), { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRequests = async () => {
      const { data, error } = await supabase
        .from('thali_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (!error) setRequests(data || [])
      setLoading(false)
    }
    fetchRequests()
  }, [user.id])

  const typeLabel = (type) => {
    const labels = { resume: '▶️ Resume Thali', stop: '⏹️ Stop Thali', miqaat: '🕌 Miqaat Pirsu', extra: '➕ Extra Food' }
    return labels[type] || type
  }
  const statusColor = (s) => s === 'pending' ? '#d4882a' : s === 'approved' ? '#5eba82' : '#e05555'

  return (
    <main style={{ flex: 1, padding: '16px 16px 160px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <BackHeader title="My Requests" onBack={onBack} />
      {loading ? <Spinner /> : requests.length === 0 ? <EmptyState msg="No requests yet." /> : requests.map(r => (
        <Card key={r.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{typeLabel(r.request_type)}</div>
              <span style={{ display: 'inline-flex', marginTop: 6, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${statusColor(r.status)}20`, color: statusColor(r.status), border: `1px solid ${statusColor(r.status)}40`, fontFamily: "'DM Sans',sans-serif" }}>{r.status?.toUpperCase()}</span>
            </div>
          </div>
          {r.from_date && <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{r.from_date} → {r.to_date}</div>}
          {r.extra_items && <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{r.extra_items.map(i => `${i.name} x${i.qty}`).join(', ')}</div>}
          {r.details && <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{r.details}</div>}
          {r.admin_note && <div style={{ marginTop: 8, fontSize: 12, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>Note: {r.admin_note}</div>}
          <div style={{ fontSize: 10, color: t.textSub, marginTop: 6, opacity: .5, fontFamily: "'DM Sans',sans-serif" }}>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </Card>
      ))}
    </main>
  )
}

function KhidmatTeamPage({ onBack }) {
  const t = useTheme()
  const [staff, setStaff] = useState([])
  const [helpline, setHelpline] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all([
      supabase.from('khidmat_guzaar').select('*').order('sort_order', { ascending: true }),
      supabase.from('app_settings').select('*').eq('key', 'helpline_number').maybeSingle()
    ]).then(([{ data: staffData }, { data: helpData }]) => {
      setStaff(staffData || [])
      if (helpData) setHelpline(helpData.value)
    }).finally(() => setLoading(false))
  }, [])
  return (
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <BackHeader title="Khidmat Guzaar" onBack={onBack} />
      
      {helpline && (
        <Card active style={{ marginBottom: 16, border: `2px solid ${t.accent}`, background: `${t.accent}10` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px ${t.accent}40` }}>
              <Phone size={30} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display',serif" }}>Al Mawaid Helpline</div>
              <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>For any queries or assistance</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginTop: 4 }}>{helpline}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
             <a href={`https://wa.me/${helpline.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '12px', borderRadius: 14, background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', fontSize: 14, fontWeight: 800, boxShadow: '0 8px 20px rgba(37,211,102,0.3)' }}>
               <MessageCircle size={18} /> WhatsApp Helpline
             </a>
          </div>
        </Card>
      )}

      <div style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 12, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 13, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>meet our Al-Mawaid Team</div>
      {loading ? <Spinner /> : staff.length === 0 ? <EmptyState msg="No staff profiles available." /> : staff.map(member => {
        const rawPhone = member.phone || '', actionPhone = rawPhone.replace(/[^\d+]/g, '')
        return (
          <Card key={member.id} active style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar avatarUrl={member.avatar_url} name={member.name} email="" size={60} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif" }}>{member.name}</div>
                {member.role && <div style={{ display: 'inline-block', marginTop: 4, padding: '2px 10px', borderRadius: 20, background: t.accentBg, border: `1px solid ${t.accentBorder}` }}><span style={{ fontSize: 11, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>{member.role}</span></div>}
                {member.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}><Phone size={12} color={t.textSub} /><span style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{member.phone}</span></div>}
                {member.area && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}><MapPin size={12} color={t.textSub} /><span style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{member.area}</span></div>}
              </div>
            </div>
            {actionPhone && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <a href={`tel:${actionPhone}`} style={{ flex: 1, padding: '10px', borderRadius: 12, background: t.accentGrad, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}><Phone size={16} /> Call</a>
                <a href={`https://wa.me/${actionPhone.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '10px', borderRadius: 12, background: 'rgba(37,211,102,0.1)', color: '#25D366', border: '1px solid rgba(37,211,102,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}><MessageCircle size={16} /> WhatsApp</a>
              </div>
            )}
          </Card>
        )
      })}
    </main>
  )
}

function NotificationsPage({ onBack, markRead }) {
  const t = useTheme(), { user } = useAuth()
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNotices = async () => {
      // Fetch notices targeted at everyone or specifically at this user
      const { data } = await supabase
        .from('notices')
        .select('*')
        .or(`target_user_id.is.null,target_user_id.eq.${user.id}`)
        .lte('scheduled_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(10)

      setNotices(data || [])
      setLoading(false)

      // Mark as read when page is viewed
      if (markRead) markRead()
    }
    fetchNotices()
  }, [user.id, markRead])

  const staticNotices = [
    { id: 'survey-window', title: 'Weekly Survey Window', body: isSurveyOpen() ? 'Your weekly meal survey is open now. Please submit lunch and dinner choices on time.' : getSurveyWindowMessage(), tone: t.accent },
  ]
  return (
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {onBack && <BackHeader title="Alerts" onBack={onBack} />}
      <SectionLabel>System Alerts</SectionLabel>
      {staticNotices.map(item => (
        <Card key={item.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${item.tone}20`, border: `1px solid ${item.tone}45`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bell size={18} color={item.tone} /></div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{item.title}</div>
              <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.6, marginTop: 4, fontFamily: "'DM Sans',sans-serif" }}>{item.body}</div>
            </div>
          </div>
        </Card>
      ))}

      <SectionLabel>Recent Broadcasts</SectionLabel>
      {loading ? <Spinner /> : notices.length === 0 ? <EmptyState msg="No recent broadcasts found." /> : notices.map(item => (
        <Card key={item.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${item.tone || t.accent}20`, border: `1px solid ${item.tone || t.accent}45`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bell size={18} color={item.tone || t.accent} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{item.title}</div>
                <div style={{ fontSize: 10, color: t.textSub }}>{item.sender_name}</div>
              </div>
              <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.6, marginTop: 4, fontFamily: "'DM Sans',sans-serif" }}>{item.body}</div>
              {item.media && item.media[0] && (
                <img
                  src={item.media[0]}
                  alt=""
                  style={{ width: '100%', borderRadius: 12, marginTop: 12, border: `1px solid ${t.border}` }}
                />
              )}
              <div style={{ fontSize: 10, color: t.accent, marginTop: 10, fontWeight: 600 }}>{new Date(item.created_at).toLocaleString()}</div>
            </div>
          </div>
        </Card>
      ))}
    </main>
  )
}

function SupportTicketsPage({ onBack }) {
  const t = useTheme(), { user } = useAuth()
  const [ticketType, setTicketType] = useState('general')
  const [subject, setSubject] = useState('')
  const [details, setDetails] = useState('')
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const issueTypes = [{ id: 'general', label: 'General' }, { id: 'thali-related', label: 'Thali Related Issues' }, { id: 'thali-delivery', label: 'Thali Delivery Issues' }]
  const inputStyle = { width: '100%', padding: '11px 13px', borderRadius: 16, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif" }
  const statusColor = s => s === 'open' ? '#d4882a' : s === 'resolved' ? '#5eba82' : '#7aabb8'

  useEffect(() => { loadTickets() }, [])
  const loadTickets = async () => {
    try {
      const { data } = await supabase.from('queries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)

      const now = new Date()
      const filtered = (data || []).filter(item => {
        return (item.comment || '').startsWith('[Support Ticket]')
      })
      setTickets(filtered)
    } catch { } finally { setLoading(false) }
  }
  const handleSubmit = async () => {
    if (!subject.trim()) return setError('Please enter a subject')
    if (!details.trim()) return setError('Please describe your problem')
    setError(''); setSuccess(''); setSubmitting(true)
    try {
      const { error: dbErr } = await supabase.from('queries').insert([{
        user_id: user.id,
        subject: subject.trim(),
        comment: `[Support Ticket] Type: ${ticketType}\n\n${details.trim()}`,
        media: [],
        status: 'open'
      }])
      if (dbErr) throw dbErr
      setSuccess('Support ticket submitted successfully.')
      setSubject(''); setDetails(''); setTicketType('general'); loadTickets()
    } catch (err) { setError(err.message) } finally { setSubmitting(false) }
  }

  return (
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {onBack && <BackHeader title="Support Ticket" onBack={onBack} />}
      <Card active style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.accent, marginBottom: 6, fontFamily: "'Playfair Display',serif" }}>Raise a Support Ticket</div>
        <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.6, marginBottom: 14, fontFamily: "'DM Sans',sans-serif" }}>Tell us your problem and our team can follow up on general, thali-related, or delivery issues.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 12 }}>
          {issueTypes.map(type => (
            <button key={type.id} onClick={() => setTicketType(type.id)}
              style={{ padding: '11px 12px', borderRadius: 11, textAlign: 'left', cursor: 'pointer', border: `1px solid ${ticketType === type.id ? t.accentBorder : t.border}`, background: ticketType === type.id ? t.accentBg : t.card, color: ticketType === type.id ? t.accent : t.textSub, fontWeight: 700, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
              {type.label}
            </button>
          ))}
        </div>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={{ ...inputStyle, marginBottom: 10 }} />
        <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Describe your problem" style={{ ...inputStyle, minHeight: 110, resize: 'vertical', marginBottom: 10 }} />
        {error && <ErrorBanner msg={error} />}
        {success && <div style={{ marginBottom: 10, padding: 11, borderRadius: 10, background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.successText, fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{success}</div>}
        <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting...' : 'Submit Support Ticket'}</button>
      </Card>
      <SectionLabel>Recent Tickets</SectionLabel>
      {loading ? <Spinner /> : tickets.length === 0 ? <EmptyState msg="No support tickets raised yet." /> : tickets.map(ticket => (
        <Card key={ticket.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 }}>
            <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{new Date(ticket.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${statusColor(ticket.status)}20`, color: statusColor(ticket.status), border: `1px solid ${statusColor(ticket.status)}40`, fontFamily: "'DM Sans',sans-serif" }}>{ticket.status?.toUpperCase()}</span>
          </div>
          <div style={{ whiteSpace: 'pre-line', fontSize: 13, color: t.textBody, lineHeight: 1.7, fontFamily: "'DM Sans',sans-serif" }}>{ticket.comment?.replace('[Support Ticket]\n', '')}</div>
          {ticket.admin_reply && <div style={{ marginTop: 8, padding: 10, borderRadius: 9, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 13, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>Reply: {ticket.admin_reply}</div>}
        </Card>
      ))}
    </main>
  )
}

function AboutPage({ onBack }) {
  const t = useTheme()
  const aboutCards = [
    { title: 'About Al-Mawaid', body: 'This app helps thali users manage surveys, requests, payments, and support in one place.' },
    { title: 'What You Can Do', body: 'Submit feedback, manage thali requests, raise support tickets, and stay updated with notices.' },
    { title: 'Need Assistance?', body: 'Use the Support tab or the Support Ticket option inside your profile to contact the team.' },
  ]
  return (
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {onBack && <BackHeader title="About" onBack={onBack} />}
      {aboutCards.map(card => (
        <Card key={card.title} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: t.accentBg, border: `1px solid ${t.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Info size={18} color={t.accent} /></div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{card.title}</div>
              <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.7, marginTop: 4, fontFamily: "'DM Sans',sans-serif" }}>{card.body}</div>
            </div>
          </div>
        </Card>
      ))}
    </main>
  )
}

function ResetPasswordPage({ onBack }) {
  const t = useTheme()
  const [newPass, setNewPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const handleReset = async (e) => {
    e.preventDefault(); setError(''); setSuccess('')
    if (newPass.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    try { const { error: updateError } = await supabase.auth.updateUser({ password: newPass }); if (updateError) throw updateError; setSuccess('Password updated successfully!'); setNewPass('') }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  return (
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {onBack && <BackHeader title="Reset Password" onBack={onBack} />}
      <Card>
        <form onSubmit={handleReset}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 7, letterSpacing: '0.14em', fontFamily: "'DM Sans',sans-serif" }}>NEW PASSWORD</label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.accent, opacity: .6 }} />
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required placeholder="Enter new password" style={{ width: '100%', padding: '13px 13px 13px 44px', borderRadius: 12, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 15, outline: 'none', fontFamily: "'DM Sans',sans-serif" }} />
            </div>
          </div>
          {error && <ErrorBanner msg={error} />}
          {success && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: t.successBg, border: `1px solid ${t.successBorder}`, fontSize: 13, color: t.successText, fontFamily: "'DM Sans',sans-serif" }}>✅ {success}</div>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: loading ? t.border : t.accentGrad, color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1, fontFamily: "'DM Sans',sans-serif" }}>{loading ? 'Updating...' : 'Update Password'}</button>
        </form>
      </Card>
    </main>
  )
}



// ══════════════════════════════════════════════════════════════
// ADMIN DASHBOARD — Dynamic UI with navigated home screen buttons
// ══════════════════════════════════════════════════════════════

// Legacy AdminBridge removed - handled by MainRouter

// ══════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════

export default function App() {
  const { session, user, signOut, portalRole, handleRoleLogin } = useAuth()
  const [theme, setTheme] = useState(() => localStorage.getItem('al_mawaid_theme') || 'dark')
  const t = THEMES[theme] || THEMES.dark

  const handleSetTheme = (newTheme) => {
    setTheme(newTheme)
    localStorage.setItem('al_mawaid_theme', newTheme)
    updateSystemTheme(newTheme)
  }

  if (session === undefined && !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#0c0c14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spin" style={{ width: 36, height: 36, border: '2.5px solid rgba(139,92,246,0.2)', borderTop: '2.5px solid #a78bfa', borderRadius: '50%' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}body{margin:0}`}</style>
      </div>
    )
  }

  if (!session && !user) return <LoginPage onRoleLogin={handleRoleLogin} />

  if (portalRole === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (['khidmat_guzar', 'supervisor', 'khidmat'].includes(portalRole)) {
    return (
      <ThemeCtx.Provider value={THEMES.royal}>
        <PushManager />
        <Toaster position="top-center" />
        <KhidmatPortal signOut={signOut} user={user} />
      </ThemeCtx.Provider>
    )
  }

  if (portalRole === 'inventory_manager') {
    return (
      <ThemeCtx.Provider value={THEMES.royal}>
        <PushManager />
        <Toaster position="top-center" />
        <InventoryManagerPortal signOut={signOut} user={user} />
      </ThemeCtx.Provider>
    )
  }

  return (
    <ThemeCtx.Provider value={t}>
      <PushManager />
      <Toaster position="top-center" />
      <ThaliUserApp theme={theme} setTheme={handleSetTheme} />
    </ThemeCtx.Provider>
  )
}


