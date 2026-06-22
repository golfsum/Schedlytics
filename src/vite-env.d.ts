/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Schedlytics backend (e.g. http://localhost:8787). Unset = demo mode. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
