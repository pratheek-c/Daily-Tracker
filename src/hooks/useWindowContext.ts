import { useMemo } from 'react'
import { useApp } from '@/app/AppContext'
import { detectConflicts, type Conflict, type Occurrence } from '@/services/scheduling/recurrence'
import type { DateKey } from '@/types'

export interface WindowContext {
  occurrences: Occurrence[]
  conflicts: Conflict[]
  activities: import('@/types').ActivityRecord[]
}

/**
 * Occurrences, overlaps and activity logs for one date window.
 *
 * Memoised on the underlying records, so a page can ask for a window on every
 * render without re-expanding recurring series each time.
 */
export function useWindowContext(from: DateKey, to: DateKey): WindowContext {
  const { data, timeline, revision } = useApp()
  const { activities, events } = data

  return useMemo(
    () => {
      const occurrences = timeline(from, to)
      return {
        occurrences,
        // Generated sleep blocks intentionally overlap nothing, but a study
        // block landing on planned sleep is a conflict worth surfacing.
        conflicts: detectConflicts(occurrences, { ignoreAcknowledged: true }),
        activities: activities.filter((record) => record.date >= from && record.date <= to),
      }
    },
    // `revision` is included so derived work re-runs after a mutation even when
    // the live query returns an equivalent snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from, to, timeline, activities, events, revision],
  )
}

/** Occurrences bucketed by calendar day, for month and agenda views. */
export function useOccurrenceIndex(from: DateKey, to: DateKey) {
  const { occurrences } = useWindowContext(from, to)
  return useMemo(() => {
    const map = new Map<DateKey, Occurrence[]>()
    for (const occurrence of occurrences) {
      const list = map.get(occurrence.date) ?? []
      list.push(occurrence)
      map.set(occurrence.date, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.startMillis - b.startMillis)
    return map
  }, [occurrences])
}
