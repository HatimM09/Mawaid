// src/App.jsx — Al-Mawaid Food Survey System v5
// Unified login: Member · Khidmat Guzar · Admin
import React, { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react'
import {
  Home, FileText, User, X,
  Star, Camera, Check, LogOut,
  Mail, Lock, Eye, EyeOff, AlertCircle, ChevronDown, ChevronUp,
  ClipboardList, MessageCircle, ChevronLeft, ChevronRight,
  Phone, MapPin, Users, Upload, Wallet, Bell, LifeBuoy, Info,
  Shield, Utensils
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'

// ─── Supabase ────────────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL  ?? ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const supabase = createClient(supabaseUrl, supabaseKey)
export { supabase }

// ══════════════════════════════════════════════════════════════
// THEMES
// ══════════════════════════════════════════════════════════════
const THEMES = {
  midnight: {
    id: 'midnight', name: 'Midnight Oud', icon: '🌙',
    bg: '#0b0f1a', bgGrad: 'linear-gradient(160deg,#0b0f1a 0%,#111827 60%,#0d1120 100%)',
    card: '#141d2e', cardActive: 'linear-gradient(135deg,#1a2540,#111827)',
    border: 'rgba(180,140,80,0.14)', borderActive: 'rgba(196,156,90,0.45)',
    accent: '#c49c5a', accentGrad: 'linear-gradient(135deg,#d4aa6a,#a87c40)',
    accentBg: 'rgba(196,156,90,0.10)', accentBorder: 'rgba(196,156,90,0.32)',
    text: '#f0ead8', textSub: '#9aabb8', textBody: '#c8d0da',
    navBg: 'rgba(11,15,26,0.97)', navBorder: 'rgba(196,156,90,0.18)',
    geo: 'rgba(196,156,90,0.05)', spinnerBorder: 'rgba(196,156,90,0.2)', spinnerTop: '#c49c5a',
    inputBg: 'rgba(255,255,255,0.04)', inputBorder: 'rgba(196,156,90,0.22)',
    loginCard: 'rgba(20,29,46,0.92)', headerWave: '#0b0f1a',
    successBg: 'rgba(74,163,110,0.12)', successBorder: 'rgba(74,163,110,0.3)', successText: '#5eba82',
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

// ─── Menu Data ────────────────────────────────────────────────
const WEEKLY_MENU = {
  monday:    { en: 'Monday',    ar: 'الاثنين',   lunch: ['Chola', 'Kulcha', 'Shreekhand', 'Dal', 'Chawal'],           dinner: ['FMB MENU'] },
  tuesday:   { en: 'Tuesday',   ar: 'الثلاثاء',  lunch: ['American Choupsey', 'Wafers', 'Butter Khichdi'],            dinner: ['Roti', 'Veg Jaipuri', 'Chicken Pulao', 'Soup'] },
  wednesday: { en: 'Wednesday', ar: 'الأربعاء',  lunch: ['Vegetable Sandwich', 'Bhel Salad', 'Corn Pulao'],           dinner: ['Roti', 'White Chicken', 'Manchurian Rice', 'Gravy'] },
  thursday:  { en: 'Thursday',  ar: 'الخميس',    lunch: ['Chicken 65', 'Corn Munch Salad', 'Dal Makhni', 'Chawal'],   dinner: ['Roti', 'Mango Custard', 'Matar Paneer', 'Tuwar Pulao', 'Palidu'] },
  friday:    { en: 'Friday',    ar: 'الجمعة',    lunch: ['FMB MENU'],                                                  dinner: ['Roti', 'Gobi Matar', 'Chicken Kashmiri Pulao', 'Soup'] },
  saturday:  { en: 'Saturday',  ar: 'السبت',     lunch: ['Chana Bateta', 'Dal Makhni', 'Chawal'],                     dinner: ['Roti', 'Chicken Tarkari', 'Veg Coconut Rice', 'Kung Pao Gravy'] },
}
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const ROTI_ITEMS = ['roti', 'chapati', 'naan', 'paratha']
const isRotiItem = (dish) => ROTI_ITEMS.some(r => dish.toLowerCase().includes(r))

const getTodayKey = () => {
  const d = new Date().getDay()
  const map = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' }
  return map[d] || 'monday'
}

const isSurveyOpen = () => {
  const now = new Date(), day = now.getDay(), total = now.getHours() * 60 + now.getMinutes()
  if (day === 6 && total >= 1200) return true
  if (day === 0) return true
  if (day === 1 && total <= 600) return true
  return false
}

const getSurveyWindowMessage = () => {
  const now = new Date(), day = now.getDay(), hour = now.getHours()
  if (day === 6 && hour < 20) return `Survey opens today at 8:00 PM (in ~${20 - hour}h)`
  if (day === 1 && hour >= 10) return 'Survey window closed. Opens next Saturday at 8:00 PM.'
  return 'Survey opens Saturday at 8:00 PM.'
}

// ─── Contexts ─────────────────────────────────────────────────
const ThemeCtx = createContext(THEMES.midnight)
const useTheme = () => useContext(ThemeCtx)
const AuthCtx = createContext(null)
const useAuth = () => useContext(AuthCtx)

export { ThemeCtx, useTheme, AuthCtx, useAuth }

// ─── WhatsApp icon ────────────────────────────────────────────
const WhatsAppLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path fill="currentColor"
      d="M19.05 4.91A9.82 9.82 0 0 0 12.03 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.74.45 3.43 1.31 4.92L2 22l5.33-1.4a9.86 9.86 0 0 0 4.7 1.2h.01c5.46 0 9.9-4.44 9.9-9.9a9.83 9.83 0 0 0-2.89-6.99Zm-7.02 15.22h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.16.83.84-3.08-.2-.31a8.18 8.18 0 0 1-1.25-4.35c0-4.53 3.69-8.22 8.23-8.22a8.16 8.16 0 0 1 5.82 2.41 8.16 8.16 0 0 1 2.41 5.82c0 4.54-3.69 8.22-8.2 8.22Zm4.51-6.16c-.25-.13-1.47-.72-1.7-.8-.23-.08-.4-.13-.57.12-.17.25-.65.8-.8.96-.15.17-.3.19-.55.07-.25-.13-1.07-.39-2.03-1.23-.75-.67-1.26-1.49-1.41-1.74-.15-.25-.02-.38.11-.5.11-.11.25-.29.38-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.57-1.37-.78-1.88-.21-.5-.43-.43-.57-.43h-.49c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.02 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.42 1.43.54.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29Z"/>
  </svg>
)

/* ─── Geo Background ─────────────────────────────────────────── */
const GeoBg = ({ t: tProp }) => {
  const ctx = useTheme()
  const t = tProp || ctx
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.7 }}>
      <defs>
        <pattern id="geo" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M24 2L46 24L24 46L2 24Z" fill="none" stroke={t.geo} strokeWidth="0.7" />
          <circle cx="24" cy="24" r="4.5" fill="none" stroke={t.geo} strokeWidth="0.5" />
          <circle cx="0" cy="0" r="2" fill={t.geo} />
          <circle cx="48" cy="0" r="2" fill={t.geo} />
          <circle cx="0" cy="48" r="2" fill={t.geo} />
          <circle cx="48" cy="48" r="2" fill={t.geo} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#geo)" />
    </svg>
  )
}

