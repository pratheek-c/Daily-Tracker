/**
 * Core domain types for Anusree's Daily Tracker.
 *
 * Conventions
 * -----------
 * - Every record carries a string `id` (uuid) so it can be merged across
 *   devices without collisions when cloud sync is added later.
 * - `createdAt` / `updatedAt` are epoch milliseconds.
 * - Calendar days are stored as `DateKey` = `YYYY-MM-DD` (local calendar day,
 *   never a UTC instant) so a "day" always means the user's own day.
 * - Wall-clock times are stored as `TimeKey` = `HH:mm` (24h) and are interpreted
 *   in the device's local timezone.
 */

export type ID = string
export type Millis = number
/** Local calendar day, `YYYY-MM-DD`. */
export type DateKey = string
/** Local wall-clock time, `HH:mm` (24-hour). */
export type TimeKey = string
/** Day of week, 0 = Sunday … 6 = Saturday (matches `Date#getDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/* -------------------------------------------------------------------------- */
/* Shared enums                                                               */
/* -------------------------------------------------------------------------- */

export const ACTIVITY_CATEGORIES = [
  'study',
  'project',
  'college',
  'assignment',
  'sleep',
  'meal',
  'exercise',
  'break',
  'personal',
  'other',
] as const
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type Priority = (typeof PRIORITIES)[number]

/** Lifecycle of a scheduled activity or planned block. */
export const ACTIVITY_STATUSES = [
  'planned',
  'in-progress',
  'completed',
  'missed',
  'cancelled',
] as const
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number]

