import { clearAllData, type TrackerDatabase } from '@/db/database'
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
import { BaseStorage, type ChangeSink, type StorageOptions } from './base'
import type {
  EventQuery,
  NotificationJobQuery,
  RangeQuery,
  StudySessionQuery,
  TaskQuery,
} from './storage'

/** Writes change-log rows for every mutation so a sync worker can replay them. */
export class DexieChangeSink implements ChangeSink {
  constructor(
    private readonly db: TrackerDatabase,
    private readonly deviceId: string,
  ) {}

  record(
    entity: string,
    entityId: string,
    action: 'create' | 'update' | 'delete',
    snapshot: unknown,
  ): void {
    // Deliberately fire-and-forget: the change log must never block a UI write.
    void this.db.changeLog
      .add({
        entity,
        entityId,
        action,
        snapshot,
        updatedAt: Date.now(),
        deviceId: this.deviceId,
        syncedAt: null,
      })
      .catch(() => undefined)
  }
}

export class DexieStorage extends BaseStorage {
  constructor(
    private readonly db: TrackerDatabase,
    options: StorageOptions = {},
  ) {
    super(options)
  }

  /* settings --------------------------------------------------------------- */

  getSettings() {
    return this.db.settings.get('singleton')
  }

  async putSettings(settings: UserSettings) {
    await this.db.settings.put(settings)
    this.track('settings', 'update', settings)
  }

  /* subjects --------------------------------------------------------------- */

