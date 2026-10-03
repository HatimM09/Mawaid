import React, { useState, useEffect } from 'react'
import { AlertCircle, ChevronLeft } from 'lucide-react'
import { useTheme } from '../admin/context'

export const GeoBg = ({ t: tProp }) => {
  const ctx = useTheme(); const t = tProp || ctx
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.7 }}>
      <defs>
        <pattern id="geo" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M24 2L46 24L24 46L2 24Z" fill="none" stroke={t.geo} strokeWidth="0.7" />
          <circle cx="24" cy="24" r="4.5" fill="none" stroke={t.geo} strokeWidth="0.5" />
          <circle cx="0" cy="0" r="2" fill={t.geo} /><circle cx="48" cy="0" r="2" fill={t.geo} />
          <circle cx="0" cy="48" r="2" fill={t.geo} /><circle cx="48" cy="48" r="2" fill={t.geo} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#geo)" />
    </svg>
  )
}

export const Spinner = ({ fullPage = true }) => {
  const t = useTheme()
  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className="spin" style={{ width: 34, height: 34, border: `2.5px solid ${t.spinnerBorder}`, borderTop: `2.5px solid ${t.spinnerTop}`, borderRadius: '50%' }} />
      {fullPage && <p style={{ margin: 0, fontSize: 12, color: t.textSub, opacity: .45, fontFamily: "'DM Sans',sans-serif", letterSpacing: '0.08em' }}>Loading…</p>}
    </div>
  )
  return fullPage
    ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>{inner}</div>
    : inner
}

export const ErrorBanner = ({ msg }) => (
  <div style={{ margin: '8px 0', padding: '11px 14px', borderRadius: 10, background: 'rgba(220,60,60,0.09)', border: '1px solid rgba(220,60,60,0.28)', color: '#e05555', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'DM Sans',sans-serif" }}>
    <AlertCircle size={14} style={{ flexShrink: 0 }} />{msg}
  </div>
)

export const Avatar = ({ avatarUrl, name, email, size = 56 }) => {
  const t = useTheme()
  const [imgError, setImgError] = useState(false)
  const initials = (name || email || 'U').charAt(0).toUpperCase()

  useEffect(() => {
    setImgError(false)
  }, [avatarUrl])

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      flexShrink: 0, border: `2px solid ${t.accent}`,
      boxShadow: `0 4px 16px ${t.accentBg}`,
      background: t.accentGrad,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      {avatarUrl && !imgError ? (
        <img
          src={avatarUrl}
          alt={name || "Avatar"}
          loading="eager"
          decoding="async"
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: Math.max(14, size * 0.38), fontWeight: 800,
          color: '#fff', fontFamily: "'Playfair Display',serif"
        }}>
          {initials}
        </div>
      )}
    </div>
  )
}

export const SectionLabel = ({ children }) => {
  const t = useTheme()
  return <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', color: t.textSub, textTransform: 'uppercase', marginBottom: 14, fontFamily: "'DM Sans',sans-serif", opacity: .7 }}>{children}</div>
}

export function Card({ children, style = {}, active, organic }) {
  const t = useTheme()
  const organicStyle = organic ? {
    borderRadius: '32px 64px 32px 64px',
    background: `linear-gradient(145deg, ${active ? t.cardActive : t.card}, rgba(0,0,0,0.1))`,
  } : {
    borderRadius: 32,
    background: active ? t.cardActive : t.card,
  }

  return (
    <div style={{
      ...organicStyle,
      padding: '24px',
      border: `1px solid ${active ? t.borderActive : t.border}`,
      backdropFilter: 'blur(30px) saturate(2.5)',
      WebkitBackdropFilter: 'blur(30px) saturate(2.5)',
      boxShadow: `0 20px 40px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -2px 6px rgba(0,0,0,0.15)`,
      position: 'relative',
      overflow: 'hidden',
      ...style
    }}>
      {/* 3D Glossy Highlight */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)',
        pointerEvents: 'none'
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}

export const Btn = ({ children, onClick, disabled, style: extra = {}, variant = 'primary' }) => {
  const t = useTheme()
  const baseStyle = {
    padding: '14px 24px', borderRadius: 16, border: 'none',
    fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'DM Sans', sans-serif", transition: 'all 0.3s ease',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: 'fit-content', opacity: disabled ? 0.5 : 1, fontSize: 16
  }
  const variants = {
    primary: { background: t.accentGrad, color: '#000', boxShadow: `0 4px 15px ${t.accentBg}` },
    outline: { background: 'transparent', color: t.accent, border: `1px solid ${t.border}` },
    ghost: { background: 'transparent', color: t.textSub }
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...baseStyle, ...variants[variant], ...extra }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {children}
    </button>
  )
}

export const BackHeader = ({ title, onBack }) => {
  const t = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><ChevronLeft size={20} color={t.accent} /></button>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif" }}>{title}</h2>
    </div>
  )
}

export const EmptyState = ({ msg }) => {
  const t = useTheme()
  return <div style={{ textAlign: 'center', padding: 60, color: t.textSub, fontSize: 18, fontFamily: "'DM Sans',sans-serif" }}>{msg}</div>
}