/* ─── Spinner ─────────────────────────────────────────────────── */
const Spinner = ({ fullPage = true }) => {
  const t = useTheme()
  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className="spin" style={{ width: 34, height: 34, border: `2.5px solid ${t.spinnerBorder}`, borderTop: `2.5px solid ${t.spinnerTop}`, borderRadius: '50%' }} />
      {fullPage && <p style={{ margin: 0, fontSize: 12, color: t.textSub, opacity: 0.45, fontFamily: "'DM Sans',sans-serif", letterSpacing: '0.08em' }}>Loading…</p>}
    </div>
  )
  return fullPage
    ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>{inner}</div>
    : inner
}

/* ─── Error Banner ───────────────────────────────────────────── */
const ErrorBanner = ({ msg }) => (
  <div style={{
    margin: '8px 0', padding: '11px 14px', borderRadius: 10,
    background: 'rgba(220,60,60,0.09)', border: '1px solid rgba(220,60,60,0.28)',
    color: '#e05555', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
    fontFamily: "'DM Sans',sans-serif"
  }}>
    <AlertCircle size={14} style={{ flexShrink: 0 }} />{msg}
  </div>
)

/* ─── Avatar ─────────────────────────────────────────────────── */
const Avatar = ({ avatarUrl, name, email, size = 56 }) => {
  const t = useTheme()
  const initials = (name || email || 'U').charAt(0).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `2px solid ${t.accent}`, boxShadow: `0 4px 16px ${t.accentBg}` }}>
      {avatarUrl
        ? <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ width: '100%', height: '100%', background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 800, color: '#fff', fontFamily: "'Playfair Display',serif" }}>
            {initials}
          </div>
      }
    </div>
  )
}

