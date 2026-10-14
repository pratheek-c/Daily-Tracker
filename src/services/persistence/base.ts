import type {
  ActivityRecord,
  Habit,
  HabitEntry,
  ID,
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
import type {
  EventQuery,
  NotificationJobQuery,
  RangeQuery,
  Storage,
  StudySessionQuery,
  TaskQuery,
} from './storage'

/** Every local record is addressable by `id`; deletes only carry that. */
interface Identified {
  id: string
}

/**
 * A future cloud-sync worker consumes this sink. The local implementation
 * simply appends to the `changeLog` table.
 */
export interface ChangeSink {
  record(
    entity: string,
    entityId: string,
    action: 'create' | 'update' | 'delete',
    snapshot: unknown,
  ): void
}

export interface StorageOptions {
  changeSink?: ChangeSink
}

/**
 * Shared plumbing for every concrete `Storage` implementation: change-log
 * fan-out plus the range-query helpers that IndexedDB and SQL backends both
 * need. Subclasses only implement raw table access.
 */
export abstract class BaseStorage implements Storage {
  protected readonly changeSink: ChangeSink | undefined

  constructor(options: StorageOptions = {}) {
    this.changeSink = options.changeSink
  }

  protected track<T extends Identified>(
    entity: string,
    action: 'create' | 'update' | 'delete',
    payload: T,
  ): void {
    if (!this.changeSink) return
    this.changeSink.record(entity, payload.id, action, payload)
  }

  protected trackMany<T extends Identified>(
    entity: string,
    action: 'create' | 'update' | 'delete',
    payloads: T[],
  ): void {
    if (!this.changeSink || payloads.length === 0) return
    for (const payload of payloads) this.changeSink.record(entity, payload.id, action, payload)
  }

  protected static inRange(date: string, query?: RangeQuery): boolean {
    if (!query) return true
    if (query.from && date < query.from) return false
    if (query.to && date > query.to) return false
    return true
  }

  protected static matchesSearch(haystack: string[], needle: string | undefined): boolean {
    if (!needle) return true
    const term = needle.trim().toLowerCase()
    if (!term) return true
    return haystack.some((value) => value.toLowerCase().includes(term))
  }

  abstract getSettings(): Promise<UserSettings | undefined>
  abstract putSettings(settings: UserSettings): Promise<void>

  abstract listSubjects(): Promise<Subject[]>
  abstract getSubject(id: ID): Promise<Subject | undefined>
  abstract putSubject(subject: Subject): Promise<void>
  abstract putSubjects(subjects: Subject[]): Promise<void>
  abstract deleteSubject(id: ID): Promise<void>

  abstract listProjects(): Promise<Project[]>
  abstract getProject(id: ID): Promise<Project | undefined>
  abstract putProject(project: Project): Promise<void>
  abstract deleteProject(id: ID): Promise<void>

  abstract listProjectTasks(projectId?: ID): Promise<ProjectTask[]>
  abstract getProjectTask(id: ID): Promise<ProjectTask | undefined>
  abstract putProjectTask(task: ProjectTask): Promise<void>
  abstract putProjectTasks(tasks: ProjectTask[]): Promise<void>
  abstract deleteProjectTask(id: ID): Promise<void>

  abstract listTasks(query?: TaskQuery): Promise<Task[]>
  abstract getTask(id: ID): Promise<Task | undefined>
  abstract putTask(task: Task): Promise<void>
  abstract putTasks(tasks: Task[]): Promise<void>
  abstract deleteTask(id: ID): Promise<void>

  abstract listEvents(query?: EventQuery): Promise<ScheduledEvent[]>
  abstract getAllEvents(): Promise<ScheduledEvent[]>
  abstract getEvent(id: ID): Promise<ScheduledEvent | undefined>
  abstract putEvent(event: ScheduledEvent): Promise<void>
  abstract putEvents(events: ScheduledEvent[]): Promise<void>
  abstract deleteEvent(id: ID): Promise<void>
  abstract deleteEvents(ids: ID[]): Promise<void>
  abstract deleteSeries(seriesId: ID): Promise<void>

  abstract listActivities(query?: RangeQuery): Promise<ActivityRecord[]>
  abstract getActivity(id: ID): Promise<ActivityRecord | undefined>
  abstract putActivity(record: ActivityRecord): Promise<void>
  abstract deleteActivity(id: ID): Promise<void>

  abstract listStudySessions(query?: StudySessionQuery): Promise<StudySession[]>
  abstract getStudySession(id: ID): Promise<StudySession | undefined>
  abstract putStudySession(session: StudySession): Promise<void>
  abstract deleteStudySession(id: ID): Promise<void>

  abstract getTimerState(id: TimerState['id']): Promise<TimerState | undefined>
  abstract listTimerStates(): Promise<TimerState[]>
  abstract putTimerState(state: TimerState): Promise<void>

  abstract listHabits(): Promise<Habit[]>
  abstract getHabit(id: ID): Promise<Habit | undefined>
  abstract putHabit(habit: Habit): Promise<void>
  abstract deleteHabit(id: ID): Promise<void>
  abstract listHabitEntries(query?: RangeQuery & { habitId?: ID }): Promise<HabitEntry[]>
  abstract putHabitEntry(entry: HabitEntry): Promise<void>
  abstract putHabitEntries(entries: HabitEntry[]): Promise<void>
  abstract deleteHabitEntry(id: ID): Promise<void>

  abstract getSleepSchedule(): Promise<SleepSchedule | undefined>
  abstract putSleepSchedule(schedule: SleepSchedule): Promise<void>
  abstract listSleepExceptions(query?: RangeQuery): Promise<SleepScheduleException[]>
  abstract putSleepException(exception: SleepScheduleException): Promise<void>
  abstract deleteSleepException(id: ID): Promise<void>
  abstract listSleepSessions(query?: RangeQuery): Promise<SleepSession[]>
  abstract getSleepSession(id: ID): Promise<SleepSession | undefined>
  abstract putSleepSession(session: SleepSession): Promise<void>
  abstract deleteSleepSession(id: ID): Promise<void>
  abstract listSleepRoutines(): Promise<SleepRoutine[]>
  abstract putSleepRoutine(routine: SleepRoutine): Promise<void>
  abstract deleteSleepRoutine(id: ID): Promise<void>
  abstract listRoutineCompletions(
    query?: RangeQuery & { routineId?: ID },
  ): Promise<SleepRoutineCompletion[]>
  abstract putRoutineCompletion(completion: SleepRoutineCompletion): Promise<void>

  abstract listNotificationJobs(query?: NotificationJobQuery): Promise<NotificationJob[]>
  abstract putNotificationJob(job: NotificationJob): Promise<void>
  abstract putNotificationJobs(jobs: NotificationJob[]): Promise<void>
  abstract deleteNotificationJob(id: ID): Promise<void>
  abstract deleteNotificationJobs(ids: ID[]): Promise<void>
  abstract deleteNotificationJobsBySource(sourceKey: string): Promise<void>
  abstract listNotificationLog(query?: {
    limit?: number
    unreadOnly?: boolean
  }): Promise<NotificationLogEntry[]>
  abstract putNotificationLog(entry: NotificationLogEntry): Promise<void>
  abstract markNotificationRead(id: ID, read: boolean): Promise<void>
  abstract clearNotificationLog(): Promise<void>

  abstract estimateUsage(): Promise<{ usage: number | null; quota: number | null }>
  abstract clearAll(): Promise<void>
}
