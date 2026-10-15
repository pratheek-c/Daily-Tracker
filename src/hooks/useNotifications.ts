import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useApp } from '@/app/AppContext'
import {
  flushDueNotifications,
  pruneOrphanJobs,
  rescheduleAllReminders,
} from '@/services/notifications/notifier'
import {
  buildSleepReminderJobs,
} from '@/services/notifications/reminders'
import {
  getNotificationPermission,
  refreshNotificationPermission,
  subscribeNotificationPermission,
} from '@/services/notifications/permission'
import { syncNativeReminders } from '@/services/notifications/native'
import { plannedNights } from '@/services/scheduling/sleep-events'
import { createDefaultSleepSchedule } from '@/config/defaults'
import { getStorage } from '@/services/persistence'
import { addDaysToKey, todayKey } from '@/lib/date'
import type { NotificationJob } from '@/types'

/**
 * Rebuilds and delivers reminders.
 *
 * Everything happens in the browser while the app is open, which is the honest
 * capability boundary documented in the README: there is no server, so a
 * closed browser cannot be woken at an exact minute.
 */
/**
 * The current notification permission, kept in sync across the browser and the
 * native app. The native lookup is asynchronous, so this subscribes to a small
 * store that is refreshed on mount.
 */
export function useNotificationPermission() {
  const permission = useSyncExternalStore(
    subscribeNotificationPermission,
    getNotificationPermission,
    getNotificationPermission,
  )
  useEffect(() => {
    void refreshNotificationPermission()
  }, [])
  return permission
}

export function useNotificationScheduler(options: { enabled?: boolean } = {}) {
  const { data, revision, ready } = useApp()
  // Resolving permission is asynchronous on native, so scheduling re-runs once
  // it changes; otherwise the first schedule could be skipped while the state
  // is still "unknown".
  const permission = useNotificationPermission()
  const [pending, setPending] = useState(0)
  const [delivered, setDelivered] = useState(0)
  const [lastRun, setLastRun] = useState<number | null>(null)
  const rescheduling = useRef(false)
  const enabled = options.enabled ?? true

  const reschedule = useCallback(async () => {
    if (rescheduling.current || !enabled) return
    rescheduling.current = true
    try {
      await pruneOrphanJobs(data)
      await rescheduleAllReminders(data)

      // Sleep reminders come from the schedule rather than stored events, so
      // they are generated here rather than in `rescheduleAllReminders`.
      const storage = getStorage()
      const schedule = data.sleepSchedule ?? createDefaultSleepSchedule()
      const now = Date.now()
      const from = todayKey()
      const wanted: NotificationJob[] = []
      for (const night of plannedNights(schedule, from, addDaysToKey(from, 7), data.sleepExceptions)) {
        if (!night.enabled) continue
        for (const job of buildSleepReminderJobs(
          {
            date: night.date,
            bedtime: night.bedtime,
            wakeTime: night.wakeTime,
            bedtimeMillis: night.bedtimeMillis,
            wakeMillis: night.wakeMillis,
            windDownStart: night.windDownStart,
          },
          schedule,
          now,
        )) {
          if (job.fireAt < now - 5 * 60_000) continue
          const categoryEnabled = data.settings?.enabledNotificationCategories?.[job.category] ?? true
          if (!categoryEnabled) continue
          wanted.push(job)
        }
      }
      // Replace any previously generated sleep jobs with the current set.
      const existingSleepJobs = (await storage.listNotificationJobs()).filter((job) =>
        job.sourceKey.startsWith('sleep:'),
      )
      await storage.deleteNotificationJobs(existingSleepJobs.map((job) => job.id))
      await storage.putNotificationJobs(wanted)

      // Hand the full set to the OS as well, so the native app can deliver them
      // while it is closed. This is a no-op on the web.
      const allJobs = await storage.listNotificationJobs()
      await syncNativeReminders(allJobs, permission)

      setPending(allJobs.length)
      setLastRun(Date.now())
    } finally {
      rescheduling.current = false
    }
  }, [data, enabled, permission])

  // Rebuild whenever underlying records change.
  useEffect(() => {
    if (!ready) return
    void reschedule()
  }, [ready, revision, reschedule])

  // Deliver anything that has come due, on a short interval and on resume.
  useEffect(() => {
    if (!ready || !enabled) return
    let cancelled = false

    const tick = async () => {
      const fired = await flushDueNotifications()
      if (!cancelled && fired > 0) {
        setDelivered((value) => value + fired)
        setPending((await getStorage().listNotificationJobs()).length)
      }
    }

    void tick()
    const handle = window.setInterval(tick, 20_000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void tick()
        void reschedule()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      cancelled = true
      window.clearInterval(handle)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [ready, enabled, reschedule])

  return { pending, delivered, lastRun, reschedule }
}
