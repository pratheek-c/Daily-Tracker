import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Moon,
  Pencil,
  Repeat,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Field,
  Input,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { ConfirmDialog, ConfirmDialogContent } from '@/components/ui/confirm-dialog'
import { EventFormDialog } from '@/components/calendar/EventFormDialog'
import { WeekGrid } from '@/components/timetable/WeekGrid'
import { useApp } from '@/app/AppContext'
import { useWindowContext } from '@/hooks/useWindowContext'
import { CATEGORY_META } from '@/config/categories'
import {
  addDaysToKey,
  formatClock,
  formatDayLabel,
  relativeDayLabel,
  todayKey,
  weekKeys,
} from '@/lib/date'
import { describeRecurrence } from '@/services/scheduling/recurrence'
import { plannedNights } from '@/services/scheduling/sleep-events'
import { cn } from '@/lib/utils'
import type { ActivityCategory, DateKey, RecurrenceFrequency, ScheduledEvent, Weekday } from '@/types'

const WEEKDAY_OPTIONS: { value: Weekday; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

/**
 * Weekly routine planner.
 *
 * Recurring blocks are stored once as a series template, so editing the routine
 * updates every future week while past days keep the history they had.
 */
export default function TimetablePage() {
  const navigate = useNavigate()
  const { data, settings, saveEvent, deleteEvent } = useApp()

  const [anchor, setAnchor] = useState<DateKey>(todayKey())
  const [formOpen, setFormOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [editing, setEditing] = useState<{ event: ScheduledEvent; date: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ScheduledEvent | null>(null)

  const week = useMemo(() => weekKeys(anchor, settings.weekStartsOn), [anchor, settings.weekStartsOn])
  const window = useWindowContext(week[0], week[6])

  const recurring = useMemo(
    () => data.events.filter((event) => event.isSeriesTemplate).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [data.events],
  )

  const oneOffs = useMemo(
    () =>
      data.events
        .filter((event) => !event.isSeriesTemplate && event.status !== 'cancelled')
        .filter((event) => event.date >= week[0] && event.date <= week[6]),
    [data.events, week],
  )

  const nights = useMemo(
    () =>
      data.sleepSchedule
        ? plannedNights(data.sleepSchedule, week[0], addDaysToKey(week[6], 1), data.sleepExceptions)
        : [],
    [data.sleepSchedule, data.sleepExceptions, week],
  )

  const conflictsThisWeek = window.conflicts

  /**
   * Copy this week's routine into a future week.
   *
   * Recurring templates already repeat, so only one-off blocks are cloned. That
   * is what prevents duplicate generations when the routine is copied twice.
   */
  const [copyTarget, setCopyTarget] = useState(addDaysToKey(week[0], 7))
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  const copyWeek = async () => {
    const targetWeek = weekKeys(copyTarget, settings.weekStartsOn)
    const source = oneOffs
    if (source.length === 0) {
      setCopyStatus(
        'This week only contains repeating routine blocks, which already repeat every week — nothing needed copying.',
      )
      return
    }
    const offset = Math.round(
      (new Date(`${targetWeek[0]}T00:00:00`).getTime() - new Date(`${week[0]}T00:00:00`).getTime()) /
        86_400_000,
    )
    let copied = 0
    for (const event of source) {
      const existing = data.events.find(
        (row) => !row.isSeriesTemplate && row.date === addDaysToKey(event.date, offset) && row.title === event.title,
      )
      if (existing) continue
      await saveEvent({
        title: event.title,
        category: event.category,
        date: addDaysToKey(event.date, offset),
        startTime: event.startTime,
        endTime: event.endTime,
        description: event.description,
        priority: event.priority,
        subjectId: event.subjectId,
        projectId: event.projectId,
        location: event.location,
        meetingUrl: event.meetingUrl,
        reminders: event.reminders,
      })
      copied += 1
    }
    setCopyStatus(
      copied === 0
        ? 'Those blocks are already in the target week.'
        : `Copied ${copied} block${copied === 1 ? '' : 's'} into the week of ${targetWeek[0]}.`,
    )
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="font-display text-lg font-bold sm:text-xl">My timetable</h1>
          <p className="text-xs text-[var(--fg-muted)]">
            Weekly routine · {formatDayLabel(week[0])} → {formatDayLabel(week[6])}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setAnchor(addDaysToKey(anchor, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAnchor(todayKey())}>
            This week
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setAnchor(addDaysToKey(anchor, 7))}
            aria-label="Next week"
          >
            <ChevronRight />
          </Button>
          <Button size="sm" onClick={() => setTemplateOpen(true)}>
            <Repeat />
            Add routine block
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
            <CalendarPlus />
            One-off block
          </Button>
        </div>
      </header>

      {conflictsThisWeek.length > 0 ? (
        <Card className="border-[var(--color-warning)] bg-[var(--color-peach)]/40">
          <CardBody className="flex flex-wrap items-center gap-2 py-3">
            <TriangleAlert className="size-4 text-[var(--color-peach-deep)]" />
            <p className="text-xs font-semibold text-[var(--color-peach-deep)]">
              {conflictsThisWeek.length} overlap{conflictsThisWeek.length === 1 ? '' : 's'} this week
            </p>
            <div className="flex flex-wrap gap-1.5">
              {conflictsThisWeek.slice(0, 3).map((conflict) => (
                <Chip key={`${conflict.a.event.id}-${conflict.b.event.id}-${conflict.a.date}`} tone="warning">
                  {conflict.a.event.title} ↔ {conflict.b.event.title}
                </Chip>
              ))}
            </div>
            <p className="text-[0.68rem] text-[var(--fg-muted)]">
              Overlapping is allowed — you decide what matters.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Tabs defaultValue="grid">
        <TabsList>
          <TabsTrigger value="grid">Week grid</TabsTrigger>
          <TabsTrigger value="routine">Routine blocks</TabsTrigger>
          <TabsTrigger value="sleep">Sleep in this week</TabsTrigger>
          <TabsTrigger value="copy">Copy to another week</TabsTrigger>
        </TabsList>

        <TabsContent value="grid">
          <WeekGrid
            days={week}
            occurrences={window.occurrences}
            weekStartsOn={settings.weekStartsOn}
            timeFormat={settings.timeFormat}
            onSelectDay={(date) => navigate(`/calendar?date=${date}`)}
            onSelectOccurrence={(occurrence) =>
              setEditing({ event: occurrence.event, date: occurrence.date })
            }
            onAddAt={() => setFormOpen(true)}
          />
        </TabsContent>

        <TabsContent value="routine">
          <Card>
            <CardHeader
              title="Repeating routine"
              description={`${recurring.length} template${recurring.length === 1 ? '' : 's'} · edit once, applies to every future week`}
              icon={<Repeat />}
              action={
                <Button size="sm" variant="soft" onClick={() => setTemplateOpen(true)}>
                  <Repeat />
                  Add
                </Button>
              }
              flush
            />
            <CardBody>
              {recurring.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm font-semibold">No routine blocks yet</p>
                  <p className="mx-auto mt-1 max-w-md text-xs text-[var(--fg-muted)]">
                    Build your week once — morning routine, college classes, study blocks, project
                    time, meals, exercise, breaks, personal time and bedtime. Everything repeats
                    automatically.
                  </p>
                  <Button className="mt-3" size="sm" onClick={() => setTemplateOpen(true)}>
                    <Sparkles />
                    Build my weekly routine
                  </Button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {recurring.map((event) => {
                    const meta = CATEGORY_META[event.category]
                    return (
                      <li
                        key={event.id}
                        className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] p-3"
                      >
                        <span
                          className="grid w-24 shrink-0 place-items-center rounded-xl px-2 py-1.5 text-center text-[0.68rem] font-bold"
                          style={meta.style}
                        >
                          {formatClock(event.startTime, settings)} – {formatClock(event.endTime, settings)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{event.title}</span>
                          <span className="block text-[0.65rem] text-[var(--fg-subtle)]">
                            {describeRecurrence(event.recurrence)} · {meta.label}
                            {event.subjectId
                              ? ` · ${data.subjects.find((subject) => subject.id === event.subjectId)?.name ?? ''}`
                              : ''}
                          </span>
                        </span>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${event.title}`}
                          onClick={() =>
                            setEditing({
                              event,
                              date: week.find((day) => day >= event.date) ?? event.date,
                            })
                          }
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete the whole ${event.title} series`}
                          onClick={() => setConfirmDelete(event)}
                        >
                          <Trash2 />
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="sleep">
          <Card>
            <CardHeader
              title="Sleep blocks this week"
              description="Generated from your sleep schedule and shown in the main timetable"
              icon={<Moon />}
              action={
                <Button size="sm" variant="soft" onClick={() => navigate('/sleep')}>
                  Edit schedule
                </Button>
              }
              flush
            />
            <CardBody>
              {nights.length === 0 ? (
                <p className="py-4 text-center text-xs text-[var(--fg-muted)]">
                  Your sleep schedule is turned off. Enable it on the Sleep page and the nights will
                  appear here and in the calendar.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {nights.map((night) => (
                    <li
                      key={night.date}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-xs"
                    >
                      <span className="w-24 font-semibold">{relativeDayLabel(night.date)}</span>
                      <span className="text-[var(--fg-muted)]">
                        {formatClock(night.bedtime, settings)} → {formatClock(night.wakeTime, settings)}
                      </span>
                      <Chip tone="neutral">{night.timeInBedMinutes} min in bed</Chip>
                      <Chip tone="accent">wind-down {formatClock(night.windDownStart, settings)}</Chip>
                      <Chip tone="neutral">{night.source === 'weekend' ? 'Weekend' : night.source === 'exception' ? 'Exception' : 'Weeknight'}</Chip>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="copy">
          <Card>
            <CardHeader
              title="Copy this week into a future week"
              description="Good for exam weeks or a changed schedule"
              icon={<Copy />}
              flush
            />
            <CardBody className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Source week starts" hint={week[0]}>
                  <Input value={week[0]} readOnly disabled />
                </Field>
                <Field label="Copy into the week of">
                  <Input
                    type="date"
                    value={copyTarget}
                    min={addDaysToKey(week[0], 7)}
                    onChange={(event) => setCopyTarget(event.target.value)}
                  />
                </Field>
                <div className="flex items-end">
                  <Button onClick={() => void copyWeek()}>
                    <Copy />
                    Copy blocks
                  </Button>
                </div>
              </div>
              <p className="text-xs text-[var(--fg-muted)]">
                Repeating routine blocks already apply to every future week, so only one-off blocks
                are copied. Blocks that already exist in the target week are skipped, which keeps
                the operation safe to repeat.
              </p>
              {copyStatus ? (
                <p className="rounded-xl bg-[var(--surface-3)] px-3 py-2 text-xs text-[var(--fg-muted)]">
                  {copyStatus}
                </p>
              ) : null}
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>

      {/* One-off block for the visible week */}
      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultDate={week[0]}
        onSaved={() => setFormOpen(false)}
      />

      {/* Recurring routine block */}
      <RoutineBlockDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        defaultDate={week[0]}
      />

      <EventFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        event={editing?.event ?? null}
        occurrenceDate={editing?.date}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <ConfirmDialogContent
          title="Delete this routine block?"
          description={`“${confirmDelete?.title ?? ''}” will be removed from every future week. Days you already completed keep their records.`}
          confirmLabel="Delete series"
          onConfirm={() => {
            if (confirmDelete) void deleteEvent(confirmDelete.id)
            setConfirmDelete(null)
          }}
        />
      </ConfirmDialog>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Routine template form                                                      */
/* -------------------------------------------------------------------------- */

function RoutineBlockDialog({
  open,
  onOpenChange,
  defaultDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDate: DateKey
}) {
  const { data, saveEvent } = useApp()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ActivityCategory>('study')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekdays')
  const [days, setDays] = useState<Weekday[]>([1, 2, 3, 4, 5])
  const [subjectId, setSubjectId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setTitle('')
    setCategory('study')
    setStartTime('09:00')
    setEndTime('10:00')
    setFrequency('weekdays')
    setDays([1, 2, 3, 4, 5])
    setSubjectId('')
    setError(null)
  }

  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange}>
      <ConfirmDialogContent
        title="Add a repeating routine block"
        description="It will repeat every week from the date below."
        confirmLabel="Create routine block"
        cancelLabel="Cancel"
        destructive={false}
        onConfirm={async () => {
          if (!title.trim()) {
            setError('Give the block a title')
            return
          }
          if (startTime === endTime) {
            setError('End time must differ from the start time')
            return
          }
          if (frequency === 'custom' && days.length === 0) {
            setError('Pick at least one weekday')
            return
          }
          await saveEvent({
            title: title.trim(),
            category,
            date: defaultDate,
            startTime,
            endTime,
            subjectId: subjectId || null,
            priority: 'medium',
            recurrence: {
              frequency,
              interval: 1,
              byWeekday: frequency === 'custom' ? days : [],
              startDate: defaultDate,
              endDate: null,
              count: null,
            },
          })
          reset()
          onOpenChange(false)
        }}
      >
        <div className="space-y-3">
          <Field label="Title" required error={error ?? undefined}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Morning study block"
            />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Start">
              <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </Field>
            <Field label="End">
              <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </Field>
            <Field label="Category">
              <Select
                value={category}
                onChange={(event) => setCategory(event.target.value as ActivityCategory)}
              >
                {Object.values(CATEGORY_META).map((meta) => (
                  <option key={meta.value} value={meta.value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Repeats">
            <Select
              value={frequency}
              onChange={(event) => setFrequency(event.target.value as RecurrenceFrequency)}
            >
              <option value="daily">Every day</option>
              <option value="weekdays">Every weekday (Mon–Fri)</option>
              <option value="weekends">Every weekend</option>
              <option value="weekly">Every week on this weekday</option>
              <option value="custom">Custom weekdays</option>
            </Select>
          </Field>

          {frequency === 'custom' ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[var(--fg-muted)]">On these days</p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_OPTIONS.map((option) => {
                  const active = days.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setDays((current) =>
                          active
                            ? current.filter((day) => day !== option.value)
                            : [...current, option.value].sort(),
                        )
                      }
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors',
                        active
                          ? 'border-transparent bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                          : 'border-[var(--line-strong)] text-[var(--fg-muted)] hover:border-[var(--accent)]',
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <Field label="Subject" hint="Optional — links the block to study reporting">
            <Select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              <option value="">None</option>
              {data.subjects
                .filter((subject) => !subject.archived)
                .map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
            </Select>
          </Field>

          <p className="rounded-xl bg-[var(--surface-3)] px-3 py-2 text-[0.68rem] text-[var(--fg-muted)]">
            Starts {formatDayLabel(defaultDate, { withYear: true })} and repeats every week until you
            change or delete it. Edit a single day and the rest of the series stays as it is.
          </p>
        </div>
      </ConfirmDialogContent>
    </ConfirmDialog>
  )
}
