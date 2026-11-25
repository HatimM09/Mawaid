// src/admin/ui.jsx — shared admin UI primitives
import React, { useState, useEffect, useId, useRef } from 'react'
import {
  AlertCircle, X, Maximize2, Minimize2, Trash2, Volume2, VolumeX,
  Mic, MicOff, Sun, Moon, Clock, Sparkles, HelpCircle, History, RotateCcw,
  CheckCircle2, XCircle, Scan
} from 'lucide-react'
import { eraseSurveySlot } from '../lib/surveyRows'
import { isRotiItem } from '../hooks/useSurvey'
import { formatWeekRange, getCurrentMealByTime } from '../common/utils'
import { playScanSound, speakScanStatus } from './scanAudio'

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
  try {
    localStorage.setItem('almawaid_admin_theme', themeId)
  } catch {}

  if (themeId === 'obsidian') {
    // Pure OLED Obsidian & High-Contrast Champagne (Stitch Dark Flagship)
    root.style.setProperty('--bg-deep', '#06080c');
    root.style.setProperty('--bg-surface', 'rgba(18, 22, 34, 0.7)');
    root.style.setProperty('--bg-card', 'rgba(18, 22, 34, 0.7)');
    root.style.setProperty('--bg-card-hover', 'rgba(197, 160, 89, 0.08)');
    root.style.setProperty('--bg-grad', 'linear-gradient(180deg, #06080c 0%, #0d1118 100%)');
    root.style.setProperty('--text-primary', '#ffffff');
    root.style.setProperty('--text-tertiary', 'rgba(255, 255, 255, 0.65)');
    root.style.setProperty('--accent-primary', '#e5c07b');
    root.style.setProperty('--accent-cyan', '#e5c07b');
    root.style.setProperty('--accent-grad', 'linear-gradient(135deg, #e5c07b, #c5a059)');
    root.style.setProperty('--accent-bg', 'rgba(229, 192, 123, 0.1)');
    root.style.setProperty('--accent-border', 'rgba(229, 192, 123, 0.35)');
    root.style.setProperty('--border-light', 'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--border-active', 'rgba(229, 192, 123, 0.5)');
    root.style.setProperty('--input-bg', 'rgba(255, 255, 255, 0.03)');
    root.style.setProperty('--input-border', 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--success-color', '#10b981');
    root.style.setProperty('--success-bg', 'rgba(16, 185, 129, 0.12)');
    root.style.setProperty('--danger-color', '#f43f5e');
    root.style.setProperty('--danger-bg', 'rgba(244, 63, 94, 0.12)');
    root.style.setProperty('--warn-color', '#f59e0b');
    root.style.setProperty('--warn-bg', 'rgba(245, 158, 11, 0.12)');
  } else if (themeId === 'studio') {
    // Crisp Studio Daylight (Ultra High-Contrast Light for Packaging Kitchen Ambient Lighting)
    root.style.setProperty('--bg-deep', '#f8fafc');
    root.style.setProperty('--bg-surface', '#ffffff');
    root.style.setProperty('--bg-card', '#ffffff');
    root.style.setProperty('--bg-card-hover', '#f1f5f9');
    root.style.setProperty('--bg-grad', 'linear-gradient(180deg, #f8fafc 0%, #edf2f7 100%)');
    root.style.setProperty('--text-primary', '#0f172a');
    root.style.setProperty('--text-tertiary', '#475569');
    root.style.setProperty('--accent-primary', '#936c28');
    root.style.setProperty('--accent-cyan', '#936c28');
    root.style.setProperty('--accent-grad', 'linear-gradient(135deg, #b88628, #936c28)');
    root.style.setProperty('--accent-bg', 'rgba(184, 134, 40, 0.08)');
    root.style.setProperty('--accent-border', 'rgba(184, 134, 40, 0.3)');
    root.style.setProperty('--border-light', '#e2e8f0');
    root.style.setProperty('--border-active', '#b88628');
    root.style.setProperty('--input-bg', '#ffffff');
    root.style.setProperty('--input-border', '#cbd5e1');
    root.style.setProperty('--success-color', '#059669');
    root.style.setProperty('--success-bg', '#ecfdf5');
    root.style.setProperty('--danger-color', '#dc2626');
    root.style.setProperty('--danger-bg', '#fef2f2');
    root.style.setProperty('--warn-color', '#d97706');
    root.style.setProperty('--warn-bg', '#fffbeb');
  } else if (themeId === 'dark') {
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
  } else {
    // Default: Professional Royal (Slate & Champagne Gold)
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

export const getSystemTheme = () => {
  try {
    return localStorage.getItem('almawaid_admin_theme') || 'royal'
  } catch {
    return 'royal'
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
    background: glass ? 'var(--bg-surface)' : T.card,
    backdropFilter: glass ? 'blur(24px) saturate(1.2)' : 'none',
    WebkitBackdropFilter: glass ? 'blur(24px) saturate(1.2)' : 'none',
    border: `1px solid ${T.border}`,
    borderRadius: 20, padding: 'clamp(20px, 4vw, 28px)',
    boxShadow: '0 10px 40px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
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
      background: 'var(--bg-card)', backdropFilter: 'blur(32px)', zIndex: 3001,
      boxShadow: '-20px 0 60px rgba(0,0,0,0.4)',
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid var(--border-light)'
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

export const SrBadge = ({ num, prefix = '#' }) => {
  const formatted = typeof num === 'number' ? String(num).padStart(2, '0') : String(num)
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 32,
      height: 24,
      padding: '0 6px',
      borderRadius: 6,
      background: 'rgba(197, 160, 89, 0.08)',
      border: '1px solid rgba(197, 160, 89, 0.22)',
      color: 'var(--accent-primary)',
      fontFamily: "'Space Grotesk', 'JetBrains Mono', monospace",
      fontSize: 11,
      fontWeight: 700,
      fontVariantNumeric: 'tabular-nums',
      letterSpacing: '0.03em',
      lineHeight: 1
    }}>
      {prefix && !formatted.startsWith(prefix) ? `${prefix}${formatted}` : formatted}
    </span>
  )
}

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
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginTop: 4, fontFamily: "'Space Grotesk', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, opacity: 0.8 }}>{sub}</div>}
    </div>
  </AdminCard>
)