/* ─── Card ───────────────────────────────────────────────────── */
const Card = ({ children, active, style: extraStyle = {} }) => {
  const t = useTheme()
  return (
    <div style={{
      padding: '18px 18px', borderRadius: 16,
      background: active ? t.cardActive : t.card,
      border: `1px solid ${active ? t.borderActive : t.border}`,
      boxShadow: active ? `0 6px 24px ${t.accentBg}` : '0 2px 8px rgba(0,0,0,0.08)',
      ...extraStyle
    }}>
      {children}
    </div>
  )
}

const SectionLabel = ({ children }) => {
  const t = useTheme()
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: t.textSub, textTransform: 'uppercase', marginBottom: 12, fontFamily: "'DM Sans',sans-serif", opacity: 0.7 }}>{children}</div>
}

export { Card, Spinner, ErrorBanner, Avatar }

// ══════════════════════════════════════════════════════════════
// UNIFIED LOGIN PAGE  (3 roles: Member · Khidmat Guzar · Admin)
// ══════════════════════════════════════════════════════════════
function LoginPage({ onRoleLogin }) {
  const t = THEMES.midnight
  const [role, setRole]         = useState('member')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [mode, setMode]         = useState('login')

  const ROLES = [
    { id: 'member',  label: 'Member',        icon: '👤' },
    { id: 'khidmat', label: 'Khidmat Guzar', icon: '🍽️' },
    { id: 'admin',   label: 'Admin',          icon: '🛡️' },
  ]

  const inp = {
    width: '100%', padding: '13px 13px 13px 44px', borderRadius: 12, boxSizing: 'border-box',
    background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text,
    fontSize: 15, outline: 'none', fontFamily: "'DM Sans',sans-serif", transition: 'border 0.2s'
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      // Sign Up (member only)
      if (role === 'member' && mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        setError('✅ Check your email for a verification link!')
        setLoading(false)
        return
      }

      // Sign In
      const { data: { session }, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) throw signInErr

      // Role check for staff
      if (role === 'khidmat' || role === 'admin') {
        const { data: staffRow } = await supabase
          .from('staff')
          .select('role')
          .eq('user_id', session.user.id)
          .single()

        const dbRole = staffRow?.role || ''

        if (role === 'admin' && dbRole !== 'admin') {
          await supabase.auth.signOut()
          throw new Error('You do not have admin privileges.')
        }
        if (role === 'khidmat' && !['khidmat_guzar', 'admin', 'supervisor'].includes(dbRole)) {
          await supabase.auth.signOut()
          throw new Error('You are not registered as a Khidmat Guzar.')
        }
        // Tell root App which portal to open
        onRoleLogin(dbRole)
      } else {
        onRoleLogin('member')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: t.bgGrad, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20, position: 'relative', overflow: 'hidden',
      fontFamily: "'DM Sans',sans-serif"
    }}>
      <GeoBg t={t} />

      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 420,
        background: t.loginCard, backdropFilter: 'blur(24px)', borderRadius: 24,
        padding: '36px 28px', border: `1px solid ${t.borderActive}`,
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 80, height: 80, margin: '0 auto 14px', borderRadius: '50%', background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 36px rgba(196,156,90,0.25)' }}>
            <img src="/al-mawaid.png" alt="Al-Mawaid" style={{ width: 54, height: 54, objectFit: 'contain' }} />
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: t.accent, letterSpacing: '0.06em', fontFamily: "'Playfair Display',serif" }}>Al-Mawaid</h1>
          <p style={{ margin: 0, fontSize: 14, color: t.textSub, fontFamily: "'Noto Nastaliq Urdu','Amiri',serif", lineHeight: 1.8 }}>
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </p>
        </div>

        {/* Role Tabs */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 22, background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 5 }}>
          {ROLES.map(r => {
            const active = role === r.id
            return (
              <button key={r.id} onClick={() => { setRole(r.id); setError(''); setMode('login') }}
                style={{
                  flex: 1, padding: '10px 6px', borderRadius: 10, border: 'none',
                  background: active ? t.accentGrad : 'transparent',
                  color: active ? '#fff' : t.textSub,
                  fontWeight: active ? 700 : 500, fontSize: 11,
                  cursor: 'pointer', transition: 'all 0.25s', fontFamily: "'DM Sans',sans-serif",
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                <span style={{ fontSize: 18 }}>{r.icon}</span>
                <span style={{ letterSpacing: '0.01em', lineHeight: 1.2 }}>{r.label}</span>
              </button>
            )
          })}
        </div>

        {/* Member sub-tabs (Sign In / Sign Up) */}
        {role === 'member' && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 4 }}>
            {['login','signup'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: '8px', borderRadius: 7, border: 'none',
                  background: mode === m ? 'rgba(196,156,90,0.15)' : 'transparent',
                  color: mode === m ? t.accent : t.textSub,
                  fontWeight: mode === m ? 700 : 500, fontSize: 13,
                  cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'DM Sans',sans-serif",
                  borderBottom: mode === m ? `2px solid ${t.accent}` : '2px solid transparent',
                }}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>
        )}

        {/* Staff role description */}
        {role !== 'member' && (
          <div style={{ marginBottom: 18, padding: '10px 14px', borderRadius: 10, background: 'rgba(196,156,90,0.07)', border: '1px solid rgba(196,156,90,0.18)', fontSize: 12, color: t.textSub, textAlign: 'center', lineHeight: 1.6 }}>
            {role === 'admin'
              ? '🛡️ Admin access — full management portal'
              : '🍽️ Khidmat Guzar — service staff portal'}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleAuth}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 7, letterSpacing: '0.14em', fontFamily: "'DM Sans',sans-serif" }}>EMAIL</label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.accent, opacity: 0.6 }} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inp} placeholder="your@email.com" autoComplete="email" />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 7, letterSpacing: '0.14em', fontFamily: "'DM Sans',sans-serif" }}>PASSWORD</label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: t.accent, opacity: 0.6 }} />
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                style={{ ...inp, paddingRight: 44 }} placeholder="••••••••" autoComplete="current-password" />
              <button type="button" onClick={() => setShowPass(s => !s)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                {showPass ? <EyeOff size={14} color={t.accent} /> : <Eye size={14} color={t.accent} />}
              </button>
            </div>
          </div>

          {error && <ErrorBanner msg={error} />}

          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: loading ? t.border : t.accentGrad,
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              boxShadow: `0 6px 20px ${t.accentBg}`, transition: 'all 0.25s', marginTop: 8,
              fontFamily: "'DM Sans',sans-serif", letterSpacing: '0.02em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {loading ? 'Please wait…'
              : role === 'admin'   ? '🛡️ Enter Admin Portal'
              : role === 'khidmat' ? '🍽️ Enter Staff Portal'
              : mode === 'signup'  ? 'Create Account'
              : 'Sign In'}
          </button>
        </form>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}body{margin:0}`}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// KHIDMAT GUZAR PORTAL
// Simple read-only view of today's menu + member list
// ══════════════════════════════════════════════════════════════
function KhidmatPortal({ signOut }) {
  const t = THEMES.midnight
  const { user } = useAuth()
  const [staffInfo, setStaffInfo] = useState(null)
  const [members, setMembers]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [activeDay, setActiveDay] = useState(getTodayKey())

  useEffect(() => {
    const load = async () => {
      const [{ data: staff }, { data: mems }] = await Promise.all([
        supabase.from('staff').select('*').eq('user_id', user.id).single(),
        supabase.from('user_stats').select('name,thali_number,phone,address').order('thali_number'),
      ])
      setStaffInfo(staff)
      setMembers(mems || [])
      setLoading(false)
    }
    load()
  }, [user])

  const todayMenu = WEEKLY_MENU[activeDay]

  return (
    <ThemeCtx.Provider value={t}>
      <div style={{ minHeight: '100vh', background: t.bgGrad, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>
        {/* Header */}
        <header style={{ position: 'relative', overflow: 'hidden', background: t.bgGrad, padding: '20px 20px 0' }}>
          <GeoBg t={t} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🍽️</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: t.accent }}>Khidmat Guzar</div>
                <div style={{ fontSize: 11, color: t.textSub }}>{staffInfo?.name || user.email}</div>
              </div>
            </div>
            <button onClick={() => { if (confirm('Log out?')) signOut() }}
              style={{ background: 'rgba(220,60,60,0.12)', border: '1px solid rgba(220,60,60,0.25)', borderRadius: 10, padding: '8px 14px', color: '#e05555', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <LogOut size={14} />Logout
            </button>
          </div>
          <svg style={{ display: 'block', position: 'relative', zIndex: 1 }} width="100%" viewBox="0 0 1440 28" preserveAspectRatio="none">
            <path d="M0,10 C200,28 400,0 600,14 C800,28 1000,4 1200,18 C1320,26 1400,10 1440,14 L1440,28 L0,28 Z" fill={t.headerWave} opacity="0.9" />
          </svg>
        </header>

        <main style={{ padding: '20px 20px 40px', maxWidth: 800, margin: '0 auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: t.textSub }}>Loading…</div>
          ) : (
            <>
              {/* Day picker */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textSub, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>Today's Service</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DAYS.map(d => {
                    const isActive = activeDay === d
                    return (
                      <button key={d} onClick={() => setActiveDay(d)}
                        style={{
                          padding: '8px 14px', borderRadius: 10, border: `1px solid ${isActive ? t.accentBorder : t.border}`,
                          background: isActive ? t.accentGrad : t.card, color: isActive ? '#fff' : t.textSub,
                          fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                        }}>
                        {WEEKLY_MENU[d].en.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Menu */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.accent, marginBottom: 14 }}>{todayMenu.en}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {['lunch', 'dinner'].map(meal => (
                    <div key={meal} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: '18px 20px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>
                        {meal === 'lunch' ? '☀️ Lunch' : '🌙 Dinner'}
                      </div>
                      {todayMenu[meal].map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < todayMenu[meal].length - 1 ? `1px solid ${t.border}` : 'none' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, flexShrink: 0 }} />
                          <span style={{ fontSize: 14, color: t.text }}>{item}</span>
                          {isRotiItem(item) && <span style={{ marginLeft: 'auto', fontSize: 10, color: t.accent, fontWeight: 700, background: t.accentBg, padding: '2px 7px', borderRadius: 6 }}>ROTI</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Member list */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textSub, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>
                  Member Thali List ({members.length})
                </div>
                <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden' }}>
                  {members.map((m, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                      borderBottom: i < members.length - 1 ? `1px solid ${t.border}` : 'none',
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {(m.name || 'M').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{m.name || '—'}</div>
                        <div style={{ fontSize: 12, color: t.textSub }}>{m.phone || m.address || ''}</div>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: t.accent }}>#{m.thali_number || '—'}</div>
                    </div>
                  ))}
                  {members.length === 0 && (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: t.textSub, fontSize: 14 }}>No members found.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </main>

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}body{margin:0}`}</style>
      </div>
    </ThemeCtx.Provider>
  )
}

