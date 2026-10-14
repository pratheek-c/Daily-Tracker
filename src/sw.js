/// <reference lib="webworker" />

/**
 * Service worker source.
 *
 * This file is plain JavaScript on purpose: Vite hashes the built asset names,
 * so the precache list cannot be known ahead of time. `vite-plugin-pwa` runs in
 * `injectManifest` mode and replaces `self.__WB_MANIFEST` below with the real
 * list of build outputs at build time, and this file is written so that it reads
 * correctly even before that substitution (the placeholder is a real array).
 *
 * Why the cache is this narrow
 * ----------------------------
 * Only the application shell is cached. All user data lives in IndexedDB on the
 * device and the app makes no authenticated API calls, so there is no private
 * response that could leak into a shared HTTP cache. Navigations fall back to
 * the cached shell when the network is unavailable.
 */

const VERSION = 'v2'
const SHELL_CACHE = `adt-shell-${VERSION}`
const PRECACHE = `adt-precache-${VERSION}`

/** Replaced at build time by vite-plugin-pwa with the real asset list. */
const PRECACHE_ENTRIES = self.__WB_MANIFEST || []

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE)
      const urls = PRECACHE_ENTRIES.map((entry) =>
        typeof entry === 'string' ? entry : entry.url,
      ).filter((url) => url && !url.startsWith('http'))
      // Add entries individually so one bad file cannot fail the whole install.
      await Promise.all(
        urls.map((url) => cache.add(url).catch(() => undefined)),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith('adt-') && key !== PRECACHE && key !== SHELL_CACHE)
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Only same-origin requests are handled; third-party fonts and any future API
  // traffic go straight to the network.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Navigations: serve the cached shell immediately, refresh it in the
  // background. This is what makes the app open instantly and still work offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE)
        const cached = await cache.match('/index.html')
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) void cache.put('/index.html', response.clone())
            return response
          })
          .catch(() => null)
        return cached || (await network) || Response.error()
      })(),
    )
    return
  }

  // Static assets: precache first, then the network.
  event.respondWith(
    (async () => {
      const cache = await caches.open(PRECACHE)
      const cached = await cache.match(request)
      if (cached) return cached
      try {
        const response = await fetch(request)
        if (response && response.ok && response.type === 'basic') {
          void cache.put(request, response.clone())
        }
        return response
      } catch (error) {
        const shell = await caches.open(SHELL_CACHE)
        const fallback = await shell.match('/index.html')
        if (fallback) return fallback
        throw error
      }
    })(),
  )
})

/**
 * Reminder delivery from the service worker.
 *
 * `showNotification` is only ever triggered by a message from an open page. The
 * app does not claim to wake a closed browser: scheduled reminders run from the
 * page while it is open, and a genuine closed-browser alarm would need the
 * optional server-side Web Push setup described in the README.
 */
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data) return
  // Sign-out clears the cached shell so the next navigation is forced through
  // the edge middleware instead of being answered from this cache.
  if (data.type === 'adt:clear-shell') {
    event.waitUntil(caches.delete(SHELL_CACHE))
    return
  }
  if (data.type !== 'adt:notify' || !data.title) return
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: self.registration.scope },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      if (allClients.length > 0) {
        await allClients[0].focus()
        return
      }
      await self.clients.openWindow(self.registration.scope)
    })(),
  )
})
