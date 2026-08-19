import React, { useState, useEffect, useRef } from 'react'
import { X, ChevronRight, Sun, Moon, Check, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/firebaseClient'
import { useAuth } from '../admin/context'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { getSurveyTargetWeek } from '../common/utils'
import { isRotiItem, isCountInput, normalizeDishValue, denormalizeDishValue, useSurveyAutoSave, getPctColor, mergeDishSnapshot } from '../hooks/useSurvey'
import { getTodayKey } from '../member/constants'
import { submitSurveyRow } from '../lib/submitSurvey'
import { fetchUserSurveyRow } from '../lib/surveyRows'

const THEME = {
  bg: '#0d0d1a', card: 'rgba(255,255,255,0.03)', cardActive: 'rgba(255,255,255,0.06)',
  border: 'rgba(139,92,246,0.15)', borderActive: 'rgba(139,92,246,0.4)',
  accent: '#D4AF37', accentGrad: 'linear-gradient(135deg, #D4AF37, #B8860B)',
  accentBg: 'rgba(212,175,55,0.1)', text: '#f0f0f5', textSub: 'rgba(240,240,245,0.5)',
  inputBg: 'rgba(255,255,255,0.05)', successText: '#4CAF50',
  success: '#4CAF50', danger: '#F44336'
}

export default function DailySurveyModal({ onClose, appSettings = {}, day: propDay }) {
  const { user } = useAuth()
  const weeklyMenu = useWeeklyMenu() || {}
  const [step, setStep] = useState(1)
  const [lunchStatus, setLunchStatus] = useState(null)
  const [dinnerStatus, setDinnerStatus] = useState(null)
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(false)
  const { autoSaveStatus, scheduleSave, setAutoSaveStatus } = useSurveyAutoSave()
  const saveTimerRef = useRef(null)
  const [userData, setUserData] = useState({ thali_no: '', email: user?.email })
  const [snackDefaults, setSnackDefaults] = useState(null)
  const [existingLoaded, setExistingLoaded] = useState(false)
  const initialLoadRef = useRef(true)

  const today = propDay || getTodayKey()
  const menu = weeklyMenu[today] || { lunch: [], dinner: [] }
  const dayKey = today.substring(0, 3).toLowerCase()

  const allLunchDishes = menu.lunch || []
  const allDinnerDishes = menu.dinner || []

  // All dishes combined (lunch + dinner) with their meal type
  const allDishes = [
    ...allLunchDishes.map(d => ({ name: d, meal: 'lunch' })),
    ...allDinnerDishes.map(d => ({ name: d, meal: 'dinner' }))
  ]

  useEffect(() => { if (loading) setAutoSaveStatus('idle') }, [loading])

  // Auto-save responses to Supabase
  useEffect(() => {
    if (Object.keys(responses).length === 0) return
    if (loading) return
    if (initialLoadRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving')
      try {
        const currentWeekId = getSurveyTargetWeek(parseInt(appSettings.survey_open_hour, 10) || 20)
        const { data: existing } = await fetchUserSurveyRow(user?.id, currentWeekId)
        const updateObj = {
          user_id: user?.id, week_id: currentWeekId, day: dayKey,
          thali_number: userData.thali_no, email: userData.email || '',
          updated_at: new Date().toISOString()
        }
        updateObj.dish_snapshot = mergeDishSnapshot(
          { dish_snapshot: mergeDishSnapshot(existing, today, 'lunch', allLunchDishes) },
          today, 'dinner', allDinnerDishes
        )
        // Build lunch responses
        allLunchDishes.forEach((dish, idx) => {
          const col = `${dayKey}_l_dish_${idx + 1}`
          const val = responses[dish]
          if (val !== undefined) {
            updateObj[col] = denormalizeDishValue(val, dish, isCountInput(appSettings, today, 'lunch', idx))
          } else if (existing && existing[col] !== undefined && existing[col] !== null) {
            updateObj[col] = existing[col]
          }
        })
        // Build dinner responses
        allDinnerDishes.forEach((dish, idx) => {
          const col = `${dayKey}_d_dish_${idx + 1}`
          const val = responses[dish]
          if (val !== undefined) {
            updateObj[col] = denormalizeDishValue(val, dish, isCountInput(appSettings, today, 'dinner', idx))
          } else if (existing && existing[col] !== undefined && existing[col] !== null) {
            updateObj[col] = existing[col]
          }
        })
        const { error: autoErr } = await submitSurveyRow(updateObj)
        if (autoErr) throw autoErr
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000)
      } catch { setAutoSaveStatus('idle') }
    }, 600)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [responses, dayKey, loading])

  // Auto-save to localStorage as draft
  useEffect(() => {
    if (Object.keys(responses).length === 0) return
    if (initialLoadRef.current) return
    const currentWeekId = getSurveyTargetWeek(parseInt(appSettings.survey_open_hour, 10) || 20)
    const draftKey = `survey_draft_${currentWeekId}_${user?.id}`
    const timer = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify({ responses, updatedAt: new Date().toISOString() })) } catch {}
    }, 800)
    return () => clearTimeout(timer)
  }, [responses])

  // Load user data
  useEffect(() => {
    supabase.from('user_stats').select('thali_number, email, snack_defaults').eq('user_id', user?.id).single()
      .then(({ data }) => { if (data) { setUserData({ thali_no: data.thali_number || '', email: data.email || user?.email }); setSnackDefaults(data.snack_defaults || null) } })
  }, [user?.id])

  // Load existing submission
  useEffect(() => {
    const loadExisting = async () => {
      const currentWeekId = getSurveyTargetWeek(parseInt(appSettings.survey_open_hour, 10) || 20)
      const { data: existing } = await fetchUserSurveyRow(user?.id, currentWeekId)
      if (existing) {
        const dk = today.substring(0, 3).toLowerCase()
        const lunchVal = existing[`${dk}_l_status`]
        const dinnerVal = existing[`${dk}_d_status`]
        if (lunchVal) setLunchStatus(lunchVal === 'Applied')
        if (dinnerVal) setDinnerStatus(dinnerVal === 'Applied')
        const newResponses = {}
        allLunchDishes.forEach((dish, idx) => {
          const col = `${dk}_l_dish_${idx + 1}`
          const val = existing[col]
          if (val !== undefined && val !== null && val !== 'No') {
            newResponses[dish] = normalizeDishValue(val, dish, isCountInput(appSettings, today, 'lunch', idx))
          }
        })
        allDinnerDishes.forEach((dish, idx) => {
          const col = `${dk}_d_dish_${idx + 1}`
          const val = existing[col]
          if (val !== undefined && val !== null && val !== 'No') {
            newResponses[dish] = normalizeDishValue(val, dish, isCountInput(appSettings, today, 'dinner', idx))
          }
        })
        setResponses(newResponses)
      }
      setExistingLoaded(true)
      initialLoadRef.current = false
    }
    loadExisting()
  }, [user?.id, today])

  const submitSurvey = async () => {
    setLoading(true)
    try {
      const currentWeekId = getSurveyTargetWeek(parseInt(appSettings.survey_open_hour, 10) || 20)
      const updateObj = {
        user_id: user?.id, week_id: currentWeekId, day: dayKey,
        thali_number: userData.thali_no, email: userData.email || '',
        updated_at: new Date().toISOString()
      }
      updateObj.dish_snapshot = mergeDishSnapshot(
        { dish_snapshot: mergeDishSnapshot(null, today, 'lunch', allLunchDishes) },
        today, 'dinner', allDinnerDishes
      )
      // Set lunch status and responses
      if (lunchStatus) {
        updateObj[`${dayKey}_l_status`] = 'Applied'
        allLunchDishes.forEach((dish, idx) => {
          const val = responses[dish]
          if (val !== undefined) {
            updateObj[`${dayKey}_l_dish_${idx + 1}`] = denormalizeDishValue(val, dish, isCountInput(appSettings, today, 'lunch', idx))
          }
        })
      } else if (lunchStatus === false) {
        updateObj[`${dayKey}_l_status`] = 'Skipped'
      }
      // Set dinner status and responses
      if (dinnerStatus) {
        updateObj[`${dayKey}_d_status`] = 'Applied'
        allDinnerDishes.forEach((dish, idx) => {
          const val = responses[dish]
          if (val !== undefined) {
            updateObj[`${dayKey}_d_dish_${idx + 1}`] = denormalizeDishValue(val, dish, isCountInput(appSettings, today, 'dinner', idx))
          }
        })
      } else if (dinnerStatus === false) {
        updateObj[`${dayKey}_d_status`] = 'Skipped'
      }
      const { error: submitErr } = await submitSurveyRow(updateObj)
      if (submitErr) throw submitErr
      try {
        await supabase.functions.invoke('send-push', {
          body: {
            title: 'Al-Mawaid · Preference saved',
            body: 'Your meal choices for today are locked in. Shukran — see you at thali.',
            url: '/post',
            target_type: 'specific',
            user_id: user?.id,
          }
        })
        await supabase.functions.invoke('send-push', {
          body: {
            title: 'Al-Mawaid · Daily response',
            body: `Thali ${userData.thali_no || '—'} updated today's meal preferences.`,
            url: '/admin/survey-tracking',
            target_type: 'admins',
          }
        })
      } catch (pushErr) {
        console.warn('[DailySurvey] Push notification skipped:', pushErr)
      }
      onClose()
    } catch (err) {
      console.error('Submit error:', err)
      alert('Error saving survey: ' + err.message)
    } finally { setLoading(false) }
  }

  // When user selects "Yes" for a meal, show dishes — non-count default to yes, count dishes start unselected
  const handleMealYes = (meal) => {
    const dishes = meal === 'lunch' ? allLunchDishes : allDinnerDishes
    const newResponses = { ...responses }
    dishes.forEach((dish, idx) => {
      if (newResponses[dish] === undefined || newResponses[dish] === null) {
        if (isCountInput(appSettings, today, meal, idx)) {
          // Count dishes: start as "no" so user sees yes/no toggle first
          newResponses[dish] = 'no'
        } else {
          newResponses[dish] = 'yes'
        }
      }
    })
    setResponses(newResponses)
  }

  // Toggle a single dish between yes/no
  const toggleDish = (dish) => {
    const current = responses[dish]
    if (current === 'yes' || current === 'no') {
      setResponses(prev => ({ ...prev, [dish]: current === 'yes' ? 'no' : 'yes' }))
    } else if (current && current.status === 'yes') {
      // Count dish: toggle to no
      setResponses(prev => ({ ...prev, [dish]: 'no' }))
    } else if (current !== undefined && current !== null) {
      setResponses(prev => ({ ...prev, [dish]: 'no' }))
    }
  }

  // Select all dishes as "yes"
  const selectAllDishes = () => {
    const newResponses = { ...responses }
    allDishes.forEach(({ name, meal }) => {
      const mealIdx = meal === 'lunch'
        ? allLunchDishes.indexOf(name)
        : allDinnerDishes.indexOf(name)
      if (isCountInput(appSettings, today, meal, mealIdx)) {
        newResponses[name] = { status: 'yes', value: Math.min(snackDefaults?.[`dish_${mealIdx + 1}`] ?? 1, 1) }
      } else {
        newResponses[name] = 'yes'
      }
    })
    setResponses(newResponses)
  }

  // Unselect all dishes (set to "no")
  const unselectAllDishes = () => {
    const newResponses = { ...responses }
    allDishes.forEach(({ name }) => {
      newResponses[name] = 'no'
    })
    setResponses(newResponses)
  }

  const handleNext = async () => {
    if (step === 1) {
      // Lunch yes/no selected
      if (lunchStatus === null) return
      if (lunchStatus) {
        // Auto-select all lunch dishes as "yes" and move to dinner
        handleMealYes('lunch')
      }
      setStep(2)
    } else if (step === 2) {
      // Dinner yes/no
      if (dinnerStatus === null) return
      if (dinnerStatus) {
        handleMealYes('dinner')
      }
      // Submit everything
      await submitSurvey()
    }
  }

  const lunchCount = allLunchDishes.filter(d => {
    const v = responses[d]
    return v === 'yes' || (typeof v === 'number' && v > 0) || (v && v.status === 'yes')
  }).length
  const dinnerCount = allDinnerDishes.filter(d => {
    const v = responses[d]
    return v === 'yes' || (typeof v === 'number' && v > 0) || (v && v.status === 'yes')
  }).length

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div>
            {/* Lunch Yes/No */}
            <div style={{ marginBottom: 16, padding: 20, borderRadius: 16, background: 'rgba(212,175,55,0.08)', border: `1px solid ${THEME.accent}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Sun size={20} color={THEME.accent} />
                <div style={{ fontSize: 18, fontWeight: 700, color: THEME.text, fontFamily: "'Playfair Display',serif" }}>Lunch Today</div>
              </div>
              <div style={{ fontSize: 14, color: THEME.textSub, marginBottom: 12 }}>
                Would you like lunch today? Menu: {allLunchDishes.join(', ') || 'Preparation in progress...'}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { setLunchStatus(true); handleMealYes('lunch') }} style={{
                  flex: 1, padding: '14px', borderRadius: 12, border: `1.5px solid ${lunchStatus ? '#4CAF50' : THEME.border}`,
                  background: lunchStatus ? 'rgba(76,175,80,0.1)' : 'transparent', color: lunchStatus ? '#4CAF50' : THEME.textSub,
                  cursor: 'pointer', fontSize: 15, fontWeight: 800
                }}>Yes, I want</button>
                <button onClick={() => setLunchStatus(false)} style={{
                  flex: 1, padding: '14px', borderRadius: 12, border: `1.5px solid ${lunchStatus === false ? '#F44336' : THEME.border}`,
                  background: lunchStatus === false ? 'rgba(244,67,54,0.1)' : 'transparent', color: lunchStatus === false ? '#F44336' : THEME.textSub,
                  cursor: 'pointer', fontSize: 15, fontWeight: 800
                }}>No, I'll skip</button>
              </div>
            </div>

            {/* Show all lunch dishes with yes/no toggle when "Yes" is selected */}
            {lunchStatus === true && allLunchDishes.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: THEME.accent }}>
                    Select your dishes ({lunchCount}/{allLunchDishes.length})
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={selectAllDishes} style={{
                      padding: '6px 12px', borderRadius: 8, border: `1px solid ${THEME.accent}`,
                      background: THEME.accentBg, color: THEME.accent, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                    }}>Select All</button>
                    <button onClick={unselectAllDishes} style={{
                      padding: '6px 12px', borderRadius: 8, border: `1px solid ${THEME.border}`,
                      background: 'transparent', color: THEME.textSub, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                    }}>Clear All</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {allLunchDishes.map((dish, idx) => (
                    <DishToggle key={idx} dish={dish} meal="lunch" idx={idx} responses={responses} toggleDish={toggleDish} setResponses={setResponses} appSettings={appSettings} today={today} maxCount={snackDefaults?.[`dish_${idx + 1}`] ?? null} />
                  ))}
                </div>
              </div>
            )}

            {/* Show all dinner dishes with yes/no toggle when dinner is also selected */}
            {lunchStatus === true && dinnerStatus === true && allDinnerDishes.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: THEME.accent }}>
                    Dinner dishes ({dinnerCount}/{allDinnerDishes.length})
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {allDinnerDishes.map((dish, idx) => (
                    <DishToggle key={idx} dish={dish} meal="dinner" idx={idx} responses={responses} toggleDish={toggleDish} setResponses={setResponses} appSettings={appSettings} today={today} maxCount={snackDefaults?.[`dish_${idx + 1}`] ?? null} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      case 2:
        return (
          <div>
            {/* Dinner Yes/No */}
            <div style={{ marginBottom: 16, padding: 20, borderRadius: 16, background: 'rgba(212,175,55,0.08)', border: `1px solid ${THEME.accent}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Moon size={20} color={THEME.accent} />
                <div style={{ fontSize: 18, fontWeight: 700, color: THEME.text, fontFamily: "'Playfair Display',serif" }}>Dinner Today</div>
              </div>
              <div style={{ fontSize: 14, color: THEME.textSub, marginBottom: 12 }}>
                Would you like dinner today? Menu: {allDinnerDishes.join(', ') || 'Preparation in progress...'}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { setDinnerStatus(true); handleMealYes('dinner') }} style={{
                  flex: 1, padding: '14px', borderRadius: 12, border: `1.5px solid ${dinnerStatus ? '#4CAF50' : THEME.border}`,
                  background: dinnerStatus ? 'rgba(76,175,80,0.1)' : 'transparent', color: dinnerStatus ? '#4CAF50' : THEME.textSub,
                  cursor: 'pointer', fontSize: 15, fontWeight: 800
                }}>Yes, I want</button>
                <button onClick={() => setDinnerStatus(false)} style={{
                  flex: 1, padding: '14px', borderRadius: 12, border: `1.5px solid ${dinnerStatus === false ? '#F44336' : THEME.border}`,
                  background: dinnerStatus === false ? 'rgba(244,67,54,0.1)' : 'transparent', color: dinnerStatus === false ? '#F44336' : THEME.textSub,
                  cursor: 'pointer', fontSize: 15, fontWeight: 800
                }}>No, I'll skip</button>
              </div>
            </div>

            {/* Show all dinner dishes with yes/no toggle when "Yes" is selected */}
            {dinnerStatus === true && allDinnerDishes.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: THEME.accent }}>
                    Select your dishes ({dinnerCount}/{allDinnerDishes.length})
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => {
                      const newResp = { ...responses }
                      allDinnerDishes.forEach((d, idx) => {
                        if (isCountInput(appSettings, today, 'dinner', idx)) {
                          newResp[d] = { status: 'yes', value: 1 }
                        } else {
                          newResp[d] = 'yes'
                        }
                      })
                      setResponses(newResp)
                    }} style={{
                      padding: '6px 12px', borderRadius: 8, border: `1px solid ${THEME.accent}`,
                      background: THEME.accentBg, color: THEME.accent, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                    }}>Select All</button>
                    <button onClick={() => {
                      const newResp = { ...responses }
                      allDinnerDishes.forEach(d => { newResp[d] = 'no' })
                      setResponses(newResp)
                    }} style={{
                      padding: '6px 12px', borderRadius: 8, border: `1px solid ${THEME.border}`,
                      background: 'transparent', color: THEME.textSub, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                    }}>Clear All</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {allDinnerDishes.map((dish, idx) => (
                    <DishToggle key={idx} dish={dish} meal="dinner" idx={idx} responses={responses} toggleDish={toggleDish} setResponses={setResponses} appSettings={appSettings} today={today} maxCount={snackDefaults?.[`dish_${idx + 1}`] ?? null} />
                  ))}
                </div>
              </div>
            )}


          </div>
        )
    }
  }

  const getButtonText = () => {
    if (step === 1) {
      if (lunchStatus === null) return 'Next'
      if (lunchStatus) return `Next — Dinner (${allLunchDishes.length} lunch dishes)`
      return 'Next — Dinner'
    }
    return 'Save & Finish'
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', padding: 'clamp(12px, 3vw, 24px)', backdropFilter: 'blur(15px)', overflowY: 'auto'
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: THEME.card, borderRadius: 32, padding: 'clamp(20px, 5vw, 32px)',
        maxWidth: 550, width: '100%', border: `1.5px solid ${THEME.borderActive}`,
        boxShadow: '0 40px 100px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, background: THEME.accentGrad, borderRadius: '50%', filter: 'blur(60px)', opacity: 0.08 }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: THEME.accent, fontFamily: "'DM Sans',sans-serif", marginBottom: 4 }}>Daily Meal</div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: THEME.text, fontFamily: "'Playfair Display',serif" }}>{today.charAt(0).toUpperCase() + today.slice(1)}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {autoSaveStatus === 'saving' && <span style={{ fontSize: 11, color: THEME.textSub }}>Saving...</span>}
            {autoSaveStatus === 'saved' && <span style={{ fontSize: 11, color: THEME.successText }}>Saved</span>}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 10, color: THEME.textSub, display: 'flex' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, justifyContent: 'center' }}>
          {['Lunch', 'Dinner'].map((s, i) => (
            <div key={i} style={{
              padding: '6px 14px', borderRadius: 20,
              background: i + 1 === step ? THEME.accentBg : 'transparent',
              border: `1px solid ${i + 1 === step ? THEME.accent : THEME.border}`,
              color: i + 1 === step ? THEME.accent : THEME.textSub,
              fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              {s}
              {i === 0 && lunchStatus !== null && <Check size={12} />}
              {i === 1 && dinnerStatus !== null && <Check size={12} />}
            </div>
          ))}
        </div>

        {renderStep()}

        <button onClick={handleNext} disabled={loading || (step === 1 && lunchStatus === null) || (step === 2 && dinnerStatus === null)} style={{
          width: '100%', padding: '14px', borderRadius: 14, border: 'none',
          background: loading ? THEME.border : THEME.accentGrad, color: '#000',
          cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8,
          fontFamily: "'DM Sans',sans-serif", boxShadow: loading ? 'none' : `0 8px 20px ${THEME.accentBg}`,
          opacity: (loading || (step === 1 && lunchStatus === null) || (step === 2 && dinnerStatus === null)) ? 0.6 : 1
        }}>
          {loading ? 'Saving...' : <>
            {getButtonText()}
            <ChevronRight size={18} />
          </>}
        </button>
      </div>
    </div>
  )
}

