import { getDatabase } from '@/db/database'
import type {
  ActivityRecord,
  Habit,
  HabitEntry,
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

export const BACKUP_FORMAT = 'anusree-daily-tracker-backup'
export const BACKUP_VERSION = 1

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  device: string
  counts: Record<string, number>
  data: {
    settings: UserSettings[]
    subjects: Subject[]
    projects: Project[]
    projectTasks: ProjectTask[]
    tasks: Task[]
    events: ScheduledEvent[]
    activities: ActivityRecord[]
    studySessions: StudySession[]
    timerStates: TimerState[]
    habits: Habit[]
    habitEntries: HabitEntry[]
    sleepSchedule: SleepSchedule[]
    sleepExceptions: SleepScheduleException[]
    sleepSessions: SleepSession[]
    sleepRoutines: SleepRoutine[]
    sleepRoutineCompletions: SleepRoutineCompletion[]
    notificationLog: NotificationLogEntry[]
  }
}

/** Everything persisted, as a plain JSON-serialisable object. */
export async function createBackup(): Promise<BackupFile> {
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
    sleepRoutineCompletions,
    notificationLog,
  ] = await Promise.all([
    db.settings.toArray(),
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
    db.sleepSchedule.toArray(),
    db.sleepExceptions.toArray(),
    db.sleepSessions.toArray(),
    db.sleepRoutines.toArray(),
    db.sleepRoutineCompletions.toArray(),
    db.notificationLog.toArray(),
  ])

  const data = {
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
    sleepRoutineCompletions,
    // Notification jobs are intentionally excluded: they are derived and are
    // rebuilt from records on load, so restoring stale ones would be wrong.
    notificationLog,
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    device: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent.slice(0, 120),
    counts: Object.fromEntries(
      Object.entries(data).map(([key, rows]) => [key, (rows as unknown[]).length]),
    ),
    data,
  }
}

export interface ImportPreview {
  valid: boolean
  error?: string
  format?: string
  version?: number
  exportedAt?: string
  counts: Record<string, number>
  /** Rows whose ids already exist locally. */
  duplicates: Record<string, number>
  total: number
}

const TABLES = [
  'settings',
  'subjects',
  'projects',
  'projectTasks',
  'tasks',
  'events',
  'activities',
  'studySessions',
  'timerStates',
  'habits',
  'habitEntries',
  'sleepSchedule',
  'sleepExceptions',
  'sleepSessions',
  'sleepRoutines',
  'sleepRoutineCompletions',
  'notificationLog',
] as const

/**
 * Validate a backup before touching the database.
 *
 * The preview reports exactly what will be imported and how much of it already
 * exists locally, so a restore is never a blind overwrite.
 */
export async function previewImport(text: string): Promise<ImportPreview> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'That file is not valid JSON.',
      counts: {},
      duplicates: {},
      total: 0,
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { valid: false, error: 'The backup file is empty.', counts: {}, duplicates: {}, total: 0 }
  }

  const candidate = parsed as Partial<BackupFile>
  if (candidate.format !== BACKUP_FORMAT) {
    return {
      valid: false,
      error: `This does not look like an Anusree's Daily Tracker backup (expected format "${BACKUP_FORMAT}").`,
      counts: {},
      duplicates: {},
      total: 0,
    }
  }
  if (typeof candidate.version !== 'number' || candidate.version > BACKUP_VERSION) {
    return {
      valid: false,
      error: `Backup version ${String(candidate.version)} is newer than this app understands (${BACKUP_VERSION}).`,
      counts: {},
      duplicates: {},
      total: 0,
    }
  }
  if (!candidate.data || typeof candidate.data !== 'object') {
    return { valid: false, error: 'The backup has no data section.', counts: {}, duplicates: {}, total: 0 }
  }

  const db = getDatabase()
  const counts: Record<string, number> = {}
  const duplicates: Record<string, number> = {}
  let total = 0

  for (const table of TABLES) {
    const rows = (candidate.data as Record<string, unknown>)[table]
    const list = Array.isArray(rows) ? rows : []
    counts[table] = list.length
    total += list.length

    if (list.length === 0) {
      duplicates[table] = 0
      continue
    }
    const ids = list
      .map((row) => (typeof row === 'object' && row !== null ? (row as { id?: string }).id : undefined))
      .filter((id): id is string => typeof id === 'string')
    if (ids.length === 0) {
      duplicates[table] = 0
      continue
    }
    const existing = await db.table(table).where('id').anyOf(ids).count()
    duplicates[table] = existing
  }

  return {
    valid: true,
    format: candidate.format,
    version: candidate.version,
    exportedAt: candidate.exportedAt,
    counts,
    duplicates,
    total,
  }
}

export interface ImportResult {
  imported: number
  skipped: number
  perTable: Record<string, { imported: number; skipped: number }>
}

/**
 * Restore a backup.
 *
 * `mode: 'merge'` keeps existing rows and skips duplicates (the safe default);
 * `mode: 'replace'` clears every table first.
 */
