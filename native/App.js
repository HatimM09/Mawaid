// App.js — Al-Mawaid Native Shell
// Thin React Native wrapper that loads the PWA in a WebView
// and bridges native push notifications (FCM + APNs) into the PWA.

import { useRef, useState, useEffect, useCallback } from 'react'
import {
  View, StyleSheet, StatusBar, Text, ActivityIndicator,
  Linking, Platform
} from 'react-native'
import { WebView } from 'react-native-webview'
import * as SplashScreen from 'expo-splash-screen'
import Constants from 'expo-constants'
import { usePushBridge } from './src/PushBridge'

// Keep splash screen visible while we load the WebView
SplashScreen.preventAutoHideAsync()

const PWA_URL = Constants.expoConfig?.extra?.pwaUrl || 'https://al-mawaid.vercel.app'

export default function App() {
  const webViewRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  // Deep link URL from a notification that launched the app (app was killed)
  const [pendingDeepLink, setPendingDeepLink] = useState(null)

  // ── Initialize push notification bridge ────────────────────────────────────
  // Pass a callback so PushBridge can tell us the deep link URL when the app
  // was launched from a notification tap (app was killed state).
  const handleDeepLink = useCallback((url) => {
    if (loading) {
      // WebView hasn't loaded yet — store for injection after mount
      setPendingDeepLink(url)
    } else {
      // WebView is already loaded — navigate immediately
      webViewRef.current?.injectJavaScript(`
        window.location.href = ${JSON.stringify(url)};
        true;
      `)
    }
  }, [loading])

  usePushBridge(webViewRef, handleDeepLink)

  // ── Hide splash screen when WebView is ready ───────────────────────────────
  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync()
    }
  }, [loading])

  // ── Navigate to pending deep link once WebView is ready ────────────────────
  useEffect(() => {
    if (!loading && pendingDeepLink && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        window.location.href = ${JSON.stringify(pendingDeepLink)};
        true;
      `)
      setPendingDeepLink(null)
    }
  }, [loading, pendingDeepLink])

  // ── JavaScript to inject into every page ───────────────────────────────────
  const INJECTED_JS = `
    (function() {
      // Notify React Native when the app shell is ready
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'ready',
        url: window.location.href
      }));

      // Listen for messages from React Native (e.g. navigation commands)
      window.addEventListener('message', function(event) {
        try {
          var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.type === 'navigate') {
            window.location.href = data.url;
          }
        } catch(e) {}
      });
    })();
  `

  // ── Handle messages from the WebView (PWA → Native) ────────────────────────
  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (data.type === 'ready') {
        console.log('[Native] PWA loaded:', data.url)
      }
    } catch (e) {
      // ignore non-JSON messages
    }
  }

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#060d1a" />
        <View style={styles.splashContent}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🌾</Text>
          </View>
          <Text style={styles.appName}>Al-Mawaid</Text>
          <Text style={styles.appSubtitle}>المَوَائِد</Text>
          <ActivityIndicator size="large" color="#D4AF37" style={styles.spinner} />
          <Text style={styles.loadingText}>{Math.round(progress)}%</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#060d1a" />
      <WebView
        ref={webViewRef}
        source={{ uri: PWA_URL }}
        style={styles.webview}
        startInLoadingState={false}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        sharedCookiesEnabled
        // In-app navigation: allow our PWA + dependencies, open external in browser
        onShouldStartLoadWithRequest={(request) => {
          if (
            request.url.startsWith(PWA_URL) ||
            request.url.includes('supabase.co') ||
            request.url.includes('firebase') ||
            request.url.includes('googleapis.com') ||
            request.url.includes('fonts.gstatic.com') ||
            request.url.includes('fcm.googleapis.com')
          ) {
            return true
          }
          if (request.url.startsWith('http')) {
            Linking.openURL(request.url)
            return false
          }
          return true
        }}
        // Track loading progress
        onLoadProgress={({ nativeEvent }) => {
          setProgress(nativeEvent.progress * 100)
        }}
        onLoadEnd={() => setLoading(false)}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent
          console.error('[Native] WebView error:', nativeEvent)
        }}
        injectedJavaScript={INJECTED_JS}
        onMessage={handleMessage}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060d1a',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#060d1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoEmoji: {
    fontSize: 48,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#D4AF37',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  appSubtitle: {
    fontSize: 18,
    color: 'rgba(212, 175, 55, 0.6)',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginTop: 4,
  },
  spinner: {
    marginTop: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: 'rgba(212, 175, 55, 0.4)',
    letterSpacing: 2,
  },
})
