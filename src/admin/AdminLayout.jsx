// src/admin/AdminLayout.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, ClipboardList, Star, FileText,
  MessageSquare, Shield, Settings, LogOut, Menu, X, ChevronRight, ChevronLeft, Search, History, Package, Send, Zap, Target, CreditCard, Palette, Check, Clock
} from 'lucide-react'
import { updateSystemTheme } from './ui'
import OfflineBanner from '../components/OfflineBanner'
import { supabase } from '../lib/firebaseClient'

const NAV_GROUPS = [
  {
    title: 'MAIN',
    items: [
      { to: '/admin', label: 'Dashboard', Icon: LayoutDashboard, end: true, roles: ['admin', 'inventory_manager', 'khidmat_guzar', 'supervisor'] },
      { to: '/admin/survey-tracking', label: 'Survey Tracking', Icon: History, roles: ['admin'], isLive: true },
      { to: '/admin/surveys', label: 'Survey Form', Icon: Star, roles: ['admin'] },
      { to: '/admin/survey-dashboard', label: 'Survey Summary', Icon: ClipboardList, roles: ['admin'] },
      { to: '/admin/survey-accuracy', label: 'Accuracy & Logs', Icon: Target, roles: ['admin'] },
    ]
  },
  {
    title: 'OPERATIONS',
    items: [
      { to: '/admin/requests', label: 'Thali Requests', Icon: FileText, roles: ['admin', 'khidmat_guzar', 'supervisor'] },
      { to: '/admin/feedback', label: 'Feedback', Icon: Star, roles: ['admin', 'khidmat_guzar', 'supervisor'] },
      { to: '/admin/queries', label: 'Queries', Icon: MessageSquare, roles: ['admin', 'khidmat_guzar', 'supervisor'] },
    ]
  },
  {
    title: 'MANAGEMENT',
    items: [
      { to: '/admin/users', label: 'Thali Users', Icon: Users, roles: ['admin'] },
      { to: '/admin/payments', label: 'Payments Hub', Icon: CreditCard, roles: ['admin', 'supervisor', 'payment_manager'] },
      { to: '/admin/inventory', label: 'Inventory', Icon: Package, roles: ['admin', 'inventory_manager'] },
      { to: '/admin/staff', label: 'Staff', Icon: Shield, roles: ['admin'] },
      { to: '/admin/notifications', label: 'Broadcast', Icon: Send, roles: ['admin'] },
      { to: '/admin/automation', label: 'Automation', Icon: Zap, roles: ['admin'] },
      { to: '/admin/settings', label: 'Settings', Icon: Settings, roles: ['admin'] },
    ]
  }
]

const ALL_NAV = NAV_GROUPS.flatMap(g => g.items)
export const NAV = ALL_NAV

const THEME_OPTIONS = [
  { id: 'royal', name: 'Royal Gold', dot1: '#c5a059', dot2: '#0a0d14', subtitle: 'Champagne & Charcoal (Default)' },
  { id: 'obsidian', name: 'Obsidian OLED', dot1: '#10b981', dot2: '#06080c', subtitle: 'Pitch Black & High Contrast' },
  { id: 'studio', name: 'Studio Daylight', dot1: '#936c28', dot2: '#ffffff', subtitle: 'Crisp Kitchen Sunlight' },
  { id: 'dark', name: 'Midnight Violet', dot1: '#a78bfa', dot2: '#0c0c14', subtitle: 'Violet Ambient Glow' },
]

