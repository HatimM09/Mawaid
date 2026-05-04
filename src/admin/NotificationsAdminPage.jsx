// src/admin/NotificationsAdminPage.jsx
import React, { useState, useEffect } from 'react'
import { 
  Bell, Send, Clock, Image as ImageIcon, Users, User, Trash2, Plus, 
  Calendar, CheckCircle2, AlertCircle, Sparkles, ChevronRight
} from 'lucide-react'
import { supabase } from './supabaseClient'
import { 
  T, PageWrap, PageTitle, AdminCard, Table, 
  Badge, Btn, Spinner, Input, Select, Grid
} from './ui'

export default function NotificationsAdminPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [notices, setNotices] = useState([])
  const [users, setUsers] = useState([])
  
  const [form, setForm] = useState({
    title: '',
    body: '',
    sender_name: 'Admin Office',
    scheduled_at: '',
    target_type: 'all', // all, specific
    target_user_id: '',
    tone: 'var(--accent-primary)',
    media_url: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [nRes, uRes] = await Promise.all([
      supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('user_stats').select('user_id, name, thali_number').order('name')
    ])
    
    if (nRes.data) setNotices(nRes.data)
    if (uRes.data) setUsers(uRes.data)
    setLoading(false)
  }

  const handleSend = async () => {
    if (!form.title || !form.body) return alert('Title and Message are required')
    
    setSubmitting(true)
    const payload = {
      title: form.title,
      body: form.body,
      sender_name: form.sender_name,
      media: form.media_url ? [form.media_url] : [],
      scheduled_at: form.scheduled_at || new Date().toISOString(),
      target_user_id: form.target_type === 'specific' ? form.target_user_id : null,
      tone: form.tone,
      created_at: new Date().toISOString()
    }

    const { error } = await supabase.from('notices').insert([payload])
    
    if (error) {
      alert('Error saving notice: ' + error.message)
    } else {
      // 🚀 Trigger OneSignal Push Notification
      try {
        const onesignalAppId = import.meta.env.VITE_ONESIGNAL_APP_ID || "36968038-7359-450f-90e8-07f9c8742913"
        const onesignalApiKey = import.meta.env.VITE_ONESIGNAL_REST_API_KEY
        
        if (onesignalApiKey) {
          const notificationBody = {
            app_id: onesignalAppId,
            headings: { en: payload.title },
            contents: { en: payload.body },
            included_segments: payload.target_user_id ? [] : ["All"],
            include_external_user_ids: payload.target_user_id ? [payload.target_user_id] : null,
            chrome_web_badge: "https://spciaktztqnjsttrtosu.supabase.co/storage/v1/object/public/al-mawaid.png",
            chrome_web_icon: "https://spciaktztqnjsttrtosu.supabase.co/storage/v1/object/public/al-mawaid.png"
          }

          if (payload.media && payload.media[0]) {
            notificationBody.chrome_web_image = payload.media[0]
          }

          const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Authorization": `Basic ${onesignalApiKey}`
            },
            body: JSON.stringify(notificationBody)
          })
          const resData = await response.json()
          console.log("OneSignal Response:", resData)
          if (!response.ok) throw new Error(resData.errors?.[0] || "OneSignal API Error")
        } else {
          console.warn("OneSignal REST API Key missing. Skipping push notification.")
          alert("Notice saved, but Push Notification skipped (REST API Key not found in environment).")
        }
      } catch (err) {
        console.error("OneSignal Error:", err)
        alert("Push Notification Error: " + err.message)
      }

      alert('Notification generated and broadcasted successfully!')
      setForm({
        title: '', body: '', sender_name: 'Admin Office',
        scheduled_at: '', target_type: 'all', target_user_id: '',
        tone: 'var(--accent-primary)', media_url: ''
      })
      fetchData()
    }
    setSubmitting(false)
  }

  const deleteNotice = async (id) => {
    if (!window.confirm('Delete this notification?')) return
    await supabase.from('notices').delete().eq('id', id)
    fetchData()
  }

  if (loading) return <Spinner />

  return (
    <PageWrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <PageTitle sub="Broadcast important updates and alerts to thali users">Notification Center</PageTitle>
        <Badge color={T.accentBg}>Active Broadcasting</Badge>
      </div>

      <Grid cols={3} style={{ marginBottom: 32 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <AdminCard style={{ padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <Sparkles size={20} color={T.accent} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>Generate New Broadcast</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Input 
                label="Notification Title" 
                placeholder="e.g. Menu Update, Delivery Alert..." 
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
              />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Input 
                  label="Sender Name" 
                  placeholder="e.g. Al-Mawaid Office" 
                  value={form.sender_name}
                  onChange={e => setForm({...form, sender_name: e.target.value})}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accent Tone</label>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    {['var(--accent-primary)', '#5eba82', '#e05555', '#5b8def'].map(c => (
                      <div 
                        key={c} 
                        onClick={() => setForm({...form, tone: c})}
                        style={{ 
                          width: 28, height: 28, borderRadius: '50%', background: c, 
                          cursor: 'pointer', border: form.tone === c ? `3px solid #fff` : 'none',
                          boxShadow: form.tone === c ? `0 0 10px ${c}` : 'none'
                        }} 
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message Content</label>
                <textarea 
                  placeholder="Type your notification message here..."
                  value={form.body}
                  onChange={e => setForm({...form, body: e.target.value})}
                  style={{ 
                    width: '100%', minHeight: 120, padding: 16, borderRadius: 16, 
                    background: 'rgba(25, 20, 10, 0.4)', border: '1px solid rgba(212, 175, 55, 0.25)', 
                    color: T.text, outline: 'none', fontFamily: 'inherit', fontSize: 14, resize: 'vertical'
                  }}
                />
              </div>

              <Input 
                label="Attached Image URL (Optional)" 
                placeholder="https://example.com/image.jpg" 
                value={form.media_url}
                onChange={e => setForm({...form, media_url: e.target.value})}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Select 
                  label="Target Audience" 
                  value={form.target_type}
                  onChange={e => setForm({...form, target_type: e.target.value})}
                >
                  <option value="all">All Thali Users</option>
                  <option value="specific">Specific User Only</option>
                </Select>

                {form.target_type === 'specific' ? (
                  <Select 
                    label="Select Recipient" 
                    value={form.target_user_id}
                    onChange={e => setForm({...form, target_user_id: e.target.value})}
                  >
                    <option value="">-- Choose User --</option>
                    {users.map(u => (
                      <option key={u.user_id} value={u.user_id}>#{u.thali_number} {u.name}</option>
                    ))}
                  </Select>
                ) : (
                  <Input 
                    label="Schedule Delivery (Optional)" 
                    type="datetime-local" 
                    value={form.scheduled_at}
                    onChange={e => setForm({...form, scheduled_at: e.target.value})}
                  />
                )}
              </div>

              <Btn 
                onClick={handleSend} 
                disabled={submitting}
                style={{ height: 54, marginTop: 10, fontSize: 16 }}
              >
                {submitting ? 'Broadcasting...' : <><Send size={18} /> Send Notification Now</>}
              </Btn>
            </div>
          </AdminCard>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <AdminCard style={{ background: 'rgba(212, 175, 55, 0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Clock size={18} color={T.accent} />
              <div style={{ fontSize: 14, fontWeight: 800 }}>Recent History</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {notices.length === 0 ? (
                <div style={{ fontSize: 12, color: T.textSub, textAlign: 'center', padding: '20px 0' }}>No history found</div>
              ) : notices.map(n => (
                <div key={n.id} style={{ 
                  padding: 12, borderRadius: 16, background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid var(--border-glass)', position: 'relative'
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.4, marginBottom: 8 }}>{n.body.substring(0, 60)}...</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 10, color: T.accent, fontWeight: 700 }}>{new Date(n.created_at).toLocaleDateString()}</div>
                    <button onClick={() => deleteNotice(n.id)} style={{ background: 'none', border: 'none', color: T.danger, cursor: 'pointer', padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>

          <AdminCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <AlertCircle size={18} color={T.accent} />
              <div style={{ fontSize: 14, fontWeight: 800 }}>Quick Tips</div>
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: 12, color: T.textSub, lineHeight: 1.6 }}>
              <li>Keep titles short and catchy.</li>
              <li>Use high-quality image URLs for banners.</li>
              <li>Scheduling allows planning for future events.</li>
            </ul>
          </AdminCard>
        </div>
      </Grid>
    </PageWrap>
  )
}
