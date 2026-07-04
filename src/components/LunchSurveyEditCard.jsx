import React from 'react'
import { Edit2, Save, RotateCcw, AlertTriangle } from 'lucide-react'

/**
 * LunchSurveyEditCard - Direct card interface for editing lunch survey responses
 * Shows dish and response editing directly without pop-ups
 */
export default function LunchSurveyEditCard({ 
  dish, 
  response, 
  onResponseChange,
  snackDefaults = {},
  theme = 'dark'
}) {
  const themes = {
    dark: {
      card: 'rgba(74, 58, 44, 0.45)',
      accent: '#E0A03C',
      text: '#FFF8E7',
      textSub: 'rgba(255, 248, 231, 0.55)',
      border: 'rgba(224, 160, 60, 0.2)',
      inputBg: 'rgba(74, 58, 44, 0.5)',
      dangerBg: 'rgba(239, 68, 68, 0.1)',
      dangerBorder: 'rgba(239, 68, 68, 0.3)',
    },
    bright: {
      card: '#ffffff',
      accent: '#b8860b',
      text: '#2d2416',
      textSub: '#706454',
      border: '#e8ddc5',
      inputBg: '#ffffff',
      dangerBg: 'rgba(239, 68, 68, 0.1)',
      dangerBorder: 'rgba(239, 68, 68, 0.3)',
    }
  }

  const t = themes[theme] || themes.dark

  const [isEditing, setIsEditing] = React.useState(false)
  const [currentResponse, setCurrentResponse] = React.useState(response)
  const [error, setError] = React.useState('')

  // Get dish number for default values (dish_1, dish_2, etc.)
  const dishNumber = parseInt(dish.split('_')[1]) || 1
  const defaultCount = snackDefaults[`dish_${dishNumber}`] || 0
  const maxCount = defaultCount

  const handleResponseChange = (newResponse) => {
    setCurrentResponse(newResponse)
    setError('')

    // Auto-save for non-editable responses
    if (newResponse !== 'no' && newResponse !== 'yes') {
      onResponseChange(dish, newResponse)
    }
  }

  const handleYesClick = () => {
    setCurrentResponse({ status: 'yes', value: defaultCount })
    onResponseChange(dish, { status: 'yes', value: defaultCount })
  }

  const handleNoClick = () => {
    setCurrentResponse('no')
    onResponseChange(dish, 'no')
  }

  const handleCountChange = (value) => {
    const countValue = Math.max(0, parseInt(value) || 0)
    setCurrentResponse(prev => ({ 
      status: prev.status || 'yes', 
      value: countValue 
    }))
    onResponseChange(dish, { status: 'yes', value: countValue })
  }

  const isOverLimit = currentResponse.status === 'yes' && currentResponse.value > maxCount
  const showCountInput = currentResponse.status === 'yes'

  return (
    <div style={{
      background: t.card,
      borderRadius: 20,
      padding: 16,
      border: `1.5px solid ${isOverLimit ? t.dangerBorder : t.border}`,
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      transition: 'all 0.3s ease',
      position: 'relative',
      fontFamily: "'DM Sans',sans-serif",
      marginBottom: isOverLimit ? 16 : 0
    }}>
      {/* Overlimit warning */}
      {isOverLimit && (
        <div style={{
          position: 'absolute',
          top: -8,
          left: 16,
          background: t.dangerBg,
          color: '#ef4444',
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          border: `1px solid ${t.dangerBorder}`,
          zIndex: 10
        }}>
          <AlertTriangle size={12} />
          Max: {maxCount}
        </div>
      )}

      {/* Dish header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: t.accentBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: t.accent,
            fontSize: 18,
            fontWeight: 700
          }}>
            🍽️
          </div>
          <div>
            <h3 style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: t.text,
              fontFamily: "'Playfair Display', serif"
            }}>
              {dish}
            </h3>
            <div style={{
              fontSize: 11,
              color: t.textSub,
              marginTop: 2,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontFamily: "'DM Sans',sans-serif"
            }}>
              Lunch Dish
            </div>
          </div>
        </div>
        
        {isEditing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => {
                setIsEditing(false)
                setCurrentResponse(response)
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: 'transparent',
                color: t.textSub,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
            >
              <RotateCcw size={12} /> Cancel
            </button>
            <button
              onClick={() => {
                setIsEditing(false)
                if (currentResponse !== 'no') {
                  onResponseChange(dish, currentResponse)
                }
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: 'none',
                background: t.accent,
                color: '#000',
                fontSize: 11,
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                boxShadow: `0 2px 8px ${t.accentBg}`
              }}
            >
              <Save size={12} /> Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: 'transparent',
              color: t.accent,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Edit2 size={14} /> Edit
          </button>
        )}
      </div>

      {/* Response section */}
      {isEditing ? (
        <div style={{ marginTop: 16 }}>
          {/* Yes/No selection */}
          <div style={{ marginBottom: 16 }}>
            <p style={{
              fontSize: 13,
              fontWeight: 600,
              color: t.text,
              marginBottom: 8,
              fontFamily: "'DM Sans',sans-serif"
            }}>
              Did you eat this dish?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleYesClick}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 12,
                  border: `2px solid ${currentResponse.status === 'yes' ? t.accent : t.border}`,
                  background: currentResponse.status === 'yes' ? t.accentBg : t.inputBg,
                  color: currentResponse.status === 'yes' ? t.accent : t.text,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                  transition: 'all 0.2s'
                }}
              >
                ✅ Yes
              </button>
              <button
                onClick={handleNoClick}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 12,
                  border: `2px solid ${currentResponse === 'no' ? '#e05555' : t.border}`,
                  background: currentResponse === 'no' ? 'rgba(224,85,85,0.1)' : t.inputBg,
                  color: currentResponse === 'no' ? '#e05555' : t.text,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                  transition: 'all 0.2s'
                }}
              >
                ❌ No
              </button>
            </div>
          </div>

          {/* Count input (only if Yes is selected) */}
          {showCountInput && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                fontSize: 12,
                color: t.textSub,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                fontFamily: "'DM Sans',sans-serif"
              }}>
                Count:
              </span>
              <input
                type="number"
                min="0"
                max={maxCount}
                name="portionCount"
                value={currentResponse.value}
                onChange={(e) => handleCountChange(e.target.value)}
                style={{
                  width: 70,
                  padding: '10px 12px',
                  borderRadius: 9,
                  border: `1.5px solid ${isOverLimit ? t.dangerBorder : t.border}`,
                  background: t.inputBg,
                  color: t.text,
                  fontSize: 15,
                  fontWeight: 700,
                  textAlign: 'center',
                  outline: 'none',
                  fontFamily: "'DM Sans',sans-serif"
                }}
                aria-label="Portion count"
              />
              <span style={{
                fontSize: 11,
                color: isOverLimit ? '#ef4444' : t.textSub,
                fontWeight: 600,
                fontFamily: "'DM Sans',sans-serif"
              }}>
                Default: {defaultCount}
              </span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{
              marginTop: 12,
              padding: '8px 12px',
              borderRadius: 8,
              background: t.dangerBg,
              border: `1px solid ${t.dangerBorder}`,
              color: '#ef4444',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'DM Sans',sans-serif"
            }}>
              {error}
            </div>
          )}
        </div>
      ) : (
        /* View mode - show current response */
        <div style={{
          marginTop: 12,
          padding: 12,
          background: t.inputBg,
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          fontFamily: "'DM Sans',sans-serif"
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 8,
              background: t.accentBg,
              color: t.accent,
              fontSize: 12,
              fontWeight: 700
            }}>
              {typeof response === 'number' ? '🍽️' : 
               response === 'yes' ? '✅' : 
               response === 'no' ? '❌' : '📊'}
            </div>
            <div>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: t.text,
                marginBottom: 2
              }}>
                Current Selection
              </div>
              <div style={{
                fontSize: 15,
                fontWeight: 800,
                color: t.accent
              }}>
                {response === 'yes' ? '✅ Yes' : 
                 response === 'no' ? '❌ No' : 
                 typeof response === 'number' ? `${response} portions` : 
                 response === undefined ? 'Not answered' : 
                 response.status === 'yes' ? `${response.value} portions` : 
                 `${response}%`}
              </div>
              {typeof response !== 'no' && (
                <div style={{
                  fontSize: 11,
                  color: t.textSub,
                  marginTop: 2
                }}>
                  Default: {defaultCount}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}