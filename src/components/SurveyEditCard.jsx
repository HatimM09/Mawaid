import React from 'react'
import { X, Edit2, Save, RotateCcw } from 'lucide-react'

/**
 * SurveyEditCard - A card component for editing survey responses
 * Shows dish name and selected response below it
 * Allows editing responses for lunch dishes
 */
export default function SurveyEditCard({ 
  dish, 
  response, 
  onEdit, 
  onSave, 
  onCancel,
  className = '',
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
      successBg: 'rgba(16, 185, 129, 0.1)',
    },
    bright: {
      card: '#ffffff',
      accent: '#b8860b',
      text: '#2d2416',
      textSub: '#706454',
      border: '#e8ddc5',
      inputBg: '#ffffff',
      successBg: '#ecfdf5',
    }
  }

  const t = themes[theme] || themes.dark

  const [isEditing, setIsEditing] = React.useState(false)
  const [currentResponse, setCurrentResponse] = React.useState(response)
  const [error, setError] = React.useState('')

  const handleEdit = () => {
    if (onEdit) onEdit(dish)
    setIsEditing(true)
    setCurrentResponse(response)
    setError('')
  }

  const handleSave = () => {
    // Validation
    if (currentResponse === undefined) {
      setError('Please select a response')
      return
    }
    
    if (onSave) {
      onSave(dish, currentResponse)
    }
    setIsEditing(false)
    setError('')
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel(dish)
    }
    setIsEditing(false)
    setCurrentResponse(response)
    setError('')
  }

  const renderResponse = () => {
    if (isEditing) {
      // Show edit interface
      return (
        <div style={{ marginTop: 16 }}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 12,
            marginBottom: error ? 12 : 0 
          }}>
            {/* Yes/No buttons for count inputs (dish1-dish3) */}
            {typeof response === 'number' && (
              <>
                <p style={{ 
                  fontSize: 14, 
                  color: t.textSub, 
                  marginBottom: 4,
                  fontFamily: "'DM Sans',sans-serif"
                }}>
                  Did you eat this dish?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setCurrentResponse({ status: 'yes', value: 0 })}
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
                      fontFamily: "'DM Sans',sans-serif"
                    }}
                  >
                    ✅ Yes
                  </button>
                  <button
                    onClick={() => setCurrentResponse({ status: 'no', value: 0 })}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: 12,
                      border: `2px solid ${currentResponse.status === 'no' ? '#e05555' : t.border}`,
                      background: currentResponse.status === 'no' ? 'rgba(224,85,85,0.1)' : t.inputBg,
                      color: currentResponse.status === 'no' ? '#e05555' : t.text,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: "'DM Sans',sans-serif"
                    }}
                  >
                    ❌ No
                  </button>
                </div>
              </>
            )}

            {/* Count input for when user selects "Yes" */}
            {currentResponse.status === 'yes' && (
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
                  name="portionCount"
                  value={currentResponse.value}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0
                    setCurrentResponse(prev => ({ ...prev, value: val }))
                  }}
                  style={{
                    width: 80,
                    padding: '10px 12px',
                    borderRadius: 9,
                    border: `1.5px solid ${t.border}`,
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
              </div>
            )}

            {/* Percentage buttons for non-count inputs */}
            {currentResponse.status === undefined && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[0, 25, 50, 100].map(pct => (
                  <button
                    key={pct}
                    onClick={() => setCurrentResponse({ status: 'percentage', value: pct })}
                    style={{
                      padding: '16px 8px',
                      borderRadius: 14,
                      border: `2px solid ${currentResponse.value === pct ? t.accent : t.border}`,
                      background: currentResponse.value === pct ? t.accentBg : t.inputBg,
                      color: currentResponse.value === pct ? t.accent : t.text,
                      fontSize: 18,
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontFamily: "'DM Sans',sans-serif",
                      transition: '0.2s'
                    }}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            )}

            {/* Roti item buttons */}
            {(response === 'yes' || response === 'no') && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setCurrentResponse('yes')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 12,
                    border: `2px solid ${currentResponse === 'yes' ? t.accent : t.border}`,
                    background: currentResponse === 'yes' ? t.accentBg : t.inputBg,
                    color: currentResponse === 'yes' ? t.accent : t.text,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif"
                  }}
                >
                  ✅ Yes
                </button>
                <button
                  onClick={() => setCurrentResponse('no')}
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
                    fontFamily: "'DM Sans',sans-serif"
                  }}
                >
                  ❌ No
                </button>
              </div>
            )}
          </div>

          {error && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: t.successBg,
              border: `1px solid rgba(16, 185, 129, 0.3)`,
              color: '#047857',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'DM Sans',sans-serif"
            }}>
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ 
            display: 'flex', 
            gap: 8, 
            marginTop: 16,
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: `1px solid ${t.border}`,
                background: 'transparent',
                color: t.textSub,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'DM Sans',sans-serif",
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <RotateCcw size={14} /> Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: 'none',
                background: t.accentGrad || t.accent,
                color: '#000',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
                fontFamily: "'DM Sans',sans-serif",
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: `0 4px 12px ${t.accentBg || 'rgba(224, 160, 60, 0.2)'}`
              }}
            >
              <Save size={14} /> Save
            </button>
          </div>
        </div>
      )
    }

    // View mode - show current response
    return (
      <div style={{ 
        marginTop: 16, 
        padding: 16, 
        background: t.inputBg,
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        fontFamily: "'DM Sans',sans-serif"
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            background: t.accentBg,
            color: t.accent,
            fontSize: 12,
            fontWeight: 700
          }}>
            {typeof response === 'number' ? '🍽️' : response === 'yes' ? '✅' : response === 'no' ? '❌' : '📊'}
          </div>
          <div>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: t.text,
              marginBottom: 4
            }}>
              Your Response
            </div>
            <div style={{ 
              fontSize: 16, 
              fontWeight: 800, 
              color: t.accent
            }}>
              {response === 'yes' ? '✅ Yes' : 
               response === 'no' ? '❌ No' : 
               typeof response === 'number' ? `${response} portions` : 
               response === undefined ? 'Not answered' : 
               `${response}%`}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: t.card,
      borderRadius: 24,
      padding: 20,
      border: `1.5px solid ${t.border}`,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      fontFamily: "'DM Sans',sans-serif",
      ...className
    }}>
      {/* Close button */}
      <button
        onClick={() => setIsEditing(false)}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'none',
          border: 'none',
          color: t.textSub,
          cursor: 'pointer',
          padding: 4,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <X size={16} />
      </button>

      {/* Dish header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 8
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: t.accentBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: t.accent,
            fontSize: 20,
            fontWeight: 700
          }}>
            🍽️
          </div>
          <div>
            <h3 style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: t.text,
              fontFamily: "'Playfair Display', serif"
            }}>
              {dish}
            </h3>
            <div style={{
              fontSize: 12,
              color: t.textSub,
              marginTop: 2,
              fontFamily: "'DM Sans',sans-serif"
            }}>
              Tap to edit your selection
            </div>
          </div>
        </div>
      </div>

      {/* Response section */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16
        }}>
          <h4 style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: t.text,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Current Selection
          </h4>
          <button
            onClick={handleEdit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: 'transparent',
              color: t.accent,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'DM Sans',sans-serif"
            }}
          >
            <Edit2 size={14} /> Edit
          </button>
        </div>

        {renderResponse()}
      </div>
    </div>
  )
}