export const Table = ({ headers, rows, emptyMsg = 'No data found.', withSrNo = false, srHeader = 'Sr #' }) => {
  const isFirstHeaderSr = headers.length > 0 && /^(sr\.?|#|sr\s*#|sl\.?|s\.?no\.?)$/i.test(String(headers[0]).trim())
  
  const finalHeaders = (withSrNo && !isFirstHeaderSr) ? [srHeader, ...headers] : headers
  const finalRows = (withSrNo && !isFirstHeaderSr)
    ? rows.map((r, i) => [<SrBadge key={`sr-${i}`} num={i + 1} />, ...r])
    : rows

  const srColIndex = finalHeaders.findIndex(h => /^(sr\.?|#|sr\s*#|sl\.?|s\.?no\.?)$/i.test(String(h).trim()))

  return (
    <div className="admin-table-wrap" style={{ 
      overflowX: 'auto', 
      borderRadius: 16, 
      border: '1px solid var(--border-light)', 
      background: 'var(--bg-surface)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 600 }}>
        <thead>
          <tr style={{ background: 'var(--input-bg)', borderBottom: '1px solid var(--border-light)' }}>
            {finalHeaders.map((h, i) => {
              const isSr = i === srColIndex
              return (
                <th key={i} style={{
                  padding: isSr ? '16px 10px' : '16px 16px', 
                  textAlign: isSr ? 'center' : 'left',
                  width: isSr ? 56 : undefined,
                  color: 'var(--text-tertiary)', fontWeight: 800,
                  fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {finalRows.length === 0 ? (
            <tr>
              <td colSpan={finalHeaders.length} style={{
                padding: '48px 16px', textAlign: 'center',
                color: 'var(--text-tertiary)', fontSize: 14,
              }}>
                {emptyMsg}
              </td>
            </tr>
          ) : finalRows.map((row, ri) => (
            <tr key={ri} style={{
              borderBottom: ri < finalRows.length - 1 ? '1px solid var(--border-light)' : 'none',
              transition: 'background 0.18s ease-in-out',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(197, 160, 89, 0.035)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {row.map((cell, ci) => {
                const isSr = ci === srColIndex
                const renderedCell = (isSr && (typeof cell === 'number' || (typeof cell === 'string' && /^\d+$/.test(cell))))
                  ? <SrBadge num={cell} />
                  : cell

                return (
                  <td key={ci} style={{ 
                    padding: isSr ? '14px 10px' : '14px 16px', 
                    color: 'var(--text-primary)', 
                    verticalAlign: 'middle', 
                    fontSize: 14, 
                    fontWeight: 500,
                    textAlign: isSr ? 'center' : 'left',
                    width: isSr ? 56 : undefined
                  }}>
                    {renderedCell}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

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
  const reactId = useId()
  const baseAutoId = label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : 'field'
  const autoId = props.id || `${baseAutoId}_${reactId.replace(/:/g, '')}`
  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {label && <label htmlFor={autoId} style={{
        display: 'block', color: 'var(--text-tertiary)', fontSize: 10,
        fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8,
      }}>{label}</label>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input id={autoId} name={props.name || autoId} style={{
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
  const reactId = useId()
  const baseAutoId = label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : 'field'
  const autoId = props.id || `${baseAutoId}_${reactId.replace(/:/g, '')}`
  return (
    <div style={{ width: '100%' }}>
      {label && <label htmlFor={autoId} style={{
        display: 'block', color: 'var(--text-tertiary)', fontSize: 10,
        fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8,
      }}>{label}</label>}
      <select id={autoId} name={props.name || autoId} style={{
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

// (ErrorBanner is defined once at the bottom of this file.)

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

export const PackingTVView = ({ user, onClose, meal, day, currentMeal, mealOverride, dishInputConfig, onMealToggle, onScanMember, onTriggerCameraScan }) => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isErasing, setIsErasing] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  // ── TV Customization States ──
  const [tvTheme, setTvTheme] = useState(() => {
    try { return localStorage.getItem('almawaid_tv_theme') || 'dark' } catch { return 'dark' }
  })
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('almawaid_tv_sound') !== 'false' } catch { return true }
  })
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try { return localStorage.getItem('almawaid_tv_voice') === 'true' } catch { return false }
  })
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString('en-GB'))
  const [recentScans, setRecentScans] = useState(() => {
    try {
      const raw = sessionStorage.getItem('almawaid_tv_recent_scans')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  // Live ticking clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('en-GB')), 1000)
    return () => clearInterval(t)
  }, [])

  // Persist settings
  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev
      try { localStorage.setItem('almawaid_tv_sound', String(next)) } catch {}
      return next
    })
  }

  const toggleVoice = () => {
    setVoiceEnabled(prev => {
      const next = !prev
      try { localStorage.setItem('almawaid_tv_voice', String(next)) } catch {}
      return next
    })
  }

  const cycleTheme = () => {
    setTvTheme(prev => {
      const next = prev === 'dark' ? 'daylight' : prev === 'daylight' ? 'amber' : 'dark'
      try { localStorage.setItem('almawaid_tv_theme', next) } catch {}
      return next
    })
  }

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } catch (e) {
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

  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  const getTimeBasedMeal = () => getCurrentMealByTime()
  const [selectedMeal, setSelectedMeal] = useState(meal || (mealOverride && currentMeal ? currentMeal : getTimeBasedMeal()))
  useEffect(() => {
    if (meal) setSelectedMeal(meal)
  }, [meal])

  const displayMeal = selectedMeal || meal || getTimeBasedMeal()
  const activeDay = day || user?.currentDay || 'monday'

  const dayIdx = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(String(activeDay).toLowerCase())
  let dayFormatted = String(activeDay).toUpperCase()
  if (user?.week_id && dayIdx >= 0) {
    try {
      const mon = new Date(user.week_id + 'T00:00:00')
      const targetDate = new Date(mon)
      targetDate.setDate(mon.getDate() + dayIdx)
      const dateStr = targetDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      dayFormatted = `${String(activeDay).toUpperCase()} · ${dateStr.toUpperCase()}`
    } catch { /* invalid week_id */ }
  }

  const mealData = displayMeal === 'lunch' ? user?.lunch : user?.dinner
  const candidateDishes = (mealData?.dishes && Object.keys(mealData.dishes).filter(k => k !== '_status').length > 0)
    ? mealData.dishes
    : (user?.currentMeal === displayMeal && user?.dishResponses && Object.keys(user.dishResponses).filter(k => k !== '_status').length > 0
      ? user.dishResponses
      : (user?.[displayMeal]?.dishes || {}))
  const dishes = candidateDishes || {}
  const dishEntries = Object.entries(dishes).filter(([k]) => k !== '_status')
  const total = dishEntries.length

  const status = mealData?.status || (displayMeal === user?.currentMeal ? user?.status : null) || 'Not Submitted'
  const isStopped = !!user?.stopped

  const mealLabels = { lunch: 'LUNCH', dinner: 'DINNER' }
  const mealIcons = { lunch: '☀️', dinner: '🌙' }

  // ── SOUND & SPEECH SYNTHESIS TRIGGER ON SCAN ──
  useEffect(() => {
    if (!user) return
    const isProceed = status === 'Applied' && !isStopped
    if (soundEnabled) {
      playScanSound(isProceed ? 'proceed' : 'skip')
    }
    if (voiceEnabled) {
      speakScanStatus(user.thali_number, isStopped ? 'STOP THALI' : status, mealLabels[displayMeal])
    }

    // Record to recent scan history
    try {
      const thaliNum = user.thali_number || '—'
      const item = {
        id: user.user_id || user.id || thaliNum,
        thali: thaliNum,
        name: user.name || 'Member',
        status: isStopped ? 'STOP THALI' : status,
        meal: displayMeal,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      }
      const raw = sessionStorage.getItem('almawaid_tv_recent_scans')
      const list = raw ? JSON.parse(raw) : []
      const filtered = list.filter(x => x.thali !== thaliNum)
      const updated = [item, ...filtered].slice(0, 8)
      sessionStorage.setItem('almawaid_tv_recent_scans', JSON.stringify(updated))
      setRecentScans(updated)
    } catch {}
  }, [user?.thali_number, displayMeal, status, isStopped])

  // ── KEYBOARD SHORTCUTS FOR TV REMOTE & DIRECT BARCODE SCANNER ──
  useEffect(() => {
    let scanBuffer = ''
    let lastKeyTime = Date.now()

    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const now = Date.now()
      if (now - lastKeyTime > 180) scanBuffer = ''
      lastKeyTime = now

      // Hardware barcode/QR scanner sends Enter after rapid character input
      if (e.key === 'Enter') {
        const text = scanBuffer.trim()
        scanBuffer = ''
        if (text && (text.length >= 2 || text.toUpperCase().includes('ALMAWAID'))) {
          e.preventDefault()
          onScanMember?.(text)
          return
        }
        // Do not close TV screen on Enter to prevent accidental dismissals
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }

      if (e.key.length === 1) {
        scanBuffer += e.key
      }

      const k = e.key.toLowerCase()
      if (k === 'f') { e.preventDefault(); toggleFullscreen() }
      if (k === 'c') {
        if (onTriggerCameraScan) {
          e.preventDefault()
          onTriggerCameraScan()
        }
      }
      if (k === 'm') {
        e.preventDefault()
        const next = displayMeal === 'lunch' ? 'dinner' : 'lunch'
        setSelectedMeal(next)
        onMealToggle?.(next)
      }
      if (k === 't') { e.preventDefault(); cycleTheme() }
      if (k === 's') { e.preventDefault(); toggleSound() }
      if (k === 'v') { e.preventDefault(); toggleVoice() }
      if (k === '?' || k === '/') { e.preventDefault(); setShowShortcuts(s => !s) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [displayMeal, onMealToggle, onClose, onScanMember, onTriggerCameraScan])

  // Admin erase
  const canErase = !!(user?.user_id && user?.week_id)
  const handleErase = async () => {
    if (!canErase || isErasing) return
    const who = user?.name || ('#' + (user?.thali_number || 'member'))
    if (!window.confirm(`Erase the ${mealLabels[displayMeal]} response for ${who}?\n\nThis clears their ${displayMeal} choices for this day and cannot be undone.`)) return
    setIsErasing(true)
    try {
      const dayKey = String(activeDay || '').substring(0, 3).toLowerCase()
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

  const getResponseStyle = (dish, value, idx) => {
    const isRoti = isRotiItem(dish || '')
    const resolveIsCount = () => {
      if (isRoti) return false
      try {
        if (typeof value === 'string' && value.trim().endsWith('%')) return false
      } catch {}
      if (typeof value === 'object' && value !== null && value?.status) return true
      const dt = (mealData && mealData.dishTypes) || user.dishTypes || null
      if (dt && dish && dt[dish] !== undefined) {
        const t = String(dt[dish]).toLowerCase()
        if (t === 'count') return true
        if (t === 'percentage' || t === 'portion' || t === 'percent' || t === '%') return false
      }
      try {
        const cfg = dishInputConfig
        if (cfg) {
          const arrKey = `${String(day || '').toLowerCase()}_${displayMeal}`
          const arr = cfg[arrKey]
          if (Array.isArray(arr) && arr[idx] !== undefined) {
            if (arr[idx] === 'count') return true
            if (arr[idx] === 'percentage' || arr[idx] === 'portion') return false
          }
          const dishKey = (dish || '').toLowerCase().replace(/[^a-z0-9]/g, '_')
          const slotKey = `${String(day || '').toLowerCase()}_${displayMeal}_${idx}`
          if (cfg[slotKey] === 'count' || cfg[dishKey] === 'count' || cfg[dish] === 'count') return true
          if (cfg[slotKey] === 'percentage' || cfg[dishKey] === 'percentage' || cfg[dish] === 'percentage') return false
        }
      } catch {}
      if ((typeof value === 'object' && value !== null && value?.status) || (typeof value === 'string' && /person|ppl/i.test(value))) return true
      if (displayMeal === 'lunch' && typeof idx === 'number' && idx <= 3) return true
      return false
    }
    const isCount = resolveIsCount()

    if (status === 'Skipped' || isStopped) {
      return {
        bg: tvTheme === 'daylight' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.06)',
        border: '#ef4444',
        label: 'SKIP',
        labelColor: '#ef4444',
        fillPct: 0,
        glow: null,
        typeLabel: isRoti ? 'ROTI' : isCount ? 'COUNT' : 'PORTION',
        typeColor: '#ef4444'
      }
    }

    if (value === null || value === undefined || value === '') {
      if (isRoti && status === 'Applied') {
        return {
          bg: tvTheme === 'daylight' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.12)',
          border: '#10b981',
          label: 'YES',
          labelColor: '#10b981',
          fillPct: 100,
          glow: 'rgba(16, 185, 129, 0.6)',
          typeLabel: 'ROTI',
          typeColor: '#10b981'
        }
      }
      if (status === 'Applied' && isCount) {
        return {
          bg: tvTheme === 'daylight' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.12)',
          border: '#6366f1',
          label: '1 PERSON',
          labelColor: '#818cf8',
          fillPct: 50,
          glow: 'rgba(99, 102, 241, 0.6)',
          typeLabel: 'COUNT',
          typeColor: '#6366f1'
        }
      }
      if (status === 'Applied') {
        return {
          bg: tvTheme === 'daylight' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.15)',
          border: '#10b981',
          label: '100%',
          labelColor: '#34d399',
          fillPct: 100,
          glow: 'rgba(16, 185, 129, 0.6)',
          typeLabel: 'PORTION',
          typeColor: '#10b981'
        }
      }
      return {
        bg: tvTheme === 'daylight' ? '#f1f5f9' : 'rgba(255,255,255,0.03)',
        border: tvTheme === 'daylight' ? '#cbd5e1' : 'rgba(255,255,255,0.08)',
        label: '—',
        labelColor: tvTheme === 'daylight' ? '#64748b' : 'rgba(255,255,255,0.3)',
        fillPct: 0,
        glow: null,
        typeLabel: isRoti ? 'ROTI' : isCount ? 'COUNT' : 'PORTION',
        typeColor: '#6b7280'
      }
    }

    const strVal = String(typeof value === 'object' ? (value?.status || value?.value) : value).toLowerCase().trim()

    // ROTI
    if (isRoti) {
      const isExplicitNo = strVal === 'no' || strVal === 'false' || strVal === 'skip' || strVal === 'skipped'
      if (isExplicitNo) {
        return {
          bg: tvTheme === 'daylight' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          border: '#ef4444',
          label: 'NO',
          labelColor: '#ef4444',
          fillPct: 0,
          glow: 'rgba(239, 68, 68, 0.4)',
          typeLabel: 'ROTI',
          typeColor: '#ef4444'
        }
      }
      const numVal = parseInt(strVal, 10)
      const isCountRoti = !isNaN(numVal) && numVal > 0 && !strVal.endsWith('%')
      const displayLabel = isCountRoti ? `${numVal} ${numVal === 1 ? 'ROTI' : 'ROTIS'}` : 'YES'
      return {
        bg: tvTheme === 'daylight' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.12)',
        border: '#10b981',
        label: displayLabel,
        labelColor: '#10b981',
        fillPct: 100,
        glow: 'rgba(16, 185, 129, 0.6)',
        typeLabel: 'ROTI',
        typeColor: '#10b981'
      }
    }

    // COUNT
    if (isCount) {
      if (strVal === 'no' || value === 0 || (typeof value === 'object' && value.status === 'no')) {
        return {
          bg: 'rgba(239, 68, 68, 0.08)',
          border: '#ef4444',
          label: 'NO',
          labelColor: '#ef4444',
          fillPct: 0,
          glow: 'rgba(239, 68, 68, 0.4)',
          typeLabel: 'COUNT',
          typeColor: '#ef4444'
        }
      }
      const countVal = typeof value === 'object' ? (value.value || 1) : (parseInt(value) || 0)
      return {
        bg: tvTheme === 'daylight' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.12)',
        border: '#6366f1',
        label: `${countVal} ${countVal === 1 ? 'PERSON' : 'PERSONS'}`,
        labelColor: '#818cf8',
        fillPct: Math.min(100, countVal * 25),
        glow: 'rgba(99, 102, 241, 0.6)',
        typeLabel: 'COUNT',
        typeColor: '#6366f1'
      }
    }

    // PERCENTAGE / PORTION
    if (strVal === 'no') {
      return {
        bg: 'rgba(239, 68, 68, 0.08)',
        border: '#ef4444',
        label: '0%',
        labelColor: '#f87171',
        fillPct: 0,
        glow: 'rgba(239, 68, 68, 0.3)',
        typeLabel: 'PORTION',
        typeColor: '#ef4444'
      }
    }
    if (strVal === 'yes') {
      return {
        bg: tvTheme === 'daylight' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.15)',
        border: '#10b981',
        label: '100%',
        labelColor: '#34d399',
        fillPct: 100,
        glow: 'rgba(16, 185, 129, 0.6)',
        typeLabel: 'PORTION',
        typeColor: '#10b981'
      }
    }

    const n = parseInt(value) || 0
    if (n === 0) {
      return {
        bg: 'rgba(239, 68, 68, 0.08)',
        border: '#ef4444',
        label: '0%',
        labelColor: '#f87171',
        fillPct: 0,
        glow: 'rgba(239, 68, 68, 0.3)',
        typeLabel: 'PORTION',
        typeColor: '#ef4444'
      }
    }
    if (n <= 25) {
      return {
        bg: 'rgba(245, 158, 11, 0.12)',
        border: '#f59e0b',
        label: `${n}%`,
        labelColor: '#fbbf24',
        fillPct: n,
        glow: 'rgba(245, 158, 11, 0.4)',
        typeLabel: 'PORTION',
        typeColor: '#f59e0b'
      }
    }
    if (n <= 50) {
      return {
        bg: 'rgba(59, 130, 246, 0.12)',
        border: '#3b82f6',
        label: `${n}%`,
        labelColor: '#60a5fa',
        fillPct: n,
        glow: 'rgba(59, 130, 246, 0.5)',
        typeLabel: 'PORTION',
        typeColor: '#3b82f6'
      }
    }
    if (n <= 75) {
      return {
        bg: 'rgba(34, 211, 238, 0.12)',
        border: '#22d3ee',
        label: `${n}%`,
        labelColor: '#67e8f9',
        fillPct: n,
        glow: 'rgba(34, 211, 238, 0.45)',
        typeLabel: 'PORTION',
        typeColor: '#22d3ee'
      }
    }
    return {
      bg: 'rgba(16, 185, 129, 0.15)',
      border: '#10b981',
      label: `${n}%`,
      labelColor: '#34d399',
      fillPct: n,
      glow: 'rgba(16, 185, 129, 0.6)',
      typeLabel: 'PORTION',
      typeColor: '#10b981'
    }
  }

  // Dynamic Theme Styling Values
  const themeBg = tvTheme === 'daylight'
    ? 'linear-gradient(180deg, #f8fafc 0%, #edf2f7 100%)'
    : tvTheme === 'amber'
      ? 'linear-gradient(180deg, #0e0b06 0%, #17120a 100%)'
      : 'linear-gradient(180deg, #05070c 0%, #0c1017 100%)'

  const themeText = tvTheme === 'daylight' ? '#0f172a' : tvTheme === 'amber' ? '#fef3c7' : '#ffffff'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: themeBg, color: themeText,
      height: '100dvh', width: '100dvw',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      transition: 'background 0.3s ease, color 0.3s ease'
    }}>
      <style>{`
        .spin { animation: spin 1s linear infinite }
        @keyframes spin { to { transform: rotate(360deg) } }
        .tv-ctrl-btn {
          width: 42px; height: 42px; border-radius: 12px;
          display: flex; alignItems: center; justifyContent: center;
          cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(16px);
          outline: none;
        }
        .tv-ctrl-btn:hover {
          transform: translateY(-2px);
        }
        .tv-ctrl-btn:active {
          transform: scale(0.95);
        }
      `}</style>

      {/* ── TOP CONTROL BAR ── */}
      <div style={{
        position: 'absolute', top: '1.2vh', left: '1.5vw', right: '1.5vw',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 10000, pointerEvents: 'auto'
      }}>
        {/* Left: Fullscreen, Live Clock, Shortcuts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={toggleFullscreen}
            className="tv-ctrl-btn"
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
            style={{
              background: isFullscreen ? 'rgba(212,175,55,0.25)' : 'rgba(255,255,255,0.08)',
              border: `1.5px solid ${isFullscreen ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)'}`,
              color: isFullscreen ? '#fcd34d' : themeText,
            }}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          {/* Clock Pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 12,
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
            fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
            fontFamily: "'Space Grotesk', monospace", fontVariantNumeric: 'tabular-nums',
            color: themeText
          }}>
            <Clock size={13} style={{ opacity: 0.7 }} />
            {clock}
          </div>

          {/* Camera Scan Button */}
          {onTriggerCameraScan && (
            <button
              onClick={onTriggerCameraScan}
              className="tv-ctrl-btn"
              title="Scan QR Code with Camera (Press 'C')"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 12,
                background: 'linear-gradient(135deg, var(--accent-primary, #c5a059), #936c28)',
                border: 'none', color: '#000', fontSize: 11, fontWeight: 900,
                cursor: 'pointer', boxShadow: '0 2px 10px rgba(197, 160, 89, 0.4)'
              }}
            >
              <Scan size={14} />
              <span>SCAN QR</span>
            </button>
          )}

          {/* Wireless Scanner Status Indicator */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 12,
            background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
            fontSize: 11, fontWeight: 800, color: '#34d399', letterSpacing: '0.04em'
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            SCANNER READY
          </div>
        </div>

        {/* Right: Sound, Voice, Theme, Erase, Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Sound Chime Toggle */}
          <button
            onClick={toggleSound}
            className="tv-ctrl-btn"
            title={soundEnabled ? 'Chime Enabled (Press S to toggle)' : 'Chime Muted (Press S to toggle)'}
            style={{
              background: soundEnabled ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255,255,255,0.06)',
              border: `1.5px solid ${soundEnabled ? '#10b981' : 'rgba(255,255,255,0.15)'}`,
              color: soundEnabled ? '#34d399' : 'rgba(255,255,255,0.4)',
            }}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Speech Synthesis Voice Announce Toggle */}
          <button
            onClick={toggleVoice}
            className="tv-ctrl-btn"
            title={voiceEnabled ? 'Voice Announce ON (Press V to toggle)' : 'Voice Announce OFF (Press V to toggle)'}
            style={{
              background: voiceEnabled ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255,255,255,0.06)',
              border: `1.5px solid ${voiceEnabled ? '#6366f1' : 'rgba(255,255,255,0.15)'}`,
              color: voiceEnabled ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
            }}
          >
            {voiceEnabled ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          {/* TV Theme Mode Cycle */}
          <button
            onClick={cycleTheme}
            className="tv-ctrl-btn"
            title={`Current TV Theme: ${tvTheme.toUpperCase()} (Press T to cycle)`}
            style={{
              background: 'rgba(212,175,55,0.15)',
              border: '1.5px solid rgba(212,175,55,0.4)',
              color: '#fbbf24',
            }}
          >
            {tvTheme === 'dark' ? <Moon size={18} /> : tvTheme === 'daylight' ? <Sun size={18} /> : <Sparkles size={18} />}
          </button>

          {/* Keyboard Shortcuts Overlay Trigger */}
          <button
            onClick={() => setShowShortcuts(s => !s)}
            className="tv-ctrl-btn"
            title="TV Keyboard Shortcuts (?)"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1.5px solid rgba(255,255,255,0.15)',
              color: themeText,
            }}
          >
            <HelpCircle size={18} />
          </button>

          {/* Admin erase slot */}
          {canErase && (
            <button
              onClick={handleErase}
              disabled={isErasing}
              className="tv-ctrl-btn"
              title={`Erase ${mealLabels[displayMeal]} response`}
              style={{
                background: isErasing ? 'rgba(239,68,68,0.2)' : 'rgba(239, 68, 68, 0.12)',
                border: '1.5px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
              }}
            >
              {isErasing ? <span className="spin">⟳</span> : <Trash2 size={18} />}
            </button>
          )}

          {/* Close TV View */}
          <button
            onClick={onClose}
            className="tv-ctrl-btn"
            title="Close TV View (Esc / Space)"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              color: '#ffffff',
            }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ── COMPACT HEADER — High Distance Readability ── */}
      <div style={{
        flexShrink: 0,
        padding: 'clamp(52px, 8vh, 72px) clamp(16px, 3vw, 48px) clamp(4px, 1vh, 12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'clamp(10px, 2.5vw, 24px)',
        flexWrap: 'wrap'
      }}>
        {/* Thali badge & Member Name */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 14,
          background: tvTheme === 'daylight'
            ? 'linear-gradient(135deg, rgba(184,134,40,0.12), rgba(184,134,40,0.04))'
            : 'linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.06))',
          border: `2px solid ${tvTheme === 'daylight' ? '#b88628' : 'rgba(212,175,55,0.6)'}`,
          borderRadius: 'clamp(16px, 2vw, 24px)',
          padding: 'clamp(6px, 1vh, 12px) clamp(16px, 2vw, 32px)',
          boxShadow: '0 0 30px rgba(212,175,55,0.15)'
        }}>
          <span style={{
            fontSize: 'clamp(38px, 7vw, 92px)', fontWeight: 900,
            color: tvTheme === 'daylight' ? '#936c28' : '#ffffff',
            textShadow: tvTheme === 'daylight' ? 'none' : '0 0 30px rgba(212,175,55,0.6), 0 0 60px rgba(212,175,55,0.3)',
            letterSpacing: '0.04em',
            fontVariantNumeric: 'tabular-nums'
          }}>
            #{user?.thali_number || '—'}
          </span>
          {user?.name && (
            <span style={{
              fontSize: 'clamp(15px, 1.8vw, 28px)', fontWeight: 700,
              color: tvTheme === 'daylight' ? '#1e293b' : 'rgba(255,255,255,0.95)',
              maxWidth: 'clamp(140px, 22vw, 360px)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>{user.name}</span>
          )}
        </div>

        {/* Day badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: 'clamp(6px, 0.8vh, 10px) clamp(14px, 1.5vw, 24px)',
          background: tvTheme === 'daylight' ? 'rgba(0,0,0,0.05)' : 'rgba(212,175,55,0.1)',
          border: `2px solid ${tvTheme === 'daylight' ? '#94a3b8' : 'rgba(212,175,55,0.5)'}`,
          borderRadius: 50,
        }}>
          <span style={{ fontSize: 'clamp(14px, 1.8vw, 22px)' }}>📆</span>
          <span style={{
            fontSize: 'clamp(12px, 1.4vw, 18px)', fontWeight: 900,
            color: themeText,
            textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap'
          }}>{dayFormatted}</span>
        </div>

        {/* Meal Interactive Toggle Button */}
        <button
          onClick={() => {
            const next = displayMeal === 'lunch' ? 'dinner' : 'lunch'
            setSelectedMeal(next)
            onMealToggle?.(next)
          }}
          title="Click or press 'M' to switch meal"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: 'clamp(6px, 0.8vh, 10px) clamp(14px, 1.5vw, 24px)',
            background: displayMeal === 'lunch' ? 'rgba(245,158,11,0.18)' : 'rgba(99,102,241,0.18)',
            border: `2px solid ${displayMeal === 'lunch' ? '#f59e0b' : '#6366f1'}`,
            borderRadius: 50,
            cursor: 'pointer', transition: 'all 0.2s', outline: 'none'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <span style={{ fontSize: 'clamp(14px, 1.8vw, 22px)' }}>{mealIcons[displayMeal]}</span>
          <span style={{
            fontSize: 'clamp(12px, 1.4vw, 18px)', fontWeight: 900,
            color: displayMeal === 'lunch' ? '#f59e0b' : '#818cf8',
            textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap'
          }}>{mealLabels[displayMeal]}</span>
          <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 2, fontWeight: 700 }}>⇄</span>
          {mealOverride && (
            <span style={{
              fontSize: 9, fontWeight: 800, color: '#fbbf24',
              background: 'rgba(251, 191, 36, 0.2)', padding: '2px 8px', borderRadius: 10,
              textTransform: 'uppercase', letterSpacing: '0.08em'
            }}>MANUAL</span>
          )}
        </button>

        {/* Status banner */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: 'clamp(6px, 0.8vh, 10px) clamp(16px, 1.5vw, 26px)', borderRadius: 50,
          background: isStopped
            ? 'rgba(244, 63, 94, 0.18)'
            : status === 'Applied'
              ? 'rgba(16, 185, 129, 0.18)'
              : status === 'Skipped'
                ? 'rgba(239, 68, 68, 0.18)'
                : 'rgba(245, 158, 11, 0.18)',
          border: `2px solid ${isStopped ? '#f43f5e' : status === 'Applied' ? '#10b981' : status === 'Skipped' ? '#ef4444' : '#f59e0b'}`,
          boxShadow: `0 0 24px ${isStopped ? 'rgba(244,63,94,0.3)' : status === 'Applied' ? 'rgba(16,185,129,0.3)' : status === 'Skipped' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`
        }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%',
            background: isStopped ? '#f43f5e' : status === 'Applied' ? '#10b981' : status === 'Skipped' ? '#ef4444' : '#f59e0b',
            boxShadow: `0 0 16px ${isStopped ? '#f43f5e' : status === 'Applied' ? '#10b981' : status === 'Skipped' ? '#ef4444' : '#f59e0b'}`
          }} />
          <span style={{
            fontSize: 'clamp(11px, 1.2vw, 17px)', fontWeight: 900,
            color: isStopped ? '#f43f5e' : status === 'Applied' ? '#10b981' : status === 'Skipped' ? '#ef4444' : '#f59e0b',
            textTransform: 'uppercase', letterSpacing: '0.1em'
          }}>
            {isStopped ? '⏹️ STOP THALI' : status === 'Applied' ? '✅ PROCEED' : status === 'Skipped' ? '❌ SKIPPED' : '⏳ NO RESPONSE'}
          </span>
        </div>
      </div>

      {/* ── MAIN DISH GRID ── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(4px, 1.5vh, 16px) clamp(8px, 2vw, 32px)',
        overflow: 'hidden'
      }}>
        {isStopped ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(72px, 12vw, 140px)', marginBottom: 'clamp(8px, 1.5vh, 20px)', opacity: 0.25 }}>⏹️</div>
            <div style={{
              fontSize: 'clamp(40px, 7vw, 88px)',
              fontWeight: 900,
              color: '#f43f5e',
              textShadow: '0 0 40px rgba(244,63,94,0.5)',
              textTransform: 'uppercase', letterSpacing: '0.06em'
            }}>No Thali</div>
            <div style={{
              fontSize: 'clamp(20px, 2.6vw, 32px)',
              color: tvTheme === 'daylight' ? '#334155' : 'rgba(255,255,255,0.85)',
              fontWeight: 600,
              marginTop: 'clamp(8px, 1.5vh, 16px)'
            }}>
              {user.stopInfo?.from_date
                ? `Thali stopped ${new Date(user.stopInfo.from_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}\u00A0${user.stopInfo.to_date && user.stopInfo.to_date !== user.stopInfo.from_date ? `→ ${new Date(user.stopInfo.to_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`
                : 'This member has stopped their thali.'}
            </div>
            <div style={{ fontSize: 'clamp(14px, 1.8vw, 20px)', color: '#f43f5e', marginTop: 'clamp(6px, 1vh, 12px)', fontWeight: 700 }}>
              ⏹️ STOP THALI — NO DISPATCH
            </div>
          </div>
        ) : dishEntries.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: total === 1 ? 'minmax(300px, 600px)' : total === 5 ? 'repeat(3, 1fr)' : `repeat(auto-fit, minmax(min(${total <= 2 ? '45vw' : total <= 4 ? '32vw' : '22vw'}, 100%), 1fr))`,
            gap: 'clamp(10px, 1.4vw, 22px)',
            width: '100%',
            height: '100%',
            maxHeight: '100%',
            alignContent: 'center',
            justifyItems: total === 5 ? 'center' : 'stretch',
            gridTemplateRows: total === 5 ? 'repeat(2, 1fr)' : undefined
          }}>
            {dishEntries.map(([dish, value], idx) => {
              const style = getResponseStyle(dish, value, idx)

              return (
                <div key={dish} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'clamp(6px, 1.2vw, 16px) clamp(6px, 1vw, 16px)',
                  background: style.bg,
                  border: `2px solid ${style.border}`,
                  borderRadius: 'clamp(14px, 1.8vw, 24px)',
                  boxShadow: style.glow ? `0 0 30px ${style.glow}` : '0 4px 16px rgba(0,0,0,0.15)',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  animation: `fadeInDish 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.06}s both`
                }}>
                  {/* Visual Level Fill Bar on Card Bottom */}
                  {style.fillPct > 0 && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: '6px',
                      background: style.border,
                      opacity: 0.7
                    }}>
                      <div style={{ width: `${style.fillPct}%`, height: '100%', background: style.labelColor, transition: 'width 0.6s ease' }} />
                    </div>
                  )}

                  {/* Glow effect */}
                  {style.glow && tvTheme !== 'daylight' && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: `radial-gradient(ellipse at center, ${style.glow} 0%, transparent 70%)`,
                      pointerEvents: 'none', opacity: 0.35
                    }} />
                  )}

                  {/* Type Badge */}
                  {style.typeLabel && (
                    <div style={{
                      position: 'absolute', top: 'clamp(6px, 0.8vw, 12px)', right: 'clamp(6px, 0.8vw, 12px)',
                      zIndex: 2,
                      padding: 'clamp(2px, 0.3vw, 5px) clamp(6px, 0.7vw, 12px)',
                      borderRadius: 'clamp(4px, 0.5vw, 8px)',
                      background: `${style.typeColor}20`,
                      border: `1px solid ${style.typeColor}80`,
                      color: style.typeColor,
                      fontSize: 'clamp(9px, 0.75vw, 12px)',
                      fontWeight: 900,
                      letterSpacing: '0.08em',
                      fontFamily: "'Space Grotesk', sans-serif"
                    }}>
                      {style.typeLabel}
                    </div>
                  )}

                  {/* Dish Name */}
                  <div style={{
                    zIndex: 1, width: '100%',
                    fontSize: 'clamp(26px, min(6.5vw, 8.5vh), 80px)',
                    fontWeight: 800,
                    color: tvTheme === 'daylight' ? '#0f172a' : '#ffffff',
                    lineHeight: 1.1,
                    marginBottom: 'clamp(4px, 0.5vw, 10px)',
                    paddingRight: 'clamp(24px, 3vw, 44px)',
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

                  {/* Value */}
                  <div style={{
                    zIndex: 1,
                    fontSize: String(style.label || '').length > 6 ? 'clamp(24px, min(5.5vw, 7vh), 52px)' : 'clamp(46px, min(9.5vw, 12.5vh), 92px)',
                    fontWeight: 950,
                    color: style.labelColor,
                    fontFamily: "'Space Grotesk', sans-serif",
                    lineHeight: 0.95,
                    letterSpacing: '-0.02em',
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
          </div>
        )}
      </div>

      {/* ── RECENT SCAN HISTORY STRIP & DISMISS ── */}
      <div style={{
        flexShrink: 0,
        padding: 'clamp(6px, 1vh, 12px) clamp(16px, 2vw, 32px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap',
        background: tvTheme === 'daylight' ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.4)',
        borderTop: `1px solid ${tvTheme === 'daylight' ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}`
      }}>
        {/* Recent scans pill strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', flex: 1, paddingBottom: 2 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, color: tvTheme === 'daylight' ? '#64748b' : 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4
          }}>
            <History size={12} /> Recent:
          </span>
          {recentScans.length === 0 ? (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>No previous scans in session</span>
          ) : (
            recentScans.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 8,
                  background: r.status === 'STOP THALI'
                    ? 'rgba(244,63,94,0.15)'
                    : r.status === 'Applied'
                      ? 'rgba(16,185,129,0.15)'
                      : 'rgba(239,68,68,0.15)',
                  border: `1px solid ${r.status === 'STOP THALI' ? '#f43f5e' : r.status === 'Applied' ? '#10b981' : '#ef4444'}40`,
                  fontSize: 11, fontWeight: 700, color: themeText,
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ color: r.status === 'Applied' ? '#10b981' : '#f43f5e' }}>#{r.thali}</span>
                <span style={{ opacity: 0.6, fontSize: 9 }}>{r.time}</span>
              </div>
            ))
          )}
        </div>

        {/* Dismiss Button */}
        <button
          onClick={onClose}
          style={{
            padding: '8px 24px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.06)',
            color: themeText,
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer', transition: 'all 0.2s',
            fontFamily: "'Space Grotesk', sans-serif",
            textTransform: 'uppercase', letterSpacing: '0.06em'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
        >
          Dismiss (Space)
        </button>
      </div>

      {/* ── KEYBOARD SHORTCUTS POPUP OVERLAY ── */}
      {showShortcuts && (
        <div
          onClick={() => setShowShortcuts(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10001,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '90%', maxWidth: 440,
              background: '#121620', border: '1px solid var(--accent-border)',
              borderRadius: 20, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              color: '#ffffff'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-primary)' }}>⌨️ TV Remote & Scan Shortcuts</div>
              <button onClick={() => setShowShortcuts(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              {[
                { key: 'C', desc: 'Scan QR with Camera' },
                { key: 'Scanner', desc: 'Scan barcode/QR directly' },
                { key: 'F', desc: 'Toggle Fullscreen Mode' },
                { key: 'M', desc: 'Switch Lunch ☀️ / Dinner 🌙' },
                { key: 'T', desc: 'Cycle TV Theme (Dark / Daylight / Amber)' },
                { key: 'S', desc: 'Toggle Audio Chimes (On / Off)' },
                { key: 'V', desc: 'Toggle Voice Announcements (On / Off)' },
                { key: 'Esc', desc: 'Close TV View' },
              ].map(({ key, desc }) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{desc}</span>
                  <span style={{ background: 'rgba(197,160,89,0.15)', border: '1px solid rgba(197,160,89,0.3)', padding: '2px 8px', borderRadius: 6, fontWeight: 700, color: 'var(--accent-primary)', fontSize: 11, fontFamily: 'monospace' }}>
                    {key}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInDish {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

export const SurveyResponseDisplay = ({ user, onClose, onPrint }) => {
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

export const ErrorBanner = ({ message, msg, onDismiss }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px', borderRadius: 14,
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#ef4444', fontSize: 13, fontWeight: 600,
    marginBottom: 16,
  }}>
    <AlertCircle size={18} style={{ flexShrink: 0 }} />
    <span style={{ flex: 1 }}>{message || msg}</span>
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
