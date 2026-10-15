import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

/**
 * One permission state that spans the browser and the native app.
 *
 * The browser's `Notification.permission` is synchronous; Capacitor's
 * `LocalNotifications.checkPermissions()` is not. React still needs a value
 * during render, so the native result is cached here and published to
 * subscribers — `useNotificationPermission` reads it through
 * `useSyncExternalStore` and refreshes it once on mount.
 */

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

export function isNativeNotifications(): boolean {
  return Capacitor.isNativePlatform()
}

let cached: NotificationPermissionState = 'default'
const listeners = new Set<() => void>()

function publish(next: NotificationPermissionState): void {
  if (next === cached) return
  cached = next
  for (const listener of listeners) listener()
}

function fromNativeDisplay(display: string): NotificationPermissionState {
  if (display === 'granted') return 'granted'
  if (display === 'denied') return 'denied'
  return 'default'
}

/** The permission as of the last refresh (or the live, synchronous web value). */
export function getNotificationPermission(): NotificationPermissionState {
  if (isNativeNotifications()) return cached
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission as NotificationPermissionState
}

export function subscribeNotificationPermission(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Ask the OS/browser for permission, then cache and return the result. */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (isNativeNotifications()) {
    try {
      const { display } = await LocalNotifications.requestPermissions()
      publish(fromNativeDisplay(display))
    } catch {
      publish('denied')
    }
    return getNotificationPermission()
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  try {
    publish((await Notification.requestPermission()) as NotificationPermissionState)
  } catch {
    publish('denied')
  }
  return getNotificationPermission()
}

/** Re-read the current permission without prompting. */
export async function refreshNotificationPermission(): Promise<NotificationPermissionState> {
  if (isNativeNotifications()) {
    try {
      const { display } = await LocalNotifications.checkPermissions()
      publish(fromNativeDisplay(display))
    } catch {
      publish('unsupported')
    }
  }
  return getNotificationPermission()
}
