// src/admin/KhidmatPortal.jsx (updated)
import React, { useState, useEffect } from 'react'
import {
  Home, Users, Package, Settings, LogOut, Bell,
  ChevronRight, Calendar, Star, Utensils, MessageSquare,
  TrendingUp, Check, Info, ArrowUpRight, Search, Clock,
  ChevronLeft, Phone, MapPin, LifeBuoy, Lock, MessageCircle,
  AlertCircle, Wallet, ClipboardList, Menu
} from 'lucide-react'
import { supabase } from './supabaseClient'
import { AuthCtx, ThemeCtx, useAuth, useTheme } from './context'
import { T as SharedT, updateSystemTheme, Modal, SurveyResponseDisplay, Btn as SharedBtn, PackingTVView } from './ui'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'
import { Scan, X } from 'lucide-react'
import UsersPage from './UsersPage'
import { getWeekDate } from '../common/utils'
import RequestsAdminPage from './RequestsAdminPage'
import QueriesAdminPage from './QueriesAdminPage'
import DailySurveyTracking from './DailySurveyTracking'

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
      <Skl w='45%' h={22} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ padding: 20, borderRadius: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
            <Skl w='50%' h={10} style={{ marginBottom: 10 }} />
            <Skl w='70%' h={24} />
          </div>
        ))}
      </div>
      <Skl w='100%' h={50} style={{ borderRadius: 12 }} />
      <Skl w='100%' h={50} style={{ borderRadius: 12 }} />
    </div>
  ) : (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12 }}>
      <Skl w={16} h={16} style={{ borderRadius: '50%' }} />
      <Skl w='60%' h={12} />
    </div>
  )
)

const T = {
  ...SharedT,
  goldBar: SharedT.accentGrad || 'var(--accent-grad)'
}

