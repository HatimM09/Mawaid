// src/pages/NotificationsPage.jsx
// Notification Inbox — persistent history with read/unread, filtering, search
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/firebaseClient'
import {
  Bell, Filter, Search, X, Check, Eye, Trash2, Clock, Mail,
  ChevronRight, ChevronLeft, ArrowUpDown, Menu, XCircle,
  Star, Archive, RefreshCw, Download, Settings
} from 'lucide-react'
import { PageWrap, PageTitle, AdminCard, Badge, Btn, Spinner, Modal, T, fmtDateTime } from '../admin/ui'

const TYPE_CONFIG = {
  broadcast: { label: 'Broadcast', icon: Megaphone, color: '#c5a059' },
  survey: { label: 'Survey', icon: ClipboardList, color: '#34d399' },
  survey_reminder: { label: 'Survey Reminder', icon: Clock, color: '#f59e0b' },
  survey_digest: { label: 'Survey Digest', icon: BarChart3, color: '#60a5fa' },
  menu: { label: 'Menu', icon: Utensils, color: '#ef4444' },
  query_reply: { label: 'Query Reply', icon: MessageSquare, color: '#a78bfa' },
  request_update: { label: 'Request Update', icon: Package, color: '#f97316' },
  reminder: { label: 'Reminder', icon: Bell, color: '#f59e0b' },
  system: { label: 'System', icon: Cpu, color: '#9ca3af' },
  default: { label: 'Notification', icon: Bell, color: '#64748b' },
}

