// src/admin/ui.jsx — shared admin UI primitives
import React from 'react'
import { AlertCircle } from 'lucide-react'

export const T = {
  bg:          '#0b0f1a',
  card:        '#141d2e',
  cardHover:   '#1a2540',
  border:      'rgba(196,156,90,0.14)',
  borderHover: 'rgba(196,156,90,0.32)',
  accent:      '#c49c5a',
  accentGrad:  'linear-gradient(135deg,#d4aa6a,#a87c40)',
  accentBg:    'rgba(196,156,90,0.10)',
  accentBorder:'rgba(196,156,90,0.30)',
  text:        '#f0ead8',
  textSub:     '#9aabb8',
  inputBg:     'rgba(255,255,255,0.04)',
  inputBorder: 'rgba(196,156,90,0.22)',
  success:     '#4aa36e',
  successBg:   'rgba(74,163,110,0.12)',
  danger:      '#e05555',
  dangerBg:    'rgba(220,60,60,0.10)',
  warn:        '#e09855',
  warnBg:      'rgba(220,152,85,0.12)',
}

export const PageWrap = ({ children }) => (
  <div style={{ padding: '28px 24px 48px', maxWidth: 1200, margin: '0 auto' }}>
    {children}
  </div>
)

export const PageTitle = ({ children, sub }) => (
  <div style={{ marginBottom: 28 }}>
    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: T.accent, letterSpacing: '0.02em' }}>
      {children}
    </h1>
    {sub && <p style={{ margin: '6px 0 0', color: T.textSub, fontSize: 14 }}>{sub}</p>}
  </div>
)

export const AdminCard = ({ children, style: extra = {} }) => (
  <div style={{
    background: T.card, border: `1px solid ${T.border}`,
    borderRadius: 16, padding: '20px 22px',
    ...extra,
  }}>
    {children}
  </div>
)

export const StatCard = ({ icon, label, value, color, sub }) => (
  <AdminCard style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{
      width: 48, height: 48, borderRadius: 14, flexShrink: 0,
      background: color ? `${color}18` : T.accentBg,
      border: `1px solid ${color ? `${color}40` : T.accentBorder}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 22,
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || T.accent, lineHeight: 1.2, marginTop: 2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>{sub}</div>}
    </div>
  </AdminCard>
)

export const Table = ({ headers, rows, emptyMsg = 'No data found.' }) => (
  <div style={{ overflowX: 'auto', borderRadius: 14, border: `1px solid ${T.border}` }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ background: 'rgba(196,156,90,0.08)', borderBottom: `1px solid ${T.border}` }}>
          {headers.map((h, i) => (
            <th key={i} style={{
              padding: '12px 16px', textAlign: 'left',
              color: T.textSub, fontWeight: 700,
              fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
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
              color: T.textSub, fontSize: 14,
            }}>
              {emptyMsg}
            </td>
          </tr>
        ) : rows.map((row, ri) => (
          <tr key={ri} style={{
            borderBottom: ri < rows.length - 1 ? `1px solid ${T.border}` : 'none',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = T.cardHover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {row.map((cell, ci) => (
              <td key={ci} style={{ padding: '14px 16px', color: T.text, verticalAlign: 'middle' }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export const Badge = ({ children, color = T.accent }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '3px 10px', borderRadius: 20,
    background: `${color}18`, border: `1px solid ${color}40`,
    color, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
  }}>
    {children}
  </span>
)

export const Input = ({ label, ...props }) => (
  <div>
    {label && <label style={{
      display: 'block', color: T.textSub, fontSize: 11,
      fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
    }}>{label}</label>}
    <input style={{
      width: '100%', boxSizing: 'border-box',
      padding: '12px 14px', borderRadius: 10,
      background: T.inputBg, border: `1px solid ${T.inputBorder}`,
      color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit',
    }} {...props} />
  </div>
)

export const Select = ({ label, children, ...props }) => (
  <div>
    {label && <label style={{
      display: 'block', color: T.textSub, fontSize: 11,
      fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
    }}>{label}</label>}
    <select style={{
      width: '100%', boxSizing: 'border-box',
      padding: '12px 14px', borderRadius: 10,
      background: T.card, border: `1px solid ${T.inputBorder}`,
      color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit',
    }} {...props}>
      {children}
    </select>
  </div>
)

export const Btn = ({ children, variant = 'primary', size = 'md', ...props }) => {
  const styles = {
    primary: { background: T.accentGrad, color: '#fff', border: 'none' },
    outline: { background: T.accentBg, color: T.accent, border: `1px solid ${T.accentBorder}` },
    danger:  { background: 'rgba(220,60,60,0.15)', color: T.danger, border: `1px solid rgba(220,60,60,0.3)` },
    ghost:   { background: 'transparent', color: T.textSub, border: `1px solid ${T.border}` },
  }
  const sizes = {
    sm: { padding: '7px 14px', fontSize: 12 },
    md: { padding: '11px 20px', fontSize: 14 },
    lg: { padding: '14px 28px', fontSize: 15 },
  }
  return (
    <button style={{
      borderRadius: 10, fontWeight: 700, cursor: 'pointer',
      fontFamily: 'inherit', transition: 'opacity 0.2s, transform 0.15s',
      display: 'inline-flex', alignItems: 'center', gap: 8,
      ...styles[variant], ...sizes[size],
    }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
      {...props}
    >
      {children}
    </button>
  )
}

export const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: '3px solid rgba(196,156,90,0.15)',
      borderTop: '3px solid #c49c5a',
      animation: 'spin 0.8s linear infinite',
    }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
)

export const Alert = ({ msg, type = 'error' }) => {
  const colors = { error: T.danger, success: T.success, warn: T.warn }
  const bgs = { error: T.dangerBg, success: T.successBg, warn: T.warnBg }
  if (!msg) return null
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 10,
      background: bgs[type], border: `1px solid ${colors[type]}40`,
      color: colors[type], fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <AlertCircle size={15} style={{ flexShrink: 0 }} />
      {msg}
    </div>
  )
}

export const Grid = ({ cols = 4, children }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: 16,
  }}>
    {children}
  </div>
)

export const SectionHeader = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, color: T.textSub,
    textTransform: 'uppercase', letterSpacing: '0.18em',
    marginBottom: 14, marginTop: 8,
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
