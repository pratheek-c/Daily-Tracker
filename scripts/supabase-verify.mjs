/**
 * Convenience wrapper for the Supabase verification scripts.
 *
 * npm scripts run through cmd.exe, which does not expand `$VAR`, so the values
 * have to be read from `.env.local` here instead.
 *
 * Usage:
 *   node scripts/supabase-verify.mjs schema
 *   node scripts/supabase-verify.mjs auth
 */
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const envPath = join(root, '.env.local')

function loadEnvFile(path) {
  const out = {}
  if (!existsSync(path)) return out
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const env = { ...process.env, ...loadEnvFile(envPath) }
const url = env.VITE_SUPABASE_URL
const publishable = env.VITE_SUPABASE_ANON_KEY
const secret = env.SUPABASE_SECRET_KEY

const which = process.argv[2]
if (!which) {
  console.error('Usage: node scripts/supabase-verify.mjs <schema|auth>')
  process.exit(2)
}

if (!url) {
  console.error('VITE_SUPABASE_URL is missing from .env.local')
  process.exit(2)
}

const scripts = {
  schema: { file: 'verify-supabase.mjs', args: [url, publishable, secret] },
  auth: { file: 'check-supabase-auth.mjs', args: [url, secret] },
}

const target = scripts[which]
if (!target) {
  console.error(`Unknown check "${which}". Use "schema" or "auth".`)
  process.exit(2)
}

if (target.args.some((value) => !value)) {
  console.error(
    `Missing credentials for the "${which}" check. ` +
      'Expected VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SECRET_KEY in .env.local.',
  )
  process.exit(2)
}

const result = spawnSync(process.execPath, [join(root, 'scripts', target.file), ...target.args], {
  stdio: 'inherit',
  windowsHide: true,
})

process.exit(result.status ?? 1)
