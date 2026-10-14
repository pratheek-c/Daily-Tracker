import {
  addDaysToKey,
  combineDateTime,
  durationMinutes,
  fromDateKey,
  isOvernight,
  minutesToTimeKey,
  parseTimeKey,
  timeKeyToMinutes,
  toDateKey,
  toTimeKey,
  weekdayOf,
} from '@/lib/date'
import type { DateKey } from '@/lib/date'
import type {
  Occurrence,
  RecurrenceException,
  RecurrenceRule,
  ScheduledEvent,
  TimeKey,
  Weekday,
} from '@/types'

/* -------------------------------------------------------------------------- */
/* Rule evaluation                                                            */
/* -------------------------------------------------------------------------- */

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5]
const WEEKEND: Weekday[] = [0, 6]

/**
 * Rule-aware weekday test.
 *
 * For weekly-ish frequencies the rule repeats on its own multi-week rhythm
 * (rather than ISO week parity), which is what a planner actually wants:
 * "every 2 weeks on Mon & Thu, starting 3 Feb".
 */
function matchesWeekdayPattern(rule: RecurrenceRule, day: DateKey, anchor: DateKey): boolean {
  const target = weekdayOf(day)

  if (rule.frequency === 'weekdays') return WEEKDAYS.includes(target)
  if (rule.frequency === 'weekends') return WEEKEND.includes(target)

  const allowed =
    rule.frequency === 'weekly' || rule.frequency === 'custom'
      ? rule.byWeekday.length > 0
        ? rule.byWeekday
        : [weekdayOf(anchor)]
      : null

  if (allowed && !allowed.includes(target)) return false

  const interval = Math.max(1, Math.floor(rule.interval || 1))
  if (interval === 1) return true

  const anchorWeek = startOfWeekKey(anchor)
  const dayWeek = startOfWeekKey(day)
  const weeksApart = Math.round(
    (fromDateKey(dayWeek).getTime() - fromDateKey(anchorWeek).getTime()) / (7 * 86_400_000),
  )
  return weeksApart % interval === 0
}

function startOfWeekKey(key: DateKey): DateKey {
  const date = fromDateKey(key)
  const day = date.getDay()
  // Monday-based week boundaries keep the interval maths stable regardless of
  // the user's display preference for week start.
  const offset = (day + 6) % 7
  return addDaysToKey(key, -offset)
}

function isOnRule(rule: RecurrenceRule, day: DateKey): boolean {
  const safeRule: RecurrenceRule = {
    ...rule,
    interval: Math.max(1, rule.interval || 1),
    byWeekday: rule.byWeekday ?? [],
  }
  if (day < safeRule.startDate) return false
  if (safeRule.endDate && day > safeRule.endDate) return false

  if (safeRule.frequency === 'daily') {
    const diff = Math.round(
      (fromDateKey(day).getTime() - fromDateKey(safeRule.startDate).getTime()) / 86_400_000,
    )
    return diff >= 0 && diff % safeRule.interval === 0
  }

  return matchesWeekdayPattern(safeRule, day, safeRule.startDate)
}

/**
 * All dates a rule produces inside `[from, to]`.
 *
 * `count`-limited series are resolved against the full span from the series
 * start so the cap is honoured exactly, then trimmed to the requested window.
 * `hardLimit` protects against accidentally walking a decade of daily rules.
 */
export function expandRecurrence(
  rule: RecurrenceRule,
  from: DateKey,
  to: DateKey,
  opts: { hardLimit?: number } = {},
): DateKey[] {
  if (from > to) return []
  const hardLimit = opts.hardLimit ?? 366
  const windowEnd = rule.endDate && rule.endDate < to ? rule.endDate : to
  if (rule.startDate > windowEnd) return []

  if (rule.frequency === 'daily') {
    const interval = Math.max(1, rule.interval || 1)
    const dates: DateKey[] = []
    let cursor = rule.startDate
    let guard = 0
    while (cursor <= windowEnd && guard <= hardLimit) {
      guard += 1
      if (cursor >= from) dates.push(cursor)
      if (rule.count !== null && dates.length + countBefore(rule, from) >= rule.count) break
      cursor = addDaysToKey(cursor, interval)
    }
    return rule.count === null ? dates : applyCountLimit(rule, dates, from, to)
  }

  const dates: DateKey[] = []
  let cursor = from
  let guard = 0
  while (cursor <= windowEnd && guard <= hardLimit) {
    guard += 1
    if (isOnRule(rule, cursor)) dates.push(cursor)
    cursor = addDaysToKey(cursor, 1)
  }
  return rule.count === null ? dates : applyCountLimit(rule, dates, from, to)
}

