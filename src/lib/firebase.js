// src/lib/firebase.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Your web app's Firebase configuration
// REPLACE THESE WITH YOUR ACTUAL FIREBASE PROJECT CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCFQqTnz_CiVIKtDW4XH6CswPAm_KwN6jc",
  authDomain: "al-mawaid-8ffef.firebaseapp.com",
  projectId: "al-mawaid-8ffef",
  storageBucket: "al-mawaid-8ffef.firebasestorage.app",
  messagingSenderId: "333277268731",
  appId: "1:333277268731:web:9f7ba7f8f279a47f94be5e",
  measurementId: "G-J5D0YKG986"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

export const requestForToken = async () => {
  try {
    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;
    
    const currentToken = await getToken(messaging, {
      vapidKey: "BMY0VrgzXWapeU_cms3fmAv6tt0P1FxpYv6WQ7-c7cgvW2U71q4qvSHE-n8RGdHQ0d4nJOMG6XHWXWFuYdzJK9w",
      serviceWorkerRegistration: registration,
    });
    
    if (currentToken) {
      return currentToken;
    } else {
      console.log("No registration token available. Request permission to generate one.");
      return null;
    }
  } catch (err) {
    console.log("An error occurred while retrieving token. ", err);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
