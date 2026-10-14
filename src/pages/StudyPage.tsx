import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Archive,
  BookOpenCheck,
  CalendarPlus,
  Clock,
  Flame,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  CuteEmptyState,
  Field,
  Input,
  Progress,
  Select,
  Textarea,
} from '@/components/ui'
import { ConfirmDialog, ConfirmDialogContent } from '@/components/ui/confirm-dialog'
import { CategoryBreakdown, ProgressCard, TrendChart } from '@/components/analytics'
import { PomodoroTimer } from '@/components/dashboard/PomodoroTimer'
import { StudyTimer } from '@/components/study/StudyTimer'
import { useApp } from '@/app/AppContext'
import { COLOR_SWATCHES } from '@/config/categories'
import { addDaysToKey, dateKeyRange, formatMinutes, todayKey, weekKeys } from '@/lib/date'
import { newId, percent } from '@/lib/utils'
import type { StudySession, Subject } from '@/types'

export default function StudyPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    data,
    settings,
    saveSubject,
    deleteSubject,
    deleteStudySession,
    saveStudySession,
  } = useApp()

  const [editing, setEditing] = useState<Subject | null>(null)
  const [formOpen, setFormOpen] = useState(searchParams.get('new') === 'session')
  const [confirmSubject, setConfirmSubject] = useState<Subject | null>(null)
  const [range, setRange] = useState<'7' | '30' | '90'>(() => {
    const param = searchParams.get('range')
    return param === '30' || param === '90' ? param : '7'
  })

  const today = todayKey()
  const rangeDays = Number(range)
  const from = addDaysToKey(today, -(rangeDays - 1))

  const completed = useMemo(
    () =>
      data.studySessions
        .filter((session) => session.status === 'completed')
        .sort((a, b) => b.startedAt - a.startedAt),
    [data.studySessions],
  )

  const inRange = useMemo(
    () => completed.filter((session) => session.date >= from && session.date <= today),
    [completed, from, today],
  )

  const week = weekKeys(today, settings.weekStartsOn)
  const weekMinutes = useMemo(
    () =>
      completed
        .filter((session) => session.date >= week[0] && session.date <= week[6])
        .reduce((total, session) => total + Math.round(session.focusedSeconds / 60), 0),
    [completed, week],
  )

  const rangeMinutes = inRange.reduce(
    (total, session) => total + Math.round(session.focusedSeconds / 60),
    0,
  )

  const trend = useMemo(() => {
    const days = dateKeyRange(from, today)
    return days.map((date) => {
      const daySessions = completed.filter((session) => session.date === date)
      const minutes = daySessions.reduce(
        (total, session) => total + Math.round(session.focusedSeconds / 60),
        0,
      )
      const planned = data.events
        .filter((event) => event.date === date && event.category === 'study' && !event.isSeriesTemplate)
        .reduce((total, event) => total + (event.plannedMinutes ?? 0), 0)
      return {
        date: date.slice(5),
        actual: minutes,
        planned,
        sessions: daySessions.length,
      }
    })
  }, [completed, data.events, from, today])

  const perSubject = useMemo(
    () =>
      data.subjects
        .map((subject) => {
          const minutes = inRange
            .filter((session) => session.subjectId === subject.id)
            .reduce((total, session) => total + Math.round(session.focusedSeconds / 60), 0)
          return {
            key: subject.id,
            label: subject.name,
            minutes,
            color: subject.color,
            weeklyTarget: subject.weeklyTargetMinutes,
            weeklyMinutes: completed
              .filter(
                (session) =>
                  session.subjectId === subject.id &&
                  session.date >= week[0] &&
                  session.date <= week[6],
              )
              .reduce((total, session) => total + Math.round(session.focusedSeconds / 60), 0),
          }
        })
        .sort((a, b) => b.minutes - a.minutes),
    [data.subjects, inRange, completed, week],
  )

  const unassigned = inRange
    .filter((session) => session.subjectId === null)
    .reduce((total, session) => total + Math.round(session.focusedSeconds / 60), 0)

  const averageSession =
    inRange.length === 0 ? 0 : Math.round(rangeMinutes / inRange.length)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="font-display text-lg font-bold sm:text-xl">Study tracker</h1>
          <p className="text-xs text-[var(--fg-muted)]">
            {formatMinutes(rangeMinutes)} studied in the last {rangeDays} days ·{' '}
            {inRange.length} session{inRange.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Select
            value={range}
            onChange={(event) => {
              const next = event.target.value as '7' | '30' | '90'
              setRange(next)
              setSearchParams({ range: next }, { replace: true })
            }}
            className="h-9.5 w-[8.5rem]"
            aria-label="Study range"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </Select>
          <Button size="sm" onClick={() => setEditing(newSubjectDraft())}>
            <Plus />
            New subject
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProgressCard
          title="This week"
          value={weekMinutes > 0 ? formatMinutes(weekMinutes) : '—'}
          caption={`Weekly goal ${formatMinutes(settings.weeklyStudyGoalMinutes)}`}
          icon={<Target />}
          tone="study"
          progress={percent(weekMinutes, settings.weeklyStudyGoalMinutes)}
          empty={weekMinutes === 0}
          emptyText="No study logged this week"
        />
        <ProgressCard
          title="Average session"
          value={averageSession > 0 ? formatMinutes(averageSession) : '—'}
          caption={`${inRange.length} completed session${inRange.length === 1 ? '' : 's'}`}
          icon={<Clock />}
          tone="accent"
          empty={averageSession === 0}
          emptyText="No sessions in this range"
        />
        <ProgressCard
          title="Pomodoro blocks"
          value={String(inRange.filter((session) => session.technique === 'pomodoro').length)}
          caption={`${inRange.filter((session) => session.technique === 'free').length} free-form sessions`}
          icon={<Flame />}
          tone="habit"
        />
        <ProgressCard
          title="Subjects tracked"
          value={String(data.subjects.filter((subject) => !subject.archived).length)}
          caption={`${data.subjects.filter((subject) => subject.archived).length} archived`}
          icon={<BookOpenCheck />}
          tone="project"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <StudyTimer eventId={searchParams.get('event')} />

          <Card>
            <CardHeader
              title="Planned versus actual study"
              description="Planned comes from your scheduled study blocks, actual from finished sessions"
              icon={<TrendingUp />}
            />
            <CardBody>
              <TrendChart
                data={trend}
                xKey="date"
                chart="line"
                height={220}
                series={[
                  { key: 'actual', label: 'Actual', color: '#B95F86' },
                  { key: 'planned', label: 'Planned', color: '#7561A8', dashed: true },
                ]}
                valueFormatter={(value) => formatMinutes(value)}
                emptyTitle="No study recorded in this range"
                emptyDescription="Finish a study session or schedule a study block and this comparison will fill in."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Sessions"
              description={`${completed.length} saved session${completed.length === 1 ? '' : 's'}`}
              icon={<BookOpenCheck />}
              flush
            />
            <CardBody className="space-y-2">
              {completed.length === 0 ? (
                <CuteEmptyState
                  mascot="cat"
                  title="No study sessions yet"
                  description="Start a session above, or run a Pomodoro block, and every minute you study is recorded here."
                />
              ) : (
                completed.slice(0, 25).map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    onCorrect={(minutes) =>
                      void saveStudySession({
                        ...session,
                        focusedSeconds: minutes * 60,
                        updatedAt: Date.now(),
                      })
                    }
                    onDelete={() => void deleteStudySession(session.id)}
                  />
                ))
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <PomodoroTimer compact />
          <Card>
            <CardHeader title="By subject" description={`Last ${rangeDays} days`} />
            <CardBody>
              <CategoryBreakdown
                data={[
                  ...perSubject.map((subject) => ({
                    key: subject.key,
                    label: subject.label,
                    minutes: subject.minutes,
                    color: subject.color,
                  })),
                  ...(unassigned > 0
                    ? [{ key: 'none', label: 'General study', minutes: unassigned, color: '#C7C9D9' }]
                    : []),
                ]}
                title="Study"
                emptyTitle="No subject time yet"
                emptyDescription="Pick a subject when you start a session to see the split here."
                height={190}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Subjects"
              description="Targets, colours and deadlines"
              action={
                <Button size="sm" variant="soft" onClick={() => setEditing(newSubjectDraft())}>
                  <Plus />
                  Add
                </Button>
              }
            />
            <CardBody className="space-y-2">
              {data.subjects.length === 0 ? (
                <CuteEmptyState
                  size="sm"
                  mascot="cat"
                  title="No subjects yet"
                  description="Add your subjects to track weekly targets and see which one needs attention."
                />
              ) : (
                data.subjects.map((subject) => {
                  const stats = perSubject.find((row) => row.key === subject.id)
                  const weekly = stats?.weeklyMinutes ?? 0
                  return (
                    <div
                      key={subject.id}
                      className={`rounded-2xl border border-[var(--line)] p-3 ${subject.archived ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-0.5 size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: subject.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{subject.name}</p>
                          <p className="text-[0.62rem] text-[var(--fg-subtle)]">
                            {subject.deadline ? `Deadline ${subject.deadline} · ` : ''}
                            {formatMinutes(subject.weeklyTargetMinutes)} weekly target
                          </p>
                        </div>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${subject.name}`}
                          onClick={() => setEditing(subject)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Archive ${subject.name}`}
                          onClick={() =>
                            void saveSubject({
                              ...subject,
                              archived: !subject.archived,
                              updatedAt: Date.now(),
                            })
                          }
                        >
                          <Archive />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${subject.name}`}
                          onClick={() => setConfirmSubject(subject)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      {subject.weeklyTargetMinutes > 0 ? (
                        <Progress
                          value={percent(weekly, subject.weeklyTargetMinutes)}
                          size="sm"
                          className="mt-2"
                          label={
                            <span className="text-[0.62rem]">
                              {formatMinutes(weekly)} / {formatMinutes(subject.weeklyTargetMinutes)} this week
                            </span>
                          }
                          barClassName="bg-[var(--color-success)]"
                        />
                      ) : null}
                    </div>
                  )
                })
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Suggested study window" description="Based on your open tasks and timetable" />
            <CardBody className="space-y-2">
              <p className="text-xs text-[var(--fg-muted)]">
                {suggestWindow(data, today)}
              </p>
              <Button size="sm" variant="soft" onClick={() => navigate('/timetable')}>
                <CalendarPlus />
                Adjust my timetable
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      {formOpen ? (
        <span className="sr-only">
          <button type="button" onClick={() => setFormOpen(false)}>
            close
          </button>
        </span>
      ) : null}

      <SubjectDialog
        subject={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={(subject) => void saveSubject(subject)}
      />

      <ConfirmDialog
        open={confirmSubject !== null}
        onOpenChange={(open) => !open && setConfirmSubject(null)}
      >
        <ConfirmDialogContent
          title={`Delete “${confirmSubject?.name ?? ''}”?`}
          description="The subject is removed and unlinked from your tasks and events. Study sessions keep their recorded minutes as general study."
          confirmLabel="Delete subject"
          onConfirm={() => {
            if (confirmSubject) void deleteSubject(confirmSubject.id)
            setConfirmSubject(null)
          }}
        />
      </ConfirmDialog>
    </div>
  )
}

function suggestWindow(
  data: ReturnType<typeof useApp>['data'],
  today: string,
): string {
  const openTasks = data.tasks.filter((task) => task.status !== 'done' && task.dueDate && task.dueDate <= addDaysToKey(today, 3))
  if (openTasks.length === 0) {
    return 'No urgent deadlines in the next three days. Your normal routine blocks are the best place to start.'
  }
  const buses = data.events.filter(
    (event) => event.date === today && !event.isSeriesTemplate && event.status !== 'cancelled',
  )
  const freeBy = buses.filter((event) => event.startTime < '12:00').length
  return freeBy === 0
    ? `You have ${openTasks.length} item${openTasks.length === 1 ? '' : 's'} due within three days and nothing scheduled this morning — a 90-minute block before noon would clear the most urgent one.`
    : `${openTasks.length} item${openTasks.length === 1 ? '' : 's'} due within three days. Your morning is already busy, so the first open evening block is the practical choice.`
}

function newSubjectDraft(): Subject {
  return {
    id: newId('subj'),
    name: '',
    description: '',
    color: COLOR_SWATCHES[0],
    weeklyTargetMinutes: 180,
    deadline: null,
    notes: '',
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function SessionRow({
  session,
  onCorrect,
  onDelete,
}: {
  session: StudySession
  onCorrect: (minutes: number) => void
  onDelete: () => void
}) {
  const { data, settings } = useApp()
  const [editing, setEditing] = useState(false)
  const [minutes, setMinutes] = useState(String(Math.round(session.focusedSeconds / 60)))
  const subject = data.subjects.find((row) => row.id === session.subjectId)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2">
      <span
        className="w-20 shrink-0 text-[0.68rem] font-semibold"
        title={session.date}
      >
        {session.date.slice(5)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">
          {subject?.name ?? 'General study'}
          {session.technique === 'pomodoro' ? ' · pomodoro' : ''}
        </span>
        <span className="block text-[0.62rem] text-[var(--fg-subtle)]">
          {new Date(session.startedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: settings.timeFormat === '12h',
          })}
          {session.endedAt
            ? ` → ${new Date(session.endedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: settings.timeFormat === '12h',
              })}`
            : ''}
          {session.notes ? ` · ${session.notes}` : ''}
        </span>
      </span>

      {editing ? (
        <span className="flex items-center gap-1.5">
          <Input
            type="number"
            min={1}
            max={1440}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            className="h-8 w-20"
          />
          <Button
            size="sm"
            onClick={() => {
              onCorrect(Math.max(1, Number(minutes) || 1))
              setEditing(false)
            }}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </span>
      ) : (
        <>
          <Chip tone="accent">{formatMinutes(Math.round(session.focusedSeconds / 60))}</Chip>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Correct duration"
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Delete session" onClick={onDelete}>
            <Trash2 />
          </Button>
        </>
      )}
    </div>
  )
}

function SubjectDialog({
  subject,
  open,
  onOpenChange,
  onSave,
}: {
  subject: Subject | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (subject: Subject) => void
}) {
  const [values, setValues] = useState<Subject>(subject ?? newSubjectDraft())
  const [error, setError] = useState<string | null>(null)

  // Re-seed when a different subject is opened.
  const [seededFor, setSeededFor] = useState<string | null>(subject?.id ?? null)
  if (open && (subject?.id ?? null) !== seededFor) {
    setSeededFor(subject?.id ?? null)
    setValues(subject ?? newSubjectDraft())
    setError(null)
  }

  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange}>
      <ConfirmDialogContent
        title={subject?.name ? `Edit ${subject.name}` : 'New subject'}
        description="Weekly targets drive the progress bars on this page and in analytics."
        confirmLabel="Save subject"
        cancelLabel="Cancel"
        destructive={false}
        onConfirm={() => {
          if (!values.name.trim()) {
            setError('Give the subject a name')
            return
          }
          onSave({ ...values, name: values.name.trim(), updatedAt: Date.now() })
          onOpenChange(false)
        }}
      >
        <div className="space-y-3">
          <Field label="Name" required error={error ?? undefined}>
            <Input
              value={values.name}
              onChange={(event) => setValues({ ...values, name: event.target.value })}
              placeholder="e.g. Mathematics"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={values.description}
              onChange={(event) => setValues({ ...values, description: event.target.value })}
              placeholder="Syllabus, topics, teacher…"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weekly target (minutes)" hint={formatMinutes(values.weeklyTargetMinutes)}>
              <Input
                type="number"
                min={0}
                max={6000}
                step={15}
                value={values.weeklyTargetMinutes}
                onChange={(event) =>
                  setValues({ ...values, weeklyTargetMinutes: Number(event.target.value) || 0 })
                }
              />
            </Field>
            <Field label="Deadline" hint="Optional">
              <Input
                type="date"
                value={values.deadline ?? ''}
                onChange={(event) => setValues({ ...values, deadline: event.target.value || null })}
              />
            </Field>
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
          <p className="text-[0.68rem] text-[var(--fg-subtle)]">
            Weekly targets reset every week beginning on your chosen week start day, which you can
            change in Settings.
          </p>
        </div>
      </ConfirmDialogContent>
    </ConfirmDialog>
  )
}
