// src/components/UpdateBanner.jsx
// Shows a "New update available" banner when the service worker detects a new version.
// On tap, activates the new SW and reloads to apply the latest PWA changes.

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

export default function UpdateBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onUpdateReady = () => setVisible(true)
    window.addEventListener('sw-update-ready', onUpdateReady)
    return () => window.removeEventListener('sw-update-ready', onUpdateReady)
  }, [])

  const handleRefresh = () => {
    const waitingSW = window.__swWaiting
    if (waitingSW) {
      waitingSW.skipWaiting()
    }
  }

  if (!visible) return null

  return (
    <>
      <style>{`
        @keyframes upd-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <div
        onClick={handleRefresh}
        style={{
          position: 'fixed',
          bottom: 'calc(90px + env(safe-area-inset-bottom, 16px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          width: 'calc(100% - 32px)',
          maxWidth: 440,
          padding: '14px 20px',
          borderRadius: 20,
          background: 'linear-gradient(135deg, #D4AF37 0%, #C8902A 35%, #A0760A 65%, #8B6914 100%)',
          color: '#1a1208',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 12px 40px rgba(212, 175, 55, 0.35), 0 4px 12px rgba(0,0,0,0.3)',
          animation: 'upd-slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          fontFamily: "'Outfit', 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <RefreshCw size={20} color="#1a1208" />
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.02em' }}>
            New update available
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.75, marginTop: 2 }}>
            Tap to refresh and apply the latest changes
          </div>
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 16,
          }}
        >
          ↻
        </div>
      </div>
    </>
  )
}
