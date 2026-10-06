// src/lib/appBadge.js
// Launcher app-icon badge (the notification count bubble on the app icon).
// Uses the Web Badging API (navigator.setAppBadge / clearAppBadge), supported
// on installed PWAs (Android/ChromeOS/Windows) and gracefully no-ops anywhere
// else (iOS Safari, in-browser tabs without PWA support, native WebView).

export function isAppBadgeSupported() {
  try {
    return typeof navigator !== 'undefined' && 'setAppBadge' in navigator
  } catch {
    return false
  }
}

// Show `count` on the app icon; count <= 0 clears it.
export async function setAppBadgeCount(count) {
  if (!isAppBadgeSupported()) return false
  try {
    const n = Math.max(0, Math.floor(Number(count) || 0))
    if (n <= 0) {
      if ('clearAppBadge' in navigator) await navigator.clearAppBadge()
      else await navigator.setAppBadge(0)
    } else {
      await navigator.setAppBadge(n)
    }
    return true
  } catch {
    return false
  }
}

export async function clearAppBadge() {
  return setAppBadgeCount(0)
}
