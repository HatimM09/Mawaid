// src/admin/AdminLayout.jsx
import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, ClipboardList, Star, FileText,
  MessageSquare, Shield, Settings, LogOut, Menu, X, ChevronRight, ChevronLeft, Search, Bell, Zap, Command, Sparkles, AlertCircle, History, Package, Send, RefreshCw
} from 'lucide-react'
import { T, updateSystemTheme } from './ui'
import { supabase } from './supabaseClient'

const NAV = [
  { to: '/admin', label: 'Dashboard', Icon: LayoutDashboard, color: 'var(--accent-primary)', end: true },
  { to: '/admin/users', label: 'Thali Users', Icon: Users, color: 'var(--accent-primary)' },
  { to: '/admin/surveys', label: 'Surveys', Icon: ClipboardList, color: 'var(--accent-primary)' },
  { to: '/admin/survey-tracking', label: 'Survey Tracking', Icon: History, color: 'var(--accent-primary)' },
  { to: '/admin/requests', label: 'Thali Requests', Icon: FileText, color: 'var(--accent-primary)' },
  { to: '/admin/inventory', label: 'Inventory', Icon: Package, color: 'var(--accent-primary)' },
  { to: '/admin/queries', label: 'Queries', Icon: MessageSquare, color: 'var(--accent-primary)' },
  { to: '/admin/staff', label: 'Staff', Icon: Shield, color: 'var(--accent-primary)' },
  { to: '/admin/notifications', label: 'Broadcast', Icon: Send, color: 'var(--accent-primary)' },
  { to: '/admin/feedback', label: 'Feedback', Icon: Star, color: 'var(--accent-primary)' },
  { to: '/admin/settings', label: 'Settings', Icon: Settings, color: 'var(--accent-primary)' },
]

