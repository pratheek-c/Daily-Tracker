import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getStorage } from '@/services/persistence'
import {
  createDefaultMorningRoutine,
  createDefaultSettings,
  createDefaultSleepSchedule,
  createDefaultWindDownRoutine,
} from '@/config/defaults'
import { useTrackerData, type TrackerData } from '@/hooks/useTrackerData'
import { createEvent, occurrencesFor, type NewEventInput } from '@/services/scheduling/events'
import { occurrenceFromEvent, type Occurrence } from '@/services/scheduling/recurrence'
import { computeSessionMath, sleepEventsForRange } from '@/services/scheduling/sleep-events'
import { newId } from '@/lib/utils'
import { addDaysToKey, toDateKey } from '@/lib/date'
import type {
  ActivityRecord,
  DateKey,
  Habit,
  HabitEntry,
  ID,
  Project,
  ProjectTask,
  ScheduledEvent,
  SleepRoutine,
  SleepRoutineCompletion,
  SleepSchedule,
  SleepSession,
  StudySession,
  Subject,
  Task,
  UserSettings,
  Millis,
} from '@/types'

export interface AppContextValue {
  data: TrackerData
  settings: UserSettings
  /** Bumped after every mutation so derived selectors can re-run. */
  revision: number
  /** Live clock, updated once per second. */
  now: Millis
  today: DateKey
  ready: boolean
  error: string | null

  /** Real events plus the sleep blocks generated from the sleep schedule. */
  timeline: (from: DateKey, to: DateKey) => Occurrence[]