// Individual dish toggle component with yes/no + count support
function DishToggle({ dish, meal, idx, responses, toggleDish, setResponses, appSettings, today, maxCount = null }) {
  const val = responses[dish]
  const isCount = isCountInput(appSettings, today, meal, idx)
  const isRoti = isRotiItem(dish)

  // Determine the yes/no state
  let isYes = false
  if (isCount) {
    // Count: { status: 'yes', value: N } or 'yes' means yes, 'no' or undefined means no
    isYes = (val && val.status === 'yes') || val === 'yes'
  } else {
    // Percentage or roti: 'yes' or numeric > 0 means yes
    isYes = val === 'yes' || (typeof val === 'number' && val > 0) || val === undefined || val === null
  }

  // Count value for display
  const countValue = isCount && isYes ? (val?.value || 1) : 0

  const handleYes = (e) => {
    e.stopPropagation()
    if (isCount) {
      setResponses(prev => ({ ...prev, [dish]: { status: 'yes', value: Math.min(maxCount ?? 99, prev[dish]?.value || 1) } }))
    } else if (isRoti) {
      setResponses(prev => ({ ...prev, [dish]: 'yes' }))
    } else {
      setResponses(prev => ({ ...prev, [dish]: 100 }))
    }
  }

  const handleNo = (e) => {
    e.stopPropagation()
    if (isCount) {
      setResponses(prev => ({ ...prev, [dish]: 'no' }))
    } else if (isRoti) {
      setResponses(prev => ({ ...prev, [dish]: 'no' }))
    } else {
      setResponses(prev => ({ ...prev, [dish]: 0 }))
    }
  }

  const handleCountChange = (e, delta) => {
    e.stopPropagation()
    const newVal = Math.max(1, Math.min(maxCount ?? 99, countValue + delta))
    setResponses(prev => ({ ...prev, [dish]: { status: 'yes', value: newVal } }))
  }

  const handleCountInput = (e, val) => {
    e.stopPropagation()
    const num = parseInt(val) || 0
    setResponses(prev => ({ ...prev, [dish]: { status: 'yes', value: Math.max(1, Math.min(maxCount ?? 99, num)) } }))
  }

  return (
    <div style={{
      padding: '12px 14px', borderRadius: 12,
      background: isYes ? 'rgba(76,175,80,0.08)' : 'rgba(244,67,54,0.05)',
      border: `1.5px solid ${isYes ? '#4CAF50' : '#F4433640'}`,
      transition: 'all 0.2s'
    }}>
      {/* Dish name */}
      <div style={{ marginBottom: 8 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: isYes ? THEME.text : 'rgba(240,240,245,0.4)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>{dish}</div>
        <div style={{
          fontSize: 10, fontWeight: 500, color: THEME.textSub, marginTop: 2, textTransform: 'uppercase'
        }}>{meal}</div>
      </div>

      {/* Yes / No buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={handleYes} style={{
          flex: 1, padding: '8px 0', borderRadius: 8,
          border: `1.5px solid ${isYes ? '#4CAF50' : THEME.border}`,
          background: isYes ? 'rgba(76,175,80,0.12)' : 'transparent',
          color: isYes ? '#4CAF50' : THEME.textSub,
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
        }}>
          <Check size={12} /> Yes
        </button>
        <button onClick={handleNo} style={{
          flex: 1, padding: '8px 0', borderRadius: 8,
          border: `1.5px solid ${!isYes ? '#F44336' : THEME.border}`,
          background: !isYes ? 'rgba(244,67,54,0.1)' : 'transparent',
          color: !isYes ? '#F44336' : THEME.textSub,
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
        }}>
          ✕ No
        </button>
      </div>

      {/* Count input row: only visible when count dish is "yes" */}
      {isCount && isYes && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            marginTop: 10, padding: '8px 0', borderTop: `1px solid rgba(76,175,80,0.15)`
          }}
        >
          <button onClick={(e) => handleCountChange(e, -1)} style={{
            width: 40, height: 40, borderRadius: 10,
            border: `1px solid ${THEME.border}`, background: THEME.inputBg,
            color: THEME.text, cursor: 'pointer', fontSize: 20, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent'
          }}>−</button>
          <input
            name={`${dayKey}-dish-count-${idx}`}
            type="number"
            min={1}
            max={maxCount ?? 99}
            value={countValue}
            onChange={(e) => handleCountInput(e, e.target.value)}
            style={{
              width: 52, height: 40, borderRadius: 10,
              border: `1px solid ${THEME.accent}`, background: THEME.inputBg,
              color: THEME.accent, fontSize: 20, fontWeight: 800,
              textAlign: 'center', outline: 'none', fontFamily: 'inherit',
              MozAppearance: 'textfield',
              WebkitAppearance: 'textfield'
            }}
          />
          <button onClick={(e) => handleCountChange(e, 1)} style={{
            width: 40, height: 40, borderRadius: 10,
            border: `1px solid ${THEME.border}`, background: THEME.inputBg,
            color: (maxCount != null && countValue >= maxCount) ? THEME.textSub : THEME.text,
            cursor: (maxCount != null && countValue >= maxCount) ? 'not-allowed' : 'pointer',
            fontSize: 20, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: (maxCount != null && countValue >= maxCount) ? 0.4 : 1,
            touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent'
          }}>+</button>
          <span style={{ fontSize: 10, fontWeight: 600, color: THEME.textSub, marginLeft: 4 }}>person{countValue === 1 ? '' : 's'}</span>
          {maxCount != null && <span style={{ fontSize: 9, fontWeight: 700, color: THEME.textSub, background: THEME.cardActive, padding: '2px 6px', borderRadius: 6 }}>Max {maxCount}</span>}
        </div>
      )}
    </div>
  )
}
