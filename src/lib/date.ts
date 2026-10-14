import {
  addDays,
  addMinutes,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { DateKey, Millis, TimeKey, Weekday } from '@/types'

// Re-exported so callers can pull date helpers and date types from one place.
export type { DateKey, Millis, TimeKey, Weekday } from '@/types'

export const DAY_MS = 86_400_000
export const MINUTE_MS = 60_000

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

/* -------------------------------------------------------------------------- */
/* DateKey helpers — a DateKey is always a LOCAL calendar day                 */
/* -------------------------------------------------------------------------- */

export function toDateKey(date: Date | Millis): DateKey {
  return format(typeof date === 'number' ? new Date(date) : date, 'yyyy-MM-dd')
}

export function fromDateKey(key: DateKey): Date {
  return parse(key, 'yyyy-MM-dd', new Date())
}

export function todayKey(): DateKey {
  return toDateKey(new Date())
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  const parsed = fromDateKey(key)
  return !Number.isNaN(parsed.getTime()) && toDateKey(parsed) === key
}

export function addDaysToKey(key: DateKey, days: number): DateKey {
  return toDateKey(addDays(fromDateKey(key), days))
}

export function diffInDays(a: DateKey, b: DateKey): number {
  return differenceInCalendarDays(fromDateKey(a), fromDateKey(b))
}

export function isKeyToday(key: DateKey): boolean {
  return key === todayKey()
}

export function isKeyBefore(a: DateKey, b: DateKey): boolean {
  return a < b
}

export function clampDateKey(key: DateKey, min: DateKey | null, max: DateKey | null): DateKey {
  if (min && key < min) return min
  if (max && key > max) return max
  return key
}

export function weekdayOf(key: DateKey): Weekday {
  return fromDateKey(key).getDay() as Weekday
}

export function weekdayName(key: DateKey, long = false): string {
  const day = weekdayOf(key)
  return long ? WEEKDAY_LONG[day] : WEEKDAY_LABELS[day]
}

/** Inclusive list of days between two DateKeys. */
export function dateKeyRange(from: DateKey, to: DateKey): DateKey[] {
  if (from > to) return []
  const start = fromDateKey(from)
  const end = fromDateKey(to)
  // Guard against accidentally enormous ranges.
  if (differenceInCalendarDays(end, start) > 1500) return []
  return eachDayOfInterval({ start, end }).map(toDateKey)
}

export function weekStartKey(key: DateKey, weekStartsOn: Weekday): DateKey {
  return toDateKey(startOfWeek(fromDateKey(key), { weekStartsOn }))
}

export function weekEndKey(key: DateKey, weekStartsOn: Weekday): DateKey {
  return toDateKey(endOfWeek(fromDateKey(key), { weekStartsOn }))
}

export function weekKeys(key: DateKey, weekStartsOn: Weekday): DateKey[] {
  return dateKeyRange(weekStartKey(key, weekStartsOn), weekEndKey(key, weekStartsOn))
}

export function monthGridKeys(monthAnchor: DateKey, weekStartsOn: Weekday): DateKey[] {
  const anchor = fromDateKey(monthAnchor)
  const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn })
  const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn })
  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map(toDateKey)
}

/* -------------------------------------------------------------------------- */
/* TimeKey helpers — `HH:mm` in local time                                    */
/* -------------------------------------------------------------------------- */

export function toTimeKey(date: Date | Millis): TimeKey {
  return format(typeof date === 'number' ? new Date(date) : date, 'HH:mm')
}

export function parseTimeKey(time: TimeKey): { hours: number; minutes: number } {
  const [h, m] = time.split(':')
  return { hours: Number(h) || 0, minutes: Number(m) || 0 }
}

export function isValidTimeKey(time: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false
  const { hours, minutes } = parseTimeKey(time)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

export function timeKeyToMinutes(time: TimeKey): number {
  const { hours, minutes } = parseTimeKey(time)
  return hours * 60 + minutes
}

export function minutesToTimeKey(totalMinutes: number): TimeKey {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function nowTimeKey(): TimeKey {
  return toTimeKey(new Date())
}

/**
 * Combine a calendar day and wall-clock time into an epoch timestamp.
 * `dayOffset` shifts the result by whole days (used for overnight blocks).
 */
export function combineDateTime(key: DateKey, time: TimeKey, dayOffset = 0): Millis {
  const base = addDays(fromDateKey(key), dayOffset)
  const { hours, minutes } = parseTimeKey(time)
  const withTime = new Date(base)
  withTime.setHours(hours, minutes, 0, 0)
  return withTime.getTime()
}

/** Duration in minutes between two wall-clock times, rolling past midnight. */
export function durationMinutes(start: TimeKey, end: TimeKey): number {
  const startMin = timeKeyToMinutes(start)
  const endMin = timeKeyToMinutes(end)
  const raw = endMin - startMin
  return raw > 0 ? raw : raw === 0 ? 1440 : raw + 1440
}

export function isOvernight(start: TimeKey, end: TimeKey): boolean {
  return timeKeyToMinutes(end) <= timeKeyToMinutes(start)
}

export function rangesOverlap(
  aStart: Millis,
  aEnd: Millis,
  bStart: Millis,
  bEnd: Millis,
): number {
  const overlapStart = Math.max(aStart, bStart)
  const overlapEnd = Math.min(aEnd, bEnd)
  if (overlapEnd <= overlapStart) return 0
  return Math.round((overlapEnd - overlapStart) / MINUTE_MS)
}

/* -------------------------------------------------------------------------- */
/* Display helpers                                                            */
/* -------------------------------------------------------------------------- */

export interface ClockFormatOptions {
  timeFormat: '12h' | '24h'
}

export function formatClock(time: TimeKey, opts: ClockFormatOptions): string {
  const { hours, minutes } = parseTimeKey(time)
  if (opts.timeFormat === '24h') {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const display = hours % 12 === 0 ? 12 : hours % 12
  return `${display}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export function formatClockFromMillis(ms: Millis, opts: ClockFormatOptions): string {
  return formatClock(toTimeKey(ms), opts)
}

export function formatDayLabel(key: DateKey, opts: { withYear?: boolean } = {}): string {
  const date = fromDateKey(key)
  const pattern = opts.withYear ? 'EEE, d MMM yyyy' : 'EEE, d MMM'
  return format(date, pattern)
}

export function formatLongDate(key: DateKey): string {
  return format(fromDateKey(key), 'EEEE, d MMMM yyyy')
}

export function formatMonthYear(key: DateKey): string {
  return format(fromDateKey(key), 'MMMM yyyy')
}

export function relativeDayLabel(key: DateKey): string {
  const diff = diffInDays(key, todayKey())
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff < 7) return formatDayLabel(key)
  if (diff < -1 && diff > -7) return formatDayLabel(key)
  return format(fromDateKey(key), 'd MMM')
}

export function greetingForNow(now = new Date()): string {
  const hour = now.getHours()
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Good night'
}

export function isSameDateKey(a: DateKey, b: DateKey) {
  return a === b
}

/** `90` -> `1h 30m`. Re-exported here so date-driven modules share one entry point. */
export { formatMinutes } from './utils'

export function startOfToday(): Date {
  return startOfDay(new Date())
}

export function addMinutesToMillis(ms: Millis, minutes: number) {
  return addMinutes(new Date(ms), minutes).getTime()
}

export { isSameDay, isToday, startOfDay, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth }
