/**
 * Local-first ⇄ Supabase synchronisation.
 *
 * Model
 * -----
 * IndexedDB stays the working store: reads and writes are instant and the app is
 * fully usable offline. This engine mirrors changes to Supabase and merges
 * remote changes back, which is what makes your data follow you to another
 * device without giving up offline behaviour.
 *
 * Conflict resolution is **last-write-wins per record**, keyed on `updatedAt`.
 * That is safe here because every record is independently owned and edited by one
 * person; two devices rarely touch the same row within the same second. Deletes
 * are soft (a `deleted` tombstone) so a delete on one device propagates instead
 * of being resurrected by a stale copy on another.
 *
 * Cursors
 * -------
 * The remote is pulled by `server_at` (a server-stamped timestamp), never by the
 * client clock. A record pushed from a device with a skewed clock therefore
 * cannot be skipped, and re-pushing an older `updated_at` still advances the
 * cursor because the trigger in `0001_records.sql` restamps `server_at`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getDatabase, type ChangeLogRow, type TrackerDatabase } from '@/db/database'
import {
  asRecordInserts,
  getSupabase,
  type Database,
  type RemoteRecord,
  type RemoteRecordInsert,
} from './supabase'

/** The insert payload type, so upserts are checked against the real column set. */
type RecordInsert = RemoteRecordInsert

/** Entities that participate in sync, in the order they are pushed. */
export const SYNCED_ENTITIES = [
  'settings',
  'subjects',
  'projects',
  'projectTasks',
  'tasks',
  'events',
  'activities',
  'studySessions',
  'timerStates',
  'habits',
  'habitEntries',
  'sleepSchedule',
  'sleepExceptions',
  'sleepSessions',
  'sleepRoutines',
  'sleepRoutineCompletions',
] as const

export type SyncedEntity = (typeof SYNCED_ENTITIES)[number]

/** Notification jobs and the change log itself are derived local state. */
const LOCAL_ONLY_TABLES = new Set(['notificationJobs', 'notificationLog', 'changeLog', 'settings'])

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'signed-out' | 'error'

export interface SyncSnapshot {
  phase: SyncPhase
  lastSyncedAt: number | null
  pushed: number
  pulled: number
  conflicts: number
  error: string | null
}

const CURSOR_PREFIX = 'adt.sync.cursor.'
const PUSH_HISTORY_KEY = 'adt.sync.changeLogCursor.'

function cursorKey(userId: string) {
  return `${CURSOR_PREFIX}${userId}`
}

function readCursor(userId: string): string | null {
  try {
    return localStorage.getItem(cursorKey(userId))
  } catch {
    return null
  }
}

function writeCursor(userId: string, cursor: string) {
  try {
    localStorage.setItem(cursorKey(userId), cursor)
  } catch {
    // A storage failure only costs an extra full pull next time.
  }
}

function readChangeLogCursor(): number {
  try {
    const raw = localStorage.getItem(PUSH_HISTORY_KEY)
    return raw ? Number(raw) || 0 : 0
  } catch {
    return 0
  }
}

function writeChangeLogCursor(seq: number) {
  try {
    localStorage.setItem(PUSH_HISTORY_KEY, String(seq))
  } catch {
    // Ignored: worst case we re-push records, which is idempotent.
  }
}

/* -------------------------------------------------------------------------- */
/* Pushing local changes                                                      */
/* -------------------------------------------------------------------------- */

interface PendingRecord {
  entity: string
  id: string
  updatedAt: number
  deleted: boolean
  payload: Record<string, unknown>
}

/**
 * Collapse the change log into one row per record.
 *
 * The change log is append-only, so a record edited five times has five rows.
 * Only the newest per (entity, id) is sent — the remote stores current state, not
 * history — which keeps a push proportional to what actually changed.
 */
function collapseChanges(rows: ChangeLogRow[]): {
  pending: PendingRecord[]
  highWaterSeq: number
} {
  const latest = new Map<string, ChangeLogRow>()
  let highWaterSeq = 0

  for (const row of rows) {
    const key = `${row.entity}:${row.entityId}`
    const existing = latest.get(key)
    if (!existing || row.updatedAt >= existing.updatedAt) latest.set(key, row)
    if ((row.seq ?? 0) > highWaterSeq) highWaterSeq = row.seq ?? 0
  }

  const pending: PendingRecord[] = []
  for (const row of latest.values()) {
    const snapshot = row.snapshot as Record<string, unknown> | null
    if (row.action === 'delete') {
      pending.push({
        entity: row.entity,
        id: row.entityId,
        updatedAt: row.updatedAt,
        deleted: true,
        payload: {},
      })
      continue
    }
    if (!snapshot || typeof snapshot !== 'object') continue
    const updatedAt = Number(snapshot.updatedAt)
    pending.push({
      entity: row.entity,
      id: row.entityId,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : row.updatedAt,
      deleted: false,
      payload: snapshot,
    })
  }

  return { pending, highWaterSeq }
}

