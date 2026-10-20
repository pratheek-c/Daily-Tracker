import { describe, expect, it } from 'vitest'
import {
  advanceCursor,
  partitionPushable,
  recordKey,
  remoteWins,
  shouldPush,
  type PushableRecord,
} from './merge-rules'

function record(entity: string, id: string, updatedAt: number): PushableRecord {
  return { entity, id, updatedAt }
}

describe('recordKey', () => {
  it('separates entity and id so different tables cannot collide', () => {
    expect(recordKey('tasks', 'a')).toBe('tasks:a')
    expect(recordKey('habits', 'a')).toBe('habits:a')
    expect(recordKey('tasks', 'a')).not.toBe(recordKey('habits', 'a'))
  })
})

describe('remoteWins', () => {
  it('lets the remote win only when it is strictly newer', () => {
    expect(remoteWins(200, 100)).toBe(true)
    expect(remoteWins(100, 200)).toBe(false)
  })

  it('keeps the local copy on a tie', () => {
    // A tie means both sides already agree, so replacing the local record
    // would be pure churn.
    expect(remoteWins(100, 100)).toBe(false)
  })

  it('treats a missing local record as losing', () => {
    expect(remoteWins(100, -1)).toBe(true)
  })
})

describe('shouldPush', () => {
  it('pushes when the record is unknown remotely', () => {
    expect(shouldPush(null, 100)).toBe(true)
  })

  it('refuses to push over a strictly newer remote copy', () => {
    // This is the data-loss case: the local snapshot is older than the one
    // already on the server, so pushing it would destroy the newer edit.
    expect(shouldPush(200, 100)).toBe(false)
  })

  it('pushes on a tie, so the change-log cursor can advance', () => {
    expect(shouldPush(100, 100)).toBe(true)
  })

  it('pushes when the local copy is newer', () => {
    expect(shouldPush(100, 200)).toBe(true)
  })
})

describe('partitionPushable', () => {
  it('skips records whose remote copy is newer', () => {
    const batch = [record('tasks', 'a', 100), record('tasks', 'b', 300)]
    // The remote holds 400 for "b" while the local copy is 300, so pushing the
    // local one would destroy the newer remote edit.
    const remote = new Map([[recordKey('tasks', 'b'), 400]])

    const { pushable, skipped } = partitionPushable(batch, remote)

    expect(pushable.map((item) => item.id)).toEqual(['a'])
    expect(skipped).toEqual(['tasks:b'])
  })

  it('keeps a local record that is newer than the remote copy', () => {
    const batch = [record('tasks', 'b', 300)]
    const remote = new Map([[recordKey('tasks', 'b'), 200]])

    const { pushable, skipped } = partitionPushable(batch, remote)

    expect(pushable.map((item) => item.id)).toEqual(['b'])
    expect(skipped).toEqual([])
  })

  it('keeps everything when the remote has no versions at all', () => {
    const batch = [record('tasks', 'a', 100), record('events', 'b', 200)]
    const { pushable, skipped } = partitionPushable(batch, new Map())

    expect(pushable).toHaveLength(2)
    expect(skipped).toHaveLength(0)
  })

  it('never matches across entities that share an id', () => {
    // A task and a habit can legitimately share an id; the remote version of
    // one must not suppress the other.
    const batch = [record('tasks', 'shared', 100), record('habits', 'shared', 100)]
    const remote = new Map([[recordKey('tasks', 'shared'), 500]])

    const { pushable } = partitionPushable(batch, remote)

    expect(pushable.map((item) => item.entity)).toEqual(['habits'])
  })
})

describe('advanceCursor', () => {
  it('takes the first server stamp it is given', () => {
    expect(advanceCursor(null, '2026-03-01T00:00:00Z')).toBe('2026-03-01T00:00:00Z')
  })

  it('moves forward only', () => {
    expect(advanceCursor('2026-03-02T00:00:00Z', '2026-03-01T00:00:00Z')).toBe(
      '2026-03-02T00:00:00Z',
    )
    expect(advanceCursor('2026-03-01T00:00:00Z', '2026-03-02T00:00:00Z')).toBe(
      '2026-03-02T00:00:00Z',
    )
  })

  it('keeps the current cursor when there is no server stamp', () => {
    expect(advanceCursor('2026-03-01T00:00:00Z', null)).toBe('2026-03-01T00:00:00Z')
    expect(advanceCursor('2026-03-01T00:00:00Z', undefined)).toBe('2026-03-01T00:00:00Z')
  })
})
