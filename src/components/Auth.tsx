import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth, firebaseEnabled } from '../lib/firebase'
import { demoMode } from '../lib/socialApi'
import { clearLocalUserData } from '../lib/sync'
import LoginScreen from './LoginScreen'

export interface AppUser {
  /** Firebase UID (absent in demo mode). */
  uid?: string
  name: string
  email: string
  photoURL?: string
}

interface AuthValue {
  user: AppUser | null
  loading: boolean
  /** True when Firebase is configured and we are not in demo mode. */
  authRequired: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  registerWithEmail: (email: string, password: string) => Promise<void>
  signOutUser: () => Promise<void>
}

// Stand-in user for demo mode / when auth is disabled.
const DEMO_USER: AppUser = {
  name: 'Alex Rivera',
  email: 'alex@schedlytics.io',
  photoURL: 'https://i.pravatar.cc/80?img=12',
}

const AuthContext = createContext<AuthValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

const authRequired = firebaseEnabled && !demoMode

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(authRequired ? null : DEMO_USER)
  const [loading, setLoading] = useState(authRequired)

  useEffect(() => {
    if (!authRequired || !auth) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (fb) => {
      setUser(
        fb
          ? { uid: fb.uid, name: fb.displayName || fb.email || 'You', email: fb.email || '', photoURL: fb.photoURL || undefined }
          : null,
      )
      setLoading(false)
    })
  }, [])

  const signInWithGoogle = async () => {
    if (auth) await signInWithPopup(auth, new GoogleAuthProvider())
  }
  const signInWithEmail = async (email: string, password: string) => {
    if (auth) await signInWithEmailAndPassword(auth, email, password)
  }
  const registerWithEmail = async (email: string, password: string) => {
    if (auth) await createUserWithEmailAndPassword(auth, email, password)
  }
  const signOutUser = async () => {
    if (auth) await signOut(auth)
    // Wipe this account's local data so the next sign-in never inherits it.
    try {
      clearLocalUserData()
      localStorage.removeItem('sl_uid')
    } catch {
      /* ignore */
    }
    window.location.assign('/') // leave the app for the marketing site
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, authRequired, signInWithGoogle, signInWithEmail, registerWithEmail, signOutUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/** Renders the login screen until the user is authenticated (when auth is on). */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, authRequired } = useAuth()

  if (!authRequired) return <>{children}</>
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-navy-950 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-accent/30 border-t-cyan-accent" />
      </div>
    )
  }
  if (!user) return <LoginScreen />
  return <>{children}</>
}
