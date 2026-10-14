import { addDaysToKey, dateKeyRange, toDateKey, todayKey, weekdayOf, type DateKey } from '@/lib/date'
import { percent, sum } from '@/lib/utils'

/** Re-exported under a clearer name for tests and callers. */
export { percent as percentOf } from '@/lib/utils'
import { eventEndMillis } from './metrics'
import type {
  ActivityRecord,
  Habit,
  HabitEntry,
  SleepRoutine,
  SleepRoutineCompletion,
  SleepSession,
  StudySession,
  Task,
} from '@/types'
import type { Occurrence } from '@/services/scheduling/recurrence'

/* -------------------------------------------------------------------------- */
/* Day-level rollup                                                           */
/* -------------------------------------------------------------------------- */

export interface DayRollup {
  date: DateKey
  plannedMinutes: number
  plannedByCategory: Record<string, number>
  completedActivities: number
  missedActivities: number
  plannedActivities: number
  studyMinutes: number
  projectMinutes: number
  activityMinutes: number
  sleepMinutes: number | null
  habitsScheduled: number
  habitsCompleted: number
  tasksDue: number
  tasksCompleted: number
}

export function buildDayRollup(input: {
  date: DateKey
  occurrences: Occurrence[]
  activities: ActivityRecord[]
  studySessions: StudySession[]
  sleepSessions: SleepSession[]
  habits: Habit[]
  habitEntries: HabitEntry[]
  tasks: Task[]
}): DayRollup {
  const { date, occurrences, activities, studySessions, sleepSessions, habits, habitEntries, tasks } = input

  const plannedByCategory: Record<string, number> = {}
  let plannedMinutes = 0
  for (const occurrence of occurrences) {
    if (occurrence.date !== date) continue
    const minutes = occurrence.durationMinutes
    plannedMinutes += minutes
    plannedByCategory[occurrence.event.category] =
      (plannedByCategory[occurrence.event.category] ?? 0) + minutes
  }

  const dayAgenda = occurrences.filter(
    (occurrence) => occurrence.date === date && occurrence.event.category !== 'sleep',
  )
  const dayActivities = activities.filter((record) => record.date === date)
  const studyMinutes = studySessions
    .filter((session) => session.date === date && session.status === 'completed')
    .reduce((total, session) => total + Math.round(session.focusedSeconds / 60), 0)

  // Project minutes are attributed from completed activities linked to a project.
  const projectMinutes = dayActivities
    .filter((record) => record.projectId && record.status === 'completed')
    .reduce((total, record) => total + record.actualMinutes, 0)

  const activityMinutes = dayActivities
    .filter((record) => record.status === 'completed')
    .reduce((total, record) => total + record.actualMinutes, 0)

  const sleep = sleepSessions.find((session) => session.date === date)
  const scheduledHabits = habits.filter(
    (habit) => !habit.archived && (habit.schedule === 'daily' || habit.days.includes(weekdayOf(date))),
  )
  const completedHabits = scheduledHabits.filter((habit) =>
    habitEntries.some((entry) => entry.habitId === habit.id && entry.date === date && entry.completed),
  )

  const dueToday = tasks.filter((task) => task.dueDate === date)

  return {
    date,
    plannedMinutes,
    plannedByCategory,
    plannedActivities: dayAgenda.length,
    completedActivities: dayAgenda.filter((occurrence) => occurrence.event.status === 'completed').length,
    missedActivities: dayAgenda.filter((occurrence) => occurrence.event.status === 'missed').length,
    studyMinutes,
    projectMinutes,
    activityMinutes,
    sleepMinutes: sleep ? (sleep.estimatedSleepMinutes ?? sleep.timeInBedMinutes) : null,
    habitsScheduled: scheduledHabits.length,
    habitsCompleted: completedHabits.length,
    tasksDue: dueToday.length,
    tasksCompleted: dueToday.filter((task) => task.status === 'done').length,
  }
}

/* -------------------------------------------------------------------------- */
/* Range aggregation                                                          */
/* -------------------------------------------------------------------------- */

