import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeCtx } from '../admin/context'

const mockTheme = {
  accent: '#D4AF37',
  text: '#FFF8E7',
  textSub: 'rgba(255, 248, 231, 0.55)',
  bgGrad: 'radial-gradient(ellipse at 50% 0%, #8B6B38 0%, #4A3A2C 70%)',
  card: 'rgba(74, 58, 44, 0.45)',
  border: 'rgba(224, 160, 60, 0.2)',
  inputBg: 'rgba(74, 58, 44, 0.5)',
  accentBg: 'rgba(224, 160, 60, 0.12)',
  accentBorder: 'rgba(224, 160, 60, 0.4)',
  navBg: 'rgba(74, 58, 44, 0.98)',
  geo: 'rgba(224, 160, 60, 0.05)',
  spinnerBorder: 'rgba(224, 160, 60, 0.2)',
  spinnerTop: '#E0A03C',
  accentGrad: 'linear-gradient(135deg, #E0A03C, #B8860B)',
  successBg: 'rgba(16, 185, 129, 0.1)',
  successBorder: 'rgba(16, 185, 129, 0.3)',
  successText: '#34d399',
  cardActive: 'rgba(224, 160, 60, 0.08)',
  borderActive: 'rgba(224, 160, 60, 0.55)',
  textBody: '#E8DCC8',
  inputBorder: 'rgba(224, 160, 60, 0.25)',
}

// A simple component that uses ThemeCtx
function TestComponent() {
  return <div data-testid="test-component">Al-Mawaid Test</div>
}

describe('App', () => {
  it('renders with ThemeCtx provider', () => {
    render(
      <ThemeCtx.Provider value={mockTheme}>
        <TestComponent />
      </ThemeCtx.Provider>
    )
    expect(screen.getByTestId('test-component')).toBeInTheDocument()
    expect(screen.getByText(/al-mawaid/i)).toBeInTheDocument()
  })

  it('verifies test environment is jsdom', () => {
    expect(typeof window).toBe('object')
    expect(typeof document).toBe('object')
  })
})