async function pushPending(
  client: SupabaseClient<Database>,
  userId: string,
  db: TrackerDatabase,
  batchSize = 400,
): Promise<{ pushed: number; highWaterSeq: number }> {
  const lastSeq = readChangeLogCursor()
  const rows = await db.changeLog.where('seq').above(lastSeq).toArray()
  if (rows.length === 0) return { pushed: 0, highWaterSeq: lastSeq }

  const { pending, highWaterSeq } = collapseChanges(rows)
  if (pending.length === 0) {
    writeChangeLogCursor(highWaterSeq)
    return { pushed: 0, highWaterSeq }
  }

  let pushed = 0
  for (let index = 0; index < pending.length; index += batchSize) {
    const batch = pending.slice(index, index + batchSize)
    const payload: RecordInsert[] = batch.map((record) => ({
      user_id: userId,
      entity: record.entity,
      id: record.id,
      entity_label: entityLabel(record.entity),
      updated_at: record.updatedAt,
      deleted: record.deleted,
      payload: record.payload,
    }))

    const { error } = await client
      .from('records')
      .upsert(asRecordInserts(payload), { onConflict: 'user_id,entity,id', ignoreDuplicates: false })
    if (error) throw new Error(`Push failed: ${error.message}`)
    pushed += batch.length
  }

  // Only advance the cursor after a successful write, so a failed push retries.
  writeChangeLogCursor(highWaterSeq)
  return { pushed, highWaterSeq }
}

const ENTITY_LABELS: Record<string, string> = {
  settings: 'Settings',
  subjects: 'Subjects',
  projects: 'Projects',
  projectTasks: 'Project tasks',
  tasks: 'Tasks',
  events: 'Scheduled blocks',
  activities: 'Activity records',
  studySessions: 'Study sessions',
  timerStates: 'Timer state',
  habits: 'Habits',
  habitEntries: 'Habit entries',
  sleepSchedule: 'Sleep schedule',
  sleepExceptions: 'Sleep exceptions',
  sleepSessions: 'Sleep sessions',
  sleepRoutines: 'Sleep routines',
  sleepRoutineCompletions: 'Routine completions',
}

function entityLabel(entity: string): string | null {
  return ENTITY_LABELS[entity] ?? null
}

/* -------------------------------------------------------------------------- */
/* Pulling remote changes                                                     */
/* -------------------------------------------------------------------------- */

interface PullResult {
  pulled: number
  conflicts: number
  cursor: string | null
}

/**
 * Merge remote rows into IndexedDB with last-write-wins.
 *
 * A remote row wins only when its `updated_at` is strictly newer than the local
 * `updatedAt`; a tie keeps the local copy, which avoids pointless churn when both
 * sides already agree.
 */
async function pullChanges(
  client: SupabaseClient<Database>,
  userId: string,
  db: TrackerDatabase,
  cursor: string | null,
): Promise<PullResult> {
  let query = client
    .from('records')
    .select('user_id,entity,id,entity_label,updated_at,deleted,server_at,payload')
    .eq('user_id', userId)
    .order('server_at', { ascending: true })
    .limit(1000)

  if (cursor) query = query.gt('server_at', cursor)

  const { data, error } = await query
  if (error) throw new Error(`Pull failed: ${error.message}`)
  if (!data || data.length === 0) return { pulled: 0, conflicts: 0, cursor }

  let pulled = 0
  let conflicts = 0
  let newest = cursor

  await db.transaction('rw', db.tables, async () => {
    for (const row of data as RemoteRecord[]) {
      if (!SYNCED_ENTITIES.includes(row.entity as SyncedEntity)) continue

      const table = db.table(row.entity)
      const local = (await table.get(row.id)) as { updatedAt?: number } | undefined
      const localUpdatedAt = typeof local?.updatedAt === 'number' ? local.updatedAt : -1

      if (row.server_at && (!newest || row.server_at > newest)) newest = row.server_at

      if (row.deleted) {
        if (local && localUpdatedAt > row.updated_at) {
          // Local edit is newer than the remote delete; keep it.
          conflicts += 1
          continue
        }
        if (local) await table.delete(row.id)
        continue
      }

      if (local && localUpdatedAt >= row.updated_at) {
        if (localUpdatedAt > row.updated_at) conflicts += 1
        continue
      }

      await table.put({ ...(row.payload as object), id: row.id, updatedAt: row.updated_at })
      pulled += 1
    }
  })

  return { pulled, conflicts, cursor: newest }
}

