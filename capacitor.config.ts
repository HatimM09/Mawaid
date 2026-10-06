import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.almawaid.myapp',
  appName: 'Al-Mawaid',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://al-mawaid.vercel.app?v=2.1.8',
    cleartext: false,
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      backgroundColor: "#060d1a",
      showSpinner: false,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#c5a059",
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#060d1a",
      overlaysWebView: true
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
      firebase: {
        senderID: "333277268731"
      }
    }
  }
};

export default config;
