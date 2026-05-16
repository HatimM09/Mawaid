import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'

export const AuthCtx = createContext()
export const useAuth = () => useContext(AuthCtx)

export const ThemeCtx = createContext()
export const useTheme = () => useContext(ThemeCtx)

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(undefined)
  const [mockUser, setMockUser] = useState(() => {
    const saved = localStorage.getItem('al_mawaid_mock_user')
    return saved ? JSON.parse(saved) : null
  })
  const [portalRole, setPortalRole] = useState(() => localStorage.getItem('al_mawaid_portal') || null)

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('al_mawaid_portal')
    localStorage.removeItem('al_mawaid_mock_user')
    localStorage.removeItem('al_mawaid_restricted')
    setSession(null)
    setMockUser(null)
    setPortalRole(null)
  }, [])

  const handleRoleLogin = useCallback((role, sess) => {
    localStorage.setItem('al_mawaid_portal', role)
    if (role === 'inventory_manager' && sess?.user) {
      localStorage.setItem('al_mawaid_mock_user', JSON.stringify(sess.user))
      setMockUser(sess.user)
    }
    setPortalRole(role)
    if (sess) setSession(sess)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess)
      if (!sess) {
        setMockUser(null)
        setPortalRole(null)
        localStorage.removeItem('al_mawaid_mock_user')
        localStorage.removeItem('al_mawaid_portal')
        localStorage.removeItem('al_mawaid_restricted')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const authValue = { 
    user: session?.user || mockUser, 
    session, 
    signOut,
    mockUser,
    portalRole,
    handleRoleLogin
  }

  return (
    <AuthCtx.Provider value={authValue}>
      {children}
    </AuthCtx.Provider>
  )
}
