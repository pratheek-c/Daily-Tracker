import { combineDateTime } from '@/lib/date'
import type { NotificationCategory, NotificationJob, ScheduledEvent } from '@/types'
import type { Occurrence } from '@/services/scheduling/recurrence'

/** Icon-free prefix derived from the reminder category. */
const CATEGORY_PREFIX: Record<NotificationCategory, string> = {
  study: 'Study time!',
  project: 'Project time!',
  assignment: 'Assignment reminder',
  activity: 'Coming up',
  habit: 'Habit check-in',
  winddown: 'Wind-down time',
  bedtime: 'Bedtime',
  wakeup: 'Good morning',
  pomodoro: 'Focus timer',
}

export function notificationTitle(category: NotificationCategory): string {
  return CATEGORY_PREFIX[category]
}

export function categoryForEvent(event: ScheduledEvent): NotificationCategory {
  switch (event.category) {
    case 'study':
      return 'study'
    case 'project':
      return 'project'
    case 'assignment':
      return 'assignment'
    default:
      return 'activity'
  }
}

/**
 * Stable identity for one reminder.
 *
 * The dedupe key is what stops a reload, a re-render or a second tab from
 * firing the same reminder twice: jobs are keyed by the record they belong to,
 * the concrete occurrence, and the offset.
 */
export function dedupeKey(parts: {
  refType: NotificationJob['refType']
  refId: string | null
  occurrenceKey?: string
  offsetMinutes: number
}): string {
  return [
    parts.refType,
    parts.refId ?? 'none',
    parts.occurrenceKey ?? '-',
    `o${parts.offsetMinutes}`,
  ].join(':')
}

export function sourceKeyForEvent(event: ScheduledEvent, occurrenceDate: string): string {
  const series = event.seriesId ?? event.id
  return `event:${series}:${occurrenceDate}`
}

export interface ReminderBuildOptions {
  /** Offsets are interpreted as "minutes before start". */
  maxOffsets?: number
  /** Skip reminders that would have fired more than this long ago. */
  graceMinutes?: number
  now?: number
}

/**
 * Build the reminder jobs for one occurrence. The caller is responsible for
 * persisting them; anything whose `fireAt` is already long past is dropped so
 * a late page load does not spam the notification centre.
 */
export function buildEventReminderJobs(
  occurrence: Occurrence,
  options: ReminderBuildOptions = {},
): NotificationJob[] {
  const event = occurrence.event
  if (!event.reminders.enabled) return []
  const now = options.now ?? Date.now()
  const grace = (options.graceMinutes ?? 2) * 60_000
  const offsets = Array.from(new Set(event.reminders.offsetsMinutes))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b)
    .slice(0, options.maxOffsets ?? 6)

  const category = categoryForEvent(event)
  const sourceKey = sourceKeyForEvent(event, occurrence.date)

  return offsets.map((offset) => {
    const fireAt = occurrence.startMillis - offset * 60_000
    const when =
      offset === 0 ? 'is starting now' : `starts in ${offset === 60 ? 'an hour' : `${offset} minutes`}`
    return {
      id: `${sourceKey}:${offset}`,
      dedupeKey: dedupeKey({
        refType: 'event',
        refId: event.id,
        occurrenceKey: occurrence.date,
        offsetMinutes: offset,
      }),
      fireAt: Math.max(fireAt, now + grace >= fireAt ? fireAt : now + grace),
      title: `${notificationTitle(category)} ${event.title}`,
      body: `${event.title} ${when}.`,
      category,
      refType: 'event' as const,
      refId: event.id,
      sourceKey,
      createdAt: now,
    }
  })
}

