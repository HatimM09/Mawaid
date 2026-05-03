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
  const t = { accent: 'var(--accent-primary)', textSub: 'rgba(255,255,255,0.5)' }
  return (
    <div style={fullPage ? { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' } : {}}>
      <div className="spin" style={{ width: 34, height: 34, border: `2.5px solid var(--border-light)`, borderTop: `2.5px solid ${t.accent}`, borderRadius: '50%' }} />
    </div>
  )
}

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


  if (loading) return <Spinner />

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-grad)',
      color: 'var(--text-primary)', overflowX: 'hidden', fontFamily: "'Inter', sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Amiri:wght@400;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        ::-webkit-scrollbar { width: 0; }
      `}</style>

      {/* Header */}
      <header style={{ textAlign: 'center', padding: '40px 20px 20px' }}>
        <p style={{ fontFamily: "'Inter', sans-serif, 'Amiri', serif", fontSize: 16, color: 'var(--accent-primary)', margin: '0 0 4px' }}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '0.15em', color: 'var(--accent-primary)', fontFamily: "'Inter', sans-serif" }}>AL-MAWAID</h1>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--border-active)', marginTop: 4 }}>Khidmat Team Portal</div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px clamp(16px, 4vw, 32px) 120px' }}>
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
              <button
                onClick={() => setActiveTab('notices')}
                style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 12, padding: 10, cursor: 'pointer', color: 'var(--accent-primary)' }}>
                <Bell size={20} />
              </button>
            </Card>

            <NoThaliTracker />


            {/* Weekly Menu Preview */}
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 10px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.7 }}>WHOLE WEEK MENU</div>
                <div onClick={() => setActiveTab('survey')} style={{ fontSize: 10, color: 'var(--accent-primary)', fontWeight: 700, cursor: 'pointer' }}>VIEW ALL</div>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
                gap: 16, 
                paddingBottom: 10 
              }}>
                {weeklyMenu.map(day => (
                  <div key={day.name} style={{ padding: 16, borderRadius: 24, background: 'var(--border-light)', border: '1px solid var(--accent-bg)', backdropFilter: 'blur(10px)', transition: 'transform 0.3s ease' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--accent-primary)', marginBottom: 10, borderBottom: '1px solid var(--border-light)', paddingBottom: 4 }}>{day.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', opacity: 0.8, marginBottom: 4 }}>LUNCH</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4, marginBottom: 10 }}>{day.lunch_1 || '—'}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#5eba82', opacity: 0.8, marginBottom: 4 }}>DINNER</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{day.dinner_1 || '—'}</div>
                  </div>
                ))}
                {weeklyMenu.length === 0 && <div style={{ fontSize: 12, color: 'rgba(255,248,225,0.3)', padding: 20 }}>Loading menu...</div>}
              </div>
            </div>

          </div>
        ) : activeTab === 'users' ? (
          <UsersPage />
        ) : activeTab === 'survey' ? (
          <DailySurveyTracking />
        ) : activeTab === 'feedback' ? (
          <FeedbackPortalView />
        ) : activeTab === 'notices' ? (
          <NoticesPortalView />
        ) : null}
      </main>

      {/* Global Portal Nav - Pill Shape */}
      <nav style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        width: '92%', maxWidth: 500, height: 74,
        background: 'var(--bg-card)', backdropFilter: 'blur(30px)',
        border: '1.5px solid var(--border-active)', borderRadius: 100,
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '0 10px', zIndex: 1000,
        boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px var(--accent-bg)'
      }}>
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'users', icon: Users, label: 'Users' },
          { id: 'survey', icon: Calendar, label: 'Stats' },
          { id: 'feedback', icon: Star, label: 'Rating' },
        ].map(({ id, icon: Icon, label }) => {
          const active = activeTab === id
          return (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              color: active ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              transition: 'all 0.3s',
              minWidth: 50
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: active ? 'var(--accent-bg)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: active ? 'inset 0 0 10px var(--border-light)' : 'none',
                border: active ? '1px solid var(--accent-border)' : '1px solid transparent'
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
