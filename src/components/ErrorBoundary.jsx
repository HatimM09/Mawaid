import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('[ErrorBoundary] Caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100dvh',
          background: '#050505',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          fontFamily: "'DM Sans', sans-serif",
          textAlign: 'center',
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24, boxShadow: '0 0 40px rgba(212,175,55,0.3)',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#FAF3E0', margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 13, color: 'rgba(250,243,224,0.6)', margin: '0 0 32px', maxWidth: 400, lineHeight: 1.6 }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '14px 32px', borderRadius: 16, border: 'none',
              background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
              color: '#000', fontWeight: 900, fontSize: 15, cursor: 'pointer',
              fontFamily: 'inherit', boxShadow: '0 8px 25px rgba(212,175,55,0.3)',
            }}
          >
            Refresh Page
          </button>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <details style={{ marginTop: 32, maxWidth: 500, textAlign: 'left', color: 'rgba(250,243,224,0.4)', fontSize: 11 }}>
              <summary style={{ cursor: 'pointer', color: 'rgba(250,243,224,0.6)' }}>Error details</summary>
              <pre style={{ marginTop: 12, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, overflow: 'auto', maxHeight: 300 }}>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
