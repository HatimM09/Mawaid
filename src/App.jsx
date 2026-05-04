// src/App.jsx — Al-Mawaid Food Survey System — FIXED v5.2 (1.0.2)
// Member App + Khidmat Guzar Portal + Admin Bridge — fully linked
// v1.0.2 - Force Cache Purge Implementation

import React, {
  useState, useEffect, useRef, createContext, useContext, useCallback
} from 'react'
import { Navigate } from 'react-router-dom'
import {
  Home, FileText, User, X, Star, Camera, Check, LogOut,
  Mail, Lock, Eye, EyeOff, AlertCircle, ChevronDown, ChevronUp,
  ClipboardList, ChevronLeft, ChevronRight, Phone, MapPin,
  Users, Wallet, Bell, LifeBuoy, Info, MessageCircle, Upload, Utensils,
  Sun, Moon, Medal, Package, Shield
} from 'lucide-react'
import { supabase } from './admin/supabaseClient'
import { useWeeklyMenu } from './common/useWeeklyMenu'
import { AuthCtx, ThemeCtx, useAuth, useTheme } from './admin/context'
import { updateSystemTheme } from './admin/ui'
import KhidmatPortal from './admin/KhidmatPortal'
import InventoryManagerPortal from './admin/InventoryManagerPortal'
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
    id: 'royal', name: 'Professional Royal', icon: '👔',
    bg: '#0a0d14', bgGrad: 'radial-gradient(circle at 0% 0%, #161b22 0%, #0a0d14 100%)',
    card: 'rgba(197, 160, 89, 0.03)', cardActive: 'rgba(197, 160, 89, 0.08)',
    border: 'rgba(197, 160, 89, 0.15)', borderActive: 'rgba(197, 160, 89, 0.4)',
    accent: '#c5a059', accentGrad: 'linear-gradient(135deg, #d4b47a 0%, #c5a059 50%, #a68446 100%)',
    accentBg: 'rgba(197, 160, 89, 0.12)', accentBorder: 'rgba(197, 160, 89, 0.35)',
    text: '#f0f4f8', textSub: 'rgba(240, 244, 248, 0.55)', textBody: '#e1e7ed',
    navBg: 'rgba(10, 13, 20, 0.98)', navBorder: 'rgba(197, 160, 89, 0.25)',
    geo: 'rgba(197, 160, 89, 0.05)', spinnerBorder: 'rgba(197, 160, 89, 0.2)', spinnerTop: '#c5a059',
    inputBg: 'rgba(197, 160, 89, 0.04)', inputBorder: 'rgba(197, 160, 89, 0.2)',
    loginCard: 'rgba(15, 20, 30, 0.95)', headerWave: '#0a0d14',
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

// Survey window: Saturday 8PM to Monday 10AM
const isSurveyOpen = () => {
  const now = new Date()
  const day = now.getDay() // 0=Sun,1=Mon,...,6=Sat
  const hour = now.getHours()
  if (day === 6 && hour >= 20) return true  // Sat 8PM+
  if (day === 0) return true                 // All Sunday
  if (day === 1 && hour < 10) return true   // Mon before 10AM
  return false
}

const getSurveyWindowMessage = () => {
  if (isSurveyOpen()) return 'Survey window is open! (Sat 8PM – Mon 10AM)'
  return 'Survey window opens Saturday 8:00 PM and closes Monday 10:00 AM.'
}

const getWeekDate = () => {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
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


// ══════════════════════════════════════════════════════════════
// SHARED UI PRIMITIVES
// ══════════════════════════════════════════════════════════════
const WhatsAppLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path fill="currentColor" d="M19.05 4.91A9.82 9.82 0 0012.03 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.74.45 3.43 1.31 4.92L2 22l5.33-1.4a9.86 9.86 0 004.7 1.2h.01c5.46 0 9.9-4.44 9.9-9.9a9.83 9.83 0 00-2.89-6.99Zm-7.02 15.22h-.01a8.2 8.2 0 01-4.18-1.14l-.3-.18-3.16.83.84-3.08-.2-.31a8.18 8.18 0 01-1.25-4.35c0-4.53 3.69-8.22 8.23-8.22a8.16 8.16 0 015.82 2.41 8.16 8.16 0 012.41 5.82c0 4.54-3.69 8.22-8.2 8.22Zm4.51-6.16c-.25-.13-1.47-.72-1.7-.8-.23-.08-.4-.13-.57.12-.17.25-.65.8-.8.96-.15.17-.3.19-.55.07-.25-.13-1.07-.39-2.03-1.23-.75-.67-1.26-1.49-1.41-1.74-.15-.25-.02-.38.11-.5.11-.11.25-.29.38-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.57-1.37-.78-1.88-.21-.5-.43-.43-.57-.43h-.49c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.02 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.42 1.43.54.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29Z" />
  </svg>
)

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
      {fullPage && <p style={{ margin: 0, fontSize: 12, color: t.textSub, opacity: .45, fontFamily: "'Inter', sans-serif", letterSpacing: '0.08em' }}>Loading…</p>}
    </div>
  )
  return fullPage
    ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>{inner}</div>
    : inner
}

const ErrorBanner = ({ msg }) => (
  <div style={{ margin: '8px 0', padding: '11px 14px', borderRadius: 10, background: 'rgba(220,60,60,0.09)', border: '1px solid rgba(220,60,60,0.28)', color: '#e05555', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Inter', sans-serif" }}>
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
        : <div style={{ width: '100%', height: '100%', background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 800, color: '#fff', fontFamily: "'Inter', sans-serif" }}>{initials}</div>
      }
    </div>
  )
}

const SectionLabel = ({ children }) => {
  const t = useTheme()
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: t.textSub, textTransform: 'uppercase', marginBottom: 12, fontFamily: "'Inter', sans-serif", opacity: .7 }}>{children}</div>
}

function Card({ children, style = {}, active, organic }) {
  const t = useTheme()
  const organicStyle = organic ? {
    borderRadius: '40px 100px 40px 100px',
    background: 'linear-gradient(145deg, rgba(35,28,15,0.6), rgba(15,12,8,0.4))',
  } : {
    borderRadius: 32,
  }

  return (
    <div style={{
      ...organicStyle,
      padding: '20px 24px',
      background: active ? t.cardActive : t.card,
      border: `1.5px solid ${active ? t.borderActive : t.border}`,
      backdropFilter: 'blur(30px) saturate(1.8)',
      boxShadow: '0 15px 35px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.05)',
      ...style
    }}>
      {children}
    </div>
  )
}

const Btn = ({ children, onClick, disabled, style: extra = {}, variant = 'primary' }) => {
  const t = useTheme()
  const baseStyle = {
    padding: '12px 20px', borderRadius: 14, border: 'none',
    fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'Inter', sans-serif", transition: 'all 0.3s ease',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: 'fit-content', opacity: disabled ? 0.5 : 1
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
    display: 'inline-flex', alignItems: 'center', padding: '4px 10px',
    borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.08em', background: `${color}15` || 'rgba(212, 175, 55, 0.1)',
    color: color || '#D4AF37', border: `1px solid ${color}30` || 'rgba(212, 175, 55, 0.25)',
    fontFamily: "'Inter', sans-serif", ...style
  }}>
    {children}
  </div>
)



const BackHeader = ({ title, onBack }) => {
  const t = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><ChevronLeft size={20} color={t.accent} /></button>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.accent, fontFamily: "'Inter', sans-serif" }}>{title}</h2>
    </div>
  )
}

const EmptyState = ({ msg }) => {
  const t = useTheme()
  return <div style={{ textAlign: 'center', padding: 48, color: t.textSub, fontSize: 15, fontFamily: "'Inter', sans-serif" }}>{msg}</div>
}

