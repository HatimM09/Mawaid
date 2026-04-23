// src/admin/ui.jsx — shared admin UI primitives
import React from 'react'
import { AlertCircle, X } from 'lucide-react'

export const T = {
  bg: 'var(--bg-deep)',
  bgGrad: 'var(--bg-grad)',
  card: 'var(--bg-surface)',
  cardGlass: 'rgba(25, 20, 10, 0.72)',
  cardHover: 'rgba(212, 175, 55, 0.08)',
  border: 'rgba(212, 175, 55, 0.2)',
  borderGlass: 'rgba(212, 175, 55, 0.25)',
  borderHover: 'rgba(212, 175, 55, 0.45)',
  accent: '#D4AF37',
  accentGrad: 'linear-gradient(135deg, #B8860B, #D4AF37)',
  accentBg: 'rgba(212, 175, 55, 0.1)',
  accentBorder: 'rgba(212, 175, 55, 0.3)',
  text: 'var(--text-primary)',
  textSub: 'var(--text-tertiary)',
  inputBg: 'rgba(25, 20, 10, 0.4)',
  inputBorder: 'rgba(212, 175, 55, 0.25)',
  success: '#5eba82',
  successBg: 'rgba(94, 186, 130, 0.12)',
  danger: '#e05555',
  dangerBg: 'rgba(224, 85, 85, 0.1)',
  warn: '#d4882a',
  warnBg: 'rgba(212, 136, 42, 0.1)',
  glow: '0 0 15px rgba(212, 175, 55, 0.3)'
}

export const updateSystemTheme = (themeId) => {
  const root = document.documentElement;
  if (themeId === 'midnight') {
    root.style.setProperty('--bg-deep', '#0f0c08');
    root.style.setProperty('--bg-surface', '#1a160e');
    root.style.setProperty('--bg-grad', 'radial-gradient(circle at 50% -20%, #2a2010 0%, #0f0c08 80%)');
    root.style.setProperty('--text-primary', '#FFF8E1');
    root.style.setProperty('--text-tertiary', 'rgba(255, 248, 225, 0.6)');
    root.style.setProperty('--accent-cyan', '#D4AF37');
    root.style.setProperty('--border-glass', 'rgba(212, 175, 55, 0.2)');
  } else if (themeId === 'ivory') {
    root.style.setProperty('--bg-deep', '#faf6ef');
    root.style.setProperty('--bg-surface', '#ffffff');
    root.style.setProperty('--bg-grad', 'linear-gradient(160deg,#faf6ef 0%,#f3ece0 60%,#faf6ef 100%)');
    root.style.setProperty('--text-primary', '#2a1a0e');
    root.style.setProperty('--text-tertiary', 'rgba(42, 26, 14, 0.6)');
    root.style.setProperty('--accent-cyan', '#9c5a2a');
    root.style.setProperty('--border-glass', 'rgba(156, 90, 42, 0.2)');
  } else if (themeId === 'forest') {
    root.style.setProperty('--bg-deep', '#13110a');
    root.style.setProperty('--bg-surface', '#1e1c14');
    root.style.setProperty('--bg-grad', 'linear-gradient(160deg,#13110a 0%,#1e1c14 60%,#13110a 100%)');
    root.style.setProperty('--text-primary', '#f5f0e8');
    root.style.setProperty('--text-tertiary', 'rgba(245, 240, 232, 0.6)');
    root.style.setProperty('--accent-cyan', '#b89e50');
    root.style.setProperty('--border-glass', 'rgba(184, 158, 80, 0.2)');
  }
}

export const PageWrap = ({ children }) => (
  <div style={{ padding: '0 12px 100px', maxWidth: '1600px', margin: '0 auto' }}>
    <style>{`
      @media (max-width: 768px) {
        .admin-page-wrap { padding-bottom: 80px !important; }
      }
    `}</style>
    <div className="admin-page-wrap">{children}</div>
  </div>
)

