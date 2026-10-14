import Dexie, { type Table } from 'dexie'
import type {
  ActivityRecord,
  Habit,
  HabitEntry,
  ID,
  Millis,
  NotificationJob,
  NotificationLogEntry,
  Project,
  ProjectTask,
  ScheduledEvent,
  SleepRoutine,
  SleepRoutineCompletion,
  SleepSchedule,
  SleepScheduleException,
  SleepSession,
  StudySession,
  Subject,
  Task,
  TimerState,
  UserSettings,
} from '@/types'

/**
 * Append-only change log.
 *
 * Nothing in the UI reads this yet: it exists so that a future cloud-sync
 * backend can replay local mutations without a rewrite. Each row is a
 * self-contained "what changed" envelope with a monotonic `seq` cursor and a
 * `syncedAt` flag the sync worker will flip.
 */
export interface ChangeLogRow {
  seq?: number
  entity: string
  entityId: ID
  action: 'create' | 'update' | 'delete'
  /** Full record snapshot at the time of the change. */
  snapshot: unknown
  updatedAt: Millis
  deviceId: string
  syncedAt: Millis | null
}

export class TrackerDatabase extends Dexie {
  settings!: Table<UserSettings, ID>
  subjects!: Table<Subject, ID>
  projects!: Table<Project, ID>
  projectTasks!: Table<ProjectTask, ID>
  tasks!: Table<Task, ID>
  events!: Table<ScheduledEvent, ID>
  activities!: Table<ActivityRecord, ID>
  studySessions!: Table<StudySession, ID>
  timerStates!: Table<TimerState, string>
  habits!: Table<Habit, ID>
  habitEntries!: Table<HabitEntry, ID>
  sleepSchedule!: Table<SleepSchedule, string>
  sleepExceptions!: Table<SleepScheduleException, ID>
  sleepSessions!: Table<SleepSession, ID>
  sleepRoutines!: Table<SleepRoutine, ID>
  sleepRoutineCompletions!: Table<SleepRoutineCompletion, ID>
  notificationJobs!: Table<NotificationJob, ID>
  notificationLog!: Table<NotificationLogEntry, ID>
  changeLog!: Table<ChangeLogRow, number>

  constructor(name = 'anusree-daily-tracker') {
    super(name)

    // v1 — the initial schema. Future versions must add a new `.version()`
    // block with an upgrade function; never mutate this one.
    this.version(1).stores({
      settings: 'id, updatedAt',
      subjects: 'id, name, archived, updatedAt',
      projects: 'id, name, status, priority, deadline, archived, updatedAt',
      projectTasks: 'id, projectId, parentTaskId, status, priority, deadline, order, updatedAt',
      tasks: 'id, kind, status, priority, dueDate, subjectId, projectId, projectTaskId, updatedAt',
      events:
        'id, date, seriesId, occurrenceDate, category, status, subjectId, projectId, taskId, isSeriesTemplate, updatedAt, [isSeriesTemplate+date]',
      activities: 'id, date, eventId, category, status, updatedAt',
      studySessions: 'id, date, subjectId, projectId, taskId, eventId, status, startedAt, updatedAt',
      timerStates: 'id, updatedAt',
      habits: 'id, name, archived, order, updatedAt',
      habitEntries: 'id, habitId, date, completed, [habitId+date], updatedAt',
      sleepSchedule: 'id, updatedAt',
      sleepExceptions: 'id, date, updatedAt',
      sleepSessions: 'id, date, confirmed, manual, updatedAt',
      sleepRoutines: 'id, kind, enabled, updatedAt',
      sleepRoutineCompletions: 'id, routineId, date, [routineId+date], updatedAt',
      notificationJobs: 'id, fireAt, category, refType, dedupeKey, sourceKey, createdAt',
      notificationLog: 'id, fireAt, deliveredAt, category, dedupeKey, read',
      changeLog: '++seq, entity, entityId, updatedAt, syncedAt',
    })
  }
}

let instance: TrackerDatabase | null = null

/** Lazily-created singleton so tests can construct isolated databases. */
export function getDatabase(): TrackerDatabase {
  if (!instance) instance = new TrackerDatabase()
  return instance
}

export function setDatabaseForTesting(db: TrackerDatabase | null) {
  instance = db
}

export interface DatabaseStats {
  events: number
  tasks: number
  studySessions: number
  habits: number
  sleepSessions: number
  changeLog: number
  estimatedBytes: number | null
}

export async function collectDatabaseStats(db: TrackerDatabase): Promise<DatabaseStats> {
  const [events, tasks, studySessions, habits, sleepSessions, changeLog] = await Promise.all([
    db.events.count(),
    db.tasks.count(),
    db.studySessions.count(),
    db.habits.count(),
    db.sleepSessions.count(),
    db.changeLog.count(),
  ])

  let estimatedBytes: number | null = null
  const nav = navigator as Navigator & { storage?: StorageManager }
  if (nav.storage && typeof nav.storage.estimate === 'function') {
    try {
      const estimate = await nav.storage.estimate()
      estimatedBytes = estimate.usage ?? null
    } catch {
      estimatedBytes = null
    }
  }

  return { events, tasks, studySessions, habits, sleepSessions, changeLog, estimatedBytes }
}

/**
 * Does this device hold work the user actually created?
 *
 * A freshly installed app already has default settings, a default sleep
 * schedule and two routine templates. Treating those as "user data" would let a
 * brand-new device overwrite a real account, so the check looks only at records
 * that can only exist because a person made them.
 */
export async function hasLocalUserData(db: TrackerDatabase = getDatabase()): Promise<boolean> {
  const [events, tasks, projects, projectTasks, habits, studySessions, sleepSessions, activities] =
    await Promise.all([
      db.events.count(),
      db.tasks.count(),
      db.projects.count(),
      db.projectTasks.count(),
      db.habits.count(),
      db.studySessions.count(),
      db.sleepSessions.count(),
      db.activities.count(),
    ])
  return (
    events + tasks + projects + projectTasks + habits + studySessions + sleepSessions + activities > 0
  )
}

export async function clearAllData(db: TrackerDatabase) {
  await db.transaction(
    'rw',
    [
      db.settings,
      db.subjects,
      db.projects,
      db.projectTasks,
      db.tasks,
      db.events,
      db.activities,
      db.studySessions,
      db.timerStates,
      db.habits,
      db.habitEntries,
      db.sleepSchedule,
      db.sleepExceptions,
      db.sleepSessions,
      db.sleepRoutines,
      db.sleepRoutineCompletions,
      db.notificationJobs,
      db.notificationLog,
      db.changeLog,
    ],
    async () => {
      await Promise.all([
        db.settings.clear(),
        db.subjects.clear(),
        db.projects.clear(),
        db.projectTasks.clear(),
        db.tasks.clear(),
        db.events.clear(),
        db.activities.clear(),
        db.studySessions.clear(),
        db.timerStates.clear(),
        db.habits.clear(),
        db.habitEntries.clear(),
        db.sleepSchedule.clear(),
        db.sleepExceptions.clear(),
        db.sleepSessions.clear(),
        db.sleepRoutines.clear(),
        db.sleepRoutineCompletions.clear(),
        db.notificationJobs.clear(),
        db.notificationLog.clear(),
        db.changeLog.clear(),
      ])
    },
  )
}