export interface RangeSummary {
  from: DateKey
  to: DateKey
  days: number
  plannedMinutes: number
  actualMinutes: number
  studyMinutes: number
  projectMinutes: number
  breakMinutes: number
  sleepMinutesTotal: number
  sleepNights: number
  averageSleepMinutes: number | null
  sessionCount: number
  averageSessionMinutes: number
  tasksCompleted: number
  tasksCreated: number
  tasksOverdue: number
  habitCompletionPercent: number
  habitOpportunities: number
  habitCompletions: number
  focusSessions: number
  rescheduledCount: number
  completionRate: number
  studyGoalPercent: number
  sleepGoalPercent: number
}

export function buildRangeSummary(input: {
  from: DateKey
  to: DateKey
  rollups: DayRollup[]
  studySessions: StudySession[]
  activities: ActivityRecord[]
  sleepSessions: SleepSession[]
  habits: Habit[]
  habitEntries: HabitEntry[]
  tasks: Task[]
  weeklyStudyGoalMinutes: number
  sleepGoalMinutes: number
  /** Occurrences that were moved or cancelled inside the range. */
  rescheduledCount?: number
}): RangeSummary {
  const {
    from,
    to,
    rollups,
    studySessions,
    activities,
    sleepSessions,
    habits,
    habitEntries,
    tasks,
    weeklyStudyGoalMinutes,
    sleepGoalMinutes,
  } = input

  const inRange = (date: DateKey) => date >= from && date <= to
  const sessions = studySessions.filter(
    (session) => inRange(session.date) && session.status === 'completed',
  )
  const studyMinutes = sessions.reduce((total, session) => total + Math.round(session.focusedSeconds / 60), 0)

  const dayActivities = activities.filter((record) => inRange(record.date))
  const completedActivities = dayActivities.filter((record) => record.status === 'completed')
  const actualMinutes = completedActivities.reduce((total, record) => total + record.actualMinutes, 0)
  const projectMinutes = completedActivities
    .filter((record) => record.projectId)
    .reduce((total, record) => total + record.actualMinutes, 0)
  const breakMinutes = rollups
    .flatMap((rollup) => Object.entries(rollup.plannedByCategory))
    .filter(([category]) => category === 'break')
    .reduce((total, [, minutes]) => total + minutes, 0)

  const nights = sleepSessions.filter(
    (session) => inRange(session.date) && (session.estimatedSleepMinutes !== null || session.endAt !== null),
  )
  const sleepMinutesTotal = nights.reduce(
    (total, session) => total + (session.estimatedSleepMinutes ?? session.timeInBedMinutes),
    0,
  )

  const tasksCompleted = tasks.filter(
    (task) => task.completedAt !== null && inRange(taskDueOrCompleted(task)),
  ).length
  const tasksCreated = tasks.filter((task) => inRange(taskCreatedDate(task))).length
  const tasksOverdue = tasks.filter(
    (task) => task.status !== 'done' && task.dueDate !== null && task.dueDate < todayKey() && inRange(task.dueDate),
  ).length

  let opportunities = 0
  let completions = 0
  for (const date of dateKeyRange(from, to)) {
    const weekday = weekdayOf(date)
    for (const habit of habits) {
      if (habit.archived) continue
      if (habit.schedule === 'weekly' && !habit.days.includes(weekday)) continue
      opportunities += 1
      if (habitEntries.some((entry) => entry.habitId === habit.id && entry.date === date && entry.completed)) {
        completions += 1
      }
    }
  }

  const plannedMinutes = sum(rollups.map((rollup) => rollup.plannedMinutes))
  const days = Math.max(1, rollups.length)
  const weeks = days / 7
  const goalMinutes = weeklyStudyGoalMinutes * weeks

  return {
    from,
    to,
    days,
    plannedMinutes,
    actualMinutes,
    studyMinutes,
    projectMinutes,
    breakMinutes,
    sleepMinutesTotal,
    sleepNights: nights.length,
    averageSleepMinutes: nights.length === 0 ? null : Math.round(sleepMinutesTotal / nights.length),
    sessionCount: sessions.length,
    averageSessionMinutes:
      sessions.length === 0 ? 0 : Math.round(studyMinutes / sessions.length),
    tasksCompleted,
    tasksCreated,
    tasksOverdue,
    habitOpportunities: opportunities,
    habitCompletions: completions,
    habitCompletionPercent: percent(completions, opportunities),
    focusSessions: sessions.filter((session) => session.technique === 'pomodoro').length,
    rescheduledCount: input.rescheduledCount ?? 0,
    completionRate: percent(actualMinutes, Math.max(plannedMinutes, actualMinutes)),
    studyGoalPercent: percent(studyMinutes, goalMinutes),
    sleepGoalPercent: percent(
      nights.length === 0 ? 0 : sleepMinutesTotal / nights.length,
      sleepGoalMinutes,
    ),
  }
}

