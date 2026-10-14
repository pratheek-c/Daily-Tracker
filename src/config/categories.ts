import {
  BookOpen,
  Briefcase,
  CalendarHeart,
  ClipboardList,
  Coffee,
  Dumbbell,
  GraduationCap,
  MoonStar,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ActivityCategory, Priority, ProjectStatus, TaskStatus } from '@/types'

export interface CategoryMeta {
  value: ActivityCategory
  label: string
  icon: LucideIcon
  /** Tailwind classes for a soft pastel chip. */
  chip: string
  /** Solid-ish dot colour. */
  dot: string
  /** Inline style pair resolved from CSS custom properties. */
  style: { backgroundColor: string; color: string }
}

export const CATEGORY_META: Record<ActivityCategory, CategoryMeta> = {
  study: {
    value: 'study',
    label: 'Study',
    icon: BookOpen,
    chip: 'bg-[var(--c-study)] text-[var(--c-study-ink)] border-transparent',
    dot: 'bg-[var(--c-study-ink)]',
    style: { backgroundColor: 'var(--c-study)', color: 'var(--c-study-ink)' },
  },
  project: {
    value: 'project',
    label: 'Project',
    icon: Briefcase,
    chip: 'bg-[var(--c-project)] text-[var(--c-project-ink)] border-transparent',
    dot: 'bg-[var(--c-project-ink)]',
    style: { backgroundColor: 'var(--c-project)', color: 'var(--c-project-ink)' },
  },
  college: {
    value: 'college',
    label: 'College',
    icon: GraduationCap,
    chip: 'bg-[var(--c-college)] text-[var(--c-college-ink)] border-transparent',
    dot: 'bg-[var(--c-college-ink)]',
    style: { backgroundColor: 'var(--c-college)', color: 'var(--c-college-ink)' },
  },
  assignment: {
    value: 'assignment',
    label: 'Assignment',
    icon: ClipboardList,
    chip: 'bg-[var(--c-assignment)] text-[var(--c-assignment-ink)] border-transparent',
    dot: 'bg-[var(--c-assignment-ink)]',
    style: { backgroundColor: 'var(--c-assignment)', color: 'var(--c-assignment-ink)' },
  },
  sleep: {
    value: 'sleep',
    label: 'Sleep',
    icon: MoonStar,
    chip: 'bg-[var(--c-sleep)] text-[var(--c-sleep-ink)] border-transparent',
    dot: 'bg-[var(--c-sleep-ink)]',
    style: { backgroundColor: 'var(--c-sleep)', color: 'var(--c-sleep-ink)' },
  },
  meal: {
    value: 'meal',
    label: 'Meals',
    icon: UtensilsCrossed,
    chip: 'bg-[var(--c-meal)] text-[var(--c-meal-ink)] border-transparent',
    dot: 'bg-[var(--c-meal-ink)]',
    style: { backgroundColor: 'var(--c-meal)', color: 'var(--c-meal-ink)' },
  },
  exercise: {
    value: 'exercise',
    label: 'Exercise',
    icon: Dumbbell,
    chip: 'bg-[var(--c-exercise)] text-[var(--c-exercise-ink)] border-transparent',
    dot: 'bg-[var(--c-exercise-ink)]',
    style: { backgroundColor: 'var(--c-exercise)', color: 'var(--c-exercise-ink)' },
  },
  break: {
    value: 'break',
    label: 'Break',
    icon: Coffee,
    chip: 'bg-[var(--c-break)] text-[var(--c-break-ink)] border-transparent',
    dot: 'bg-[var(--c-break-ink)]',
    style: { backgroundColor: 'var(--c-break)', color: 'var(--c-break-ink)' },
  },
  personal: {
    value: 'personal',
    label: 'Personal',
    icon: CalendarHeart,
    chip: 'bg-[var(--c-personal)] text-[var(--c-personal-ink)] border-transparent',
    dot: 'bg-[var(--c-personal-ink)]',
    style: { backgroundColor: 'var(--c-personal)', color: 'var(--c-personal-ink)' },
  },
  other: {
    value: 'other',
    label: 'Other',
    icon: Sparkles,
    chip: 'bg-[var(--c-other)] text-[var(--c-other-ink)] border-transparent',
    dot: 'bg-[var(--c-other-ink)]',
    style: { backgroundColor: 'var(--c-other)', color: 'var(--c-other-ink)' },
  },
}

/** Categories that should never receive auto-scheduled work. */
export const RESTFUL_CATEGORIES: ActivityCategory[] = ['sleep', 'break', 'meal']

export const CATEGORY_OPTIONS = Object.values(CATEGORY_META).map((meta) => ({
  value: meta.value,
  label: meta.label,
}))

export interface PriorityMeta {
  value: Priority
  label: string
  chip: string
  dot: string
  rank: number
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  low: {
    value: 'low',
    label: 'Low',
    chip: 'bg-[var(--color-mint)] text-[var(--color-mint-deep)] border-transparent',
    dot: 'bg-[var(--color-success)]',
    rank: 0,
  },
  medium: {
    value: 'medium',
    label: 'Medium',
    chip: 'bg-[var(--color-babyblue)] text-[var(--color-sky-deep)] border-transparent',
    dot: 'bg-[var(--color-sky-deep)]',
    rank: 1,
  },
  high: {
    value: 'high',
    label: 'High',
    chip: 'bg-[var(--color-peach)] text-[var(--color-peach-deep)] border-transparent',
    dot: 'bg-[var(--color-peach-deep)]',
    rank: 2,
  },
  urgent: {
    value: 'urgent',
    label: 'Urgent',
    chip: 'bg-[var(--color-blush)] text-[var(--color-rose-deep)] border-transparent',
    dot: 'bg-[var(--color-rose-deep)]',
    rank: 3,
  },
}

