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
  const navigate = useNavigate()

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
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
        .admin-main { flex: 1; display: flex; flex-direction: column; height: 100dvh; overflow: hidden; padding: 0; position: relative; z-index: 1; }
        .admin-header { height: 70px; display: flex; align-items: center; padding: 0 30px; background: var(--bg-card); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border-glass); z-index: 100; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
        .global-bottom-nav { 
          position: fixed; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); left: 16px; right: 16px;
          height: 80px;
          background: rgba(15, 12, 8, 0.9); backdrop-filter: blur(25px);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 24px;
          display: flex; align-items: center;
          padding: 0 8px; z-index: 2000;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          overflow: visible;
        }
        .bottom-nav-inner {
          display: flex; align-items: center; gap: 4px;
          padding: 0 16px; min-width: max-content;
        }
        .nav-item {
          display: flex; flexDirection: column; align-items: center; gap: 4px;
          text-decoration: none; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: var(--text-tertiary); padding: 8px 12px; border-radius: 16px;
        }
        .nav-item.active { color: var(--accent-primary); background: var(--accent-bg); text-shadow: 0 0 10px var(--accent-bg); }
        .nav-item:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }

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
          .global-bottom-nav {
            bottom: 24px; left: 50%; transform: translateX(-50%);
            width: auto; max-width: 90%; height: 88px;
            border-radius: 26px; border: 1px solid rgba(212, 175, 55, 0.3);
            background: rgba(10, 13, 20, 0.85);
            padding: 0 12px; margin: 0 auto;
            overflow: visible;
          }
          .bottom-nav-inner { gap: 12px; }
          .nav-item {
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            padding: 10px 18px;
          }
          .nav-item:hover {
            transform: translateY(-12px) scale(1.15);
            background: rgba(255, 255, 255, 0.08);
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          }
        }

        @media (max-width: 1024px) {
          .admin-right-sidebar { display: none; }
        }
        @media (max-width: 768px) {
          .admin-header { padding: 0 16px; height: 60px; }
          .admin-search { display: none !important; }
          .desktop-only { display: none !important; }
          .admin-nav-breadcrumb { display: none !important; }
          .admin-main { padding-bottom: 80px !important; }
          .mobile-only { display: block !important; }
        }
      `}</style>

      {/* Main Content Area */}
      <div className="admin-main">
        {/* Top Navbar */}
        <header className="admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* Sidebar removed as per request */}

          {/* Dynamic content */}
          <main key={location.pathname} className="smooth-appear scroll-container" style={{ flex: 1, padding: '24px', paddingBottom: 120, overflowY: 'auto', overflowX: 'hidden' }}>
            <Outlet context={{ role }} />
          </main>
        </div>

        {/* Global Floating Bottom Nav */}
        <nav className="global-bottom-nav">
          <div className="bottom-nav-inner" style={{ width: '100%', justifyContent: 'space-around', gap: 0, padding: 0 }}>
            {/* Show first 5 items for better functionality */}
            {NAV.slice(0, 5).map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ flex: 1, minWidth: 0, padding: '8px 4px' }}>
                <Icon size={20} />
                <span style={{ fontSize: 8, fontWeight: 700 }}>{label}</span>
              </NavLink>
            ))}
            
            {/* More Button */}
            <button 
              onClick={() => setShowMore(!showMore)}
              className={`nav-item ${showMore ? 'active' : ''}`}
              style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px' }}
            >
              <Menu size={20} />
              <span style={{ fontSize: 8, fontWeight: 700 }}>More</span>
            </button>
          </div>

          {/* More Menu Popup */}
          {showMore && (
            <>
              <div onClick={() => setShowMore(false)} style={{ position: 'fixed', inset: 0, zIndex: 2099 }} />
              <div className="more-menu-container">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {NAV.slice(5).map(({ to, label, Icon, end }) => (
                    <NavLink 
                      key={to} to={to} end={end} 
                      onClick={() => setShowMore(false)}
                      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                      style={{ padding: '12px 8px' }}
                    >
                      <Icon size={18} />
                      <span style={{ fontSize: 8, fontWeight: 700 }}>{label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            </>
          )}
        </nav>
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