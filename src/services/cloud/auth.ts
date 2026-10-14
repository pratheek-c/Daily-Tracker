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
  /** True while a typed code is being verified. */
  verifying: boolean
  /** True while an email + password sign-in is in flight. */
  signingIn: boolean
  /** True while an account is being created. */
  signingUp: boolean
  /** True while a password-reset email is being requested. */
  resetting: boolean
  /** True while a new password (after a recovery link) is being saved. */
  updatingPassword: boolean
  /**
   * True once a password-recovery link has been opened, until a new password is
   * chosen. While set, the app shows the “choose a new password” screen instead
   * of the planner.
   */
  recovering: boolean
  error: string | null
  /** Set once a magic link has been emailed, so the UI can say so. */
  linkSentTo: string | null
  /** Set once a password-reset email has been sent, so the UI can say so. */
  resetSentTo: string | null
  signInWithEmail: (email: string) => Promise<boolean>
  /**
   * Verify the numeric code that the same email carries.
   *
   * This is the reliable path: a magic *link* has to bounce through a redirect
   * URL that the project must have allow-listed, whereas a code is verified
   * directly against GoTrue and needs no redirect at all.
   */
  verifyEmailCode: (email: string, code: string) => Promise<boolean>
  /**
   * Email + password sign-in.
   *
   * This is the primary path because it sends no email, and the hosted project's
   * built-in mailer is limited to a couple of messages per hour — the limit that
   * makes repeated magic links fail with “email rate limit exceeded”.
   */
  signInWithPassword: (email: string, password: string) => Promise<boolean>
  /**
   * Create an account with email + password.
   *
   * `needsConfirmation` is true when the project still requires the address to be
   * confirmed: GoTrue returns a user but no session, and the caller should tell
   * the user to open the emailed link. When confirmations are switched off the
   * call signs in immediately and no email is sent at all.
   */
  signUpWithPassword: (
    email: string,
    password: string,
    details?: SignUpDetails,
  ) => Promise<SignUpOutcome>
  /** Send the “reset your password” email. Rate-limited like any other email. */
  sendPasswordReset: (email: string) => Promise<boolean>
  /** Re-send the signup confirmation email for an account that has not confirmed yet. */
  resendConfirmation: (email: string) => Promise<boolean>
  /** Save a new password for the currently-recovering session. */
  updatePassword: (password: string) => Promise<boolean>
  /** Abandon recovery and return to the sign-in screen. */
  cancelRecovery: () => Promise<void>
  signOut: () => Promise<void>
}

export interface SignUpOutcome {
  ok: boolean
  /** True when the account exists but the email address must still be confirmed. */
  needsConfirmation: boolean
}

/**
 * Profile details gathered at sign-up. They are stored in the Supabase user's
 * `raw_user_meta_data`, so they travel with the account and are readable as
 * `cloud.user.user_metadata` on any device. Every field except the name is
 * optional — the app never blocks on them.
 */
export interface SignUpDetails {
  fullName?: string
  displayName?: string
  course?: string
  institution?: string
}

/** Where GoTrue should return the browser after an email link is opened. */
function redirectTarget(): string {
  return `${window.location.origin}${window.location.pathname}`
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Translate GoTrue's raw error strings into something a student can act on.
 *
 * The rate-limit case matters most: Supabase's built-in mailer allows only a
 * couple of messages per hour, and “email rate limit exceeded” is the single
 * most confusing failure a magic-link-first sign-in can produce. The copy points
 * at the password path, which sends no email, and at custom SMTP as the real fix.
 */
function friendlyAuthError(cause: unknown, fallback: string): string {
  const message =
    cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : ''
  const lower = message.toLowerCase()
  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('over_email_send_rate_limit')
  ) {
    return 'Email sending is rate-limited (the built-in mailer allows only a few messages per hour). Sign in with your password instead — it sends no email — or wait about an hour. For unlimited email, connect custom SMTP in Supabase → Authentication → Emails.'
  }
  if (lower.includes('invalid login credentials')) {
    return 'That email and password do not match an account. Check for typos, or create an account.'
  }
  if (lower.includes('email not confirmed')) {
    return 'This email has not been confirmed yet. Open the confirmation link we emailed you, then sign in.'
  }
  if (lower.includes('user already registered')) {
    return 'An account already exists for this email. Switch to Sign in.'
  }
  if (lower.includes('password should be at least') || lower.includes('password is too short')) {
    return 'That password is too short — use at least 6 characters.'
  }
  if (lower.includes('for security purposes') || lower.includes('only request this after')) {
    return 'Please wait a moment before trying again.'
  }
  return message || fallback
}

