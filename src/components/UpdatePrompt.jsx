import { useState, useEffect } from 'react'

const APP_VERSION = "1.5.0"

export default function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true)
                setWaitingWorker(newWorker)
              }
            })
          }
        })
      })

      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })
    }
  }, [])

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    }
  }

  if (!updateAvailable) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 99999, maxWidth: 420, width: 'calc(100% - 32px)',
    }}>
      <div style={{
        background: '#1a1308', borderRadius: 20,
        border: '1px solid rgba(212,175,55,0.3)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>🔄</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#FAF3E0' }}>
              Update Available v{APP_VERSION}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(250,243,224,0.6)', marginTop: 2 }}>
              A new version of Al-Mawaid is ready. Refresh to apply the update.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleUpdate}
            style={{
              flex: 1, padding: '12px 20px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
              color: '#000', fontSize: 13, fontWeight: 900, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Refresh Now
          </button>
          <button
            onClick={() => setUpdateAvailable(false)}
            style={{
              padding: '12px 20px', borderRadius: 12, border: '1px solid rgba(212,175,55,0.2)',
              background: 'transparent', color: 'rgba(250,243,224,0.6)', fontSize: 13,
              fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
