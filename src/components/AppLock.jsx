import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY = 'almawaid_lock_enabled'
const PIN_KEY = 'almawaid_lock_pin'
const LOCK_TIMEOUT = 30000

export default function AppLock({ children }) {
  const [locked, setLocked] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [showLockScreen, setShowLockScreen] = useState(false)
  const [pinMode, setPinMode] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [setupPin, setSetupPin] = useState('')
  const [setupConfirm, setSetupConfirm] = useState('')
  const [lockEnabled, setLockEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const lastActivity = useRef(Date.now())
  const timeoutRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const check = async () => {
      try {
        if (typeof window !== 'undefined' && window.PublicKeyCredential) {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          setBiometricAvailable(available)
        }
      } catch (e) {}
    }
    check()
  }, [])

  const resetActivity = useCallback(() => {
    lastActivity.current = Date.now()
    if (locked) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (lockEnabled && !showLockScreen) {
      timeoutRef.current = setTimeout(() => {
        if ((Date.now() - lastActivity.current) >= LOCK_TIMEOUT) {
          setLocked(true)
          setShowLockScreen(true)
        }
      }, LOCK_TIMEOUT)
    }
  }, [locked, lockEnabled, showLockScreen])

  useEffect(() => {
    if (!lockEnabled) return
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'wheel']
    events.forEach(e => window.addEventListener(e, resetActivity))
    resetActivity()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetActivity))
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [lockEnabled, resetActivity])

  useEffect(() => {
    if (!lockEnabled) return
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        window.__lockOnReturn = true
      } else if (document.visibilityState === 'visible' && window.__lockOnReturn) {
        window.__lockOnReturn = false
        setLocked(true)
        setShowLockScreen(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [lockEnabled])

  useEffect(() => {
    const handleShowSetup = () => setShowSetup(true)
    const handleDisabled = () => {
      setLockEnabled(false)
      setLocked(false)
      setShowLockScreen(false)
      setShowSetup(false)
    }
    window.addEventListener('applock-show-setup', handleShowSetup)
    window.addEventListener('applock-disabled', handleDisabled)
    return () => {
      window.removeEventListener('applock-show-setup', handleShowSetup)
      window.removeEventListener('applock-disabled', handleDisabled)
    }
  }, [])

  useEffect(() => {
    if (lockEnabled) {
      setLocked(true)
      setShowLockScreen(true)
    }
    setInitialized(true)
  }, [lockEnabled])

  useEffect(() => {
    if (showLockScreen && pinMode && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [showLockScreen, pinMode])

  const authenticateBiometric = async () => {
    try {
      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: 'required',
          timeout: 30000,
        },
      })
      if (credential) {
        setLocked(false)
        setShowLockScreen(false)
        setPinMode(false)
        return true
      }
    } catch (e) {
      console.warn('[AppLock] Biometric auth failed:', e.message)
      setPinMode(true)
    }
    return false
  }

  const authenticatePin = () => {
    const storedPin = localStorage.getItem(PIN_KEY)
    if (pin === storedPin) {
      setLocked(false)
      setShowLockScreen(false)
      setPin('')
      setPinError(false)
      return true
    }
    setPinError(true)
    setPin('')
    setTimeout(() => setPinError(false), 2000)
    return false
  }

  const handlePinSubmit = (e) => {
    e.preventDefault()
    authenticatePin()
  }

  const enableLock = async () => {
    if (biometricAvailable) {
      try {
        const challenge = new Uint8Array(32)
        crypto.getRandomValues(challenge)
        await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { id: window.location.hostname, name: 'Al-Mawaid' },
            user: {
              id: new Uint8Array(16),
              name: 'user@almawaid.com',
              displayName: 'Al-Mawaid User',
            },
            pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
            },
            timeout: 30000,
          },
        })
        localStorage.setItem(STORAGE_KEY, 'true')
        setLockEnabled(true)
        setShowSetup(false)
        return
      } catch (e) {
        console.warn('[AppLock] Biometric setup failed:', e.message)
      }
    }
    setSetupPin('')
    setSetupConfirm('')
    setShowSetup('pin')
  }

  const disableLock = () => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(PIN_KEY)
    setLockEnabled(false)
    setLocked(false)
    setShowLockScreen(false)
    setShowSetup(false)
  }

  const setupPinComplete = () => {
    if (setupPin.length < 4) return
    if (setupPin !== setupConfirm) return
    localStorage.setItem(PIN_KEY, setupPin)
    localStorage.setItem(STORAGE_KEY, 'true')
    setLockEnabled(true)
    setShowSetup(false)
    setLocked(false)
    setShowLockScreen(false)
  }

  const promptBiometric = () => {
    setPinMode(false)
    authenticateBiometric()
  }

  if (!initialized) return <>{children}</>

  const lockStyles = {
    position: 'fixed', inset: 0, zIndex: 99999,
    background: '#050505',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: 32,
    fontFamily: "'DM Sans', sans-serif",
  }

  return (
    <>
      {children}
      {showLockScreen && (
        <div style={lockStyles}>
          <style>{`@keyframes lockFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } } @keyframes lockShake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }`}</style>
          <div style={{ animation: 'lockFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)', textAlign: 'center', maxWidth: 340 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37, #B8860B)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 40px rgba(212,175,55,0.3)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#FAF3E0', margin: '0 0 6px' }}>App Locked</h1>
            <p style={{ fontSize: 13, color: 'rgba(250,243,224,0.6)', margin: '0 0 32px' }}>
              {pinMode ? 'Enter your PIN to unlock' : 'Verify your identity to unlock'}
            </p>
            {pinMode ? (
              <form onSubmit={handlePinSubmit}>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: pin.length > i ? '#D4AF37' : 'rgba(212,175,55,0.2)', border: pin.length > i ? '2px solid #D4AF37' : '2px solid rgba(212,175,55,0.3)', transition: 'all 0.2s', animation: pinError ? 'lockShake 0.5s ease' : 'none' }} />
                  ))}
                </div>
                <input ref={inputRef} type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setPin(val)
                  if (val.length === 4) {
                    const storedPin = localStorage.getItem(PIN_KEY)
                    if (val === storedPin) { setLocked(false); setShowLockScreen(false); setPin('') }
                    else { setPinError(true); setPin(''); setTimeout(() => setPinError(false), 2000) }
                  }
                }} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} autoComplete="off" />
                {pinError && <p style={{ color: '#ef4444', fontSize: 12, margin: '-16px 0 16px' }}>Incorrect PIN. Try again.</p>}
              </form>
            ) : (
              <button onClick={promptBiometric} style={{ width: '100%', padding: '16px 24px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg, #D4AF37, #B8860B)', color: '#000', fontSize: 15, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 25px rgba(212,175,55,0.3)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 0 0-4 4v2h8V6a4 4 0 0 0-4-4Z" />
                  <path d="M6 10v8a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-8H6Z" />
                </svg>
                Unlock with Biometrics
              </button>
            )}
            {!pinMode && <button onClick={() => setPinMode(true)} style={{ marginTop: 20, background: 'none', border: 'none', color: 'rgba(250,243,224,0.5)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>Use PIN instead</button>}
            {pinMode && <button onClick={() => { setPinMode(false); authenticateBiometric() }} style={{ marginTop: 20, background: 'none', border: 'none', color: 'rgba(250,243,224,0.5)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>Use Biometrics instead</button>}
          </div>
        </div>
      )}
      {showSetup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ background: '#1a1308', borderRadius: 24, border: '1px solid rgba(212,175,55,0.3)', padding: 32, maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            {showSetup === 'pin' ? (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#FAF3E0', margin: '0 0 20px' }}>Set Lock PIN</h2>
                <input type="password" inputMode="numeric" maxLength={4} placeholder="Enter 4-digit PIN" value={setupPin} onChange={e => setSetupPin(e.target.value.replace(/\D/g, '').slice(0, 4))} style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.3)', color: '#FAF3E0', fontSize: 24, fontWeight: 700, textAlign: 'center', letterSpacing: '0.3em', outline: 'none', marginBottom: 12, fontFamily: 'inherit' }} />
                <input type="password" inputMode="numeric" maxLength={4} placeholder="Confirm PIN" value={setupConfirm} onChange={e => setSetupConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))} style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(212,175,55,0.3)', color: '#FAF3E0', fontSize: 24, fontWeight: 700, textAlign: 'center', letterSpacing: '0.3em', outline: 'none', marginBottom: 8, fontFamily: 'inherit' }} />
                {!!(setupPin && setupConfirm && setupPin !== setupConfirm) && <p style={{ color: '#ef4444', fontSize: 11, margin: '0 0 8px' }}>PINs don't match</p>}
                {!!(setupPin && setupPin.length < 4) && <p style={{ color: 'rgba(250,243,224,0.4)', fontSize: 11, margin: '0 0 8px' }}>PIN must be 4 digits</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setShowSetup(false)} style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(212,175,55,0.2)', background: 'transparent', color: 'rgba(250,243,224,0.6)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  <button onClick={setupPinComplete} disabled={setupPin.length < 4 || setupPin !== setupConfirm} style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #D4AF37, #B8860B)', color: '#000', fontWeight: 900, cursor: 'pointer', opacity: (setupPin.length < 4 || setupPin !== setupConfirm) ? 0.5 : 1, fontFamily: 'inherit' }}>Enable Lock</button>
                </div>
              </>
            ) : biometricAvailable ? (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#FAF3E0', margin: '0 0 8px' }}>Enable App Lock</h2>
                <p style={{ fontSize: 13, color: 'rgba(250,243,224,0.6)', margin: '0 0 24px' }}>Use your device's biometric sensor (fingerprint or FaceID) to lock the app. Your app will lock automatically after 30 seconds of inactivity or when you switch apps.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowSetup(false)} style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(212,175,55,0.2)', background: 'transparent', color: 'rgba(250,243,224,0.6)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  <button onClick={enableLock} style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #D4AF37, #B8860B)', color: '#000', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }}>Enable</button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#FAF3E0', margin: '0 0 8px' }}>Enable App Lock</h2>
                <p style={{ fontSize: 13, color: 'rgba(250,243,224,0.6)', margin: '0 0 24px' }}>Biometric authentication is not available on this device. You can set a 4-digit PIN instead to lock the app.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowSetup(false)} style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(212,175,55,0.2)', background: 'transparent', color: 'rgba(250,243,224,0.6)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  <button onClick={() => setShowSetup('pin')} style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #D4AF37, #B8860B)', color: '#000', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }}>Set PIN</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export function useAppLock() {
  return {
    isEnabled: localStorage.getItem(STORAGE_KEY) === 'true',
    enable: () => { window.dispatchEvent(new CustomEvent('applock-show-setup')) },
    disable: () => { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(PIN_KEY); window.dispatchEvent(new CustomEvent('applock-disabled')) },
  }
}
