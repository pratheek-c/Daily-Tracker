import { getStorage } from '@/services/persistence'
import { addDaysToKey, todayKey, weekdayOf } from '@/lib/date'
import { buildOccurrences, type Occurrence } from '@/services/scheduling/recurrence'
import { newId } from '@/lib/utils'
import { buildEventReminderJobs, buildHabitReminderJob, buildTaskReminderJob } from './reminders'
import {
  getNotificationPermission,
  isNativeNotifications,
  requestNotificationPermission as requestPermission,
  type NotificationPermissionState,
} from './permission'
import { showNativeNotification } from './native'
import type { TrackerData } from '@/hooks/useTrackerData'
import type { NotificationCategory, NotificationJob, ScheduledEvent } from '@/types'

/** Where a delivered reminder actually reached the user. */
export type DeliveryChannel = 'browser' | 'native' | 'in-app'

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  study: 'Study sessions',
  project: 'Project work',
  assignment: 'Assignments & exams',
  activity: 'Daily activities',
  habit: 'Habits',
  winddown: 'Wind-down routine',
  bedtime: 'Bedtime',
  wakeup: 'Wake-up',
  pomodoro: 'Focus timer',
}

export function notificationsSupported(): boolean {
  return isNativeNotifications() || (typeof window !== 'undefined' && 'Notification' in window)
}

export function notificationPermission(): NotificationPermissionState {
  return getNotificationPermission()
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  return requestPermission()
}

