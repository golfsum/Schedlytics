/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Schedlytics backend (e.g. http://localhost:8787). Unset = demo mode. */
  readonly VITE_API_URL?: string
  /** Firebase Auth (public client config). Unset = auth disabled. */
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
