import React, { useState } from 'react'
import SurveyEditModal from './components/SurveyEditModal'
import SurveyEditCard from './components/SurveyEditCard'
import { THEMES } from './admin/ui'

/**
 * Example component showing how to use the SurveyEditCard and SurveyEditModal
 * This can be integrated into the existing survey system
 */
export default function SurveyEditExample() {
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedDish, setSelectedDish] = useState(null)
  const [theme, setTheme] = useState('dark')

  // Mock survey data (this would come from your database)
  const mockSurveyData = {
    responses: {
      dish_1: { status: 'yes', value: 2 }, // 2 portions
      dish_2: 'no',                       // Skipped
      dish_3: { status: 'yes', value: 1 }, // 1 portion
      dish_4: 50,                         // 50%
      'Vegetable Curry': 25,              // 25%
      'Roti': 'yes'                       // Yes
    },
    userData: {
      thali_no: '123',
      email: 'user@example.com'
    },
    snackDefaults: {
      dish_1: 3,
      dish_2: 2,
      dish_3: 1,
      dish_4: 0
    },
    menu: {
      lunch: ['dish_1', 'dish_2', 'dish_3', 'dish_4', 'Vegetable Curry', 'Roti']
    }
  }

  const handleEditResponse = (dish, newResponse) => {
    console.log('Response updated:', dish, newResponse)
    // In a real app, this would update state and potentially save to database
  }

  const handleSaveAll = (responses) => {
    console.log('All responses saved:', responses)
    // In a real app, this would trigger a save to the database
  }

  const handleDishClick = (dish) => {
    setSelectedDish(dish)
    // This could trigger a modal or inline editing
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
          <h1 style={{
            fontSize: 32,
            fontWeight: 700,
            color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
            marginBottom: 16,
            fontFamily: "'Playfair Display', serif"
          }}>
            Survey Edit Components
          </h1>
          <p style={{
            fontSize: 16,
            color: theme === 'dark' ? 'rgba(255,248,231,0.7)' : '#706454',
            lineHeight: 1.6
          }}>
            This example shows how to use the SurveyEditCard and SurveyEditModal components 
            for editing survey responses with enhanced Yes/No flow and validation.
          </p>
        </div>

        {/* Theme switcher */}
        <div style={{ marginBottom: 40 }}>
          <label htmlFor="themeSelect" style={{
            fontSize: 14,
            fontWeight: 600,
            color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
            marginRight: 16
          }}>
            Theme:
          </label>
          <select
            id="themeSelect"
            name="theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
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

        {/* Individual dish cards */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{
            fontSize: 24,
            fontWeight: 700,
            color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
            marginBottom: 20,
            fontFamily: "'Playfair Display', serif"
          }}>
            Individual Dish Cards
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20
          }}>
            {Object.entries(mockSurveyData.responses).map(([dish, response]) => (
              <SurveyEditCard
                key={dish}
                dish={dish}
                response={response}
                onEdit={(dishName) => console.log('Edit clicked for:', dishName)}
                onSave={handleEditResponse}
                onCancel={(dishName) => console.log('Edit cancelled for:', dishName)}
                theme={theme}
              />
            ))}
          </div>
        </div>

        {/* Edit modal trigger */}
        <div style={{ marginBottom: 40 }}>
          <button
            onClick={() => setShowEditModal(true)}
            style={{
              padding: '16px 32px',
              borderRadius: 16,
              border: 'none',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #E0A03C, #B8860B)' 
                : 'linear-gradient(135deg, #dfb44a, #b8860b)',
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: theme === 'dark' 
                ? '0 8px 24px rgba(224,160,60,0.3)' 
                : '0 8px 24px rgba(184,134,11,0.2)',
              fontFamily: "'DM Sans',sans-serif'"
            }}
          >
            Open Edit Survey Modal
          </button>
        </div>

        {/* Features description */}
        <div style={{
          background: theme === 'dark' 
            ? 'rgba(74,58,44,0.3)' 
            : 'rgba(184,134,11,0.05)',
          borderRadius: 16,
          padding: 24,
          border: `1px solid ${theme === 'dark' ? 'rgba(224,160,60,0.2)' : '#e8ddc5'}`,
          marginBottom: 40
        }}>
          <h3 style={{
            fontSize: 20,
            fontWeight: 700,
            color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
            marginBottom: 16,
            fontFamily: "'Playfair Display', serif"
          }}>
            Key Features
          </h3>
          <ul style={{
            fontSize: 14,
            color: theme === 'dark' ? 'rgba(255,248,231,0.7)' : '#706454',
            lineHeight: 1.8,
            paddingLeft: 20
          }}>
            <li><strong>Yes/No Selection:</strong> For dishes 1-3, users must first select Yes/No before entering counts</li>
            <li><strong>Default Values:</strong> Uses admin-configured default counts from user profile</li>
            <li><strong>Validation:</strong> Prevents submission if counts exceed admin-set defaults</li>
            <li><strong>Interactive Editing:</strong> Click any dish to edit its response</li>
            <li><strong>Real-time Preview:</strong> Shows current response before saving</li>
            <li><strong>Batch Save:</strong> Save all changes at once with confirmation</li>
            <li><strong>Responsive Design:</strong> Works on desktop and mobile devices</li>
            <li><strong>Theme Support:</strong> Dark and bright themes available</li>
          </ul>
        </div>

        {/* Integration instructions */}
        <div style={{
          background: theme === 'dark' 
            ? 'rgba(74,58,44,0.3)' 
            : 'rgba(184,134,11,0.05)',
          borderRadius: 16,
          padding: 24,
          border: `1px solid ${theme === 'dark' ? 'rgba(224,160,60,0.2)' : '#e8ddc5'}`,
          marginBottom: 40
        }}>
          <h3 style={{
            fontSize: 20,
            fontWeight: 700,
            color: theme === 'dark' ? '#FFF8E7' : '#2d2416',
            marginBottom: 16,
            fontFamily: "'Playfair Display', serif"
          }}>
            Integration Guide
          </h3>
          <div style={{
            fontSize: 14,
            color: theme === 'dark' ? 'rgba(255,248,231,0.7)' : '#706454',
            lineHeight: 1.8,
            fontFamily: "'DM Sans',sans-serif'"
          }}>
            <p><strong>1. SurveyEditCard</strong> - Individual dish editing component:</p>
            <pre style={{
              background: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
              padding: 16,
              borderRadius: 8,
              overflowX: 'auto',
              fontSize: 12,
              margin: '12px 0'
            }}>
{`<SurveyEditCard
  dish="Vegetable Curry"
  response={responses.dish_1}
  onEdit={(dish) => console.log('Edit:', dish)}
  onSave={handleEditResponse}
  onCancel={handleCancel}
  theme="dark"
/>`}
            </pre>

            <p><strong>2. SurveyEditModal</strong> - Modal for editing multiple dishes:</p>
            <pre style={{
              background: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
              padding: 16,
              borderRadius: 8,
              overflowX: 'auto',
              fontSize: 12,
              margin: '12px 0'
            }}>
{`<SurveyEditModal
  isOpen={showEditModal}
  onClose={() => setShowEditModal(false)}
  initialData={surveyData}
  onSave={handleSaveAll}
  theme="dark"
/>}`}
            </pre>

            <p><strong>3. Data Format:</strong> The components expect responses in this format:</p>
            <pre style={{
              background: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
              padding: 16,
              borderRadius: 8,
              overflowX: 'auto',
              fontSize: 12,
              margin: '12px 0'
            }}>
{`responses: {
  'dish_1': { status: 'yes', value: 2 },   // Yes with 2 portions
  'dish_2': 'no',                         // No/Skipped
  'dish_3': 50,                          // 50% percentage
  'Roti': 'yes'                          // Yes for roti items
}`}
            </pre>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <SurveyEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialData={mockSurveyData}
        onSave={handleSaveAll}
        theme={theme}
      />

      {/* Add global styles */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;700&display=swap');
        
        body {
          margin: 0;
          padding: 0;
          font-family: 'DM Sans', sans-serif;
        }
      `}</style>
    </div>
  )
}