import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import type { PlatformId } from '../types'
import { PLATFORMS } from '../data'
import { useToast } from './Toast'
import {
  backendEnabled,
  startConnect,
  fetchAccounts,
  disconnectAccount,
  type RemoteAccount,
} from '../lib/socialApi'

export interface Account {
  connected: boolean
  /** True while the OAuth handshake is in progress. */
  connecting: boolean
  handle?: string
  followers?: string
}

/** Platforms the user can connect their accounts to. */
export const CONNECTABLE: PlatformId[] = [
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'pinterest',
  'twitch',
  'patreon',
]

// Demo seed (used when no backend is configured).
const INITIAL: Record<string, Account> = {
  instagram: { connected: true, connecting: false, handle: '@alex.creates', followers: '128K' },
  facebook: { connected: true, connecting: false, handle: 'Alex Creates', followers: '54K' },
  tiktok: { connected: false, connecting: false },
  youtube: { connected: false, connecting: false },
  pinterest: { connected: false, connecting: false },
  twitch: { connected: false, connecting: false },
  patreon: { connected: false, connecting: false },
}

// Plausible handles/follower counts assigned on connect in demo mode.
const PROFILE: Record<string, { handle: string; followers: string }> = {
  instagram: { handle: '@alex.creates', followers: '128K' },
  facebook: { handle: 'Alex Creates', followers: '54K' },
  tiktok: { handle: '@alexcreates', followers: '92K' },
  youtube: { handle: 'Alex Creates', followers: '41K' },
  pinterest: { handle: 'alexcreates', followers: '18K' },
  twitch: { handle: 'alexcreates', followers: '23K' },
  patreon: { handle: 'Alex Creates', followers: '1.4K' },
}

interface ConnectionsValue {
  accounts: Record<string, Account>
  connectedCount: number
  /** True when wired to the real OAuth backend (vs. demo simulation). */
  live: boolean
  connect: (id: PlatformId) => void
  disconnect: (id: PlatformId) => void
}

const ConnectionsContext = createContext<ConnectionsValue | null>(null)

export function useConnections() {
  const ctx = useContext(ConnectionsContext)
  if (!ctx) throw new Error('useConnections must be used within a ConnectionsProvider')
  return ctx
}

/** Format a follower number into a compact string (12345 → "12.3K"). */
function compact(n?: number): string | undefined {
  if (n === undefined) return undefined
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function toAccount(r: RemoteAccount): Account {
  return {
    connected: r.connected,
    connecting: false,
    handle: r.handle,
    followers: compact(r.followers),
  }
}

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const { addToast } = useToast()
  const [accounts, setAccounts] = useState<Record<string, Account>>(
    backendEnabled
      ? Object.fromEntries(CONNECTABLE.map((id) => [id, { connected: false, connecting: false }]))
      : INITIAL,
  )

  /** Pull real connection status from the backend. */
  const refresh = useCallback(async () => {
    if (!backendEnabled) return
    try {
      const remote = await fetchAccounts()
      setAccounts((prev) => {
        const next = { ...prev }
        for (const id of CONNECTABLE) {
          if (remote[id]) next[id] = toAccount(remote[id])
        }
        return next
      })
    } catch {
      /* backend unreachable — keep what we have */
    }
  }, [])

  // On mount (live mode): load accounts and handle the OAuth return params.
  useEffect(() => {
    if (!backendEnabled) return
    refresh()

    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const error = params.get('error')
    if (connected && PLATFORMS[connected as PlatformId]) {
      addToast(`${PLATFORMS[connected as PlatformId].name} connected! 🔗`)
      refresh()
    } else if (error) {
      addToast(`Connection failed: ${error}`, 'info')
    }
    if (connected || error) {
      // Clean the query string so a refresh doesn't re-toast.
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [refresh, addToast])

  const connect = useCallback(
    (id: PlatformId) => {
      if (backendEnabled) {
        // Real OAuth: redirect to the provider's consent screen.
        setAccounts((a) => ({ ...a, [id]: { ...a[id], connecting: true } }))
        startConnect(id)
        return
      }
      // Demo: simulate an OAuth handshake.
      setAccounts((a) => ({ ...a, [id]: { ...a[id], connecting: true } }))
      window.setTimeout(() => {
        setAccounts((a) => ({
          ...a,
          [id]: { connected: true, connecting: false, ...PROFILE[id] },
        }))
        addToast(`${PLATFORMS[id].name} connected! 🔗`)
      }, 1300)
    },
    [addToast],
  )

  const disconnect = useCallback(
    (id: PlatformId) => {
      if (backendEnabled) {
        disconnectAccount(id).finally(refresh)
      }
      setAccounts((a) => ({ ...a, [id]: { connected: false, connecting: false } }))
      addToast(`${PLATFORMS[id].name} disconnected`, 'info')
    },
    [addToast, refresh],
  )

  const connectedCount = Object.values(accounts).filter((a) => a.connected).length

  return (
    <ConnectionsContext.Provider
      value={{ accounts, connectedCount, live: backendEnabled, connect, disconnect }}
    >
      {children}
    </ConnectionsContext.Provider>
  )
}
