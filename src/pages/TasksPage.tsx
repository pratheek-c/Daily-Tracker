import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarPlus,
  ClipboardList,
  Copy,
  Filter,
  Plus,
  Search,
  SortAsc,
  Trash2,
  Undo2,
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
  Select,
  Textarea,
} from '@/components/ui'
import { ConfirmDialog, ConfirmDialogContent } from '@/components/ui/confirm-dialog'
import { useApp } from '@/app/AppContext'
import { TASK_KIND_META, TASK_STATUS_META, PRIORITY_OPTIONS } from '@/config/categories'
import { classifyTaskDue, URGENCY_META } from '@/services/analytics/metrics'
import { addDaysToKey, formatMinutes, relativeDayLabel, todayKey } from '@/lib/date'
import { newId } from '@/lib/utils'
import type { Priority, Task, TaskKind, TaskStatus } from '@/types'

type QuickFilter = 'all' | 'today' | 'overdue' | 'upcoming' | 'done'
type SortKey = 'due' | 'priority' | 'created' | 'title'

/**
 * Unified task manager for assignments, exams, project work and personal
 * responsibilities, with conversion of any task into a scheduled block.
 */
export default function TasksPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, saveTask, deleteTask, saveEvent } = useApp()

  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(
    (searchParams.get('filter') as QuickFilter) || 'all',
  )
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [kindFilter, setKindFilter] = useState<TaskKind | 'all'>('all')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('due')
  const [draft, setDraft] = useState<Task | null>(null)
  const [confirmTask, setConfirmTask] = useState<Task | null>(null)
  const [undo, setUndo] = useState<Task | null>(null)
  const [scheduleFor, setScheduleFor] = useState<Task | null>(null)

  const today = todayKey()

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    let rows = data.tasks.filter((task) => {
      if (term && !`${task.title} ${task.description} ${task.notes}`.toLowerCase().includes(term)) {
        return false
      }
      if (statusFilter !== 'all' && task.status !== statusFilter) return false
      if (kindFilter !== 'all' && task.kind !== kindFilter) return false
      if (subjectFilter !== 'all' && task.subjectId !== subjectFilter) return false

      const urgency = classifyTaskDue(task)
      switch (quickFilter) {
        case 'today':
          return task.dueDate === today && task.status !== 'done'
        case 'overdue':
          return urgency === 'overdue'
        case 'upcoming':
          return (
            task.status !== 'done' &&
            task.dueDate !== null &&
            task.dueDate > today &&
            task.dueDate <= addDaysToKey(today, 7)
          )
        case 'done':
          return task.status === 'done'
        default:
          return true
      }
    })

    const priorityRank = { urgent: 3, high: 2, medium: 1, low: 0 }
    rows = rows.sort((a, b) => {
      if (sort === 'due') {
        if (a.dueDate === null && b.dueDate === null) return a.title.localeCompare(b.title)
        if (a.dueDate === null) return 1
        if (b.dueDate === null) return -1
        return a.dueDate.localeCompare(b.dueDate)
      }
      if (sort === 'priority') return priorityRank[b.priority] - priorityRank[a.priority]
      if (sort === 'title') return a.title.localeCompare(b.title)
      return b.createdAt - a.createdAt
    })
    return rows
  }, [data.tasks, query, statusFilter, kindFilter, subjectFilter, quickFilter, sort, today])

  const counts = useMemo(
    () => ({
      all: data.tasks.length,
      today: data.tasks.filter((task) => task.dueDate === today && task.status !== 'done').length,
      overdue: data.tasks.filter((task) => classifyTaskDue(task) === 'overdue').length,
      upcoming: data.tasks.filter(
        (task) =>
          task.status !== 'done' &&
          task.dueDate !== null &&
          task.dueDate > today &&
          task.dueDate <= addDaysToKey(today, 7),
      ).length,
      done: data.tasks.filter((task) => task.status === 'done').length,
    }),
    [data.tasks, today],
  )

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="font-display text-lg font-bold sm:text-xl">Tasks &amp; assignments</h1>
          <p className="text-xs text-[var(--fg-muted)]">
            {counts.overdue > 0
              ? `${counts.overdue} overdue · ${counts.today} due today`
              : counts.today > 0
                ? `${counts.today} due today`
                : 'Nothing overdue'}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" onClick={() => setDraft(newTaskDraft())}>
            <Plus />
            New task
          </Button>
        </div>
      </header>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--fg-subtle)]" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSearchParams(
                    (current) => {
                      const next = new URLSearchParams(current)
                      if (event.target.value) next.set('q', event.target.value)
                      else next.delete('q')
                      return next
                    },
                    { replace: true },
                  )
                }}
                placeholder="Search tasks, assignments and notes…"
                className="pl-9"
                aria-label="Search tasks"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'today', label: 'Today' },
                  { id: 'overdue', label: 'Overdue' },
                  { id: 'upcoming', label: 'Next 7 days' },
                  { id: 'done', label: 'Done' },
                ] as { id: QuickFilter; label: string }[]
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setQuickFilter(option.id)
                    setSearchParams(
                      (current) => {
                        const next = new URLSearchParams(current)
                        if (option.id === 'all') next.delete('filter')
                        else next.set('filter', option.id)
                        return next
                      },
                      { replace: true },
                    )
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors ${
                    quickFilter === option.id
                      ? 'border-transparent bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                      : 'border-[var(--line-strong)] text-[var(--fg-muted)] hover:border-[var(--accent)]'
                  }`}
                >
                  {option.label} {counts[option.id] > 0 ? `(${counts[option.id]})` : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-t border-[var(--line)] pt-3">
            <Filter className="size-3.5 text-[var(--fg-subtle)]" />
            <Field label="Status" className="w-32">
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as TaskStatus | 'all')}
                className="h-8.5 text-xs"
              >
                <option value="all">Any status</option>
                {Object.values(TASK_STATUS_META).map((meta) => (
                  <option key={meta.value} value={meta.value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type" className="w-36">
              <Select
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value as TaskKind | 'all')}
                className="h-8.5 text-xs"
              >
                <option value="all">Any type</option>
                {Object.entries(TASK_KIND_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject" className="w-40">
              <Select
                value={subjectFilter}
                onChange={(event) => setSubjectFilter(event.target.value)}
                className="h-8.5 text-xs"
              >
                <option value="all">Any subject</option>
                {data.subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sort" className="w-36">
              <Select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="h-8.5 text-xs"
              >
                <option value="due">Due date</option>
                <option value="priority">Priority</option>
                <option value="created">Newest first</option>
                <option value="title">Title</option>
              </Select>
            </Field>
            <span className="ml-auto flex items-center gap-1 text-[0.68rem] text-[var(--fg-subtle)]">
              <SortAsc className="size-3.5" />
              {filtered.length} shown
            </span>
          </div>
        </CardBody>
      </Card>

      {undo ? (
        <Card>
          <CardBody className="flex items-center gap-2 py-2.5">
            <span className="flex-1 text-xs text-[var(--fg-muted)]">Deleted “{undo.title}”.</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void saveTask(undo)
                setUndo(null)
              }}
            >
              <Undo2 />
              Undo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setUndo(null)}>
              Dismiss
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Task list"
          description={
            filtered.length === 0
              ? 'Nothing matches these filters'
              : `${filtered.length} task${filtered.length === 1 ? '' : 's'}`
          }
          icon={<ClipboardList />}
          flush
        />
        <CardBody className="space-y-2">
          {filtered.length === 0 ? (
            <CuteEmptyState
              mascot="bunny"
              title={data.tasks.length === 0 ? 'No tasks yet' : 'No tasks match these filters'}
              description={
                data.tasks.length === 0
                  ? 'Add an assignment, an exam revision task or a personal to-do. Deadlines feed the dashboard and reminders.'
                  : 'Try clearing the search box or switching back to the All filter.'
              }
              action={
                data.tasks.length === 0 ? (
                  <Button size="sm" onClick={() => setDraft(newTaskDraft())}>
                    <Plus />
                    Add your first task
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setQuery('')
                      setQuickFilter('all')
                      setStatusFilter('all')
                      setKindFilter('all')
                      setSubjectFilter('all')
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            filtered.map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                subjectName={data.subjects.find((subject) => subject.id === task.subjectId)?.name}
                projectName={data.projects.find((project) => project.id === task.projectId)?.name}
                onToggle={() =>
                  void saveTask({
                    ...task,
                    status: task.status === 'done' ? 'todo' : 'done',
                    completedAt: task.status === 'done' ? null : Date.now(),
                    updatedAt: Date.now(),
                  })
                }
                onEdit={() => setDraft(task)}
                onDuplicate={() =>
                  void saveTask({
                    ...task,
                    id: newId('task'),
                    title: `${task.title} (copy)`,
                    status: 'todo',
                    completedAt: null,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  })
                }
                onDelete={() => setConfirmTask(task)}
                onSchedule={() => setScheduleFor(task)}
              />
            ))
          )}
        </CardBody>
      </Card>

      <TaskDialog
        task={draft}
        onOpenChange={(open) => !open && setDraft(null)}
        onSave={(task) => {
          void saveTask(task)
          setDraft(null)
        }}
      />

      <ScheduleTaskDialog
        task={scheduleFor}
        onOpenChange={(open) => !open && setScheduleFor(null)}
        onSchedule={async (task, values) => {
          const [hours, minutes] = values.start.split(':').map(Number)
          const endMinutes = hours * 60 + minutes + values.minutes
          const end = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(
            endMinutes % 60,
          ).padStart(2, '0')}`
          const saved = await saveEvent({
            title: task.title,
            category:
              task.kind === 'assignment'
                ? 'assignment'
                : task.kind === 'project-task'
                  ? 'project'
                  : 'study',
            date: values.date,
            startTime: values.start,
            endTime: end,
            description: task.description,
            priority: task.priority,
            subjectId: task.subjectId,
            projectId: task.projectId,
            taskId: task.id,
            plannedMinutes: values.minutes,
          })
          await saveTask({ ...task, scheduledEventId: saved.id, updatedAt: Date.now() })
          setScheduleFor(null)
          navigate(`/planner?date=${values.date}`)
        }}
      />

      <ConfirmDialog open={confirmTask !== null} onOpenChange={(open) => !open && setConfirmTask(null)}>
        <ConfirmDialogContent
          title={`Delete “${confirmTask?.title ?? ''}”?`}
          description="The task is removed from your list. Any scheduled block created from it stays in your calendar."
          confirmLabel="Delete task"
          onConfirm={() => {
            if (confirmTask) {
              setUndo(confirmTask)
              void deleteTask(confirmTask.id)
            }
            setConfirmTask(null)
          }}
        />
      </ConfirmDialog>
    </div>
  )
}

