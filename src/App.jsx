// src/App.jsx
import React, { useState, useEffect, useCallback } from 'react'
import {
  Mail, Lock, Eye, EyeOff, AlertCircle, ChevronDown, ChevronUp,
  ClipboardList, ChevronLeft, ChevronRight, Phone, MapPin,
  Users, Wallet, Bell, LifeBuoy, Info, MessageCircle, Upload, Utensils,
  Sun, Moon, Medal, Package, Shield, Zap, RefreshCw
} from 'lucide-react'
import { supabase } from './admin/supabaseClient'
import { useWeeklyMenu } from './common/useWeeklyMenu'
import { AuthCtx, ThemeCtx } from './admin/context'
import AdminLayout from './admin/AdminLayout'
import KhidmatPortal from './admin/KhidmatPortal'
import InventoryManagerPortal from './admin/InventoryManagerPortal'
import LoginPage from './LoginPage'

// ══════════════════════════════════════════════════════════════
// THEME CONFIGURATION
// ══════════════════════════════════════════════════════════════
const THEMES = {
  light: {
    id: 'light', name: 'Fresh Morning', icon: '☀️',
    bg: '#f8fafc', bgGrad: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    card: '#ffffff', cardActive: '#ffffff',
    border: '#e2e8f0', borderActive: '#cbd5e1',
    accent: '#3b82f6', accentGrad: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
    accentBg: '#eff6ff', accentBorder: '#dbeafe',
    text: '#1e293b', textSub: '#64748b', textBody: '#334155',
    navBg: '#ffffff', navBorder: '#e2e8f0',
    geo: 'rgba(59, 130, 246, 0.03)', spinnerBorder: 'rgba(59, 130, 246, 0.1)', spinnerTop: '#3b82f6',
    inputBg: '#ffffff', inputBorder: '#e2e8f0',
    loginCard: '#ffffff', headerWave: '#f8fafc',
    successBg: '#f0fdf4', successBorder: '#dcfce7', successText: '#16a34a',
  },
  dark: {
    id: 'dark', name: 'Midnight Gold', icon: '🌙',
    bg: '#060d1a', bgGrad: 'radial-gradient(circle at 20% 20%, #0d1a33 0%, #060d1a 100%)',
    card: 'rgba(255, 255, 255, 0.03)', cardActive: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.08)', borderActive: 'rgba(212, 175, 55, 0.3)',
    accent: '#D4AF37', accentGrad: 'linear-gradient(135deg, #F9D976 0%, #D4AF37 100%)',
    accentBg: 'rgba(212, 175, 55, 0.12)', accentBorder: 'rgba(212, 175, 55, 0.3)',
    text: '#f8fafc', textSub: 'rgba(255, 255, 255, 0.5)', textBody: 'rgba(255, 255, 255, 0.8)',
    navBg: 'rgba(6, 13, 26, 0.95)', navBorder: 'rgba(255, 255, 255, 0.1)',
    geo: 'rgba(212, 175, 55, 0.04)', spinnerBorder: 'rgba(212, 175, 55, 0.2)', spinnerTop: '#D4AF37',
    inputBg: 'rgba(255, 255, 255, 0.04)', inputBorder: 'rgba(255, 255, 255, 0.1)',
    loginCard: 'rgba(10, 20, 40, 0.95)', headerWave: '#060d1a',
    successBg: 'rgba(34, 197, 94, 0.1)', successBorder: 'rgba(34, 197, 94, 0.3)', successText: '#4ade80',
  },
  earth: {
    id: 'earth', name: 'Desert Oasis', icon: '🏜️',
    bg: '#f4eee1', bgGrad: 'linear-gradient(135deg, #f4eee1 0%, #e8dec7 100%)',
    card: '#ffffff', cardActive: '#ffffff',
    border: '#e0d4bc', borderActive: '#c5b08b',
    accent: '#b8860b', accentGrad: 'linear-gradient(135deg, #d4a017 0%, #b8860b 100%)',
    accentBg: '#fdf8ec', accentBorder: '#f3e5c2',
    text: '#4a3728', textSub: '#8b7355', textBody: '#5d4037',
    navBg: '#ffffff', navBorder: '#e0d4bc',
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

const getTodayKey = () => {
  const map = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' }
  return map[new Date().getDay()] || 'monday'
}

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ══════════════════════════════════════════════════════════════
// UI COMPONENTS (Shared)
// ══════════════════════════════════════════════════════════════
const Card = ({ children, style = {}, active, organic, title, count, icon, onClick, hoverable }) => {
  const { t } = React.useContext(ThemeCtx)
  return (
    <div 
      onClick={onClick}
      className={`card ${hoverable ? 'hoverable' : ''}`}
      style={{
        borderRadius: organic ? 32 : 24,
        background: active ? t.cardActive : t.card,
        padding: '24px',
        border: `1.5px solid ${active ? t.borderActive : t.border}`,
        backdropFilter: 'blur(30px) saturate(1.2)',
        boxShadow: active ? `0 20px 50px rgba(0,0,0,0.3)` : '0 10px 30px rgba(0,0,0,0.2)',
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        ...style
      }}>
      {(title || count) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {icon}
            <span style={{ fontSize: 16, fontWeight: 800, color: t.text, letterSpacing: '0.02em' }}>{title}</span>
          </div>
          {count !== undefined && (
            <span style={{ fontSize: 24, fontWeight: 900, color: t.accent }}>{count}</span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

const Avatar = ({ avatarUrl, name, size = 40 }) => {
  const { t } = React.useContext(ThemeCtx)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      background: t.accentBg, border: `2px solid ${t.accent}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 8px 20px ${t.accent}25`, flexShrink: 0
    }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ color: t.accent, fontWeight: 800, fontSize: size * 0.4 }}>{name?.charAt(0) || '?'}</span>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession] = useState(undefined)
  const [mockUser, setMockUser] = useState(() => {
    const saved = localStorage.getItem('al_mawaid_mock_user')
    return saved ? JSON.parse(saved) : null
  })
  const [portalRole, setPortalRole] = useState(() => localStorage.getItem('al_mawaid_portal') || null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess)
      if (sess) {
        registerPush(sess.user.id);
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess)
      if (!sess) {
        setPortalRole(null);
        setMockUser(null);
        localStorage.removeItem('al_mawaid_portal')
        localStorage.removeItem('al_mawaid_mock_user')
      } else {
        registerPush(sess.user.id);
      }
    })

    const registerPush = async (userId) => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const reg = await navigator.serviceWorker.ready;
          let sub = await reg.pushManager.getSubscription();
          
          if (!sub && Notification.permission === 'granted') {
            const vapidKey = import.meta.env.VITE_VAPID_KEY;
            if (vapidKey) {
              sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey)
              });
            }
          }

          if (sub && userId) {
            await supabase.from('push_subscriptions').upsert([{ 
              user_id: userId, 
              subscription: sub 
            }], { onConflict: 'user_id,subscription' });
          }
        } catch (err) {
          console.warn('Push registration failed:', err);
        }
      }
    }

    return () => subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setPortalRole(null)
    setMockUser(null)
    localStorage.removeItem('al_mawaid_portal')
    localStorage.removeItem('al_mawaid_mock_user')
  }, [])

  const handleRoleLogin = useCallback((role, sess) => {
    localStorage.setItem('al_mawaid_portal', role)
    if (role === 'inventory_manager' && sess?.user) {
      localStorage.setItem('al_mawaid_mock_user', JSON.stringify(sess.user))
      setMockUser(sess.user)
    }
    setPortalRole(role)
  }, [])

  if (session === undefined && !mockUser) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060d1a' }}><div className="spin" style={{ width: 40, height: 40, border: '3px solid rgba(212,175,55,0.2)', borderTop: '3px solid #D4AF37', borderRadius: '50%' }} /></div>
  }

  if (!session && !mockUser) {
    return <LoginPage onRoleLogin={handleRoleLogin} />
  }

  // Admin and Khidmat layouts handle their own themes
  if (portalRole === 'admin') return <AdminLayout signOut={signOut} user={session?.user || mockUser} />
  if (portalRole === 'khidmat') return <KhidmatPortal signOut={signOut} user={session?.user || mockUser} />
  if (portalRole === 'inventory_manager') return <InventoryManagerPortal signOut={signOut} user={session?.user || mockUser} />

  // Thali User Portal
  return <ThaliUserApp user={session?.user || mockUser} signOut={signOut} />
}

