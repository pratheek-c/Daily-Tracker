import {
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  MoonStar,
  Repeat,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Shown in the mobile bottom bar (only five fit comfortably). */
  primary?: boolean
  description: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Today',
    items: [
      {
        to: '/',
        label: 'Dashboard',
        icon: LayoutDashboard,
        primary: true,
        description: 'Your day at a glance',
      },
      {
        to: '/planner',
        label: 'Daily Planner',
        icon: ClipboardList,
        primary: true,
        description: 'Activities and actual time',
      },
      {
        to: '/timetable',
        label: 'My Timetable',
        icon: Repeat,
        primary: true,
        description: 'Weekly routine blocks',
      },
      {
        to: '/calendar',
        label: 'Calendar',
        icon: CalendarRange,
        description: 'Day, week, month and agenda',
      },
    ],
  },
  {
    title: 'Learn',
    items: [
      {
        to: '/study',
        label: 'Study Tracker',
        icon: BookOpenCheck,
        primary: true,
        description: 'Subjects, sessions and Pomodoro',
      },
      {
        to: '/projects',
        label: 'Project Tracker',
        icon: FolderKanban,
        description: 'Projects, tasks and boards',
      },
      {
        to: '/tasks',
        label: 'Tasks & Assignments',
        icon: CalendarDays,
        primary: true,
        description: 'Everything with a deadline',
      },
    ],
  },
  {
    title: 'Wellbeing',
    items: [
      {
        to: '/habits',
        label: 'Habits',
        icon: Sparkles,
        description: 'Streaks and consistency',
      },
      {
        to: '/sleep',
        label: 'Sleep Tracker',
        icon: MoonStar,
        description: 'Schedule, sessions and cycles',
      },
    ],
  },
  {
    title: 'Review',
    items: [
      {
        to: '/analytics',
        label: 'Analytics',
        icon: BarChart3,
        description: 'Study, projects and sleep trends',
      },
      {
        to: '/settings',
        label: 'Settings',
        icon: SettingsIcon,
        description: 'Profile, goals and data',
      },
    ],
  },
]

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items)
export const PRIMARY_NAV_ITEMS = ALL_NAV_ITEMS.filter((item) => item.primary)

export function navItemForPath(pathname: string): NavItem | undefined {
  if (pathname === '/') return ALL_NAV_ITEMS[0]
  return (
    ALL_NAV_ITEMS.filter((item) => item.to !== '/' && pathname.startsWith(item.to)).sort(
      (a, b) => b.to.length - a.to.length,
    )[0] ?? undefined
  )
}

export const MOTIVATIONS = [
  'Small steps still move you forward.',
  'Rest is part of the plan, not a reward for it.',
  'One page, one problem, one pomodoro at a time.',
  'Consistency beats intensity. Every single time.',
  'You are allowed to work slowly and still finish.',
  'Future you is cheering from the other side of this to-do list.',
]
