import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useCloudAuth, cloudUserId, type CloudAuthState } from '@/services/cloud/auth'
import { isCloudConfigured, getSupabase } from '@/services/cloud/supabase'
import {
  forgetSyncCursors,
  pushEverything,
  readLastLocalUserId,
  runSync,
  wipeCloudData,
  wipeLocalData,
  writeLastLocalUserId,
  type SyncOutcome,
} from '@/services/cloud/sync'

export type CloudPhase = 'local-only' | 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error'

/** The phase a sync run reported. Whether the user is signed in or online is derived separately. */
type ActivityPhase = 'idle' | 'syncing' | 'error'

export interface RemoteEntityCount {
  entity: string
  live: number
  tombstones: number
}

export interface CloudContextValue extends CloudAuthState {
  configured: boolean
  phase: CloudPhase
  lastSyncedAt: number | null
  lastError: string | null
  pendingLocalChanges: number
  autoSync: boolean
  setAutoSync: (enabled: boolean) => void
  syncNow: () => Promise<SyncOutcome>
  uploadEverything: () => Promise<SyncOutcome>
  deleteCloudData: () => Promise<SyncOutcome>
  /** Records synced from the remote, for the Settings summary. */
  remoteCounts: RemoteEntityCount[] | null
  refreshRemoteCounts: () => Promise<void>
}

const CloudContext = createContext<CloudContextValue | null>(null)

const AUTO_SYNC_KEY = 'adt.sync.auto'

