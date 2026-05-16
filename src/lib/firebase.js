// src/lib/firebase.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCFQqTnz_CiVIKtDW4XH6CswPAm_KwN6jc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "al-mawaid-8ffef.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "al-mawaid-8ffef",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "al-mawaid-8ffef.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "333277268731",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:333277268731:web:9f7ba7f8f279a47f94be5e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-J5D0YKG986"
};

// VAPID Key from environment variable
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

export const requestForToken = async () => {
  if (!VAPID_KEY) {
    console.error("[PushManager] VITE_FIREBASE_VAPID_KEY is missing from .env!");
    return null;
  }

  try {
    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;
    
    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    
    if (currentToken) {
      return currentToken;
    } else {
      console.log("No registration token available. Request permission to generate one.");
      return null;
    }
  } catch (err) {
    console.error("An error occurred while retrieving token: ", err);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