function countBefore(rule: RecurrenceRule, from: DateKey): number {
  if (!rule.count) return 0
  if (from <= rule.startDate) return 0
  return expandRecurrence({ ...rule, count: null }, rule.startDate, addDaysToKey(from, -1), {
    hardLimit: rule.count + 7,
  }).length
}

function applyCountLimit(
  rule: RecurrenceRule,
  windowDates: DateKey[],
  from: DateKey,
  to: DateKey,
): DateKey[] {
  if (rule.count === null) return windowDates
  const before = countBefore(rule, from)
  const remaining = Math.max(0, rule.count - before)
  if (remaining === 0) return []
  // Recompute from the series start so the cap is exact, then slice the window.
  const all = expandRecurrence({ ...rule, count: null }, rule.startDate, to, { hardLimit: 4000 })
  return all.slice(before, before + remaining).filter((day) => day >= from && day <= to)
}

/** Human summary such as "Every week on Mon, Thu". */
export function describeRecurrence(rule: RecurrenceRule | null): string {
  if (!rule) return 'Does not repeat'
  const interval = Math.max(1, rule.interval || 1)
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayList = (rule.byWeekday ?? []).map((day) => names[day]).join(', ')

  let base: string
  switch (rule.frequency) {
    case 'daily':
      base = interval === 1 ? 'Every day' : `Every ${interval} days`
      break
    case 'weekly':
      base = interval === 1 ? 'Every week' : `Every ${interval} weeks`
      if (dayList) base += ` on ${dayList}`
      break
    case 'weekdays':
      base = 'Every weekday (Mon–Fri)'
      break
    case 'weekends':
      base = 'Every weekend'
      break
    case 'custom':
    default:
      base = interval === 1 ? 'Every week' : `Every ${interval} weeks`
      if (dayList) base += ` on ${dayList}`
      break
  }
  if (rule.endDate) base += ` until ${rule.endDate}`
  else if (rule.count !== null) base += `, ${rule.count} times`
  return base
}

export function createDailyRule(startDate: DateKey): RecurrenceRule {
  return { frequency: 'daily', interval: 1, byWeekday: [], startDate, endDate: null, count: null }
}

export function createWeeklyRule(startDate: DateKey, days?: Weekday[]): RecurrenceRule {
  return {
    frequency: 'weekly',
    interval: 1,
    byWeekday: days && days.length > 0 ? days : [weekdayOf(startDate)],
    startDate,
    endDate: null,
    count: null,
  }
}

/* -------------------------------------------------------------------------- */
/* Occurrences                                                               */
/* -------------------------------------------------------------------------- */

/**
 * An `Occurrence` is a scheduled event together with the concrete day it lands
 * on. The type is defined in `@/types` and re-exported here so callers of the
 * scheduling engine do not need a second import.
 */
export type { Occurrence } from '@/types'

export function occurrenceFromEvent(event: ScheduledEvent, date = event.date): Occurrence {
  const overnight = event.overnight || isOvernight(event.startTime, event.endTime)
  const startMillis = combineDateTime(date, event.startTime, 0)
  const endMillis = overnight
    ? combineDateTime(date, event.endTime, 1)
    : combineDateTime(date, event.endTime, 0)
  return {
    event,
    date,
    startTime: event.startTime,
    endTime: event.endTime,
    overnight,
    startMillis,
    endMillis: endMillis <= startMillis ? startMillis + 60_000 : endMillis,
    durationMinutes: Math.round((endMillis - startMillis) / 60_000),
  }
}

