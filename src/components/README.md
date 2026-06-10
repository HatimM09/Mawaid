# Survey Edit Components

This package provides enhanced components for editing survey responses with a Yes/No flow and validation features.

## Components

### 1. SurveyEditCard

Individual card component for editing a single dish's survey response.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `dish` | string | Yes | Name of the dish |
| `response` | any | Yes | Current response value |
| `onEdit` | function | No | Called when edit button is clicked |
| `onSave` | function | No | Called when response is saved |
| `onCancel` | function | No | Called when edit is cancelled |
| `className` | string | No | Additional CSS classes |
| `theme` | 'dark' \| 'bright' | No | Visual theme (default: 'dark') |

#### Response Format

The `response` prop can be:

- **For count inputs (dishes 1-4):**
  - `{ status: 'yes', value: number }` - Yes with count
  - `'no'` - No/Skipped
  - `number` - Direct count value

- **For percentage inputs:**
  - `number` - Percentage value (0, 25, 50, 100)

- **For roti items:**
  - `'yes'` - Yes
  - `'no'` - No

#### Example Usage

```jsx
import SurveyEditCard from './components/SurveyEditCard'

function SurveyView() {
  const [responses, setResponses] = useState({
    'Vegetable Curry': { status: 'yes', value: 2 },
    'Rice': 'no',
    'Roti': 50,
    'Salad': 'yes'
  })

  const handleSaveResponse = (dish, newResponse) => {
    setResponses(prev => ({
      ...prev,
      [dish]: newResponse
    }))
  }

  return (
    <div>
      {Object.entries(responses).map(([dish, response]) => (
        <SurveyEditCard
          key={dish}
          dish={dish}
          response={response}
          onSave={handleSaveResponse}
          theme="dark"
        />
      ))}
    </div>
  )
}
```

### 2. SurveyEditModal

Modal component for editing multiple survey responses at once.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | boolean | Yes | Whether modal is open |
| `onClose` | function | Yes | Called when modal is closed |
| `initialData` | object | Yes | Initial survey data |
| `onSave` | function | No | Called when all changes are saved |
| `theme` | 'dark' \| 'bright' | No | Visual theme (default: 'dark') |

#### Data Format

```jsx
initialData: {
  responses: {
    'dish_1': { status: 'yes', value: 2 },
    'dish_2': 'no',
    'dish_3': 50,
    'Roti': 'yes'
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
    lunch: ['dish_1', 'dish_2', 'dish_3', 'dish_4']
  }
}
```

#### Example Usage

```jsx
import SurveyEditModal from './components/SurveyEditModal'

function SurveyDashboard() {
  const [showEditModal, setShowEditModal] = useState(false)
  const [surveyData, setSurveyData] = useState({ /* ... */ })

  const handleSaveAll = (responses) => {
    // Save to database
    setSurveyData(prev => ({
      ...prev,
      responses
    }))
    setShowEditModal(false)
  }

  return (
    <div>
      <button onClick={() => setShowEditModal(true)}>
        Edit Survey
      </button>
      
      <SurveyEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialData={surveyData}
        onSave={handleSaveAll}
        theme="dark"
      />
    </div>
  )
}
```

## Features

### 1. Yes/No Flow
- For dishes 1-3, users must first select "Yes" or "No"
- If "Yes" is selected, they can then enter a count
- If "No" is selected, the dish is marked as skipped

### 2. Default Values
- Uses admin-configured default counts from user profile
- Pre-fills count input with default value
- Enforces maximum limits based on admin settings

### 3. Validation
- Prevents submission if counts exceed admin-set defaults
- Shows error messages for invalid inputs
- Real-time validation feedback

### 4. Interactive Editing
- Click any dish to edit its response
- Visual feedback for selected states
- Smooth animations and transitions

### 5. Batch Operations
- Save all changes at once
- Summary view before saving
- Confirmation dialogs

## Integration

### Into Existing Survey System

1. **Replace existing dish rendering** in your SurveyModal:
```jsx
// Instead of direct count input
{isCountInput(idx) ? (
  <input type="number" ... />
) : (
  // percentage buttons
)}

// Use SurveyEditCard
{dishes.map((dish, idx) => (
  <SurveyEditCard
    key={dish}
    dish={dish}
    response={responses[dish]}
    onSave={handleSaveResponse}
    theme="dark"
  />
))}
```

2. **Add edit modal** for bulk editing:
```jsx
// Add edit button in survey header
<button onClick={() => setShowEditModal(true)}>
  Edit Survey
</button>

// SurveyEditModal for bulk editing
<SurveyEditModal
  isOpen={showEditModal}
  onClose={() => setShowEditModal(false)}
  initialData={surveyData}
  onSave={handleSaveAll}
  theme="dark"
/>
```

### Database Integration

The components expect and produce data compatible with your existing schema:

- `survey_submissions_flat` table
- `user_stats` table with `snack_defaults`
- `weekly_menu` table for dish names

## Styling

### Themes

Two built-in themes are available:

1. **Dark Theme** (default)
   - Warm gold accents
   - Dark background
   - High contrast for readability

2. **Bright Theme**
   - Light background
   - Golden accents
   - Clean, modern look

### Customization

You can customize themes by modifying the theme objects in the components:

```jsx
const customTheme = {
  card: 'rgba(255,255,255,0.95)',
  accent: '#2d3748',
  text: '#1a202c',
  textSub: 'rgba(0,0,0,0.6)',
  border: 'rgba(0,0,0,0.1)',
  inputBg: 'rgba(255,255,255,0.8)',
  successBg: 'rgba(72, 187, 120, 0.1)'
}
```

## Accessibility

The components include:

- Proper ARIA labels
- Keyboard navigation support
- Screen reader friendly
- High contrast ratios
- Focus indicators

## Performance

- Optimized re-rendering with React.memo
- Lazy loading of modal content
- Minimal DOM manipulation
- Efficient state management

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.