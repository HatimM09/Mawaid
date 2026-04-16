// src/admin/Dashboard.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { Users, ClipboardList, Star, FileText, MessageSquare, TrendingUp, Activity, Calendar } from 'lucide-react'
import {
  T, PageWrap, PageTitle, StatCard, AdminCard, Badge, Spinner, Grid, fmtDate, fmtDateTime, SectionHeader
} from './ui'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'

const CHART_COLORS = ['#c49c5a', '#5e9ce0', '#5eba82', '#e06070', '#9b8de0', '#e09855']

const TooltipStyle = {
  contentStyle: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 13 },
  labelStyle: { color: T.accent },
  cursor: { fill: 'rgba(196,156,90,0.06)' },
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    users: 0, surveys: 0, feedback: 0, requests: 0, queries: 0,
  })
  const [surveyByDay, setSurveyByDay] = useState([])
  const [feedbackByDay, setFeedbackByDay] = useState([])
  const [feedbackDist, setFeedbackDist] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [requestStats, setRequestStats] = useState([])
  const [weeklyTrend, setWeeklyTrend] = useState([])

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    await Promise.all([
      loadStats(), loadSurveyByDay(), loadFeedbackByDay(),
      loadFeedbackDist(), loadRecentActivity(), loadRequestStats(), loadWeeklyTrend()
    ])
    setLoading(false)
  }, [])

  useEffect(() => { 
    loadAll()
    const interval = setInterval(() => loadAll(true), 60000) // Auto-sync every minute
    return () => clearInterval(interval)
  }, [loadAll])

  const loadStats = async () => {
    const [u, s, f, r, q] = await Promise.all([
      supabase.from('user_stats').select('id', { count: 'exact', head: true }),
      supabase.from('survey_responses').select('id', { count: 'exact', head: true }),
      supabase.from('daily_feedback').select('id', { count: 'exact', head: true }),
      supabase.from('thali_requests').select('id', { count: 'exact', head: true }),
      supabase.from('user_queries').select('id', { count: 'exact', head: true }),
    ])
    setStats({
      users:    u.count ?? 0,
      surveys:  s.count ?? 0,
      feedback: f.count ?? 0,
      requests: r.count ?? 0,
      queries:  q.count ?? 0,
    })
  }

  const loadSurveyByDay = async () => {
    const { data } = await supabase.from('survey_responses').select('day')
    if (!data) return
    const counts = {}
    data.forEach(r => { counts[r.day] = (counts[r.day] || 0) + 1 })
    const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday']
    setSurveyByDay(DAYS.map(d => ({ day: d.charAt(0).toUpperCase() + d.slice(1,3), count: counts[d] || 0 })))
  }

  const loadFeedbackByDay = async () => {
    const { data } = await supabase.from('daily_feedback').select('day, lunch_stars, dinner_stars')
    if (!data) return
    const map = {}
    data.forEach(r => {
      if (!map[r.day]) map[r.day] = { lunch: [], dinner: [] }
      if (r.lunch_stars) map[r.day].lunch.push(r.lunch_stars)
      if (r.dinner_stars) map[r.day].dinner.push(r.dinner_stars)
    })
    const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday']
    setFeedbackByDay(DAYS.map(d => {
      const e = map[d] || { lunch: [], dinner: [] }
      const avg = arr => arr.length ? (arr.reduce((a,b) => a+b,0)/arr.length).toFixed(1) : 0
      return { day: d.charAt(0).toUpperCase()+d.slice(1,3), lunch: +avg(e.lunch), dinner: +avg(e.dinner) }
    }))
  }

  const loadFeedbackDist = async () => {
    const { data } = await supabase.from('daily_feedback').select('lunch_stars, dinner_stars')
    if (!data) return
    const dist = { 1:0, 2:0, 3:0, 4:0, 5:0 }
    data.forEach(r => {
      if (r.lunch_stars)  dist[r.lunch_stars]  = (dist[r.lunch_stars]  || 0) + 1
      if (r.dinner_stars) dist[r.dinner_stars] = (dist[r.dinner_stars] || 0) + 1
    })
    setFeedbackDist([1,2,3,4,5].map(s => ({ name: `${s}★`, value: dist[s] })))
  }

  const loadRecentActivity = async () => {
    const [{ data: srv }, { data: fbk }, { data: req }] = await Promise.all([
      supabase.from('survey_responses').select('id,user_id,day,meal,created_at').order('created_at',{ascending:false}).limit(5),
      supabase.from('daily_feedback').select('id,user_id,day,created_at').order('created_at',{ascending:false}).limit(5),
      supabase.from('thali_requests').select('id,user_id,request_type,created_at').order('created_at',{ascending:false}).limit(5),
    ])
    const all = [
      ...(srv||[]).map(r => ({ type:'Survey',   desc:`Survey for ${r.day} ${r.meal}`, at: r.created_at })),
      ...(fbk||[]).map(r => ({ type:'Feedback', desc:`Feedback for ${r.day}`,          at: r.created_at })),
      ...(req||[]).map(r => ({ type:'Request',  desc:`Request: ${r.request_type}`,     at: r.created_at })),
    ].sort((a,b) => new Date(b.at) - new Date(a.at)).slice(0,10)
    setRecentActivity(all)
  }

  const loadRequestStats = async () => {
    const { data } = await supabase.from('thali_requests').select('request_type, status')
    if (!data) return
    const map = {}
    data.forEach(r => { map[r.request_type] = (map[r.request_type] || 0) + 1 })
    setRequestStats(Object.entries(map).map(([name, value]) => ({ name, value })))
  }

  const loadWeeklyTrend = async () => {
    // Last 6 weeks surveys
    const { data } = await supabase.from('survey_responses').select('created_at')
    if (!data) return
    const weekMap = {}
    data.forEach(r => {
      const d = new Date(r.created_at)
      const week = `W${Math.ceil(d.getDate()/7)} ${d.toLocaleString('default',{month:'short'})}`
      weekMap[week] = (weekMap[week] || 0) + 1
    })
    setWeeklyTrend(Object.entries(weekMap).slice(-6).map(([week, count]) => ({ week, count })))
  }

  if (loading) return <Spinner />

  return (
    <PageWrap>
      <PageTitle sub={`Last updated ${new Date().toLocaleTimeString()}`}>
        Dashboard Overview
      </PageTitle>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard icon={<Users size={22} color={T.accent} />}    label="Total Users"    value={stats.users}    />
        <StatCard icon={<ClipboardList size={22} color="#5e9ce0" />} label="Survey Resp."  value={stats.surveys}  color="#5e9ce0" />
        <StatCard icon={<Star size={22} color="#5eba82" />}       label="Feedbacks"      value={stats.feedback} color="#5eba82" />
        <StatCard icon={<FileText size={22} color="#e09855" />}   label="Requests"       value={stats.requests} color="#e09855" />
        <StatCard icon={<MessageSquare size={22} color="#e06070"/>} label="Queries"      value={stats.queries}  color="#e06070" />
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Survey Responses by Day */}
        <AdminCard>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 20 }}>Survey Responses by Day</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={surveyByDay} margin={{ left: -20 }}>
              <CartesianGrid stroke={T.border} vertical={false} />
              <XAxis dataKey="day" tick={{ fill: T.textSub, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.textSub, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TooltipStyle} />
              <Bar dataKey="count" fill={T.accent} radius={[6,6,0,0]} name="Responses" />
            </BarChart>
          </ResponsiveContainer>
        </AdminCard>

        {/* Avg Feedback Rating by Day */}
        <AdminCard>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 20 }}>Avg Feedback Rating by Day</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={feedbackByDay} margin={{ left: -20 }}>
              <CartesianGrid stroke={T.border} vertical={false} />
              <XAxis dataKey="day" tick={{ fill: T.textSub, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0,5]} tick={{ fill: T.textSub, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: T.textSub }} />
              <Line type="monotone" dataKey="lunch"  stroke="#c49c5a" strokeWidth={2.5} dot={{ r:4, fill:'#c49c5a' }} name="Lunch" />
              <Line type="monotone" dataKey="dinner" stroke="#5e9ce0" strokeWidth={2.5} dot={{ r:4, fill:'#5e9ce0' }} name="Dinner" />
            </LineChart>
          </ResponsiveContainer>
        </AdminCard>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Feedback Star Distribution */}
        <AdminCard>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Star Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={feedbackDist} cx="50%" cy="50%" outerRadius={75} dataKey="value" nameKey="name" label={({ name }) => name} labelLine={false}>
                {feedbackDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
              </Pie>
              <Tooltip {...TooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </AdminCard>

        {/* Request Types */}
        <AdminCard>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Request Types</div>
          {requestStats.length === 0
            ? <div style={{ color: T.textSub, fontSize: 13, textAlign: 'center', paddingTop: 60 }}>No requests yet</div>
            : <ResponsiveContainer width="100%" height={200}>
                <BarChart data={requestStats} layout="vertical" margin={{ left: 0 }}>
                  <XAxis type="number" tick={{ fill: T.textSub, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: T.textSub, fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip {...TooltipStyle} />
                  <Bar dataKey="value" fill="#5e9ce0" radius={[0,6,6,0]} name="Count" />
                </BarChart>
              </ResponsiveContainer>
          }
        </AdminCard>

        {/* Weekly Survey Trend */}
        <AdminCard>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Weekly Survey Trend</div>
          {weeklyTrend.length < 2
            ? <div style={{ color: T.textSub, fontSize: 13, textAlign: 'center', paddingTop: 60 }}>More data needed</div>
            : <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeklyTrend}>
                  <CartesianGrid stroke={T.border} vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: T.textSub, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.textSub, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip {...TooltipStyle} />
                  <Line type="monotone" dataKey="count" stroke="#5eba82" strokeWidth={2.5} dot={{ r:4 }} name="Surveys" />
                </LineChart>
              </ResponsiveContainer>
          }
        </AdminCard>
      </div>

      {/* Recent Activity */}
      <AdminCard>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity size={16} color={T.accent} />
          Recent Activity
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {recentActivity.length === 0
            ? <div style={{ color: T.textSub, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No activity yet</div>
            : recentActivity.map((a, i) => {
                const colors = { Survey: '#c49c5a', Feedback: '#5eba82', Request: '#e09855' }
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 0',
                    borderBottom: i < recentActivity.length - 1 ? `1px solid ${T.border}` : 'none',
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: colors[a.type] || T.accent,
                    }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ color: T.text, fontSize: 13 }}>{a.desc}</span>
                    </div>
                    <Badge color={colors[a.type]}>{a.type}</Badge>
                    <span style={{ color: T.textSub, fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDateTime(a.at)}</span>
                  </div>
                )
              })
          }
        </div>
      </AdminCard>
    </PageWrap>
  )
}
