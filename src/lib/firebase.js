// src/lib/firebase.js — Firebase Cloud Messaging Setup
// Initializes Firebase and exports FCM token + foreground message utilities

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app;
let messaging;

try {
  app = initializeApp(firebaseConfig);
  messaging = getMessaging(app);
} catch (err) {
  console.warn('Firebase init skipped (missing config or unsupported env):', err.message);
}

/**
 * Request notification permission and retrieve FCM token.
 * Returns the token string, or null if permission denied / error.
 */
export async function requestFCMToken() {
  if (!messaging) {
    console.warn('Firebase Messaging not initialized');
    return null;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Get the service worker registration for Firebase messaging
    const swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration || undefined,
    });

    console.log('FCM Token acquired:', token?.substring(0, 20) + '...');
    return token;
  } catch (err) {
    console.error('Error getting FCM token:', err);
    return null;
  }
}

/**
 * Listen for push messages while the app is in the foreground.
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
