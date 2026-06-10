// src/AdminLogin.jsx
// ══════════════════════════════════════════════════════════════
// AL-MAWAID ADMIN LOGIN — Wheat Field · Warm Earth
// Matches the main login page's wheat-theme design language
// ══════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Shield, Lock, ArrowRight } from 'lucide-react'

export default function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
      animation: adm-ripple 0.6s ease-out forwards;
      pointer-events: none;
    `
    btn.appendChild(ripple)
    setTimeout(() => ripple.remove(), 700)
  }, [])

  const handleSubmit = () => {
    setError('')
    if (password === 'almawaid') {
      setLoading(true)
      setTimeout(() => onLogin(), 400)
    } else {
      setError('🚫 Invalid Key')
    }
  }

  const px = (mousePos.x - 0.5) * 14
  const py = (mousePos.y - 0.5) * 10

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Outfit:wght@300;400;500;600;700;800&display=swap');

        html, body { margin: 0; overflow: hidden; height: 100%; }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }

        .adm-root {
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
        .adm-wheat-canvas {
          position: absolute; inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .adm-wheat-bg {
          position: absolute;
          inset: -10%;
          background: url('/wheat_bg.png') center/cover no-repeat;
          animation: adm-ken-burns 24s ease-in-out infinite alternate;
          will-change: transform;
        }
        @keyframes adm-ken-burns {
          0%   { transform: scale(1) translate(0, 0); }
          50%  { transform: scale(1.12) translate(-1.5%, -1%); }
          100% { transform: scale(1.06) translate(1%, 1.5%); }
        }
        .adm-wheat-overlay {
          position: absolute;
          inset: -15%;
          background: url('/wheat_bg.png') center/cover no-repeat;
          opacity: 0.15;
          animation: adm-ken-overlay 30s ease-in-out infinite alternate;
          will-change: transform;
          filter: blur(2px) saturate(0.8) hue-rotate(10deg);
        }
        @keyframes adm-ken-overlay {
          0%   { transform: scale(1.15) translate(0, 0); }
          100% { transform: scale(1) translate(3%, -2%); }
        }

        /* Vignette */
        .adm-vignette {
          position: absolute; inset: 0;
          z-index: 1;
          background: radial-gradient(ellipse at center, transparent 30%, rgba(26,18,8,0.45) 65%, rgba(26,18,8,0.85) 100%);
          pointer-events: none;
        }

        /* Warm ambient glow */
        .adm-warm-glow {
          position: absolute; inset: 0;
          z-index: 1;
          pointer-events: none;
          background: radial-gradient(circle at 25% 20%, rgba(212,175,55,0.06), transparent 50%),
                      radial-gradient(circle at 75% 75%, rgba(180,120,40,0.05), transparent 50%);
        }

        /* ── Floating Wheat Grains ── */
        .adm-grains {
          position: absolute; inset: 0; z-index: 2;
          pointer-events: none; overflow: hidden;
        }
        .adm-grain {
          position: absolute;
          width: 4px; height: 10px;
          background: linear-gradient(180deg, #D4AF37, #B8860B);
          border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
          opacity: 0;
          box-shadow: 0 0 6px rgba(212,175,55,0.3);
          animation: adm-grain-drift linear infinite;
        }
        .adm-grain:nth-child(1)  { left: 10%; animation-duration: 18s; animation-delay: 0s; }
        .adm-grain:nth-child(2)  { left: 30%; animation-duration: 22s; animation-delay: 2s; transform: rotate(30deg); }
        .adm-grain:nth-child(3)  { left: 50%; animation-duration: 20s; animation-delay: 4s; transform: rotate(-20deg); }
        .adm-grain:nth-child(4)  { left: 70%; animation-duration: 16s; animation-delay: 1s; }
        .adm-grain:nth-child(5)  { left: 88%; animation-duration: 21s; animation-delay: 3s; transform: rotate(15deg); }
        @keyframes adm-grain-drift {
          0%   { opacity: 0; transform: translateY(105vh) translateX(0) rotate(0deg) scale(0.6); }
          15%  { opacity: 0.6; }
          75%  { opacity: 0.35; }
          100% { opacity: 0; transform: translateY(-8vh) translateX(25px) rotate(360deg) scale(1); }
        }

        /* ── Dust Motes ── */
        .adm-dust {
          position: absolute; inset: 0; z-index: 2;
          pointer-events: none; overflow: hidden;
        }
        .adm-mote {
          position: absolute;
          width: 2px; height: 2px;
          background: #F5DEB3;
          border-radius: 50%;
          opacity: 0;
          animation: adm-mote-float linear infinite;
        }
        .adm-mote:nth-child(1)  { left: 20%; animation-duration: 14s; animation-delay: 0s; }
        .adm-mote:nth-child(2)  { left: 45%; animation-duration: 17s; animation-delay: 3s; }
        .adm-mote:nth-child(3)  { left: 70%; animation-duration: 12s; animation-delay: 5s; }
        @keyframes adm-mote-float {
          0%   { opacity: 0; transform: translateY(100vh) translateX(0); }
          25%  { opacity: 0.4; }
          75%  { opacity: 0.25; }
          100% { opacity: 0; transform: translateY(-5vh) translateX(-12px); }
        }

        /* ── Card ── */
        .adm-card {
          position: relative;
          z-index: 5;
          width: min(400px, 92vw);
          padding: clamp(36px, 6vw, 52px) clamp(28px, 5vw, 44px);
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
          align-items: center;
          gap: 0;
          animation: adm-card-in 0.8s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes adm-card-in {
          0%   { opacity: 0; transform: translateY(24px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Stagger ── */
        .adm-stagger > * {
          opacity: 0;
          animation: adm-stag 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .adm-stagger > *:nth-child(1) { animation-delay: 0.3s; }
        .adm-stagger > *:nth-child(2) { animation-delay: 0.45s; }
        .adm-stagger > *:nth-child(3) { animation-delay: 0.6s; }
        .adm-stagger > *:nth-child(4) { animation-delay: 0.75s; }
        @keyframes adm-stag {
          0%   { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        /* ── Brand ── */
        .adm-brand {
          text-align: center;
          margin-bottom: 28px;
        }
        .adm-icon-wrap {
          position: relative;
          display: inline-flex;
          margin-bottom: 14px;
        }
        .adm-icon-glow {
          position: absolute;
          inset: -12px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(212, 175, 55, 0.25), transparent 70%);
          animation: adm-icon-pulse 4s ease-in-out infinite;
        }
        @keyframes adm-icon-pulse {
          0%,100% { transform: scale(1); opacity: 0.3; }
          50%     { transform: scale(1.25); opacity: 0.8; }
        }
        .adm-icon-box {
          position: relative;
          width: 64px; height: 64px;
          border-radius: 20px;
          background: rgba(212, 175, 55, 0.08);
          border: 1px solid rgba(212, 175, 55, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .adm-icon-box svg {
          filter: brightness(0.85);
          animation: adm-icon-wobble 5s ease-in-out infinite;
        }
        @keyframes adm-icon-wobble {
          0%,100% { transform: rotate(0deg); }
          25%     { transform: rotate(-4deg); }
          75%     { transform: rotate(4deg); }
        }
        .adm-title {
          font-family: 'Cinzel', serif;
          font-weight: 900;
          font-size: clamp(24px, 6vw, 34px);
          letter-spacing: 0.14em;
          background: linear-gradient(135deg, #F5DEB3 0%, #D4AF37 30%, #C8902A 60%, #F5DEB3 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1.1;
          margin-bottom: 6px;
          animation: adm-shine 6s ease-in-out infinite;
        }
        @keyframes adm-shine {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .adm-sub {
          font-size: 12px;
          font-weight: 400;
          color: rgba(212, 175, 55, 0.4);
          letter-spacing: 0.12em;
        }

        /* ── Divider ── */
        .adm-divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.25), rgba(245, 222, 179, 0.3), rgba(212, 175, 55, 0.25), transparent);
          margin-bottom: 24px;
        }

        /* ── Field ── */
        .adm-field {
          width: 100%;
          margin-bottom: 18px;
        }
        .adm-field-label {
          display: block;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: rgba(212, 175, 55, 0.5);
          text-transform: uppercase;
          margin-bottom: 6px;
          transition: color 0.3s ease;
        }
        .adm-field:focus-within .adm-field-label {
          color: #F5DEB3;
        }
        .adm-input-wrap {
          position: relative;
          border-radius: 14px;
        }
        .adm-input-wrap svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(212, 175, 55, 0.3);
          filter: brightness(0.85);
          pointer-events: none;
          transition: color 0.3s ease, transform 0.3s ease;
        }
        .adm-field:focus-within .adm-input-wrap svg {
          color: rgba(245, 222, 179, 0.6);
          transform: translateY(-50%) scale(1.1);
        }
        .adm-input {
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
        .adm-input:focus {
          border-color: rgba(212, 175, 55, 0.35);
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.08), inset 0 2px 6px rgba(0, 0, 0, 0.3);
          background: rgba(255, 248, 230, 0.1);
        }
        .adm-input::placeholder {
          color: rgba(212, 175, 55, 0.2);
          transition: color 0.3s ease, opacity 0.3s ease;
        }
        .adm-input:focus::placeholder {
          color: rgba(212, 175, 55, 0.15);
          opacity: 0.6;
        }

        /* ── Error ── */
        .adm-error {
          width: 100%;
          font-size: 12px;
          font-weight: 600;
          color: #c0392b;
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(192, 57, 43, 0.1);
          border: 1px solid rgba(192, 57, 43, 0.2);
          margin-bottom: 10px;
          animation: adm-shake 0.5s cubic-bezier(0.36,0.07,0.19,0.97) both;
        }
        @keyframes adm-shake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-5px); }
          30%     { transform: translateX(4px); }
          45%     { transform: translateX(-3px); }
          60%     { transform: translateX(2px); }
          75%     { transform: translateX(-1px); }
        }

        /* ── Button ── */
        .adm-btn-wrap {
          position: relative;
          width: 100%;
          border-radius: 14px;
          overflow: hidden;
        }
        .adm-btn {
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
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow:
            0 8px 28px rgba(212, 175, 55, 0.2),
            0 2px 8px rgba(0, 0, 0, 0.3);
          transition: filter 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
          animation: adm-btn-shift 4s ease-in-out infinite;
        }
        @keyframes adm-btn-shift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .adm-btn:hover:not(:disabled) {
          filter: brightness(1.15);
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(212, 175, 55, 0.3), 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .adm-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.99);
          filter: brightness(0.95);
        }
        .adm-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          animation: none;
        }
        .adm-btn svg {
          filter: brightness(0.85);
          transition: transform 0.3s ease;
        }
        .adm-btn:hover svg {
          transform: translateX(3px);
        }
        @keyframes adm-ripple {
          to { transform: scale(4); opacity: 0; }
        }

        /* ── Footer ── */
        .adm-footer {
          width: 100%;
          text-align: center;
          margin-top: 24px;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.1em;
          color: rgba(212, 175, 55, 0.25);
        }
      `}</style>

      <div className="adm-root">
        {/* Wheat Background Canvas — Ken Burns Motion */}
        <div className="adm-wheat-canvas">
          <div className="adm-wheat-bg" />
          <div className="adm-wheat-overlay" />
        </div>

        {/* Vignette + Warm Glow */}
        <div className="adm-vignette" />
        <div className="adm-warm-glow" />

        {/* Floating Wheat Grains */}
        <div className="adm-grains">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="adm-grain" />
          ))}
        </div>

        {/* Dust Motes */}
        <div className="adm-dust">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="adm-mote" />
          ))}
        </div>

        {/* Card Wrapper — handles mouse parallax separately from card animation */}
        <div style={{
          transform: `translate(${px}px, ${py}px)`,
          transition: 'transform 0.15s ease-out',
          position: 'relative', zIndex: 5
        }}>
          <div className="adm-card">
            <div className="adm-stagger">
              {/* Brand */}
              <div>
                <div className="adm-brand">
                  <div className="adm-icon-wrap">
                    <div className="adm-icon-glow" />
                    <div className="adm-icon-box">
                      <Shield size={34} color="#8B6914" strokeWidth={1.5} />
                    </div>
                  </div>
                  <div className="adm-title">ADMIN ACCESS</div>
                  <div className="adm-sub">Authorized personnel only</div>
                </div>
              </div>

              {/* Divider */}
              <div><div className="adm-divider" /></div>

              {/* Input */}
              <div>
                <div className="adm-field">
                  <label className="adm-field-label">Secret Key</label>
                  <div className="adm-input-wrap">
                    <Lock size={16} />
                    <input
                      className="adm-input"
                      type="password"
                      name="adminKey"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                      placeholder="Enter admin key..."
                      autoFocus
                    />
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div key={error}>
                  <div className="adm-error">{error}</div>
                </div>
              )}

              {/* Button */}
              <div>
                <div className="adm-btn-wrap">
                  <button
                    ref={btnRef}
                    className="adm-btn"
                    onClick={(e) => { createRipple(e); handleSubmit() }}
                    disabled={loading}
                  >
                    {loading ? 'Authenticating…' : 'Access Dashboard'}
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="adm-footer">Al-Mawaid Food Service System</div>
          </div>
        </div>
      </div>
    </>
  )
}