// ══════════════════════════════════════════════════════════════
// ── ALL YOUR EXISTING PAGE COMPONENTS GO HERE ────────────────
// (HomePage, FeedbackPage, PostPage, ProfilePage, SurveyPage, etc.)
// Keep them exactly as they are in your original App.jsx
// Only the ROOT App() function below changes.
// ══════════════════════════════════════════════════════════════

// [[ INSERT YOUR EXISTING: HomePage, FeedbackPage, PostPage, ProfilePage, etc. HERE ]]
// They are unchanged — do NOT re-paste them, just keep them in the file.

// ══════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession] = useState(undefined)
  const [portalRole, setPortalRole] = useState(() => sessionStorage.getItem('al_mawaid_portal') || null)
  const [theme, setTheme] = useState(() => localStorage.getItem('almawaid_theme') || 'midnight')

  const currentTheme = THEMES[theme] || THEMES.midnight

  const handleSetTheme = (id) => {
    setTheme(id)
    localStorage.setItem('almawaid_theme', id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      setSession(session)
      // On sign-out clear portal role
      if (!session) {
        setPortalRole(null)
        sessionStorage.removeItem('al_mawaid_portal')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setPortalRole(null)
    sessionStorage.removeItem('al_mawaid_portal')
  }, [])

  const handleRoleLogin = (dbRole) => {
    sessionStorage.setItem('al_mawaid_portal', dbRole)
    setPortalRole(dbRole)
  }

  // Loading
  if (session === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: THEMES.midnight.bgGrad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spin" style={{ width: 36, height: 36, border: '2.5px solid rgba(196,156,90,0.2)', borderTop: '2.5px solid #c49c5a', borderRadius: '50%' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}body{margin:0}`}</style>
      </div>
    )
  }

  // Not logged in → unified login
  if (!session) {
    return <LoginPage onRoleLogin={handleRoleLogin} />
  }

  const t = currentTheme

  // ── Admin portal ──────────────────────────────────────────
  if (portalRole === 'admin') {
    // Dynamically lazy-load the admin layout to keep bundle small
    // We use a simple redirect approach: render a bridge component
    return (
      <AuthCtx.Provider value={{ user: session.user, signOut }}>
        <AdminBridge signOut={signOut} />
      </AuthCtx.Provider>
    )
  }

  // ── Khidmat Guzar portal ──────────────────────────────────
  if (portalRole === 'khidmat_guzar' || portalRole === 'supervisor') {
    return (
      <AuthCtx.Provider value={{ user: session.user, signOut }}>
        <KhidmatPortal signOut={signOut} />
      </AuthCtx.Provider>
    )
  }

  // ── Member app (default) ──────────────────────────────────
  const tabs = [
    { id: 'home',     label: 'Home',     Icon: Home },
    { id: 'feedback', label: 'Feedback', Icon: Star },
    { id: 'post',     label: 'Requests', Icon: FileText },
    { id: 'profile',  label: 'Profile',  Icon: User },
  ]
  const tabLabels = { home: 'AL-MAWAID', feedback: 'FEEDBACK', post: 'REQUESTS', profile: 'PROFILE' }

  return (
    <ThemeCtx.Provider value={t}>
      <AuthCtx.Provider value={{ user: session.user, signOut }}>
        <MemberApp
          theme={theme}
          setTheme={handleSetTheme}
          tabs={tabs}
          tabLabels={tabLabels}
          t={t}
        />
      </AuthCtx.Provider>
    </ThemeCtx.Provider>
  )
}

