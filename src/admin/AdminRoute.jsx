import React, { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabaseClient } from '../lib/supabaseClient'

export default function AdminRoute() {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const check = async () => {
      const { data: { session }, error } = await supabaseClient.auth.getSession()
      if (error || !session) return setStatus('denied')

      let role = ''
      try {
        const { data: staffRow } = await supabaseClient
          .from('staff').select('role').eq('user_id', session.user.id).single()
        role = staffRow?.role || ''
      } catch (err) {
        console.warn('[AdminRoute] staff table check failed:', err.message)
        return setStatus('denied')
      }

      if (['admin', 'inventory_manager', 'khidmat_guzar', 'supervisor'].includes(role)) {
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