export function CloudProvider({ children }: { children: ReactNode }) {
  const auth = useCloudAuth()
  const userId = cloudUserId(auth.session)

  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [pendingLocalChanges, setPendingLocalChanges] = useState(0)
  const [remoteCounts, setRemoteCounts] = useState<RemoteEntityCount[] | null>(null)
  const [autoSync, setAutoSyncState] = useState(() => {
    try {
      return localStorage.getItem(AUTO_SYNC_KEY) !== '0'
    } catch {
      return true
    }
  })

  const inFlight = useRef(false)
  const uploadedFor = useRef<string | null>(null)
  const debounceHandle = useRef<number | null>(null)
  /** Resolves once the local store is guaranteed clean of any previous account. */
  const isolatedFor = useRef<Promise<void> | null>(null)

  const setAutoSync = useCallback((enabled: boolean) => {
    setAutoSyncState(enabled)
    try {
      localStorage.setItem(AUTO_SYNC_KEY, enabled ? '1' : '0')
    } catch {
      // Preference persistence is best-effort.
    }
  }, [])

  /* -- online/offline awareness ----------------------------------------- */
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  /* -- phase --------------------------------------------------------------
   * Derived during render rather than written from an effect, so signing in or
   * losing the network never costs a redundant render pass. `activityPhase` is
   * the only part a sync run needs to set, and it is written from handlers.
   */
  const [activityPhase, setActivityPhase] = useState<ActivityPhase>('idle')

  const phase: CloudPhase = !isCloudConfigured
    ? 'local-only'
    : !userId
      ? 'signed-out'
      : activityPhase === 'syncing'
        ? 'syncing'
        : activityPhase === 'error'
          ? 'error'
          : !isOnline
            ? 'offline'
            : 'idle'

  /* -- local change counter, so Settings can show what is waiting ------- */
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const count = async () => {
      const { getDatabase } = await import('@/db/database')
      const db = getDatabase()
      const total = await db.changeLog.count()
      const cursor = Number(localStorage.getItem('adt.sync.changeLogCursor.') ?? 0)
      if (!cancelled) setPendingLocalChanges(Math.max(0, total - cursor))
    }
    const handle = window.setInterval(() => void count(), 5000)
    void count()
    return () => {
      cancelled = true
      window.clearInterval(handle)
    }
  }, [userId, lastSyncedAt])

  const syncNow = useCallback(async (): Promise<SyncOutcome> => {
    if (!userId) {
      return { ok: false, pushed: 0, pulled: 0, conflicts: 0, error: 'Not signed in' }
    }
    // Never touch the store before an in-flight account-switch wipe has finished.
    await isolatedFor.current
    if (inFlight.current) {
      return { ok: true, pushed: 0, pulled: 0, conflicts: 0, error: null }
    }
    inFlight.current = true
    setActivityPhase('syncing')
    try {
      const outcome = await runSync(userId)
      if (outcome.ok) {
        setLastSyncedAt(Date.now())
        setLastError(null)
        setActivityPhase('idle')
      } else {
        setLastError(outcome.error)
        // Going offline mid-sync is a normal condition, not a failure to report.
        setActivityPhase(navigator.onLine ? 'error' : 'idle')
      }
      return outcome
    } finally {
      inFlight.current = false
    }
  }, [userId])

  /* -- account isolation ----------------------------------------------------
   * The local store is shared by every account on the device. When a different
   * user signs in, the previous user's records must be removed before anything
   * is read from (or pushed into) the store. This runs even with autoSync off,
   * because the UI reads the store directly.
   */
  useEffect(() => {
    if (!userId) {
      isolatedFor.current = null
      return
    }
    const previousUserId = readLastLocalUserId()
    if (previousUserId !== null && previousUserId !== userId) {
      // A different account on this device: wipe before anything is read or pushed.
      // The mark is written only after the wipe so a crash mid-wipe re-wipes (harmless).
      isolatedFor.current = wipeLocalData().finally(() => writeLastLocalUserId(userId))
    } else {
      if (previousUserId === null) writeLastLocalUserId(userId)
      isolatedFor.current = null
    }
  }, [userId])

  /**
   * First sign-in on this device.
   *
   * If there is real local work, upload it once so nothing is lost; then pull.
   * If this is a fresh install with nothing but default settings, skip the
   * upload so a brand-new device cannot clobber the account's real data with
   * empty defaults — in that case the first pull simply downloads everything.
   */
  useEffect(() => {
    if (!userId || !autoSync) return
    if (uploadedFor.current === userId) return
    uploadedFor.current = userId
    void (async () => {
      // Wait for the account-switch wipe (if any) before reading or pushing.
      await isolatedFor.current
      const { hasLocalUserData } = await import('@/db/database')
      const substantial = await hasLocalUserData()
      if (substantial) {
        const outcome = await pushEverything(userId)
        if (!outcome.ok) {
          setLastError(outcome.error)
          uploadedFor.current = null
          return
        }
        setLastSyncedAt(Date.now())
        setLastError(null)
      }
      await syncNow()
    })()
  }, [userId, autoSync, syncNow])

  /* -- sync on a debounce after any local mutation ---------------------- */
  useEffect(() => {
    if (!userId || !autoSync) return
    const onLocalChange = () => {
      if (debounceHandle.current) window.clearTimeout(debounceHandle.current)
      // Debounced so a burst of edits (dragging, ticking habits) becomes one sync.
      debounceHandle.current = window.setTimeout(() => void syncNow(), 2500)
    }
    window.addEventListener('adt:data-changed', onLocalChange)
    return () => {
      window.removeEventListener('adt:data-changed', onLocalChange)
      if (debounceHandle.current) window.clearTimeout(debounceHandle.current)
    }
  }, [userId, autoSync, syncNow])

  /* -- sync on focus / visibility / reconnect -------------------------- */
  useEffect(() => {
    if (!userId || !autoSync) return
    const tick = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void syncNow()
    }
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    window.addEventListener('online', tick)
    // A slow safety net for a long-lived tab.
    const handle = window.setInterval(tick, 5 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
      window.removeEventListener('online', tick)
      window.clearInterval(handle)
    }
  }, [userId, autoSync, syncNow])

  const remoteCountsRefresh = useCallback(async () => {
    const client = getSupabase()
    if (!client || !userId) {
      setRemoteCounts(null)
      return
    }
    const { data, error } = await client
      .from('record_counts')
      .select('entity,live_rows,tombstoned_rows')
      .eq('user_id', userId)
    if (error || !data) {
      setRemoteCounts(null)
      return
    }
    setRemoteCounts(
      (data as unknown as { entity: string; live_rows: number; tombstoned_rows: number }[]).map(
        (row) => ({
          entity: row.entity,
          live: Number(row.live_rows ?? 0),
          tombstones: Number(row.tombstoned_rows ?? 0),
        }),
      ),
    )
  }, [userId])

  const uploadEverything = useCallback(async () => {
    if (!userId) {
      return { ok: false, pushed: 0, pulled: 0, conflicts: 0, error: 'Not signed in' }
    }
    await isolatedFor.current
    setActivityPhase('syncing')
    try {
      const outcome = await pushEverything(userId)
      setLastError(outcome.ok ? null : outcome.error)
      if (outcome.ok) setLastSyncedAt(Date.now())
      setActivityPhase(outcome.ok ? 'idle' : 'error')
      return outcome
    } finally {
      inFlight.current = false
    }
  }, [userId])
  const deleteCloudData = useCallback(async () => {
    if (!userId) {
      return { ok: false, pushed: 0, pulled: 0, conflicts: 0, error: 'Not signed in' }
    }
    const outcome = await wipeCloudData(userId)
    forgetSyncCursors(userId)
    setRemoteCounts(null)
    setLastError(outcome.ok ? null : outcome.error)
    return outcome
  }, [userId])

  const value = useMemo<CloudContextValue>(
    () => ({
      ...auth,
      configured: isCloudConfigured,
      phase,
      lastSyncedAt,
      lastError,
      pendingLocalChanges,
      autoSync,
      setAutoSync,
      syncNow,
      uploadEverything,
      deleteCloudData,
      remoteCounts,
      refreshRemoteCounts: remoteCountsRefresh,
    }),
    [
      auth,
      phase,
      lastSyncedAt,
      lastError,
      pendingLocalChanges,
      autoSync,
      setAutoSync,
      syncNow,
      uploadEverything,
      deleteCloudData,
      remoteCounts,
      remoteCountsRefresh,
    ],
  )

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>
}

export function useCloud(): CloudContextValue {
  const context = useContext(CloudContext)
  if (!context) throw new Error('useCloud must be used inside <CloudProvider>')
  return context
}
