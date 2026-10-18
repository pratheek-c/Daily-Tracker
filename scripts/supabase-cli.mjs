/**
 * Convenience wrapper around the Supabase CLI for this project.
 *
 * It loads the project's `.env.local` plus `~/.anusree-tracker-secrets.env`
 * (which npm does not do for plain scripts) via `scripts/env.mjs`, maps the
 * project's variable names onto the ones the CLI expects, then delegates to
 * `run-supabase.mjs`.
 *
 * Usage:
 *   node scripts/supabase-cli.mjs db push
 *   node scripts/supabase-cli.mjs config push
 *   node scripts/supabase-cli.mjs db reset
 *   node scripts/supabase-cli.mjs <anything the CLI accepts>
 *
 * `.env.local` is gitignored and holds the publishable `VITE_*` values; the
 * credentials the CLI needs live in `~/.anusree-tracker-secrets.env` (outside
 * the synced project folder). Both are read via `scripts/env.mjs`:
 *   SUPABASE_DB_URL        direct Postgres URL, used by `db push` / `db reset`
 *   SUPABASE_ACCESS_TOKEN  optional Personal Access Token, needed only for
 *                          Management API commands such as `config push`
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadProjectEnv } from './env.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const env = loadProjectEnv(root)

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: node scripts/supabase-cli.mjs <cli args…>')
  process.exit(2)
}

const subcommand = args.join(' ')
const projectRef = env.SUPABASE_PROJECT_REF || 'safzqvsrayinskpicgej'

// Build the argument list, filling in what the CLI needs for each command.
const forwarded = [...args]

if (subcommand.startsWith('db push') || subcommand.startsWith('db reset') || subcommand.startsWith('db query')) {
  if (!forwarded.includes('--db-url')) {
    if (!env.SUPABASE_DB_URL) {
      console.error(
        'SUPABASE_DB_URL is missing.\n' +
          'Add it to ~/.anusree-tracker-secrets.env (see scripts/env.mjs) as:\n' +
          '  postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres',
      )
      process.exit(2)
    }
    forwarded.push('--db-url', env.SUPABASE_DB_URL)
  }
  if (!forwarded.includes('--yes')) forwarded.push('--yes')
}

if (subcommand.startsWith('config')) {
  if (!forwarded.includes('--project-ref')) forwarded.push('--project-ref', projectRef)
  if (!forwarded.includes('--yes') && !env.SUPABASE_ACCESS_TOKEN) {
    // Without a PAT the CLI fails fast anyway; --yes just avoids a hang.
    forwarded.push('--yes')
  } else if (!forwarded.includes('--yes')) {
    forwarded.push('--yes')
  }
}

// The CLI reads the access token from the environment, so pass it through when
// present. Absence is fine for database-only commands.
const childEnv = {}
if (env.SUPABASE_ACCESS_TOKEN) childEnv.SUPABASE_ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN

const result = spawnSync(
  process.execPath,
  [join(root, 'scripts', 'run-supabase.mjs'), '.sandbox/supabase', '--', ...forwarded],
  { stdio: 'inherit', env: { ...process.env, ...childEnv }, windowsHide: true },
)

process.exit(result.status ?? 1)
