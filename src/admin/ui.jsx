// src/admin/ui.jsx — shared admin UI primitives
import React from 'react'
import { AlertCircle, X } from 'lucide-react'

export const T = {
  bg: 'var(--bg-deep)',
  bgGrad: 'var(--bg-grad)',
  card: 'var(--bg-surface)',
  cardGlass: 'var(--bg-card-glass)',
  cardHover: 'var(--bg-card-hover)',
  border: 'var(--border-light)',
  borderGlass: 'var(--border-glass)',
  borderActive: 'var(--border-active)',
  accent: 'var(--accent-primary)',
  accentGrad: 'var(--accent-grad)',
  accentBg: 'var(--accent-bg)',
  accentBorder: 'var(--accent-border)',
  text: 'var(--text-primary)',
  textSub: 'var(--text-tertiary)',
  inputBg: 'var(--input-bg)',
  inputBorder: 'var(--input-border)',
  success: 'var(--success-color)',
  successBg: 'var(--success-bg)',
  danger: 'var(--danger-color)',
  dangerBg: 'var(--danger-bg)',
  warn: 'var(--warn-color)',
  warnBg: 'var(--warn-bg)',
  glow: '0 0 15px var(--accent-bg)'
}

export const updateSystemTheme = (themeId) => {
  const root = document.documentElement;
  if (themeId === 'dark') {
    // Dark Mode (violet accent)
    root.style.setProperty('--bg-deep', '#0c0c14');
    root.style.setProperty('--bg-surface', 'rgba(255, 255, 255, 0.04)');
    root.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.04)');
    root.style.setProperty('--bg-card-hover', 'rgba(139, 92, 246, 0.06)');
    root.style.setProperty('--bg-grad', 'radial-gradient(ellipse at 50% 0%, #1a1a2e 0%, #0c0c14 70%)');
    root.style.setProperty('--text-primary', '#f0f0f5');
    root.style.setProperty('--text-tertiary', 'rgba(240, 240, 245, 0.5)');
    root.style.setProperty('--accent-primary', '#a78bfa');
    root.style.setProperty('--accent-cyan', '#a78bfa');
    root.style.setProperty('--accent-grad', 'linear-gradient(135deg, #a78bfa, #7c3aed)');
    root.style.setProperty('--accent-bg', 'rgba(139, 92, 246, 0.1)');
    root.style.setProperty('--accent-border', 'rgba(139, 92, 246, 0.35)');
    root.style.setProperty('--border-light', 'rgba(139, 92, 246, 0.15)');
    root.style.setProperty('--border-active', 'rgba(139, 92, 246, 0.5)');
    root.style.setProperty('--input-bg', 'rgba(255, 255, 255, 0.05)');
    root.style.setProperty('--input-border', 'rgba(139, 92, 246, 0.2)');
    root.style.setProperty('--success-color', '#34d399');
    root.style.setProperty('--success-bg', 'rgba(16, 185, 129, 0.1)');
    root.style.setProperty('--danger-color', '#ef4444');
    root.style.setProperty('--danger-bg', 'rgba(239, 68, 68, 0.1)');
    root.style.setProperty('--warn-color', '#f59e0b');
    root.style.setProperty('--warn-bg', 'rgba(245, 158, 11, 0.1)');
  } else if (themeId === 'purple') {
    // Light Purple
    root.style.setProperty('--bg-deep', '#f5f0ff');
    root.style.setProperty('--bg-surface', '#ffffff');
    root.style.setProperty('--bg-card', '#ffffff');
    root.style.setProperty('--bg-card-hover', '#faf5ff');
    root.style.setProperty('--bg-grad', 'linear-gradient(135deg, #f5f0ff 0%, #ede4ff 50%, #e8dff5 100%)');
    root.style.setProperty('--text-primary', '#1e1b4b');
    root.style.setProperty('--text-tertiary', '#6b6394');
    root.style.setProperty('--accent-primary', '#7c3aed');
    root.style.setProperty('--accent-cyan', '#7c3aed');
    root.style.setProperty('--accent-grad', 'linear-gradient(135deg, #8b5cf6, #6d28d9)');
    root.style.setProperty('--accent-bg', 'rgba(124, 58, 237, 0.08)');
    root.style.setProperty('--accent-border', 'rgba(124, 58, 237, 0.3)');
    root.style.setProperty('--border-light', '#e0d4f5');
    root.style.setProperty('--border-active', '#7c3aed');
    root.style.setProperty('--input-bg', '#ffffff');
    root.style.setProperty('--input-border', '#d4c4ed');
    root.style.setProperty('--success-color', '#047857');
    root.style.setProperty('--success-bg', '#ecfdf5');
    root.style.setProperty('--danger-color', '#b91c1c');
    root.style.setProperty('--danger-bg', '#fee2e2');
    root.style.setProperty('--warn-color', '#b45309');
    root.style.setProperty('--warn-bg', '#fef3c7');
  } else if (themeId === 'royal') {
    // Professional Royal (Slate & Champagne Gold)
    root.style.setProperty('--bg-deep', '#0a0d14');
    root.style.setProperty('--bg-surface', 'rgba(197, 160, 89, 0.03)');
    root.style.setProperty('--bg-card', 'rgba(197, 160, 89, 0.03)');
    root.style.setProperty('--bg-card-hover', 'rgba(197, 160, 89, 0.06)');
    root.style.setProperty('--bg-grad', 'radial-gradient(circle at 0% 0%, #161b22 0%, #0a0d14 100%)');
    root.style.setProperty('--text-primary', '#f0f4f8');
    root.style.setProperty('--text-tertiary', 'rgba(240, 244, 248, 0.55)');
    root.style.setProperty('--accent-primary', '#c5a059');
    root.style.setProperty('--accent-cyan', '#c5a059');
    root.style.setProperty('--accent-grad', 'linear-gradient(135deg, #d4b47a 0%, #c5a059 50%, #a68446 100%)');
    root.style.setProperty('--accent-bg', 'rgba(197, 160, 89, 0.08)');
    root.style.setProperty('--accent-border', 'rgba(197, 160, 89, 0.3)');
    root.style.setProperty('--border-light', 'rgba(197, 160, 89, 0.12)');
    root.style.setProperty('--border-active', 'rgba(197, 160, 89, 0.4)');
    root.style.setProperty('--input-bg', 'rgba(197, 160, 89, 0.02)');
    root.style.setProperty('--input-border', 'rgba(197, 160, 89, 0.15)');
    root.style.setProperty('--success-color', '#34d399');
    root.style.setProperty('--success-bg', 'rgba(16, 185, 129, 0.1)');
    root.style.setProperty('--danger-color', '#ef4444');
    root.style.setProperty('--danger-bg', 'rgba(239, 68, 68, 0.1)');
    root.style.setProperty('--warn-color', '#f59e0b');
    root.style.setProperty('--warn-bg', 'rgba(245, 158, 11, 0.1)');
  }
}


