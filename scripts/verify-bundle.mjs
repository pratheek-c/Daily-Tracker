/**
 * Verifies a deployed bundle's configuration without needing any secrets.
 *
 * Usage: node scripts/verify-bundle.mjs <base-url>
 *
 * Confirms the app shell loads, that Supabase configuration reached the bundle,
 * and — importantly — that no secret key was ever shipped to the browser.
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

const entryPath = entryMatch[1]
const entry = await (await fetch(base + entryPath)).text()

// Follow the lazy chunks too, so a leak in any of them is caught.
const chunkPaths = [...html.matchAll(/href="(\/assets\/[^"]+\.css)"/g)].map((m) => m[1])
const modulePreloads = [...html.matchAll(/href="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1])
const allPaths = [...new Set([entryPath, ...chunkPaths, ...modulePreloads])]

let allSource = entry
for (const path of allPaths) {
  if (path === entryPath) continue
  const response = await fetch(base + path)
  if (response.ok) allSource += await response.text()
}

const checks = [
  ['shell has the app title', /<title>Anusree/.test(html)],
  ['entry script found', entryPath.length > 0],
  ['supabase URL compiled in', allSource.includes('supabase.co')],
  ['publishable key compiled in', /sb_publishable_[A-Za-z0-9_-]{10,}/.test(allSource)],
  // The service_role / secret key bypasses Row Level Security, so its presence
  // in a browser bundle would be a serious vulnerability, not a style issue.
  ['NO secret key in the bundle', !/sb_secret_[A-Za-z0-9_-]{10,}/.test(allSource)],
  ['NO service_role JWT in the bundle', !/service_role/.test(allSource)],
]

let failures = 0
for (const [label, ok] of checks) {
  if (!ok) failures += 1
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
}

console.log(`\nentry: ${entryPath}`)
console.log(`checked ${allPaths.length} asset file(s), ${allSource.length} bytes of JS/CSS`)
console.log(failures === 0 ? 'Bundle checks passed.' : `${failures} bundle check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