// ── Admin Bridge: renders the admin area inline (no separate route needed)
// Import AdminLayout lazily to avoid bundling it unless needed.
import { lazy, Suspense } from 'react'
const AdminLayout   = lazy(() => import('./admin/AdminLayout'))
const AdminDash     = lazy(() => import('./admin/Dashboard'))

function AdminBridge({ signOut }) {
  // We use react-router's Outlet pattern but need the Router context from MainRouter.
  // Simply redirect the browser to /admin which MainRouter handles.
  useEffect(() => {
    window.location.replace('/admin')
  }, [])
  return (
    <div style={{ minHeight: '100vh', background: THEMES.midnight.bgGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c49c5a', fontFamily: "'DM Sans',sans-serif" }}>
      Redirecting to Admin Portal…
    </div>
  )
}

// ── Member App shell (extracted so root stays clean) ──────────
function MemberApp({ theme, setTheme, tabs, tabLabels, t }) {
  const [activeTab, setActiveTab] = useState('home')

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',-apple-system,sans-serif", minHeight: '100vh', background: t.bgGrad, color: t.text, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ position: 'relative', overflow: 'hidden', background: t.bgGrad, padding: '14px 18px 0', flexShrink: 0 }}>
        <GeoBg t={t} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/al-mawaid.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(196,156,90,0.5))' }} />
            <span style={{ fontSize: 9, letterSpacing: '0.24em', textTransform: 'uppercase', color: t.textSub, opacity: 0.55, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>Al-Mawaid</span>
          </div>
          <span style={{ fontSize: 11, color: t.textSub, opacity: 0.4, fontFamily: "'DM Sans',sans-serif" }}>
            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        {activeTab === 'home' && (
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginBottom: 2 }}>
            <p style={{ fontFamily: "'Noto Nastaliq Urdu','Amiri',serif", fontSize: 16, color: t.accent, margin: 0, lineHeight: 1.8 }}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
          </div>
        )}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: activeTab === 'home' ? 28 : 20, fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.1, color: t.accent, fontFamily: "'Playfair Display',serif" }}>
            {tabLabels[activeTab]}
          </h1>
        </div>
        <svg style={{ display: 'block', position: 'relative', zIndex: 1 }} width="100%" viewBox="0 0 1440 28" preserveAspectRatio="none">
          <path d="M0,10 C200,28 400,0 600,14 C800,28 1000,4 1200,18 C1320,26 1400,10 1440,14 L1440,28 L0,28 Z" fill={t.headerWave} opacity="0.9" />
        </svg>
      </header>

      {/* Pages — keep your original page components */}
      {activeTab === 'home'     && <HomePage setActiveTab={setActiveTab} />}
      {activeTab === 'feedback' && <FeedbackPage />}
      {activeTab === 'post'     && <PostPage />}
      {activeTab === 'profile'  && <ProfilePage theme={theme} setTheme={setTheme} />}

      {/* Bottom Nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30, display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 4px 18px', background: t.navBg, borderTop: `1px solid ${t.navBorder}`, boxShadow: '0 -8px 30px rgba(0,0,0,0.20)' }}>
        {tabs.map(({ id, label, Icon }) => {
          const active = activeTab === id
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '2px 14px', position: 'relative', WebkitTapHighlightColor: 'transparent' }}>
              {active && <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', width: 28, height: 2.5, borderRadius: 6, background: t.accent }} />}
              <div style={{ width: 36, height: 36, borderRadius: '50%', transition: 'all 0.25s', background: active ? t.accentBg : 'transparent', border: active ? `1px solid ${t.accentBorder}` : '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={active ? t.accent : t.textSub} strokeWidth={active ? 2.2 : 1.5} style={{ opacity: active ? 1 : 0.5 }} />
              </div>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', color: active ? t.accent : t.textSub, opacity: active ? 1 : 0.45, fontFamily: "'DM Sans',sans-serif" }}>{label}</span>
            </button>
          )
        })}
      </nav>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@400;500;600;700;800&family=Amiri:wght@400;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { display: none; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
        textarea::placeholder, input::placeholder { opacity: 0.45; }
      `}</style>
    </div>
  )
}