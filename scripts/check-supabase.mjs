/**
 * One-off connectivity check for a Supabase project.
 *
 * Usage:
 *   node scripts/check-supabase.mjs <url> <publishable-key>
 *
 * Verifies the project is reachable, that the publishable key is accepted by
 * PostgREST, and whether the app's schema has been applied yet. It reads no
 * secrets from disk and prints nothing sensitive.
 */
import { createClient } from '@supabase/supabase-js'

const [url, key] = process.argv.slice(2)
if (!url || !key) {
  console.error('Usage: node scripts/check-supabase.mjs <url> <publishable-key>')
  process.exit(1)
}

const client = createClient(url, key, { auth: { persistSession: false } })

console.log(`project : ${url}`)
console.log(`key type: ${key.slice(0, 14)}… (${key.length} chars)`)

// 1. Reachability + settings endpoint (no auth required).
try {
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
  })
  const body = await response.json().catch(() => ({}))
  console.log(`auth    : HTTP ${response.status}`)
  if (response.ok) {
    console.log(`  email provider enabled : ${body.external?.email ?? 'unknown'}`)
    console.log(`  email signups enabled  : ${body.external?.email_enabled ?? 'unknown'}`)
    console.log(`  mailer autoconfirm     : ${body.mailer_autoconfirm ?? 'unknown'}`)
  } else {
    console.log(`  body: ${JSON.stringify(body).slice(0, 200)}`)
  }
} catch (error) {
  console.log(`auth    : ERROR ${error.message}`)
}

// 2. PostgREST reachability and whether the migration has been applied.
//    An anon request hits Row Level Security, so:
//      200 with [] -> table exists, RLS active, no rows visible (correct)
//      404          -> table missing, migration not applied yet
//      401/403      -> key rejected
for (const table of ['records', 'reminder_jobs', 'push_subscriptions']) {
  const response = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const body = await response.text()
  const note =
    response.status === 404
      ? 'MISSING — run supabase/migrations/0001_records.sql'
      : response.status === 200
        ? 'present (RLS active, 0 rows visible to anon — expected)'
        : body.slice(0, 160)
  console.log(`table   : ${table.padEnd(20)} HTTP ${response.status}  ${note}`)
}

// 3. The view used by the Settings summary.
{
  const response = await fetch(`${url}/rest/v1/record_counts?select=entity&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  console.log(
    `view    : record_counts        HTTP ${response.status}  ${
      response.status === 404 ? 'MISSING' : response.status === 200 ? 'present' : ''
    }`,
  )
}

// 4. Auth client construction, to prove the key format is accepted by the SDK.
try {
  const { data, error } = await client.auth.getSession()
  console.log(`sdk     : getSession ok=${!error} session=${data.session ? 'present' : 'none'}`)
} catch (error) {
  console.log(`sdk     : ERROR ${error.message}`)
}
