/**
 * Probes which Supabase credentials can reach which API surface.
 *
 * Usage: node scripts/probe-supabase-auth.mjs <project-url> <secret-key>
 *
 * Read-only: it lists projects and the project's API keys if authorised, and
 * prints nothing that would leak a credential. Used once during setup to decide
 * whether the Management API is reachable with the key at hand, or whether a
 * Personal Access Token is required.
 */
const [projectUrl, secretKey] = process.argv.slice(2)
if (!projectUrl || !secretKey) {
  console.error('Usage: node scripts/probe-supabase-auth.mjs <project-url> <secret-key>')
  process.exit(2)
}

const projectRef = new URL(projectUrl).hostname.split('.')[0]
console.log(`project ref : ${projectRef}`)
console.log(`key prefix  : ${secretKey.slice(0, 12)}…`)

async function probe(label, url, headers) {
  try {
    const response = await fetch(url, { headers })
    const text = await response.text()
    let summary = text.slice(0, 160).replace(/\s+/g, ' ')
    if (response.ok) {
      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) summary = `array of ${parsed.length}`
        else if (parsed && typeof parsed === 'object') {
          summary = Object.keys(parsed).slice(0, 8).join(', ')
        }
      } catch {
        // Keep the raw summary.
      }
    }
    console.log(`${label.padEnd(46)} HTTP ${response.status}  ${summary}`)
    return response.status
  } catch (error) {
    console.log(`${label.padEnd(46)} ERROR ${error.message}`)
    return 0
  }
}

const management = 'https://api.supabase.com/v1'
const apiKey = { Authorization: `Bearer ${secretKey}` }
const apiKeyHeader = { apikey: secretKey, Authorization: `Bearer ${secretKey}` }

// 1. Management API with the secret key as a bearer token.
await probe('mgmt /projects (Bearer key)', `${management}/projects`, apiKey)
// 2. Management API with the key as `apikey`.
await probe('mgmt /projects (apikey header)', `${management}/projects`, apiKeyHeader)
// 3. Management API for this specific project.
await probe('mgmt /projects/<ref>', `${management}/projects/${projectRef}`, apiKey)
// 4. Project-level API keys endpoint (would let us read the anon key).
await probe('mgmt /projects/<ref>/api-keys', `${management}/projects/${projectRef}/api-keys`, apiKey)
// 5. PostgREST with the secret key: this is the documented server-side path and
//    proves the key is a real project secret rather than a Management token.
await probe(
  'rest /records (apikey = secret key)',
  `${projectUrl}/rest/v1/records?select=id&limit=1`,
  apiKeyHeader,
)
