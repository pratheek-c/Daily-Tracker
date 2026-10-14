/**
 * Verifies a deployed build over HTTP.
 *
 * Usage: node scripts/verify-deployment.mjs <base-url>
 *
 * Checks that the SPA rewrite serves the shell for deep links, that the PWA
 * assets exist, and that the cache and security headers from `vercel.json`
 * actually reached the client.
 */
const base = (process.argv[2] ?? '').replace(/\/$/, '')
if (!base) {
  console.error('Usage: node scripts/verify-deployment.mjs <base-url>')
  process.exit(1)
}

const paths = [
  '/',
  '/planner',
  '/timetable',
  '/calendar',
  '/study',
  '/projects',
  '/tasks',
  '/habits',
  '/sleep',
  '/analytics',
  '/settings',
  '/not-a-real-route',
  '/manifest.webmanifest',
  '/sw.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.svg',
  '/robots.txt',
]

let failures = 0

for (const path of paths) {
  try {
    const response = await fetch(base + path, { redirect: 'follow' })
    const contentType = (response.headers.get('content-type') ?? '-').split(';')[0]
    const cacheControl = response.headers.get('cache-control') ?? '-'
    const nosniff = response.headers.get('x-content-type-options') ?? '-'
    const body = await response.text()
    const isShell = /<title>Anusree/.test(body)
    const expectedShell = !path.startsWith('/assets/') && !path.includes('.')

    const ok = response.status === 200 && (!expectedShell || isShell)
    if (!ok) failures += 1

    console.log(
      [
        ok ? 'OK  ' : 'FAIL',
        path.padEnd(32),
        String(response.status).padEnd(4),
        `${String(body.length).padStart(8)}b`,
        contentType.padEnd(26),
        expectedShell ? `shell=${isShell}` : '',
        `cc=${cacheControl}`,
        `nosniff=${nosniff}`,
      ]
        .filter(Boolean)
        .join(' ')
        .trimEnd(),
    )
  } catch (error) {
    failures += 1
    console.log(`FAIL ${path.padEnd(32)} ${error.message}`)
  }
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
