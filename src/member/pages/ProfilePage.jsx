import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ScanLine, ClipboardCheck, Users2, BellRing, Headphones, Sparkles,
  MessageCircle, Phone, MapPin, Check, KeyRound, Eye, EyeOff, LogOut,
  X, ChevronRight, Calendar, CalendarDays, Sun, Moon, SunMedium, MoonStar, ArrowRight,
  CheckCircle2, ShieldCheck, HeartHandshake, Layers, FileText, HelpCircle, LifeBuoy, Clock,
  PlayCircle, PauseCircle, PlusCircle, MinusCircle
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../../lib/firebaseClient'
import { useWeeklyMenu } from '../../common/useWeeklyMenu'
import { useAuth, useTheme } from '../../admin/context'
import { getSurveyTargetWeek, getSurveyTargetWeeks, getSurveyCadence, formatWeekRange, getCalendarWeekDate, addWeeks } from '../../common/utils'
import { getSlotDishes, isRotiItem } from '../../hooks/useSurvey'
import ErrorBoundary from '../../components/ErrorBoundary'
import { fetchLatestUserSurveyRow, fetchUserSurveyRow, fetchUserSurveyRows } from '../../lib/surveyRows'
import { ProfileSkeleton, ListPageSkeleton, RequestsSkeleton, NotificationsSkeleton, KhidmatTeamSkeleton } from '../../common/Skeleton'
import { THEMES } from '../theme'
import { DAYS } from '../constants'
import { isSurveyOpen, getSurveyWindowMessage } from '../survey'
import { Card, Avatar, SectionLabel, BackHeader, Btn, EmptyState, ErrorBanner } from '../ui'

export default function ProfilePage({ theme, setTheme, markRead, appSettings, activeSubPage: externalSubPage, setActiveSubPage: externalSetSubPage, onGoToSurvey }) {
  const [internalSubPage, setInternalSubPage] = useState('main')
  const activeSubPage = externalSubPage !== undefined ? externalSubPage : internalSubPage
  const setActiveSubPage = externalSetSubPage || setInternalSubPage
  if (activeSubPage === 'surveys') return <MySurveysPage onBack={() => setActiveSubPage('main')} appSettings={appSettings} onGoToSurvey={onGoToSurvey} />
  if (activeSubPage === 'requests') return <MyRequestsPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'khidmat') return <KhidmatTeamPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'notifications') return <NotificationsPage onBack={() => setActiveSubPage('main')} markRead={markRead} appSettings={appSettings} />
  if (activeSubPage === 'support') return <SupportTicketsPage onBack={() => setActiveSubPage('main')} />
  if (activeSubPage === 'about') return <AboutPage onBack={() => setActiveSubPage('main')} />
  return <ProfileMainPage theme={theme} setTheme={setTheme} onNav={setActiveSubPage} />
}

