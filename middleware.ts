/**
 * Vercel Edge Middleware — refuses every app route without a Supabase session.
 *
 * The SPA is a static bundle, so without this the shell for `/planner`, `/tasks`
 * and friends is served to anyone who asks. This runs before every request and,
 * when there is no `sb-<project-ref>-auth-token` cookie, redirects to `/auth`
 * with a `next` parameter so the user lands back where they were after signing in.
 *
 * Why a cookie and not `getUser()`?
 * ---------------------------------
 * The session lives in cookies (the browser client is created with
 * `@supabase/ssr`'s `createBrowserClient`), which is what makes it readable here.
 * This middleware deliberately checks for the cookie rather than validating the
 * token over the network on every request: the SPA is static, and a server-side
 * refresh would need to write `Set-Cookie` on responses this edge function cannot
 * easily reconstruct. Real authorisation is still enforced twice — the client
 * gate in `AppShell` and, decisively, Row Level Security in Postgres, which
 * scopes every row to `auth.uid()`. Forging a cookie here gains an attacker the
 * empty UI shell and nothing else.
 *
 * A deployment with no Supabase credentials is a supported local-only state and
 * is left ungated.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const CONFIGURED = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0

const AUTH_PATH = '/auth'

/** Paths that must load before a session exists, or the sign-in page cannot render. */
function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/icons/') ||
    /\.[a-z0-9]+$/i.test(pathname)
  )
}

/** The cookie key supabase-js uses, e.g. `sb-abcdefgh-auth-token` (chunked as `.0`). */
function storageKeyFor(supabaseUrl: string): string {
  try {
    return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  } catch {
    return ''
  }
}

function hasSessionCookie(cookieHeader: string, storageKey: string): boolean {
  if (!storageKey) return false
  const escaped = storageKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Match `<key>=…` or a numbered chunk `<key>.0=…`.
  return new RegExp(`(?:^|;\\s*)${escaped}(?:\\.\\d+)?=`).test(cookieHeader)
}

/** Reject protocol-relative and absolute `next` values so the redirect stays on-site. */
function safeNext(next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  return '/'
}

export default function middleware(request: Request): Response | undefined {
  if (!CONFIGURED) return undefined

  const url = new URL(request.url)
  const { pathname, searchParams } = url
  const signedIn = hasSessionCookie(request.headers.get('cookie') ?? '', storageKeyFor(SUPABASE_URL))

  // A PKCE callback carries `?code=…` (or an error) and must reach the client to
  // be exchanged for a session — before which, of course, there is no cookie.
  const isAuthCallback =
    searchParams.has('code') ||
    searchParams.has('token_hash') ||
    searchParams.has('error') ||
    searchParams.has('error_description')

  if (pathname === AUTH_PATH) {
    if (signedIn && !isAuthCallback) {
      return Response.redirect(new URL(safeNext(searchParams.get('next')), url.origin).toString(), 307)
    }
    return undefined
  }

  if (isPublicAsset(pathname) || isAuthCallback || signedIn) return undefined

  const redirectUrl = new URL(AUTH_PATH, url.origin)
  redirectUrl.searchParams.set('next', pathname + url.search)
  return Response.redirect(redirectUrl.toString(), 307)
}
