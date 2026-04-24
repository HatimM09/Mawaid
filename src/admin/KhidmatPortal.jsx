// src/admin/KhidmatPortal.jsx (updated)
import React, { useState, useEffect } from 'react'
import { 
  Home, Users, Package, Settings, LogOut, Bell, 
  ChevronRight, Calendar, Star, Utensils, MessageSquare,
  TrendingUp, Check, Info, ArrowUpRight, Search, Clock,
  ChevronLeft, Phone, MapPin, LifeBuoy, Lock, MessageCircle,
  AlertCircle, Wallet, ClipboardList
} from 'lucide-react'
import { supabase } from './supabaseClient'
import { AuthCtx, ThemeCtx, useAuth, useTheme } from './context'
import { T as SharedT, updateSystemTheme } from './ui'
import UsersPage from './UsersPage'
import InventoryPage from './InventoryPage'
import RequestsAdminPage from './RequestsAdminPage'
import DailySurveyTracking from './DailySurveyTracking'

const Spinner = ({ fullPage = true }) => {
  const t = { accent: '#D4AF37', textSub: 'rgba(255,255,255,0.5)' }
  return (
    <div style={fullPage ? { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' } : {}}>
      <div className="spin" style={{ width: 34, height: 34, border: `2.5px solid rgba(212,175,55,0.2)`, borderTop: `2.5px solid ${t.accent}`, borderRadius: '50%' }} />
    </div>
  )
}

const T = {
  ...SharedT,
  goldBar: 'linear-gradient(to right, #8B6B23 0%, #D4AF37 45%, #FFD700 50%, #D4AF37 55%, #8B6B23 100%)'
}

function Card({ children, style = {}, active, organic, title, count, icon }) {
  const organicStyle = organic ? {
    borderRadius: '40px 100px 40px 100px',
    background: 'linear-gradient(145deg, rgba(35,28,15,0.7), rgba(15,12,8,0.5))',
  } : {
    borderRadius: 24,
    background: 'rgba(15,12,8,0.65)',
  }

  return (
    <div style={{
      ...organicStyle,
      padding: '24px 30px',
      border: `1.5px solid ${active ? 'rgba(255,215,0,0.6)' : 'rgba(212,175,55,0.2)'}`,
      backdropFilter: 'blur(40px) saturate(1.8)',
      boxShadow: '0 15px 35px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.05)',
      ...style
    }}>
      {(title || count) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {icon}
            <span style={{ fontSize: 16, fontWeight: 800, color: '#FFF8E1', fontFamily: "'Playfair Display',serif" }}>{title}</span>
          </div>
          {count !== undefined && (
            <span style={{ fontSize: 24, fontWeight: 900, color: '#D4AF37' }}>{count}</span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

export default function KhidmatPortal({ signOut, user }) {
  const [activeTab, setActiveTab] = useState('home')
  const [staffInfo, setStaffInfo] = useState({ name: 'Staff Member', role: 'Team Member' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedTheme = localStorage.getItem('almawaid_theme') || 'midnight'
    updateSystemTheme(savedTheme)
    
    if (!user?.id) return
    supabase.from('staff').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setStaffInfo(data) })
      .finally(() => setLoading(false))
  }, [user])

  const [requestsList, setRequestsList] = useState([])
  const [queriesList, setQueriesList] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => { loadHomeData() }, [])
  const loadHomeData = async () => {
    setLoadingItems(true)
    const [{ data: req }, { data: queries }] = await Promise.all([
      supabase.from('thali_requests').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('queries').select('*').order('created_at', { ascending: false }).limit(5)
    ])
    setRequestsList(req || []); setQueriesList(queries || []); setLoadingItems(false)
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
         <div style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)', marginTop: 4 }}>Khidmat Team Portal</div>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px 120px' }}>
        {activeTab === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Staff Profile - Organic */}
            <Card organic style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ 
                width: 60, height: 60, borderRadius: '50%', background: '#B8860B', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, color: '#fff',
                boxShadow: '0 10px 20px rgba(0,0,0,0.3)', border: '2px solid #D4AF37'
              }}>
                {staffInfo.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#D4AF37', fontFamily: "'Playfair Display',serif" }}>{staffInfo.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,248,225,0.6)' }}>{staffInfo.role}</div>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,248,225,0.4)', textAlign: 'right' }}>
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </Card>

            {/* Quick Stats / Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
               <Card title="Requests" count={requestsList.length} icon={<Utensils size={18} color="#D4AF37" />} style={{ borderRadius: '40px 40px 10px 40px' }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,248,225,0.5)', lineHeight: 1.6 }}>Manage thali resume, stop, and extra food requests.</div>
               </Card>
               <Card title="Queries" count={queriesList.length} icon={<MessageCircle size={18} color="#D4AF37" />} style={{ borderRadius: '40px 40px 40px 10px' }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,248,225,0.5)', lineHeight: 1.6 }}>Respond to user queries and support tickets.</div>
               </Card>
            </div>

            {/* Main Action Button */}
            <button style={{ 
                width: '100%', height: 54, border: 'none', borderRadius: 14, 
                background: T.goldBar, color: '#000', fontSize: 13, fontWeight: 900, 
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em',
                boxShadow: '0 12px 30px rgba(139,107,35,0.4)'
              }} onClick={() => setActiveTab('survey')}>
              View Daily Survey Analytics
            </button>

            {/* Recent Activity Section */}
            <div style={{ marginTop: 8 }}>
               <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(212,175,55,0.6)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16, marginLeft: 10 }}>RECENT ACTIVITY</div>
               <Card organic style={{ padding: '10px 0' }}>
                  {requestsList.slice(0,3).map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: i < 2 ? '1px solid rgba(212,175,55,0.1)' : 'none' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={16} color="#D4AF37" /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{r.request_type} Request</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,248,225,0.5)' }}>Thali #{r.thali_no || '—'}</div>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase' }}>{r.status}</div>
                    </div>
                  ))}
               </Card>
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
        ) : null}
      </main>

      {/* Global Portal Nav - Pill Shape */}
      <nav style={{ 
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        width: '92%', maxWidth: 500, height: 74,
        background: 'rgba(15,12,8,0.92)', backdropFilter: 'blur(30px)',
        border: '1.5px solid rgba(212,175,55,0.4)', borderRadius: 100,
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '0 10px', zIndex: 1000,
        boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(212,175,55,0.15)'
      }}>
        {[
          { id: 'home', icon: Home },
          { id: 'users', icon: Users },
          { id: 'inventory', icon: Package },
          { id: 'survey', icon: Calendar },
          { id: 'requests', icon: Utensils },
        ].map(({ id, icon: Icon }) => {
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
                boxShadow: active ? 'inset 0 0 10px rgba(212,175,55,0.2)' : 'none',
                border: active ? '1px solid rgba(212,175,55,0.3)' : '1px solid transparent'
              }}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              </div>
            </button>
          )
        })}
        <button onClick={() => { if(window.confirm('Sign out?')) signOut() }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 12, color: '#e05555', opacity: 0.8 }}>
          <LogOut size={20} />
        </button>
      </nav>
    </div>
  )
}
