// src/lib/useApiToast.js
// Hook to surface API/database errors as visible toasts instead of swallowing them
import toast from 'react-hot-toast'

export function useApiToast() {
  const showError = (error, fallback = 'Something went wrong. Please try again.') => {
    const message = error?.message || error?.error?.message || fallback
    console.error('[API Error]', message, error)
    toast.error(message, {
      duration: 5000,
      position: 'top-center',
      style: {
        borderRadius: '14px',
        background: '#1a0a0a',
        color: '#ef4444',
        border: '1px solid rgba(239,68,68,0.3)',
        fontSize: '13px',
        fontWeight: 600,
        fontFamily: "'DM Sans',sans-serif",
        boxShadow: '0 10px 30px rgba(239,68,68,0.2)',
      },
      iconTheme: { primary: '#ef4444', secondary: '#1a0a0a' },
    })
  }

  const showSuccess = (message) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-center',
      style: {
        borderRadius: '14px',
        background: '#065f46',
        color: '#fff',
        border: '1px solid rgba(16,185,129,0.3)',
        fontSize: '13px',
        fontWeight: 600,
        fontFamily: "'DM Sans',sans-serif",
        boxShadow: '0 10px 30px rgba(16,185,129,0.2)',
      },
    })
  }

  // Wraps an async function with error toast on failure
  const withErrorToast = (fn, fallback) => async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      showError(error, fallback)
      throw error
    }
  }

  return { showError, showSuccess, withErrorToast }
}

// Standalone version (no hook)
export function showApiError(error, fallback) {
  const message = error?.message || error?.error?.message || fallback || 'Something went wrong.'
  console.error('[API Error]', message, error)
  toast.error(message, {
    duration: 5000,
    position: 'top-center',
    style: {
      borderRadius: '14px',
      background: '#1a0a0a',
      color: '#ef4444',
      border: '1px solid rgba(239,68,68,0.3)',
      fontSize: '13px',
      fontWeight: 600,
      fontFamily: "'DM Sans',sans-serif",
      boxShadow: '0 10px 30px rgba(239,68,68,0.2)',
    },
    iconTheme: { primary: '#ef4444', secondary: '#1a0a0a' },
  })
}

export function showApiSuccess(message) {
  toast.success(message, {
    duration: 3000,
    position: 'top-center',
    style: {
      borderRadius: '14px',
      background: '#065f46',
      color: '#fff',
      border: '1px solid rgba(16,185,129,0.3)',
      fontSize: '13px',
      fontWeight: 600,
      fontFamily: "'DM Sans',sans-serif",
      boxShadow: '0 10px 30px rgba(16,185,129,0.2)',
    },
  })
}
