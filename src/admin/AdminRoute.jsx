// src/admin/AdminRoute.jsx
// Guards /admin/* — user must be signed in via Supabase AND have role='admin' in staff table.
// No separate password needed — login happens on the main unified login page.
import React, { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from './supabaseClient'

export default function AdminRoute() {
  const [status, setStatus] = useState('loading') // 'loading' | 'allowed' | 'denied'

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return setStatus('denied')

      // Check role in staff table
      const { data: staffRow } = await supabase
        .from('staff')
        .select('role')
        .eq('user_id', session.user.id)
        .single()

      const role = staffRow?.role || ''

      // Also accept the sessionStorage flag set by the login page
      const portalRole = sessionStorage.getItem('al_mawaid_portal') || ''

      if (role === 'admin' || portalRole === 'admin') {
        setStatus('allowed')
      } else {
        setStatus('denied')
      }
    }
    check()
  }, [])

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', background: '#0b0f1a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 36, height: 36, border: '2.5px solid rgba(196,156,90,0.2)', borderTop: '2.5px solid #c49c5a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (status === 'denied') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}