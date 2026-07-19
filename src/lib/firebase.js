// src/lib/firebase.js
// Firebase Messaging - only initializes when VITE_FIREBASE_VAPID_KEY is set
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCFQqTnz_CiVIKtDW4XH6CswPAm_KwN6jc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "al-mawaid-8ffef.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "al-mawaid-8ffef",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "al-mawaid-8ffef.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "333277268731",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:333277268731:web:9f7ba7f8f279a47f94be5e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-J5D0YKG986"
};

// VAPID Key - must be explicitly set (non-empty) to enable FCM
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim() || '';

// Initialize Firebase app (always safe)
const app = initializeApp(firebaseConfig);

// Only create messaging instance if VAPID key is configured
const messaging = VAPID_KEY ? getMessaging(app) : null;

export const requestForToken = async () => {
  if (!VAPID_KEY || !messaging) {
    console.log('[Firebase] VAPID_KEY not configured - skipping FCM token (Web Push will be used)');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return currentToken || null;
  } catch (err) {
    if (err instanceof Error && (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('auth/invalid-vapid-key'))) {
      console.warn('[Firebase] FCM unavailable - VAPID key mismatch in Firebase Console. Web Push will be used.');
    } else {
      console.error('[Firebase] Token error:', err);
    }
    return null;
  }
};

export const onMessageListener = () => {
  if (!messaging) return Promise.resolve(null);
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => resolve(payload));
  });
};

// Export messaging instance (may be null)
export { messaging };