  saveSettings: (patch: Partial<Omit<UserSettings, 'id'>>) => Promise<void>
  saveSubject: (subject: Subject) => Promise<void>
  deleteSubject: (id: ID) => Promise<void>
  saveProject: (project: Project) => Promise<void>
  deleteProject: (id: ID) => Promise<void>
  saveProjectTask: (task: ProjectTask) => Promise<void>
  deleteProjectTask: (id: ID) => Promise<void>
  saveTask: (task: Task) => Promise<void>
  deleteTask: (id: ID) => Promise<void>
  saveEvent: (input: NewEventInput, existingId?: ID) => Promise<ScheduledEvent>
  saveEventRecord: (event: ScheduledEvent) => Promise<void>
  deleteEvent: (id: ID) => Promise<void>
  deleteOccurrence: (event: ScheduledEvent, date: DateKey) => Promise<void>
  duplicateEventById: (id: ID, date?: DateKey) => Promise<void>
  moveOccurrence: (
    event: ScheduledEvent,
    fromDate: DateKey,
    toDate: DateKey,
    startTime: string,
    endTime: string,
  ) => Promise<void>
  saveActivity: (record: ActivityRecord) => Promise<void>
  deleteActivity: (id: ID) => Promise<void>
  startActivity: (event: ScheduledEvent, date: DateKey) => Promise<void>
  finishActivity: (
    event: ScheduledEvent,
    date: DateKey,
    status: 'completed' | 'missed' | 'cancelled',
    actualMinutes?: number,
  ) => Promise<void>
  saveStudySession: (session: StudySession) => Promise<void>
  deleteStudySession: (id: ID) => Promise<void>
  saveHabit: (habit: Habit) => Promise<void>
  deleteHabit: (id: ID) => Promise<void>
  toggleHabit: (habit: Habit, date: DateKey, delta?: number) => Promise<void>
  saveSleepSchedule: (patch: Partial<SleepSchedule>) => Promise<void>
  saveSleepException: (date: DateKey, bedtime: string | null, wakeTime: string | null) => Promise<void>
  saveSleepSession: (session: SleepSession) => Promise<void>
  deleteSleepSession: (id: ID) => Promise<void>
  saveRoutine: (routine: SleepRoutine) => Promise<void>
  toggleRoutineItem: (routine: SleepRoutine, date: DateKey, itemId: ID) => Promise<void>
  resetLocalData: () => Promise<void>
  reload: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

const FALLBACK_SETTINGS = createDefaultSettings()

export function AppProvider({ children }: { children: ReactNode }) {
  const data = useTrackerData()
  const [revision, setRevision] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [bootstrapped, setBootstrapped] = useState(false)

  /* -- clock ------------------------------------------------------------- */
  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(handle)
  }, [])

  /* -- first-run bootstrap ------------------------------------------------ */
  useEffect(() => {
    if (!data.ready || bootstrapped) return
    let cancelled = false

    void (async () => {
      try {
        const storage = getStorage()
        const stamp = Date.now()
        const existingSettings = await storage.getSettings()
        if (!existingSettings) await storage.putSettings(createDefaultSettings(stamp))

        const existingSchedule = await storage.getSleepSchedule()
        if (!existingSchedule) await storage.putSleepSchedule(createDefaultSleepSchedule(stamp))

        const routines = await storage.listSleepRoutines()
        if (routines.length === 0) {
          await storage.putSleepRoutine(createDefaultWindDownRoutine(stamp))
          await storage.putSleepRoutine(createDefaultMorningRoutine(stamp))
        }
        if (!cancelled) setBootstrapped(true)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not open local storage')
          setBootstrapped(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [data.ready, bootstrapped])

  /**
   * Notify the app that a mutation landed.
   *
   * `adt:data-changed` is what the cloud layer listens for: keeping the signal on
   * the window rather than in React state means the sync engine never becomes a
   * dependency of the data layer, so the app still works with no cloud at all.
   */
  const bump = useCallback(() => {
    setRevision((value) => value + 1)
    try {
      window.dispatchEvent(new CustomEvent('adt:data-changed'))
    } catch {
      // A non-browser environment (tests) simply skips the notification.
    }
  }, [])
  const reload = useCallback(() => bump(), [bump])

  const settings = data.settings ?? FALLBACK_SETTINGS
  const sleepSchedule = data.sleepSchedule ?? createDefaultSleepSchedule()

  /**
   * Merge stored events with the sleep blocks generated from the schedule.
   * Sleep is generated rather than stored so a nightly schedule and one-off
   * edits never fight each other.
   */
  const timeline = useCallback(
    (from: DateKey, to: DateKey): Occurrence[] => {
      const stored = occurrencesFor(data.events, from, to)
      const sleep = sleepEventsForRange(
        sleepSchedule,
        addDaysToKey(from, -1),
        to,
        data.sleepExceptions,
        data.sleepSessions,
        { includeWindDown: true },
      )
      const sleepOccurrences = sleep
        .map((event) => occurrenceFromEvent(event))
        .filter((occurrence) => occurrence.date >= from && occurrence.date <= to)
      return [...stored, ...sleepOccurrences].sort(
        (a, b) => a.startMillis - b.startMillis || a.event.title.localeCompare(b.event.title),
      )
    },
    [data.events, data.sleepExceptions, data.sleepSessions, sleepSchedule],
  )

  /* -- mutations ---------------------------------------------------------- */

  const saveSettings = useCallback(
    async (patch: Partial<Omit<UserSettings, 'id'>>) => {
      const storage = getStorage()
      const current = (await storage.getSettings()) ?? createDefaultSettings()
      await storage.putSettings({ ...current, ...patch, id: 'singleton', updatedAt: Date.now() })
      bump()
    },
    [bump],
  )

  const saveSubject = useCallback(
    async (subject: Subject) => {
      await getStorage().putSubject(subject)
      bump()
    },
    [bump],
  )

  const deleteSubject = useCallback(
    async (id: ID) => {
      const storage = getStorage()
      await storage.deleteSubject(id)
      // Detach the subject from anything that referenced it rather than
      // silently orphaning records.
      const tasks = (await storage.listTasks({ subjectId: id })).map((task) => ({
        ...task,
        subjectId: null,
        updatedAt: Date.now(),
      }))
      await storage.putTasks(tasks)
      const events = (await storage.listEvents({ subjectId: id })).map((event) => ({
        ...event,
        subjectId: null,
        updatedAt: Date.now(),
      }))
      await storage.putEvents(events)
      bump()
    },
    [bump],
  )

  const saveProject = useCallback(
    async (project: Project) => {
      await getStorage().putProject(project)
      bump()
    },
    [bump],
  )

  const deleteProject = useCallback(
    async (id: ID) => {
      const storage = getStorage()
      const childTasks = await storage.listProjectTasks(id)
      for (const child of childTasks) await storage.deleteProjectTask(child.id)
      await storage.deleteProject(id)
      bump()
    },
    [bump],
  )

  const saveProjectTask = useCallback(
    async (task: ProjectTask) => {
      await getStorage().putProjectTask(task)
      bump()
    },
    [bump],
  )

  const deleteProjectTask = useCallback(
    async (id: ID) => {
      const storage = getStorage()
      const children = (await storage.listProjectTasks()).filter((task) => task.parentTaskId === id)
      for (const child of children) await storage.deleteProjectTask(child.id)
      await storage.deleteProjectTask(id)
      bump()
    },
    [bump],
  )

  const saveTask = useCallback(
    async (task: Task) => {
      await getStorage().putTask(task)
      bump()
    },
    [bump],
  )

  const deleteTask = useCallback(
    async (id: ID) => {
      await getStorage().deleteTask(id)
      bump()
    },
    [bump],
  )

  const saveEvent = useCallback(
    async (input: NewEventInput, existingId?: ID) => {
      const storage = getStorage()
      const stamp = Date.now()
      if (existingId) {
        const existing = await storage.getEvent(existingId)
        if (existing) {
          const overnight =
            input.endTime <= input.startTime ? true : existing.overnight && input.endTime === existing.endTime
          const updated: ScheduledEvent = {
            ...existing,
            ...input,
            title: input.title.trim(),
            description: input.description?.trim() ?? existing.description,
            notes: input.notes?.trim() ?? existing.notes,
            location: input.location?.trim() ?? existing.location,
            meetingUrl: input.meetingUrl?.trim() ?? existing.meetingUrl,
            reminders: input.reminders ?? existing.reminders,
            recurrence: input.recurrence !== undefined ? input.recurrence : existing.recurrence,
            overnight,
            updatedAt: stamp,
          }
          await storage.putEvent(updated)
          bump()
          return updated
        }
      }
      const created = createEvent(input, stamp)
      await storage.putEvent(created)
      bump()
      return created
    },
    [bump],
  )

  const saveEventRecord = useCallback(
    async (event: ScheduledEvent) => {
      await getStorage().putEvent({ ...event, updatedAt: Date.now() })
      bump()
    },
    [bump],
  )

  const deleteEvent = useCallback(
    async (id: ID) => {
      const storage = getStorage()
      const event = await storage.getEvent(id)
      if (event?.seriesId) await storage.deleteSeries(event.seriesId)
      else await storage.deleteEvent(id)
      bump()
    },
    [bump],
  )

  /** Cancel a single occurrence without touching the rest of the series. */
  const deleteOccurrence = useCallback(
    async (event: ScheduledEvent, date: DateKey) => {
      const storage = getStorage()
      if (!event.seriesId) {
        await storage.deleteEvent(event.id)
        bump()
        return
      }
      const marker: ScheduledEvent = {
        ...event,
        id: `cancel_${event.seriesId}_${date}`,
        date,
        occurrenceDate: date,
        isSeriesTemplate: false,
        status: 'cancelled',
        updatedAt: Date.now(),
      }
      await storage.putEvent(marker)
      bump()
    },
    [bump],
  )

  const duplicateEventById = useCallback(
    async (id: ID, date?: DateKey) => {
      const storage = getStorage()
      const event = await storage.getEvent(id)
      if (!event) return
      const copy: ScheduledEvent = {
        ...event,
        id: newId('evt'),
        date: date ?? event.date,
        seriesId: null,
        occurrenceDate: null,
        isSeriesTemplate: false,
        recurrence: null,
        status: 'planned',
        startedAt: null,
        finishedAt: null,
        actualMinutes: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await storage.putEvent(copy)
      bump()
    },
    [bump],
  )

  /** Move a single occurrence of a series by turning it into an exception + copy. */
  const moveOccurrence = useCallback(
    async (
      event: ScheduledEvent,
      fromDate: DateKey,
      toDate: DateKey,
      startTime: string,
      endTime: string,
    ) => {
      const storage = getStorage()
      const stamp = Date.now()
      const overnight = endTime <= startTime

      if (!event.seriesId || !event.recurrence) {
        await storage.putEvent({
          ...event,
          date: toDate,
          startTime,
          endTime,
          overnight,
          updatedAt: stamp,
        })
        bump()
        return
      }

      const cancelMarker: ScheduledEvent = {
        ...event,
        id: `cancel_${event.seriesId}_${fromDate}`,
        date: fromDate,
        occurrenceDate: fromDate,
        isSeriesTemplate: false,
        status: 'cancelled',
        notes: 'Moved by you',
        updatedAt: stamp,
      }
      const moved: ScheduledEvent = {
        ...event,
        id: newId('evt'),
        date: toDate,
        startTime,
        endTime,
        overnight,
        recurrence: null,
        seriesId: null,
        occurrenceDate: null,
        isSeriesTemplate: false,
        updatedAt: stamp,
        createdAt: stamp,
      }
      await storage.putEvent(cancelMarker)
      await storage.putEvent(moved)
      bump()
    },
    [bump],
  )

  const saveActivity = useCallback(
    async (record: ActivityRecord) => {
      await getStorage().putActivity(record)
      bump()
    },
    [bump],
  )

  const deleteActivity = useCallback(
    async (id: ID) => {
      await getStorage().deleteActivity(id)
      bump()
    },
    [bump],
  )

  const startActivity = useCallback(
    async (event: ScheduledEvent, date: DateKey) => {
      const storage = getStorage()
      const stamp = Date.now()
      const payload = event.isSeriesTemplate
        ? {
            ...event,
            id: `run_${event.seriesId}_${date}`,
            date,
            occurrenceDate: date,
            isSeriesTemplate: false,
            recurrence: null,
            seriesId: event.seriesId,
            status: 'in-progress' as const,
            startedAt: stamp,
            updatedAt: stamp,
          }
        : { ...event, status: 'in-progress' as const, startedAt: stamp, updatedAt: stamp }
      await storage.putEvent(payload)
      bump()
    },
    [bump],
  )

  const finishActivity = useCallback(
    async (
      event: ScheduledEvent,
      date: DateKey,
      status: 'completed' | 'missed' | 'cancelled',
      actualMinutes?: number,
    ) => {
      const storage = getStorage()
      const stamp = Date.now()
      const startedAt = event.startedAt ?? stamp
      const minutes = actualMinutes ?? Math.max(1, Math.round((stamp - startedAt) / 60_000))

      const source = event.isSeriesTemplate
        ? {
            ...event,
            id: `run_${event.seriesId}_${date}`,
            date,
            occurrenceDate: date,
            isSeriesTemplate: false,
            recurrence: null,
          }
        : event

      await storage.putEvent({
        ...source,
        status,
        finishedAt: stamp,
        actualMinutes: status === 'completed' ? minutes : 0,
        updatedAt: stamp,
      })

      // Every finish writes an immutable activity record; finished work is the
      // source of truth for analytics rather than the editable plan.
      const record: ActivityRecord = {
        id: newId('act'),
        eventId: source.id,
        title: source.title,
        category: source.category,
        date,
        plannedMinutes: source.plannedMinutes ?? 0,
        actualMinutes: status === 'completed' ? minutes : 0,
        status,
        startedAt,
        finishedAt: stamp,
        subjectId: source.subjectId,
        projectId: source.projectId,
        projectTaskId: source.projectTaskId,
        notes: '',
        createdAt: stamp,
        updatedAt: stamp,
      }
      await storage.putActivity(record)
      bump()
    },
    [bump],
  )

  const saveStudySession = useCallback(
    async (session: StudySession) => {
      await getStorage().putStudySession(session)
      bump()
    },
    [bump],
  )

  const deleteStudySession = useCallback(
    async (id: ID) => {
      await getStorage().deleteStudySession(id)
      bump()
    },
    [bump],
  )

  const saveHabit = useCallback(
    async (habit: Habit) => {
      await getStorage().putHabit(habit)
      bump()
    },
    [bump],
  )

  const deleteHabit = useCallback(
    async (id: ID) => {
      await getStorage().deleteHabit(id)
      bump()
    },
    [bump],
  )

  const toggleHabit = useCallback(
    async (habit: Habit, date: DateKey, delta = 1) => {
      const storage = getStorage()
      const stamp = Date.now()
      const existing = (await storage.listHabitEntries({ habitId: habit.id, from: date, to: date }))[0]
      const nextCount = Math.max(0, (existing?.count ?? 0) + delta)
      const entry: HabitEntry = {
        id: existing?.id ?? newId('habitentry'),
        habitId: habit.id,
        date,
        count: nextCount,
        completed: nextCount >= habit.targetCount,
        notes: existing?.notes ?? '',
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      }
      await storage.putHabitEntry(entry)
      bump()
    },
    [bump],
  )

  const saveSleepSchedule = useCallback(
    async (patch: Partial<SleepSchedule>) => {
      const storage = getStorage()
      const current = (await storage.getSleepSchedule()) ?? createDefaultSleepSchedule()
      await storage.putSleepSchedule({ ...current, ...patch, id: 'singleton', updatedAt: Date.now() })
      bump()
    },
    [bump],
  )

  const saveSleepException = useCallback(
    async (date: DateKey, bedtime: string | null, wakeTime: string | null) => {
      const storage = getStorage()
      const existing = (await storage.listSleepExceptions({ from: date, to: date }))[0]
      if (!bedtime && !wakeTime) {
        if (existing) await storage.deleteSleepException(existing.id)
        bump()
        return
      }
      await storage.putSleepException({
        id: existing?.id ?? newId('sleepexc'),
        date,
        bedtime,
        wakeTime,
        note: existing?.note ?? '',
        createdAt: existing?.createdAt ?? Date.now(),
      })
      bump()
    },
    [bump],
  )

  const saveSleepSession = useCallback(
    async (session: SleepSession) => {
      const maths = computeSessionMath(session)
      await getStorage().putSleepSession({
        ...session,
        timeInBedMinutes: maths.timeInBedMinutes,
        estimatedSleepMinutes: maths.estimatedSleepMinutes,
        awakeMinutes: maths.awakeMinutes,
        updatedAt: Date.now(),
      })
      bump()
    },
    [bump],
  )

  const deleteSleepSession = useCallback(
    async (id: ID) => {
      await getStorage().deleteSleepSession(id)
      bump()
    },
    [bump],
  )

  const saveRoutine = useCallback(
    async (routine: SleepRoutine) => {
      await getStorage().putSleepRoutine({ ...routine, updatedAt: Date.now() })
      bump()
    },
    [bump],
  )

  const toggleRoutineItem = useCallback(
    async (routine: SleepRoutine, date: DateKey, itemId: ID) => {
      const storage = getStorage()
      const stamp = Date.now()
      const existing = (
        await storage.listRoutineCompletions({ routineId: routine.id, from: date, to: date })
      )[0]
      const current = existing?.completedItemIds ?? []
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
      const completion: SleepRoutineCompletion = {
        id: existing?.id ?? newId('routinecomp'),
        routineId: routine.id,
        date,
        completedItemIds: next,
        completedAt: next.length === routine.items.length ? stamp : null,
        updatedAt: stamp,
      }
      await storage.putRoutineCompletion(completion)
      bump()
    },
    [bump],
  )

  const resetLocalData = useCallback(async () => {
    await getStorage().clearAll()
    const stamp = Date.now()
    const storage = getStorage()
    await storage.putSettings(createDefaultSettings(stamp))
    await storage.putSleepSchedule(createDefaultSleepSchedule(stamp))
    await storage.putSleepRoutine(createDefaultWindDownRoutine(stamp))
    await storage.putSleepRoutine(createDefaultMorningRoutine(stamp))
    bump()
  }, [bump])

  const value = useMemo<AppContextValue>(
    () => ({
      data,
      settings,
      revision,
      now,
      today: toDateKey(now),
      ready: data.ready && bootstrapped,
      error,
      timeline,
      saveSettings,
      saveSubject,
      deleteSubject,
      saveProject,
      deleteProject,
      saveProjectTask,
      deleteProjectTask,
      saveTask,
      deleteTask,
      saveEvent,
      saveEventRecord,
      deleteEvent,
      deleteOccurrence,
      duplicateEventById,
      moveOccurrence,
      saveActivity,
      deleteActivity,
      startActivity,
      finishActivity,
      saveStudySession,
      deleteStudySession,
      saveHabit,
      deleteHabit,
      toggleHabit,
      saveSleepSchedule,
      saveSleepException,
      saveSleepSession,
      deleteSleepSession,
      saveRoutine,
      toggleRoutineItem,
      resetLocalData,
      reload,
    }),
    [
      data,
      settings,
      revision,
      now,
      error,
      timeline,
      saveSettings,
      saveSubject,
      deleteSubject,
      saveProject,
      deleteProject,
      saveProjectTask,
      deleteProjectTask,
      saveTask,
      deleteTask,
      saveEvent,
      saveEventRecord,
      deleteEvent,
      deleteOccurrence,
      duplicateEventById,
      moveOccurrence,
      saveActivity,
      deleteActivity,
      startActivity,
      finishActivity,
      saveStudySession,
      deleteStudySession,
      saveHabit,
      deleteHabit,
      toggleHabit,
      saveSleepSchedule,
      saveSleepException,
      saveSleepSession,
      deleteSleepSession,
      saveRoutine,
      toggleRoutineItem,
      resetLocalData,
      reload,
      bootstrapped,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside <AppProvider>')
  return context
}
