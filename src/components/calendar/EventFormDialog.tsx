import { useMemo, useState } from 'react'
import { z } from 'zod'
import { AlertTriangle, CalendarDays, Clock, MapPin, Repeat, Trash2 } from 'lucide-react'
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogContent,
  Field,
  Input,
  Select,
  Switch,
  Textarea,
} from '@/components/ui'
import { CATEGORY_META, CATEGORY_OPTIONS, PRIORITY_OPTIONS } from '@/config/categories'
import { REMINDER_PRESET_OPTIONS } from '@/config/defaults'
import { useApp } from '@/app/AppContext'
import { conflictsForCandidate } from '@/services/scheduling/events'
import { describeRecurrence } from '@/services/scheduling/recurrence'
import { durationMinutes, isOvernight, todayKey, weekdayOf } from '@/lib/date'
import { formatMinutes } from '@/lib/utils'
import type {
  ActivityCategory,
  Priority,
  RecurrenceRule,
  ScheduledEvent,
  Weekday,
} from '@/types'

const eventSchema = z
  .object({
    title: z.string().trim().min(1, 'Give this block a name').max(120, 'Keep it under 120 characters'),
    category: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time is required'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time is required'),
    priority: z.string(),
    description: z.string().max(600),
    location: z.string().max(160),
    meetingUrl: z.string().max(300),
    notes: z.string().max(2000),
    subjectId: z.string(),
    projectId: z.string(),
    recurrence: z.enum(['none', 'daily', 'weekdays', 'weekends', 'weekly', 'custom']),
    interval: z.number().int().min(1).max(12),
    recurrenceEnd: z.string(),
    remindersEnabled: z.boolean(),
    reminderOffsets: z.array(z.number().int().min(0).max(1440)),
  })
  .refine((value) => value.endTime !== value.startTime, {
    message: 'End time must differ from the start time',
    path: ['endTime'],
  })
  .refine((value) => value.meetingUrl === '' || /^https?:\/\//i.test(value.meetingUrl), {
    message: 'Meeting links must start with http:// or https://',
    path: ['meetingUrl'],
  })

type FormValues = z.infer<typeof eventSchema>

export interface EventFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Existing record to edit; omit to create. */
  event?: ScheduledEvent | null
  defaultDate?: string
  defaultStart?: string
  defaultEnd?: string
  defaultCategory?: ActivityCategory
  defaultTitle?: string
  /** When editing a recurring series: the concrete day being edited. */
  occurrenceDate?: string
  onSaved?: (event: ScheduledEvent) => void
  onDeleted?: () => void
}

function emptyValues(props: EventFormDialogProps): FormValues {
  return {
    title: props.defaultTitle ?? '',
    category: props.defaultCategory ?? 'study',
    date: props.defaultDate ?? todayKey(),
    startTime: props.defaultStart ?? '09:00',
    endTime: props.defaultEnd ?? '10:00',
    priority: 'medium',
    description: '',
    location: '',
    meetingUrl: '',
    notes: '',
    subjectId: '',
    projectId: '',
    recurrence: 'none',
    interval: 1,
    recurrenceEnd: '',
    remindersEnabled: true,
    reminderOffsets: [10],
  }
}

function valuesFromEvent(event: ScheduledEvent, occurrenceDate?: string): FormValues {
  return {
    title: event.title,
    category: event.category,
    date: occurrenceDate ?? event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    priority: event.priority,
    description: event.description,
    location: event.location,
    meetingUrl: event.meetingUrl,
    notes: event.notes,
    subjectId: event.subjectId ?? '',
    projectId: event.projectId ?? '',
    recurrence: event.recurrence?.frequency ?? 'none',
    interval: event.recurrence?.interval ?? 1,
    recurrenceEnd: event.recurrence?.endDate ?? '',
    remindersEnabled: event.reminders.enabled,
    reminderOffsets: event.reminders.offsetsMinutes,
  }
}

/**
 * The single event form shared by the planner, calendar, timetable and
 * quick-add menu.
 *
 * It validates before saving, previews overlaps (planned sleep included) and
 * requires an explicit acknowledgement before an intentional double-booking is
 * written — a warning rather than a silent block.
 */
