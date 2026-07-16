// src/App.jsx — Al-Mawaid Food Survey System — FIXED v5
// Member App + Khidmat Guzar Portal + Admin Bridge — fully linked

import React, {
  useState, useEffect, useRef, createContext, useContext, useCallback
} from 'react'
import {
  Home, FileText, User, X, Star, Check, LogOut,
  Eye, EyeOff, AlertCircle, ChevronDown, ChevronUp,
  ClipboardList, ChevronLeft, ChevronRight, Phone, MapPin,
  Users, Wallet, Bell, LifeBuoy, Info, MessageCircle, Upload, Utensils,
  Sun, Moon, Medal, Package, Shield, Menu, QrCode, Camera
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase, auth } from './lib/firebaseClient'
import { useWeeklyMenu } from './common/useWeeklyMenu'
import { AuthCtx, ThemeCtx, useAuth, useTheme } from './admin/context'
import { updateSystemTheme } from './admin/ui'
import KhidmatPortal from './admin/KhidmatPortal'
import InventoryManagerPortal from './admin/InventoryManagerPortal'
import LoginPage from './LoginPage'
import PushManager from './lib/PushManager'
import UpdatePrompt from './components/UpdatePrompt'
import { Toaster } from 'react-hot-toast'
import OfflineBanner from './components/OfflineBanner'
import DailyEditCard from './components/DailyEditCard'
import SurveyModal from './components/SurveyModal'
import DailySurveyModal from './components/DailySurveyModal'
import {
  HomePageSkeleton, WeeklyMenuSkeleton, ProfileSkeleton,
  ListPageSkeleton, RequestsSkeleton, NotificationsSkeleton, KhidmatTeamSkeleton
} from './common/Skeleton'
const THEMES = {
  dark: {
    id: 'dark', name: 'Deep Topaz', icon: '🌾',
    bg: '#8B6B38', bgGrad: 'radial-gradient(ellipse at 50% 0%, #8B6B38 0%, #4A3A2C 70%)',
    card: 'rgba(74, 58, 44, 0.45)', cardActive: 'rgba(224, 160, 60, 0.08)',
    border: 'rgba(224, 160, 60, 0.2)', borderActive: 'rgba(224, 160, 60, 0.55)',
    accent: '#E0A03C', accentGrad: 'linear-gradient(135deg, #E0A03C, #B8860B)',
    accentBg: 'rgba(224, 160, 60, 0.12)', accentBorder: 'rgba(224, 160, 60, 0.4)',
    text: '#FFF8E7', textSub: 'rgba(255, 248, 231, 0.72)', textBody: '#E8DCC8',
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
    text: '#2d2416', textSub: '#5a4e38', textBody: '#4a3d2e',
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
    text: '#FAF3E0', textSub: 'rgba(250, 243, 224, 0.72)', textBody: '#E8DCC8',
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

const hasUserOverride = (appSettings, userId, dayName, mealType) => {
  if (!userId || !appSettings.user_overrides) return false;
  try {
    const overrides = typeof appSettings.user_overrides === 'string'
      ? JSON.parse(appSettings.user_overrides)
      : appSettings.user_overrides;
    const userOverride = overrides[userId];
    if (!userOverride) return false;
    
    if (userOverride.all) return true;
    
    if (dayName) {
      const dayOverride = userOverride[dayName.toLowerCase()];
      if (dayOverride) {
        if (mealType) return !!dayOverride[mealType];
        return !!(dayOverride.lunch || dayOverride.dinner || dayOverride.all);
      }
    } else {
      return Object.keys(userOverride).length > 0;
    }
  } catch (e) {
    return false;
  }
  return false;
}

// Survey window: Saturday 8PM to Monday 11AM
const isSurveyOpen = (appSettings = {}, userId = null) => {
  if (userId && hasUserOverride(appSettings, userId)) return true;
  if (appSettings.survey_status === 'open') return true;
  if (appSettings.survey_status === 'closed') return false;

  const now = new Date()
  const day = now.getDay() // 0=Sun,1=Mon,6=Sat
  const hour = now.getHours()
  if (day === 6 && hour >= 20) return true  // Sat 8PM+
  if (day === 0) return true                // Sun all day
  if (day === 1 && hour < 11) return true   // Mon before 11AM
  return false
}

const getSurveyWindowMessage = (appSettings = {}, userId = null) => {
  if (appSettings.survey_status === 'open') return 'Survey window is open (Admin Override)!'
  if (isSurveyOpen(appSettings, userId)) return 'Survey window is open! (Sat 8PM – Mon 11AM)'
  return 'Survey window opens Saturday 8:00 PM and closes Monday 11:00 AM.'
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

const isPortionItem = (dish) => {
  const portionKeywords = ["pulav", "pulao", "dal chawal", "dhal chawal", "biryani", "khichdi", "khichadi", "rice", "pilaf", "polo"]
  return portionKeywords.some(k => dish.toLowerCase().includes(k))
}

const mapDishToCol = (day, meal, dish) => {
  const d = day.substring(0, 3).toLowerCase()
  const m = meal === 'lunch' ? 'l' : 'd'
  const dishKey = dish.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)
  return `${d}_${m}_${dishKey}`
}

const canEditMeal = (dayName, weekId, mealType, appSettings = {}, userId = null) => {
  if (hasUserOverride(appSettings, userId, dayName, mealType)) return true;
  if (isSurveyOpen(appSettings)) return true;

  if (mealType === 'lunch' && appSettings.lunch_edit_status === 'closed') return false;
  if (mealType === 'lunch' && appSettings.lunch_edit_status === 'open') return true;
  if (mealType === 'dinner' && appSettings.dinner_edit_status === 'closed') return false;
  if (mealType === 'dinner' && appSettings.dinner_edit_status === 'open') return true;

  const now = new Date()
  const weekStart = new Date(weekId) // Monday
  const dayIdx = DAYS.indexOf(dayName)
  if (dayIdx === -1) return false

  const mealDate = new Date(weekStart)
  mealDate.setDate(mealDate.getDate() + dayIdx)

  // Parse configurable timings from appSettings (used when status is AUTO)
  const parseHm = (val, defaultH, defaultM) => {
    const p = (val || '').split(':').map(Number)
    return (p.length === 2 && !isNaN(p[0]) && !isNaN(p[1]))
      ? { h: p[0], m: p[1] }
      : { h: defaultH, m: defaultM }
  }

  if (mealType === 'lunch') {
    const open = parseHm(appSettings.lunch_edit_open, 20, 0)
    const close = parseHm(appSettings.lunch_edit_close, 11, 0)
    // Lunch edit: Opens prev night at lunch_edit_open, closes same day at lunch_edit_close
    const openDate = new Date(mealDate)
    openDate.setDate(openDate.getDate() - 1)
    openDate.setHours(open.h, open.m, 0, 0)

    const closeDate = new Date(mealDate)
    closeDate.setHours(close.h, close.m, 0, 0)

    return now >= openDate && now < closeDate
  } else {
    const open = parseHm(appSettings.dinner_edit_open, 12, 0)
    const close = parseHm(appSettings.dinner_edit_close, 15, 30)
    // Dinner edit: Opens same day at dinner_edit_open, closes same day at dinner_edit_close
    const openDate = new Date(mealDate)
    openDate.setHours(open.h, open.m, 0, 0)

    const closeDate = new Date(mealDate)
    closeDate.setHours(close.h, close.m, 0, 0)

    return now >= openDate && now < closeDate
  }
}


// ══════════════════════════════════════════════════════════════
// SHARED UI PRIMITIVES
// ══════════════════════════════════════════════════════════════




// ── Notification Chime ──
const playNotificationChime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(660, now + 0.2);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(660, now + 0.1);
    gain2.gain.setValueAtTime(0, now + 0.1);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.5);
    setTimeout(() => ctx.close(), 600);
  } catch { /* Audio not available */ }
};

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
  const t = useTheme()
  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className="spin" style={{ width: 34, height: 34, border: `2.5px solid ${t.spinnerBorder}`, borderTop: `2.5px solid ${t.spinnerTop}`, borderRadius: '50%' }} />
      {fullPage && <p style={{ margin: 0, fontSize: 12, color: t.textSub, opacity: .45, fontFamily: "'DM Sans',sans-serif", letterSpacing: '0.08em' }}>Loading…</p>}
    </div>
  )
  return fullPage
    ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>{inner}</div>
    : inner
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
        bottom: calc(12px + env(safe-area-inset-bottom, 0px)); 
        left: 50%; 
        transform: translateX(-50%);
        width: min(480px, calc(100% - 32px));
        height: 72px;
        background: ${t.navBg};
        backdrop-filter: blur(25px) saturate(1.8);
        -webkit-backdrop-filter: blur(25px) saturate(1.8);
        border: 1.5px solid ${t.accentBorder};
        display: flex; align-items: center; justify-content: space-around;
        padding: 0 8px;
        z-index: 9000;
        border-radius: 24px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1);
      }
      .mobile-bottom-nav button {
        flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: none; border: none; cursor: pointer; color: ${t.textSub};
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        height: 100%;
        position: relative;
      }
      .mobile-bottom-nav button.active { 
        color: ${t.accent}; 
      }
      .mobile-bottom-nav button div {
        width: 44px; height: 44px; border-radius: 16px;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .mobile-bottom-nav button.active div { 
        background: ${t.accentGrad}; 
        color: #000;
        box-shadow: 0 8px 20px ${t.accent}40;
        transform: translateY(-6px) scale(1.05);
        border-radius: 18px;
      }
      .mobile-bottom-nav button span {
        font-size: 10px; font-weight: 800; text-transform: uppercase;
        margin-top: 4px; opacity: 0.7; letter-spacing: 0.05em;
        transition: all 0.3s;
      }
      .mobile-bottom-nav button.active span {
        transform: translateY(-2px);
        opacity: 1;
        color: ${t.accent};
        font-weight: 900;
      }
      /* ── COMPREHENSIVE RESPONSIVE SYSTEM ── */
      html { font-size: 16px; overflow-x: hidden; }
      body { overflow-x: hidden; width: 100%; max-width: 100vw; }
      img { max-width: 100%; height: auto; }
      .vh-fix { min-height: 100dvh; min-height: -webkit-fill-available; }
      main { padding-bottom: max(110px, calc(80px + env(safe-area-inset-bottom, 20px))) !important; }
      h1, h2, h3, h4, p, span, div { overflow-wrap: break-word; word-wrap: break-word; }
      button, a, input, select, textarea { min-height: 44px; }
      button, a { min-width: 44px; }
      @media (max-width: 1024px) {
        .mobile-bottom-nav { height: 68px !important; }
      }
      @media (max-width: 768px) {
        main { padding-left: 14px !important; padding-right: 14px !important; }
        h1 { font-size: clamp(20px, 5.5vw, 28px) !important; }
        h2 { font-size: clamp(17px, 5vw, 24px) !important; }
        .mobile-bottom-nav { height: 66px !important; border-radius: 22px !important; }
        .mobile-bottom-nav button div { width: 42px !important; height: 42px !important; border-radius: 14px !important; }
        .mobile-bottom-nav button span { font-size: 9px !important; }
      }
      @media (max-width: 480px) {
        main { padding-left: 12px !important; padding-right: 12px !important; }
        h1 { font-size: clamp(18px, 5vw, 24px) !important; }
        h2 { font-size: clamp(16px, 4.5vw, 20px) !important; }
        .mobile-bottom-nav { height: 62px !important; border-radius: 20px !important; width: calc(100% - 24px) !important; bottom: calc(8px + env(safe-area-inset-bottom, 0px)) !important; }
        .mobile-bottom-nav button div { width: 38px !important; height: 38px !important; border-radius: 12px !important; }
        .mobile-bottom-nav button span { font-size: 8px !important; }
        .mobile-bottom-nav button.active div { border-radius: 14px !important; }
      }
      @media (max-width: 360px) {
        main { padding-left: 8px !important; padding-right: 8px !important; }
        .mobile-bottom-nav { height: 56px !important; width: calc(100% - 16px) !important; }
        .mobile-bottom-nav button div { width: 34px !important; height: 34px !important; border-radius: 10px !important; }
        .mobile-bottom-nav button span { font-size: 7px !important; }
      }
      @media (max-height: 500px) and (orientation: landscape) {
        .mobile-bottom-nav { height: 52px !important; }
        .mobile-bottom-nav button div { width: 32px !important; height: 32px !important; }
        main { padding-bottom: 70px !important; }
      }
      @media (min-width: 1400px) {
        main { max-width: 900px !important; }
      }

    `}</style>
  )
}



// ══════════════════════════════════════════════════════════════
// THALI USER APP
// ══════════════════════════════════════════════════════════════
function ThaliUserApp() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('home')
  const [showDailySurvey, setShowDailySurvey] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('almawaid_theme') || 'dark')
  const t = THEMES[theme] || THEMES.dark
  const [unreadCount, setUnreadCount] = useState(0)
  const [toastNotice, setToastNotice] = useState(null)
  const seenNoticeIds = useRef(new Set(JSON.parse(localStorage.getItem('almawaid_seen_notices') || '[]')))
  const dragStartY = useRef(null)
  const dragY = useRef(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [appSettings, setAppSettings] = useState({})

  const loadAppSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('*')
    if (data) {
      const settings = {}
      data.forEach(row => settings[row.key] = row.value)
      setAppSettings(settings)
    } else {
      // Default settings if none exist
      setAppSettings({
        survey_status: 'open',
        survey_msg: 'Survey opens Saturday at 8:00 PM and closes Monday at 11:00 AM.'
      })
    }
  }, [])

  useEffect(() => {
    loadAppSettings()
    // Realtime subscription so admin survey toggle changes take effect immediately
    const channel = supabase
      .channel('app-settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
        loadAppSettings()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadAppSettings])

  useEffect(() => {
    updateSystemTheme(theme)
    if (typeof window !== 'undefined' && window.Capacitor) {
      import('@capacitor/status-bar').then(({ StatusBar }) => {
        const isDark = theme === 'dark' || theme === 'royal'
        StatusBar.setStyle({ style: isDark ? 'DARK' : 'LIGHT' })
        StatusBar.setBackgroundColor({ color: THEMES[theme]?.card || '#060d1a' })
      }).catch(() => {})
    }
  }, [theme])

  // ── Native Notification System (Supabase Realtime) ──
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const loadUnread = async () => {
      if (!user) return
      const lastRead = localStorage.getItem('almawaid_last_notice_read') || '1970-01-01T00:00:00.000Z'
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .or(`target_user_id.is.null,target_user_id.eq.${user.id}`)
        .gt('created_at', lastRead)

      if (!error && data) {
        try {
          const dayNum = new Date().getDay()
          const h = new Date().getHours()
          const weekId = getWeekDate()
          let isEating = false

          if (dayNum !== 0) {
            const days = ['', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
            const today = days[dayNum]
            const mealName = h < 15 ? 'lunch' : 'dinner'
            const dayKey = today.substring(0, 3).toLowerCase()
            const mealKey = mealName === 'lunch' ? 'l' : 'd'
            
            const { data: subData } = await supabase
              .from('survey_submissions_flat')
              .select(`${dayKey}_${mealKey}_status`)
              .eq('user_id', user.id)
              .eq('week_id', weekId)
              .maybeSingle()
              
            const status = subData ? subData[`${dayKey}_${mealKey}_status`] : 'Not Submitted'
            isEating = status === 'Applied'
          }
          
          const filtered = data.filter(notice => {
            const toneStr = notice.tone || ''
            if (toneStr.includes(':opt_in')) return isEating
            if (toneStr.includes(':opt_out')) return !isEating
            return true
          })
          setUnreadCount(filtered.length)
          // Mark as seen so they don't reappear on next login
          localStorage.setItem('almawaid_last_notice_read', new Date().toISOString())
        } catch {
          setUnreadCount(data.length)
          localStorage.setItem('almawaid_last_notice_read', new Date().toISOString())
        }
      }
    }
    loadUnread()

    const channel = supabase
      .channel('global-notices')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' }, async (payload) => {
        const notice = payload.new
        if (seenNoticeIds.current.has(notice.id)) return
        seenNoticeIds.current.add(notice.id)
        try { localStorage.setItem('almawaid_seen_notices', JSON.stringify([...seenNoticeIds.current])) } catch {}
        // Skip if notice was created before the last read timestamp (already seen)
        const lastRead = localStorage.getItem('almawaid_last_notice_read')
        if (lastRead && new Date(notice.created_at).getTime() <= new Date(lastRead).getTime()) return
        let isForMe = !notice.target_user_id || notice.target_user_id === user?.id

        if (isForMe && notice.tone) {
          const toneStr = notice.tone || ''
          if (toneStr.includes(':opt_in') || toneStr.includes(':opt_out')) {
            const isOptInTarget = toneStr.includes(':opt_in')
            try {
              const dayNum = new Date().getDay()
              const h = new Date().getHours()
              const weekId = getWeekDate()
              let isEating = false

              if (dayNum !== 0) {
                const days = ['', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
                const today = days[dayNum]
                const mealName = h < 15 ? 'lunch' : 'dinner'
                const dayKey = today.substring(0, 3).toLowerCase()
                const mealKey = mealName === 'lunch' ? 'l' : 'd'
                
                const { data } = await supabase
                  .from('survey_submissions_flat')
                  .select(`${dayKey}_${mealKey}_status`)
                  .eq('user_id', user.id)
                  .eq('week_id', weekId)
                  .maybeSingle()
                  
                const status = data ? data[`${dayKey}_${mealKey}_status`] : 'Not Submitted'
                isEating = status === 'Applied'
              }
              
              if (isOptInTarget && !isEating) isForMe = false
              if (!isOptInTarget && isEating) isForMe = false
            } catch (e) {
              console.error(e)
            }
          }
        }

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
  }, [user?.id])

  const markNotificationsRead = useCallback(() => {
    localStorage.setItem('almawaid_last_notice_read', new Date().toISOString())
    setUnreadCount(0)
  }, [])

  const handleSetTheme = (id) => { setTheme(id); localStorage.setItem('almawaid_theme', id) }

  const LogoIcon = ({ size = 20, style = {} }) => (
    <img src="/al-mawaid.png" alt="" style={{ width: size, height: size, objectFit: 'contain', ...style }} />
  )
  const tabs = [
    { id: 'home', label: 'Home', Icon: Home, aria: 'Home Dashboard' },
    { id: 'menu', label: 'Menu', Icon: Utensils, aria: 'Weekly Menu' },
    { id: 'post', label: 'Requests', Icon: FileText, aria: 'My Requests & Queries' },
    { id: 'profile', label: 'Profile', Icon: User, aria: 'My Profile & Settings' },
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

        {/* ── Premium Toast Notification ── */}
        {toastNotice && (() => {
          const toneColor = (toastNotice.tone || '').split(':')[0] || t.accent
          const senderInitial = (toastNotice.sender_name || 'A').charAt(0).toUpperCase()
          const hasMedia = toastNotice.media && toastNotice.media[0]
          return (
          <div
            onClick={() => { setActiveTab('profile'); setToastNotice(null) }}
            onTouchStart={(e) => {
              dragStartY.current = e.touches[0].clientY
              dragY.current = 0
              setIsDragging(true)
            }}
            onTouchMove={(e) => {
              if (dragStartY.current === null) return
              const delta = e.touches[0].clientY - dragStartY.current
              if (delta > 0) {
                e.preventDefault()
                dragY.current = delta * 0.5
                setDragOffset(dragY.current)
              }
            }}
            onTouchEnd={() => {
              setIsDragging(false)
              if (dragY.current > 80) {
                setToastNotice(null)
              }
              setDragOffset(0)
              dragStartY.current = null
              dragY.current = 0
            }}
            style={{
              position: 'fixed', top: 20, left: '50%',
              width: 'calc(100% - 32px)', maxWidth: 400, zIndex: 10000,
              background: `linear-gradient(135deg, ${toneColor}08, rgba(20,18,12,0.98))`,
              border: `1.5px solid ${toneColor}40`,
              borderRadius: 20, overflow: 'hidden',
              boxShadow: `0 20px 50px rgba(0,0,0,0.5), 0 0 30px ${toneColor}15`,
              cursor: 'pointer',
              transform: dragOffset > 0
                ? `translateX(-50%) translateY(${dragOffset}px)`
                : 'translateX(-50%)',
              transition: isDragging
                ? 'none'
                : 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              animation: dragOffset === 0 && !isDragging
                ? 'slideDown 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                : undefined,
              backdropFilter: 'blur(20px)'
            }}
          >
            {hasMedia && (
              <div style={{
                width: '100%', height: 100,
                background: `url(${toastNotice.media[0]}) center/cover no-repeat`,
                borderBottom: `1px solid ${toneColor}20`
              }} />
            )}
            <div style={{ padding: 16, display: 'flex', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: `linear-gradient(135deg, ${toneColor}, ${toneColor}88)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: `0 4px 12px ${toneColor}30`,
                color: '#000', fontSize: 16, fontWeight: 900
              }}>
                {senderInitial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: toneColor }}>
                    {toastNotice.sender_name || 'Al-Mawaid'}
                  </span>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: toneColor, opacity: 0.5 }} />
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>just now</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{toastNotice.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word', lineHeight: 1.65 }}>{toastNotice.body}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setToastNotice(null) }} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.4)', width: 28, height: 28, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${toneColor}, ${toneColor}44)`, animation: 'toastCountdown 8s linear forwards' }} />
          </div>
          )
        })()}

        {activeTab === 'home' && <HomePage setActiveTab={setActiveTab} setShowDailySurvey={setShowDailySurvey} appSettings={appSettings} />}
        {activeTab === 'menu' && <WeeklyMenuPage />}

        {activeTab === 'post' && <PostPage />}
        {activeTab === 'profile' && <ProfilePage theme={theme} setTheme={handleSetTheme} markRead={markNotificationsRead} appSettings={appSettings} />}

        <OfflineBanner />
        {showDailySurvey && <DailySurveyModal onClose={() => { setShowDailySurvey(false); setActiveTab('home') }} appSettings={appSettings} />}

        <nav className="mobile-bottom-nav" aria-label="Main navigation">
          {tabs.map(({ id, label, Icon, aria }) => {
            const active = activeTab === id
            return (
              <button key={id} onClick={() => setActiveTab(id)} className={active ? 'active' : ''} aria-label={aria || label}>
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
function HomePage({ setActiveTab, appSettings = {} }) {
  const t = useTheme()
  const { user } = useAuth()

  const weeklyMenu = useWeeklyMenu()
  const [showSurvey, setShowSurvey] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [profileData, setProfileData] = useState({ name: '', thali_number: '', avatar_url: '' })
  const [statsLoading, setStatsLoading] = useState(true)
  const surveyOpen = isSurveyOpen(appSettings, user.id)
  const todayKey = getTodayKey()

  // Auto-edit card state — show at most once per meal window
  const [showDailyEditCard, setShowDailyEditCard] = useState(false)
  const [dailyEditMealInfo, setDailyEditMealInfo] = useState(null)

  const editPromptStorageKey = (day, meal) =>
    `almawaid_edit_prompt_${user?.id || 'anon'}_${getWeekDate()}_${day}_${meal}`

  const markEditPromptDone = useCallback((day, meal) => {
    if (!day || !meal) return
    try { localStorage.setItem(editPromptStorageKey(day, meal), '1') } catch { /* ignore */ }
  }, [user?.id])

  const wasEditPromptShown = useCallback((day, meal) => {
    try { return localStorage.getItem(editPromptStorageKey(day, meal)) === '1' } catch { return false }
  }, [user?.id])

  // Check if auto-edit is enabled and current time is within the timing window
  const checkAutoEditWindow = useCallback(() => {
    if (!user || !weeklyMenu) return
    
    const lunchAuto = appSettings.lunch_edit_status === 'auto'
    const dinnerAuto = appSettings.dinner_edit_status === 'auto'
    
    if (!lunchAuto && !dinnerAuto) {
      setShowDailyEditCard(false)
      setDailyEditMealInfo(null)
      return
    }

    const currentWeekId = getWeekDate()
    const today = todayKey
    
    const pick = (day, meal) => {
      if (wasEditPromptShown(day, meal)) return false
      setDailyEditMealInfo({ day, meal })
      setShowDailyEditCard(true)
      return true
    }

    // Check if lunch is editable now (in auto mode)
    const canEditLunch = lunchAuto && canEditMeal(today, currentWeekId, 'lunch', appSettings, user.id)
    // Check if dinner is editable now (in auto mode)
    const canEditDinner = dinnerAuto && canEditMeal(today, currentWeekId, 'dinner', appSettings, user.id)

    if (canEditLunch && pick(today, 'lunch')) return
    if (canEditDinner && pick(today, 'dinner')) return

    // After dinner closes, check if next day's lunch is editable
    const todayIdx = DAYS.indexOf(today)
    const nextDay = todayIdx >= 0 ? DAYS[(todayIdx + 1) % DAYS.length] : null
    const canEditNextLunch = nextDay && lunchAuto && canEditMeal(nextDay, currentWeekId, 'lunch', appSettings, user.id)
    if (canEditNextLunch && pick(nextDay, 'lunch')) return

    setShowDailyEditCard(false)
    setDailyEditMealInfo(null)
  }, [appSettings, user, weeklyMenu, todayKey, wasEditPromptShown])

  const closeDailyEditCard = useCallback((markDone = true) => {
    if (markDone && dailyEditMealInfo) {
      markEditPromptDone(dailyEditMealInfo.day, dailyEditMealInfo.meal)
    }
    setShowDailyEditCard(false)
  }, [dailyEditMealInfo, markEditPromptDone])

  // Check auto-edit window every minute
  useEffect(() => {
    checkAutoEditWindow()
    const interval = setInterval(checkAutoEditWindow, 60000)
    return () => clearInterval(interval)
  }, [checkAutoEditWindow])

  // Feedback State
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState({ lunch: false, dinner: false })
  const [lunchStars, setLunchStars] = useState(0)
  const [dinnerStars, setDinnerStars] = useState(0)
  const [lunchComment, setLunchComment] = useState('')
  const [dinnerComment, setDinnerComment] = useState('')
  const STAR_LABELS = { 1: '😞 Poor', 2: '😐 Fair', 3: '🙂 Good', 4: '😄 Great', 5: '🤩 Excellent' }

  useEffect(() => { loadData() }, [user?.id])

  const loadData = async () => {
    try {
      const [{ data: profile }, { data: existingFb }] = await Promise.all([
        supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('daily_feedback').select('*').eq('user_id', user.id).eq('day', todayKey).maybeSingle(),
      ])
      if (profile) setProfileData({ name: profile.name || '', thali_number: profile.thali_number || '', avatar_url: profile.avatar_url || '' })
      if (existingFb) {
        setFeedbackSubmitted({ lunch: !!existingFb.lunch_stars, dinner: !!existingFb.dinner_stars })
        setLunchStars(existingFb.lunch_stars || 0)
        setDinnerStars(existingFb.dinner_stars || 0)
        setLunchComment(existingFb.lunch_comment || '')
        setDinnerComment(existingFb.dinner_comment || '')
      }
    } catch { }
    setStatsLoading(false)
  }

const handleSubmitCombined = async () => {
  if (!lunchStars && !dinnerStars) {
    setFeedbackError('Please rate at least one meal')
    return
  }
  setSubmittingFeedback(true)
  setFeedbackError('')
  try {
    const { error: dbErr } = await supabase.from('daily_feedback').upsert([{
      user_id: user.id, day: todayKey,
      lunch_stars: lunchStars || null, lunch_emoji: lunchStars ? STAR_LABELS[lunchStars] : null,
      dinner_stars: dinnerStars || null, dinner_emoji: dinnerStars ? STAR_LABELS[dinnerStars] : null,
      lunch_comment: lunchComment.trim() || null,
      dinner_comment: dinnerComment.trim() || null,
      created_at: new Date().toISOString()
    }], { onConflict: 'user_id,day' })
    if (dbErr) throw dbErr
    setFeedbackSubmitted({ lunch: !!lunchStars, dinner: !!dinnerStars })
  } catch (err) {
    setFeedbackError('Failed to submit feedback. Please try again.')
    console.error('Feedback submission error:', err)
  } finally { setSubmittingFeedback(false) }
}

  const currentWeekId = getWeekDate()
  // Any meal editable in the current week?
  const isAnyMealEditable = DAYS.some(d => canEditMeal(d, currentWeekId, 'lunch', appSettings, user.id) || canEditMeal(d, currentWeekId, 'dinner', appSettings, user.id))

  if (!weeklyMenu || statsLoading) return <HomePageSkeleton />

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
            <div style={{ fontSize: 13, color: t.textSub, marginTop: 8, fontFamily: "'DM Sans',sans-serif" }}>{surveyOpen ? getSurveyWindowMessage(appSettings, user.id) : (isAnyMealEditable ? 'Daily edit window is live (L < 11am, D < 3:30pm).' : 'Weekly survey is closed. You can still view your responses.')}</div>
          </div>

          <button
            onClick={() => setShowSurvey(true)}
            style={{
              padding: '16px 28px', borderRadius: 16,
              background: (surveyOpen || isAnyMealEditable) ? t.accentGrad : 'rgba(255,255,255,0.05)',
              color: (surveyOpen || isAnyMealEditable) ? '#000' : t.textSub,
              fontSize: 14, fontWeight: 900, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, boxShadow: (surveyOpen || isAnyMealEditable) ? `0 10px 25px ${t.accent}40` : 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: "'DM Sans',sans-serif"
            }}
          >
            <ClipboardList size={18} /> {surveyOpen ? 'Start Weekly Survey' : (isAnyMealEditable ? 'Edit Response' : 'View Responses')}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
          {['lunch', 'dinner'].map(meal => {
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
                {/* Separate comment field per meal */}
                <div style={{ marginTop: 16 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: t.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{meal === 'lunch' ? 'Lunch' : 'Dinner'} Comment</label>
                  {submitted ? (
                    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${t.border}`, color: t.textSub, fontSize: 13, minHeight: 60, boxSizing: 'border-box', fontStyle: 'italic' }}>
                      {meal === 'lunch' ? lunchComment || '—' : dinnerComment || '—'}
                    </div>
                  ) : (
                    <textarea
                      name={`${meal}Comment`}
                      value={meal === 'lunch' ? lunchComment : dinnerComment}
                      onChange={e => meal === 'lunch' ? setLunchComment(e.target.value) : setDinnerComment(e.target.value)}
                      placeholder={`Tell us how ${meal} was...`}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, resize: 'none', outline: 'none', fontFamily: "'DM Sans',sans-serif", minHeight: 60, boxSizing: 'border-box', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
        
        {feedbackSubmitted.lunch && feedbackSubmitted.dinner ? (
          <div style={{ width: '100%', padding: '14px 0', textAlign: 'center', color: t.successText, fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>
            ✅ Feedback submitted for today. Shukran!
          </div>
        ) : (
          <Btn onClick={handleSubmitCombined} disabled={submittingFeedback || (!lunchStars && !dinnerStars)} style={{ width: '100%', height: 52, fontSize: 15, borderRadius: 16 }}>
            {submittingFeedback ? 'Saving...' : 'Submit Feedback'}
          </Btn>
        )}
      </Card>

      {/* Auto Daily Edit Card - shows when edit status is AUTO and current time is within window */}
      {showDailyEditCard && dailyEditMealInfo && (
        <DailyEditCard
          weeklyMenu={weeklyMenu}
          isOpen={showDailyEditCard}
          onClose={() => closeDailyEditCard(true)}
          onComplete={() => closeDailyEditCard(true)}
          appSettings={appSettings}
        />
      )}

      {showSurvey && <SurveyModal onClose={() => { setShowSurvey(false); loadData() }} appSettings={appSettings} />}
    </main>
  )
}

function WeeklyMenuPage() {
  const t = useTheme()
  const weeklyMenu = useWeeklyMenu()
  const todayKey = getTodayKey()
  const [expandedDay, setExpandedDay] = useState(todayKey)
  const { user } = useAuth()
  const [userSurvey, setUserSurvey] = useState(null)

  // Fetch user survey response
  useEffect(() => {
    const fetchSurvey = async () => {
      const { data } = await supabase.from('survey_submissions_flat').select('*').eq('user_id', user.id).eq('week_id', getWeekDate()).maybeSingle()
      setUserSurvey(data)
    }
    fetchSurvey()
  }, [user.id])

  const getDishResp = (day, meal, idx) => {
    if (!userSurvey) return null
    const dayKey = day.substring(0, 3).toLowerCase()
    const mealKey = meal === 'lunch' ? 'l' : 'd'
    const col = `${dayKey}_${mealKey}_dish_${idx + 1}`
    const val = userSurvey[col]
    if (val === 'Yes') return 'yes'
    if (val === 'No') return 'no'
    if (typeof val === 'string' && val.endsWith('%')) return parseInt(val.replace('%', ''))
    if (typeof val === 'string' && /^\d+$/.test(val)) return parseInt(val)
    return null
  }

  const jumpToDay = (day) => {
    setExpandedDay(day)
    const el = document.getElementById(`day-card-${day}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (!weeklyMenu) return <WeeklyMenuSkeleton />

  return (
    <main style={{ flex: 1, padding: '16px 16px calc(110px + env(safe-area-inset-bottom, 20px))', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Dynamic Header with Dropdown */}
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
                      {menu.lunch.length > 0 ? menu.lunch.map((dish, idx) => {
                        const resp = getDishResp(day, 'lunch', idx)
                        return (
                          <div key={dish} style={{
                            padding: '8px 16px', borderRadius: 14,
                            background: resp === 'yes' ? 'rgba(76, 175, 80, 0.1)' : resp === 'no' ? 'rgba(244, 67, 54, 0.1)' : t.inputBg,
                            border: `1px solid ${resp === 'yes' ? '#4CAF50' : resp === 'no' ? '#F44336' : t.border}`,
                            fontSize: 13, fontWeight: 600, color: t.textBody,
                            display: 'flex', alignItems: 'center', gap: '8px'
                          }}>
                            {dish}
                            {resp !== null && (
                              <span style={{ fontWeight: '800', color: resp === 'yes' ? '#4CAF50' : resp === 'no' ? '#F44336' : t.accent }}>
                                {resp === 'yes' ? '✅' : resp === 'no' ? '❌' : (typeof resp === 'number' && resp <= 100 && resp % 25 === 0 ? `${resp}%` : `${resp}`)}
                              </span>
                            )}
                          </div>
                        )
                      }) : <div style={{ fontSize: 12, color: t.textSub, fontStyle: 'italic' }}>Preparation in progress...</div>}
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
                      {menu.dinner.length > 0 ? menu.dinner.map((dish, idx) => {
                        const resp = getDishResp(day, 'dinner', idx)
                        return (
                          <div key={dish} style={{
                            padding: '8px 16px', borderRadius: 14,
                            background: resp === 'yes' ? 'rgba(76, 175, 80, 0.1)' : resp === 'no' ? 'rgba(244, 67, 54, 0.1)' : t.inputBg,
                            border: `1px solid ${resp === 'yes' ? '#4CAF50' : resp === 'no' ? '#F44336' : t.border}`,
                            fontSize: 13, fontWeight: 600, color: t.textBody,
                            display: 'flex', alignItems: 'center', gap: '8px'
                          }}>
                            {dish}
                            {resp !== null && (
                              <span style={{ fontWeight: '800', color: resp === 'yes' ? '#4CAF50' : resp === 'no' ? '#F44336' : t.accent }}>
                                {resp === 'yes' ? '✅' : resp === 'no' ? '❌' : (typeof resp === 'number' && resp <= 100 && resp % 25 === 0 ? `${resp}%` : `${resp}`)}
                              </span>
                            )}
                          </div>
                        )
                      }) : <div style={{ fontSize: 12, color: t.textSub, fontStyle: 'italic' }}>Stay tuned for the menu...</div>}
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

const RCard = ({ activeRequest, type, t, children }) => (
  <div style={{ marginBottom: 10, borderRadius: 14, border: `1px solid ${activeRequest === type ? t.borderActive : t.border}`, background: activeRequest === type ? t.cardActive : t.card, overflow: 'hidden' }}>{children}</div>
)

const HdrBtn = ({ type, emoji, label, desc, activeRequest, openRequest, t }) => (
  <button onClick={() => openRequest(type)} style={{ width: '100%', padding: 15, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}>
    <div style={{ width: 44, height: 44, borderRadius: 12, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{emoji}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: activeRequest === type ? t.accent : t.text, fontFamily: "'DM Sans',sans-serif" }}>{label}</div>
      <div style={{ fontSize: 12, color: t.textSub, marginTop: 1, fontFamily: "'DM Sans',sans-serif" }}>{desc}</div>
    </div>
    {activeRequest === type ? <ChevronUp size={14} color={t.accent} /> : <ChevronDown size={14} color={t.accent} />}
  </button>
)

function ThaliRequestsSection() {
  const t = useTheme(), { user } = useAuth()
  const [activeRequest, setActiveRequest] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [resumeFrom, setResumeFrom] = useState('')
  const [resumeTo, setResumeTo] = useState('')
  const [resumeMealType, setResumeMealType] = useState(null)
  const [stopFrom, setStopFrom] = useState('')
  const [stopTo, setStopTo] = useState('')
  const [stopMealType, setStopMealType] = useState(null)
  const [miqaatOption, setMiqaatOption] = useState(null)
  const [extraItems, setExtraItems] = useState([{ name: '', qty: 1 }])
  const today = new Date().toISOString().split('T')[0]
  const inp = { width: '100%', padding: '11px 13px', borderRadius: 11, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif" }

  const resetAll = () => { setResumeFrom(''); setResumeTo(''); setResumeMealType(null); setStopFrom(''); setStopTo(''); setStopMealType(null); setMiqaatOption(null); setExtraItems([{ name: '', qty: 1 }]); setError(''); setSuccess('') }
  const openRequest = (type) => { resetAll(); setActiveRequest(activeRequest === type ? null : type) }
  const addExtraItem = () => setExtraItems(prev => [...prev, { name: '', qty: 1 }])
  const removeExtraItem = i => setExtraItems(prev => prev.filter((_, idx) => idx !== i))
  const updateExtraItem = (i, field, val) => setExtraItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  const handleSubmit = async (type) => {
    setError(''); setSuccess(''); setSubmitting(true)
    try {
      let payload = { user_id: user.id, request_type: type, status: 'pending' }
      if (type === 'resume') {        if (!resumeMealType) throw new Error('Please select a meal option (Lunch, Dinner, or Both)');        if (!resumeFrom) throw new Error('Please select a date');        payload = { ...payload, from_date: resumeFrom, to_date: null, meal_type: resumeMealType }      }
      else if (type === 'stop') {        if (!stopMealType) throw new Error('Please select a meal option (Lunch, Dinner, or Both)');        if (!stopFrom || !stopTo) throw new Error('Please select both dates');        payload = { ...payload, from_date: stopFrom, to_date: stopTo, meal_type: stopMealType }      }
      else if (type === 'miqaat') { if (!miqaatOption) throw new Error('Please select an option'); payload = { ...payload, details: `Option ${miqaatOption}` } }
      else if (type === 'extra') { const valid = extraItems.filter(i => i.name.trim()); if (!valid.length) throw new Error('Please add at least one item'); payload = { ...payload, extra_items: valid } }
      const { error: dbErr } = await supabase.from('thali_requests').insert([payload])
      if (dbErr) throw dbErr
      
      // Send push notification for request submission
      try {
        const typeLabels = { resume: 'Resume Thali', stop: 'Stop Thali', extra: 'Extra Food', miqaat: 'Miqaat Pirsu' }
        const typeLabel = typeLabels[type] || type
        await supabase.functions.invoke('sendPush', {
          body: {
            title: 'Al-Mawaid · Request received',
            body: `Your ${typeLabel} request is with the kitchen team. We’ll notify you when it’s reviewed.`,
            target_type: 'specific',
            user_id: user.id,
            url: '/post'
          }
        })
      } catch (notifyErr) {
        console.warn('Request submission notification failed:', notifyErr)
      }
      
      setSuccess(`✅ ${type === 'resume' ? 'Resume' : type === 'stop' ? 'Stop' : 'Extra food'} request submitted!`)
      resetAll(); setActiveRequest(null)
    } catch (err) { setError(err.message) } finally { setSubmitting(false) }
  }



  return (
    <div>
      {success && <div style={{ marginBottom: 12, padding: 13, borderRadius: 12, background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.successText, fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{success}</div>}
      <RCard activeRequest={activeRequest} type="resume" t={t}>
        <HdrBtn activeRequest={activeRequest} openRequest={openRequest} t={t} type="resume" emoji="▶️" label="Resume Thali" desc="Restart your thali service" />
        {activeRequest === 'resume' && (
          <div style={{ padding: '0 16px 16px' }}>
            {!resumeMealType ? (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>SELECT MEAL TO RESUME</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['lunch', 'dinner', 'both'].map(m => (
                    <button key={m} onClick={() => setResumeMealType(m)}
                      style={{ flex: 1, padding: '12px 8px', borderRadius: 11, border: `1.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", textTransform: 'capitalize' }}>
                      {m === 'both' ? 'Both' : m}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accentBorder}`, textAlign: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>Meal: {resumeMealType === 'both' ? 'Both (Lunch & Dinner)' : resumeMealType.charAt(0).toUpperCase() + resumeMealType.slice(1)}</span>
                  <button onClick={() => setResumeMealType(null)} style={{ marginLeft: 10, background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>Change</button>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>RESUME FROM</label>
                  <input type="date" name="resumeFrom" value={resumeFrom} min={today} onChange={e => setResumeFrom(e.target.value)} style={inp} />
                </div>
                {error && <ErrorBanner msg={error} />}
                <button onClick={() => handleSubmit('resume')} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting...' : 'Submit Resume Request'}</button>
              </>
            )}
          </div>
        )}
      </RCard>
      <RCard activeRequest={activeRequest} type="stop" t={t}>
        <HdrBtn activeRequest={activeRequest} openRequest={openRequest} t={t} type="stop" emoji="⏹️" label="Stop Thali" desc="Pause your thali service" />
        {activeRequest === 'stop' && (
          <div style={{ padding: '0 16px 16px' }}>
            {!stopMealType ? (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>SELECT MEAL TO STOP</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['lunch', 'dinner', 'both'].map(m => (
                    <button key={m} onClick={() => setStopMealType(m)}
                      style={{ flex: 1, padding: '12px 8px', borderRadius: 11, border: `1.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", textTransform: 'capitalize' }}>
                      {m === 'both' ? 'Both' : m}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accentBorder}`, textAlign: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>Meal: {stopMealType === 'both' ? 'Both (Lunch & Dinner)' : stopMealType.charAt(0).toUpperCase() + stopMealType.slice(1)}</span>
                  <button onClick={() => setStopMealType(null)} style={{ marginLeft: 10, background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>Change</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>FROM</label><input type="date" name="stopFrom" value={stopFrom} min={today} onChange={e => setStopFrom(e.target.value)} style={inp} /></div>
                  <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>TO</label><input type="date" name="stopTo" value={stopTo} min={stopFrom || today} onChange={e => setStopTo(e.target.value)} style={inp} /></div>
                </div>
                {error && <ErrorBanner msg={error} />}
                <button onClick={() => handleSubmit('stop')} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : 'linear-gradient(135deg,#e05555,#c03030)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting...' : 'Submit Stop Request'}</button>
              </>
            )}
          </div>
        )}
      </RCard>
      <RCard activeRequest={activeRequest} type="miqaat" t={t}>
        <HdrBtn activeRequest={activeRequest} openRequest={openRequest} t={t} type="miqaat" emoji="🕌" label="Miqaat Pirsu" desc="Select your Miqaat option" />
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
      <RCard activeRequest={activeRequest} type="extra" t={t}>
        <HdrBtn activeRequest={activeRequest} openRequest={openRequest} t={t} type="extra" emoji="➕" label="Add Extra Food" desc="Request additional items" />
        {activeRequest === 'extra' && (
          <div style={{ padding: '0 16px 16px' }}>
            {extraItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input type="text" name={`extraItem${i}`} value={item.name} placeholder={`Item ${i + 1}`} onChange={e => updateExtraItem(i, 'name', e.target.value)} style={{ ...inp, flex: 1 }} />
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
        <RecentRequestsList />
      </div>
    </div>
  )
}

function RecentRequestsList() {
  const t = useTheme(), { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPending = async () => {
    if (!user?.id) return
    const { data } = await supabase.from('thali_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5)
    setRequests(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchPending()
    const channel = supabase
      .channel('recent-requests-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'thali_requests', filter: `user_id=eq.${user.id}` }, () => {
        fetchPending()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user.id])

  const statusColor = (s) => s === 'pending' ? '#d4882a' : s === 'approved' ? '#5eba82' : '#e05555'

  if (loading) return <Spinner />
  if (requests.length === 0) return <div style={{ textAlign: 'center', padding: 20, color: t.textSub, fontSize: 13, opacity: 0.6 }}>No active requests.</div>

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

  useEffect(() => {
    loadQueries()
    const channel = supabase
      .channel('queries-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queries', filter: `user_id=eq.${user.id}` }, () => {
        loadQueries()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])
  const loadQueries = async () => {
    try {
      const { data } = await supabase.from('queries')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(20)

      setQueries(data || [])
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
        <textarea name="query" value={comment} onChange={e => setComment(e.target.value)} style={{ width: '100%', minHeight: 78, padding: 12, borderRadius: 11, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: "'DM Sans',sans-serif", marginBottom: 10 }} placeholder="Describe your query or issue…" />
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
      {loading ? <ListPageSkeleton count={3} /> : queries.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: t.textSub, fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>No queries yet.</div> : queries.map(q => (
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
function ProfilePage({ theme, setTheme, markRead, appSettings }) {
  const [activeSubPage, setActiveSubPage] = useState('main')
  if (activeSubPage === 'surveys') return <MySurveysPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'requests') return <MyRequestsPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'khidmat') return <KhidmatTeamPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'notifications') return <NotificationsPage onBack={() => setActiveSubPage('main')} markRead={markRead} appSettings={appSettings} />
  if (activeSubPage === 'support') return <SupportTicketsPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'about') return <AboutPage onBack={() => setActiveSubPage('main')} />
  return <ProfileMainPage theme={theme} setTheme={setTheme} onNav={setActiveSubPage} />
}

function ProfileMainPage({ theme, setTheme, onNav }) {
  const t = useTheme(), { user, signOut } = useAuth()
  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)
  const [helpline, setHelpline] = useState('')
  useEffect(() => {
    supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => { 
      if (data) setProfileData(data)
    }).finally(() => setLoading(false))
    supabase.from("app_settings").select("*").eq("key", "helpline_number").maybeSingle().then(({ data }) => { if (data) setHelpline(data.value) })
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

  if (loading) return <ProfileSkeleton />
  return (
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <Card active style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ width: 84, height: 84, margin: '0 auto 14px' }}><Avatar avatarUrl={profileData?.avatar_url} name={profileData?.name} email={user.email} size={84} /></div>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display',serif" }}>{profileData?.name || 'Thali User'}</h2>
        <div style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginBottom: 6 }}>{user.email}</div>
        {profileData?.thali_number && <div style={{ display: 'inline-block', padding: '4px 16px', borderRadius: 20, background: t.accentBg, border: `1px solid ${t.accentBorder}`, marginBottom: 6 }}><span style={{ fontSize: 13, color: t.accent, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>Thali #{profileData.thali_number}</span></div>}
        {profileData?.phone && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}><Phone size={12} color={t.textSub} /><span style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{profileData.phone}</span></div>}
        {profileData?.address && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}><MapPin size={12} color={t.textSub} /><span style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{profileData.address}</span></div>}
        {profileData?.snack_defaults && Object.values(profileData.snack_defaults).some(v => v > 0) && (
          <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 12, background: t.accentBg, border: `1px solid ${t.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin Allotted Count:</span>
            {Object.entries(profileData.snack_defaults).map(([key, val]) => (
              <span key={key} style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>Dish {key.replace('dish_', '')}: <strong>{val}</strong></span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: t.textSub, marginTop: 10, opacity: .5, fontFamily: "'DM Sans',sans-serif" }}>Thali User since {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>

      </Card>
      <SectionLabel>My Activity</SectionLabel>
      <NavCard label="My Identity QR" icon={<QrCode size={19} color="#fff" />} desc="Show your QR code for thali collection" onClick={() => setShowQR(true)} />
      <NavCard label="My Surveys" icon={<ClipboardList size={19} color="#fff" />} desc="View your weekly survey responses" onClick={() => onNav('surveys')} />
      <NavCard label="My Requests" icon={<img src="/al-mawaid.png" alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />} desc="Resume, stop & extra food requests" onClick={() => onNav('requests')} />
      <NavCard label="Khidmat Guzaar" icon={<Users size={19} color="#fff" />} desc="Meet our Al-Mawaid team" onClick={() => onNav('khidmat')} />
      <NavCard label="Alerts" icon={<Bell size={19} color="#fff" />} desc="See notices and important updates" onClick={() => onNav('notifications')} />
      <NavCard label="Support Ticket" icon={<LifeBuoy size={19} color="#fff" />} desc="Raise general, thali, and delivery issues" onClick={() => onNav('support')} />

      {helpline && (
        <a href={`https://wa.me/${helpline.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', marginBottom: 10 }}>
          <button style={{ width: '100%', padding: '13px 16px', borderRadius: 14, border: '1px solid rgba(37,211,102,0.3)', background: 'rgba(37,211,102,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s', textAlign: 'left' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MessageCircle size={19} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>WhatsApp Helpline</div>
              <div style={{ fontSize: 12, color: '#25D366', marginTop: 1, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>{helpline} — Tap to chat</div>
            </div>
            <MessageCircle size={15} color="#25D366" />
          </button>
        </a>
      )}

      <NavCard label="About" icon={<Info size={19} color="#fff" />} desc="Learn more about the app and services" onClick={() => onNav('about')} />
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
            <p style={{ fontSize: 12, color: t.textSub, marginTop: 16, lineHeight: 1.65 }}>Present this code at the distribution counter to verify your thali collection status.</p>
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
    supabase.from('survey_submissions_flat').select('*').eq('user_id', user.id).order('week_id', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (!data) return setSurveys({})
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
                    dishResponses[d] = val === 'Yes' ? 'yes' : val === 'No' ? 'no' : (() => { const n = parseInt(val); return isNaN(n) ? val : n })()
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

  // Realtime subscription: refresh surveys on any change
  useEffect(() => {
    const subscription = supabase.channel('survey_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_submissions_flat' }, payload => {
        const fetchData = async () => {
          const { data: rows } = await supabase.from('survey_submissions_flat').select('*').eq('user_id', user.id).order('week_id', { ascending: false }).limit(1).maybeSingle();
          if (!rows) return setSurveys({});
          const grouped = {};
          DAYS.forEach(day => {
            const dayKey = day.substring(0, 3).toLowerCase();
            ['lunch', 'dinner'].forEach(meal => {
              const mealKey = meal === 'lunch' ? 'l' : 'd';
              const status = rows[`${dayKey}_${mealKey}_status`];
              if (status) {
                const dishResponses = {};
                const dishes = weeklyMenu[day]?.[meal] || [];
                dishes.forEach((d, i) => {
                  const val = rows[`${dayKey}_${mealKey}_dish_${i + 1}`];
                  if (val !== undefined && val !== null) {
                    dishResponses[d] = val === 'Yes' ? 'yes' : val === 'No' ? 'no' : (() => { const n = parseInt(val); return isNaN(n) ? val : n })();
                  }
                });
                if (!grouped[day]) grouped[day] = {};
                grouped[day][meal] = {
                  wants_food: status === 'Applied',
                  dish_responses: dishResponses,
                  edit_count: (rows.edit_metadata || {})[`${dayKey}_${mealKey}`] || 0
                };
              }
            });
          });
          setSurveys(grouped);
        };
        fetchData();
      })
      .subscribe();
    return () => supabase.removeChannel(subscription);
  }, [user.id, weeklyMenu]);

  return (
    <main style={{ flex: 1, padding: '16px 16px 160px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <BackHeader title="My Surveys" onBack={onBack} />
      {loading ? <ListPageSkeleton title="My Surveys" count={6} /> : DAYS.map(day => {
        const dayData = surveys[day]
        return (
          <Card key={day} active style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <img src="/al-mawaid.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif" }}>{weeklyMenu[day]?.en || day}</div>
            </div>
            {['lunch', 'dinner'].map(meal => {
              const r = dayData?.[meal] || {};
              return (
                <div key={meal} style={{ marginBottom: 8, padding: 11, background: t.inputBg, borderRadius: 10, border: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>{meal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}</span>
                    <span style={{ fontSize: 10, color: (r.edit_count || 0) < 1 ? t.accent : t.textSub, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>{r.edit_count === undefined ? '' : (r.edit_count || 0) === 0 ? 'Not edited yet' : `Edited ${r.edit_count} time(s)`}</span>
                  </div>
                  {r.wants_food !== undefined ? (
                    <>
                      <div style={{ fontSize: 13, color: r.wants_food ? t.successText : '#e05555', fontWeight: 700, fontFamily: "'DM Sans',sans-serif", marginBottom: r.wants_food ? 6 : 0 }}>{r.wants_food ? '✅ Requested Food' : '❌ Skipped'}</div>
                      {r.wants_food && r.dish_responses && Object.entries(r.dish_responses).map(([dish, val]) => (
                        <div key={dish} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${t.border}` }}>
                          <span style={{ fontSize: 12, color: t.textBody, fontFamily: "'DM Sans',sans-serif" }}>{dish}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>{val === 'yes' ? '✅' : val === 'no' ? '❌' : `${val}%`}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: t.textSub, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>No response</div>
                  )}
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
  const [filterTab, setFilterTab] = useState('all')
  const [requests, setRequests] = useState([])
  const [queries, setQueries] = useState([])
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      const [reqRes, queryRes] = await Promise.all([
        supabase.from('thali_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('queries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ])
      if (!reqRes.error) setRequests(reqRes.data || [])
      if (!queryRes.error) {
        const allQueries = queryRes.data || []
        setQueries(allQueries.filter(q => !(q.comment || '').startsWith('[Support Ticket]')))
        setTickets(allQueries.filter(q => (q.comment || '').startsWith('[Support Ticket]')))
      }
      setLoading(false)
    }
    fetchAll()
    const ch = supabase.channel('my-requests-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'thali_requests', filter: `user_id=eq.${user.id}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queries', filter: `user_id=eq.${user.id}` }, fetchAll)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user.id])

  const typeLabel = (type) => {
    const labels = { resume: 'Resume Thali', stop: 'Stop Thali', miqaat: 'Miqaat Pirsu', extra: 'Extra Food' }
    return labels[type] || type
  }
  const statusColor = (s) => s === 'pending' || s === 'open' || s === 'in_progress' ? '#d4882a' : s === 'approved' || s === 'resolved' ? '#5eba82' : '#e05555'
  const statusIcon = (s) => s === 'pending' || s === 'open' ? '⏳' : s === 'in_progress' ? '🔄' : s === 'approved' || s === 'resolved' ? '✅' : s === 'rejected' || s === 'closed' ? '❌' : ''

  const tabs = [
    { id: 'all', label: 'All Activity' },
    { id: 'requests', label: `Requests (${requests.length})` },
    { id: 'queries', label: `Queries (${queries.length})` },
    { id: 'tickets', label: `Tickets (${tickets.length})` },
  ]

  const renderRequestCard = (r) => (
    <Card key={r.id} style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{typeLabel(r.request_type)}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: `${statusColor(r.status)}20`, color: statusColor(r.status), border: `1px solid ${statusColor(r.status)}40` }}>
              {statusIcon(r.status)} {r.status?.toUpperCase()}
            </span>
          </div>
          {r.meal_type && <div style={{ fontSize: 12, color: t.textSub, marginTop: 4 }}>Meal: {r.meal_type}</div>}
          {r.from_date && <div style={{ fontSize: 12, color: t.textSub, marginTop: 4 }}>{r.from_date} {r.to_date ? `\u2192 ${r.to_date}` : ''}</div>}
          {r.extra_items && <div style={{ fontSize: 12, color: t.textSub, marginTop: 4 }}>{r.extra_items.map(i => `${i.name} x${i.qty}`).join(', ')}</div>}
          {r.details && <div style={{ fontSize: 12, color: t.textSub, marginTop: 4 }}>{r.details}</div>}
        </div>
      </div>
      {r.admin_note && <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: t.accentBg, fontSize: 12, color: t.accent }}>Note: {r.admin_note}</div>}
      <div style={{ fontSize: 10, color: t.textSub, marginTop: 8, opacity: .5 }}>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
    </Card>
  )

  const renderQueryCard = (q, isTicket = false) => (
    <Card key={q.id} style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {q.subject && <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{q.subject}</span>}
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: `${statusColor(q.status)}20`, color: statusColor(q.status), border: `1px solid ${statusColor(q.status)}40` }}>
              {statusIcon(q.status)} {q.status?.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: 12, color: t.textSub, marginTop: 4 }}>{new Date(q.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>
      {q.comment && <p style={{ margin: '6px 0 0', fontSize: 13, color: t.textBody, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
        {isTicket ? q.comment.replace('[Support Ticket]\n', '') : q.comment}
      </p>}
      {q.media && q.media.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {q.media.map((m, i) => m.path && m.type === 'image' && <img key={i} src={m.path} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />)}
        </div>
      )}
      {q.admin_reply && <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: t.accentBg, fontSize: 12, color: t.accent }}>Reply: {q.admin_reply}</div>}
    </Card>
  )

  if (loading) return <RequestsSkeleton title="My Requests" />

  const hasAny = requests.length > 0 || queries.length > 0 || tickets.length > 0

  return (
    <main style={{ flex: 1, padding: '16px 16px 160px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <BackHeader title="My Requests" onBack={onBack} />

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: t.card, borderRadius: 13, padding: 5, border: `1px solid ${t.border}`, overflowX: 'auto' }}>
        {tabs.map(({ id, label }) => (
          <button key={id} onClick={() => setFilterTab(id)}
            style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: 'none', whiteSpace: 'nowrap', background: filterTab === id ? t.accentGrad : 'transparent', color: filterTab === id ? '#fff' : t.textSub, fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.25s' }}>
            {label}
          </button>
        ))}
      </div>

      {!hasAny ? <EmptyState msg="No activity yet. Raise a request, query, or support ticket to see it here." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Pending Requests */}
          {(filterTab === 'all' || filterTab === 'requests') && requests.filter(r => r.status === 'pending').length > 0 && (
            <div>
              <SectionLabel>Pending Requests</SectionLabel>
              {requests.filter(r => r.status === 'pending').map(renderRequestCard)}
            </div>
          )}

          {/* Approved Requests */}
          {(filterTab === 'all' || filterTab === 'requests') && requests.filter(r => r.status === 'approved').length > 0 && (
            <div style={{ marginTop: filterTab === 'all' ? 16 : 0 }}>
              {filterTab === 'all' && requests.filter(r => r.status === 'pending').length > 0 && <div style={{ height: 1, background: t.border, marginBottom: 16 }} />}
              <SectionLabel>Approved Requests</SectionLabel>
              {requests.filter(r => r.status === 'approved').map(renderRequestCard)}
            </div>
          )}

          {/* Rejected Requests */}
          {(filterTab === 'all' || filterTab === 'requests') && requests.filter(r => r.status === 'rejected').length > 0 && (
            <div style={{ marginTop: filterTab === 'all' ? 16 : 0 }}>
              {(requests.filter(r => r.status === 'pending').length > 0 || requests.filter(r => r.status === 'approved').length > 0) && filterTab === 'all' && <div style={{ height: 1, background: t.border, marginBottom: 16 }} />}
              <SectionLabel>Rejected Requests</SectionLabel>
              {requests.filter(r => r.status === 'rejected').map(renderRequestCard)}
            </div>
          )}

          {filterTab === 'requests' && requests.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: t.textSub, fontSize: 13 }}>No thali requests yet.</div>}

          {/* Queries */}
          {(filterTab === 'all' || filterTab === 'queries') && queries.length > 0 && (
            <div style={{ marginTop: (filterTab === 'all' && requests.length > 0) ? 16 : 0 }}>
              {filterTab === 'all' && requests.length > 0 && <div style={{ height: 1, background: t.border, marginBottom: 16 }} />}
              <SectionLabel>Queries ({queries.filter(q => q.status === 'open' || q.status === 'in_progress').length} open)</SectionLabel>
              {queries.map(q => renderQueryCard(q, false))}
              {queries.length === 0 && filterTab === 'queries' && <EmptyState msg="No queries." />}
            </div>
          )}

          {/* Support Tickets */}
          {(filterTab === 'all' || filterTab === 'tickets') && tickets.length > 0 && (
            <div style={{ marginTop: (filterTab === 'all' && (requests.length > 0 || queries.length > 0)) ? 16 : 0 }}>
              {(requests.length > 0 || queries.length > 0) && filterTab === 'all' && <div style={{ height: 1, background: t.border, marginBottom: 16 }} />}
              <SectionLabel>Support Tickets ({tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length} open)</SectionLabel>
              {tickets.map(t => renderQueryCard(t, true))}
              {tickets.length === 0 && filterTab === 'tickets' && <EmptyState msg="No support tickets." />}
            </div>
          )}
        </div>
      )}
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
      {loading ? <KhidmatTeamSkeleton /> : staff.length === 0 ? <EmptyState msg="No staff profiles available." /> : staff.map(member => {
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

function NotificationsPage({ onBack, markRead, appSettings }) {
  const t = useTheme(), { user } = useAuth()
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNotices = async () => {
      const { data } = await supabase
        .from('notices')
        .select('*')
        .or(`target_user_id.is.null,target_user_id.eq.${user.id}`)
        .lte('scheduled_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(30)

      if (data) {
        try {
          const dayNum = new Date().getDay()
          const h = new Date().getHours()
          const weekId = getWeekDate()
          let isEating = false

          if (dayNum !== 0) {
            const days = ['', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
            const today = days[dayNum]
            const mealName = h < 15 ? 'lunch' : 'dinner'
            const dayKey = today.substring(0, 3).toLowerCase()
            const mealKey = mealName === 'lunch' ? 'l' : 'd'
            
            const { data: subData } = await supabase
              .from('survey_submissions_flat')
              .select(`${dayKey}_${mealKey}_status`)
              .eq('user_id', user.id)
              .eq('week_id', weekId)
              .maybeSingle()
               
            const status = subData ? subData[`${dayKey}_${mealKey}_status`] : 'Not Submitted'
            isEating = status === 'Applied'
          }
          
          const now = new Date()
          const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)
          
          const filtered = data.filter(notice => {
            const noticeDate = new Date(notice.created_at || notice.scheduled_at)
            if (noticeDate < fortyEightHoursAgo) return false
            const toneStr = notice.tone || ''
            if (toneStr.includes(':opt_in')) return isEating
            if (toneStr.includes(':opt_out')) return !isEating
            return true
          })
          setNotices(filtered)
        } catch {
          setNotices(data)
        }
      } else {
        setNotices([])
      }
      setLoading(false)
      if (markRead) markRead()
    }
    fetchNotices()
  }, [user.id, markRead])

  const timeAgo = (dateStr) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const groupByDate = (items) => {
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    const groups = { today: [], yesterday: [], earlier: [] }
    items.forEach(n => {
      const d = new Date(n.created_at).toDateString()
      if (d === today) groups.today.push(n)
      else if (d === yesterday) groups.yesterday.push(n)
      else groups.earlier.push(n)
    })
    return groups
  }

  const surveyMsg = isSurveyOpen(appSettings, user.id)
    ? 'Your weekly meal survey is open now. Submit your lunch and dinner choices on time.'
    : getSurveyWindowMessage(appSettings, user.id)

  return (
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {onBack && <BackHeader title="Alerts" onBack={onBack} />}

      {/* Premium Survey Card */}
      <div style={{
        marginBottom: 20, padding: 18, borderRadius: 18,
        background: `linear-gradient(135deg, ${t.accent}10, ${t.accent}02)`,
        border: `1px solid ${t.accent}25`,
        display: 'flex', gap: 14, alignItems: 'flex-start',
        boxShadow: `0 4px 20px rgba(0,0,0,0.2)`
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: `${t.accent}20`, border: `1px solid ${t.accent}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <Bell size={20} color={t.accent} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.text, marginBottom: 4, fontFamily: "'DM Sans',sans-serif" }}>Weekly Survey Window</div>
          <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>{surveyMsg}</div>
        </div>
      </div>

      {/* Broadcasts */}
      {loading ? <NotificationsSkeleton /> : notices.length === 0 ? (
        <EmptyState msg="No broadcasts yet. Stay tuned for updates from Al-Mawaid." />
      ) : (() => {
        const groups = groupByDate(notices)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['today', 'yesterday', 'earlier'].map(section => {
              const items = groups[section]
              if (items.length === 0) return null
              const label = section === 'today' ? 'Today' : section === 'yesterday' ? 'Yesterday' : 'Earlier'
              return (
                <div key={section} style={{ marginBottom: 4 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 800, color: t.textSub,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    padding: '12px 4px 8px'
                  }}>{label}</div>
                  {items.map(item => {
                    const toneColor = (item.tone || '').split(':')[0] || t.accent
                    const initial = (item.sender_name || 'A').charAt(0).toUpperCase()
                    const hasMedia = item.media && item.media[0]
                    return (
                      <div key={item.id} style={{
                        marginBottom: 10, borderRadius: 18, overflow: 'hidden',
                        background: `linear-gradient(135deg, ${toneColor}06, ${t.card})`,
                        border: `1px solid ${toneColor}18`,
                        boxShadow: `0 2px 12px rgba(0,0,0,0.12)`,
                        transition: 'all 0.25s'
                      }}>
                        {hasMedia && (
                          <div style={{
                            width: '100%', height: 140,
                            background: `url(${item.media[0]}) center/cover no-repeat`,
                            borderBottom: `1px solid ${toneColor}15`
                          }} />
                        )}
                        <div style={{ padding: 16 }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                              background: `linear-gradient(135deg, ${toneColor}, ${toneColor}77)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#000', fontSize: 14, fontWeight: 900,
                              boxShadow: `0 4px 10px ${toneColor}25`
                            }}>
                              {initial}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: toneColor }}>
                                  {item.sender_name || 'Al-Mawaid'}
                                </span>
                                <span style={{ fontSize: 10, color: t.textSub, opacity: 0.5 }}>
                                  {timeAgo(item.created_at)}
                                </span>
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: t.text, marginBottom: 4, fontFamily: "'DM Sans',sans-serif" }}>
                                {item.title}
                              </div>
                              <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>
                                {item.body}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div style={{ height: 2, background: `linear-gradient(90deg, ${toneColor}, transparent)` }} />
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })()}
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

  useEffect(() => {
    loadTickets()
    const channel = supabase
      .channel('tickets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queries', filter: `user_id=eq.${user.id}` }, () => {
        loadTickets()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])
  const loadTickets = async () => {
    try {
      const { data } = await supabase.from('queries')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(30)

      const filtered = (data || []).filter(item => {
        return (item.comment || '').startsWith('[Support Ticket]')
      }).slice(0, 20)

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
        <input name="ticketSubject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={{ ...inputStyle, marginBottom: 10 }} />
        <textarea name="ticketDetails" value={details} onChange={e => setDetails(e.target.value)} placeholder="Describe your problem" style={{ ...inputStyle, minHeight: 110, resize: 'vertical', marginBottom: 10 }} />
        {error && <ErrorBanner msg={error} />}
        {success && <div style={{ marginBottom: 10, padding: 11, borderRadius: 10, background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.successText, fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{success}</div>}
        <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting...' : 'Submit Support Ticket'}</button>
      </Card>
      <SectionLabel>Recent Tickets</SectionLabel>
      {loading ? <ListPageSkeleton title="Support Tickets" count={4} /> : tickets.length === 0 ? <EmptyState msg="No support tickets raised yet." /> : tickets.map(ticket => (
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


// ══════════════════════════════════════════════════════════════
// ADMIN DASHBOARD — Dynamic UI with navigated home screen buttons
// ══════════════════════════════════════════════════════════════

// Legacy AdminBridge removed - handled by MainRouter

// ══════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════

export default function App() {
  const [session, setSession] = useState(undefined)
  const [mockUser, setMockUser] = useState(() => {
    const remember = localStorage.getItem('almawaid_remember_me') !== 'false'
    if (!remember) return null
    const saved = localStorage.getItem('al_mawaid_mock_user')
    return saved ? JSON.parse(saved) : null
  })
  const [portalRole, setPortalRole] = useState(() => {
    const remember = localStorage.getItem('almawaid_remember_me') !== 'false'
    if (!remember) return null
    return localStorage.getItem('al_mawaid_portal') || null
  })

  const navigate = useNavigate()

  const signOut = useCallback(async () => {
    setMockUser(null)
    setPortalRole(null)
    localStorage.removeItem('al_mawaid_portal')
    localStorage.removeItem('al_mawaid_mock_user')
        localStorage.removeItem('al-mawaid-auth-token')
    await supabase.auth.signOut()
  }, [])

  const handleRoleLogin = useCallback((role, sess) => {
    const remember = localStorage.getItem('almawaid_remember_me') !== 'false'
    if (remember) {
      localStorage.setItem('al_mawaid_portal', role)
      if (sess?.user) {
        localStorage.setItem('al_mawaid_mock_user', JSON.stringify(sess.user))
      }
    }
    setMockUser(sess?.user || null)
    setPortalRole(role)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error && error.message?.includes('Refresh Token Not Found')) {
        console.warn('[Auth] Refresh token missing, signing out...');
        signOut();
      } else {
        setSession(session)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess)
      if (!sess) {
        setPortalRole(null);
        setMockUser(null);
        localStorage.removeItem('al_mawaid_portal')
        localStorage.removeItem('al_mawaid_mock_user')
        localStorage.removeItem('al-mawaid-auth-token')
      }
    })
    return () => subscription.unsubscribe()
  }, [signOut])

  useEffect(() => {
    if (portalRole === 'admin' && !window.location.pathname.startsWith('/admin')) {
      navigate('/admin', { replace: true })
    }
  }, [portalRole, navigate])

  // Push notifications removed

  if (session === undefined && !mockUser) {
    return (
      <div style={{ minHeight: '100vh', background: '#0c0c14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spin" style={{ width: 36, height: 36, border: '2.5px solid rgba(139,92,246,0.2)', borderTop: '2.5px solid #a78bfa', borderRadius: '50%' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}body{margin:0}`}</style>
      </div>
    )
  }

  if (!session && !mockUser) return <LoginPage onRoleLogin={handleRoleLogin} />

  const authValue = { user: session?.user || mockUser, signOut }

  if (portalRole === 'admin') return null

  if (['khidmat_guzar', 'supervisor', 'khidmat'].includes(portalRole)) {
    return (
      <AuthCtx.Provider value={authValue}>
        <ThemeCtx.Provider value={THEMES.royal}>
          <PushManager />
          <UpdatePrompt />
          <Toaster position="top-center" />
          <KhidmatPortal signOut={signOut} user={authValue.user} />
        </ThemeCtx.Provider>
      </AuthCtx.Provider>
    )
  }

  if (portalRole === 'inventory_manager') {
    return (
      <AuthCtx.Provider value={authValue}>
        <ThemeCtx.Provider value={THEMES.royal}>
          <PushManager />
          <UpdatePrompt />
          <Toaster position="top-center" />
          <InventoryManagerPortal signOut={signOut} user={authValue.user} />
        </ThemeCtx.Provider>
      </AuthCtx.Provider>
    )
  }

  return (
    <AuthCtx.Provider value={authValue}>
      <PushManager />
      <UpdatePrompt />
      <Toaster position="top-center" />
      <ThaliUserApp />
    </AuthCtx.Provider>
  )
}


