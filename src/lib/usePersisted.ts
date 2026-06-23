import { useEffect, useState } from 'react'

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
