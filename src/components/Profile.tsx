import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './Auth'
import { sampleData } from '../lib/socialApi'

export interface ProfileData {
  name: string
  email: string
  photoURL: string
  bio: string
}

interface ProfileContextValue extends ProfileData {
  /** Merge and persist profile edits (no-op persistence in demo mode). */
  save: (patch: Partial<ProfileData>) => void
}

const KEY = 'sl_profile'
const SAMPLE_BIO = 'Creator & marketer. Fashion, lifestyle, and a little chaos.'

const ProfileContext = createContext<ProfileContextValue | null>(null)

/**
 * The user's editable profile. Starts from the authenticated account, then
 * layers locally-saved overrides on top. Demo mode is never persisted.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [overrides, setOverrides] = useState<Partial<ProfileData>>(() => {
    if (sampleData) return {}
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? (JSON.parse(raw) as Partial<ProfileData>) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    if (sampleData) return
    try {
      localStorage.setItem(KEY, JSON.stringify(overrides))
    } catch {
      /* storage unavailable - ignore */
    }
  }, [overrides])

  // A saved field (even an empty string) wins over the account default.
  const value: ProfileContextValue = {
    name: overrides.name ?? user?.name ?? '',
    email: overrides.email ?? user?.email ?? '',
    photoURL: overrides.photoURL ?? user?.photoURL ?? '',
    bio: overrides.bio ?? (sampleData ? SAMPLE_BIO : ''),
    save: (patch) => setOverrides((o) => ({ ...o, ...patch })),
  }

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider')
  return ctx
}

/** Initials for an avatar placeholder, derived from name or email. */
export function initialsOf(name: string, email: string) {
  const src = (name || email || '?').trim()
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 1).toUpperCase()
}
