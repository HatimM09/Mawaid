import React, { useState, useEffect, useRef, useCallback } from 'react'
import { QrCode, Sun, Moon, Clock, ChevronRight, Utensils, Star, Check, ClipboardList } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../../lib/firebaseClient'
import { useWeeklyMenu } from '../../common/useWeeklyMenu'
import { useAuth, useTheme } from '../../admin/context'
import DailyEditCard, { getCardMealInfo } from '../../components/DailyEditCard'
import { getWeekDate, getCalendarWeekDate } from '../../common/utils'
import { HomePageSkeleton } from '../../common/Skeleton'
import { DAYS, getTodayKey } from '../constants'
import { hasUserOverride, isSurveyOpen, canEditMeal, getEditWindow } from '../survey'
import { Card, Btn, Avatar } from '../ui'

export default function HomePage({ appSettings = {}, onGoToSurvey }) {
  const t = useTheme()
  const { user } = useAuth()

  const weeklyMenu = useWeeklyMenu(getCalendarWeekDate())
  const [showQR, setShowQR] = useState(false)
  const [profileData, setProfileData] = useState({ name: '', thali_number: '', avatar_url: '' })
  const [statsLoading, setStatsLoading] = useState(true)
  const [weeklySurveySubmitted, setWeeklySurveySubmitted] = useState(false)
  const todayKey = getTodayKey()

  // Auto-edit card state — auto-popup when edit window opens
  const [showDailyEditCard, setShowDailyEditCard] = useState(false)
  const [dailyEditMealInfo, setDailyEditMealInfo] = useState(null)
  // Tracks cards the user opened manually (via the Quick Edit button) so the
  // auto-window checker never force-closes them mid-edit (the "blinking" bug).
  const manualEditOpenRef = useRef(false)

  const editPromptStorageKey = useCallback((day, meal) =>
    `almawaid_edit_prompt_${user?.id || 'anon'}_${getWeekDate(parseInt(appSettings.survey_open_hour, 10) || 20)}_${day}_${meal}`
  , [user?.id, appSettings.survey_open_hour])

  const markEditPromptDone = useCallback((day, meal) => {
    if (!day || !meal) return
    try { localStorage.setItem(editPromptStorageKey(day, meal), '1') } catch { /* ignore */ }
  }, [editPromptStorageKey])

  const wasEditPromptShown = useCallback((day, meal) => {
    try { return localStorage.getItem(editPromptStorageKey(day, meal)) === '1' } catch { return false }
  }, [editPromptStorageKey])

  const openDailyEditCard = useCallback((mealInfo) => {
    manualEditOpenRef.current = true  // user-initiated — auto-checker must not close it
    setDailyEditMealInfo(mealInfo)
    setShowDailyEditCard(true)
  }, [])

  // Check if auto-edit is enabled and current time is within the timing window
  const checkAutoEditWindow = useCallback(() => {
    if (!user || !weeklyMenu) return

    const lunchAuto = appSettings.lunch_edit_status === 'auto'
    const dinnerAuto = appSettings.dinner_edit_status === 'auto'

    if (!lunchAuto && !dinnerAuto) {
      // Only auto-dismiss cards we opened ourselves — never a manual one.
      if (!manualEditOpenRef.current) {
        setShowDailyEditCard(false)
        setDailyEditMealInfo(null)
      }
      return
    }

    const currentWeekId = getWeekDate(parseInt(appSettings.survey_open_hour, 10) || 20)
    const today = todayKey

    const pick = (day, meal) => {
      if (wasEditPromptShown(day, meal)) return false
      if (manualEditOpenRef.current) return true  // leave a manually-opened card alone
      setDailyEditMealInfo({ day, meal })
      setShowDailyEditCard(true)
      return true
    }

    if (lunchAuto && canEditMeal(today, currentWeekId, 'lunch', appSettings, user.id)) {
      if (pick(today, 'lunch')) return
    }
    if (dinnerAuto && canEditMeal(today, currentWeekId, 'dinner', appSettings, user.id)) {
      if (pick(today, 'dinner')) return
    }

    const todayIdx = DAYS.indexOf(today)
    const nextDay = todayIdx >= 0 ? DAYS[(todayIdx + 1) % DAYS.length] : null
    if (nextDay && lunchAuto && canEditMeal(nextDay, currentWeekId, 'lunch', appSettings, user.id)) {
      if (pick(nextDay, 'lunch')) return
    }

    // Window ended — auto-dismiss only cards the auto-checker itself opened.
    if (!manualEditOpenRef.current) {
      setShowDailyEditCard(false)
      setDailyEditMealInfo(null)
    }
  }, [appSettings, user, weeklyMenu, todayKey, wasEditPromptShown])

  const closeDailyEditCard = useCallback((markDone = true) => {
    if (markDone && dailyEditMealInfo) {
      markEditPromptDone(dailyEditMealInfo.day, dailyEditMealInfo.meal)
    }
    manualEditOpenRef.current = false
    setShowDailyEditCard(false)
  }, [dailyEditMealInfo, markEditPromptDone])

  // Check auto-edit window every minute
  useEffect(() => {
    checkAutoEditWindow()
    const interval = setInterval(checkAutoEditWindow, 60000)
    return () => clearInterval(interval)
  }, [checkAutoEditWindow])

  // Feedback State
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState({ lunch: false, dinner: false })
  const [feedbackError, setFeedbackError] = useState('')
  const [lunchStars, setLunchStars] = useState(0)
  const [dinnerStars, setDinnerStars] = useState(0)
  const [lunchComment, setLunchComment] = useState('')
  const [dinnerComment, setDinnerComment] = useState('')
  const STAR_LABELS = { 1: '😞 Poor', 2: '😐 Fair', 3: '🙂 Good', 4: '😄 Great', 5: '🤩 Excellent' }

  const loadData = useCallback(async () => {
    try {
      const weekId = getWeekDate(parseInt(appSettings.survey_open_hour, 10) || 20)
      const [{ data: profile }, { data: existingFb }, { data: surveyData }] = await Promise.all([
        supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('daily_feedback').select('*').eq('user_id', user.id).eq('day', todayKey).maybeSingle(),
        supabase.from('survey_submissions_flat').select('*').eq('user_id', user.id).eq('week_id', weekId).maybeSingle(),
      ])
      if (profile) setProfileData({ name: profile.name || '', thali_number: profile.thali_number || '', avatar_url: profile.avatar_url || '' })
      if (existingFb) {
        setFeedbackSubmitted({ lunch: !!existingFb.lunch_stars, dinner: !!existingFb.dinner_stars })
        setLunchStars(existingFb.lunch_stars || 0)
        setDinnerStars(existingFb.dinner_stars || 0)
        setLunchComment(existingFb.lunch_comment || '')
        setDinnerComment(existingFb.dinner_comment || '')
      }
      // Hide the weekly-survey notice once every day's meals are answered
      const allDone = !!surveyData && DAYS.every(day => {
        const dk = day.substring(0, 3).toLowerCase()
        return surveyData[`${dk}_l_status`] && surveyData[`${dk}_d_status`]
      })
      setWeeklySurveySubmitted(allDone)
    } catch { /* ignore */ }
    setStatsLoading(false)
  }, [user?.id, todayKey, appSettings.survey_open_hour])

  useEffect(() => { loadData() }, [loadData])

  // Hide the survey notice the moment the whole week gets filled (e.g. from the
  // Survey tab), even while the Home screen stays mounted.
  useEffect(() => {
    if (!user?.id) return
    const ch = supabase.channel('home-survey-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_submissions_flat', filter: `user_id=eq.${user.id}` }, () => loadData())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user?.id, loadData])

  // Reset feedback state when day changes
  useEffect(() => {
    setFeedbackSubmitted({ lunch: false, dinner: false })
    setLunchStars(0)
    setDinnerStars(0)
    setLunchComment('')
    setDinnerComment('')
  }, [todayKey])

  const handleSubmitCombined = async () => {
    if (!lunchStars && !dinnerStars) {
      setFeedbackError('Please rate at least one meal')
      return
    }
    setSubmittingFeedback(true)
    setFeedbackError('')
    try {
      const { error: dbErr } = await supabase.from('daily_feedback').upsert([{
        user_id: user.id, day: todayKey,
        lunch_stars: lunchStars || null, lunch_emoji: lunchStars ? STAR_LABELS[lunchStars] : null,
        dinner_stars: dinnerStars || null, dinner_emoji: dinnerStars ? STAR_LABELS[dinnerStars] : null,
        lunch_comment: lunchComment.trim() || null,
        dinner_comment: dinnerComment.trim() || null,
        created_at: new Date().toISOString()
      }], { onConflict: 'user_id,day' })
      if (dbErr) throw dbErr
      setFeedbackSubmitted({ lunch: !!lunchStars, dinner: !!dinnerStars })

      // Notify admins (in-app + push) the first time this member rates each meal
      // for the day, so feedback is seen even when nobody is watching the page.
      const hasNewFeedback = (lunchStars && !feedbackSubmitted.lunch) || (dinnerStars && !feedbackSubmitted.dinner)
      if (hasNewFeedback) {
        try {
          let userName = 'A member'
          try {
            const { data: profile } = await supabase.from('user_stats').select('name, thali_number').eq('user_id', user.id).maybeSingle()
            if (profile?.name) userName = profile.name
            if (profile?.thali_number) userName += ` (#${profile.thali_number})`
          } catch { /* name is optional */ }
          const ratingParts = []
          if (lunchStars) ratingParts.push(`Lunch: ${lunchStars}★`)
          if (dinnerStars) ratingParts.push(`Dinner: ${dinnerStars}★`)
          await supabase.functions.invoke('send-push', {
            body: {
              title: '⭐ New Daily Feedback',
              body: `${userName} rated ${ratingParts.join(', ')}.`,
              target_type: 'admins',
              notify_in_app: true,
              type: 'feedback',
              sender_name: 'Al-Mawaid',
              url: '/admin/feedback'
            }
          })
        } catch (notifyErr) {
          console.warn('Feedback notification failed:', notifyErr)
        }
      }
    } catch (err) {
      setFeedbackError('Failed to submit feedback. Please try again.')
      console.error('Feedback submission error:', err)
    } finally { setSubmittingFeedback(false) }
  }

  const currentWeekId = getWeekDate(parseInt(appSettings.survey_open_hour, 10) || 20)

  // Time-window lunch/dinner quick-edit: only shown while a meal's edit window is live
  const currentMealInfo = weeklyMenu ? getCardMealInfo(weeklyMenu, appSettings) : null
  const currentEditableMeal = (currentMealInfo && canEditMeal(currentMealInfo.day, currentWeekId, currentMealInfo.meal, appSettings, user.id))
    ? currentMealInfo
    : null

  // Weekly survey notice — only shown while the Survey tab is actually visible
  // (survey open / override), so it never points to a missing tab.
  const surveyTabVisible = hasUserOverride(appSettings, user.id) || isSurveyOpen(appSettings, user.id)

  if (!weeklyMenu || statsLoading) return <HomePageSkeleton />

  return (
    <main style={{ flex: 1, padding: '16px 16px calc(110px + env(safe-area-inset-bottom, 20px))', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Profile strip */}
      <Card active style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, padding: '14px 16px', borderRadius: 18, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, left: -20, width: 80, height: 80, background: t.accentGrad, borderRadius: '50%', filter: 'blur(40px)', opacity: 0.08 }} />
        <Avatar avatarUrl={profileData?.avatar_url} name={profileData?.name} size={46} />
        <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display',serif", lineHeight: 1.2 }}>{profileData?.name || 'Thali User'}</div>
          <div style={{ fontSize: 13, color: t.textSub, fontFamily: "'DM Sans',sans-serif", marginTop: 2 }}>Thali #{profileData?.thali_number || '—'}</div>
        </div>
        <button onClick={() => setShowQR(true)} style={{ background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2, position: 'relative' }}>
          <QrCode size={22} color={t.accent} />
        </button>
      </Card>

      {/* Weekly survey notice — points to the Survey tab (the only fill entry point).
          Hidden once every day's meals are answered for the week. */}
      {surveyTabVisible && !weeklySurveySubmitted && (
        <button
          onClick={onGoToSurvey}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '13px 16px', margin: '0 0 16px', boxSizing: 'border-box',
            borderRadius: 18, cursor: 'pointer', textAlign: 'left',
            background: `linear-gradient(135deg, ${t.accentBg}, transparent 72%)`,
            border: `1.5px solid ${t.accentBorder}`,
            boxShadow: `0 8px 22px ${t.accentBg}`,
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s',
            fontFamily: "'DM Sans',sans-serif",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 28px ${t.accentBg}` }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 22px ${t.accentBg}` }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 12, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 6px 16px ${t.accentBg}` }}>
            <ClipboardList size={18} color="#000" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.accent }}>Weekly Survey Open</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, marginTop: 2, lineHeight: 1.35 }}>
              Fill your weekly survey in the <span style={{ color: t.accent, fontWeight: 800 }}>Survey</span> tab
            </div>
          </div>
          <ChevronRight size={18} color={t.accent} style={{ flexShrink: 0 }} />
        </button>
      )}

      {/* Time-based Daily Survey Edit button — shows during lunch/dinner edit window */}
      {currentEditableMeal && (() => {
        const isLunch = currentEditableMeal.meal === 'lunch'
        const MealIcon = isLunch ? Sun : Moon
        const window = getEditWindow(appSettings, currentEditableMeal.meal)
        return (
          <button
            onClick={() => openDailyEditCard(currentEditableMeal)}
            style={{
              width: '100%', margin: '0 0 16px', padding: 0,
              border: `1.5px solid ${t.accentBorder}`, cursor: 'pointer',
              textAlign: 'left', borderRadius: 22, position: 'relative',
              overflow: 'hidden', background: t.cardActive,
              boxShadow: `0 18px 40px ${t.accentBg}`,
              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 24px 50px ${t.accentBg}` }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 18px 40px ${t.accentBg}` }}
          >
            <div
              style={{
                position: 'absolute', top: -30, right: -30, width: 110, height: 110,
                background: t.accentGrad, borderRadius: '50%', filter: 'blur(50px)', opacity: 0.16
              }}
            />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%',
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '18px 20px', borderRadius: 22, boxSizing: 'border-box',
              background: `linear-gradient(135deg, ${t.accentBg}, transparent 55%)`
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, background: t.accentGrad,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: `0 8px 18px ${t.accentBg}`
              }}>
                <MealIcon size={22} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
                  color: t.accent, fontFamily: "'DM Sans',sans-serif", textTransform: 'uppercase'
                }}>
                  {isLunch ? 'Today\'s Lunch' : 'Today\'s Dinner'} &bull; Daily Edit
                </div>
                <div style={{
                  fontSize: 18, fontWeight: 800, color: t.text,
                  fontFamily: "'Playfair Display',serif", lineHeight: 1.25
                }}>
                  {isLunch ? 'Edit Lunch Survey' : 'Edit Dinner Survey'}
                </div>
                <div style={{
                  fontSize: 12, color: t.textSub, marginTop: 4,
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: "'DM Sans',sans-serif", fontWeight: 600
                }}>
                  <Clock size={13} color={t.accent} />
                  Edit window {window.open} – {window.close}
                </div>
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: 12, background: t.accentGrad,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <ChevronRight size={20} color="#fff" />
              </div>
            </div>
          </button>
        )
      })()}

      {showQR && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(10px)' }} onClick={() => setShowQR(false)}>
          <div style={{ background: '#fff', padding: 32, borderRadius: 32, textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', color: '#000', fontSize: 22, fontWeight: 800, fontFamily: "'Playfair Display',serif" }}>Member ID</h3>
            <div style={{ padding: 16, background: '#fff', borderRadius: 20, border: '2px solid #f0f0f0', display: 'inline-block' }}>
               <QRCodeCanvas value={`ALMAWAID:${user.id}`} size={220} level="H" />
            </div>
            <div style={{ marginTop: 20, fontSize: 18, fontWeight: 800, color: '#000', fontFamily: "'DM Sans',sans-serif" }}>#{profileData?.thali_number}</div>
            <button onClick={() => setShowQR(false)} style={{ marginTop: 24, padding: '12px 32px', borderRadius: 16, background: '#000', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 16, fontFamily: "'DM Sans',sans-serif", width: '100%' }}>Close</button>
          </div>
        </div>
      )}



      {/* Daily Feedback Section */}
      <Card organic style={{ marginBottom: 24 }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, background: t.accentGrad, borderRadius: '50%', filter: 'blur(60px)', opacity: 0.12 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 15px ${t.accentBg}` }}><Utensils size={16} color="#fff" /></div>
          <div style={{ fontSize: 18, fontWeight: 800, color: t.accent, fontFamily: "'Playfair Display',serif" }}>Today's Menu & Feedback</div>
        </div>

        {/* Current Day Menu & Feedback combined vertically */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
          {['lunch', 'dinner'].map(meal => {
            const menuItems = weeklyMenu[todayKey]?.[meal] || []
            const menuText = menuItems.length ? menuItems.join(', ') : 'Preparation in progress...'
            const stars = meal === 'lunch' ? lunchStars : dinnerStars
            const setStars = meal === 'lunch' ? setLunchStars : setDinnerStars
            const submitted = feedbackSubmitted[meal]
            const Icon = meal === 'lunch' ? Sun : Moon

            return (
              <div key={meal} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 20, borderRadius: 20, border: `1px solid ${stars > 0 ? t.accentBorder : t.border}`, transition: 'border-color 0.3s', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05), 0 8px 20px rgba(0,0,0,0.1)' }}>
                {/* Menu Part */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: t.accent, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={14} /> {meal} Menu</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: t.textBody }}>{menuText}</div>
                </div>

                <hr style={{ border: 'none', borderTop: `1px solid ${t.border}`, margin: '0 0 16px' }} />

                {/* Rating Part */}
                <div style={{ fontSize: 11, fontWeight: 800, color: t.textSub, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans',sans-serif" }}>
                  Rate this meal
                </div>
                {submitted ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.successText, fontWeight: 600 }}><Check size={14} /> Rated!</div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      {[1, 2, 3, 4, 5].map(num => (
                        <button key={num} onClick={() => setStars(num)} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', transition: 'transform 0.2s', transform: stars >= num ? 'scale(1.15)' : 'scale(1)' }}>
                          <Star size={28} color={t.accent} fill={stars >= num ? t.accent : 'none'} strokeWidth={1.5} style={{ transition: 'fill 0.2s, color 0.2s', filter: stars >= num ? `drop-shadow(0 2px 8px ${t.accentBg})` : 'none' }} />
                        </button>
                      ))}
                    </div>
                    {stars > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: t.accent, opacity: 0.9, fontFamily: "'DM Sans',sans-serif" }}>{STAR_LABELS[stars]}</div>}
                  </div>
                )}
                {/* Separate comment field per meal */}
                <div style={{ marginTop: 16 }}>
                  <label htmlFor={`${meal}Comment`} style={{ display: 'block', fontSize: 10, fontWeight: 800, color: t.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{meal === 'lunch' ? 'Lunch' : 'Dinner'} Comment</label>
                  {submitted ? (
                    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${t.border}`, color: t.textSub, fontSize: 13, minHeight: 60, boxSizing: 'border-box', fontStyle: 'italic' }}>
                      {meal === 'lunch' ? lunchComment || '—' : dinnerComment || '—'}
                    </div>
                  ) : (
                    <textarea
                      name={`${meal}Comment`}
                      id={`${meal}Comment`}
                      value={meal === 'lunch' ? lunchComment : dinnerComment}
                      onChange={e => meal === 'lunch' ? setLunchComment(e.target.value) : setDinnerComment(e.target.value)}
                      placeholder={`Tell us how ${meal} was...`}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text, fontSize: 13, resize: 'none', outline: 'none', fontFamily: "'DM Sans',sans-serif", minHeight: 60, boxSizing: 'border-box', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {feedbackError && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(220,60,60,0.09)', border: '1px solid rgba(220,60,60,0.28)', color: '#e05555', fontSize: 13, marginBottom: 12, fontFamily: "'DM Sans',sans-serif" }}>
            {feedbackError}
          </div>
        )}

        {feedbackSubmitted.lunch && feedbackSubmitted.dinner ? (
          <div style={{ width: '100%', padding: '14px 0', textAlign: 'center', color: t.successText, fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>
            ✅ Feedback submitted for today. Shukran!
          </div>
        ) : (
          <Btn onClick={handleSubmitCombined} disabled={submittingFeedback || (!lunchStars && !dinnerStars)} style={{ width: '100%', height: 52, fontSize: 15, borderRadius: 16 }}>
            {submittingFeedback ? 'Saving...' : 'Submit Feedback'}
          </Btn>
        )}
      </Card>

      {/* Auto Daily Edit Card — auto-appears when edit window opens, saves only on Submit */}
      {showDailyEditCard && dailyEditMealInfo && (
        <DailyEditCard
          weeklyMenu={weeklyMenu}
          isOpen={showDailyEditCard}
          onClose={() => closeDailyEditCard(true)}
          onComplete={() => closeDailyEditCard(true)}
          appSettings={appSettings}
        />
      )}

    </main>
  )
}