function TaskListItem({
  task,
  subjectName,
  projectName,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  onSchedule,
}: {
  task: Task
  subjectName?: string
  projectName?: string
  onToggle: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onSchedule: () => void
}) {
  const urgency = classifyTaskDue(task)
  const kindMeta = TASK_KIND_META[task.kind]

  return (
    <div className="flex flex-wrap items-start gap-2.5 rounded-2xl border border-[var(--line)] p-3">
      <Checkbox
        checked={task.status === 'done'}
        onCheckedChange={onToggle}
        aria-label={`Mark ${task.title} ${task.status === 'done' ? 'not done' : 'done'}`}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onEdit} className="block w-full text-left">
          <span
            className={`block truncate text-sm font-semibold ${
              task.status === 'done' ? 'text-[var(--fg-subtle)] line-through' : 'text-[var(--fg)]'
            }`}
          >
            {task.title}
          </span>
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Chip className={kindMeta.chip}>{kindMeta.label}</Chip>
          <Chip className={TASK_STATUS_META[task.status].chip}>
            {TASK_STATUS_META[task.status].label}
          </Chip>
          {task.dueDate ? (
            <Chip className={URGENCY_META[urgency].chip}>
              {relativeDayLabel(task.dueDate)}
              {task.dueTime ? ` ${task.dueTime}` : ''}
            </Chip>
          ) : null}
          {subjectName ? <Chip tone="neutral">{subjectName}</Chip> : null}
          {projectName ? <Chip tone="neutral">{projectName}</Chip> : null}
          {task.estimatedMinutes > 0 ? (
            <Chip tone="neutral">~{formatMinutes(task.estimatedMinutes)}</Chip>
          ) : null}
          {task.scheduledEventId ? <Chip tone="success">Scheduled</Chip> : null}
        </div>
        {task.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs text-[var(--fg-muted)]">{task.description}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Button size="icon-sm" variant="ghost" onClick={onSchedule} aria-label="Convert to a scheduled block">
          <CalendarPlus />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onDuplicate} aria-label="Duplicate task">
          <Copy />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onDelete} aria-label="Delete task">
          <Trash2 />
        </Button>
      </div>
    </div>
  )
}

