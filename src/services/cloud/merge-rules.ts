/**
 * The merge rules that decide who wins when a record exists both locally and
 * remotely.
 *
 * They are deliberately pure and dependency-free: this is the part of the sync
 * engine that is easy to get subtly wrong, and it should be readable — and
 * testable — without a database or a network.
 *
 * The single principle behind all of it is **last-write-wins per record**,
 * keyed on the record's own `updatedAt`:
 *
 *   - the remote replaces the local copy only when it is *strictly* newer, so a
 *     tie keeps the local copy and avoids pointless churn when both sides
 *     already agree;
 *   - the local copy is pushed only when the remote is not newer, so a push
 *     can never clobber a more recent edit made on another device.
 *
 * Push and pull therefore agree, which is what makes the merge symmetric: a
 * record that wins locally also survives the next pull, and one that wins
 * remotely is not overwritten by the next push.
 */

/** A record as the sync engine sees it. */
export interface MergeableRecord {
  id: string
  updatedAt?: number
}

/** A record that is about to be pushed, identified by its entity and id. */
export interface PushableRecord {
  entity: string
  id: string
  updatedAt: number
}

/** Stable key for a record within one account. */
export function recordKey(entity: string, id: string): string {
  return `${entity}:${id}`
}

/**
 * Does the remote copy win over the local one?
 *
 * `localUpdatedAt` is `-1` when there is no local record, which makes the
 * remote win by definition.
 */
export function remoteWins(remoteUpdatedAt: number, localUpdatedAt: number): boolean {
  return remoteUpdatedAt > localUpdatedAt
}

/**
 * Is the local copy safe to push?
 *
 * A record is skipped when the remote already holds a *strictly* newer
 * version. A tie is pushed: the two sides agree, so the write is a no-op, and
 * skipping it would leave the change-log cursor pointing at work that was
 * never sent.
 */
export function shouldPush(remoteUpdatedAt: number | null, localUpdatedAt: number): boolean {
  if (remoteUpdatedAt === null) return true
  return remoteUpdatedAt <= localUpdatedAt
}

/**
 * Split a batch into the records that may be pushed and the keys that must be
 * left alone because the remote already holds a newer version.
 */
export function partitionPushable<T extends PushableRecord>(
  records: T[],
  remoteUpdatedAtByKey: Map<string, number>,
): { pushable: T[]; skipped: string[] } {
  const pushable: T[] = []
  const skipped: string[] = []
  for (const record of records) {
    const key = recordKey(record.entity, record.id)
    const remote = remoteUpdatedAtByKey.get(key)
    if (shouldPush(remote ?? null, record.updatedAt)) pushable.push(record)
    else skipped.push(key)
  }
  return { pushable, skipped }
}

/**
 * Advance the pull cursor.
 *
 * The cursor moves to the newest `server_at` seen, whether or not the row was
 * applied. That matters for rows this build does not understand: skipping
 * them without advancing would re-fetch them on every pull and, once there
 * are more of them than the page size, would stall the pull completely.
 */
export function advanceCursor(current: string | null, serverAt: string | null | undefined): string | null {
  if (!serverAt) return current
  if (!current) return serverAt
  return serverAt > current ? serverAt : current
}
