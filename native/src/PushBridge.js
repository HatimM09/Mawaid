// src/PushBridge.js
// Bridges native push notifications into the PWA WebView using Expo's push service.
//
// Architecture:
//   Native App → expo-notifications → Expo Push Service → FCM (Android) / APNs (iOS)
//
// The Expo Push Service handles routing to the correct platform natively.
// Tokens are injected into the PWA WebView, where PushManager saves them to Supabase.
// The backend send-push edge function sends via Expo Push Service API for these tokens.

import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'

// Show system notification even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/**
 * Get an Expo push token (works on both Android & iOS via Expo's managed push service).
 * No native module linking or prebuild required.
 */
async function getExpoPushToken() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.warn('[PushBridge] Push notification permission not granted')
    return null
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
  return tokenData.data
}

/**
 * Hook that bridges native push tokens into the WebView.
 *
 * @param {object}   webViewRef - React ref to the WebView component
 * @param {function} onDeepLink - Callback with (url) when notification tap launches the app
 */
export function usePushBridge(webViewRef, onDeepLink) {
  const notificationResponseListener = useRef(null)
  const notificationListener = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      // ── 1. Get Expo push token ────────────────────────────────────────────
      const expoToken = await getExpoPushToken()
      if (cancelled) return

      console.log('[PushBridge] Expo push token:', expoToken ? expoToken.slice(0, 30) + '...' : 'none')

      // ── 2. Inject tokens into the WebView when it loads ────────────────────
      const injectTokensScript = `
        (function() {
          window.__nativePushToken = ${JSON.stringify(expoToken)};
          window.__nativePlatform = ${JSON.stringify(Platform.OS)};
          window.__nativeExpoToken = ${JSON.stringify(expoToken)};
          window.__nativeTokenType = 'expo';
          // Dispatch event so PushManager can pick up tokens even if it mounted early
          window.dispatchEvent(new Event('native-push-ready'));
          console.log('[WebView] Native push tokens injected ✅');
        })();
      `

      // Poll for WebView to be ready, then inject
      const checkInterval = setInterval(() => {
        if (webViewRef.current && !cancelled) {
          webViewRef.current.injectJavaScript(injectTokensScript)
          clearInterval(checkInterval)
        }
      }, 500)

      setTimeout(() => clearInterval(checkInterval), 15000)
    }

    init()

    // ── 3. Listen for incoming notifications (app in foreground) ─────────────
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[PushBridge] Notification received:', notification.request.content.title)
      }
    )

    // ── 4. Handle notification taps (user taps notification) ─────────────────
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data
        const url = data?.url || data?.link || '/'
        console.log('[PushBridge] Notification tapped — opening:', url)

        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            window.location.href = ${JSON.stringify(url)};
            true;
          `)
        }
      })

    // ── 5. Handle notification that launched the app from killed state ───────
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response && !cancelled) {
        const data = response.notification.request.content.data
        const url = data?.url || data?.link || '/'
        console.log('[PushBridge] App launched from notification — URL:', url)
        if (onDeepLink) onDeepLink(url)
      }
    })

    return () => {
      cancelled = true
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current)
      }
      if (notificationResponseListener.current) {
        Notifications.removeNotificationSubscription(notificationResponseListener.current)
      }
    }
  }, [])
}

/**
 * Send a push notification via the Expo Push Service API.
 * Use this in your backend to send to Expo push tokens.
 *
 * @param {string} expoPushToken - Recipient's Expo push token (ExponentPushToken[...])
 * @param {string} title         - Notification title
 * @param {string} body          - Notification body
 * @param {string} url           - Deep link to open on tap
 */
export async function sendExpoPush(expoPushToken, title, body, url = '/') {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data: { url },
    _displayInForeground: true,
  }

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })

  return res.json()
}
