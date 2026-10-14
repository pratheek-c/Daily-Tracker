import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  Kanban,
  Link2,
  List,
  Plus,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui'
import { ConfirmDialog, ConfirmDialogContent } from '@/components/ui/confirm-dialog'
import { useApp } from '@/app/AppContext'
import { COLOR_SWATCHES, PRIORITY_OPTIONS, PROJECT_STATUS_META, TASK_STATUS_META } from '@/config/categories'
import { checklistProgress, classifyTaskDue, projectProgress, URGENCY_META } from '@/services/analytics/metrics'
import { addDaysToKey, formatMinutes, todayKey } from '@/lib/date'
import { newId } from '@/lib/utils'
import type { ID, Priority, Project, ProjectStatus, ProjectTask, TaskStatus } from '@/types'

/**
 * Project tracker.
 *
 * Progress is always derived from tasks (and their checklists) rather than a
 * hand-typed percentage, so the number cannot drift away from reality.
 */
export default function ProjectsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, saveProject, deleteProject, saveProjectTask, deleteProjectTask, saveEvent } = useApp()

  const [selectedId, setSelectedId] = useState<ID | null>(searchParams.get('project'))
  const [projectDialog, setProjectDialog] = useState<{ open: boolean; draft: Project | null }>({
    open: false,
    draft: null,
  })
  const [taskDraft, setTaskDraft] = useState<ProjectTask | null>(null)
  const [confirmProject, setConfirmProject] = useState<Project | null>(null)
  const [view, setView] = useState<'list' | 'board'>('list')

  const selected = data.projects.find((project) => project.id === selectedId) ?? null

  const projectsWithProgress = useMemo(
    () =>
      data.projects.map((project) => {
        const tasks = data.projectTasks.filter((task) => task.projectId === project.id)
        const progress = projectProgress(tasks)
        const overdue = tasks.filter(
          (task) => task.status !== 'done' && task.deadline !== null && task.deadline < todayKey(),
        ).length
        const dueSoon = tasks.filter(
          (task) =>
            task.status !== 'done' &&
            task.deadline !== null &&
            task.deadline >= todayKey() &&
            task.deadline <= addDaysToKey(todayKey(), 5),
        ).length
        return { project, tasks, progress, overdue, dueSoon }
      }),
    [data.projects, data.projectTasks],
  )

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="font-display text-lg font-bold sm:text-xl">Project tracker</h1>
          <p className="text-xs text-[var(--fg-muted)]">
            {data.projects.filter((project) => project.status === 'active').length} active Â·{' '}
            {data.projectTasks.length} task{data.projectTasks.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => setProjectDialog({ open: true, draft: newProjectDraft() })}
          >
            <Plus />
            New project
          </Button>
        </div>
      </header>

      {data.projects.length === 0 ? (
        <Card>
          <CardBody>
            <CuteEmptyState
              mascot="cat-box"
              size="lg"
              title="No projects yet"
              description="Add a college or software project, break it into tasks with subtasks and checklists, and its progress will be calculated from what you actually finish."
              action={
                <Button onClick={() => setProjectDialog({ open: true, draft: newProjectDraft() })}>
                  <FolderKanban />
                  Create my first project
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-2">
            {projectsWithProgress.map(({ project, progress, overdue, dueSoon }) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  setSelectedId(project.id)
                  setSearchParams({ project: project.id }, { replace: true })
                }}
                className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                  selectedId === project.id
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{project.name}</span>
                    <span className="block text-[0.62rem] text-[var(--fg-subtle)]">
                      {progress.done}/{progress.total} tasks
                      {project.deadline ? ` Â· due ${project.deadline}` : ''}
                    </span>
                  </span>
                  <Chip className={PROJECT_STATUS_META[project.status].chip}>
                    {PROJECT_STATUS_META[project.status].label}
                  </Chip>
                </div>
                <Progress
                  value={progress.percent}
                  size="sm"
                  className="mt-2"
                  barClassName="bg-[var(--color-sky-deep)]"
                />
                {overdue > 0 || dueSoon > 0 ? (
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {overdue > 0 ? <Chip tone="danger">{overdue} overdue</Chip> : null}
                    {dueSoon > 0 ? <Chip tone="warning">{dueSoon} due soon</Chip> : null}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="min-w-0">
            {!selected ? (
              <Card>
                <CardBody>
                  <CuteEmptyState
                    size="sm"
                    mascot="bunny"
                    title="Pick a project"
                    description="Choose a project on the left to see its tasks, checklists and schedule."
                  />
                </CardBody>
              </Card>
            ) : (
              <ProjectDetail
                project={selected}
                view={view}
                onChangeView={setView}
                onEdit={() => setProjectDialog({ open: true, draft: selected })}
                onDelete={() => setConfirmProject(selected)}
                onCreateTask={() => setTaskDraft(newTaskDraft(selected.id))}
                onEditTask={(task) => setTaskDraft(task)}
                tasks={data.projectTasks.filter((task) => task.projectId === selected.id)}
                onDeleteTask={(id) => void deleteProjectTask(id)}
                onScheduleTask={async (task) => {
                  await saveEvent({
                    title: task.title,
                    category: 'project',
                    date: todayKey(),
                    startTime: '18:00',
                    endTime: '19:00',
                    description: task.description,
                    priority: task.priority,
                    projectId: selected.id,
                    projectTaskId: task.id,
                    plannedMinutes: task.estimatedMinutes || 60,
                  })
                  navigate('/calendar')
                }}
              />
            )}
          </div>
        </div>
      )}

      <ProjectDialog
        open={projectDialog.open}
        draft={projectDialog.draft}
        onOpenChange={(open) => setProjectDialog((current) => ({ ...current, open }))}
        onSave={(project) => {
          void saveProject(project)
          setSelectedId(project.id)
        }}
      />

      <ProjectTaskDialog
        task={taskDraft}
        projectId={selectedId}
        onOpenChange={(open) => !open && setTaskDraft(null)}
        onSave={(task) => {
          void saveProjectTask(task)
          setTaskDraft(null)
        }}
      />

      <ConfirmDialog
        open={confirmProject !== null}
        onOpenChange={(open) => !open && setConfirmProject(null)}
      >
        <ConfirmDialogContent
          title={`Delete â€œ${confirmProject?.name ?? ''}â€?`}
          description="The project and all of its tasks are removed. Scheduled blocks already in your calendar stay where they are."
          confirmLabel="Delete project"
          onConfirm={() => {
            if (confirmProject) {
              void deleteProject(confirmProject.id)
              setSelectedId(null)
            }
            setConfirmProject(null)
          }}
        />
      </ConfirmDialog>
    </div>
  )
}

function ProjectDetail({
  project,
  tasks,
  view,
  onChangeView,
  onEdit,
  onDelete,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  onScheduleTask,
}: {
  project: Project
  tasks: ProjectTask[]
  view: 'list' | 'board'
  onChangeView: (next: 'list' | 'board') => void
  onEdit: () => void
  onDelete: () => void
  onCreateTask: () => void
  onEditTask: (task: ProjectTask) => void
  onDeleteTask: (id: ID) => void
  onScheduleTask: (task: ProjectTask) => void
}) {
  const { saveProjectTask } = useApp()
  const progress = projectProgress(tasks)
  const boardColumns: TaskStatus[] = ['todo', 'in-progress', 'blocked', 'done']

  // Timestamps are produced inside the handlers, so nothing impure is read while
  // the component renders.
  const handleSetStatus = useCallback(
    (task: ProjectTask, status: TaskStatus) => {
      const stamp = Date.now()
      void saveProjectTask({
        ...task,
        status,
        completedAt: status === 'done' ? stamp : null,
        updatedAt: stamp,
      })
    },
    [saveProjectTask],
  )

  const toggleChecklist = useCallback(
    (task: ProjectTask, itemId: ID) => {
      void saveProjectTask({
        ...task,
        checklist: task.checklist.map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item,
        ),
        updatedAt: Date.now(),
      })
    },
    [saveProjectTask],
  )

  return (
    <Card>
      <CardHeader
        title={project.name}
        description={project.description || 'No description yet'}
        icon={<FolderKanban />}
        action={
          <>
            <Button size="sm" variant="soft" onClick={onCreateTask}>
              <Plus />
              Task
            </Button>
            <Button size="sm" variant="ghost" onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Delete project">
              <Trash2 />
            </Button>
          </>
        }
        flush
      />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip className={PROJECT_STATUS_META[project.status].chip}>
            {PROJECT_STATUS_META[project.status].label}
          </Chip>
          <Chip tone={project.priority === 'urgent' ? 'danger' : 'neutral'}>{project.priority} priority</Chip>
          {project.deadline ? <Chip tone="accent">Deadline {project.deadline}</Chip> : null}
          <Chip tone="neutral">{progress.done}/{progress.total} tasks done</Chip>
        </div>

        <Progress
          value={progress.percent}
          label={<span>Weighted progress from tasks and checklists</span>}
          barClassName="bg-[var(--color-sky-deep)]"
        />

        {project.resources.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {project.resources.map((resource) => (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-[0.68rem] font-semibold text-[var(--accent-ink)] hover:underline"
              >
                <Link2 className="size-3" />
                {resource.label || resource.url}
              </a>
            ))}
          </div>
        ) : null}

        <Tabs value={view} onValueChange={(value) => onChangeView(value as 'list' | 'board')}>
          <TabsList>
            <TabsTrigger value="list">
              <List />
              List
            </TabsTrigger>
            <TabsTrigger value="board">
              <Kanban />
              Board
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <CuteEmptyState
                  size="sm"
                  mascot="cat"
                  title="No tasks in this project yet"
                  description="Break the project into tasks with estimates and checklists. Progress is calculated from them."
                  action={
                    <Button size="sm" onClick={onCreateTask}>
                      <Plus />
                      Add a task
                    </Button>
                  }
                />
              ) : (
                tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    subtasks={tasks.filter((row) => row.parentTaskId === task.id)}
                    onToggle={() => handleSetStatus(task, task.status === 'done' ? 'todo' : 'done')}
                    onToggleChecklist={(itemId) => toggleChecklist(task, itemId)}
                    onEdit={() => onEditTask(task)}
                    onDelete={() => onDeleteTask(task.id)}
                    onSchedule={() => onScheduleTask(task)}
                    onStatus={(status) => handleSetStatus(task, status)}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="board">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {boardColumns.map((status) => {
                const columnTasks = tasks.filter((task) => task.status === status && !task.parentTaskId)
                return (
                  <div key={status} className="rounded-2xl bg-[var(--surface-3)] p-2.5">
                    <div className="flex items-center justify-between px-1 pb-2">
                      <span className="text-[0.68rem] font-bold tracking-wide uppercase">
                        {TASK_STATUS_META[status].label}
                      </span>
                      <Chip tone="neutral">{columnTasks.length}</Chip>
                    </div>
                    <div className="space-y-2">
                      {columnTasks.map((task) => {
                        const checklist = checklistProgress(task.checklist)
                        return (
                          <div
                            key={task.id}
                            className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5"
                          >
                            <p className="text-xs font-semibold">{task.title}</p>
                            {task.deadline ? (
                              <p className="mt-0.5 text-[0.6rem] text-[var(--fg-subtle)]">
                                due {task.deadline}
                              </p>
                            ) : null}
                            {checklist.total > 0 ? (
                              <Progress value={checklist.percent} size="sm" className="mt-1.5" />
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {boardColumns
                                .filter((next) => next !== status)
                                .map((next) => (
                                  <button
                                    key={next}
                                    type="button"
                                    onClick={() => handleSetStatus(task, next)}
                                    className="rounded-full border border-[var(--line-strong)] px-1.5 py-0.5 text-[0.58rem] font-semibold text-[var(--fg-muted)] hover:border-[var(--accent)]"
                                  >
                                    {TASK_STATUS_META[next].label}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )
                      })}
                      {columnTasks.length === 0 ? (
                        <p className="px-1 py-3 text-center text-[0.62rem] text-[var(--fg-subtle)]">
                          Nothing here
                        </p>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </CardBody>
    </Card>
  )
}

function TaskRow({
  task,
  subtasks,
  onToggle,
  onToggleChecklist,
  onEdit,
  onDelete,
  onSchedule,
  onStatus,
}: {
  task: ProjectTask
  subtasks: ProjectTask[]
  onToggle: () => void
  onToggleChecklist: (id: ID) => void
  onEdit: () => void
  onDelete: () => void
  onSchedule: () => void
  onStatus: (status: TaskStatus) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const checklist = checklistProgress(task.checklist)
  const urgency = classifyTaskDue({
    dueDate: task.deadline,
    dueTime: null,
    status: task.status,
  })

  return (
    <div className="rounded-2xl border border-[var(--line)] p-3">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-0.5 text-[var(--fg-subtle)]"
          aria-label={expanded ? 'Collapse task' : 'Expand task'}
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <Checkbox
          checked={task.status === 'done'}
          onCheckedChange={onToggle}
          aria-label={`Mark ${task.title} ${task.status === 'done' ? 'not done' : 'done'}`}
        />
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-semibold ${task.status === 'done' ? 'text-[var(--fg-subtle)] line-through' : ''}`}
          >
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Chip className={TASK_STATUS_META[task.status].chip}>
              {TASK_STATUS_META[task.status].label}
            </Chip>
            {task.deadline ? <Chip className={URGENCY_META[urgency].chip}>{task.deadline}</Chip> : null}
            {task.estimatedMinutes > 0 ? (
              <Chip tone="neutral">~{formatMinutes(task.estimatedMinutes)}</Chip>
            ) : null}
            {checklist.total > 0 ? (
              <Chip tone="accent">
                {checklist.done}/{checklist.total} steps
              </Chip>
            ) : null}
            {subtasks.length > 0 ? <Chip tone="neutral">{subtasks.length} subtasks</Chip> : null}
            {task.dependsOn.length > 0 ? (
              <Chip tone="warning">{task.dependsOn.length} dependency</Chip>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button size="icon-sm" variant="ghost" onClick={onSchedule} aria-label="Schedule into timetable">
            <CalendarPlus />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label="Edit task">
            <ClipboardList />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onDelete} aria-label="Delete task">
            <Trash2 />
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-2.5 border-t border-[var(--line)] pt-3">
          {task.description ? (
            <p className="text-xs leading-relaxed text-[var(--fg-muted)]">{task.description}</p>
          ) : null}

          {task.checklist.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[0.68rem] font-bold tracking-wide text-[var(--fg-subtle)] uppercase">
                Checklist
              </p>
              <ul className="space-y-1.5">
                {task.checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={item.done}
                      onCheckedChange={() => onToggleChecklist(item.id)}
                      aria-label={`Toggle ${item.label}`}
                    />
                    <span
                      className={`text-xs ${item.done ? 'text-[var(--fg-subtle)] line-through' : 'text-[var(--fg)]'}`}
                    >
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[0.68rem] text-[var(--fg-muted)]">Move to</span>
            {(['todo', 'in-progress', 'blocked', 'done'] as TaskStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onStatus(status)}
                className={`rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold ${
                  task.status === status
                    ? 'border-transparent bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                    : 'border-[var(--line-strong)] text-[var(--fg-muted)] hover:border-[var(--accent)]'
                }`}
              >
                {TASK_STATUS_META[status].label}
              </button>
            ))}
          </div>

          {subtasks.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[0.68rem] font-bold tracking-wide text-[var(--fg-subtle)] uppercase">
                Subtasks
              </p>
              <ul className="space-y-1">
                {subtasks.map((subtask) => (
                  <li key={subtask.id} className="flex items-center gap-2 text-xs">
                    <Check
                      className={`size-3.5 ${subtask.status === 'done' ? 'text-[var(--color-success)]' : 'text-[var(--fg-subtle)]'}`}
                    />
                    <span className={subtask.status === 'done' ? 'line-through opacity-70' : ''}>
                      {subtask.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {task.links.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {task.links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-[0.65rem] font-semibold text-[var(--accent-ink)] hover:underline"
                >
                  <Link2 className="size-3" />
                  {link.label || link.url}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function newProjectDraft(): Project {
  const stamp = Date.now()
  return {
    id: newId('proj'),
    name: '',
    description: '',
    startDate: todayKey(),
    deadline: addDaysToKey(todayKey(), 21),
    priority: 'medium',
    status: 'planning',
    category: 'College',
    color: COLOR_SWATCHES[5],
    notes: '',
    resources: [],
    archived: false,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

function newTaskDraft(projectId: ID): ProjectTask {
  const stamp = Date.now()
  return {
    id: newId('ptask'),
    projectId,
    parentTaskId: null,
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    estimatedMinutes: 60,
    actualMinutes: 0,
    startDate: todayKey(),
    deadline: addDaysToKey(todayKey(), 7),
    checklist: [],
    dependsOn: [],
    notes: '',
    links: [],
    order: 0,
    completedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

function ProjectDialog({
  open,
  draft,
  onOpenChange,
  onSave,
}: {
  open: boolean
  draft: Project | null
  onOpenChange: (open: boolean) => void
  onSave: (project: Project) => void
}) {
  const [values, setValues] = useState<Project>(draft ?? newProjectDraft())
  const [error, setError] = useState<string | null>(null)
  const [seededFor, setSeededFor] = useState<string | null>(draft?.id ?? null)

  if (open && (draft?.id ?? null) !== seededFor) {
    setSeededFor(draft?.id ?? null)
    setValues(draft ?? newProjectDraft())
    setError(null)
  }

  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange}>
      <ConfirmDialogContent
        title={draft?.name ? `Edit ${draft.name}` : 'New project'}
        description="Deadlines and status feed the dashboard and analytics."
        confirmLabel="Save project"
        destructive={false}
        onConfirm={() => {
          if (!values.name.trim()) {
            setError('Give the project a name')
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
              placeholder="e.g. Final year project"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={values.description}
              onChange={(event) => setValues({ ...values, description: event.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <Input
                type="date"
                value={values.startDate}
                onChange={(event) => setValues({ ...values, startDate: event.target.value })}
              />
            </Field>
            <Field label="Deadline">
              <Input
                type="date"
                value={values.deadline ?? ''}
                onChange={(event) => setValues({ ...values, deadline: event.target.value || null })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select
                value={values.status}
                onChange={(event) => setValues({ ...values, status: event.target.value as ProjectStatus })}
              >
                {Object.values(PROJECT_STATUS_META).map((meta) => (
                  <option key={meta.value} value={meta.value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
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
          <Field label="Category">
            <Input
              value={values.category}
              onChange={(event) => setValues({ ...values, category: event.target.value })}
              placeholder="College, personal, clientâ€¦"
            />
          </Field>
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
          <Field label="Notes">
            <Textarea
              value={values.notes}
              onChange={(event) => setValues({ ...values, notes: event.target.value })}
            />
          </Field>
          <Field label="Link (optional)" hint="Documentation, repository or brief">
            <Input
              value={values.resources[0]?.url ?? ''}
              onChange={(event) =>
                setValues({
                  ...values,
                  resources: event.target.value
                    ? [{ id: values.resources[0]?.id ?? newId('res'), label: 'Reference', url: event.target.value }]
                    : [],
                })
              }
              placeholder="https://â€¦"
            />
          </Field>
        </div>
      </ConfirmDialogContent>
    </ConfirmDialog>
  )
}

function ProjectTaskDialog({
  task,
  projectId,
  onOpenChange,
  onSave,
}: {
  task: ProjectTask | null
  /** Used when creating a brand new task. */
  projectId: ID | null
  onOpenChange: (open: boolean) => void
  onSave: (task: ProjectTask) => void
}) {
  const { data } = useApp()
  const [values, setValues] = useState<ProjectTask>(() =>
    task ?? newTaskDraft(projectId ?? ''),
  )
  const [error, setError] = useState<string | null>(null)
  const [seededFor, setSeededFor] = useState<string | null>(task?.id ?? null)
  const [newStep, setNewStep] = useState('')

  if (task && task.id !== seededFor) {
    setSeededFor(task.id)
    setValues(task)
    setError(null)
  }

  const projectTasks = data.projectTasks.filter(
    (row) => row.projectId === values.projectId && row.id !== values.id,
  )

  const checklist = checklistProgress(values.checklist)

  return (
    <ConfirmDialog open={task !== null} onOpenChange={onOpenChange}>
      <ConfirmDialogContent
        title={task?.title ? `Edit ${task.title}` : 'New project task'}
        description="Estimates and checklists shape the project's calculated progress."
        confirmLabel="Save task"
        destructive={false}
        onConfirm={() => {
          if (!values.title.trim()) {
            setError('Give the task a title')
            return
          }
          onSave({ ...values, title: values.title.trim(), updatedAt: Date.now() })
        }}
      >
        <div className="space-y-3">
          <Field label="Title" required error={error ?? undefined}>
            <Input
              value={values.title}
              onChange={(event) => setValues({ ...values, title: event.target.value })}
              placeholder="e.g. Draft chapter 2"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={values.description}
              onChange={(event) => setValues({ ...values, description: event.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select
                value={values.status}
                onChange={(event) =>
                  setValues({
                    ...values,
                    status: event.target.value as TaskStatus,
                    completedAt: event.target.value === 'done' ? Date.now() : null,
                  })
                }
              >
                {Object.values(TASK_STATUS_META).map((meta) => (
                  <option key={meta.value} value={meta.value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
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
          <div className="grid grid-cols-3 gap-3">
            <Field label="Estimate (min)">
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
            <Field label="Start">
              <Input
                type="date"
                value={values.startDate ?? ''}
                onChange={(event) => setValues({ ...values, startDate: event.target.value || null })}
              />
            </Field>
            <Field label="Deadline">
              <Input
                type="date"
                value={values.deadline ?? ''}
                onChange={(event) => setValues({ ...values, deadline: event.target.value || null })}
              />
            </Field>
          </div>

          <Field label="Parent task" hint="Turns this into a subtask">
            <Select
              value={values.parentTaskId ?? ''}
              onChange={(event) => setValues({ ...values, parentTaskId: event.target.value || null })}
            >
              <option value="">Top-level task</option>
              {projectTasks
                .filter((row) => row.parentTaskId === null)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title}
                  </option>
                ))}
            </Select>
          </Field>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--fg-muted)]">
              Checklist {checklist.total > 0 ? `Â· ${checklist.percent}% weighted` : ''}
            </p>
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
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={item.weight}
                    onChange={(event) =>
                      setValues({
                        ...values,
                        checklist: values.checklist.map((row) =>
                          row.id === item.id
                            ? { ...row, weight: Math.max(1, Number(event.target.value) || 1) }
                            : row,
                        ),
                      })
                    }
                    className="h-7 w-14"
                    aria-label={`Weight for ${item.label}`}
                    title="Weight used for progress"
                  />
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
                placeholder="Add a checklist step"
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
                Step
              </Button>
            </div>
          </div>

          <Field label="Dependencies" hint="Tasks that should finish first">
            <div className="flex flex-wrap gap-1.5">
              {projectTasks.length === 0 ? (
                <span className="text-[0.68rem] text-[var(--fg-subtle)]">
                  No other tasks in this project
                </span>
              ) : (
                projectTasks.map((row) => {
                  const active = values.dependsOn.includes(row.id)
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() =>
                        setValues({
                          ...values,
                          dependsOn: active
                            ? values.dependsOn.filter((id) => id !== row.id)
                            : [...values.dependsOn, row.id],
                        })
                      }
                      className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold ${
                        active
                          ? 'border-transparent bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                          : 'border-[var(--line-strong)] text-[var(--fg-muted)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {row.title}
                    </button>
                  )
                })
              )}
            </div>
          </Field>

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