export const PRIORITY_OPTIONS = Object.values(PRIORITY_META).map((meta) => ({
  value: meta.value,
  label: meta.label,
}))

export interface StatusMeta {
  value: string
  label: string
  chip: string
}

export const TASK_STATUS_META: Record<TaskStatus, StatusMeta> = {
  todo: {
    value: 'todo',
    label: 'To do',
    chip: 'bg-[var(--surface-3)] text-[var(--fg-muted)] border-transparent',
  },
  'in-progress': {
    value: 'in-progress',
    label: 'In progress',
    chip: 'bg-[var(--color-babyblue)] text-[var(--color-sky-deep)] border-transparent',
  },
  blocked: {
    value: 'blocked',
    label: 'Blocked',
    chip: 'bg-[var(--color-peach)] text-[var(--color-peach-deep)] border-transparent',
  },
  done: {
    value: 'done',
    label: 'Done',
    chip: 'bg-[var(--color-mint)] text-[var(--color-mint-deep)] border-transparent',
  },
}

export const TASK_STATUS_OPTIONS = Object.values(TASK_STATUS_META).map((meta) => ({
  value: meta.value,
  label: meta.label,
}))

export const PROJECT_STATUS_META: Record<ProjectStatus, StatusMeta> = {
  planning: {
    value: 'planning',
    label: 'Planning',
    chip: 'bg-[var(--color-lavender)] text-[var(--color-lavender-deep)] border-transparent',
  },
  active: {
    value: 'active',
    label: 'Active',
    chip: 'bg-[var(--color-babyblue)] text-[var(--color-sky-deep)] border-transparent',
  },
  paused: {
    value: 'paused',
    label: 'Paused',
    chip: 'bg-[var(--color-peach)] text-[var(--color-peach-deep)] border-transparent',
  },
  completed: {
    value: 'completed',
    label: 'Completed',
    chip: 'bg-[var(--color-mint)] text-[var(--color-mint-deep)] border-transparent',
  },
  archived: {
    value: 'archived',
    label: 'Archived',
    chip: 'bg-[var(--surface-3)] text-[var(--fg-muted)] border-transparent',
  },
}

export const PROJECT_STATUS_OPTIONS = Object.values(PROJECT_STATUS_META).map((meta) => ({
  value: meta.value,
  label: meta.label,
}))

export const ACTIVITY_STATUS_META: Record<string, StatusMeta> = {
  planned: {
    value: 'planned',
    label: 'Planned',
    chip: 'bg-[var(--surface-3)] text-[var(--fg-muted)] border-transparent',
  },
  'in-progress': {
    value: 'in-progress',
    label: 'In progress',
    chip: 'bg-[var(--color-babyblue)] text-[var(--color-sky-deep)] border-transparent',
  },
  completed: {
    value: 'completed',
    label: 'Completed',
    chip: 'bg-[var(--color-mint)] text-[var(--color-mint-deep)] border-transparent',
  },
  missed: {
    value: 'missed',
    label: 'Missed',
    chip: 'bg-[var(--color-peach)] text-[var(--color-peach-deep)] border-transparent',
  },
  cancelled: {
    value: 'cancelled',
    label: 'Cancelled',
    chip: 'bg-[var(--surface-3)] text-[var(--fg-subtle)] border-transparent line-through',
  },
}

export const TASK_KIND_META: Record<string, { label: string; chip: string }> = {
  task: { label: 'Task', chip: 'bg-[var(--color-babyblue)] text-[var(--color-sky-deep)]' },
  assignment: {
    label: 'Assignment',
    chip: 'bg-[var(--color-blush)] text-[var(--color-rose-deep)]',
  },
  exam: { label: 'Exam', chip: 'bg-[var(--color-peach)] text-[var(--color-peach-deep)]' },
  'project-task': {
    label: 'Project task',
    chip: 'bg-[var(--color-lavender)] text-[var(--color-lavender-deep)]',
  },
  personal: { label: 'Personal', chip: 'bg-[var(--color-mint)] text-[var(--color-mint-deep)]' },
}

/** Pastel swatches offered in colour pickers. */
export const COLOR_SWATCHES = [
  '#F2A7C3',
  '#F8C8DC',
  '#E8DDF8',
  '#C9B6F0',
  '#DDEFFC',
  '#A8CDEE',
  '#DDF3E4',
  '#8FCBA8',
  '#FFE4D6',
  '#F5BE94',
  '#FDF0D8',
  '#E9BD75',
  '#D6F0EA',
  '#80B99A',
  '#C7C9D9',
  '#89818F',
] as const

export const ACCENT_META = {
  rose: {
    label: 'Blush rose',
    accent: '#F2A7C3',
    accentInk: '#B95F86',
    accentSoft: '#FDEEF4',
  },
  lavender: {
    label: 'Pastel lavender',
    accent: '#C9B6F0',
    accentInk: '#7561A8',
    accentSoft: '#F4EFFD',
  },
  sky: {
    label: 'Baby blue',
    accent: '#A8CDEE',
    accentInk: '#41729A',
    accentSoft: '#EFF7FD',
  },
  mint: {
    label: 'Mint',
    accent: '#8FCBA8',
    accentInk: '#3F7A5C',
    accentSoft: '#EFF9F3',
  },
  peach: {
    label: 'Peach',
    accent: '#F5BE94',
    accentInk: '#A9663A',
    accentSoft: '#FEF3EC',
  },
} as const

export type AccentName = keyof typeof ACCENT_META
