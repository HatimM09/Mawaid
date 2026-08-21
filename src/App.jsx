// src/App.jsx — Root component: auth gating + portal routing.
// Member app lives in src/member/ (ThaliUserApp + pages + shared modules).

import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { supabase } from './lib/firebaseClient'
import { AuthCtx, ThemeCtx } from './admin/context'
import LoginPage from './LoginPage'
import PushManager from './lib/PushManager'
import UpdatePrompt from './components/UpdatePrompt'
import { THEMES } from './member/theme'
import ThaliUserApp from './member/ThaliUserApp'
const KhidmatPortal = React.lazy(() => import('./admin/KhidmatPortal'))
const InventoryManagerPortal = React.lazy(() => import('./admin/InventoryManagerPortal'))

export default function App() {
  const [session, setSession] = useState(undefined)
  const [mockUser, setMockUser] = useState(() => {
    const remember = localStorage.getItem('almawaid_remember_me') !== 'false'
    if (!remember) return null
    const saved = localStorage.getItem('al_mawaid_mock_user')
    return saved ? JSON.parse(saved) : null
  })
  const [portalRole, setPortalRole] = useState(() => {
    const remember = localStorage.getItem('almawaid_remember_me') !== 'false'
    if (!remember) return null
    return localStorage.getItem('al_mawaid_portal') || null
  })

  const navigate = useNavigate()

  const signOut = useCallback(async () => {
    setMockUser(null)
    setPortalRole(null)
    localStorage.removeItem('al_mawaid_portal')
    localStorage.removeItem('al_mawaid_mock_user')
    localStorage.removeItem('al-mawaid-auth-token')
    await supabase.auth.signOut()
  }, [])

  const handleRoleLogin = useCallback((role, sess) => {
    const remember = localStorage.getItem('almawaid_remember_me') !== 'false'
    if (remember) {
      localStorage.setItem('al_mawaid_portal', role)
      if (sess?.user) {
        localStorage.setItem('al_mawaid_mock_user', JSON.stringify(sess.user))
      }
    }
    setMockUser(sess?.user || null)
    setPortalRole(role)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error && error.message?.includes('Refresh Token Not Found')) {
        console.warn('[Auth] Refresh token missing, signing out...');
        signOut();
      } else {
        setSession(session)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess)
      if (!sess) {
        setPortalRole(null);
        setMockUser(null);
        localStorage.removeItem('al_mawaid_portal')
        localStorage.removeItem('al_mawaid_mock_user')
        localStorage.removeItem('al-mawaid-auth-token')
      }
    })
    return () => subscription.unsubscribe()
  }, [signOut])

  useEffect(() => {
    if (portalRole === 'admin' && !window.location.pathname.startsWith('/admin')) {
      navigate('/admin', { replace: true })
    }
  }, [portalRole, navigate])

  if (session === undefined && !mockUser) {
    return (
      <div style={{ minHeight: '100vh', background: '#0c0c14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spin" style={{ width: 36, height: 36, border: '2.5px solid rgba(139,92,246,0.2)', borderTop: '2.5px solid #a78bfa', borderRadius: '50%' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}body{margin:0}`}</style>
      </div>
    )
  }

  if (!session && !mockUser) return <LoginPage onRoleLogin={handleRoleLogin} />

  const authValue = { user: session?.user || mockUser, signOut }

  if (portalRole === 'admin') return null

  if (['khidmat_guzar', 'supervisor', 'khidmat'].includes(portalRole)) {
    return (
      <AuthCtx.Provider value={authValue}>
        <ThemeCtx.Provider value={THEMES.royal}>
          <PushManager />
          <UpdatePrompt />
          <Toaster position="top-center" />
          <React.Suspense fallback={<div style={{ minHeight: '100vh', background: '#0c0c14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>Loading…</div>}>
            <KhidmatPortal signOut={signOut} user={authValue.user} />
          </React.Suspense>
        </ThemeCtx.Provider>
      </AuthCtx.Provider>
    )
  }

  if (portalRole === 'inventory_manager') {
    return (
      <AuthCtx.Provider value={authValue}>
        <ThemeCtx.Provider value={THEMES.royal}>
          <PushManager />
          <UpdatePrompt />
          <Toaster position="top-center" />
          <React.Suspense fallback={<div style={{ minHeight: '100vh', background: '#0c0c14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>Loading…</div>}>
            <InventoryManagerPortal signOut={signOut} user={authValue.user} />
          </React.Suspense>
        </ThemeCtx.Provider>
      </AuthCtx.Provider>
    )
  }

  return (
    <AuthCtx.Provider value={authValue}>
      <PushManager />
      <UpdatePrompt />
      <Toaster position="top-center" />
      <ThaliUserApp />
    </AuthCtx.Provider>
  )
}