export function EventFormDialog(props: EventFormDialogProps) {
  const { open, onOpenChange, event, occurrenceDate } = props
  const { data, saveEvent, saveEventRecord, deleteEvent, settings, saveSettings } = useApp()

  /**
   * Seeding during render (rather than in an effect) is the documented pattern
   * for resetting state when a prop changes: React discards the render's output
   * and re-runs the component immediately, so there is no cascading re-render.
   * The form only re-seeds on the open transition, so typing is never clobbered.
   */
  const [form, setForm] = useState(() => ({
    wasOpen: open,
    values: event ? valuesFromEvent(event, occurrenceDate) : emptyValues(props),
  }))
  const values = form.values
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [scope, setScope] = useState<'occurrence' | 'series'>('occurrence')
  const [acknowledged, setAcknowledged] = useState(false)
  const [saving, setSaving] = useState(false)

  const setValues = (next: FormValues | ((current: FormValues) => FormValues)) => {
    setForm((current) => ({
      ...current,
      values: typeof next === 'function' ? next(current.values) : next,
    }))
  }

  if (open && !form.wasOpen) {
    setForm({
      wasOpen: true,
      values: event ? valuesFromEvent(event, occurrenceDate) : emptyValues(props),
    })
    setErrors({})
    setAcknowledged(false)
    setScope('occurrence')
  } else if (!open && form.wasOpen) {
    setForm((current) => ({ ...current, wasOpen: false }))
  }

  const editingSeries = Boolean(event?.seriesId && event?.recurrence)
  const date = occurrenceDate ?? event?.date

  const duration = durationMinutes(values.startTime, values.endTime)
  const overnight = isOvernight(values.startTime, values.endTime)

  const conflicts = useMemo(() => {
    if (!open) return []
    // A pure stand-in for "now": this draft record is never persisted, it only
    // needs a well-formed shape for the conflict detector.
    const stamp = 0
    const candidate: ScheduledEvent = {
      id: event?.id ?? 'candidate',
      title: values.title || 'New block',
      description: values.description,
      category: values.category as ActivityCategory,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
      overnight,
      status: 'planned',
      priority: values.priority as Priority,
      subjectId: values.subjectId || null,
      projectId: values.projectId || null,
      projectTaskId: null,
      taskId: null,
      location: values.location,
      meetingUrl: values.meetingUrl,
      reminders: { enabled: true, offsetsMinutes: [10] },
      recurrence: null,
      seriesId: event?.seriesId ?? null,
      occurrenceDate: null,
      isSeriesTemplate: false,
      conflictAcknowledged: false,
      plannedMinutes: duration,
      actualMinutes: null,
      startedAt: null,
      finishedAt: null,
      notes: values.notes,
      createdAt: stamp,
      updatedAt: stamp,
    }
    const stored = event?.isSeriesTemplate
      ? data.events.filter((row) => row.seriesId !== event.seriesId)
      : data.events
    return conflictsForCandidate(candidate, stored).slice(0, 6)
  }, [open, values, data.events, duration, overnight, event])

  const sleepConflicts = conflicts.filter(
    (conflict) => conflict.a.event.category === 'sleep' || conflict.b.event.category === 'sleep',
  )

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key as string]) return current
      const next = { ...current }
      delete next[key as string]
      return next
    })
    setAcknowledged(false)
  }

  const buildRecurrence = (): RecurrenceRule | null => {
    if (values.recurrence === 'none') return null
    const base = {
      interval: values.interval,
      startDate: values.date,
      endDate: values.recurrenceEnd || null,
      count: null,
      byWeekday: [] as Weekday[],
    }
    switch (values.recurrence) {
      case 'daily':
        return { ...base, frequency: 'daily' }
      case 'weekdays':
        return { ...base, frequency: 'weekdays' }
      case 'weekends':
        return { ...base, frequency: 'weekends' }
      case 'custom':
        return { ...base, frequency: 'custom', byWeekday: [weekdayOf(values.date)] }
      case 'weekly':
      default:
        return { ...base, frequency: 'weekly', byWeekday: [weekdayOf(values.date)] }
    }
  }

  const submit = async () => {
    const parsed = eventSchema.safeParse(values)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        if (!next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }
    if (conflicts.length > 0 && !acknowledged) {
      setErrors({ form: 'Review the overlap warning below, then tick the box to save anyway.' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: parsed.data.title,
        category: parsed.data.category as ActivityCategory,
        date: parsed.data.date,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        description: parsed.data.description,
        priority: parsed.data.priority as Priority,
        subjectId: parsed.data.subjectId || null,
        projectId: parsed.data.projectId || null,
        location: parsed.data.location,
        meetingUrl: parsed.data.meetingUrl,
        reminders: {
          enabled: parsed.data.remindersEnabled,
          offsetsMinutes:
            parsed.data.reminderOffsets.length > 0 ? parsed.data.reminderOffsets : [0],
        },
        notes: parsed.data.notes,
        plannedMinutes: duration,
      }

      let saved: ScheduledEvent
      if (event && editingSeries && scope === 'occurrence' && date) {
        // Keep the series intact: detach one concrete block and cancel the
        // occurrence the rule originally produced for that day.
        const marker: ScheduledEvent = {
          ...event,
          id: `cancel_${event.seriesId}_${date}`,
          date,
          occurrenceDate: date,
          isSeriesTemplate: false,
          status: 'cancelled',
          notes: 'Replaced by an edited occurrence',
          updatedAt: Date.now(),
        }
        await saveEventRecord(marker)
        saved = await saveEvent({ ...payload, recurrence: null }, undefined)
      } else if (event) {
        saved = await saveEvent(editingSeries ? { ...payload, recurrence: event.recurrence } : payload, event.id)
      } else {
        saved = await saveEvent({ ...payload, recurrence: buildRecurrence() })
      }

      if (settings.defaultCategory !== payload.category) {
        void saveSettings({ defaultCategory: payload.category })
      }
      props.onSaved?.(saved)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={event ? 'Edit scheduled block' : 'New scheduled block'}
        description={
          duration > 0
            ? `${formatMinutes(duration)}${overnight ? ' · crosses midnight' : ''}`
            : 'Choose a time range'
        }
        size="lg"
        footer={
          <>
            {event ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-[#C2545F] hover:bg-[var(--color-blush)]"
                onClick={async () => {
                  await deleteEvent(event.id)
                  props.onDeleted?.()
                  onOpenChange(false)
                }}
              >
                <Trash2 />
                Delete
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={saving}>
              {saving ? 'Saving…' : event ? 'Save changes' : 'Add to plan'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2" error={errors.title}>
            <Input
              autoFocus
              value={values.title}
              onChange={(changeEvent) => update('title', changeEvent.target.value)}
              placeholder="e.g. Data structures revision"
              maxLength={120}
            />
          </Field>

          <Field label="Category">
            <Select
              value={values.category}
              onChange={(changeEvent) => update('category', changeEvent.target.value)}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Priority">
            <Select
              value={values.priority}
              onChange={(changeEvent) => update('priority', changeEvent.target.value)}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Date" required error={errors.date}>
            <Input
              type="date"
              value={values.date}
              onChange={(changeEvent) => update('date', changeEvent.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" required error={errors.startTime}>
              <Input
                type="time"
                value={values.startTime}
                onChange={(changeEvent) => update('startTime', changeEvent.target.value)}
              />
            </Field>
            <Field
              label="End"
              required
              error={errors.endTime}
              hint={overnight ? 'Ends next day' : undefined}
            >
              <Input
                type="time"
                value={values.endTime}
                onChange={(changeEvent) => update('endTime', changeEvent.target.value)}
              />
            </Field>
          </div>

          <Field label="Subject" hint="Optional link for study reporting">
            <Select
              value={values.subjectId}
              onChange={(changeEvent) => update('subjectId', changeEvent.target.value)}
            >
              <option value="">No subject</option>
              {data.subjects
                .filter((subject) => !subject.archived)
                .map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
            </Select>
          </Field>

          <Field label="Project" hint="Optional link for project reporting">
            <Select
              value={values.projectId}
              onChange={(changeEvent) => update('projectId', changeEvent.target.value)}
            >
              <option value="">No project</option>
              {data.projects
                .filter((project) => project.status !== 'archived')
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </Select>
          </Field>

          <Field label="Repeats">
            <Select
              value={values.recurrence}
              onChange={(changeEvent) =>
                update('recurrence', changeEvent.target.value as FormValues['recurrence'])
              }
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Every day</option>
              <option value="weekdays">Every weekday (Mon–Fri)</option>
              <option value="weekends">Every weekend</option>
              <option value="weekly">Every week on this day</option>
              <option value="custom">Custom weekly rhythm</option>
            </Select>
          </Field>

          {values.recurrence !== 'none' ? (
            <>
              <Field label="Repeat every" hint="In days for daily, weeks otherwise">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={values.interval}
                  onChange={(changeEvent) =>
                    update('interval', Math.max(1, Number(changeEvent.target.value) || 1))
                  }
                />
              </Field>
              <Field label="Repeat until" hint="Leave empty to repeat indefinitely">
                <Input
                  type="date"
                  value={values.recurrenceEnd}
                  min={values.date}
                  onChange={(changeEvent) => update('recurrenceEnd', changeEvent.target.value)}
                />
              </Field>
              <div className="sm:col-span-2">
                <p className="flex items-center gap-1.5 rounded-xl bg-[var(--surface-3)] px-3 py-2 text-xs text-[var(--fg-muted)]">
                  <Repeat className="size-3.5" />
                  {describeRecurrence(buildRecurrence())}
                </p>
              </div>
            </>
          ) : null}

          <Field label="Location" error={errors.location}>
            <Input
              value={values.location}
              onChange={(changeEvent) => update('location', changeEvent.target.value)}
              placeholder="Room 204, library…"
            />
          </Field>

          <Field label="Meeting link" error={errors.meetingUrl}>
            <Input
              value={values.meetingUrl}
              onChange={(changeEvent) => update('meetingUrl', changeEvent.target.value)}
              placeholder="https://…"
            />
          </Field>

          <Field label="Description" className="sm:col-span-2">
            <Textarea
              value={values.description}
              onChange={(changeEvent) => update('description', changeEvent.target.value)}
              placeholder="What exactly are you doing in this block?"
            />
          </Field>

          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              value={values.notes}
              onChange={(changeEvent) => update('notes', changeEvent.target.value)}
              placeholder="Anything to remember afterwards"
            />
          </Field>

          <div className="sm:col-span-2 rounded-2xl border border-[var(--line)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[var(--fg)]">Reminders</p>
                <p className="text-[0.68rem] text-[var(--fg-subtle)]">
                  Multiple times per block are supported
                </p>
              </div>
              <Switch
                checked={values.remindersEnabled}
                onCheckedChange={(checked) => update('remindersEnabled', checked)}
                aria-label="Reminders enabled"
              />
            </div>
            {values.remindersEnabled ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {REMINDER_PRESET_OPTIONS.map((option) => {
                  const active = values.reminderOffsets.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        update(
                          'reminderOffsets',
                          active
                            ? values.reminderOffsets.filter((value) => value !== option.value)
                            : [...values.reminderOffsets, option.value].sort((a, b) => a - b),
                        )
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
            ) : null}
          </div>

          {editingSeries ? (
            <div className="sm:col-span-2 rounded-2xl border border-[var(--color-lavender)] bg-[var(--color-lavender)]/35 p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--color-lavender-deep)]">
                This block repeats — what should change?
              </p>
              <div className="flex flex-col gap-2 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === 'occurrence'}
                    onChange={() => setScope('occurrence')}
                    className="accent-[var(--accent)]"
                  />
                  Only {date} — the rest of the series stays as it is
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === 'series'}
                    onChange={() => setScope('series')}
                    className="accent-[var(--accent)]"
                  />
                  The whole series
                </label>
              </div>
            </div>
          ) : null}

          {conflicts.length > 0 ? (
            <div className="sm:col-span-2 rounded-2xl border border-[var(--color-warning)] bg-[var(--color-peach)]/45 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-peach-deep)]">
                <AlertTriangle className="size-3.5" />
                {sleepConflicts.length > 0
                  ? 'This overlaps planned sleep'
                  : `Overlaps ${conflicts.length} other block${conflicts.length === 1 ? '' : 's'}`}
              </p>
              <ul className="mt-1.5 space-y-1">
                {conflicts.map((conflict) => {
                  const other = conflict.a.event.id === event?.id ? conflict.b : conflict.a
                  return (
                    <li
                      key={`${other.event.id}-${other.startMillis}`}
                      className="text-[0.72rem] text-[var(--fg-muted)]"
                    >
                      {other.event.title} · {other.startTime}–{other.endTime} (
                      {formatMinutes(conflict.overlapMinutes)} overlap)
                    </li>
                  )
                })}
              </ul>
              <label className="mt-2.5 flex items-center gap-2 text-xs font-semibold text-[var(--fg)]">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(value) => setAcknowledged(Boolean(value))}
                />
                Save anyway — I know these overlap
              </label>
            </div>
          ) : null}

          {errors.form ? (
            <p className="sm:col-span-2 text-xs font-semibold text-[#C2545F]">{errors.form}</p>
          ) : null}

          <div className="sm:col-span-2 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
            <Chip icon={<Clock />} tone="accent">
              {formatMinutes(duration)}
            </Chip>
            {(() => {
              const meta = CATEGORY_META[values.category as ActivityCategory]
              return (
                <Chip style={meta.style} icon={<CalendarDays />}>
                  {meta.label}
                </Chip>
              )
            })()}
            {values.location ? (
              <Chip icon={<MapPin />} tone="neutral">
                {values.location}
              </Chip>
            ) : null}
          </div>

          {values.category === 'sleep' ? (
            <p className="sm:col-span-2 rounded-xl bg-[var(--color-sleep)]/40 px-3 py-2 text-[0.7rem] text-[var(--color-sleep-ink)]">
              Sleep blocks are normally generated from your sleep schedule. A manual block here is a
              one-off override and will show alongside the generated one.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