/** Deliver one notification, degrading to an in-app entry when blocked. */
export async function showNotification(job: NotificationJob): Promise<DeliveryChannel> {
  if (isNativeNotifications()) {
    if (getNotificationPermission() !== 'granted') return 'in-app'
    try {
      await showNativeNotification(job)
      return 'native'
    } catch {
      return 'in-app'
    }
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') return 'in-app'
  try {
    const notification = new Notification(job.title, {
      body: job.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Reusing the dedupe key as the tag means a duplicate replaces the
      // existing notification instead of stacking a second one.
      tag: job.dedupeKey,
      requireInteraction: false,
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    return 'browser'
  } catch {
    return 'in-app'
  }
}

/* -------------------------------------------------------------------------- */
/* Job materialisation                                                        */
/* -------------------------------------------------------------------------- */

const HORIZON_DAYS = 14

/**
 * Rebuild the reminder job table from current records.
 *
 * Jobs are derived, not authored: removing every pending job and regenerating
 * from live data means editing an event, changing a habit time or moving a
 * deadline can never leave a stale or duplicated reminder behind.
 */
export async function rescheduleAllReminders(data: TrackerData): Promise<number> {
  const storage = getStorage()
  const now = Date.now()
  const from = todayKey()
  const to = addDaysToKey(from, HORIZON_DAYS)

  const pending = await storage.listNotificationJobs()
  const deliveredKeys = new Set(
    (await storage.listNotificationLog()).map((entry) => entry.dedupeKey),
  )

  const enabled = data.settings?.enabledNotificationCategories
  const allowed = (category: NotificationCategory) => enabled?.[category] ?? true

  const jobs: NotificationJob[] = []

  for (const event of data.events) {
    if (!event.reminders.enabled) continue
    if (event.status === 'completed' || event.status === 'cancelled') continue
    const occurrences = expandForReminders(event, from, to)
    for (const occurrence of occurrences) {
      for (const job of buildEventReminderJobs(occurrence, { now })) {
        if (!allowed(job.category)) continue
        if (job.fireAt < now - 5 * 60_000) continue
        jobs.push(job)
      }
    }
  }

  for (const habit of data.habits) {
    if (habit.archived || !habit.reminderEnabled || !habit.reminderTime) continue
    if (!allowed('habit')) continue
    for (let offset = 0; offset <= 7; offset += 1) {
      const date = addDaysToKey(from, offset)
      if (habit.schedule === 'weekly' && !habit.days.includes(weekdayOf(date))) continue
      const already = data.habitEntries.find(
        (entry) => entry.habitId === habit.id && entry.date === date && entry.completed,
      )
      if (already) continue
      const job = buildHabitReminderJob({
        habitId: habit.id,
        name: habit.name,
        date,
        reminderTime: habit.reminderTime,
        now,
      })
      if (job.fireAt >= now) jobs.push(job)
    }
  }

  for (const task of data.tasks) {
    if (!task.dueDate || !task.dueTime || task.status === 'done') continue
    if (task.dueDate < from || task.dueDate > to) continue
    const category: NotificationCategory =
      task.kind === 'assignment' ? 'assignment' : task.kind === 'project-task' ? 'project' : 'activity'
    if (!allowed(category)) continue
    const job = buildTaskReminderJob({
      taskId: task.id,
      title: task.title,
      kind: task.kind,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      now,
    })
    if (job.fireAt >= now - 60_000) jobs.push(job)
  }

  // Deduplicate within the freshly generated set, then against delivery history.
  const byKey = new Map<string, NotificationJob>()
  for (const job of jobs) {
    if (deliveredKeys.has(job.dedupeKey)) continue
    const existing = byKey.get(job.dedupeKey)
    if (!existing || existing.fireAt > job.fireAt) byKey.set(job.dedupeKey, job)
  }

  const next = Array.from(byKey.values())
  await storage.deleteNotificationJobs(pending.map((job) => job.id))
  await storage.putNotificationJobs(next)
  return next.length
}

function expandForReminders(event: ScheduledEvent, from: string, to: string): Occurrence[] {
  return buildOccurrences([event], from, to, [])
}

/* -------------------------------------------------------------------------- */
/* Delivery                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Fire every job whose time has arrived.
 *
 * `dedupeKey` is the guard: a key already present in the delivery history is
 * skipped and its job removed, so reloading the page, opening a second tab or
 * resuming from sleep cannot produce a duplicate notification.
 */
export async function flushDueNotifications(): Promise<number> {
  const storage = getStorage()
  const now = Date.now()
  const due = await storage.listNotificationJobs({ dueBefore: now })
  if (due.length === 0) return 0

  const history = await storage.listNotificationLog()
  const delivered = new Set(history.map((entry) => entry.dedupeKey))
  let count = 0

  for (const job of due) {
    if (delivered.has(job.dedupeKey)) {
      await storage.deleteNotificationJob(job.id)
      continue
    }
    // On native the OS already delivered this from the pre-scheduled local
    // notification, so the flush only records it in the in-app history.
    const channel: DeliveryChannel = isNativeNotifications()
      ? getNotificationPermission() === 'granted'
        ? 'native'
        : 'in-app'
      : await showNotification(job)
    const deliveredAt = Date.now()
    await storage.putNotificationLog({
      id: newId('notiflog'),
      dedupeKey: job.dedupeKey,
      title: job.title,
      body: job.body,
      category: job.category,
      fireAt: job.fireAt,
      deliveredAt,
      channel,
      read: false,
    })
    delivered.add(job.dedupeKey)
    await storage.deleteNotificationJob(job.id)
    count += 1
  }
  return count
}

/** Remove queued jobs belonging to records that no longer exist. */
export async function pruneOrphanJobs(data: TrackerData): Promise<number> {
  const storage = getStorage()
  const jobs = await storage.listNotificationJobs()
  const eventIds = new Set(data.events.map((event) => event.id))
  const seriesIds = new Set(data.events.map((event) => event.seriesId).filter(Boolean) as string[])
  const taskIds = new Set(data.tasks.map((task) => task.id))
  const habitIds = new Set(data.habits.map((habit) => habit.id))

  const stale = jobs.filter((job) => {
    if (job.refType === 'event') return !eventIds.has(job.refId ?? '') && !seriesIds.has(job.refId ?? '')
    if (job.refType === 'task') return !taskIds.has(job.refId ?? '')
    if (job.refType === 'habit') return !habitIds.has(job.refId ?? '')
    return false
  })
  await storage.deleteNotificationJobs(stale.map((job) => job.id))
  return stale.length
}

export async function sendTestNotification(): Promise<DeliveryChannel | 'unsupported'> {
  const permission = notificationPermission()
  if (permission === 'unsupported') return 'unsupported'
  const job: NotificationJob = {
    id: 'test-notification',
    dedupeKey: `test:${Date.now()}`,
    fireAt: Date.now(),
    title: 'Test reminder',
    body: 'Reminders are wired up. This is what a study or bedtime nudge looks like.',
    category: 'activity',
    refType: 'system',
    refId: null,
    sourceKey: 'system:test',
    createdAt: Date.now(),
  }
  if (permission !== 'granted') {
    const result = await requestNotificationPermission()
    if (result !== 'granted') return 'in-app'
  }
  return showNotification(job)
}

export function notificationChannelNotice(): string {
  const permission = notificationPermission()

  if (isNativeNotifications()) {
    if (permission === 'unsupported') {
      return 'This device could not open a notification channel, so reminders appear in the in-app notification centre only.'
    }
    if (permission === 'denied') {
      return 'Notifications are blocked for this app. Enable them in Android Settings → Apps → Anusree’s Daily Tracker → Notifications. Reminders still appear in the in-app notification centre.'
    }
    if (permission === 'default') {
      return 'Allow notifications to get study, bedtime and wake-up nudges — they are scheduled on the device and arrive even when the app is closed.'
    }
    return 'Notifications are allowed. Reminders are scheduled with the device, so they arrive even when the app is closed.'
  }

  if (permission === 'unsupported') {
    return 'This browser has no Notification API, so reminders appear in the in-app notification centre only.'
  }
  if (permission === 'denied') {
    return 'Notifications are blocked for this site. Reminders will still appear in the in-app notification centre — enable them in your browser settings to get pop-ups.'
  }
  if (permission === 'default') {
    return 'Allow notifications to get study, bedtime and wake-up pop-ups. They are scheduled while the app is open.'
  }
  return 'Notifications are allowed. Reminders fire while the app is open in a tab; see the README for the closed-browser limitation.'
}

/** Copy shown right after permission is granted, which differs per platform. */
export function notificationAllowedNotice(): string {
  return isNativeNotifications()
    ? 'Notifications allowed. Reminders are scheduled on the device and arrive even when the app is closed.'
    : 'Notifications allowed. Reminders pop up while the app is open.'
}

export function notificationLimitation(): string {
  if (isNativeNotifications()) {
    return 'On Android your reminders are scheduled with the operating system, so they fire even when the app is closed. The soonest 60 are kept scheduled at a time; opening the app refreshes the list, so every reminder still arrives.'
  }
  return 'Reminders are scheduled in the browser while this app is open. Neither browser timers nor a service worker can wake a closed browser at an exact minute, so a guaranteed alarm would need the optional server-side Web Push setup described in the README. This app is a planner, not a medical device or an alarm clock.'
}
