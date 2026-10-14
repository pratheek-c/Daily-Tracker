import { Check, Flame, Minus, Plus } from 'lucide-react'
import { Card, CardBody, CardHeader, Chip, Progress } from '@/components/ui'
import { habitStreak } from '@/services/analytics/selectors'
import { habitCompletedOn, habitScheduledOn } from '@/services/analytics/selectors'
import { addDaysToKey, todayKey, WEEKDAY_LABELS } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { Habit, HabitEntry } from '@/types'

export interface HabitGridProps {
  habits: Habit[]
  entries: HabitEntry[]
  onToggle: (habit: Habit, date: string) => void
  onAdjust?: (habit: Habit, date: string, delta: number) => void
  days?: number
  className?: string
  onEdit?: (habit: Habit) => void
}

/**
 * Habit grid with schedule-aware streaks.
 *
 * Cells for days a habit is not scheduled are shown as inactive rather than as
 * failures, which is what makes the streak honest.
 */
export function HabitGrid({
  habits,
  entries,
  onToggle,
  onAdjust,
  days = 14,
  className,
  onEdit,
}: HabitGridProps) {
  const today = todayKey()
  const columns = Array.from({ length: days }, (_, index) => addDaysToKey(today, -(days - 1 - index)))

  return (
    <Card className={className}>
      <CardHeader
        title="Habit tracker"
        description={`${habits.length} habit${habits.length === 1 ? '' : 's'} · last ${days} days`}
        icon={<Flame />}
        flush
      />
      <CardBody className="px-0 sm:px-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-2 text-left text-[0.62rem] font-bold tracking-wider text-[var(--fg-subtle)] uppercase sm:px-5">
                  Habit
                </th>
                {columns.map((day) => (
                  <th
                    key={day}
                    className="px-0.5 py-2 text-center text-[0.58rem] font-semibold text-[var(--fg-subtle)]"
                  >
                    <span className="block">{WEEKDAY_LABELS[new Date(`${day}T00:00:00`).getDay()][0]}</span>
                    <span className="block text-[0.58rem] font-normal">{Number(day.slice(8, 10))}</span>
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-[0.62rem] font-bold tracking-wider text-[var(--fg-subtle)] uppercase">
                  Streak
                </th>
              </tr>
            </thead>
            <tbody>
              {habits.map((habit) => {
                const streak = habitStreak(habit, entries, today, 28)
                return (
                  <tr key={habit.id}>
                    <td className="sticky left-0 z-10 max-w-[13rem] bg-[var(--surface)] px-4 py-2 sm:px-5">
                      <button
                        type="button"
                        onClick={() => onEdit?.(habit)}
                        className="min-w-0 text-left"
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: habit.color }}
                          />
                          <span className="truncate text-xs font-semibold text-[var(--fg)]">
                            {habit.name}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[0.62rem] text-[var(--fg-subtle)]">
                          {habit.schedule === 'daily'
                            ? `Every day · ${habit.targetCount}×`
                            : `${habit.days.map((day) => WEEKDAY_LABELS[day]).join(' ')} · ${habit.targetCount}×`}
                        </span>
                      </button>
                    </td>
                    {columns.map((day) => {
                      const scheduled = habitScheduledOn(habit, day)
                      const done = habitCompletedOn(habit, entries, day)
                      const entry = entries.find(
                        (row) => row.habitId === habit.id && row.date === day,
                      )
                      const future = day > today
                      return (
                        <td key={day} className="px-0.5 py-1.5 text-center">
                          <button
                            type="button"
                            disabled={!scheduled || future}
                            onClick={() => onToggle(habit, day)}
                            onContextMenu={(event) => {
                              if (!onAdjust) return
                              event.preventDefault()
                              onAdjust(habit, day, -1)
                            }}
                            aria-label={`${habit.name} on ${day}${done ? ' completed' : ''}`}
                            aria-pressed={done}
                            title={
                              !scheduled
                                ? 'Not scheduled on this day'
                                : future
                                  ? 'Future day'
                                  : `${entry?.count ?? 0}/${habit.targetCount}${onAdjust ? ' — right-click to decrease' : ''}`
                            }
                            className={cn(
                              'mx-auto grid size-6.5 place-items-center rounded-lg border text-[0.6rem] font-bold transition-transform',
                              !scheduled
                                ? 'border-dashed border-[var(--line-strong)] bg-transparent text-transparent'
                                : future
                                  ? 'border-[var(--line)] bg-[var(--surface-2)] text-transparent'
                                  : done
                                    ? 'border-transparent text-white'
                                    : 'border-[var(--line-strong)] bg-[var(--surface)] hover:border-[var(--accent)]',
                            )}
                            style={done ? { backgroundColor: habit.color } : undefined}
                          >
                            {done ? (
                              <Check className="size-3.5" strokeWidth={3} />
                            ) : scheduled && !future ? (
                              habit.targetCount > 1 ? (
                                <span className="text-[var(--fg-subtle)]">
                                  {entry?.count ? entry.count : ''}
                                </span>
                              ) : (
                                ''
                              )
                            ) : null}
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Chip tone={streak.current > 0 ? 'accent' : 'neutral'}>
                          <Flame className="size-3" />
                          {streak.current}
                        </Chip>
                        <span className="hidden text-[0.6rem] text-[var(--fg-subtle)] sm:inline">
                          best {streak.best}
                        </span>
                      </div>
                      <Progress
                        value={streak.consistency}
                        size="sm"
                        className="mt-1 w-16"
                        barClassName="bg-[var(--color-success)]"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {onAdjust ? (
          <p className="flex items-center gap-1 px-4 pt-2 text-[0.62rem] text-[var(--fg-subtle)] sm:px-5">
            <Plus className="size-3" />
            {/* Adjust controls live on the habits page; this grid stays compact. */}
            Right-click a day to undo a tick. Use the habits page to fine-tune counts.
          </p>
        ) : null}
      </CardBody>
    </Card>
  )
}

export function HabitQuickList({
  habits,
  entries,
  onToggle,
  onAdjust,
}: {
  habits: Habit[]
  entries: HabitEntry[]
  onToggle: (habit: Habit, date: string) => void
  onAdjust?: (habit: Habit, date: string, delta: number) => void
}) {
  const today = todayKey()
  const scheduled = habits.filter((habit) => !habit.archived && habitScheduledOn(habit, today))

  return (
    <ul className="space-y-1.5">
      {scheduled.map((habit) => {
        const done = habitCompletedOn(habit, entries, today)
        const entry = entries.find((row) => row.habitId === habit.id && row.date === today)
        const count = entry?.count ?? 0
        return (
          <li
            key={habit.id}
            className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] px-3 py-2"
          >
            <button
              type="button"
              onClick={() => onToggle(habit, today)}
              aria-pressed={done}
              aria-label={`Toggle ${habit.name}`}
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-lg border transition-colors',
                done
                  ? 'border-transparent text-white'
                  : 'border-[var(--line-strong)] hover:border-[var(--accent)]',
              )}
              style={done ? { backgroundColor: habit.color } : undefined}
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : null}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{habit.name}</p>
              {habit.targetCount > 1 ? (
                <p className="text-[0.62rem] text-[var(--fg-subtle)]">
                  {count}/{habit.targetCount} {habit.unit || 'times'}
                </p>
              ) : null}
            </div>
            {onAdjust && habit.targetCount > 1 ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onAdjust(habit, today, -1)}
                  className="grid size-6 place-items-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--surface-3)]"
                  aria-label={`Decrease ${habit.name}`}
                >
                  <Minus className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onAdjust(habit, today, 1)}
                  className="grid size-6 place-items-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--surface-3)]"
                  aria-label={`Increase ${habit.name}`}
                >
                  <Plus className="size-3" />
                </button>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
