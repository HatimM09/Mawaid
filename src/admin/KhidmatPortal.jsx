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
  const [weeklyMenu, setWeeklyMenu] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [surveyData, setSurveyData] = useState({
    lunch: 'yes', lunch_pct: 100,
    dinner: 'yes', dinner_pct: 100
  })

  useEffect(() => { loadHomeData() }, [])
  const loadHomeData = async () => {
    setLoadingItems(true)
    const [{ data: req }, { data: queries }, { data: menu }] = await Promise.all([
      supabase.from('thali_requests').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('queries').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('weekly_menu').select('*').order('week_start', { ascending: false }).limit(1)
    ])
    setRequestsList(req || []); 
    setQueriesList(queries || []);
    if (menu?.[0]?.menu_json) {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      setWeeklyMenu(days.map(d => ({ name: d, ...menu[0].menu_json[d] })))
    }
    setLoadingItems(false)
  }

  const handleSurveySubmit = async () => {
    const { error } = await supabase.from('daily_kitchen_audit').insert({
      staff_id: user.id,
      day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      lunch_served: surveyData.lunch === 'yes',
      lunch_consumption: surveyData.lunch_pct,
      dinner_served: surveyData.dinner === 'yes',
      dinner_consumption: surveyData.dinner_pct,
      recorded_at: new Date().toISOString()
    })
    if (!error) alert('✅ Survey Submitted Successfully')
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
              <button 
                onClick={() => setActiveTab('notices')}
                style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 12, padding: 10, cursor: 'pointer', color: '#D4AF37' }}>
                <Bell size={20} />
              </button>
            </Card>

            {/* Main Action - Daily Kitchen Survey */}
            <DailySurveyPanel surveyData={surveyData} setSurveyData={setSurveyData} onSubmit={handleSurveySubmit} />

            {/* Weekly Menu Preview */}
            <div style={{ marginTop: 8 }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 10px' }}>
                 <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(212,175,55,0.6)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>WHOLE WEEK MENU</div>
                 <div onClick={() => setActiveTab('survey')} style={{ fontSize: 10, color: '#D4AF37', fontWeight: 700, cursor: 'pointer' }}>VIEW ALL</div>
               </div>
               <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 10 }}>
                 {weeklyMenu.map(day => (
                   <div key={day.name} style={{ minWidth: 160, padding: 16, borderRadius: 24, background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.1)', backdropFilter: 'blur(10px)' }}>
                     <div style={{ fontSize: 13, fontWeight: 900, color: '#D4AF37', marginBottom: 10, borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: 4 }}>{day.name}</div>
                     <div style={{ fontSize: 11, fontWeight: 700, color: '#FFF8E1', opacity: 0.8, marginBottom: 4 }}>LUNCH</div>
                     <div style={{ fontSize: 10, color: 'rgba(255,248,225,0.5)', lineHeight: 1.4, marginBottom: 10 }}>{day.lunch_1 || '—'}</div>
                     <div style={{ fontSize: 11, fontWeight: 700, color: '#5eba82', opacity: 0.8, marginBottom: 4 }}>DINNER</div>
                     <div style={{ fontSize: 10, color: 'rgba(255,248,225,0.5)', lineHeight: 1.4 }}>{day.dinner_1 || '—'}</div>
                   </div>
                 ))}
                 {weeklyMenu.length === 0 && <div style={{ fontSize: 12, color: 'rgba(255,248,225,0.3)', padding: 20 }}>Loading menu...</div>}
               </div>
            </div>

          </div>
        ) : activeTab === 'users' ? (
          <UsersPage />
        ) : activeTab === 'requests' ? (
          <RequestsAdminPage />
        ) : activeTab === 'survey' ? (
          <DailySurveyTracking />
        ) : activeTab === 'feedback' ? (
          <FeedbackPortalView />
        ) : activeTab === 'notices' ? (
          <NoticesPortalView />
        ) : activeTab === 'survey_fill' ? (
          <div style={{ animation: 'fadeIn 0.5s ease' }}>
            <DailySurveyPanel surveyData={surveyData} setSurveyData={setSurveyData} onSubmit={handleSurveySubmit} />
          </div>
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
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'users', icon: Users, label: 'Users' },
          { id: 'survey_fill', icon: ClipboardList, label: 'Survey' },
          { id: 'survey', icon: Calendar, label: 'Stats' },
          { id: 'feedback', icon: Star, label: 'Rating' },
        ].map(({ id, icon: Icon, label }) => {
          const active = activeTab === id
          return (
            <button key={id} onClick={() => setActiveTab(id)} style={{ 
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              color: active ? '#D4AF37' : 'rgba(255,248,225,0.4)',
              transition: 'all 0.3s',
              minWidth: 50
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
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
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
    return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '—'
  }

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1, padding: 16, borderRadius: 20, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#D4AF37' }}>{avg('lunch_stars')}★</div>
          <div style={{ fontSize: 10, color: 'rgba(255,248,225,0.5)', fontWeight: 700, textTransform: 'uppercase' }}>Avg Lunch</div>
        </div>
        <div style={{ flex: 1, padding: 16, borderRadius: 20, background: 'rgba(94, 186, 130, 0.1)', border: '1px solid rgba(94, 186, 130, 0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#5eba82' }}>{avg('dinner_stars')}★</div>
          <div style={{ fontSize: 10, color: 'rgba(255,248,225,0.5)', fontWeight: 700, textTransform: 'uppercase' }}>Avg Dinner</div>
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
                <Badge color="#D4AF37">{fb.day.toUpperCase()}</Badge>
                <div style={{ fontSize: 10, color: 'rgba(255,248,225,0.4)' }}>{new Date(fb.created_at).toLocaleDateString()}</div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#D4AF37' }}>LUNCH</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#D4AF37' }}>{fb.lunch_stars}★</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,248,225,0.5)', fontStyle: 'italic' }}>{lunchDishes || 'No menu found'}</div>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#5eba82' }}>DINNER</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#5eba82' }}>{fb.dinner_stars}★</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,248,225,0.5)', fontStyle: 'italic' }}>{dinnerDishes || 'No menu found'}</div>
                </div>
              </div>

              {fb.comment && (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: 'rgba(212,175,55,0.05)', borderLeft: '3px solid #D4AF37', fontSize: 13, color: 'rgba(255,248,225,0.8)', fontStyle: 'italic' }}>
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

    const channel = supabase.channel('public:notices')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' }, (payload) => {
        setNotices(prev => [payload.new, ...prev])
        // Trigger browser notification
        if (Notification.permission === 'granted') {
          new Notification(payload.new.title, { body: payload.new.body, icon: '/logo.png' })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (loading) return <Spinner fullPage={false} />

  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {notices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,248,225,0.4)' }}>
            <Bell size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>No recent notices</div>
          </div>
        ) : notices.map((n, i) => (
          <Card key={n.id} style={{ padding: 20, borderLeft: `4px solid ${n.tone || '#D4AF37'}` }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: n.tone || '#D4AF37', textTransform: 'uppercase' }}>{n.sender_name || 'Admin'}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,248,225,0.4)' }}>{new Date(n.created_at).toLocaleDateString()}</div>
             </div>
             <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 8, color: '#fff' }}>{n.title}</div>
             <div style={{ fontSize: 13, color: 'rgba(255,248,225,0.7)', lineHeight: 1.5 }}>{n.body}</div>
             {n.media && n.media[0] && (
               <img src={n.media[0]} style={{ width: '100%', borderRadius: 12, marginTop: 12, border: '1px solid rgba(255,255,255,0.1)' }} alt="notice" />
             )}
          </Card>
        ))}
      </div>
    </div>
  )
}