function ThaliUserApp({ user, signOut }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('al_mawaid_theme') || 'dark')
  const t = THEMES[theme] || THEMES.dark

  useEffect(() => {
    localStorage.setItem('al_mawaid_theme', theme)
    document.body.style.background = t.bg
  }, [theme, t.bg])

  return (
    <ThemeCtx.Provider value={{ t, theme, setTheme }}>
      <div style={{ minHeight: '100vh', background: t.bg, color: t.text, transition: 'all 0.3s ease' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Amiri:wght@400;700&display=swap');
          * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
          body { background: ${t.bg}; color: ${t.text}; margin: 0; transition: background 0.3s ease; }
          .card:hover.hoverable { transform: translateY(-4px); border-color: ${t.accent}; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
          .glow-text { text-shadow: 0 0 15px ${t.accent}40; }
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
        
        <header style={{ padding: '40px 20px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Amiri', serif", fontSize: 18, color: t.accent, margin: '0 0 4px', letterSpacing: '0.05em' }}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: '0.15em', color: t.accent, fontFamily: "'Inter', sans-serif" }}>AL-MAWAID</h1>
          <div style={{ fontSize: 9, letterSpacing: '0.4em', textTransform: 'uppercase', color: t.textSub, marginTop: 4, fontWeight: 700 }}>Mumineen Service Portal</div>
        </header>

        <PortalRouter user={user} signOut={signOut} />
      </div>
    </ThemeCtx.Provider>
  )
}

function PortalRouter({ user, signOut }) {
  const [activeTab, setActiveTab] = useState('home')
  const { t } = React.useContext(ThemeCtx)

  return (
    <div style={{ paddingBottom: 120 }}>
      {activeTab === 'home' ? <HomeView user={user} /> :
       activeTab === 'alerts' ? <AlertsView user={user} /> :
       activeTab === 'profile' ? <ProfileView user={user} signOut={signOut} /> : null}

      <nav style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        width: '90%', maxWidth: 400, height: 74,
        background: t.navBg, backdropFilter: 'blur(40px)',
        border: `1.5px solid ${t.navBorder}`, borderRadius: 100,
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '0 10px', zIndex: 1000,
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        {[
          { id: 'home', icon: Utensils, label: 'Menu' },
          { id: 'alerts', icon: Bell, label: 'Alerts' },
          { id: 'profile', icon: Users, label: 'Account' },
        ].map(({ id, icon: Icon, label }) => {
          const active = activeTab === id
          return (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              color: active ? t.accent : t.textSub,
              transition: 'all 0.3s'
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: active ? t.accentBg : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${active ? t.accentBorder : 'transparent'}`
              }}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function HomeView({ user }) {
  const { t } = React.useContext(ThemeCtx)
  const [profileData, setProfileData] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [surveyOpen, setSurveyOpen] = useState(false)
  const weeklyMenu = useWeeklyMenu()
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
        <button 
          onClick={() => window.location.reload()} 
          style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <RefreshCw size={20} />
        </button>
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
            <div style={{ fontSize: 13, color: t.textSub, marginTop: 8, fontFamily: "'Inter', sans-serif" }}>Choose your thali requirements for the upcoming week.</div>
          </div>
          <button
            onClick={() => alert('Survey logic will open here')}
            disabled={!surveyOpen}
            style={{
              padding: '16px 32px', borderRadius: 16, background: surveyOpen ? t.accentGrad : t.border,
              color: surveyOpen ? '#000' : t.textSub, border: 'none', fontWeight: 900, cursor: surveyOpen ? 'pointer' : 'not-allowed',
              fontSize: 14, letterSpacing: '0.05em', boxShadow: surveyOpen ? `0 10px 30px ${t.accent}30` : 'none', transition: 'all 0.3s'
            }}>
            {surveyOpen ? 'OPEN NOW' : 'LOCKED'}
          </button>
        </div>
      </Card>

      {/* Daily Menu & Feedback */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionTitle title="Today's Menu" />
        
        {/* Lunch Card */}
        <Card title="Lunch" icon={<Utensils size={18} color={t.accent} />} style={{ borderLeft: `6px solid ${t.accent}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {weeklyMenu[todayKey]?.lunch?.length > 0 ? (
              weeklyMenu[todayKey].lunch.map((item, i) => (
                <div key={i} style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent }} />
                  {item}
                </div>
              ))
            ) : (
              <div style={{ color: t.textSub, fontStyle: 'italic' }}>No lunch menu scheduled</div>
            )}
          </div>
          
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Rate Lunch Quality</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  onClick={() => !feedbackSubmitted.lunch && setLunchStars(s)}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 12, border: `1px solid ${lunchStars >= s ? t.accent : t.border}`,
                    background: lunchStars >= s ? t.accentBg : 'transparent', color: lunchStars >= s ? t.accent : t.textSub,
                    cursor: feedbackSubmitted.lunch ? 'default' : 'pointer', transition: 'all 0.2s', fontSize: 18
                  }}>
                  ★
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Dinner Card */}
        <Card title="Dinner" icon={<Utensils size={18} color="#5eba82" />} style={{ borderLeft: `6px solid #5eba82` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {weeklyMenu[todayKey]?.dinner?.length > 0 ? (
              weeklyMenu[todayKey].dinner.map((item, i) => (
                <div key={i} style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5eba82' }} />
                  {item}
                </div>
              ))
            ) : (
              <div style={{ color: t.textSub, fontStyle: 'italic' }}>No dinner menu scheduled</div>
            )}
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Rate Dinner Quality</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  onClick={() => !feedbackSubmitted.dinner && setDinnerStars(s)}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 12, border: `1px solid ${dinnerStars >= s ? '#5eba82' : t.border}`,
                    background: dinnerStars >= s ? 'rgba(94, 186, 130, 0.1)' : 'transparent', color: dinnerStars >= s ? '#5eba82' : t.textSub,
                    cursor: feedbackSubmitted.dinner ? 'default' : 'pointer', transition: 'all 0.2s', fontSize: 18
                  }}>
                  ★
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Combined Submit Feedback */}
        {(lunchStars > 0 || dinnerStars > 0) && !feedbackSubmitted.lunch && !feedbackSubmitted.dinner && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <Card style={{ padding: 16 }}>
              <textarea
                placeholder="Any comments about today's food quality or taste? (Optional)"
                value={lunchComment}
                onChange={e => setLunchComment(e.target.value)}
                style={{
                  width: '100%', height: 80, borderRadius: 12, background: t.inputBg, border: `1px solid ${t.border}`,
                  padding: 12, color: t.text, fontSize: 14, outline: 'none', resize: 'none', marginBottom: 16
                }}
              />
              <button
                onClick={handleSubmitCombined}
                disabled={submittingFeedback}
                style={{
                  width: '100%', padding: '16px', borderRadius: 14, background: t.accentGrad, color: '#000',
                  border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: 15, letterSpacing: '0.05em'
                }}>
                {submittingFeedback ? 'SUBMITTING...' : 'SUBMIT FEEDBACK'}
              </button>
            </Card>
          </div>
        )}

        { (feedbackSubmitted.lunch || feedbackSubmitted.dinner) && (
          <div style={{ padding: 16, borderRadius: 16, background: t.successBg, border: `1px solid ${t.successBorder}`, textAlign: 'center', color: t.successText, fontSize: 14, fontWeight: 700 }}>
             Jazakallah! Your feedback has been recorded.
          </div>
        )}
      </div>
    </main>
  )
}

function SectionTitle({ title }) {
  const { t } = React.useContext(ThemeCtx)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, padding: '0 4px' }}>
      <div style={{ height: 1.5, flex: 1, background: `linear-gradient(to right, ${t.accent}, transparent)` }} />
      <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: t.accent }}>{title}</div>
      <div style={{ height: 1.5, flex: 1, background: `linear-gradient(to left, ${t.accent}, transparent)` }} />
    </div>
  )
}

