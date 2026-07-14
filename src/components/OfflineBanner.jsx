// src/components/OfflineBanner.jsx
// Premium offline/online detection with smooth animations
import { useState, useEffect, useCallback, useRef } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine)
  const [showReconnected, setShowReconnected] = useState(false)
  const wasOffline = useRef(false)

  const handleOnline = useCallback(() => {
    setOffline(false)
    if (wasOffline.current) {
      setShowReconnected(true)
      setTimeout(() => setShowReconnected(false), 4000)
    }
    wasOffline.current = false
  }, [])

  const handleOffline = useCallback(() => {
    setOffline(true)
    wasOffline.current = true
    setShowReconnected(false)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
        transform: offline ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #1a0a0a, #2d1515)',
          borderBottom: '1.5px solid rgba(239,68,68,0.4)',
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          boxShadow: '0 8px 30px rgba(239,68,68,0.15)',
          backdropFilter: 'blur(20px)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', fontFamily: "'DM Sans',sans-serif" }}>You're offline</div>
            <div style={{ fontSize: 11, color: 'rgba(239,68,68,0.7)', fontFamily: "'DM Sans',sans-serif", marginTop: 1 }}>Some features may be unavailable. Changes will sync when you're back online.</div>
          </div>
        </div>
      </div>
      <div style={{
        position: 'fixed', bottom: 100, left: '50%', zIndex: 99999,
        opacity: showReconnected ? 1 : 0,
        transition: showReconnected
          ? 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
          : 'opacity 0.3s ease',
        pointerEvents: showReconnected ? 'auto' : 'none',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #065f46, #059669)',
          border: '1px solid rgba(16,185,129,0.4)',
          borderRadius: 16, padding: '14px 24px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 10px 30px rgba(16,185,129,0.25)',
          backdropFilter: 'blur(20px)', fontFamily: "'DM Sans',sans-serif",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Back online</span>
        </div>
      </div>
    </>
  )
}