function Card({ children, style = {}, active, organic, title, count, icon }) {
  const cardStyle = {
    borderRadius: 24,
    background: 'var(--bg-card)',
  }

  return (
    <div style={{
      ...cardStyle,
      padding: '28px 32px',
      border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-light)'}`,
      backdropFilter: 'blur(30px) saturate(1.2)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
      ...style
    }}>
      {(title || count) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {icon}
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>{title}</span>
          </div>
          {count !== undefined && (
            <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-primary)' }}>{count}</span>
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
  const [isScanning, setIsScanning] = useState(false)
  const [scannedUser, setScannedUser] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // --- WIRELESS SCANNER SUPPORT ---
  useEffect(() => {
    let scanBuffer = ''
    let lastKeyTime = Date.now()

    const handleKeyDown = (e) => {
      const now = Date.now()
      if (now - lastKeyTime > 100) scanBuffer = ''
      lastKeyTime = now

      if (e.key === 'Enter') {
        if (scanBuffer.startsWith('ALMAWAID:')) {
          const userId = scanBuffer.split(':')[1]
          processScan(userId)
          scanBuffer = ''
        }
      } else if (e.key.length === 1) {
        scanBuffer += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const processScan = async (userId) => {
    try {
      const { data: u } = await supabase.from('user_stats').select('*').eq('user_id', userId).single()
      if (!u) return
      
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      let today = days[new Date().getDay()]
      if (today === 'sunday') today = 'monday'
      const meal = new Date().getHours() < 16 ? 'lunch' : 'dinner'
      const dayKey = today.substring(0, 3).toLowerCase()
      const mealKey = meal === 'lunch' ? 'l' : 'd'
      
      // Get current week Monday (matching user-side getWeekDate logic)
      const now2 = new Date()
      const wd = now2.getDay()
      const wh = now2.getHours()
      let diff = now2.getDate() - wd + (wd === 0 ? -6 : 1)
      if (wd === 0 || (wd === 6 && wh >= 20)) {
        diff += 7
      }
      const weekId = new Date(new Date().setDate(diff)).toISOString().split('T')[0]
      
      const { data: row } = await supabase.from('survey_submissions_flat')
        .select('*').eq('user_id', userId).eq('week_id', weekId).single()
      
      const { data: menuRow } = await supabase.from('weekly_menu').select('*').eq('day_name', today.charAt(0).toUpperCase() + today.slice(1)).eq('week_start', getWeekDate()).maybeSingle()
      let dishRes = {}
      if (row && row[`${dayKey}_${mealKey}_status`] === 'Applied' && menuRow) {
        const dishList = (menuRow[meal] || '').split(',').map(s => s.trim()).filter(Boolean)
        dishList.forEach((dish, idx) => {
          const val = row[`${dayKey}_${mealKey}_dish_${idx + 1}`]
          if (val !== undefined && val !== null) {
            dishRes[dish] = val === 'Yes' ? 'yes' : (val === 'No' ? 'no' : val)
          }
        })
      }

      setScannedUser({
        ...u,
        status: row ? row[`${dayKey}_${mealKey}_status`] : 'Not Submitted',
        dishResponses: dishRes,
        currentDay: today,
        currentMeal: meal
      })
    } catch (e) { console.error(e) }
  }

  // --- CAMERA SCANNER ---
  useEffect(() => {
    if (isScanning) {
      const qrBoxSize = window.innerWidth < 600 ? 200 : 250;
      const scanner = new Html5QrcodeScanner("portal-reader", {
        fps: 10,
        qrbox: qrBoxSize,
        supportedScanTypes: [
          Html5QrcodeScanType.SCAN_TYPE_CAMERA,
          Html5QrcodeScanType.SCAN_TYPE_FILE
        ],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
      });
      
      const handleScan = async (decodedText) => {
        if (decodedText.startsWith('ALMAWAID:')) {
          const userId = decodedText.split(':')[1];
          try {
            await scanner.clear();
          } catch (e) {
            console.error("Failed to clear scanner", e);
          }
          setIsScanning(false);
          processScan(userId);
        }
      };

      scanner.render(handleScan, (error) => {});
      return () => {
        scanner.clear().catch(e => console.error("Scanner cleanup failed", e));
      };
    }
  }, [isScanning])

  useEffect(() => {
    updateSystemTheme('royal')

    if (!user?.id) return
    supabase.from('staff').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setStaffInfo(data) })
      .finally(() => setLoading(false))
  }, [user])

  const [requestsList, setRequestsList] = useState([])
  const [queriesList, setQueriesList] = useState([])
  const [weeklyMenu, setWeeklyMenu] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => { loadHomeData() }, [])
  const loadHomeData = async () => {
    setLoadingItems(true)
    const [{ data: req }, { data: queries }, { data: menu }] = await Promise.all([
      supabase.from('thali_requests').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('queries').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('weekly_menu').select('*').eq('week_start', getWeekDate())
    ])
    setRequestsList(req || []);
    setQueriesList(queries || []);
    if (menu && menu.length > 0) {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      setWeeklyMenu(days.map(d => {
        const row = menu.find(r => r.day_name === d)
        return { name: d, lunch: row?.lunch || '', dinner: row?.dinner || '' }
      }))
    }
    setLoadingItems(false)
  }


  if (loading) return <Spinner />

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg-grad)',
      color: 'var(--text-primary)', overflowX: 'hidden', fontFamily: "'Inter', sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Amiri:wght@400;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        ::-webkit-scrollbar { width: 0; }
        .kh-nav-inner { 
          display: flex; align-items: center; gap: 4px; 
          width: 100%; padding: 0 10px;
        }
        
        .khidmat-sidebar {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 280px; background: rgba(15, 12, 8, 0.98);
          backdrop-filter: blur(40px); z-index: 3000;
          border-right: 1px solid var(--accent-border);
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateX(-100%);
          display: flex; flex-direction: column;
          padding: 40px 0;
          border-radius: 0 60px 60px 0;
          box-shadow: 20px 0 60px rgba(0,0,0,0.8);
        }
        .khidmat-sidebar.open { transform: translateX(0); }
        
        .kh-sidebar-item {
          display: flex; align-items: center; gap: 15px;
          padding: 16px 30px; cursor: pointer;
          color: var(--text-tertiary); transition: all 0.3s;
          border-radius: 0 30px 30px 0;
          margin-bottom: 5px;
        }
        /* Curve layout */
        .kh-sidebar-item:nth-child(1), .kh-sidebar-item:nth-child(5) { padding-left: 25px; }
        .kh-sidebar-item:nth-child(2), .kh-sidebar-item:nth-child(4) { padding-left: 45px; }
        .kh-sidebar-item:nth-child(3) { padding-left: 55px; }

        .kh-sidebar-item:hover { background: var(--accent-bg); color: var(--accent-primary); padding-left: 65px; }
        .kh-sidebar-item.active { background: var(--accent-grad); color: #000; font-weight: 800; padding-left: 75px; }

        @media (min-width: 1025px) {
          .global-portal-nav { display: none !important; }
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
        <div style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--border-active)', marginTop: 4 }}>Khidmat Team Portal</div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px clamp(16px, 4vw, 32px) 160px' }}>
        {activeTab === 'home' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Staff Profile - Organic */}
            <Card organic style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, color: 'var(--accent-primary)',
                boxShadow: '0 8px 20px rgba(0,0,0,0.2)', border: '2px solid var(--accent-border)'
              }}>
                {staffInfo.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-primary)', fontFamily: "'Inter', sans-serif" }}>{staffInfo.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{staffInfo.role}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setIsScanning(true)}
                  style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 12, padding: 10, cursor: 'pointer', color: 'var(--accent-primary)' }}>
                  <Scan size={20} />
                </button>
                <button
                  onClick={() => setActiveTab('notices')}
                  style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 12, padding: 10, cursor: 'pointer', color: 'var(--accent-primary)' }}>
                  <Bell size={20} />
                </button>
              </div>
            </Card>

            {/* MODALS */}
            {isScanning && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', padding: 20 }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
                  <button onClick={() => setIsScanning(false)} style={{ position: 'absolute', top: -50, right: 0, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={32} /></button>
                  <Card style={{ padding: 10, background: '#fff' }}><div id="portal-reader" style={{ width: '100%' }}></div></Card>
                  <p style={{ color: '#fff', textAlign: 'center', marginTop: 20, fontWeight: 600 }}>Scan Member QR Code</p>
                </div>
              </div>
            )}

            {scannedUser && (
              <PackingTVView 
                user={scannedUser} 
                onClose={() => setScannedUser(null)} 
              />
            )}

            <NoThaliTracker />

          </div>
        ) : activeTab === 'users' ? (
          <UsersPage />
        ) : activeTab === 'requests' ? (
          <RequestsAdminPage />
        ) : activeTab === 'queries' ? (
          <QueriesAdminPage />
        ) : activeTab === 'survey' ? (
          <DailySurveyTracking />
        ) : activeTab === 'feedback' ? (
          <FeedbackPortalView />
        ) : activeTab === 'notices' ? (
          <NoticesPortalView />
        ) : null}
      </main>

      {/* Left Sidebar */}
      <aside className={`khidmat-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '20px 30px 40px', display: 'flex', alignItems: 'center', gap: 15 }}>
          <div style={{ width: 45, height: 45, borderRadius: 12, background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/al-mawaid.png" alt="" style={{ width: 30, height: 30 }} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--accent-primary)' }}>KHIDMAT</h2>
          <div style={{ flex: 1 }} />
          <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={24} /></button>
        </div>

        <div style={{ flex: 1 }}>
          {[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'users', icon: Users, label: 'Thali Users' },
            { id: 'requests', icon: Star, label: 'Requests' },
            { id: 'queries', icon: MessageCircle, label: 'Tickets' },
            { id: 'survey', icon: ClipboardList, label: 'Surveys' },
          ].map(({ id, icon: Icon, label }) => (
            <div 
              key={id} 
              onClick={() => { setActiveTab(id); setIsSidebarOpen(false); }} 
              className={`kh-sidebar-item ${activeTab === id ? 'active' : ''}`}
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


    </div>
  )
}

function FeedbackPortalView() {
  const [feedbacks, setFeedbacks] = useState([])
  const [menu, setMenu] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('daily_feedback').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('weekly_menu').select('*').order('week_start', { ascending: false }).limit(1)
    ]).then(([{ data: fb }, { data: mn }]) => {
      setFeedbacks(fb || [])
      if (mn?.[0]?.menu_json) setMenu(mn[0].menu_json)
      setLoading(false)
    })
  }, [])

  if (loading) return <Spinner fullPage={false} />

  const avg = (type) => {
    const vals = feedbacks.map(f => f[type]).filter(Boolean)
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—'
  }

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1, padding: 16, borderRadius: 20, background: 'var(--accent-bg)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent-primary)' }}>{avg('lunch_stars')}★</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Avg Lunch</div>
        </div>
        <div style={{ flex: 1, padding: 16, borderRadius: 20, background: 'rgba(94, 186, 130, 0.1)', border: '1px solid rgba(94, 186, 130, 0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#5eba82' }}>{avg('dinner_stars')}★</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Avg Dinner</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {feedbacks.map((fb, i) => {
          const dayMenu = menu[fb.day] || {}
          const lunchDishes = [dayMenu.lunch_1, dayMenu.lunch_2, dayMenu.lunch_3].filter(Boolean).join(', ')
          const dinnerDishes = [dayMenu.dinner_1, dayMenu.dinner_2, dayMenu.dinner_3].filter(Boolean).join(', ')
          return (
            <Card key={fb.id} style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Badge color="var(--accent-primary)">{fb.day.toUpperCase()}</Badge>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{new Date(fb.created_at).toLocaleDateString()}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-primary)' }}>LUNCH</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--accent-primary)' }}>{fb.lunch_stars}★</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{lunchDishes || 'No menu found'}</div>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#5eba82' }}>DINNER</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#5eba82' }}>{fb.dinner_stars}★</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{dinnerDishes || 'No menu found'}</div>
                </div>
              </div>

              {fb.comment && (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: 'var(--border-light)', borderLeft: '3px solid var(--accent-primary)', fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                  "{fb.comment}"
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function NoticesPortalView() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => {
        setNotices(data || [])
        setLoading(false)
      })
  }, [])

  if (loading) return <Spinner fullPage={false} />

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {notices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
            <Bell size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>No recent notices</div>
          </div>
        ) : notices.map((n, i) => (
          <Card key={n.id} style={{ padding: 20, borderLeft: `4px solid ${n.tone || 'var(--accent-primary)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: n.tone || 'var(--accent-primary)', textTransform: 'uppercase' }}>{n.sender_name || 'Admin'}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{new Date(n.created_at).toLocaleDateString()}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 8, color: '#fff' }}>{n.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{n.body}</div>
            {n.media && n.media[0] && (
              <img src={n.media[0]} style={{ width: '100%', borderRadius: 12, marginTop: 12, border: '1px solid rgba(255,255,255,0.1)' }} alt="notice" />
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}


function NoThaliTracker() {
  const t = useTheme()
  const [meal, setMeal] = useState(() => {
    const now = new Date()
    const h = now.getHours(), m = now.getMinutes()
    return (h > 16 || (h === 16 && m >= 30)) ? 'dinner' : 'lunch'
  })
  const [skips, setSkips] = useState([])
  const [loading, setLoading] = useState(true)

  const loadSkips = async () => {
    setLoading(true)
    try {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const todayIdx = new Date().getDay()
      
      // If Sunday, there are no recorded thali skips in the flat table (mon-sat only)
      if (todayIdx === 0) {
        setSkips([])
        setLoading(false)
        return
      }

      const dayKey = days[todayIdx].substring(0, 3)
      const mealKey = meal === 'lunch' ? 'l' : 'd'
      const statusCol = `${dayKey}_${mealKey}_status`

      const { data, error } = await supabase
        .from('survey_submissions_flat')
        .select('user_id, thali_number, email')
        .eq(statusCol, 'Skipped')

      if (error) throw error

      // Get names from user_stats
      if (data?.length > 0) {
        const userIds = data.map(d => d.user_id)
        const { data: stats } = await supabase.from('user_stats').select('user_id, name').in('user_id', userIds)
        const combined = data.map(d => ({
          ...d,
          name: stats?.find(s => s.user_id === d.user_id)?.name || 'Unknown'
        }))
        setSkips(combined)
      } else {
        setSkips([])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSkips() }, [meal])

  return (
    <Card title="No Thali Members" icon={<AlertCircle size={20} color="#e05555" />} count={skips.length}>
      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 4, marginBottom: 16, border: '1px solid var(--accent-bg)' }}>
        <button onClick={() => setMeal('lunch')} style={{ flex: 1, padding: '8px', borderRadius: 11, border: 'none', background: meal === 'lunch' ? 'var(--accent-primary)' : 'transparent', color: meal === 'lunch' ? '#000' : 'var(--text-tertiary)', fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: '0.3s' }}>LUNCH</button>
        <button onClick={() => setMeal('dinner')} style={{ flex: 1, padding: '8px', borderRadius: 11, border: 'none', background: meal === 'dinner' ? 'var(--accent-primary)' : 'transparent', color: meal === 'dinner' ? '#000' : 'var(--text-tertiary)', fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: '0.3s' }}>DINNER</button>
      </div>

      {loading ? <Spinner fullPage={false} /> : skips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,248,225,0.3)', fontSize: 13 }}>No skips recorded for {meal}.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
          {skips.map(s => (
            <div key={s.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(224,85,85,0.1)', color: '#e05555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>{s.thali_number || '#?'}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
              </div>
              <Badge color="#e05555">SKIPPED</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function Badge({ children, color = 'var(--accent-primary)' }) {
  return (
    <span style={{ padding: '4px 10px', borderRadius: 20, background: `${color}15`, border: `1px solid ${color}30`, color, fontSize: 10, fontWeight: 900, letterSpacing: '0.05em' }}>
      {children}
    </span>
  )
}
