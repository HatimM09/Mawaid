# Lunch Survey Editor - Direct Card Interface

This package provides a direct card-based interface for editing lunch survey responses without pop-ups or modals.

## Components

### 1. LunchSurveyEditCard

Individual card component for editing a single lunch dish's survey response.

#### Features
- ✅ **Direct Card Interface** - Edit responses directly on the card
- ✅ **Yes/No Flow** - Must select Yes/No before entering counts (dishes 1-3)
- ✅ **Admin Defaults** - Pre-filled with admin-configured default counts
- ✅ **Auto-Save** - Changes are automatically saved to database
- ✅ **Validation** - Prevents counts from exceeding admin-set defaults
- ✅ **Visual Feedback** - Clear indicators for current selection and limits

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `dish` | string | Yes | Name of the dish |
| `response` | any | Yes | Current response value |
| `onResponseChange` | function | Yes | Called when response changes |
| `snackDefaults` | object | No | Admin-configured default counts |
| `theme` | 'dark' \| 'bright' | No | Visual theme (default: 'dark') |

#### Response Format

```javascript
// For dishes 1-3 (Yes/No + Count)
{ status: 'yes', value: 2 }    // Yes with 2 portions
'no'                          // No/Skipped

// For dishes 4+ (Direct count or percentage)
3                             // 3 portions
50                            // 50%
```

#### Example Usage

```jsx
import LunchSurveyEditCard from './components/LunchSurveyEditCard'

function SurveyView() {
  const [responses, setResponses] = useState({
    'dish_1': { status: 'yes', value: 2 },
    'dish_2': 'no',
    'dish_3': { status: 'yes', value: 1 },
    'Vegetable Curry': 50
  })

  const handleResponseChange = (dish, newResponse) => {
    setResponses(prev => ({
      ...prev,
      [dish]: newResponse
    }))
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {Object.entries(responses).map(([dish, response]) => (
        <LunchSurveyEditCard
          key={dish}
          dish={dish}
          response={response}
          onResponseChange={handleResponseChange}
          snackDefaults={{ dish_1: 3, dish_2: 2, dish_3: 1, dish_4: 0 }}
          theme="dark"
        />
      ))}
    </div>
  )
}
```

### 2. LunchSurveyEditor

Complete editor component that loads survey data and displays all lunch dishes.

#### Features
- ✅ **Automatic Data Loading** - Fetches user data, survey responses, and menu
- ✅ **Real-time Updates** - Changes are auto-saved to database
- ✅ **Summary View** - Shows all current selections in one place
- ✅ **Error Handling** - Graceful error messages and retry functionality
- ✅ **Loading States** - Shows loading spinner while fetching data
- ✅ **Responsive Design** - Works on all device sizes

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `userId` | string | Yes | Current user ID |
| `theme` | 'dark' \| 'bright' | No | Visual theme (default: 'dark') |

#### Example Usage

```jsx
import LunchSurveyEditor from './components/LunchSurveyEditor'

function App() {
  const [user] = useState('user-123')

  return (
    <div style={{ padding: '40px 20px' }}>
      <LunchSurveyEditor userId={user} theme="dark" />
    </div>
  )
}
```

## Integration

### Into Existing Application

1. **Replace existing survey modal** with direct card interface:
```jsx
// Instead of SurveyModal
<LunchSurveyEditor userId={user.id} theme="dark" />
```

2. **Add to your routing**:
```javascript
// routes.js
{
  path: '/lunch-survey',
  component: LunchSurveyEditor
}
```

3. **Add navigation button**:
```jsx
<button onClick={() => navigate('/lunch-survey')}>
  Edit Lunch Survey
</button>
```

### Database Integration

The component automatically handles:
- **user_stats** table for snack defaults
- **survey_submissions_flat** table for responses
- **weekly_menu** table for dish names

## Styling

### Themes

Two built-in themes:

```javascript
// Dark theme (default)
const theme = 'dark'

// Bright theme
const theme = 'bright'
```

### Customization

Override theme colors:
```javascript
const customTheme = {
  card: 'rgba(255,255,255,0.95)',
  accent: '#2d3748',
  text: '#1a202c',
  textSub: 'rgba(0,0,0,0.6)',
  border: 'rgba(0,0,0,0.1)',
  inputBg: 'rgba(255,255,255,0.8)',
  dangerBg: 'rgba(239, 68, 68, 0.1)',
  dangerBorder: 'rgba(239, 68, 68, 0.3)'
}
```

## Workflow

### For Users

1. **View Current Selections** - See all dishes with their current status
2. **Click "Edit"** - Start editing any dish's response
3. **Select Yes/No** - Choose whether to eat the dish
4. **Enter Count** - If Yes, enter portion count (with default pre-filled)
5. **Auto-Save** - Changes are saved automatically
6. **Save All** - Confirm all changes at once

### For Admins

1. **Configure Defaults** - Set `snack_defaults` for each user
2. **Monitor Usage** - Users can only enter counts up to the default
3. **Real-time Updates** - See survey responses as they're submitted

## Data Flow

```
User Action → LunchSurveyEditCard → onResponseChange → 
Auto-save to database → Update UI → Optional summary refresh
```

## Error Handling

- **Network Errors**: Shows retry button
- **Validation Errors**: Highlights invalid inputs
- **Loading States**: Shows spinner during data fetch
- **Authentication**: Checks user login status

## Performance

- **Optimized Rendering**: Uses React.memo for performance
- **Lazy Loading**: Components load only when needed
- **Efficient Updates**: Minimal re-renders on data changes
- **Database Optimization**: Upsert operations for efficient saves

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies

- React 18+
- Supabase client
- Lucide React icons
- DM Sans & Playfair Display fonts

## Example Implementation

See `src/examples/LunchSurveyDemo.jsx` for a complete working example.

## Migration from SurveyModal

1. Replace SurveyModal with LunchSurveyEditor
2. Remove modal-related code
3. Update navigation to show editor page
4. Ensure user authentication is working
5. Test with real data

## Benefits

✅ **No Pop-ups** - Direct editing experience  
✅ **Faster Workflow** - Click and edit without modal overhead  
✅ **Better UX** - Continuous editing with auto-save  
✅ **Mobile Friendly** - Works perfectly on all devices  
✅ **Accessibility** - Full keyboard navigation and screen reader support