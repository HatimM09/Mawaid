// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

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

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/al-mawaid.png' // Make sure this path is correct
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});