function DailySurveyPanel({ surveyData, setSurveyData, onSubmit }) {
  const T = { goldBar: 'linear-gradient(to right, #8B6B23 0%, #D4AF37 45%, #FFD700 50%, #D4AF37 55%, #8B6B23 100%)' }
  
  return (
    <Card organic title="Daily Kitchen Survey" icon={<ClipboardList size={20} color="#D4AF37" />}>
       <p style={{ fontSize: 12, color: 'rgba(255,248,225,0.5)', marginTop: -10, marginBottom: 20 }}>Record meal status and consumption for today's kitchen audit.</p>
       
       <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
         {/* Lunch Section */}
         <div style={{ padding: 16, borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.1)' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#D4AF37' }}>LUNCH STATUS</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => setSurveyData({...surveyData, lunch: 'yes'})}
                  style={{ padding: '6px 12px', borderRadius: 8, background: surveyData.lunch === 'yes' ? 'rgba(94, 186, 130, 0.2)' : 'transparent', color: surveyData.lunch === 'yes' ? '#5eba82' : 'rgba(255,248,225,0.4)', border: `1px solid ${surveyData.lunch === 'yes' ? '#5eba82' : 'rgba(255,248,225,0.1)'}`, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>YES</button>
                <button 
                  onClick={() => setSurveyData({...surveyData, lunch: 'no'})}
                  style={{ padding: '6px 12px', borderRadius: 8, background: surveyData.lunch === 'no' ? 'rgba(224, 85, 85, 0.2)' : 'transparent', color: surveyData.lunch === 'no' ? '#e05555' : 'rgba(255,248,225,0.4)', border: `1px solid ${surveyData.lunch === 'no' ? '#e05555' : 'rgba(255,248,225,0.1)'}`, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>NO</button>
              </div>
           </div>
           <div style={{ fontSize: 10, color: 'rgba(255,248,225,0.4)', marginBottom: 8, letterSpacing: 1 }}>CONSUMPTION %</div>
           <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
              {[0, 25, 50, 100].map(p => (
                <button key={p} 
                  onClick={() => setSurveyData({...surveyData, lunch_pct: p})}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `1px solid ${surveyData.lunch_pct === p ? '#D4AF37' : 'rgba(212,175,55,0.1)'}`, background: surveyData.lunch_pct === p ? 'rgba(212,175,55,0.1)' : 'transparent', color: surveyData.lunch_pct === p ? '#D4AF37' : 'rgba(255,248,225,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{p}%</button>
              ))}
           </div>
         </div>

         {/* Dinner Section */}
         <div style={{ padding: 16, borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.1)' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#D4AF37' }}>DINNER STATUS</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => setSurveyData({...surveyData, dinner: 'yes'})}
                  style={{ padding: '6px 12px', borderRadius: 8, background: surveyData.dinner === 'yes' ? 'rgba(94, 186, 130, 0.2)' : 'transparent', color: surveyData.dinner === 'yes' ? '#5eba82' : 'rgba(255,248,225,0.4)', border: `1px solid ${surveyData.dinner === 'yes' ? '#5eba82' : 'rgba(255,248,225,0.1)'}`, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>YES</button>
                <button 
                  onClick={() => setSurveyData({...surveyData, dinner: 'no'})}
                  style={{ padding: '6px 12px', borderRadius: 8, background: surveyData.dinner === 'no' ? 'rgba(224, 85, 85, 0.2)' : 'transparent', color: surveyData.dinner === 'no' ? '#e05555' : 'rgba(255,248,225,0.4)', border: `1px solid ${surveyData.dinner === 'no' ? '#e05555' : 'rgba(255,248,225,0.1)'}`, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>NO</button>
              </div>
           </div>
           <div style={{ fontSize: 10, color: 'rgba(255,248,225,0.4)', marginBottom: 8, letterSpacing: 1 }}>CONSUMPTION %</div>
           <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
              {[0, 25, 50, 100].map(p => (
                <button key={p} 
                  onClick={() => setSurveyData({...surveyData, dinner_pct: p})}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `1px solid ${surveyData.dinner_pct === p ? '#D4AF37' : 'rgba(212,175,55,0.1)'}`, background: surveyData.dinner_pct === p ? 'rgba(212,175,55,0.1)' : 'transparent', color: surveyData.dinner_pct === p ? '#D4AF37' : 'rgba(255,248,225,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{p}%</button>
              ))}
           </div>
         </div>

         <div style={{ display: 'flex', gap: 12 }}>
           <button onClick={() => alert('Survey Skipped')} style={{ flex: 1, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,248,225,0.5)', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Skip Today</button>
           <button onClick={onSubmit} style={{ flex: 2, height: 44, borderRadius: 12, background: T.goldBar, color: '#000', border: 'none', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer' }}>Submit Survey</button>
         </div>
       </div>
    </Card>
  )
}

function Badge({ children, color = '#D4AF37' }) {
  return (
    <span style={{ padding: '4px 10px', borderRadius: 20, background: `${color}15`, border: `1px solid ${color}30`, color, fontSize: 10, fontWeight: 900, letterSpacing: '0.05em' }}>
      {children}
    </span>
  )
}