export function occurrencesOverlap(a: Occurrence, b: Occurrence): number {
  const start = Math.max(a.startMillis, b.startMillis)
  const end = Math.min(a.endMillis, b.endMillis)
  if (end <= start) return 0
  return Math.round((end - start) / 60_000)
}

/**
 * Expand a set of stored events into concrete occurrences for a date window.
 *
 * Series templates (`isSeriesTemplate`) are expanded through their rule and
 * then have exceptions applied. Concretely stored single events pass through.
 */
export function buildOccurrences(
  events: ScheduledEvent[],
  from: DateKey,
  to: DateKey,
  exceptions: RecurrenceException[] = [],
): Occurrence[] {
  const out: Occurrence[] = []
  const cancels = new Set(
    exceptions.filter((e) => e.kind === 'cancelled').map((e) => `${e.seriesId}|${e.originalDate}`),
  )
  const moves = new Map<string, RecurrenceException>(
    exceptions
      .filter((e) => e.kind === 'moved')
      .map((e) => [`${e.seriesId}|${e.originalDate}`, e] as const),
  )

  for (const event of events) {
    if (event.isSeriesTemplate) {
      if (!event.seriesId) continue
      // Fold the template's own day into the rule so a series whose start date
      // is outside the window still produces its in-window occurrences.
      const rule: RecurrenceRule = event.recurrence ?? createDailyRule(event.date)
      const dates = expandRecurrence(rule, from, to)

      for (const date of dates) {
        const key = `${event.seriesId}|${date}`
        if (cancels.has(key)) continue

        const move = moves.get(key)
        if (move && move.movedToDate) {
          const movedStart = move.movedToStart ?? event.startTime
          const movedEnd = move.movedToEnd ?? event.endTime
          out.push(
            occurrenceFromEvent(
              { ...event, startTime: movedStart, endTime: movedEnd, isSeriesTemplate: false },
              move.movedToDate,
            ),
          )
          continue
        }
        out.push(occurrenceFromEvent({ ...event, isSeriesTemplate: false }, date))
      }
      continue
    }

    // A stored occurrence that was individually moved into the window.
    if (event.date >= from && event.date <= to) out.push(occurrenceFromEvent(event))
  }

  return out.sort((a, b) => a.startMillis - b.startMillis || a.event.title.localeCompare(b.event.title))
}

/* -------------------------------------------------------------------------- */
/* Conflict detection                                                        */
/* -------------------------------------------------------------------------- */

export interface Conflict {
  a: Occurrence
  b: Occurrence
  overlapMinutes: number
}

export interface ConflictOptions {
  /** Overlaps shorter than this are treated as touching, not conflicting. */
  minimumOverlapMinutes?: number
  /** Categories that may happily overlap with each other (e.g. sleep + sleep). */
  ignoredSelfOverlap?: boolean
  ignoreAcknowledged?: boolean
}

/**
 * Find overlapping occurrences. Sleep overlapping study is a real conflict:
 * the brief asks us to warn when work is planned during planned sleep.
 */
export function detectConflicts(
  occurrences: Occurrence[],
  options: ConflictOptions = {},
): Conflict[] {
  const minimum = options.minimumOverlapMinutes ?? 1
  const sorted = [...occurrences].sort((a, b) => a.startMillis - b.startMillis)
  const conflicts: Conflict[] = []

  for (let i = 0; i < sorted.length; i += 1) {
    const a = sorted[i]
    if (options.ignoreAcknowledged && a.event.conflictAcknowledged) continue
    for (let j = i + 1; j < sorted.length; j += 1) {
      const b = sorted[j]
      // Because the list is start-sorted, once b starts after a ends no later
      // item can overlap a either.
      if (b.startMillis >= a.endMillis) break
      if (a.event.id === b.event.id) continue
      if (
        options.ignoredSelfOverlap &&
        a.event.category === b.event.category &&
        ['break', 'meal', 'sleep'].includes(a.event.category)
      ) {
        continue
      }
      const overlap = occurrencesOverlap(a, b)
      if (overlap >= minimum) conflicts.push({ a, b, overlapMinutes: overlap })
    }
  }
  return conflicts
}

