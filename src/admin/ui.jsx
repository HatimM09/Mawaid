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

// ── Skeleton Loading Blocks ──
const Skl = ({ w = '100%', h = 14, r, style = {} }) => (
  <div style={{
    height: h, width: w, borderRadius: r ?? h / 2,
    background: 'var(--border-light)',
    animation: 'skeletonPulse 1.5s ease-in-out infinite',
    ...style
  }} />
)

const SklBox = ({ w = '100%', h = 80, style = {} }) => (
  <div style={{
    height: h, width: w, borderRadius: 12,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-light)',
    animation: 'skeletonPulse 1.6s ease-in-out infinite',
    ...style
  }} />
)

export const Spinner = () => (
  <div style={{ padding: '20px clamp(12px, 4vw, 40px)', maxWidth: 1400, margin: '0 auto' }}>
    {/* Stat card skeletons */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 24 }}>
      {[1,2,3,4].map(i => (
        <SklBox key={i} h={100} style={{ borderRadius: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 20 }}>
          <Skl w='35%' h={10} style={{ marginBottom: 12 }} />
          <Skl w='55%' h={24} r={6} />
        </SklBox>
      ))}
    </div>
    {/* Table skeleton */}
    <SklBox h={60} style={{ marginBottom: 4 }}>
      <div style={{ padding: 20 }}>
        <Skl w='30%' h={12} />
      </div>
    </SklBox>
    {[1,2,3,4,5].map(i => (
      <SklBox key={i} h={50} style={{ borderRadius: 0, borderTop: 'none' }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 16 }}>
          <Skl w='25%' h={12} />
          <Skl w='20%' h={12} />
          <Skl w='35%' h={12} />
          <Skl w='15%' h={12} />
        </div>
      </SklBox>
    ))}
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

const pctColor = (val, isRoti, rotiVal) => {
  if (isRoti) {
    return rotiVal === 'yes'
      ? { fill: '#10b981', border: '#10b981', bg: 'rgba(16,185,129,0.15)', badge: '#10b981', shadow: 'rgba(16,185,129,0.25)', text: '#fff', tagBg: 'rgba(16,185,129,0.2)', tagBorder: 'rgba(16,185,129,0.3)', tagColor: '#10b981' }
      : { fill: '#f43f5e', border: '#f43f5e', bg: 'rgba(244,63,94,0.15)', badge: '#f43f5e', shadow: 'rgba(244,63,94,0.25)', text: '#fff', tagBg: 'rgba(244,63,94,0.2)', tagBorder: 'rgba(244,63,94,0.3)', tagColor: '#f43f5e' }
  }
  const n = parseInt(val) || 0
  if (n === 0) return { fill: '#6b7280', border: '#6b7280', bg: 'rgba(107,114,128,0.08)', badge: '#6b7280', shadow: 'rgba(107,114,128,0.08)', text: 'rgba(255,255,255,0.4)', tagBg: 'rgba(107,114,128,0.12)', tagBorder: 'rgba(107,114,128,0.2)', tagColor: '#9ca3af' }
  if (n <= 25) return { fill: '#f59e0b', border: '#f59e0b', bg: 'rgba(245,158,11,0.12)', badge: '#f59e0b', shadow: 'rgba(245,158,11,0.2)', text: '#fff', tagBg: 'rgba(245,158,11,0.2)', tagBorder: 'rgba(245,158,11,0.3)', tagColor: '#fbbf24' }
  if (n <= 50) return { fill: '#d4af37', border: '#d4af37', bg: 'rgba(212,175,55,0.12)', badge: '#d4af37', shadow: 'rgba(212,175,55,0.25)', text: '#fff', tagBg: 'rgba(212,175,55,0.2)', tagBorder: 'rgba(212,175,55,0.3)', tagColor: '#fcd34d' }
  return { fill: '#10b981', border: '#10b981', bg: 'rgba(16,185,129,0.12)', badge: '#10b981', shadow: 'rgba(16,185,129,0.25)', text: '#fff', tagBg: 'rgba(16,185,129,0.2)', tagBorder: 'rgba(16,185,129,0.3)', tagColor: '#34d399' }
}

