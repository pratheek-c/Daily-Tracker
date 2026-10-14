import type { DateKey, Millis, ScheduledEvent, Task, TimeKey } from '@/types'
import { addMinutesToMillis, combineDateTime, nowTimeKey, timeKeyToMinutes, todayKey, toDateKey } from '@/lib/date'

export type TaskUrgency = 'overdue' | 'today' | 'soon' | 'later' | 'none'

export function taskDueMillis(task: Pick<Task, 'dueDate' | 'dueTime'>): Millis | null {
  if (!task.dueDate) return null
  return combineDateTime(task.dueDate, task.dueTime ?? '23:59', 0)
}

export function classifyTaskDue(
  task: Pick<Task, 'dueDate' | 'dueTime' | 'status'>,
  now = Date.now(),
): TaskUrgency {
  if (!task.dueDate) return 'none'
  if (task.status === 'done') return 'none'
  const due = taskDueMillis(task)
  if (due === null) return 'none'
  if (due < now) return 'overdue'
  if (task.dueDate === toDateKey(now)) return 'today'
  const inThreeDays = now + 3 * 86_400_000
  if (due <= inThreeDays) return 'soon'
  return 'later'
}

export const URGENCY_META: Record<TaskUrgency, { label: string; chip: string }> = {
  overdue: { label: 'Overdue', chip: 'bg-[var(--color-blush)] text-[var(--color-rose-deep)]' },
  today: { label: 'Due today', chip: 'bg-[var(--color-peach)] text-[var(--color-peach-deep)]' },
  soon: { label: 'Due soon', chip: 'bg-[var(--color-babyblue)] text-[var(--color-sky-deep)]' },
  later: { label: 'Scheduled', chip: 'bg-[var(--surface-3)] text-[var(--fg-muted)]' },
  none: { label: 'No due date', chip: 'bg-[var(--surface-3)] text-[var(--fg-subtle)]' },
}

/**
 * Weighted completion for a checklist. Completed items count their declared
 * weight, so a heavy subtask moves the bar further than a trivial one.
 */
export function checklistProgress(items: { done: boolean; weight?: number }[]): {
  done: number
  total: number
  percent: number
} {
  const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0)
  const done = items.reduce((sum, item) => sum + (item.done ? (item.weight ?? 1) : 0), 0)
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/**
 * Project progress is derived from its tasks rather than a hand-typed number:
 * each task contributes `1 + checklist weight`, and Done tasks count fully.
 */
export function projectProgress(
  tasks: { status: string; checklist: { done: boolean; weight?: number }[] }[],
): { percent: number; done: number; total: number; minutesTracked: number } {
  if (tasks.length === 0) return { percent: 0, done: 0, total: 0, minutesTracked: 0 }

  let earned = 0
  let possible = 0
  let done = 0
  for (const task of tasks) {
    const checklist = checklistProgress(task.checklist ?? [])
    const taskWeight = 1 + checklist.total
    possible += taskWeight
    if (task.status === 'done') {
      earned += taskWeight
      done += 1
    } else {
      earned += checklist.done
    }
  }
  return {
    percent: possible === 0 ? 0 : Math.round((earned / possible) * 100),
    done,
    total: tasks.length,
    minutesTracked: 0,
  }
}

/** Overlap-safe "next up" picker for the dashboard. */
export function nextUpcoming<T extends { startMillis: Millis; endMillis: Millis }>(
  items: T[],
  now = Date.now(),
): T | null {
  return (
    items
      .filter((item) => item.endMillis > now)
      .sort((a, b) => a.startMillis - b.startMillis)[0] ?? null
  )
}

export function eventEndMillis(event: ScheduledEvent): Millis {
  const overnight = event.overnight || timeKeyToMinutes(event.endTime) <= timeKeyToMinutes(event.startTime)
  return combineDateTime(event.date, event.endTime, overnight ? 1 : 0)
}

export function minutesUntil(target: Millis, now = Date.now()): number {
  return Math.round((target - now) / 60_000)
}

/** Suggest a free slot of `minutes` on `date` given busy blocks. */
export function findFreeSlot(
  _date: DateKey,
  minutes: number,
  busy: { startTime: TimeKey; endTime: TimeKey; overnight?: boolean }[],
  opts: { earliest?: TimeKey; latest?: TimeKey; stepMinutes?: number } = {},
): TimeKey | null {
  const earliest = timeKeyToMinutes(opts.earliest ?? '07:00')
  const latest = timeKeyToMinutes(opts.latest ?? '22:00')
  const step = opts.stepMinutes ?? 15

  const busyRanges = busy.map((block) => {
    const start = timeKeyToMinutes(block.startTime)
    const rawEnd = timeKeyToMinutes(block.endTime)
    const end = block.overnight || rawEnd <= start ? rawEnd + 1440 : rawEnd
    return [start, end] as const
  })

  for (let cursor = earliest; cursor + minutes <= latest; cursor += step) {
    const candidateEnd = cursor + minutes
    const collides = busyRanges.some(([start, end]) => cursor < end && candidateEnd > start)
    if (!collides) {
      const hours = Math.floor(cursor / 60)
      const mins = cursor % 60
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
    }
  }
  return null
}

/** A friendly nudge that only ever references real data. */
export function encourage(seed: {
  completedToday: number
  plannedToday: number
  studyMinutes: number
  sleepMinutes: number | null
  streakBest: number
}): string {
  if (seed.plannedToday === 0) return 'Your day is a blank page — add one small thing to begin with ♡'
  if (seed.completedToday === 0) return 'Nothing finished yet, and that is okay. Pick the easiest item first.'
  if (seed.completedToday >= seed.plannedToday)
    return 'Everything on today’s plan is done. Rest is part of the plan too.'
  if (seed.sleepMinutes !== null && seed.sleepMinutes < 360)
    return 'Short night — a gentler pace today still counts as progress.'
  if (seed.streakBest >= 7) return `A ${seed.streakBest}-day streak! Quiet consistency is your superpower.`
  if (seed.studyMinutes >= 120) return 'Two hours of study banked. Your future self says thank you.'
  return 'Small steps, every day. You are doing better than you think.'
}

export function nowKey(): { date: DateKey; time: TimeKey } {
  const now = new Date()
  return { date: toDateKey(now), time: nowTimeKey() }
}

export { addMinutesToMillis, todayKey }