const GlobalStyles = () => {
  const t = useTheme()
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Amiri:wght@400;700&display=swap');
      @keyframes spin { to { transform: rotate(360deg); } }
      .spin { animation: spin 0.8s linear infinite; }
      * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
      body { background: ${t.bg}; color: ${t.text}; margin: 0; transition: background 0.3s ease; }
      
      /* Modern Scrollbar */
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${t.borderActive}; border-radius: 10px; }
      ::-webkit-scrollbar-thumb:hover { background: ${t.accent}; }

    `}</style>
  )
}

// ══════════════════════════════════════════════════════════════
// LOGIN PAGE
// ══════════════════════════════════════════════════════════════
const LOGIN_ROLES = [
  { id: 'khidmat_guzar',      label: 'Khidmat\nGuzar',     icon: <User size={20} />,    short: 'Khidmat Guzar' },
  { id: 'khidmat',            label: 'Al-Mawaid\nTeam',    icon: <Medal size={20} />,   short: 'Al-Mawaid Team' },
  { id: 'inventory_manager',  label: 'Inventory',          icon: <Package size={20} />, short: 'Inventory Manager' },
  { id: 'admin',              label: 'Admin',              icon: <Shield size={20} />,  short: 'Admin' },
]

function LoginPage({ onRoleLogin }) {
  const [role, setRole]         = useState('khidmat_guzar')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    const savedEmail = localStorage.getItem('al_mawaid_remembered_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  const activeRole = LOGIN_ROLES.find(r => r.id === role)

  const handleAuth = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (role === 'inventory_manager') {
        const { data: invStaff, error: invErr } = await supabase
          .from('staff').select('*').ilike('email', email).eq('role', 'inventory_manager').maybeSingle()
        if (invErr || !invStaff) throw new Error('Unauthorized: Email not registered as Inventory Manager.')
        
        if (rememberMe) {
          localStorage.setItem('al_mawaid_remembered_email', email)
        } else {
          localStorage.removeItem('al_mawaid_remembered_email')
        }

        onRoleLogin('inventory_manager', { user: { email, id: invStaff.user_id || `inv_${invStaff.id}`, ...invStaff } })
        setLoading(false); return
      }

      const { data: { session }, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) throw signInErr

      if (rememberMe) {
        localStorage.setItem('al_mawaid_remembered_email', email)
      } else {
        localStorage.removeItem('al_mawaid_remembered_email')
      }

      if (role === 'khidmat_guzar') { onRoleLogin('khidmat_guzar', session); setLoading(false); return }

      let { data: staffRow, error: staffErr } = await supabase
        .from('staff').select('*').eq('user_id', session.user.id).maybeSingle()
      if (!staffRow && !staffErr) {
        const { data: emailMatch } = await supabase.from('staff').select('*').eq('email', session.user.email).maybeSingle()
        if (emailMatch && !emailMatch.user_id) {
          const { data: updated } = await supabase.from('staff').update({ user_id: session.user.id }).eq('id', emailMatch.id).select().single()
          staffRow = updated
        } else if (emailMatch) { staffRow = emailMatch }
      }
      if (staffErr && staffErr.code !== 'PGRST116') { await supabase.auth.signOut(); throw new Error(staffErr.message) }
      const dbRole = staffRow?.role || ''
      if (role === 'admin' && dbRole !== 'admin') { await supabase.auth.signOut(); throw new Error('You do not have admin privileges.') }
      if (role === 'khidmat' && !['khidmat_guzar','supervisor','khidmat','admin'].includes(dbRole)) {
        await supabase.auth.signOut(); throw new Error('You are not registered as part of the Al Mawaid Team.')
      }
      onRoleLogin(role, session)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; overflow: hidden; }

        .lp-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: #1a0f00;
          font-family: 'Inter', sans-serif;
        }

        /* ── Wheat field background ── */
        .lp-bg {
          position: absolute; inset: 0;
          background-image: url('/wheat_bg.png');
          background-size: cover;
          background-position: center;
          filter: brightness(0.78) contrast(1.08) saturate(1.1);
          z-index: 0;
        }

        /* ── Vignette overlay ── */
        .lp-vignette {
          position: absolute; inset: 0; z-index: 1;
          background: radial-gradient(ellipse at 50% 50%,
            rgba(30,18,4,0.10) 0%,
            rgba(12,7,2,0.55) 100%);
        }

        /* ── Sparkle ── */
        .lp-sparkle {
          position: absolute;
          bottom: clamp(20px, 5vh, 48px);
          right: clamp(20px, 5vw, 60px);
          z-index: 10;
          color: #FFD84D;
          font-size: clamp(22px, 4vw, 36px);
          line-height: 1;
          filter: drop-shadow(0 0 10px #FFD84D88);
          animation: sparkle-pulse 3s ease-in-out infinite;
          user-select: none;
        }
        @keyframes sparkle-pulse {
          0%,100% { opacity: 0.75; transform: scale(1) rotate(0deg); }
          50%      { opacity: 1;    transform: scale(1.15) rotate(10deg); }
        }

        /* ── Glass card ── */
        .lp-card {
          position: relative;
          z-index: 5;
          width: min(420px, 94vw);
          padding: clamp(28px,5vw,44px) clamp(22px,5vw,36px);
          border-radius: 32px;
          background: rgba(255, 248, 230, 0.38);
          backdrop-filter: blur(28px) saturate(1.4) brightness(1.05);
          -webkit-backdrop-filter: blur(28px) saturate(1.4) brightness(1.05);
          border: 1.5px solid rgba(255, 240, 180, 0.65);
          box-shadow:
            0 0 0 1px rgba(200,140,40,0.18),
            0 32px 80px rgba(0,0,0,0.32),
            inset 0 1px 2px rgba(255,255,255,0.75),
            inset 0 -1px 2px rgba(180,120,20,0.15);
          display: flex;
          flex-direction: column;
          gap: 0;
          animation: card-in 0.6s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }

        /* ── Filigree corners ── */
        .lp-corner {
          position: absolute;
          width: 44px; height: 44px;
          pointer-events: none;
          z-index: 6;
        }
        .lp-corner svg { width: 100%; height: 100%; }
        .lp-corner--tl { top: -3px;  left: -3px;  transform: rotate(0deg); }
        .lp-corner--tr { top: -3px;  right: -3px; transform: rotate(90deg); }
        .lp-corner--bl { bottom: -3px; left: -3px;  transform: rotate(270deg); }
        .lp-corner--br { bottom: -3px; right: -3px; transform: rotate(180deg); }

        /* ── Logo & title ── */
        .lp-brand { text-align: center; margin-bottom: 20px; }
        .lp-logo  { width: 62px; height: 62px; object-fit: contain; margin-bottom: 10px; filter: drop-shadow(0 6px 18px rgba(0,0,0,0.35)); }
        .lp-title {
          font-family: 'Inter', sans-serif;
          font-weight: 900;
          font-size: clamp(26px, 7vw, 38px);
          letter-spacing: 0.14em;
          background: linear-gradient(180deg, #C8902A 0%, #7A4E10 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1;
          filter: drop-shadow(0 1px 2px rgba(255,255,255,0.18));
        }

        /* ── Role tabs ── */
        .lp-tabs {
          display: flex;
          gap: 6px;
          background: rgba(15, 10, 4, 0.55);
          border-radius: 18px;
          padding: 6px;
          border: 1px solid rgba(200,150,40,0.25);
          margin-bottom: 18px;
        }
        .lp-tab {
          flex: 1;
          border: none;
          border-radius: 13px;
          padding: 10px 4px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          font-family: 'Inter', sans-serif;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.06em;
          line-height: 1.25;
          text-align: center;
          white-space: pre-line;
          transition: all 0.28s cubic-bezier(0.4,0,0.2,1);
        }
        .lp-tab--active {
          background: linear-gradient(135deg, #FFD84D 0%, #E0A030 50%, #B87B14 100%);
          color: #2a1a04;
          box-shadow: 0 6px 20px rgba(220,160,30,0.45);
          transform: scale(1.04);
        }
        .lp-tab--inactive {
          background: rgba(15, 10, 4, 0.5);
          color: rgba(200,150,60,0.55);
        }
        .lp-tab--inactive:hover { color: rgba(220,170,70,0.85); background: rgba(30,20,8,0.6); }

        /* ── Role subtitle ── */
        .lp-subtitle {
          text-align: center;
          font-size: 11.5px;
          font-weight: 600;
          color: rgba(80,50,15,0.75);
          letter-spacing: 0.04em;
          margin-bottom: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }
        .lp-subtitle svg { opacity: 0.6; }

        /* ── Input group ── */
        .lp-form { display: flex; flex-direction: column; gap: 14px; }
        .lp-label {
          display: block;
          font-size: 9.5px;
          font-weight: 900;
          letter-spacing: 0.2em;
          color: rgba(90,58,15,0.7);
          text-transform: uppercase;
          margin-bottom: 7px;
        }
        .lp-input-wrap { position: relative; }
        .lp-input-wrap svg {
          position: absolute;
          left: 16px;
          top: 50%; transform: translateY(-50%);
          color: rgba(160,105,30,0.65);
          pointer-events: none;
          width: 17px; height: 17px;
        }
        .lp-input {
          width: 100%;
          padding: 15px 46px 15px 46px;
          border-radius: 15px;
          border: 1px solid rgba(220,180,80,0.28);
          background: rgba(120,75,15,0.07);
          color: #3a2508;
          font-size: 14.5px;
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-shadow: inset 0 2px 5px rgba(0,0,0,0.04);
        }
        .lp-input:focus {
          border-color: rgba(200,140,40,0.55);
          box-shadow: 0 0 0 3px rgba(200,140,40,0.12), inset 0 2px 5px rgba(0,0,0,0.04);
        }
        .lp-input::placeholder { color: rgba(90,58,15,0.32); }
        .lp-eye {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: rgba(140,95,25,0.55); padding: 4px;
          display: flex; align-items: center;
        }
        .lp-eye:hover { color: rgba(180,120,30,0.9); }

        /* ── Error ── */
        .lp-error {
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          color: #c0392b;
          padding: 8px 12px;
          border-radius: 10px;
          background: rgba(192,57,43,0.09);
          border: 1px solid rgba(192,57,43,0.22);
        }

        /* ── Submit button ── */
        .lp-btn {
          width: 100%;
          padding: 18px;
          border-radius: 18px;
          border: none;
          margin-top: 6px;
          background: linear-gradient(135deg, #FFD84D 0%, #E0A030 45%, #B87B14 100%);
          color: #2a1a04;
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow:
            0 12px 32px rgba(184,123,20,0.35),
            inset 0 1px 1px rgba(255,255,255,0.45);
          transition: filter 0.2s, transform 0.15s, box-shadow 0.2s;
        }
        .lp-btn:hover:not(:disabled) {
          filter: brightness(1.07);
          transform: translateY(-1px);
          box-shadow: 0 16px 40px rgba(184,123,20,0.45), inset 0 1px 1px rgba(255,255,255,0.45);
        }
        .lp-btn:active:not(:disabled) { transform: translateY(0); filter: brightness(0.97); }
        .lp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>

      <div className="lp-root">
        {/* Background */}
        <div className="lp-bg" />
        <div className="lp-vignette" />

        {/* Sparkle */}
        <div className="lp-sparkle">✦</div>

        {/* Card */}
        <div className="lp-card">
          {/* Filigree corners */}
          {['tl','tr','bl','br'].map(pos => (
            <div key={pos} className={`lp-corner lp-corner--${pos}`}>
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id={`cg-${pos}`} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FFF8E0"/>
                    <stop offset="0.45" stopColor="#E0A030"/>
                    <stop offset="1" stopColor="#9A6010"/>
                  </linearGradient>
                </defs>
                {/* L-bracket */}
                <path
                  d="M5 5 L5 38 M5 5 L38 5"
                  stroke={`url(#cg-${pos})`} strokeWidth="5.5"
                  strokeLinecap="round" strokeLinejoin="round" fill="none"
                />
                {/* Small diamond accent */}
                <rect x="1" y="1" width="8" height="8" rx="2"
                  fill={`url(#cg-${pos})`} opacity="0.85"
                  transform="rotate(45 5 5)"
                />
              </svg>
            </div>
          ))}

          {/* Brand */}
          <div className="lp-brand">
            <img src="/al-mawaid.png" alt="Al-Mawaid" className="lp-logo" />
            <div className="lp-title">AL-MAWAID</div>
          </div>

          {/* Role tabs */}
          <div className="lp-tabs">
            {LOGIN_ROLES.map(r => (
              <button
                key={r.id}
                className={`lp-tab ${role === r.id ? 'lp-tab--active' : 'lp-tab--inactive'}`}
                onClick={() => { setRole(r.id); setError('') }}
                type="button"
              >
                {r.icon}
                {r.label}
              </button>
            ))}
          </div>

          {/* Subtitle */}
          <div className="lp-subtitle">
            <User size={13} />
            {activeRole?.short} — member portal
          </div>

          {/* Form */}
          <form className="lp-form" onSubmit={handleAuth}>
            <div>
              <label className="lp-label">Email</label>
              <div className="lp-input-wrap">
                <Mail />
                <input
                  type="email"
                  className="lp-input"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {role !== 'inventory_manager' && (
              <div>
                <label className="lp-label">Password</label>
                <div className="lp-input-wrap">
                  <Lock />
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="lp-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="lp-eye"
                    onClick={() => setShowPass(s => !s)}
                    tabIndex={-1}
                    style={{ 
                      right: 12, 
                      fontSize: 10, 
                      fontWeight: 800, 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em',
                      color: '#C8902A',
                      background: 'rgba(200,144,42,0.1)',
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid rgba(200,144,42,0.2)'
                    }}
                  >
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 6px' }}>
              <input 
                type="checkbox" 
                id="rememberMe" 
                checked={rememberMe} 
                onChange={e => setRememberMe(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#C8902A' }}
              />
              <label htmlFor="rememberMe" style={{ fontSize: 12, fontWeight: 600, color: 'rgba(90,58,15,0.7)', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                Remember Me
              </label>
            </div>

            {error && <div className="lp-error">{error}</div>}

            <button type="submit" className="lp-btn" disabled={loading}>
              {loading ? 'Processing…' : 'Sign In'}
            </button>
          </form>

          {/* Version Tag */}
          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 10, color: 'rgba(197, 160, 89, 0.4)', letterSpacing: '0.1em', fontWeight: 700 }}>
            v1.0.2 • CACHE_PURGED
          </div>
        </div>
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// SURVEY MODAL
// ══════════════════════════════════════════════════════════════
function SurveyModal({ startDay, onClose }) {
  const t = useTheme()
  const { user } = useAuth()
  const weeklyMenu = useWeeklyMenu() || {}
  const [currentDay, setCurrentDay] = useState(startDay || 'monday')
  const [currentMeal, setCurrentMeal] = useState('lunch')
  const [wantsFood, setWantsFood] = useState(null)
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(false)
  const [existingResponse, setExistingResponse] = useState(null)

  const [userData, setUserData] = useState({ thali_no: '', email: user.email })
  const currentDayIndex = DAYS.indexOf(currentDay)
  const menu = weeklyMenu[currentDay] || { lunch: [], dinner: [] }
  const editBlocked = existingResponse && (existingResponse.edit_count || 0) >= 1

  useEffect(() => { loadExisting() }, [currentDay, currentMeal])

  const loadExisting = async () => {
    try {
      if (!userData.thali_no) {
        const { data: u } = await supabase.from('user_stats').select('thali_number, email').eq('user_id', user.id).single()
        if (u) setUserData({ thali_no: u.thali_number || '', email: u.email || user.email })
      }

      // 1. Fetch LATEST submission (template)
      const { data } = await supabase.from('survey_submissions_flat')
        .select('*').eq('user_id', user.id).order('week_id', { ascending: false }).limit(1).maybeSingle()

      if (data) {
        const currentWeekId = getWeekDate()
        const isFromOldWeek = data.week_id !== currentWeekId
        
        const dayKey = currentDay.substring(0, 3).toLowerCase()
        const mealKey = currentMeal === 'lunch' ? 'l' : 'd'
        const status = data[`${dayKey}_${mealKey}_status`]
        // If it's an old week, we reset the edit count for the new week
        const editCount = isFromOldWeek ? 0 : (data.edit_metadata || {})[`${dayKey}_${mealKey}`] || 0

        setExistingResponse({ ...data, edit_count: editCount, is_template: isFromOldWeek })
        
        if (status) {
          setWantsFood(status === 'Applied')
          const activeDishes = menu[currentMeal] || []
          const dishRes = {}
          activeDishes.forEach((dish, idx) => {
            const val = data[`${dayKey}_${mealKey}_dish_${idx + 1}`]
            if (val !== undefined && val !== null) {
              dishRes[dish] = val === 'Yes' ? 'yes' : val === 'No' ? 'no' : parseInt(val)
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
      console.error('Error loading survey template:', err)
      setExistingResponse(null); setWantsFood(null); setResponses({})
    }
  }

  const goToDay = (day) => {
    setCurrentDay(day)
    setCurrentMeal('lunch')
    setWantsFood(null)
    setResponses({})
  }

  const handleNext = async () => {
    if (wantsFood !== null && !(existingResponse && (existingResponse.edit_count || 0) >= 1)) {
      setLoading(true)
      try {
        const dayKey = currentDay.substring(0, 3).toLowerCase()
        const mealKey = currentMeal === 'lunch' ? 'l' : 'd'
        const currentEdits = existingResponse?.edit_metadata || {}
        const newEditCount = (currentEdits[`${dayKey}_${mealKey}`] || 0) + (existingResponse ? 1 : 0)

        const currentWeekId = getWeekDate()
        const updateObj = {
          user_id: user.id,
          week_id: currentWeekId,
          thali_number: userData.thali_no,
          email: userData.email,
          [`${dayKey}_${mealKey}_status`]: wantsFood ? 'Applied' : 'Skipped',
          edit_metadata: { ...currentEdits, [`${dayKey}_${mealKey}`]: newEditCount },
          updated_at: new Date().toISOString()
        }

        if (wantsFood) {
          const activeDishes = menu[currentMeal] || []
          activeDishes.forEach((dish, idx) => {
            const colName = `${dayKey}_${mealKey}_dish_${idx + 1}`
            const val = responses[dish]
            if (val !== undefined) {
              updateObj[colName] = val === 'yes' ? 'Yes' : val === 'no' ? 'No' : `${val}%`
            }
          })
        }

        await supabase.from('survey_submissions_flat').upsert([updateObj])

        if (!existingResponse) {
          await supabase.rpc('increment_user_surveys', { p_user_id: user.id })
        }
      } catch (err) {
        alert('Error saving: ' + err.message)
      } finally {
        setLoading(false)
      }
    }

    if (currentMeal === 'lunch') {
      setCurrentMeal('dinner'); setWantsFood(null); setResponses({})
    } else if (currentDayIndex < DAYS.length - 1) {
      setCurrentDay(DAYS[currentDayIndex + 1]); setCurrentMeal('lunch'); setWantsFood(null); setResponses({})
    } else {
      // 4. Survey Complete - Delete old week data if this was a template-based submission
      if (existingResponse?.is_template) {
        try {
          await supabase.from('survey_submissions_flat')
            .delete()
            .eq('user_id', user.id)
            .eq('week_id', existingResponse.week_id)
        } catch (delErr) {
          console.warn('Could not clean up old survey:', delErr)
        }
      }
      alert('🎉 Survey complete! Shukran Jazeelan.')
      onClose()
    }
  }

  const handlePrev = () => {
    if (currentMeal === 'dinner') {
      setCurrentMeal('lunch'); setWantsFood(null); setResponses({})
    } else if (currentDayIndex > 0) {
      setCurrentDay(DAYS[currentDayIndex - 1]); setCurrentMeal('dinner'); setWantsFood(null); setResponses({})
    }
  }

  const dishes = currentMeal === 'lunch' ? menu.lunch : menu.dinner
  const isFirst = currentDayIndex === 0 && currentMeal === 'lunch'
  const isLast = currentDayIndex === DAYS.length - 1 && currentMeal === 'dinner'
  const progress = ((currentDayIndex * 2 + (currentMeal === 'lunch' ? 1 : 2)) / (DAYS.length * 2)) * 100

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.82)', padding: 16, backdropFilter: 'blur(12px)', overflowY: 'auto' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: 32, padding: 22, maxWidth: 500, width: '100%', border: `1px solid ${t.borderActive}`, boxShadow: '0 28px 70px rgba(0,0,0,0.55)', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: t.inputBg, borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: t.accentGrad, borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>

        {/* Day pills */}
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 14, paddingBottom: 2, scrollbarWidth: 'none' }}>
          {DAYS.map(day => (
            <button key={day} onClick={() => goToDay(day)}
              style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${currentDay === day ? t.accent : t.border}`, background: currentDay === day ? t.accentBg : 'transparent', color: currentDay === day ? t.accent : t.textSub, fontWeight: 700, fontSize: 10, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
              {weeklyMenu[day]?.en?.slice(0, 3) || day.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="/al-mawaid.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: t.accent, fontFamily: "'Inter', sans-serif" }}>{menu.en || currentDay}</h2>
            </div>
            <div style={{ fontSize: 13, color: t.textSub, fontFamily: "'Inter', sans-serif", marginTop: 3 }}>
              {currentMeal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}<span style={{ margin: '0 6px', opacity: .3 }}>·</span>
              <span style={{ fontFamily: "'Inter', sans-serif, 'Amiri', serif", fontSize: 14 }}>{menu.ar}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} color={t.textSub} /></button>
        </div>

        {editBlocked && (
          <div style={{ marginBottom: 12, padding: 11, borderRadius: 10, background: 'rgba(220,140,40,0.10)', border: '1px solid rgba(220,140,40,0.28)', color: '#d4882a', fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
            ⚠️ 1 edit already used for this meal — view only.
          </div>
        )}

        {/* Prev / Next */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={handlePrev} disabled={isFirst}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'transparent', color: isFirst ? t.border : t.textSub, fontSize: 13, fontWeight: 600, cursor: isFirst ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: "'Inter', sans-serif" }}>
            <ChevronLeft size={13} /> Prev
          </button>
          <button onClick={handleNext} disabled={loading}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: `1px solid ${t.accent}`, background: t.accentBg, color: t.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: "'Inter', sans-serif" }}>
            {isLast ? 'Finish ✓' : 'Next'} {!isLast && <ChevronRight size={13} />}
          </button>
        </div>

        {/* Content */}
        {editBlocked ? (
          <div style={{ padding: 14, background: t.inputBg, borderRadius: 12, border: `1px solid ${t.border}` }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: t.textSub, fontFamily: "'Inter', sans-serif" }}>{wantsFood ? 'Responded: Yes' : 'Responded: No (skipped)'}</p>
            {wantsFood && Object.entries(responses).map(([dish, val]) => (
              <div key={dish} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${t.border}` }}>
                <span style={{ fontSize: 13, color: t.text, fontFamily: "'Inter', sans-serif" }}>{dish}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.accent, fontFamily: "'Inter', sans-serif" }}>{val === 'yes' ? '✅' : val === 'no' ? '❌' : `${val}%`}</span>
              </div>
            ))}
          </div>
        ) : wantsFood === null ? (
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 14, fontFamily: "'Inter', sans-serif" }}>
              Do you want {currentMeal} for {menu.en || currentDay}?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="stagger-item" onClick={() => setWantsFood(true)}
                style={{ flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${t.accent}`, background: t.accentBg, color: t.accent, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>✅ Yes</button>
              <button className="stagger-item" onClick={() => { setWantsFood(false); setTimeout(handleNext, 200) }}
                style={{ flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>❌ No</button>
            </div>
          </div>
        ) : wantsFood ? (
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 10, fontFamily: "'Inter', sans-serif" }}>Select portion for each dish:</p>
            {dishes.map((dish, idx) => (
              <div key={dish} className="stagger-item" style={{ marginBottom: 10, padding: 12, background: t.inputBg, borderRadius: 11, animationDelay: `${0.1 + idx * 0.05}s` }}>
                <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: t.text, fontFamily: "'Inter', sans-serif" }}>{dish}</p>
                {isRotiItem(dish) ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['yes', 'no'].map(opt => (
                      <button key={opt} onClick={() => setResponses(prev => ({ ...prev, [dish]: opt }))}
                        style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: `1.5px solid ${responses[dish] === opt ? (opt === 'yes' ? t.accent : '#e05555') : t.border}`, background: responses[dish] === opt ? (opt === 'yes' ? t.accentBg : 'rgba(220,80,80,0.09)') : 'transparent', color: responses[dish] === opt ? (opt === 'yes' ? t.accent : '#e05555') : t.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                        {opt === 'yes' ? '✅ Yes' : '❌ No'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[0, 25, 50, 100].map(pct => (
                      <button key={pct} onClick={() => setResponses(prev => ({ ...prev, [dish]: pct }))}
                        style={{ flex: 1, padding: '7px 2px', borderRadius: 9, border: `1.5px solid ${responses[dish] === pct ? t.accent : t.border}`, background: responses[dish] === pct ? t.accentBg : 'transparent', color: responses[dish] === pct ? t.accent : t.text, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                        {pct}%
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button onClick={handleNext} disabled={loading || Object.keys(responses).length < dishes.length}
              style={{ width: '100%', padding: 13, borderRadius: 11, border: 'none', marginTop: 6, background: Object.keys(responses).length < dishes.length ? t.border : t.accentGrad, color: '#fff', fontSize: 14, fontWeight: 700, cursor: Object.keys(responses).length < dishes.length ? 'not-allowed' : 'pointer', opacity: Object.keys(responses).length < dishes.length ? .5 : 1, fontFamily: "'Inter', sans-serif" }}>
              {loading ? 'Saving…' : isLast ? 'Complete Survey ✓' : 'Save & Next →'}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20, color: t.textSub, fontFamily: "'Inter', sans-serif" }}>Skipping this meal…</div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// DAILY SURVEY MODAL (NEW)
// ══════════════════════════════════════════════════════════════
function DailySurveyModal({ onClose }) {
  const t = useTheme()
  const { user } = useAuth()
  const weeklyMenu = useWeeklyMenu() || {}
  const [step, setStep] = useState(1) // 1: Lunch Yes/No, 2: Lunch Dishes, 3: Dinner Yes/No, 4: Roti (if any), 5: Dinner Dishes
  const [lunchStatus, setLunchStatus] = useState(null) // true/false
  const [dinnerStatus, setDinnerStatus] = useState(null) // true/false
  const [rotiStatus, setRotiStatus] = useState(null) // true/false
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(false)
  const [userData, setUserData] = useState({ thali_no: '', email: user.email })
  
  const today = getTodayKey()
  const menu = weeklyMenu[today] || { lunch: [], dinner: [] }
  const dayKey = today.substring(0, 3).toLowerCase()

  useEffect(() => {
    supabase.from('user_stats').select('thali_number, email').eq('user_id', user.id).single()
      .then(({ data }) => { if (data) setUserData({ thali_no: data.thali_number || '', email: data.email || user.email }) })
  }, [user.id])

  const dinnerDishes = menu.dinner || []
  const rotiItems = dinnerDishes.filter(d => isRotiItem(d))
  const otherDinnerDishes = dinnerDishes.filter(d => !isRotiItem(d))

  const handleNext = async () => {
    if (step === 1) {
      if (lunchStatus === null) return
      setStep(lunchStatus ? 2 : 3)
    } else if (step === 2) {
      if (Object.keys(responses).filter(k => menu.lunch.includes(k)).length < menu.lunch.length) return
      setStep(3)
    } else if (step === 3) {
      if (dinnerStatus === null) return
      if (!dinnerStatus) {
        await submitSurvey(false, false)
      } else {
        setStep(rotiItems.length > 0 ? 4 : 5)
      }
    } else if (step === 4) {
      if (rotiStatus === null) return
      setStep(5)
    } else if (step === 5) {
      const dinnerDishesToCheck = otherDinnerDishes
      if (Object.keys(responses).filter(k => dinnerDishesToCheck.includes(k)).length < dinnerDishesToCheck.length) return
      await submitSurvey(true, true)
    }
  }

  const handleStatusSelect = (type, val) => {
    if (type === 'lunch') {
      setLunchStatus(val)
      setTimeout(() => setStep(val ? 2 : 3), 400)
    } else if (type === 'dinner') {
      setDinnerStatus(val)
      if (!val) {
        setTimeout(() => submitSurvey(lunchStatus, false), 400)
      } else {
        setTimeout(() => setStep(rotiItems.length > 0 ? 4 : 5), 400)
      }
    } else if (type === 'roti') {
      setRotiStatus(val)
      setTimeout(() => setStep(5), 400)
    }
  }

  const submitSurvey = async (isDinnerApplied, isDinnerActuallyYes) => {
    setLoading(true)
    try {
      const currentWeekId = getWeekDate()
      const updateObj = {
        user_id: user.id,
        week_id: currentWeekId,
        thali_number: userData.thali_no,
        email: userData.email,
        [`${dayKey}_l_status`]: lunchStatus ? 'Applied' : 'Skipped',
        [`${dayKey}_d_status`]: dinnerStatus ? 'Applied' : 'Skipped',
        updated_at: new Date().toISOString()
      }

      // ... [dishes mapping skipped for brevity in Instruction, but keeping it in implementation]
      // Add Lunch Dishes
      if (lunchStatus) {
        menu.lunch.forEach((dish, idx) => {
          const colName = `${dayKey}_l_dish_${idx + 1}`
          const val = responses[dish]
          updateObj[colName] = typeof val === 'number' ? `${val}%` : val === 'yes' ? 'Yes' : 'No'
        })
      }

      // Add Dinner Dishes
      if (dinnerStatus) {
        rotiItems.forEach((dish, idx) => {
          const menuIdx = dinnerDishes.indexOf(dish)
          const realColName = `${dayKey}_d_dish_${menuIdx + 1}`
          updateObj[realColName] = rotiStatus ? 'Yes' : 'No'
        })
        otherDinnerDishes.forEach((dish) => {
          const menuIdx = dinnerDishes.indexOf(dish)
          const realColName = `${dayKey}_d_dish_${menuIdx + 1}`
          const val = responses[dish]
          updateObj[realColName] = typeof val === 'number' ? `${val}%` : val === 'yes' ? 'Yes' : 'No'
        })
      }

      const { error } = await supabase.from('survey_submissions_flat').upsert([updateObj])
      if (error) throw error

      // Clean up old week if it exists
      const { data: latest } = await supabase.from('survey_submissions_flat')
        .select('week_id').eq('user_id', user.id).neq('week_id', currentWeekId).order('week_id', { ascending: false }).limit(1).maybeSingle()
      if (latest) {
        await supabase.from('survey_submissions_flat').delete().eq('user_id', user.id).eq('week_id', latest.week_id)
      }

      alert('🎉 Daily Survey submitted! Shukran.')
      onClose()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: 'clamp(12px, 3vw, 24px)', backdropFilter: 'blur(15px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: 32, padding: 'clamp(18px, 4vw, 32px)', maxWidth: 500, width: '100%', border: `1.5px solid ${t.borderActive}`, boxShadow: '0 30px 80px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.accent, fontFamily: "'Inter', sans-serif" }}>Daily Food Survey</div>
              <div style={{ fontSize: 11, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{today} • {userData.thali_no ? `Thali #${userData.thali_no}` : 'Loading...'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5 }}><X size={20} color={t.textSub} /></button>
        </div>

        <div style={{ minHeight: 200 }}>
          {step === 1 && (
            <div className="stagger-item">
              <SectionLabel>Part 1: Lunch</SectionLabel>
              <p style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 20 }}>Did you have lunch today?</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => handleStatusSelect('lunch', true)} style={{ flex: 1, padding: '16px', borderRadius: 16, border: `2px solid ${lunchStatus === true ? t.accent : t.border}`, background: lunchStatus === true ? t.accentBg : 'transparent', color: lunchStatus === true ? t.accent : t.textSub, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>✅ Yes</button>
                <button onClick={() => handleStatusSelect('lunch', false)} style={{ flex: 1, padding: '16px', borderRadius: 16, border: `2px solid ${lunchStatus === false ? '#e05555' : t.border}`, background: lunchStatus === false ? 'rgba(224,85,85,0.1)' : 'transparent', color: lunchStatus === false ? '#e05555' : t.textSub, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>❌ No</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="stagger-item">
              <SectionLabel>Lunch Portions</SectionLabel>
              <div style={{ maxHeight: '40vh', overflowY: 'auto', paddingRight: 5 }}>
                {menu.lunch.map(dish => (
                  <div key={dish} style={{ marginBottom: 18, padding: 14, background: t.inputBg, borderRadius: 16, border: `1px solid ${t.border}` }}>
                    <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: t.text }}>{dish}</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[0, 25, 50, 100].map(pct => (
                        <button key={pct} onClick={() => setResponses(prev => ({ ...prev, [dish]: pct }))}
                          style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1.5px solid ${responses[dish] === pct ? t.accent : t.border}`, background: responses[dish] === pct ? t.accentBg : 'transparent', color: responses[dish] === pct ? t.accent : t.textSub, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{pct}%</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="stagger-item">
              <SectionLabel>Part 2: Dinner</SectionLabel>
              <p style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 20 }}>Will you have dinner tonight?</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => handleStatusSelect('dinner', true)} style={{ flex: 1, padding: '16px', borderRadius: 16, border: `2px solid ${dinnerStatus === true ? t.accent : t.border}`, background: dinnerStatus === true ? t.accentBg : 'transparent', color: dinnerStatus === true ? t.accent : t.textSub, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>✅ Yes</button>
                <button onClick={() => handleStatusSelect('dinner', false)} style={{ flex: 1, padding: '16px', borderRadius: 16, border: `2px solid ${dinnerStatus === false ? '#e05555' : t.border}`, background: dinnerStatus === false ? 'rgba(224,85,85,0.1)' : 'transparent', color: dinnerStatus === false ? '#e05555' : t.textSub, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>❌ No</button>
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
                {otherDinnerDishes.map(dish => (
                  <div key={dish} style={{ marginBottom: 18, padding: 14, background: t.inputBg, borderRadius: 16, border: `1px solid ${t.border}` }}>
                    <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: t.text }}>{dish}</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[0, 25, 50, 100].map(pct => (
                        <button key={pct} onClick={() => setResponses(prev => ({ ...prev, [dish]: pct }))}
                          style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1.5px solid ${responses[dish] === pct ? t.accent : t.border}`, background: responses[dish] === pct ? t.accentBg : 'transparent', color: responses[dish] === pct ? t.accent : t.textSub, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{pct}%</button>
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
function ThaliUserApp() {
  const [activeTab, setActiveTab] = useState('home')
  const [showDailySurvey, setShowDailySurvey] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('almawaid_theme') || 'dark')
  const t = THEMES[theme] || THEMES.dark

  useEffect(() => {
    updateSystemTheme(theme)
  }, [theme])

  const handleSetTheme = (id) => { setTheme(id); localStorage.setItem('almawaid_theme', id) }

  const LogoIcon = ({ size = 20, style = {} }) => (
    <img src="/al-mawaid.png" alt="" style={{ width: size, height: size, objectFit: 'contain', ...style }} />
  )
  const tabs = [
    { id: 'home', label: 'Home', Icon: Home },
    { id: 'menu', label: 'Menu', Icon: Utensils },
    { id: 'post', label: 'Requests', Icon: LogoIcon },
    { id: 'profile', label: 'Profile', Icon: User },
  ]
  const tabLabels = { home: 'AL-MAWAID', menu: 'WEEKLY MENU', survey: 'DAILY SURVEY', post: 'REQUESTS', profile: 'PROFILE' }

  return (
    <ThemeCtx.Provider value={t}>
      <div style={{ fontFamily: "'Inter', sans-serif", minHeight: '100vh', background: t.bgGrad, color: t.text, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}>
        <header style={{ position: 'relative', overflow: 'hidden', background: t.bgGrad, padding: '14px 0 0', flexShrink: 0 }}>
          <GeoBg t={t} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '0 clamp(16px, 4vw, 32px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src="/al-mawaid.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(196,156,90,0.5))' }} />
                <span style={{ fontSize: 9, letterSpacing: '0.24em', textTransform: 'uppercase', color: t.textSub, opacity: .55, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>Al-Mawaid</span>
              </div>
              <span style={{ fontSize: 11, color: t.textSub, opacity: .4, fontFamily: "'Inter', sans-serif" }}>
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            {activeTab === 'home' && (
              <div style={{ textAlign: 'center', marginBottom: 2 }}>
                <p style={{ fontFamily: "'Noto Nastaliq Urdu','Amiri',serif", fontSize: 16, color: t.accent, margin: 0, lineHeight: 1.8 }}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
              </div>
            )}
            <div style={{ textAlign: 'center', marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: activeTab === 'home' ? 28 : 20, fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.1, color: t.accent, fontFamily: "'Inter', sans-serif" }}>{tabLabels[activeTab]}</h1>
            </div>
          </div>
          <svg style={{ display: 'block', position: 'relative', zIndex: 1, marginTop: -1 }} width="100%" height="40" viewBox="0 0 1440 40" preserveAspectRatio="none">
            <path d="M0,0 C240,40 480,40 720,20 C960,0 1200,0 1440,20 L1440,40 L0,40 Z" fill={t.headerWave} />
          </svg>
        </header>

        {activeTab === 'home' && <HomePage setActiveTab={setActiveTab} />}
        {activeTab === 'menu' && <WeeklyMenuPage />}

        {activeTab === 'post' && <PostPage />}
        {activeTab === 'profile' && <ProfilePage theme={theme} setTheme={handleSetTheme} />}

        {showDailySurvey && <DailySurveyModal onClose={() => { setShowDailySurvey(false); setActiveTab('home') }} />}

        <nav className="mobile-bottom-nav" style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 1200, zIndex: 100, display: 'flex',
          justifyContent: 'space-around', alignItems: 'center', padding: 'clamp(8px, 2vw, 12px) 4px clamp(12px, 3vw, 22px)',
          background: t.navBg, borderTop: `1px solid ${t.navBorder}`,
          boxShadow: '0 -8px 30px rgba(0,0,0,0.20)',
          borderRadius: '32px 32px 0 0'
        }}>
          {tabs.map(({ id, label, Icon }) => {
            const active = activeTab === id
            return (
              <button key={id} onClick={() => {
                if (id === 'survey') {
                  setShowDailySurvey(true)
                  return
                }
                setActiveTab(id)
              }}
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer', 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', 
                  gap: 4, padding: '2px 18px', position: 'relative', 
                  WebkitTapHighlightColor: 'transparent', transition: 'all 0.2s' 
                }}>
                {active && <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', width: 32, height: 3, borderRadius: 6, background: t.accent, boxShadow: `0 0 10px ${t.accent}` }} />}
                <div style={{ 
                  width: 32, height: 32, borderRadius: 10, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                  background: active ? t.accentBg : 'transparent', 
                  border: active ? `1.5px solid ${t.accentBorder}` : '1.5px solid transparent', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: active ? 'scale(1.1) translateY(-2px)' : 'scale(1)'
                }}>
                  <Icon size={18} color={active ? t.accent : '#FFF8E7'} strokeWidth={active ? 2.5 : 1.5} style={{ opacity: active ? 1 : .35 }} />
                </div>
                <span style={{ 
                  fontSize: 7.5, fontWeight: 900, letterSpacing: '0.08em', 
                  color: active ? t.accent : '#FFF8E7', opacity: active ? 1 : .3, 
                  fontFamily: "'Inter', sans-serif", textTransform: 'uppercase' 
                }}>{label}</span>
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
function HomePage({ setActiveTab }) {
  const t = useTheme()
  const weeklyMenu = useWeeklyMenu()
  const { user } = useAuth()

  const [showSurvey, setShowSurvey] = useState(false)
  const [profileData, setProfileData] = useState({ name: '', thali_number: '', avatar_url: '' })
  const [statsLoading, setStatsLoading] = useState(true)
  const surveyOpen = isSurveyOpen()
  const todayKey = getTodayKey()

  // Feedback State
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState({ lunch: false, dinner: false })
  const [lunchStars, setLunchStars] = useState(0)
  const [dinnerStars, setDinnerStars] = useState(0)
  const [lunchComment, setLunchComment] = useState('')
  const [dinnerComment, setDinnerComment] = useState('')
  const STAR_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Great', 5: 'Excellent' }

  useEffect(() => { loadData() }, [user])

  const loadData = async () => {
    try {
      const { data } = await supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle()
      if (data) setProfileData({ name: data.name || '', thali_number: data.thali_number || '', avatar_url: data.avatar_url || '' })
    } catch { }
    setStatsLoading(false)
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


  if (!weeklyMenu) return <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spin" style={{ width: 40, height: 40, border: '3px solid rgba(212,175,55,0.2)', borderTop: '3px solid #D4AF37', borderRadius: '50%' }} /></div>

  return (
    <main style={{ flex: 1, padding: '20px 16px 120px', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Profile strip */}
      <Card active style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, padding: '14px 16px', borderRadius: 18, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, left: -20, width: 80, height: 80, background: t.accentGrad, borderRadius: '50%', filter: 'blur(40px)', opacity: 0.08 }} />
        <Avatar avatarUrl={profileData?.avatar_url} name={profileData?.name} size={46} />
        <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: t.accent, fontFamily: "'Inter', sans-serif", lineHeight: 1.2 }}>{profileData?.name || 'Thali User'}</div>
          <div style={{ fontSize: 11, color: t.textSub, fontFamily: "'Inter', sans-serif", marginTop: 2 }}>Thali #{profileData?.thali_number || '—'}</div>
        </div>
      </Card>

      {/* Weekly Survey Section */}
      <Card organic style={{
        marginBottom: 20, borderRadius: 24,
        background: surveyOpen ? t.accentBg : 'rgba(0,0,0,0.2)',
        border: `1.5px solid ${surveyOpen ? t.accent : t.border}`,
        position: 'relative', overflow: 'hidden', padding: '24px'
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, background: t.accentGrad, borderRadius: '50%', filter: 'blur(60px)', opacity: 0.15 }} />
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: surveyOpen ? t.successText : t.textSub, boxShadow: surveyOpen ? `0 0 10px ${t.successText}` : 'none' }} />
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: t.accent, fontFamily: "'Inter', sans-serif" }}>{surveyOpen ? 'SURVEY LIVE' : 'SURVEY CLOSED'}</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.text, fontFamily: "'Inter', sans-serif", lineHeight: 1.2 }}>Weekly Food Survey</div>
            <div style={{ fontSize: 13, color: t.textSub, marginTop: 8, fontFamily: "'Inter', sans-serif" }}>{getSurveyWindowMessage()}</div>
          </div>

          <button 
            onClick={() => setShowSurvey(true)}
            disabled={!surveyOpen}
            style={{ 
              padding: '16px 28px', borderRadius: 16, 
              background: surveyOpen ? t.accentGrad : 'rgba(255,255,255,0.05)', 
              color: surveyOpen ? '#000' : t.textSub, 
              fontSize: 14, fontWeight: 900, border: 'none', cursor: surveyOpen ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 10, boxShadow: surveyOpen ? `0 10px 25px ${t.accent}40` : 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: "'Inter', sans-serif"
            }}
          >
            <ClipboardList size={18} /> Start Survey
          </button>
        </div>
      </Card>


      {/* Daily Feedback Section */}
      <Card organic style={{ marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, background: t.accentGrad, borderRadius: '50%', filter: 'blur(50px)', opacity: 0.08 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Star size={16} color="#fff" fill="#fff" /></div>
          <div style={{ fontSize: 17, fontWeight: 800, color: t.accent, fontFamily: "'Inter', sans-serif" }}>Daily Feedback</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }}>
          {['lunch', 'dinner'].map(meal => {
            const stars = meal === 'lunch' ? lunchStars : dinnerStars
            const setStars = meal === 'lunch' ? setLunchStars : setDinnerStars
            const submitted = feedbackSubmitted[meal]
            return (
              <div key={meal} style={{ background: t.inputBg, padding: 14, borderRadius: 14, border: `1px solid ${stars > 0 ? t.accentBorder : t.border}`, transition: 'border-color 0.3s' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: t.accent, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Inter', sans-serif" }}>
                  {meal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}
                </div>
                {submitted ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.successText, fontWeight: 600 }}><Check size={14} /> Rated!</div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      {[1, 2, 3, 4, 5].map(num => (
                        <button key={num} onClick={() => setStars(num)} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', transition: 'transform 0.2s', transform: stars >= num ? 'scale(1.15)' : 'scale(1)' }}>
                          <Star size={22} color={t.accent} fill={stars >= num ? t.accent : 'none'} strokeWidth={1.5} style={{ transition: 'fill 0.2s, color 0.2s' }} />
                        </button>
                      ))}
                    </div>
                    {stars > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: t.accent, opacity: 0.7, fontFamily: "'Inter', sans-serif" }}>{STAR_LABELS[stars]}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: t.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Comments</label>
          <textarea
            value={lunchComment}
            onChange={e => { setLunchComment(e.target.value); setDinnerComment(e.target.value) }}
            placeholder="Tell us what you liked or how we can improve..."
            style={{ 
              width: '100%', padding: '15px 18px', borderRadius: 18, 
              background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${t.border}`, 
              color: t.text, fontSize: 14, resize: 'none', outline: 'none', 
              fontFamily: "'Inter', sans-serif", minHeight: 90, boxSizing: 'border-box',
              transition: 'all 0.3s ease',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
            }}
            onFocus={e => { e.target.style.borderColor = t.accent; e.target.style.background = 'rgba(255,255,255,0.05)' }}
            onBlur={e => { e.target.style.borderColor = t.border; e.target.style.background = 'rgba(255,255,255,0.03)' }}
          />
        </div>
        <Btn onClick={handleSubmitCombined} disabled={submittingFeedback || (!lunchStars && !dinnerStars)} style={{ width: '100%', height: 48, fontSize: 14 }}>
          {submittingFeedback ? 'Saving...' : 'Submit Feedback'}
        </Btn>
      </Card>

      {showSurvey && <SurveyModal startDay="monday" onClose={() => { setShowSurvey(false); loadData() }} />}
    </main>
  )
}

function WeeklyMenuPage() {
  const t = useTheme()
  const weeklyMenu = useWeeklyMenu()
  const todayKey = getTodayKey()
  const [expandedDay, setExpandedDay] = useState(todayKey)

  if (!weeklyMenu) return <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spin" style={{ width: 40, height: 40, border: '3px solid rgba(212,175,55,0.2)', borderTop: '3px solid #D4AF37', borderRadius: '50%' }} /></div>

  const jumpToDay = (day) => {
    setExpandedDay(day)
    const el = document.getElementById(`day-card-${day}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <main style={{ flex: 1, padding: '16px 16px 100px', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
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
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', color: t.accent, textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>Culinary Journey</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: t.text, fontFamily: "'Inter', sans-serif" }}>Weekly Menu</div>
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
                    <div style={{ fontSize: 18, fontWeight: 800, color: isExpanded ? t.accent : t.text, fontFamily: "'Inter', sans-serif" }}>
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'Inter', sans-serif", marginTop: 2, opacity: 0.7 }}>
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
                    fontFamily: "'Inter', sans-serif, 'Amiri', serif", fontSize: 18, color: t.accent
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
    <main style={{ flex: 1, padding: '16px 16px 100px', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, background: t.card, borderRadius: 13, padding: 5, border: `1px solid ${t.border}` }}>
        {[{ id: 'requests', label: '📋 Requests' }, { id: 'queries', label: '❓ Queries' }].map(({ id, label }) => (
          <button key={id} onClick={() => setSubTab(id)}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: 'none', background: subTab === id ? t.accentGrad : 'transparent', color: subTab === id ? '#fff' : t.textSub, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 0.25s' }}>
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
  const [extraItems, setExtraItems] = useState([{ name: '', qty: 1 }])
  const today = new Date().toISOString().split('T')[0]
  const inp = { width: '100%', padding: '11px 13px', borderRadius: 11, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 14, outline: 'none', fontFamily: "'Inter', sans-serif" }

  const resetAll = () => { setResumeFrom(''); setResumeTo(''); setStopFrom(''); setStopTo(''); setExtraItems([{ name: '', qty: 1 }]); setError(''); setSuccess('') }
  const openRequest = (type) => { resetAll(); setActiveRequest(activeRequest === type ? null : type) }
  const addExtraItem = () => setExtraItems(prev => [...prev, { name: '', qty: 1 }])
  const removeExtraItem = i => setExtraItems(prev => prev.filter((_, idx) => idx !== i))
  const updateExtraItem = (i, field, val) => setExtraItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  const handleSubmit = async (type) => {
    setError(''); setSuccess(''); setSubmitting(true)
    try {
      let payload = { user_id: user.id, request_type: type, status: 'pending' }
      if (type === 'resume') { if (!resumeFrom || !resumeTo) throw new Error('Please select both dates'); payload = { ...payload, from_date: resumeFrom, to_date: resumeTo } }
      else if (type === 'stop') { if (!stopFrom || !stopTo) throw new Error('Please select both dates'); payload = { ...payload, from_date: stopFrom, to_date: stopTo } }
      else if (type === 'extra') { const valid = extraItems.filter(i => i.name.trim()); if (!valid.length) throw new Error('Please add at least one item'); payload = { ...payload, extra_items: valid } }
      const { error: dbErr } = await supabase.from('thali_requests').insert([payload])
      if (dbErr) throw dbErr
      setSuccess(`✅ ${type === 'resume' ? 'Resume' : type === 'stop' ? 'Stop' : 'Extra food'} request submitted!`)
      resetAll(); setActiveRequest(null)
    } catch (err) { setError(err.message) } finally { setSubmitting(false) }
  }

  const RCard = ({ type, children }) => (
    <div style={{ marginBottom: 10, borderRadius: 14, border: `1px solid ${activeRequest === type ? t.borderActive : t.border}`, background: activeRequest === type ? t.cardActive : t.card, overflow: 'hidden' }}>{children}</div>
  )
  const HdrBtn = ({ type, emoji, label, desc }) => (
    <button onClick={() => openRequest(type)} style={{ width: '100%', padding: 15, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: activeRequest === type ? t.accent : t.text, fontFamily: "'Inter', sans-serif" }}>{label}</div>
        <div style={{ fontSize: 12, color: t.textSub, marginTop: 1, fontFamily: "'Inter', sans-serif" }}>{desc}</div>
      </div>
      {activeRequest === type ? <ChevronUp size={14} color={t.accent} /> : <ChevronDown size={14} color={t.accent} />}
    </button>
  )

  return (
    <div>
      {success && <div style={{ marginBottom: 12, padding: 13, borderRadius: 12, background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.successText, fontSize: 14, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>{success}</div>}
      <RCard type="resume">
        <HdrBtn type="resume" emoji="▶️" label="Resume Thali" desc="Restart your thali service" />
        {activeRequest === 'resume' && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'Inter', sans-serif" }}>FROM</label><input type="date" value={resumeFrom} min={today} onChange={e => setResumeFrom(e.target.value)} style={inp} /></div>
              <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'Inter', sans-serif" }}>TO</label><input type="date" value={resumeTo} min={resumeFrom || today} onChange={e => setResumeTo(e.target.value)} style={inp} /></div>
            </div>
            {error && <ErrorBanner msg={error} />}
            <button onClick={() => handleSubmit('resume')} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'Inter', sans-serif" }}>{submitting ? 'Submitting…' : '✅ Submit Resume Request'}</button>
          </div>
        )}
      </RCard>
      <RCard type="stop">
        <HdrBtn type="stop" emoji="⏹️" label="Stop Thali" desc="Pause your thali service" />
        {activeRequest === 'stop' && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'Inter', sans-serif" }}>FROM</label><input type="date" value={stopFrom} min={today} onChange={e => setStopFrom(e.target.value)} style={inp} /></div>
              <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'Inter', sans-serif" }}>TO</label><input type="date" value={stopTo} min={stopFrom || today} onChange={e => setStopTo(e.target.value)} style={inp} /></div>
            </div>
            {error && <ErrorBanner msg={error} />}
            <button onClick={() => handleSubmit('stop')} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : 'linear-gradient(135deg,#e05555,#c03030)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'Inter', sans-serif" }}>{submitting ? 'Submitting…' : '⏹️ Submit Stop Request'}</button>
          </div>
        )}
      </RCard>
      <RCard type="extra">
        <HdrBtn type="extra" emoji="➕" label="Add Extra Food" desc="Request additional items" />
        {activeRequest === 'extra' && (
          <div style={{ padding: '0 16px 16px' }}>
            {extraItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input type="text" value={item.name} placeholder={`Item ${i + 1}`} onChange={e => updateExtraItem(i, 'name', e.target.value)} style={{ ...inp, flex: 1 }} />
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {[1, 2, 3, 4].map(n => (
                    <button key={n} onClick={() => updateExtraItem(i, 'qty', n)}
                      style={{ width: 32, height: 36, borderRadius: 9, border: `1.5px solid ${item.qty === n ? t.accent : t.border}`, background: item.qty === n ? t.accentBg : 'transparent', color: item.qty === n ? t.accent : t.textSub, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>{n}</button>
                  ))}
                </div>
                {extraItems.length > 1 && <button onClick={() => removeExtraItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={15} color="#e05555" /></button>}
              </div>
            ))}
            {extraItems.length < 6 && <button onClick={addExtraItem} style={{ width: '100%', padding: 10, borderRadius: 11, border: `1px dashed ${t.accent}`, background: 'transparent', color: t.accent, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 10, fontFamily: "'Inter', sans-serif" }}>+ Add Another Item</button>}
            {error && <ErrorBanner msg={error} />}
            <button onClick={() => handleSubmit('extra')} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: "'Inter', sans-serif" }}>{submitting ? 'Submitting…' : '➕ Submit Extra Food Request'}</button>
          </div>
        )}
      </RCard>
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
  const fileInputRef = useRef(null)
  const almawaidHelplineWhatsApp = '917737151253'

  useEffect(() => { loadQueries() }, [])
  const loadQueries = async () => {
    try { const { data } = await supabase.from('queries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20); setQueries(data || []) } catch { } finally { setLoading(false) }
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
      const { error: dbErr } = await supabase.from('queries').insert([{ user_id: user.id, comment: comment.trim(), media: uploadedUrls, status: 'open' }])
      if (dbErr) throw dbErr
      setSuccess('✅ Query submitted! Our team will respond shortly.')
      setComment(''); setMediaFiles([]); loadQueries()
    } catch (err) { setError(err.message) } finally { setSubmitting(false) }
  }
  const statusColor = s => s === 'open' ? '#d4882a' : s === 'resolved' ? '#5eba82' : '#7aabb8'
  const buildQueryShareLink = (query) => {
    const lines = ['Assalamualaikum Al-Mawaid,', 'I want to share my query details.', `Status: ${(query.status || 'open').toUpperCase()}`, `Query: ${query.comment ? (query.comment) : (query.media?.length ? 'Media attached' : 'No comment')}`, `Created on: ${new Date(query.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`]
    return `https://wa.me/${almawaidHelplineWhatsApp}?text=${encodeURIComponent(lines.join('\n'))}`
  }

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.accent, marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>✉️ New Query</div>
        <textarea value={comment} onChange={e => setComment(e.target.value)} style={{ width: '100%', minHeight: 78, padding: 12, borderRadius: 11, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: "'Inter', sans-serif", marginBottom: 10 }} placeholder="Describe your query or issue…" />
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
          <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: 10, borderRadius: 11, border: `1px dashed ${t.accentBorder}`, background: t.accentBg, color: t.accent, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: "'Inter', sans-serif" }}>
            <Camera size={14} /> Attach Photo / Video ({mediaFiles.length}/4)
          </button>
        )}
        {error && <ErrorBanner msg={error} />}
        {success && <div style={{ marginBottom: 10, padding: 11, borderRadius: 10, background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.successText, fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>{success}</div>}
        <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: "'Inter', sans-serif" }}>{submitting ? 'Submitting…' : '📨 Submit Query'}</button>
      </Card>
      <SectionLabel>My Queries</SectionLabel>
      {loading ? <Spinner /> : queries.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: t.textSub, fontSize: 14, fontFamily: "'Inter', sans-serif" }}>No queries yet.</div> : queries.map(q => (
        <Card key={q.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <div>
              <span style={{ display: 'block', fontSize: 11, color: t.textSub, fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>{new Date(q.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: `${statusColor(q.status)}20`, color: statusColor(q.status), border: `1px solid ${statusColor(q.status)}38`, fontFamily: "'Inter', sans-serif" }}>{q.status?.toUpperCase()}</span>
            </div>
            <a href={buildQueryShareLink(q)} target="_blank" rel="noreferrer" style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0, boxShadow: '0 8px 18px rgba(18,140,126,0.22)' }}><WhatsAppLogo size={18} /></a>
          </div>
          {q.comment && <p style={{ margin: '0 0 8px', fontSize: 14, color: t.textBody, lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>{q.comment}</p>}
          {q.media && q.media.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {q.media.map((m, i) => m.path && m.type === 'image' && <img key={i} src={m.path} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />)}
            </div>
          )}
          {q.admin_reply && <div style={{ marginTop: 8, padding: 10, borderRadius: 9, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 13, color: t.accent, fontFamily: "'Inter', sans-serif" }}>💬 <strong>Reply:</strong> {q.admin_reply}</div>}
        </Card>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// PROFILE PAGE (Member)
// ══════════════════════════════════════════════════════════════
function ProfilePage({ theme, setTheme }) {
  const [activeSubPage, setActiveSubPage] = useState('main')
  if (activeSubPage === 'surveys') return <MySurveysPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'requests') return <MyRequestsPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'khidmat') return <KhidmatTeamPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'notifications') return <NotificationsPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'support') return <SupportTicketsPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'about') return <AboutPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'reset_password') return <ResetPasswordPage onBack={() => setActiveSubPage('main')} />
  return <ProfileMainPage theme={theme} setTheme={setTheme} onNav={setActiveSubPage} />
}

function ProfileMainPage({ theme, setTheme, onNav }) {
  const t = useTheme(), { user, signOut } = useAuth()
  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => { if (data) setProfileData(data) }).finally(() => setLoading(false)) }, [])

  const NavCard = ({ label, icon, desc, onClick }) => (
    <button onClick={onClick} style={{ width: '100%', padding: '13px 16px', borderRadius: 14, border: `1px solid ${t.border}`, background: t.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, textAlign: 'left', transition: 'all 0.2s' }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'Inter', sans-serif" }}>{label}</div>
        <div style={{ fontSize: 12, color: t.textSub, marginTop: 1, fontFamily: "'Inter', sans-serif" }}>{desc}</div>
      </div>
      <ChevronRight size={15} color={t.textSub} />
    </button>
  )

  if (loading) return <Spinner />
  return (
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <Card active style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ width: 84, height: 84, margin: '0 auto 14px' }}><Avatar avatarUrl={profileData?.avatar_url} name={profileData?.name} email={user.email} size={84} /></div>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: t.text, fontFamily: "'Inter', sans-serif" }}>{profileData?.name || 'Thali User'}</h2>
        <div style={{ fontSize: 13, color: t.textSub, fontFamily: "'Inter', sans-serif", marginBottom: 6 }}>{user.email}</div>
        {profileData?.thali_number && <div style={{ display: 'inline-block', padding: '4px 16px', borderRadius: 20, background: t.accentBg, border: `1px solid ${t.accentBorder}`, marginBottom: 6 }}><span style={{ fontSize: 13, color: t.accent, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>Thali #{profileData.thali_number}</span></div>}
        {profileData?.phone && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}><Phone size={12} color={t.textSub} /><span style={{ fontSize: 13, color: t.textSub, fontFamily: "'Inter', sans-serif" }}>{profileData.phone}</span></div>}
        {profileData?.address && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}><MapPin size={12} color={t.textSub} /><span style={{ fontSize: 13, color: t.textSub, fontFamily: "'Inter', sans-serif" }}>{profileData.address}</span></div>}
        <div style={{ fontSize: 11, color: t.textSub, marginTop: 10, opacity: .5, fontFamily: "'Inter', sans-serif" }}>Thali User since {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 12, color: t.accent, fontFamily: "'Inter', sans-serif" }}>ℹ️ To update your profile details, contact an admin.</div>
      </Card>
      <SectionLabel>My Activity</SectionLabel>
      <NavCard label="My Surveys" icon={<ClipboardList size={19} color="#fff" />} desc="View your weekly survey responses" onClick={() => onNav('surveys')} />
      <NavCard label="My Requests" icon={<img src="/al-mawaid.png" alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />} desc="Resume, stop & extra food requests" onClick={() => onNav('requests')} />
      <NavCard label="Khidmat Guzaar" icon={<Users size={19} color="#fff" />} desc="Meet our service team" onClick={() => onNav('khidmat')} />
      <NavCard label="Alerts" icon={<Bell size={19} color="#fff" />} desc="See notices and important updates" onClick={() => onNav('notifications')} />
      <NavCard label="Support Ticket" icon={<LifeBuoy size={19} color="#fff" />} desc="Raise general, thali, and delivery issues" onClick={() => onNav('support')} />
      <NavCard label="About" icon={<Info size={19} color="#fff" />} desc="Learn more about the app and services" onClick={() => onNav('about')} />
      <NavCard label="Reset Password" icon={<Lock size={19} color="#fff" />} desc="Update your account password" onClick={() => onNav('reset_password')} />
      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <SectionLabel>App Management</SectionLabel>
        <button 
          onClick={async () => {
            if (window.confirm('This will clear all local app cache and reload to the latest version. Continue?')) {
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let reg of regs) await reg.unregister();
              }
              const keys = await caches.keys();
              for (let key of keys) await caches.delete(key);
              window.location.reload(true);
            }
          }}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 13, border: `1.5px solid ${t.border}`, background: t.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.25s' }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(224, 85, 85, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="#e05555" />
          </div>
          <div style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 700, color: t.text, fontFamily: "'Inter', sans-serif" }}>Clear App Cache & Update</div>
          <ChevronRight size={14} color={t.textSub} />
        </button>
        <div style={{ marginTop: 8, fontSize: 10, color: t.textSub, textAlign: 'center', opacity: 0.6 }}>Current Version: 2.0.1 (Build 102)</div>
      </div>

      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <SectionLabel>App Theme</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.values(THEMES).filter(th => th.id === 'dark' || th.id === 'bright').map(th => (
            <button key={th.id} onClick={() => setTheme(th.id)}
              style={{ padding: '12px 14px', borderRadius: 13, border: `1.5px solid ${theme === th.id ? th.accent : t.border}`, background: theme === th.id ? th.accentBg : t.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.25s' }}>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {[th.bg, th.accent, th.card].map((c, i) => <div key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: '1.5px solid rgba(255,255,255,0.12)' }} />)}
              </div>
              <div style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 700, color: theme === th.id ? th.accent : t.text, fontFamily: "'Inter', sans-serif" }}>{th.icon} {th.name}</div>
              {theme === th.id && <Check size={15} color={th.accent} />}
            </button>
          ))}
        </div>
      </div>
      <button onClick={signOut} style={{ width: '100%', padding: 14, borderRadius: 13, border: '1px solid rgba(220,60,60,0.28)', background: 'rgba(220,60,60,0.07)', color: '#e05555', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: "'Inter', sans-serif" }}>
        <LogOut size={15} /> Sign Out
      </button>
    </main>
  )
}

