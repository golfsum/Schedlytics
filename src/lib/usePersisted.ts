import { useEffect, useState } from 'react'
import { sampleData } from './socialApi'

/**
 * useState that mirrors its value to localStorage so it survives reloads.
 * Safe on first render (reads synchronously) and no-ops if storage is blocked.
 */
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage unavailable (private mode / quota) - ignore */
    }
  }, [key, value])

  return [value, setValue] as const
}

/**
 * State for content that should ship with sample data in demo mode but start
 * empty (and persist) for real accounts.
 *
 * - Demo / sample mode: seeded with `sample`, never written to storage (the demo
 *   is throwaway and must not leak into a real account on the same browser).
 * - Real accounts: start from stored value or `empty`, and persist every change.
 */
export function useSeededState<T>(key: string, sample: T, empty: T) {
  const [value, setValue] = useState<T>(() => {
    if (sampleData) return sample
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? (JSON.parse(raw) as T) : empty
    } catch {
      return empty
    }
  })

  useEffect(() => {
    if (sampleData) return
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage unavailable (private mode / quota) - ignore */
    }
  }, [key, value])

  return [value, setValue] as const
}
