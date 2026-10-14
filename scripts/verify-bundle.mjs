/**
 * Verifies a deployed bundle's configuration without needing any secrets.
 *
 * Usage: node scripts/verify-bundle.mjs <base-url>
 *
 * Crawls the entry module and every static or dynamic import it references, so a
 * lazy-loaded route is inspected too — that is where the cloud sign-in UI lives.
 *
 * Confirms the app shell loads, that Supabase configuration reached the bundle,
 * that the sign-in UI shipped, and — importantly — that no secret key was ever
 * sent to the browser.
 */
const base = (process.argv[2] ?? '').replace(/\/$/, '')
if (!base) {
  console.error('Usage: node scripts/verify-bundle.mjs <base-url>')
  process.exit(1)
}

const html = await (await fetch(`${base}/`)).text()
const entryMatch = html.match(/src="(\/assets\/index-[^"]+)"/)
if (!entryMatch) {
  console.error('Could not find the entry script in index.html')
  process.exit(1)
}

/** Fetch a path, returning '' when it is not a readable text asset. */
async function grab(path) {
  try {
    const response = await fetch(base + path)
    if (!response.ok) return { path, text: '' }
    const type = response.headers.get('content-type') ?? ''
    if (!/javascript|css|text/.test(type)) return { path, text: '' }
    return { path, text: await response.text() }
  } catch {
    return { path, text: '' }
  }
}

// Breadth-first crawl of the module graph.
//
// The specifier form varies between bundlers (`./chunk.js`, `./assets/x.js`, or
// bare `chunk.js` for a dynamic import), so rather than matching one shape this
// collects every quoted string that ends in `.js` and resolves it against the
// assets directory. Anything that is not a real asset simply 404s and is skipped.
function discoverSpecifiers(text) {
  const found = new Set()
  for (const match of text.matchAll(/["']([^"']{1,120}?\.js)["']/g)) {
    const raw = match[1]
    if (raw.startsWith('http')) continue
    const cleaned = raw.replace(/^\.?\//, '').replace(/^assets\//, '')
    if (!/^[A-Za-z0-9._-]+$/.test(cleaned)) continue
    found.add(`/assets/${cleaned}`)
  }
  return [...found]
}

const visited = new Map()
let pending = [
  entryMatch[1],
  ...[...html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)].map((m) => m[1]),
]

for (let guard = 0; guard < 12 && pending.length > 0; guard += 1) {
  const batch = [...new Set(pending)].filter((path) => !visited.has(path))
  pending = []
  if (batch.length === 0) break

  const results = await Promise.all(batch.map(grab))
  for (const { path, text } of results) {
    visited.set(path, text)
    if (!text) continue
    pending.push(...discoverSpecifiers(text))
  }
}

let allSource = ''
for (const text of visited.values()) allSource += text

const checks = [
  ['shell has the app title', /<title>Anusree/.test(html)],
  ['entry script found', visited.size > 0],
  ['supabase URL compiled in', allSource.includes('supabase.co')],
  ['publishable key compiled in', /sb_publishable_[A-Za-z0-9_-]{10,}/.test(allSource)],
  // The service_role / secret key bypasses Row Level Security, so its presence
  // in a browser bundle would be a serious vulnerability, not a style issue.
  ['NO secret key in the bundle', !/sb_secret_[A-Za-z0-9_-]{10,}/.test(allSource)],
  ['NO service_role JWT in the bundle', !/service_role/.test(allSource)],
  // The sign-in UI must actually have shipped, including the code path that
  // works before a redirect allow-list is configured.
  ['sign-in UI shipped', allSource.includes('Email me a sign-in link')],
  ['code-based sign-in shipped', allSource.includes('Enter the code from the email')],
  ['cloud sync panel shipped', allSource.includes('Cloud sync')],
]

let failures = 0
for (const [label, ok] of checks) {
  if (!ok) failures += 1
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
}

console.log(`\nentry: ${entryMatch[1]}`)
console.log(`crawled ${visited.size} module(s), ${allSource.length} bytes of JS/CSS`)

// A sign-in UI that never shipped is worth diagnosing, so list what was seen.
if (failures > 0) {
  const names = [...visited.keys()].sort()
  console.log(`\nmodules crawled:\n  ${names.join('\n  ')}`)
}

console.log(failures === 0 ? 'Bundle checks passed.' : `${failures} bundle check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