export const PageWrap = ({ children }) => (
  <div style={{ 
    padding: '0 clamp(12px, 4vw, 40px) 40px', 
    maxWidth: '1400px', 
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box'
  }}>
    <style>{`
      @media (max-width: 768px) {
        .admin-page-wrap { padding-bottom: 20px !important; }
      }
    `}</style>
    <div className="admin-page-wrap">{children}</div>
  </div>
)

export const PageTitle = ({ children, sub }) => (
  <div style={{ marginBottom: 40 }}>
    <h1 style={{ margin: 0, fontSize: 'clamp(32px, 6vw, 44px)', fontWeight: 800, color: T.text, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
      {children}
    </h1>
    {sub && <p style={{ margin: '8px 0 0', color: T.textSub, fontSize: 'clamp(15px, 3.5vw, 18px)', fontWeight: 500 }}>{sub}</p>}
  </div>
)

export const AdminCard = ({ children, style: extra = {}, glass = true, ...props }) => (
  <div className="admin-card" {...props} style={{
    background: glass ? 'rgba(15, 20, 30, 0.6)' : T.card,
    backdropFilter: glass ? 'blur(24px) saturate(1.2)' : 'none',
    WebkitBackdropFilter: glass ? 'blur(24px) saturate(1.2)' : 'none',
    border: `1px solid ${T.border}`,
    borderRadius: 20, padding: 'clamp(20px, 4vw, 28px)',
    boxShadow: '0 10px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    color: T.text,
    ...extra,
  }}>
    {children}
  </div>
)


export const SlideDrawer = ({ isOpen, onClose, title, children, width = 480 }) => (
  <>
    {isOpen && (
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(12px)', zIndex: 3000,
          animation: 'fadeIn 0.3s ease-out'
        }}
      />
    )}
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: 'min(100%, ' + (typeof width === 'number' ? width + 'px' : width) + ')',
      background: 'rgba(19, 23, 32, 0.95)', backdropFilter: 'blur(32px)', zIndex: 3001,
      boxShadow: '-20px 0 60px rgba(0,0,0,0.4)',
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid var(--border-glass)'
    }}>
      <div style={{ padding: '28px 36px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={22} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(24px, 6vw, 40px)' }}>
        {children}
      </div>
    </div>
  </>
)

