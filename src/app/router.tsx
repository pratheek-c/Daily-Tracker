import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/app/AppShell'
import { Mascot } from '@/components/mascots/Mascot'

/**
 * Every page is code-split so the first paint only pays for the dashboard.
 * Charts, the Kanban board and the sleep-cycle tool land on demand.
 */
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const PlannerPage = lazy(() => import('@/pages/PlannerPage'))
const TimetablePage = lazy(() => import('@/pages/TimetablePage'))
const CalendarPage = lazy(() => import('@/pages/CalendarPage'))
const StudyPage = lazy(() => import('@/pages/StudyPage'))
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'))
const TasksPage = lazy(() => import('@/pages/TasksPage'))
const HabitsPage = lazy(() => import('@/pages/HabitsPage'))
const SleepPage = lazy(() => import('@/pages/SleepPage'))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function PageFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex flex-col items-center gap-2">
        <Mascot kind="bunny" className="size-20 animate-float" />
        <p className="text-xs text-[var(--fg-muted)]">Fetching this page…</p>
      </div>
    </div>
  )
}

function page(element: React.ReactNode) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: page(<DashboardPage />) },
      { path: 'planner', element: page(<PlannerPage />) },
      { path: 'timetable', element: page(<TimetablePage />) },
      { path: 'calendar', element: page(<CalendarPage />) },
      { path: 'study', element: page(<StudyPage />) },
      { path: 'projects', element: page(<ProjectsPage />) },
      { path: 'tasks', element: page(<TasksPage />) },
      { path: 'habits', element: page(<HabitsPage />) },
      { path: 'sleep', element: page(<SleepPage />) },
      { path: 'analytics', element: page(<AnalyticsPage />) },
      { path: 'settings', element: page(<SettingsPage />) },
      { path: 'dashboard', element: <Navigate to="/" replace /> },
      { path: '*', element: page(<NotFoundPage />) },
    ],
  },
])
