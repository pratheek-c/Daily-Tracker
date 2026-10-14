import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BedDouble,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Moon,
  Plus,
  RefreshCw,
  Sunrise,
  Trash2,
} from 'lucide-react'
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
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { ProgressCard, TrendChart } from '@/components/analytics'
import { SleepCard, SleepSessionFields } from '@/components/sleep/SleepCard'
import { useApp } from '@/app/AppContext'
import {
  computeSessionMath,
  plannedNight,
  sleepEventsForRange,
} from '@/services/scheduling/sleep-events'
import { routineProgress, sleepSeries } from '@/services/analytics/selectors'
import {
  addDaysToKey,
  formatClock,
  formatMinutes,
  minutesToTimeKey,
  relativeDayLabel,
  timeKeyToMinutes,
  WEEKDAY_LABELS,
} from '@/lib/date'
import { newId, percent } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { SleepRoutine, SleepSession, Weekday } from '@/types'

const WEEKDAY_CHOICES: { value: Weekday; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

export default function SleepPage() {
  const [searchParams] = useSearchParams()
  const {
    data,
    settings,
    now,
    today,
    saveSleepSchedule,
    saveSleepException,
    saveSleepSession,
    toggleRoutineItem,
    saveRoutine,
  } = useApp()

  const schedule = data.sleepSchedule
  const [range, setRange] = useState<'7' | '14' | '30'>('14')
  const rangeDays = Number(range)

  /**
   * Before noon the current sleep night started the previous evening, which is
   * what keeps an overnight session attributed to the right night.
   */
  const nightKey = new Date(now).getHours() < 12 ? addDaysToKey(today, -1) : today

  const tonight = useMemo(
    () => (schedule ? plannedNight(schedule, nightKey, data.sleepExceptions) : null),
    [schedule, nightKey, data.sleepExceptions],
  )

  const weekSeries = useMemo(
    () => sleepSeries(data.sleepSessions, addDaysToKey(today, -(rangeDays - 1)), today),
    [data.sleepSessions, today, rangeDays],
  )

  const chartData = weekSeries.map((point) => ({
    date: point.date.slice(5),
    sleep:
      point.estimatedSleepMinutes === null
        ? null
        : Math.round((point.estimatedSleepMinutes / 60) * 10) / 10,
    inBed: Math.round((point.timeInBedMinutes / 60) * 10) / 10,
    goal: Math.round((settings.sleepGoalMinutes / 60) * 10) / 10,
  }))

  const routineRows = routineProgress(data.sleepRoutines, data.routineCompletions, today)

  const recorded = data.sleepSessions.filter(
    (session) => session.date >= addDaysToKey(today, -(rangeDays - 1)) && session.endAt !== null,
  )
  const averageMinutes =
    recorded.length === 0
      ? null
      : Math.round(
          recorded.reduce(
            (total, session) => total + (session.estimatedSleepMinutes ?? session.timeInBedMinutes),
            0,
          ) / recorded.length,
        )

  const timeInBedEvents = useMemo(() => {
    if (!schedule) return []
    return sleepEventsForRange(
      schedule,
      addDaysToKey(today, -1),
      addDaysToKey(today, 6),
      data.sleepExceptions,
      data.sleepSessions,
    ).filter((event) => event.category === 'sleep')
  }, [schedule, data.sleepExceptions, data.sleepSessions, today])

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="font-display text-lg font-bold sm:text-xl">Sleep tracker</h1>
          <p className="text-xs text-[var(--fg-muted)]">
            {tonight
              ? `Tonight: bed at ${formatClock(tonight.bedtime, settings)}, up at ${formatClock(tonight.wakeTime, settings)}`
              : 'No sleep schedule configured yet'}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Select
            value={range}
            onChange={(event) => setRange(event.target.value as '7' | '14' | '30')}
            className="h-9.5 w-[9.5rem]"
            aria-label="Sleep range"
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </Select>
        </div>
      </header>

      {searchParams.get('new') === 'session' ? (
        <p className="rounded-2xl bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent-ink)]">
          Use “Log a night” below to enter a previous night by hand.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProgressCard
          title={`${rangeDays}-night average`}
          value={averageMinutes !== null ? formatMinutes(averageMinutes) : '—'}
          caption={`Goal ${formatMinutes(settings.sleepGoalMinutes)}`}
          icon={<Moon />}
          tone="sleep"
          progress={percent(averageMinutes ?? 0, settings.sleepGoalMinutes)}
          empty={averageMinutes === null}
          emptyText="No nights recorded in this range"
        />
        <ProgressCard
          title="Nights recorded"
          value={`${recorded.length}/${rangeDays}`}
          caption={
            recorded.length === rangeDays
              ? 'Every night in this range has a record'
              : `${rangeDays - recorded.length} night${rangeDays - recorded.length === 1 ? '' : 's'} without a record`
          }
          icon={<BedDouble />}
          tone="accent"
          progress={percent(recorded.length, rangeDays)}
        />
        <ProgressCard
          title="Wind-down done"
          value={
            routineRows.find((row) => row.kind === 'winddown')
              ? `${routineRows.find((row) => row.kind === 'winddown')?.percent}%`
              : '—'
          }
          caption="Checklist completion for today"
          icon={<Check />}
          tone="habit"
          progress={routineRows.find((row) => row.kind === 'winddown')?.percent ?? 0}
          empty={!routineRows.some((row) => row.kind === 'winddown')}
          emptyText="No wind-down routine set up"
        />
        <ProgressCard
          title="Morning routine"
          value={
            routineRows.find((row) => row.kind === 'morning')
              ? `${routineRows.find((row) => row.kind === 'morning')?.percent}%`
              : '—'
          }
          caption="Checklist completion for today"
          icon={<Sunrise />}
          tone="project"
          progress={routineRows.find((row) => row.kind === 'morning')?.percent ?? 0}
          empty={!routineRows.some((row) => row.kind === 'morning')}
          emptyText="No morning routine set up"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <SleepCard />

          <Card>
            <CardHeader
              title="Sleep duration"
              description="Estimated sleep and time in bed, night by night"
              icon={<Moon />}
            />
            <CardBody>
              <TrendChart
                data={chartData}
                xKey="date"
                chart="bar"
                height={230}
                yUnit="h"
                series={[
                  { key: 'sleep', label: 'Estimated sleep', color: '#7561A8' },
                  { key: 'inBed', label: 'Time in bed', color: '#C9B6F0' },
                ]}
                valueFormatter={(value) => `${value} h`}
                emptyTitle="No sleep records in this range"
                emptyDescription="Start a sleep session before bed, or log a past night, and the chart will build itself."
              />
              <p className="mt-2 text-[0.68rem] text-[var(--fg-subtle)]">
                Bars show estimated sleep next to total time in bed, so you can see the difference
                between lying down and actually sleeping.
              </p>
            </CardBody>
          </Card>

          <SleepCycleCalculator defaultOnsetMinutes={tonight?.sleepOnsetMinutes ?? 15} />

          <Card>
            <CardHeader
              title="Nights"
              description={`${data.sleepSessions.length} record${data.sleepSessions.length === 1 ? '' : 's'} stored`}
              icon={<BedDouble />}
              flush
            />
            <CardBody className="space-y-2">
              {data.sleepSessions.length === 0 ? (
                <CuteEmptyState
                  mascot="sleeping-bunny"
                  title="No sleep records yet"
                  description="Nothing here is estimated for you. Start a session tonight, or log last night in a few taps."
                />
              ) : (
                <NightList
                  sessions={data.sleepSessions}
                  onSave={(session) => void saveSleepSession(session)}
                />
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Sleep schedule"
              description="Separate weeknights and weekends, and it may cross midnight"
              icon={<Moon />}
              action={
                <Switch
                  checked={schedule?.enabled ?? false}
                  onCheckedChange={(checked) => void saveSleepSchedule({ enabled: checked })}
                  aria-label="Enable sleep schedule"
                />
              }
            />
            <CardBody className="space-y-3">
              {!schedule ? (
                <p className="text-xs text-[var(--fg-muted)]">
                  The sleep schedule could not be loaded. Reloading the page recreates it with
                  sensible defaults.
                </p>
              ) : (
                <>
                  {(
                    [
                      { key: 'weekday' as const, label: 'Weeknights' },
                      { key: 'weekend' as const, label: 'Weekend nights' },
                    ]
                  ).map(({ key, label }) => {
                    const part = schedule[key]
                    return (
                      <div key={key} className="rounded-2xl border border-[var(--line)] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold">{label}</p>
                          <Switch
                            checked={part.enabled}
                            onCheckedChange={(checked) =>
                              void saveSleepSchedule({
                                [key]: { ...part, enabled: checked },
                              } as never)
                            }
                            aria-label={`Enable ${label}`}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Bedtime">
                            <Input
                              type="time"
                              value={part.bedtime}
                              onChange={(event) =>
                                void saveSleepSchedule({
                                  [key]: { ...part, bedtime: event.target.value },
                                } as never)
                              }
                            />
                          </Field>
                          <Field label="Wake up">
                            <Input
                              type="time"
                              value={part.wakeTime}
                              onChange={(event) =>
                                void saveSleepSchedule({
                                  [key]: { ...part, wakeTime: event.target.value },
                                } as never)
                              }
                            />
                          </Field>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <Field label="Minutes to fall asleep">
                            <Input
                              type="number"
                              min={0}
                              max={180}
                              value={part.sleepOnsetMinutes}
                              onChange={(event) =>
                                void saveSleepSchedule({
                                  [key]: {
                                    ...part,
                                    sleepOnsetMinutes: Math.max(0, Number(event.target.value) || 0),
                                  },
                                } as never)
                              }
                            />
                          </Field>
                          <Field label="Wind-down (minutes)">
                            <Input
                              type="number"
                              min={0}
                              max={180}
                              value={part.windDownMinutes}
                              onChange={(event) =>
                                void saveSleepSchedule({
                                  [key]: {
                                    ...part,
                                    windDownMinutes: Math.max(0, Number(event.target.value) || 0),
                                  },
                                } as never)
                              }
                            />
                          </Field>
                        </div>
                        <div className="mt-2">
                          <p className="mb-1 text-[0.68rem] font-semibold text-[var(--fg-muted)]">
                            Applies to
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {WEEKDAY_CHOICES.map((option) => {
                              const active = part.days.includes(option.value)
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() =>
                                    void saveSleepSchedule({
                                      [key]: {
                                        ...part,
                                        days: active
                                          ? part.days.filter((day) => day !== option.value)
                                          : [...part.days, option.value].sort(),
                                      },
                                    } as never)
                                  }
                                  className={`rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold ${
                                    active
                                      ? 'border-transparent bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                                      : 'border-[var(--line-strong)] text-[var(--fg-muted)]'
                                  }`}
                                >
                                  {WEEKDAY_LABELS[option.value]}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <p className="mt-2 text-[0.62rem] text-[var(--fg-subtle)]">
                          {part.wakeTime <= part.bedtime
                            ? 'Crosses midnight — the wake-up lands on the next morning.'
                            : 'Same-day schedule.'}
                        </p>
                      </div>
                    )
                  })}

                  <p className="text-[0.62rem] text-[var(--fg-subtle)]">
                    Reminder timing (minutes before) is configurable in Settings.
                  </p>

                  <div className="rounded-2xl border border-[var(--line)] p-3">
                    <p className="mb-2 text-xs font-semibold">Single-night exception</p>
                    <ExceptionEditor
                      date={nightKey}
                      bedtime={tonight?.bedtime ?? '23:00'}
                      wakeTime={tonight?.wakeTime ?? '07:00'}
                      onSave={(date, bedtime, wakeTime) =>
                        void saveSleepException(date, bedtime, wakeTime)
                      }
                    />
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Routines"
              description="Wind-down and morning checklists"
              icon={<Check />}
            />
            <CardBody className="space-y-3">
              {data.sleepRoutines.length === 0 ? (
                <CuteEmptyState
                  size="sm"
                  mascot="cat"
                  title="No routines yet"
                  description="Add a wind-down checklist to make bedtime easier to keep."
                  action={
                    <Button
                      size="sm"
                      onClick={() =>
                        void saveRoutine(createRoutine('winddown', data.sleepRoutines.length))
                      }
                    >
                      <Plus />
                      Add wind-down
                    </Button>
                  }
                />
              ) : (
                data.sleepRoutines.map((routine) => (
                  <RoutineChecklist
                    key={routine.id}
                    routine={routine}
                    completedItemIds={
                      data.routineCompletions.find(
                        (row) => row.routineId === routine.id && row.date === today,
                      )?.completedItemIds ?? []
                    }
                    onToggle={(itemId) => void toggleRoutineItem(routine, today, itemId)}
                    onSave={(next) => void saveRoutine(next)}
                  />
                ))
              )}
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => void saveRoutine(createRoutine('winddown', data.sleepRoutines.length))}
                >
                  <Plus />
                  Wind-down
                </Button>
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => void saveRoutine(createRoutine('morning', data.sleepRoutines.length))}
                >
                  <Plus />
                  Morning
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Upcoming sleep blocks"
              description="These also appear in your timetable and calendar"
              icon={<Moon />}
            />
            <CardBody className="space-y-1.5">
              {timeInBedEvents.length === 0 ? (
                <p className="text-xs text-[var(--fg-muted)]">
                  No sleep blocks generated. Enable the schedule to see them.
                </p>
              ) : (
                timeInBedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-xs"
                  >
                    <span className="w-20 font-semibold">{relativeDayLabel(event.date)}</span>
                    <span className="flex-1 text-[var(--fg-muted)]">
                      {formatClock(event.startTime, settings)} → {formatClock(event.endTime, settings)}
                    </span>
                    <Chip tone="sleep">{event.plannedMinutes ?? 0} min</Chip>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Sleep-cycle calculator                                                     */
/* -------------------------------------------------------------------------- */

const CYCLE_MINUTES = 90

/**
 * Sleep-cycle estimator.
 *
 * 90 minutes is an average, not a fact about any individual night, so every
 * label says "estimate" and the copy states the limitation plainly. This is a
 * planning aid, not a medical device.
 */
function SleepCycleCalculator({ defaultOnsetMinutes }: { defaultOnsetMinutes: number }) {
  const [mode, setMode] = useState<'wake-from-bedtime' | 'bedtime-from-wake'>('wake-from-bedtime')
  const [anchor, setAnchor] = useState(mode === 'wake-from-bedtime' ? '23:00' : '07:00')
  const [onset, setOnset] = useState(String(defaultOnsetMinutes))
  const [cycles, setCycles] = useState(5)

  const results = useMemo(() => {
    const onsetMinutes = Math.max(0, Number(onset) || 0)
    const anchorMinutes = timeKeyToMinutes(anchor)
    const out: { cycles: number; time: string; sleepMinutes: number }[] = []
    for (let count = 3; count <= Math.max(3, cycles); count += 1) {
      const total = count * CYCLE_MINUTES
      const target =
        mode === 'wake-from-bedtime'
          ? anchorMinutes + onsetMinutes + total
          : anchorMinutes - onsetMinutes - total
      out.push({
        cycles: count,
        time: minutesToTimeKey(target),
        sleepMinutes: total,
      })
    }
    return out
  }, [anchor, onset, mode, cycles])

  return (
    <Card>
      <CardHeader
        title="Sleep-cycle estimator"
        description="A planning aid using approximate 90-minute cycles"
        icon={<RefreshCw />}
      />
      <CardBody className="space-y-3">
        <Tabs
          value={mode}
          onValueChange={(value) => {
            const next = value as 'wake-from-bedtime' | 'bedtime-from-wake'
            setMode(next)
            setAnchor(next === 'wake-from-bedtime' ? '23:00' : '07:00')
          }}
        >
          <TabsList>
            <TabsTrigger value="wake-from-bedtime">I go to bed at…</TabsTrigger>
            <TabsTrigger value="bedtime-from-wake">I must wake at…</TabsTrigger>
          </TabsList>
          <TabsContent value="wake-from-bedtime">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Bedtime">
                <Input type="time" value={anchor} onChange={(event) => setAnchor(event.target.value)} />
              </Field>
              <Field label="Minutes to fall asleep" hint="Your own estimate">
                <Input
                  type="number"
                  min={0}
                  max={180}
                  value={onset}
                  onChange={(event) => setOnset(event.target.value)}
                />
              </Field>
              <Field label="Show up to" hint="Cycles">
                <Input
                  type="number"
                  min={3}
                  max={8}
                  value={cycles}
                  onChange={(event) => setCycles(Math.min(8, Math.max(3, Number(event.target.value) || 5)))}
                />
              </Field>
            </div>
            <p className="mt-2 text-[0.68rem] text-[var(--fg-muted)]">
              Estimated wake-up times if you fall asleep {onset || 0} minutes after getting into bed:
            </p>
          </TabsContent>
          <TabsContent value="bedtime-from-wake">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Wake-up time">
                <Input type="time" value={anchor} onChange={(event) => setAnchor(event.target.value)} />
              </Field>
              <Field label="Minutes to fall asleep">
                <Input
                  type="number"
                  min={0}
                  max={180}
                  value={onset}
                  onChange={(event) => setOnset(event.target.value)}
                />
              </Field>
              <Field label="Show up to" hint="Cycles">
                <Input
                  type="number"
                  min={3}
                  max={8}
                  value={cycles}
                  onChange={(event) => setCycles(Math.min(8, Math.max(3, Number(event.target.value) || 5)))}
                />
              </Field>
            </div>
            <p className="mt-2 text-[0.68rem] text-[var(--fg-muted)]">
              Estimated bedtimes to land at the end of a cycle before {formatClock(anchor as never, { timeFormat: '24h' })}:
            </p>
          </TabsContent>
        </Tabs>

        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((row) => (
            <li
              key={row.cycles}
              className="flex items-center gap-2.5 rounded-2xl border border-[var(--line)] px-3 py-2"
            >
              <span className="font-display text-lg font-bold">{formatClock(row.time, { timeFormat: '24h' })}</span>
              <span className="min-w-0 flex-1 text-[0.68rem] text-[var(--fg-muted)]">
                {row.cycles} cycle{row.cycles === 1 ? '' : 's'} · about{' '}
                {formatMinutes(row.sleepMinutes)} asleep
              </span>
            </li>
          ))}
        </ul>

        <div className="flex gap-2 rounded-2xl bg-[var(--surface-3)] p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--fg-subtle)]" />
          <p className="text-[0.68rem] leading-relaxed text-[var(--fg-muted)]">
            These are <strong>estimates only</strong>. Real sleep cycles vary between people and from
            night to night, and this calculator cannot detect REM, light or deep sleep, cannot tell
            you when you actually woke up, and cannot guarantee a better morning. It is a planning
            aid, not a medical device — if you are persistently exhausted or sleeping badly, talk to
            a doctor.
          </p>
        </div>
      </CardBody>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Routines                                                                   */
/* -------------------------------------------------------------------------- */

function createRoutine(kind: 'winddown' | 'morning', order: number): SleepRoutine {
  const stamp = Date.now()
  return {
    id: newId('routine'),
    name: kind === 'winddown' ? 'Wind-down routine' : 'Morning routine',
    kind,
    enabled: true,
    startTime: null,
    reminderEnabled: true,
    reminderMinutesBefore: kind === 'winddown' ? 30 : 5,
    items:
      kind === 'winddown'
        ? [
            { id: newId('item'), label: 'Finish studying', minutes: 10, order: 0 },
            { id: newId('item'), label: 'Brush teeth', minutes: 5, order: 1 },
            { id: newId('item'), label: 'Reduce screen use', minutes: 10, order: 2 },
          ]
        : [
            { id: newId('item'), label: 'Get out of bed', minutes: 2, order: 0 },
            { id: newId('item'), label: 'Drink water', minutes: 2, order: 1 },
            { id: newId('item'), label: 'Review today\u2019s timetable', minutes: 5, order: 2 },
          ],
    createdAt: stamp,
    updatedAt: stamp,
    ...{ order },
  } as SleepRoutine
}

function RoutineChecklist({
  routine,
  completedItemIds,
  onToggle,
  onSave,
}: {
  routine: SleepRoutine
  completedItemIds: string[]
  onToggle: (itemId: string) => void
  onSave: (routine: SleepRoutine) => void
}) {
  const [newItem, setNewItem] = useState('')
  const done = routine.items.filter((item) => completedItemIds.includes(item.id)).length

  return (
    <div className="rounded-2xl border border-[var(--line)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{routine.name}</p>
          <p className="text-[0.62rem] text-[var(--fg-subtle)]">
            {routine.items.length} steps · {routine.items.reduce((total, item) => total + item.minutes, 0)}{' '}
            min total
          </p>
        </div>
        <Switch
          checked={routine.enabled}
          onCheckedChange={(checked) => onSave({ ...routine, enabled: checked })}
          aria-label={`Enable ${routine.name}`}
        />
      </div>

      <Progress
        value={percent(done, routine.items.length)}
        size="sm"
        className="mt-2"
        label={
          <span className="text-[0.62rem]">
            {done}/{routine.items.length} done today
          </span>
        }
        barClassName="bg-[var(--color-success)]"
      />

      <ul className="mt-2 space-y-1.5">
        {routine.items
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <Checkbox
                checked={completedItemIds.includes(item.id)}
                onCheckedChange={() => onToggle(item.id)}
                aria-label={`Toggle ${item.label}`}
              />
              <span
                className={cn(
                  'flex-1 text-xs',
                  completedItemIds.includes(item.id) && 'text-[var(--fg-subtle)] line-through',
                )}
              >
                {item.label}
              </span>
              <span className="text-[0.6rem] text-[var(--fg-subtle)]">{item.minutes}m</span>
              <button
                type="button"
                aria-label={`Remove ${item.label}`}
                onClick={() =>
                  onSave({ ...routine, items: routine.items.filter((row) => row.id !== item.id) })
                }
                className="text-[var(--fg-subtle)] hover:text-[#C2545F]"
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
      </ul>

      <div className="mt-2 flex gap-2">
        <Input
          value={newItem}
          onChange={(event) => setNewItem(event.target.value)}
          placeholder="Add a step"
          className="h-8 text-xs"
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            if (!newItem.trim()) return
            onSave({
              ...routine,
              items: [
                ...routine.items,
                {
                  id: newId('item'),
                  label: newItem.trim(),
                  minutes: 5,
                  order: routine.items.length,
                },
              ],
            })
            setNewItem('')
          }}
        />
        <Button
          size="sm"
          variant="soft"
          onClick={() => {
            if (!newItem.trim()) return
            onSave({
              ...routine,
              items: [
                ...routine.items,
                {
                  id: newId('item'),
                  label: newItem.trim(),
                  minutes: 5,
                  order: routine.items.length,
                },
              ],
            })
            setNewItem('')
          }}
        >
          <Plus />
          Add
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-[#C2545F]"
          aria-label={`Delete ${routine.name}`}
          onClick={() => onSave({ ...routine, enabled: false, items: [] })}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  )
}

function ExceptionEditor({
  date,
  bedtime,
  wakeTime,
  onSave,
}: {
  date: string
  bedtime: string
  wakeTime: string
  onSave: (date: string, bedtime: string | null, wakeTime: string | null) => void
}) {
  const [targetDate, setTargetDate] = useState(date)
  const [nextBedtime, setNextBedtime] = useState(bedtime)
  const [nextWake, setNextWake] = useState(wakeTime)

  return (
    <div className="space-y-2">
      <Field label="Night of">
        <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Bedtime">
          <Input
            type="time"
            value={nextBedtime}
            onChange={(event) => setNextBedtime(event.target.value)}
          />
        </Field>
        <Field label="Wake up">
          <Input type="time" value={nextWake} onChange={(event) => setNextWake(event.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="soft"
          onClick={() => onSave(targetDate, nextBedtime, nextWake)}
        >
          <BedDouble />
          Apply to this night only
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onSave(targetDate, null, null)}
        >
          Clear exception
        </Button>
      </div>
    </div>
  )
}

function NightList({
  sessions,
  onSave,
}: {
  sessions: SleepSession[]
  onSave: (session: SleepSession) => void
}) {
  const [editing, setEditing] = useState<SleepSession | null>(null)
  const [page, setPage] = useState(0)
  const pageSize = 10

  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1))
  const pageItems = sorted.slice(page * pageSize, page * pageSize + pageSize)
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))

  return (
    <div className="space-y-1.5">
      {pageItems.map((session) => {
        const maths = computeSessionMath({
          startAt: session.startAt,
          endAt: session.endAt,
          sleepOnsetAt: session.sleepOnsetAt,
          awakeMinutes: session.awakeMinutes,
          awakenings: session.awakenings,
        })
        const active = session.endAt === null
        return (
          <div key={session.id} className="rounded-xl border border-[var(--line)] px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-[0.68rem] font-semibold">{session.date.slice(5)}</span>
              <span className="min-w-0 flex-1 text-[0.68rem] text-[var(--fg-muted)]">
                {new Date(session.startAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' → '}
                {session.endAt
                  ? new Date(session.endAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'still in bed'}
                {session.manual ? ' · manual' : ''}
                {session.quality ? ` · felt ${session.quality}/5` : ''}
              </span>
              <Chip tone="neutral">{formatMinutes(maths.timeInBedMinutes)} in bed</Chip>
              <Chip tone="sleep">
                {maths.estimatedSleepMinutes === null
                  ? 'sleep unknown'
                  : `${formatMinutes(maths.estimatedSleepMinutes)} sleep`}
              </Chip>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(editing?.id === session.id ? null : session)}
                disabled={active}
                title={active ? 'Finish the session first' : 'Edit or delete this night'}
              >
                {active ? 'Running' : editing?.id === session.id ? 'Close' : 'Edit'}
              </Button>
            </div>

            {editing?.id === session.id ? (
              <div className="mt-3 border-t border-[var(--line)] pt-3">
                <SleepSessionFields
                  session={session}
                  onClose={() => setEditing(null)}
                  onDelete={async () => {
                    onSave({ ...session, endAt: null, timeInBedMinutes: 0, estimatedSleepMinutes: null })
                    setEditing(null)
                  }}
                />
              </div>
            ) : null}
          </div>
        )
      })}

      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            disabled={page === 0}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <span className="text-[0.68rem] text-[var(--fg-subtle)]">
            Page {page + 1} of {pageCount}
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            disabled={page >= pageCount - 1}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      ) : null}

      <p className="pt-1 text-[0.62rem] text-[var(--fg-subtle)]">
        Sleep records are stored only on this device.
      </p>
    </div>
  )
}
