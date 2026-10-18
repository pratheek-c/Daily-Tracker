/**
 * Convenience wrapper for the Supabase verification scripts.
 *
 * npm scripts run through cmd.exe, which does not expand `$VAR`, so the values
 * have to be read from the env files here instead (`scripts/env.mjs`): the
 * project's `.env.local` for the publishable `VITE_*` values and
 * `~/.anusree-tracker-secrets.env` for the service-role key.
 *
 * Usage:
 *   node scripts/supabase-verify.mjs schema
 *   node scripts/supabase-verify.mjs auth
 *   node scripts/supabase-verify.mjs password
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadProjectEnv } from './env.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const env = loadProjectEnv(root)
const url = env.VITE_SUPABASE_URL
const publishable = env.VITE_SUPABASE_ANON_KEY
const secret = env.SUPABASE_SECRET_KEY

const which = process.argv[2]
if (!which) {
  console.error('Usage: node scripts/supabase-verify.mjs <schema|auth|password>')
  process.exit(2)
}

if (!url) {
  console.error('VITE_SUPABASE_URL is missing from .env.local')
  process.exit(2)
}

const scripts = {
  schema: { file: 'verify-supabase.mjs', args: [url, publishable, secret] },
  auth: { file: 'check-supabase-auth.mjs', args: [url, secret] },
  password: { file: 'check-auth-password.mjs', args: [url, publishable, secret] },
}

const target = scripts[which]
if (!target) {
  console.error(`Unknown check "${which}". Use "schema", "auth" or "password".`)
  process.exit(2)
}

if (target.args.some((value) => !value)) {
  console.error(
    `Missing credentials for the "${which}" check. ` +
      'Expected VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SECRET_KEY. ' +
        'The first two live in .env.local, the last in ~/.anusree-tracker-secrets.env.',
  )
  process.exit(2)
}

const result = spawnSync(process.execPath, [join(root, 'scripts', target.file), ...target.args], {
  stdio: 'inherit',
  windowsHide: true,
})

process.exit(result.status ?? 1)