function taskCreatedDate(task: Task): DateKey {
  return toDateKey(task.createdAt)
}

function taskDueOrCompleted(task: Task): DateKey {
  if (task.completedAt) return toDateKey(task.completedAt)
  return task.dueDate ?? taskCreatedDate(task)
}

/* -------------------------------------------------------------------------- */
/* Habit streaks                                                              */
/* -------------------------------------------------------------------------- */

export interface HabitStreak {
  current: number
  best: number
  /** Completed days inside the last 28 scheduled days, for the consistency bar. */
  consistency: number
  last28: { date: DateKey; scheduled: boolean; completed: boolean }[]
}

/**
 * Streaks are counted only across *scheduled* days.
 *
 * A habit set for Mon/Wed/Fri is never penalised for the days in between, which
 * is the difference between a motivating streak and a demoralising one.
 */
export function habitStreak(
  habit: Habit,
  entries: HabitEntry[],
  reference = todayKey(),
  windowDays = 28,
): HabitStreak {
  const isScheduled = (date: DateKey) =>
    habit.schedule === 'daily' || habit.days.includes(weekdayOf(date))
  const isComplete = (date: DateKey) =>
    entries.some((entry) => entry.habitId === habit.id && entry.date === date && entry.completed)

  const days: DateKey[] = []
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    days.push(addDaysToKey(reference, -offset))
  }
  const last28 = days.map((date) => ({
    date,
    scheduled: isScheduled(date),
    completed: isComplete(date),
  }))

  // Current streak: walk backwards from today (or yesterday if today is not
  // scheduled yet) across scheduled days only.
  let current = 0
  let cursor = reference
  for (let guard = 0; guard < 400; guard += 1) {
    if (isScheduled(cursor)) {
      if (isComplete(cursor)) {
        current += 1
      } else if (cursor === reference) {
        // Today is still open; do not break the streak for it.
      } else {
        break
      }
    }
    cursor = addDaysToKey(cursor, -1)
  }

  // Best streak across all recorded history.
  const completedDates = entries
    .filter((entry) => entry.habitId === habit.id && entry.completed)
    .map((entry) => entry.date)
    .sort()
  let best = 0
  let run = 0
  let previous: DateKey | null = null
  for (const date of completedDates) {
    if (!isScheduled(date)) continue
    if (previous === null) {
      run = 1
    } else {
      // Count scheduled days between `previous` and `date`.
      let gap = 0
      let walker = addDaysToKey(previous, 1)
      while (walker < date) {
        if (isScheduled(walker)) gap += 1
        walker = addDaysToKey(walker, 1)
      }
      run = gap === 0 ? run + 1 : 1
    }
    best = Math.max(best, run)
    previous = date
  }

  const scheduled = last28.filter((day) => day.scheduled)
  const consistency = percent(
    scheduled.filter((day) => day.completed).length,
    scheduled.length,
  )

  return { current, best: Math.max(best, current), consistency, last28 }
}

export function habitScheduledOn(habit: Habit, date: DateKey) {
  return habit.schedule === 'daily' || habit.days.includes(weekdayOf(date))
}

export function habitCompletedOn(habit: Habit, entries: HabitEntry[], date: DateKey) {
  return entries.some((entry) => entry.habitId === habit.id && entry.date === date && entry.completed)
}

/* -------------------------------------------------------------------------- */
/* Sleep analytics                                                            */
/* -------------------------------------------------------------------------- */