export const PackingTVView = ({ user, onClose }) => {
  const responses = user.dishResponses || {}
  const dishEntries = Object.entries(responses)
  const [imgError, setImgError] = React.useState(false)
  
  return (
    <div style={{ 
      position: 'fixed', inset: 0, zIndex: 9999, 
      background: '#000', color: '#fff',
      display: 'flex', flexDirection: 'column',
      padding: '4vh 4vw', boxSizing: 'border-box',
      overflow: 'hidden', animation: 'fadeIn 0.3s ease-out',
      height: '100vh', width: '100vw'
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulseBorder { 
          0% { border-color: rgba(212, 175, 55, 0.2); } 
          50% { border-color: rgba(212, 175, 55, 1); } 
          100% { border-color: rgba(212, 175, 55, 0.2); } 
        }
        .tv-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3vh;
        }
        .tv-grid {
          display: grid;
          width: 100%;
          box-sizing: border-box;
          margin-bottom: 2vh;
        }
        @media (max-width: 768px) {
          .tv-header {
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 2vh !important;
            gap: 12px;
          }
          .tv-header-right {
            text-align: right !important;
          }
          .tv-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
        }
      `}</style>

      {/* Absolute Top-Right Dismiss Button */}
      <button 
        onClick={onClose}
        style={{
          position: 'absolute', top: '3vh', right: '3vw',
          background: 'rgba(244, 63, 94, 0.15)', border: '2px solid rgba(244, 63, 94, 0.4)',
          color: '#f43f5e', width: 'clamp(50px, 7vh, 80px)', height: 'clamp(50px, 7vh, 80px)', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'clamp(20px, 3.5vh, 36px)', fontWeight: 900, cursor: 'pointer', zIndex: 10005,
          boxShadow: '0 0 20px rgba(244, 63, 94, 0.2)',
          transition: 'all 0.2s',
          lineHeight: 1
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244, 63, 94, 0.3)'; e.currentTarget.style.transform = 'scale(1.1)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244, 63, 94, 0.15)'; e.currentTarget.style.transform = 'scale(1)' }}
      >
        ✕
      </button>

      {/* TOP HEADER: USER PROFILE WITH PIC */}
      <div className="tv-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2vw' }}>
           {user.avatar_url && !imgError ? (
             <img 
               src={user.avatar_url} 
               alt={user.name} 
               onError={() => setImgError(true)}
               style={{ 
                 width: 'clamp(60px, 12vh, 120px)', 
                 height: 'clamp(60px, 12vh, 120px)', 
                 borderRadius: '3vh', 
                 objectFit: 'cover',
                 border: '3px solid var(--accent-gold)',
                 boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                 flexShrink: 0 
               }} 
             />
           ) : (
             <div style={{ 
               width: 'clamp(60px, 12vh, 120px)', height: 'clamp(60px, 12vh, 120px)', borderRadius: '3vh', background: 'var(--accent-grad)',
               display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(24px, 5vh, 48px)', fontWeight: 900, color: '#000',
               flexShrink: 0,
               border: '3px solid var(--accent-gold)',
               boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
             }}>
               {(user.name || 'U').charAt(0).toUpperCase()}
             </div>
           )}
           <div>
             <div style={{ fontSize: 'clamp(16px, 3.5vh, 32px)', fontWeight: 800, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: '1.5vh', flexWrap: 'wrap' }}>
               Thali Dispatch Station
               {user.currentDay && (
                 <span style={{ fontSize: 'clamp(12px, 2.8vh, 20px)', background: 'rgba(212, 175, 55, 0.15)', padding: '4px 12px', borderRadius: '0.8vh', color: '#fff', fontWeight: 900 }}>
                   {user.currentDay.toUpperCase()} • {user.currentMeal.toUpperCase()}
                 </span>
               )}
             </div>
             <div style={{ fontSize: 'clamp(32px, 8vh, 80px)', fontWeight: 1000, lineHeight: 1.1, letterSpacing: '-0.02em', marginTop: '0.5vh' }}>{user.name}</div>
           </div>
        </div>
        
        <div className="tv-header-right" style={{ textAlign: 'right', marginRight: '80px' }}>
          <div style={{ fontSize: 'clamp(16px, 4vh, 30px)', color: 'var(--text-tertiary)', fontWeight: 700 }}>Thali Reference</div>
          <div style={{ fontSize: 'clamp(48px, 12vh, 120px)', fontWeight: 1000, lineHeight: 1, color: '#fff' }}>#{user.thali_number}</div>
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
        // Scale styles dynamically - made larger for readability
        const cardPadding = isMultiRow ? '2vh 2.5vw' : '3.5vh 3.5vw'
        const badgeSize = isMultiRow ? 'clamp(60px, 10vh, 110px)' : 'clamp(80px, 15vh, 150px)'
        const badgeFontSize = isMultiRow ? 'clamp(22px, 4.5vh, 44px)' : 'clamp(32px, 6.5vh, 60px)'
        const dishFontSize = isMultiRow ? 'clamp(28px, 5.5vh, 60px)' : 'clamp(38px, 8vh, 80px)'
        const dishMargin = isMultiRow ? '1.2vh 0' : '2vh 0'
        const tagPadding = isMultiRow ? '0.6vh 2vh' : '1vh 3vh'
        const tagFontSize = isMultiRow ? '2vh' : '2.8vh'
        const amountFontSize = isMultiRow ? 'clamp(38px, 9vh, 110px)' : 'clamp(56px, 13vh, 160px)'
        const labelFontSize = isMultiRow ? '1.8vh' : '2.6vh'

        return (
          <div className="tv-grid" style={{ 
            flex: 1, 
            minHeight: 0,
            gridTemplateColumns: gridCols,
            gridTemplateRows: gridRows,
            gap: isMultiRow ? '2vh 2vw' : '0 2.5vw', 
          }}>
            {dishEntries.map(([dish, pct], idx) => {
              const isCount = typeof pct === 'string' && !pct.endsWith('%') && pct !== 'yes' && pct !== 'no'
              const isRoti = dish.toLowerCase().includes('roti') || dish.toLowerCase().includes('naan')
              const val = parseInt(pct) || 0
              const fillHeight = isRoti ? (pct === 'yes' ? '100%' : '0%') : (isCount ? (val > 0 ? '100%' : '0%') : `${val}%`)
              const clr = pctColor(isCount || isRoti ? (val > 0 ? 100 : 0) : val, isRoti, pct)
              
              return (
                <div key={dish} style={{ 
                  background: clr.bg,
                  border: `clamp(3px, 0.6vh, 8px) solid ${clr.border}`,
                  borderRadius: '3vh',
                  display: 'flex', flexDirection: 'column', 
                  alignItems: 'center', justifyContent: 'space-between',
                  padding: cardPadding, position: 'relative', overflow: 'hidden',
                  boxShadow: `0 0 30px ${clr.shadow}`,
                  textAlign: 'center',
                  minWidth: 0,
                  height: '100%',
                  boxSizing: 'border-box'
                }}>
                  {/* Vertical Fill Animation */}
                  <div style={{ 
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    height: fillHeight,
                    background: clr.fill,
                    opacity: 0.12,
                    transition: 'height 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 1
                  }} />

                  {/* Index Badge */}
                  <div style={{ 
                    width: badgeSize, height: badgeSize, borderRadius: '50%',
                    background: clr.badge,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: badgeFontSize, fontWeight: 1000, color: '#fff', zIndex: 2,
                    boxShadow: `0 0 20px ${clr.shadow}`
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
                         display: 'inline-block', padding: tagPadding, borderRadius: '1vh', 
                         background: clr.tagBg, color: clr.tagColor, 
                         fontSize: tagFontSize, fontWeight: 900, marginBottom: '0.5vh',
                         border: `1px solid ${clr.tagBorder}`
                       }}>
                         {isCount ? `${val} pcs` : (val === 100 ? 'FULL' : (val === 50 ? 'HALF' : (val === 25 ? 'QUARTER' : `${val}%`)))}
                       </div>
                     )}
                      
                    <div style={{ 
                      fontSize: amountFontSize, 
                      fontWeight: 1000, color: clr.text, 
                      textShadow: `0 5px 15px ${clr.shadow}`, lineHeight: 1 
                    }}>
                      {isRoti ? (pct === 'yes' ? 'YES' : 'NO') : (isCount ? `${val}` : `${val}%`)}
                    </div>

                    <div style={{ 
                      fontSize: labelFontSize, fontWeight: 800, 
                      color: 'var(--text-tertiary)', textTransform: 'uppercase', 
                      marginTop: '0.4vh', letterSpacing: '0.1em' 
                    }}>
                      {isRoti ? 'Response' : (isCount ? 'Pieces' : 'Portion')}
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
          background: 'rgba(244, 63, 94, 0.1)', border: 'clamp(6px, 1.2vh, 16px) solid #f43f5e', borderRadius: '4vh',
          padding: '20px'
        }}>
           <div style={{ fontSize: 'clamp(48px, 16vh, 180px)', fontWeight: 1000, color: '#f43f5e', textAlign: 'center' }}>NO MEAL</div>
        </div>
      )}

      {/* FOOTER ACTION */}
      <div style={{ marginTop: '2vh', display: 'flex', justifyContent: 'center', paddingBottom: '1vh' }}>
        <button 
          onClick={onClose}
          style={{ 
            background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)', color: '#fff',
            padding: '2vh 6vh', borderRadius: '1.5vh', fontSize: 'clamp(18px, 3vh, 28px)', fontWeight: 800, cursor: 'pointer'
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
            const isCount = typeof pct === 'string' && !pct.endsWith('%') && pct !== 'yes' && pct !== 'no'
            const isRoti = dish.toLowerCase().includes('roti') || dish.toLowerCase().includes('naan')
            const val = parseInt(pct) || 0
            const fillHeight = isRoti ? (pct === 'yes' ? '100%' : '0%') : (isCount ? (val > 0 ? '100%' : '0%') : `${val}%`)
            
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
                  height: fillHeight,
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
                  {isRoti ? (pct === 'yes' ? 'YES' : 'NO') : (isCount ? `${val}` : `${val}%`)}
                </div>
                
                {val > 0 && !isRoti && (
                   <div style={{ 
                     marginTop: 12, padding: '4px 12px', borderRadius: 10, background: 'var(--accent-gold)', 
                     color: '#000', fontSize: 12, fontWeight: 900, zIndex: 2 
                   }}>
                     {isCount ? `${val} pcs` : (val === 100 ? 'FULL PORTION' : 'HALF PORTION')}
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

export const ErrorBanner = ({ message, onDismiss }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px', borderRadius: 14,
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#ef4444', fontSize: 13, fontWeight: 600,
    marginBottom: 16,
  }}>
    <AlertCircle size={18} style={{ flexShrink: 0 }} />
    <span style={{ flex: 1 }}>{message}</span>
    {onDismiss && (
      <button onClick={onDismiss} style={{
        background: 'none', border: 'none', color: '#ef4444',
        cursor: 'pointer', padding: 4, opacity: 0.7
      }}>
        <X size={16} />
      </button>
    )}
  </div>
)