/** Bedtime, wind-down and wake-up reminders for one planned night. */
export function buildSleepReminderJobs(
  input: {
    date: string
    bedtime: string
    wakeTime: string
    bedtimeMillis: number
    wakeMillis: number
    windDownStart: string
  },
  prefs: {
    windDownReminderEnabled: boolean
    windDownReminderMinutes: number
    bedtimeReminderEnabled: boolean
    bedtimeReminderMinutes: number
    wakeReminderEnabled: boolean
    wakeReminderMinutes: number
  },
  now = Date.now(),
): NotificationJob[] {
  const jobs: NotificationJob[] = []
  const sourceKey = `sleep:${input.date}`

  if (prefs.windDownReminderEnabled) {
    const fireAt = input.bedtimeMillis - prefs.windDownReminderMinutes * 60_000
    jobs.push({
      id: `${sourceKey}:winddown`,
      dedupeKey: dedupeKey({
        refType: 'routine',
        refId: 'winddown',
        occurrenceKey: input.date,
        offsetMinutes: prefs.windDownReminderMinutes,
      }),
      fireAt,
      title: 'Wind-down time',
      body: `Anusree, your wind-down routine starts in ${prefs.windDownReminderMinutes} minutes. Tonight's plan: sleep at ${input.bedtime}.`,
      category: 'winddown',
      refType: 'routine',
      refId: 'winddown',
      sourceKey,
      createdAt: now,
    })
  }

  if (prefs.bedtimeReminderEnabled) {
    jobs.push({
      id: `${sourceKey}:bedtime`,
      dedupeKey: dedupeKey({
        refType: 'routine',
        refId: 'bedtime',
        occurrenceKey: input.date,
        offsetMinutes: prefs.bedtimeReminderMinutes,
      }),
      fireAt: input.bedtimeMillis - prefs.bedtimeReminderMinutes * 60_000,
      title: 'Bedtime soon',
      body: `Lights out at ${input.bedtime}. Sweet dreams ♡`,
      category: 'bedtime',
      refType: 'routine',
      refId: 'bedtime',
      sourceKey,
      createdAt: now,
    })
  }

  if (prefs.wakeReminderEnabled) {
    jobs.push({
      id: `${sourceKey}:wake`,
      dedupeKey: dedupeKey({
        refType: 'routine',
        refId: 'wake',
        occurrenceKey: input.date,
        offsetMinutes: prefs.wakeReminderMinutes,
      }),
      fireAt: input.wakeMillis - prefs.wakeReminderMinutes * 60_000,
      title: 'Good morning',
      body: `Your planned wake-up time (${input.wakeTime}) is coming up.`,
      category: 'wakeup',
      refType: 'routine',
      refId: 'wake',
      sourceKey,
      createdAt: now,
    })
  }

  return jobs.filter((job) => job.fireAt > now - 12 * 60 * 60 * 1000)
}

export function buildTaskReminderJob(input: {
  taskId: string
  title: string
  kind: 'assignment' | 'project-task' | 'task' | 'exam' | 'personal'
  dueDate: string
  dueTime: string
  now?: number
}): NotificationJob {
  const now = input.now ?? Date.now()
  const dueMillis = combineDateTime(input.dueDate, input.dueTime, 0)
  const category: NotificationCategory =
    input.kind === 'assignment' ? 'assignment' : input.kind === 'project-task' ? 'project' : 'activity'
  const fireAt = dueMillis - 60 * 60_000
  const sourceKey = `task:${input.taskId}`
  return {
    id: `${sourceKey}:due`,
    dedupeKey: dedupeKey({
      refType: 'task',
      refId: input.taskId,
      occurrenceKey: input.dueDate,
      offsetMinutes: 60,
    }),
    fireAt,
    title: category === 'assignment' ? 'Assignment due soon' : 'Task due soon',
    body: `${input.title} is due at ${input.dueTime} today.`,
    category,
    refType: 'task',
    refId: input.taskId,
    sourceKey,
    createdAt: now,
  }
}

export function buildHabitReminderJob(input: {
  habitId: string
  name: string
  date: string
  reminderTime: string
  now?: number
}): NotificationJob {
  const now = input.now ?? Date.now()
  const sourceKey = `habit:${input.habitId}:${input.date}`
  return {
    id: sourceKey,
    dedupeKey: dedupeKey({
      refType: 'habit',
      refId: input.habitId,
      occurrenceKey: input.date,
      offsetMinutes: 0,
    }),
    fireAt: combineDateTime(input.date, input.reminderTime, 0),
    title: 'Habit check-in',
    body: `Did you tick off “${input.name}” today?`,
    category: 'habit',
    refType: 'habit',
    refId: input.habitId,
    sourceKey,
    createdAt: now,
  }
}

/** Progress note shown when a study/Pomodoro timer finishes. */
export function buildPomodoroJob(
  input: { sessionKey: string; label: string; kind: 'focus' | 'break'; now?: number },
): NotificationJob {
  const now = input.now ?? Date.now()
  const sourceKey = `pomodoro:${input.sessionKey}:${input.kind}`
  return {
    id: sourceKey,
    dedupeKey: dedupeKey({
      refType: 'timer',
      refId: input.sessionKey,
      occurrenceKey: input.kind,
      offsetMinutes: 0,
    }),
    fireAt: now,
    title: input.kind === 'focus' ? 'Focus block complete' : 'Break finished',
    body:
      input.kind === 'focus'
        ? `${input.label} done. Time for a break — stand up and stretch.`
        : 'Break over. Ready for the next focus block?',
    category: 'pomodoro',
    refType: 'timer',
    refId: input.sessionKey,
    sourceKey,
    createdAt: now,
  }
}
