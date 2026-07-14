import React, { useState, useEffect } from 'react'
import LunchSurveyEditCard from './LunchSurveyEditCard'
import { supabase } from '../lib/firebaseClient'
import { THEMES } from '../admin/ui'

/**
 * LunchSurveyEditor - Direct editing interface for lunch survey responses
 * Shows all lunch dishes in a card layout for easy editing
 */
export default function LunchSurveyEditor({ 
  userId,
  theme = 'dark'
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [appSettings, setAppSettings] = useState({})
  const [surveyData, setSurveyData] = useState({
    responses: {},
    userData: {},
    snackDefaults: { dish_1: 0, dish_2: 0, dish_3: 0, dish_4: 0 },
    weeklyMenu: {}
  })

  const t = THEMES[theme] || THEMES.dark

  // Load survey data
  useEffect(() => {
    loadSurveyData()
  }, [userId])

  const loadSurveyData = async () => {
    setLoading(true)
    setError('')

    try {
      const { user } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Load user data and defaults
      const { data: userData } = await supabase
        .from('user_stats')
        .select('thali_number, email, snack_defaults')
        .eq('user_id', user.id)
        .single()

      if (!userData) throw new Error('User data not found')

      // Load app settings for dish input config
      const { data: settingsData } = await supabase.from('app_settings').select('*')
      if (settingsData) {
        const settings = {}
        settingsData.forEach(row => settings[row.key] = row.value)
        setAppSettings(settings)
      }

      // Load current week's survey
      const currentWeekId = new Date().toISOString().split('T')[0]
      const { data: surveyData } = await supabase
        .from('survey_submissions_flat')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_id', currentWeekId)
        .maybeSingle()

      // Load weekly menu
      const { data: menuData } = await supabase
        .from('weekly_menu')
        .select('*')
        .order('day_name', { ascending: true })

      // Process menu data
      const weeklyMenu = {}
      if (menuData) {
        menuData.forEach(day => {
          weeklyMenu[day.day_name] = {
            lunch: day.lunch ? day.lunch.split(',').map(s => s.trim()).filter(Boolean) : [],
            dinner: day.dinner ? day.dinner.split(',').map(s => s.trim()).filter(Boolean) : []
          }
        })
      }

      // Initialize responses
      const responses = {}
      if (surveyData) {
        const today = new Date().toISOString().split('T')[0].toLowerCase().slice(0, 3)
        const mealKey = 'l'
        
        // Load existing responses
        for (let i = 1; i <= 4; i++) {
          const responseValue = surveyData[`${today}_${mealKey}_dish_${i}`]
          if (responseValue) {
            if (responseValue === 'No' || responseValue === 'No') {
              responses[`dish_${i}`] = 'no'
            } else if (!isNaN(responseValue) && responseValue !== 'Yes' && responseValue !== 'No') {
              responses[`dish_${i}`] = parseInt(responseValue) || 0
            } else if (responseValue === 'Yes') {
              responses[`dish_${i}`] = { status: 'yes', value: userData.snack_defaults?.[`dish_${i}`] || 0 }
            }
          }
        }
      }

      setSurveyData({
        responses,
        userData: {
          thali_no: userData.thali_number,
          email: userData.email
        },
        snackDefaults: userData.snack_defaults || { dish_1: 0, dish_2: 0, dish_3: 0, dish_4: 0 },
        weeklyMenu
      })

    } catch (err) {
      setError('Error loading survey data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResponseChange = async (dish, newResponse) => {
    setSurveyData(prev => ({
      ...prev,
      responses: {
        ...prev.responses,
        [dish]: newResponse
      }
    }))

    // Auto-save to database
    await saveSurveyResponse(dish, newResponse)
  }

  const saveSurveyResponse = async (dish, response) => {
    try {
      const { user } = await supabase.auth.getUser()
      const currentWeekId = new Date().toISOString().split('T')[0]
      const today = new Date().toISOString().split('T')[0].toLowerCase().slice(0, 3)
      const mealKey = 'l'
      
      // Get dish number
      const dishNumber = parseInt(dish.split('_')[1])
      const colName = `${today}_${mealKey}_dish_${dishNumber}`

      // Prepare update object
      const updateObj = {
        user_id: user.id,
        week_id: currentWeekId,
        updated_at: new Date().toISOString(),
        [`${today}_${mealKey}_status`]: 'Applied'
      }

      // Convert response to database format
      if (response === 'no') {
        updateObj[colName] = 'No'
      } else if (response.status === 'yes') {
        updateObj[colName] = String(response.value)
      } else if (typeof response === 'number') {
        updateObj[colName] = String(response)
      } else {
        updateObj[colName] = response
      }

      // Save to database
      await supabase
        .from('survey_submissions_flat')
        .upsert([updateObj], { onConflict: 'user_id,week_id' })

    } catch (err) {
      console.error('Error saving response:', err)
    }
  }

  const handleSaveAll = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { user } = await supabase.auth.getUser()
      const currentWeekId = new Date().toISOString().split('T')[0]
      const today = new Date().toISOString().split('T')[0].toLowerCase().slice(0, 3)
      const mealKey = 'l'

      // Prepare update object
      const updateObj = {
        user_id: user.id,
        week_id: currentWeekId,
        thali_number: surveyData.userData.thali_no,
        email: surveyData.userData.email,
        [`${today}_${mealKey}_status`]: 'Applied',
        updated_at: new Date().toISOString()
      }

      // Add all dish responses
      Object.entries(surveyData.responses).forEach(([dish, response]) => {
        const dishNumber = parseInt(dish.split('_')[1])
        const colName = `${today}_${mealKey}_dish_${dishNumber}`
        
        if (response === 'no') {
          updateObj[colName] = 'No'
        } else if (response.status === 'yes') {
          updateObj[colName] = String(response.value)
        } else if (typeof response === 'number') {
          updateObj[colName] = String(response)
        } else {
          updateObj[colName] = response
        }
      })

      // Save to database
      await supabase
        .from('survey_submissions_flat')
        .upsert([updateObj], { onConflict: 'user_id,week_id' })

      setSuccess('Survey responses updated successfully!')

    } catch (err) {
      setError('Error saving survey: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const getTodayLunchDishes = () => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const todayMenu = surveyData.weeklyMenu[today] || {}
    return todayMenu.lunch || []
  }

  const todayLunchDishes = getTodayLunchDishes()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        fontFamily: "'DM Sans',sans-serif"
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(255,255,255,0.3)',
          borderTopColor: t.accent,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        fontFamily: "'DM Sans',sans-serif"
      }}>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#ef4444',
          marginBottom: 16
        }}>
          Error
        </div>
        <div style={{
          fontSize: 14,
          color: t.textSub,
          marginBottom: 24
        }}>
          {error}
        </div>
        <button
          onClick={loadSurveyData}
          style={{
            padding: '12px 24px',
            borderRadius: 12,
            border: 'none',
            background: t.accent,
            color: '#000',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'DM Sans',sans-serif"
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{
      fontFamily: "'DM Sans',sans-serif"
    }}>
      {/* Header */}
      <div style={{
        marginBottom: 32,
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          color: t.text,
          marginBottom: 8,
          fontFamily: "'Playfair Display', serif"
        }}>
          Lunch Survey Editor
        </h1>
        <p style={{
          fontSize: 16,
          color: t.textSub,
          lineHeight: 1.65
        }}>
          Edit your lunch selections for today. You can choose "Yes" or "No" for each dish.
        </p>
      </div>

      {/* Success message */}
      {success && (
        <div style={{
          marginBottom: 24,
          padding: 16,
          borderRadius: 12,
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#059669',
          fontSize: 14,
          fontWeight: 600,
          textAlign: 'center'
        }}>
          {success}
        </div>
      )}

      {/* Save all button */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: 24
      }}>
        <button
          onClick={handleSaveAll}
          disabled={loading}
          style={{
            padding: '12px 24px',
            borderRadius: 12,
            border: 'none',
            background: t.accent,
            color: '#000',
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans',sans-serif",
            boxShadow: `0 4px 12px ${t.accentBg}`,
            opacity: loading ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          {loading ? (
            <>
              <div style={{
                width: 16,
                height: 16,
                border: '2px solid rgba(0,0,0,0.2)',
                borderTopColor: '#000',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Saving...
            </>
          ) : (
            'Save All Changes'
          )}
        </button>
      </div>

      {/* Today's lunch dishes */}
      <div style={{
        marginBottom: 40
      }}>
        <h2 style={{
          fontSize: 20,
          fontWeight: 700,
          color: t.text,
          marginBottom: 20,
          fontFamily: "'Playfair Display', serif"
        }}>
          Today's Lunch Menu
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 20
        }}>
          {todayLunchDishes.map((dish, index) => (
            <LunchSurveyEditCard
              key={dish}
              dish={dish}
              response={surveyData.responses[dish] || 'no'}
              onResponseChange={handleResponseChange}
              snackDefaults={surveyData.snackDefaults}
              theme={theme}
              appSettings={appSettings}
              dayName={new Date().toLocaleDateString('en-US', { weekday: 'long' })}
              meal="lunch"
              dishIndex={index}
            />
          ))}
        </div>
      </div>

      {/* Summary section */}
      <div style={{
        background: t.inputBg,
        borderRadius: 16,
        padding: 24,
        border: `1px solid ${t.border}`
      }}>
        <h3 style={{
          fontSize: 18,
          fontWeight: 700,
          color: t.text,
          marginBottom: 16,
          fontFamily: "'Playfair Display', serif"
        }}>
          Current Selection Summary
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16
        }}>
          {Object.entries(surveyData.responses).map(([dish, response]) => {
            let displayText = ''
            let statusColor = t.text
            
            if (response === 'no') {
              displayText = 'Skipped'
              statusColor = '#e05555'
            } else if (response === 'yes') {
              displayText = 'Selected'
              statusColor = t.accent
            } else if (typeof response === 'number') {
              displayText = `${response} portions`
              statusColor = t.accent
            } else if (response.status === 'yes') {
              displayText = `${response.value} portions`
              statusColor = t.accent
            } else {
              displayText = 'Unknown'
            }

            return (
              <div key={dish} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: `1px solid ${t.border}`
              }}>
                <span style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: t.text
                }}>
                  {dish}:
                </span>
                <span style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: statusColor
                }}>
                  {displayText}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Global styles */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}