  async listSubjects() {
    const rows = await this.db.subjects.toArray()
    return rows.sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name))
  }

  getSubject(id: ID) {
    return this.db.subjects.get(id)
  }

  async putSubject(subject: Subject) {
    await this.db.subjects.put(subject)
    this.track('subjects', 'update', subject)
  }

  async putSubjects(subjects: Subject[]) {
    await this.db.subjects.bulkPut(subjects)
    this.trackMany('subjects', 'update', subjects)
  }

  async deleteSubject(id: ID) {
    await this.db.subjects.delete(id)
    this.track('subjects', 'delete', { id })
  }

  /* projects --------------------------------------------------------------- */

  listProjects() {
    return this.db.projects.toArray()
  }

  getProject(id: ID) {
    return this.db.projects.get(id)
  }

  async putProject(project: Project) {
    await this.db.projects.put(project)
    this.track('projects', 'update', project)
  }

  async deleteProject(id: ID) {
    await this.db.projects.delete(id)
    this.track('projects', 'delete', { id })
  }

  /* project tasks ---------------------------------------------------------- */

  async listProjectTasks(projectId?: ID) {
    const rows = projectId
      ? await this.db.projectTasks.where('projectId').equals(projectId).toArray()
      : await this.db.projectTasks.toArray()
    return rows.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
  }

  getProjectTask(id: ID) {
    return this.db.projectTasks.get(id)
  }

  async putProjectTask(task: ProjectTask) {
    await this.db.projectTasks.put(task)
    this.track('projectTasks', 'update', task)
  }

  async putProjectTasks(tasks: ProjectTask[]) {
    await this.db.projectTasks.bulkPut(tasks)
    this.trackMany('projectTasks', 'update', tasks)
  }

  async deleteProjectTask(id: ID) {
    await this.db.projectTasks.delete(id)
    this.track('projectTasks', 'delete', { id })
  }

  /* tasks ------------------------------------------------------------------ */

  async listTasks(query: TaskQuery = {}) {
    let rows = await this.db.tasks.toArray()

    if (query.status?.length) {
      const allowed = new Set(query.status)
      rows = rows.filter((row) => allowed.has(row.status))
    }
    if (query.kind?.length) {
      const allowed = new Set(query.kind)
      rows = rows.filter((row) => allowed.has(row.kind))
    }
    if (query.subjectId) rows = rows.filter((row) => row.subjectId === query.subjectId)
    if (query.projectId) rows = rows.filter((row) => row.projectId === query.projectId)
    if (query.dueFrom) rows = rows.filter((row) => row.dueDate !== null && row.dueDate >= query.dueFrom!)
    if (query.dueTo) rows = rows.filter((row) => row.dueDate !== null && row.dueDate <= query.dueTo!)
    if (query.search) {
      const term = query.search.trim().toLowerCase()
      rows = rows.filter(
        (row) =>
          row.title.toLowerCase().includes(term) ||
          row.description.toLowerCase().includes(term) ||
          row.notes.toLowerCase().includes(term),
      )
    }
    return rows
  }

  getTask(id: ID) {
    return this.db.tasks.get(id)
  }

  async putTask(task: Task) {
    await this.db.tasks.put(task)
    this.track('tasks', 'update', task)
  }

  async putTasks(tasks: Task[]) {
    await this.db.tasks.bulkPut(tasks)
    this.trackMany('tasks', 'update', tasks)
  }

  async deleteTask(id: ID) {
    await this.db.tasks.delete(id)
    this.track('tasks', 'delete', { id })
  }

  /* scheduled events ------------------------------------------------------- */

  async listEvents(query: EventQuery = {}) {
    const includeTemplates = query.includeSeriesTemplates ?? false
    let rows: ScheduledEvent[]
    if (query.from && query.to) {
      rows = await this.db.events.where('date').between(query.from, query.to, true, true).toArray()
    } else if (query.from) {
      rows = await this.db.events.where('date').aboveOrEqual(query.from).toArray()
    } else if (query.to) {
      rows = await this.db.events.where('date').belowOrEqual(query.to).toArray()
    } else {
      rows = await this.db.events.toArray()
    }

    if (!includeTemplates) rows = rows.filter((row) => !row.isSeriesTemplate)
    if (query.category?.length) {
      const allowed = new Set(query.category)
      rows = rows.filter((row) => allowed.has(row.category))
    }
    if (query.subjectId) rows = rows.filter((row) => row.subjectId === query.subjectId)
    if (query.projectId) rows = rows.filter((row) => row.projectId === query.projectId)
    return rows
  }

  getAllEvents() {
    return this.db.events.toArray()
  }

  getEvent(id: ID) {
    return this.db.events.get(id)
  }

  async putEvent(event: ScheduledEvent) {
    await this.db.events.put(event)
    this.track('events', 'update', event)
  }

  async putEvents(events: ScheduledEvent[]) {
    await this.db.events.bulkPut(events)
    this.trackMany('events', 'update', events)
  }

  async deleteEvent(id: ID) {
    await this.db.events.delete(id)
    this.track('events', 'delete', { id })
  }

  async deleteEvents(ids: ID[]) {
    if (ids.length === 0) return
    await this.db.events.bulkDelete(ids)
    for (const id of ids) this.track('events', 'delete', { id })
  }

  async deleteSeries(seriesId: ID) {
    const rows = await this.db.events.where('seriesId').equals(seriesId).toArray()
    await this.deleteEvents(rows.map((row) => row.id))
  }

  /* activity records ------------------------------------------------------- */

  async listActivities(query: RangeQuery = {}) {
    const rows = await this.db.activities.toArray()
    return rows.filter((row) => BaseStorage.inRange(row.date, query))
  }

  getActivity(id: ID) {
    return this.db.activities.get(id)
  }

  async putActivity(record: ActivityRecord) {
    await this.db.activities.put(record)
    this.track('activities', 'update', record)
  }

  async deleteActivity(id: ID) {
    await this.db.activities.delete(id)
    this.track('activities', 'delete', { id })
  }

  /* study sessions --------------------------------------------------------- */

  async listStudySessions(query: StudySessionQuery = {}) {
    const rows = await this.db.studySessions.toArray()
    return rows.filter((row) => {
      if (!BaseStorage.inRange(row.date, query)) return false
      if (query.subjectId && row.subjectId !== query.subjectId) return false
      if (query.projectId && row.projectId !== query.projectId) return false
      if (query.taskId && row.taskId !== query.taskId) return false
      if (query.status && row.status !== query.status) return false
      return true
    })
  }

  getStudySession(id: ID) {
    return this.db.studySessions.get(id)
  }

  async putStudySession(session: StudySession) {
    await this.db.studySessions.put(session)
    this.track('studySessions', 'update', session)
  }

  async deleteStudySession(id: ID) {
    await this.db.studySessions.delete(id)
    this.track('studySessions', 'delete', { id })
  }

  /* timer state ------------------------------------------------------------ */

  getTimerState(id: TimerState['id']) {
    return this.db.timerStates.get(id)
  }

  listTimerStates() {
    return this.db.timerStates.toArray()
  }

  async putTimerState(state: TimerState) {
    await this.db.timerStates.put(state)
    this.track('timerStates', 'update', state)
  }

  /* habits ----------------------------------------------------------------- */

  async listHabits() {
    const rows = await this.db.habits.toArray()
    return rows.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
  }

  getHabit(id: ID) {
    return this.db.habits.get(id)
  }

  async putHabit(habit: Habit) {
    await this.db.habits.put(habit)
    this.track('habits', 'update', habit)
  }

  async deleteHabit(id: ID) {
    await this.db.habits.delete(id)
    const entries = await this.db.habitEntries.where('habitId').equals(id).toArray()
    await this.db.habitEntries.bulkDelete(entries.map((entry) => entry.id))
    this.track('habits', 'delete', { id })
  }

  async listHabitEntries(query: RangeQuery & { habitId?: ID } = {}) {
    const rows = query.habitId
      ? await this.db.habitEntries.where('habitId').equals(query.habitId).toArray()
      : await this.db.habitEntries.toArray()
    return rows.filter((row) => BaseStorage.inRange(row.date, query))
  }

  async putHabitEntry(entry: HabitEntry) {
    await this.db.habitEntries.put(entry)
    this.track('habitEntries', 'update', entry)
  }

  async putHabitEntries(entries: HabitEntry[]) {
    await this.db.habitEntries.bulkPut(entries)
    this.trackMany('habitEntries', 'update', entries)
  }

  async deleteHabitEntry(id: ID) {
    await this.db.habitEntries.delete(id)
    this.track('habitEntries', 'delete', { id })
  }

  /* sleep ------------------------------------------------------------------ */

  getSleepSchedule() {
    return this.db.sleepSchedule.get('singleton')
  }

  async putSleepSchedule(schedule: SleepSchedule) {
    await this.db.sleepSchedule.put(schedule)
    this.track('sleepSchedule', 'update', schedule)
  }

  async listSleepExceptions(query: RangeQuery = {}) {
    const rows = await this.db.sleepExceptions.toArray()
    return rows.filter((row) => BaseStorage.inRange(row.date, query))
  }

  async putSleepException(exception: SleepScheduleException) {
    await this.db.sleepExceptions.put(exception)
    this.track('sleepExceptions', 'update', exception)
  }

  async deleteSleepException(id: ID) {
    await this.db.sleepExceptions.delete(id)
    this.track('sleepExceptions', 'delete', { id })
  }

  async listSleepSessions(query: RangeQuery = {}) {
    const rows = await this.db.sleepSessions.toArray()
    return rows.filter((row) => BaseStorage.inRange(row.date, query))
  }

  getSleepSession(id: ID) {
    return this.db.sleepSessions.get(id)
  }

  async putSleepSession(session: SleepSession) {
    await this.db.sleepSessions.put(session)
    this.track('sleepSessions', 'update', session)
  }

  async deleteSleepSession(id: ID) {
    await this.db.sleepSessions.delete(id)
    this.track('sleepSessions', 'delete', { id })
  }

  async listSleepRoutines() {
    const rows = await this.db.sleepRoutines.toArray()
    return rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.createdAt - b.createdAt)
  }

  async putSleepRoutine(routine: SleepRoutine) {
    await this.db.sleepRoutines.put(routine)
    this.track('sleepRoutines', 'update', routine)
  }

  async deleteSleepRoutine(id: ID) {
    await this.db.sleepRoutines.delete(id)
    const completions = await this.db.sleepRoutineCompletions
      .where('routineId')
      .equals(id)
      .toArray()
    await this.db.sleepRoutineCompletions.bulkDelete(completions.map((row) => row.id))
    this.track('sleepRoutines', 'delete', { id })
  }

  async listRoutineCompletions(query: RangeQuery & { routineId?: ID } = {}) {
    const rows = query.routineId
      ? await this.db.sleepRoutineCompletions.where('routineId').equals(query.routineId).toArray()
      : await this.db.sleepRoutineCompletions.toArray()
    return rows.filter((row) => BaseStorage.inRange(row.date, query))
  }

  async putRoutineCompletion(completion: SleepRoutineCompletion) {
    await this.db.sleepRoutineCompletions.put(completion)
    this.track('sleepRoutineCompletions', 'update', completion)
  }

  /* notifications ---------------------------------------------------------- */

  async listNotificationJobs(query: NotificationJobQuery = {}) {
    let rows = await this.db.notificationJobs.toArray()
    if (query.dueBefore !== undefined) rows = rows.filter((row) => row.fireAt <= query.dueBefore!)
    if (query.from !== undefined) rows = rows.filter((row) => row.fireAt >= query.from!)
    if (query.to !== undefined) rows = rows.filter((row) => row.fireAt <= query.to!)
    if (query.category) rows = rows.filter((row) => row.category === query.category)
    return rows.sort((a, b) => a.fireAt - b.fireAt)
  }

  async putNotificationJob(job: NotificationJob) {
    await this.db.notificationJobs.put(job)
    this.track('notificationJobs', 'update', job)
  }

  async putNotificationJobs(jobs: NotificationJob[]) {
    await this.db.notificationJobs.bulkPut(jobs)
    this.trackMany('notificationJobs', 'update', jobs)
  }

  async deleteNotificationJob(id: ID) {
    await this.db.notificationJobs.delete(id)
    this.track('notificationJobs', 'delete', { id })
  }

  async deleteNotificationJobs(ids: ID[]) {
    if (ids.length === 0) return
    await this.db.notificationJobs.bulkDelete(ids)
  }

  async deleteNotificationJobsBySource(sourceKey: string) {
    const rows = await this.db.notificationJobs.where('sourceKey').equals(sourceKey).toArray()
    await this.db.notificationJobs.bulkDelete(rows.map((row) => row.id))
  }

  async listNotificationLog(query: { limit?: number; unreadOnly?: boolean } = {}) {
    let rows = await this.db.notificationLog.orderBy('deliveredAt').reverse().toArray()
    if (query.unreadOnly) rows = rows.filter((row) => !row.read)
    if (query.limit) rows = rows.slice(0, query.limit)
    return rows
  }

  async putNotificationLog(entry: NotificationLogEntry) {
    await this.db.notificationLog.put(entry)
  }

  async markNotificationRead(id: ID, read: boolean) {
    await this.db.notificationLog.update(id, { read })
  }

  async clearNotificationLog() {
    await this.db.notificationLog.clear()
  }

  /* maintenance ------------------------------------------------------------ */

  async estimateUsage() {
    const nav = navigator as Navigator & { storage?: StorageManager }
    if (!nav.storage || typeof nav.storage.estimate !== 'function') {
      return { usage: null, quota: null }
    }
    try {
      const estimate = await nav.storage.estimate()
      return { usage: estimate.usage ?? null, quota: estimate.quota ?? null }
    } catch {
      return { usage: null, quota: null }
    }
  }

  async clearAll() {
    await clearAllData(this.db)
  }
}