function newTaskDraft(): Task {
  const stamp = Date.now()
  return {
    id: newId('task'),
    title: '',
    description: '',
    kind: 'assignment',
    status: 'todo',
    priority: 'medium',
    subjectId: null,
    projectId: null,
    projectTaskId: null,
    estimatedMinutes: 60,
    actualMinutes: 0,
    dueDate: addDaysToKey(todayKey(), 3),
    dueTime: '23:59',
    checklist: [],
    notes: '',
    scheduledEventId: null,
    completedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

function TaskDialog({
  task,
  onOpenChange,
  onSave,
}: {
  task: Task | null
  onOpenChange: (open: boolean) => void
  onSave: (task: Task) => void
}) {
  const { data } = useApp()
  const [values, setValues] = useState<Task>(() => task ?? newTaskDraft())
  const [error, setError] = useState<string | null>(null)
  const [seededFor, setSeededFor] = useState<string | null>(task?.id ?? null)
  const [newStep, setNewStep] = useState('')

  if (task && task.id !== seededFor) {
    setSeededFor(task.id)
    setValues(task)
    setError(null)
  }

  return (
    <ConfirmDialog open={task !== null} onOpenChange={onOpenChange}>
      <ConfirmDialogContent
        title={task?.title ? `Edit ${task.title}` : 'New task or assignment'}
        description="Deadlines drive reminders and the overdue list on your dashboard."
        confirmLabel="Save task"
        destructive={false}
        onConfirm={() => {
          if (!values.title.trim()) {
            setError('Give the task a title')
            return
          }
          onSave({
            ...values,
            title: values.title.trim(),
            completedAt: values.status === 'done' ? (values.completedAt ?? Date.now()) : null,
            updatedAt: Date.now(),
          })
        }}
      >
        <div className="space-y-3">
          <Field label="Title" required error={error ?? undefined}>
            <Input
              value={values.title}
              onChange={(event) => setValues({ ...values, title: event.target.value })}
              placeholder="e.g. Submit data structures assignment"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select
                value={values.kind}
                onChange={(event) => setValues({ ...values, kind: event.target.value as TaskKind })}
              >
                {Object.entries(TASK_KIND_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={values.status}
                onChange={(event) => setValues({ ...values, status: event.target.value as TaskStatus })}
              >
                {Object.values(TASK_STATUS_META).map((meta) => (
                  <option key={meta.value} value={meta.value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Due date">
              <Input
                type="date"
                value={values.dueDate ?? ''}
                onChange={(event) => setValues({ ...values, dueDate: event.target.value || null })}
              />
            </Field>
            <Field label="Due time" hint={values.dueTime ? undefined : 'Reminders need a time'}>
              <Input
                type="time"
                value={values.dueTime ?? ''}
                onChange={(event) => setValues({ ...values, dueTime: event.target.value || null })}
              />
            </Field>
            <Field label="Priority">
              <Select
                value={values.priority}
                onChange={(event) => setValues({ ...values, priority: event.target.value as Priority })}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Subject">
              <Select
                value={values.subjectId ?? ''}
                onChange={(event) => setValues({ ...values, subjectId: event.target.value || null })}
              >
                <option value="">None</option>
                {data.subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Project">
              <Select
                value={values.projectId ?? ''}
                onChange={(event) => setValues({ ...values, projectId: event.target.value || null })}
              >
                <option value="">None</option>
                {data.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Estimated minutes" hint={formatMinutes(values.estimatedMinutes)}>
            <Input
              type="number"
              min={0}
              max={6000}
              step={15}
              value={values.estimatedMinutes}
              onChange={(event) =>
                setValues({ ...values, estimatedMinutes: Number(event.target.value) || 0 })
              }
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={values.description}
              onChange={(event) => setValues({ ...values, description: event.target.value })}
            />
          </Field>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--fg-muted)]">Checklist</p>
            <ul className="mb-2 space-y-1.5">
              {values.checklist.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={() =>
                      setValues({
                        ...values,
                        checklist: values.checklist.map((row) =>
                          row.id === item.id ? { ...row, done: !row.done } : row,
                        ),
                      })
                    }
                    aria-label={`Toggle ${item.label}`}
                  />
                  <span className="flex-1 text-xs">{item.label}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${item.label}`}
                    onClick={() =>
                      setValues({
                        ...values,
                        checklist: values.checklist.filter((row) => row.id !== item.id),
                      })
                    }
                    className="text-[var(--fg-subtle)] hover:text-[#C2545F]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                value={newStep}
                onChange={(event) => setNewStep(event.target.value)}
                placeholder="Add a step"
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  if (!newStep.trim()) return
                  setValues({
                    ...values,
                    checklist: [
                      ...values.checklist,
                      { id: newId('chk'), label: newStep.trim(), done: false, weight: 1 },
                    ],
                  })
                  setNewStep('')
                }}
              />
              <Button
                size="sm"
                variant="soft"
                onClick={() => {
                  if (!newStep.trim()) return
                  setValues({
                    ...values,
                    checklist: [
                      ...values.checklist,
                      { id: newId('chk'), label: newStep.trim(), done: false, weight: 1 },
                    ],
                  })
                  setNewStep('')
                }}
              >
                <Plus />
                Add
              </Button>
            </div>
          </div>

          <Field label="Notes">
            <Textarea
              value={values.notes}
              onChange={(event) => setValues({ ...values, notes: event.target.value })}
            />
          </Field>
        </div>
      </ConfirmDialogContent>
    </ConfirmDialog>
  )
}

function ScheduleTaskDialog({
  task,
  onOpenChange,
  onSchedule,
}: {
  task: Task | null
  onOpenChange: (open: boolean) => void
  onSchedule: (task: Task, values: { date: string; start: string; minutes: number }) => Promise<void>
}) {
  const [date, setDate] = useState(todayKey())
  const [start, setStart] = useState('18:00')
  const [minutes, setMinutes] = useState('60')
  const [busy, setBusy] = useState(false)
  const [seededFor, setSeededFor] = useState<string | null>(null)

  if (task && task.id !== seededFor) {
    setSeededFor(task.id)
    setMinutes(String(task.estimatedMinutes || 60))
    setDate(task.dueDate && task.dueDate >= todayKey() ? task.dueDate : todayKey())
  }

  return (
    <ConfirmDialog open={task !== null} onOpenChange={onOpenChange}>
      <ConfirmDialogContent
        title="Schedule this task"
        description="Creates a real block in your timetable that you can start, track and complete."
        confirmLabel={busy ? 'Scheduling…' : 'Add to timetable'}
        destructive={false}
        onConfirm={async () => {
          if (!task) return
          setBusy(true)
          try {
            await onSchedule(task, { date, start, minutes: Number(minutes) || 60 })
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Start">
            <Input type="time" value={start} onChange={(event) => setStart(event.target.value)} />
          </Field>
          <Field label="Minutes" hint={formatMinutes(Number(minutes) || 0)}>
            <Input
              type="number"
              min={5}
              max={600}
              step={5}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </Field>
        </div>
      </ConfirmDialogContent>
    </ConfirmDialog>
  )
}
