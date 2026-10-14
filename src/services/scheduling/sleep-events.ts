import {
  addDaysToKey,
  combineDateTime,
  dateKeyRange,
  isOvernight,
  minutesToTimeKey,
  timeKeyToMinutes,
  toDateKey,
  toTimeKey,
  weekdayOf,
  type DateKey,
  type Millis,
} from '@/lib/date'
import { createDefaultReminders } from '@/config/defaults'
import type {
  ScheduledEvent,
  SleepSchedule,
  SleepScheduleException,
  SleepSession,
  TimeKey,
  WeekSchedule,
  Weekday,
} from '@/types'

/** Deterministic id for the generated sleep block of one night. */
export function sleepEventId(date: DateKey): string {
  return `sleep__${date}`
}

export function isSleepEvent(event: ScheduledEvent): boolean {
  return event.category === 'sleep'
}

/** Which half of the schedule governs the night that starts on `date`. */
export function scheduleForNight(schedule: SleepSchedule, date: DateKey): WeekSchedule {
  const day = weekdayOf(date)
  if (schedule.weekendDays.includes(day)) return schedule.weekend
  if (schedule.weekend.days.includes(day) && !schedule.weekday.days.includes(day)) {
    return schedule.weekend
  }
  return schedule.weekday
}

export interface PlannedNight {
  date: DateKey
  bedtime: TimeKey
  wakeTime: TimeKey
  /** Calendar day the alarm lands on. */
  wakeDate: DateKey
  bedtimeMillis: Millis
  wakeMillis: Millis
  /** Minutes between bedtime and wake time — i.e. the sleep opportunity. */
  timeInBedMinutes: number
  sleepOnsetMinutes: number
  windDownMinutes: number
  /** Minutes actually asleep if the user goes to sleep after `sleepOnsetMinutes`. */
  expectedSleepMinutes: number
  windDownStart: TimeKey
  source: 'weekday' | 'weekend' | 'exception'
  enabled: boolean
}

/**
 * Resolve the planned night that starts on `date`, honouring single-day
 * exceptions. Bedtimes after midnight (e.g. 00:30) are supported because the
 * block is expressed as bedtime → wake time rolling forward.
 */
export function plannedNight(
  schedule: SleepSchedule,
  date: DateKey,
  exceptions: SleepScheduleException[] = [],
): PlannedNight | null {
  const exception = exceptions.find((row) => row.date === date)
  const base = scheduleForNight(schedule, date)

  const useException = exception && (exception.bedtime || exception.wakeTime)
  if (!schedule.enabled && !useException) return null
  if (!schedule.enabled && useException && !exception) return null

  const bedtime = exception?.bedtime ?? base.bedtime
  const wakeTime = exception?.wakeTime ?? base.wakeTime
  if (!bedtime || !wakeTime) return null

  const bedtimeMillis = combineDateTime(date, bedtime, 0)
  const overnight = isOvernight(bedtime, wakeTime)
  const wakeMillis = combineDateTime(date, wakeTime, overnight ? 1 : 0)
  const timeInBedMinutes = Math.max(0, Math.round((wakeMillis - bedtimeMillis) / 60_000))
  const onset = base.sleepOnsetMinutes
  const windDownMinutes = base.windDownMinutes

  return {
    date,
    bedtime,
    wakeTime,
    wakeDate: toDateKey(wakeMillis),
    bedtimeMillis,
    wakeMillis,
    timeInBedMinutes,
    sleepOnsetMinutes: onset,
    windDownMinutes,
    expectedSleepMinutes: Math.max(0, timeInBedMinutes - onset),
    windDownStart: minutesToTimeKey(timeKeyToMinutes(bedtime) - windDownMinutes),
    source: useException ? 'exception' : schedule.weekendDays.includes(weekdayOf(date)) ? 'weekend' : 'weekday',
    enabled: schedule.enabled || Boolean(useException),
  }
}

export function plannedNights(
  schedule: SleepSchedule,
  from: DateKey,
  to: DateKey,
  exceptions: SleepScheduleException[] = [],
): PlannedNight[] {
  const nights: PlannedNight[] = []
  for (const date of dateKeyRange(from, to)) {
    const night = plannedNight(schedule, date, exceptions)
    if (night) nights.push(night)
  }
  return nights
}

/**
 * Turn the sleep schedule into ordinary `ScheduledEvent` rows so the calendar,
 * timetable, reminders and conflict detection all see sleep without any
 * special-casing.
 *
 * The generated events are *virtual*: they are recomputed from the schedule on
 * every render and are never persisted, which keeps a nightly schedule and a
 * one-off edit from fighting each other.
 */
