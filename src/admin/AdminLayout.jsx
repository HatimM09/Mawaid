// src/admin/AdminLayout.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, ClipboardList, Star, FileText,
  MessageSquare, Shield, Settings, LogOut, Menu, X, ChevronRight, Search, Bell, History, Package, Send, Zap, FileWarning, Target
} from 'lucide-react'
import { updateSystemTheme } from './ui'
import OfflineBanner from '../components/OfflineBanner'
import { supabase } from '../lib/firebaseClient'
import { playNotificationChime } from '../common/utils'

const NAV = [
  { to: '/admin', label: 'Dashboard', Icon: LayoutDashboard, color: 'var(--accent-primary)', end: true, roles: ['admin', 'inventory_manager', 'khidmat_guzar', 'supervisor'] },
  { to: '/admin/users', label: 'Thali Users', Icon: Users, color: 'var(--accent-primary)', roles: ['admin'] },
  { to: '/admin/survey-dashboard', label: 'Survey Summary', Icon: ClipboardList, color: 'var(--accent-primary)', roles: ['admin'] },
  { to: '/admin/surveys', label: 'Survey Form', Icon: Star, color: 'var(--accent-primary)', roles: ['admin'] },
  { to: '/admin/survey-tracking', label: 'Survey Tracking', Icon: History, color: 'var(--accent-primary)', roles: ['admin'] },
  { to: '/admin/survey-accuracy', label: 'Accuracy & Logs', Icon: Target, color: 'var(--accent-primary)', roles: ['admin'] },
  { to: '/admin/requests', label: 'Thali Requests', Icon: FileText, color: 'var(--accent-primary)', roles: ['admin', 'khidmat_guzar', 'supervisor'] },
  { to: '/admin/inventory', label: 'Inventory', Icon: Package, color: 'var(--accent-primary)', roles: ['admin', 'inventory_manager'] },
  { to: '/admin/queries', label: 'Queries', Icon: MessageSquare, color: 'var(--accent-primary)', roles: ['admin', 'khidmat_guzar', 'supervisor'] },
  { to: '/admin/staff', label: 'Staff', Icon: Shield, color: 'var(--accent-primary)', roles: ['admin'] },
  { to: '/admin/notifications', label: 'Broadcast', Icon: Send, color: 'var(--accent-primary)', roles: ['admin'] },
  { to: '/admin/feedback', label: 'Feedback', Icon: Star, color: 'var(--accent-primary)', roles: ['admin', 'khidmat_guzar', 'supervisor'] },
  { to: '/admin/automation', label: 'Automation', Icon: Zap, color: 'var(--accent-primary)', roles: ['admin'] },
  { to: '/admin/settings', label: 'Settings', Icon: Settings, color: 'var(--accent-primary)', roles: ['admin'] },
]