const pwInputStyle = t => ({
  flex: 1,
  minWidth: 0,
  padding: '11px 13px',
  borderRadius: 11,
  border: `1px solid ${t.border}`,
  background: t.bg,
  color: t.text,
  fontSize: 14,
  fontFamily: "'DM Sans',sans-serif",
  outline: 'none',
})
function ProfileMainPage({ theme, setTheme, onNav }) {
  const t = useTheme(), { user, signOut } = useAuth()
  const [profileData, setProfileData] = useState(() => {
    try {
      const cached = localStorage.getItem(`almawaid_user_profile_${user?.id || 'anon'}`)
      if (cached) return JSON.parse(cached)
    } catch { /* ignore */ }
    return null
  })
  const [loading, setLoading] = useState(() => !profileData)
  const [showQR, setShowQR] = useState(false)
  const [helpline, setHelpline] = useState('')
  // Change password state
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' })
  const [pwSaving, setPwSaving] = useState(false)

  const changePassword = async () => {
    setPwMsg({ type: '', text: '' })
    if (newPass.length < 6) { setPwMsg({ type: 'error', text: 'New password must be at least 6 characters.' }); return }
    if (curPass && newPass === curPass) { setPwMsg({ type: 'error', text: 'New password must be different from the current one.' }); return }
    if (newPass !== confirmPass) { setPwMsg({ type: 'error', text: 'New password and confirmation do not match.' }); return }
    setPwSaving(true)
    try {
      let { error } = await supabase.auth.updateUser({ password: newPass })
      if (error && /reauthenticat|recent/i.test(error.message || '')) {
        await supabase.auth.reauthenticate(curPass)
        ;({ error } = await supabase.auth.updateUser({ password: newPass }))
      }
      if (error) {
        setPwMsg({ type: 'error', text: `Password update failed: ${error.message}` })
      } else {
        setPwMsg({ type: 'success', text: '✅ Password updated successfully.' })
        setCurPass(''); setNewPass(''); setConfirmPass(''); setShowPw(false)
      }
    } catch (e) {
      setPwMsg({ type: 'error', text: `Password update failed: ${e.message}` })
    } finally {
      setPwSaving(false)
    }
  }

  useEffect(() => {
    supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => { 
      if (data) {
        setProfileData(data)
        try { localStorage.setItem(`almawaid_user_profile_${user?.id || 'anon'}`, JSON.stringify(data)) } catch { /* ignore */ }
      }
    }).finally(() => setLoading(false))
    supabase.from("app_settings").select("*").eq("key", "helpline_number").maybeSingle().then(({ data }) => { if (data) setHelpline(data.value) })
  }, [user.id])

  const NavCard = ({ label, icon, desc, onClick }) => (
    <button onClick={onClick} style={{ width: '100%', padding: '13px 16px', borderRadius: 14, border: `1px solid ${t.border}`, background: t.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, textAlign: 'left', transition: 'all 0.2s' }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{label}</div>
        <div style={{ fontSize: 12, color: t.textSub, marginTop: 1, fontFamily: "'DM Sans',sans-serif" }}>{desc}</div>
      </div>
      <ChevronRight size={15} color={t.textSub} />
    </button>
  )

  if (loading) return <ProfileSkeleton />
  return (
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <Card active style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ width: 84, height: 84, margin: '0 auto 14px' }}><Avatar avatarUrl={profileData?.avatar_url} name={profileData?.name} email={user.email} size={84} /></div>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: t.text, fontFamily: "'Playfair Display',serif" }}>{profileData?.name || 'Thali User'}</h2>
        <div style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginBottom: 6 }}>{user.email}</div>
        {profileData?.thali_number && <div style={{ display: 'inline-block', padding: '4px 16px', borderRadius: 20, background: t.accentBg, border: `1px solid ${t.accentBorder}`, marginBottom: 6 }}><span style={{ fontSize: 13, color: t.accent, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>Thali #{profileData.thali_number}</span></div>}
        {profileData?.phone && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}><Phone size={12} color={t.textSub} /><span style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{profileData.phone}</span></div>}
        {profileData?.address && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}><MapPin size={12} color={t.textSub} /><span style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{profileData.address}</span></div>}
        {profileData?.snack_defaults && Object.values(profileData.snack_defaults).some(v => v > 0) && (
          <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 12, background: t.accentBg, border: `1px solid ${t.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin Allotted Count:</span>
            {Object.entries(profileData.snack_defaults).map(([key, val]) => (
              <span key={key} style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>Dish {key.replace('dish_', '')}: <strong>{val}</strong></span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: t.textSub, marginTop: 10, opacity: .5, fontFamily: "'DM Sans',sans-serif" }}>Thali User since {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>

      </Card>
      <SectionLabel>My Activity</SectionLabel>
      <NavCard label="My Identity QR" icon={<ScanLine size={20} color="#fff" />} desc="Show your QR code for thali collection" onClick={() => setShowQR(true)} />
      <NavCard label="My Surveys" icon={<ClipboardCheck size={20} color="#fff" />} desc="View your weekly survey responses" onClick={() => onNav('surveys')} />
      <NavCard label="My Requests" icon={<img src="/al-mawaid.png" alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />} desc="Resume, stop & extra food requests" onClick={() => onNav('requests')} />
      <NavCard label="Khidmat Team" icon={<HeartHandshake size={20} color="#fff" />} desc="Meet our Al-Mawaid team" onClick={() => onNav('khidmat')} />
      <NavCard label="Alerts" icon={<BellRing size={20} color="#fff" />} desc="See notices and important updates" onClick={() => onNav('notifications')} />
      <NavCard label="Support Ticket" icon={<Headphones size={20} color="#fff" />} desc="Raise general, thali, and delivery issues" onClick={() => onNav('support')} />

      {helpline && (
        <a href={`https://wa.me/${helpline.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', marginBottom: 10 }}>
          <button style={{ width: '100%', padding: '13px 16px', borderRadius: 14, border: '1px solid rgba(37,211,102,0.3)', background: 'rgba(37,211,102,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s', textAlign: 'left' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MessageCircle size={20} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>WhatsApp Helpline</div>
              <div style={{ fontSize: 12, color: '#25D366', marginTop: 1, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>{helpline} — Tap to chat</div>
            </div>
            <MessageCircle size={16} color="#25D366" />
          </button>
        </a>
      )}

      <NavCard label="About" icon={<Sparkles size={20} color="#fff" />} desc="Learn more about the app and services" onClick={() => onNav('about')} />
      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <SectionLabel>App Theme</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.values(THEMES).filter(th => th.id === 'dark' || th.id === 'bright').map(th => (
            <button key={th.id} onClick={() => setTheme(th.id)}
              style={{ padding: '12px 14px', borderRadius: 13, border: `1.5px solid ${theme === th.id ? th.accent : t.border}`, background: theme === th.id ? th.accentBg : t.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.25s' }}>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {[th.bg, th.accent, th.card].map((c, i) => <div key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: '1.5px solid rgba(255,255,255,0.12)' }} />)}
              </div>
              <div style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 700, color: theme === th.id ? th.accent : t.text, fontFamily: "'DM Sans',sans-serif" }}>{th.icon} {th.name}</div>
              {theme === th.id && <Check size={15} color={th.accent} />}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 24, marginBottom: 40, paddingBottom: 20 }}>
        <SectionLabel>Account</SectionLabel>
        <div style={{ padding: '16px 16px 20px', borderRadius: 18, border: `1px solid ${t.border}`, background: t.card, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KeyRound size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>Change Password</div>
              <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>Keep your account secure</div>
            </div>
          </div>
          <form onSubmit={e => { e.preventDefault(); changePassword() }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Hidden username field — Chrome password-form accessibility heuristic */}
            <input type="text" name="username" autoComplete="username" value={user?.email || ''} readOnly tabIndex={-1} aria-hidden="true" style={{ display: 'none' }} />
            <div>
              <label htmlFor="cur-password" style={{ display: 'none' }}>Current Password</label>
              <input
                id="cur-password"
                name="current-password"
                autoComplete="current-password"
                aria-label="Current Password"
                type={showPw ? 'text' : 'password'}
                placeholder="Current password (only needed if re-login required)"
                value={curPass}
                onChange={e => { setCurPass(e.target.value); setPwMsg({ type: '', text: '' }) }}
                style={pwInputStyle(t)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="new-password" style={{ display: 'none' }}>New Password</label>
                <input
                  id="new-password"
                  name="new-password"
                  autoComplete="new-password"
                  aria-label="New Password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="New password (min 6 chars)"
                  value={newPass}
                  onChange={e => { setNewPass(e.target.value); setPwMsg({ type: '', text: '' }) }}
                  style={pwInputStyle(t)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="confirm-password" style={{ display: 'none' }}>Confirm New Password</label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  autoComplete="new-password"
                  aria-label="Confirm New Password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPass}
                  onChange={e => { setConfirmPass(e.target.value); setPwMsg({ type: '', text: '' }) }}
                  style={pwInputStyle(t)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
              <button
                type="submit"
                disabled={pwSaving}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: t.accentGrad, color: '#fff', fontSize: 14, fontWeight: 800, cursor: pwSaving ? 'wait' : 'pointer', fontFamily: "'DM Sans',sans-serif" }}
              >
                {pwSaving ? 'Updating…' : 'Update Password'}
              </button>
              <button type="button" onClick={() => { setShowPw(s => !s) }} style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSub, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {pwMsg.text && (
              <div style={{ fontSize: 12.5, fontWeight: 600, padding: '9px 12px', borderRadius: 10, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.45, background: pwMsg.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: pwMsg.type === 'error' ? '#f87171' : '#34d399', border: `1px solid ${pwMsg.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                {pwMsg.text}
              </div>
            )}
          </form>
        </div>
        <button
          onClick={signOut}
          style={{
            width: '100%', padding: '18px', borderRadius: 20,
            border: 'none',
            background: 'linear-gradient(135deg, #ff5c5c, #d93636)',
            color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            fontFamily: "'DM Sans',sans-serif", transition: 'all 0.3s',
            boxShadow: '0 8px 25px rgba(217, 54, 54, 0.4)',
            textTransform: 'uppercase', letterSpacing: '0.05em'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <LogOut size={20} strokeWidth={3} /> Logout from Al-Mawaid
        </button>
      </div>

      {showQR && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Card style={{ width: '100%', maxWidth: 360, textAlign: 'center', padding: 32, position: 'relative' }}>
            <button onClick={() => setShowQR(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: t.textSub, cursor: 'pointer' }}><X size={20}/></button>
            <div style={{ fontSize: 12, fontWeight: 900, color: t.accent, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>Member Identity</div>
            <div style={{ background: '#fff', padding: 20, borderRadius: 24, display: 'inline-block', marginBottom: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
              <QRCodeCanvas value={`ALMAWAID:${user.id}`} size={200} level="H" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.text, fontFamily: "'Playfair Display',serif" }}>{profileData?.name}</div>
            <div style={{ fontSize: 14, color: t.accent, fontWeight: 700, marginTop: 4 }}>Thali #{profileData?.thali_number}</div>
            <p style={{ fontSize: 12, color: t.textSub, marginTop: 16, lineHeight: 1.65 }}>Present this code at the distribution counter to verify your thali collection status.</p>
            <Btn style={{ width: '100%', marginTop: 24, borderRadius: 14 }} onClick={() => setShowQR(false)}>Close</Btn>
          </Card>
        </div>
      )}


    </main>
  )
}

function MySurveysPage({ onBack, appSettings: initialAppSettings = {}, onGoToSurvey }) {
  const t = useTheme(), { user } = useAuth()
  const [appSettings, setAppSettings] = useState(initialAppSettings)
  const [surveysByWeek, setSurveysByWeek] = useState({}) // weekId -> flat row
  const [loading, setLoading] = useState(true)

  const calendarWeekId = useMemo(() => getCalendarWeekDate(), [])
  const nextWeekId = useMemo(() => addWeeks(calendarWeekId, 1), [calendarWeekId])
  const targetWeeks = useMemo(() => getSurveyTargetWeeks(appSettings), [appSettings])
  const primaryTargetWeek = targetWeeks[0] || nextWeekId

  // Exactly 2 tabs: This Week & Next Week
  const weekTabs = useMemo(() => [
    {
      id: calendarWeekId,
      label: 'This Week',
      weekId: calendarWeekId,
      range: formatWeekRange(calendarWeekId),
      isServing: true,
    },
    {
      id: nextWeekId,
      label: 'Next Week',
      weekId: nextWeekId,
      range: formatWeekRange(nextWeekId),
      isTarget: true,
    }
  ], [calendarWeekId, nextWeekId])

  const [activeTab, setActiveTab] = useState(calendarWeekId)

  const selectedWeekObj = useMemo(() => {
    return weekTabs.find(w => w.id === activeTab || w.weekId === activeTab) || weekTabs[0]
  }, [weekTabs, activeTab])

  const selectedWeekId = selectedWeekObj.weekId

  // Weekly menu for the active week to resolve scheduled dish labels
  const selectedWeekMenu = useWeeklyMenu(selectedWeekId)

  useEffect(() => {
    supabase.from('app_settings').select('key, value')
      .then(({ data }) => {
        const s = {}
        ;(data || []).forEach(r => { if (r && r.key) s[r.key] = r.value })
        setAppSettings(prev => ({ ...prev, ...s }))
      })
      .catch(() => {})
  }, [])

  const loadData = useCallback(async () => {
    try {
      const { data: map } = await fetchUserSurveyRows(user.id, [calendarWeekId, nextWeekId])
      setSurveysByWeek(map || {})
    } catch {
      setSurveysByWeek({})
    }
  }, [user.id, calendarWeekId, nextWeekId])

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [loadData])

  // Realtime subscription: refresh surveys on any change
  useEffect(() => {
    if (!user?.id) return
    const subscription = supabase.channel(`profile-surveys-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_day_responses', filter: `user_id=eq.${user.id}` }, () => {
        loadData()
      })
      .subscribe()
    return () => supabase.removeChannel(subscription)
  }, [user?.id, loadData])

  // Smart initial tab switch: if current week has no responses but next week has responses, switch to next week
  useEffect(() => {
    if (!loading && Object.keys(surveysByWeek).length > 0) {
      const countFor = (r) => {
        if (!r) return 0
        let c = 0
        DAYS.forEach(d => {
          const dk = d.substring(0, 3).toLowerCase()
          if (r[`${dk}_l_status`] || r[`${dk}_d_status`]) c++
        })
        return c
      }
      const nextCount = countFor(surveysByWeek[nextWeekId])
      const curCount = countFor(surveysByWeek[calendarWeekId])
      if (nextCount > 0 && curCount === 0 && activeTab === calendarWeekId) {
        setActiveTab(nextWeekId)
      }
    }
  }, [loading, surveysByWeek, nextWeekId, calendarWeekId, activeTab])

  const formatDishVal = (val, dish) => {
    if (val === 'yes' || val === 'Yes') return '✅ Yes'
    if (val === 'no' || val === 'No') return '❌ Skip'
    if (typeof val === 'string' && val.endsWith('%')) return val
    if (typeof val === 'number') {
      if ([0, 25, 50, 75, 100].includes(val) && !isRotiItem(dish)) return `${val}%`
      return `${val} portion${val === 1 ? '' : 's'}`
    }
    return String(val)
  }

  const markOverride = useCallback((grouped, rawData) => {
    Object.keys(grouped).forEach(day => {
      Object.keys(grouped[day]).forEach(meal => {
        const hasSlotOverride = rawData?._isOverride ||
          rawData?.edit_metadata?.[`${day.substring(0, 3).toLowerCase()}_${meal === 'lunch' ? 'l' : 'd'}_override`]
        if (hasSlotOverride) grouped[day][meal].is_override = true
      })
    })
    return grouped
  }, [])

  const processRow = useCallback((data, menu) => {
    const grouped = {}
    DAYS.forEach(day => {
      const dayKey = day.substring(0, 3).toLowerCase()
      grouped[day] = {}
      ;['lunch', 'dinner'].forEach(meal => {
        const mealKey = meal === 'lunch' ? 'l' : 'd'
        const rawStatus = data?.[`${dayKey}_${mealKey}_status`] || null
        const status = rawStatus === 'Applied' || rawStatus === 'opted_in' ? 'Applied'
          : rawStatus === 'Skipped' || rawStatus === 'opted_out' ? 'Skipped'
          : null

        const menuDishes = menu?.[day]?.[meal] || menu?.[day.toLowerCase()]?.[meal] || menu?.[dayKey]?.[meal] || []
        const dishList = getSlotDishes(data, day, meal, menuDishes)
        const nameList = dishList.length > 0
          ? dishList
          : menuDishes.length > 0
            ? menuDishes
            : Array.from({ length: 5 }, (_, i) => `Dish ${i + 1}`).filter((_, i) => data && data[`${dayKey}_${mealKey}_dish_${i + 1}`] !== undefined && data[`${dayKey}_${mealKey}_dish_${i + 1}`] !== null && data[`${dayKey}_${mealKey}_dish_${i + 1}`] !== '')

        const dishResponses = {}
        if (status === 'Applied') {
          nameList.forEach((d, i) => {
            const val = data?.[`${dayKey}_${mealKey}_dish_${i + 1}`]
            if (val !== undefined && val !== null && val !== '') {
              const lower = String(val).toLowerCase()
              if (lower === 'yes') dishResponses[d] = 'yes'
              else if (lower === 'no') dishResponses[d] = 'no'
              else if (typeof val === 'string' && val.endsWith('%')) dishResponses[d] = val
              else {
                const n = parseInt(val)
                dishResponses[d] = isNaN(n) ? val : n
              }
            } else {
              // Default to full portion if status is applied
              dishResponses[d] = isRotiItem(d) ? 'yes' : 100
            }
          })
        }

        grouped[day][meal] = {
          has_response: !!status,
          status,
          wants_food: status === 'Applied',
          dish_responses: dishResponses,
          menu_dishes: nameList.length > 0 ? nameList : menuDishes,
          edit_count: (data?.edit_metadata || {})[`${dayKey}_${mealKey}`] || 0,
          updated_at: data?.updated_at || null
        }
      })
    })
    return grouped
  }, [])

  // Active week data processed
  const currentWeekRaw = surveysByWeek[selectedWeekId] || null
  const currentGrouped = useMemo(() => {
    return markOverride(processRow(currentWeekRaw, selectedWeekMenu || {}), currentWeekRaw)
  }, [currentWeekRaw, selectedWeekMenu, processRow, markOverride])

  // Meal counts for summary
  const mealSummary = useMemo(() => {
    let appliedCount = 0
    let skippedCount = 0
    let pendingCount = 0
    DAYS.forEach(d => {
      ;['lunch', 'dinner'].forEach(meal => {
        const item = currentGrouped[d]?.[meal]
        if (item?.has_response) {
          if (item.wants_food) appliedCount++
          else skippedCount++
        } else {
          pendingCount++
        }
      })
    })
    const totalAnswered = appliedCount + skippedCount
    return { appliedCount, skippedCount, pendingCount, totalAnswered, hasResponses: totalAnswered > 0 }
  }, [currentGrouped])

  return (
    <main style={{ flex: 1, padding: '16px 16px 140px', maxWidth: 640, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <BackHeader title="My Surveys" onBack={onBack} />

      {/* Week Toggle Tabs with Modern Segmented Control */}
      <div style={{
        display: 'flex',
        background: t.inputBg,
        padding: 4,
        borderRadius: 18,
        border: `1px solid ${t.border}`,
        marginBottom: 16,
        gap: 4,
        overflowX: 'auto',
        scrollbarWidth: 'none'
      }}>
        {weekTabs.map(tab => {
          const isActive = selectedWeekId === tab.weekId
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                minWidth: 130,
                padding: '10px 14px',
                borderRadius: 14,
                border: 'none',
                background: isActive ? t.accentGrad : 'transparent',
                color: isActive ? '#000' : t.textSub,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.2)' : 'none',
                fontFamily: "'DM Sans', sans-serif"
              }}
            >
              <span style={{ fontSize: 13, fontWeight: isActive ? 900 : 700, whiteSpace: 'nowrap' }}>
                {tab.isServing ? '🌿 ' : tab.isTarget ? '📋 ' : '🗓️ '}
                {tab.label}
              </span>
              <span style={{ fontSize: 11, opacity: isActive ? 0.95 : 0.6, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {tab.range}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <ListPageSkeleton title="My Surveys" count={6} />
      ) : (
        <>
          {/* Week Overview Hero Bento Card */}
          <div style={{
            padding: '20px',
            borderRadius: 24,
            background: t.cardActive || t.card,
            border: `1.5px solid ${t.borderActive || t.border}`,
            marginBottom: 16,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 12px 32px rgba(0,0,0,0.25)'
          }}>
            <div style={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, background: t.accentGrad, borderRadius: '50%', filter: 'blur(45px)', opacity: 0.12 }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: t.accent }}>
                  {selectedWeekObj.label} Overview
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: t.text, marginTop: 2, fontFamily: "'Playfair Display', serif" }}>
                  {selectedWeekObj.range}
                </div>
              </div>

              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 999,
                background: t.accentBg, border: `1px solid ${t.accentBorder}`,
                fontSize: 11, fontWeight: 800, color: t.accent
              }}>
                <Calendar size={13} /> 12 Meals Total
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                <span>Completion Status</span>
                <span style={{ color: mealSummary.totalAnswered === 12 ? '#10b981' : t.accent }}>
                  {mealSummary.totalAnswered} / 12 Decided ({Math.round(mealSummary.totalAnswered / 12 * 100)}%)
                </span>
              </div>
              <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${(mealSummary.appliedCount / 12) * 100}%`, background: '#10b981', transition: 'width 0.4s' }} />
                <div style={{ width: `${(mealSummary.skippedCount / 12) * 100}%`, background: '#ef4444', transition: 'width 0.4s' }} />
              </div>
            </div>

            {/* Stats Metrics Bento Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div style={{
                padding: '10px 12px', borderRadius: 14,
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#34d399' }}>{mealSummary.appliedCount}</div>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: 'rgba(52,211,153,0.85)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Requested</div>
              </div>

              <div style={{
                padding: '10px 12px', borderRadius: 14,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#f87171' }}>{mealSummary.skippedCount}</div>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: 'rgba(248,113,113,0.85)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Skipped</div>
              </div>

              <div style={{
                padding: '10px 12px', borderRadius: 14,
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fbbf24' }}>{mealSummary.pendingCount}</div>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: 'rgba(251,191,36,0.85)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending</div>
              </div>
            </div>
          </div>

          {/* Quick CTA banner if survey is not completed for this week */}
          {mealSummary.pendingCount > 0 && onGoToSurvey && (
            <div style={{
              padding: '14px 18px',
              borderRadius: 18,
              background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))',
              border: `1.5px solid ${t.accentBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              gap: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
            }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: t.text, fontFamily: "'DM Sans', sans-serif" }}>
                  ⚠️ {mealSummary.pendingCount} meal{mealSummary.pendingCount === 1 ? '' : 's'} pending for this week
                </div>
                <div style={{ fontSize: 11.5, color: t.textSub, marginTop: 2 }}>
                  Set your portions or skip meals in 1 tap
                </div>
              </div>
              <button
                onClick={onGoToSurvey}
                type="button"
                style={{
                  padding: '9px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: t.accentGrad,
                  color: '#000',
                  fontSize: 12.5,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(184,134,11,0.3)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Fill Survey <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* Day-by-Day Cards with Assigned Menu & Responses */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {DAYS.map((day, dIdx) => {
              const dayData = currentGrouped[day] || {}
              const [y, m, d] = selectedWeekId.split('-').map(Number)
              const dayDate = new Date(y, m - 1, d + dIdx)
              const dateLabel = dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              const hasAnyResponse = dayData?.lunch?.has_response || dayData?.dinner?.has_response
              const dayAr = selectedWeekMenu?.[day]?.ar || ''

              return (
                <div
                  key={day}
                  style={{
                    padding: '18px',
                    borderRadius: 22,
                    background: t.card,
                    border: `1.5px solid ${hasAnyResponse ? t.borderActive || t.border : t.border}`,
                    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Day Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 34,
                        height: 34,
                        borderRadius: 11,
                        background: t.accentGrad,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12.5,
                        fontWeight: 900,
                        color: '#000',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                      }}>
                        {day.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, textTransform: 'capitalize', color: t.text, fontFamily: "'Playfair Display', serif" }}>
                          {selectedWeekMenu?.[day]?.en || day}
                        </div>
                        {dayAr && (
                          <div style={{ fontSize: 11, color: t.accent, fontFamily: "'Amiri', serif" }}>
                            {dayAr}
                          </div>
                        )}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: t.textSub,
                      background: t.inputBg, border: `1px solid ${t.border}`,
                      padding: '4px 10px', borderRadius: 999
                    }}>
                      {dateLabel}
                    </span>
                  </div>

                  {/* Meals (Lunch & Dinner) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                    {['lunch', 'dinner'].map(meal => {
                      const r = dayData?.[meal] || {}
                      const hasResponse = r.has_response
                      const isApplied = r.status === 'Applied'
                      const isSkipped = r.status === 'Skipped'
                      const isOverride = !!r?.is_override
                      const menuDishes = r.menu_dishes || []

                      return (
                        <div
                          key={meal}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 16,
                            background: isApplied
                              ? 'rgba(16,185,129,0.04)'
                              : isSkipped
                                ? 'rgba(239,68,68,0.03)'
                                : t.inputBg,
                            border: `1px solid ${
                              isOverride
                                ? 'rgba(16,185,129,0.35)'
                                : isApplied
                                  ? 'rgba(16,185,129,0.2)'
                                  : isSkipped
                                    ? 'rgba(239,68,68,0.18)'
                                    : t.border
                            }`
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: (hasResponse || menuDishes.length > 0) ? 10 : 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                width: 26, height: 26, borderRadius: 8,
                                background: meal === 'lunch' ? 'linear-gradient(135deg, #FF9500, #FFCC00)' : 'linear-gradient(135deg, #5856D6, #AF52DE)',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                              }}>
                                {meal === 'lunch' ? <SunMedium size={13} color="#fff" /> : <MoonStar size={13} color="#fff" />}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>
                                {meal === 'lunch' ? 'Lunch Feast' : 'Dinner Delight'}
                              </span>

                              {isApplied && (
                                <span style={{
                                  fontSize: 10.5, fontWeight: 800,
                                  padding: '2px 8px', borderRadius: 999,
                                  background: 'rgba(16,185,129,0.14)',
                                  color: '#34d399',
                                  border: '1px solid rgba(16,185,129,0.3)'
                                }}>
                                  ✓ Requested
                                </span>
                              )}
                              {isSkipped && (
                                <span style={{
                                  fontSize: 10.5, fontWeight: 800,
                                  padding: '2px 8px', borderRadius: 999,
                                  background: 'rgba(239,68,68,0.12)',
                                  color: '#f87171',
                                  border: '1px solid rgba(239,68,68,0.25)'
                                }}>
                                  ✕ Skipped
                                </span>
                              )}
                              {!hasResponse && (
                                <span style={{
                                  fontSize: 10.5, fontWeight: 800,
                                  padding: '2px 8px', borderRadius: 999,
                                  background: 'rgba(245,158,11,0.12)',
                                  color: '#fbbf24',
                                  border: '1px solid rgba(245,158,11,0.25)'
                                }}>
                                  ⏳ Pending
                                </span>
                              )}
                              {isOverride && (
                                <span style={{
                                  fontSize: 10, fontWeight: 800,
                                  padding: '2px 7px', borderRadius: 6,
                                  background: 'rgba(16,185,129,0.18)',
                                  color: '#34d399',
                                  border: '1px solid rgba(16,185,129,0.4)'
                                }}>
                                  ⚡ Daily Edit
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: t.textSub }}>
                              {hasResponse && (
                                <span>
                                  {(r.edit_count || 0) > 0 ? `Edited ${r.edit_count}x` : 'Original'}
                                </span>
                              )}
                              {r?.updated_at && (
                                <span style={{ opacity: 0.7 }}>
                                  • {new Date(r.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* If Applied: show individual dish responses */}
                          {isApplied && r.dish_responses && Object.keys(r.dish_responses).length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, borderTop: `1px solid ${t.border}` }}>
                              {Object.entries(r.dish_responses).map(([dish, val]) => (
                                <div
                                  key={dish}
                                  style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    fontSize: 12.5, padding: '4px 8px', borderRadius: 8,
                                    background: 'rgba(255,255,255,0.02)',
                                  }}
                                >
                                  <span style={{ color: t.text, fontWeight: 600 }}>{dish}</span>
                                  <span style={{
                                    fontWeight: 900,
                                    color: isOverride ? '#34d399' : t.accent,
                                    background: t.accentBg, padding: '2px 8px', borderRadius: 6,
                                    border: `1px solid ${t.accentBorder}`
                                  }}>
                                    {formatDishVal(val, dish)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : isSkipped ? (
                            <div style={{ paddingTop: 6, borderTop: `1px solid ${t.border}` }}>
                              <div style={{ fontSize: 11, color: t.textSub, marginBottom: 4, fontWeight: 600 }}>
                                Menu Prepared by Al-Mawaid:
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {menuDishes.length > 0 ? (
                                  menuDishes.map((dish, i) => (
                                    <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, color: t.textSub, opacity: 0.75 }}>
                                      {dish}
                                    </span>
                                  ))
                                ) : (
                                  <span style={{ fontSize: 11, color: t.textSub, fontStyle: 'italic' }}>
                                    Meal skipped
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div style={{ paddingTop: 6, borderTop: `1px solid ${t.border}` }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {menuDishes.length > 0 ? (
                                  menuDishes.map((dish, i) => (
                                    <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, background: t.card, border: `1px solid ${t.border}`, color: t.textSub }}>
                                      {dish}
                                    </span>
                                  ))
                                ) : (
                                  <span style={{ fontSize: 11, color: t.textSub, fontStyle: 'italic' }}>
                                    No response recorded yet
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}

function MyRequestsPage({ onBack }) {
  const t = useTheme(), { user } = useAuth()
  const [filterTab, setFilterTab] = useState('all')
  const [requests, setRequests] = useState([])
  const [queries, setQueries] = useState([])
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      const [reqRes, queryRes] = await Promise.all([
        supabase.from('thali_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('queries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ])
      if (!reqRes.error) setRequests(reqRes.data || [])
      if (!queryRes.error) {
        const allQueries = queryRes.data || []
        setQueries(allQueries.filter(q => !(q.comment || '').startsWith('[Support Ticket]')))
        setTickets(allQueries.filter(q => (q.comment || '').startsWith('[Support Ticket]')))
      }
      setLoading(false)
    }
    fetchAll()
    const ch = supabase.channel('my-requests-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'thali_requests', filter: `user_id=eq.${user.id}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queries', filter: `user_id=eq.${user.id}` }, fetchAll)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user.id])

  const typeLabel = (type) => {
    const labels = { resume: 'Resume Thali', stop: 'Stop Thali', miqaat: 'Miqaat Pirsu', extra: 'Extra Food' }
    return labels[type] || type
  }

  const typeIcon = (type) => {
    if (type === 'resume') return <PlayCircle size={16} color="#10b981" />
    if (type === 'stop') return <PauseCircle size={16} color="#ef4444" />
    if (type === 'miqaat') return <Sparkles size={16} color="#eab308" />
    if (type === 'extra') return <PlusCircle size={16} color="#3b82f6" />
    return <FileText size={16} color={t.accent} />
  }

  const statusStyle = (s) => {
    if (s === 'approved' || s === 'resolved') {
      return { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)', icon: <CheckCircle2 size={12} /> }
    }
    if (s === 'rejected' || s === 'closed') {
      return { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)', icon: <X size={12} /> }
    }
    return { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)', icon: <Clock size={12} /> }
  }

  const tabs = [
    { id: 'all', label: 'All', icon: Layers, count: requests.length + queries.length + tickets.length },
    { id: 'requests', label: 'Requests', icon: FileText, count: requests.length },
    { id: 'queries', label: 'Queries', icon: HelpCircle, count: queries.length },
    { id: 'tickets', label: 'Tickets', icon: LifeBuoy, count: tickets.length },
  ]

  const renderRequestCard = (r) => {
    const st = statusStyle(r.status)
    return (
      <div key={r.id} style={{
        padding: '16px', borderRadius: 20, marginBottom: 12,
        background: t.card, border: `1px solid ${t.border}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {typeIcon(r.request_type)}
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{typeLabel(r.request_type)}</span>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
            background: st.bg, color: st.color, border: `1px solid ${st.border}`,
            display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase'
          }}>
            {st.icon} {r.status}
          </span>
        </div>

        {r.meal_type && (
          <div style={{ fontSize: 13, color: t.textSub, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600, color: t.text }}>Meal:</span> {r.meal_type.toUpperCase()}
          </div>
        )}
        {r.from_date && (
          <div style={{ fontSize: 13, color: t.textSub, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600, color: t.text }}>Dates:</span> {r.from_date} {r.to_date ? `→ ${r.to_date}` : ''}
          </div>
        )}
        {r.extra_items && (
          <div style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>
            <span style={{ fontWeight: 600, color: t.text }}>{r.extra_mode === 'deduction' ? 'Deduction: ' : 'Addition: '}</span>
            {r.extra_items.map(i => `${i.name} × ${i.qty}`).join(', ')}
          </div>
        )}
        {r.details && (
          <div style={{ fontSize: 13, color: t.textBody, marginTop: 6, padding: '8px 12px', borderRadius: 10, background: t.inputBg }}>
            {r.details}
          </div>
        )}

        {r.admin_note && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 12, color: t.accent }}>
            <strong>Admin Note:</strong> {r.admin_note}
          </div>
        )}
        <div style={{ fontSize: 11, color: t.textSub, marginTop: 10, opacity: 0.6 }}>
          {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    )
  }

  const renderQueryCard = (q, isTicket = false) => {
    const st = statusStyle(q.status)
    return (
      <div key={q.id} style={{
        padding: '16px', borderRadius: 20, marginBottom: 12,
        background: t.card, border: `1px solid ${t.border}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isTicket ? <LifeBuoy size={16} color="#ec4899" /> : <MessageCircle size={16} color={t.accent} />}
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{q.subject || (isTicket ? 'Support Ticket' : 'Query')}</span>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
            background: st.bg, color: st.color, border: `1px solid ${st.border}`,
            display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase'
          }}>
            {st.icon} {q.status}
          </span>
        </div>

        {q.comment && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: t.textBody, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {isTicket ? q.comment.replace('[Support Ticket]\n', '') : q.comment}
          </p>
        )}

        {q.media && q.media.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {q.media.map((m, i) => m.path && m.type === 'image' && (
              <img key={i} src={m.path} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: `1px solid ${t.border}` }} />
            ))}
          </div>
        )}

        {q.admin_reply && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 12.5, color: t.accent }}>
            <strong>Official Reply:</strong> {q.admin_reply}
          </div>
        )}

        <div style={{ fontSize: 11, color: t.textSub, marginTop: 10, opacity: 0.6 }}>
          {new Date(q.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    )
  }

  if (loading) return <RequestsSkeleton title="My Requests" />

  const hasAny = requests.length > 0 || queries.length > 0 || tickets.length > 0

  return (
    <main style={{ flex: 1, padding: '16px 16px 160px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <BackHeader title="My Requests" onBack={onBack} />

      {/* Filter tabs */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 20,
        background: t.card, borderRadius: 18, padding: 6, border: `1px solid ${t.border}`
      }}>
        {tabs.map(({ id, label, icon: TabIcon, count }) => {
          const isActive = filterTab === id
          return (
            <button
              key={id}
              onClick={() => setFilterTab(id)}
              style={{
                padding: '10px 6px', borderRadius: 12, border: 'none',
                background: isActive ? t.accentGrad : 'transparent',
                color: isActive ? '#000' : t.textSub,
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                boxShadow: isActive ? '0 4px 12px rgba(184,134,11,0.25)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <TabIcon size={16} color={isActive ? '#000' : t.textSub} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{label}</span>
                {count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 10,
                    background: isActive ? 'rgba(0,0,0,0.15)' : t.inputBg,
                    color: isActive ? '#000' : t.accent
                  }}>
                    {count}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {!hasAny ? <EmptyState msg="No activity yet. Raise a request, query, or support ticket to see it here." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Pending Requests */}
          {(filterTab === 'all' || filterTab === 'requests') && requests.filter(r => r.status === 'pending').length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <SectionLabel>Pending Requests</SectionLabel>
              {requests.filter(r => r.status === 'pending').map(renderRequestCard)}
            </div>
          )}

          {/* Approved Requests */}
          {(filterTab === 'all' || filterTab === 'requests') && requests.filter(r => r.status === 'approved').length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <SectionLabel>Approved Requests</SectionLabel>
              {requests.filter(r => r.status === 'approved').map(renderRequestCard)}
            </div>
          )}

          {/* Rejected Requests */}
          {(filterTab === 'all' || filterTab === 'requests') && requests.filter(r => r.status === 'rejected').length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <SectionLabel>Rejected Requests</SectionLabel>
              {requests.filter(r => r.status === 'rejected').map(renderRequestCard)}
            </div>
          )}

          {filterTab === 'requests' && requests.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: t.textSub, fontSize: 13 }}>No thali requests found.</div>}

          {/* Queries */}
          {(filterTab === 'all' || filterTab === 'queries') && queries.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <SectionLabel>Queries & Feedback ({queries.length})</SectionLabel>
              {queries.map(q => renderQueryCard(q, false))}
            </div>
          )}
          {filterTab === 'queries' && queries.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: t.textSub, fontSize: 13 }}>No queries submitted yet.</div>}

          {/* Support Tickets */}
          {(filterTab === 'all' || filterTab === 'tickets') && tickets.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <SectionLabel>Support Tickets ({tickets.length})</SectionLabel>
              {tickets.map(t => renderQueryCard(t, true))}
            </div>
          )}
          {filterTab === 'tickets' && tickets.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: t.textSub, fontSize: 13 }}>No support tickets found.</div>}
        </div>
      )}
    </main>
  )
}