export const GlobalStyles = () => {
  const t = useTheme()
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@400;500;600;700;800&family=Amiri:wght@400;700&family=Outfit:wght@400;600;700;800&display=swap');
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      @keyframes toastCountdown { from { width: 100%; } to { width: 0%; } }
      @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
      .spin { animation: spin 0.8s linear infinite; }
      * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
      body { background: ${t.bg}; color: ${t.text}; margin: 0; transition: background 0.3s ease; }
      
      /* Modern Scrollbar */
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${t.borderActive}; border-radius: 10px; }
      ::-webkit-scrollbar-thumb:hover { background: ${t.accent}; }

      .mobile-bottom-nav {
        position: fixed; 
        bottom: calc(12px + env(safe-area-inset-bottom, 0px)); 
        left: 50%; 
        transform: translateX(-50%);
        width: min(480px, calc(100% - 32px));
        height: 72px;
        background: ${t.navBg};
        backdrop-filter: blur(25px) saturate(1.8);
        -webkit-backdrop-filter: blur(25px) saturate(1.8);
        border: 1.5px solid ${t.accentBorder};
        display: flex; align-items: center; justify-content: space-around;
        padding: 0 8px;
        z-index: 9000;
        border-radius: 24px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1);
      }
      .mobile-bottom-nav button {
        flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: none; border: none; cursor: pointer; color: ${t.textSub};
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        height: 100%;
        position: relative;
      }
      .mobile-bottom-nav button.active { 
        color: ${t.accent}; 
      }
      .mobile-bottom-nav button div {
        width: 44px; height: 44px; border-radius: 16px;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .mobile-bottom-nav button.active div { 
        background: ${t.accentGrad}; 
        color: #000;
        box-shadow: 0 8px 20px ${t.accent}40;
        transform: translateY(-6px) scale(1.05);
        border-radius: 18px;
      }
      .mobile-bottom-nav button span {
        font-size: 10px; font-weight: 800; text-transform: uppercase;
        margin-top: 4px; opacity: 0.7; letter-spacing: 0.05em;
        transition: all 0.3s;
      }
      .mobile-bottom-nav button.active span {
        transform: translateY(-2px);
        opacity: 1;
        color: ${t.accent};
        font-weight: 900;
      }
      /* ── COMPREHENSIVE RESPONSIVE SYSTEM ── */
      html { font-size: 16px; overflow-x: hidden; }
      body { overflow-x: hidden; width: 100%; max-width: 100vw; }
      img { max-width: 100%; height: auto; }
      .vh-fix { min-height: 100dvh; min-height: -webkit-fill-available; }
      main { padding-bottom: max(110px, calc(80px + env(safe-area-inset-bottom, 20px))) !important; }
      h1, h2, h3, h4, p, span, div { overflow-wrap: break-word; word-wrap: break-word; }
      button, a, input, select, textarea { min-height: 44px; }
      button, a { min-width: 44px; }
      @media (max-width: 1024px) {
        .mobile-bottom-nav { height: 68px !important; }
      }
      @media (max-width: 768px) {
        main { padding-left: 14px !important; padding-right: 14px !important; }
        h1 { font-size: clamp(20px, 5.5vw, 28px) !important; }
        h2 { font-size: clamp(17px, 5vw, 24px) !important; }
        .mobile-bottom-nav { height: 66px !important; border-radius: 22px !important; }
        .mobile-bottom-nav button div { width: 42px !important; height: 42px !important; border-radius: 14px !important; }
        .mobile-bottom-nav button span { font-size: 9px !important; }
      }
      @media (max-width: 480px) {
        main { padding-left: 12px !important; padding-right: 12px !important; }
        h1 { font-size: clamp(18px, 5vw, 24px) !important; }
        h2 { font-size: clamp(16px, 4.5vw, 20px) !important; }
        .mobile-bottom-nav { height: 62px !important; border-radius: 20px !important; width: calc(100% - 24px) !important; bottom: calc(8px + env(safe-area-inset-bottom, 0px)) !important; }
        .mobile-bottom-nav button div { width: 38px !important; height: 38px !important; border-radius: 12px !important; }
        .mobile-bottom-nav button span { font-size: 8px !important; }
        .mobile-bottom-nav button.active div { border-radius: 14px !important; }
      }
      @media (max-width: 360px) {
        main { padding-left: 8px !important; padding-right: 8px !important; }
        .mobile-bottom-nav { height: 56px !important; width: calc(100% - 16px) !important; }
        .mobile-bottom-nav button div { width: 34px !important; height: 34px !important; border-radius: 10px !important; }
        .mobile-bottom-nav button span { font-size: 7px !important; }
      }
      @media (max-height: 500px) and (orientation: landscape) {
        .mobile-bottom-nav { height: 52px !important; }
        .mobile-bottom-nav button div { width: 32px !important; height: 32px !important; }
        main { padding-bottom: 70px !important; }
      }
      @media (min-width: 1400px) {
        main { max-width: 900px !important; }
      }

    `}</style>
  )
}


