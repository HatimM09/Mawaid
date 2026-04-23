// src/admin/InventoryManagerPortal.jsx
import React, { useState, useEffect } from 'react'
import { 
  Home, Package, LogOut, TrendingUp, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, History, Search, RefreshCw, 
  Plus, X, Clock, ShieldCheck
} from 'lucide-react'
import { supabase } from './supabaseClient'
import { T as SharedT, updateSystemTheme } from './ui'
import InventoryPage from './InventoryPage'

const T = SharedT

const Spinner = ({ fullPage = true }) => (
  <div style={fullPage ? { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' } : {}}>
    <div className="spin" style={{ width: 34, height: 34, border: `2.5px solid rgba(196,156,90,0.2)`, borderTop: `2.5px solid ${T.accent}`, borderRadius: '50%' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }.spin { animation: spin 0.8s linear infinite; }`}</style>
  </div>
)

const PortalCard = ({ title, value, icon, color = T.accent, sub }) => (
  <div style={{ 
    background: 'rgba(15, 12, 8, 0.75)', border: `1px solid ${T.border}`,
    borderRadius: 24, padding: 24, backdropFilter: 'blur(28px) saturate(1.3)',
    WebkitBackdropFilter: 'blur(28px) saturate(1.3)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)', flex: 1, minWidth: 200,
    position: 'relative', overflow: 'hidden'
  }}>
    <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, background: `radial-gradient(circle at top right, ${color}15, transparent 70%)`, pointerEvents: 'none' }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 16, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color }}>
        {icon}
      </div>
      {sub && <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, opacity: 0.8 }}>{sub}</span>}
    </div>
    <div style={{ fontSize: 13, color: 'rgba(255, 248, 225, 0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans', sans-serif" }}>{title}</div>
    <div style={{ fontSize: 32, fontWeight: 900, color: '#FFF8E1', marginTop: 4, fontFamily: "'Cinzel', serif" }}>{value}</div>
  </div>
)

export default function InventoryManagerPortal({ signOut, user }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [staffInfo, setStaffInfo] = useState({ name: 'Inventory Manager', role: 'Inventory' })
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, recentTx: 0 })

  useEffect(() => {
    const savedTheme = localStorage.getItem('almawaid_theme') || 'midnight'
    updateSystemTheme(savedTheme)
    
    if (user?.role) {
      // If we already have the staff data (e.g. from mock login), use it directly
      setStaffInfo(user)
      setLoading(false)
    } else if (user?.id) {
      // Otherwise fetch it (for real Supabase Auth sessions)
      supabase.from('staff').select('*').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => { if (data) setStaffInfo(data) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
    
    loadStats()
  }, [user])

  const loadStats = async () => {
    const { data: inv } = await supabase.from('inventory').select('*')
    const { data: logs } = await supabase.from('inventory_log').select('*').limit(10).order('created_at', { ascending: false })
    
    if (inv) {
      const low = inv.filter(i => i.stock <= (i.low_stock_threshold || 10)).length
      setStats({
        totalItems: inv.length,
        lowStock: low,
        recentTx: logs?.length || 0
      })
    }
  }

  if (loading) return <Spinner />

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', 
      background: T.bg,
      color: T.text, overflow: 'hidden', fontFamily: "'DM Sans', sans-serif",
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: T.bgGrad,
      }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=DM+Sans:wght@400;500;700;900&display=swap');
        .scroll-container { position: relative; z-index: 1; }
        .scroll-container::-webkit-scrollbar { width: 6px; }
        .scroll-container::-webkit-scrollbar-track { background: transparent; }
        .scroll-container::-webkit-scrollbar-thumb { background: rgba(212, 175, 55, 0.2); border-radius: 10px; }
        .bottom-nav { 
          position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
          width: 90%; maxWidth: 400px; height: 70px;
          background: rgba(20, 16, 8, 0.85); backdrop-filter: blur(25px);
          border: 1px solid rgba(212, 175, 55, 0.4); border-radius: 24px;
          display: flex; justify-content: space-around; align-items: center;
          padding: 0 20px; z-index: 2000;
          box-shadow: 0 10px 40px rgba(0,0,0,0.6), 0 0 25px rgba(212, 175, 55, 0.2);
        }
        .glow-text {
          color: #FFF8E1;
          text-shadow: 0 0 15px rgba(212, 175, 55, 0.6);
          font-family: 'Cinzel', serif;
        }
        @media (max-width: 768px) {
          .bottom-nav { width: 95%; bottom: 10px; height: 64px; }
        }
      `}</style>

      {/* Header */}
      <header style={{ 
        height: 64, padding: '0 24px', display: 'flex', alignItems: 'center', 
        justifyContent: 'space-between', borderBottom: `1px solid rgba(212, 175, 55, 0.3)`,
        background: 'rgba(20, 16, 8, 0.6)', backdropFilter: 'blur(12px)', zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #8B6B23, #B8860B)', border: '1px solid rgba(212, 175, 55, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(184, 134, 11, 0.4)' }}>
            <Package size={20} color="#D4AF37" />
          </div>
          <div>
            <div className="glow-text" style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.1em' }}>AL-MAWAID</div>
            <div style={{ fontSize: 10, color: 'rgba(212, 175, 55, 0.7)', fontWeight: 700, letterSpacing: '0.05em' }}>INVENTORY PORTAL</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right', className: 'desktop-only' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#FFF8E1' }}>{staffInfo.name}</div>
            <div style={{ fontSize: 10, color: 'rgba(212, 175, 55, 0.7)' }}>{staffInfo.role?.replace('_', ' ')}</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #B8860B, #8B6B23)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#FFF8E1', border: '1.5px solid rgba(212, 175, 55, 0.4)', boxShadow: '0 0 10px rgba(184, 134, 11, 0.3)' }}>
            {staffInfo.name.charAt(0)}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="scroll-container" style={{ flex: 1, padding: '24px 16px 120px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
          
          {activeTab === 'dashboard' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#fff' }}>Welcome back!</h1>
                  <p style={{ margin: '4px 0 0', color: T.textSub, fontSize: 14 }}>Here's what's happening in your inventory today.</p>
                </div>
                <button onClick={loadStats} style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, color: T.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={18} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
                <PortalCard title="Total Inventory" value={stats.totalItems} icon={<Package size={24} />} />
                <PortalCard title="Low Stock Alerts" value={stats.lowStock} icon={<AlertTriangle size={24} />} color={stats.lowStock > 0 ? T.danger : T.success} sub="Critical Levels" />
                <PortalCard title="Recent Movements" value={stats.recentTx} icon={<History size={24} />} color="#5e9ce0" sub="Last 24h" />
              </div>

              <div style={{ 
                background: 'rgba(20, 16, 8, 0.6)', border: `1px solid ${T.border}`,
                borderRadius: 24, padding: 32, backdropFilter: 'blur(20px)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 12px 40px rgba(0,0,0,0.4)', cursor: 'pointer',
                transition: 'transform 0.3s'
              }} 
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              onClick={() => setActiveTab('inventory')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #B8860B, #8B6B23)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(184, 134, 11, 0.3)', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                    <ArrowUpRight size={28} color="#FFF8E1" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#FFF8E1', fontFamily: "'Cinzel', serif" }}>Manage Stock In/Out</h3>
                    <p style={{ margin: '4px 0 0', color: 'rgba(255, 248, 225, 0.6)', fontSize: 13 }}>Update quantities, record supplies, and view logs.</p>
                  </div>
                </div>
                <ChevronRight size={24} color="#D4AF37" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.95)', borderRadius: 24, padding: 24, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ShieldCheck size={18} color={T.accent} /> Quick Stock Check
                  </div>
                  <div style={{ color: T.textSub, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                    Access the Inventory tab to perform quick updates.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <InventoryPage role={staffInfo.role} />
          )}
        </div>
      </main>

      {/* Navigation */}
      <nav className="bottom-nav">
        <NavIcon icon={<Home size={22} />} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} label="Home" />
        <NavIcon icon={<Package size={22} />} active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} label="Stock" />
        <NavIcon icon={<LogOut size={22} color={T.danger} />} onClick={() => { if(window.confirm('Sign out?')) signOut() }} label="Exit" />
      </nav>
    </div>
  )
}

function NavIcon({ icon, active, onClick, label }) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        color: active ? T.accent : T.textSub, cursor: 'pointer', transition: 'all 0.3s'
      }}
    >
      <div style={{ 
        width: 40, height: 40, borderRadius: 12, 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'rgba(196, 156, 90, 0.15)' : 'transparent',
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
    </div>
  )
}

function ChevronRight({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
