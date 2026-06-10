import React, { useState } from 'react'
import LunchSurveyEditor from './components/LunchSurveyEditor'
import THEMES from './admin/ui'

/**
 * Simple demo of the LunchSurveyEditor component
 * Shows direct editing interface without pop-ups
 */
export default function LunchSurveyDemo() {
  const [theme, setTheme] = useState('dark')
  const [userId, setUserId] = useState('demo-user-123') // In real app, get from auth

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: theme === 'dark' ? '#8B6B38' : '#fdfbf7',
      fontFamily: "'DM Sans',sans-serif"
    }}>
      <div style={{
        maxWidth: 1200,
        margin: 0 auto,
        padding: '40px 20px'
      }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h1 style={{
                fontSize: 32,
                fontWeight: 700,
                color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
                marginBottom: 8,
                fontFamily: "'Playfair Display', serif"
              }}>
                Lunch Survey Editor
              </h1>
              <p style={{
                fontSize: 16,
                color: theme === 'dark' ? 'rgba(255,248,231,0.7)' : '#706454',
                lineHeight: 1.6
              }}>
                Direct card interface for editing lunch survey responses
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div>
                <label style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
                  marginRight: 8
                }}>
                  Theme:
                </label>
                <select
                  value={theme}
                  onChange={(e) => handleThemeChange(e.target.value)}
                  style={{
                    padding: 8 12,
                    borderRadius: 8,
                    border: `1px solid ${theme === 'dark' ? 'rgba(224,160,60,0.3)' : '#e8ddc5'}`,
                    background: theme === 'dark' ? 'rgba(74,58,44,0.5)' : '#fff',
                    color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
                    fontSize: 14,
                    fontFamily: "'DM Sans',sans-serif'"
                  }}
                >
                  <option value="dark">Dark</option>
                  <option value="bright">Bright</option>
                </select>
              </div>
              
              <div>
                <label style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
                  marginRight: 8
                }}>
                  User ID:
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  style={{
                    padding: 8 12,
                    borderRadius: 8,
                    border: `1px solid ${theme === 'dark' ? 'rgba(224,160,60,0.3)' : '#e8ddc5'}`,
                    background: theme === 'dark' ? 'rgba(74,58,44,0.5)' : '#fff',
                    color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
                    fontSize: 14,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Features overview */}
        <div style={{
          background: theme === 'dark' 
            ? 'rgba(74,58,44,0.3)' 
            : 'rgba(184,134,11,0.05)',
          borderRadius: 16,
          padding: 24,
          border: `1px solid ${theme === 'dark' ? 'rgba(224,160,60,0.2)' : '#e8ddc5'}`,
          marginBottom: 40
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
            marginBottom: 16,
            fontFamily: "'Playfair Display', serif"
          }}>
            Features
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 16
          }}>
            <div style={{
              padding: 16,
              borderRadius: 12,
              background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)'
            }}>
              <h3 style={{
                fontSize: 16,
                fontWeight: 700,
                color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
                marginBottom: 8,
                fontFamily: "'Playfair Display', serif"
              }}>
                ✅ Direct Card Interface
              </h3>
              <p style={{
                fontSize: 14,
                color: theme === 'dark' ? 'rgba(255,248,231,0.7)' : '#706454',
                lineHeight: 1.5
              }}>
                No pop-ups or modals. Edit responses directly on the cards.
              </p>
            </div>
            
            <div style={{
              padding: 16,
              borderRadius: 12,
              background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)'
            }}>
              <h3 style={{
                fontSize: 16,
                fontWeight: 700,
                color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
                marginBottom: 8,
                fontFamily: "'Playfair Display', serif"
              }}>
                ✅ Yes/No Flow
              </h3>
              <p style={{
                fontSize: 14,
                color: theme === 'dark' ? 'rgba(255,248,231,0.7)' : '#706454',
                lineHeight: 1.5
              }}>
                Must select Yes/No before entering counts for dishes 1-3.
              </p>
            </div>
            
            <div style={{
              padding: 16,
              borderRadius: 12,
              background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)'
            }}>
              <h3 style={{
                fontSize: 16,
                fontWeight: 700,
                color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
                marginBottom: 8,
                fontFamily: "'Playfair Display', serif"
              }}>
                ✅ Admin Defaults
              </h3>
              <p style={{
                fontSize: 14,
                color: theme === 'dark' ? 'rgba(255,248,231,0.7)' : '#706454',
                lineHeight: 1.5
              }}>
                Uses admin-configured default counts from user profile.
              </p>
            </div>
            
            <div style={{
              padding: 16,
              borderRadius: 12,
              background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)'
            }}>
              <h3 style={{
                fontSize: 16,
                fontWeight: 700,
                color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
                marginBottom: 8,
                fontFamily: "'Playfair Display', serif"
              }}>
                ✅ Auto-Save
              </h3>
              <p style={{
                fontSize: 14,
                color: theme === 'dark' ? 'rgba(255,248,231,0.7)' : '#706454',
                lineHeight: 1.5
              }}>
                Changes are automatically saved to the database.
              </p>
            </div>
          </div>
        </div>

        {/* Editor */}
        <LunchSurveyEditor userId={userId} theme={theme} />

        {/* Usage instructions */}
        <div style={{
          marginTop: 40,
          background: theme === 'dark' 
            ? 'rgba(74,58,44,0.3)' 
            : 'rgba(184,134,11,0.05)',
          borderRadius: 16,
          padding: 24,
          border: `1px solid ${theme === 'dark' ? 'rgba(224,160,60,0.2)' : '#e8ddc5'}`,
          marginBottom: 40
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
            marginBottom: 16,
            fontFamily: "'Playfair Display', serif"
          }}>
            How to Use
          </h2>
          
          <div style={{
            fontSize: 14,
            color: theme === 'dark' ? 'rgba(255,248,231,0.7)' : '#706454',
            lineHeight: 1.8,
            fontFamily: "'DM Sans',sans-serif'"
          }}>
            <ol style={{ paddingLeft: 20, marginBottom: 20 }}>
              <li style={{ marginBottom: 12 }}>
                <strong>Click "Edit" on any dish card</strong> to start editing your response
              </li>
              <li style={{ marginBottom: 12 }}>
                <strong>Select "Yes" or "No"</strong> for whether you want to eat the dish
              </li>
              <li style={{ marginBottom: 12 }}>
                <strong>If "Yes", enter your portion count</strong> (pre-filled with admin default)
              </li>
              <li style={{ marginBottom: 12 }}>
                <strong>Changes are auto-saved</strong> to the database
              </li>
              <li style={{ marginBottom: 12 }}>
                <strong>Use "Save All Changes" button</strong> to confirm all selections
              </li>
            </ol>
            
            <div style={{
              background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
              padding: 16,
              borderRadius: 8,
              borderLeft: `4px solid ${theme === 'dark' ? '#E0A03C' : '#b8860b'}`,
              fontSize: 13
            }}>
              <strong>Note:</strong> The system enforces admin-set maximum portion counts. 
              If you try to enter more than the default, you'll see a warning and the count 
              will be highlighted in red.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}