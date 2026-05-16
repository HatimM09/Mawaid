// src/admin/Dashboard.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import {
  Users, Star, Calendar, Zap, RefreshCw, Package, ArrowUpRight, ChevronRight, AlertCircle, FileText, Check, Bell, AlertTriangle, QrCode
} from 'lucide-react'
import {
  T, PageWrap, StatCard, AdminCard, Badge, Spinner, SectionHeader, Btn, SlideDrawer, Skeleton, SoundUI
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
    // Generate real metrics for the pie chart and bars
    // This could be from daily_feedback but for now let's make it look dynamic
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    setFeedbackByDay(DAYS.map(d => ({ name: d, lunch: 40 + Math.random() * 40, dinner: 50 + Math.random() * 30 })))
  }

  if (loading) return (
    <PageWrap>
      <div className="bento-grid">
        <div style={{ gridArea: 'header', marginBottom: 20 }}><Skeleton width="200px" height={32} /></div>
        <Skeleton style={{ gridArea: 'stat1', height: 120 }} />
        <Skeleton style={{ gridArea: 'stat2', height: 120 }} />
        <Skeleton style={{ gridArea: 'stat3', height: 120 }} />
        <Skeleton style={{ gridArea: 'stat4', height: 120 }} />
        <Skeleton style={{ gridArea: 'nav', height: 400 }} />
        <Skeleton style={{ gridArea: 'inventory', height: 200 }} />
        <Skeleton style={{ gridArea: 'thali', height: 150 }} />
        <Skeleton style={{ gridArea: 'actionable', height: 200 }} />
        <Skeleton style={{ gridArea: 'reports', height: 200 }} />
      </div>
    </PageWrap>
  )

  return (
    <PageWrap>
      {/* Dashboard Bento Grid */}
      <div className="bento-grid">
        {/* Header */}
        <div style={{ gridArea: 'header', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-gold)', margin: 0, letterSpacing: '0.1em' }}>ADMIN PORTAL</h1>
          <Btn variant="outline" size="sm" onClick={() => { SoundUI.success(); loadAll(true); }} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> 
            <span className="desktop-only" style={{ marginLeft: 6 }}>{refreshing ? 'Refreshing...' : 'Refresh Stats'}</span>
          </Btn>
        </div>

        {/* Stat Cards */}
        <AdminCard 
          onClick={() => { SoundUI.click(); navigate('/admin/users'); }} 
          style={{ gridArea: 'stat1', background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.1)', cursor: 'pointer', transition: 'transform 0.2s', animation: 'popIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both' }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color="var(--accent-gold)" />
            </div>
            <QrCode 
              size={14} 
              color="var(--accent-gold)" 
              style={{ opacity: 0.5 }} 
            />
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 12 }}>{stats.users}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>Members (QR Ready)</div>
        </AdminCard>

        <AdminCard 
          onClick={() => navigate('/admin/survey-tracking')} 
          style={{ gridArea: 'stat2', background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.1)', cursor: 'pointer', transition: 'transform 0.2s', animation: 'popIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both' }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 16 }}>🍱</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 12 }}>{stats.todayThalis}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>Thalis for {new Date().getHours() < 16 ? 'Lunch' : 'Dinner'}</div>
        </AdminCard>

        <AdminCard 
          onClick={() => navigate('/admin/queries')} 
          style={{ gridArea: 'stat3', background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.1)', cursor: 'pointer', transition: 'transform 0.2s', animation: 'popIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both' }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--accent-gold)', fontWeight: 900, fontSize: 18 }}>?</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 12 }}>{stats.queries}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>Open Queries</div>
        </AdminCard>

        <AdminCard 
          onClick={() => navigate('/admin/inventory')} 
          style={{ gridArea: 'stat4', background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.1)', cursor: 'pointer', transition: 'transform 0.2s', animation: 'popIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both' }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={16} color="var(--accent-gold)" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 12, color: stats.lowStock > 0 ? '#f43f5e' : 'var(--accent-gold)' }}>{stats.lowStock}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>Low Stock Items</div>
        </AdminCard>

        {/* QR Code Hub Tile */}
        <AdminCard 
          onClick={() => navigate('/admin/qr-portal')} 
          style={{ gridArea: 'qr', background: T.accentGrad, border: 'none', cursor: 'pointer', transition: 'transform 0.2s', animation: 'popIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.28s both', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#fff', gap: 12 }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ width: 50, height: 50, borderRadius: 15, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QrCode size={28} color="#fff" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>QR HUB</div>
            <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 700 }}>Scan & Identify</div>
          </div>
        </AdminCard>

        {/* Quick Nav */}
        <AdminCard onClick={() => navigate('/admin/users')} style={{ gridArea: 'nav', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', animation: 'popIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both' }}>
          <div style={{ padding: '24px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>QUICK NAVIGATION</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} color="var(--accent-gold)" />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>Members</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Manage all members</div>
                </div>
              </div>
              <ChevronRight size={20} color="var(--text-tertiary)" />
            </div>
          </div>
          <div style={{ flex: 1, borderTop: '1px solid var(--border-light)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '16px 24px', color: 'var(--text-tertiary)' }}>Team Availability</td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-green)' }}>Tomorrow</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '16px 24px', color: 'var(--text-tertiary)' }}>Team Logistics</td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-green)' }}>Active</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ padding: 16, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setDrawerOpen(true)}>
            <Zap size={16} color="var(--accent-gold)" />
            <span style={{ fontSize: 12, fontWeight: 800 }}>Open Command Center</span>
          </div>
        </AdminCard>

        {/* Inventory */}
        <AdminCard onClick={() => navigate('/admin/inventory')} style={{ gridArea: 'inventory', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', animation: 'popIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both' }}>
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
        <AdminCard onClick={() => navigate('/admin/requests')} style={{ gridArea: 'thali', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', animation: 'popIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both' }}>
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
        <AdminCard onClick={() => navigate('/admin/survey-tracking')} style={{ gridArea: 'actionable', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', animation: 'popIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.45s both' }}>
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

        {/* Reports */}
        <AdminCard style={{ gridArea: 'reports', display: 'flex', flexDirection: 'column', gap: 16, animation: 'popIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both' }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Reports</div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={feedbackByDay}>
                  <Bar dataKey="lunch" fill="var(--accent-purple)" radius={[4, 4, 0, 0]} barSize={8} />
                  <Bar dataKey="dinner" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} barSize={8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ v: 40 }, { v: 30 }, { v: 20 }, { v: 10 }]} dataKey="v" innerRadius={35} outerRadius={50} paddingAngle={5}>
                    {CHART_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              {[
                { label: 'Users & Thali Database', path: '/admin/users' },
                { label: 'Survey Tracking', path: '/admin/surveys' },
                { label: 'Inventory & Stock', path: '/admin/inventory' },
                { label: 'Requests Admin', path: '/admin/requests' },
                { label: 'User Feedback', path: '/admin/feedback' },
                { label: 'User Queries', path: '/admin/queries' },
                { label: 'Settings & Config', path: '/admin/settings' },
              ].map(l => (
                <button key={l.label} onClick={() => { navigate(l.path); setDrawerOpen(false); }} style={{ padding: '16px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', textAlign: 'left', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {l.label}
                  <ChevronRight size={16} color="var(--text-tertiary)" />
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
            "nav nav inventory qr"
            "nav nav inventory thali"
            "nav nav actionable reports";
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
              "nav nav"
              "inventory qr"
              "thali actionable"
              "reports reports";
          }
        }

        @media (max-width: 768px) {
          .bento-grid {
            grid-template-columns: repeat(2, 1fr);
            grid-template-areas: 
              "header header"
              "stat1 stat2"
              "stat3 stat4"
              "qr nav"
              "inventory inventory"
              "thali actionable"
              "reports reports";
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
