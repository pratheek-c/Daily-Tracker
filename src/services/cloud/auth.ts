import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase, isCloudConfigured } from './supabase'

export type AuthStatus = 'unconfigured' | 'loading' | 'signed-out' | 'signed-in'

export interface CloudAuthState {
  status: AuthStatus
  session: Session | null
  user: User | null
  /** Human-readable email of the signed-in user. */
  email: string | null
  /** True while a magic link is being requested. */
  sending: boolean
  error: string | null
  /** Set once a magic link has been emailed, so the UI can say so. */
  linkSentTo: string | null
  signInWithEmail: (email: string) => Promise<boolean>
  signOut: () => Promise<void>
}

/**
 * Supabase Auth (email magic link / OTP) state.
 *
 * The client is created lazily, so an unconfigured deployment simply reports
 * `unconfigured` and the app keeps working entirely offline.
 *
 * `status` is derived rather than stored: writing it from an effect would be a
 * redundant second render, and React's rules-of-hooks lint correctly flags that
 * as a cascading update. Only the raw facts — the session and whether the first
 * lookup has finished — are held in state.
 */
export function useCloudAuth(): CloudAuthState {
  const client = useMemo(() => getSupabase(), [])
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null)

  const status: AuthStatus = !isCloudConfigured
    ? 'unconfigured'
    : !sessionLoaded
      ? 'loading'
      : session
        ? 'signed-in'
        : 'signed-out'

  useEffect(() => {
    if (!client) return
    let cancelled = false

    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (cancelled) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session ?? null)
      setSessionLoaded(true)
    })

    const { data: subscription } = client.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return
      setSession(nextSession ?? null)
      setSessionLoaded(true)
      if (event === 'SIGNED_IN') {
        setError(null)
        setLinkSentTo(null)
      }
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [client])

  const signInWithEmail = useCallback(
    async (email: string) => {
      if (!client) {
        setError(
          'Cloud sync is not configured for this deployment. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
        )
        return false
      }
      const trimmed = email.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setError('That does not look like an email address.')
        return false
      }
      setSending(true)
      setError(null)
      try {
        const { error: signInError } = await client.auth.signInWithOtp({
          email: trimmed,
          options: {
            // Return to wherever the app is deployed, including a subpath.
            emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
            shouldCreateUser: true,
          },
        })
        if (signInError) throw signInError
        setLinkSentTo(trimmed)
        return true
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not send the sign-in link.')
        return false
      } finally {
        setSending(false)
      }
    },
    [client],
  )

  const signOut = useCallback(async () => {
    if (!client) return
    setError(null)
    await client.auth.signOut()
    setLinkSentTo(null)
  }, [client])

  return {
    status,
    session,
    user: session?.user ?? null,
    email: session?.user?.email ?? null,
    sending,
    error,
    linkSentTo,
    signInWithEmail,
    signOut,
  }
}

/** Stable per-user identifier used to scope local cursors and cloud rows. */
export function cloudUserId(session: Session | null): string | null {
  return session?.user?.id ?? null
}
