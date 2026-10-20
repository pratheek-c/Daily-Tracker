import { Capacitor } from '@capacitor/core'

/**
 * A stack of "consume the Android hardware back button" handlers.
 *
 * On Android the system back button is expected to dismiss the topmost
 * transient thing on screen — a dialog, a menu — before it navigates. Radix
 * listens for `Escape`, not for the hardware button, so without this a back
 * press would navigate the app *behind* an open dialog, which reads as the app
 * ignoring the user.
 *
 * The stack is last-in-first-out: the most recently opened overlay gets the
 * press. It is a plain module so any component can register, and it is a no-op
 * on the web where the browser already has a back button and `Escape` works.
 */

type BackHandler = () => boolean | void

const handlers: BackHandler[] = []

/** Register a handler; the returned function unregisters it. */
export function pushBackHandler(handler: BackHandler): () => void {
  handlers.push(handler)
  return () => {
    const index = handlers.lastIndexOf(handler)
    if (index !== -1) handlers.splice(index, 1)
  }
}

/**
 * Give the topmost handler the press.
 *
 * Returns true when a handler dealt with it, in which case the app must not
 * navigate or exit.
 */
export function runBackHandler(): boolean {
  if (!Capacitor.isNativePlatform()) return false
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    const handled = handlers[index]()
    if (handled !== false) return true
  }
  return false
}

/**
 * Dismiss the topmost overlay by raising the `Escape` key it already listens
 * for.
 *
 * Radix's dismissable layer registers a document-level `keydown` listener for
 * `Escape`, so raising that event closes a dialog or a menu through exactly
 * the same code path the keyboard uses — no duplicated close logic and no
 * risk of the two disagreeing.
 */
export function dismissTopOverlay(): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
  )
}
