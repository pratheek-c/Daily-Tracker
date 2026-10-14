import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpenCheck,
  Briefcase,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Flame,
  GraduationCap,
  ListChecks,
  Moon,
  Play,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  CuteEmptyState,
  Progress,
} from '@/components/ui'
import { ProgressCard } from '@/components/analytics'
import { DailyTimeline } from '@/components/calendar/DailyTimeline'
import { EventFormDialog } from '@/components/calendar/EventFormDialog'
import { PomodoroTimer } from '@/components/dashboard/PomodoroTimer'
import { HabitQuickList } from '@/components/habits/HabitGrid'
import { SleepCard } from '@/components/sleep/SleepCard'
import { Mascot } from '@/components/mascots/Mascot'
import { useApp } from '@/app/AppContext'
import { useWindowContext } from '@/hooks/useWindowContext'
import { useStudyTimer } from '@/hooks/useTimers'
import {
  buildDayRollup,
  buildAttentionList,
  habitScheduledOn,
} from '@/services/analytics/selectors'
import { encourage, nextUpcoming, projectProgress } from '@/services/analytics/metrics'
import { CATEGORY_META } from '@/config/categories'
import {
  addDaysToKey,
  formatClock,
  formatDayLabel,
  formatMinutes,
  greetingForNow,
  relativeDayLabel,
} from '@/lib/date'
import { percent } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Occurrence } from '@/services/scheduling/recurrence'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data, settings, now, today, startActivity, finishActivity, toggleHabit } = useApp()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<{ event: Occurrence['event']; date: string } | null>(null)
  const studyTimer = useStudyTimer()

  const window = useWindowContext(addDaysToKey(today, -6), addDaysToKey(today, 27))

  const rollup = useMemo(
    () =>
      buildDayRollup({
        date: today,
        occurrences: window.occurrences,
        activities: data.activities,
        studySessions: data.studySessions,
        sleepSessions: data.sleepSessions,
        habits: data.habits,
        habitEntries: data.habitEntries,
        tasks: data.tasks,
      }),
    [today, window.occurrences, data],
  )

  const weekOccurrences = useMemo(
    () => window.occurrences.filter((occurrence) => occurrence.date >= addDaysToKey(today, -6)),
    [window.occurrences, today],
  )

  const weekStudyMinutes = useMemo(() => {
    const from = addDaysToKey(today, -6)
    return data.studySessions
      .filter((session) => session.date >= from && session.date <= today && session.status === 'completed')
      .reduce((total, session) => total + Math.round(session.focusedSeconds / 60), 0)
  }, [data.studySessions, today])

  const weekProjectMinutes = useMemo(() => {
    const from = addDaysToKey(today, -6)
    return data.activities
      .filter(
        (record) =>
          record.date >= from &&
          record.date <= today &&
          record.status === 'completed' &&
          record.category === 'project',
      )
      .reduce((total, record) => total + record.actualMinutes, 0)
  }, [data.activities, today])

  const upcoming = useMemo(
    () =>
      window.occurrences
        .filter((occurrence) => occurrence.event.status === 'planned' && occurrence.endMillis > now)
        .slice(0, 3),
    [window.occurrences, now],
  )

  const next = nextUpcoming(window.occurrences.filter((o) => o.event.category !== 'sleep'), now)

  const activeProjects = useMemo(
    () => data.projects.filter((project) => project.status === 'active' || project.status === 'planning'),
    [data.projects],
  )

  const attention = useMemo(
    () =>
      buildAttentionList({
        tasks: data.tasks,
        occurrences: window.occurrences.filter((occurrence) => occurrence.date <= today),
        habits: data.habits,
        habitEntries: data.habitEntries,
        today,
      }),
    [data.tasks, data.habits, data.habitEntries, window.occurrences, today],
  )

  const habitsToday = data.habits.filter((habit) => !habit.archived && habitScheduledOn(habit, today))
  const bestStreak = habitsToday.length
    ? Math.max(
        ...habitsToday.map(
          (habit) =>
            data.habitEntries.filter(
              (entry) => entry.habitId === habit.id && entry.completed,
            ).length,
        ),
      )
    : 0

  const completionPercent = percent(rollup.completedActivities, Math.max(1, rollup.plannedActivities), 1)
  const isBrandNew =
    data.events.length === 0 &&
    data.tasks.length === 0 &&
    data.projects.length === 0 &&
    data.habits.length === 0 &&
    data.studySessions.length === 0

  const message = encourage({
    completedToday: rollup.completedActivities,
    plannedToday: rollup.plannedActivities,
    studyMinutes: rollup.studyMinutes,
    sleepMinutes: rollup.sleepMinutes,
    streakBest: bestStreak,
  })

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------------- hero */}
      <section className="paper-grain relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-[var(--fg-subtle)] uppercase">
              {greetingForNow()} · {relativeDayLabel(today)}
            </p>
            <h1 className="font-display mt-1 text-xl font-bold text-balance-tight sm:text-2xl">
              Hi, {settings.displayName}! <span className="text-[var(--accent)]">♡</span> Let&rsquo;s
              make today a little more productive.
            </h1>
            <p className="font-hand mt-1.5 text-lg text-[var(--accent-ink)]">{message}</p>

            <div className="mt-3.5 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <CalendarPlus />
                Plan a block
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/planner')}>
                <ListChecks />
                Open planner
              </Button>
              {isBrandNew ? (
                <Button size="sm" variant="soft" onClick={() => navigate('/timetable')}>
                  <Sparkles />
                  Build my weekly routine
                </Button>
              ) : (
                <Button size="sm" variant="soft" onClick={() => navigate('/sleep')}>
                  <Moon />
                  Sleep insights
                </Button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[0.68rem] font-semibold text-[var(--fg-muted)]">
                Today&rsquo;s progress
              </span>
              <Progress
                value={completionPercent}
                className="max-w-56 min-w-32 flex-1"
                size="sm"
                label={
                  <span className="text-[0.62rem]">
                    {rollup.completedActivities}/{rollup.plannedActivities} blocks done
                  </span>
                }
              />
            </div>
          </div>

          <div className="relative flex shrink-0 items-center gap-4">
            <Mascot kind={settings.mascot === 'cat' ? 'cat-crown' : 'bunny-crown'} className="size-28" animate />
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
              <p className="text-[0.62rem] font-bold tracking-wider text-[var(--fg-subtle)] uppercase">
                Up next
              </p>
              {next ? (
                <>
                  <p className="mt-0.5 max-w-44 truncate text-sm font-semibold">{next.event.title}</p>
                  <p className="text-[0.68rem] text-[var(--fg-muted)]">
                    {formatClock(next.startTime, settings)} · {next.durationMinutes}m
                  </p>
                  <Chip className="mt-1.5" style={CATEGORY_META[next.event.category].style}>
                    {CATEGORY_META[next.event.category].label}
                  </Chip>
                </>
              ) : (
                <p className="mt-0.5 max-w-44 text-xs text-[var(--fg-muted)]">
                  Nothing else scheduled. Enjoy the space, or add one small block.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- stat row */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProgressCard
          title="Scheduled today"
          value={rollup.plannedMinutes > 0 ? formatMinutes(rollup.plannedMinutes) : '—'}
          caption={`${rollup.plannedActivities} block${rollup.plannedActivities === 1 ? '' : 's'} planned`}
          icon={<Clock />}
          tone="accent"
          empty={rollup.plannedMinutes === 0}
          emptyText="No blocks planned yet"
        />
        <ProgressCard
          title="Study today"
          value={rollup.studyMinutes > 0 ? formatMinutes(rollup.studyMinutes) : '—'}
          caption={`This week: ${formatMinutes(weekStudyMinutes)} of ${formatMinutes(settings.weeklyStudyGoalMinutes)} goal`}
          icon={<BookOpenCheck />}
          tone="study"
          progress={percent(weekStudyMinutes, settings.weeklyStudyGoalMinutes)}
          empty={rollup.studyMinutes === 0 && weekStudyMinutes === 0}
          emptyText="Start a study timer to fill this in"
        />
        <ProgressCard
          title="Blocks completed"
          value={`${rollup.completedActivities}/${rollup.plannedActivities}`}
          caption={
            rollup.missedActivities > 0
              ? `${rollup.missedActivities} marked missed`
              : 'Cancelled and missed work is never counted as done'
          }
          icon={<CheckCircle2 />}
          tone="habit"
          progress={completionPercent}
        />
        <ProgressCard
          title="Sleep last night"
          value={rollup.sleepMinutes !== null ? formatMinutes(rollup.sleepMinutes) : '—'}
          caption={
            rollup.sleepMinutes !== null
              ? `Goal ${formatMinutes(settings.sleepGoalMinutes)}`
              : 'Not recorded yet'
          }
          icon={<Moon />}
          tone="sleep"
          progress={percent(rollup.sleepMinutes ?? 0, settings.sleepGoalMinutes)}
          empty={rollup.sleepMinutes === null}
          emptyText="No sleep record for last night"
        />
      </section>

      {isBrandNew ? (
        <Card>
          <CardBody>
            <CuteEmptyState
              mascot="bunny"
              size="lg"
              title="Your planner is ready and completely empty"
              description="Nothing here is pre-filled or invented. Start with one study block, one habit or your weekly routine, and every number on this dashboard will grow from what you actually record."
              action={
                <>
                  <Button onClick={() => setFormOpen(true)}>
                    <CalendarPlus />
                    Add my first block
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/study')}>
                    <Target />
                    Set up a subject
                  </Button>
                  <Button variant="ghost" onClick={() => navigate('/habits')}>
                    <Flame />
                    Add a habit
                  </Button>
                </>
              }
            />
          </CardBody>
        </Card>
      ) : null}

      {/* --------------------------------------------------------- main columns */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <DailyTimeline
            date={today}
            occurrences={window.occurrences}
            conflicts={window.conflicts}
            timeFormat={settings.timeFormat}
            title="Today's schedule"
            description={formatDayLabel(today, { withYear: true })}
            now={now}
            onAdd={() => setFormOpen(true)}
            onEdit={(occurrence) =>
              setEditing({ event: occurrence.event, date: occurrence.date })
            }
            onRun={(occurrence) => void startActivity(occurrence.event, occurrence.date)}
            onComplete={(occurrence) =>
              void finishActivity(occurrence.event, occurrence.date, 'completed')
            }
            onMissed={(occurrence) => void finishActivity(occurrence.event, occurrence.date, 'missed')}
            onDuplicate={() => undefined}
            onStartStudy={(occurrence) =>
              void studyTimer.start({
                subjectId: occurrence.event.subjectId,
                projectId: occurrence.event.projectId,
                projectTaskId: occurrence.event.projectTaskId,
                taskId: occurrence.event.taskId,
                eventId: occurrence.event.id,
              })
            }
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader
                title="This week's study"
                description={`${formatMinutes(weekStudyMinutes)} studied · ${formatMinutes(weekProjectMinutes)} on projects`}
                icon={<TrendingUp />}
                action={
                  <Button size="sm" variant="ghost" onClick={() => navigate('/analytics')}>
                    <ArrowRight />
                  </Button>
                }
              />
              <CardBody className="space-y-3">
                <Progress
                  value={percent(weekStudyMinutes, settings.weeklyStudyGoalMinutes)}
                  label={
                    <span>
                      Study goal · {formatMinutes(weekStudyMinutes)} /{' '}
                      {formatMinutes(settings.weeklyStudyGoalMinutes)}
                    </span>
                  }
                />
                <Progress
                  value={percent(weekProjectMinutes, settings.weeklyProjectGoalMinutes)}
                  barClassName="bg-[var(--color-sky-deep)]"
                  label={
                    <span>
                      Project goal · {formatMinutes(weekProjectMinutes)} /{' '}
                      {formatMinutes(settings.weeklyProjectGoalMinutes)}
                    </span>
                  }
                />
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(CATEGORY_META).map((meta) => {
                    const minutes = weekOccurrences
                      .filter((occurrence) => occurrence.event.category === meta.value)
                      .reduce((total, occurrence) => total + occurrence.durationMinutes, 0)
                    if (minutes === 0) return null
                    return (
                      <Chip key={meta.value} style={meta.style}>
                        {meta.label} {formatMinutes(minutes, { compact: true })}
                      </Chip>
                    )
                  })}
                </div>
                {weekOccurrences.length === 0 ? (
                  <p className="text-xs text-[var(--fg-subtle)]">
                    No blocks in the last seven days yet.
                  </p>
                ) : null}
              </CardBody>
            </Card>

            <PomodoroTimer />
          </div>

          <Card>
            <CardHeader
              title="Projects"
              description={
                activeProjects.length > 0
                  ? `${activeProjects.length} active project${activeProjects.length === 1 ? '' : 's'}`
                  : 'Nothing in flight'
              }
              icon={<Briefcase />}
              action={
                <Button size="sm" variant="ghost" onClick={() => navigate('/projects')}>
                  <ArrowRight />
                </Button>
              }
            />
            <CardBody className="space-y-2.5">
              {activeProjects.length === 0 ? (
                <CuteEmptyState
                  size="sm"
                  mascot="cat-box"
                  title="No projects yet"
                  description="Add a college or software project and its tasks will roll up into a progress bar here."
                  action={
                    <Button size="sm" onClick={() => navigate('/projects')}>
                      Create a project
                    </Button>
                  }
                />
              ) : (
                activeProjects.slice(0, 3).map((project) => {
                  const tasks = data.projectTasks.filter((task) => task.projectId === project.id)
                  const progress = projectProgress(tasks)
                  const dueSoon = tasks.filter(
                    (task) =>
                      task.status !== 'done' &&
                      task.deadline !== null &&
                      task.deadline <= addDaysToKey(today, 3),
                  )
                  return (
                    <div
                      key={project.id}
                      className="rounded-2xl border border-[var(--line)] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/projects?project=${project.id}`)}
                          className="min-w-0 text-left"
                        >
                          <p className="truncate text-sm font-semibold">{project.name}</p>
                          <p className="text-[0.65rem] text-[var(--fg-subtle)]">
                            {progress.done}/{progress.total} tasks
                            {project.deadline ? ` · due ${project.deadline}` : ''}
                          </p>
                        </button>
                        <span className="font-display shrink-0 text-sm font-bold">{progress.percent}%</span>
                      </div>
                      <Progress
                        value={progress.percent}
                        size="sm"
                        className="mt-2"
                        barClassName="bg-[var(--color-sky-deep)]"
                      />
                      {dueSoon.length > 0 ? (
                        <p className="mt-1.5 text-[0.65rem] text-[var(--color-peach-deep)]">
                          {dueSoon.length} task{dueSoon.length === 1 ? '' : 's'} due within 3 days
                        </p>
                      ) : null}
                    </div>
                  )
                })
              )}
            </CardBody>
          </Card>
        </div>

        {/* ------------------------------------------------------------ sidebar */}
        <div className="space-y-4">
          <SleepCard onOpenSleepPage={() => navigate('/sleep')} compact />

          <Card>
            <CardHeader
              title="Habits today"
              description={
                habitsToday.length > 0
                  ? `${habitsToday.filter((habit) => data.habitEntries.some((entry) => entry.habitId === habit.id && entry.date === today && entry.completed)).length}/${habitsToday.length} done`
                  : 'Nothing scheduled today'
              }
              icon={<Flame />}
              action={
                <Button size="sm" variant="ghost" onClick={() => navigate('/habits')}>
                  <ArrowRight />
                </Button>
              }
            />
            <CardBody>
              {habitsToday.length === 0 ? (
                <CuteEmptyState
                  size="sm"
                  mascot="bunny"
                  title="No habits for today"
                  description="Add habits like waking up on time or studying daily to build streaks."
                  action={
                    <Button size="sm" onClick={() => navigate('/habits')}>
                      Add a habit
                    </Button>
                  }
                />
              ) : (
                <HabitQuickList
                  habits={data.habits}
                  entries={data.habitEntries}
                  onToggle={(habit, date) => void toggleHabit(habit, date)}
                  onAdjust={(habit, date, delta) => void toggleHabit(habit, date, delta)}
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Needs attention"
              description={
                attention.length > 0
                  ? `${attention.length} item${attention.length === 1 ? '' : 's'} worth a look`
                  : 'Everything looks tidy'
              }
              icon={<Sparkles />}
            />
            <CardBody className="space-y-1.5">
              {attention.length === 0 ? (
                <p className="text-xs text-[var(--fg-muted)]">
                  No overdue work, no unfinished blocks from the past few days.
                </p>
              ) : (
                attention.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl border border-[var(--line)] px-2.5 py-2 text-left transition-colors hover:border-[var(--accent)]',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{item.title}</span>
                      <span className="block truncate text-[0.62rem] text-[var(--fg-subtle)]">
                        {item.detail}
                      </span>
                    </span>
                    <Chip
                      tone={
                        item.tone === 'danger'
                          ? 'danger'
                          : item.tone === 'warning'
                            ? 'warning'
                            : 'accent'
                      }
                    >
                      {item.tone === 'danger' ? 'Late' : item.tone === 'warning' ? 'Today' : 'Open'}
                    </Chip>
                  </button>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Upcoming" description="Next few blocks" icon={<GraduationCap />} />
            <CardBody className="space-y-1.5">
              {upcoming.length === 0 ? (
                <p className="text-xs text-[var(--fg-muted)]">
                  Nothing else in the plan. A short break block is a perfectly good addition.
                </p>
              ) : (
                upcoming.map((occurrence) => (
                  <button
                    key={`${occurrence.event.id}-${occurrence.date}`}
                    type="button"
                    onClick={() =>
                      setEditing({ event: occurrence.event, date: occurrence.date })
                    }
                    className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--line)] px-2.5 py-2 text-left transition-colors hover:border-[var(--accent)]"
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-[0.6rem] font-bold"
                      style={CATEGORY_META[occurrence.event.category].style}
                    >
                      {formatClock(occurrence.startTime, settings).replace(/\s?[AP]M/, '')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{occurrence.event.title}</span>
                      <span className="block text-[0.62rem] text-[var(--fg-subtle)]">
                        {relativeDayLabel(occurrence.date)} · {formatClock(occurrence.startTime, settings)}
                      </span>
                    </span>
                    <Play className="size-3.5 shrink-0 text-[var(--fg-subtle)]" />
                  </button>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultDate={today}
        onSaved={() => setFormOpen(false)}
      />
      <EventFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        event={editing?.event ?? null}
        occurrenceDate={editing?.date}
      />
    </div>
  )
}
