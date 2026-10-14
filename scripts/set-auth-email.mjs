/**
 * Configures email auth on a hosted Supabase project for this app.
 *
 * Usage:
 *   node scripts/set-auth-email.mjs [--require-confirmation] [--dry-run]
 *
 * What it changes (and only this):
 *   - external_email_enabled : true      — the email provider must be on.
 *   - mailer_autoconfirm     : true      — SKIP the confirmation email.
 *   - password_min_length    : 6         — match the app's client-side rule.
 *
 * Why turn confirmations OFF by default?
 * --------------------------------------
 * The hosted project uses Supabase's built-in mailer, which is rate-limited to
 * roughly two messages per hour (`auth.rate_limit.email_sent = 2`). A magic-link
 * flow sends a message on every sign-in attempt, so it fails quickly with
 * "email rate limit exceeded". This app therefore signs in with email +
 * password, which sends no email at all; with auto-confirm on, creating the
 * account sends nothing either. The only routine email left is a password
 * reset, which is rare enough to fit inside the limit.
 *
 * Passing `--require-confirmation` flips confirmation back on if you later
 * connect custom SMTP and want verified addresses.
 *
 * Like `set-auth-redirects.mjs`, this patches ONLY the named properties through
 * the Management API. It never runs `supabase config push`, which would push a
 * whole file of defaults over the live project's auth settings.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

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

const fileEnv = loadEnvFile(join(root, '.env.local'))
const token = process.env.SUPABASE_ACCESS_TOKEN || fileEnv.SUPABASE_ACCESS_TOKEN
const projectRef = process.env.SUPABASE_PROJECT_REF || fileEnv.SUPABASE_PROJECT_REF

if (!token) {
  console.error('No access token. Set SUPABASE_ACCESS_TOKEN or add it to .env.local.')
  process.exit(2)
}
if (!projectRef) {
  console.error('No project ref. Set SUPABASE_PROJECT_REF or add it to .env.local.')
  process.exit(2)
}

const requireConfirmation = process.argv.includes('--require-confirmation')
const dryRun = process.argv.includes('--dry-run')

const api = 'https://api.supabase.com/v1'
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
}

console.log(`project                 : ${projectRef}`)
console.log(`email provider          : enabled`)
console.log(`confirmation email      : ${requireConfirmation ? 'REQUIRED' : 'skipped (auto-confirm)'}`)
console.log(`minimum password length : 6`)

/* -- 1. read the current config ------------------------------------------- */
const beforeResponse = await fetch(`${api}/projects/${projectRef}/config/auth`, { headers })
if (!beforeResponse.ok) {
  const body = await beforeResponse.text()
  console.error(`\nCould not read the auth config: HTTP ${beforeResponse.status} ${body.slice(0, 200)}`)
  process.exit(1)
}
const before = await beforeResponse.json()
console.log(`\nbefore email provider     : ${before.external_email_enabled}`)
console.log(`before auto-confirm       : ${before.mailer_autoconfirm}`)
console.log(`before min password length: ${before.password_min_length ?? '(unchanged)'}`)

if (dryRun) {
  console.log('\n--dry-run: no changes sent.')
  process.exit(0)
}

/* -- 2. patch only the email-auth properties ------------------------------ */
const patchResponse = await fetch(`${api}/projects/${projectRef}/config/auth`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({
    external_email_enabled: true,
    mailer_autoconfirm: !requireConfirmation,
    password_min_length: 6,
  }),
})

if (!patchResponse.ok) {
  const body = await patchResponse.text()
  console.error(`\nUpdate failed: HTTP ${patchResponse.status} ${body.slice(0, 300)}`)
  process.exit(1)
}

/* -- 3. confirm the read-back --------------------------------------------- */
const after = await (await fetch(`${api}/projects/${projectRef}/config/auth`, { headers })).json()
const emailOk = after.external_email_enabled === true
const autoconfirmOk = after.mailer_autoconfirm === !requireConfirmation
const passwordOk = Number(after.password_min_length ?? 0) === 6
// Guard the settings this script must not touch.
const urlsUnchanged =
  after.site_url === before.site_url && after.uri_allow_list === before.uri_allow_list

console.log(`\nafter email provider      : ${after.external_email_enabled}  ${emailOk ? 'OK' : 'MISMATCH'}`)
console.log(`after auto-confirm        : ${after.mailer_autoconfirm}  ${autoconfirmOk ? 'OK' : 'MISMATCH'}`)
console.log(`after min password length : ${after.password_min_length}  ${passwordOk ? 'OK' : 'MISMATCH'}`)
console.log(`redirect URLs untouched   : ${urlsUnchanged ? 'OK' : 'CHANGED'}`)

if (!requireConfirmation) {
  console.log(
    '\nSign-up now returns a session immediately and sends no email. Password reset still emails.',
  )
}

process.exit(emailOk && autoconfirmOk && passwordOk && urlsUnchanged ? 0 : 1)
