import { describe, expect, it } from 'vitest'
import { buildDayRollup, habitStreak, percentOf, routineProgress } from './selectors'
import { checklistProgress, projectProgress } from './metrics'
import type { Habit, HabitEntry, SleepRoutine, SleepRoutineCompletion } from '@/types'

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    name: 'Study daily',
    description: '',
    icon: 'book-open',
    color: '#8FCBA8',
    schedule: 'daily',
    days: [0, 1, 2, 3, 4, 5, 6],
    targetCount: 1,
    unit: '',
    reminderTime: null,
    reminderEnabled: false,
    archived: false,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function entry(date: string, completed = true, habitId = 'habit-1'): HabitEntry {
  return {
    id: `${habitId}-${date}`,
    habitId,
    date,
    count: completed ? 1 : 0,
    completed,
    notes: '',
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('habitStreak', () => {
  it('counts consecutive completed days', () => {
    const habit = makeHabit()
    const entries = ['2026-03-01', '2026-03-02', '2026-03-03'].map((date) => entry(date))
    const streak = habitStreak(habit, entries, '2026-03-03', 28)
    expect(streak.current).toBe(3)
    expect(streak.best).toBe(3)
  })

  it('does not break a streak for an incomplete today that is still open', () => {
    const habit = makeHabit()
    const entries = ['2026-03-01', '2026-03-02'].map((date) => entry(date))
    const streak = habitStreak(habit, entries, '2026-03-03', 28)
    // 2026-03-03 has no entry yet, but the day is not over.
    expect(streak.current).toBe(2)
  })

  it('breaks a streak after a missed scheduled day', () => {
    const habit = makeHabit()
    const entries = ['2026-03-01', '2026-03-02'].map((date) => entry(date))
    // 2026-03-03 was missed, and we are now on the 4th.
    const streak = habitStreak(habit, entries, '2026-03-04', 28)
    expect(streak.current).toBe(0)
    expect(streak.best).toBe(2)
  })

  it('never penalises days a weekly habit is not scheduled', () => {
    // Monday + Thursday only. 2026-03-02 is a Monday, 2026-03-05 a Thursday.
    const habit = makeHabit({ schedule: 'weekly', days: [1, 4] })
    const entries = [entry('2026-03-02'), entry('2026-03-05'), entry('2026-03-09')]
    const streak = habitStreak(habit, entries, '2026-03-09', 28)
    // Tue/Wed/Fri/Sat/Sun are not scheduled, so the streak continues across them.
    expect(streak.current).toBe(3)
  })

  it('reports a consistency percentage against scheduled days only', () => {
    const habit = makeHabit({ schedule: 'weekly', days: [1] })
    // The 28-day window ending 2026-03-30 (a Monday) holds four Mondays:
    // 2026-03-09, 03-16, 03-23 and 03-30. Only two of them were completed, and
    // the other 24 days are not scheduled at all, so they must not count.
    const entries = [entry('2026-03-16'), entry('2026-03-23')]
    const streak = habitStreak(habit, entries, '2026-03-30', 28)
    expect(streak.last28.filter((day) => day.scheduled)).toHaveLength(4)
    expect(streak.consistency).toBe(50)
  })

  it('starts a fresh run after a gap when computing the best streak', () => {
    const habit = makeHabit()
    const entries = ['2026-03-01', '2026-03-02', '2026-03-05', '2026-03-06', '2026-03-07'].map((date) =>
      entry(date),
    )
    const streak = habitStreak(habit, entries, '2026-03-07', 28)
    expect(streak.best).toBe(3)
    expect(streak.current).toBe(3)
  })
})

describe('checklistProgress', () => {
  it('weights items by their declared weight', () => {
    const progress = checklistProgress([
      { done: true, weight: 3 },
      { done: false, weight: 1 },
    ])
    expect(progress.done).toBe(3)
    expect(progress.total).toBe(4)
    expect(progress.percent).toBe(75)
  })

  it('treats an empty checklist as zero progress', () => {
    expect(checklistProgress([]).percent).toBe(0)
  })
})

describe('projectProgress', () => {
  it('derives progress from task status', () => {
    const progress = projectProgress([
      { status: 'done', checklist: [] },
      { status: 'todo', checklist: [] },
    ])
    expect(progress.percent).toBe(50)
    expect(progress.done).toBe(1)
    expect(progress.total).toBe(2)
  })

  it('credits partially completed checklists on open tasks', () => {
    const progress = projectProgress([
      { status: 'done', checklist: [] },
      { status: 'in-progress', checklist: [{ done: true, weight: 1 }, { done: false, weight: 1 }] },
    ])
    // Task 1 is worth 1 and fully earned. Task 2 is worth 3 (1 + 2 checklist
    // weight) and has earned 1.
    expect(progress.percent).toBe(Math.round((1 + 1) / 4 * 100))
  })

  it('is zero for a project with no tasks rather than a fake percentage', () => {
    expect(projectProgress([]).percent).toBe(0)
  })
})

describe('routineProgress', () => {
  const routine: SleepRoutine = {
    id: 'r1',
    name: 'Wind-down',
    kind: 'winddown',
    enabled: true,
    startTime: null,
    reminderEnabled: true,
    reminderMinutesBefore: 30,
    items: [
      { id: 'a', label: 'Brush teeth', minutes: 5, order: 0 },
      { id: 'b', label: 'Read', minutes: 10, order: 1 },
      { id: 'c', label: 'Screens off', minutes: 5, order: 2 },
    ],
    createdAt: 0,
    updatedAt: 0,
  }

  it('reports checklist completion for the day', () => {
    const completion: SleepRoutineCompletion = {
      id: 'c1',
      routineId: 'r1',
      date: '2026-03-02',
      completedItemIds: ['a', 'b'],
      completedAt: null,
      updatedAt: 0,
    }
    const rows = routineProgress([routine], [completion], '2026-03-02')
    expect(rows[0].done).toBe(2)
    expect(rows[0].percent).toBe(67)
  })

  it('is zero when nothing is ticked yet', () => {
    const rows = routineProgress([routine], [], '2026-03-02')
    expect(rows[0].done).toBe(0)
    expect(rows[0].percent).toBe(0)
  })

  it('excludes disabled routines', () => {
    expect(routineProgress([{ ...routine, enabled: false }], [], '2026-03-02')).toHaveLength(0)
  })
})

describe('buildDayRollup', () => {
  it('separates planned, completed and missed and never credits cancelled work', () => {
    const rollup = buildDayRollup({
      date: '2026-03-02',
      occurrences: [],
      activities: [
        {
          id: '1',
          eventId: null,
          title: 'Done',
          category: 'study',
          date: '2026-03-02',
          plannedMinutes: 60,
          actualMinutes: 55,
          status: 'completed',
          startedAt: 0,
          finishedAt: 0,
          subjectId: null,
          projectId: null,
          projectTaskId: null,
          notes: '',
          createdAt: 0,
          updatedAt: 0,
        },
        {
          id: '2',
          eventId: null,
          title: 'Cancelled',
          category: 'study',
          date: '2026-03-02',
          plannedMinutes: 60,
          actualMinutes: 0,
          status: 'cancelled',
          startedAt: null,
          finishedAt: null,
          subjectId: null,
          projectId: null,
          projectTaskId: null,
          notes: '',
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      studySessions: [],
      sleepSessions: [],
      habits: [],
      habitEntries: [],
      tasks: [],
    })
    expect(rollup.activityMinutes).toBe(55)
    expect(rollup.plannedMinutes).toBe(0)
  })

  it('counts only habits scheduled for that weekday', () => {
    const rollup = buildDayRollup({
      date: '2026-03-02', // Monday
      occurrences: [],
      activities: [],
      studySessions: [],
      sleepSessions: [],
      habits: [makeHabit(), makeHabit({ id: 'h2', schedule: 'weekly', days: [5] })],
      habitEntries: [entry('2026-03-02')],
      tasks: [],
    })
    expect(rollup.habitsScheduled).toBe(1)
    expect(rollup.habitsCompleted).toBe(1)
  })
})

describe('percentOf', () => {
  it('guards against division by zero', () => {
    expect(percentOf(10, 0)).toBe(0)
    expect(percentOf(0, 0)).toBe(0)
    expect(percentOf(1, 4)).toBe(25)
  })
})
