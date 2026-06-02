// src/LoginPage.jsx
// ══════════════════════════════════════════════════════════════
// AL-MAWAID LOGIN — Wheat Field · Warm Earth · Dynamic Motion
//   • Full-screen wheat background with Ken Burns slow zoom
//   • Warm amber/gold card with frosted glass
//   • Floating wheat-grain particles
//   • Dynamic parallax layers
//   • Fluid entrance animations
// ══════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Mail, Lock, User, Medal, Package, Shield } from 'lucide-react'
import { supabase } from './admin/supabaseClient'

const LOGIN_ROLES = [
  { id: 'member',             label: 'Member',      icon: <User size={16} />,    short: 'Khidmat Guzar' },
  { id: 'khidmat',            label: 'Team',         icon: <Medal size={16} />,   short: 'Al-Mawaid Team' },
  { id: 'inventory_manager',  label: 'Inventory',    icon: <Package size={16} />, short: 'Inventory Manager' },
  { id: 'admin',              label: 'Admin',        icon: <Shield size={16} />,  short: 'Admin' },
]

export default function LoginPage({ onRoleLogin }) {
  const [role, setRole]         = useState('member')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })

  const btnRef = useRef(null)

  useEffect(() => {
    const handleMouse = (e) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
    }
    window.addEventListener('mousemove', handleMouse)
    return () => window.removeEventListener('mousemove', handleMouse)
  }, [])

  const createRipple = useCallback((e) => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const ripple = document.createElement('span')
    const size = Math.max(rect.width, rect.height)
    const x = e.clientX - rect.left - size / 2
    const y = e.clientY - rect.top - size / 2
    ripple.style.cssText = `
      position: absolute; width: ${size}px; height: ${size}px;
      left: ${x}px; top: ${y}px; border-radius: 50%;
      background: rgba(255,255,255,0.35);
      transform: scale(0);
      animation: ripple-burst 0.6s ease-out forwards;
      pointer-events: none;
    `
    btn.appendChild(ripple)
    setTimeout(() => ripple.remove(), 700)
  }, [])

  const handleAuth = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (role === 'inventory_manager') {
        const { data: invStaff, error: invErr } = await supabase
          .from('staff').select('*').ilike('email', email).eq('role', 'inventory_manager').maybeSingle()
        if (invErr || !invStaff) throw new Error('Unauthorized: Email not registered as Inventory Manager.')
        onRoleLogin('inventory_manager', { user: { email, id: invStaff.user_id || `inv_${invStaff.id}`, ...invStaff } })
        setLoading(false); return
      }

      const { data: { session }, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) throw signInErr

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
      const isSecretAdmin = role === 'admin' && secretKey === 'almawaid'

      if (role === 'admin' && dbRole !== 'admin' && !isSecretAdmin) {
        await supabase.auth.signOut();
        throw new Error('You do not have admin privileges. If you are the system administrator, please enter the Secret Key.')
      }
      if (role === 'khidmat' && !['khidmat_guzar','supervisor','khidmat','admin'].includes(dbRole)) {
        await supabase.auth.signOut(); throw new Error('You are not registered as part of the Al Mawaid Team.')
      }
      onRoleLogin((dbRole === 'admin' || isSecretAdmin) ? 'admin' : dbRole, session)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const px = (mousePos.x - 0.5) * 16
  const py = (mousePos.y - 0.5) * 12

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Outfit:wght@300;400;500;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { margin: 0; overflow: hidden; height: 100%; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }

        /* ── Root ── */
        .lp-root {
          min-height: 100vh; min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: #1a1208;
          font-family: 'Outfit', sans-serif;
        }

        /* ── Wheat Background Canvas ── */
        .lp-wheat-canvas {
          position: absolute; inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }

        /* Ken Burns wheat image — slow drift */
        .lp-wheat-bg {
          position: absolute;
          inset: -10%;
          background: url('/wheat_bg.png') center/cover no-repeat;
          animation: ken-burns 24s ease-in-out infinite alternate;
          will-change: transform;
        }
        @keyframes ken-burns {
          0%   { transform: scale(1) translate(0, 0); }
          50%  { transform: scale(1.12) translate(-2%, -1%); }
          100% { transform: scale(1.06) translate(1%, 1.5%); }
        }

        /* Second parallax layer — lighter overlay with own drift */
        .lp-wheat-overlay {
          position: absolute;
          inset: -15%;
          background: url('/wheat_bg.png') center/cover no-repeat;
          opacity: 0.15;
          animation: ken-overlay 30s ease-in-out infinite alternate;
          will-change: transform;
          filter: blur(2px) saturate(0.8) hue-rotate(10deg);
        }
        @keyframes ken-overlay {
          0%   { transform: scale(1.15) translate(0, 0); }
          100% { transform: scale(1) translate(3%, -2%); }
        }

        /* Vignette overlay for depth */
        .lp-vignette {
          position: absolute; inset: 0;
          z-index: 1;
          background: radial-gradient(ellipse at center, transparent 30%, rgba(26,18,8,0.45) 65%, rgba(26,18,8,0.85) 100%);
          pointer-events: none;
        }

        /* Warm ambient glow overlay */
        .lp-warm-glow {
          position: absolute; inset: 0;
          z-index: 1;
          pointer-events: none;
          background: radial-gradient(circle at 30% 20%, rgba(212,175,55,0.06), transparent 50%),
                      radial-gradient(circle at 80% 70%, rgba(180,120,40,0.05), transparent 50%);
        }

        /* ── Floating Wheat / Grain Particles ── */
        .lp-grains {
          position: absolute; inset: 0; z-index: 2;
          pointer-events: none; overflow: hidden;
        }
        .lp-grain {
          position: absolute;
          width: 4px; height: 10px;
          background: linear-gradient(180deg, #D4AF37, #B8860B);
          border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
          opacity: 0;
          box-shadow: 0 0 6px rgba(212,175,55,0.3);
          animation: grain-drift linear infinite;
        }
        .lp-grain:nth-child(1)  { left: 8%;  animation-duration: 18s; animation-delay: 0s; }
        .lp-grain:nth-child(2)  { left: 18%; animation-duration: 22s; animation-delay: 2s; transform: rotate(30deg); }
        .lp-grain:nth-child(3)  { left: 30%; animation-duration: 20s; animation-delay: 4s; transform: rotate(-20deg); }
        .lp-grain:nth-child(4)  { left: 42%; animation-duration: 24s; animation-delay: 1s; }
        .lp-grain:nth-child(5)  { left: 55%; animation-duration: 16s; animation-delay: 3s; transform: rotate(45deg); }
        .lp-grain:nth-child(6)  { left: 68%; animation-duration: 21s; animation-delay: 5s; transform: rotate(-10deg); }
        .lp-grain:nth-child(7)  { left: 78%; animation-duration: 19s; animation-delay: 0.5s; }
        .lp-grain:nth-child(8)  { left: 90%; animation-duration: 23s; animation-delay: 2.5s; transform: rotate(15deg); }

        @keyframes grain-drift {
          0%   { opacity: 0; transform: translateY(105vh) translateX(0) rotate(0deg) scale(0.6); }
          15%  { opacity: 0.6; }
          75%  { opacity: 0.4; }
          100% { opacity: 0; transform: translateY(-8vh) translateX(30px) rotate(360deg) scale(1); }
        }

        /* ── Tiny golden dust motes ── */
        .lp-dust {
          position: absolute; inset: 0; z-index: 2;
          pointer-events: none; overflow: hidden;
        }
        .lp-mote {
          position: absolute;
          width: 2px; height: 2px;
          background: #F5DEB3;
          border-radius: 50%;
          opacity: 0;
          animation: mote-float linear infinite;
        }
        .lp-mote:nth-child(1)  { left: 15%; animation-duration: 14s; animation-delay: 0s; }
        .lp-mote:nth-child(2)  { left: 35%; animation-duration: 17s; animation-delay: 3s; }
        .lp-mote:nth-child(3)  { left: 55%; animation-duration: 12s; animation-delay: 5s; }
        .lp-mote:nth-child(4)  { left: 75%; animation-duration: 16s; animation-delay: 1s; }
        .lp-mote:nth-child(5)  { left: 90%; animation-duration: 13s; animation-delay: 4s; }
        @keyframes mote-float {
          0%   { opacity: 0; transform: translateY(100vh) translateX(0); }
          25%  { opacity: 0.5; }
          75%  { opacity: 0.3; }
          100% { opacity: 0; transform: translateY(-5vh) translateX(-15px); }
        }

        /* ── Card ── */
        .lp-card {
          position: relative;
          z-index: 5;
          width: min(440px, 94vw);
          padding: clamp(32px, 6vw, 52px) clamp(24px, 5vw, 44px);
          border-radius: 28px;
          background: rgba(26, 20, 12, 0.65);
          backdrop-filter: blur(40px) saturate(1.3);
          -webkit-backdrop-filter: blur(40px) saturate(1.3);
          border: 1px solid rgba(212, 175, 55, 0.15);
          box-shadow:
            0 0 0 1px rgba(212, 175, 55, 0.06),
            0 30px 80px rgba(0, 0, 0, 0.5),
            0 8px 24px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(212, 175, 55, 0.06);
          display: flex;
          flex-direction: column;
          gap: 0;
          animation: card-in 0.8s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes card-in {
          0%   { opacity: 0; transform: translateY(24px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Staggered Entrance ── */
        .lp-stagger > * {
          opacity: 0;
          animation: stagger-up 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .lp-stagger > *:nth-child(1) { animation-delay: 0.3s; }
        .lp-stagger > *:nth-child(2) { animation-delay: 0.45s; }
        .lp-stagger > *:nth-child(3) { animation-delay: 0.6s; }
        .lp-stagger > *:nth-child(4) { animation-delay: 0.75s; }
        .lp-stagger > *:nth-child(5) { animation-delay: 0.9s; }
        @keyframes stagger-up {
          0%   { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        /* ── Brand Section ── */
        .lp-brand {
          text-align: center;
          margin-bottom: 28px;
        }
        .lp-logo-wrap {
          position: relative;
          display: inline-flex;
          margin-bottom: 14px;
        }
        .lp-logo-glow {
          position: absolute;
          inset: -14px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(212, 175, 55, 0.25), transparent 70%);
          animation: logo-glow-pulse 4s ease-in-out infinite;
        }
        @keyframes logo-glow-pulse {
          0%,100% { transform: scale(1); opacity: 0.3; }
          50%     { transform: scale(1.25); opacity: 0.8; }
        }
        .lp-logo {
          position: relative;
          width: 64px; height: 64px;
          object-fit: contain;
          filter: brightness(0.85) drop-shadow(0 8px 24px rgba(212, 175, 55, 0.2));
        }
        .lp-title {
          font-family: 'Cinzel', serif;
          font-weight: 900;
          font-size: clamp(30px, 7vw, 42px);
          letter-spacing: 0.16em;
          background: linear-gradient(135deg, #F5DEB3 0%, #D4AF37 30%, #C8902A 60%, #F5DEB3 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1.1;
          margin-bottom: 0;
          animation: title-shine 6s ease-in-out infinite;
        }
        @keyframes title-shine {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* ── Divider ── */
        .lp-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.25), rgba(245, 222, 179, 0.3), rgba(212, 175, 55, 0.25), transparent);
          margin-bottom: 22px;
        }

        /* ── Role Pills ── */
        .lp-role-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: rgba(212, 175, 55, 0.5);
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .lp-roles {
          display: flex;
          gap: 6px;
          margin-bottom: 22px;
        }
        .lp-role {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 4px;
          border-radius: 14px;
          border: 1px solid rgba(212, 175, 55, 0.12);
          background: rgba(255, 248, 230, 0.04);
          cursor: pointer;
          transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1);
          font-family: 'Outfit', sans-serif;
        }
        .lp-role svg {
          color: rgba(212, 175, 55, 0.35);
          filter: brightness(0.85);
          transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1);
        }
        .lp-role span {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: rgba(212, 175, 55, 0.35);
          transition: color 0.35s ease;
        }
        .lp-role:hover {
          border-color: rgba(212, 175, 55, 0.3);
          background: rgba(212, 175, 55, 0.08);
        }
        .lp-role:hover svg { color: rgba(212, 175, 55, 0.6); filter: brightness(0.9); }
        .lp-role:hover span { color: rgba(212, 175, 55, 0.5); }
        .lp-role--active {
          border-color: rgba(212, 175, 55, 0.35);
          background: rgba(212, 175, 55, 0.1);
          box-shadow: 0 0 24px rgba(212, 175, 55, 0.08), inset 0 0 20px rgba(212, 175, 55, 0.03);
        }
        .lp-role--active svg {
          color: #F5DEB3;
          transform: scale(1.15);
        }
        .lp-role--active span {
          color: #F5DEB3;
        }

        /* ── Form ── */
        .lp-form { display: flex; flex-direction: column; gap: 16px; }

        .lp-field { position: relative; }
        .lp-field-label {
          display: block;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: rgba(212, 175, 55, 0.5);
          text-transform: uppercase;
          margin-bottom: 6px;
          transition: color 0.3s ease;
        }
        .lp-field:focus-within .lp-field-label {
          color: #F5DEB3;
        }

        .lp-input-wrap {
          position: relative;
          border-radius: 14px;
        }
        .lp-input-wrap svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(212, 175, 55, 0.3);
          filter: brightness(0.85);
          pointer-events: none;
          transition: color 0.3s ease, transform 0.3s ease;
          width: 16px; height: 16px;
        }
        .lp-field:focus-within .lp-input-wrap svg {
          color: rgba(245, 222, 179, 0.6);
          transform: translateY(-50%) scale(1.1);
        }
        .lp-input {
          width: 100%;
          padding: 14px 14px 14px 42px;
          border-radius: 14px;
          border: 1px solid rgba(212, 175, 55, 0.15);
          background: rgba(255, 248, 230, 0.06);
          color: #F5DEB3;
          font-size: 14px;
          font-family: 'Outfit', sans-serif;
          font-weight: 400;
          outline: none;
          transition: border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
          box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3);
        }
        .lp-input:focus {
          border-color: rgba(212, 175, 55, 0.35);
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.08), inset 0 2px 6px rgba(0, 0, 0, 0.3);
          background: rgba(255, 248, 230, 0.1);
        }
        .lp-input::placeholder {
          color: rgba(212, 175, 55, 0.2);
          transition: color 0.3s ease, opacity 0.3s ease;
        }
        .lp-input:focus::placeholder {
          color: rgba(212, 175, 55, 0.15);
          opacity: 0.6;
        }
        .lp-eye {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(212, 175, 55, 0.4);
          padding: 6px;
          display: flex;
          align-items: center;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          font-family: 'Outfit', sans-serif;
          transition: color 0.25s ease;
        }
        .lp-eye:hover { color: rgba(245, 222, 179, 0.7); }

        /* ── Error ── */
        .lp-error {
          font-size: 12px;
          font-weight: 600;
          color: #c0392b;
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(192, 57, 43, 0.1);
          border: 1px solid rgba(192, 57, 43, 0.2);
          animation: err-shake 0.5s cubic-bezier(0.36,0.07,0.19,0.97) both;
        }
        @keyframes err-shake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-5px); }
          30%     { transform: translateX(4px); }
          45%     { transform: translateX(-3px); }
          60%     { transform: translateX(2px); }
          75%     { transform: translateX(-1px); }
        }

        /* ── Submit Button ── */
        .lp-btn-wrap {
          position: relative;
          margin-top: 4px;
          border-radius: 14px;
          overflow: hidden;
        }
        .lp-btn {
          width: 100%;
          padding: 16px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #D4AF37 0%, #C8902A 35%, #A0760A 65%, #8B6914 100%);
          background-size: 200% 200%;
          color: #1a1208;
          font-family: 'Cinzel', serif;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          box-shadow:
            0 8px 28px rgba(212, 175, 55, 0.2),
            0 2px 8px rgba(0, 0, 0, 0.3);
          transition: filter 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
          animation: btn-shift 4s ease-in-out infinite;
        }
        @keyframes btn-shift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .lp-btn:hover:not(:disabled) {
          filter: brightness(1.15);
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(212, 175, 55, 0.3), 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .lp-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.99);
          filter: brightness(0.95);
        }
        .lp-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          animation: none;
        }
        @keyframes ripple-burst {
          to { transform: scale(4); opacity: 0; }
        }

        /* ── Footer ── */
        .lp-footer {
          text-align: center;
          margin-top: 24px;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.1em;
          color: rgba(212, 175, 55, 0.25);
        }
      `}</style>

      <div className="lp-root">
        {/* Wheat Background Canvas — Ken Burns Motion */}
        <div className="lp-wheat-canvas">
          <div className="lp-wheat-bg" />
          <div className="lp-wheat-overlay" />
        </div>

        {/* Vignette + Warm Glow */}
        <div className="lp-vignette" />
        <div className="lp-warm-glow" />

        {/* Floating Wheat Grains */}
        <div className="lp-grains">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="lp-grain" />
          ))}
        </div>

        {/* Golden Dust Motes */}
        <div className="lp-dust">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="lp-mote" />
          ))}
        </div>

        {/* Card Wrapper — handles mouse parallax separately from card animation */}
        <div style={{
          transform: `translate(${px}px, ${py}px)`,
          transition: 'transform 0.15s ease-out',
          position: 'relative', zIndex: 5
        }}>
          <div className="lp-card">
          <div className="lp-stagger">
            {/* ── Brand Section ── */}
            <div>
              <div className="lp-brand">
                <div className="lp-logo-wrap">
                  <div className="lp-logo-glow" />
                  <img src="/al-mawaid.png" alt="Al-Mawaid" className="lp-logo" />
                </div>
                <div className="lp-title">AL-MAWAID</div>
              </div>
            </div>

            {/* ── Divider ── */}
            <div><div className="lp-divider" /></div>

            {/* ── Role Selection ── */}
            <div>
              <div className="lp-role-label">I am a...</div>
              <div className="lp-roles">
                {LOGIN_ROLES.map(r => (
                  <button
                    key={r.id}
                    className={`lp-role ${role === r.id ? 'lp-role--active' : ''}`}
                    onClick={() => { setRole(r.id); setError('') }}
                    type="button"
                  >
                    {r.icon}
                    <span>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Form ── */}
            <div>
              <form className="lp-form" onSubmit={handleAuth}>
                <div className="lp-field">
                  <label className="lp-field-label">Email</label>
                  <div className="lp-input-wrap">
                    <Mail />
                    <input
                      type="email"
                      className="lp-input"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                {role !== 'inventory_manager' && (
                  <div className="lp-field">
                    <label className="lp-field-label">Password</label>
                    <div className="lp-input-wrap">
                      <Lock />
                      <input
                        type={showPass ? 'text' : 'password'}
                        className="lp-input"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
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
                  <div className="lp-field">
                    <label className="lp-field-label">Secret Key</label>
                    <div className="lp-input-wrap">
                      <Shield size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(139,105,20,0.3)', filter: 'brightness(0.85)', pointerEvents: 'none' }} />
                      <input
                        type="password"
                        className="lp-input"
                        placeholder="Enter admin key..."
                        value={secretKey}
                        onChange={e => setSecretKey(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {error && <div className="lp-error" key={error}>{error}</div>}

                <div className="lp-btn-wrap">
                  <button
                    ref={btnRef}
                    type="submit"
                    className="lp-btn"
                    disabled={loading}
                    onClick={createRipple}
                  >
                    {loading ? 'Processing…' : 'Sign In'}
                  </button>
                </div>
              </form>
            </div>
          </div>

            {/* ── Footer ── */}
            <div className="lp-footer">Al-Mawaid Food Service System</div>
          </div>
        </div>
      </div>
    </>
  )
}