export default function AdminLayout() {
  const [adminName, setAdminName] = useState('Admin')
  const [role, setRole] = useState(localStorage.getItem('al_mawaid_portal') || 'khidmat')
  const seenNoticeIds = useRef(new Set(JSON.parse(localStorage.getItem('almawaid_seen_notices') || '[]')))
  const [, setConnStatus] = useState('connecting')
  const [navCounts, setNavCounts] = useState({})
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('almawaid_sidebar_collapsed') !== 'expanded' } catch { return true }
  })
  const [mobileDrawer, setMobileDrawer] = useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const themeMenuRef = useRef(null)
  const [liveTime, setLiveTime] = useState(new Date())
  const navigate = useNavigate()
  const location = useLocation()

  const [currentTheme, setCurrentTheme] = useState(() => {
    try { return localStorage.getItem('almawaid_admin_theme') || 'royal' } catch { return 'royal' }
  })

  useEffect(() => {
    updateSystemTheme(currentTheme)
  }, [currentTheme])

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) {
        setThemeMenuOpen(false)
      }
    }
    if (themeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [themeMenuOpen])

  const handleThemeChange = (nextTheme) => {
    setCurrentTheme(nextTheme)
    updateSystemTheme(nextTheme)
    setThemeMenuOpen(false)
  }

  const currentNav = ALL_NAV.find(n => n.to === location.pathname) ||
    ALL_NAV.find(n => n.to !== '/admin' && location.pathname.startsWith(n.to)) ||
    { label: 'Portal' }

  useEffect(() => {
    const check = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error && error.message?.includes('Refresh Token Not Found')) {
        handleLogout();
        return;
      }
      if (session) {
        setAdminName(session.user.user_metadata?.name || 'Admin')
        const { data: staff } = await supabase.from('staff').select('role').eq('user_id', session.user.id).maybeSingle()
        if (staff?.role) setRole(staff.role)
      }
    }
    check()
  }, [])
  const [showPalette, setShowPalette] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowPalette(true)
      }
      if (e.key === 'Escape') {
        setShowPalette(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const isMobile = () => window.innerWidth < 1025
  const toggleSidebar = () => {
    if (isMobile()) { setMobileDrawer(v => !v); return }
    setCollapsed(v => {
      const next = !v
      try { localStorage.setItem('almawaid_sidebar_collapsed', next ? 'collapsed' : 'expanded') } catch { /* storage may be unavailable */ }
      return next
    })
  }
  const closeDrawer = () => setMobileDrawer(false)

  useEffect(() => {
    const onResize = () => {
      if (isMobile()) { setCollapsed(true) } else { setMobileDrawer(false) }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      const fallback = session.user.email || 'Admin'
      setAdminName(fallback)
      supabase.from('staff').select('name, role').eq('user_id', session.user.id).maybeSingle()
        .then(({ data, error }) => {
          if (!error && data?.name) setAdminName(data.name)
          if (!error && data?.role) setRole(data.role)
        })
    })
  }, [])

  // ── NAVIGATION BADGE COUNTS ──
  const loadNavCounts = useCallback(async () => {
    const [pendingReqs, openQueries, lowStock, userCount] = await Promise.all([
      supabase.from('thali_requests').select('id', { count: 'exact', head: true }).or('status.eq.pending,status.is.null'),
      supabase.from('queries').select('id', { count: 'exact', head: true }).or('status.eq.open,status.is.null'),
      supabase.from('inventory').select('id, stock, low_stock_threshold'),
      supabase.from('user_stats').select('user_id', { count: 'exact', head: true }),
    ])
    const lowStockCount = (lowStock.data || []).filter(p => p.stock <= (p.low_stock_threshold || 5)).length
    setNavCounts({
      'Thali Requests': pendingReqs.count ?? 0,
      'Queries': openQueries.count ?? 0,
      'Inventory': lowStockCount,
      'Thali Users': userCount.count ?? 0,
    })
  }, [])

  useEffect(() => {
    loadNavCounts()
    const channel = supabase
      .channel('nav-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'thali_requests' }, () => loadNavCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queries' }, () => loadNavCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => loadNavCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_stats' }, () => loadNavCounts())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadNavCounts])

  // ── Outside-app notices (Realtime) ──
  // No in-app popup banner: notices arrive as OS-level notifications outside
  // the app (Web Push / FCM) and are stored for the Broadcast/notices history.
  // This listener only fires the OS Notification API when granted.
  useEffect(() => {
    // Mark existing notices as read so they don't appear on login/reconnect
    const lastRead = localStorage.getItem('almawaid_last_notice_read') || '1970-01-01T00:00:00.000Z'
    supabase.from('notices')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', lastRead)
      .then(({ count }) => {
        if (count && count > 0) {
          localStorage.setItem('almawaid_last_notice_read', new Date().toISOString())
        }
      })
      .catch(() => { })

    const channel = supabase
      .channel('global-notices')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' }, (payload) => {
        const notice = payload.new
        if (!notice || !notice.id) return
        if (seenNoticeIds.current.has(notice.id)) return
        seenNoticeIds.current.add(notice.id)
        try { localStorage.setItem('almawaid_seen_notices', JSON.stringify([...seenNoticeIds.current].slice(-200))) } catch { /* storage may be unavailable */ }

        // Suppress routine menu publications from notifying repeatedly in admin dashboard
        if (notice.type === 'menu') return

        // Only notify for truly fresh notices (< 30 seconds old)
        const createdAtMs = notice.created_at ? new Date(notice.created_at).getTime() : Date.now()
        const isFresh = (Date.now() - createdAtMs) < 30000
        if (!isFresh) return

        // Skip if notice was created before the last read timestamp (already seen)
        const lastRead = localStorage.getItem('almawaid_last_notice_read')
        if (lastRead && new Date(notice.created_at).getTime() <= new Date(lastRead).getTime()) return

        // Outside-app OS notification (no in-app banner, no chime).
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(notice.title || 'Broadcast Sent', { body: notice.body || notice.message || '', icon: '/al-mawaid.png' })
          } catch { /* Notification constructor can throw — ignore */ }
        }
      })
      .subscribe((status) => {
        setConnStatus(status === 'SUBSCRIBED' ? 'online' : 'offline')
      })
    return () => supabase.removeChannel(channel)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('al_mawaid_portal')
    localStorage.removeItem('al_mawaid_mock_user')
    window.location.reload()
  }

  const visibleNav = ALL_NAV.filter(n => n.roles.includes(role))
  const filteredNav = ALL_NAV.filter(n => n.roles.includes(role) && n.label.toLowerCase().includes(searchQuery.toLowerCase()))
  const expanded = isMobile() ? mobileDrawer : !collapsed

  const currentHour = liveTime.getHours()
  const mealWindowTag = (currentHour >= 6 && currentHour < 12) ? '☀️ Lunch Session' : (currentHour >= 12 && currentHour < 19) ? '🌙 Dinner Session' : '🕒 Prep Window'
  const timeFormatted = liveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const activeThemeMeta = THEME_OPTIONS.find(t => t.id === currentTheme) || THEME_OPTIONS[0]



  return (
    <div className="admin-root" style={{
      display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden',
      background: 'var(--bg-deep)',
      position: 'relative'
    }}>
      <OfflineBanner />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'var(--bg-grad)',
      }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=DM+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap');

        /* ── Base App Layout ── */
        .admin-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100dvh;
          overflow: hidden;
          padding: 0;
          position: relative;
          z-index: 1;
          transition: margin-left 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* ── Modern Sticky Top Header ── */
        .admin-header {
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          background: var(--bg-card);
          backdrop-filter: blur(24px) saturate(1.2);
          -webkit-backdrop-filter: blur(24px) saturate(1.2);
          border-bottom: 1px solid var(--border-light);
          z-index: 1000;
          flex-shrink: 0;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }

        .header-toggle-btn {
          width: 38px; height: 38px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.03); border: 1px solid var(--border-light);
          color: var(--text-primary); cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .header-toggle-btn:hover {
          background: var(--accent-bg);
          border-color: var(--accent-border);
          color: var(--accent-primary);
        }

        .admin-breadcrumbs {
          display: flex; align-items: center; gap: 8px;
          font-size: 13.5px; font-weight: 600;
        }
        .breadcrumb-root { color: var(--text-tertiary); opacity: 0.8; }
        .breadcrumb-sep { color: var(--border-active); opacity: 0.5; font-size: 12px; }
        .breadcrumb-active {
          color: var(--text-primary);
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .header-search-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 7px 14px; border-radius: 10px;
          background: var(--input-bg); border: 1px solid var(--border-light);
          color: var(--text-tertiary); cursor: pointer;
          transition: all 0.2s;
        }
        .header-search-btn:hover {
          border-color: var(--accent-border);
          color: var(--text-primary);
          background: var(--bg-card-hover);
        }
        .header-shortcut-badge {
          padding: 2px 6px; border-radius: 5px;
          background: rgba(255,255,255,0.06); border: 1px solid var(--border-light);
          font-size: 10px; font-weight: 800; font-family: monospace;
          color: var(--accent-primary);
        }

        /* ── TV Scan Station Launcher Pill ── */
        .header-tv-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 7px 14px; border-radius: 10px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.35);
          color: #34d399; cursor: pointer;
          font-family: inherit; font-size: 12.5px; font-weight: 800;
          letter-spacing: 0.02em;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 2px 10px rgba(16, 185, 129, 0.1);
        }
        .header-tv-btn:hover {
          background: rgba(16, 185, 129, 0.2);
          border-color: #10b981;
          color: #ffffff;
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.25);
        }

        /* ── Live Digital Clock & Window ── */
        .header-clock-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 12px; border-radius: 10px;
          background: var(--input-bg); border: 1px solid var(--border-light);
          font-family: 'Space Grotesk', monospace;
          font-variant-numeric: tabular-nums;
          font-size: 11.5px; font-weight: 700;
          color: var(--text-primary);
        }
        .clock-session-tag {
          font-size: 9.5px; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.05em;
          color: var(--accent-primary);
        }

        /* ── Theme Popover & Dropdown ── */
        .theme-popover-wrap {
          position: relative;
        }
        .header-theme-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 7px 12px; border-radius: 10px;
          background: var(--bg-surface); border: 1px solid var(--border-light);
          color: var(--text-primary); cursor: pointer;
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.02em;
          transition: all 0.2s;
        }
        .header-theme-btn:hover {
          border-color: var(--accent-border);
          background: var(--bg-card-hover);
        }
        .theme-dropdown {
          position: absolute; top: calc(100% + 8px); right: 0;
          width: 250px;
          background: var(--bg-card);
          backdrop-filter: blur(28px) saturate(1.2);
          -webkit-backdrop-filter: blur(28px) saturate(1.2);
          border: 1px solid var(--border-light);
          border-radius: 16px;
          padding: 8px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.35);
          z-index: 4000;
          display: flex; flex-direction: column; gap: 4px;
          animation: themeFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes themeFadeIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .theme-option-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 12px; border-radius: 10px;
          background: transparent; border: 1px solid transparent;
          cursor: pointer; transition: all 0.15s;
          text-align: left;
        }
        .theme-option-item:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-light);
        }
        .theme-option-item.active {
          background: var(--accent-bg);
          border-color: var(--accent-border);
        }

        .header-live-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 10px; border-radius: 10px;
          background: rgba(57,255,20,0.06); border: 1px solid rgba(57,255,20,0.2);
          font-size: 10px; font-weight: 800; color: #39ff14;
          text-transform: uppercase; letter-spacing: 0.08em;
        }

        .header-profile-pill {
          display: flex; align-items: center; gap: 9px;
          padding: 4px 10px 4px 5px; border-radius: 24px;
          background: rgba(255,255,255,0.03); border: 1px solid var(--border-light);
        }
        .avatar-mini {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--accent-grad);
          color: #000; font-weight: 900; font-size: 12px;
          display: flex; align-items: center; justify-content: center;
        }

        /* ── Impeccable Stitch-Standard Sidebar ── */
        .admin-sidebar {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 74px; background: var(--bg-card);
          backdrop-filter: blur(36px) saturate(1.2);
          -webkit-backdrop-filter: blur(36px) saturate(1.2);
          z-index: 2000;
          border-right: 1px solid var(--border-light);
          transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s ease;
          transform: translateX(0);
          display: flex; flex-direction: column;
          padding: 16px 10px 16px;
          overflow: hidden;
          box-shadow: 4px 0 24px rgba(0,0,0,0.18);
        }
        .admin-sidebar.expanded {
          width: 254px;
          box-shadow: 12px 0 40px rgba(0,0,0,0.3);
        }

        .sidebar-brand {
          display: flex; align-items: center; gap: 12px;
          padding: 6px 6px 16px; cursor: pointer; flex-shrink: 0;
          border-bottom: 1px solid var(--border-light);
          margin-bottom: 12px;
        }
        .admin-sidebar.collapsed .sidebar-brand {
          justify-content: center;
          padding: 6px 0 16px;
        }
        .sidebar-brand-icon {
          width: 40px; height: 40px; border-radius: 12px;
          background: var(--accent-grad); flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(197, 160, 89, 0.25);
        }
        .sidebar-brand-text { white-space: nowrap; }
        .admin-sidebar.collapsed .sidebar-brand-text { display: none; }

        .sidebar-nav-list {
          flex: 1; overflow-y: auto; overflow-x: hidden;
          display: flex; flex-direction: column; gap: 3px;
        }
        .sidebar-nav-list::-webkit-scrollbar { width: 3px; }
        .sidebar-nav-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

        .sidebar-group-title {
          font-size: 9px; font-weight: 800;
          letter-spacing: 0.14em;
          color: var(--text-tertiary);
          padding: 12px 14px 4px;
          text-transform: uppercase;
          opacity: 0.75;
        }
        .sidebar-group-divider {
          height: 1px; background: var(--border-light);
          margin: 8px 10px; opacity: 0.6;
        }

        .sidebar-nav-item {
          display: flex; align-items: center; gap: 13px;
          padding: 9.5px 14px; text-decoration: none;
          color: var(--text-tertiary);
          border-radius: 12px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          white-space: nowrap;
          border: 1px solid transparent;
        }
        .admin-sidebar.collapsed .sidebar-nav-item {
          justify-content: center;
          padding: 10px 0;
        }

        /* Sleek floating tooltip on collapsed hover */
        .admin-sidebar.collapsed .sidebar-nav-item::after {
          content: attr(data-label);
          position: absolute;
          left: 100%;
          top: 50%;
          transform: translateY(-50%) translateX(6px);
          background: var(--bg-card);
          color: var(--text-primary);
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 700;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid var(--border-light);
          box-shadow: 0 10px 30px rgba(0,0,0,0.35);
          z-index: 9999;
        }
        .admin-sidebar.collapsed .sidebar-nav-item:hover::after {
          opacity: 1;
          transform: translateY(-50%) translateX(12px);
        }

        .sidebar-nav-item:hover {
          background: var(--bg-card-hover);
          color: var(--text-primary);
          border-color: var(--border-light);
        }

        .sidebar-nav-item.active {
          background: var(--accent-bg);
          border-color: var(--accent-border);
          color: var(--accent-primary);
          font-weight: 700;
          box-shadow: inset 0 0 12px rgba(197, 160, 89, 0.08);
        }
        .sidebar-nav-item.active::before {
          content: '';
          position: absolute; left: 0; top: 18%; bottom: 18%;
          width: 3.5px; border-radius: 0 3px 3px 0;
          background: var(--accent-primary);
          box-shadow: 0 0 8px var(--accent-primary);
        }
        .admin-sidebar.collapsed .sidebar-nav-item.active::before {
          left: 2px;
          top: 20%;
          bottom: 20%;
        }

        .sidebar-nav-label { font-size: 13.5px; font-weight: 600; }
        .admin-sidebar.collapsed .sidebar-nav-label { display: none; }

        .sidebar-nav-count {
          margin-left: auto; min-width: 20px; height: 20px;
          border-radius: 10px; background: var(--accent-bg);
          border: 1px solid var(--accent-border);
          color: var(--accent-primary); font-size: 10px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          padding: 0 5px; font-family: monospace; font-variant-numeric: tabular-nums;
        }
        .admin-sidebar.collapsed .sidebar-nav-count { display: none; }

        /* ── Sidebar Footer & Controls ── */
        .sidebar-footer-wrap {
          padding-top: 12px; border-top: 1px solid var(--border-light);
          display: flex; align-items: center; gap: 8px; flex-shrink: 0;
        }
        .admin-sidebar.collapsed .sidebar-footer-wrap {
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .sidebar-rail-btn {
          width: 38px; height: 38px; border-radius: 10px;
          background: var(--input-bg); border: 1px solid var(--border-light);
          color: var(--text-tertiary); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; flex-shrink: 0;
        }
        .sidebar-rail-btn:hover {
          color: var(--accent-primary);
          border-color: var(--accent-border);
          background: var(--accent-bg);
        }
        .sidebar-logout-btn {
          flex: 1; border-radius: 10px;
          background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25);
          color: #f87171; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 9px; font-size: 13px; font-weight: 700; transition: all 0.2s;
        }
        .sidebar-logout-btn:hover {
          background: rgba(239, 68, 68, 0.18);
          border-color: #ef4444;
          color: #ffffff;
        }
        .admin-sidebar.collapsed .sidebar-logout-btn {
          width: 38px; height: 38px; padding: 0; flex: initial;
        }
        .admin-sidebar.collapsed .sidebar-logout-btn span { display: none; }

        /* ── Responsive & Desktop Positions ── */
        @media (min-width: 1025px) {
          .sidebar-backdrop { display: none !important; }
          .admin-main { margin-left: 74px; min-height: 100dvh; cursor: default; }
          .admin-main.sidebar-expanded { margin-left: 254px; }
        }

        @media (max-width: 1024px) {
          .admin-sidebar { width: 70px; z-index: 5000; transform: translateX(-100%); }
          .admin-sidebar.expanded { width: 250px; transform: translateX(0) !important; }
          .admin-main { margin-left: 0; }
        }

        @media (max-width: 768px) {
          .admin-header { padding: 0 14px; height: 58px; }
          .admin-search { display: none !important; }
          .desktop-only { display: none !important; }
          .mobile-only { display: block !important; }
        }

        .sidebar-backdrop {
          position: fixed; inset: 0; z-index: 1999;
          background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
          opacity: 0; pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .sidebar-backdrop.visible { opacity: 1; pointer-events: auto; }

        /* ── Scrollbars & Micro-Animations ── */
        main::-webkit-scrollbar { width: 4px; }
        main::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

        .admin-table-wrap::-webkit-scrollbar { height: 6px; }
        .admin-table-wrap::-webkit-scrollbar-thumb { background: rgba(197, 160, 89, 0.25); border-radius: 6px; }
        .admin-table-wrap::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); }

        .admin-main button {
          box-sizing: border-box;
          line-height: 1.2;
          vertical-align: middle;
        }
        .admin-btn {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          text-align: center !important;
          box-sizing: border-box !important;
        }
        .admin-btn:active {
          transform: scale(0.97) translateY(1px) !important;
        }

        .admin-card {
          position: relative;
        }
        .admin-card:hover {
          border-color: rgba(197, 160, 89, 0.24) !important;
        }

        .admin-sr-mono {
          font-family: 'Space Grotesk', 'JetBrains Mono', monospace;
          font-variant-numeric: tabular-nums;
        }

        .smooth-appear {
          animation: fadeSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .scroll-container {
          scroll-behavior: smooth;
        }

        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.85); }
        }
        .live-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #39ff14; display: inline-block;
          box-shadow: 0 0 8px #39ff14;
          animation: livePulse 1.8s ease-in-out infinite;
        }
        .tv-pulse-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #10b981; display: inline-block;
          box-shadow: 0 0 8px #10b981;
          animation: livePulse 1.4s ease-in-out infinite;
        }

        .hover-lift {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
        }
        .hover-lift:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(212, 175, 55, 0.15);
        }

        @keyframes staggerFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .stagger-item {
          animation: staggerFadeIn 0.4s ease-out forwards;
          opacity: 0;
        }
        .stagger-item:nth-child(1) { animation-delay: 0.05s; }
        .stagger-item:nth-child(2) { animation-delay: 0.1s; }
        .stagger-item:nth-child(3) { animation-delay: 0.15s; }
        .stagger-item:nth-child(4) { animation-delay: 0.2s; }
        .stagger-item:nth-child(5) { animation-delay: 0.25s; }
        .stagger-item:nth-child(6) { animation-delay: 0.3s; }
        .stagger-item:nth-child(7) { animation-delay: 0.35s; }
        .stagger-item:nth-child(8) { animation-delay: 0.4s; }

        .admin-root select {
          color: var(--text-primary) !important;
          background: var(--input-bg) !important;
        }
        .admin-root select option {
          background: var(--bg-deep) !important;
          color: var(--text-primary) !important;
        }
      `}</style>

      {/* Main Content Area */}
      <div className={`admin-main ${expanded ? 'sidebar-expanded' : ''}`}>

        {/* Sidebar backdrop overlay on mobile */}
        <div className={`sidebar-backdrop ${mobileDrawer ? 'visible' : ''}`} onClick={closeDrawer} />

        {/* ── Top Header Bar ── */}
        <header className="admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={toggleSidebar} className="header-toggle-btn" aria-label="Toggle navigation drawer">
              {expanded ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="admin-breadcrumbs">
              <span className="breadcrumb-root">Al-Mawaid</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-active">{currentNav?.label || 'Portal'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Live Session Clock */}
            <div className="header-clock-badge desktop-only" title="Current Kitchen Dispatch Clock">
              <Clock size={13} color="var(--accent-primary)" />
              <span>{timeFormatted}</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span className="clock-session-tag">{mealWindowTag}</span>
            </div>

            {/* Quick search button */}
            <button onClick={() => setShowPalette(true)} className="header-search-btn" title="Search commands & pages (⌘K)">
              <Search size={14} style={{ opacity: 0.6 }} />
              <span className="desktop-only" style={{ fontSize: 12 }}>Search portal...</span>
              <span className="header-shortcut-badge">⌘K</span>
            </button>

            {/* TV Scan Mode Launcher Button */}
            <button
              onClick={() => navigate('/admin/survey-tracking?scan=true')}
              className="header-tv-btn"
              title="Launch TV Packaging & Scan Station"
            >
              <span className="tv-pulse-dot" />
              <span>📺 TV Scan Mode</span>
            </button>

            {/* Dynamic Theme Picker Popover */}
            <div className="theme-popover-wrap" ref={themeMenuRef}>
              <button
                onClick={() => setThemeMenuOpen(v => !v)}
                className="header-theme-btn"
                title={`Active Theme: ${activeThemeMeta.name}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: activeThemeMeta.dot1, display: 'inline-block' }} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: activeThemeMeta.dot2, display: 'inline-block', border: '1px solid rgba(255,255,255,0.2)' }} />
                </div>
                <span className="desktop-only">{activeThemeMeta.name}</span>
                <Palette size={13} style={{ opacity: 0.7 }} />
              </button>

              {themeMenuOpen && (
                <div className="theme-dropdown">
                  <div style={{ padding: '6px 8px 4px', fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Select Theme
                  </div>
                  {THEME_OPTIONS.map(opt => {
                    const isActive = currentTheme === opt.id
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleThemeChange(opt.id)}
                        className={`theme-option-item ${isActive ? 'active' : ''}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: opt.dot1, display: 'inline-block' }} />
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: opt.dot2, display: 'inline-block', border: '1px solid rgba(255,255,255,0.2)' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{opt.name}</div>
                            <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)' }}>{opt.subtitle}</div>
                          </div>
                        </div>
                        {isActive && <Check size={14} color="var(--accent-primary)" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Realtime Live Indicator */}
            <div className="header-live-badge desktop-only">
              <span className="live-dot" />
              <span>Live</span>
            </div>

            {/* Admin Avatar & Role Pill */}
            <div className="header-profile-pill">
              <div className="avatar-mini">
                {(adminName || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="desktop-only" style={{ textAlign: 'left', lineHeight: 1.1 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>{adminName}</div>
                <div style={{ fontSize: 8.5, fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>{role}</div>
              </div>
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* Left Sidebar */}
          <aside className={`admin-sidebar ${expanded ? 'expanded' : 'collapsed'}`}>
            <div
              onClick={() => { navigate('/admin'); if (isMobile()) closeDrawer() }}
              className="sidebar-brand"
              title="AL-MAWAID PORTAL"
            >
              <div className="sidebar-brand-icon">
                <img src="/al-mawaid.png" alt="" style={{ width: 26, height: 26 }} />
              </div>
              <div className="sidebar-brand-text">
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '0.04em' }}>AL-MAWAID</div>
                <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Management Portal</div>
              </div>
            </div>

            {/* Grouped Navigation List */}
            <div className="sidebar-nav-list">
              {NAV_GROUPS.map((grp, gIdx) => {
                const groupItems = grp.items.filter(item => item.roles.includes(role))
                if (groupItems.length === 0) return null
                return (
                  <div key={grp.title}>
                    {expanded ? (
                      <div className="sidebar-group-title">{grp.title}</div>
                    ) : (
                      gIdx > 0 && <div className="sidebar-group-divider" />
                    )}

                    {groupItems.map(({ to, label, Icon, end, isLive }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={end}
                        title={label}
                        data-label={label}
                        className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => isMobile() && closeDrawer()}
                        onKeyDown={e => { if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Space') { e.preventDefault(); navigate(to) } }}
                      >
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={19} style={{ flexShrink: 0 }} />
                          {isLive && (
                            <span style={{
                              position: 'absolute', top: -1, right: -2, width: 6, height: 6,
                              borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981'
                            }} />
                          )}
                        </div>
                        <span className="sidebar-nav-label">{label}</span>
                        {navCounts[label] > 0 && (
                          <div className="sidebar-nav-count">
                            {navCounts[label] > 99 ? '99+' : navCounts[label]}
                          </div>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )
              })}
            </div>

            {/* Sidebar Controls & Footer */}
            <div className="sidebar-footer-wrap">
              {!isMobile() && (
                <button
                  onClick={toggleSidebar}
                  title={expanded ? 'Collapse sidebar ([)' : 'Expand sidebar ([)'}
                  className="sidebar-rail-btn"
                >
                  {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>
              )}
              <button
                onClick={handleLogout}
                title="Sign out of Admin Portal"
                className="sidebar-logout-btn"
              >
                <LogOut size={16} strokeWidth={2.2} />
                <span className="sidebar-nav-label">Logout</span>
              </button>
            </div>
          </aside>

          {/* Dynamic page content */}
          <main key={location.pathname} className="smooth-appear scroll-container" style={{ flex: 1, padding: 'clamp(14px, 2.5vw, 28px)', paddingBottom: 40, overflowY: 'auto', overflowX: 'hidden' }}>
            <Outlet context={{ role }} />
          </main>
        </div>
      </div>

      {/* Command Palette */}
      {showPalette && (
        <>
          <div onClick={() => setShowPalette(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 3000 }} />
          <div style={{ position: 'fixed', top: '15%', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: 600, background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: 24, zIndex: 3001, boxShadow: '0 24px 70px rgba(0,0,0,0.45)', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid var(--border-light)' }}>
              <Search size={20} color="var(--accent-primary)" />
              <input
                name="commandSearch"
                autoFocus
                placeholder="Type a command or search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', paddingLeft: 14, fontSize: 16, flex: 1, fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ padding: 12, maxHeight: 400, overflowY: 'auto' }}>
              {filteredNav.map(n => (
                <div key={n.to} onClick={() => { navigate(n.to); setShowPalette(false); }} onKeyDown={e => { if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Space') { e.preventDefault(); navigate(n.to); setShowPalette(false) } }} role="button" tabIndex={0} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s', background: location.pathname === n.to ? 'var(--accent-bg)' : 'transparent', color: 'var(--text-primary)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                    {typeof n.Icon === 'string' ? n.Icon : <n.Icon size={18} />}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{n.label}</div>
                  <div style={{ flex: 1 }} />
                  <ChevronRight size={14} color="var(--text-tertiary)" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}