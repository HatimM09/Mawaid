// src/admin/InventoryManagerPortal.jsx
import React, { useState, useEffect } from 'react'
import { 
  Home, Package, LogOut, TrendingUp, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, History, Search, RefreshCw, 
  Plus, X, Clock, ShieldCheck, ChevronRight, Menu
} from 'lucide-react'
import { supabase } from '../lib/firebaseClient'
import { T as SharedT, updateSystemTheme } from './ui'
import InventoryPage from './InventoryPage'

const T = {
  ...SharedT,
  goldBar: SharedT.accentGrad || 'var(--accent-grad)'
}

const Skl = ({ w = '100%', h = 14, style = {} }) => (
  <div style={{
    height: h, width: w, borderRadius: h / 2,
    background: 'var(--border-light)',
    animation: 'skeletonPulse 1.5s ease-in-out infinite',
    ...style
  }} />
)

const Spinner = ({ fullPage = true }) => (
  fullPage ? (
    <div style={{ flex: 1, padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Skl w='50%' h={24} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ padding: 20, borderRadius: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
            <Skl w='40%' h={10} style={{ marginBottom: 12 }} />
            <Skl w='60%' h={28} />
          </div>
        ))}
      </div>
      <Skl w='100%' h={60} style={{ borderRadius: 12 }} />
      <Skl w='100%' h={60} style={{ borderRadius: 12 }} />
    </div>
  ) : (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12 }}>
      <Skl w={16} h={16} style={{ borderRadius: '50%' }} />
      <Skl w='60%' h={12} />
    </div>
  )
)

const PortalCard = ({ title, value, icon, color = 'var(--accent-primary)', sub, organic }) => (
  <div style={{ 
    background: 'var(--bg-card)',
    border: `1px solid ${color}30`,
    borderRadius: 20, padding: 28, 
    backdropFilter: 'blur(32px) saturate(1.2)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
    flex: 1, minWidth: 200, position: 'relative', overflow: 'hidden'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 16, background: `${color}15`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color }}>
        {icon}
      </div>
      {sub && <span style={{ fontSize: 10, fontWeight: 800, color: color, opacity: 0.8, letterSpacing: '0.1em' }}>{sub}</span>}
    </div>
    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: "'Inter', sans-serif" }}>{title}</div>
    <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6, fontFamily: "'Inter', sans-serif" }}>{value}</div>
  </div>
)