function StaffDirectoryPage() {
  const t = useTheme()
  const [staff, setStaff] = useState([])
  const [helpline, setHelpline] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all([
      supabase.from('khidmat_guzaar').select('*').order('sort_order', { ascending: true }),
      supabase.from('app_settings').select('*').eq('key', 'helpline_number').maybeSingle()
    ]).then(([{ data: staffData }, { data: helpData }]) => {
      setStaff(staffData || [])
      if (helpData) setHelpline(helpData.value)
    }).finally(() => setLoading(false))
  }, [])
  return (
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {helpline && (
        <Card active style={{ marginBottom: 16, border: `2px solid ${t.accent}`, background: `${t.accent}10` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px ${t.accent}40` }}>
              <Phone size={30} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display',serif" }}>Al Mawaid Helpline</div>
              <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>For any queries or assistance</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginTop: 4 }}>{helpline}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
             <a href={`https://wa.me/${helpline.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '12px', borderRadius: 14, background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', fontSize: 14, fontWeight: 800, boxShadow: '0 8px 20px rgba(37,211,102,0.3)' }}>
               <MessageCircle size={18} /> WhatsApp Helpline
             </a>
          </div>
        </Card>
      )}

      <div style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 12, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 13, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>meet our Al-Mawaid Team</div>
      {loading ? <KhidmatTeamSkeleton /> : staff.length === 0 ? <EmptyState msg="No staff profiles available." /> : staff.map(member => {
        const rawPhone = member.phone || '', actionPhone = rawPhone.replace(/[^\d+]/g, '')
        return (
          <Card key={member.id} active style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar avatarUrl={member.avatar_url} name={member.name} email="" size={60} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif" }}>{member.name}</div>
                {member.role && <div style={{ display: 'inline-block', marginTop: 4, padding: '2px 10px', borderRadius: 20, background: t.accentBg, border: `1px solid ${t.accentBorder}` }}><span style={{ fontSize: 11, fontWeight: 700, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>{member.role}</span></div>}
                {member.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}><Phone size={12} color={t.textSub} /><span style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{member.phone}</span></div>}
                {member.area && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}><MapPin size={12} color={t.textSub} /><span style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{member.area}</span></div>}
              </div>
            </div>
            {actionPhone && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <a href={`tel:${actionPhone}`} style={{ flex: 1, padding: '10px', borderRadius: 12, background: t.accentGrad, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}><Phone size={16} /> Call</a>
                <a href={`https://wa.me/${actionPhone.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '10px', borderRadius: 12, background: 'rgba(37,211,102,0.1)', color: '#25D366', border: '1px solid rgba(37,211,102,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}><MessageCircle size={16} /> WhatsApp</a>
              </div>
            )}
          </Card>
        )
      })}
    </main>
  )
}

function KhidmatTeamPage({ onBack }) {
  return (
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <BackHeader title="Khidmat Guzaar" onBack={onBack} />
      <StaffDirectoryPage />
    </main>
  )
}

function NotificationsPage({ onBack, markRead, appSettings }) {
  const t = useTheme(), { user } = useAuth()
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNotices = async () => {
      const { data } = await supabase
        .from('notices')
        .select('*')
        .or(`target_user_id.is.null,target_user_id.eq.${user.id}`)
        .lte('scheduled_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(30)

      if (data) {
        try {
          const dayNum = new Date().getDay()
          const h = new Date().getHours()
          const weekId = getSurveyTargetWeek(appSettings)
          let isEating = false

          if (dayNum !== 0) {
            const days = ['', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
            const today = days[dayNum]
            const mealName = h < 15 ? 'lunch' : 'dinner'
            const dayKey = today.substring(0, 3).toLowerCase()
            const mealKey = mealName === 'lunch' ? 'l' : 'd'
            
            const { data: subData } = await fetchUserSurveyRow(user.id, weekId)
            const effective = subData

            const status = effective ? effective[`${dayKey}_${mealKey}_status`] : 'Not Submitted'
            isEating = status === 'Applied'
          }
          
          const now = new Date()
          const filtered = data.filter(notice => {
            const toneStr = notice.tone || ''
            if (toneStr.includes(':opt_in')) return isEating
            if (toneStr.includes(':opt_out')) return !isEating
            return true
          })
          setNotices(filtered)
        } catch {
          setNotices(data)
        }
      } else {
        setNotices([])
      }
      setLoading(false)
      if (markRead) markRead()
    }
    fetchNotices()
  }, [user.id, markRead, appSettings.survey_window_start_day])

  const timeAgo = (dateStr) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const groupByDate = (items) => {
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    const groups = { today: [], yesterday: [], earlier: [] }
    items.forEach(n => {
      const d = new Date(n.created_at).toDateString()
      if (d === today) groups.today.push(n)
      else if (d === yesterday) groups.yesterday.push(n)
      else groups.earlier.push(n)
    })
    return groups
  }

  const surveyMsg = isSurveyOpen(appSettings, user.id)
    ? 'Your weekly meal survey is open now. Submit your lunch and dinner choices on time.'
    : getSurveyWindowMessage(appSettings, user.id)

  return (
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {onBack && <BackHeader title="Alerts" onBack={onBack} />}

      {/* Premium Survey Card */}
      <div style={{
        marginBottom: 20, padding: 18, borderRadius: 18,
        background: `linear-gradient(135deg, ${t.accent}10, ${t.accent}02)`,
        border: `1px solid ${t.accent}25`,
        display: 'flex', gap: 14, alignItems: 'flex-start',
        boxShadow: `0 4px 20px rgba(0,0,0,0.2)`
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: `${t.accent}20`, border: `1px solid ${t.accent}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <BellRing size={20} color={t.accent} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.text, marginBottom: 4, fontFamily: "'DM Sans',sans-serif" }}>Weekly Survey Window</div>
          <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>{surveyMsg}</div>
        </div>
      </div>

      {/* Broadcasts */}
      {loading ? <NotificationsSkeleton /> : notices.length === 0 ? (
        <EmptyState msg="No broadcasts yet. Stay tuned for updates from Al-Mawaid." />
      ) : (() => {
        const groups = groupByDate(notices)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['today', 'yesterday', 'earlier'].map(section => {
              const items = groups[section]
              if (items.length === 0) return null
              const label = section === 'today' ? 'Today' : section === 'yesterday' ? 'Yesterday' : 'Earlier'
              return (
                <div key={section} style={{ marginBottom: 4 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 800, color: t.textSub,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    padding: '12px 4px 8px'
                  }}>{label}</div>
                  {items.map(item => {
                    const toneColor = (item.tone || '').split(':')[0] || t.accent
                    const initial = (item.sender_name || 'A').charAt(0).toUpperCase()
                    const hasMedia = item.media && item.media[0]
                    return (
                      <div key={item.id} style={{
                        marginBottom: 10, borderRadius: 18, overflow: 'hidden',
                        background: `linear-gradient(135deg, ${toneColor}06, ${t.card})`,
                        border: `1px solid ${toneColor}18`,
                        boxShadow: `0 2px 12px rgba(0,0,0,0.12)`,
                        transition: 'all 0.25s'
                      }}>
                        {hasMedia && (
                          <div style={{
                            width: '100%', height: 140,
                            background: `url(${item.media[0]}) center/cover no-repeat`,
                            borderBottom: `1px solid ${toneColor}15`
                          }} />
                        )}
                        <div style={{ padding: 16 }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                              background: `linear-gradient(135deg, ${toneColor}, ${toneColor}77)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#000', fontSize: 14, fontWeight: 900,
                              boxShadow: `0 4px 10px ${toneColor}25`
                            }}>
                              {initial}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: toneColor }}>
                                  {item.sender_name || 'Al-Mawaid'}
                                </span>
                                <span style={{ fontSize: 10, color: t.textSub, opacity: 0.5 }}>
                                  {timeAgo(item.created_at)}
                                </span>
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: t.text, marginBottom: 4, fontFamily: "'DM Sans',sans-serif" }}>
                                {item.title}
                              </div>
                              <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }}>
                                {item.body}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div style={{ height: 2, background: `linear-gradient(90deg, ${toneColor}, transparent)` }} />
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })()}
    </main>
  )
}

function SupportTicketsPage({ onBack }) {
  const t = useTheme(), { user } = useAuth()
  const [ticketType, setTicketType] = useState('general')
  const [subject, setSubject] = useState('')
  const [details, setDetails] = useState('')
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const issueTypes = [{ id: 'general', label: 'General' }, { id: 'thali-related', label: 'Thali Related Issues' }, { id: 'thali-delivery', label: 'Thali Delivery Issues' }]
  const inputStyle = { width: '100%', padding: '11px 13px', borderRadius: 16, boxSizing: 'border-box', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif" }
  const statusColor = s => s === 'open' ? '#d4882a' : s === 'resolved' ? '#5eba82' : '#7aabb8'

  useEffect(() => {
    loadTickets()
    const channel = supabase
      .channel('tickets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queries', filter: `user_id=eq.${user.id}` }, () => {
        loadTickets()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])
  const loadTickets = async () => {
    try {
      const { data } = await supabase.from('queries')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(30)

      const filtered = (data || []).filter(item => {
        return (item.comment || '').startsWith('[Support Ticket]')
      }).slice(0, 20)

      setTickets(filtered)
    } catch { /* ignore */ } finally { setLoading(false) }
  }
  const handleSubmit = async () => {
    if (!subject.trim()) return setError('Please enter a subject')
    if (!details.trim()) return setError('Please describe your problem')
    setError(''); setSuccess(''); setSubmitting(true)
    try {
      const { error: dbErr } = await supabase.from('queries').insert([{
        user_id: user.id,
        subject: subject.trim(),
        comment: `[Support Ticket] Type: ${ticketType}\n\n${details.trim()}`,
        media: [],
        status: 'open'
      }])
      if (dbErr) throw dbErr
      setSuccess('Support ticket submitted successfully.')
      setSubject(''); setDetails(''); setTicketType('general'); loadTickets()
    } catch (err) { setError(err.message) } finally { setSubmitting(false) }
  }

  return (
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {onBack && <BackHeader title="Support Ticket" onBack={onBack} />}
      <Card active style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.accent, marginBottom: 6, fontFamily: "'Playfair Display',serif" }}>Raise a Support Ticket</div>
        <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.6, marginBottom: 14, fontFamily: "'DM Sans',sans-serif" }}>Tell us your problem and our team can follow up on general, thali-related, or delivery issues.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 12 }}>
          {issueTypes.map(type => (
            <button key={type.id} onClick={() => setTicketType(type.id)}
              style={{ padding: '11px 12px', borderRadius: 11, textAlign: 'left', cursor: 'pointer', border: `1px solid ${ticketType === type.id ? t.accentBorder : t.border}`, background: ticketType === type.id ? t.accentBg : t.card, color: ticketType === type.id ? t.accent : t.textSub, fontWeight: 700, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
              {type.label}
            </button>
          ))}
        </div>
        <label htmlFor="ticketSubject" style={{ display: 'none' }}>Ticket Subject</label>
        <input id="ticketSubject" name="ticketSubject" aria-label="Ticket Subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={{ ...inputStyle, marginBottom: 10 }} />
        <label htmlFor="ticketDetails" style={{ display: 'none' }}>Ticket Description</label>
        <textarea id="ticketDetails" name="ticketDetails" aria-label="Ticket Description" value={details} onChange={e => setDetails(e.target.value)} placeholder="Describe your problem" style={{ ...inputStyle, minHeight: 110, resize: 'vertical', marginBottom: 10 }} />
        {error && <ErrorBanner msg={error} />}
        {success && <div style={{ marginBottom: 10, padding: 11, borderRadius: 10, background: t.successBg, border: `1px solid ${t.successBorder}`, color: t.successText, fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{success}</div>}
        <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: submitting ? t.border : t.accentGrad, color: '#fff', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>{submitting ? 'Submitting...' : 'Submit Support Ticket'}</button>
      </Card>
      <SectionLabel>Recent Tickets</SectionLabel>
      {loading ? <ListPageSkeleton title="Support Tickets" count={4} /> : tickets.length === 0 ? <EmptyState msg="No support tickets raised yet." /> : tickets.map(ticket => (
        <Card key={ticket.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 }}>
            <div style={{ fontSize: 12, color: t.textSub, fontFamily: "'DM Sans',sans-serif" }}>{new Date(ticket.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${statusColor(ticket.status)}20`, color: statusColor(ticket.status), border: `1px solid ${statusColor(ticket.status)}40`, fontFamily: "'DM Sans',sans-serif" }}>{ticket.status?.toUpperCase()}</span>
          </div>
          <div style={{ whiteSpace: 'pre-line', fontSize: 13, color: t.textBody, lineHeight: 1.7, fontFamily: "'DM Sans',sans-serif" }}>{ticket.comment?.replace('[Support Ticket]\n', '')}</div>
          {ticket.admin_reply && <div style={{ marginTop: 8, padding: 10, borderRadius: 9, background: t.accentBg, border: `1px solid ${t.accentBorder}`, fontSize: 13, color: t.accent, fontFamily: "'DM Sans',sans-serif" }}>Reply: {ticket.admin_reply}</div>}
        </Card>
      ))}
    </main>
  )
}

function AboutPage({ onBack }) {
  const t = useTheme()
  const aboutCards = [
    { title: 'About Al-Mawaid', body: 'This app helps thali users manage surveys, requests, payments, and support in one place.' },
    { title: 'What You Can Do', body: 'Submit feedback, manage thali requests, raise support tickets, and stay updated with notices.' },
    { title: 'Need Assistance?', body: 'Use the Support tab or the Support Ticket option inside your profile to contact the team.' },
  ]
  return (
    <main style={{ flex: 1, padding: '16px 16px 120px', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {onBack && <BackHeader title="About" onBack={onBack} />}
      {aboutCards.map(card => (
        <Card key={card.title} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: t.accentBg, border: `1px solid ${t.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Info size={18} color={t.accent} /></div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, fontFamily: "'DM Sans',sans-serif" }}>{card.title}</div>
              <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.7, marginTop: 4, fontFamily: "'DM Sans',sans-serif" }}>{card.body}</div>
            </div>
          </div>
        </Card>
      ))}
    </main>
  )
}
