import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabaseClient } from '../lib/supabaseClient'

export const AuthCtx = createContext()
export const useAuth = () => useContext(AuthCtx)

export const ThemeCtx = createContext()
export const useTheme = () => useContext(ThemeCtx)

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(undefined)
  const [portalRole, setPortalRole] = useState(() => localStorage.getItem('al_mawaid_portal') || null)

  const signOut = useCallback(async () => {
    try {
      await supabaseClient.auth.signOut()
    } catch (err) {
      console.warn('SignOut server error, clearing local session anyway:', err.message)
    } finally {
      localStorage.removeItem('al_mawaid_portal')
      localStorage.removeItem('al_mawaid_restricted')
      localStorage.removeItem('al-mawaid-auth-token')
      setSession(null)
      setPortalRole(null)
    }
  }, [])

  const handleRoleLogin = useCallback((role, sess) => {
    localStorage.setItem('al_mawaid_portal', role)
    setPortalRole(role)
    if (sess) setSession(sess)
  }, [])

  useEffect(() => {
    supabaseClient.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error("Auth Session Error:", error.message)
          signOut()
        } else {
          setSession(session)
        }
      })
      .catch(err => {
        console.error("Caught Auth Error:", err)
        signOut()
      })

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, sess) => {
      setSession(sess)
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED' || !sess) {
        setPortalRole(null)
        localStorage.removeItem('al_mawaid_mock_user')
        localStorage.removeItem('al_mawaid_portal')
        localStorage.removeItem('al_mawaid_restricted')
        localStorage.removeItem('al-mawaid-auth-token')
      }
    })
    return () => subscription.unsubscribe()
  }, [signOut])

  const authValue = { 
    user: session?.user, 
    session, 
    signOut,
    portalRole,
    handleRoleLogin
  }

  return (
    <AuthCtx.Provider value={authValue}>
      {children}
    </AuthCtx.Provider>
  )
}
