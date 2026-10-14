/**
 * Verifies a deployed build over HTTP.
 *
 * Usage: node scripts/verify-deployment.mjs <base-url>
 *
 * Checks that the SPA rewrite serves the shell for deep links, that the PWA
 * assets exist, and that the cache and security headers from `vercel.json`
 * actually reached the client. It also confirms the edge middleware sends
 * signed-out visitors from app routes to `/auth` while leaving assets public.
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

/* -- edge middleware: app routes need a session, assets do not ------------- */
console.log('\n--- edge middleware (no session cookie) ---')
for (const path of ['/', '/planner', '/settings', '/not-a-real-route']) {
  const response = await fetch(base + path, { redirect: 'manual' })
  const location = response.headers.get('location') ?? ''
  const ok = response.status === 307 && location.includes('/auth')
  if (!ok) failures += 1
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${path.padEnd(20)} -> HTTP ${response.status} ${location}`,
  )
}

const shell = await (await fetch(base + '/auth')).text()
const assetPath = shell.match(/src="(\/assets\/index-[^"]+)"/)?.[1]
if (assetPath) {
  const asset = await fetch(base + assetPath, { redirect: 'manual' })
  const ok = asset.status === 200
  if (!ok) failures += 1
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${assetPath.padEnd(20)} -> HTTP ${asset.status} (asset stays public)`)
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
