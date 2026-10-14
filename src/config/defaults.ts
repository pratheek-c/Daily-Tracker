import type {
  ReminderSettings,
  SleepRoutine,
  SleepSchedule,
  UserSettings,
  Weekday,
} from '@/types'

export const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]
export const WEEKDAY_DAYS: Weekday[] = [1, 2, 3, 4, 5]
/** Sunday–Thursday nights count as "college nights" by default. */
export const WEEK_NIGHTS: Weekday[] = [0, 1, 2, 3, 4]

export function createDefaultSettings(now = Date.now()): UserSettings {
  return {
    id: 'singleton',
    displayName: 'Anusree',
    avatarDataUrl: null,
    mascot: 'bunny',
    themeAccent: 'rose',
    weekStartsOn: 1,
    timeFormat: '12h',
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4,
    autoStartBreaks: false,
    soundEnabled: true,
    weeklyStudyGoalMinutes: 15 * 60,
    weeklyProjectGoalMinutes: 6 * 60,
    sleepGoalMinutes: 8 * 60,
    dailyActivityGoalMinutes: 8 * 60,
    defaultCategory: 'study',
    notificationPermissionAsked: false,
    enabledNotificationCategories: {
      study: true,
      project: true,
      assignment: true,
      activity: true,
      habit: true,
      winddown: true,
      bedtime: true,
      wakeup: true,
      pomodoro: true,
    },
    updatedAt: now,
  }
}

/**
 * Sleep schedule that comfortably crosses midnight: 11:00 PM → 7:00 AM.
 * Week nights and weekend nights are separate so the weekend can differ.
 */
export function createDefaultSleepSchedule(now = Date.now()): SleepSchedule {
  return {
    id: 'singleton',
    enabled: true,
    weekday: {
      days: WEEK_NIGHTS,
      bedtime: '23:00',
      wakeTime: '07:00',
      sleepOnsetMinutes: 15,
      windDownMinutes: 30,
      enabled: true,
    },
    weekend: {
      days: [5, 6],
      bedtime: '00:00',
      wakeTime: '08:30',
      sleepOnsetMinutes: 20,
      windDownMinutes: 30,
      enabled: true,
    },
    weekendDays: [5, 6],
    windDownReminderMinutes: 30,
    bedtimeReminderMinutes: 15,
    wakeReminderMinutes: 5,
    windDownReminderEnabled: true,
    bedtimeReminderEnabled: true,
    wakeReminderEnabled: true,
    updatedAt: now,
  }
}

export function createDefaultWindDownRoutine(now = Date.now()): SleepRoutine {
  const labels: [string, number][] = [
    ['Finish studying', 10],
    ['Save project work', 5],
    ['Prepare materials for tomorrow', 10],
    ['Brush teeth', 5],
    ['Complete skincare', 5],
    ['Prepare clothes and bag', 5],
    ['Reduce screen use', 10],
    ['Read or journal', 15],
  ]
  return {
    id: 'routine_winddown_default',
    name: 'Wind-down routine',
    kind: 'winddown',
    enabled: true,
    startTime: null,
    reminderEnabled: true,
    reminderMinutesBefore: 30,
    items: labels.map(([label, minutes], index) => ({
      id: `winddown-item-${index}`,
      label,
      minutes,
      order: index,
    })),
    createdAt: now,
    updatedAt: now,
  }
}

export function createDefaultMorningRoutine(now = Date.now()): SleepRoutine {
  const labels: [string, number][] = [
    ['Get out of bed', 2],
    ['Drink water', 2],
    ['Make the bed', 3],
    ['Stretch', 5],
    ['Prepare for college', 20],
    ["Review today's timetable", 5],
  ]
  return {
    id: 'routine_morning_default',
    name: 'Morning routine',
    kind: 'morning',
    enabled: true,
    startTime: null,
    reminderEnabled: true,
    reminderMinutesBefore: 5,
    items: labels.map(([label, minutes], index) => ({
      id: `morning-item-${index}`,
      label,
      minutes,
      order: index,
    })),
    createdAt: now,
    updatedAt: now,
  }
}

export function createDefaultReminders(): ReminderSettings {
  return { enabled: true, offsetsMinutes: [10] }
}

export const REMINDER_PRESET_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'At start time' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
]

export const HABIT_ICON_CHOICES = [
  'sunrise',
  'book-open',
  'hammer',
  'book',
  'dumbbell',
  'droplets',
  'notebook-pen',
  'moon-star',
  'heart',
  'sparkles',
  'footprints',
  'brain',
] as const