export const PageTitle = ({ children, sub }) => (
  <div style={{ marginBottom: 32 }}>
    <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 800, color: T.text, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
      {children}
    </h1>
    {sub && <p style={{ margin: '6px 0 0', color: T.textSub, fontSize: 'clamp(13px, 3vw, 15px)', fontWeight: 500 }}>{sub}</p>}
  </div>
)

export const AdminCard = ({ children, style: extra = {}, glass = true }) => (
  <div className="admin-card" style={{
    background: glass ? 'rgba(15, 12, 8, 0.75)' : 'var(--bg-surface)',
    backdropFilter: glass ? 'blur(28px) saturate(1.3)' : 'none',
    WebkitBackdropFilter: glass ? 'blur(28px) saturate(1.3)' : 'none',
    border: '1px solid rgba(212, 175, 55, 0.15)',
    borderRadius: 24, padding: 'clamp(16px, 4vw, 24px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    color: 'var(--text-primary)',
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
      background: 'rgba(19, 23, 32, 0.9)', backdropFilter: 'blur(32px)', zIndex: 3001,
      boxShadow: '-20px 0 60px rgba(0,0,0,0.4)',
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid var(--border-glass)'
    }}>
      <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={18} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(20px, 5vw, 32px)' }}>
        {children}
      </div>
    </div>
  </>
)

export const StatCard = ({ icon, label, value, color, sub }) => (
  <AdminCard style={{ 
    display: 'flex', alignItems: 'center', gap: 'clamp(12px, 3vw, 16px)',
    border: `1px solid ${color ? `${color}40` : 'rgba(212, 175, 55, 0.25)'}`,
    boxShadow: `0 8px 30px ${color ? `${color}15` : 'rgba(212, 175, 55, 0.15)'}`
  }}>
    <div style={{
      width: 'clamp(40px, 10vw, 48px)', height: 'clamp(40px, 10vw, 48px)', borderRadius: 14, flexShrink: 0,
      background: color ? `${color}18` : 'rgba(212, 175, 55, 0.12)',
      border: `1px solid ${color ? `${color}40` : 'rgba(212, 175, 55, 0.3)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 'clamp(18px, 4vw, 22px)', color: color || 'var(--accent-cyan)',
      boxShadow: `0 0 15px ${color ? `${color}30` : 'rgba(212, 175, 55, 0.2)'}`
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        {label}
      </div>
      <div style={{ fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, marginTop: 2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>}
    </div>
  </AdminCard>
)

export const Table = ({ headers, rows, emptyMsg = 'No data found.' }) => (
  <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid rgba(212, 175, 55, 0.15)', background: 'rgba(15, 12, 8, 0.3)' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 600 }}>
      <thead>
        <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-light)' }}>
          {headers.map((h, i) => (
            <th key={i} style={{
              padding: '12px 16px', textAlign: 'left',
              color: 'var(--text-tertiary)', fontWeight: 700,
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
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
              padding: '40px 16px', textAlign: 'center',
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
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {row.map((cell, ci) => (
              <td key={ci} style={{ padding: '14px 16px', color: 'var(--text-primary)', verticalAlign: 'middle' }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export const Badge = ({ children, color = 'var(--accent-cyan)' }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '3px 10px', borderRadius: 20,
    background: `${color}18`, border: `1px solid ${color}40`,
    color, fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  }}>
    {children}
  </span>
)

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
    ghost: { background: 'transparent', color: 'var(--text-tertiary)', border: 'none' },
  }
  const sizes = {
    sm: { padding: '8px 14px', fontSize: 12 },
    md: { padding: '12px 20px', fontSize: 13 },
    lg: { padding: '16px 28px', fontSize: 14 },
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

export const Grid = ({ cols = 4, children, style: extra = {} }) => (
  <div className="admin-grid" style={{
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: 20,
    ...extra
  }}>
    <style>{`
      @media (max-width: 1024px) {
        .admin-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 16px !important; }
      }
      @media (max-width: 600px) {
        .admin-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
      }
    `}</style>
    {children}
  </div>
)

export const SectionHeader = ({ children }) => (
  <div style={{
    fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.15em',
    marginBottom: 16, marginTop: 8,
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

