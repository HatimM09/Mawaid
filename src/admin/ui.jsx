// src/admin/ui.jsx — shared admin UI primitives
import React, { useState, useEffect } from 'react'
import { AlertCircle, X, Maximize2, Minimize2, Trash2 } from 'lucide-react'
import { eraseSurveySlot } from '../lib/surveyRows'

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
    root.style.setProperty('--bg-grad', 'linear-gradient(180deg, #0c0c14 0%, #1a1a2e 100%)');
    root.style.setProperty('--text-primary', '#f0f0f5');
    root.style.setProperty('--text-tertiary', 'rgba(240, 240, 245, 0.72)');
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
    root.style.setProperty('--bg-grad', 'linear-gradient(180deg, #f5f0ff 0%, #ede9fe 100%)');
    root.style.setProperty('--text-primary', '#1e1b4b');
    root.style.setProperty('--text-tertiary', '#4a4468');
    root.style.setProperty('--accent-primary', '#7c3aed');
    root.style.setProperty('--accent-cyan', '#7c3aed');
    root.style.setProperty('--accent-grad', 'linear-gradient(135deg, #7c3aed, #6d28d9)');
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
    root.style.setProperty('--bg-grad', 'linear-gradient(180deg, #0a0d14 0%, #141a24 100%)');
    root.style.setProperty('--text-primary', '#f0f4f8');
    root.style.setProperty('--text-tertiary', 'rgba(240, 244, 248, 0.72)');
    root.style.setProperty('--accent-primary', '#c5a059');
    root.style.setProperty('--accent-cyan', '#c5a059');
    root.style.setProperty('--accent-grad', 'linear-gradient(135deg, #c5a059, #d4af37)');
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
        <button onClick={onClose} aria-label="Close drawer" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    display: 'flex', alignItems: 'center', gap: 14,
    border: `1.5px solid ${color ? `${color}30` : 'rgba(197, 160, 89, 0.15)'}`,
    boxShadow: `0 12px 40px rgba(0,0,0,0.25)`,
    padding: '18px', overflow: 'hidden',
  }}>
    <div style={{
      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
      background: color ? `${color}12` : 'rgba(197, 160, 89, 0.08)',
      border: `1.5px solid ${color ? `${color}30` : 'rgba(197, 160, 89, 0.2)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, color: color || 'var(--accent-primary)',
    }}>
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginTop: 4 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, opacity: 0.8 }}>{sub}</div>}
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

export const Input = ({ label, rightAction, ...props }) => {
  const autoId = label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : undefined
  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {label && <label htmlFor={props.id || autoId} style={{
        display: 'block', color: 'var(--text-tertiary)', fontSize: 10,
        fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8,
      }}>{label}</label>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input id={props.id || autoId} name={props.name || autoId} style={{
          width: '100%', boxSizing: 'border-box',
          padding: '12px 16px', borderRadius: 12,
          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
          color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
          paddingRight: rightAction ? 40 : 16,
        }} {...props} />
        {rightAction && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', zIndex: 2 }}>{rightAction}</span>}
      </div>
    </div>
  )
}

export const Select = ({ label, children, ...props }) => {
  const autoId = label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : undefined
  return (
    <div style={{ width: '100%' }}>
      {label && <label htmlFor={props.id || autoId} style={{
        display: 'block', color: 'var(--text-tertiary)', fontSize: 10,
        fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8,
      }}>{label}</label>}
      <select id={props.id || autoId} name={props.name || autoId} style={{
        width: '100%', boxSizing: 'border-box',
        padding: '12px 16px', borderRadius: 12,
        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
        color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
      }} {...props}>
        {children}
      </select>
    </div>
  )
}

export const Btn = ({ children, variant = 'primary', size = 'md', ...props }) => {
  const styles = {
    primary: { background: 'var(--accent-cyan)', color: 'var(--bg-deep)', border: 'none' },
    solid: { background: 'var(--accent-gold)', color: 'var(--bg-deep)', border: 'none' },
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
      boxShadow: variant === 'primary' 
        ? '0 8px 20px rgba(0, 229, 255, 0.3)' 
        : variant === 'solid'
          ? '0 8px 20px rgba(212, 175, 55, 0.3)'
          : 'none'
    }}
      onMouseEnter={e => { 
        e.currentTarget.style.transform = 'translateY(-2px)'; 
        const isFilled = variant === 'primary' || variant === 'solid'
        e.currentTarget.style.boxShadow = isFilled 
          ? '0 12px 25px rgba(212, 175, 55, 0.5)' 
          : '0 8px 15px rgba(0, 0, 0, 0.2)';
      }}
      onMouseLeave={e => { 
        e.currentTarget.style.transform = 'translateY(0)'; 
        const isFilled = variant === 'primary' || variant === 'solid'
        e.currentTarget.style.boxShadow = isFilled 
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
          <button onClick={onClose} aria-label="Close modal" style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
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
  if (n <= 50) return { fill: '#d4af37', border: '#d4af37', bg: 'rgba(212,175,55,0.12)', badge: '#d4af37', shadow: 'rgba(212,175,55,0.25)', text: '#fff', tagBg: 'var(--border-light)', tagBorder: 'var(--accent-border)', tagColor: '#fcd34d' }
  return { fill: '#10b981', border: '#10b981', bg: 'rgba(16,185,129,0.12)', badge: '#10b981', shadow: 'rgba(16,185,129,0.25)', text: '#fff', tagBg: 'rgba(16,185,129,0.2)', tagBorder: 'rgba(16,185,129,0.3)', tagColor: '#34d399' }
}

export const PackingTVView = ({ user, onClose, meal, day, currentMeal, mealOverride }) => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isErasing, setIsErasing] = useState(false)

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } catch (e) {
        // Fullscreen not supported or denied
        console.warn('Fullscreen request failed:', e)
      }
    } else {
      try {
        await document.exitFullscreen()
        setIsFullscreen(false)
      } catch (e) {
        console.warn('Exit fullscreen failed:', e)
      }
    }
  }

  // Sync state when user exits via Escape or OS gesture;
  // also exit fullscreen on unmount so the admin isn't stuck in fullscreen after closing
  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  const getTimeBasedMeal = () => {
    const hour = new Date().getHours()
    const minutes = new Date().getMinutes()
    const timeInMinutes = hour * 60 + minutes
    if (timeInMinutes < 15 * 60) return 'lunch'
    if (timeInMinutes < 20 * 60) return 'dinner'
    return 'lunch'
  }

  const displayMeal = mealOverride && currentMeal ? currentMeal : (meal || getTimeBasedMeal())

  const mealData = displayMeal === 'lunch' ? user.lunch : user.dinner
  const dishes = mealData?.dishes || user.dishResponses || {}
  const dishEntries = Object.entries(dishes).filter(([k]) => k !== '_status')
  const total = dishEntries.length

  const status = mealData?.status || 'Not Submitted'

  const isStopped = !!user.stopped

  const mealLabels = { lunch: 'LUNCH', dinner: 'DINNER' }
  const mealIcons = { lunch: '☀️', dinner: '🌙' }

  // Admin: erase this member's displayed-meal response for the displayed day.
  // Clears survey_day_responses + flat mirror via the erase_survey_slot RPC,
  // AND survey_day_responses (granted slots) via erase_override_slot so
  // no stale override answer survives the erase.
  const canErase = !!(user?.user_id && user?.week_id)
  const handleErase = async () => {
    if (!canErase || isErasing) return
    const who = user?.name || ('#' + (user?.thali_number || 'member'))
    if (!window.confirm(`Erase the ${mealLabels[displayMeal]} response for ${who}?\n\nThis clears their ${displayMeal} choices for this day and cannot be undone.`)) return
    setIsErasing(true)
    try {
      const dayKey = String(day || '').substring(0, 3).toLowerCase()
      const { error } = await eraseSurveySlot(user.user_id, user.week_id, dayKey, displayMeal)
      if (error) throw error
      onClose()
    } catch (e) {
      console.error(e)
      alert('Erase failed: ' + (e?.message || 'make sure migration 039 has been applied.'))
    } finally {
      setIsErasing(false)
    }
  }

  const getResponseStyle = (value) => {
    if (value === null || value === undefined || value === '') {
      return { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.06)', label: '—', labelColor: 'rgba(255,255,255,0.15)', glow: null, typeLabel: '', typeColor: 'transparent' }
    }
    const strVal = String(value).toLowerCase()
    if (strVal === 'yes') {
      return { bg: 'rgba(16, 185, 129, 0.08)', border: '#10b981', label: 'YES', labelColor: '#10b981', glow: 'rgba(16, 185, 129, 0.5)', typeLabel: 'ROTI', typeColor: '#10b981' }
    }
    if (strVal === 'no') {
      return { bg: 'rgba(239, 68, 68, 0.08)', border: '#ef4444', label: 'NO', labelColor: '#ef4444', glow: 'rgba(239, 68, 68, 0.5)', typeLabel: 'ROTI', typeColor: '#ef4444' }
    }
    const num = parseInt(value) || 0
    const isPercent = typeof value === 'string' && value.endsWith('%')
    if (num > 0 || isPercent) {
      return {
        bg: 'rgba(212, 175, 55, 0.06)', border: 'rgba(212, 175, 55, 0.5)',
        label: isPercent ? (typeof value === 'string' ? value : `${num}%`) : `${num}`,
        labelColor: '#ffffff', glow: 'rgba(212, 175, 55, 0.5)',
        typeLabel: isPercent ? 'PCT' : 'COUNT',
        typeColor: '#fcd34d'
      }
    }
    return { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.06)', label: '0', labelColor: 'rgba(255,255,255,0.15)', glow: null, typeLabel: '', typeColor: 'transparent' }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#050508', color: '#fff',
      height: '100dvh', width: '100dvw',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Space Grotesk', 'Inter', sans-serif"
    }}>
      <style>{`.spin { animation: spin 1s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
      {/* Fullscreen toggle — top left */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        style={{
          position: 'fixed', top: '1.5vh', left: '1.5vw', zIndex: 10000,
          background: isFullscreen
            ? 'rgba(212,175,55,0.15)'
            : 'rgba(255,255,255,0.08)',
          border: `1.5px solid ${isFullscreen ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.15)'}`,
          color: isFullscreen ? '#fcd34d' : '#fff',
          width: 44, height: 44, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, cursor: 'pointer',
          transition: 'all 0.2s', backdropFilter: 'blur(20px)',
          boxShadow: isFullscreen ? '0 0 20px rgba(212,175,55,0.2)' : 'none'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(212,175,55,0.2)'
          e.currentTarget.style.borderColor = 'rgba(212,175,55,0.5)'
          e.currentTarget.style.color = '#fcd34d'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = isFullscreen ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.08)'
          e.currentTarget.style.borderColor = isFullscreen ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.15)'
          e.currentTarget.style.color = isFullscreen ? '#fcd34d' : '#fff'
        }}
      >
        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>

      {/* Admin erase — clears this member's displayed-meal response for the day */}
      {canErase && (
        <button
          onClick={handleErase}
          disabled={isErasing}
          title={`Erase ${mealLabels[displayMeal]} response for this member`}
          aria-label={`Erase ${mealLabels[displayMeal]} response`}
          style={{
            position: 'fixed', top: '1.5vh', right: '7vw', zIndex: 10000,
            background: isErasing ? 'rgba(239,68,68,0.2)' : 'rgba(239, 68, 68, 0.12)',
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5', width: 44, height: 44, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, cursor: isErasing ? 'wait' : 'pointer',
            transition: 'all 0.2s', backdropFilter: 'blur(20px)',
            boxShadow: '0 0 16px rgba(239,68,68,0.15)'
          }}
          onMouseEnter={e => { if (!isErasing) { e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.7)' } }}
          onMouseLeave={e => { if (!isErasing) { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)' } }}
        >
          {isErasing ? <span className="spin">⟳</span> : <Trash2 size={18} />}
        </button>
      )}

      {/* Close button */}
      <button onClick={onClose} style={{
        position: 'fixed', top: '1.5vh', right: '1.5vw', zIndex: 10000,
        background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)',
        color: '#fff', width: 44, height: 44, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 900, cursor: 'pointer',
        transition: 'all 0.2s', backdropFilter: 'blur(20px)'
      }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}>
        ✕
      </button>

      {/* ── COMPACT HEADER — Bright White for Distance Readability ── */}
      <div style={{
        flexShrink: 0,
        padding: 'clamp(44px, 6vh, 64px) clamp(16px, 3vw, 48px) clamp(4px, 1vh, 12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'clamp(12px, 3vw, 32px)',
        flexWrap: 'wrap'
      }}>
        {/* Thali badge - bright white with gold glow for distance visibility */}
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.06))',
          border: '2px solid rgba(212,175,55,0.6)', borderRadius: 'clamp(14px, 2vw, 24px)',
          padding: 'clamp(6px, 1vh, 12px) clamp(14px, 2vw, 28px)',
          boxShadow: '0 0 30px rgba(212,175,55,0.15), inset 0 0 20px rgba(212,175,55,0.05)'
        }}>
          <span style={{
            fontSize: 'clamp(40px, 8vw, 100px)', fontWeight: 900,
            color: '#ffffff',
            textShadow: '0 0 30px rgba(212,175,55,0.6), 0 0 60px rgba(212,175,55,0.3)',
            letterSpacing: '0.04em'
          }}>#{user?.thali_number || '—'}</span>
        </div>

        {/* Meal badge - bright text on darker bg */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: 'clamp(6px, 0.8vh, 10px) clamp(12px, 1.5vw, 22px)',
          background: 'rgba(212,175,55,0.08)', border: '2px solid rgba(212,175,55,0.4)', borderRadius: 50,
          boxShadow: '0 0 20px rgba(212,175,55,0.1)'
        }}>
          <span style={{ fontSize: 'clamp(14px, 1.8vw, 22px)' }}>{mealIcons[displayMeal]}</span>
          <span style={{
            fontSize: 'clamp(12px, 1.4vw, 18px)', fontWeight: 900,
            color: '#ffffff',
            textShadow: '0 0 12px rgba(212,175,55,0.4)',
            textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap'
          }}>{mealLabels[displayMeal]}</span>
          {mealOverride && (
            <span style={{
              fontSize: 9, fontWeight: 800, color: '#fbbf24',
              background: 'rgba(251, 191, 36, 0.2)', padding: '2px 8px', borderRadius: 10,
              textTransform: 'uppercase', letterSpacing: '0.08em'
            }}>MANUAL</span>
          )}
        </div>

        {/* Status badge - bright white status text with colored glow */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: 'clamp(6px, 0.8vh, 10px) clamp(14px, 1.5vw, 24px)', borderRadius: 50,
          background: status === 'Applied'
            ? 'rgba(16, 185, 129, 0.15)'
            : status === 'Skipped'
              ? 'rgba(239, 68, 68, 0.15)'
              : 'rgba(245, 158, 11, 0.15)',
          border: `2px solid ${status === 'Applied' ? 'rgba(16,185,129,0.6)' : status === 'Skipped' ? 'rgba(239,68,68,0.6)' : 'rgba(245,158,11,0.6)'}`,
          boxShadow: `0 0 24px ${status === 'Applied' ? 'rgba(16,185,129,0.15)' : status === 'Skipped' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}`
        }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%',
            background: status === 'Applied' ? '#10b981' : status === 'Skipped' ? '#ef4444' : '#f59e0b',
            boxShadow: `0 0 16px ${status === 'Applied' ? '#10b981' : status === 'Skipped' ? '#ef4444' : '#f59e0b'}`
          }} />
          <span style={{
            fontSize: 'clamp(11px, 1.2vw, 16px)', fontWeight: 800,
            color: '#ffffff',
            textShadow: isStopped
              ? '0 0 16px rgba(244,63,94,0.6)'
              : status === 'Applied'
                ? '0 0 16px rgba(16,185,129,0.5)'
                : status === 'Skipped'
                  ? '0 0 16px rgba(239,68,68,0.5)'
                  : '0 0 16px rgba(245,158,11,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.1em'
          }}>
            {isStopped ? '⏹️ STOP THALI' : status === 'Applied' ? '✅ PROCEED' : status === 'Skipped' ? '❌ SKIPPED' : '⏳ NO RESPONSE'}
          </span>
        </div>
      </div>

      {/* ── MAIN DISH GRID - FILLS FULL SCREEN ── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(6px, 1.5vh, 16px) clamp(8px, 2vw, 32px) clamp(8px, 1.5vh, 16px)',
        overflow: 'hidden'
      }}>
        {isStopped ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(72px, 12vw, 140px)', marginBottom: 'clamp(8px, 1.5vh, 20px)', opacity: 0.25 }}>⏹️</div>
            <div style={{
              fontSize: 'clamp(40px, 7vw, 88px)',
              fontWeight: 900,
              color: '#f43f5e',
              textShadow: '0 0 40px rgba(244,63,94,0.5), 0 0 80px rgba(244,63,94,0.2)',
              textTransform: 'uppercase', letterSpacing: '0.06em'
            }}>No Thali</div>
            <div style={{
              fontSize: 'clamp(20px, 2.6vw, 32px)',
              color: 'rgba(255,255,255,0.85)',
              fontWeight: 600,
              marginTop: 'clamp(8px, 1.5vh, 16px)'
            }}>
              {user.stopInfo?.from_date
                ? `Thali stopped ${new Date(user.stopInfo.from_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}\u00A0${user.stopInfo.to_date && user.stopInfo.to_date !== user.stopInfo.from_date ? `→ ${new Date(user.stopInfo.to_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`
                : 'This member has stopped their thali.'}
            </div>
            <div style={{ fontSize: 'clamp(14px, 1.8vw, 20px)', color: 'rgba(244,63,94,0.7)', marginTop: 'clamp(6px, 1vh, 12px)' }}>⏹️ STOP THALI — NO DISPATCH</div>
          </div>
        ) : dishEntries.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: total === 1 ? 'minmax(300px, 600px)' : total === 5 ? 'repeat(3, 1fr)' : `repeat(auto-fit, minmax(min(${total <= 2 ? '45vw' : total <= 4 ? '32vw' : '22vw'}, 100%), 1fr))`,
            gap: 'clamp(8px, 1.2vw, 20px)',
            width: '100%',
            height: '100%',
            maxHeight: '100%',
            alignContent: 'center',
            justifyItems: total === 5 ? 'center' : 'stretch',
            gridTemplateRows: total === 5 ? 'repeat(2, 1fr)' : undefined
          }}>
            {dishEntries.map(([dish, value], idx) => {
              const style = getResponseStyle(value)
              const isActive = value !== null && value !== undefined
              
              return (
                <div key={dish} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'clamp(4px, 1vw, 12px) clamp(4px, 0.8vw, 12px)',
                  background: style.bg,
                  border: `2px solid ${style.border}`,
                  borderRadius: 'clamp(12px, 1.5vw, 20px)',
                  boxShadow: style.glow ? `0 0 30px ${style.glow}` : '0 4px 16px rgba(0,0,0,0.3)',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  animation: `fadeInDish 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.08}s both`
                }}>
                  {/* Glow effect */}
                  {style.glow && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: `radial-gradient(ellipse at center, ${style.glow} 0%, transparent 70%)`,
                      pointerEvents: 'none', opacity: 0.4
                    }} />
                  )}

                  {/* Type Badge — bright white text with colored border for distance visibility */}
                  {style.typeLabel && (
                    <div style={{
                      position: 'absolute', top: 'clamp(4px, 0.6vw, 10px)', right: 'clamp(4px, 0.6vw, 10px)',
                      zIndex: 2,
                      padding: 'clamp(2px, 0.3vw, 6px) clamp(6px, 0.7vw, 12px)',
                      borderRadius: 'clamp(4px, 0.5vw, 8px)',
                      background: `${style.typeColor}15`,
                      border: `1px solid ${style.typeColor}60`,
                      color: '#ffffff',
                      textShadow: '0 0 10px rgba(255,255,255,0.3)',
                      fontSize: 'clamp(8px, 0.7vw, 12px)',
                      fontWeight: 900,
                      letterSpacing: '0.08em',
                      fontFamily: "'Space Grotesk', sans-serif"
                    }}>
                      {style.typeLabel}
                    </div>
                  )}

                  {/* Dish Name — BRIGHT WHITE with aura glow for distance readability */}
                  <div style={{
                    zIndex: 1, width: '100%',
                    fontSize: 'clamp(28px, min(7vw, 9vh), 88px)',
                    fontWeight: 800,
                    color: '#ffffff',
                    textShadow: '0 0 24px rgba(255,255,255,0.15), 0 2px 8px rgba(0,0,0,0.5)',
                    lineHeight: 1.1,
                    marginBottom: 'clamp(6px, 0.6vw, 12px)',
                    paddingRight: 'clamp(24px, 3vw, 48px)',
                    paddingLeft: 'clamp(4px, 0.5vw, 10px)',
                    wordBreak: 'break-word',
                    textAlign: 'center',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    boxSizing: 'border-box'
                  }}>
                    {dish}
                  </div>

                  {/* Value — BRIGHT WHITE with colored glow, visible from 20+ feet */}
                  <div style={{
                    zIndex: 1,
                    fontSize: 'clamp(48px, min(10vw, 13vh), 96px)',
                    fontWeight: 900,
                    color: '#ffffff',
                    fontFamily: "'Space Grotesk', sans-serif",
                    lineHeight: 0.95,
                    textShadow: style.glow
                      ? `0 0 40px ${style.glow}, 0 0 80px ${style.glow}, 0 2px 8px rgba(0,0,0,0.4)`
                      : '0 0 20px rgba(255,255,255,0.1)',
                    letterSpacing: '-0.03em',
                    marginTop: 'clamp(2px, 0.3vw, 6px)'
                  }}>
                    {style.label}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(40px, 6vw, 72px)', marginBottom: 16, opacity: 0.3 }}>🍽️</div>
            <div style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
              No dishes for {mealLabels[displayMeal].toLowerCase()}
            </div>
            <div style={{ fontSize: 'clamp(14px, 1.8vw, 18px)', color: 'rgba(255,255,255,0.25)' }}>
              Menu not available or no responses recorded
            </div>
          </div>
        )}
      </div>

      {/* ── DISMISS BUTTON ── */}
      <div style={{
        flexShrink: 0,
        padding: 'clamp(4px, 0.8vh, 10px) 0 clamp(8px, 1.5vh, 16px)',
        display: 'flex', justifyContent: 'center'
      }}>
        <button onClick={onClose} style={{
          padding: 'clamp(8px, 1vh, 14px) clamp(32px, 6vw, 56px)', borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
          color: 'rgba(255,255,255,0.4)',
          fontSize: 'clamp(12px, 1.2vw, 15px)', fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.2s',
          fontFamily: "'Space Grotesk', sans-serif",
          textTransform: 'uppercase', letterSpacing: '0.08em'
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
        >
          Dismiss
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        @keyframes fadeInDish {
          from { opacity: 0; transform: translateY(24px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

export const SurveyResponseDisplay = ({ user, meal, day, onClose, onPrint }) => {
  const responses = user.dishResponses || {}
  const dishEntries = Object.entries(responses).filter(([k]) => k !== '_status')
  const total = dishEntries.length
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 8 }}>
      {/* Status Banner */}
      <div style={{ 
        padding: 'clamp(16px, 3vw, 28px)', borderRadius: 20, textAlign: 'center',
        background: user.status === 'Applied' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
        border: `2px solid ${user.status === 'Applied' ? '#10b981' : '#f43f5e'}`,
      }}>
        <div style={{ fontSize: 'clamp(11px, 1.2vw, 14px)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.6, marginBottom: 6 }}>Dispatch Decision</div>
        <div style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, color: user.status === 'Applied' ? '#10b981' : '#f43f5e' }}>
          {user.status === 'Applied' ? '✅ PROCEED' : user.status === 'Skipped' ? '❌ SKIPPED' : '⏳ NO RESPONSE'}
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: total <= 2 ? `repeat(${total}, 1fr)` : `repeat(auto-fit, minmax(min(220px, 100%), 1fr))`,
        gap: 'clamp(12px, 2vw, 20px)',
        justifyItems: total === 5 ? 'center' : 'stretch'
      }}>
        {dishEntries.map(([dish, pct], idx) => {
          const isCount = pct !== null && typeof pct === 'string' && !pct.endsWith('%') && pct !== 'yes' && pct !== 'no'
          const isRoti = pct !== null && ['roti', 'naan', 'paratha', 'bread', 'chapati', 'puri'].some(k => dish.toLowerCase().includes(k))
          const val = pct !== null ? (parseInt(pct) || 0) : null
          const isActive = pct !== null && (pct === 'yes' || (isCount && val > 0) || (!isRoti && !isCount && val > 0))
          const fillHeight = pct === null ? '0%' : isRoti ? (pct === 'yes' ? '100%' : '0%') : (isCount ? (val > 0 ? '100%' : '0%') : `${val}%`)
          const color = isActive ? 'var(--accent-primary)' : 'rgba(239, 68, 68, 0.25)'
          
          return (
            <div key={dish} style={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'clamp(16px, 2.5vw, 28px)',
              background: isActive ? 'rgba(212, 175, 55, 0.04)' : 'rgba(255,255,255,0.02)', 
              border: `2px solid ${isActive ? 'var(--accent-border)' : 'rgba(239, 68, 68, 0.12)'}`,
              borderRadius: 'clamp(20px, 3vw, 32px)',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: isActive ? '0 8px 24px rgba(0,0,0,0.2)' : 'none',
              animation: `fadeInDishResp 0.4s ease-out ${idx * 0.06}s both`
            }}>
              {/* Bottom fill bar */}
              <div style={{ 
                position: 'absolute', 
                bottom: 0, left: 0, right: 0, 
                height: fillHeight,
                background: val !== null && (val > 50 || pct === 'yes') ? 'var(--accent-grad)' : 'rgba(212, 175, 55, 0.15)',
                opacity: 0.2,
                transition: 'height 1s ease-out'
              }} />

              {/* Type Badge */}
              {isActive && pct !== null && pct !== 'yes' && pct !== 'no' && (
                <div style={{
                  position: 'absolute', top: 'clamp(6px, 1vw, 12px)', right: 'clamp(6px, 1vw, 12px)',
                  zIndex: 3,
                  padding: '2px 8px', borderRadius: 6,
                  background: isCount ? 'rgba(197, 160, 89, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  border: `1px solid ${isCount ? '#c5a059' : '#f59e0b'}50`,
                  color: isCount ? '#c5a059' : '#f59e0b',
                  fontSize: 'clamp(8px, 1vw, 11px)',
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                  {isCount ? 'COUNT' : 'PCT'}
                </div>
              )}              <div style={{ 
        fontSize: 'clamp(18px, 2.5vw, 32px)', fontWeight: 900, 
        color: isActive ? '#ffffff' : 'rgba(239, 68, 68, 0.3)',
        textShadow: isActive ? '0 0 20px rgba(255,255,255,0.15), 0 2px 8px rgba(0,0,0,0.4)' : 'none',
        textTransform: 'uppercase', 
        marginBottom: 'clamp(6px, 1vw, 12px)', 
        textAlign: 'center', zIndex: 2,
        paddingRight: 'clamp(20px, 3vw, 48px)',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        wordBreak: 'break-word',
        boxSizing: 'border-box'
      }}>{dish}</div>
              
              <div style={{ 
        fontSize: isRoti ? 'clamp(40px, 7vw, 72px)' : 'clamp(48px, 10vw, 96px)', 
        fontWeight: 950, 
        color: '#ffffff',
        textShadow: isActive
          ? '0 0 30px rgba(212,175,55,0.4), 0 0 60px rgba(212,175,55,0.15), 0 2px 10px rgba(0,0,0,0.5)'
          : 'none',
        opacity: isActive ? 1 : 0.2,
        zIndex: 2,
        lineHeight: 1
      }}>
        {pct === null ? '—' : isRoti ? (pct === 'yes' ? 'YES' : 'NO') : (isCount ? `${val}` : `${val}%`)}
      </div>
              
              {val !== null && val > 0 && !isRoti && (
                 <div style={{ 
                   marginTop: 'clamp(8px, 1vw, 12px)', padding: '4px 12px', borderRadius: 8, background: 'var(--accent-grad)', 
                   color: '#000', fontSize: 'clamp(10px, 1vw, 12px)', fontWeight: 900, zIndex: 2 
                 }}>
                   {isCount ? `${val} person${val === '1' ? '' : 's'}` : (val === 100 ? 'FULL PORTION' : 'HALF PORTION')}
                 </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <Btn variant="outline" style={{ flex: 1 }} onClick={onClose}>Dismiss</Btn>
        {onPrint && <Btn style={{ flex: 1 }} onClick={onPrint}>Print Label</Btn>}
      </div>

      <style>{`
        @keyframes fadeInDishResp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
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
