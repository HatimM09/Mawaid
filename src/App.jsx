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
  Sun, Moon
} from 'lucide-react'
import { supabase } from './admin/supabaseClient'
import { useWeeklyMenu } from './common/useWeeklyMenu'
import { AuthCtx, ThemeCtx, useAuth, useTheme } from './admin/context'
import { updateSystemTheme } from './admin/ui'
import KhidmatPortal from './admin/KhidmatPortal'
import InventoryManagerPortal from './admin/InventoryManagerPortal'
const THEMES = {
  midnight: {
    id: 'midnight', name: 'Royal Gold', icon: '👑',
    bg: '#0f0c08', bgGrad: 'radial-gradient(circle at 50% -20%, #2a2010 0%, #0f0c08 80%)',
    card: 'rgba(25, 20, 10, 0.72)', cardActive: 'linear-gradient(135deg, rgba(40, 30, 15, 0.8), rgba(20, 15, 10, 0.9))',
    border: 'rgba(212, 175, 55, 0.2)', borderActive: 'rgba(212, 175, 55, 0.45)',
    accent: '#D4AF37', accentGrad: 'linear-gradient(135deg, #B8860B, #D4AF37)',
    accentBg: 'rgba(212, 175, 55, 0.10)', accentBorder: 'rgba(212, 175, 55, 0.32)',
    text: '#FFF8E1', textSub: 'rgba(255, 248, 225, 0.6)', textBody: '#F0EAD2',
    navBg: 'rgba(15, 12, 8, 0.97)', navBorder: 'rgba(212, 175, 55, 0.25)',
    geo: 'rgba(212, 175, 55, 0.05)', spinnerBorder: 'rgba(212, 175, 55, 0.2)', spinnerTop: '#D4AF37',
    inputBg: 'rgba(25, 20, 10, 0.4)', inputBorder: 'rgba(212, 175, 55, 0.25)',
    loginCard: 'rgba(20, 16, 8, 0.92)', headerWave: '#0f0c08',
    successBg: 'rgba(94, 186, 130, 0.12)', successBorder: 'rgba(94, 186, 130, 0.3)', successText: '#5eba82',
  },
  ivory: {
    id: 'ivory', name: 'Ivory Dune', icon: '🏺',
    bg: '#faf6ef', bgGrad: 'linear-gradient(160deg,#faf6ef 0%,#f3ece0 60%,#faf6ef 100%)',
    card: '#ffffff', cardActive: 'linear-gradient(135deg,#fffdf8,#fef9f0)',
    border: 'rgba(160,100,60,0.14)', borderActive: 'rgba(185,105,55,0.4)',
    accent: '#9c5a2a', accentGrad: 'linear-gradient(135deg,#b8672f,#874a20)',
    accentBg: 'rgba(156,90,42,0.08)', accentBorder: 'rgba(156,90,42,0.28)',
    text: '#2a1a0e', textSub: '#7a5a40', textBody: '#5a3d28',
    navBg: 'rgba(250,246,239,0.97)', navBorder: 'rgba(156,90,42,0.18)',
    geo: 'rgba(156,90,42,0.06)', spinnerBorder: 'rgba(156,90,42,0.2)', spinnerTop: '#9c5a2a',
    inputBg: 'rgba(156,90,42,0.04)', inputBorder: 'rgba(156,90,42,0.2)',
    loginCard: 'rgba(255,255,255,0.96)', headerWave: '#faf6ef',
    successBg: 'rgba(60,140,80,0.08)', successBorder: 'rgba(60,140,80,0.28)', successText: '#3a7a50',
  },
  forest: {
    id: 'forest', name: 'Forest Qalam', icon: '🌿',
    bg: '#0a130e', bgGrad: 'linear-gradient(160deg,#0a130e 0%,#0f1f15 60%,#091108 100%)',
    card: '#111e14', cardActive: 'linear-gradient(135deg,#162a1a,#0f1f15)',
    border: 'rgba(120,180,100,0.13)', borderActive: 'rgba(180,158,80,0.42)',
    accent: '#b89e50', accentGrad: 'linear-gradient(135deg,#cab060,#9a7e38)',
    accentBg: 'rgba(184,158,80,0.10)', accentBorder: 'rgba(184,158,80,0.30)',
    text: '#e8f0e2', textSub: '#7aab82', textBody: '#a8c8a0',
    navBg: 'rgba(10,19,14,0.97)', navBorder: 'rgba(184,158,80,0.18)',
    geo: 'rgba(120,180,100,0.06)', spinnerBorder: 'rgba(184,158,80,0.2)', spinnerTop: '#b89e50',
    inputBg: 'rgba(120,180,100,0.05)', inputBorder: 'rgba(184,158,80,0.22)',
    loginCard: 'rgba(17,30,20,0.92)', headerWave: '#0a130e',
    successBg: 'rgba(80,180,100,0.12)', successBorder: 'rgba(80,180,100,0.3)', successText: '#60c078',
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
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: t.textSub, textTransform: 'uppercase', marginBottom: 12, fontFamily: "'DM Sans',sans-serif", opacity: .7 }}>{children}</div>
}

const Card = ({ children, active, style: extra = {} }) => {
  const t = useTheme()
  return (
    <div style={{ padding: '18px 18px', borderRadius: 16, background: active ? t.cardActive : t.card, border: `1px solid ${active ? t.borderActive : t.border}`, boxShadow: active ? `0 6px 24px ${t.accentBg}` : '0 2px 8px rgba(0,0,0,0.08)', ...extra }}>
      {children}
    </div>
  )
}