export const PROJECT_STATUSES = ['planning', 'active', 'paused', 'completed', 'archived'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const TASK_STATUSES = ['todo', 'in-progress', 'blocked', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_KINDS = ['task', 'assignment', 'exam', 'project-task', 'personal'] as const
export type TaskKind = (typeof TASK_KINDS)[number]

export type ReminderPreset = 'at-time' | 0 | 5 | 10 | 15 | 30 | 60

export const NOTIFICATION_CATEGORIES = [
  'study',
  'project',
  'assignment',
  'activity',
  'habit',
  'winddown',
  'bedtime',
  'wakeup',
  'pomodoro',
] as const
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

/* -------------------------------------------------------------------------- */
/* Recurrence                                                                 */
/* -------------------------------------------------------------------------- */

export type RecurrenceFrequency = 'daily' | 'weekly' | 'weekdays' | 'weekends' | 'custom'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  /** Interval in frequency units (1 = every day/week). */
  interval: number
  /** For `weekly` / `custom`: which weekdays the series repeats on. */
  byWeekday: Weekday[]
  /** Inclusive first day the series applies to. */
  startDate: DateKey
  /** Inclusive last day; `null` means "never ends". */
  endDate: DateKey | null
  /** How many occurrences to generate, if the series is count-limited. */
  count: number | null
}

/** A cancelled or modified occurrence inside an otherwise recurring series. */
export interface RecurrenceException {
  /** `seriesId` of the parent event. */
  seriesId: ID
  /** The occurrence date that the original rule produced. */
  originalDate: DateKey
  /** `cancelled` drops the occurrence; `moved` keeps a pointer to another day. */
  kind: 'cancelled' | 'moved'
  movedToDate?: DateKey
  movedToStart?: TimeKey
  movedToEnd?: TimeKey
  reason?: string
}

/* -------------------------------------------------------------------------- */
/* Structured values                                                          */
/* -------------------------------------------------------------------------- */

export interface ReminderSpec {
  preset: ReminderPreset
  /** Absolute fire time, resolved when the reminder job is created. */
  offsetMinutes: number
}

export interface ChecklistItem {
  id: ID
  label: string
  done: boolean
}

export interface ReminderSettings {
  enabled: boolean
  /** Minutes before the start; 0 = at start time. Multiple values allowed. */
  offsetsMinutes: number[]
}

export interface WeekSchedule {
  /** Weekdays this schedule is active on. */
  days: Weekday[]
  bedtime: TimeKey
  wakeTime: TimeKey
  /** Minutes allowed to fall asleep; used by the cycle calculator. */
  sleepOnsetMinutes: number
  windDownMinutes: number
  enabled: boolean
}

/* -------------------------------------------------------------------------- */
/* Records                                                                    */
/* -------------------------------------------------------------------------- */

export interface UserSettings {
  id: 'singleton'
  displayName: string
  avatarDataUrl: string | null
  mascot: 'cat' | 'bunny'
  themeAccent: 'rose' | 'lavender' | 'sky' | 'mint' | 'peach'
  weekStartsOn: Weekday
  timeFormat: '12h' | '24h'
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
  autoStartBreaks: boolean
  soundEnabled: boolean
  weeklyStudyGoalMinutes: number
  weeklyProjectGoalMinutes: number
  sleepGoalMinutes: number
  dailyActivityGoalMinutes: number
  defaultCategory: ActivityCategory
  notificationPermissionAsked: boolean
  enabledNotificationCategories: Record<NotificationCategory, boolean>
  updatedAt: Millis
}

export interface Subject {
  id: ID
  name: string
  description: string
  color: string
  weeklyTargetMinutes: number
  deadline: DateKey | null
  notes: string
  archived: boolean
  createdAt: Millis
  updatedAt: Millis
}

export interface Project {
  id: ID
  name: string
  description: string
  startDate: DateKey
  deadline: DateKey | null
  priority: Priority
  status: ProjectStatus
  category: string
  color: string
  notes: string
  resources: { id: ID; label: string; url: string }[]
  archived: boolean
  createdAt: Millis
  updatedAt: Millis
}

export interface TaskChecklistItem extends ChecklistItem {
  /** Relative weight used for weighted progress, default 1. */
  weight: number
}

export interface ProjectTask {
  id: ID
  projectId: ID
  parentTaskId: ID | null
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  estimatedMinutes: number
  /** Accumulated tracked minutes from linked focus/study sessions. */
  actualMinutes: number
  startDate: DateKey | null
  deadline: DateKey | null
  checklist: TaskChecklistItem[]
  dependsOn: ID[]
  notes: string
  links: { id: ID; label: string; url: string }[]
  order: number
  completedAt: Millis | null
  createdAt: Millis
  updatedAt: Millis
}

export interface Task {
  id: ID
  title: string
  description: string
  kind: TaskKind
  status: TaskStatus
  priority: Priority
  subjectId: ID | null
  projectId: ID | null
  /** Set when this task mirrors a project task. */
  projectTaskId: ID | null
  estimatedMinutes: number
  actualMinutes: number
  dueDate: DateKey | null
  dueTime: TimeKey | null
  checklist: TaskChecklistItem[]
  notes: string
  /** Denormalised pointer to the scheduled block created from this task. */
  scheduledEventId: ID | null
  completedAt: Millis | null
  createdAt: Millis
  updatedAt: Millis
}

/**
 * A scheduled block of time. Sleep schedules, study blocks and college
 * classes are all scheduled events so that conflict detection, calendar views
 * and reminders only need one code path.
 */
export interface ScheduledEvent {
  id: ID
  title: string
  description: string
  category: ActivityCategory
  date: DateKey
  startTime: TimeKey
  endTime: TimeKey
  /** True when `endTime` falls on the following calendar day. */
  overnight: boolean
  status: ActivityStatus
  priority: Priority
  subjectId: ID | null
  projectId: ID | null
  projectTaskId: ID | null
  taskId: ID | null
  location: string
  meetingUrl: string
  reminders: ReminderSettings
  recurrence: RecurrenceRule | null
  /** Id shared by every generated occurrence of one series (`null` if one-off). */
  seriesId: ID | null
  /** The date the recurrence rule originally produced for this occurrence. */
  occurrenceDate: DateKey | null
  /** True when this is a series template row that must not be rendered itself. */
  isSeriesTemplate: boolean
  /** Set when the user explicitly accepted an overlap warning. */
  conflictAcknowledged: boolean
  plannedMinutes: number | null
  actualMinutes: number | null
  startedAt: Millis | null
  finishedAt: Millis | null
  notes: string
  createdAt: Millis
  updatedAt: Millis
}

/** A one-off log of how a planned activity actually went. */
export interface ActivityRecord {
  id: ID
  eventId: ID | null
  title: string
  category: ActivityCategory
  date: DateKey
  plannedMinutes: number
  actualMinutes: number
  status: ActivityStatus
  startedAt: Millis | null
  finishedAt: Millis | null
  subjectId: ID | null
  projectId: ID | null
  projectTaskId: ID | null
  notes: string
  createdAt: Millis
  updatedAt: Millis
}

export interface StudySession {
  id: ID
  subjectId: ID | null
  projectId: ID | null
  projectTaskId: ID | null
  taskId: ID | null
  eventId: ID | null
  date: DateKey
  /** Wall-clock range actually spent studying (may span midnight). */
  startedAt: Millis
  endedAt: Millis | null
  /** Accumulated focus seconds excluding paused time. */
  focusedSeconds: number
  /** Accumulated break seconds inside this session. */
  breakSeconds: number
  pausedAt: Millis | null
  status: 'active' | 'paused' | 'completed'
  technique: 'free' | 'pomodoro'
  pomodoroCycles: number
  notes: string
  createdAt: Millis
  updatedAt: Millis
}

/**
 * Durable timer snapshot. Written on every start/pause so an interrupted page
 * can rebuild elapsed time exactly (`accumulated + now - runningSince`).
 */
export interface TimerState {
  id: 'pomodoro' | 'study' | 'sleep' | 'activity'
  mode: 'idle' | 'focus' | 'short-break' | 'long-break'
  running: boolean
  /** Seconds banked before the current run started. */
  accumulatedSeconds: number
  /** Epoch ms when the current run segment started; `null` while paused. */
  runningSince: Millis | null
  cycle: number
  subjectId: ID | null
  projectTaskId: ID | null
  taskId: ID | null
  eventId: ID | null
  /** Seconds the current segment should last, for countdown timers. */
  targetSeconds: number | null
  startedAt: Millis | null
  updatedAt: Millis
}

export interface Habit {
  id: ID
  name: string
  description: string
  icon: string
  color: string
  /** 'daily' uses every day; 'weekly' uses `days`. */
  schedule: 'daily' | 'weekly'
  days: Weekday[]
  /** How many times per scheduled day counts as complete. */
  targetCount: number
  unit: string
  reminderTime: TimeKey | null
  reminderEnabled: boolean
  /** Number of scheduled days in a row needed before a streak is "on track". */
  archived: boolean
  order: number
  createdAt: Millis
  updatedAt: Millis
}

export interface HabitEntry {
  id: ID
  habitId: ID
  date: DateKey
  count: number
  completed: boolean
  notes: string
  createdAt: Millis
  updatedAt: Millis
}

export interface SleepSchedule {
  id: 'singleton'
  enabled: boolean
  weekday: WeekSchedule
  weekend: WeekSchedule
  /** Weekdays the weekend schedule applies to. Defaults to Fri+Sat nights. */
  weekendDays: Weekday[]
  windDownReminderMinutes: number
  bedtimeReminderMinutes: number
  wakeReminderMinutes: number
  windDownReminderEnabled: boolean
  bedtimeReminderEnabled: boolean
  wakeReminderEnabled: boolean
  updatedAt: Millis
}

/** A single-day override of the recurring sleep schedule. */
export interface SleepScheduleException {
  id: ID
  /** The night the exception applies to (the "sleep day"). */
  date: DateKey
  bedtime: TimeKey | null
  wakeTime: TimeKey | null
  note: string
  createdAt: Millis
}

export interface SleepSession {
  id: ID
  /** The night this session belongs to (`YYYY-MM-DD` of the bedtime day). */
  date: DateKey
  startAt: Millis
  endAt: Millis | null
  /** When the user believes they fell asleep; `null` if unknown. */
  sleepOnsetAt: Millis | null
  /** Awakenings recorded during the night. */
  awakenings: { id: ID; at: Millis; minutes: number }[]
  /** Total minutes awake during the night. */
  awakeMinutes: number
  timeInBedMinutes: number
  /** Estimated sleep duration; `null` when onset is unknown. */
  estimatedSleepMinutes: number | null
  /** True when entered by hand rather than started/stopped live. */
  manual: boolean
  /** True once the user confirmed the night's record. */
  confirmed: boolean
  quality: 1 | 2 | 3 | 4 | 5 | null
  notes: string
  createdAt: Millis
  updatedAt: Millis
}

export interface SleepRoutineItem {
  id: ID
  label: string
  minutes: number
  order: number
}

export interface SleepRoutine {
  id: ID
  name: string
  kind: 'winddown' | 'morning'
  enabled: boolean
  /** Time to start the routine, e.g. wind-down start. */
  startTime: TimeKey | null
  reminderEnabled: boolean
  reminderMinutesBefore: number
  items: SleepRoutineItem[]
  createdAt: Millis
  updatedAt: Millis
}

export interface SleepRoutineCompletion {
  id: ID
  routineId: ID
  /** `YYYY-MM-DD` of the routine day (the wake day for morning routines). */
  date: DateKey
  completedItemIds: ID[]
  completedAt: Millis | null
  updatedAt: Millis
}

/**
 * A reminder that must fire at `fireAt`. Jobs are materialised ahead of time so
 * they survive reloads, and `dedupeKey` guarantees a single delivery.
 */
export interface NotificationJob {
  id: ID
  dedupeKey: string
  fireAt: Millis
  title: string
  body: string
  category: NotificationCategory
  /** What the job points at, used for deep links. */
  refType: 'event' | 'task' | 'habit' | 'routine' | 'timer' | 'system'
  refId: ID | null
  /** Stable key of the source record, so jobs can be regenerated idempotently. */
  sourceKey: string
  createdAt: Millis
}

export interface NotificationLogEntry {
  id: ID
  dedupeKey: string
  title: string
  body: string
  category: NotificationCategory
  fireAt: Millis
  deliveredAt: Millis
  /** How the notification reached the user. `native` is a scheduled OS notification. */
  channel: 'browser' | 'native' | 'in-app' | 'skipped'
  read: boolean
}

/* -------------------------------------------------------------------------- */
/* Derived / view models                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A scheduled event together with the concrete calendar day it lands on.
 * Recurring series are expanded into occurrences for a requested window, with
 * exceptions applied, so every view (timeline, week grid, conflicts, reminders)
 * works against the same concrete shape.
 */
export interface Occurrence {
  event: ScheduledEvent
  date: DateKey
  startTime: TimeKey
  endTime: TimeKey
  overnight: boolean
  startMillis: Millis
  endMillis: Millis
  durationMinutes: number
}

export interface ConflictInfo {
  event: ScheduledEvent
  other: ScheduledEvent
  overlapMinutes: number
}

export interface TimeRange {
  start: Millis
  end: Millis
}