function MySurveysPage({ onBack }) {
  const t = useTheme(), { user } = useAuth()
  const weeklyMenu = useWeeklyMenu() || {}
  const [surveys, setSurveys] = useState({})
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('survey_submissions_flat').select('*').eq('user_id', user.id).maybeSingle()
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
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <BackHeader title="My Surveys" onBack={onBack} />
      {loading ? <Spinner /> : DAYS.map(day => {
        const dayData = surveys[day]; if (!dayData) return null
        return (
          <Card key={day} active style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <img src="/al-mawaid.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: t.accent, fontFamily: "'Inter', sans-serif" }}>{weeklyMenu[day]?.en || day}</div>
            </div>
            {['lunch', 'dinner'].map(meal => {
              const r = dayData[meal]; if (!r) return null
              return (
                <div key={meal} style={{ marginBottom: 8, padding: 11, background: t.inputBg, borderRadius: 10, border: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.accent, fontFamily: "'Inter', sans-serif" }}>{meal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}</span>
                    <span style={{ fontSize: 10, color: (r.edit_count || 0) < 1 ? t.accent : '#e05555', fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>{(r.edit_count || 0) < 1 ? '1 edit left' : 'no edits left'}</span>
                  </div>
                  <div style={{ fontSize: 13, color: r.wants_food ? t.successText : '#e05555', fontWeight: 700, fontFamily: "'Inter', sans-serif", marginBottom: r.wants_food ? 6 : 0 }}>{r.wants_food ? '✅ Requested Food' : '❌ Skipped'}</div>
                  {r.wants_food && r.dish_responses && Object.entries(r.dish_responses).map(([dish, val]) => (
                    <div key={dish} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${t.border}` }}>
                      <span style={{ fontSize: 12, color: t.textBody, fontFamily: "'Inter', sans-serif" }}>{dish}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: t.accent, fontFamily: "'Inter', sans-serif" }}>{val === 'yes' ? '✅' : val === 'no' ? '❌' : `${val}%`}</span>
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
  const almawaidHelplineWhatsApp = '911234567890'
  useEffect(() => { supabase.from('thali_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => setRequests(data || [])).finally(() => setLoading(false)) }, [])
  const statusColor = s => s === 'pending' ? '#d4882a' : s === 'approved' ? '#5eba82' : '#e05555'
  const typeLabel = tp => tp === 'resume' ? '▶️ Resume' : tp === 'stop' ? '⏹️ Stop' : '➕ Extra Food'
  const buildShareLink = (r) => {
    const lines = ['Assalamualaikum Al-Mawaid,', 'I want to share my request details.', `Request type: ${typeLabel(r.request_type)}`, `Status: ${(r.status || 'pending').toUpperCase()}`]
    if (r.from_date) lines.push(`Dates: ${r.from_date} to ${r.to_date}`)
    if (r.extra_items?.length) lines.push(`Items: ${r.extra_items.map(i => `${i.name} x${i.qty}`).join(', ')}`)
    if (r.admin_note) lines.push(`Admin note: ${r.admin_note}`)
    lines.push(`Created on: ${new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`)
    return `https://wa.me/${almawaidHelplineWhatsApp}?text=${encodeURIComponent(lines.join('\n'))}`
  }
  return (
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <BackHeader title="My Requests" onBack={onBack} />
      {loading ? <Spinner /> : requests.length === 0 ? <EmptyState msg="No requests yet." /> : requests.map(r => (
        <Card key={r.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'Inter', sans-serif" }}>{typeLabel(r.request_type)}</div>
              <span style={{ display: 'inline-flex', marginTop: 6, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${statusColor(r.status)}20`, color: statusColor(r.status), border: `1px solid ${statusColor(r.status)}40`, fontFamily: "'Inter', sans-serif" }}>{r.status?.toUpperCase()}</span>
            </div>
            <a href={buildShareLink(r)} target="_blank" rel="noreferrer" style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0, boxShadow: '0 8px 18px rgba(18,140,126,0.22)' }}><WhatsAppLogo size={18} /></a>
          </div>
          {r.from_date && <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'Inter', sans-serif" }}>{r.from_date} → {r.to_date}</div>}
          {r.extra_items && <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'Inter', sans-serif" }}>{r.extra_items.map(i => `${i.name} x${i.qty}`).join(', ')}</div>}
          {r.admin_note && <div style={{ marginTop: 8, fontSize: 12, color: t.accent, fontFamily: "'Inter', sans-serif" }}>Note: {r.admin_note}</div>}
          <div style={{ fontSize: 10, color: t.textSub, marginTop: 6, opacity: .5, fontFamily: "'Inter', sans-serif" }}>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </Card>
      ))}
    </main>
  )
}

function KhidmatTeamPage({ onBack }) {
  const t = useTheme()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { supabase.from('khidmat_guzaar').select('*').order('sort_order', { ascending: true }).then(({ data }) => setStaff(data || [])).finally(() => setLoading(false)) }, [])
  return (
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <BackHeader title="Khidmat Guzaar" onBack={onBack} />
      <div style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 12, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 13, color: t.accent, fontFamily: "'Inter', sans-serif" }}>🤝 Our dedicated service team — the ones who make every meal possible.</div>
      {loading ? <Spinner /> : staff.length === 0 ? <EmptyState msg="No staff profiles available." /> : staff.map(member => {
        const rawPhone = member.phone || '', actionPhone = rawPhone.replace(/[^\d+]/g, ''), whatsappPhone = actionPhone.replace(/^\+/, '')
        return (
          <Card key={member.id} active style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar avatarUrl={member.avatar_url} name={member.name} email="" size={60} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: t.accent, fontFamily: "'Inter', sans-serif" }}>{member.name}</div>
                {member.role && <div style={{ display: 'inline-block', marginTop: 4, padding: '2px 10px', borderRadius: 20, background: t.accentBg, border: `1px solid ${t.accentBorder}` }}><span style={{ fontSize: 11, fontWeight: 700, color: t.accent, fontFamily: "'Inter', sans-serif" }}>{member.role}</span></div>}
                {member.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}><Phone size={12} color={t.textSub} /><span style={{ fontSize: 12, color: t.textSub, fontFamily: "'Inter', sans-serif" }}>{member.phone}</span></div>}
                {member.area && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}><MapPin size={12} color={t.textSub} /><span style={{ fontSize: 12, color: t.textSub, fontFamily: "'Inter', sans-serif" }}>{member.area}</span></div>}
              </div>
            </div>
            {actionPhone && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <a href={`tel:${actionPhone}`} style={{ flex: 1, padding: '10px', borderRadius: 12, background: t.accentGrad, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}><Phone size={16} /> Call</a>
                <a href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '10px', borderRadius: 12, background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(18,140,126,0.2)' }}><WhatsAppLogo size={16} /> WhatsApp</a>
              </div>
            )}
          </Card>
        )
      })}
    </main>
  )
}

function NotificationsPage({ onBack }) {
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
    }
    fetchNotices()
  }, [user.id])

  const staticNotices = [
    { id: 'survey-window', title: 'Weekly Survey Window', body: isSurveyOpen() ? 'Your weekly meal survey is open now. Please submit lunch and dinner choices on time.' : getSurveyWindowMessage(), tone: t.accent },
  ]
  return (
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {onBack && <BackHeader title="Alerts" onBack={onBack} />}
      <SectionLabel>System Alerts</SectionLabel>
      {staticNotices.map(item => (
        <Card key={item.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${item.tone}20`, border: `1px solid ${item.tone}45`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bell size={18} color={item.tone} /></div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'Inter', sans-serif" }}>{item.title}</div>
              <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.6, marginTop: 4, fontFamily: "'Inter', sans-serif" }}>{item.body}</div>
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
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'Inter', sans-serif" }}>{item.title}</div>
                <div style={{ fontSize: 10, color: t.textSub }}>{item.sender_name}</div>
              </div>
              <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.6, marginTop: 4, fontFamily: "'Inter', sans-serif" }}>{item.body}</div>
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
  const inputStyle = { width: '100%', padding: '11px 13px', borderRadius: 16, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 14, outline: 'none', fontFamily: "'Inter', sans-serif" }
  const statusColor = s => s === 'open' ? '#d4882a' : s === 'resolved' ? '#5eba82' : '#7aabb8'

  useEffect(() => { loadTickets() }, [])
  const loadTickets = async () => {
    try {
      const { data } = await supabase.from('queries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
      setTickets((data || []).filter(item => (item.comment || '').startsWith('[Support Ticket]')))
    } catch { } finally { setLoading(false) }
  }
  const handleSubmit = async () => {
    if (!subject.trim()) return setError('Please enter a subject')
    if (!details.trim()) return setError('Please describe your problem')
    setError(''); setSuccess(''); setSubmitting(true)
    try {
      const { error: dbErr } = await supabase.from('queries').insert([{ user_id: user.id, comment: `[Support Ticket]\nType: ${ticketType}\nSubject: ${subject.trim()}\nIssue: ${details.trim()}`, media: [], status: 'open' }])
      if (dbErr) throw dbErr
      setSuccess('Support ticket submitted successfully.')
      setSubject(''); setDetails(''); setTicketType('general'); loadTickets()
    } catch (err) { setError(err.message) } finally { setSubmitting(false) }
  }

  return (
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {onBack && <BackHeader title="Support Ticket" onBack={onBack} />}
      <Card active style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.accent, marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>Raise a Support Ticket</div>
        <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.6, marginBottom: 14, fontFamily: "'Inter', sans-serif" }}>Tell us your problem and our team can follow up on general, thali-related, or delivery issues.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 12 }}>
          {issueTypes.map(type => (
            <button key={type.id} onClick={() => setTicketType(type.id)}
              style={{ padding: '11px 12px', borderRadius: 11, textAlign: 'left', cursor: 'pointer', border: `1px solid ${ticketType === type.id ? t.accentBorder : t.border}`, background: ticketType === type.id ? t.accentBg : t.card, color: ticketType === type.id ? t.accent : t.textSub, fontWeight: 700, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
              {type.label}
            </button>
          ))}
        </div>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={{ ...inputStyle, marginBottom: 10 }} />
        <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Describe your problem" style={{ ...inputStyle, minHeight: 110, resize: 'vertical', marginBottom: 10 }} />
        {error && <ErrorBanner msg={error} />}
        {success && <div style={{ marginBottom: 10, padding: 11, borderRadius: 10, background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.successText, fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>{success}</div>}
        <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: "'Inter', sans-serif" }}>{submitting ? 'Submitting...' : 'Submit Support Ticket'}</button>
      </Card>
      <SectionLabel>Recent Tickets</SectionLabel>
      {loading ? <Spinner /> : tickets.length === 0 ? <EmptyState msg="No support tickets raised yet." /> : tickets.map(ticket => (
        <Card key={ticket.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 }}>
            <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'Inter', sans-serif" }}>{new Date(ticket.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${statusColor(ticket.status)}20`, color: statusColor(ticket.status), border: `1px solid ${statusColor(ticket.status)}40`, fontFamily: "'Inter', sans-serif" }}>{ticket.status?.toUpperCase()}</span>
          </div>
          <div style={{ whiteSpace: 'pre-line', fontSize: 13, color: t.textBody, lineHeight: 1.7, fontFamily: "'Inter', sans-serif" }}>{ticket.comment?.replace('[Support Ticket]\n', '')}</div>
          {ticket.admin_reply && <div style={{ marginTop: 8, padding: 10, borderRadius: 9, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 13, color: t.accent, fontFamily: "'Inter', sans-serif" }}>Reply: {ticket.admin_reply}</div>}
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
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {onBack && <BackHeader title="About" onBack={onBack} />}
      {aboutCards.map(card => (
        <Card key={card.title} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: t.accentBg, border: `1px solid ${t.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Info size={18} color={t.accent} /></div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: "'Inter', sans-serif" }}>{card.title}</div>
              <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.7, marginTop: 4, fontFamily: "'Inter', sans-serif" }}>{card.body}</div>
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
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {onBack && <BackHeader title="Reset Password" onBack={onBack} />}
      <Card>
        <form onSubmit={handleReset}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 7, letterSpacing: '0.14em', fontFamily: "'Inter', sans-serif" }}>NEW PASSWORD</label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.accent, opacity: .6 }} />
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required placeholder="Enter new password" style={{ width: '100%', padding: '13px 13px 13px 44px', borderRadius: 12, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 15, outline: 'none', fontFamily: "'Inter', sans-serif" }} />
            </div>
          </div>
          {error && <ErrorBanner msg={error} />}
          {success && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: t.successBg, border: `1px solid ${t.successBorder}`, fontSize: 13, color: t.successText, fontFamily: "'Inter', sans-serif" }}>✅ {success}</div>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: loading ? t.border : t.accentGrad, color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1, fontFamily: "'Inter', sans-serif" }}>{loading ? 'Updating...' : 'Update Password'}</button>
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
  const [session, setSession] = useState(undefined)
  const [mockUser, setMockUser] = useState(() => {
    const saved = localStorage.getItem('al_mawaid_mock_user')
    return saved ? JSON.parse(saved) : null
  })
  const [portalRole, setPortalRole] = useState(() => localStorage.getItem('al_mawaid_portal') || null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess)
      if (!sess) {
        setPortalRole(null);
        setMockUser(null);
        localStorage.removeItem('al_mawaid_portal')
        localStorage.removeItem('al_mawaid_mock_user')
        window.OneSignal.push(() => {
          window.OneSignal.logout();
        });
      } else {
        window.OneSignal.push(() => {
          window.OneSignal.login(sess.user.id);
        });
      }
    })

    // OneSignal Init
    window.OneSignal = window.OneSignal || [];
    window.OneSignal.push(() => {
      window.OneSignal.init({
        appId: import.meta.env.VITE_ONESIGNAL_APP_ID || "36968038-7359-450f-90e8-07f9c8742913", // Fallback or use env
        safari_web_id: "web.onesignal.auto.10468a35-180a-48d1-817c-658231267812",
        notifyButton: { enable: true },
        allowLocalhostAsSecureOrigin: true,
      });
    });

    return () => subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setPortalRole(null)
    setMockUser(null)
    localStorage.removeItem('al_mawaid_portal')
    localStorage.removeItem('al_mawaid_mock_user')
  }, [])

  // Push notifications removed


  const handleRoleLogin = useCallback((role, sess) => {
    localStorage.setItem('al_mawaid_portal', role)
    if (role === 'inventory_manager' && sess?.user) {
      localStorage.setItem('al_mawaid_mock_user', JSON.stringify(sess.user))
      setMockUser(sess.user)
    }
    setPortalRole(role)
  }, [])

  if (session === undefined && !mockUser) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0d14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <div className="spin" style={{ width: 40, height: 40, border: '3px solid rgba(197, 160, 89, 0.1)', borderTop: '3px solid #c5a059', borderRadius: '50%' }} />
        <div style={{ color: '#c5a059', fontSize: 12, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.8 }}>AL-MAWAID</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}body{margin:0;background:#0a0d14;}`}</style>
      </div>
    )
  }

  if (!session && !mockUser) return <LoginPage onRoleLogin={handleRoleLogin} />

  const authValue = { user: session?.user || mockUser, signOut }

  if (portalRole === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (['supervisor', 'khidmat'].includes(portalRole)) {
    return (
      <AuthCtx.Provider value={authValue}>
        <ThemeCtx.Provider value={THEMES.royal}>
          <KhidmatPortal signOut={signOut} user={authValue.user} />
        </ThemeCtx.Provider>
      </AuthCtx.Provider>
    )
  }

  if (portalRole === 'inventory_manager') {
    return (
      <AuthCtx.Provider value={authValue}>
        <ThemeCtx.Provider value={THEMES.royal}>
          <InventoryManagerPortal signOut={signOut} user={authValue.user} />
        </ThemeCtx.Provider>
      </AuthCtx.Provider>
    )
  }

  return <AuthCtx.Provider value={authValue}><ThaliUserApp /></AuthCtx.Provider>
}