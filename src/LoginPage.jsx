// src/LoginPage.jsx
// ══════════════════════════════════════════════════════════════
// AL-MAWAID LOGIN PAGE — Drop-in replacement for LoginPage
// Matches the screenshot exactly:
//   • Dense golden wheat field background image (/wheat_bg.png)
//   • Frosted glass card with warm sepia tint
//   • Sculpted gold filigree corner mounts
//   • Gold sparkle ✦ in bottom-right
//   • Role tabs: Khidmat Guzar | Al-Mawaid Team | Inventory | Admin
//   • Selected tab pill is gold, unselected is dark navy
//   • Role subtitle changes dynamically
//   • Email + Password fields with amber icons
//   • Solid gold SIGN IN button
// ══════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, User, Medal, Package, Shield } from 'lucide-react'
import { supabase } from './admin/supabaseClient'
import { SoundUI } from './admin/ui'

const LOGIN_ROLES = [
  { id: 'member',             label: 'Khidmat\nGuzar',     icon: <User size={20} />,    short: 'Khidmat Guzar' },
  { id: 'khidmat',            label: 'Al-Mawaid\nTeam',    icon: <Medal size={20} />,   short: 'Al-Mawaid Team' },
  { id: 'inventory_manager',  label: 'Inventory',          icon: <Package size={20} />, short: 'Inventory Manager' },
  { id: 'admin',              label: 'Admin',              icon: <Shield size={20} />,  short: 'Admin' },
]