export function conflictsForEvent(
  target: Occurrence,
  occurrences: Occurrence[],
  options: ConflictOptions = {},
): Conflict[] {
  const minimum = options.minimumOverlapMinutes ?? 1
  return occurrences
    .filter((other) => other.event.id !== target.event.id)
    .map((other) => ({ other, overlap: occurrencesOverlap(target, other) }))
    .filter((entry) => entry.overlap >= minimum)
    .map((entry) => ({ a: target, b: entry.other, overlapMinutes: entry.overlap }))
    .sort((x, y) => y.overlapMinutes - x.overlapMinutes)
}

/** Does this occurrence sit inside a planned sleep block? */
export function overlapsSleep(target: Occurrence, occurrences: Occurrence[]) {
  const sleepOccurrences = occurrences.filter((o) => o.event.category === 'sleep')
  return conflictsForEvent(target, sleepOccurrences).length > 0
}

/* -------------------------------------------------------------------------- */
/* Time helpers for the UI                                                    */
/* -------------------------------------------------------------------------- */

export function shiftOccurrence(
  occurrence: Occurrence,
  deltaMinutes: number,
): { date: DateKey; startTime: TimeKey; endTime: TimeKey } {
  const startMinutes = timeKeyToMinutes(occurrence.startTime) + deltaMinutes
  const dayShift = Math.floor(startMinutes / 1440)
  const normalizedStart = ((startMinutes % 1440) + 1440) % 1440
  const endMinutes = normalizedStart + occurrence.durationMinutes

  return {
    date: addDaysToKey(occurrence.date, dayShift),
    startTime: minutesToTimeKey(normalizedStart),
    endTime: minutesToTimeKey(endMinutes),
  }
}

/** Current position marker for day/week grids. */
export function timeIndicator(startTime: TimeKey, endTime: TimeKey, now = new Date()) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const start = timeKeyToMinutes(startTime)
  const end = timeKeyToMinutes(endTime)
  const total = end > start ? end - start : end + 1440 - start
  const elapsed = nowMinutes >= start ? nowMinutes - start : nowMinutes + 1440 - start
  return {
    minutes: nowMinutes,
    fraction: total <= 0 ? 0 : Math.min(1, Math.max(0, elapsed / total)),
  }
}

export function timeRangeLabel(start: TimeKey, end: TimeKey, format: (t: TimeKey) => string) {
  return `${format(start)} – ${format(end)}`
}

/**
 * Materialise a recurring series template + its exceptions into a concrete
 * block for one day. Used by "edit this occurrence only".
 */
export function concretizeOccurrence(event: ScheduledEvent, date: DateKey): ScheduledEvent {
  return {
    ...event,
    id: `${event.id}__${date}`,
    date,
    seriesId: event.seriesId,
    occurrenceDate: date,
    isSeriesTemplate: false,
    recurrence: null,
  }
}

export function seriesTemplateFrom(
  event: ScheduledEvent,
  rule: RecurrenceRule,
): ScheduledEvent {
  const seriesId = event.seriesId ?? event.id
  return {
    ...event,
    seriesId,
    occurrenceDate: event.date,
    isSeriesTemplate: true,
    recurrence: rule,
  }
}

/** Days a template occupies inside a window (used for calendar dots). */
export function occurrenceDatesByEvent(
  events: ScheduledEvent[],
  from: DateKey,
  to: DateKey,
  exceptions: RecurrenceException[] = [],
): Map<string, DateKey[]> {
  const map = new Map<string, DateKey[]>()
  for (const occurrence of buildOccurrences(events, from, to, exceptions)) {
    const key = occurrence.event.seriesId ?? occurrence.event.id
    const list = map.get(key) ?? []
    list.push(occurrence.date)
    map.set(key, list)
  }
  return map
}

/** Total planned minutes per day for a window. */
export function plannedMinutesByDay(occurrences: Occurrence[]) {
  const map = new Map<DateKey, number>()
  for (const occurrence of occurrences) {
    map.set(occurrence.date, (map.get(occurrence.date) ?? 0) + occurrence.durationMinutes)
  }
  return map
}

export { durationMinutes, toDateKey, toTimeKey, parseTimeKey, timeKeyToMinutes, minutesToTimeKey }