function AlertsView({ user }) {
  const { t } = React.useContext(ThemeCtx)
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => {
        setNotices(data || [])
        setLoading(false)
      })
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ width: 30, height: 30, border: '2px solid rgba(0,0,0,0.1)', borderTop: `2px solid ${t.accent}`, borderRadius: '50%', margin: '0 auto' }} /></div>

  return (
    <div style={{ padding: '20px 16px', maxWidth: 800, margin: '0 auto' }}>
      <SectionTitle title="Broadcast Alerts" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        {notices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: t.textSub }}>
            <Bell size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <div>No alerts at this time.</div>
          </div>
        ) : notices.map(n => (
          <Card key={n.id} style={{ borderLeft: `4px solid ${n.tone || t.accent}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: n.tone || t.accent, textTransform: 'uppercase' }}>{n.sender_name || 'Al-Mawaid'}</div>
              <div style={{ fontSize: 10, color: t.textSub }}>{new Date(n.created_at).toLocaleDateString()}</div>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{n.title}</div>
            <div style={{ fontSize: 14, color: t.textBody, lineHeight: 1.5 }}>{n.body}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ProfileView({ user, signOut }) {
  const { theme, setTheme, t } = React.useContext(ThemeCtx)
  const [syncing, setSyncing] = useState(false)

  const clearAppCache = async () => {
    setSyncing(true)
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (let registration of registrations) { await registration.unregister() }
      const cacheNames = await caches.keys()
      for (let cacheName of cacheNames) { await caches.delete(cacheName) }
      alert('Cache cleared! Restarting app...')
      window.location.reload(true)
    } catch { alert('Failed to clear cache.') }
    setSyncing(false)
  }

  const toggleNotifications = async () => {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        window.location.reload(); // Trigger registration useEffect
      }
    } else {
      alert(`Notification permission is: ${Notification.permission}. Please update this in your browser/device settings.`);
    }
  }

  return (
    <div style={{ padding: '20px 16px', maxWidth: 800, margin: '0 auto' }}>
      <SectionTitle title="Account & Preferences" />
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        <Card title="Display Theme" icon={<Sun size={18} color={t.accent} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {Object.values(THEMES).map(themeItem => (
              <button
                key={themeItem.id}
                onClick={() => setTheme(themeItem.id)}
                style={{
                  padding: '16px', borderRadius: 16, border: `1.5px solid ${theme === themeItem.id ? t.accent : t.border}`,
                  background: theme === themeItem.id ? t.accentBg : 'transparent', color: t.text,
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s'
                }}>
                <span style={{ fontSize: 20 }}>{themeItem.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{themeItem.name}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Settings" icon={<Shield size={18} color={t.accent} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
             <button
              onClick={toggleNotifications}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: `1px solid ${t.border}`,
                background: 'rgba(0,0,0,0.1)', color: t.text, fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12
              }}>
              <Bell size={18} color={t.accent} />
              {Notification.permission === 'granted' ? 'Notifications Enabled' : 'Enable Push Notifications'}
            </button>
            <button
              onClick={clearAppCache}
              disabled={syncing}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: `1px solid ${t.border}`,
                background: 'rgba(0,0,0,0.1)', color: t.text, fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12
              }}>
              <RefreshCw size={18} color={t.accent} className={syncing ? 'spin' : ''} />
              {syncing ? 'UPDATING...' : 'Clear App Cache & Update'}
            </button>
          </div>
        </Card>

        <button
          onClick={signOut}
          style={{
            width: '100%', padding: '18px', borderRadius: 20, background: 'rgba(255, 92, 92, 0.1)',
            border: '1.5px solid rgba(255, 92, 92, 0.2)', color: '#ff5c5c', fontWeight: 900, cursor: 'pointer',
            marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
          }}>
          <LogOut size={20} /> SIGN OUT
        </button>
      </div>
    </div>
  )
}

function SectionHeader({ children }) {
  const { t } = React.useContext(ThemeCtx)
  return <div style={{ fontSize: 12, fontWeight: 800, color: t.accent, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12, marginTop: 8 }}>{children}</div>
}

function Badge({ children, color }) {
  return (
    <span style={{ 
      padding: '4px 10px', borderRadius: 12, background: `${color}15`, 
      border: `1px solid ${color}30`, color, fontSize: 10, fontWeight: 900, textTransform: 'uppercase' 
    }}>
      {children}
    </span>
  )
}

function LogOut({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}