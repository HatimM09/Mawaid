import React, { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import SurveyEditCard from './SurveyEditCard'
import { supabase } from '../lib/firebaseClient'
import { THEMES } from '../admin/ui'

/**
 * SurveyEditModal - Modal for editing survey responses
 * Shows a grid of SurveyEditCard components for each dish
 * Handles the editing and saving of survey responses
 */
export default function SurveyEditModal({ 
  isOpen, 
  onClose, 
  initialData = {},
  onSave,
  theme = 'dark'
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingResponses, setEditingResponses] = useState(initialData)
  const [appSettings, setAppSettings] = useState({})

  // Load app settings
  useEffect(() => {
    const loadAppSettings = async () => {
      const { data } = await supabase.from('app_settings').select('*')
      if (data) {
        const settings = {}
        data.forEach(row => settings[row.key] = row.value)
        setAppSettings(settings)
      }
    }
    loadAppSettings()
  }, [])

  // Load user data and snack defaults
  useEffect(() => {
    const loadUserData = async () => {
      const { user } = await supabase.auth.getUser()
      if (user) {
        const { data: u } = await supabase.from('user_stats')
          .select('thali_number, email, snack_defaults')
          .eq('user_id', user.id)
          .single()
        
        if (u) {
          setEditingResponses(prev => ({
            ...prev,
            userData: { thali_no: u.thali_number || '', email: u.email || user.email },
            snackDefaults: u.snack_defaults || { dish_1: 0, dish_2: 0, dish_3: 0, dish_4: 0 }
          }))
        }
      }
    }
    
    if (isOpen) {
      loadUserData()
    }
  }, [isOpen])

  const handleSaveResponse = async (dish, newResponse) => {
    setEditingResponses(prev => ({
      ...prev,
      responses: {
        ...prev.responses,
        [dish]: newResponse
      }
    }))
  }

  const handleSaveAll = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { user } = await supabase.auth.getUser()
      const currentWeekId = new Date().toISOString().split('T')[0] // Get current week
      
      // Prepare update object
      const updateObj = {
        user_id: user.id,
        week_id: currentWeekId,
        thali_number: editingResponses.userData.thali_no,
        email: editingResponses.userData.email,
        updated_at: new Date().toISOString()
      }

      // Add status and responses for current meal
      const dayKey = new Date().toISOString().split('T')[0].toLowerCase().slice(0, 3)
      const mealKey = 'l' // Assuming lunch for now
      updateObj[`${dayKey}_${mealKey}_status`] = 'Applied'

      // Add dish responses
      Object.entries(editingResponses.responses).forEach(([dish, response]) => {
        const dishIndex = parseInt(dish.split('_')[1]) - 1 // Convert dish_1 to index 0
        const colName = `${dayKey}_${mealKey}_dish_${dishIndex + 1}`
        
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
      const { error: upsertError } = await supabase
        .from('survey_submissions_flat')
        .upsert([updateObj], { onConflict: 'user_id,week_id' })

      if (upsertError) throw upsertError

      // Call onSave callback if provided
      if (onSave) {
        onSave(editingResponses.responses)
      }

      setSuccess('Survey responses updated successfully!')
      setTimeout(() => {
        onClose()
        setSuccess('')
      }, 2000)

    } catch (err) {
      setError('Error saving survey: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const getDishesFromData = () => {
    const responses = editingResponses.responses || {}
    const dishes = Object.keys(responses).filter(key => 
      key.startsWith('dish_') || typeof responses[key] !== 'object'
    )
    
    // Also get dishes from the menu (fallback)
    const menu = editingResponses.menu || {}
    const lunchDishes = menu.lunch || []
    
    // Combine and deduplicate
    const allDishes = [...new Set([...dishes, ...lunchDishes])]
    return allDishes.filter(dish => dish) // Remove empty strings
  }

  if (!isOpen) return null

  const t = THEMES[theme] || THEMES.dark
  const dishes = getDishesFromData()

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)',
      padding: 'clamp(20px, 4vw, 40px)',
      backdropFilter: 'blur(15px)',
      fontFamily: "'DM Sans',sans-serif"
    }} onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()} 
        style={{
          background: t.card,
          borderRadius: 32,
          padding: 'clamp(24px, 5vw, 40px)',
          maxWidth: 800,
          width: '100%',
          border: `1.5px solid ${t.borderActive}`,
          boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
          maxHeight: '90vh',
          overflowY: 'auto',
          paddingBottom: 40
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              color: t.accent,
              fontFamily: "'Playfair Display', serif"
            }}>
              Edit Survey Responses
            </h2>
            <p style={{
              margin: 8 0 0 0,
              fontSize: 14,
              color: t.textSub,
              fontFamily: "'DM Sans',sans-serif'"
            }}>
              Update your selections for lunch dishes
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              borderRadius: 12,
              color: t.textSub,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Error/Success messages */}
        {error && (
          <div style={{
            marginBottom: 20,
            padding: 16,
            borderRadius: 12,
            background: 'rgba(239, 68, 68, 0.1)',
            border: `1px solid rgba(239, 68, 68, 0.3)`,
            color: '#ef4444',
            fontSize: 14,
            fontWeight: 600
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            marginBottom: 20,
            padding: 16,
            borderRadius: 12,
            background: 'rgba(16, 185, 129, 0.1)',
            border: `1px solid rgba(16, 185, 129, 0.3)`,
            color: '#059669',
            fontSize: 14,
            fontWeight: 600
          }}>
            {success}
          </div>
        )}

        {/* Dishes grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: 20,
          marginBottom: 24 
        }}>
          {dishes.map((dish, index) => (
            <SurveyEditCard
              key={dish}
              dish={dish}
              response={editingResponses.responses?.[dish] || 'no'}
              onEdit={(dishName) => {
                // Handle edit locally - the card manages its own state
                console.log('Editing dish:', dishName)
              }}
              onSave={handleSaveResponse}
              onCancel={(dishName) => {
                // Reset to initial response
                setEditingResponses(prev => ({
                  ...prev,
                  responses: {
                    ...prev.responses,
                    [dishName]: initialData.responses?.[dishName] || 'no'
                  }
                }))
              }}
              theme={theme}
              appSettings={appSettings}
              dayName={editingResponses.dayName || ''}
              meal={editingResponses.meal || 'lunch'}
              dishIndex={index}
            />
          ))}
        </div>

        {/* Summary */}
        <div style={{
          background: t.inputBg,
          borderRadius: 16,
          padding: 16,
          border: `1px solid ${t.border}`,
          marginBottom: 24
        }}>
          <h3 style={{
            margin: 0 0 12 0,
            fontSize: 16,
            fontWeight: 700,
            color: t.text,
            fontFamily: "'Playfair Display', serif"
          }}>
            Summary
          </h3>
          <div style={{
            fontSize: 14,
            color: t.textSub,
            fontFamily: "'DM Sans',sans-serif'"
          }}>
            {Object.entries(editingResponses.responses || {}).map(([dish, response]) => {
              let displayText = ''
              if (response === 'no') displayText = 'Skipped'
              else if (response === 'yes') displayText = 'Selected'
              else if (typeof response === 'number') displayText = `${response} portions`
              else if (response.status === 'yes') displayText = `${response.value} portions`
              else if (typeof response === 'string') displayText = response
              else displayText = 'Unknown'

              return (
                <div key={dish} style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{dish}:</span> {displayText}
                </div>
              )
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              border: `1px solid ${t.border}`,
              background: 'transparent',
              color: t.textSub,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'DM Sans',sans-serif'"
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            disabled={loading}
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              border: 'none',
              background: t.accentGrad || t.accent,
              color: '#000',
              fontSize: 14,
              fontWeight: 900,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans',sans-serif'",
              boxShadow: `0 8px 20px ${t.accentBg || 'rgba(224, 160, 60, 0.2)'}`,
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
              <>
                <Save size={16} /> Save All Changes
              </>
            )}
          </button>
        </div>

        {/* Loading spinner */}
        {loading && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001
          }}>
            <div style={{
              width: 40,
              height: 40,
              border: '3px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
        )}
      </div>

      {/* Add CSS for animation */}
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}