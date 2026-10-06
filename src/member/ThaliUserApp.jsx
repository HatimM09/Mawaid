import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Sparkles, UtensilsCrossed, ClipboardCheck, MessageSquareText, UserCircle2, BellRing } from 'lucide-react'
import { supabase } from '../lib/firebaseClient'
import { ThemeCtx, useAuth } from '../admin/context'
import { updateSystemTheme } from '../admin/ui'
import OfflineBanner from '../components/OfflineBanner'
import { getSurveyTargetWeek } from '../common/utils'
import { fetchUserSurveyRow } from '../lib/surveyRows'
import { setAppBadgeCount, clearAppBadge } from '../lib/appBadge'

import { THEMES } from './theme'
import { isSurveyOpen } from './survey'
import { GeoBg, GlobalStyles } from './ui'
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
  const isPayments = pathname.includes('/payments') || tabParam === 'payments' || initialParams.get('payments') === '1'
  const isSurvey = pathname.includes('/survey') || tabParam === 'survey'
  const isMenu = pathname.includes('/menu') || tabParam === 'menu'
  const isPost = pathname.includes('/post') || tabParam === 'post'
  // Deep-linkable alert/payment pages: works for both fresh loads (OS
  // notification tap → service worker openWindow) and in-app navigation.
  const isNotifPath = pathname.includes('/profile/notifications') || pathname.includes('/notifications')
  const isPayPath = pathname.includes('/profile/payments') || pathname.includes('/payments')
  const isProfile = pathname.includes('/profile') || tabParam === 'profile' || isAlerts || isPayments || isNotifPath || isPayPath

  const initialTab = isSurvey ? 'survey' : isMenu ? 'menu' : isPost ? 'post' : isProfile ? 'profile' : 'home'
  const initialSubPage = (isAlerts || isNotifPath) ? 'notifications' : (isPayments || isPayPath) ? 'payments' : 'main'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [activeSubPage, setActiveSubPage] = useState(initialSubPage)
  const [theme, setTheme] = useState(() => localStorage.getItem('almawaid_theme') || 'dark')
  const t = THEMES[theme] || THEMES.dark
  const [unreadCount, setUnreadCount] = useState(0)
  const seenNoticeIds = useRef(new Set(JSON.parse(localStorage.getItem('almawaid_seen_notices') || '[]')))
  const [appSettings, setAppSettings] = useState({})
  const appSettingsRef = useRef(appSettings)
  const [, setClockTick] = useState(0)

  const loadAppSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('*')
    if (data) {
      const settings = {}
      data.forEach(row => settings[row.key] = row.value)
      setAppSettings(settings)
      appSettingsRef.current = settings
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

  // ── Consume a pending push deep-link (stored when the tap arrived before the
  // app/tabs were mounted — e.g. cold start from an OS notification) ──
  useEffect(() => {
    let pending = null
    try {
      pending = sessionStorage.getItem('almawaid_pending_deep_link')
      sessionStorage.removeItem('almawaid_pending_deep_link')
    } catch {
      console.debug('[deep-link] session storage unavailable')
    }
    if (pending) {
      // Dispatch after mount so the app-navigate handler below routes it.
      const t = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('app-navigate', { detail: { url: pending } }))
      }, 50)
      return () => clearTimeout(t)
    }
  }, [])

  // ── Handle deep links from notifications (SW clicks / PushManager) ──
  useEffect(() => {
    if (activeSubPage !== 'main') {
      setActiveTab('profile')
    }
  }, [activeSubPage])

  useEffect(() => {
    const handleAppNavigate = (e) => {
      const url = e.detail?.url || ''
      if (url.includes('/profile/payments') || url.includes('payments=1') || url.includes('tab=payments')) {
        setActiveTab('profile')
        setActiveSubPage('payments')
      } else if (url.includes('/profile/notifications') || url.includes('alerts=1')) {
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

  // ── Alerts badge (no in-app popup — notifications arrive via OS push and
  // are stored in the Alerts tab). Realtime only bumps the badge silently. ──
  const refreshUnread = useCallback(async () => {
    if (!user) return
    const lastRead = localStorage.getItem('almawaid_last_notice_read') || '1970-01-01T00:00:00.000Z'
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .or(`target_user_id.is.null,target_user_id.eq.${user.id}`)
      .gt('created_at', lastRead)

    if (!error && data) {
      setUnreadCount(data.length)
      // DON'T auto-mark as read here — user must open notifications page to mark read
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror the Alerts count onto the launcher app icon (Badging API).
  useEffect(() => {
    setAppBadgeCount(unreadCount)
  }, [unreadCount])

  // Load unread count once on mount — NOT on every appSettings change
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    refreshUnread()
  }, [refreshUnread])

  // Silent refresh when a push arrives while the app is open (PushManager
  // dispatches this instead of showing any popup).
  useEffect(() => {
    const onPush = () => refreshUnread()
    window.addEventListener('notifications-updated', onPush)
    return () => window.removeEventListener('notifications-updated', onPush)
  }, [refreshUnread])

  // Realtime subscription for the Alerts badge — stable channel, no appSettings dependency.
  // Silent: no banner, no chime. The OS push is the notification; the tab stores it.
  useEffect(() => {
    if (!user?.id) return

    // Shared notice-targeting check
    const computeIsEating = async () => {
      const dayNum = new Date().getDay()
      if (dayNum === 0) return false
      const h = new Date().getHours()
      const weekId = getSurveyTargetWeek(appSettingsRef.current)
      const days = ['', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const today = days[dayNum]
      const mealName = h < 15 ? 'lunch' : 'dinner'
      const dayKey = today.substring(0, 3).toLowerCase()
      const mealKey = mealName === 'lunch' ? 'l' : 'd'
      
      const { data: subData } = await fetchUserSurveyRow(user.id, weekId)
      const status = subData ? subData[`${dayKey}_${mealKey}_status`] : 'Not Submitted'
      return status === 'Applied'
    }


    const channel = supabase
      .channel('global-notices')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' }, async (payload) => {
        const notice = payload.new
        if (!notice || !notice.id) return
        
        // Prevent double-counting the badge on re-subscribes
        if (seenNoticeIds.current.has(notice.id)) return
        seenNoticeIds.current.add(notice.id)
        try { localStorage.setItem('almawaid_seen_notices', JSON.stringify([...seenNoticeIds.current].slice(-200))) } catch { /* ignore */ }

        // Content-based survey dedup check
        const titleStr = (notice.title || '').trim()
        const bodyStr = (notice.body || notice.message || '').trim()
        const isSurveyNotice = notice.type === 'survey' || notice.type === 'survey_reminder' ||
          titleStr.toLowerCase().includes('survey') || bodyStr.toLowerCase().includes('survey')
        
        if (isSurveyNotice) {
          const surveyKey = `notice_survey_${titleStr}_${bodyStr}`.replace(/\s+/g, '_').substring(0, 80)
          const lastSurveyToast = sessionStorage.getItem(surveyKey)
          if (lastSurveyToast && (Date.now() - Number(lastSurveyToast)) < 15 * 60 * 1000) {
            return // Skip rapid duplicate survey badge bumps within 15 min
          }
          sessionStorage.setItem(surveyKey, String(Date.now()))
        }

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
          setUnreadCount(prev => prev + 1)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.id])

  const markNotificationsRead = useCallback(() => {
    localStorage.setItem('almawaid_last_notice_read', new Date().toISOString())
    setUnreadCount(0)
    clearAppBadge()
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
    { id: 'home', label: 'Home', Icon: Sparkles, aria: 'Home Dashboard' },
    { id: 'menu', label: 'Menu', Icon: UtensilsCrossed, aria: 'Weekly Menu' },
    ...(surveyTabVisible ? [{ id: 'survey', label: 'Survey', Icon: ClipboardCheck, aria: 'Weekly Survey' }] : []),
    { id: 'post', label: 'Requests', Icon: MessageSquareText, aria: 'My Requests & Queries' },
    { id: 'profile', label: 'Profile', Icon: UserCircle2, aria: 'My Profile & Settings' },
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
                  <BellRing size={18} color={unreadCount > 0 ? t.accent : t.textSub} style={{ opacity: unreadCount > 0 ? 1 : 0.5 }} />
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

        {activeTab === 'home' && (
          <HomePage
            onGoToSurvey={() => { loadAppSettings(); setActiveTab('survey') }}
            onGoToPayments={() => { setActiveTab('profile'); setActiveSubPage('payments') }}
            appSettings={appSettings}
          />
        )}
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
