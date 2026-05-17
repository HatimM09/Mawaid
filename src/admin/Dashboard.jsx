// src/admin/Dashboard.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import {
  Users, Star, Calendar, Zap, RefreshCw, Package, ArrowUpRight, ChevronRight, AlertCircle, FileText, Check, Bell, AlertTriangle, QrCode
} from 'lucide-react'
import {
  T, PageWrap, StatCard, AdminCard, Badge, Spinner, SectionHeader, Btn, SlideDrawer
} from './ui'
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'

const CHART_COLORS = ['var(--accent-gold)', 'var(--accent-cyan)', 'var(--accent-purple)', 'var(--accent-pink)', 'var(--accent-green)', 'var(--accent-orange)']

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [stats, setStats] = useState({
    users: 0, surveys: 0, feedback: 0, requests: 0, queries: 0, todayThalis: 0, lowStock: 0
  })
  const [missingSurveys, setMissingSurveys] = useState([])
  const [feedbackByDay, setFeedbackByDay] = useState([])
  const [inventoryTrend, setInventoryTrend] = useState([
    { name: '1', count: 40 }, { name: '2', count: 30 }, { name: '3', count: 55 }, { name: '4', count: 35 }, { name: '5', count: 70 }, { name: '6', count: 45 }, { name: '7', count: 50 },
  ])
  const navigate = useNavigate()

  const getWeekDate = () => {
    const now = new Date()
    const day = now.getDay()
    const hour = now.getHours()
    let diff = now.getDate() - day + (day === 0 ? -6 : 1)
    // Saturday 8PM+ or Sunday: surveys target next week's Monday
    if (day === 0 || (day === 6 && hour >= 20)) {
      diff += 7
    }
    const monday = new Date(now.setDate(diff))
    return monday.toISOString().split('T')[0]
  }

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    await Promise.all([
      loadStats(), loadFeedbackByDay()
    ])

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // --- WIRELESS SCANNER REDIRECT ---
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
          navigate(`/admin/surveys?userId=${userId}`)
          scanBuffer = ''
        }
      } else if (e.key.length === 1) {
        scanBuffer += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  const loadStats = async () => {
    const currentWeekId = getWeekDate()
    const [u, s, f, r, q, allUsers, allSubmissions, allInventory] = await Promise.all([
      supabase.from('user_stats').select('id', { count: 'exact', head: true }),
      supabase.from('survey_submissions_flat').select('user_id', { count: 'exact', head: true }).eq('week_id', currentWeekId),
      supabase.from('daily_feedback').select('id', { count: 'exact', head: true }),
      supabase.from('thali_requests').select('id', { count: 'exact', head: true }).or('status.eq.pending,status.is.null'),
      supabase.from('queries').select('id', { count: 'exact', head: true }).or('status.eq.open,status.is.null'),
      supabase.from('user_stats').select('user_id, name, thali_number'),
      supabase.from('survey_submissions_flat').select('*').eq('week_id', currentWeekId),
      supabase.from('inventory').select('id, stock, low_stock_threshold'),
    ])

    const today = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]
    const meal = new Date().getHours() < 16 ? 'l' : 'd'
    const todayKey = `${today}_${meal}_status`
    
    const submissions = allSubmissions.data || []
    const todayCount = submissions.filter(s => s[todayKey] === 'Applied').length
    
    const inventory = allInventory.data || []
    const lowStockCount = inventory.filter(p => p.stock <= p.low_stock_threshold).length

    setStats({
      users: u.count ?? 0,
      surveys: s.count ?? 0,
      feedback: f.count ?? 0,
      requests: r.count ?? 0,
      queries: q.count ?? 0,
      todayThalis: todayCount,
      lowStock: lowStockCount
    })

    const submittedIds = new Set(submissions.map(row => row.user_id))
    const missing = (allUsers.data || []).filter(user => !submittedIds.has(user.user_id))
    setMissingSurveys(missing)

    // Update trend based on real data
    if (inventory.length > 0) {
      const topItems = inventory.sort((a, b) => b.stock - a.stock).slice(0, 7)
      setInventoryTrend(topItems.map(item => ({ 
        name: (item.name || 'Item').substring(0, 5), 
        count: item.stock || 0 
      })))
    }
  }

  const loadFeedbackByDay = async () => {
    const DAYS = ['Thali', 'Feb', 'Mar', 'Apr', 'May', 'Dec']
    setFeedbackByDay(DAYS.map(d => ({ name: d, lunch: 20 + Math.random() * 60, dinner: 30 + Math.random() * 50 })))
  }

  if (loading) return <Spinner />

  return (
    <PageWrap>
      {/* Dashboard Bento Grid */}
      <div className="bento-grid">
        {/* Header */}
        <div style={{ gridArea: 'header', marginBottom: 10 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-gold)', margin: 0, letterSpacing: '0.1em' }}>ADMIN PORTAL</h1>
        </div>

        {/* Stat Cards */}
        <AdminCard 
          onClick={() => navigate('/admin/users')}
          style={{ gridArea: 'stat1', background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.1)', cursor: 'pointer', transition: 'all 0.3s' }}
          className="hover-lift"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color="var(--accent-gold)" />
            </div>
            <QrCode 
              size={14} 
              color="var(--accent-gold)" 
              style={{ opacity: 0.5, cursor: 'pointer' }} 
              onClick={(e) => {
                e.stopPropagation()
                navigate('/admin/qr')
              }} 
            />
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 12 }}>{stats.users}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>Members (QR Ready)</div>
        </AdminCard>

        <AdminCard 
          onClick={() => navigate('/admin/surveys')}
          style={{ gridArea: 'stat2', background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.1)', cursor: 'pointer', transition: 'all 0.3s' }}
          className="hover-lift"
        >
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 16 }}>🍱</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 12 }}>{stats.todayThalis}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>Thalis for {new Date().getHours() < 16 ? 'Lunch' : 'Dinner'}</div>
        </AdminCard>

        <AdminCard 
          onClick={() => navigate('/admin/queries')}
          style={{ gridArea: 'stat3', background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.1)', cursor: 'pointer', transition: 'all 0.3s' }}
          className="hover-lift"
        >
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--accent-gold)', fontWeight: 900, fontSize: 18 }}>?</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 12 }}>{stats.queries}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>Open Queries</div>
        </AdminCard>

        <AdminCard 
          onClick={() => navigate('/admin/inventory')} 
          style={{ gridArea: 'stat4', background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.1)', cursor: 'pointer', transition: 'all 0.3s' }}
          className="hover-lift"
        >
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={16} color="var(--accent-gold)" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 12, color: stats.lowStock > 0 ? '#f43f5e' : 'var(--accent-gold)' }}>{stats.lowStock}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>Low Stock Items</div>
        </AdminCard>

        {/* QR Identity Hub Card */}
        <AdminCard style={{ gridArea: 'qr-hub', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>QR Identity Hub</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Stickers & scan dispatch controls</div>
            </div>
            <QrCode size={20} color="var(--accent-gold)" />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Btn variant="primary" style={{ flex: 1, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => navigate('/admin/qr')}>
              <QrCode size={14} /> Open Hub
            </Btn>
            <Btn variant="outline" style={{ flex: 1, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setDrawerOpen(true)}>
              <Zap size={14} /> Command Center
            </Btn>
          </div>
          <div style={{ flex: 1, borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Pending Survey Members</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 150 }} className="custom-scroll">
              {(missingSurveys || []).slice(0, 3).map(u => (
                <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(212, 175, 55, 0.08)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>
                      #{u.thali_number || '—'}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name || 'Anonymous'}</div>
                  </div>
                  <Btn variant="ghost" size="sm" onClick={() => navigate(`/admin/qr?userId=${u.user_id}`)} style={{ padding: 4 }}><ArrowUpRight size={14} /></Btn>
                </div>
              ))}
              {(!missingSurveys || missingSurveys.length === 0) && (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>No missing surveys ✓</div>
              )}
            </div>
          </div>
        </AdminCard>

        {/* Inventory */}
        <AdminCard onClick={() => navigate('/admin/inventory')} style={{ gridArea: 'inventory', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Inventory</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Stock levels</div>
            </div>
            <ChevronRight size={18} color="var(--text-tertiary)" />
          </div>
          <div style={{ flex: 1, minHeight: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={inventoryTrend}>
                <defs>
                  <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-orange)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent-orange)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="count" stroke="var(--accent-orange)" fillOpacity={1} fill="url(#colorStock)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>

        {/* Thali */}
        <AdminCard onClick={() => navigate('/admin/requests')} style={{ gridArea: 'thali', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star size={18} color="var(--accent-gold)" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{stats.requests}</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Thali Requests</div>
          <Btn variant="primary" size="sm" style={{ width: '100%' }}>View All</Btn>
        </AdminCard>

        {/* Missing Surveys */}
        <AdminCard onClick={() => navigate('/admin/surveys')} style={{ gridArea: 'actionable', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-pink)' }}>PENDING SURVEYS</div>
            <Badge color="var(--accent-pink)">{missingSurveys.length}</Badge>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 200, display: 'flex', flexDirection: 'column', gap: 8 }} className="custom-scroll">
            {missingSurveys.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>All members have submitted! ✓</div>
            ) : missingSurveys.map(u => (
              <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-gold)', width: 30 }}>#{u.thali_number || '—'}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{u.name || 'Anonymous'}</div>
                </div>
                <ArrowUpRight size={14} color="var(--text-tertiary)" />
              </div>
            ))}
          </div>
        </AdminCard>
      </div>

      <SlideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Admin Quick Commands"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <SectionHeader>Quick Actions</SectionHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Refill Stock', icon: <Package size={20} />, color: 'var(--accent-green)' },
                { label: 'QR Portal', icon: <QrCode size={20} />, color: 'var(--accent-gold)', onClick: () => navigate('/admin/qr-portal') },
                { label: 'Approve All', icon: <Check size={20} />, color: 'var(--accent-cyan)' },
                { label: 'Send Alert', icon: <Bell size={20} />, color: 'var(--accent-orange)' },
                { label: 'Export Data', icon: <FileText size={20} />, color: 'var(--accent-purple)' },
              ].map((item, i) => (
                <button key={i} onClick={item.onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px', borderRadius: 18, border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <div style={{ color: item.color }}>{item.icon}</div>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader>Navigation</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Users', 'Surveys', 'Inventory', 'Requests'].map(l => (
                <button key={l} onClick={() => { navigate(`/admin/${l.toLowerCase()}`); setDrawerOpen(false); }} style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', textAlign: 'left', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  {l} Management
                </button>
              ))}
            </div>
          </div>

          <AdminCard style={{ background: 'rgba(244,63,94,0.1)', borderColor: 'rgba(244,63,94,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <AlertTriangle size={20} color="#f43f5e" />
              <h4 style={{ margin: 0, color: '#f43f5e', fontWeight: 800 }}>Maintenance Mode</h4>
            </div>
            <Btn variant="danger" size="sm" style={{ marginTop: 12, width: '100%' }}>Enable Now</Btn>
          </AdminCard>
        </div>
      </SlideDrawer>

      <style>{`
        .bento-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-auto-rows: minmax(100px, auto);
          gap: 20px;
          grid-template-areas: 
            "header header header header"
            "stat1 stat2 stat3 stat4"
            "qr-hub qr-hub inventory thali"
            "qr-hub qr-hub inventory actionable";
        }

        .bento-grid > * {
          opacity: 0;
          animation: slideUp 0.5s ease-out forwards;
        }

        .bento-grid > *:nth-child(1) { animation-delay: 0.1s; }
        .bento-grid > *:nth-child(2) { animation-delay: 0.15s; }
        .bento-grid > *:nth-child(3) { animation-delay: 0.2s; }
        .bento-grid > *:nth-child(4) { animation-delay: 0.25s; }
        .bento-grid > *:nth-child(5) { animation-delay: 0.3s; }
        .bento-grid > *:nth-child(6) { animation-delay: 0.35s; }
        .bento-grid > *:nth-child(7) { animation-delay: 0.4s; }

        @media (max-width: 1200px) {
          .bento-grid {
            grid-template-columns: repeat(2, 1fr);
            grid-template-areas: 
              "header header"
              "stat1 stat2"
              "stat3 stat4"
              "qr-hub qr-hub"
              "inventory thali"
              "actionable actionable";
          }
        }

        @media (max-width: 768px) {
          .bento-grid {
            grid-template-columns: repeat(2, 1fr);
            grid-template-areas: 
              "header header"
              "stat1 stat2"
              "stat3 stat4"
              "qr-hub qr-hub"
              "inventory inventory"
              "thali actionable";
            gap: 12px;
          }
          
          .bento-grid > div[style*="gridArea: 'header'"] {
            margin-bottom: 0 !important;
          }
        }
        
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </PageWrap>
  )
}
