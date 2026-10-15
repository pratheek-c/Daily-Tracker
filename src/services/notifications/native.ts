import { LocalNotifications } from '@capacitor/local-notifications'
import type { NotificationJob } from '@/types'
import { isNativeNotifications, type NotificationPermissionState } from './permission'

/**
 * Native reminder delivery through Capacitor's Local Notifications plugin.
 *
 * The browser can only fire a reminder while a tab is open. On Android these are
 * handed to the OS as *scheduled* local notifications, so study, habit, bedtime
 * and wake-up nudges arrive even when the app is closed — which is the gap the
 * README has always been honest about for the web build.
 *
 * The same `NotificationJob` records feed both paths, so nothing about the
 * scheduling engine changes; only delivery does.
 */

/** Android requires a named channel for anything posted on Android 8+. */
const CHANNEL_ID = 'adt-reminders'

/**
 * How many reminders are kept scheduled with the OS at once.
 *
 * Android tolerates many pending alarms and iOS caps around 64; 60 keeps the
 * soonest reminders on both without ever hitting that ceiling. Reopening the app
 * (or editing anything) re-syncs, so later reminders slide into the window.
 */
const MAX_SCHEDULED = 60

export function nativeChannelId(): string {
  return CHANNEL_ID
}

/** Turn a string job id into the 32-bit int the plugin (and Android) expects. */
export function nativeIdFor(jobId: string): number {
  let hash = 2166136261
  for (let index = 0; index < jobId.length; index += 1) {
    hash ^= jobId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const positive = Math.abs(hash | 0)
  return positive === 0 ? 1 : positive
}

function toNative(job: NotificationJob) {
  return {
    id: nativeIdFor(job.id),
    title: job.title,
    body: job.body,
    channelId: CHANNEL_ID,
    smallIcon: 'ic_stat_reminder',
    iconColor: '#F2A7C3',
    // Inexact on purpose. The plugin defaults to exact, which opens the system
    // “Alarms & reminders” screen on every schedule() until the user grants it —
    // a nag on each edit. Inexact alarms still deliver (within a few minutes),
    // and `allowWhileIdle` lets them fire through Doze.
    isExactNotification: false,
    allowWhileIdle: true,
    schedule: { at: new Date(job.fireAt) },
    extra: {
      dedupeKey: job.dedupeKey,
      category: job.category,
      refType: job.refType,
      refId: job.refId,
    },
  }
}

export async function ensureNativeChannel(): Promise<void> {
  if (!isNativeNotifications()) return
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Reminders',
      description: 'Study, habit, bedtime and wake-up nudges',
      importance: 4,
      visibility: 1,
    })
  } catch {
    // Channels do not exist on every platform; a failure here is not fatal.
  }
}

/**
 * Make the OS's pending reminders match `jobs` exactly.
 *
 * Diffing by id rather than cancel-all-then-schedule means a reminder that is
 * due in a few seconds is never briefly unregistered during a data change.
 */
export async function syncNativeReminders(
  jobs: NotificationJob[],
  permission: NotificationPermissionState,
): Promise<number> {
  if (!isNativeNotifications()) return 0

  if (permission !== 'granted') {
    await cancelAllNativeReminders()
    return 0
  }

  await ensureNativeChannel()

  const wanted = jobs
    .filter((job) => job.fireAt > Date.now() + 2_000)
    .sort((a, b) => a.fireAt - b.fireAt)
    .slice(0, MAX_SCHEDULED)
    .map(toNative)

  const wantedIds = new Set(wanted.map((notification) => notification.id))

  try {
    const pending = await LocalNotifications.getPending()
    const stale = pending.notifications
      .filter((notification) => !wantedIds.has(notification.id))
      .map((notification) => ({ id: notification.id }))
    if (stale.length > 0) await LocalNotifications.cancel({ notifications: stale })
    if (wanted.length > 0) await LocalNotifications.schedule({ notifications: wanted })
  } catch {
    return 0
  }

  return wanted.length
}

/** Show a notification immediately (used by “send a test”). */
export async function showNativeNotification(job: NotificationJob): Promise<void> {
  await ensureNativeChannel()
  await LocalNotifications.schedule({
    notifications: [{ ...toNative(job), schedule: { at: new Date(Date.now() + 250) } }],
  })
}

export async function cancelAllNativeReminders(): Promise<void> {
  if (!isNativeNotifications()) return
  try {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length === 0) return
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((notification) => ({ id: notification.id })),
    })
  } catch {
    // Best effort: a stale alarm is harmless, a thrown error would not be.
  }
}

export interface NativeNotificationTap {
  refType?: string
  refId?: string | null
  category?: string
}

/**
 * Route a tap on a reminder to the relevant screen.
 *
 * Returns an unsubscribe function. On the web (or if the plugin is unavailable)
 * this is a no-op, so callers do not need to branch.
 */
export function addNativeNotificationTapListener(
  handler: (tap: NativeNotificationTap) => void,
): () => void {
  if (!isNativeNotifications()) return () => undefined

  let handle: { remove: () => Promise<void> } | null = null
  let removed = false

  void LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    handler((action.notification.extra ?? {}) as NativeNotificationTap)
  }).then((listener) => {
    if (removed) void listener.remove()
    else handle = listener
  })

  return () => {
    removed = true
    if (handle) void handle.remove()
  }
}
