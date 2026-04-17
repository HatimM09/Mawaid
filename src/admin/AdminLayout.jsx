// src/admin/AdminLayout.jsx
import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, ClipboardList, Star, FileText,
  MessageSquare, Shield, Settings, LogOut, Menu, X, ChevronRight
} from 'lucide-react'
import { supabase } from './supabaseClient'

const NAV = [
  { to: '/admin',           label: 'Dashboard',  Icon: LayoutDashboard, end: true },
  { to: '/admin/users',     label: 'Users',      Icon: Users },
  { to: '/admin/surveys',   label: 'Surveys',    Icon: ClipboardList },
  { to: '/admin/feedback',  label: 'Feedback',   Icon: Star },
  { to: '/admin/requests',  label: 'Requests',   Icon: FileText },
  { to: '/admin/queries',   label: 'Queries',    Icon: MessageSquare },
  { to: '/admin/staff',     label: 'Staff',      Icon: Shield },
  { to: '/admin/settings',  label: 'Settings',   Icon: Settings },
]

const T = {
  bg:         '#0b0f1a',
  sidebar:    '#0e1422',
  card:       '#141d2e',
  border:     'rgba(196,156,90,0.14)',
  accent:     '#c49c5a',
  accentGrad: 'linear-gradient(135deg,#d4aa6a,#a87c40)',
  accentBg:   'rgba(196,156,90,0.10)',
  text:       '#f0ead8',
  textSub:    '#9aabb8',
}

export default function AdminLayout() {
  const [sideOpen, setSideOpen] = useState(false)
  const [adminName, setAdminName] = useState('Admin')
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      // Fallback to email if the staff table doesn't exist yet or has no row
      const fallback = session.user.email || 'Admin'
      setAdminName(fallback)
      supabase.from('staff').select('name').eq('user_id', session.user.id).single()
        .then(({ data, error }) => {
          if (!error && data?.name) setAdminName(data.name)
        })
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    sessionStorage.removeItem('al_mawaid_portal')
    navigate('/', { replace: true })
    window.location.reload()
  }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: '28px 24px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: T.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🍽️</div>
        <div>
          <div style={{ color: T.accent, fontWeight: 700, fontSize: 16, letterSpacing: '0.04em', lineHeight: 1.2 }}>Al-Mawaid</div>
          <div style={{ color: T.textSub, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>Admin Portal</div>
        </div>
      </div>

      {/* Admin identity */}
      <div style={{ padding: '14px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {adminName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adminName}</div>
          <div style={{ color: T.textSub, fontSize: 10, marginTop: 1 }}>Administrator</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        <div style={{ color: T.textSub, fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', padding: '4px 12px 12px' }}>Navigation</div>
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 12px', borderRadius: 12, marginBottom: 4,
              textDecoration: 'none',
              background: isActive ? T.accentBg : 'transparent',
              border: `1px solid ${isActive ? 'rgba(196,156,90,0.28)' : 'transparent'}`,
              color: isActive ? T.accent : T.textSub,
              fontWeight: isActive ? 700 : 500, fontSize: 14, transition: 'all 0.2s',
            })}
            onClick={() => setSideOpen(false)}
          >
            {({ isActive }) => (
              <>
                <Icon size={17} strokeWidth={isActive ? 2.2 : 1.7} />
                <span style={{ flex: 1 }}>{label}</span>
                {isActive && <ChevronRight size={14} />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: '16px 12px', borderTop: `1px solid ${T.border}` }}>
        <button onClick={handleLogout}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 12, border: 'none', background: 'rgba(220,60,60,0.1)', color: '#e05555', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
          <LogOut size={17} />Logout
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.bg, fontFamily: "'DM Sans','Segoe UI',sans-serif", color: T.text }}>
      {/* Desktop Sidebar */}
      <aside className="admin-sidebar" style={{ width: 240, flexShrink: 0, background: T.sidebar, borderRight: `1px solid ${T.border}` }}>
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {sideOpen && (
        <>
          <div onClick={() => setSideOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 40 }} />
          <aside style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 260, background: T.sidebar, borderRight: `1px solid ${T.border}`, zIndex: 50, display: 'flex', flexDirection: 'column' }}>
            <button onClick={() => setSideOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', padding: 4 }}>
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Bar */}
        <header style={{ height: 56, flexShrink: 0, background: T.sidebar, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16 }}>
          <button onClick={() => setSideOpen(true)} className="admin-hamburger"
            style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', padding: 4, display: 'flex' }}>
            <Menu size={22} />
          </button>
          <span style={{ color: T.accent, fontWeight: 700, fontSize: 15, letterSpacing: '0.04em' }}>Al-Mawaid Admin</span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: T.textSub }}>{adminName}</span>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
              {adminName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', background: T.bg }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .admin-sidebar { display: flex !important; flex-direction: column; }
        .admin-hamburger { display: none !important; }
        @media (max-width: 767px) {
          .admin-sidebar { display: none !important; }
          .admin-hamburger { display: flex !important; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(196,156,90,0.2); border-radius: 10px; }
      `}</style>
    </div>
  )
}