import React, { useState, useEffect, useRef } from 'react'
import { X, ChevronRight, Sun, Moon } from 'lucide-react'
import { supabase } from '../lib/firebaseClient'
import { useAuth } from '../admin/context'
import { useWeeklyMenu } from '../common/useWeeklyMenu'
import { getWeekDate } from '../common/utils'
import { isRotiItem, isCountInput, normalizeDishValue, denormalizeDishValue, useSurveyAutoSave } from '../hooks/useSurvey'

const THEME = {
  bg: '#0d0d1a', card: 'rgba(255,255,255,0.03)', cardActive: 'rgba(255,255,255,0.06)',
  border: 'rgba(139,92,246,0.15)', borderActive: 'rgba(139,92,246,0.4)',
  accent: '#D4AF37', accentGrad: 'linear-gradient(135deg, #D4AF37, #B8860B)',
  accentBg: 'rgba(212,175,55,0.1)', text: '#f0f0f5', textSub: 'rgba(240,240,245,0.5)',
  inputBg: 'rgba(255,255,255,0.05)', successText: '#4CAF50'
}

const getTodayKey = () => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[new Date().getDay()]
}

export default function DailySurveyModal({ onClose, appSettings = {}, day: propDay }) {
  const { user } = useAuth()
  const weeklyMenu = useWeeklyMenu() || {}
  const [step, setStep] = useState(1)
  const [lunchStatus, setLunchStatus] = useState(null)
  const [dinnerStatus, setDinnerStatus] = useState(null)
  const [rotiStatus, setRotiStatus] = useState(null)
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(false)
  const { autoSaveStatus, scheduleSave, setAutoSaveStatus } = useSurveyAutoSave()
  const saveTimerRef = useRef(null)
  const [userData, setUserData] = useState({ thali_no: '', email: user?.email })
  const [existingLoaded, setExistingLoaded] = useState(false)
  const initialLoadRef = useRef(true)

  const today = propDay || getTodayKey()
  const menu = weeklyMenu[today] || { lunch: [], dinner: [] }
  const dayKey = today.substring(0, 3).toLowerCase()

  useEffect(() => { if (loading) setAutoSaveStatus('idle') }, [loading])

  useEffect(() => {
    if (Object.keys(responses).length === 0) return
    if (loading) return
    if (initialLoadRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving')
      try {
        const currentWeekId = getWeekDate(appSettings)
        const { data: existing } = await supabase.from('survey_submissions_flat')
          .select('*').eq('user_id', user?.id).eq('week_id', currentWeekId).maybeSingle()
        const updateObj = {
          user_id: user?.id, week_id: currentWeekId,
          thali_number: userData.thali_no, email: userData.email,
          updated_at: new Date().toISOString()
        }
        if (lunchStatus !== null) {
          updateObj[`${dayKey}_l_status`] = lunchStatus ? 'Applied' : 'Skipped'
          if (lunchStatus) {
            menu.lunch.forEach((dish, idx) => {
              const col = `${dayKey}_l_dish_${idx + 1}`
              const val = responses[dish]
              if (val !== undefined) {
                updateObj[col] = denormalizeDishValue(val, dish, isCountInput(appSettings, today, 'lunch', idx))
              } else if (existing && existing[col] !== undefined && existing[col] !== null) {
                updateObj[col] = existing[col]
              }
            })
          }
        }
        if (dinnerStatus !== null) {
          updateObj[`${dayKey}_d_status`] = dinnerStatus ? 'Applied' : 'Skipped'
          if (dinnerStatus) {
            otherDinnerDishes.forEach((dish) => {
              const menuIdx = dinnerDishes.indexOf(dish)
              const col = `${dayKey}_d_dish_${menuIdx + 1}`
              const val = responses[dish]
              if (val !== undefined) {
                updateObj[col] = denormalizeDishValue(val, dish, isCountInput(appSettings, today, 'dinner', menuIdx))
              } else if (existing && existing[col] !== undefined && existing[col] !== null) {
                updateObj[col] = existing[col]
              }
            })
          }
        }
        await supabase.from('survey_submissions_flat')
          .upsert([updateObj], { onConflict: 'user_id,week_id' })
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000)
      } catch { setAutoSaveStatus('idle') }
    }, 600)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [responses, lunchStatus, dinnerStatus, dayKey, loading])

 
  // ── Auto-save responses to localStorage as draft ──
  useEffect(() => {
    if (Object.keys(responses).length === 0) return
    if (initialLoadRef?.current) return
    const timer = setTimeout(() => {
      saveDraft({ responses, updatedAt: new Date().toISOString() })
    }, 800)
    return () => clearTimeout(timer)
  }, [responses])
 useEffect(() => {
    supabase.from('user_stats').select('thali_number, email').eq('user_id', user?.id).single()
      .then(({ data }) => { if (data) setUserData({ thali_no: data.thali_number || '', email: data.email || user?.email }) })
  }, [user?.id])

  useEffect(() => {
    const loadExisting = async () => {
      const currentWeekId = getWeekDate(appSettings)
      const { data: existing } = await supabase.from('survey_submissions_flat')
        .select('*').eq('user_id', user?.id).eq('week_id', currentWeekId).maybeSingle()
      if (existing) {
        const dk = today.substring(0, 3).toLowerCase()
        const lunchVal = existing[`${dk}_l_status`]
        const dinnerVal = existing[`${dk}_d_status`]
        if (lunchVal) setLunchStatus(lunchVal === 'Applied')
        if (dinnerVal) setDinnerStatus(dinnerVal === 'Applied')
        const newResponses = {}
        ;(menu.lunch || []).forEach((dish, idx) => {
          const col = `${dk}_l_dish_${idx + 1}`
          const val = existing[col]
          if (val !== undefined && val !== null && val !== 'No') {
            if (isCountInput(appSettings, today, 'lunch', idx)) {
              newResponses[dish] = { status: 'yes', value: Number(val) }
            } else {
              newResponses[dish] = val.endsWith('%') ? parseInt(val, 10) : Number(val)
            }
          }
        })
        const allDinner = menu.dinner || []
        allDinner.forEach((dish, idx) => {
          if (isRotiItem(dish)) return
          const col = `${dk}_d_dish_${idx + 1}`
          const val = existing[col]
          if (val !== undefined && val !== null && val !== 'No') {
            if (isCountInput(appSettings, today, 'dinner', idx)) {
              newResponses[dish] = { status: 'yes', value: Number(val) }
            } else {
              newResponses[dish] = val.endsWith('%') ? parseInt(val, 10) : Number(val)
            }
          }
        })
        setResponses(newResponses)
        const rotiDish = allDinner.find(d => isRotiItem(d))
        if (rotiDish) {
          const ri = allDinner.indexOf(rotiDish)
          const rv = existing[`${dk}_d_dish_${ri + 1}`]
          if (rv) setRotiStatus(rv === 'Yes')
        }
        if (dinnerVal === 'Applied') {
          setStep(allDinner.some(d => isRotiItem(d)) ? 4 : 5)
        } else if (lunchVal === 'Applied') {
          setStep(3)
        }
      }
      setExistingLoaded(true)
      initialLoadRef.current = false
    }
    loadExisting()
  }, [user?.id, today])


  // ── Restore draft from localStorage on mount ──
  useEffect(() => {
    if (!dataLoaded) return
    const draft = loadDraft()
    if (draft && !existingData) {
      console.log('[DailySurveyModal] Draft restored from localStorage')
      if (draft.responses && Object.keys(draft.responses).length > 0) {
        setResponses(draft.responses)
      }
    }
  }, [dataLoaded])
  const dinnerDishes = menu.dinner || []
  const rotiItems = dinnerDishes.filter(d => isRotiItem(d))
  const otherDinnerDishes = dinnerDishes.filter(d => !isRotiItem(d))

  const submitSurvey = async (hasLunch, hasDinner) => {
    setLoading(true)
    try {
      const currentWeekId = getWeekDate(appSettings)
      const updateObj = {
        user_id: user?.id, week_id: currentWeekId,
        thali_number: userData.thali_no, email: userData.email,
        updated_at: new Date().toISOString()
      }
      if (hasLunch) {
        updateObj[`${dayKey}_l_status`] = 'Applied'
        menu.lunch.forEach((dish, idx) => {
          const val = responses[dish]
          if (val !== undefined) {
            updateObj[`${dayKey}_l_dish_${idx + 1}`] = denormalizeDishValue(val, dish, isCountInput(appSettings, today, 'lunch', idx))
          }
        })
      } else if (lunchStatus === false) {
        updateObj[`${dayKey}_l_status`] = 'Skipped'
      }
      if (hasDinner) {
        updateObj[`${dayKey}_d_status`] = 'Applied'
        if (rotiItems.length > 0) {
          const ri = dinnerDishes.indexOf(rotiItems[0])
          updateObj[`${dayKey}_d_dish_${ri + 1}`] = rotiStatus ? 'Yes' : 'No'
        }
        otherDinnerDishes.forEach(dish => {
          const menuIdx = dinnerDishes.indexOf(dish)
          const val = responses[dish]
          if (val !== undefined) {
            updateObj[`${dayKey}_d_dish_${menuIdx + 1}`] = denormalizeDishValue(val, dish, isCountInput(appSettings, today, 'dinner', menuIdx))
          }
        })
      } else if (dinnerStatus === false) {
        updateObj[`${dayKey}_d_status`] = 'Skipped'
      }
      await supabase.from('survey_submissions_flat')
        .upsert([updateObj], { onConflict: 'user_id,week_id' })
      try {
        await supabase.functions.invoke('sendPush', {
          body: { title: 'Daily Survey Submitted', body: 'Your daily food survey has been saved successfully.', url: '/post', target_type: 'specific', target_user_id: user?.id }
        })
        await supabase.functions.invoke('sendPush', {
          body: {
            title: '📋 Daily Survey Response',
            body: `${userData.thali_no || user?.email || 'A user'} submitted today's survey.`,
            url: '/admin/survey-tracking',
            target_type: 'admins',
          }
        })
      } catch (pushErr) {
        console.warn('[DailySurvey] Push notification skipped:', pushErr)
      }
      clearDraft(); onClose()
    } catch (err) {
      console.error('Submit error:', err)
      alert('Error saving survey: ' + err.message)
    } finally { setLoading(false) }
  }

  const handleNext = async () => {
    if (step === 1) { if (lunchStatus === null) return; setStep(lunchStatus ? 2 : 3) }
    else if (step === 2) { if (Object.keys(responses).filter(k => menu.lunch.includes(k)).length < menu.lunch.length) return; setStep(3) }
    else if (step === 3) { if (dinnerStatus === null) return; if (!dinnerStatus) await submitSurvey(lunchStatus, false); else setStep(rotiItems.length > 0 ? 4 : 5) }
    else if (step === 4) { if (rotiStatus === null) return; setStep(5) }
    else if (step === 5) {
      const dinnerDishesToCheck = otherDinnerDishes
      if (Object.keys(responses).filter(k => dinnerDishesToCheck.includes(k)).length < dinnerDishesToCheck.length) return
      await submitSurvey(lunchStatus, true)
    }
  }

  const DishSelector = ({ dish, meal }) => {
    const isRoti = isRotiItem(dish)
    const isCount = !isRoti && isCountInput(appSettings, today, meal, (meal === 'lunch' ? menu.lunch : dinnerDishes).indexOf(dish))
    const resp = responses[dish]

    if (isRoti) {
      return (
        <div style={{ marginBottom: 8, padding: '10px 14px', borderRadius: 12, background: THEME.card, border: `1px solid ${resp ? THEME.accent : THEME.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text, marginBottom: 8 }}>{dish}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['yes', 'no'].map(opt => (
              <button key={opt} onClick={() => { setResponses(prev => ({ ...prev, [dish]: opt })) }} style={{
                flex: 1, padding: '8px', borderRadius: 8,
                border: `1.5px solid ${resp === opt ? '#4CAF50' : THEME.border}`,
                background: resp === opt ? 'rgba(76,175,80,0.12)' : 'transparent',
                color: resp === opt ? '#4CAF50' : THEME.textSub, fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}>{opt === 'yes' ? '✅ Yes' : '❌ No'}</button>
            ))}
          </div>
        </div>
      )
    }
    if (isCount) {
      const val = resp?.value || 0
      return (
        <div style={{ marginBottom: 8, padding: '10px 14px', borderRadius: 12, background: THEME.card, border: `1px solid ${resp && resp.status === 'yes' ? THEME.accent : THEME.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text, marginBottom: 8 }}>{dish}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setResponses(prev => ({ ...prev, [dish]: { status: 'yes', value: Math.max(0, val - 1) } }))} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.inputBg, color: THEME.text, cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <span style={{ fontSize: 20, fontWeight: 800, color: THEME.accent, minWidth: 40, textAlign: 'center' }}>{val}</span>
            <button onClick={() => setResponses(prev => ({ ...prev, [dish]: { status: 'yes', value: Math.min(99, val + 1) } }))} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.inputBg, color: THEME.text, cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          </div>
        </div>
      )
    }
    return (
      <div style={{ marginBottom: 8, padding: '10px 14px', borderRadius: 12, background: THEME.card, border: `1px solid ${resp !== undefined ? THEME.accent : THEME.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text, marginBottom: 8 }}>{dish}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 25, 50, 75, 100].map(pct => (
            <button key={pct} onClick={() => { setResponses(prev => ({ ...prev, [dish]: pct })) }} style={{
              flex: 1, padding: '8px 4px', borderRadius: 8,
              border: `1.5px solid ${resp === pct ? THEME.accent : THEME.border}`,
              background: resp === pct ? THEME.accentBg : 'transparent',
              color: resp === pct ? THEME.accent : THEME.textSub, fontSize: 11, fontWeight: 800, cursor: 'pointer'
            }}>{pct === 0 ? '0%' : pct + '%'}</button>
          ))}
        </div>
      </div>
    )
  }

  const StepIndicator = () => {
    const steps = lunchStatus ? ['Lunch', 'Dishes', 'Dinner', rotiItems.length > 0 ? 'Roti' : null, 'Dishes'].filter(Boolean) : []
    return (
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, justifyContent: 'center' }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            padding: '6px 14px', borderRadius: 20,
            background: i + 1 === step ? THEME.accentBg : 'transparent',
            border: `1px solid ${i + 1 === step ? THEME.accent : THEME.border}`,
            color: i + 1 === step ? THEME.accent : THEME.textSub,
            fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans',sans-serif"
          }}>{s}</div>
        ))}
      </div>
    )
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div style={{ marginBottom: 16, padding: 20, borderRadius: 16, background: 'rgba(212,175,55,0.08)', border: `1px solid ${THEME.accent}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Sun size={20} color={THEME.accent} />
              <div style={{ fontSize: 18, fontWeight: 700, color: THEME.text, fontFamily: "'Playfair Display',serif" }}>Lunch Today</div>
            </div>
            <div style={{ fontSize: 14, color: THEME.textSub, marginBottom: 12 }}>Would you like lunch today? Menu: {(menu.lunch || []).join(', ') || 'Preparation in progress...'}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setLunchStatus(true)} style={{
                flex: 1, padding: '14px', borderRadius: 12, border: `1.5px solid ${lunchStatus ? '#4CAF50' : THEME.border}`,
                background: lunchStatus ? 'rgba(76,175,80,0.1)' : 'transparent', color: lunchStatus ? '#4CAF50' : THEME.textSub,
                cursor: 'pointer', fontSize: 15, fontWeight: 800
              }}>✅ Yes, I want</button>
              <button onClick={() => setLunchStatus(false)} style={{
                flex: 1, padding: '14px', borderRadius: 12, border: `1.5px solid ${lunchStatus === false ? '#F44336' : THEME.border}`,
                background: lunchStatus === false ? 'rgba(244,67,54,0.1)' : 'transparent', color: lunchStatus === false ? '#F44336' : THEME.textSub,
                cursor: 'pointer', fontSize: 15, fontWeight: 800
              }}>❌ No, I'll skip</button>
            </div>
          </div>
        )
      case 2:
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Sun size={20} color={THEME.accent} />
              <div style={{ fontSize: 18, fontWeight: 700, color: THEME.text, fontFamily: "'Playfair Display',serif" }}>Lunch Portions</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              {(menu.lunch || []).length > 0 ? (menu.lunch || []).map((dish, idx) => <DishSelector key={idx} dish={dish} meal="lunch" />)
                : <div style={{ padding: 16, textAlign: 'center', color: THEME.textSub, fontSize: 13, fontStyle: 'italic' }}>Menu being prepared...</div>}
            </div>
          </div>
        )
      case 3:
        return (
          <div style={{ marginBottom: 16, padding: 20, borderRadius: 16, background: 'rgba(212,175,55,0.08)', border: `1px solid ${THEME.accent}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Moon size={20} color={THEME.accent} />
              <div style={{ fontSize: 18, fontWeight: 700, color: THEME.text, fontFamily: "'Playfair Display',serif" }}>Dinner Today</div>
            </div>
            <div style={{ fontSize: 14, color: THEME.textSub, marginBottom: 12 }}>Would you like dinner today? Menu: {(menu.dinner || []).join(', ') || 'Preparation in progress...'}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDinnerStatus(true)} style={{
                flex: 1, padding: '14px', borderRadius: 12, border: `1.5px solid ${dinnerStatus ? '#4CAF50' : THEME.border}`,
                background: dinnerStatus ? 'rgba(76,175,80,0.1)' : 'transparent', color: dinnerStatus ? '#4CAF50' : THEME.textSub,
                cursor: 'pointer', fontSize: 15, fontWeight: 800
              }}>✅ Yes, I want</button>
              <button onClick={() => setDinnerStatus(false)} style={{
                flex: 1, padding: '14px', borderRadius: 12, border: `1.5px solid ${dinnerStatus === false ? '#F44336' : THEME.border}`,
                background: dinnerStatus === false ? 'rgba(244,67,54,0.1)' : 'transparent', color: dinnerStatus === false ? '#F44336' : THEME.textSub,
                cursor: 'pointer', fontSize: 15, fontWeight: 800
              }}>❌ No, I'll skip</button>
            </div>
          </div>
        )
      case 4:
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: THEME.text, marginBottom: 12, fontFamily: "'Playfair Display',serif" }}>Roti / Bread</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setRotiStatus(true)} style={{
                flex: 1, padding: '14px', borderRadius: 12, border: `1.5px solid ${rotiStatus ? '#4CAF50' : THEME.border}`,
                background: rotiStatus ? 'rgba(76,175,80,0.1)' : 'transparent', color: rotiStatus ? '#4CAF50' : THEME.textSub,
                cursor: 'pointer', fontSize: 15, fontWeight: 800
              }}>✅ Yes</button>
              <button onClick={() => setRotiStatus(false)} style={{
                flex: 1, padding: '14px', borderRadius: 12, border: `1.5px solid ${rotiStatus === false ? '#F44336' : THEME.border}`,
                background: rotiStatus === false ? 'rgba(244,67,54,0.1)' : 'transparent', color: rotiStatus === false ? '#F44336' : THEME.textSub,
                cursor: 'pointer', fontSize: 15, fontWeight: 800
              }}>❌ No</button>
            </div>
          </div>
        )
      case 5:
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Moon size={20} color={THEME.accent} />
              <div style={{ fontSize: 18, fontWeight: 700, color: THEME.text, fontFamily: "'Playfair Display',serif" }}>Dinner Portions</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              {otherDinnerDishes.length > 0 ? otherDinnerDishes.map((dish, idx) => <DishSelector key={idx} dish={dish} meal="dinner" />)
                : <div style={{ padding: 16, textAlign: 'center', color: THEME.textSub, fontSize: 13, fontStyle: 'italic' }}>Menu being prepared...</div>}
            </div>
          </div>
        )
    }
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
            {autoSaveStatus === 'saved' && <span style={{ fontSize: 11, color: THEME.successText }}>✓ Saved</span>}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 10, color: THEME.textSub, display: 'flex' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        <StepIndicator />
        {renderStep()}

        <button onClick={handleNext} disabled={loading} style={{
          width: '100%', padding: '14px', borderRadius: 14, border: 'none',
          background: loading ? THEME.border : THEME.accentGrad, color: '#000',
          cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8,
          fontFamily: "'DM Sans',sans-serif", boxShadow: loading ? 'none' : `0 8px 20px ${THEME.accentBg}`,
          opacity: loading ? 0.6 : 1
        }}>
          {loading ? 'Saving...' : <>
            {step >= 3 && !dinnerStatus ? 'Save & Finish' : step >= 5 ? 'Save & Finish' : 'Next'}
            <ChevronRight size={18} />
          </>}
        </button>
      </div>
    </div>
  )
}