const Btn = ({ children, onClick, disabled, style: extra = {}, variant = 'primary' }) => {
  const t = useTheme()
  const baseStyle = {
    padding: '12px 20px', borderRadius: 14, border: 'none',
    fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'DM Sans', sans-serif", transition: 'all 0.3s ease',
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
  return <div style={{ textAlign: 'center', padding: 48, color: t.textSub, fontSize: 15, fontFamily: "'DM Sans',sans-serif" }}>{msg}</div>
}

const GlobalStyles = () => {
  const t = useTheme()
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@400;500;600;700;800&family=Amiri:wght@400;700&display=swap');
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
  { id: 'member', label: 'Thali User', icon: '👤' },
  { id: 'khidmat', label: 'Khidmat Guzar', icon: 'logo' },
  { id: 'inventory_manager', label: 'Inventory', icon: '📦' },
  { id: 'admin', label: 'Admin', icon: '🛡️' },
]

function LoginPage({ onRoleLogin }) {
  const t = THEMES.midnight
  const [role, setRole] = useState('member')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login')

  const inp = {
    width: '100%', padding: '13px 13px 13px 44px', borderRadius: 12, boxSizing: 'border-box',
    background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text,
    fontSize: 15, outline: 'none', fontFamily: "'DM Sans',sans-serif", transition: 'border 0.2s'
  }

  const handleAuth = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      if (role === 'member' && mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        setError('✅ Check your email for a verification link!')
        setLoading(false); return
      }
      if (role === 'inventory_manager') {
        const { data: invStaff, error: invErr } = await supabase
          .from('staff').select('*').ilike('email', email).eq('role', 'inventory_manager').maybeSingle()

        if (invErr || !invStaff) {
          throw new Error('Unauthorized: Email not registered as Inventory Manager.')
        }
        onRoleLogin('inventory_manager', { user: { email, id: invStaff.user_id || `inv_${invStaff.id}`, ...invStaff } })
        setLoading(false)
        return
      }

      const { data: { session }, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) throw signInErr

      if (role === 'member') { onRoleLogin('member', session); setLoading(false); return }

      let { data: staffRow, error: staffErr } = await supabase
        .from('staff').select('*').eq('user_id', session.user.id).maybeSingle()

      // Auto-link staff by email if user_id is missing
      if (!staffRow && !staffErr) {
        const { data: emailMatch } = await supabase
          .from('staff').select('*').eq('email', session.user.email).maybeSingle()
        if (emailMatch && !emailMatch.user_id) {
          const { data: updated } = await supabase
            .from('staff').update({ user_id: session.user.id }).eq('id', emailMatch.id).select().single()
          staffRow = updated
        } else if (emailMatch) {
          staffRow = emailMatch
        }
      }
      if (staffErr && staffErr.code !== 'PGRST116') {
        await supabase.auth.signOut(); throw new Error(staffErr.message)
      }
      const dbRole = staffRow?.role || ''
      if (role === 'admin' && dbRole !== 'admin') {
        await supabase.auth.signOut(); throw new Error('You do not have admin privileges.')
      }
      if (role === 'khidmat' && !['khidmat_guzar', 'supervisor', 'khidmat', 'admin'].includes(dbRole)) {
        await supabase.auth.signOut(); throw new Error('You are not registered as a Khidmat Guzar.')
      }
      onRoleLogin(dbRole === 'admin' ? 'admin' : dbRole, session)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, position: 'relative', overflow: 'hidden', fontFamily: "'DM Sans',sans-serif",
      background: '#0f0c08'
    }}>
      {/* Wheat background with blur */}
      <img
        src="/wheat_bg.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center',
          filter: 'blur(3px) brightness(0.7)',
          animation: 'kenburns 30s infinite alternate ease-in-out',
          zIndex: 0,
        }}
      />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'radial-gradient(circle at 50% 50%, rgba(30,25,10,0.1) 0%, rgba(15,12,8,0.5) 100%)',
        backdropFilter: 'saturate(1.2)',
      }} />

      {/* Main card with ornate border */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 440, padding: 10 }}>

        {/* Ornate golden border frame */}
        <div style={{
          position: 'relative',
          borderRadius: 28,
          padding: 3,
          background: 'linear-gradient(135deg, #8B6B23 0%, #D4AF37 30%, #B8860B 50%, #D4AF37 70%, #8B6B23 100%)',
          boxShadow: '0 0 0 1px rgba(184,134,11,0.4), 0 40px 100px rgba(0,0,0,0.85), 0 0 50px rgba(184,134,11,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}>
          {/* Corner ornaments */}
          {['0 0', '100% 0', '0 100%', '100% 100%'].map((pos, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: pos.includes('100% ') ? 'auto' : -8,
              right: pos.includes('100% ') ? -8 : 'auto',
              top: pos.includes('100%') ? 'auto' : -8,
              bottom: pos.includes('100%') ? -8 : 'auto',
              width: 36, height: 36, zIndex: 2,
              background: 'linear-gradient(135deg, #8B6B23, #D4AF37)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(139,107,35,0.7)',
              fontSize: 15, color: '#fff',
            }}>✦</div>
          ))}

          {/* Card interior — Royal Glassmorphism */}
          <div style={{
            borderRadius: 26,
            background: 'rgba(15, 12, 8, 0.28)',
            backdropFilter: 'blur(60px) saturate(2.2)',
            WebkitBackdropFilter: 'blur(60px) saturate(2.2)',
            padding: '24px 32px 28px',
            border: '1px solid rgba(212,175,55,0.3)',
            boxShadow: '0 25px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}>
            {/* Logo + Title */}
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{
                width: 72, height: 72, margin: '0 auto 8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                filter: 'drop-shadow(0 0 16px rgba(212,175,55,0.5)) drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
              }}>
                <img src="/al-mawaid.png" alt="Al-Mawaid" style={{ width: 66, height: 66, objectFit: 'contain' }} />
              </div>
              <h1 style={{
                margin: '0 0 0px', fontSize: 28, fontWeight: 700,
                background: 'linear-gradient(135deg, #D4AF37 0%, #F0EAD2 40%, #D4AF37 80%, #C5A059 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                letterSpacing: '0.08em', fontFamily: "'Cinzel','Playfair Display',serif"
              }}>Al-Mawaid</h1>
            </div>

            {/* Role tabs */}
            <div style={{
              display: 'flex', gap: 3, marginBottom: 10,
              background: 'rgba(25,20,10,0.12)',
              borderRadius: 14, padding: 4,
              border: '1px solid rgba(212,175,55,0.1)',
              backdropFilter: 'blur(30px) saturate(1.5)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}>
              {LOGIN_ROLES.map(r => {
                const active = role === r.id
                return (
                  <button key={r.id} onClick={() => { setRole(r.id); setError('') }} style={{
                    flex: 1, padding: '10px 4px', borderRadius: 11, border: 'none',
                    background: active ? 'linear-gradient(135deg, #B8860B, #8B6B23)' : 'transparent',
                    color: active ? '#fff' : t.textSub,
                    cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    boxShadow: active ? '0 4px 16px rgba(139,107,35,0.4)' : 'none',
                    transform: active ? 'scale(1.05)' : 'scale(1)',
                  }}>
                    <span style={{ fontSize: 20 }}>
                      {r.icon === 'logo'
                        ? <img src="/al-mawaid.png" alt="" style={{ width: 22, height: 22, objectFit: 'contain', filter: active ? 'brightness(10)' : 'none' }} />
                        : r.icon}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Role descriptor bar */}
            <div style={{
              marginBottom: 12, padding: '8px 14px', borderRadius: 10,
              background: 'rgba(212,175,55,0.05)',
              border: '1px solid rgba(212,175,55,0.15)',
              backdropFilter: 'blur(5px)',
              fontSize: 11, color: 'rgba(240,234,210,0.85)', textAlign: 'center',
              fontFamily: "'DM Sans',sans-serif", letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}>
              {role === 'member' && <><span>👤</span> Thali User — member portal</>}
              {role === 'khidmat' && <><img src="/al-mawaid.png" alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} /> Khidmat Guzar — service portal</>}
              {role === 'inventory_manager' && <><span>📦</span> Inventory Manager — stock portal</>}
              {role === 'admin' && <><span>🛡️</span> Admin — full management portal</>}
            </div>

            {/* Form */}
            <form onSubmit={handleAuth}>
              {/* Email */}
              <div style={{ marginBottom: 14 }}>
                <label style={{
                  display: 'block', fontSize: 10, fontWeight: 700,
                  color: 'rgba(212,175,55,0.9)', marginBottom: 8,
                  letterSpacing: '0.14em', fontFamily: "'DM Sans',sans-serif"
                }}>EMAIL</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(212,175,55,0.7)' }} />
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="your@email.com"
                    style={{
                      width: '100%', padding: '14px 16px 14px 44px', borderRadius: 12, boxSizing: 'border-box',
                      background: 'rgba(25, 20, 10, 0.45)', border: '1px solid rgba(212,175,55,0.25)',
                      color: '#FFF8E1', fontSize: 15, outline: 'none',
                      fontFamily: "'DM Sans',sans-serif", transition: 'all 0.25s',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#D4AF37'; e.target.style.boxShadow = '0 0 0 3px rgba(212, 175, 55, 0.2)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(212,175,55,0.25)'; e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)'; }}
                  />
                </div>
              </div>

              {/* Password — hidden for inventory */}
              {role !== 'inventory_manager' && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{
                    display: 'block', fontSize: 10, fontWeight: 700,
                    color: 'rgba(212,175,55,0.9)', marginBottom: 8,
                    letterSpacing: '0.14em', fontFamily: "'DM Sans',sans-serif"
                  }}>PASSWORD</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(212,175,55,0.7)' }} />
                    <input
                      type={showPass ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)} required
                      placeholder="••••••••"
                      style={{
                        width: '100%', padding: '14px 48px 14px 44px', borderRadius: 12, boxSizing: 'border-box',
                        background: 'rgba(25, 20, 10, 0.45)', border: '1px solid rgba(212,175,55,0.25)',
                        color: '#FFF8E1', fontSize: 15, outline: 'none',
                        fontFamily: "'DM Sans',sans-serif", transition: 'all 0.25s',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#D4AF37'; e.target.style.boxShadow = '0 0 0 3px rgba(212, 175, 55, 0.2)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(212,175,55,0.25)'; e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)'; }}
                    />
                    <button type="button" onClick={() => setShowPass(s => !s)} style={{
                      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                      color: 'rgba(212,175,55,0.7)', display: 'flex'
                    }}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              {error && <ErrorBanner msg={error} />}

              {/* Submit button — Royal Gold */}
              <button
                type="submit" disabled={loading}
                className="login-btn"
                style={{
                  width: '100%', padding: '15px 20px', borderRadius: 12, border: 'none', marginTop: 10,
                  background: loading
                    ? 'rgba(184,134,11,0.2)'
                    : 'linear-gradient(135deg, #8B6B23 0%, #D4AF37 35%, #FFD700 65%, #B8860B 100%)',
                  color: loading ? 'rgba(255,255,255,0.35)' : '#FFF8E1',
                  fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 6px 20px rgba(139,107,35,0.4), 0 0 15px rgba(212,175,55,0.2)',
                  transition: 'all 0.3s ease', fontFamily: "'Cinzel','DM Sans',sans-serif",
                  letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                {loading ? 'Please wait…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes kenburns {
          0% { transform: scale(1); }
          100% { transform: scale(1.15) translate(10px, 5px); }
        }
        .spin { animation: spin 0.8s linear infinite; }
        body { margin: 0; }
        input::placeholder { color: rgba(212,175,55,0.35); }
        .login-btn {
          width: 100%; padding: 15px 20px; borderRadius: 12; border: 1px solid rgba(212,175,55,0.6) !important; marginTop: 10px;
          background: rgba(212,175,55,0.05) !important;
          backdrop-filter: blur(15px);
          color: #FFF8E1;
          fontSize: 15px; fontWeight: 800; cursor: pointer;
          boxShadow: 0 0 20px rgba(212,175,55,0.15);
          transition: all 0.3s ease; fontFamily: "'Cinzel','DM Sans',sans-serif";
          letterSpacing: 0.08em; display: flex; alignItems: center; justifyContent: center; gap: 8px;
        }
        .login-btn:hover:not(:disabled) {
          background: rgba(212,175,55,0.15) !important;
          border-color: #D4AF37 !important;
          box-shadow: 0 0 30px rgba(212,175,55,0.3), 0 8px 32px rgba(0,0,0,0.5) !important;
          transform: translateY(-1px);
        }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
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

      const { data } = await supabase.from('survey_submissions_flat').select('*').eq('user_id', user.id).single()
      if (data) {
        const dayKey = currentDay.substring(0, 3).toLowerCase()
        const mealKey = currentMeal === 'lunch' ? 'l' : 'd'
        const status = data[`${dayKey}_${mealKey}_status`]
        const editCount = (data.edit_metadata || {})[`${dayKey}_${mealKey}`] || 0

        setExistingResponse({ ...data, edit_count: editCount })
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
    } catch {
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

        const updateObj = {
          user_id: user.id,
          thali_no: userData.thali_no,
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
      <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: 20, padding: 22, maxWidth: 500, width: '100%', border: `1px solid ${t.borderActive}`, boxShadow: '0 28px 70px rgba(0,0,0,0.55)', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: t.inputBg, borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: t.accentGrad, borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>

        {/* Day pills */}
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 14, paddingBottom: 2, scrollbarWidth: 'none' }}>
          {DAYS.map(day => (
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
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif" }}>{menu.en}</h2>
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
            ⚠️ 1 edit already used for this meal — view only.
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
              <div key={dish} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${t.border}` }}>
                <span style={{ fontSize: 13, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{dish}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>{val === 'yes' ? '✅' : val === 'no' ? '❌' : `${val}%`}</span>
              </div>
            ))}
          </div>
        ) : wantsFood === null ? (
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 14, fontFamily: "'DM Sans',sans-serif" }}>
              Do you want {currentMeal} for {menu.en}?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="stagger-item" onClick={() => setWantsFood(true)}
                style={{ flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${t.accent}`, background: t.accentBg, color: t.accent, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>✅ Yes</button>
              <button className="stagger-item" onClick={() => { setWantsFood(false); setTimeout(handleNext, 200) }}
                style={{ flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>❌ No</button>
            </div>
          </div>
        ) : wantsFood ? (
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 10, fontFamily: "'DM Sans',sans-serif" }}>Select portion for each dish:</p>
            {dishes.map((dish, idx) => (
              <div key={dish} className="stagger-item" style={{ marginBottom: 10, padding: 12, background: t.inputBg, borderRadius: 11, animationDelay: `${0.1 + idx * 0.05}s` }}>
                <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{dish}</p>
                {isRotiItem(dish) ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['yes', 'no'].map(opt => (
                      <button key={opt} onClick={() => setResponses(prev => ({ ...prev, [dish]: opt }))}
                        style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: `1.5px solid ${responses[dish] === opt ? (opt === 'yes' ? t.accent : '#e05555') : t.border}`, background: responses[dish] === opt ? (opt === 'yes' ? t.accentBg : 'rgba(220,80,80,0.09)') : 'transparent', color: responses[dish] === opt ? (opt === 'yes' ? t.accent : '#e05555') : t.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                        {opt === 'yes' ? '✅ Yes' : '❌ No'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[0, 25, 50, 100].map(pct => (
                      <button key={pct} onClick={() => setResponses(prev => ({ ...prev, [dish]: pct }))}
                        style={{ flex: 1, padding: '7px 2px', borderRadius: 9, border: `1.5px solid ${responses[dish] === pct ? t.accent : t.border}`, background: responses[dish] === pct ? t.accentBg : 'transparent', color: responses[dish] === pct ? t.accent : t.text, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                        {pct}%
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button onClick={handleNext} disabled={loading || Object.keys(responses).length < dishes.length}
              style={{ width: '100%', padding: 13, borderRadius: 11, border: 'none', marginTop: 6, background: Object.keys(responses).length < dishes.length ? t.border : t.accentGrad, color: '#fff', fontSize: 14, fontWeight: 700, cursor: Object.keys(responses).length < dishes.length ? 'not-allowed' : 'pointer', opacity: Object.keys(responses).length < dishes.length ? .5 : 1, fontFamily: "'DM Sans',sans-serif" }}>
              {loading ? 'Saving…' : isLast ? 'Complete Survey ✓' : 'Save & Next →'}
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
// THALI USER APP
// ══════════════════════════════════════════════════════════════
function ThaliUserApp() {
  const [activeTab, setActiveTab] = useState('home')
  const [theme, setTheme] = useState(() => localStorage.getItem('almawaid_theme') || 'midnight')
  const t = THEMES[theme] || THEMES.midnight

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
  const tabLabels = { home: 'AL-MAWAID', menu: 'WEEKLY MENU', post: 'REQUESTS', profile: 'PROFILE' }

  return (
    <ThemeCtx.Provider value={t}>
      <div style={{ fontFamily: "'DM Sans','Segoe UI',-apple-system,sans-serif", minHeight: '100vh', background: t.bgGrad, color: t.text, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}>
        <header style={{ position: 'relative', overflow: 'hidden', background: t.bgGrad, padding: '14px 0 0', flexShrink: 0 }}>
          <GeoBg t={t} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 800, margin: '0 auto', padding: '0 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src="/al-mawaid.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(196,156,90,0.5))' }} />
                <span style={{ fontSize: 9, letterSpacing: '0.24em', textTransform: 'uppercase', color: t.textSub, opacity: .55, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>Al-Mawaid</span>
              </div>
              <span style={{ fontSize: 11, color: t.textSub, opacity: .4, fontFamily: "'DM Sans',sans-serif" }}>
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            {activeTab === 'home' && (
              <div style={{ textAlign: 'center', marginBottom: 2 }}>
                <p style={{ fontFamily: "'Noto Nastaliq Urdu','Amiri',serif", fontSize: 16, color: t.accent, margin: 0, lineHeight: 1.8 }}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
              </div>
            )}
            <div style={{ textAlign: 'center', marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: activeTab === 'home' ? 28 : 20, fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.1, color: t.accent, fontFamily: "'Playfair Display',serif" }}>{tabLabels[activeTab]}</h1>
            </div>
          </div>
          <svg style={{ display: 'block', position: 'relative', zIndex: 1 }} width="100%" viewBox="0 0 1440 28" preserveAspectRatio="none">
            <path d="M0,10 C200,28 400,0 600,14 C800,28 1000,4 1200,18 C1320,26 1400,10 1440,14 L1440,28 L0,28 Z" fill={t.headerWave} opacity="0.9" />
          </svg>
        </header>

        {activeTab === 'home' && <HomePage setActiveTab={setActiveTab} />}
        {activeTab === 'menu' && <WeeklyMenuPage />}
        {activeTab === 'post' && <PostPage />}
        {activeTab === 'profile' && <ProfilePage theme={theme} setTheme={handleSetTheme} />}

        <nav className="mobile-bottom-nav" style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 800, zIndex: 30, display: 'flex',
          justifyContent: 'space-around', alignItems: 'center', padding: '8px 4px 18px',
          background: t.navBg, borderTop: `1px solid ${t.navBorder}`,
          boxShadow: '0 -8px 30px rgba(0,0,0,0.20)',
          borderRadius: '24px 24px 0 0'
        }}>
          {tabs.map(({ id, label, Icon }) => {
            const active = activeTab === id
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '2px 14px', position: 'relative', WebkitTapHighlightColor: 'transparent' }}>
                {active && <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', width: 28, height: 2.5, borderRadius: 6, background: t.accent }} />}
                <div style={{ width: 36, height: 36, borderRadius: '50%', transition: 'all 0.25s', background: active ? t.accentBg : 'transparent', border: active ? `1px solid ${t.accentBorder}` : '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color={active ? t.accent : t.textSub} strokeWidth={active ? 2.2 : 1.5} style={{ opacity: active ? 1 : .5 }} />
                </div>
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', color: active ? t.accent : t.textSub, opacity: active ? 1 : .45, fontFamily: "'DM Sans',sans-serif" }}>{label}</span>
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
  const weeklyMenu = useWeeklyMenu() || {}
  const { user } = useAuth()
  const [showSurvey, setShowSurvey] = useState(false)
  const [profileData, setProfileData] = useState({ name: '', thali_number: '', avatar_url: '' })
  const [statsLoading, setStatsLoading] = useState(true)
  const [paymentError, setPaymentError] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentReceipt, setPaymentReceipt] = useState(null)
  const fixedPaymentAmount = '400.00'
  const surveyOpen = isSurveyOpen()
  const todayKey = getTodayKey()

  // Feedback State
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState({ lunch: false, dinner: false })
  const [lunchStars, setLunchStars] = useState(0)
  const [dinnerStars, setDinnerStars] = useState(0)
  const [lunchComment, setLunchComment] = useState('')
  const [dinnerComment, setDinnerComment] = useState('')
  const [hoveredLunch, setHoveredLunch] = useState(0)
  const [hoveredDinner, setHoveredDinner] = useState(0)
  const STAR_EMOJIS = { 1: '😡', 2: '😟', 3: '😐', 4: '😊', 5: '😍' }
  const STAR_LABELS = { 1: 'Terrible', 2: 'Poor', 3: 'Okay', 4: 'Good', 5: 'Excellent!' }

  useEffect(() => { loadData() }, [user])

  const loadData = async () => {
    try {
      const { data } = await supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle()
      if (data) setProfileData({ name: data.name || '', thali_number: data.thali_number || '', avatar_url: data.avatar_url || '' })
    } catch { }
    try {
      const { data } = await supabase.from('payments').select('*').eq('user_id', user.id).ilike('status', 'success').order('created_at', { ascending: false }).limit(1)
      if (data && data.length > 0) {
        const p = data[0]
        setPaymentReceipt({ orderId: p.order_id, amount: p.amount, date: new Date(p.created_at).toLocaleString('en-IN'), paymentMethod: p.method || 'Online Payment' })
      }
    } catch { }
    setStatsLoading(false)
    loadTodayFeedback()
  }

  const loadTodayFeedback = async () => {
    try {
      const { data } = await supabase.from('daily_feedback').select('*').eq('user_id', user.id).eq('day', todayKey)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (data) {
        setFeedbackSubmitted({ lunch: !!data.lunch_stars, dinner: !!data.dinner_stars })
        if (data.lunch_stars) setLunchStars(data.lunch_stars)
        if (data.dinner_stars) setDinnerStars(data.dinner_stars)
        if (data.lunch_comment) setLunchComment(data.lunch_comment)
        if (data.dinner_comment) setDinnerComment(data.dinner_comment)
      }
    } catch { }
  }

  const handleSubmitCombined = async () => {
    if (!lunchStars && !dinnerStars) return alert('Please rate at least one meal')
    setSubmittingFeedback(true)
    try {
      const { error: dbErr } = await supabase.from('daily_feedback').upsert([{
        user_id: user.id, day: todayKey,
        lunch_stars: lunchStars, lunch_emoji: lunchStars ? STAR_EMOJIS[lunchStars] : null,
        dinner_stars: dinnerStars, dinner_emoji: dinnerStars ? STAR_EMOJIS[dinnerStars] : null,
        comment: lunchComment.trim(), // Unified comment field
        created_at: new Date().toISOString()
      }], { onConflict: 'user_id,day' })
      if (dbErr) throw dbErr
      setFeedbackSubmitted({ lunch: !!lunchStars, dinner: !!dinnerStars })
    } catch { } finally { setSubmittingFeedback(false) }
  }

  const handleCashfreePayment = async () => {
    setPaymentLoading(true); setPaymentError('')
    try {
      const orderId = 'ORDER_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
      const payload = {
        amount: fixedPaymentAmount, order_id: orderId,
        customer_id: user?.id || 'cust_123',
        customer_name: profileData?.name || user?.email?.split('@')[0] || 'User',
        customer_email: user?.email || 'user@example.com',
        customer_phone: '9999999999'
      }
      const functionUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/create-cashfree-order'
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify(payload)
      })
      if (!res.ok) { const errText = await res.text(); throw new Error(`Edge Function error (${res.status}): ${errText}`) }
      const data = await res.json(); if (data?.error) throw new Error(data.error)

      let cfInstance
      if (window.Cashfree) {
        cfInstance = window.Cashfree({ mode: 'production' })
      } else {
        await new Promise(resolve => {
          const s = document.createElement('script')
          s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
          s.onload = resolve
          document.body.appendChild(s)
        })
        cfInstance = window.Cashfree({ mode: 'production' })
      }

      const result = await cfInstance.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: '_modal'
      })

      if (result.error) {
        setPaymentError(result.error.message || 'Payment failed.')
      } else if (result.paymentDetails) {
        const methodString = result.paymentDetails?.paymentMessage || 'Online UPI/Card Payment'
        setPaymentReceipt({
          orderId: data.order_id,
          amount: fixedPaymentAmount,
          date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
          paymentMethod: methodString
        })
        supabase.from('payments').insert([{
          user_id: user?.id,
          order_id: data.order_id,
          amount: fixedPaymentAmount,
          method: methodString,
          status: 'success'
        }]).then(() => null)
      }
    } catch (err) {
      setPaymentError(err.message || 'Failed to initialize payment')
    } finally {
      setPaymentLoading(false)
    }
  }

  return (
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Profile strip */}
      <Card active style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, padding: '12px 16px' }}>
        <Avatar avatarUrl={profileData?.avatar_url} name={profileData?.name} size={48} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display',serif" }}>{profileData?.name || 'Thali User'}</div>
          <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>Thali #{profileData?.thali_number || '—'}</div>
        </div>
      </Card>

      {/* Payment Section */}
      {statsLoading ? (
        <Card className="stagger-item" style={{ marginBottom: 18, display: 'flex', justifyContent: 'center', padding: '30px 0' }}><Spinner fullPage={false} /></Card>
      ) : !paymentReceipt ? (
        <Card className="stagger-item" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>UPI Payment</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: t.accent, marginTop: 4, fontFamily: "'Playfair Display',serif" }}>Pay ₹{fixedPaymentAmount}</div>
              <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: t.inputBg, border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 11, color: t.textSub, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.6 }}>Pay securely using Cashfree Payments Gateway.</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
              {!paymentLoading
                ? <button onClick={handleCashfreePayment} style={{ minWidth: 190, padding: '13px 18px', border: 'none', borderRadius: 14, background: t.accentGrad, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 10px 24px ${t.accentBg}`, fontFamily: "'DM Sans',sans-serif" }}>
                  <Wallet size={16} /> Secure Pay with Cashfree
                </button>
                : <div style={{ minWidth: 190, padding: '13px 18px', border: `1px solid ${t.border}`, borderRadius: 14, background: t.card, color: t.accent, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: "'DM Sans',sans-serif" }}>Processing...</div>
              }
            </div>
          </div>
          {paymentError && <ErrorBanner msg={paymentError} />}
        </Card>
      ) : (
        <Card active className="stagger-item" style={{ marginBottom: 18, background: 'rgba(94,186,130,0.06)', border: `1px solid ${t.successBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#5eba82,#3d9a60)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 20px rgba(94,186,130,0.25)' }}><Check size={20} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.successText, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'DM Sans',sans-serif" }}>Payment Confirmed</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: t.text, marginTop: 2, fontFamily: "'Playfair Display',serif" }}>₹{paymentReceipt.amount} Paid Successfully</div>
            </div>
          </div>
        </Card>
      )}

      {/* Survey filling button */}
      <button onClick={() => setShowSurvey(true)} disabled={!surveyOpen}
        style={{ width: '100%', padding: '16px 20px', borderRadius: 16, border: 'none', marginBottom: 18, background: surveyOpen ? t.accentGrad : t.border, color: '#fff', fontSize: 16, fontWeight: 800, cursor: surveyOpen ? 'pointer' : 'not-allowed', opacity: surveyOpen ? 1 : .55, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: surveyOpen ? `0 10px 28px ${t.accentBg}` : 'none', fontFamily: "'Playfair Display',serif", letterSpacing: '0.02em' }}>
        <ClipboardList size={20} /> Fill Weekly Survey Now
      </button>

      {/* Integrated Daily Feedback & Menu */}
      <SectionLabel>Today's Experience</SectionLabel>
      <Card active={!feedbackSubmitted.lunch || !feedbackSubmitted.dinner} style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif" }}>Daily Meal Feedback</div>
          {(feedbackSubmitted.lunch || feedbackSubmitted.dinner) && <Badge color={t.successBg}>Submitted ✅</Badge>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {['lunch', 'dinner'].map(meal => {
            const isLunch = meal === 'lunch'
            const stars = isLunch ? lunchStars : dinnerStars
            const setStars = isLunch ? setLunchStars : setDinnerStars
            const hovered = isLunch ? hoveredLunch : hoveredDinner
            const setHovered = isLunch ? setHoveredLunch : setHoveredDinner
            const menuItems = weeklyMenu[todayKey]?.[meal] || []

            return (
              <div key={meal} style={{ background: 'rgba(25, 20, 10, 0.4)', borderRadius: 16, padding: 16, border: `1px solid ${t.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  {isLunch ? <Sun size={14} color={t.accent} /> : <Moon size={14} color={t.accent} />}
                  <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{meal}</div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                  {menuItems.map(d => (
                    <span key={d} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: t.accentBg, color: t.accent, border: `1px solid ${t.accentBorder}` }}>{d}</span>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setStars(n)} onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                      <Star size={18} fill={n <= (hovered || stars) ? t.accent : 'none'} color={n <= (hovered || stars) ? t.accent : t.border} strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: t.textSub, marginBottom: 8, textTransform: 'uppercase' }}>Your Comments</label>
          <textarea
            value={lunchComment}
            onChange={e => {
              setLunchComment(e.target.value)
              setDinnerComment(e.target.value)
            }}
            placeholder="Tell us what you liked or how we can improve..."
            style={{
              width: '100%', padding: '14px', borderRadius: 14, background: t.inputBg,
              border: `1px solid ${t.border}`, color: t.text, fontSize: 14,
              resize: 'none', outline: 'none', fontFamily: 'inherit', minHeight: 80
            }}
          />
        </div>

        <Btn
          onClick={handleSubmitCombined}
          disabled={submittingFeedback || (!lunchStars && !dinnerStars)}
          style={{ width: '100%', height: 50, fontSize: 15 }}
        >
          {submittingFeedback ? 'Saving Feedback...' : 'Submit Daily Feedback'}
        </Btn>
      </Card>

      {showSurvey && <SurveyModal startDay="monday" onClose={() => { setShowSurvey(false); loadData() }} />}
    </main>
  )
}

function WeeklyMenuPage() {
  const t = useTheme()
  const weeklyMenu = useWeeklyMenu() || {}
  const todayKey = getTodayKey()

  return (
    <main style={{ flex: 1, padding: '16px 16px 100px', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 18, padding: '16px 18px', borderRadius: 16, background: t.cardActive, border: `1px solid ${t.borderActive}`, textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: t.textSub, marginBottom: 5, fontFamily: "'DM Sans',sans-serif" }}>AL-MAWAID</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif" }}>This Week's Menu</div>
      </div>

      {DAYS.map((day) => {
        const menu = weeklyMenu[day] || { en: '', ar: '', lunch: [], dinner: [] }
        const isToday = day === todayKey
        return (
          <Card key={day} active={isToday} style={{ marginBottom: 15, position: 'relative', overflow: 'hidden' }}>
            {isToday && <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: t.accent }} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: isToday ? t.accent : t.text, fontFamily: "'Playfair Display',serif" }}>{day.toUpperCase()}</div>
              {isToday && <span style={{ fontSize: 10, fontWeight: 800, background: t.accent, color: '#000', padding: '2px 8px', borderRadius: 10 }}>TODAY</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: t.inputBg, padding: 12, borderRadius: 12, border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.accent, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Sun size={12} /> LUNCH</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {menu.lunch.length > 0 ? menu.lunch.map(d => (
                    <span key={d} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: t.card, color: t.text, border: `1px solid ${t.border}` }}>{d}</span>
                  )) : <span style={{ fontSize: 11, color: t.textSub }}>No menu</span>}
                </div>
              </div>
              <div style={{ background: t.inputBg, padding: 12, borderRadius: 12, border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.accent, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Moon size={12} /> DINNER</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {menu.dinner.length > 0 ? menu.dinner.map(d => (
                    <span key={d} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: t.card, color: t.text, border: `1px solid ${t.border}` }}>{d}</span>
                  )) : <span style={{ fontSize: 11, color: t.textSub }}>No menu</span>}
                </div>
              </div>
            </div>
            {(menu.en || menu.ar) && (
              <div style={{ marginTop: 10, textAlign: 'center', opacity: 0.8 }}>
                <div style={{ fontSize: 13, color: t.accent, fontWeight: 600 }}>{menu.en}</div>
                <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'Amiri',serif" }}>{menu.ar}</div>
              </div>
            )}
          </Card>
        )
      })}
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
  const [extraItems, setExtraItems] = useState([{ name: '', qty: 1 }])
  const today = new Date().toISOString().split('T')[0]
  const inp = { width: '100%', padding: '11px 13px', borderRadius: 11, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif" }

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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>FROM</label><input type="date" value={resumeFrom} min={today} onChange={e => setResumeFrom(e.target.value)} style={inp} /></div>
              <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>TO</label><input type="date" value={resumeTo} min={resumeFrom || today} onChange={e => setResumeTo(e.target.value)} style={inp} /></div>
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
        <div style={{ fontSize: 15, fontWeight: 700, color: t.accent, marginBottom: 12, fontFamily: "'Playfair Display',serif" }}>✉️ New Query</div>
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
            <a href={buildQueryShareLink(q)} target="_blank" rel="noreferrer" style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0, boxShadow: '0 8px 18px rgba(18,140,126,0.22)' }}><WhatsAppLogo size={18} /></a>
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
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{label}</div>
        <div style={{ fontSize: 12, color: t.textSub, marginTop: 1, fontFamily: "'DM Sans',sans-serif" }}>{desc}</div>
      </div>
      <ChevronRight size={15} color={t.textSub} />
    </button>
  )

  if (loading) return <Spinner />
  return (
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
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
      <SectionLabel>My Activity</SectionLabel>
      <NavCard label="My Surveys" icon={<ClipboardList size={19} color="#fff" />} desc="View your weekly survey responses" onClick={() => onNav('surveys')} />
      <NavCard label="My Requests" icon={<img src="/al-mawaid.png" alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />} desc="Resume, stop & extra food requests" onClick={() => onNav('requests')} />
      <NavCard label="Khidmat Guzaar" icon={<Users size={19} color="#fff" />} desc="Meet our service team" onClick={() => onNav('khidmat')} />
      <NavCard label="Alerts" icon={<Bell size={19} color="#fff" />} desc="See notices and important updates" onClick={() => onNav('notifications')} />
      <NavCard label="Support Ticket" icon={<LifeBuoy size={19} color="#fff" />} desc="Raise general, thali, and delivery issues" onClick={() => onNav('support')} />
      <NavCard label="About" icon={<Info size={19} color="#fff" />} desc="Learn more about the app and services" onClick={() => onNav('about')} />
      <NavCard label="Reset Password" icon={<Lock size={19} color="#fff" />} desc="Update your account password" onClick={() => onNav('reset_password')} />
      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <SectionLabel>App Theme</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.values(THEMES).map(th => (
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
      <button onClick={signOut} style={{ width: '100%', padding: 14, borderRadius: 13, border: '1px solid rgba(220,60,60,0.28)', background: 'rgba(220,60,60,0.07)', color: '#e05555', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: "'DM Sans',sans-serif" }}>
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
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{typeLabel(r.request_type)}</div>
              <span style={{ display: 'inline-flex', marginTop: 6, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${statusColor(r.status)}20`, color: statusColor(r.status), border: `1px solid ${statusColor(r.status)}40`, fontFamily: "'DM Sans',sans-serif" }}>{r.status?.toUpperCase()}</span>
            </div>
            <a href={buildShareLink(r)} target="_blank" rel="noreferrer" style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0, boxShadow: '0 8px 18px rgba(18,140,126,0.22)' }}><WhatsAppLogo size={18} /></a>
          </div>
          {r.from_date && <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{r.from_date} → {r.to_date}</div>}
          {r.extra_items && <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{r.extra_items.map(i => `${i.name} x${i.qty}`).join(', ')}</div>}
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
  const [loading, setLoading] = useState(true)
  useEffect(() => { supabase.from('khidmat_guzaar').select('*').order('sort_order', { ascending: true }).then(({ data }) => setStaff(data || [])).finally(() => setLoading(false)) }, [])
  return (
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <BackHeader title="Khidmat Guzaar" onBack={onBack} />
      <div style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 12, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 13, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>🤝 Our dedicated service team — the ones who make every meal possible.</div>
      {loading ? <Spinner /> : staff.length === 0 ? <EmptyState msg="No staff profiles available." /> : staff.map(member => {
        const rawPhone = member.phone || '', actionPhone = rawPhone.replace(/[^\d+]/g, ''), whatsappPhone = actionPhone.replace(/^\+/, '')
        return (
          <Card key={member.id} active style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
            <Avatar avatarUrl={member.avatar_url} name={member.name} email="" size={60} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif" }}>{member.name}</div>
              {member.role && <div style={{ display: 'inline-block', marginTop: 4, padding: '2px 10px', borderRadius: 20, background: t.accentBg, border: `1px solid ${t.accentBorder}` }}><span style={{ fontSize: 11, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>{member.role}</span></div>}
              {member.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}><Phone size={12} color={t.textSub} /><span style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{member.phone}</span></div>}
              {member.area && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}><MapPin size={12} color={t.textSub} /><span style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{member.area}</span></div>}
            </div>
            {actionPhone && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                <a href={`tel:${actionPhone}`} style={{ width: 42, height: 42, borderRadius: 12, background: t.accentGrad, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxShadow: '0 8px 18px rgba(0,0,0,0.18)' }}><Phone size={16} /></a>
                <a href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer" style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxShadow: '0 8px 18px rgba(18,140,126,0.22)' }}><WhatsAppLogo size={18} /></a>
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
  const inputStyle = { width: '100%', padding: '11px 13px', borderRadius: 11, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif" }
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
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
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
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
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
// KHIDMAT GUZAR PORTAL
// ══════════════════════════════════════════════════════════════

function KhidmatHomePage({ staffInfo, setActiveTab }) {
  const t = useTheme()
  const weeklyMenu = useWeeklyMenu() || {}
  const todayKey = getTodayKey()
  const menu = weeklyMenu[todayKey] || { en: '', ar: '', lunch: [], dinner: [] }

  return (
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <Card active style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `2px solid ${t.accent}` }}>
          <img src="/al-mawaid.png" alt="Al-Mawaid" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif", lineHeight: 1.2 }}>{staffInfo?.name || 'Khidmat Guzar'}</div>
          <div style={{ fontSize: 12, color: t.textSub, marginTop: 2, fontFamily: "'DM Sans',sans-serif" }}>{staffInfo?.role || 'Service Staff'}</div>
          {staffInfo?.area && <div style={{ fontSize: 12, color: t.textSub, marginTop: 1, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'DM Sans',sans-serif" }}><MapPin size={11} color={t.textSub} />{staffInfo.area}</div>}
        </div>
        <div style={{ padding: '4px 12px', borderRadius: 20, background: t.accentBg, border: `1px solid ${t.accentBorder}` }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>Staff</span>
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.accent, marginBottom: 12, fontFamily: "'Playfair Display',serif" }}>Today's Menu — {menu.en}</div>
        {[['☀️ Lunch', menu.lunch], ['🌙 Dinner', menu.dinner]].map(([label, dishes]) => (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, marginBottom: 6, fontFamily: "'DM Sans',sans-serif" }}>{label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {dishes.map(d => (
                <span key={d} style={{ padding: '4px 10px', borderRadius: 20, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 12, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>{d}</span>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Thali Requests', icon: <img src="/al-mawaid.png" alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />, tab: 'thali_requests' },
          { label: 'Inventory', icon: <Upload size={18} />, tab: 'inventory' },
        ].map(({ label, icon, tab }) => (
          <button key={label} onClick={() => setActiveTab(tab)}
            style={{ padding: '14px 10px', borderRadius: 13, border: `1px solid ${t.accentBorder}`, background: t.accentBg, color: t.accent, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s' }}>
            {icon}{label}
          </button>
        ))}
      </div>

      <Card active style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.accent, marginBottom: 12, fontFamily: "'Playfair Display',serif" }}>Service Information</div>
        <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>
          As a Khidmat Guzar, you play a vital role in our service delivery. Please use the Requests tab to manage thali user requests and stay updated with important notices.
        </div>
      </Card>
    </main>
  )
}

// ══════════════════════════════════════════════════════════════
// KHIDMAT — THALI REQUESTS (view & manage thaali user requests/queries)
// ══════════════════════════════════════════════════════════════
function KhidmatThaliRequestsPage() {
  const t = useTheme()
  const [subTab, setSubTab] = useState('thali')
  return (
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 700, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, background: t.card, borderRadius: 13, padding: 5, border: `1px solid ${t.border}` }}>
        {[{ id: 'thali', label: '🥗 Thali Requests' }, { id: 'queries', label: '❓ Thali User Queries' }].map(({ id, label }) => (
          <button key={id} onClick={() => setSubTab(id)}
            style={{ flex: 1, padding: '10px 6px', borderRadius: 9, border: 'none', background: subTab === id ? t.accentGrad : 'transparent', color: subTab === id ? '#fff' : t.textSub, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.25s' }}>
            {label}
          </button>
        ))}
      </div>
      {subTab === 'thali' && <KhidmatAllThaliRequests />}
      {subTab === 'queries' && <KhidmatMemberQueries />}
    </main>
  )
}

function KhidmatAllThaliRequests() {
  const t = useTheme()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => { loadRequests() }, [filter])

  const loadRequests = async () => {
    setLoading(true)
    try {
      let q = supabase.from('thali_requests').select('*, user_stats(name, thali_number, phone)').order('created_at', { ascending: false })
      if (filter !== 'all') q = q.eq('status', filter)
      const { data } = await q
      setRequests(data || [])
    } catch { } finally { setLoading(false) }
  }

  const statusColor = s => s === 'pending' ? '#d4882a' : s === 'approved' ? '#5eba82' : '#e05555'
  const typeLabel = tp => tp === 'resume' ? '▶️ Resume' : tp === 'stop' ? '⏹️ Stop' : '➕ Extra Food'

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {['pending', 'approved', 'rejected', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filter === f ? t.accent : t.border}`, background: filter === f ? t.accentBg : 'transparent', color: filter === f ? t.accent : t.textSub, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", textTransform: 'capitalize' }}>
            {f}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : requests.length === 0 ? <EmptyState msg="No requests found." /> : requests.map(r => {
        const member = r.user_stats // representing a thali user
        return (
          <div key={r.id} style={{ marginBottom: 12, borderRadius: 16, border: `1px solid ${t.border}`, background: t.card, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{typeLabel(r.request_type)}</div>
                  {member?.name && <div style={{ fontSize: 12, color: t.textSub, marginTop: 2, fontFamily: "'DM Sans',sans-serif" }}>👤 {member.name}{member.thali_number ? ` · Thali #${member.thali_number}` : ''}</div>}
                  {member?.phone && <div style={{ fontSize: 12, color: t.textSub, marginTop: 1, fontFamily: "'DM Sans',sans-serif" }}>📞 {member.phone}</div>}
                </div>
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${statusColor(r.status)}20`, color: statusColor(r.status), border: `1px solid ${statusColor(r.status)}40`, fontFamily: "'DM Sans',sans-serif" }}>{(r.status || 'pending').toUpperCase()}</span>
              </div>
              {r.from_date && <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>📅 {r.from_date} → {r.to_date}</div>}
              {r.extra_items?.length > 0 && <div style={{ fontSize: 12, color: t.textSub, marginTop: 4, fontFamily: "'DM Sans',sans-serif" }}>Items: {r.extra_items.map(i => `${i.name} x${i.qty}`).join(', ')}</div>}
              {r.admin_note && <div style={{ marginTop: 6, fontSize: 12, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>Note: {r.admin_note}</div>}
              <div style={{ fontSize: 10, color: t.textSub, marginTop: 6, opacity: .5, fontFamily: "'DM Sans',sans-serif" }}>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
            <div style={{ padding: '10px 14px', background: t.accentBg, borderTop: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 11, color: t.textSub, textAlign: 'center', opacity: 0.8, fontFamily: "'DM Sans',sans-serif" }}>
                ℹ️ Resolution is handled by Admin
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KhidmatThaliUserQueries() {
  const t = useTheme()
  const [queries, setQueries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadQueries() }, [])

  const loadQueries = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('queries').select('*, user_stats(name, thali_number, phone)').order('created_at', { ascending: false }).limit(50)
      setQueries((data || []).filter(q => !(q.comment || '').startsWith('[Support Ticket]')))
    } catch { } finally { setLoading(false) }
  }

  const statusColor = s => s === 'open' ? '#d4882a' : s === 'resolved' ? '#5eba82' : '#7aabb8'

  return (
    <div>
      {loading ? <Spinner /> : queries.length === 0 ? <EmptyState msg="No thali user queries." /> : queries.map(q => {
        const member = q.user_stats
        return (
          <div key={q.id} style={{ marginBottom: 12, borderRadius: 16, border: `1px solid ${q.status === 'open' ? t.accentBorder : t.border}`, background: t.card, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div>
                  {member?.name && <div style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>👤 {member.name}{member.thali_number ? ` · #${member.thali_number}` : ''}</div>}
                  {member?.phone && <div style={{ fontSize: 12, color: t.textSub, marginTop: 2, fontFamily: "'DM Sans',sans-serif" }}>📞 {member.phone}</div>}
                  <div style={{ fontSize: 10, color: t.textSub, opacity: .5, marginTop: 2, fontFamily: "'DM Sans',sans-serif" }}>{new Date(q.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${statusColor(q.status)}20`, color: statusColor(q.status), border: `1px solid ${statusColor(q.status)}40`, fontFamily: "'DM Sans',sans-serif" }}>{(q.status || 'open').toUpperCase()}</span>
              </div>
              {q.comment && <p style={{ margin: '0 0 8px', fontSize: 14, color: t.textBody, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>{q.comment}</p>}
              {q.media?.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>{q.media.map((m, i) => m.path && m.type === 'image' && <img key={i} src={m.path} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />)}</div>}
              {q.admin_reply && <div style={{ marginTop: 8, padding: 10, borderRadius: 9, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 13, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>💬 Reply: {q.admin_reply}</div>}
            </div>
            <div style={{ borderTop: `1px solid ${t.border}`, padding: '10px 14px', background: t.accentBg }}>
              <div style={{ fontSize: 11, color: t.textSub, textAlign: 'center', opacity: 0.8, fontFamily: "'DM Sans',sans-serif" }}>
                ℹ️ Resolution is handled by Admin
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// KHIDMAT — INVENTORY (Al-Mawaid Master PDR implementation)
// ══════════════════════════════════════════════════════════════
function KhidmatInventoryPage() {
  const t = useTheme()
  const [subTab, setSubTab] = useState('stock')
  const [categories, setCategories] = useState([
    { id: 1, name: 'Pulses', parent_id: null, icon: '🌾' },
    { id: 2, name: 'Grains', parent_id: null, icon: '🌽' },
    { id: 3, name: 'Spices', parent_id: null, icon: '🌶️' },
    { id: 4, name: 'Oils & Fats', parent_id: null, icon: '🫙' },
  ])
  const [products, setProducts] = useState([
    { id: 101, name: 'Chana Dal', category_id: 1, stock: 50, unit: 'kg', low_stock_threshold: 10 },
    { id: 102, name: 'Masoor Dal', category_id: 1, stock: 30, unit: 'kg', low_stock_threshold: 8 },
    { id: 103, name: 'Toor Dal', category_id: 1, stock: 7, unit: 'kg', low_stock_threshold: 10 },
    { id: 104, name: 'Basmati Rice', category_id: 2, stock: 80, unit: 'kg', low_stock_threshold: 20 },
    { id: 105, name: 'Whole Wheat Flour', category_id: 2, stock: 45, unit: 'kg', low_stock_threshold: 15 },
    { id: 106, name: 'Cumin Seeds', category_id: 3, stock: 4, unit: 'kg', low_stock_threshold: 5 },
    { id: 107, name: 'Coriander Powder', category_id: 3, stock: 8, unit: 'kg', low_stock_threshold: 5 },
    { id: 108, name: 'Sunflower Oil', category_id: 4, stock: 25, unit: 'L', low_stock_threshold: 10 },
  ])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [txModal, setTxModal] = useState(null) // { product, type: 'in'|'out' }
  const [txQty, setTxQty] = useState('')
  const [txNote, setTxNote] = useState('')
  const [auditLog, setAuditLog] = useState([])
  const [addProductModal, setAddProductModal] = useState(false)
  const [newProduct, setNewProduct] = useState({ name: '', category_id: '', unit: 'kg', stock: 0, low_stock_threshold: 10 })
  const [scannerActive, setScannerActive] = useState(false)
  const [csvExport, setCsvExport] = useState(false)

  const filteredProducts = selectedCategory ? products.filter(p => p.category_id === selectedCategory) : products
  const lowStockProducts = products.filter(p => p.stock <= p.low_stock_threshold)

  const handleTransaction = (type) => {
    const qty = parseFloat(txQty)
    if (!qty || qty <= 0) { alert('Enter a valid quantity'); return }
    const pid = txModal.product.id
    setProducts(prev => prev.map(p => {
      if (p.id !== pid) return p
      const newStock = type === 'in' ? p.stock + qty : Math.max(0, p.stock - qty)
      return { ...p, stock: parseFloat(newStock.toFixed(2)) }
    }))
    setAuditLog(prev => [{
      id: Date.now(), product: txModal.product.name, type,
      qty, note: txNote, timestamp: new Date().toISOString()
    }, ...prev])
    setTxModal(null); setTxQty(''); setTxNote('')
  }

  const handleAddProduct = () => {
    if (!newProduct.name.trim() || !newProduct.category_id) { alert('Name and category required'); return }
    const id = Math.max(...products.map(p => p.id)) + 1
    setProducts(prev => [...prev, { ...newProduct, id, stock: parseFloat(newProduct.stock) || 0, category_id: parseInt(newProduct.category_id) }])
    setAddProductModal(false); setNewProduct({ name: '', category_id: '', unit: 'kg', stock: 0, low_stock_threshold: 10 })
  }

  const exportCSV = () => {
    const rows = [['Product', 'Category', 'Stock', 'Unit', 'Low Stock Threshold', 'Status']]
    products.forEach(p => {
      const cat = categories.find(c => c.id === p.category_id)?.name || ''
      rows.push([p.name, cat, p.stock, p.unit, p.low_stock_threshold, p.stock <= p.low_stock_threshold ? 'LOW STOCK' : 'OK'])
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `almawaid_inventory_${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  const inp = { width: '100%', padding: '11px 13px', borderRadius: 11, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif" }

  return (
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 16, background: t.card, borderRadius: 13, padding: 5, border: `1px solid ${t.border}`, overflowX: 'auto' }}>
        {[{ id: 'stock', label: '📦 Stock' }, { id: 'transactions', label: '↕️ In/Out' }, { id: 'alerts', label: `⚠️ Alerts${lowStockProducts.length ? ` (${lowStockProducts.length})` : ''}` }, { id: 'log', label: '📜 Audit Log' }].map(({ id, label }) => (
          <button key={id} onClick={() => setSubTab(id)}
            style={{ flexShrink: 0, padding: '9px 12px', borderRadius: 9, border: 'none', background: subTab === id ? t.accentGrad : 'transparent', color: subTab === id ? '#fff' : t.textSub, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {/* STOCK TAB */}
      {subTab === 'stock' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setSelectedCategory(null)}
                style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${!selectedCategory ? t.accent : t.border}`, background: !selectedCategory ? t.accentBg : 'transparent', color: !selectedCategory ? t.accent : t.textSub, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                All
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                  style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${selectedCategory === cat.id ? t.accent : t.border}`, background: selectedCategory === cat.id ? t.accentBg : 'transparent', color: selectedCategory === cat.id ? t.accent : t.textSub, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setAddProductModal(true)}
                style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${t.accentBorder}`, background: t.accentBg, color: t.accent, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                + Add Item
              </button>
              <button onClick={exportCSV}
                style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                ⬇ Export CSV
              </button>
            </div>
          </div>

          {filteredProducts.map(p => {
            const cat = categories.find(c => c.id === p.category_id)
            const isLow = p.stock <= p.low_stock_threshold
            const pct = Math.min(100, (p.stock / (p.low_stock_threshold * 4)) * 100)
            return (
              <div key={p.id} style={{ marginBottom: 10, padding: '14px 16px', borderRadius: 14, border: `1px solid ${isLow ? 'rgba(220,88,55,0.4)' : t.border}`, background: isLow ? 'rgba(220,88,55,0.06)' : t.card }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: t.textSub, marginTop: 2, fontFamily: "'DM Sans',sans-serif" }}>{cat?.icon} {cat?.name}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: isLow ? '#e05555' : t.accent, fontFamily: "'DM Sans',sans-serif", lineHeight: 1 }}>{p.stock}</div>
                    <div style={{ fontSize: 11, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{p.unit}</div>
                  </div>
                </div>
                <div style={{ height: 4, background: t.inputBg, borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: isLow ? 'linear-gradient(90deg,#e05555,#c03030)' : t.accentGrad, borderRadius: 2, transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setTxModal({ product: p, type: 'in' }); setSubTab('transactions') }}
                    style={{ flex: 1, padding: '8px 6px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#5eba82,#3d9a60)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                    ↑ Stock In
                  </button>
                  <button onClick={() => { setTxModal({ product: p, type: 'out' }); setSubTab('transactions') }}
                    style={{ flex: 1, padding: '8px 6px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#e07755,#c04030)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                    ↓ Stock Out
                  </button>
                </div>
                {isLow && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(220,88,55,0.10)', border: '1px solid rgba(220,88,55,0.30)', fontSize: 11, color: '#e05555', fontFamily: "'DM Sans',sans-serif" }}>⚠️ Low Stock — threshold: {p.low_stock_threshold} {p.unit}</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* IN/OUT TRANSACTIONS TAB */}
      {subTab === 'transactions' && (
        <div>
          {txModal && (
            <div style={{ marginBottom: 20, padding: '18px 18px', borderRadius: 16, border: `1px solid ${txModal.type === 'in' ? 'rgba(94,186,130,0.4)' : 'rgba(220,85,85,0.4)'}`, background: txModal.type === 'in' ? 'rgba(94,186,130,0.07)' : 'rgba(220,85,85,0.07)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.accent, marginBottom: 14, fontFamily: "'Playfair Display',serif" }}>
                {txModal.type === 'in' ? '↑ Stock In' : '↓ Stock Out'} — {txModal.product.name}
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>QUANTITY ({txModal.product.unit})</label>
                <input type="number" min="0" step="0.1" value={txQty} onChange={e => setTxQty(e.target.value)} style={inp} placeholder={`e.g. 10`} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 6, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>NOTE (optional)</label>
                <input type="text" value={txNote} onChange={e => setTxNote(e.target.value)} style={inp} placeholder="Supplier name, batch, etc." />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleTransaction(txModal.type)}
                  style={{ flex: 1, padding: 12, borderRadius: 11, border: 'none', background: txModal.type === 'in' ? 'linear-gradient(135deg,#5eba82,#3d9a60)' : 'linear-gradient(135deg,#e05555,#c03030)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                  {txModal.type === 'in' ? '↑ Confirm Stock In' : '↓ Confirm Stock Out'}
                </button>
                <button onClick={() => { setTxModal(null); setTxQty(''); setTxNote('') }}
                  style={{ padding: '12px 16px', borderRadius: 11, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {!txModal && (
            <div>
              <SectionLabel>Select an item to record stock movement</SectionLabel>
              {products.map(p => (
                <div key={p.id} style={{ marginBottom: 8, padding: '12px 14px', borderRadius: 13, border: `1px solid ${t.border}`, background: t.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>Stock: {p.stock} {p.unit}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setTxModal({ product: p, type: 'in' })}
                      style={{ padding: '6px 12px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#5eba82,#3d9a60)', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>↑ In</button>
                    <button onClick={() => setTxModal({ product: p, type: 'out' })}
                      style={{ padding: '6px 12px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#e05555,#c03030)', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>↓ Out</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LOW STOCK ALERTS */}
      {subTab === 'alerts' && (
        <div>
          {lowStockProducts.length === 0
            ? <div style={{ textAlign: 'center', padding: 48, color: t.textSub, fontSize: 15, fontFamily: "'DM Sans',sans-serif" }}>✅ All items are well stocked!</div>
            : lowStockProducts.map(p => {
              const cat = categories.find(c => c.id === p.category_id)
              return (
                <div key={p.id} style={{ marginBottom: 10, padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(220,88,55,0.4)', background: 'rgba(220,88,55,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#e05555', fontFamily: "'DM Sans',sans-serif" }}>⚠️ {p.name}</div>
                      <div style={{ fontSize: 12, color: t.textSub, marginTop: 2, fontFamily: "'DM Sans',sans-serif" }}>{cat?.icon} {cat?.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#e05555', fontFamily: "'DM Sans',sans-serif" }}>{p.stock} {p.unit}</div>
                      <div style={{ fontSize: 11, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>threshold: {p.low_stock_threshold}</div>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* AUDIT LOG */}
      {subTab === 'log' && (
        <div>
          {auditLog.length === 0
            ? <EmptyState msg="No transactions recorded yet." />
            : auditLog.map(entry => (
              <div key={entry.id} style={{ marginBottom: 8, padding: '12px 14px', borderRadius: 13, border: `1px solid ${t.border}`, background: t.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{entry.product}</div>
                  {entry.note && <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{entry.note}</div>}
                  <div style={{ fontSize: 10, color: t.textSub, opacity: .5, fontFamily: "'DM Sans',sans-serif" }}>{new Date(entry.timestamp).toLocaleString('en-GB')}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: entry.type === 'in' ? '#5eba82' : '#e05555', fontFamily: "'DM Sans',sans-serif" }}>
                    {entry.type === 'in' ? '+' : '-'}{entry.qty}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: entry.type === 'in' ? '#5eba82' : '#e05555', fontFamily: "'DM Sans',sans-serif" }}>{entry.type.toUpperCase()}</div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Add Product Modal */}
      {addProductModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', padding: 16, backdropFilter: 'blur(8px)' }}>
          <div style={{ background: t.card, borderRadius: 20, padding: 22, maxWidth: 400, width: '100%', border: `1px solid ${t.borderActive}`, boxShadow: '0 28px 70px rgba(0,0,0,0.55)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.accent, marginBottom: 16, fontFamily: "'Playfair Display',serif" }}>Add New Item</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 5, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>PRODUCT NAME</label>
              <input value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} style={inp} placeholder="e.g. Chana Dal" />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 5, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>CATEGORY</label>
              <select value={newProduct.category_id} onChange={e => setNewProduct(p => ({ ...p, category_id: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                <option value="">Select category…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 5, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>UNIT</label>
                <select value={newProduct.unit} onChange={e => setNewProduct(p => ({ ...p, unit: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                  {['kg', 'g', 'L', 'ml', 'pcs', 'box', 'bag'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 5, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>INITIAL STOCK</label>
                <input type="number" value={newProduct.stock} onChange={e => setNewProduct(p => ({ ...p, stock: e.target.value }))} style={inp} placeholder="0" />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 5, letterSpacing: '0.12em', fontFamily: "'DM Sans',sans-serif" }}>LOW STOCK THRESHOLD</label>
              <input type="number" value={newProduct.low_stock_threshold} onChange={e => setNewProduct(p => ({ ...p, low_stock_threshold: parseFloat(e.target.value) }))} style={inp} placeholder="10" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAddProduct} style={{ flex: 1, padding: 12, borderRadius: 11, border: 'none', background: t.accentGrad, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Add Item</button>
              <button onClick={() => setAddProductModal(false)} style={{ padding: '12px 16px', borderRadius: 11, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}



function KhidmatRequestHistory() {
  const t = useTheme(), { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('thali_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setRequests(data || [])).finally(() => setLoading(false))
  }, [])
  const statusColor = s => s === 'pending' ? '#d4882a' : s === 'approved' ? '#5eba82' : '#e05555'
  const typeLabel = tp => tp === 'resume' ? '▶️ Resume' : tp === 'stop' ? '⏹️ Stop' : '➕ Extra Food'
  if (loading) return <Spinner />
  if (!requests.length) return <EmptyState msg="No requests submitted yet." />
  return (
    <div>
      {requests.map(r => (
        <Card key={r.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{typeLabel(r.request_type)}</div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${statusColor(r.status)}20`, color: statusColor(r.status), border: `1px solid ${statusColor(r.status)}40`, fontFamily: "'DM Sans',sans-serif" }}>{r.status?.toUpperCase()}</span>
          </div>
          {r.from_date && <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{r.from_date} → {r.to_date}</div>}
          {r.extra_items && <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{r.extra_items.map(i => `${i.name} x${i.qty}`).join(', ')}</div>}
          {r.admin_note && <div style={{ marginTop: 8, fontSize: 12, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>Note: {r.admin_note}</div>}
          <div style={{ fontSize: 10, color: t.textSub, marginTop: 6, opacity: .5, fontFamily: "'DM Sans',sans-serif" }}>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </Card>
      ))}
    </div>
  )
}

function KhidmatProfilePage({ staffInfo, theme, setTheme, signOut }) {
  const t = useTheme(), { user } = useAuth()
  const [activeSubPage, setActiveSubPage] = useState('main')

  if (activeSubPage === 'team') return <KhidmatTeamPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'notifications') return <NotificationsPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'support') return <SupportTicketsPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'about') return <AboutPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'reset_password') return <ResetPasswordPage onBack={() => setActiveSubPage('main')} />

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

  return (
    <main style={{ flex: 1, padding: '16px 16px 96px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <Card active style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ width: 80, height: 80, margin: '0 auto 14px', borderRadius: '50%', background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${t.accent}`, boxShadow: `0 4px 16px ${t.accentBg}` }}>
          <img src="/al-mawaid.png" alt="Al-Mawaid" style={{ width: 54, height: 54, objectFit: 'contain' }} />
        </div>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display',serif" }}>{staffInfo?.name || 'Khidmat Guzar'}</h2>
        <div style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginBottom: 6 }}>{user.email}</div>
        {staffInfo?.role && <div style={{ display: 'inline-block', padding: '4px 16px', borderRadius: 20, background: t.accentBg, border: `1px solid ${t.accentBorder}`, marginBottom: 6 }}><span style={{ fontSize: 13, color: t.accent, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>{staffInfo.role}</span></div>}
        {staffInfo?.phone && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}><Phone size={12} color={t.textSub} /><span style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{staffInfo.phone}</span></div>}
        {staffInfo?.area && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}><MapPin size={12} color={t.textSub} /><span style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{staffInfo.area}</span></div>}
        <div style={{ fontSize: 11, color: t.textSub, marginTop: 10, opacity: .5, fontFamily: "'DM Sans',sans-serif" }}>Khidmat Guzar since {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 12, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>ℹ️ To update your profile details, contact an admin.</div>
      </Card>

      <SectionLabel>Tools & Info</SectionLabel>
      <NavCard label="Khidmat Team" icon={<Users size={19} color="#fff" />} desc="See the service team roster" onClick={() => setActiveSubPage('team')} />
      <NavCard label="Alerts" icon={<Bell size={19} color="#fff" />} desc="Important notices and updates" onClick={() => setActiveSubPage('notifications')} />
      <NavCard label="Support Ticket" icon={<LifeBuoy size={19} color="#fff" />} desc="Raise a general or delivery issue" onClick={() => setActiveSubPage('support')} />
      <NavCard label="About" icon={<Info size={19} color="#fff" />} desc="About Al-Mawaid app" onClick={() => setActiveSubPage('about')} />
      <NavCard label="Reset Password" icon={<Lock size={19} color="#fff" />} desc="Update your account password" onClick={() => setActiveSubPage('reset_password')} />

      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <SectionLabel>App Theme</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.values(THEMES).map(th => (
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

      <button onClick={() => { if (window.confirm('Sign out?')) signOut() }}
        style={{ width: '100%', padding: 14, borderRadius: 13, border: '1px solid rgba(220,60,60,0.28)', background: 'rgba(220,60,60,0.07)', color: '#e05555', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: "'DM Sans',sans-serif" }}>
        <LogOut size={15} /> Sign Out
      </button>
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
    const saved = sessionStorage.getItem('al_mawaid_mock_user')
    return saved ? JSON.parse(saved) : null
  })
  const [portalRole, setPortalRole] = useState(() => sessionStorage.getItem('al_mawaid_portal') || null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess)
      if (!sess) {
        setPortalRole(null);
        setMockUser(null);
        sessionStorage.removeItem('al_mawaid_portal')
        sessionStorage.removeItem('al_mawaid_mock_user')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setPortalRole(null)
    setMockUser(null)
    sessionStorage.removeItem('al_mawaid_portal')
    sessionStorage.removeItem('al_mawaid_mock_user')
  }, [])

  const handleRoleLogin = useCallback((role, sess) => {
    sessionStorage.setItem('al_mawaid_portal', role)
    if (role === 'inventory_manager' && sess?.user) {
      sessionStorage.setItem('al_mawaid_mock_user', JSON.stringify(sess.user))
      setMockUser(sess.user)
    }
    setPortalRole(role)
  }, [])

  if (session === undefined && !mockUser) {
    return (
      <div style={{ minHeight: '100vh', background: '#081c10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spin" style={{ width: 36, height: 36, border: '2.5px solid rgba(212,175,55,0.2)', borderTop: '2.5px solid #D4AF37', borderRadius: '50%' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}body{margin:0}`}</style>
      </div>
    )
  }

  if (!session && !mockUser) return <LoginPage onRoleLogin={handleRoleLogin} />

  const authValue = { user: session?.user || mockUser, signOut }

  if (portalRole === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (['khidmat_guzar', 'supervisor', 'khidmat'].includes(portalRole)) {
    return (
      <AuthCtx.Provider value={authValue}>
        <ThemeCtx.Provider value={THEMES[localStorage.getItem('almawaid_theme') || 'midnight'] || THEMES.midnight}>
          <KhidmatPortal signOut={signOut} user={authValue.user} />
        </ThemeCtx.Provider>
      </AuthCtx.Provider>
    )
  }

  if (portalRole === 'inventory_manager') {
    return (
      <AuthCtx.Provider value={authValue}>
        <ThemeCtx.Provider value={THEMES[localStorage.getItem('almawaid_theme') || 'midnight'] || THEMES.midnight}>
          <InventoryManagerPortal signOut={signOut} user={authValue.user} />
        </ThemeCtx.Provider>
      </AuthCtx.Provider>
    )
  }

  return <AuthCtx.Provider value={authValue}><ThaliUserApp /></AuthCtx.Provider>
}