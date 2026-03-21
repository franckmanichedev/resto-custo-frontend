// src/utils/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, initializeAuth, indexedDBLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";
import { Capacitor } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: isNative
    ? import.meta.env.VITE_FIREBASE_ANDROID_APP_ID
    : import.meta.env.VITE_FIREBASE_WEB_APP_ID,
};

const appName = "bridge-connector-app";
const app = getApps().find((a) => a.name === appName) || initializeApp(firebaseConfig, appName);

// Configuration spécifique de la persistance selon la plateforme
let auth;
if (isNative) {
  // Sur mobile (Capacitor), utiliser indexedDBLocalPersistence pour la persistance
  try {
    auth = initializeAuth(app, {
      persistence: indexedDBLocalPersistence,
    });
  } catch {
    // Si déjà initialisé, utiliser getAuth
    auth = getAuth(app);
  }
} else {
  // Sur web, utiliser le mode normal avec browserLocalPersistence
  auth = getAuth(app);
}

export const db = getFirestore(app);

/**
 * Web push (FCM) : uniquement si le navigateur supporte.
 * Sur natif, tu passeras plutôt par un plugin Capacitor (voir plus bas).
 */
let messaging = null;

if (!isNative) {
  isSupported()
    .then((supported) => {
      if (supported) {
        messaging = getMessaging(app);
      }
    })
    .catch((e) => {
      console.warn("FCM not supported:", e);
    });
}

// Configurer la persistance pour web uniquement
if (!isNative) {
  setPersistence(auth, browserLocalPersistence).catch((e) => {
    console.warn("Failed to set Firebase persistence:", e);
  });
}

export { auth, messaging };
export default app;
