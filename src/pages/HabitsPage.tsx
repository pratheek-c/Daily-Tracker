import { useMemo, useState } from 'react'
import {
  Archive,
  CalendarCheck,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Notebook,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Chip,
  CuteEmptyState,
  Field,
  Input,
  Progress,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { ConfirmDialog, ConfirmDialogContent } from '@/components/ui/confirm-dialog'
import { HabitGrid } from '@/components/habits/HabitGrid'
import { useApp } from '@/app/AppContext'
import { COLOR_SWATCHES } from '@/config/categories'
import { HABIT_ICON_CHOICES } from '@/config/defaults'
import { habitStreak, habitScheduledOn } from '@/services/analytics/selectors'
import { addDaysToKey, formatDayLabel, todayKey, WEEKDAY_LABELS } from '@/lib/date'
import { newId, percent } from '@/lib/utils'
import type { Habit, Weekday } from '@/types'

const ICON_MAP: Record<string, LucideIcon> = {
  sunrise: CalendarCheck,
  'book-open': Notebook,
  hammer: Flame,
  book: Notebook,
  dumbbell: Dumbbell,
  droplets: Droplets,
  'notebook-pen': Notebook,
  'moon-star': Sparkles,
  heart: Heart,
  sparkles: Sparkles,
  footprints: Footprints,
  brain: Sparkles,
}

const WEEKDAY_CHOICES: { value: Weekday; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

export default function HabitsPage() {
  const { data, toggleHabit, saveHabit, deleteHabit } = useApp()
  const [draft, setDraft] = useState<Habit | null>(null)
  const [confirmHabit, setConfirmHabit] = useState<Habit | null>(null)
  const today = todayKey()

  const habits = data.habits.filter((habit) => !habit.archived)

  const stats = useMemo(() => {
    let opportunities = 0
    let completions = 0
    for (let offset = 0; offset < 28; offset += 1) {
      const date = addDaysToKey(today, -offset)
      for (const habit of habits) {
        if (!habitScheduledOn(habit, date)) continue
        opportunities += 1
        if (
          data.habitEntries.some(
            (entry) => entry.habitId === habit.id && entry.date === date && entry.completed,
          )
        ) {
          completions += 1
        }
      }
    }
    const bestStreak = habits.reduce(
      (best, habit) => Math.max(best, habitStreak(habit, data.habitEntries, today, 28).current),
      0,
    )
    return {
      opportunities,
      completions,
      consistency: percent(completions, opportunities),
      bestStreak,
    }
  }, [habits, data.habitEntries, today])

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="font-display text-lg font-bold sm:text-xl">Habits</h1>
          <p className="text-xs text-[var(--fg-muted)]">
            {habits.length} habit{habits.length === 1 ? '' : 's'} · {stats.consistency}% consistent over
            28 days
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" onClick={() => setDraft(newHabitDraft(data.habits.length))}>
            <Plus />
            New habit
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--fg-muted)]">
            <Flame className="size-3.5" />
            Best current streak
          </p>
          <p className="font-display mt-1 text-2xl font-bold">{stats.bestStreak} days</p>
          <p className="text-[0.68rem] text-[var(--fg-subtle)]">
            Counted across the days each habit is actually scheduled
          </p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--fg-muted)]">
            <TrendingUp className="size-3.5" />
            28-day consistency
          </p>
          <p className="font-display mt-1 text-2xl font-bold">{stats.consistency}%</p>
          <Progress value={stats.consistency} size="sm" className="mt-1.5" barClassName="bg-[var(--color-success)]" />
          <p className="mt-1 text-[0.68rem] text-[var(--fg-subtle)]">
            {stats.completions} of {stats.opportunities} scheduled chances
          </p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--fg-muted)]">
            <CalendarCheck className="size-3.5" />
            Today
          </p>
          <p className="font-display mt-1 text-2xl font-bold">
            {habits.filter((habit) => habitScheduledOn(habit, today)).length} scheduled
          </p>
          <p className="text-[0.68rem] text-[var(--fg-subtle)]">
            {data.habitEntries.filter((entry) => entry.date === today && entry.completed).length}{' '}
            completed
          </p>
        </Card>
      </section>

      {habits.length === 0 ? (
        <Card>
          <CardBody>
            <CuteEmptyState
              mascot="bunny"
              size="lg"
              title="No habits yet"
              description="Start with one or two: waking up on time, studying daily, or following your bedtime routine. Streaks skip days a habit is not scheduled, so a Mon/Wed/Fri habit is never punished for Tuesday."
              action={
                <Button onClick={() => setDraft(newHabitDraft(0))}>
                  <Plus />
                  Create my first habit
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <Tabs defaultValue="grid">
          <TabsList>
            <TabsTrigger value="grid">14-day grid</TabsTrigger>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="grid">
            <HabitGrid
              habits={habits}
              entries={data.habitEntries}
              days={14}
              onToggle={(habit, date) => void toggleHabit(habit, date)}
              onAdjust={(habit, date, delta) => void toggleHabit(habit, date, delta)}
              onEdit={(habit) => setDraft(habit)}
            />
          </TabsContent>

          <TabsContent value="today">
            <Card>
              <CardHeader
                title="Today's habits"
                description={formatDayLabel(today, { withYear: true })}
                icon={<CalendarCheck />}
              />
              <CardBody className="space-y-2">
                {habits.filter((habit) => habitScheduledOn(habit, today)).length === 0 ? (
                  <CuteEmptyState
                    size="sm"
                    mascot="bunny"
                    title="Nothing scheduled today"
                    description="None of your habits are set for this weekday. Enjoy the lighter day."
                  />
                ) : (
                  habits
                    .filter((habit) => habitScheduledOn(habit, today))
                    .map((habit) => {
                      const entry = data.habitEntries.find(
                        (row) => row.habitId === habit.id && row.date === today,
                      )
                      const Icon = ICON_MAP[habit.icon] ?? Sparkles
                      const streak = habitStreak(habit, data.habitEntries, today, 28)
                      return (
                        <div
                          key={habit.id}
                          className="flex items-center gap-3 rounded-2xl border border-[var(--line)] p-3"
                        >
                          <span
                            className="grid size-9 shrink-0 place-items-center rounded-xl"
                            style={{ backgroundColor: `${habit.color}33`, color: habit.color }}
                          >
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{habit.name}</p>
                            <p className="text-[0.65rem] text-[var(--fg-subtle)]">
                              {entry?.count ?? 0}/{habit.targetCount} {habit.unit || 'times'} ·{' '}
                              {streak.current} day streak
                            </p>
                          </div>
                          <Checkbox
                            checked={entry?.completed ?? false}
                            onCheckedChange={() => void toggleHabit(habit, today)}
                            aria-label={`Toggle ${habit.name}`}
                          />
                        </div>
                      )
                    })
                )}
              </CardBody>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader
                title="History"
                description="Every habit with its streak and consistency"
                icon={<TrendingUp />}
                flush
              />
              <CardBody className="space-y-2">
                {habits.map((habit) => {
                  const streak = habitStreak(habit, data.habitEntries, today, 28)
                  const Icon = ICON_MAP[habit.icon] ?? Sparkles
                  return (
                    <div key={habit.id} className="rounded-2xl border border-[var(--line)] p-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="grid size-8 shrink-0 place-items-center rounded-lg"
                          style={{ backgroundColor: `${habit.color}33`, color: habit.color }}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{habit.name}</p>
                          <p className="text-[0.62rem] text-[var(--fg-subtle)]">
                            {habit.schedule === 'daily'
                              ? 'Every day'
                              : habit.days.map((day) => WEEKDAY_LABELS[day]).join(', ')}
                            {habit.targetCount > 1 ? ` · ${habit.targetCount}× per day` : ''}
                          </p>
                        </div>
                        <Chip tone="accent">
                          <Flame className="size-3" />
                          {streak.current} current
                        </Chip>
                        <Chip tone="neutral">best {streak.best}</Chip>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${habit.name}`}
                          onClick={() => setDraft(habit)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Archive ${habit.name}`}
                          onClick={() =>
                            void saveHabit({ ...habit, archived: true, updatedAt: Date.now() })
                          }
                        >
                          <Archive />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${habit.name}`}
                          onClick={() => setConfirmHabit(habit)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress
                          value={streak.consistency}
                          size="sm"
                          className="flex-1"
                          barClassName="bg-[var(--color-success)]"
                        />
                        <span className="text-[0.62rem] text-[var(--fg-subtle)]">
                          {streak.consistency}% of 28 days
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {streak.last28.map((day) => (
                          <span
                            key={day.date}
                            title={`${day.date}${day.scheduled ? (day.completed ? ' · done' : ' · missed') : ' · not scheduled'}`}
                            className={`size-3.5 rounded-sm ${
                              !day.scheduled
                                ? 'bg-[var(--surface-3)]'
                                : day.completed
                                  ? 'bg-[var(--color-success)]'
                                  : 'bg-[var(--color-blush)]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </CardBody>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {data.habits.some((habit) => habit.archived) ? (
        <Card>
          <CardHeader
            title="Archived habits"
            description="Kept for history, excluded from streaks and reminders"
            icon={<Archive />}
          />
          <CardBody className="space-y-1.5">
            {data.habits
              .filter((habit) => habit.archived)
              .map((habit) => (
                <div
                  key={habit.id}
                  className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{habit.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void saveHabit({ ...habit, archived: false, updatedAt: Date.now() })}
                  >
                    Restore
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${habit.name}`}
                    onClick={() => setConfirmHabit(habit)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
          </CardBody>
        </Card>
      ) : null}

      <HabitDialog
        habit={draft}
        onOpenChange={(open) => !open && setDraft(null)}
        onSave={(habit) => {
          void saveHabit(habit)
          setDraft(null)
        }}
      />

      <ConfirmDialog
        open={confirmHabit !== null}
        onOpenChange={(open) => !open && setConfirmHabit(null)}
      >
        <ConfirmDialogContent
          title={`Delete “${confirmHabit?.name ?? ''}”?`}
          description="The habit and every completion record for it are removed permanently. Archiving keeps the history instead."
          confirmLabel="Delete habit"
          onConfirm={() => {
            if (confirmHabit) void deleteHabit(confirmHabit.id)
            setConfirmHabit(null)
          }}
        />
      </ConfirmDialog>
    </div>
  )
}

function newHabitDraft(order: number): Habit {
  const stamp = Date.now()
  return {
    id: newId('habit'),
    name: '',
    description: '',
    icon: 'sparkles',
    color: COLOR_SWATCHES[7],
    schedule: 'daily',
    days: [0, 1, 2, 3, 4, 5, 6],
    targetCount: 1,
    unit: '',
    reminderTime: null,
    reminderEnabled: false,
    archived: false,
    order,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

function HabitDialog({
  habit,
  onOpenChange,
  onSave,
}: {
  habit: Habit | null
  onOpenChange: (open: boolean) => void
  onSave: (habit: Habit) => void
}) {
  const [values, setValues] = useState<Habit>(() => habit ?? newHabitDraft(0))
  const [error, setError] = useState<string | null>(null)
  const [seededFor, setSeededFor] = useState<string | null>(habit?.id ?? null)

  if (habit && habit.id !== seededFor) {
    setSeededFor(habit.id)
    setValues(habit)
    setError(null)
  }

  return (
    <ConfirmDialog open={habit !== null} onOpenChange={onOpenChange}>
      <ConfirmDialogContent
        title={habit?.name ? `Edit ${habit.name}` : 'New habit'}
        description="Streaks are counted only across the days you schedule, so rest days never break them."
        confirmLabel="Save habit"
        destructive={false}
        onConfirm={() => {
          if (!values.name.trim()) {
            setError('Give the habit a name')
            return
          }
          if (values.schedule === 'weekly' && values.days.length === 0) {
            setError('Pick at least one day')
            return
          }
          onSave({
            ...values,
            name: values.name.trim(),
            days: values.schedule === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : values.days,
            updatedAt: Date.now(),
          })
        }}
      >
        <div className="space-y-3">
          <Field label="Name" required error={error ?? undefined}>
            <Input
              value={values.name}
              onChange={(event) => setValues({ ...values, name: event.target.value })}
              placeholder="e.g. Study daily"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="How often">
              <Select
                value={values.schedule}
                onChange={(event) =>
                  setValues({ ...values, schedule: event.target.value as 'daily' | 'weekly' })
                }
              >
                <option value="daily">Every day</option>
                <option value="weekly">Selected weekdays</option>
              </Select>
            </Field>
            <Field label="Target per day" hint="Numeric goals count up">
              <Input
                type="number"
                min={1}
                max={50}
                value={values.targetCount}
                onChange={(event) =>
                  setValues({ ...values, targetCount: Math.max(1, Number(event.target.value) || 1) })
                }
              />
            </Field>
          </div>

          {values.schedule === 'weekly' ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[var(--fg-muted)]">On these days</p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_CHOICES.map((option) => {
                  const active = values.days.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setValues({
                          ...values,
                          days: active
                            ? values.days.filter((day) => day !== option.value)
                            : [...values.days, option.value].sort(),
                        })
                      }
                      className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors ${
                        active
                          ? 'border-transparent bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                          : 'border-[var(--line-strong)] text-[var(--fg-muted)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {values.targetCount > 1 ? (
            <Field label="Unit" hint="Shown next to the count">
              <Input
                value={values.unit}
                onChange={(event) => setValues({ ...values, unit: event.target.value })}
                placeholder="glasses, pages, minutes…"
              />
            </Field>
          ) : null}

          <Field label="Description">
            <Input
              value={values.description}
              onChange={(event) => setValues({ ...values, description: event.target.value })}
              placeholder="Why does this habit matter to you?"
            />
          </Field>

          <div className="rounded-2xl border border-[var(--line)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold">Daily reminder</p>
                <p className="text-[0.65rem] text-[var(--fg-subtle)]">
                  Delivered while the app is open, in-app if pop-ups are blocked
                </p>
              </div>
              <Checkbox
                checked={values.reminderEnabled}
                onCheckedChange={(checked) =>
                  setValues({
                    ...values,
                    reminderEnabled: Boolean(checked),
                    reminderTime: values.reminderTime ?? '20:00',
                  })
                }
                aria-label="Habit reminder"
              />
            </div>
            {values.reminderEnabled ? (
              <Field label="Reminder time" className="mt-2">
                <Input
                  type="time"
                  value={values.reminderTime ?? '20:00'}
                  onChange={(event) => setValues({ ...values, reminderTime: event.target.value })}
                />
              </Field>
            ) : null}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--fg-muted)]">Icon</p>
            <div className="flex flex-wrap gap-1.5">
              {HABIT_ICON_CHOICES.map((icon) => {
                const Icon = ICON_MAP[icon] ?? Sparkles
                const active = values.icon === icon
                return (
                  <button
                    key={icon}
                    type="button"
                    aria-label={`Use icon ${icon}`}
                    onClick={() => setValues({ ...values, icon })}
                    className={`grid size-8 place-items-center rounded-xl border transition-colors ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                        : 'border-[var(--line-strong)] text-[var(--fg-muted)] hover:border-[var(--accent)]'
                    }`}
                  >
                    <Icon className="size-4" />
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--fg-muted)]">Colour</p>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use colour ${color}`}
                  onClick={() => setValues({ ...values, color })}
                  className={`size-6.5 rounded-full border-2 transition-transform ${
                    values.color === color ? 'scale-110 border-[var(--fg)]' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      </ConfirmDialogContent>
    </ConfirmDialog>
  )
}