function Megaphone({ size = 16, color }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9z"/><path d="M10 14.5v-5l6 2.5-6 2.5"/><path d="M4 9v6"/></svg> }
function ClipboardList({ size = 16, color }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="4" width="6" height="16" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg> }
function BarChart3({ size = 16, color }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg> }
function Utensils({ size = 16, color }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2v-7"/><path d="M15 11v7"/></svg> }
function MessageSquare({ size = 16, color }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function Package({ size = 16, color }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> }
function Cpu({ size = 16, color }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/><line x1="20" y1="15" x2="23" y2="15"/></svg> }

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [readFilter, setReadFilter] = useState('all') // all, unread, read
  const [dateFilter, setDateFilter] = useState('all') // all, today, week, month
  const [sortOrder, setSortOrder] = useState('desc') // desc, asc

  // Pagination
  const [visibleCount, setVisibleCount] = useState(50)
  const PAGE_SIZE = 50

  // Archived view
  const [showArchived, setShowArchived] = useState(false)

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // Detail modal
  const [detailItem, setDetailItem] = useState(null)

  // Get archived notifications
  const fetchArchived = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .not('archived_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50)
      return data || []
    } catch { return [] }
  }, [])

  // Stats
  const [stats, setStats] = useState({ total: 0, unread: 0, types: {} })

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Build query
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200)

      // Apply filters
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,message.ilike.%${searchQuery}%`)
      }
      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter)
      }
      if (readFilter === 'unread') {
        query = query.is('read_at', null)
      } else if (readFilter === 'read') {
        query = query.not('read_at', 'is', null)
      }
      if (dateFilter === 'today') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        query = query.gte('created_at', today.toISOString())
      } else if (dateFilter === 'week') {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        query = query.gte('created_at', weekAgo.toISOString())
      } else if (dateFilter === 'month') {
        const monthAgo = new Date()
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        query = query.gte('created_at', monthAgo.toISOString())
      }

      const { data, error } = await query
      if (error) throw error

      setNotifications(data || [])
      const unread = (data || []).filter(n => !n.read_at).length
      setUnreadCount(unread)

      // Calculate stats
      const typeCounts = {}
      data?.forEach(n => {
        typeCounts[n.type] = (typeCounts[n.type] || 0) + 1
      })
      setStats({ total: data?.length || 0, unread, types: typeCounts })
    } catch (err) {
      console.error('[NotificationsPage] Fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [searchQuery, typeFilter, readFilter, dateFilter, sortOrder])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('notifications-inbox')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${supabase.auth.getUser().then(r => r.data?.user?.id)}`,
      }, () => fetchNotifications())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${supabase.auth.getUser().then(r => r.data?.user?.id)}`,
      }, () => fetchNotifications())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchNotifications])

  // Mark as read
  const markAsRead = async (ids) => {
    if (!ids.length) return
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n))
    setUnreadCount(prev => prev - ids.filter(id => !notifications.find(n => n.id === id)?.read_at).length)
  }

  // Mark as unread
  const markAsUnread = async (ids) => {
    if (!ids.length) return
    await supabase.from('notifications').update({ read_at: null }).in('id', ids)
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read_at: null } : n))
  }

  // Delete
  const deleteNotifications = async (ids) => {
    if (!ids.length) return
    await supabase.from('notifications').delete().in('id', ids)
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)))
    setSelectedIds(new Set())
    setSelectAll(false)
  }

  // Archive (soft delete - move to archived)
  const archiveNotifications = async (ids) => {
    if (!ids.length) return
    await supabase.from('notifications').update({ archived_at: new Date().toISOString() }).in('id', ids)
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)))
    setSelectedIds(new Set())
    setSelectAll(false)
  }

  // Toggle selection
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set())
      setSelectAll(false)
    } else {
      setSelectedIds(new Set(filteredNotifications.map(n => n.id)))
      setSelectAll(true)
    }
  }

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let result = [...notifications].sort((a, b) => {
      const ad = new Date(a.created_at).getTime()
      const bd = new Date(b.created_at).getTime()
      return sortOrder === 'desc' ? bd - ad : ad - bd
    })
    return result
  }, [notifications, sortOrder])

  const paginatedNotifications = useMemo(() => {
    return filteredNotifications.slice(0, visibleCount)
  }, [filteredNotifications, visibleCount])

  const hasMore = visibleCount < filteredNotifications.length

  // Unique types for filter dropdown with readable labels
  const availableTypes = useMemo(() => {
    const types = new Set(notifications.map(n => n.type))
    return Array.from(types).sort().map(t => ({
      value: t,
      label: (TYPE_CONFIG[t] || TYPE_CONFIG.default).label
    }))
  }, [notifications])

  // Handle notification click (mark read + open the related action page).
  // Uses a full navigation so it works from anywhere: the app boots on the
  // right tab via pathname parsing (survey / menu / requests / alerts).
  const handleNotificationClick = (item) => {
    if (!item.read_at) markAsRead([item.id])
    if (item.url) {
      if (item.url.startsWith('http://') || item.url.startsWith('https://')) {
        window.open(item.url, '_blank')
      } else if (item.url !== '/') {
        window.location.href = item.url
      }
    }
    setDetailItem(item)
  }

  // Get type config
  const getTypeConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.default

  // Render time ago
  const timeAgo = (dateStr) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  // Bulk actions bar
  const hasSelection = selectedIds.size > 0

  return (
    <PageWrap>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <PageTitle sub={`${unreadCount} unread · ${stats.total} total`}>
            Notification Inbox
          </PageTitle>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge color={T.accent}><Bell size={12} /> {unreadCount} unread</Badge>
          <Btn variant="ghost" size="sm" onClick={() => { setRefreshing(true); fetchNotifications() }} disabled={refreshing}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </Btn>
        </div>
      </div>

      {/* Filter Bar */}
      <AdminCard style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={16} color={T.textSub} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search title, message..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px 10px 40px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
              minWidth: 160, cursor: 'pointer',
            }}
          >
            <option value="all">All Types</option>
            {availableTypes.map(({ value, label }) => {
              return <option key={value} value={value}>{label}</option>
            })}
          </select>

          {/* Read Filter */}
          <select
            value={readFilter}
            onChange={e => setReadFilter(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
              minWidth: 140, cursor: 'pointer',
            }}
          >
            <option value="all">All</option>
            <option value="unread">Unread Only</option>
            <option value="read">Read Only</option>
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
              minWidth: 140, cursor: 'pointer',
            }}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          {/* Archived Toggle */}
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => { setShowArchived(!showArchived); if (!showArchived) fetchArchived().then(a => setNotifications(a)); else fetchNotifications() }}
            style={{ color: showArchived ? T.accent : 'var(--text-tertiary)' }}
          >
            <Archive size={14} /> {showArchived ? 'Inbox' : 'Archived'}
          </Btn>

          {/* Sort */}
          <Btn variant="ghost" size="sm" onClick={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}>
            <ArrowUpDown size={14} /> {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
          </Btn>
        </div>
      </AdminCard>

      {/* Bulk Actions Bar */}
      {hasSelection && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'linear-gradient(180deg, rgba(10,13,20,0) 0%, #0a0d14 20%)',
          padding: '16px 24px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        }}>
          <AdminCard style={{ maxWidth: 800, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              {selectedIds.size} selected
            </span>
            <Btn variant="ghost" size="sm" onClick={() => markAsRead(Array.from(selectedIds))}>
              <Check size={14} /> Mark Read
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => markAsUnread(Array.from(selectedIds))}>
              <Mail size={14} /> Mark Unread
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => archiveNotifications(Array.from(selectedIds))}>
              <Archive size={14} /> Archive
            </Btn>
            <Btn variant="danger" size="sm" onClick={() => { if (window.confirm(`Delete ${selectedIds.size} notifications?`)) deleteNotifications(Array.from(selectedIds)) }}>
              <Trash2 size={14} /> Delete
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => { setSelectedIds(new Set()); setSelectAll(false) }}>
              <X size={14} /> Clear Selection
            </Btn>
          </AdminCard>
        </div>
      )}

      {/* List */}
      <AdminCard style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <Spinner size={32} style={{ marginBottom: 16 }} />
            Loading notifications...
          </div>
        ) : paginatedNotifications.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <Bell size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p style={{ fontSize: 16, marginBottom: 8 }}>No notifications found</p>
            <p style={{ fontSize: 13 }}>Try adjusting your filters or search</p>
          </div>
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
            {paginatedNotifications.map((item, index) => {
              const cfg = getTypeConfig(item.type)
              const Icon = cfg.icon
              const isUnread = !item.read_at
              const isSelected = selectedIds.has(item.id)

              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '16px 20px',
                    borderBottom: index < paginatedNotifications.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                    background: isSelected
                      ? 'rgba(197, 160, 89, 0.06)'
                      : isUnread
                        ? 'rgba(197, 160, 89, 0.03)'
                        : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'rgba(197, 160, 89, 0.06)' : isUnread ? 'rgba(197, 160, 89, 0.03)' : 'transparent' }}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(item.id)}
                    onClick={e => e.stopPropagation()}
                    style={{ marginTop: 4, width: 18, height: 18, accentColor: T.accent, cursor: 'pointer' }}
                  />

                  {/* Icon */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: `${cfg.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: isUnread ? `1px solid ${cfg.color}40` : 'none',
                  }}>
                    <Icon size={18} color={cfg.color} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <h4 style={{
                            fontSize: 14, fontWeight: isUnread ? 700 : 500, color: 'var(--text-primary)',
                            margin: 0, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {item.title || 'Notification'}
                          </h4>
                          {item.sender_name && item.sender_name !== 'Al-Mawaid' && (
                            <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, marginTop: 1, letterSpacing: '0.03em' }}>
                              from {item.sender_name}
                            </div>
                          )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                          <Badge size="xs" style={{ background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
                            <Icon size={10} /> {cfg.label}
                          </Badge>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{timeAgo(item.created_at)}</span>
                          {isUnread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, flexShrink: 0 }} />}
                        </div>
                      </div>
                    </div>
                    <p style={{
                      fontSize: 12.5, color: isUnread ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                      margin: 0, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {item.message || item.body || ''}
                    </p>                        {item.url && item.url !== '/' && (
                          <div style={{ marginTop: 8, fontSize: 11, color: T.accent, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ChevronRight size={12} /> Opens: {item.url}
                          </div>
                        )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: 0, transition: 'opacity 0.2s' }}>
                    {!item.read_at && (
                      <button
                        onClick={e => { e.stopPropagation(); markAsRead([item.id]) }}
                        title="Mark as read"
                        style={{ padding: 6, borderRadius: 8, background: 'rgba(52, 211, 153, 0.1)', border: 'none', color: '#34d399', cursor: 'pointer' }}
                      ><Check size={14} /></button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setDetailItem(item) }}
                      title="View details"
                      style={{ padding: 6, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', color: 'var(--text-tertiary)', cursor: 'pointer' }}
                    ><Eye size={14} /></button>
                  </div>
                </div>
              )
            })}
            {/* Load More */}
            {hasMore && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <button
                  onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                  style={{
                    padding: '10px 24px', borderRadius: 12,
                    background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)',
                    color: T.accent, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    fontFamily: 'inherit', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(197,160,89,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(197,160,89,0.08)'}
                >
                  Load More ({filteredNotifications.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </AdminCard>

      {/* Detail Modal */}
      {detailItem && (
        <Modal isOpen onClose={() => setDetailItem(null)} size="md">
          {(() => {
            const cfg = getTypeConfig(detailItem.type)
            const Icon = cfg.icon
            return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: `${cfg.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={20} color={cfg.color} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {detailItem.title || 'Notification'}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  <Badge size="xs" style={{ background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
                    <Icon size={10} /> {cfg.label}
                  </Badge>
                  {detailItem.sender_name && <span>• {detailItem.sender_name}</span>}
                  <span>{fmtDateTime(detailItem.created_at)}</span>
                  {detailItem.read_at && <span style={{ color: '#34d399' }}>• Read at {fmtDateTime(detailItem.read_at)}</span>}
                </div>
              </div>
            </div>

            <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--border-glass)' }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {detailItem.message || detailItem.body || 'No message content'}
              </p>
            </div>

            {detailItem.url && detailItem.url !== '/' && (
              <div style={{ textAlign: 'center' }}>
                <Btn
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (detailItem.url.startsWith('http://') || detailItem.url.startsWith('https://')) {
                      window.open(detailItem.url, '_blank')
                    } else if (detailItem.url.includes('survey')) {
                      window.dispatchEvent(new CustomEvent('app-navigate', { detail: { url: '/survey' } }))
                      setDetailItem(null)
                    } else if (detailItem.url.includes('menu')) {
                      window.dispatchEvent(new CustomEvent('app-navigate', { detail: { url: '/menu' } }))
                      setDetailItem(null)
                    } else {
                      window.location.href = detailItem.url
                    }
                  }}
                >
                  <ChevronRight size={14} /> Open Link
                </Btn>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 8 }}>
              {!detailItem.read_at && (
                <Btn variant="ghost" size="sm" onClick={() => { markAsRead([detailItem.id]); setDetailItem(null) }}>
                  <Check size={14} /> Mark Read
                </Btn>
              )}
              <Btn variant="ghost" size="sm" onClick={() => { archiveNotifications([detailItem.id]); setDetailItem(null) }}>
                <Archive size={14} /> Archive
              </Btn>
              <Btn variant="danger" size="sm" onClick={() => { if (window.confirm('Delete this notification?')) { deleteNotifications([detailItem.id]); setDetailItem(null) } }}>
                <Trash2 size={14} /> Delete
              </Btn>
            </div>
          </div>
            )
          })()}
        </Modal>
      )}
    </PageWrap>
  )
}