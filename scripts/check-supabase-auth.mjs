/**
 * Probes the hosted Supabase Auth configuration.
 *
 * Usage: node scripts/check-supabase-auth.mjs <project-url> <secret-key>
 *
 * The Management API needs a Personal Access Token, but the GoTrue *Admin* API
 * accepts a project server key. That is enough to answer the two questions that
 * actually matter for magic-link sign-in:
 *
 *   1. Is the email provider reachable, and are confirmations required?
 *   2. Does Auth accept the app's production redirect URL, or does the allow-list
 *      need updating first?
 *
 * It creates one throwaway user so the redirect check is real, then deletes it.
 * No credential material is printed.
 */
const [projectUrl, secretKey] = process.argv.slice(2)
if (!projectUrl || !secretKey) {
  console.error('Usage: node scripts/check-supabase-auth.mjs <project-url> <secret-key>')
  process.exit(2)
}

const admin = `${projectUrl}/auth/v1/admin`
const headers = {
  apikey: secretKey,
  Authorization: `Bearer ${secretKey}`,
  'Content-Type': 'application/json',
}

const email = `setup-probe+${Date.now()}@example.com`
let userId = null

try {
  /* -- 1. create a throwaway user ---------------------------------------- */
  const createResponse = await fetch(`${admin}/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, email_confirm: true }),
  })
  const created = await createResponse.json().catch(() => ({}))
  if (!createResponse.ok) {
    console.log(`create user          : HTTP ${createResponse.status} ${JSON.stringify(created).slice(0, 200)}`)
    process.exit(1)
  }
  userId = created.id
  console.log(`create user          : HTTP ${createResponse.status} (ok)`)

  /* -- 2. does Auth accept the production redirect URL? ------------------ */
  const target = 'https://anusree-daily-tracker.vercel.app/settings'
  const linkResponse = await fetch(`${admin}/generate_link`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'magiclink', email, options: { redirectTo: target } }),
  })
  const link = await linkResponse.json().catch(() => ({}))

  // GoTrue silently falls back to the project's Site URL when a redirect is not
  // allow-listed, and when it *is* allow-listed it may normalise the value down
  // to the matching origin. So the test is whether the returned origin is the
  // app's origin — a localhost result means the allow-list is still wrong.
  const actionLink = String(link.action_link ?? '')
  const chosen = actionLink ? new URL(actionLink).searchParams.get('redirect_to') : null
  const chosenOrigin = chosen ? new URL(chosen).origin : null
  const targetOrigin = new URL(target).origin
  const honoured = chosenOrigin === targetOrigin
  const fellBack = chosenOrigin !== null && !honoured

  console.log(`generate magic link  : HTTP ${linkResponse.status}`)
  console.log(`requested redirect   : ${target}`)
  console.log(`redirect Auth chose  : ${chosen ?? '(none returned)'}`)
  console.log(
    `allow-list           : ${
      honoured
        ? 'ACCEPTS the production URL — the emailed link will sign you in'
        : fellBack
          ? `IGNORED it and fell back to ${chosenOrigin} — add ${targetOrigin}/** in Authentication → URL Configuration`
          : 'could not be determined'
    }`,
  )

  // The emailed code path does not depend on any of this, so report it too.
  const otpPresent = typeof link.email_otp === 'string' && link.email_otp.length > 0
  console.log(
    `code path            : ${
      otpPresent
        ? `the same email carries a ${link.email_otp.length}-digit code, which needs no redirect`
        : 'no code returned by the admin API'
    }`,
  )
} catch (error) {
  console.log(`ERROR ${error.message}`)
} finally {
  /* -- 3. clean up the probe user ---------------------------------------- */
  if (userId) {
    const deleteResponse = await fetch(`${admin}/users/${userId}`, { method: 'DELETE', headers })
    console.log(`cleanup probe user   : HTTP ${deleteResponse.status}`)
  }
}