export const StatCard = ({ icon, label, value, color, sub }) => (
  <AdminCard style={{ 
    display: 'flex', alignItems: 'center', gap: 'clamp(16px, 4vw, 24px)',
    border: `1.5px solid ${color ? `${color}30` : 'rgba(197, 160, 89, 0.15)'}`,
    boxShadow: `0 12px 40px rgba(0,0,0,0.25)`,
    padding: '24px'
  }}>
    <div style={{
      width: 'clamp(52px, 13vw, 64px)', height: 'clamp(52px, 13vw, 64px)', borderRadius: 16, flexShrink: 0,
      background: color ? `${color}12` : 'rgba(197, 160, 89, 0.08)',
      border: `1.5px solid ${color ? `${color}30` : 'rgba(197, 160, 89, 0.2)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 'clamp(24px, 5.5vw, 32px)', color: color || 'var(--accent-primary)',
    }}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
        {label}
      </div>
      <div style={{ fontSize: 'clamp(26px, 6vw, 36px)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginTop: 6 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6, opacity: 0.8 }}>{sub}</div>}
    </div>
  </AdminCard>
)

export const Table = ({ headers, rows, emptyMsg = 'No data found.' }) => (
  <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid var(--border-light)', background: 'rgba(0, 0, 0, 0.2)' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 600 }}>
      <thead>
        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-light)' }}>
          {headers.map((h, i) => (
            <th key={i} style={{
              padding: '20px 16px', textAlign: 'left',
              color: 'var(--text-tertiary)', fontWeight: 800,
              fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={headers.length} style={{
              padding: '48px 16px', textAlign: 'center',
              color: 'var(--text-tertiary)', fontSize: 14,
            }}>
              {emptyMsg}
            </td>
          </tr>
        ) : rows.map((row, ri) => (
          <tr key={ri} style={{
            borderBottom: ri < rows.length - 1 ? '1px solid var(--border-light)' : 'none',
            transition: 'background 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {row.map((cell, ci) => (
              <td key={ci} style={{ padding: '20px 16px', color: 'var(--text-primary)', verticalAlign: 'middle', fontSize: 15, fontWeight: 500 }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export const Badge = ({ children, color = 'var(--accent-cyan)', style = {} }) => {
  const isVar = String(color).startsWith('var(')
  const bg = isVar ? `rgba(167, 139, 250, 0.1)` : `${color}18`
  const border = isVar ? `1px solid ${color}` : `1px solid ${color}40`
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 20,
      background: bg, border: border,
      color, fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
      whiteSpace: 'nowrap',
      ...style
    }}>
      {children}
    </span>
  )
}

export const Input = ({ label, ...props }) => (
  <div style={{ width: '100%' }}>
    {label && <label style={{
      display: 'block', color: 'var(--text-tertiary)', fontSize: 10,
      fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8,
    }}>{label}</label>}
    <input style={{
      width: '100%', boxSizing: 'border-box',
      padding: '12px 16px', borderRadius: 12,
      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
      color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
    }} {...props} />
  </div>
)

export const Select = ({ label, children, ...props }) => (
  <div style={{ width: '100%' }}>
    {label && <label style={{
      display: 'block', color: 'var(--text-tertiary)', fontSize: 10,
      fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8,
    }}>{label}</label>}
    <select style={{
      width: '100%', boxSizing: 'border-box',
      padding: '12px 16px', borderRadius: 12,
      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
      color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
    }} {...props}>
      {children}
    </select>
  </div>
)

export const Btn = ({ children, variant = 'primary', size = 'md', ...props }) => {
  const styles = {
    primary: { background: 'var(--accent-cyan)', color: 'var(--bg-deep)', border: 'none' },
    outline: { background: 'rgba(25, 20, 10, 0.4)', color: 'var(--text-primary)', border: '1px solid rgba(212, 175, 55, 0.25)' },
    danger: { background: 'rgba(224, 85, 85, 0.1)', color: '#e05555', border: '1px solid rgba(224, 85, 85, 0.25)' },
    ghost: { background: 'var(--accent-bg)', color: 'var(--text-tertiary)', border: 'none' },
  }
  const sizes = {
    sm: { padding: '10px 16px', fontSize: 13 },
    md: { padding: '14px 24px', fontSize: 15 },
    lg: { padding: '18px 32px', fontSize: 16 },
  }
  return (
    <button className="admin-btn" style={{
      borderRadius: 12, fontWeight: 800, cursor: 'pointer',
      fontFamily: 'inherit', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      ...styles[variant], ...sizes[size],
      boxShadow: variant === 'primary' ? '0 8px 20px rgba(0, 229, 255, 0.3)' : 'none'
    }}
      onMouseEnter={e => { 
        e.currentTarget.style.transform = 'translateY(-2px)'; 
        e.currentTarget.style.boxShadow = variant === 'primary' 
          ? '0 12px 25px rgba(212, 175, 55, 0.5)' 
          : '0 8px 15px rgba(0, 0, 0, 0.2)';
      }}
      onMouseLeave={e => { 
        e.currentTarget.style.transform = 'translateY(0)'; 
        e.currentTarget.style.boxShadow = variant === 'primary' 
          ? '0 8px 20px rgba(212, 175, 55, 0.3)' 
          : 'none';
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      border: '3px solid rgba(212, 175, 55, 0.1)',
      borderTop: '3px solid var(--accent-cyan)',
      animation: 'spin 0.8s linear infinite',
    }} />
  </div>
)

export const Alert = ({ msg, type = 'error' }) => {
  const colors = { error: '#f43f5e', success: 'var(--accent-green)', warn: 'var(--accent-orange)' }
  const bgs = { error: 'rgba(244,63,94,0.1)', success: 'rgba(57,255,20,0.1)', warn: 'rgba(255,153,102,0.1)' }
  if (!msg) return null
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: bgs[type], border: `1px solid ${colors[type]}40`,
      color: colors[type], fontSize: 13, display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <AlertCircle size={16} style={{ flexShrink: 0 }} />
      {msg}
    </div>
  )
}

export const Modal = ({ isOpen, onClose, title, children, maxWidth = 440 }) => {
  if (!isOpen) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', padding: 20 }}>
      <AdminCard style={{ width: '100%', maxWidth, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </AdminCard>
    </div>
  )
}

export const Grid = ({ cols = 4, children, style: extra = {}, gap = 20 }) => (
  <div className="admin-grid" style={{
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: `clamp(12px, 2vw, ${gap}px)`,
    ...extra
  }}>
    <style>{`
      @media (max-width: 1400px) {
        .admin-grid { grid-template-columns: repeat(min(3, ${cols}), 1fr) !important; }
      }
      @media (max-width: 1024px) {
        .admin-grid { grid-template-columns: repeat(min(2, ${cols}), 1fr) !important; }
      }
      @media (max-width: 640px) {
        .admin-grid { grid-template-columns: 1fr !important; }
      }
    `}</style>
    {children}
  </div>
)

export const SectionHeader = ({ children }) => (
  <div style={{
    fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.15em',
    marginBottom: 20, marginTop: 12,
  }}>
    {children}
  </div>
)

export const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const fmtTime = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
export const fmtDateTime = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
    dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export const PackingTVView = ({ user, onClose }) => {
  const responses = user.dishResponses || {}
  const dishEntries = Object.entries(responses)
  
  return (
    <div style={{ 
      position: 'fixed', inset: 0, zIndex: 9999, 
      background: '#000', color: '#fff',
      display: 'flex', flexDirection: 'column',
      padding: '4vh 4vw', boxSizing: 'border-box',
      overflow: 'hidden', animation: 'fadeIn 0.3s ease-out'
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulseBorder { 
          0% { border-color: rgba(212, 175, 55, 0.2); } 
          50% { border-color: rgba(212, 175, 55, 1); } 
          100% { border-color: rgba(212, 175, 55, 0.2); } 
        }
      `}</style>

      {/* Absolute Top-Right Dismiss Button */}
      <button 
        onClick={onClose}
        style={{
          position: 'absolute', top: '3vh', right: '3vw',
          background: 'rgba(244, 63, 94, 0.15)', border: '2px solid rgba(244, 63, 94, 0.4)',
          color: '#f43f5e', width: '7vh', height: '7vh', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '3.5vh', fontWeight: 900, cursor: 'pointer', zIndex: 10005,
          boxShadow: '0 0 20px rgba(244, 63, 94, 0.2)',
          transition: 'all 0.2s',
          lineHeight: 1
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244, 63, 94, 0.3)'; e.currentTarget.style.transform = 'scale(1.1)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244, 63, 94, 0.15)'; e.currentTarget.style.transform = 'scale(1)' }}
      >
        ✕
      </button>

      {/* TOP HEADER: USER PROFILE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3vw' }}>
           <div style={{ 
             width: '12vh', height: '12vh', borderRadius: '3vh', background: 'var(--accent-grad)',
             display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5vh', fontWeight: 900, color: '#000'
           }}>
             {user.thali_number?.toString().charAt(0) || 'U'}
           </div>
           <div>
             <div style={{ fontSize: '3.5vh', fontWeight: 800, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.25em', display: 'flex', alignItems: 'center', gap: '2vh' }}>
               Thali Dispatch Station
               {user.currentDay && (
                 <span style={{ fontSize: '2.5vh', background: 'rgba(212, 175, 55, 0.15)', padding: '0.5vh 2vh', borderRadius: '1vh', color: '#fff', fontWeight: 900 }}>
                   {user.currentDay.toUpperCase()} • {user.currentMeal.toUpperCase()}
                 </span>
               )}
             </div>
             <div style={{ fontSize: '10vh', fontWeight: 1000, lineHeight: 1, letterSpacing: '-0.03em', marginTop: '1vh' }}>{user.name}</div>
           </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '4vh', color: 'var(--text-tertiary)', fontWeight: 700 }}>Thali Reference</div>
          <div style={{ fontSize: '15vh', fontWeight: 1000, lineHeight: 1, color: '#fff' }}>#{user.thali_number}</div>
        </div>
      </div>

      {/* DISH LIST - AUTOMATICALLY ADJUSTS GRID & FONT SIZES FOR 1-6 DISHES */}
      {user.status === 'Applied' ? (() => {
        const totalDishes = dishEntries.length
        const isMultiRow = totalDishes > 3
        
        // Define dynamic grid rows/columns
        let gridCols = 'repeat(3, 1fr)'
        if (totalDishes === 1) gridCols = '1fr'
        else if (totalDishes === 2) gridCols = 'repeat(2, 1fr)'
        else if (totalDishes === 3) gridCols = 'repeat(3, 1fr)'
        else if (totalDishes === 4) gridCols = 'repeat(2, 1fr)'
        else if (totalDishes >= 5) gridCols = 'repeat(3, 1fr)'

        const gridRows = isMultiRow ? 'repeat(2, 1fr)' : '1fr'

        // Scale styles dynamically
        const cardPadding = isMultiRow ? '2.5vh 2vw' : '5vh 2.5vw'
        const badgeSize = isMultiRow ? '7.5vh' : '10vh'
        const badgeFontSize = isMultiRow ? '3vh' : '4.5vh'
        const dishFontSize = isMultiRow ? 'clamp(14px, 3vh, 32px)' : 'clamp(20px, 4.5vh, 50px)'
        const dishMargin = isMultiRow ? '1.5vh 0' : '3vh 0'
        const tagPadding = isMultiRow ? '0.5vh 1.8vh' : '0.8vh 2.5vh'
        const tagFontSize = isMultiRow ? '1.8vh' : '2.5vh'
        const amountFontSize = isMultiRow ? 'clamp(26px, 6.5vh, 85px)' : 'clamp(36px, 9vh, 120px)'
        const labelFontSize = isMultiRow ? '1.5vh' : '1.8vh'

        return (
          <div style={{ 
            flex: 1, 
            display: 'grid', 
            gridTemplateColumns: gridCols,
            gridTemplateRows: gridRows,
            gap: isMultiRow ? '2vh 2vw' : '0 2.5vw', 
            width: '100%', 
            boxSizing: 'border-box',
            marginBottom: '2vh'
          }}>
            {dishEntries.map(([dish, pct], idx) => {
              const val = parseInt(pct) || 0
              const isRoti = dish.toLowerCase().includes('roti') || dish.toLowerCase().includes('naan')
              
              return (
                <div key={dish} style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  border: `clamp(4px, 0.8vh, 12px) solid ${val > 0 || pct === 'yes' ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '4vh',
                  display: 'flex', flexDirection: 'column', 
                  alignItems: 'center', justifyContent: 'space-between',
                  padding: cardPadding, position: 'relative', overflow: 'hidden',
                  boxShadow: val > 0 || pct === 'yes' ? '0 0 50px rgba(16, 185, 129, 0.15)' : 'none',
                  textAlign: 'center',
                  minWidth: 0
                }}>
                  {/* Vertical Fill Animation */}
                  <div style={{ 
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    height: isRoti ? (pct === 'yes' ? '100%' : '0%') : `${val}%`,
                    background: val > 75 || pct === 'yes' ? 'rgba(16, 185, 129, 0.2)' : (val > 0 ? 'rgba(212, 175, 55, 0.2)' : 'transparent'),
                    transition: 'height 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 1
                  }} />

                  {/* Index Badge */}
                  <div style={{ 
                    width: badgeSize, height: badgeSize, borderRadius: '2.5vh',
                    background: val > 0 || pct === 'yes' ? '#10b981' : 'rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: badgeFontSize, fontWeight: 1000, color: '#fff', zIndex: 2
                  }}>
                    {idx + 1}
                  </div>

                  {/* Dish Name */}
                  <div style={{ 
                    fontSize: dishFontSize, 
                    fontWeight: 1000, color: '#fff', 
                    textTransform: 'uppercase', letterSpacing: '0.01em',
                    margin: dishMargin, zIndex: 2,
                    lineHeight: 1.1,
                    wordBreak: 'break-word',
                    maxWidth: '100%'
                  }}>{dish}</div>
                  
                  {/* Portion/Quantity display */}
                  <div style={{ zIndex: 2, width: '100%' }}>
                    {val > 0 && !isRoti && (
                       <div style={{ 
                         display: 'inline-block', padding: tagPadding, borderRadius: '1.2vh', 
                         background: 'rgba(255,255,255,0.1)', color: 'var(--accent-gold)', 
                         fontSize: tagFontSize, fontWeight: 900, marginBottom: isMultiRow ? '0.8vh' : '1.5vh',
                         border: '1px solid rgba(255,255,255,0.1)'
                       }}>
                         {val === 100 ? 'FULL' : (val === 50 ? 'HALF' : (val === 25 ? 'QUARTER' : `${val}%`))}
                       </div>
                    )}
                    
                    <div style={{ 
                      fontSize: amountFontSize, 
                      fontWeight: 1000, color: '#fff', 
                      textShadow: '0 10px 30px rgba(0,0,0,0.5)', lineHeight: 1 
                    }}>
                      {isRoti ? (pct === 'yes' ? 'YES' : 'NO') : `${val}%`}
                    </div>

                    <div style={{ 
                      fontSize: labelFontSize, fontWeight: 800, 
                      color: 'var(--text-tertiary)', textTransform: 'uppercase', 
                      marginTop: '0.8vh', letterSpacing: '0.1em' 
                    }}>
                      {isRoti ? 'Response' : 'Portion'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })() : (
        <div style={{ 
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(244, 63, 94, 0.1)', border: '15px solid #f43f5e', borderRadius: '5vh'
        }}>
           <div style={{ fontSize: 'clamp(80px, 30vh, 500px)', fontWeight: 1000, color: '#f43f5e' }}>NO MEAL</div>
        </div>
      )}


      {/* FOOTER ACTION */}
      <div style={{ marginTop: '4vh', display: 'flex', justifyContent: 'center' }}>
        <button 
          onClick={onClose}
          style={{ 
            background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)', color: '#fff',
            padding: '2vh 6vh', borderRadius: '2vh', fontSize: '3vh', fontWeight: 800, cursor: 'pointer'
          }}
        >
          DISMISS (X)
        </button>
      </div>
    </div>
  )
}

export const SurveyResponseDisplay = ({ user, meal, day, onClose, onPrint }) => {
  const responses = user.dishResponses || {}
  const dishEntries = Object.entries(responses)
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 8 }}>
      {/* High-Contrast Status Banner */}
      <div style={{ 
        padding: '24px', borderRadius: 24, textAlign: 'center',
        background: user.status === 'Applied' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
        border: `2px solid ${user.status === 'Applied' ? '#10b981' : '#f43f5e'}`,
        animation: 'pulse 2s infinite'
      }}>
        <div style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', opacity: 0.7, marginBottom: 8 }}>Dispatch Decision</div>
        <div style={{ fontSize: 42, fontWeight: 900, color: user.status === 'Applied' ? '#10b981' : '#f43f5e' }}>
          {user.status === 'Applied' ? '✅ PROCEED' : '❌ NO MEAL'}
        </div>
      </div>

      {user.status === 'Applied' ? (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: 20 
        }}>
          {dishEntries.map(([dish, pct]) => {
            const val = parseInt(pct) || 0
            const isRoti = dish.toLowerCase().includes('roti') || dish.toLowerCase().includes('naan')
            
            return (
              <div key={dish} style={{ 
                aspectRatio: '1 / 1', 
                background: 'rgba(255,255,255,0.03)', 
                border: `2px solid ${val > 0 || pct === 'yes' ? 'var(--accent-gold)' : 'var(--border-glass)'}`,
                borderRadius: 32,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: val > 0 || pct === 'yes' ? '0 10px 30px rgba(212, 175, 55, 0.1)' : 'none'
              }}>
                <div style={{ 
                  position: 'absolute', 
                  bottom: 0, left: 0, right: 0, 
                  height: isRoti ? (pct === 'yes' ? '100%' : '0%') : `${val}%`,
                  background: val > 50 || pct === 'yes' ? 'var(--accent-grad)' : 'rgba(212, 175, 55, 0.2)',
                  opacity: 0.3,
                  transition: 'height 1s ease-out'
                }} />

                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12, textAlign: 'center', zIndex: 2 }}>{dish}</div>
                
                <div style={{ 
                  fontSize: isRoti ? 48 : 72, 
                  fontWeight: 950, 
                  color: val > 0 || pct === 'yes' ? '#fff' : 'var(--text-tertiary)',
                  textShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  zIndex: 2,
                  lineHeight: 1
                }}>
                  {isRoti ? (pct === 'yes' ? 'YES' : 'NO') : `${val}%`}
                </div>
                
                {val > 0 && !isRoti && (
                   <div style={{ 
                     marginTop: 12, padding: '4px 12px', borderRadius: 10, background: 'var(--accent-gold)', 
                     color: '#000', fontSize: 12, fontWeight: 900, zIndex: 2 
                   }}>
                     {val === 100 ? 'FULL PORTION' : 'HALF PORTION'}
                   </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
           No meal data for this session.
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <Btn variant="outline" style={{ flex: 1 }} onClick={onClose}>Dismiss</Btn>
        {onPrint && <Btn style={{ flex: 1 }} onClick={onPrint}>Print Label</Btn>}
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); opacity: 0.9; }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