export function sleepEventsForRange(
  schedule: SleepSchedule,
  from: DateKey,
  to: DateKey,
  exceptions: SleepScheduleException[] = [],
  sessions: SleepSession[] = [],
  options: { includeWindDown?: boolean } = {},
): ScheduledEvent[] {
  const now = Date.now()
  const events: ScheduledEvent[] = []

  for (const night of plannedNights(schedule, from, to, exceptions)) {
    if (!night.enabled) continue
    const session = sessions.find((row) => row.date === night.date)
    const overnight = isOvernight(night.bedtime, night.wakeTime)

    events.push({
      id: sleepEventId(night.date),
      title: session ? 'Sleep (recorded)' : 'Sleep',
      description:
        night.source === 'exception'
          ? 'Single-night exception to your sleep schedule'
          : `Planned ${night.bedtime} → ${night.wakeTime}`,
      category: 'sleep',
      date: night.date,
      startTime: night.bedtime,
      endTime: night.wakeTime,
      overnight,
      status: session ? 'completed' : 'planned',
      priority: 'high',
      subjectId: null,
      projectId: null,
      projectTaskId: null,
      taskId: null,
      location: '',
      meetingUrl: '',
      reminders: createDefaultReminders(),
      recurrence: null,
      seriesId: 'sleep-schedule',
      occurrenceDate: night.date,
      isSeriesTemplate: false,
      conflictAcknowledged: false,
      plannedMinutes: night.timeInBedMinutes,
      actualMinutes: session?.timeInBedMinutes ?? null,
      startedAt: session?.startAt ?? null,
      finishedAt: session?.endAt ?? null,
      notes: session?.notes ?? '',
      createdAt: now,
      updatedAt: now,
    })

    if (options.includeWindDown && night.windDownMinutes > 0) {
      const windDownOvernight = timeKeyToMinutes(night.windDownStart) > timeKeyToMinutes(night.bedtime)
      events.push({
        id: `winddown__${night.date}`,
        title: 'Wind-down routine',
        description: `${night.windDownMinutes} minutes before a ${night.bedtime} bedtime`,
        category: 'personal',
        date: night.date,
        startTime: night.windDownStart,
        endTime: night.bedtime,
        overnight: windDownOvernight,
        status: 'planned',
        priority: 'medium',
        subjectId: null,
        projectId: null,
        projectTaskId: null,
        taskId: null,
        location: '',
        meetingUrl: '',
        reminders: createDefaultReminders(),
        recurrence: null,
        seriesId: 'winddown-schedule',
        occurrenceDate: night.date,
        isSeriesTemplate: false,
        conflictAcknowledged: false,
        plannedMinutes: night.windDownMinutes,
        actualMinutes: null,
        startedAt: null,
        finishedAt: null,
        notes: '',
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  return events
}

/* -------------------------------------------------------------------------- */
/* Session calculations                                                      */
/* -------------------------------------------------------------------------- */

export interface SessionMath {
  timeInBedMinutes: number
  estimatedSleepMinutes: number | null
  awakeMinutes: number
}

/**
 * `estimatedSleep = (wake − sleep onset) − awake time`
 *
 * When the sleep onset is unknown we return `null` for the estimate rather than
 * pretending time-in-bed was actual sleep.
 */
export function computeSessionMath(session: {
  startAt: Millis
  endAt: Millis | null
  sleepOnsetAt: Millis | null
  awakeMinutes: number
  awakenings: { minutes: number }[]
}): SessionMath {
  const end = session.endAt ?? Date.now()
  const timeInBedMinutes = Math.max(0, Math.round((end - session.startAt) / 60_000))
  const awakeningMinutes = session.awakenings.reduce((total, row) => total + row.minutes, 0)
  const awakeMinutes = Math.max(session.awakeMinutes, awakeningMinutes)

  if (session.sleepOnsetAt === null) {
    return { timeInBedMinutes, estimatedSleepMinutes: null, awakeMinutes }
  }
  const onset = Math.max(session.sleepOnsetAt, session.startAt)
  const asleep = Math.round((end - onset) / 60_000) - awakeMinutes
  return {
    timeInBedMinutes,
    estimatedSleepMinutes: Math.max(0, asleep),
    awakeMinutes,
  }
}

/* -------------------------------------------------------------------------- */
/* Onboarding helpers                                                        */
/* -------------------------------------------------------------------------- */

export function defaultSleepScheduleFor(days: Weekday[]): WeekSchedule {
  return {
    days,
    bedtime: '23:00',
    wakeTime: '07:00',
    sleepOnsetMinutes: 15,
    windDownMinutes: 30,
    enabled: true,
  }
}

/** Next wake-up instant from `now`, used for the dashboard countdown. */
export function nextWakeMillis(
  schedule: SleepSchedule,
  exceptions: SleepScheduleException[] = [],
  now = Date.now(),
): Millis | null {
  const today = toDateKey(now)
  for (let offset = -1; offset <= 3; offset += 1) {
    const night = plannedNight(schedule, addDaysToKey(today, offset), exceptions)
    if (night && night.wakeMillis > now) return night.wakeMillis
  }
  return null
}

/** The night whose block covers `now`, if any. */
export function currentNight(
  schedule: SleepSchedule,
  exceptions: SleepScheduleException[] = [],
  now = Date.now(),
): PlannedNight | null {
  const today = toDateKey(now)
  for (let offset = -2; offset <= 0; offset += 1) {
    const night = plannedNight(schedule, addDaysToKey(today, offset), exceptions)
    if (night && now >= night.bedtimeMillis && now < night.wakeMillis) return night
  }
  return null
}

export { toTimeKey }