export default function AdminLayout() {
  const [adminName, setAdminName] = useState('Admin')
  const [role, setRole] = useState(localStorage.getItem('al_mawaid_portal') || 'khidmat')
  const [toastNotice, setToastNotice] = useState(null)
  const seenNoticeIds = useRef(new Set(JSON.parse(localStorage.getItem('almawaid_seen_notices') || '[]')))
  const dragStartY = useRef(null)
  const dragY = useRef(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [connStatus, setConnStatus] = useState('connecting')
  const [navCounts, setNavCounts] = useState({})
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('almawaid_sidebar_collapsed') !== 'expanded' } catch { return true }
  })
  const [mobileDrawer, setMobileDrawer] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

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

  useEffect(() => {
    updateSystemTheme('royal')
  }, [])

  const isMobile = () => window.innerWidth < 1025
  const toggleSidebar = () => {
    if (isMobile()) { setMobileDrawer(v => !v); return }
    setCollapsed(v => {
      const next = !v
      try { localStorage.setItem('almawaid_sidebar_collapsed', next ? 'collapsed' : 'expanded') } catch {}
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

  // ── Native Notification System (Realtime) ──
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
      .catch(() => {})

    const channel = supabase
      .channel('global-notices')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' }, (payload) => {
        const notice = payload.new
        if (!notice || !notice.id) return
        if (seenNoticeIds.current.has(notice.id)) return
        seenNoticeIds.current.add(notice.id)
        try { localStorage.setItem('almawaid_seen_notices', JSON.stringify([...seenNoticeIds.current].slice(-200))) } catch {}

        // Suppress routine menu publications from popping up repeatedly in admin dashboard
        if (notice.type === 'menu') return

        // Only show live in-app toast banner for truly fresh notices (< 30 seconds old)
        const createdAtMs = notice.created_at ? new Date(notice.created_at).getTime() : Date.now()
        const isFresh = (Date.now() - createdAtMs) < 30000
        if (!isFresh) return

        // Skip if notice was created before the last read timestamp (already seen)
        const lastRead = localStorage.getItem('almawaid_last_notice_read')
        if (lastRead && new Date(notice.created_at).getTime() <= new Date(lastRead).getTime()) return

        setToastNotice(notice)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notice.title || 'Broadcast Sent', { body: notice.body || notice.message || '', icon: '/al-mawaid.png' })
        }
        setTimeout(() => setToastNotice(null), 8000)
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

  const visibleNav = NAV.filter(n => n.roles.includes(role))
  const filteredNav = visibleNav.filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase()))
  const expanded = isMobile() ? mobileDrawer : !collapsed



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
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=DM+Sans:wght@400;500;700;900&display=swap');
        @keyframes slideDown { from { opacity: 0; transform: translateY(-24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toastCountdown { from { width: 100%; } to { width: 0%; } }
        .admin-main { flex: 1; display: flex; flex-direction: column; height: 100dvh; overflow: hidden; padding: 0; position: relative; z-index: 1; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .admin-header { height: 70px; display: flex; align-items: center; padding: 0 30px; background: var(--bg-card); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border-glass); z-index: 1000; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
        
        .admin-sidebar {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 84px; background: rgba(15, 12, 8, 0.95);
          backdrop-filter: blur(40px); z-index: 2000;
          border-right: 1px solid rgba(212, 175, 55, 0.2);
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateX(0);
          display: flex; flex-direction: column;
          padding: 24px 0 40px;
          overflow: hidden;
        }
        .admin-sidebar.expanded {
          width: 280px;
          /* The UI Curve */
          border-radius: 0 80px 80px 0;
          box-shadow: 20px 0 50px rgba(0,0,0,0.5);
        }

        .sidebar-toggle {
          display: flex; align-items: center; justify-content: center;
          width: 42px; height: 42px; border-radius: 12px;
          background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.25);
          color: var(--accent-primary); cursor: pointer;
          margin: 0 auto 24px; transition: all 0.3s; flex-shrink: 0;
        }
        .sidebar-toggle:hover { background: var(--accent-grad); color: #000; }

        .admin-sidebar .sidebar-brand {
          display: flex; align-items: center; justify-content: center; gap: 15px;
          padding: 0 0 32px; cursor: pointer; flex-shrink: 0;
        }
        .admin-sidebar.expanded .sidebar-brand { justify-content: flex-start; padding: 0 30px 32px; }
        .sidebar-brand-text { white-space: nowrap; }
        .admin-sidebar.collapsed .sidebar-brand-text { display: none; }

        .sidebar-nav-list { flex: 1; overflow-y: auto; padding-right: 10px; }

        .sidebar-nav-item {
          display: flex; align-items: center; justify-content: center; gap: 15px;
          padding: 14px 0; text-decoration: none;
          color: var(--text-tertiary); transition: all 0.3s;
          position: relative; margin-bottom: 5px;
          border-radius: 0 30px 30px 0;
        }
        .admin-sidebar.expanded .sidebar-nav-item { justify-content: flex-start; padding: 14px 30px; }
        /* Lay icons with the UI curve when expanded */
        .admin-sidebar.expanded .sidebar-nav-item:nth-child(1), .admin-sidebar.expanded .sidebar-nav-item:nth-child(11) { padding-left: 20px; }
        .admin-sidebar.expanded .sidebar-nav-item:nth-child(2), .admin-sidebar.expanded .sidebar-nav-item:nth-child(10) { padding-left: 35px; }
        .admin-sidebar.expanded .sidebar-nav-item:nth-child(3), .admin-sidebar.expanded .sidebar-nav-item:nth-child(9) { padding-left: 45px; }
        .admin-sidebar.expanded .sidebar-nav-item:nth-child(4), .admin-sidebar.expanded .sidebar-nav-item:nth-child(8) { padding-left: 52px; }
        .admin-sidebar.expanded .sidebar-nav-item:nth-child(5), .admin-sidebar.expanded .sidebar-nav-item:nth-child(7) { padding-left: 56px; }
        .admin-sidebar.expanded .sidebar-nav-item:nth-child(6) { padding-left: 58px; }

        .admin-sidebar.expanded .sidebar-nav-item:hover { background: rgba(212, 175, 55, 0.1); color: var(--text-primary); padding-left: 65px; }
        .admin-sidebar.expanded .sidebar-nav-item.active { background: var(--accent-grad); color: #000; font-weight: 800; padding-left: 70px; box-shadow: 0 10px 25px rgba(212, 175, 55, 0.3); }
        .admin-sidebar.collapsed .sidebar-nav-item:hover { color: var(--text-primary); }
        .admin-sidebar.collapsed .sidebar-nav-item.active { color: var(--accent-primary); }

        .sidebar-nav-label { font-size: 14px; font-weight: 600; white-space: nowrap; }
        .admin-sidebar.collapsed .sidebar-nav-label,
        .admin-sidebar.collapsed .sidebar-nav-count { display: none; }

        .sidebar-logout-wrap {
          padding: 20px 0; border-top: 1px solid rgba(255,255,255,0.05);
          display: flex; justify-content: center; flex-shrink: 0;
        }
        .admin-sidebar.expanded .sidebar-logout-wrap { padding: 20px 30px; }
        .sidebar-logout-btn {
          width: 44px; height: 44px; border-radius: 14px;
          background: rgba(255,92,92,0.1); border: 1.5px solid rgba(255,92,92,0.3);
          color: #ff5c5c; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 12;
          font-weight: 800; transition: all 0.3s;
        }
        .admin-sidebar.expanded .sidebar-logout-btn { width: 100%; padding: 14px; }

        /* Sidebar overlay backdrop on mobile */
        .sidebar-backdrop {
          position: fixed; inset: 0; z-index: 1999;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
          opacity: 0; pointer-events: none;
          transition: opacity 0.4s ease;
        }
        .sidebar-backdrop.visible { opacity: 1; pointer-events: auto; }

        .glass {
          background: var(--bg-card);
          backdrop-filter: blur(28px) saturate(1.3);
          -webkit-backdrop-filter: blur(28px) saturate(1.3);
          border: 1px solid var(--border-glass);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .glow-text {
          color: var(--text-primary);
          text-shadow: 0 0 15px rgba(212, 175, 55, 0.6);
          font-family: 'Cinzel', serif;
        }

        .more-menu-container {
          position: fixed; bottom: 100px; right: 5%; width: 260px;
          background: rgba(15, 12, 8, 0.95); backdrop-filter: blur(30px);
          border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 24px;
          padding: 16px; z-index: 2100; box-shadow: 0 20px 50px rgba(0,0,0,0.6);
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes skeletonPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }

        @media (min-width: 1025px) {
          .sidebar-backdrop { display: none !important; }
          .admin-main { margin-left: 84px; transition: margin-left 0.5s cubic-bezier(0.4, 0, 0.2, 1); min-height: 100dvh; cursor: default; }
          .admin-main.sidebar-expanded { margin-left: 280px; }
        }

        @media (max-width: 1024px) {
          .admin-sidebar { width: 72px; border-radius: 0 40px 40px 0; padding-top: 16px; z-index: 5000; }
          .admin-sidebar.expanded { width: 280px; transform: translateX(0) !important; }
          .admin-right-sidebar { display: none; }
          .admin-main { margin-left: 72px; transition: margin-left 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
          .admin-main.sidebar-expanded { margin-left: 0; }
        }

        @media (max-width: 768px) {
          .admin-header { padding: 0 16px; height: 60px; }
          .admin-search { display: none !important; }
          .desktop-only { display: none !important; }
          .admin-nav-breadcrumb { display: none !important; }
          .mobile-only { display: block !important; }
        }

        /* ── Fix native select dropdown visibility in dark admin theme ── */
        .admin-root select {
          color: var(--text-primary) !important;
          background: var(--input-bg) !important;
        }
        .admin-root select option {
          background: var(--bg-deep) !important;
          color: var(--text-primary) !important;
        }
        .admin-root select option:hover,
        .admin-root select option:focus,
        .admin-root select option:active,
        .admin-root select option:checked {
          background: var(--accent-primary) !important;
          color: #000 !important;
        }
        .admin-root select:focus {
          border-color: var(--accent-primary) !important;
          box-shadow: 0 0 0 2px var(--accent-bg) !important;
        }
      `}</style>

      {/* Main Content Area */}
      <div className={`admin-main ${expanded ? 'sidebar-expanded' : ''}`}>

        {/* Sidebar backdrop overlay on mobile */}
        <div className={`sidebar-backdrop ${mobileDrawer ? 'visible' : ''}`} onClick={closeDrawer} />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* Left Sidebar */}
          <aside className={`admin-sidebar ${expanded ? 'expanded' : 'collapsed'}`}>
            <button onClick={toggleSidebar} className="sidebar-toggle" aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}>
              {expanded ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div 
              onClick={() => { navigate('/admin'); if (isMobile()) closeDrawer() }}
              className="sidebar-brand"
              title="AL-MAWAID"
            >
              <div style={{ width: 42, height: 42, borderRadius: 14, background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/al-mawaid.png" alt="" style={{ width: 28, height: 28 }} />
              </div>
              <div className="sidebar-brand-text">
                <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '0.05em' }}>AL-MAWAID</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Management Portal</div>
              </div>
            </div>
            <div className="sidebar-nav-list">
              {visibleNav.map(({ to, label, Icon, end }) => (
                <NavLink key={to} to={to} end={end} title={label} className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => isMobile() && closeDrawer()} onKeyDown={e => { if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Space') { e.preventDefault(); navigate(to) } }}>
                  <Icon size={20} />
                  <span className="sidebar-nav-label">{label}</span>
                  {navCounts[label] > 0 && (
                    <div className="sidebar-nav-count" style={{
                      marginLeft: 'auto', minWidth: 22, height: 22,
                      borderRadius: 11, background: 'var(--accent-grad)',
                      color: '#000', fontSize: 10, fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 5px', boxShadow: '0 2px 8px var(--border-active)'
                    }}>
                      {navCounts[label] > 99 ? '99+' : navCounts[label]}
                    </div>
                  )}
                </NavLink>
              ))}
            </div>
            <div className="sidebar-logout-wrap">
              <button 
                onClick={handleLogout} 
                title="Logout"
                style={{ 
                  background: 'var(--accent-grad)',
                  boxShadow: '0 4px 15px rgba(255, 92, 92, 0.1)'
                }}
                className="sidebar-logout-btn"
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,92,92,0.2)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,92,92,0.1)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <LogOut size={18} strokeWidth={2.5} /> <span className="sidebar-nav-label">Logout</span>
              </button>
            </div>
          </aside>

          {/* Dynamic content */}
          <main key={location.pathname} className="smooth-appear scroll-container" style={{ flex: 1, padding: 'clamp(12px, 3vw, 24px)', paddingBottom: 40, overflowY: 'auto', overflowX: 'hidden' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 100, marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 10,
                background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.15)',
                fontSize: 9, fontWeight: 700, color: 'rgba(57,255,20,0.7)',
                textTransform: 'uppercase', letterSpacing: '0.1em'
              }}>
                <span className="live-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#39ff14', display: 'inline-block' }} />
                Real-time
              </div>
            </div>
            <Outlet context={{ role }} />
          </main>
        </div>

        {/* ── Toast Notification Popup ── */}
        {toastNotice && (
          <div
            onClick={() => setToastNotice(null)}
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
              position: 'fixed', top: 80, right: 20,
              width: 'calc(100% - 40px)', maxWidth: 350, zIndex: 10000,
              background: 'rgba(15, 12, 8, 0.95)', border: '1.5px solid rgba(212, 175, 55, 0.4)',
              borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)', cursor: 'pointer',
              transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : 'none',
              transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              animation: dragOffset === 0 && !isDragging ? 'slideDown 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : undefined,
              backdropFilter: 'blur(20px)'
            }}
          >
            {/* Media banner */}
            {toastNotice.media && toastNotice.media[0] && (
              <div style={{
                width: '100%', height: 100,
                background: `url(${toastNotice.media[0]}) center/cover no-repeat`,
                borderBottom: '1px solid rgba(255,255,255,0.06)'
              }} />
            )}
            <div style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bell size={20} color="#000" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>
                  {toastNotice.sender_name || 'Al-Mawaid'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-gold)', marginBottom: 2 }}>{toastNotice.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>{toastNotice.body}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setToastNotice(null) }} aria-label="Dismiss notification" style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.4)', width: 26, height: 26, borderRadius: 8, padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
            <div style={{height:3,background:"var(--accent-primary)",borderRadius:"0 0 20px 20px",animation:`toastCountdown ${Math.max(6, Math.min((toastNotice.body || '').length * 0.05, 12))}s linear forwards`}} />
          </div>
        )}
      </div>

      {/* Command Palette */}
      {showPalette && (
        <>
          <div onClick={() => setShowPalette(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 3000 }} />
          <div style={{ position: 'fixed', top: '15%', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: 600, background: '#12151d', borderRadius: 24, zIndex: 3001, boxShadow: '0 0 40px rgba(0,0,0,0.5)', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-light)' }}>
              <Search size={20} color="var(--accent-cyan)" />
              <input
                name="commandSearch"
                autoFocus
                placeholder="Type a command or search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ background: 'var(--accent-bg)', border: 'none', color: '#fff', outline: 'none', paddingLeft: 16, fontSize: 16, flex: 1 }}
              />
            </div>
            <div style={{ padding: 12, maxHeight: 400, overflowY: 'auto' }}>
              {filteredNav.map(n => (
                <div key={n.to} onClick={() => { navigate(n.to); setShowPalette(false); }} onKeyDown={e => { if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Space') { e.preventDefault(); navigate(n.to); setShowPalette(false) } }} role="button" tabIndex={0} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s', background: location.pathname === n.to ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: location.pathname === n.to ? 'var(--accent-gold)' : 'var(--text-tertiary)' }}>
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

      <style>{`
        main::-webkit-scrollbar { width: 4px; }
        main::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

        .smooth-appear {
          animation: fadeSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .scroll-container {
          scroll-behavior: smooth;
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

        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .live-dot {
          animation: livePulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}