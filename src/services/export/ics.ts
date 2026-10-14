import type { RecurrenceRule, ScheduledEvent } from '@/types'
import { toDateKey } from '@/lib/date'

/** Escape text per RFC 5545 (commas, semicolons, newlines, backslashes). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Fold long lines at 75 octets as the spec requires. */
function foldLine(line: string): string {
  if (line.length <= 73) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 73))
  rest = rest.slice(73)
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 72)}`)
    rest = rest.slice(72)
  }
  return parts.join('\r\n')
}

function toIcsDateTime(dateKey: string, time: string): string {
  return `${dateKey.replace(/-/g, '')}T${time.replace(':', '')}00`
}

function toUtcStamp(ms: number): string {
  return `${new Date(ms).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

function recurrenceRule(rule: RecurrenceRule | null): string | null {
  if (!rule) return null
  const parts: string[] = []
  switch (rule.frequency) {
    case 'daily':
      parts.push('FREQ=DAILY')
      break
    case 'weekly':
      parts.push('FREQ=WEEKLY')
      break
    case 'weekdays':
      parts.push('FREQ=WEEKLY')
      break
    case 'weekends':
      parts.push('FREQ=WEEKLY')
      break
    case 'custom':
      parts.push('FREQ=WEEKLY')
      break
    default:
      return null
  }
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`)
  if (rule.frequency === 'weekdays') parts.push('BYDAY=MO,TU,WE,TH,FR')
  else if (rule.frequency === 'weekends') parts.push('BYDAY=SU,SA')
  else if (rule.byWeekday.length > 0) {
    const names = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
    parts.push(`BYDAY=${rule.byWeekday.map((day) => names[day]).join(',')}`)
  }
  if (rule.count !== null) parts.push(`COUNT=${rule.count}`)
  else if (rule.endDate) parts.push(`UNTIL=${toIcsDateTime(rule.endDate, '23:59')}`)
  return parts.join(';')
}

/**
 * Build an RFC 5545 calendar from scheduled blocks.
 *
 * Repeating blocks are exported as real `RRULE`s so they import into Google
 * Calendar, Apple Calendar and Outlook as a series rather than as duplicates.
 * Sleep blocks generated from the schedule are deliberately not exported: they
 * are a planning aid, not events on someone else's calendar.
 */
export function buildIcs(
  events: ScheduledEvent[],
  options: { calendarName?: string; now?: number } = {},
): string {
  const now = options.now ?? Date.now()
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Anusree Daily Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.calendarName ?? "Anusree's Daily Tracker")}`,
  ]

  for (const event of events) {
    const uid = `${event.isSeriesTemplate ? event.seriesId ?? event.id : event.id}@anusree-daily-tracker`
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${uid}`)
    lines.push(`DTSTAMP:${toUtcStamp(now)}`)
    lines.push(`SUMMARY:${escapeText(event.title)}`)

    if (event.isSeriesTemplate && event.recurrence) {
      lines.push(`DTSTART:${toIcsDateTime(event.recurrence.startDate, event.startTime)}`)
      lines.push(`DTEND:${toIcsDateTime(event.recurrence.startDate, event.endTime)}`)
      const rrule = recurrenceRule(event.recurrence)
      if (rrule) lines.push(`RRULE:${rrule}`)
    } else {
      lines.push(`DTSTART:${toIcsDateTime(event.date, event.startTime)}`)
      const endDate = event.overnight ? toDateKey(new Date(`${event.date}T00:00:00`).getTime() + 86_400_000) : event.date
      lines.push(`DTEND:${toIcsDateTime(endDate, event.endTime)}`)
    }

    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`)
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`)
    if (event.meetingUrl) lines.push(`URL:${event.meetingUrl}`)
    lines.push(`CATEGORIES:${escapeText(event.category)}`)
    lines.push(`STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`)
    if (event.reminders.enabled && event.reminders.offsetsMinutes.length > 0) {
      for (const offset of event.reminders.offsetsMinutes) {
        lines.push('BEGIN:VALARM')
        lines.push('ACTION:DISPLAY')
        lines.push(`TRIGGER:-PT${offset}M`)
        lines.push(`DESCRIPTION:${escapeText(event.title)}`)
        lines.push('END:VALARM')
      }
    }
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n')
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