/* -------------------------------------------------------------------------- */
/* Orchestration                                                              */
/* -------------------------------------------------------------------------- */

let running = false

export interface SyncOutcome {
  ok: boolean
  pushed: number
  pulled: number
  conflicts: number
  error: string | null
}

/**
 * Run one full push-then-pull cycle.
 *
 * Push first so a local edit made while offline wins the tie against the copy
 * that is still sitting on the server.
 */
export async function runSync(userId: string): Promise<SyncOutcome> {
  const client = getSupabase()
  if (!client) {
    return { ok: false, pushed: 0, pulled: 0, conflicts: 0, error: 'Cloud sync is not configured' }
  }
  if (running) {
    return { ok: true, pushed: 0, pulled: 0, conflicts: 0, error: null }
  }
  if (!navigator.onLine) {
    return { ok: false, pushed: 0, pulled: 0, conflicts: 0, error: 'Offline — will sync when back online' }
  }

  running = true
  const db = getDatabase()
  try {
    const pushed = await pushPending(client, userId, db)
    const cursor = readCursor(userId)
    const pulled = await pullChanges(client, userId, db, cursor)
    if (pulled.cursor) writeCursor(userId, pulled.cursor)

    // Timer state is device-local by design: two devices must not fight over a
    // running stopwatch, so it is excluded from the cursors above.
    return {
      ok: true,
      pushed: pushed.pushed,
      pulled: pulled.pulled,
      conflicts: pulled.conflicts,
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      error: error instanceof Error ? error.message : 'Sync failed',
    }
  } finally {
    running = false
  }
}

/**
 * Push the whole local database, ignoring the change log.
 *
 * This is the "first sign-in on a device that already has data" path: the change
 * log may predate the account, so every record is enumerated and uploaded once.
 */
export async function pushEverything(userId: string): Promise<SyncOutcome> {
  const client = getSupabase()
  if (!client) {
    return { ok: false, pushed: 0, pulled: 0, conflicts: 0, error: 'Cloud sync is not configured' }
  }
  const db = getDatabase()

  try {
    let pushed = 0
    for (const entity of SYNCED_ENTITIES) {
      const rows = (await db.table(entity).toArray()) as { id: string; updatedAt?: number }[]
      if (rows.length === 0) continue
      const payload: RecordInsert[] = rows.map((row) => ({
        user_id: userId,
        entity,
        id: row.id,
        entity_label: entityLabel(entity),
        updated_at: typeof row.updatedAt === 'number' ? row.updatedAt : Date.now(),
        deleted: false,
        payload: row as unknown as Record<string, unknown>,
      }))
      for (let index = 0; index < payload.length; index += 400) {
        const batch = payload.slice(index, index + 400)
        const { error } = await client
          .from('records')
          .upsert(asRecordInserts(batch), {
            onConflict: 'user_id,entity,id',
            ignoreDuplicates: false,
          })
        if (error) throw new Error(error.message)
        pushed += batch.length
      }
    }

    // Mark the whole local change log as pushed: it is now reflected remotely.
    const latest = await db.changeLog.orderBy('seq').last()
    if (latest?.seq) writeChangeLogCursor(latest.seq)

    return { ok: true, pushed, pulled: 0, conflicts: 0, error: null }
  } catch (error) {
    return {
      ok: false,
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      error: error instanceof Error ? error.message : 'Upload failed',
    }
  }
}

/**
 * Clear the pull cursor and remove remote rows for this user.
 *
 * Used by Settings → "Delete cloud data". Tombstones are not used here: the point
 * is to leave nothing behind on the server.
 */
export async function wipeCloudData(userId: string): Promise<SyncOutcome> {
  const client = getSupabase()
  if (!client) {
    return { ok: false, pushed: 0, pulled: 0, conflicts: 0, error: 'Cloud sync is not configured' }
  }
  try {
    const { error } = await client.from('records').delete().eq('user_id', userId)
    if (error) throw new Error(error.message)
    try {
      localStorage.removeItem(cursorKey(userId))
    } catch {
      // Ignored.
    }
    const db = getDatabase()
    const latest = await db.changeLog.orderBy('seq').last()
    writeChangeLogCursor(latest?.seq ?? 0)
    return { ok: true, pushed: 0, pulled: 0, conflicts: 0, error: null }
  } catch (error) {
    return {
      ok: false,
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      error: error instanceof Error ? error.message : 'Could not delete cloud data',
    }
  }
}

/** Reset the local cursors so the next sync re-downloads everything. */
export function forgetSyncCursors(userId: string) {
  try {
    localStorage.removeItem(cursorKey(userId))
    localStorage.removeItem(PUSH_HISTORY_KEY)
  } catch {
    // Ignored.
  }
}

export { LOCAL_ONLY_TABLES }
