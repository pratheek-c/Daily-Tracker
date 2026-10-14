import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Inbox,
  Pencil,
  Plus,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Field,
  Input,
  Progress,
  Select,
} from '@/components/ui'
import { ConfirmDialog, ConfirmDialogContent } from '@/components/ui/confirm-dialog'
import { DailyTimeline } from '@/components/calendar/DailyTimeline'
import { EventFormDialog } from '@/components/calendar/EventFormDialog'
import { useApp } from '@/app/AppContext'
import { useWindowContext } from '@/hooks/useWindowContext'
import { buildDayRollup } from '@/services/analytics/selectors'
import { CATEGORY_META, CATEGORY_OPTIONS } from '@/config/categories'
import { addDaysToKey, formatLongDate, formatMinutes, relativeDayLabel, todayKey } from '@/lib/date'
import { newId, percent } from '@/lib/utils'
import type {
  ActivityCategory,
  ActivityRecord,
  ActivityStatus,
  Occurrence,
} from '@/types'

/**
 * Daily planner.
 *
 * The timetable holds the repeating routine; the planner is where one specific
 * day gets adjusted, tracked and reviewed against what actually happened.
 */
export default function PlannerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [date, setDate] = useState(searchParams.get('date') ?? todayKey())
  const {
    data,
    settings,
    now,
    startActivity,
    finishActivity,
    saveActivity,
    deleteActivity,
    deleteOccurrence,
    duplicateEventById,
  } = useApp()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<{ event: Occurrence['event']; date: string } | null>(null)
  const [confirmOccurrence, setConfirmOccurrence] = useState<Occurrence | null>(null)
  const [undo, setUndo] = useState<ActivityRecord | null>(null)
  const [manualOpen, setManualOpen] = useState(false)

  const window = useWindowContext(date, date)
  const dayOccurrences = useMemo(
    () => window.occurrences.filter((occurrence) => occurrence.date === date),
    [window.occurrences, date],
  )

  const rollup = useMemo(
    () =>
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
    [date, window.occurrences, data],
  )

  const dayRecords = useMemo(
    () =>
      data.activities
        .filter((record) => record.date === date)
        .sort((a, b) => a.createdAt - b.createdAt),
    [data.activities, date],
  )

  /** Open tasks with no block on this day — the day's "unscheduled inbox". */
  const unscheduled = useMemo(
    () =>
      data.tasks.filter(
        (task) =>
          task.status !== 'done' &&
          (task.dueDate === null || task.dueDate <= date) &&
          !data.events.some((event) => event.taskId === task.id && event.date === date),
      ),
    [data.tasks, data.events, date],
  )

  const unfinished = dayOccurrences.filter(
    (occurrence) => occurrence.event.status === 'planned' && occurrence.endMillis < now,
  )

  const goToDate = (next: string) => {
    setDate(next)
    setSearchParams({ date: next }, { replace: true })
  }

  const actualVsPlanned = percent(rollup.activityMinutes, Math.max(1, rollup.plannedMinutes), 1)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="font-display text-lg font-bold sm:text-xl">Daily planner</h1>
          <p className="text-xs text-[var(--fg-muted)]">
            {formatLongDate(date)} {date === todayKey() ? '· today' : `· ${relativeDayLabel(date)}`}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToDate(addDaysToKey(date, -1))}
            aria-label="Previous day"
          >
            <ChevronLeft />
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(event) => goToDate(event.target.value)}
            className="h-9.5 w-[9.8rem]"
            aria-label="Planner date"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToDate(addDaysToKey(date, 1))}
            aria-label="Next day"
          >
            <ChevronRight />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => goToDate(todayKey())}>
            Today
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <CalendarPlus />
            Add activity
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold text-[var(--fg-muted)]">Planned</p>
          <p className="font-display mt-1 text-2xl font-bold">{formatMinutes(rollup.plannedMinutes)}</p>
          <p className="text-[0.68rem] text-[var(--fg-subtle)]">
            {rollup.plannedActivities} scheduled block{rollup.plannedActivities === 1 ? '' : 's'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-[var(--fg-muted)]">Actually completed</p>
          <p className="font-display mt-1 text-2xl font-bold">{formatMinutes(rollup.activityMinutes)}</p>
          <Progress value={actualVsPlanned} size="sm" className="mt-2" />
          <p className="mt-1 text-[0.68rem] text-[var(--fg-subtle)]">
            {rollup.completedActivities} done · {rollup.missedActivities} missed · cancelled excluded
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-[var(--fg-muted)]">Study logged</p>
          <p className="font-display mt-1 text-2xl font-bold">{formatMinutes(rollup.studyMinutes)}</p>
          <p className="text-[0.68rem] text-[var(--fg-subtle)]">From study sessions on this day</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-[var(--fg-muted)]">Time allocation</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(rollup.plannedByCategory).map(([category, minutes]) => {
              const meta = CATEGORY_META[category as ActivityCategory]
              return (
                <Chip key={category} style={meta.style}>
                  {meta.label} {formatMinutes(minutes, { compact: true })}
                </Chip>
              )
            })}
            {Object.keys(rollup.plannedByCategory).length === 0 ? (
              <span className="text-xs text-[var(--fg-subtle)]">Nothing planned yet</span>
            ) : null}
          </div>
        </Card>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DailyTimeline
            date={date}
            occurrences={window.occurrences}
            conflicts={window.conflicts}
            timeFormat={settings.timeFormat}
            title="Timeline"
            description="Start, complete or reschedule each block"
            now={now}
            onAdd={() => setFormOpen(true)}
            onEdit={(occurrence) => setEditing({ event: occurrence.event, date: occurrence.date })}
            onRun={(occurrence) => void startActivity(occurrence.event, occurrence.date)}
            onComplete={(occurrence) =>
              void finishActivity(occurrence.event, occurrence.date, 'completed')
            }
            onMissed={(occurrence) => void finishActivity(occurrence.event, occurrence.date, 'missed')}
            onCancelOccurrence={(occurrence) => setConfirmOccurrence(occurrence)}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Carry forward"
              description="Blocks from this day that were never marked done"
              icon={<Undo2 />}
            />
            <CardBody className="space-y-2">
              {unfinished.length === 0 ? (
                <p className="text-xs text-[var(--fg-muted)]">
                  Nothing left behind on this day.
                </p>
              ) : (
                unfinished.map((occurrence) => (
                  <div
                    key={`carry-${occurrence.event.id}`}
                    className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-2.5 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">
                        {occurrence.event.title}
                      </span>
                      <span className="block text-[0.62rem] text-[var(--fg-subtle)]">
                        {occurrence.startTime}–{occurrence.endTime}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => void duplicateEventById(occurrence.event.id, todayKey())}
                      title="Copy this block onto today"
                    >
                      <Copy />
                      Today
                    </Button>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Unscheduled inbox"
              description="Open tasks with no time block yet"
              icon={<Inbox />}
            />
            <CardBody className="space-y-2">
              {unscheduled.length === 0 ? (
                <p className="text-xs text-[var(--fg-muted)]">
                  Every open task already has a slot.
                </p>
              ) : (
                unscheduled.slice(0, 6).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-2.5 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{task.title}</span>
                      <span className="block text-[0.62rem] text-[var(--fg-subtle)]">
                        {task.dueDate ? `Due ${task.dueDate}` : 'No due date'}
                        {task.estimatedMinutes ? ` · ~${formatMinutes(task.estimatedMinutes)}` : ''}
                      </span>
                    </span>
                    <ScheduleTaskButton taskId={task.id} date={date} />
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Manual log"
              description="Correct or add what actually happened"
              icon={<Pencil />}
              action={
                <Button size="sm" variant="ghost" onClick={() => setManualOpen(true)}>
                  <Plus />
                  Add
                </Button>
              }
            />
            <CardBody className="space-y-2">
              {dayRecords.length === 0 ? (
                <p className="text-xs text-[var(--fg-muted)]">
                  Nothing logged yet. Completing a block writes a record automatically.
                </p>
              ) : (
                dayRecords.map((record) => (
                  <ManualRecordRow
                    key={record.id}
                    record={record}
                    onSave={(next) => void saveActivity(next)}
                    onDelete={() => {
                      setUndo(record)
                      void deleteActivity(record.id)
                    }}
                  />
                ))
              )}
              {undo ? (
                <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-3)] px-3 py-2">
                  <span className="flex-1 truncate text-[0.68rem] text-[var(--fg-muted)]">
                    Removed “{undo.title}”.
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void saveActivity(undo)
                      setUndo(null)
                    }}
                  >
                    <Undo2 />
                    Undo
                  </Button>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Day summary" description="Where the hours went" />
            <CardBody className="space-y-2">
              <Progress
                value={percent(
                  rollup.activityMinutes,
                  Math.max(rollup.plannedMinutes, rollup.activityMinutes, 1),
                )}
                label={<span>Completed against plan</span>}
              />
              <ul className="space-y-1 text-xs">
                <li className="flex justify-between">
                  <span className="text-[var(--fg-muted)]">Scheduled</span>
                  <span className="font-semibold">{formatMinutes(rollup.plannedMinutes)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[var(--fg-muted)]">Completed</span>
                  <span className="font-semibold">{formatMinutes(rollup.activityMinutes)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[var(--fg-muted)]">Study</span>
                  <span className="font-semibold">{formatMinutes(rollup.studyMinutes)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[var(--fg-muted)]">Sleep recorded</span>
                  <span className="font-semibold">
                    {rollup.sleepMinutes === null ? '—' : formatMinutes(rollup.sleepMinutes)}
                  </span>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>

      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultDate={date}
        onSaved={() => setFormOpen(false)}
      />
      <EventFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        event={editing?.event ?? null}
        occurrenceDate={editing?.date}
      />

      <ConfirmDialog
        open={confirmOccurrence !== null}
        onOpenChange={(open) => !open && setConfirmOccurrence(null)}
      >
        <ConfirmDialogContent
          title={confirmOccurrence?.event.seriesId ? 'Cancel this occurrence?' : 'Delete this block?'}
          description={
            confirmOccurrence?.event.seriesId
              ? 'Only this day is cancelled. The rest of the repeating series stays exactly as it is.'
              : 'This block is removed from your plan. Work already logged stays in your history.'
          }
          confirmLabel={confirmOccurrence?.event.seriesId ? 'Cancel this day' : 'Delete block'}
          onConfirm={() => {
            if (confirmOccurrence) void deleteOccurrence(confirmOccurrence.event, confirmOccurrence.date)
            setConfirmOccurrence(null)
          }}
        />
      </ConfirmDialog>

      <ManualRecordDialog
        open={manualOpen}
        date={date}
        onOpenChange={setManualOpen}
        onSave={(record) => void saveActivity(record)}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Inline editors                                                             */
/* -------------------------------------------------------------------------- */

function ManualRecordRow({
  record,
  onSave,
  onDelete,
}: {
  record: ActivityRecord
  onSave: (next: ActivityRecord) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex items-center gap-2 rounded-xl border border-[var(--line)] px-2.5 py-2">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: CATEGORY_META[record.category].style.color }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{record.title}</span>
        <span className="block text-[0.62rem] text-[var(--fg-subtle)]">
          planned {formatMinutes(record.plannedMinutes)} · actual {formatMinutes(record.actualMinutes)}
        </span>
      </span>

      {open ? (
        <ManualRecordEditor
          record={record}
          onCancel={() => setOpen(false)}
          onSave={(next) => {
            onSave(next)
            setOpen(false)
          }}
        />
      ) : (
        <>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Edit actual duration"
            onClick={() => setOpen(true)}
          >
            <Pencil />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Delete record" onClick={onDelete}>
            <Trash2 />
          </Button>
        </>
      )}
    </div>
  )
}

function ManualRecordEditor({
  record,
  onSave,
  onCancel,
}: {
  record: ActivityRecord
  onSave: (next: ActivityRecord) => void
  onCancel: () => void
}) {
  const [minutes, setMinutes] = useState(String(record.actualMinutes))
  const [status, setStatus] = useState<ActivityStatus>(record.status)

  return (
    <div className="absolute top-full right-2 z-20 mt-1 w-60 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-xl">
      <Field label="Actual minutes">
        <Input
          type="number"
          min={0}
          max={1440}
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
        />
      </Field>
      <Field label="Status" className="mt-2">
        <Select value={status} onChange={(event) => setStatus(event.target.value as ActivityStatus)}>
          <option value="completed">Completed</option>
          <option value="missed">Missed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </Field>
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() =>
            onSave({
              ...record,
              // Missing or cancelled work is never credited as completed time.
              actualMinutes: status === 'completed' ? Number(minutes) || 0 : 0,
              status,
              updatedAt: Date.now(),
            })
          }
        >
          <Check />
          Save
        </Button>
      </div>
    </div>
  )
}

function ManualRecordDialog({
  open,
  date,
  onOpenChange,
  onSave,
}: {
  open: boolean
  date: string
  onOpenChange: (open: boolean) => void
  onSave: (record: ActivityRecord) => void
}) {
  const { data } = useApp()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ActivityCategory>('other')
  const [minutes, setMinutes] = useState('45')
  const [status, setStatus] = useState<ActivityStatus>('completed')
  const [subjectId, setSubjectId] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange}>
      <ConfirmDialogContent
        title="Log an activity by hand"
        description="Use this for something you did without a scheduled block."
        confirmLabel="Add record"
        cancelLabel="Cancel"
        destructive={false}
        onConfirm={() => {
          if (!title.trim()) {
            setError('Give the record a title')
            return
          }
          const stamp = Date.now()
          const total = Number(minutes) || 0
          onSave({
            id: newId('act'),
            eventId: null,
            title: title.trim(),
            category,
            date,
            plannedMinutes: 0,
            actualMinutes: status === 'completed' ? total : 0,
            status,
            startedAt: stamp - total * 60_000,
            finishedAt: stamp,
            subjectId: subjectId || null,
            projectId: null,
            projectTaskId: null,
            notes: '',
            createdAt: stamp,
            updatedAt: stamp,
          })
          setTitle('')
          setMinutes('45')
          setError(null)
          onOpenChange(false)
        }}
      >
        <div className="space-y-3">
          <Field label="Title" required error={error ?? undefined}>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Library revision" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select
                value={category}
                onChange={(event) => setCategory(event.target.value as ActivityCategory)}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Minutes">
              <Input
                type="number"
                min={0}
                max={1440}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={status} onChange={(event) => setStatus(event.target.value as ActivityStatus)}>
                <option value="completed">Completed</option>
                <option value="missed">Missed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </Field>
            <Field label="Subject">
              <Select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                <option value="">None</option>
                {data.subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </ConfirmDialogContent>
    </ConfirmDialog>
  )
}

function ScheduleTaskButton({ taskId, date }: { taskId: string; date: string }) {
  const { data, saveEvent } = useApp()
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState('18:00')
  const [minutes, setMinutes] = useState('60')

  const task = data.tasks.find((row) => row.id === taskId)

  return (
    <div className="relative">
      <Button size="sm" variant="soft" onClick={() => setOpen((value) => !value)}>
        <CalendarDays />
        Schedule
      </Button>
      {open ? (
        <div className="absolute top-full right-0 z-20 mt-1 w-60 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-xl">
          <p className="mb-2 truncate text-xs font-semibold">Schedule “{task?.title ?? 'task'}”</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start">
              <Input type="time" value={start} onChange={(event) => setStart(event.target.value)} />
            </Field>
            <Field label="Minutes">
              <Input
                type="number"
                min={5}
                max={600}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </Field>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              <X />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!task) return
                const total = Number(minutes) || 60
                const [hours, mins] = start.split(':').map(Number)
                const endMinutes = hours * 60 + mins + total
                const end = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(
                  endMinutes % 60,
                ).padStart(2, '0')}`
                await saveEvent({
                  title: task.title,
                  category: task.kind === 'assignment' ? 'assignment' : 'study',
                  date,
                  startTime: start,
                  endTime: end,
                  description: task.description,
                  priority: task.priority,
                  subjectId: task.subjectId,
                  projectId: task.projectId,
                  taskId: task.id,
                  plannedMinutes: total,
                })
                setOpen(false)
              }}
            >
              <Plus />
              Add block
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
