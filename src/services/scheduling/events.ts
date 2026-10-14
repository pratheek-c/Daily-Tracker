import { newId } from '@/lib/utils'
import { addDaysToKey, isOvernight, weekdayOf, type DateKey } from '@/lib/date'
import { createDefaultReminders } from '@/config/defaults'
import {
  buildOccurrences,
  createDailyRule,
  createWeeklyRule,
  detectConflicts,
  occurrenceFromEvent,
  type Conflict,
  type Occurrence,
} from './recurrence'
import type {
  ActivityCategory,
  ID,
  Priority,
  RecurrenceException,
  RecurrenceRule,
  ScheduledEvent,
  Weekday,
} from '@/types'

/* -------------------------------------------------------------------------- */
/* Factories                                                                  */
/* -------------------------------------------------------------------------- */

export interface NewEventInput {
  title: string
  category: ActivityCategory
  date: DateKey
  startTime: string
  endTime: string
  description?: string
  priority?: Priority
  subjectId?: ID | null
  projectId?: ID | null
  projectTaskId?: ID | null
  taskId?: ID | null
  location?: string
  meetingUrl?: string
  reminders?: { enabled: boolean; offsetsMinutes: number[] }
  recurrence?: RecurrenceRule | null
  plannedMinutes?: number | null
  notes?: string
}

export function createEvent(input: NewEventInput, now = Date.now()): ScheduledEvent {
  const overnight = isOvernight(input.startTime, input.endTime)
  const recurring = Boolean(input.recurrence)
  const id = newId('evt')
  return {
    id,
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    category: input.category,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    overnight,
    status: 'planned',
    priority: input.priority ?? 'medium',
    subjectId: input.subjectId ?? null,
    projectId: input.projectId ?? null,
    projectTaskId: input.projectTaskId ?? null,
    taskId: input.taskId ?? null,
    location: input.location?.trim() ?? '',
    meetingUrl: input.meetingUrl?.trim() ?? '',
    reminders: input.reminders ?? createDefaultReminders(),
    recurrence: input.recurrence ?? null,
    // A recurring event is stored once as its series template; occurrences are
    // generated on read so edits stay consistent across the whole series.
    seriesId: recurring ? id : null,
    occurrenceDate: recurring ? input.date : null,
    isSeriesTemplate: recurring,
    conflictAcknowledged: false,
    plannedMinutes: input.plannedMinutes ?? null,
    actualMinutes: null,
    startedAt: null,
    finishedAt: null,
    notes: input.notes?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  }
}

export interface NewRecurringInput extends Omit<NewEventInput, 'recurrence'> {
  frequency: RecurrenceRule['frequency']
  interval?: number
  byWeekday?: Weekday[]
  endDate?: DateKey | null
  count?: number | null
}

export function createRecurringEvent(input: NewRecurringInput, now = Date.now()): ScheduledEvent {
  const rule: RecurrenceRule =
    input.frequency === 'daily'
      ? {
          ...createDailyRule(input.date),
          interval: input.interval ?? 1,
          endDate: input.endDate ?? null,
          count: input.count ?? null,
        }
      : {
          ...createWeeklyRule(input.date, input.byWeekday),
          frequency: input.frequency,
          interval: input.interval ?? 1,
          endDate: input.endDate ?? null,
          count: input.count ?? null,
        }
  return createEvent({ ...input, recurrence: rule }, now)
}

/* -------------------------------------------------------------------------- */
/* Occurrence helpers                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Exceptions are stored as `cancelled` events carrying the series id and the
 * occurrence date the rule originally produced. Keeping them as ordinary rows
 * means they persist, export and (later) sync with no special table.
 */
export function exceptionsFromEvents(events: ScheduledEvent[]): RecurrenceException[] {
  return events
    .filter((event) => event.status === 'cancelled' && event.seriesId && event.occurrenceDate)
    .map((event) => ({
      seriesId: event.seriesId as string,
      originalDate: event.occurrenceDate as string,
      kind: 'cancelled' as const,
      reason: event.notes || undefined,
    }))
}

/** Stored events without the cancel-marker rows, ready for occurrence building. */
export function renderableEvents(events: ScheduledEvent[]): ScheduledEvent[] {
  const templates = events.filter((event) => event.isSeriesTemplate)
  const singles = events.filter(
    (event) => !event.isSeriesTemplate && event.status !== 'cancelled',
  )
  return [...templates, ...singles]
}

export function occurrencesFor(
  events: ScheduledEvent[],
  from: DateKey,
  to: DateKey,
): Occurrence[] {
  return buildOccurrences(renderableEvents(events), from, to, exceptionsFromEvents(events))
}

export function conflictsInRange(
  events: ScheduledEvent[],
  from: DateKey,
  to: DateKey,
): Conflict[] {
  return detectConflicts(occurrencesFor(events, from, to), { ignoreAcknowledged: true })
}

/** Conflicts for a candidate event before it is saved. */
export function conflictsForCandidate(
  candidate: ScheduledEvent,
  events: ScheduledEvent[],
  window = 3,
): Conflict[] {
  const from = addDaysToKey(candidate.date, -window)
  const to = addDaysToKey(candidate.date, window)
  const others = occurrencesFor(
    events.filter((event) => event.id !== candidate.id && event.seriesId !== candidate.seriesId),
    from,
    to,
  )
  const expanded = candidate.recurrence
    ? buildOccurrences([candidate], from, to, [])
    : [occurrenceFromEvent(candidate)]
  const out: Conflict[] = []
  for (const occurrence of expanded) {
    const nearby = others.filter(
      (other) => Math.abs(other.startMillis - occurrence.startMillis) < 36 * 60 * 60 * 1000,
    )
    out.push(...detectConflicts([occurrence, ...nearby]))
  }
  // Deduplicate pairs that repeat across occurrences of the same series.
  const seen = new Set<string>()
  return out.filter((conflict) => {
    const key = [conflict.a.event.id, conflict.b.event.id].sort().join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Detect work scheduled on top of planned sleep — called out separately in the UI. */
export function sleepOverlaps(conflicts: Conflict[]) {
  return conflicts.filter(
    (conflict) =>
      conflict.a.event.category === 'sleep' || conflict.b.event.category === 'sleep',
  )
}

export function duplicateEvent(event: ScheduledEvent, date?: DateKey, now = Date.now()): ScheduledEvent {
  return {
    ...event,
    id: newId('evt'),
    date: date ?? event.date,
    seriesId: null,
    occurrenceDate: null,
    isSeriesTemplate: false,
    recurrence: null,
    status: 'planned',
    actualMinutes: null,
    startedAt: null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function weekdayDefaults(date: DateKey): Weekday {
  return weekdayOf(date)
}
