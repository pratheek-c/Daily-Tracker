import { registerSW } from 'virtual:pwa-register'

/**
 * Service worker registration.
 *
 * `registerType: 'prompt'` means a new build never takes over mid-session; the
 * user is asked instead, which matters for a planner that may be open all day.
 */
export function registerServiceWorker(onNeedRefresh: (reload: () => void) => void) {
  if (!('serviceWorker' in navigator)) return () => undefined
  try {
    const update = registerSW({
      onNeedRefresh() {
        onNeedRefresh(() => {
          void update(true)
        })
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return
        // Cheap safety net: check for a new build when the tab regains focus.
        window.setInterval(() => void registration.update(), 60 * 60 * 1000)
      },
    })
    return () => undefined
  } catch {
    return () => undefined
  }
}
