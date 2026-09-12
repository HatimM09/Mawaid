import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Home, FileText, User, X, Bell, ClipboardList, Utensils } from 'lucide-react'
import { supabase } from '../lib/firebaseClient'
import { ThemeCtx, useAuth } from '../admin/context'
import { updateSystemTheme } from '../admin/ui'
import OfflineBanner from '../components/OfflineBanner'
import { getSurveyTargetWeek } from '../common/utils'
import { fetchUserSurveyRow } from '../lib/surveyRows'

import { THEMES } from './theme'
import { isSurveyOpen } from './survey'
import { GeoBg, GlobalStyles } from './ui'
import { playNotificationChime } from './sound'
import HomePage from './pages/HomePage'
import WeeklyMenuPage from './pages/WeeklyMenuPage'
import SurveyPage from './pages/SurveyPage'
import PostPage from './pages/PostPage'
import ProfilePage from './pages/ProfilePage'

export default function ThaliUserApp() {
  const { user } = useAuth()
  const initialParams = new URLSearchParams(window.location.search)
  const pathname = window.location.pathname.toLowerCase()
  const tabParam = initialParams.get('tab')
  const isAlerts = initialParams.get('alerts') === '1'
  const isSurvey = pathname.includes('/survey') || tabParam === 'survey'
  const isMenu = pathname.includes('/menu') || tabParam === 'menu'
  const isPost = pathname.includes('/post') || tabParam === 'post'
  const isProfile = pathname.includes('/profile') || tabParam === 'profile' || isAlerts

  const initialTab = isSurvey ? 'survey' : isMenu ? 'menu' : isPost ? 'post' : isProfile ? 'profile' : 'home'
  const initialSubPage = isAlerts ? 'notifications' : 'main'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [activeSubPage, setActiveSubPage] = useState(initialSubPage)
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
  const [, setClockTick] = useState(0)

  const loadAppSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('*')
    if (data) {
      const settings = {}
      data.forEach(row => settings[row.key] = row.value)
      setAppSettings(settings)
    } else {
      setAppSettings({})
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
    // Fallback polling: if realtime replication isn't enabled for app_settings,
    // still pick up admin survey opens/closes within 30s. Also refresh on focus
    // so users returning to the app always see the latest survey window state.
    const poll = setInterval(loadAppSettings, 10000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadAppSettings()
    }
    const onFocus = () => loadAppSettings()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [loadAppSettings])

  // Minute tick so time-windowed survey visibility (e.g. Sat 8 PM – Mon 11 AM)
  // updates live even while the app stays open across the boundary.
  useEffect(() => {
    const tick = setInterval(() => setClockTick(v => v + 1), 60000)
    return () => clearInterval(tick)
  }, [])

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

  // ── Handle deep links from notifications (SW clicks / PushManager) ──
  useEffect(() => {
    if (activeSubPage !== 'main') {
      setActiveTab('profile')
    }
  }, [activeSubPage])

  useEffect(() => {
    const handleAppNavigate = (e) => {
      const url = e.detail?.url || ''
      if (url.includes('/profile/notifications') || url.includes('alerts=1')) {
        setActiveTab('profile')
        setActiveSubPage('notifications')
      } else if (url.includes('/survey') || url.includes('tab=survey')) {
        loadAppSettings()
        setActiveTab('survey')
      } else if (url.includes('/menu') || url.includes('tab=menu')) {
        setActiveTab('menu')
      } else if (url.includes('/post') || url.includes('tab=post')) {
        setActiveTab('post')
      } else if (url.includes('/profile') || url.includes('tab=profile')) {
        setActiveTab('profile')
      } else if (url.includes('/home') || url.includes('tab=home') || url === '/') {
        setActiveTab('home')
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        window.open(url, '_blank')
      } else if (url) {
        window.location.href = url
      }
    }
    window.addEventListener('app-navigate', handleAppNavigate)
    // Clean up ?alerts=1 or query params from URL after handling
    if (window.location.search.includes('alerts=1')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    return () => window.removeEventListener('app-navigate', handleAppNavigate)
  }, [loadAppSettings])

  // ── Native Notification System (Supabase Realtime) ──
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Shared notice-targeting check: whether the user is currently "eating" a
    // granted slot. Merge override responses so override users are targeted
    // correctly (their normal table may be empty).
    const computeIsEating = async () => {
      const dayNum = new Date().getDay()
      if (dayNum === 0) return false
      const h = new Date().getHours()
      const weekId = getSurveyTargetWeek(appSettings)
      const days = ['', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const today = days[dayNum]
      const mealName = h < 15 ? 'lunch' : 'dinner'
      const dayKey = today.substring(0, 3).toLowerCase()
      const mealKey = mealName === 'lunch' ? 'l' : 'd'
      
      const { data: subData } = await fetchUserSurveyRow(user.id, weekId)
      const status = subData ? subData[`${dayKey}_${mealKey}_status`] : 'Not Submitted'
      return status === 'Applied'
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
          const isEating = await computeIsEating()
          
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
        try { localStorage.setItem('almawaid_seen_notices', JSON.stringify([...seenNoticeIds.current])) } catch { /* ignore */ }
        let isForMe = !notice.target_user_id || notice.target_user_id === user?.id

        if (isForMe && notice.tone) {
          const toneStr = notice.tone || ''
          if (toneStr.includes(':opt_in') || toneStr.includes(':opt_out')) {
            const isOptInTarget = toneStr.includes(':opt_in')
            try {
              const isEating = await computeIsEating()
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
          // Play notification chime for important broadcasts
          if (notice.title || notice.sender_name) {
            playNotificationChime()
          }
          // Note: we deliberately do NOT also fire a native Notification here —
          // background delivery is handled by the push service worker, and showing
          // both a toast AND a native popup for the same notice duplicates alerts.
          // Proportional timing: longer content = longer display
          const bodyLen = (notice.body || '').length
          const toastDuration = Math.max(6000, Math.min(bodyLen * 50, 12000))
          setTimeout(() => setToastNotice(null), toastDuration)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, appSettings])

  const markNotificationsRead = useCallback(() => {
    localStorage.setItem('almawaid_last_notice_read', new Date().toISOString())
    setUnreadCount(0)
  }, [])

  const handleSetTheme = (id) => { setTheme(id); localStorage.setItem('almawaid_theme', id) }

  const LogoIcon = ({ size = 20, style = {} }) => (
    <img src="/al-mawaid.png" alt="" style={{ width: size, height: size, objectFit: 'contain', ...style }} />
  )
  const surveyTabVisible = isSurveyOpen(appSettings, user?.id)

  // Redirect away from survey tab if survey window closes
  useEffect(() => {
    if (activeTab === 'survey' && !surveyTabVisible) {
      setActiveTab('home')
    }
  }, [activeTab, surveyTabVisible])

  const tabs = [
    { id: 'home', label: 'Home', Icon: Home, aria: 'Home Dashboard' },
    { id: 'menu', label: 'Menu', Icon: Utensils, aria: 'Weekly Menu' },
    ...(surveyTabVisible ? [{ id: 'survey', label: 'Survey', Icon: ClipboardList, aria: 'Weekly Survey' }] : []),
    { id: 'post', label: 'Requests', Icon: FileText, aria: 'My Requests & Queries' },
    { id: 'profile', label: 'Profile', Icon: User, aria: 'My Profile & Settings' },
  ]
  const tabLabels = { home: 'AL-MAWAID', menu: 'WEEKLY MENU', survey: 'WEEKLY SURVEY', post: 'REQUESTS', profile: 'PROFILE' }

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
          const senderInitial = (toastNotice.sender_name || 'A').charAt(0).toUpperCase()
          const hasMedia = toastNotice.media && toastNotice.media[0]
          return (
          <div
            onClick={() => { setActiveTab('profile'); setActiveSubPage('notifications'); setToastNotice(null) }}
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
              position: 'fixed', top: 16, left: '50%',
              width: 'calc(100% - 32px)', maxWidth: 400, zIndex: 10000,
              background: 'rgba(14,12,10,0.96)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 18, overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              cursor: 'pointer',
              backdropFilter: 'blur(20px)',
              transform: dragOffset > 0
                ? `translateX(-50%) translateY(${dragOffset}px)`
                : 'translateX(-50%)',
              transition: isDragging
                ? 'none'
                : 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              animation: dragOffset === 0 && !isDragging
                ? 'slideDown 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                : undefined,
            }}
          >
            {hasMedia && (
              <div style={{
                width: '100%', height: 120,
                background: `url(${toastNotice.media[0]}) center/cover no-repeat`,
                borderBottom: '1px solid rgba(255,255,255,0.06)'
              }} />
            )}
            <div style={{ padding: 14, display: 'flex', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'var(--accent-grad)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, color: '#0a0d14', fontSize: 15, fontWeight: 800
              }}>
                {senderInitial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.04em', marginBottom: 1, textTransform: 'uppercase' }}>
                  {toastNotice.sender_name || 'Al-Mawaid'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 1 }}>{toastNotice.title}</div>
                {toastNotice.body && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>{toastNotice.body}</div>}
              </div>
              <button onClick={(e) => { e.stopPropagation(); setToastNotice(null) }} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.35)', width: 26, height: 26, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <X size={13} />
              </button>
            </div>
            <div style={{ height: 2, background: 'linear-gradient(90deg, var(--accent-primary), transparent)', animation: `toastCountdown ${Math.max(6, Math.min((toastNotice.body || '').length * 0.05, 12))}s linear forwards` }} />
          </div>
          )
        })()}

        {activeTab === 'home' && <HomePage onGoToSurvey={() => { loadAppSettings(); setActiveTab('survey') }} appSettings={appSettings} />}
        {activeTab === 'menu' && <WeeklyMenuPage appSettings={appSettings} />}
        {activeTab === 'survey' && <SurveyPage appSettings={appSettings} />}

        {activeTab === 'post' && <PostPage />}
        {activeTab === 'profile' && <ProfilePage theme={theme} setTheme={handleSetTheme} markRead={markNotificationsRead} appSettings={appSettings} activeSubPage={activeSubPage} setActiveSubPage={setActiveSubPage} onGoToSurvey={() => { loadAppSettings(); setActiveTab('survey') }} />}

        <OfflineBanner />

        <nav className="mobile-bottom-nav" aria-label="Main navigation">
          {tabs.map(tab => {
            const active = activeTab === tab.id
            const showSurveyBadge = false // per-user override removed; badge deprecated
            const surveyLive = isSurveyOpen(appSettings, user.id)
            return (
              <button key={tab.id} onClick={() => { if (tab.id === 'survey') loadAppSettings(); setActiveTab(tab.id) }} className={active ? 'active' : ''} aria-label={tab.aria || tab.label}>
                <div>
                  <tab.Icon size={22} />
                </div>
                {showSurveyBadge && (
                  <span
                    title={surveyLive ? 'Survey is open' : 'Survey is closed (override access)'}
                    style={{
                      position: 'absolute', top: 4, right: '50%', transform: 'translateX(20px)',
                      padding: '3px 7px', borderRadius: 9, lineHeight: 1,
                      background: surveyLive ? 'rgba(52,211,153,0.16)' : 'rgba(239,68,68,0.16)',
                      border: `1px solid ${surveyLive ? 'rgba(52,211,153,0.65)' : 'rgba(239,68,68,0.65)'}`,
                      color: surveyLive ? '#34d399' : '#f87171',
                      fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
                      fontFamily: "'DM Sans', sans-serif", zIndex: 2, whiteSpace: 'nowrap',
                      boxShadow: surveyLive ? '0 0 10px rgba(52,211,153,0.45)' : '0 0 8px rgba(239,68,68,0.35)',
                    }}
                  >{surveyLive ? 'OPEN' : 'CLOSED'}</span>
                )}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
        <GlobalStyles />
      </div>
    </ThemeCtx.Provider>
  )
}
