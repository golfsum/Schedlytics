import { initializeApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

/**
 * Firebase Authentication client. Config comes from public VITE_FIREBASE_*
 * env vars (these are safe to expose). When they are not set, auth is disabled
 * and the app stays open (handy for local dev and the demo).
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseEnabled = Boolean(config.apiKey && config.authDomain && config.appId)

export const auth: Auth | null = firebaseEnabled ? getAuth(initializeApp(config)) : null
