// src/admin/InventoryManagerPortal.jsx
import React, { useState, useEffect } from 'react'
import { 
  Home, Package, LogOut, TrendingUp, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, History, Search, RefreshCw, 
  Plus, X, Clock, ShieldCheck, ChevronRight
} from 'lucide-react'
import { supabase } from './supabaseClient'
import { T as SharedT, updateSystemTheme } from './ui'
import InventoryPage from './InventoryPage'

const T = {
  ...SharedT,
  goldBar: 'linear-gradient(to right, #8B6B23 0%, #D4AF37 45%, #FFD700 50%, #D4AF37 55%, #8B6B23 100%)'
}

const Spinner = ({ fullPage = true }) => (
  <div style={fullPage ? { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' } : {}}>
    <div className="spin" style={{ width: 34, height: 34, border: `2.5px solid rgba(212,175,55,0.2)`, borderTop: `2.5px solid #D4AF37`, borderRadius: '50%' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }.spin { animation: spin 0.8s linear infinite; }`}</style>
  </div>
)

const PortalCard = ({ title, value, icon, color = '#D4AF37', sub, organic }) => (
  <div style={{ 
    background: 'linear-gradient(145deg, rgba(35,28,15,0.7), rgba(15,12,8,0.5))',
    border: `1.5px solid ${color}30`,
    borderRadius: organic ? '40px 80px 40px 80px' : 24, padding: 24, 
    backdropFilter: 'blur(40px) saturate(1.8)',
    boxShadow: '0 15px 35px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.05)',
    flex: 1, minWidth: 200, position: 'relative', overflow: 'hidden'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 16, background: `${color}15`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color }}>
        {icon}
      </div>
      {sub && <span style={{ fontSize: 10, fontWeight: 800, color: color, opacity: 0.8, letterSpacing: '0.1em' }}>{sub}</span>}
    </div>
    <div style={{ fontSize: 11, color: 'rgba(255, 248, 225, 0.5)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: "'DM Sans', sans-serif" }}>{title}</div>
    <div style={{ fontSize: 32, fontWeight: 900, color: '#FFF8E1', marginTop: 4, fontFamily: "'Playfair Display', serif" }}>{value}</div>
  </div>
)

export default function InventoryManagerPortal({ signOut, user }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [staffInfo, setStaffInfo] = useState({ name: 'Inventory Manager', role: 'inventory_manager' })
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, recentTx: 0 })

  useEffect(() => {
    const savedTheme = localStorage.getItem('almawaid_theme') || 'midnight'
    updateSystemTheme(savedTheme)
    
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

    // Realtime stats updates
    const channel = supabase
      .channel('portal_stats_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => loadStats())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inventory_log' }, () => loadStats())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const loadStats = async () => {
    const { data: inv } = await supabase.from('inventory').select('*')
    const { data: logs } = await supabase.from('inventory_log').select('*').limit(10).order('created_at', { ascending: false })
    if (inv) {
      const low = inv.filter(i => i.stock <= (i.low_stock_threshold || 10)).length
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
      minHeight: '100vh', background: 'radial-gradient(circle at 50% 0%, #1a150a 0%, #0f0c08 100%)',
      color: '#FFF8E1', overflowX: 'hidden', fontFamily: "'DM Sans', sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;700;900&family=Amiri:wght@400;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        ::-webkit-scrollbar { width: 0; }
      `}</style>

      {/* Header */}
      <header style={{ textAlign: 'center', padding: '40px 20px 20px' }}>
         <p style={{ fontFamily: "'Amiri',serif", fontSize: 16, color: '#D4AF37', margin: '0 0 4px' }}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
         <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '0.15em', color: '#D4AF37', fontFamily: "'Playfair Display',serif" }}>AL-MAWAID</h1>
         <div style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)', marginTop: 4 }}>Inventory Control Portal</div>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px 120px' }}>
        {activeTab === 'dashboard' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
              <PortalCard title="Inventory Items" value={stats.totalItems} icon={<Package size={22} />} organic />
              <PortalCard title="Stock Status" value="Good" icon={<Package size={22} />} color="#5eba82" sub="STABLE" organic />
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
              background: 'linear-gradient(145deg, rgba(35,28,15,0.6), rgba(15,12,8,0.4))',
              border: `1.5px solid rgba(212,175,55,0.2)`,
              borderRadius: '24px 24px 40px 40px', padding: 24, 
              backdropFilter: 'blur(30px) saturate(1.8)',
              boxShadow: '0 15px 35px rgba(0,0,0,0.4)'
            }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#D4AF37', letterSpacing: '0.1em' }}>RECENT ACTIVITY</div>
                  <button onClick={() => setActiveTab('inventory')} style={{ background: 'none', border: 'none', color: 'rgba(255,248,225,0.5)', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>VIEW ALL</button>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {stats.recentLogs?.length > 0 ? stats.recentLogs.map(log => (
                    <div key={log.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ 
                            width: 32, height: 32, borderRadius: 10, 
                            background: log.type === 'in' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                             {log.type === 'in' ? <ArrowUpRight size={16} color="#10b981" /> : <ArrowDownRight size={16} color="#ef4444" />}
                          </div>
                          <div>
                             <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF8E1' }}>{log.product_name}</div>
                             <div style={{ fontSize: 10, color: 'rgba(255,248,225,0.4)' }}>{new Date(log.created_at).toLocaleTimeString()} • {log.note || 'No note'}</div>
                          </div>
                       </div>
                       <div style={{ fontSize: 14, fontWeight: 900, color: log.type === 'in' ? '#10b981' : '#ef4444' }}>
                          {log.type === 'in' ? '+' : '-'}{log.qty}
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

      <nav style={{ 
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        width: '92%', maxWidth: 400, height: 74,
        background: 'rgba(15,12,8,0.92)', backdropFilter: 'blur(30px)',
        border: '1.5px solid rgba(212,175,55,0.4)', borderRadius: 100,
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '0 20px', zIndex: 1000,
        boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(212,175,55,0.15)'
      }}>
        {[
          { id: 'dashboard', icon: Home, label: 'Home' },
          { id: 'inventory', icon: Package, label: 'Stock' },
          { id: 'logs', icon: History, label: 'Logs' },
        ].map(({ id, icon: Icon, label }) => {
          const active = activeTab === id
          return (
            <button key={id} onClick={() => setActiveTab(id)} style={{ 
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              color: active ? '#D4AF37' : 'rgba(255,248,225,0.4)',
              transition: 'all 0.3s'
            }}>
              <div style={{ 
                width: 44, height: 44, borderRadius: '50%', 
                background: active ? 'rgba(212,175,55,0.15)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: active ? '1px solid rgba(212,175,55,0.3)' : '1px solid transparent'
              }}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              </div>
            </button>
          )
        })}
        <button onClick={signOut} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 12, color: '#e05555', opacity: 0.8 }}>
          <LogOut size={20} />
        </button>
      </nav>
    </div>
  )
}