export default function InventoryManagerPortal({ signOut, user }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [staffInfo, setStaffInfo] = useState({ name: 'Inventory Manager', role: 'inventory_manager' })
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, recentTx: 0 })
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    updateSystemTheme('royal')
    
    if (user?.role) {
      setStaffInfo(user); setLoading(false)
    } else if (user?.id) {
      supabase.from('staff').select('*').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => { if (data) setStaffInfo(data) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
    loadStats()

    // REALTIME SUBSCRIPTION
    const portalSub = supabase
      .channel('portal_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        loadStats()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_log' }, () => {
        loadStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(portalSub)
    }
  }, [user])

  const loadStats = async () => {
    const { data: inv } = await supabase.from('inventory').select('*')
    const { data: logs } = await supabase.from('inventory_log').select('*').limit(10).order('created_at', { ascending: false })
    if (inv) {
      const low = inv.filter(i => i.stock <= (i.low_stock || 10)).length
      setStats({ 
        totalItems: inv.length, 
        lowStock: low, 
        recentTx: logs?.length || 0,
        recentLogs: logs || [] 
      })
    }
  }

  if (loading) return <Spinner />

  return (
    <div style={{ 
      minHeight: '100vh', background: 'var(--bg-grad)',
      color: 'var(--text-primary)', overflowX: 'hidden', fontFamily: "'Inter', sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Amiri:wght@400;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        .inv-nav-inner { 
          display: flex; align-items: center; gap: 16px; 
          width: 100%; padding: 0 10px;
        }

        .inventory-sidebar {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 280px; background: rgba(10, 13, 20, 0.98);
          backdrop-filter: blur(40px); z-index: 3000;
          border-right: 1px solid var(--border-active);
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateX(-100%);
          display: flex; flex-direction: column;
          padding: 40px 0;
          border-radius: 0 60px 60px 0;
          box-shadow: 20px 0 60px rgba(0,0,0,0.8);
        }
        .inventory-sidebar.open { transform: translateX(0); }
        
        .inv-sidebar-item {
          display: flex; align-items: center; gap: 15px;
          padding: 18px 30px; cursor: pointer;
          color: var(--text-tertiary); transition: all 0.3s;
          border-radius: 0 30px 30px 0;
          margin-bottom: 8px;
        }
        /* Curve layout for 3 items */
        .inv-sidebar-item:nth-child(1), .inv-sidebar-item:nth-child(3) { padding-left: 35px; }
        .inv-sidebar-item:nth-child(2) { padding-left: 55px; }

        .inv-sidebar-item:hover { background: var(--accent-bg); color: var(--accent-primary); padding-left: 65px; }
        .inv-sidebar-item.active { background: var(--accent-grad); color: #000; font-weight: 800; padding-left: 75px; }

        @media (min-width: 1025px) {
          .global-inventory-nav { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <header style={{ textAlign: 'center', padding: '40px 20px 20px', position: 'relative' }}>
         <button 
           onClick={() => setIsSidebarOpen(true)}
           style={{ position: 'absolute', left: 25, top: 45, background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}
         >
           <Menu size={28} />
         </button>
         <p style={{ fontFamily: "'Inter', sans-serif, 'Amiri', serif", fontSize: 16, color: 'var(--accent-primary)', margin: '0 0 4px' }}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
         <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '0.15em', color: 'var(--accent-primary)', fontFamily: "'Inter', sans-serif" }}>AL-MAWAID</h1>
         <div style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--border-active)', marginTop: 4 }}>Inventory Control Portal</div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px clamp(16px, 4vw, 32px) 160px' }}>
        {activeTab === 'dashboard' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <PortalCard title="Inventory Items" value={stats.totalItems} icon={<Package size={20} />} organic />
              <PortalCard title="Stock Status" value="Good" icon={<Package size={20} />} color="#5eba82" sub="STABLE" organic />
            </div>

            <button style={{ 
                width: '100%', height: 54, border: 'none', borderRadius: 14, 
                background: T.goldBar, color: '#000', fontSize: 13, fontWeight: 900, 
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em',
                boxShadow: '0 12px 30px rgba(139,107,35,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
              }} onClick={() => setActiveTab('inventory')}>
              <Plus size={18} /> Manage Inventory Now
            </button>

            <div style={{ 
              background: 'var(--bg-card)',
              border: `1px solid var(--border-light)`,
              borderRadius: 24, padding: 28, 
              backdropFilter: 'blur(32px) saturate(1.2)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.3)'
            }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '0.1em' }}>RECENT ACTIVITY</div>
                  <button onClick={() => setActiveTab('inventory')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>VIEW ALL</button>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {stats.recentLogs?.length > 0 ? stats.recentLogs.map(log => (
                    <div key={log.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ 
                            width: 32, height: 32, borderRadius: 10, 
                            background: log.action === 'add' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                             {log.action === 'add' ? <ArrowUpRight size={16} color="#10b981" /> : <ArrowDownRight size={16} color="#ef4444" />}
                          </div>
                          <div>
                             <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{log.item_name}</div>
                             <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{new Date(log.created_at).toLocaleTimeString()} • {log.notes || 'No notes'}</div>
                          </div>
                       </div>
                       <div style={{ fontSize: 14, fontWeight: 900, color: log.action === 'add' ? '#10b981' : '#ef4444' }}>
                          {log.action === 'add' ? '+' : '-'}{log.quantity}
                       </div>
                    </div>
                  )) : (
                    <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'rgba(255,248,225,0.3)' }}>No recent activity</div>
                  )}
               </div>
            </div>

          </div>
        ) : activeTab === 'inventory' ? (
          <div style={{ animation: 'fadeIn 0.5s ease' }}>
            <InventoryPage role={staffInfo.role} initialTab="stock" />
          </div>
        ) : (
          <div style={{ animation: 'fadeIn 0.5s ease' }}>
            <InventoryPage role={staffInfo.role} initialTab="log" />
          </div>
        )}
      </main>

      {/* Left Sidebar */}
      <aside className={`inventory-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '20px 30px 40px', display: 'flex', alignItems: 'center', gap: 15 }}>
          <div style={{ width: 45, height: 45, borderRadius: 12, background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/al-mawaid.png" alt="" style={{ width: 30, height: 30 }} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--accent-primary)' }}>INVENTORY</h2>
          <div style={{ flex: 1 }} />
          <button onClick={() => setIsSidebarOpen(false)} aria-label="Close sidebar" style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={24} /></button>
        </div>

        <div style={{ flex: 1 }}>
          {[
            { id: 'dashboard', icon: Home, label: 'Dashboard' },
            { id: 'inventory', icon: Package, label: 'Inventory' },
            { id: 'logs', icon: History, label: 'Activity Logs' },
          ].map(({ id, icon: Icon, label }) => (
            <div 
              key={id} 
              onClick={() => { setActiveTab(id); setIsSidebarOpen(false); }} 
              className={`inv-sidebar-item ${activeTab === id ? 'active' : ''}`}
            >
              <Icon size={22} />
              <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '20px 30px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={signOut} style={{ width: '100%', padding: '14px', borderRadius: 12, background: 'rgba(255,92,92,0.1)', color: '#ff5c5c', border: '1px solid rgba(255,92,92,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontWeight: 700 }}>
            <LogOut size={20} /> Logout
          </button>
        </div>
      </aside>

      {/* Global Portal Nav - Pill Shape (Mobile) */}
      <nav className="global-inventory-nav" style={{ 
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        width: '92%', maxWidth: 500, height: 74,
        background: 'var(--bg-card)', backdropFilter: 'blur(30px)',
        border: '1.5px solid var(--border-active)', borderRadius: 100,
        display: 'flex', alignItems: 'center',
        padding: '0 10px', zIndex: 1000,
        boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px var(--accent-bg)',
        overflow: 'hidden'
      }}>
        <div className="inv-nav-inner">
          <style>{`.inventory-nav::-webkit-scrollbar { display: none; }`}</style>
          {[
            { id: 'dashboard', icon: Home, label: 'Home' },
            { id: 'inventory', icon: Package, label: 'Stock' },
            { id: 'logs', icon: History, label: 'Logs' },
          ].map(({ id, icon: Icon, label }) => {
            const active = activeTab === id
            return (
              <button key={id} onClick={() => setActiveTab(id)} style={{ 
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: active ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                transition: 'all 0.3s',
                minWidth: 56, flexShrink: 0
              }}>
                <div style={{ 
                  width: 44, height: 44, borderRadius: '50%', 
                  background: active ? 'var(--accent-bg)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: active ? '1px solid var(--accent-border)' : '1px solid transparent'
                }}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                </div>
              </button>
            )
          })}
        </div>
        <button onClick={signOut} aria-label="Log out" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 12, color: '#e05555', opacity: 0.8, flexShrink: 0 }}>
          <LogOut size={20} />
        </button>
      </nav>
    </div>
  )
}