/**
 * Supabase Auth (email + password, with magic link / OTP still available) state.
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
  const [verifying, setVerifying] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [signingUp, setSigningUp] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null)
  const [resetSentTo, setResetSentTo] = useState<string | null>(null)

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
      if (event === 'PASSWORD_RECOVERY') {
        // A recovery link just signed the user in; ask for a new password first.
        setRecovering(true)
      }
      if (event === 'SIGNED_IN') {
        setError(null)
        setLinkSentTo(null)
        setResetSentTo(null)
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
            emailRedirectTo: redirectTarget(),
            shouldCreateUser: true,
          },
        })
        if (signInError) throw signInError
        setLinkSentTo(trimmed)
        return true
      } catch (cause) {
        setError(friendlyAuthError(cause, 'Could not send the sign-in link.'))
        return false
      } finally {
        setSending(false)
      }
    },
    [client],
  )

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      if (!client) {
        setError('Cloud sync is not configured for this deployment.')
        return false
      }
      const trimmed = email.trim()
      if (!isEmail(trimmed)) {
        setError('That does not look like an email address.')
        return false
      }
      if (password.length < 6) {
        setError('Passwords are at least 6 characters.')
        return false
      }
      setSigningIn(true)
      setError(null)
      try {
        const { error: signInError } = await client.auth.signInWithPassword({
          email: trimmed,
          password,
        })
        if (signInError) throw signInError
        return true
      } catch (cause) {
        setError(friendlyAuthError(cause, 'Could not sign you in.'))
        return false
      } finally {
        setSigningIn(false)
      }
    },
    [client],
  )

  const signUpWithPassword = useCallback(
    async (email: string, password: string, details?: SignUpDetails): Promise<SignUpOutcome> => {
      if (!client) {
        setError('Cloud sync is not configured for this deployment.')
        return { ok: false, needsConfirmation: false }
      }
      const trimmed = email.trim()
      if (!isEmail(trimmed)) {
        setError('That does not look like an email address.')
        return { ok: false, needsConfirmation: false }
      }
      if (password.length < 6) {
        setError('Passwords are at least 6 characters.')
        return { ok: false, needsConfirmation: false }
      }
      // Only send keys that were actually filled in, so the metadata stays clean.
      const data: Record<string, string> = {}
      const put = (key: string, value: string | undefined) => {
        const trimmedValue = value?.trim()
        if (trimmedValue) data[key] = trimmedValue
      }
      put('full_name', details?.fullName)
      put('display_name', details?.displayName)
      put('course', details?.course)
      put('institution', details?.institution)

      setSigningUp(true)
      setError(null)
      try {
        const { data: response, error: signUpError } = await client.auth.signUp({
          email: trimmed,
          password,
          options: {
            emailRedirectTo: redirectTarget(),
            ...(Object.keys(data).length > 0 ? { data } : {}),
          },
        })
        if (signUpError) throw signUpError
        // With confirmations on, GoTrue returns a user but no session until the
        // emailed link is opened. With them off, the session is already here.
        const needsConfirmation = !response.session
        return { ok: true, needsConfirmation }
      } catch (cause) {
        setError(friendlyAuthError(cause, 'Could not create your account.'))
        return { ok: false, needsConfirmation: false }
      } finally {
        setSigningUp(false)
      }
    },
    [client],
  )

  const sendPasswordReset = useCallback(
    async (email: string) => {
      if (!client) {
        setError('Cloud sync is not configured for this deployment.')
        return false
      }
      const trimmed = email.trim()
      if (!isEmail(trimmed)) {
        setError('That does not look like an email address.')
        return false
      }
      setResetting(true)
      setError(null)
      try {
        const { error: resetError } = await client.auth.resetPasswordForEmail(trimmed, {
          redirectTo: redirectTarget(),
        })
        if (resetError) throw resetError
        setResetSentTo(trimmed)
        return true
      } catch (cause) {
        setError(friendlyAuthError(cause, 'Could not send the reset email.'))
        return false
      } finally {
        setResetting(false)
      }
    },
    [client],
  )

  const resendConfirmation = useCallback(
    async (email: string) => {
      if (!client) return false
      setSending(true)
      setError(null)
      try {
        const { error: resendError } = await client.auth.resend({
          type: 'signup',
          email: email.trim(),
          options: { emailRedirectTo: redirectTarget() },
        })
        if (resendError) throw resendError
        return true
      } catch (cause) {
        setError(friendlyAuthError(cause, 'Could not resend the confirmation email.'))
        return false
      } finally {
        setSending(false)
      }
    },
    [client],
  )

  const updatePassword = useCallback(
    async (password: string) => {
      if (!client) {
        setError('Cloud sync is not configured for this deployment.')
        return false
      }
      if (password.length < 6) {
        setError('Passwords are at least 6 characters.')
        return false
      }
      setUpdatingPassword(true)
      setError(null)
      try {
        const { error: updateError } = await client.auth.updateUser({ password })
        if (updateError) throw updateError
        setRecovering(false)
        return true
      } catch (cause) {
        setError(friendlyAuthError(cause, 'Could not update your password.'))
        return false
      } finally {
        setUpdatingPassword(false)
      }
    },
    [client],
  )

  const cancelRecovery = useCallback(async () => {
    setRecovering(false)
    if (!client) return
    await client.auth.signOut()
  }, [client])

  const signOut = useCallback(async () => {
    if (!client) return
    setError(null)
    await client.auth.signOut()
    setLinkSentTo(null)
    setResetSentTo(null)
    setRecovering(false)
    // The PWA caches the app shell; drop it so a signed-out reload hits the edge
    // middleware and is sent to /auth rather than served from the cache.
    navigator.serviceWorker?.controller?.postMessage({ type: 'adt:clear-shell' })
  }, [client])

  const verifyEmailCode = useCallback(
    async (email: string, code: string) => {
      if (!client) {
        setError('Cloud sync is not configured for this deployment.')
        return false
      }
      const trimmedEmail = email.trim()
      const trimmedCode = code.replace(/\s+/g, '')
      if (!/^\d{6,10}$/.test(trimmedCode)) {
        setError('Enter the numeric code from the email (it is 6 to 8 digits).')
        return false
      }
      setVerifying(true)
      setError(null)
      try {
        const { error: verifyError } = await client.auth.verifyOtp({
          email: trimmedEmail,
          token: trimmedCode,
          type: 'email',
        })
        if (verifyError) throw verifyError
        setLinkSentTo(null)
        return true
      } catch (cause) {
        setError(friendlyAuthError(cause, 'That code could not be verified. Check it and try again.'))
        return false
      } finally {
        setVerifying(false)
      }
    },
    [client],
  )

  return {
    status,
    session,
    user: session?.user ?? null,
    email: session?.user?.email ?? null,
    sending,
    verifying,
    signingIn,
    signingUp,
    resetting,
    updatingPassword,
    recovering,
    error,
    linkSentTo,
    resetSentTo,
    signInWithEmail,
    verifyEmailCode,
    signInWithPassword,
    signUpWithPassword,
    sendPasswordReset,
    resendConfirmation,
    updatePassword,
    cancelRecovery,
    signOut,
  }
}

/** Stable per-user identifier used to scope local cursors and cloud rows. */
export function cloudUserId(session: Session | null): string | null {
  return session?.user?.id ?? null
}
