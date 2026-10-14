import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart3,
  BookOpenCheck,
  Briefcase,
  CheckCircle2,
  Clock,
  Flame,
  Moon,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Card, CardBody, CardHeader, Chip, CuteEmptyState, Progress, Select } from '@/components/ui'
import { CategoryBreakdown, ProgressCard, RangePicker, TrendChart } from '@/components/analytics'
import { useApp } from '@/app/AppContext'
import { buildDayRollup, buildRangeSummary, sleepSeries } from '@/services/analytics/selectors'
import { CATEGORY_META } from '@/config/categories'
import { addDaysToKey, dateKeyRange, formatMinutes, todayKey } from '@/lib/date'
import { percent, sum } from '@/lib/utils'
import { useWindowContext } from '@/hooks/useWindowContext'
import { routineProgress } from '@/services/analytics/selectors'

/**
 * Productivity analytics.
 *
 * Breaks and sleep are shown as legitimate parts of a sustainable routine
 * rather than as lost time — the point is balance, not maximum busyness.
 */
export default function AnalyticsPage() {
  const [searchParams] = useSearchParams()
  const { data, settings, timeline } = useApp()

  const [range, setRange] = useState<{ from: string; to: string }>(() => ({
    from: searchParams.get('from') ?? addDaysToKey(todayKey(), -29),
    to: searchParams.get('to') ?? todayKey(),
  }))

  const safeRange = useMemo(
    () => (range.from <= range.to ? range : { from: range.to, to: range.from }),
    [range],
  )
  const window = useWindowContext(safeRange.from, safeRange.to)

  const days = useMemo(
    () => dateKeyRange(safeRange.from, safeRange.to),
    [safeRange.from, safeRange.to],
  )

  const rollups = useMemo(
    () =>
      days.map((date) =>
        buildDayRollup({
          date,
          occurrences: window.occurrences,
          activities: data.activities,
          studySessions: data.studySessions,
          sleepSessions: data.sleepSessions,
          habits: data.habits,
          habitEntries: data.habitEntries,
          tasks: data.tasks,
        }),
      ),
    [days, window.occurrences, data],
  )

  const summary = useMemo(
    () =>
      buildRangeSummary({
        from: safeRange.from,
        to: safeRange.to,
        rollups,
        studySessions: data.studySessions,
        activities: data.activities,
        sleepSessions: data.sleepSessions,
        habits: data.habits,
        habitEntries: data.habitEntries,
        tasks: data.tasks,
        weeklyStudyGoalMinutes: settings.weeklyStudyGoalMinutes,
        sleepGoalMinutes: settings.sleepGoalMinutes,
        rescheduledCount: data.events.filter(
          (event) => event.status === 'cancelled' && event.date >= safeRange.from && event.date <= safeRange.to,
        ).length,
      }),
    [safeRange, rollups, data, settings],
  )

  /** Previous equal-length window, for honest period-over-period deltas. */
  const previous = useMemo(() => {
    const length = days.length
    const previousTo = addDaysToKey(safeRange.from, -1)
    const previousFrom = addDaysToKey(previousTo, -(length - 1))
    const previousRollups = dateKeyRange(previousFrom, previousTo).map((date) =>
      buildDayRollup({
        date,
        occurrences: timeline(previousFrom, previousTo),
        activities: data.activities,
        studySessions: data.studySessions,
        sleepSessions: data.sleepSessions,
        habits: data.habits,
        habitEntries: data.habitEntries,
        tasks: data.tasks,
      }),
    )
    return {
      studyMinutes: sum(previousRollups.map((rollup) => rollup.studyMinutes)),
      activityMinutes: sum(previousRollups.map((rollup) => rollup.activityMinutes)),
      sleepMinutes: sum(previousRollups.map((rollup) => rollup.sleepMinutes ?? 0)),
      hasData: previousRollups.some((rollup) => rollup.plannedMinutes > 0 || rollup.studyMinutes > 0),
    }
  }, [safeRange, days.length, data, timeline])

  const delta = (current: number, before: number): number | null => {
    if (!previous.hasData || before === 0) return null
    return ((current - before) / before) * 100
  }

  const trend = rollups.map((rollup) => ({
    date: rollup.date.slice(5),
    planned: Math.round((rollup.plannedMinutes / 60) * 10) / 10,
    completed: Math.round((rollup.activityMinutes / 60) * 10) / 10,
    study: Math.round((rollup.studyMinutes / 60) * 10) / 10,
    sleep: rollup.sleepMinutes === null ? null : Math.round((rollup.sleepMinutes / 60) * 10) / 10,
    habits: percent(rollup.habitsCompleted, rollup.habitsScheduled),
  }))

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const occurrence of window.occurrences) {
      totals.set(
        occurrence.event.category,
        (totals.get(occurrence.event.category) ?? 0) + occurrence.durationMinutes,
      )
    }
    return Array.from(totals.entries())
      .map(([category, minutes]) => ({
        key: category,
        label: CATEGORY_META[category as keyof typeof CATEGORY_META].label,
        minutes,
        color: CATEGORY_META[category as keyof typeof CATEGORY_META].style.color,
      }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [window.occurrences])

  const subjectRows = data.subjects
    .map((subject) => {
      const sessions = data.studySessions.filter(
        (session) =>
          session.status === 'completed' &&
          session.subjectId === subject.id &&
          session.date >= safeRange.from &&
          session.date <= safeRange.to,
      )
      const minutes = sessions.reduce(
        (total, session) => total + Math.round(session.focusedSeconds / 60),
        0,
      )
      return { subject, minutes, sessions: sessions.length }
    })
    .sort((a, b) => b.minutes - a.minutes)

  const routineRows = routineProgress(data.sleepRoutines, data.routineCompletions, todayKey())

  const sleepPoints = sleepSeries(data.sleepSessions, safeRange.from, safeRange.to)
  const sleepChart = sleepPoints.map((point) => ({
    date: point.date.slice(5),
    bedtime: point.bedtimeMinutes === null ? null : Math.round((point.bedtimeMinutes / 60) * 10) / 10,
    wake: point.wakeMinutes === null ? null : Math.round((point.wakeMinutes / 60) * 10) / 10,
  }))

  const hasAnything =
    data.events.length > 0 ||
    data.studySessions.length > 0 ||
    data.tasks.length > 0 ||
    data.sleepSessions.length > 0 ||
    data.habits.length > 0

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="font-display text-lg font-bold sm:text-xl">Productivity analytics</h1>
          <p className="text-xs text-[var(--fg-muted)]">
            {summary.days} days · {safeRange.from} → {safeRange.to}
          </p>
        </div>
        <div className="ml-auto">
          <RangePicker from={range.from} to={range.to} onChange={setRange} />
        </div>
      </header>

      {!hasAnything ? (
        <Card>
          <CardBody>
            <CuteEmptyState
              mascot="cat"
              size="lg"
              title="Nothing to analyse yet"
              description="Every number on this page is computed from records you create. Plan a block, run a study session, tick a habit or log a night of sleep and the charts will build themselves."
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ProgressCard
              title="Study hours"
              value={formatMinutes(summary.studyMinutes)}
              caption={`${summary.sessionCount} sessions · average ${formatMinutes(summary.averageSessionMinutes)}`}
              icon={<BookOpenCheck />}
              tone="study"
              progress={summary.studyGoalPercent}
              delta={delta(summary.studyMinutes, previous.studyMinutes)}
              empty={summary.studyMinutes === 0}
              emptyText="No completed study sessions in this range"
            />
            <ProgressCard
              title="Project hours"
              value={formatMinutes(summary.projectMinutes)}
              caption="From completed project-linked blocks"
              icon={<Briefcase />}
              tone="project"
              empty={summary.projectMinutes === 0}
              emptyText="No project blocks completed in this range"
            />
            <ProgressCard
              title="Task completion"
              value={`${summary.tasksCompleted}/${summary.tasksCreated}`}
              caption={
                summary.tasksOverdue > 0
                  ? `${summary.tasksOverdue} still overdue`
                  : 'Nothing overdue in this range'
              }
              icon={<CheckCircle2 />}
              tone="habit"
              progress={percent(summary.tasksCompleted, Math.max(1, summary.tasksCreated))}
            />
            <ProgressCard
              title="Sleep average"
              value={
                summary.averageSleepMinutes !== null ? formatMinutes(summary.averageSleepMinutes) : '—'
              }
              caption={`${summary.sleepNights} nights recorded · goal ${formatMinutes(settings.sleepGoalMinutes)}`}
              icon={<Moon />}
              tone="sleep"
              progress={summary.sleepGoalPercent}
              delta={delta(summary.sleepMinutesTotal, previous.sleepMinutes)}
              empty={summary.averageSleepMinutes === null}
              emptyText="No sleep records in this range"
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Planned versus actual time"
                description="Hours per day: what you scheduled against what you completed"
                icon={<Clock />}
              />
              <CardBody>
                <TrendChart
                  data={trend}
                  xKey="date"
                  chart="area"
                  height={250}
                  yUnit="h"
                  series={[
                    { key: 'planned', label: 'Planned', color: '#C9B6F0' },
                    { key: 'completed', label: 'Completed', color: '#B95F86' },
                  ]}
                  valueFormatter={(value) => `${value} h`}
                  emptyTitle="No scheduled blocks in this range"
                  emptyDescription="Plan some blocks and this comparison becomes meaningful."
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Where your time goes"
                description="Planned minutes by category"
                icon={<BarChart3 />}
              />
              <CardBody>
                <CategoryBreakdown
                  data={categoryTotals}
                  emptyTitle="No blocks in this range"
                  emptyDescription="Planned categories appear here once you schedule something."
                  height={210}
                />
              </CardBody>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader
                title="Study and sleep together"
                description="Study hours and sleep hours on the same axis"
                icon={<TrendingUp />}
              />
              <CardBody>
                <TrendChart
                  data={trend}
                  xKey="date"
                  chart="line"
                  height={240}
                  series={[
                    { key: 'study', label: 'Study (h)', color: '#7561A8' },
                    { key: 'sleep', label: 'Sleep (h)', color: '#5F5AA8', dashed: true },
                  ]}
                  valueFormatter={(value) => `${value} h`}
                  emptyTitle="Not enough records yet"
                  emptyDescription="Study sessions and sleep records both need at least a day of data."
                />
                <p className="mt-2 text-[0.68rem] text-[var(--fg-subtle)]">
                  Shown together on purpose: a sustainable routine keeps both lines healthy rather
                  than pushing study up at the expense of sleep.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Habits"
                description={`${summary.habitCompletionPercent}% of scheduled chances met`}
                icon={<Flame />}
              />
              <CardBody className="space-y-3">
                <TrendChart
                  data={trend}
                  xKey="date"
                  chart="area"
                  height={170}
                  yUnit="%"
                  series={[{ key: 'habits', label: 'Habit score', color: '#4F8A6C' }]}
                  valueFormatter={(value) => `${value}%`}
                  emptyTitle="No habits scheduled"
                  emptyDescription="Add a habit and its daily completion rate appears here."
                />
                <Progress
                  value={summary.habitCompletionPercent}
                  label={
                    <span>
                      {summary.habitCompletions}/{summary.habitOpportunities} scheduled chances
                    </span>
                  }
                  barClassName="bg-[var(--color-success)]"
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Bedtime and wake-up"
                description="Hours since 6pm, so an after-midnight bedtime plots later"
                icon={<Moon />}
              />
              <CardBody>
                <TrendChart
                  data={sleepChart}
                  xKey="date"
                  chart="line"
                  height={210}
                  series={[
                    { key: 'bedtime', label: 'Bedtime', color: '#5F5AA8' },
                    { key: 'wake', label: 'Wake-up', color: '#E9BD75' },
                  ]}
                  valueFormatter={(value) => `${value} h`}
                  emptyTitle="No sleep records"
                  emptyDescription="Record a few nights to see how consistent your timing is."
                />
                <p className="mt-2 text-[0.68rem] text-[var(--fg-subtle)]">
                  Consistency matters more than any single night. Aim for a steady band rather than a
                  perfect one.
                </p>
              </CardBody>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader
                title="Per subject"
                description="Study time inside the selected range"
                icon={<Target />}
              />
              <CardBody className="space-y-2.5">
                {subjectRows.filter((row) => row.minutes > 0).length === 0 ? (
                  <CuteEmptyState
                    size="sm"
                    mascot="cat"
                    title="No subject time in this range"
                    description="Pick a subject when you start a study session to break the time down here."
                  />
                ) : (
                  subjectRows
                    .filter((row) => row.minutes > 0)
                    .map((row) => (
                      <div key={row.subject.id} className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: row.subject.color }}
                          />
                          <span className="min-w-0 flex-1 truncate font-semibold">
                            {row.subject.name}
                          </span>
                          <span className="text-[var(--fg-subtle)]">
                            {row.sessions} session{row.sessions === 1 ? '' : 's'}
                          </span>
                          <span className="font-semibold">{formatMinutes(row.minutes)}</span>
                        </div>
                        <Progress
                          value={percent(row.minutes, Math.max(1, subjectRows[0].minutes))}
                          size="sm"
                          barClassName="bg-[var(--color-success)]"
                        />
                      </div>
                    ))
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Balance check" description="How the range breaks down" />
              <CardBody className="space-y-2.5">
                <ul className="space-y-1.5 text-xs">
                  <li className="flex justify-between">
                    <span className="text-[var(--fg-muted)]">Scheduled</span>
                    <span className="font-semibold">{formatMinutes(summary.plannedMinutes)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--fg-muted)]">Completed</span>
                    <span className="font-semibold">{formatMinutes(summary.actualMinutes)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--fg-muted)]">Study</span>
                    <span className="font-semibold">{formatMinutes(summary.studyMinutes)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--fg-muted)]">Project</span>
                    <span className="font-semibold">{formatMinutes(summary.projectMinutes)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--fg-muted)]">Scheduled breaks</span>
                    <span className="font-semibold">{formatMinutes(summary.breakMinutes)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--fg-muted)]">Sleep recorded</span>
                    <span className="font-semibold">{formatMinutes(summary.sleepMinutesTotal)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--fg-muted)]">Focus sessions</span>
                    <span className="font-semibold">{summary.focusSessions}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--fg-muted)]">Rescheduled / cancelled</span>
                    <span className="font-semibold">{summary.rescheduledCount}</span>
                  </li>
                </ul>
                <div className="flex flex-wrap gap-1.5">
                  <Chip tone="success">Completion {summary.completionRate}%</Chip>
                  <Chip tone="accent">Study goal {summary.studyGoalPercent}%</Chip>
                  <Chip tone="neutral">Sleep goal {summary.sleepGoalPercent}%</Chip>
                </div>
                <p className="text-[0.68rem] leading-relaxed text-[var(--fg-subtle)]">
                  Free time is deliberately not treated as wasted time. Breaks and sleep are part of
                  the plan, so they are measured rather than penalised.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Routine consistency" description="Today's checklists" />
              <CardBody className="space-y-2.5">
                {routineRows.length === 0 ? (
                  <p className="text-xs text-[var(--fg-muted)]">
                    No sleep routines configured yet.
                  </p>
                ) : (
                  routineRows.map((row) => (
                    <Progress
                      key={row.routineId}
                      value={row.percent}
                      label={
                        <span>
                          {row.name} · {row.done}/{row.total}
                        </span>
                      }
                      size="sm"
                      barClassName="bg-[var(--color-lavender-deep)]"
                    />
                  ))
                )}
                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2">
                  <span className="text-[0.68rem] text-[var(--fg-muted)]">Study range view</span>
                  <Select
                    value=""
                    onChange={(event) => {
                      if (!event.target.value) return
                      const length = Number(event.target.value)
                      setRange({ from: addDaysToKey(todayKey(), -(length - 1)), to: todayKey() })
                    }}
                    className="h-8 w-36 text-xs"
                    aria-label="Quick range"
                  >
                    <option value="">Quick range…</option>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="180">Last 180 days</option>
                  </Select>
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
