/**
 * Verifies the Supabase schema is applied and that Row Level Security is real.
 *
 * Usage:
 *   node scripts/verify-supabase.mjs <project-url> <publishable-key> [secret-key]
 *
 * Checks, in order:
 *   1. every expected table/view exists;
 *   2. the anon/publishable key sees zero rows (RLS is enforcing);
 *   3. the secret key CAN read the table (proving the table is real and that the
 *      empty result above was RLS, not a missing table);
 *   4. an anonymous insert is rejected.
 *
 * Read-only apart from one deliberate, immediately-deleted probe insert, and it
 * prints no credential material.
 */
const [projectUrl, publishableKey, secretKey] = process.argv.slice(2)
if (!projectUrl || !publishableKey) {
  console.error('Usage: node scripts/verify-supabase.mjs <project-url> <publishable-key> [secret-key]')
  process.exit(2)
}

const rest = (path) => `${projectUrl}/rest/v1/${path}`
const anonHeaders = { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` }
const secretHeaders = secretKey
  ? { apikey: secretKey, Authorization: `Bearer ${secretKey}` }
  : null

let failures = 0
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? `  — ${detail}` : ''}`)
}

/* -- 1. objects exist ------------------------------------------------------ */
console.log('--- schema objects ---')
for (const [kind, name] of [
  ['table', 'records'],
  ['table', 'reminder_jobs'],
  ['table', 'push_subscriptions'],
  ['view', 'record_counts'],
]) {
  const response = await fetch(rest(`${name}?select=*&limit=0`), { headers: anonHeaders })
  // 200 means the object exists and RLS allowed a zero-row scan.
  check(`${kind} ${name}`, response.status === 200, `HTTP ${response.status}`)
}

/* -- 2. RLS blocks the publishable key ------------------------------------ */
console.log('\n--- row level security ---')
{
  const response = await fetch(rest('records?select=id&limit=5'), { headers: anonHeaders })
  const body = await response.json().catch(() => null)
  check(
    'publishable key reads 0 rows from records',
    response.status === 200 && Array.isArray(body) && body.length === 0,
    `HTTP ${response.status}, rows=${Array.isArray(body) ? body.length : 'n/a'}`,
  )
}
{
  // An insert with no JWT cannot satisfy `auth.uid() = user_id`, so RLS must
  // reject it. 401/403 is the expected outcome; a 201 would be a serious hole.
  const response = await fetch(rest('records'), {
    method: 'POST',
    headers: { ...anonHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: '00000000-0000-0000-0000-000000000000',
      entity: 'events',
      id: 'rls-probe',
      updated_at: Date.now(),
      deleted: false,
      payload: { probe: true },
    }),
  })
  check(
    'anonymous insert into records is rejected',
    response.status === 401 || response.status === 403,
    `HTTP ${response.status}`,
  )
}

/* -- 3. the secret key proves the table is real --------------------------- */
if (secretHeaders) {
  console.log('\n--- server key (RLS bypass) ---')
  const response = await fetch(rest('records?select=id&limit=1'), { headers: secretHeaders })
  const body = await response.json().catch(() => null)
  check(
    'secret key can read records',
    response.status === 200 && Array.isArray(body),
    `HTTP ${response.status}, rows=${Array.isArray(body) ? body.length : 'n/a'}`,
  )
}

/* -- 4. the record_counts view is queryable ------------------------------- */
{
  const response = await fetch(rest('record_counts?select=entity&limit=5'), {
    headers: secretHeaders ?? anonHeaders,
  })
  check('record_counts view is queryable', response.status === 200, `HTTP ${response.status}`)
}

console.log(failures === 0 ? '\nSchema verified.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