export async function applyImport(
  text: string,
  mode: 'merge' | 'replace',
): Promise<ImportResult> {
  const parsed = JSON.parse(text) as BackupFile
  const db = getDatabase()
  const perTable: Record<string, { imported: number; skipped: number }> = {}
  let imported = 0
  let skipped = 0

  await db.transaction('rw', db.tables, async () => {
    if (mode === 'replace') {
      for (const table of TABLES) await db.table(table).clear()
    }
    for (const table of TABLES) {
      const rows = ((parsed.data as Record<string, unknown>)[table] ?? []) as { id?: string }[]
      if (rows.length === 0) {
        perTable[table] = { imported: 0, skipped: 0 }
        continue
      }
      if (mode === 'merge') {
        const ids = rows
          .map((row) => row.id)
          .filter((id): id is string => typeof id === 'string')
        const existing = ids.length
          ? new Set(
              (
                (await db
                  .table(table)
                  .where('id')
                  .anyOf(ids)
                  .toArray()) as { id: string }[]
              ).map((row) => row.id),
            )
          : new Set<string>()
        const fresh = rows.filter((row) => !row.id || !existing.has(row.id))
        if (fresh.length > 0) await db.table(table).bulkAdd(fresh as never[])
        perTable[table] = { imported: fresh.length, skipped: rows.length - fresh.length }
        imported += fresh.length
        skipped += rows.length - fresh.length
      } else {
        await db.table(table).bulkPut(rows as never[])
        perTable[table] = { imported: rows.length, skipped: 0 }
        imported += rows.length
      }
    }
  })

  return { imported, skipped, perTable }
}

/* -------------------------------------------------------------------------- */
/* CSV export                                                                 */
/* -------------------------------------------------------------------------- */

function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return ''
  const keys = columns ?? Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return ''
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [keys.join(','), ...rows.map((row) => keys.map((key) => escape(row[key])).join(','))].join(
    '\r\n',
  )
}

export function studySessionsCsv(sessions: StudySession[], subjects: Subject[]): string {
  const nameById = new Map(subjects.map((subject) => [subject.id, subject.name]))
  return toCsv(
    sessions.map((session) => ({
      date: session.date,
      subject: session.subjectId ? (nameById.get(session.subjectId) ?? '') : 'General study',
      started_at: new Date(session.startedAt).toISOString(),
      ended_at: session.endedAt ? new Date(session.endedAt).toISOString() : '',
      focused_minutes: Math.round(session.focusedSeconds / 60),
      break_minutes: Math.round(session.breakSeconds / 60),
      technique: session.technique,
      status: session.status,
      notes: session.notes,
    })),
    [
      'date',
      'subject',
      'started_at',
      'ended_at',
      'focused_minutes',
      'break_minutes',
      'technique',
      'status',
      'notes',
    ],
  )
}

export function activityHistoryCsv(records: ActivityRecord[]): string {
  return toCsv(
    records.map((record) => ({
      date: record.date,
      title: record.title,
      category: record.category,
      status: record.status,
      planned_minutes: record.plannedMinutes,
      actual_minutes: record.actualMinutes,
      started_at: record.startedAt ? new Date(record.startedAt).toISOString() : '',
      finished_at: record.finishedAt ? new Date(record.finishedAt).toISOString() : '',
      notes: record.notes,
    })),
    [
      'date',
      'title',
      'category',
      'status',
      'planned_minutes',
      'actual_minutes',
      'started_at',
      'finished_at',
      'notes',
    ],
  )
}

export function tasksCsv(tasks: Task[], subjects: Subject[], projects: Project[]): string {
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject.name]))
  const projectById = new Map(projects.map((project) => [project.id, project.name]))
  return toCsv(
    tasks.map((task) => ({
      title: task.title,
      kind: task.kind,
      status: task.status,
      priority: task.priority,
      subject: task.subjectId ? (subjectById.get(task.subjectId) ?? '') : '',
      project: task.projectId ? (projectById.get(task.projectId) ?? '') : '',
      due_date: task.dueDate ?? '',
      due_time: task.dueTime ?? '',
      estimated_minutes: task.estimatedMinutes,
      completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : '',
      checklist_steps: task.checklist.length,
      checklist_done: task.checklist.filter((item) => item.done).length,
    })),
    [
      'title',
      'kind',
      'status',
      'priority',
      'subject',
      'project',
      'due_date',
      'due_time',
      'estimated_minutes',
      'completed_at',
      'checklist_steps',
      'checklist_done',
    ],
  )
}

export function sleepRecordsCsv(sessions: SleepSession[]): string {
  return toCsv(
    sessions.map((session) => ({
      night_of: session.date,
      in_bed_at: new Date(session.startAt).toISOString(),
      woke_at: session.endAt ? new Date(session.endAt).toISOString() : '',
      time_in_bed_minutes: session.timeInBedMinutes,
      estimated_sleep_minutes: session.estimatedSleepMinutes ?? '',
      sleep_onset_at: session.sleepOnsetAt ? new Date(session.sleepOnsetAt).toISOString() : '',
      awake_minutes: session.awakeMinutes,
      awakenings: session.awakenings.length,
      manual: session.manual,
      confirmed: session.confirmed,
      quality: session.quality ?? '',
      notes: session.notes,
    })),
    [
      'night_of',
      'in_bed_at',
      'woke_at',
      'time_in_bed_minutes',
      'estimated_sleep_minutes',
      'sleep_onset_at',
      'awake_minutes',
      'awakenings',
      'manual',
      'confirmed',
      'quality',
      'notes',
    ],
  )
}

export function habitHistoryCsv(habits: Habit[], entries: HabitEntry[]): string {
  const habitById = new Map(habits.map((habit) => [habit.id, habit.name]))
  return toCsv(
    entries
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((entry) => ({
        habit: habitById.get(entry.habitId) ?? 'Unknown habit',
        date: entry.date,
        count: entry.count,
        completed: entry.completed,
        notes: entry.notes,
      })),
    ['habit', 'date', 'count', 'completed', 'notes'],
  )
}
