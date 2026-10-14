/**
 * Verifies the email + password auth flow end to end against a hosted project.
 *
 * Usage: node scripts/check-auth-password.mjs <url> <publishable-key> <secret-key>
 *
 * It creates a throwaway account, asserts that:
 *   - sign-up returns a session immediately (auto-confirm is on, so no email is
 *     sent — this is the fix for “email rate limit exceeded”),
 *   - password sign-in issues a session,
 *   - a wrong password is rejected,
 *   - the session can read its own RLS-scoped rows,
 * and then deletes the account again. No email is sent at any point.
 */
const [url, publishable, secret] = process.argv.slice(2)
if (!url || !publishable || !secret) {
  console.error('Usage: node scripts/check-auth-password.mjs <url> <publishable-key> <secret-key>')
  process.exit(2)
}

const base = url.replace(/\/$/, '')
const email = `probe+${Date.now()}@anusree-tracker.test`
const password = 'probe-password-123'

let failures = 0
function report(label, ok, detail = '') {
  if (!ok) failures += 1
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? `  — ${detail}` : ''}`)
}

async function authPost(path, body, token) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      apikey: publishable,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const json = await response.json().catch(() => ({}))
  return { response, json }
}

let userId = null
try {
  // 1. Sign up.
  const signup = await authPost('/auth/v1/signup', { email, password })
  userId = signup.json?.user?.id ?? signup.json?.id ?? null
  const signupSession = Boolean(signup.json?.access_token)
  report(
    'sign-up returns a session (auto-confirm, no email)',
    signup.response.ok && signupSession,
    signupSession ? 'confirmed' : `HTTP ${signup.response.status} ${signup.json?.msg ?? ''}`,
  )

  // 2. Wrong password is rejected.
  const bad = await authPost('/auth/v1/token?grant_type=password', {
    email,
    password: 'definitely-wrong',
  })
  report('wrong password is rejected', bad.response.status === 400, `HTTP ${bad.response.status}`)

  // 3. Correct password signs in.
  const signin = await authPost('/auth/v1/token?grant_type=password', { email, password })
  const token = signin.json?.access_token ?? null
  report('password sign-in issues a session', Boolean(token), `HTTP ${signin.response.status}`)

  // 4. The session can read its own RLS-scoped rows.
  if (token) {
    const read = await fetch(`${base}/rest/v1/records?select=entity&limit=1`, {
      headers: { apikey: publishable, Authorization: `Bearer ${token}` },
    })
    report('session reads its own rows through RLS', read.ok, `HTTP ${read.status}`)
  }
} finally {
  if (userId) {
    const del = await fetch(`${base}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: secret, Authorization: `Bearer ${secret}` },
    })
    console.log(`${del.ok ? 'OK  ' : 'FAIL'} probe account removed  — HTTP ${del.status}`)
    if (!del.ok) failures += 1
  }
}

console.log(failures === 0 ? '\nPassword auth verified.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
