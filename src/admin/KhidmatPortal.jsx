// src/admin/KhidmatPortal.jsx (updated)
import React, { useState, useEffect } from 'react'
import { 
  Home, Users, Package, Settings, LogOut, Bell, 
  ChevronRight, Calendar, Star, Utensils, MessageSquare,
  TrendingUp, Check, Info, ArrowUpRight, Search, Clock,
  ChevronLeft, Phone, MapPin, LifeBuoy, Lock, MessageCircle,
  AlertCircle
} from 'lucide-react'
import { 
  LineChart, Line, ResponsiveContainer 
} from 'recharts'
import { supabase } from './supabaseClient'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { AuthCtx, ThemeCtx, useAuth, useTheme } from './context'
import { T as SharedT, updateSystemTheme } from './ui'
import UsersPage from './UsersPage'
import InventoryPage from './InventoryPage'
import RequestsAdminPage from './RequestsAdminPage'
import DailySurveyTracking from './DailySurveyTracking'

// Shared UI Elements
const Spinner = ({ fullPage = true }) => {
  const t = { accent: '#c49c5a', textSub: 'rgba(255,255,255,0.5)' }
  return (
    <div style={fullPage ? { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' } : {}}>
      <div className="spin" style={{ width: 34, height: 34, border: `2.5px solid rgba(196,156,90,0.2)`, borderTop: `2.5px solid ${t.accent}`, borderRadius: '50%' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }.spin { animation: spin 0.8s linear infinite; }`}</style>
    </div>
  )
}

const T = SharedT

export default function KhidmatPortal({ signOut, user }) {
  const [activeTab, setActiveTab] = useState('home')
  const [staffInfo, setStaffInfo] = useState({ name: 'Loading...', role: 'Staff' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedTheme = localStorage.getItem('almawaid_theme') || 'midnight'
    updateSystemTheme(savedTheme)
    
    if (!user?.id) return
    supabase.from('staff').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setStaffInfo(data)
      })
      .finally(() => setLoading(false))
  }, [user])

  const [requestsList, setRequestsList] = useState([])
  const [queriesList, setQueriesList] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => {
    loadHomeData()
  }, [])

  const loadHomeData = async () => {
    setLoadingItems(true)
    const [{ data: req }, { data: queries }] = await Promise.all([
      supabase.from('thali_requests').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('queries').select('*').order('created_at', { ascending: false }).limit(5)
    ])
    setRequestsList(req || [])
    setQueriesList(queries || [])
    setLoadingItems(false)
  }

  if (loading) return <Spinner />

  return (
    <div className="portal-container" style={{ 
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
        .main-content { padding: 32px; display: grid; grid-template-columns: 1fr; gap: 32px; z-index: 1; }
        .bento-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .profile-banner { padding: 24px 32px; flex-direction: row; gap: 32px; }
        .global-portal-nav { 
          position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
          width: 90%; maxWidth: 600px; height: 70px;
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

        .glass-card {
          background: rgba(15, 12, 8, 0.75);
          backdrop-filter: blur(28px) saturate(1.3);
          -webkit-backdrop-filter: blur(28px) saturate(1.3);
          border: 1px solid rgba(212, 175, 55, 0.15);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
        }

        @media (max-width: 768px) {
          .main-content { padding: 16px 16px 100px; }
          .bento-grid { grid-template-columns: 1fr; }
          .profile-banner { flex-direction: column; text-align: center; gap: 16px; padding: 24px 16px; }
          .profile-banner > div { justify-content: center; }
          header { padding: 0 16px !important; }
          .global-portal-nav { width: 95%; bottom: 10px; height: 64px; }
        }
      `}</style>

      {/* Main Container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        
        {/* Top Navigation */}
        <header style={{ 
          height: 60, padding: '0 32px', display: 'flex', alignItems: 'center', 
          justifyContent: 'space-between', borderBottom: `1px solid rgba(212, 175, 55, 0.3)`,
          background: 'rgba(20, 16, 8, 0.6)', backdropFilter: 'blur(10px)', zIndex: 100
        }}>
          <div style={{ 
            fontSize: 16, fontWeight: 900, letterSpacing: '0.1em', color: T.accent, 
            display: 'flex', alignItems: 'center', gap: 12 
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #8B6B23, #B8860B)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 15px rgba(184, 134, 11, 0.4)', border: '1px solid rgba(212, 175, 55, 0.3)'
            }}>
              <img src="/al-mawaid.png" alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
            </div>
            <span className="glow-text">KHIDMAT PORTAL</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.textSub }}>
              <Clock size={16} /> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="desktop-only" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{staffInfo.role}</div>
                <div style={{ fontSize: 10, color: T.textSub }}>{staffInfo.name}</div>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff' }}>
                {staffInfo.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>


        <main className="scroll-container" style={{ flex: 1, padding: '24px 16px 120px', overflowY: 'auto' }}>
          {activeTab === 'home' ? (
            <div className="main-content">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="profile-banner glass-card" style={{ 
                  borderRadius: 24, 
                  display: 'flex', alignItems: 'center',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ 
                    width: 80, height: 80, borderRadius: '50%', border: `3px solid ${T.accent}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', flexShrink: 0
                  }}>
                    <img src="/al-mawaid.png" alt="" style={{ width: 50, height: 50, objectFit: 'contain' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#FFF8E1', textShadow: '0 0 10px rgba(212, 175, 55, 0.4)' }}>{staffInfo.name}</h2>
                    <div style={{ color: 'rgba(255, 248, 225, 0.6)', marginTop: 4 }}>{staffInfo.role}</div>
                    <div style={{ fontSize: 12, color: '#D4AF37', marginTop: 8, fontWeight: 600 }}>Active Session</div>
                  </div>
                  <div style={{ padding: '8px 24px', borderRadius: 30, background: 'linear-gradient(135deg, #B8860B, #8B6B23)', color: '#FFF8E1', fontWeight: 900, fontSize: 14, boxShadow: '0 4px 15px rgba(184, 134, 11, 0.4)', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                    {staffInfo.role}
                  </div>
                </div>

                <div className="bento-grid" style={{ gap: 16 }}>
                  <Card title="Thali Requests" count={requestsList.length}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                        <thead style={{ color: T.textSub, fontSize: 11, borderBottom: `1px solid ${T.border}` }}>
                          <tr>
                            <th align="left" style={{ padding: '8px 0' }}>Request Type</th>
                            <th align="center">Date</th>
                            <th align="right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {requestsList.length === 0 ? (
                            <tr><td colSpan="3" align="center" style={{ padding: 20, color: T.textSub }}>No recent requests</td></tr>
                          ) : requestsList.map((r, i) => (
                            <tr key={i} style={{ borderBottom: i < requestsList.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                              <td style={{ padding: '12px 0', fontWeight: 600, color: T.text }}>{r.request_type || 'General'}</td>
                              <td align="center" style={{ color: T.textSub }}>{r.date || '—'}</td>
                              <td align="right">
                                <Badge active={r.status === 'approved'}>{r.status || 'pending'}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                  <Card title="User Queries" count={queriesList.length}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {queriesList.map((q, i) => (
                        <div key={i} style={{ padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.03)', border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>{q.subject}</div>
                          <div style={{ fontSize: 11, color: T.textSub }}>{q.comment}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          ) : activeTab === 'users' ? (
            <UsersPage />
          ) : activeTab === 'inventory' ? (
            <InventoryPage />
          ) : activeTab === 'requests' ? (
            <RequestsAdminPage />
          ) : activeTab === 'survey' ? (
            <DailySurveyTracking />
          ) : (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <h2 style={{ color: T.accent }}>{activeTab.toUpperCase()} Section</h2>
              <p style={{ color: T.textSub }}>Section coming soon...</p>
              <button onClick={() => setActiveTab('home')}>Back to Dashboard</button>
            </div>
          )}
        </main>

        {/* Global Bottom Nav */}
        <nav className="global-portal-nav">
          <SidebarIcon icon={<Home size={22} />} active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
          <SidebarIcon icon={<Users size={22} />} active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
          <SidebarIcon icon={<Package size={22} />} active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
          <SidebarIcon icon={<Calendar size={22} />} active={activeTab === 'survey'} onClick={() => setActiveTab('survey')} />
          <SidebarIcon icon={<Utensils size={22} />} active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} />
          <SidebarIcon icon={<LogOut size={22} color={T.danger} />} onClick={() => { if(window.confirm('Sign out?')) signOut() }} />
        </nav>
      </div>
    </div>
  )
}

function SidebarIcon({ icon, active, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        width: 44, height: 44, borderRadius: 12, 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
        color: active ? T.accent : T.textSub,
        cursor: 'pointer', transition: 'all 0.3s'
      }}
    >
      {icon}
    </div>
  )
}

function Card({ title, count, children, icon, style = {} }) {
  return (
    <div className="glass-card" style={{ 
      borderRadius: 24, padding: 24, ...style
    }}>
      {(title || count) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {icon}
            <span style={{ fontSize: 16, fontWeight: 800 }}>{title}</span>
          </div>
          {count !== undefined && (
            <span style={{ fontSize: 24, fontWeight: 900, color: T.accent }}>[{count}]</span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

function Badge({ children, active }) {
  return (
    <span style={{ 
      padding: '6px 16px', borderRadius: 20, 
      background: active ? T.accent : 'rgba(255,255,255,0.05)', 
      color: active ? '#000' : T.accent,
      border: `1px solid ${active ? T.accent : 'rgba(255,255,255,0.1)'}`,
      fontSize: 12, fontWeight: 700 
    }}>
      {children}
    </span>
  )
}
