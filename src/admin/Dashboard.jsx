// src/admin/Dashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import {
  Users, Star, Calendar, RefreshCw, ArrowUpRight, ChevronRight, AlertCircle, AlertTriangle, QrCode
} from 'lucide-react'
import {
  T, PageWrap, StatCard, AdminCard, Badge, Spinner, Btn, Modal
} from './ui'
import { QRCodeCanvas } from 'qrcode.react'
import { jsPDF } from 'jspdf'
import { getWeekDate } from '../common/utils'
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'

const CHART_COLORS = ['var(--accent-gold)', 'var(--accent-cyan)', 'var(--accent-purple)', 'var(--accent-pink)', 'var(--accent-green)', 'var(--accent-orange)']

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState({
    users: 0, surveys: 0, feedback: 0, requests: 0, queries: 0, todayThalis: 0, lowStock: 0
  })
  const [helpline, setHelpline] = useState('')
  const [missingSurveys, setMissingSurveys] = useState([])
  const [feedbackByDay, setFeedbackByDay] = useState([])
  const [inventoryTrend, setInventoryTrend] = useState([
    { name: '1', count: 40 }, { name: '2', count: 30 }, { name: '3', count: 55 }, { name: '4', count: 35 }, { name: '5', count: 70 }, { name: '6', count: 45 }, { name: '7', count: 50 },
  ])
  const [badgeKey, setBadgeKey] = useState(0)
  const [lowStockKey, setLowStockKey] = useState(0)
  const [requestsKey, setRequestsKey] = useState(0)
  const [qrHubOpen, setQrHubOpen] = useState(false)
  const [selectedQRUser, setSelectedQRUser] = useState(null)
  const [qrSearch, setQrSearch] = useState('')
  const [usersList, setUsersList] = useState([])
  const [toast, setToast] = useState({ message: '', icon: '', key: 0 })
  const toastTimer = useRef(null)
  const navigate = useNavigate()

  const downloadSticker = (u, format = 'png') => {
    const canvas = document.createElement('canvas');
    const w = 1500, h = 798;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const logo = new Image();
    logo.src = '/al-mawaid.png';
    logo.onload = () => {
      const logoCx = 250, logoCy = 220, logoR = 170;
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2);
      ctx.clip();
      const s = Math.max((logoR * 2) / logo.width, (logoR * 2) / logo.height);
      const dw = logo.width * s, dh = logo.height * s;
      ctx.drawImage(logo, logoCx - dw / 2, logoCy - dh / 2, dw, dh);
      ctx.restore();

      const thaliText = `${u.thali_number || '—'}`;
      ctx.font = '900 120px "DM Sans", sans-serif';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(thaliText, 250, 520);

      const qrCanvas = document.getElementById(`qr-canvas-${u.user_id}`);
      if (qrCanvas) {
        const qrSize = 480;
        ctx.drawImage(qrCanvas, w - qrSize - 120, (h - qrSize) / 2, qrSize, qrSize);
      }

      if (format === 'pdf') {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: [150, 79.8]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, 150, 79.8);
        pdf.save(`Sticker_${u.thali_number}_${u.name}.pdf`);
      } else {
        const link = document.createElement('a');
        link.download = `Sticker_${u.thali_number}_${u.name}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    };
  }

  const printSticker = (u) => {
    const canvas = document.createElement('canvas');
    const w = 1500, h = 798;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const logo = new Image();
    logo.src = '/al-mawaid.png';
    logo.onload = () => {
      const logoCx = 250, logoCy = 220, logoR = 170;
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2);
      ctx.clip();
      const s = Math.max((logoR * 2) / logo.width, (logoR * 2) / logo.height);
      const dw = logo.width * s, dh = logo.height * s;
      ctx.drawImage(logo, logoCx - dw / 2, logoCy - dh / 2, dw, dh);
      ctx.restore();

      const thaliText = `${u.thali_number || '—'}`;
      ctx.font = '900 120px "DM Sans", sans-serif';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(thaliText, 250, 520);

      const qrCanvas = document.getElementById(`qr-canvas-${u.user_id}`);
      if (qrCanvas) {
        const qrSize = 480;
        ctx.drawImage(qrCanvas, w - qrSize - 120, (h - qrSize) / 2, qrSize, qrSize);
      }

      const imgData = canvas.toDataURL('image/png');
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert("Please allow popups to print the sticker.");
        return;
      }
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Sticker - Thali #${u.thali_number || '—'}</title>
            <style>
              @page {
                size: 150mm 79.8mm;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                width: 100vw;
                background: #ffffff;
              }
              img {
                width: 150mm;
                height: 79.8mm;
                display: block;
              }
            </style>
          </head>
          <body>
            <img src="${imgData}" />
            <script>
              window.onload = () => {
                window.print();
                setTimeout(() => { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    };
  }

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    await Promise.all([
      loadStats(), loadFeedbackByDay(),
      supabase.from('app_settings').select('*').eq('key', 'helpline_number').maybeSingle()
        .then(({ data }) => { if (data) setHelpline(data.value) })
    ])

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const loadStats = useCallback(async () => {
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

    setUsersList(allUsers.data || [])

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
  }, [])


  const showToast = useCallback((message, icon) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(prev => ({ message, icon, key: prev.key + 1 }))
    toastTimer.current = setTimeout(() => {
      setToast(prev => ({ ...prev, key: 0 }))
    }, 2500)
  }, [])

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const loadFeedbackByDay = useCallback(async () => {
    const { data } = await supabase
      .from('daily_feedback')
      .select('day, lunch_stars, dinner_stars, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data && data.length > 0) {
      const dayMap = {}
      data.forEach(f => {
        if (!dayMap[f.day]) dayMap[f.day] = { name: f.day.slice(0, 3).toUpperCase(), lunch: 0, dinner: 0, count: 0 }
        if (f.lunch_stars) dayMap[f.day].lunch += f.lunch_stars
        if (f.dinner_stars) dayMap[f.day].dinner += f.dinner_stars
        dayMap[f.day].count++
      })
      setFeedbackByDay(Object.values(dayMap).map(d => ({
        name: d.name,
        lunch: d.count ? Math.round((d.lunch / d.count) * 20) : 0,
        dinner: d.count ? Math.round((d.dinner / d.count) * 20) : 0
      })))
    } else {
      setFeedbackByDay([])
    }
  }, [])

  

// --- REAL-TIME SUBSCRIPTIONS ---
  useEffect(() => {
    const channels = [
      supabase.channel('dashboard-survey-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_submissions_flat' }, () => {
          loadStats()
          setBadgeKey(k => k + 1)
          showToast('Survey updated', '🍱')
        }),
      supabase.channel('dashboard-inventory-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
          loadStats()
          setLowStockKey(k => k + 1)
          showToast('Stock changed', '📦')
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_log' }, () => {
          loadStats()
          setLowStockKey(k => k + 1)
          showToast('Inventory logged', '📋')
        }),
      supabase.channel('dashboard-requests-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'thali_requests' }, () => {
          loadStats()
          setRequestsKey(k => k + 1)
          showToast('Request received', '📬')
        }),
      supabase.channel('dashboard-queries-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queries' }, () => {
          loadStats()
          showToast('Query submitted', '❓')
        }),
      supabase.channel('dashboard-feedback-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_feedback' }, () => {
          loadFeedbackByDay()
          showToast('Feedback received', '⭐')
        }),
      supabase.channel('dashboard-users-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_stats' }, () => {
          loadStats()
          showToast('New member', '👤')
        }),
    ]

    channels.forEach(ch => ch.subscribe())

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch))
    }
  }, [loadStats, loadFeedbackByDay, showToast])

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
                setQrHubOpen(true)
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
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 12, color: stats.lowStock > 0 ? '#f43f5e' : 'var(--accent-gold)' }}><span key={lowStockKey} className="stock-glow">{stats.lowStock}</span></div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>Low Stock Items</div>
        </AdminCard>

        {/* QR Identity Hub — Core Member Registry */}
        <AdminCard style={{ gridArea: 'qr-hub', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>QR Identity Hub</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Core Registry Node</div>
            </div>
            <QrCode size={20} color="var(--accent-gold)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 240 }} className="custom-scroll">
            {(missingSurveys || []).slice(0, 6).map(u => (
              <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', transition: 'all 0.2s' }} className="member-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(212, 175, 55, 0.08)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>
                    #{u.thali_number || '—'}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{u.name || 'Anonymous'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>Pending survey</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(`https://wa.me/${helpline ? helpline.replace(/[^0-9]/g,'') : ''}?text=Hi%20${encodeURIComponent(u.name || 'Member')}%2C%20please%20submit%20your%20weekly%20meal%20survey.%20`, '_blank')
                    }}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(37,211,102,0.3)', background: 'rgba(37,211,102,0.08)', color: '#25D366', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                    title="Direct Message"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Msg
                  </button>
                  <Btn variant="ghost" size="sm" onClick={(e) => {
                    e.stopPropagation()
                    setSelectedQRUser(u)
                    setQrHubOpen(true)
                  }} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <QrCode size={12} /> Show QR
                  </Btn>
                </div>
              </div>
            ))}
            {(!missingSurveys || missingSurveys.length === 0) && (
              <div style={{ textAlign: 'center', padding: '30px 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                All members have submitted their surveys
              </div>
            )}
          </div>

          <Btn
            variant="primary"
            style={{ borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}
            onClick={() => setQrHubOpen(true)}
          >
            <QrCode size={14} /> Open QR Hub
          </Btn>
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
          <div style={{ flex: 1, minHeight: 120, height: 120 }}>
            <ResponsiveContainer width="100%" height={120}>
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
            <div style={{ fontSize: 24, fontWeight: 900 }}><span key={requestsKey} className="requests-glow">{stats.requests}</span></div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Thali Requests</div>
          <Btn variant="primary" size="sm" style={{ width: '100%' }}>View All</Btn>
        </AdminCard>

        {/* Missing Surveys */}
        <AdminCard onClick={() => navigate('/admin/surveys')} style={{ gridArea: 'actionable', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-pink)' }}>PENDING SURVEYS</div>
            <Badge color="var(--accent-pink)"><span key={badgeKey} className="badge-pulse">{missingSurveys.length}</span></Badge>
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

        .member-row:hover {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(212,175,55,0.25) !important;
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

          .member-row {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .member-row > div:first-child {
            width: 100%;
          }
          .member-row > div:last-child {
            width: 100%;
            justify-content: stretch !important;
          }
          .member-row > div:last-child > * {
            flex: 1;
          }
        }
        
        @keyframes badgePulse {
          0% { transform: scale(1); }
          30% { transform: scale(1.25); }
          60% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        .badge-pulse {
          display: inline-block;
          animation: badgePulse 0.45s ease-out;
        }
        @keyframes stockGlow {
          0% { filter: drop-shadow(0 0 0px rgba(244,63,94,0)); }
          40% { filter: drop-shadow(0 0 12px rgba(244,63,94,0.6)); }
          100% { filter: drop-shadow(0 0 0px rgba(244,63,94,0)); }
        }
        .stock-glow {
          display: inline-block;
          will-change: filter;
          animation: stockGlow 0.6s ease-out;
        }
        @keyframes requestsGlow {
          0% { filter: drop-shadow(0 0 0px rgba(212,175,55,0)); }
          40% { filter: drop-shadow(0 0 14px rgba(212,175,55,0.5)); }
          100% { filter: drop-shadow(0 0 0px rgba(212,175,55,0)); }
        }
        .requests-glow {
          display: inline-block;
          will-change: filter;
          animation: requestsGlow 0.6s ease-out;
        }
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        
        @keyframes toastSlideIn {
          0% { transform: translateX(120%); opacity: 0; }
          15% { transform: translateX(0); opacity: 1; }
          75% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        .toast-pop {
          animation: toastSlideIn 2.5s ease-out forwards;
        }
      `}</style>

      {/* QR Identity Hub Modal */}
      <Modal
        isOpen={qrHubOpen}
        onClose={() => {
          setQrHubOpen(false)
          setSelectedQRUser(null)
        }}
        title="QR Identity Hub"
        maxWidth={700}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <input 
              type="text" 
              name="searchDashboard"
              placeholder="Search member by name or thali..." 
              value={qrSearch}
              onChange={e => setQrSearch(e.target.value)}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 12,
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)', outline: 'none', fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 20, minHeight: 350, maxHeight: 450 }}>
            {/* User List */}
            <div style={{ flex: 1, overflowY: 'auto', borderRight: '1px solid var(--border-light)', paddingRight: 16 }} className="custom-scroll">
              {usersList
                .filter(u => 
                  (u.name || '').toLowerCase().includes(qrSearch.toLowerCase()) || 
                  (u.thali_number || '').toString().includes(qrSearch)
                )
                .map(u => (
                  <div 
                    key={u.user_id}
                    onClick={() => setSelectedQRUser(u)}
                    style={{
                      padding: '12px 14px', borderRadius: 12,
                      background: selectedQRUser?.user_id === u.user_id ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.01)',
                      border: `1px solid ${selectedQRUser?.user_id === u.user_id ? 'var(--accent-gold)' : 'var(--border-glass)'}`,
                      marginBottom: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Thali #{u.thali_number}</div>
                    </div>
                    <ChevronRight size={16} color="var(--text-tertiary)" />
                  </div>
                ))}
            </div>

            {/* Sticker Preview */}
            <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {selectedQRUser ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  {/* Sticker Container */}
                  <div style={{ 
                    width: '375px', height: '200px', 
                    background: '#fff', 
                    color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    boxSizing: 'border-box', border: '1px solid #eee', position: 'relative',
                    overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', padding: '0 30px',
                    borderRadius: 12
                  }}>
                    {/* Left: Logo + Thali */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 2 }}>
                      <div style={{ 
                        width: 110, height: 110, borderRadius: '50%', overflow: 'hidden',
                        border: '1px solid #eee', flexShrink: 0
                      }}>
                        <img src="/al-mawaid.png" alt="Al Mawaid" style={{ 
                          width: '100%', height: '100%', objectFit: 'cover'
                        }} />
                      </div>
                      <div style={{ fontSize: '22pt', fontWeight: 900, color: '#000' }}>{selectedQRUser.thali_number || '—'}</div>
                    </div>
                    
                    {/* Right: QR Code */}
                    <div style={{ 
                      background: '#fff', padding: '6px', borderRadius: '8px',
                      border: '1px solid #eee', display: 'inline-block',
                      position: 'relative', zIndex: 2,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                      <QRCodeCanvas value={`ALMAWAID:${selectedQRUser.user_id}`} size={120} level="H" includeMargin={false} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn variant="outline" size="sm" style={{ flex: 1 }} onClick={() => downloadSticker(selectedQRUser, 'png')}>
                        Save PNG
                      </Btn>
                      <Btn variant="outline" size="sm" style={{ flex: 1 }} onClick={() => downloadSticker(selectedQRUser, 'pdf')}>
                        Save PDF
                      </Btn>
                    </div>
                    <Btn size="sm" style={{ background: T.accentGrad, width: '100%', color: '#fff', border: 'none' }} onClick={() => printSticker(selectedQRUser)}>
                      Print Sticker
                    </Btn>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center' }}>
                  <QrCode size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                  <div>Select a member to view, save, or print their QR Identity Sticker</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hidden QR code canvas for printing/downloading */}
        {selectedQRUser && (
          <div style={{ display: 'none' }}>
            <QRCodeCanvas
              id={`qr-canvas-${selectedQRUser.user_id}`}
              value={`ALMAWAID:${selectedQRUser.user_id}`}
              size={512}
              level="H"
            />
          </div>
        )}
      </Modal>

      {/* Real-time toast notification */}
      <div key={toast.key} className="toast-pop" style={{
        position: 'fixed', top: 20, right: 20, zIndex: 9999,
        padding: '10px 18px', borderRadius: 12,
        background: 'rgba(18, 24, 38, 0.92)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(212, 175, 55, 0.2)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        display: toast.key ? 'flex' : 'none',
        alignItems: 'center', gap: 10,
        pointerEvents: 'none', userSelect: 'none',
        fontSize: 13, fontWeight: 600, color: '#e8e4d9',
        fontFamily: "'DM Sans',sans-serif"
      }}>
        <span style={{ fontSize: 16 }}>{toast.icon}</span>
        <span>{toast.message}</span>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d4af37', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    </PageWrap>
  )
}
