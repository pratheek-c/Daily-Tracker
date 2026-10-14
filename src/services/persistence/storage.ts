import type {
  ActivityCategory,
  DateKey,
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
  TaskStatus,
  TimerState,
  UserSettings,
} from '@/types'

/** A generic filter bag; repositories translate it into index queries. */
export interface RangeQuery {
  from?: DateKey
  to?: DateKey
}

export interface StudySessionQuery extends RangeQuery {
  subjectId?: ID
  projectId?: ID
  taskId?: ID
  status?: StudySession['status']
}

export interface TaskQuery {
  status?: TaskStatus[]
  kind?: Task['kind'][]
  subjectId?: ID
  projectId?: ID
  dueFrom?: DateKey
  dueTo?: DateKey
  search?: string
}

export interface EventQuery extends RangeQuery {
  category?: ActivityCategory[]
  subjectId?: ID
  projectId?: ID
  includeSeriesTemplates?: boolean
}

export interface NotificationJobQuery {
  /** Jobs whose fire time is at or before this instant. */
  dueBefore?: Millis
  from?: Millis
  to?: Millis
  category?: NotificationJob['category']
}

/**
 * Storage port.
 *
 * The whole app talks to this interface only. `DexieStorage` is the local-first
 * implementation; a `RemoteStorage` (Supabase/Postgres + sync worker) can be
 * dropped in later because every method is already async, range-based and
 * keyed by the same ids that a server table would use.
 */
export interface Storage {
  /* settings ------------------------------------------------------------- */
  getSettings(): Promise<UserSettings | undefined>
  putSettings(settings: UserSettings): Promise<void>

  /* subjects ------------------------------------------------------------- */
  listSubjects(): Promise<Subject[]>
  getSubject(id: ID): Promise<Subject | undefined>
  putSubject(subject: Subject): Promise<void>
  putSubjects(subjects: Subject[]): Promise<void>
  deleteSubject(id: ID): Promise<void>

  /* projects ------------------------------------------------------------- */
  listProjects(): Promise<Project[]>
  getProject(id: ID): Promise<Project | undefined>
  putProject(project: Project): Promise<void>
  deleteProject(id: ID): Promise<void>

  /* project tasks -------------------------------------------------------- */
  listProjectTasks(projectId?: ID): Promise<ProjectTask[]>
  getProjectTask(id: ID): Promise<ProjectTask | undefined>
  putProjectTask(task: ProjectTask): Promise<void>
  putProjectTasks(tasks: ProjectTask[]): Promise<void>
  deleteProjectTask(id: ID): Promise<void>

  /* tasks ---------------------------------------------------------------- */
  listTasks(query?: TaskQuery): Promise<Task[]>
  getTask(id: ID): Promise<Task | undefined>
  putTask(task: Task): Promise<void>
  putTasks(tasks: Task[]): Promise<void>
  deleteTask(id: ID): Promise<void>

  /* scheduled events ----------------------------------------------------- */
  listEvents(query?: EventQuery): Promise<ScheduledEvent[]>
  getAllEvents(): Promise<ScheduledEvent[]>
  getEvent(id: ID): Promise<ScheduledEvent | undefined>
  putEvent(event: ScheduledEvent): Promise<void>
  putEvents(events: ScheduledEvent[]): Promise<void>
  deleteEvent(id: ID): Promise<void>
  deleteEvents(ids: ID[]): Promise<void>
  deleteSeries(seriesId: ID): Promise<void>

  /* activity records ----------------------------------------------------- */
  listActivities(query?: RangeQuery): Promise<ActivityRecordRow[]>
  getActivity(id: ID): Promise<ActivityRecordRow | undefined>
  putActivity(record: ActivityRecordRow): Promise<void>
  deleteActivity(id: ID): Promise<void>

  /* study sessions ------------------------------------------------------- */
  listStudySessions(query?: StudySessionQuery): Promise<StudySession[]>
  getStudySession(id: ID): Promise<StudySession | undefined>
  putStudySession(session: StudySession): Promise<void>
  deleteStudySession(id: ID): Promise<void>

  /* timer state ---------------------------------------------------------- */
  getTimerState(id: TimerState['id']): Promise<TimerState | undefined>
  listTimerStates(): Promise<TimerState[]>
  putTimerState(state: TimerState): Promise<void>

  /* habits --------------------------------------------------------------- */
  listHabits(): Promise<Habit[]>
  getHabit(id: ID): Promise<Habit | undefined>
  putHabit(habit: Habit): Promise<void>
  deleteHabit(id: ID): Promise<void>
  listHabitEntries(query?: RangeQuery & { habitId?: ID }): Promise<HabitEntry[]>
  putHabitEntry(entry: HabitEntry): Promise<void>
  putHabitEntries(entries: HabitEntry[]): Promise<void>
  deleteHabitEntry(id: ID): Promise<void>

  /* sleep ---------------------------------------------------------------- */
  getSleepSchedule(): Promise<SleepSchedule | undefined>
  putSleepSchedule(schedule: SleepSchedule): Promise<void>
  listSleepExceptions(query?: RangeQuery): Promise<SleepScheduleException[]>
  putSleepException(exception: SleepScheduleException): Promise<void>
  deleteSleepException(id: ID): Promise<void>
  listSleepSessions(query?: RangeQuery): Promise<SleepSession[]>
  getSleepSession(id: ID): Promise<SleepSession | undefined>
  putSleepSession(session: SleepSession): Promise<void>
  deleteSleepSession(id: ID): Promise<void>
  listSleepRoutines(): Promise<SleepRoutine[]>
  putSleepRoutine(routine: SleepRoutine): Promise<void>
  deleteSleepRoutine(id: ID): Promise<void>
  listRoutineCompletions(query?: RangeQuery & { routineId?: ID }): Promise<SleepRoutineCompletion[]>
  putRoutineCompletion(completion: SleepRoutineCompletion): Promise<void>

  /* notifications -------------------------------------------------------- */
  listNotificationJobs(query?: NotificationJobQuery): Promise<NotificationJob[]>
  putNotificationJob(job: NotificationJob): Promise<void>
  putNotificationJobs(jobs: NotificationJob[]): Promise<void>
  deleteNotificationJob(id: ID): Promise<void>
  deleteNotificationJobs(ids: ID[]): Promise<void>
  deleteNotificationJobsBySource(sourceKey: string): Promise<void>
  listNotificationLog(query?: { limit?: number; unreadOnly?: boolean }): Promise<NotificationLogEntry[]>
  putNotificationLog(entry: NotificationLogEntry): Promise<void>
  markNotificationRead(id: ID, read: boolean): Promise<void>
  clearNotificationLog(): Promise<void>

  /* maintenance ---------------------------------------------------------- */
  estimateUsage(): Promise<{ usage: number | null; quota: number | null }>
  clearAll(): Promise<void>
}

/** Alias kept short for repository signatures. */
export type ActivityRecordRow = import('@/types').ActivityRecord
