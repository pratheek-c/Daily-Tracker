/**
 * Shared environment loading for the Supabase scripts.
 *
 * Credentials are deliberately split across two files:
 *
 *   <project>/.env.local               the publishable `VITE_*` values that are
 *                                      compiled into the browser bundle — safe
 *                                      to keep in the (OneDrive-synced) project
 *   ~/.anusree-tracker-secrets.env     the service-role key, Postgres password
 *                                      and Personal Access Token — kept in the
 *                                      user profile, outside the synced tree
 *
 * When the same key exists in both, the project file wins.
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const SECRETS_FILE_NAME = '.anusree-tracker-secrets.env'

export function secretsFilePath() {
  return join(homedir(), SECRETS_FILE_NAME)
}

/** Minimal dotenv reader: `KEY=value`, optional surrounding quotes, `#` comments. */
export function loadEnvFile(path) {
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

/** `process.env` + the profile secrets file + the project `.env.local` (last wins). */
export function loadProjectEnv(projectRoot) {
  return {
    ...process.env,
    ...loadEnvFile(secretsFilePath()),
    ...loadEnvFile(join(projectRoot, '.env.local')),
  }
}