export interface SleepPoint {
  date: DateKey
  timeInBedMinutes: number
  estimatedSleepMinutes: number | null
  bedtimeMinutes: number | null
  wakeMinutes: number | null
  awakenings: number
  quality: number | null
}

export function sleepSeries(sessions: SleepSession[], from: DateKey, to: DateKey): SleepPoint[] {
  return sessions
    .filter((session) => session.date >= from && session.date <= to)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((session) => {
      const bed = new Date(session.startAt)
      const wake = session.endAt ? new Date(session.endAt) : null
      return {
        date: session.date,
        timeInBedMinutes: session.timeInBedMinutes,
        estimatedSleepMinutes: session.estimatedSleepMinutes,
        // Hours since 18:00, so an 01:00 bedtime plots after a 23:00 one.
        bedtimeMinutes: minutesSince18(bed),
        wakeMinutes: wake ? wake.getHours() * 60 + wake.getMinutes() : null,
        awakenings: session.awakenings.length,
        quality: session.quality,
      }
    })
}

function minutesSince18(date: Date): number {
  const minutes = date.getHours() * 60 + date.getMinutes()
  return minutes >= 18 * 60 ? minutes - 18 * 60 : minutes + 6 * 60
}

export interface RoutineProgress {
  routineId: string
  name: string
  kind: 'winddown' | 'morning'
  total: number
  done: number
  percent: number
}

export function routineProgress(
  routines: SleepRoutine[],
  completions: SleepRoutineCompletion[],
  date: DateKey,
): RoutineProgress[] {
  return routines
    .filter((routine) => routine.enabled)
    .map((routine) => {
      const completion = completions.find(
        (row) => row.routineId === routine.id && row.date === date,
      )
      const done = completion ? completion.completedItemIds.length : 0
      return {
        routineId: routine.id,
        name: routine.name,
        kind: routine.kind,
        total: routine.items.length,
        done,
        percent: percent(done, routine.items.length),
      }
    })
}

/* -------------------------------------------------------------------------- */
/* Attention lists                                                            */
/* -------------------------------------------------------------------------- */

export interface AttentionItem {
  id: string
  title: string
  detail: string
  tone: 'danger' | 'warning' | 'accent' | 'neutral'
  to: string
}

export function buildAttentionList(input: {
  tasks: Task[]
  occurrences: Occurrence[]
  habits: Habit[]
  habitEntries: HabitEntry[]
  today: DateKey
}): AttentionItem[] {
  const items: AttentionItem[] = []
  const now = Date.now()

  for (const task of input.tasks) {
    if (task.status === 'done' || !task.dueDate) continue
    if (task.dueDate < input.today) {
      items.push({
        id: `overdue-${task.id}`,
        title: task.title,
        detail: `Overdue since ${task.dueDate}`,
        tone: 'danger',
        to: '/tasks?filter=overdue',
      })
    } else if (task.dueDate === input.today) {
      items.push({
        id: `today-${task.id}`,
        title: task.title,
        detail: task.dueTime ? `Due at ${task.dueTime}` : 'Due today',
        tone: 'warning',
        to: '/tasks?filter=today',
      })
    }
  }

  for (const occurrence of input.occurrences) {
    const end = eventEndMillis(occurrence.event)
    if (end >= now) continue
    if (occurrence.event.status === 'planned') {
      items.push({
        id: `missed-${occurrence.event.id}-${occurrence.date}`,
        title: occurrence.event.title,
        detail: `Not marked done on ${occurrence.date}`,
        tone: 'neutral',
        to: `/planner?date=${occurrence.date}`,
      })
    }
  }

  for (const habit of input.habits) {
    if (habit.archived) continue
    if (!habitScheduledOn(habit, input.today)) continue
    if (habitCompletedOn(habit, input.habitEntries, input.today)) continue
    items.push({
      id: `habit-${habit.id}`,
      title: habit.name,
      detail: 'Scheduled for today',
      tone: 'accent',
      to: '/habits',
    })
  }

  return items.slice(0, 12)
}

export { weekdayOf }
