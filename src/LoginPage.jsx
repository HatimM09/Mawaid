import React, { useState, useEffect } from 'react'
import { 
  Mail, Lock, Eye, EyeOff, AlertCircle, ChevronDown, ChevronUp,
  ClipboardList, ChevronLeft, ChevronRight, Phone, MapPin,
  Users, Wallet, Bell, LifeBuoy, Info, MessageCircle, Upload, Utensils,
  Sun, Moon, Medal, Package, Shield, Zap, RefreshCw
} from 'lucide-react'
import { supabase } from './admin/supabaseClient'

export default function LoginPage({ onRoleLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('al_mawaid_remembered_email')
    if (saved) setEmail(saved)
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) throw authErr

      if (rememberMe) localStorage.setItem('al_mawaid_remembered_email', email)
      else localStorage.removeItem('al_mawaid_remembered_email')

      // Determine Role
      const { data: staff } = await supabase.from('staff').select('role').eq('user_id', data.user.id).maybeSingle()
      const role = staff?.role || 'member'
      onRoleLogin(role, data.session)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#060d1a', padding: 20, fontFamily: "'Inter', sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Amiri:wght@400;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .login-card { animation: fadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
      `}</style>

      <div className="login-card" style={{
        width: '100%', maxWidth: 420, background: 'rgba(10, 20, 40, 0.8)',
        backdropFilter: 'blur(30px) saturate(1.5)', borderRadius: 32,
        border: '1px solid rgba(212, 175, 55, 0.2)', padding: '48px 40px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(212, 175, 55, 0.05)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
           <p style={{ fontFamily: "'Amiri', serif", fontSize: 18, color: '#D4AF37', margin: '0 0 8px', letterSpacing: '0.05em' }}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
           <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: '0.15em', color: '#D4AF37' }}>AL-MAWAID</h1>
           <div style={{ fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginTop: 6, fontWeight: 700 }}>Exclusive Access</div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(212, 175, 55, 0.5)' }} />
              <input
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={{
                  width: '100%', padding: '16px 16px 16px 48px', borderRadius: 16,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212, 175, 55, 0.15)',
                  color: '#fff', fontSize: 15, outline: 'none', transition: 'all 0.3s'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(212, 175, 55, 0.5)' }} />
              <input
                type={showPass ? 'text' : 'password'} required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '16px 48px 16px 48px', borderRadius: 16,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212, 175, 55, 0.15)',
                  color: '#fff', fontSize: 15, outline: 'none', transition: 'all 0.3s'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'rgba(212, 175, 55, 0.5)',
                  cursor: 'pointer', fontSize: 10, fontWeight: 800
                }}>
                {showPass ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ accentColor: '#D4AF37' }} />
              Remember Me
            </label>
            <span style={{ fontSize: 13, color: '#D4AF37', fontWeight: 600, cursor: 'pointer' }}>Forgot?</span>
          </div>

          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: 12, background: 'rgba(224, 85, 85, 0.1)',
              border: '1px solid rgba(224, 85, 85, 0.3)', color: '#ff5c5c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10
            }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '18px', borderRadius: 18, border: 'none',
              background: 'linear-gradient(135deg, #F9D976 0%, #D4AF37 50%, #A68446 100%)',
              color: '#000', fontWeight: 900, fontSize: 16, cursor: 'pointer',
              marginTop: 10, boxShadow: '0 15px 35px rgba(212, 175, 55, 0.3)',
              transition: 'all 0.3s'
            }}>
            {loading ? 'AUTHENTICATING...' : 'SIGN IN'}
          </button>
        </form>

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Secured by Al-Mawaid Systems</div>
        </div>
      </div>
    </div>
  )
}
