import { useLiveQuery } from 'dexie-react-hooks'
import { getDatabase } from '@/db/database'
import type { RecurrenceException } from '@/types'

/** Everything the UI needs, fetched live from IndexedDB in one subscription. */
export interface TrackerData {
  ready: boolean
  settings: import('@/types').UserSettings | undefined
  subjects: import('@/types').Subject[]
  projects: import('@/types').Project[]
  projectTasks: import('@/types').ProjectTask[]
  tasks: import('@/types').Task[]
  events: import('@/types').ScheduledEvent[]
  activities: import('@/types').ActivityRecord[]
  studySessions: import('@/types').StudySession[]
  timerStates: import('@/types').TimerState[]
  habits: import('@/types').Habit[]
  habitEntries: import('@/types').HabitEntry[]
  sleepSchedule: import('@/types').SleepSchedule | undefined
  sleepExceptions: import('@/types').SleepScheduleException[]
  sleepSessions: import('@/types').SleepSession[]
  sleepRoutines: import('@/types').SleepRoutine[]
  routineCompletions: import('@/types').SleepRoutineCompletion[]
  notificationJobs: import('@/types').NotificationJob[]
  notificationLog: import('@/types').NotificationLogEntry[]
}

const EMPTY: TrackerData = {
  ready: false,
  settings: undefined,
  subjects: [],
  projects: [],
  projectTasks: [],
  tasks: [],
  events: [],
  activities: [],
  studySessions: [],
  timerStates: [],
  habits: [],
  habitEntries: [],
  sleepSchedule: undefined,
  sleepExceptions: [],
  sleepSessions: [],
  sleepRoutines: [],
  routineCompletions: [],
  notificationJobs: [],
  notificationLog: [],
}

/**
 * One live subscription over every table.
 *
 * Dexie re-runs this whenever any table changes, so pages never need manual
 * cache invalidation — which is what keeps the dashboard and analytics honest
 * about reflecting real records.
 */
export function useTrackerData(): TrackerData {
  const data = useLiveQuery(async () => {
    const db = getDatabase()
    const [
      settings,
      subjects,
      projects,
      projectTasks,
      tasks,
      events,
      activities,
      studySessions,
      timerStates,
      habits,
      habitEntries,
      sleepSchedule,
      sleepExceptions,
      sleepSessions,
      sleepRoutines,
      routineCompletions,
      notificationJobs,
      notificationLog,
    ] = await Promise.all([
      db.settings.get('singleton'),
      db.subjects.toArray(),
      db.projects.toArray(),
      db.projectTasks.toArray(),
      db.tasks.toArray(),
      db.events.toArray(),
      db.activities.toArray(),
      db.studySessions.toArray(),
      db.timerStates.toArray(),
      db.habits.toArray(),
      db.habitEntries.toArray(),
      db.sleepSchedule.get('singleton'),
      db.sleepExceptions.toArray(),
      db.sleepSessions.toArray(),
      db.sleepRoutines.toArray(),
      db.sleepRoutineCompletions.toArray(),
      db.notificationJobs.toArray(),
      db.notificationLog.orderBy('deliveredAt').reverse().limit(200).toArray(),
    ])

    const payload: TrackerData = {
      ready: true,
      settings,
      subjects: [...subjects].sort(
        (a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name),
      ),
      projects: [...projects].sort((a, b) => a.createdAt - b.createdAt),
      projectTasks: [...projectTasks].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt),
      tasks: [...tasks].sort((a, b) => a.createdAt - b.createdAt),
      events,
      activities,
      studySessions,
      timerStates,
      habits: [...habits].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt),
      habitEntries,
      sleepSchedule,
      sleepExceptions,
      sleepSessions,
      sleepRoutines,
      routineCompletions,
      notificationJobs: [...notificationJobs].sort((a, b) => a.fireAt - b.fireAt),
      notificationLog,
    }
    return payload
  }, [])

  return data ?? EMPTY
}

/** Events stored as recurrence exceptions, derived from cancelled occurrences. */
export function exceptionsFromEvents(
  events: import('@/types').ScheduledEvent[],
): RecurrenceException[] {
  return events
    .filter((event) => event.status === 'cancelled' && event.seriesId && event.occurrenceDate)
    .map((event) => ({
      seriesId: event.seriesId as string,
      originalDate: event.occurrenceDate as string,
      kind: 'cancelled' as const,
      reason: event.notes || undefined,
    }))
}