export default function LoginPage({ onRoleLogin }) {
  const [role, setRole]         = useState('member')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [secretKey, setSecretKey] = useState('')

  const activeRole = LOGIN_ROLES.find(r => r.id === role)

  const handleAuth = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (role === 'admin' && secretKey === 'SURVEY786') {
        localStorage.setItem('al_mawaid_restricted', 'true')
        onRoleLogin('admin', { user: { email: 'survey-admin@mawaid.com', id: 'survey_admin', user_metadata: { name: 'Survey Admin' } } })
        setLoading(false); return
      }

      if (role === 'inventory_manager') {
        const { data: invStaff, error: invErr } = await supabase
          .from('staff').select('*').ilike('email', email).eq('role', 'inventory_manager').maybeSingle()
        if (invErr || !invStaff) throw new Error('Unauthorized: Email not registered as Inventory Manager.')
        onRoleLogin('inventory_manager', { user: { email, id: invStaff.user_id || `inv_${invStaff.id}`, ...invStaff } })
        setLoading(false); return
      }

      const { data: { session }, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) throw signInErr

      SoundUI.success()
      if (role === 'member') { onRoleLogin('member', session); setLoading(false); return }

      let { data: staffRow, error: staffErr } = await supabase
        .from('staff').select('*').eq('user_id', session.user.id).maybeSingle()
      if (!staffRow && !staffErr) {
        const { data: emailMatch } = await supabase.from('staff').select('*').eq('email', session.user.email).maybeSingle()
        if (emailMatch && !emailMatch.user_id) {
          const { data: updated } = await supabase.from('staff').update({ user_id: session.user.id }).eq('id', emailMatch.id).select().single()
          staffRow = updated
        } else if (emailMatch) { staffRow = emailMatch }
      }
      if (staffErr && staffErr.code !== 'PGRST116') { await supabase.auth.signOut(); throw new Error(staffErr.message) }
      const dbRole = staffRow?.role || ''
      const isRestrictedAdmin = role === 'admin' && secretKey === 'SURVEY786'
      const isFullAdmin = role === 'admin' && (secretKey === 'almawaid' || dbRole === 'admin')
      
      if (role === 'admin' && !isFullAdmin && !isRestrictedAdmin) { 
        await supabase.auth.signOut(); 
        throw new Error('You do not have admin privileges. If you are the system administrator, please enter the correct Secret Key.') 
      }
      if (role === 'khidmat' && !['khidmat_guzar','supervisor','khidmat','admin'].includes(dbRole)) {
        await supabase.auth.signOut(); throw new Error('You are not registered as part of the Al Mawaid Team.')
      }

      // Set restriction state based on login key
      localStorage.setItem('al_mawaid_restricted', isRestrictedAdmin ? 'true' : 'false')

      onRoleLogin((isFullAdmin || isRestrictedAdmin) ? 'admin' : dbRole, session)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; overflow: hidden; }

        .lp-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: #1a0f00;
          font-family: 'Outfit', sans-serif;
        }

        /* ── Wheat field background ── */
        .lp-bg {
          position: absolute; inset: 0;
          background-image: url('/wheat_bg.png');
          background-size: cover;
          background-position: center;
          filter: brightness(0.78) contrast(1.08) saturate(1.1);
          z-index: 0;
        }

        /* ── Vignette overlay ── */
        .lp-vignette {
          position: absolute; inset: 0; z-index: 1;
          background: radial-gradient(ellipse at 50% 50%,
            rgba(30,18,4,0.10) 0%,
            rgba(12,7,2,0.55) 100%);
        }

        /* ── Sparkle ── */
        .lp-sparkle {
          position: absolute;
          bottom: clamp(20px, 5vh, 48px);
          right: clamp(20px, 5vw, 60px);
          z-index: 10;
          color: #FFD84D;
          font-size: clamp(22px, 4vw, 36px);
          line-height: 1;
          filter: drop-shadow(0 0 10px #FFD84D88);
          animation: sparkle-pulse 3s ease-in-out infinite;
          user-select: none;
        }
        @keyframes sparkle-pulse {
          0%,100% { opacity: 0.75; transform: scale(1) rotate(0deg); }
          50%      { opacity: 1;    transform: scale(1.15) rotate(10deg); }
        }

        /* ── Glass card ── */
        .lp-card {
          position: relative;
          z-index: 5;
          width: min(420px, 94vw);
          padding: clamp(28px,5vw,44px) clamp(22px,5vw,36px);
          border-radius: 32px;
          background: rgba(255, 248, 230, 0.38);
          backdrop-filter: blur(28px) saturate(1.4) brightness(1.05);
          -webkit-backdrop-filter: blur(28px) saturate(1.4) brightness(1.05);
          border: 1.5px solid rgba(255, 240, 180, 0.65);
          box-shadow:
            0 0 0 1px rgba(200,140,40,0.18),
            0 32px 80px rgba(0,0,0,0.32),
            inset 0 1px 2px rgba(255,255,255,0.75),
            inset 0 -1px 2px rgba(180,120,20,0.15);
          display: flex;
          flex-direction: column;
          gap: 0;
          animation: card-in 0.6s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }

        /* ── Filigree corners ── */
        .lp-corner {
          position: absolute;
          width: 44px; height: 44px;
          pointer-events: none;
          z-index: 6;
        }
        .lp-corner svg { width: 100%; height: 100%; }
        .lp-corner--tl { top: -3px;  left: -3px;  transform: rotate(0deg); }
        .lp-corner--tr { top: -3px;  right: -3px; transform: rotate(90deg); }
        .lp-corner--bl { bottom: -3px; left: -3px;  transform: rotate(270deg); }
        .lp-corner--br { bottom: -3px; right: -3px; transform: rotate(180deg); }

        /* ── Logo & title ── */
        .lp-brand { text-align: center; margin-bottom: 20px; }
        .lp-logo  { width: 62px; height: 62px; object-fit: contain; margin-bottom: 10px; filter: drop-shadow(0 6px 18px rgba(0,0,0,0.35)); }
        .lp-title {
          font-family: 'Cinzel', serif;
          font-weight: 900;
          font-size: clamp(26px, 7vw, 38px);
          letter-spacing: 0.14em;
          background: linear-gradient(180deg, #C8902A 0%, #7A4E10 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1;
          filter: drop-shadow(0 1px 2px rgba(255,255,255,0.18));
        }

        /* ── Role tabs ── */
        .lp-tabs {
          display: flex;
          gap: 6px;
          background: rgba(15, 10, 4, 0.55);
          border-radius: 18px;
          padding: 6px;
          border: 1px solid rgba(200,150,40,0.25);
          margin-bottom: 18px;
        }
        .lp-tab {
          flex: 1;
          border: none;
          border-radius: 13px;
          padding: 10px 4px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          font-family: 'Outfit', sans-serif;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.06em;
          line-height: 1.25;
          text-align: center;
          white-space: pre-line;
          transition: all 0.28s cubic-bezier(0.4,0,0.2,1);
        }
        .lp-tab--active {
          background: linear-gradient(135deg, #FFD84D 0%, #E0A030 50%, #B87B14 100%);
          color: #2a1a04;
          box-shadow: 0 6px 20px rgba(220,160,30,0.45);
          transform: scale(1.04);
        }
        .lp-tab--inactive {
          background: rgba(15, 10, 4, 0.5);
          color: rgba(200,150,60,0.55);
        }
        .lp-tab--inactive:hover { color: rgba(220,170,70,0.85); background: rgba(30,20,8,0.6); }

        /* ── Role subtitle ── */
        .lp-subtitle {
          text-align: center;
          font-size: 11.5px;
          font-weight: 600;
          color: rgba(80,50,15,0.75);
          letter-spacing: 0.04em;
          margin-bottom: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }
        .lp-subtitle svg { opacity: 0.6; }

        /* ── Input group ── */
        .lp-form { display: flex; flex-direction: column; gap: 14px; }
        .lp-label {
          display: block;
          font-size: 9.5px;
          font-weight: 900;
          letter-spacing: 0.2em;
          color: rgba(90,58,15,0.7);
          text-transform: uppercase;
          margin-bottom: 7px;
        }
        .lp-input-wrap { position: relative; }
        .lp-input-wrap svg {
          position: absolute;
          left: 16px;
          top: 50%; transform: translateY(-50%);
          color: rgba(160,105,30,0.65);
          pointer-events: none;
          width: 17px; height: 17px;
        }
        .lp-input {
          width: 100%;
          padding: 15px 16px 15px 46px;
          border-radius: 15px;
          border: 1px solid rgba(220,180,80,0.28);
          background: rgba(120,75,15,0.07);
          color: #3a2508;
          font-size: 14.5px;
          font-family: 'Outfit', sans-serif;
          font-weight: 500;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-shadow: inset 0 2px 5px rgba(0,0,0,0.04);
        }
        .lp-input:focus {
          border-color: rgba(200,140,40,0.55);
          box-shadow: 0 0 0 3px rgba(200,140,40,0.12), inset 0 2px 5px rgba(0,0,0,0.04);
        }
        .lp-input::placeholder { color: rgba(90,58,15,0.32); }
        .lp-eye {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: rgba(140,95,25,0.55); padding: 4px;
          display: flex; align-items: center;
          font-size: 10px; font-weight: 800; letter-spacing: 0.1em; font-family: 'Outfit', sans-serif;
        }
        .lp-eye:hover { color: rgba(180,120,30,0.9); }

        /* ── Error ── */
        .lp-error {
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          color: #c0392b;
          padding: 8px 12px;
          border-radius: 10px;
          background: rgba(192,57,43,0.09);
          border: 1px solid rgba(192,57,43,0.22);
        }

        /* ── Submit button ── */
        .lp-btn {
          width: 100%;
          padding: 18px;
          border-radius: 18px;
          border: none;
          margin-top: 6px;
          background: linear-gradient(135deg, #FFD84D 0%, #E0A030 45%, #B87B14 100%);
          color: #2a1a04;
          font-family: 'Cinzel', serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow:
            0 12px 32px rgba(184,123,20,0.35),
            inset 0 1px 1px rgba(255,255,255,0.45);
          transition: filter 0.2s, transform 0.15s, box-shadow 0.2s;
        }
        .lp-btn:hover:not(:disabled) {
          filter: brightness(1.07);
          transform: translateY(-1px);
          box-shadow: 0 16px 40px rgba(184,123,20,0.45), inset 0 1px 1px rgba(255,255,255,0.45);
        }
        .lp-btn:active:not(:disabled) { transform: translateY(0); filter: brightness(0.97); }
        .lp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>

      <div className="lp-root">
        {/* Background */}
        <div className="lp-bg" />
        <div className="lp-vignette" />

        {/* Sparkle */}
        <div className="lp-sparkle">✦</div>

        {/* Card */}
        <div className="lp-card">
          {/* Filigree corners */}
          {['tl','tr','bl','br'].map(pos => (
            <div key={pos} className={`lp-corner lp-corner--${pos}`}>
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id={`cg-${pos}`} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FFF8E0"/>
                    <stop offset="0.45" stopColor="#E0A030"/>
                    <stop offset="1" stopColor="#9A6010"/>
                  </linearGradient>
                </defs>
                {/* L-bracket */}
                <path
                  d="M5 5 L5 38 M5 5 L38 5"
                  stroke={`url(#cg-${pos})`} strokeWidth="5.5"
                  strokeLinecap="round" strokeLinejoin="round" fill="none"
                />
                {/* Small diamond accent */}
                <rect x="1" y="1" width="8" height="8" rx="2"
                  fill={`url(#cg-${pos})`} opacity="0.85"
                  transform="rotate(45 5 5)"
                />
              </svg>
            </div>
          ))}

          {/* Brand */}
          <div className="lp-brand">
            <img src="/al-mawaid.png" alt="Al-Mawaid" className="lp-logo" />
            <div className="lp-title">AL-MAWAID</div>
          </div>

          {/* Role tabs */}
          <div className="lp-tabs">
            {LOGIN_ROLES.map(r => (
              <button
                key={r.id}
                className={`lp-tab ${role === r.id ? 'lp-tab--active' : 'lp-tab--inactive'}`}
                onClick={() => { SoundUI.click(); setRole(r.id); setError('') }}
                type="button"
              >
                {r.icon}
                {r.label}
              </button>
            ))}
          </div>

          {/* Subtitle */}
          <div className="lp-subtitle">
            <User size={13} />
            {activeRole?.short} — member portal
          </div>

          {/* Form */}
          <form className="lp-form" onSubmit={handleAuth}>
            <div>
              <label className="lp-label">Email</label>
              <div className="lp-input-wrap">
                <Mail />
                <input
                  type="email"
                  className="lp-input"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required={!secretKey || role !== 'admin'}
                  autoComplete="email"
                />
              </div>
            </div>

            {role !== 'inventory_manager' && (
              <div>
                <label className="lp-label">Password</label>
                <div className="lp-input-wrap">
                  <Lock />
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="lp-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required={!secretKey || role !== 'admin'}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="lp-eye"
                    onClick={() => setShowPass(s => !s)}
                    tabIndex={-1}
                  >
                    {showPass ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>
            )}
            {role === 'admin' && (
              <div>
                <label className="lp-label">Secret Key (Optional)</label>
                <div className="lp-input-wrap">
                  <Shield size={17} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(160,105,30,0.65)', pointerEvents: 'none' }} />
                  <input
                    type="password"
                    className="lp-input"
                    placeholder="Enter Secret Key"
                    value={secretKey}
                    onChange={e => setSecretKey(e.target.value)}
                  />
                </div>
              </div>
            )}

            {error && <div className="lp-error">{error}</div>}

            <button type="submit" className="lp-btn" disabled={loading}>
              {loading ? 'Processing…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
