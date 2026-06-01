// src/PushBridge.js
// Bridges native push notifications (via expo-notifications) into the PWA WebView.
//
// TWO PUSH PATHS AVAILABLE:
//   Path A (Recommended): Expo Push Token → expo-notifications → Expo Push Service →
//                          FCM (Android) / APNs (iOS)
//   Path B (Optional):     Raw FCM Token → Direct FCM send (uses your existing
//                          supabase/functions/send-push edge function)
//
// Path A is simpler and works out of the box in Expo managed workflow.
// Path B requires `npx expo prebuild` + google-services.json for raw FCM access.

import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'

// Configure notification handler — show system notification when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/**
 * Get the Expo push token (works on both Android & iOS via Expo's push service).
 * This is the recommended path for Expo managed workflow.
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

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  })

  return tokenData.data
}

/**
 * Get the raw FCM token for direct FCM delivery.
 * This is OPTIONAL — only works after `npx expo prebuild` + google-services.json setup.
 * Falls back gracefully to null if @react-native-firebase is not available.
 */
async function getFcmToken() {
  try {      // Dynamic import — gracefully fails if @react-native-firebase is not linked
      // (which requires npx expo prebuild + google-services.json)
      const { default: messaging } = await import('@react-native-firebase/messaging')
    await messaging().registerDeviceForRemoteMessages()
    const token = await messaging().getToken()
    return token
  } catch (e) {
    // Graceful fallback — @react-native-firebase/messaging requires prebuild
    console.log('[PushBridge] Raw FCM unavailable (expected if no prebuild):', e.message)
    return null
  }
}

/**
 * Hook that bridges native push tokens into the WebView.
 *
 * @param {object}   webViewRef         - React ref to the WebView component
 * @param {function} onDeepLink         - Callback fired with (url) when a notification
 *                                        tap launches the app (for navigating WebView)
 */
export function usePushBridge(webViewRef, onDeepLink) {
  const notificationResponseListener = useRef(null)
  const notificationListener = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      // ── 1. Get push tokens ─────────────────────────────────────────────────
      const expoToken = await getExpoPushToken()
      const fcmToken = await getFcmToken()

      if (cancelled) return

      console.log('[PushBridge] Expo token:', expoToken ? expoToken.slice(0, 20) + '...' : 'none')
      console.log('[PushBridge] FCM token:', fcmToken ? fcmToken.slice(0, 20) + '...' : 'none')

      // ── 2. Inject tokens into the WebView when it loads ────────────────────
      const injectTokensScript = `
        (function() {
          window.__nativePushToken = ${JSON.stringify(expoToken || fcmToken)};
          window.__nativePlatform = ${JSON.stringify(Platform.OS)};
          window.__nativeFcmToken = ${JSON.stringify(fcmToken)};
          window.__nativeExpoToken = ${JSON.stringify(expoToken)};
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

        // Navigate the WebView to the deep link
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            window.location.href = ${JSON.stringify(url)};
            true;
          `)
        }
      })

    // ── 5. Handle notification that launched the app from a killed state ─────
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response && !cancelled) {
        const data = response.notification.request.content.data
        const url = data?.url || data?.link || '/'
        console.log('[PushBridge] App launched from notification — URL:', url)
        // Pass back to App.js so it can navigate WebView once mounted
        if (onDeepLink) {
          onDeepLink(url)
        }
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
 * Send a push notification via the Expo Push Service.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   Path A — Use this in your backend if going Expo-native.       ║
 * ║   Path B — Keep using supabase/functions/send-push (FCM)        ║
 * ║            if you want direct FCM control.                      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * @param {string} expoPushToken - Recipient's Expo push token
 * @param {string} title         - Notification title
 * @param {string} body          - Notification body
 * @param {string} url           - Deep link URL to open on tap
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