export default function AdminLayout() {
  const [adminName, setAdminName] = useState('Admin')
  const [role, setRole] = useState(localStorage.getItem('al_mawaid_portal') || 'khidmat')
  const [toastNotice, setToastNotice] = useState(null)
  const [connStatus, setConnStatus] = useState('connecting')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const navigate = useNavigate()

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
  const [showMore, setShowMore] = useState(false)

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

  // ── Native Notification System (Realtime) ──
  useEffect(() => {
    const channel = supabase
      .channel('global-notices')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' }, (payload) => {
        const notice = payload.new
        setToastNotice(notice)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notice.title || 'Broadcast Sent', { body: notice.body || '', icon: '/al-mawaid.png' })
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

  const getActiveLabel = () => {
    const active = NAV.find(n => location.pathname === n.to || (n.to !== '/admin' && location.pathname.startsWith(n.to)))
    return active ? active.label : 'Dashboard'
  }

  const filteredNav = NAV.filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase()))



  return (
    <div className="admin-root" style={{ 
      display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', 
      background: 'var(--bg-deep)',
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'var(--bg-grad)',
      }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=DM+Sans:wght@400;500;700;900&display=swap');
        .admin-main { flex: 1; display: flex; flex-direction: column; height: 100dvh; overflow: hidden; padding: 0; position: relative; z-index: 1; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .admin-header { height: 70px; display: flex; align-items: center; padding: 0 30px; background: var(--bg-card); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border-glass); z-index: 1000; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
        
        .admin-sidebar {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 280px; background: rgba(15, 12, 8, 0.95);
          backdrop-filter: blur(40px); z-index: 2000;
          border-right: 1px solid rgba(212, 175, 55, 0.2);
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateX(-100%);
          display: flex; flex-direction: column;
          padding: 100px 0 40px;
          /* The UI Curve */
          border-radius: 0 80px 80px 0;
          box-shadow: 20px 0 50px rgba(0,0,0,0.5);
        }
        .admin-sidebar.open { transform: translateX(0); }
        
        .sidebar-nav-item {
          display: flex; align-items: center; gap: 15px;
          padding: 14px 30px; text-decoration: none;
          color: var(--text-tertiary); transition: all 0.3s;
          position: relative; margin-bottom: 5px;
          border-radius: 0 30px 30px 0;
        }
        /* Lay icons with the UI curve */
        .sidebar-nav-item:nth-child(1), .sidebar-nav-item:nth-child(11) { padding-left: 20px; }
        .sidebar-nav-item:nth-child(2), .sidebar-nav-item:nth-child(10) { padding-left: 35px; }
        .sidebar-nav-item:nth-child(3), .sidebar-nav-item:nth-child(9) { padding-left: 45px; }
        .sidebar-nav-item:nth-child(4), .sidebar-nav-item:nth-child(8) { padding-left: 52px; }
        .sidebar-nav-item:nth-child(5), .sidebar-nav-item:nth-child(7) { padding-left: 56px; }
        .sidebar-nav-item:nth-child(6) { padding-left: 58px; }

        .sidebar-nav-item:hover { background: rgba(212, 175, 55, 0.1); color: var(--text-primary); padding-left: 65px; }
        .sidebar-nav-item.active { background: var(--accent-grad); color: #000; font-weight: 800; padding-left: 70px; box-shadow: 0 10px 25px rgba(212, 175, 55, 0.3); }

        .global-bottom-nav { 
          position: fixed; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); left: 16px; right: 16px;
          height: 84px;
          background: rgba(15, 12, 8, 0.85); backdrop-filter: blur(30px);
          border: 1px solid rgba(212, 175, 55, 0.25);
          border-radius: 26px;
          display: flex; align-items: center;
          padding: 0; z-index: 2000;
          box-shadow: 0 10px 40px rgba(0,0,0,0.6);
          overflow: hidden;
        }
        .bottom-nav-inner {
          display: flex; align-items: center; gap: 4px;
          padding: 0 16px;
          width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
          mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
        }
        .bottom-nav-inner::-webkit-scrollbar { display: none; }

        .nav-item {
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          text-decoration: none; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          color: var(--text-tertiary); padding: 10px 14px; border-radius: 20px;
          min-width: 68px; flex-shrink: 0;
          scroll-snap-align: center;
        }
        .nav-item.active { 
          color: var(--accent-primary); 
          background: rgba(212, 175, 55, 0.1); 
          box-shadow: inset 0 0 10px rgba(212, 175, 55, 0.05);
        }
        .nav-item:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); transform: translateY(-2px); }

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

        @media (min-width: 1025px) {
          .global-bottom-nav { display: none !important; }
          .sidebar-backdrop { display: none !important; }
          .admin-sidebar { transform: translateX(-100%); border-radius: 0; padding-top: 100px; width: 280px; transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-main { margin-left: 0; transition: margin-left 0.5s cubic-bezier(0.4, 0, 0.2, 1); min-height: 100dvh; cursor: default; }
          .admin-main.sidebar-open { margin-left: 280px; }
          .admin-header { left: 0; transition: left 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
          .admin-main.sidebar-open .admin-header { left: 280px; width: calc(100% - 280px); }
        }

        @media (max-width: 1024px) {
          .admin-sidebar { width: 280px; border-radius: 0 40px 40px 0; padding-top: 80px; z-index: 5000; }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-right-sidebar { display: none; }
          .global-bottom-nav { 
            display: flex !important; 
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: min(450px, calc(100% - 40px));
            height: 74px;
            background: rgba(15, 12, 8, 0.95);
            backdrop-filter: blur(30px);
            border: 1.5px solid var(--accent-primary);
            border-radius: 30px;
            z-index: 9000;
            padding: 0 12px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7), inset 0 1px 1px rgba(255,255,255,0.1);
            align-items: center;
            justify-content: space-around;
          }
          .global-bottom-nav button {
            flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
            background: none; border: none; cursor: pointer; color: rgba(255,248,225,0.4);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            height: 100%;
            position: relative;
          }
          .global-bottom-nav button.active { color: var(--accent-primary); }
          .global-bottom-nav button .icon-box {
            width: 44px; height: 44px; border-radius: 16px;
            display: flex; align-items: center; justify-content: center;
            transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          }
          .global-bottom-nav button.active .icon-box {
            background: var(--accent-grad);
            color: #000;
            box-shadow: 0 10px 25px rgba(212, 175, 55, 0.4);
            transform: translateY(-22px) scale(1.15) rotate(5deg);
            border-radius: 18px;
          }
          .global-bottom-nav button span {
            font-size: 9px; font-weight: 900; text-transform: uppercase;
            margin-top: 4px; opacity: 0.7; letter-spacing: 0.05em;
            transition: all 0.3s;
          }
          .global-bottom-nav button.active span {
            transform: translateY(-10px);
            opacity: 1;
          }
          .admin-main { padding-bottom: 110px !important; }
        }

        @media (max-width: 768px) {
          .admin-header { padding: 0 16px; height: 60px; }
          .admin-search { display: none !important; }
          .desktop-only { display: none !important; }
          .admin-nav-breadcrumb { display: none !important; }
          .mobile-only { display: block !important; }
        }
      `}</style>

      {/* Main Content Area */}
      <div 
        className={`admin-main ${isSidebarOpen && window.innerWidth > 1024 ? 'sidebar-open' : ''}`}
        onClick={() => { if(isSidebarOpen) setIsSidebarOpen(false) }}
      >
        {/* Top Navbar */}
        <header className="admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(!isSidebarOpen); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
            >
              <Menu size={24} />
            </button>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-grad)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 15px rgba(184, 134, 11, 0.4)',
              border: '1px solid rgba(212, 175, 55, 0.3)'
            }}>
              <img src="/al-mawaid.png" alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
            </div>
            <div className="admin-nav-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255, 248, 225, 0.6)', fontSize: 13, fontWeight: 600 }}>
              <span className="glow-text" style={{ letterSpacing: '0.05em' }}>AL-MAWAID</span>
              <ChevronRight size={14} />
              <span style={{ color: 'var(--text-primary)' }}>{getActiveLabel()}</span>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Glowing Search */}
          <div className="admin-search" style={{
            position: 'relative', width: 300,
            background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(212, 175, 55, 0.2)',
            borderRadius: 14, display: 'flex', alignItems: 'center', padding: '0 12px',
            height: 40, marginRight: 20
          }}>
            <Search size={16} color="var(--text-tertiary)" />
            <input
              readOnly
              onClick={() => setShowPalette(true)}
              placeholder="Search command (CMD+K)"
              style={{ background: 'var(--accent-bg)', border: 'none', color: 'var(--text-primary)', outline: 'none', paddingLeft: 10, fontSize: 13, flex: 1, fontWeight: 600 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 4px 4px 12px', background: 'rgba(25, 20, 10, 0.6)', borderRadius: 18, border: '1px solid rgba(212, 175, 55, 0.25)' }}>
              <div className="desktop-only" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'rgba(212, 175, 55, 0.7)', fontWeight: 600 }}>{adminName.toLowerCase()}</div>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 14, background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', fontWeight: 800, fontSize: 13, border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                {adminName.charAt(0).toUpperCase()}
              </div>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <RefreshCw size={18} />
            </button>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ff5c5c', cursor: 'pointer' }}><LogOut size={20} /></button>
          </div>
        </header>

        {/* Sidebar backdrop overlay for mobile */}
        <div className={`sidebar-backdrop ${isSidebarOpen ? 'visible' : ''}`} onClick={() => setIsSidebarOpen(false)} />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* Left Sidebar */}
          <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
            <div style={{ padding: '0 30px 40px', display: 'flex', alignItems: 'center', gap: 15 }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/al-mawaid.png" alt="" style={{ width: 28, height: 28 }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '0.05em' }}>AL-MAWAID</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Management Portal</div>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 10 }}>
              {NAV.map(({ to, label, Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth < 1025 && setIsSidebarOpen(false)}>
                  <Icon size={20} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
                </NavLink>
              ))}
            </div>
            <div style={{ padding: '20px 30px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button 
                onClick={handleLogout} 
                style={{ 
                  width: '100%', padding: '16px', borderRadius: 16, 
                  background: 'linear-gradient(135deg, rgba(255,92,92,0.1), rgba(255,92,92,0.05))', 
                  color: '#ff5c5c', border: '1.5px solid rgba(255,92,92,0.3)', 
                  cursor: 'pointer', display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', gap: 12, fontWeight: 800,
                  transition: 'all 0.3s',
                  boxShadow: '0 4px 15px rgba(255, 92, 92, 0.1)'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,92,92,0.2)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,92,92,0.1)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <LogOut size={18} strokeWidth={2.5} /> Logout
              </button>
            </div>
          </aside>

          {/* Dynamic content */}
          <main key={location.pathname} className="smooth-appear scroll-container" style={{ flex: 1, padding: 'clamp(12px, 3vw, 24px)', paddingBottom: 120, overflowY: 'auto', overflowX: 'hidden' }}>
            <Outlet context={{ role }} />
          </main>
        </div>

        {/* Global Floating Bottom Nav */}
        <nav className="global-bottom-nav">
          <div className="bottom-nav-inner" ref={el => {
            if (el) {
              const active = el.querySelector('.nav-item.active')
              if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
            }
          }}>
            {NAV.map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <div className="icon-box">
                  <Icon size={20} strokeWidth={2.5} />
                </div>
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>



        {/* ── Toast Notification Popup ── */}
        {toastNotice && (
          <div
            onClick={() => setToastNotice(null)}
            style={{
              position: 'fixed', top: 80, right: 20,
              width: 'calc(100% - 40px)', maxWidth: 350, zIndex: 10000,
              background: 'rgba(15, 12, 8, 0.95)', border: '1.5px solid rgba(212, 175, 55, 0.4)',
              borderRadius: 20, padding: 16, display: 'flex', gap: 14,
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)', cursor: 'pointer',
              animation: 'slideDown 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bell size={20} color="#000" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-gold)', marginBottom: 2 }}>{toastNotice.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{toastNotice.body}</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setToastNotice(null) }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', padding: 4, cursor: 'pointer' }}>
              <X size={16} />
            </button>
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
                autoFocus
                placeholder="Type a command or search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ background: 'var(--accent-bg)', border: 'none', color: '#fff', outline: 'none', paddingLeft: 16, fontSize: 16, flex: 1 }}
              />
            </div>
            <div style={{ padding: 12, maxHeight: 400, overflowY: 'auto' }}>
              {filteredNav.map(n => (
                <div key={n.to} onClick={() => { navigate(n.to); setShowPalette(false); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s', background: location.pathname === n.to ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
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
      `}</style>
    </div>
  )
}